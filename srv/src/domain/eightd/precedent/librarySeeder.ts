/**
 * Nạp case vào kho tiền lệ.
 *
 * ── Vì sao logic nằm ở đây chứ không trong script ──
 * Trên Cloud Foundry không có đường chạy script cục bộ đối với HDI container:
 * không ai cầm được credential của container để nối thẳng vào. Đặt logic ở tầng
 * domain thì cùng một hàm phục vụ được cả hai đường vào — CLI lúc chạy local, và
 * một action HTTP sau khi deploy.
 *
 * ── Vì sao đi qua `mapCase` ──
 * `mapCase` là đường đọc dữ liệu duy nhất của pipeline. Viết một parser thứ hai
 * ở đây nghĩa là hai cách hiểu cùng một file, và chúng sẽ lệch nhau ngay lần đầu
 * ai đó sửa định dạng — âm thầm, vì kho vẫn nạp được.
 */

import fs from 'node:fs';
import path from 'node:path';
import cds from '@sap/cds';
import { extractDeepCase, classifyAction, mapCase } from '../caseMapper';
import { tokenizeDefectText } from './scoring';
import { flattenPayload } from './sourceFields';
import { buildSearchText } from './searchText';
import { batchEmbed, currentEmbeddingModel } from '../../../core/ai/llmClient';
import {
    HISTORICAL_ACTIONS,
    HISTORICAL_CASES,
    HISTORICAL_TEAM,
} from './precedentRepository';
import { clearRetrievalConfigCache } from './configRepository';
import { DEFAULT_STEP_PROMPTS } from './defaults';
import { allocateNumber } from '../../numberRange';
import { classifyTaskCode } from '../../../../../shared/task-catalogue';
import type { CaseContext } from '../types';

const LOG = cds.log('library-seed');

export interface SeedReport {
    inserted: number;
    replaced: number;
    skipped: Array<{ index: number; notificationId: string | null; reason: string }>;
    total: number;
}

/** Số EUR có thể là chuỗi trong workbook — chỉ ghi khi ra được số thật. */
function numberOrNull(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function emptyToNull(v: unknown): string | null {
    const s = String(v ?? '').trim();
    return s === '' ? null : s;
}

/** Hai đường vào kho. Không có đường thứ ba — xem `HistoricalCases.provenance`. */
export type CaseProvenance = 'imported' | 'closed-in-app';

export interface WriteCaseOptions {
    provenance: CaseProvenance;
    /** Lượt chạy 8D đã đóng case. Chỉ có với `closed-in-app`. */
    sourceReportID?: string | null;
    /**
     * Ghi đè trạng thái SAP và ngày hoàn tất.
     *
     * Case đóng ở D8 thì trạng thái là một SỰ KIỆN vừa xảy ra, không phải thứ đọc
     * lại từ payload lúc phân tích — payload đó được nhập khi case còn đang mở.
     */
    sapStatus?: string | null;
    completionDate?: string | null;
}

/**
 * Ghi MỘT case vào kho: dòng chính, nhóm 8D, và danh sách hành động.
 *
 * ── Vì sao là hàm riêng, không nằm trong `seedLibrary` ──
 * Từ Phase 5 kho có hai đường vào — nạp hàng loạt, và case do chính app đóng ở
 * D8. Cả hai phải sinh ra dòng GIỐNG HỆT nhau về hình dạng: cùng `defectKeywords`
 * tách bằng cùng một hàm, cùng `searchText` ghép bằng cùng một công thức, cùng
 * `attributesJson`. Hai chỗ chép lại logic này sẽ lệch nhau ở lần sửa kế tiếp, và
 * hậu quả là những case app tự đóng lặng lẽ không bao giờ ăn điểm — đúng cái bẫy
 * mà `EightDService.cds:88` đã cảnh báo.
 *
 * Thay thế theo `notificationId`: kho phải đúng MỘT dòng mỗi case.
 */
export async function writeHistoricalCase(
    db: any,
    ctx: CaseContext,
    raw: unknown,
    opts: WriteCaseOptions,
): Promise<{ ID: string; replaced: boolean }> {
    const notificationId = ctx.notificationId;

    const existing = await db.run(
        SELECT.one.from(HISTORICAL_CASES).columns('ID').where({ notificationId }),
    );
    if (existing) {
        // Xoá con trước rồi mới xoá cha: ở tầng db thuần không có cascade
        // nào chạy hộ, và team mồ côi sẽ vẫn được D1 đếm.
        await db.run(DELETE.from(HISTORICAL_TEAM).where({ historicalCase_ID: existing.ID }));
        await db.run(DELETE.from(HISTORICAL_ACTIONS).where({ historicalCase_ID: existing.ID }));
        await db.run(DELETE.from(HISTORICAL_CASES).where({ ID: existing.ID }));
    }

    const ID = cds.utils.uuid();
    await db.run(
        INSERT.into(HISTORICAL_CASES).entries({
            ID,
            notificationId,
            origin: emptyToNull(ctx.origin),
            symptomShortText: emptyToNull(ctx.header.symptomShortText),
            sapStatus: emptyToNull(opts.sapStatus ?? ctx.header.status),
            foundDate: ctx.header.foundDate,
            completionDate: opts.completionDate ?? ctx.header.completionDate,
            quantityExtent: emptyToNull(ctx.header.quantityExtent),

            workCenterId: emptyToNull(ctx.product.workCenterId),
            workCenterDesc: emptyToNull(ctx.product.workCenterDesc),
            defectCodeGroup: emptyToNull(ctx.product.defectCodeGroup),
            defectCode: emptyToNull(ctx.product.defectCode),
            defectText: emptyToNull(ctx.product.defectText),
            materialId: emptyToNull(ctx.product.materialId),
            materialDesc: emptyToNull(ctx.product.materialDesc),
            materialFamily: emptyToNull(ctx.product.materialGroup),

            // Tách bằng CHÍNH hàm mà lúc chấm điểm dùng. Hai cách tách
            // khác nhau ở hai đầu là lỗi không bao giờ báo.
            defectKeywords: tokenizeDefectText(ctx.product.defectText),

            // Gộp câu chữ của NGƯỜI VẬN HÀNH vào cùng tập token. `defectText` là
            // văn bản danh mục; `symptomShortText` là thứ người ta thật sự viết ra,
            // và nó chưa bao giờ được đem so — xem R3(b) và chú thích của cột.
            // Cùng một hàm, một lời gọi, nên hai nguồn không thể lệch cách tách.
            searchKeywords: tokenizeDefectText(
                `${ctx.product.defectText ?? ''} ${ctx.header.symptomShortText ?? ''}`,
            ),

            // Ghép sẵn; vector sinh sau ở `embedLibrary` để việc nạp kho
            // không phụ thuộc AI Core có thông hay không.
            searchText: buildSearchText(ctx),

            provenance: opts.provenance,
            sourceReportID: emptyToNull(opts.sourceReportID),

            batchId: emptyToNull(ctx.product.batchId),
            rootCauseCategory: ctx.rootCause?.category ?? null,
            copqEur: numberOrNull(ctx.copqEur),
            fmeaId: ctx.fmea?.fmeaId ?? null,

            sourcePayload: JSON.stringify(raw),

            // Làm phẳng NGAY lúc nạp, không parse lại lúc chấm: một lần
            // chấm duyệt cả kho × mọi tiêu chí, parse `sourcePayload`
            // trong vòng lặp đó là trả giá cho cùng một việc hàng nghìn lần.
            attributesJson: JSON.stringify(flattenPayload(raw)),
        }),
    );

    const team = [
        ...(ctx.team.leader ? [ctx.team.leader] : []),
        ...ctx.team.members,
    ];
    if (team.length) {
        await db.run(
            INSERT.into(HISTORICAL_TEAM).entries(
                team.map((m) => ({
                    ID: cds.utils.uuid(),
                    historicalCase_ID: ID,
                    partnerId: m.partnerId,
                    partnerName: m.partnerName,
                    functionTitle: m.functionTitle,
                    partnerRole: m.partnerRole,
                    email: emptyToNull(m.email),
                    phone: emptyToNull(m.phone),
                })),
            ),
        );
    }

    const allActions = [
        ...ctx.actions.containment,
        ...ctx.actions.corrective,
        ...ctx.actions.preventive,
    ];
    if (allActions.length) {
        await db.run(
            INSERT.into(HISTORICAL_ACTIONS).entries(
                allActions.map((a) => {
                    // Mã hoá ở ĐÚNG CHỖ NÀY, không ở phía gọi. Mọi đường vào kho
                    // — nạp dataset, đóng case trong app, seed lại — đều đi qua
                    // đây, nên đều nhận cùng một bộ luật. Đặt ở phía gọi là mở
                    // đường cho hai đường vào mã hoá khác nhau.
                    const coded = classifyTaskCode(a.actionText);
                    return {
                        ID: cds.utils.uuid(),
                        historicalCase_ID: ID,
                        lineNo: a.lineNo,
                        actionType: classifyAction(a.actionType) ?? a.actionType,
                        actionText: a.actionText,
                        status: a.status,
                        taskCode: coded?.taskCode ?? null,
                        taskCodeGroup: coded?.taskCodeGroup ?? null,
                        // Null khi nguồn không có. Dataset nhập vào không bao giờ
                        // có; case đóng trong app thì luôn có, vì người dùng đã
                        // điền chúng trên màn hình D3/D5/D7.
                        taskProcessor: emptyToNull(a.taskProcessor ?? ''),
                        timeEffort: numberOrNull(a.timeEffort),
                        plannedEndDate: emptyToNull(a.plannedEndDate ?? '') ,
                    };
                }),
            ),
        );
    }

    return { ID, replaced: Boolean(existing) };
}

/**
 * Nạp một mảng payload case vào kho.
 *
 * Thay thế theo `notificationId`: nạp lại cùng một case ghi đè bản cũ thay vì
 * tạo bản trùng. Kho phải đúng MỘT dòng mỗi case — trùng dòng là làm hỏng phép
 * đếm tần suất của D1 mà không có dấu hiệu gì.
 *
 * Case hỏng KHÔNG làm dừng cả mẻ: ghi vào `skipped` rồi đi tiếp. Dừng cả mẻ vì
 * một file lỗi nghĩa là 11 case còn lại cũng không vào được kho.
 */
export async function seedLibrary(payloads: readonly unknown[]): Promise<SeedReport> {
    const db = await cds.connect.to('db');
    const report: SeedReport = { inserted: 0, replaced: 0, skipped: [], total: payloads.length };

    for (let i = 0; i < payloads.length; i++) {
        const raw = payloads[i];
        let notificationId: string | null = null;

        try {
            if (!extractDeepCase(raw)) {
                report.skipped.push({ index: i, notificationId: null, reason: 'Not a recognisable 8D case payload' });
                continue;
            }

            const ctx = mapCase(raw);
            notificationId = ctx.notificationId;

            /**
             * Payload không khai số thông báo thì CẤP số, không bỏ qua.
             *
             * Từ Phase 1.7 quy ước của app là "để trống thì server đánh số" —
             * đúng cái mà màn Master Data hứa với người dùng. Bỏ qua ở đây nghĩa
             * là dán một file cũ không có cột notification vào hộp thoại import
             * thì mọi dòng biến mất kèm một lý do khó hiểu, trong khi tạo tay
             * cùng dữ liệu đó lại chạy.
             */
            if (!notificationId) {
                notificationId = await allocateNumber(db, 'DEFECT', async (code: string) => {
                    const hit = await db.run(
                        SELECT.one.from(HISTORICAL_CASES).columns('ID').where({ notificationId: code }),
                    );
                    return Boolean(hit);
                });
                ctx.notificationId = notificationId;
            }

            const { replaced } = await writeHistoricalCase(db, ctx, raw, { provenance: 'imported' });

            await ensureReportRecord(db, notificationId, ctx, raw);

            if (replaced) report.replaced++;
            else report.inserted++;
        } catch (e: any) {
            report.skipped.push({ index: i, notificationId, reason: e.message });
        }
    }

    clearRetrievalConfigCache();
    LOG.info(
        `Nạp kho: ${report.inserted} mới, ${report.replaced} ghi đè, ${report.skipped.length} bỏ qua`,
    );
    if (report.skipped.length) {
        for (const s of report.skipped) LOG.warn(`  bỏ qua #${s.index} ${s.notificationId ?? ''}: ${s.reason}`);
    }

    return report;
}

async function ensureReportRecord(db: any, notificationId: string, ctx: any, raw: any) {
    const existing = await db.run(
        SELECT.one.from('cnma.proresolve.Reports').columns('ID').where({ notificationId }),
    );
    if (existing) return;

    const reportID = cds.utils.uuid();
    await db.run(
        INSERT.into('cnma.proresolve.Reports').entries({
            ID: reportID,
            status: 'Analyzed',
            notificationId,
            origin: emptyToNull(ctx.origin),
            symptomShortText: emptyToNull(ctx.header.symptomShortText),
            sapStatus: emptyToNull(ctx.header.status),
            foundDate: ctx.header.foundDate,
            completionDate: ctx.header.completionDate,
            quantityExtent: emptyToNull(ctx.header.quantityExtent),
            defectQuantity: ctx.header.defectQuantity,
            defectQuantityUom: emptyToNull(ctx.header.defectQuantityUom ?? ''),
            teamSize: ctx.header.teamSize,
            plant: emptyToNull(ctx.product.plant),
            materialId: emptyToNull(ctx.product.materialId),
            materialDesc: emptyToNull(ctx.product.materialDesc),
            batchId: emptyToNull(ctx.product.batchId),
            defectCodeGroup: emptyToNull(ctx.product.defectCodeGroup),
            defectCode: emptyToNull(ctx.product.defectCode),
            defectText: emptyToNull(ctx.product.defectText),
            defectClass: emptyToNull(ctx.product.defectClass),
            workCenterId: emptyToNull(ctx.product.workCenterId),
            workCenterDesc: emptyToNull(ctx.product.workCenterDesc),
            copqEur: numberOrNull(ctx.copqEur),
            rootCauseCategory: ctx.rootCause?.category ?? null,
            fmeaId: ctx.fmea?.fmeaId ?? null,
            sourcePayload: JSON.stringify(raw),
            caseContext: JSON.stringify(ctx),
            internalSummary: `${ctx.header.symptomShortText} — Root cause: ${ctx.rootCause?.category ?? 'Investigated'}. Work center: ${ctx.product.workCenterDesc}.`,
            customerSummary: `Defect on ${ctx.product.materialDesc} resolved under 8D methodology.`,
            analyzedAt: new Date().toISOString(),
        }),
    );

    const disciplines = [
        {
            code: 'D1', sequence: 1, title: 'D1 — Team Roster',
            summary: 'Formed cross-functional 8D team.',
            resultJson: JSON.stringify({
                team: {
                    roster: (ctx.team.members || []).map((m: any) => ({
                        name: m.partnerName, organizationalRole: m.functionTitle,
                        assigned8DRole: m.partnerRole, caseResponsibility: m.functionTitle,
                    })),
                    assignedRoster: [
                        ...(ctx.team.leader ? [{ partnerId: ctx.team.leader.partnerId, partnerRole: '8D Team Leader' }] : []),
                        ...(ctx.team.members || []).map((m: any) => ({ partnerId: m.partnerId, partnerRole: m.partnerRole || '8D Team Member' })),
                    ],
                },
            }),
        },
        {
            code: 'D2', sequence: 2, title: 'D2 — Problem Description',
            summary: ctx.header.symptomShortText,
            resultJson: JSON.stringify({
                problem: {
                    statement: ctx.header.symptomShortText,
                    isIsNot: ctx.isIsNot || {},
                    w2h: ctx.w2h || {},
                },
            }),
        },
        {
            code: 'D3', sequence: 3, title: 'D3 — Containment Actions',
            summary: 'Containment actions established.',
            resultJson: JSON.stringify({
                containment: { actions: ctx.actions?.containment || [] },
            }),
        },
        {
            code: 'D4', sequence: 4, title: 'D4 — Root Cause Analysis',
            summary: `Root cause identified as ${ctx.rootCause?.category ?? 'Investigated'}.`,
            resultJson: JSON.stringify({
                rootCause: {
                    category: ctx.rootCause?.category,
                    whyChain: ctx.rootCause?.whyChain || [],
                    ishikawa: ctx.ishikawa || [],
                },
            }),
        },
        {
            code: 'D5', sequence: 5, title: 'D5 — Corrective Actions',
            summary: 'Permanent corrective actions defined.',
            resultJson: JSON.stringify({
                corrective: { actions: ctx.actions?.corrective || [] },
            }),
        },
        {
            code: 'D6', sequence: 6, title: 'D6 — Verification of Effectiveness',
            summary: 'Verification plan executed.',
            resultJson: JSON.stringify({
                verification: { status: 'Verified', notes: 'Corrective actions verified on line.' },
            }),
        },
        {
            code: 'D7', sequence: 7, title: 'D7 — Preventive Actions',
            summary: 'Preventive measures implemented.',
            resultJson: JSON.stringify({
                preventive: { actions: ctx.actions?.preventive || [] },
            }),
        },
        {
            code: 'D8', sequence: 8, title: 'D8 — Closure & Team Recognition',
            summary: '8D report closed.',
            resultJson: JSON.stringify({
                closure: { gate: { status: 'Closed', readyForClosure: true } },
            }),
        },
    ];

    const schemaByCode = new Map(DEFAULT_STEP_PROMPTS.map((p) => [p.stepCode, p.formSchemaJson]));

    await db.run(
        INSERT.into('cnma.proresolve.Disciplines').entries(
            disciplines.map((d) => ({
                ID: cds.utils.uuid(),
                report_ID: reportID,
                code: d.code,
                sequence: d.sequence,
                title: d.title,
                summary: d.summary,
                content: d.summary,
                aiGenerated: true,
                resultJson: d.resultJson,
                formSchemaJson: schemaByCode.get(d.code) ?? null,
            })),
        ),
    );
}

/**
 * Case đóng gói theo build, ở `srv/data/case-library/`.
 *
 * Thư mục này do `scripts/bundle-library.mjs` sinh ra từ `mock-data/clean/` và
 * nằm trong .gitignore — nó là ảnh chụp, không phải nguồn.
 */
const BUNDLE_DIR = path.resolve(__dirname, '../../../../data/case-library');

/**
 * Bù vào kho những case có trong dữ liệu đóng gói mà kho CHƯA có.
 *
 * Gọi lúc khởi động. Đây là đường duy nhất để kho có dữ liệu trên Cloud Foundry
 * mà không phải nới scope `admin` cho token kỹ thuật của chính app.
 *
 * ── Vì sao "bù case thiếu" chứ không phải "chỉ khi kho rỗng" ──
 * Bản đầu chỉ nạp khi kho rỗng. Hệ quả: thêm một case vào bộ mock rồi deploy lại
 * thì case đó KHÔNG BAO GIỜ lên tới cloud, vì kho đã có sẵn 12 dòng nên điều
 * kiện không bao giờ đúng — và không có gì báo.
 *
 * Case đã có thì không đụng tới: dữ liệu thật, hoặc phần ai đó đã chỉnh, phải
 * sống sót qua mọi lần deploy.
 */
export async function seedLibraryFromBundle(): Promise<SeedReport | null> {
    const db = await cds.connect.to('db');

    if (!fs.existsSync(BUNDLE_DIR)) {
        LOG.info('Không có dữ liệu đóng gói — bỏ qua. Nạp bằng action seedCaseLibrary.');
        return null;
    }

    const files = fs.readdirSync(BUNDLE_DIR).filter((f) => f.endsWith('.json')).sort();
    if (!files.length) return null;

    const existing = await db.run(
        SELECT.from(HISTORICAL_CASES).columns(
            'notificationId', 'searchText', 'attributesJson', 'searchKeywords',
        ),
    );
    /**
     * Chỉ coi là "đã có" khi dòng đó CÓ ĐỦ dữ liệu của schema hiện tại.
     *
     * Dòng nạp bằng bản code cũ hơn thiếu `searchText` — chúng tồn tại, nên phép
     * kiểm "đã có chưa" cho là đủ và bỏ qua; rồi bước nhúng lại bỏ qua tiếp vì
     * không có gì để nhúng. Kết quả: tiêu chí ngữ nghĩa im lặng không hoạt động,
     * và không có một dòng log nào nói tại sao.
     *
     * `attributesJson` nằm trong phép kiểm vì lý do y hệt: dòng cũ không có nó,
     * và mọi tiêu chí trỏ vào một đường dẫn payload sẽ lặng lẽ ăn 0 điểm trên
     * đúng những case đó — nhìn ra ngoài giống hệt "không có case nào giống".
     *
     * `searchKeywords` vào danh sách này cùng một lý do, và hậu quả còn kín hơn:
     * dòng thiếu nó không sinh ra đỉnh `Keyword` nào trong graph, nên case đó
     * đơn giản là KHÔNG BAO GIỜ được tìm thấy qua từ khoá — không lỗi, không log,
     * chỉ là một case lặng lẽ biến mất khỏi mọi kết quả của D4.
     *
     * Nạp lại từ bundle là an toàn: case thật không nằm trong bundle.
     */
    const complete = new Set(
        existing
            .filter((r: any) => r.searchText && r.attributesJson && r.searchKeywords)
            .map((r: any) => String(r.notificationId)),
    );
    const stale = existing.length - complete.size;

    const payloads: unknown[] = [];
    for (const f of files) {
        const raw = JSON.parse(fs.readFileSync(path.join(BUNDLE_DIR, f), 'utf8'));
        const nid = extractDeepCase(raw)?.notifications?.[0]?.notification_id;
        if (nid && complete.has(String(nid))) continue;
        payloads.push(raw);
    }

    if (!payloads.length) {
        LOG.info(`Kho đã có đủ ${complete.size} case của bộ đóng gói — không cần bù.`);
        return null;
    }

    LOG.info(
        `Nạp ${payloads.length} case từ bundle (kho đang có ${existing.length}`
        + (stale ? `, trong đó ${stale} thiếu searchText nên phải nạp lại` : '')
        + ').',
    );
    return seedLibrary(payloads);
}

/**
 * Sinh vector cho những case còn thiếu, chạy NGẦM sau khi app đã lên.
 *
 * Không `await` ở hook khởi động: nhúng 13 case mất ~7 giây và cần AI Core sống.
 * Chặn boot vì nó nghĩa là một sự cố bên AI làm app không khởi động được, trong
 * khi phần chấm điểm theo luật vốn không cần vector.
 */
export function embedLibraryInBackground(): void {
    cds.spawn({}, async () => {
        try {
            const r = await embedLibrary(false);
            if (r.embedded || r.failed) {
                LOG.info(`Nhúng lúc khởi động: ${r.embedded} xong, ${r.failed} lỗi, ${r.skipped} bỏ qua.`);
            }
        } catch (e: any) {
            LOG.warn(
                `Không nhúng được kho lúc khởi động (${e.message}) — `
                + 'tiêu chí ngữ nghĩa sẽ im lặng cho tới khi chạy lại action embedCaseLibrary.',
            );
        }
    });
}

export interface EmbedReport {
    model: string;
    embedded: number;
    skipped: number;
    failed: number;
    total: number;
    error?: string;
}

/** Nhúng theo mẻ; mẻ nhỏ để một lỗi không mất cả lượt chạy. */
const EMBED_BATCH = 8;

/**
 * Sinh vector cho các case trong kho.
 *
 * ── Vì sao tách khỏi `seedLibrary` ──
 * Nạp kho là thao tác DB thuần, luôn chạy được. Nhúng thì phụ thuộc AI Core:
 * chưa cấu hình credential, hết quota, model chưa deploy — bất cứ cái nào cũng
 * làm nó hỏng. Gộp chung thì một sự cố bên AI khiến kho không nạp được, trong
 * khi phần chấm điểm theo luật vốn không cần vector.
 *
 * @param force `false` (mặc định) chỉ nhúng case chưa có vector hoặc nhúng bằng
 *              model khác. `true` nhúng lại tất cả — dùng khi đổi công thức ghép
 *              `searchText`, vì lúc đó vector cũ không còn khớp với văn bản mới.
 */
export async function embedLibrary(force = false): Promise<EmbedReport> {
    const db = await cds.connect.to('db');
    const model = currentEmbeddingModel();

    const rows: Record<string, any>[] = await db.run(
        SELECT.from(HISTORICAL_CASES)
            .columns('ID', 'notificationId', 'searchText', 'embedding', 'embeddingModel')
            .orderBy('notificationId'),
    );

    const report: EmbedReport = { model, embedded: 0, skipped: 0, failed: 0, total: rows.length };

    const todo = rows.filter((r) => {
        if (!r.searchText) { report.skipped++; return false; }
        // Vector nhúng bằng model khác PHẢI làm lại, không được dùng lẫn.
        if (!force && r.embedding && r.embeddingModel === model) { report.skipped++; return false; }
        return true;
    });

    if (!todo.length) {
        LOG.info(`Nhúng: không có case nào cần làm (${report.skipped} đã có vector của "${model}")`);
        return report;
    }

    LOG.info(`Nhúng ${todo.length}/${rows.length} case bằng "${model}"…`);

    for (let i = 0; i < todo.length; i += EMBED_BATCH) {
        const batch = todo.slice(i, i + EMBED_BATCH);
        try {
            const vectors = await batchEmbed(batch.map((r) => String(r.searchText)));
            for (let k = 0; k < batch.length; k++) {
                const v = vectors[k];
                if (!Array.isArray(v) || !v.length) { report.failed++; continue; }
                await db.run(
                    UPDATE(HISTORICAL_CASES).set({
                        embedding: JSON.stringify(v),
                        embeddingModel: model,
                        embeddedAt: new Date().toISOString(),
                    }).where({ ID: batch[k].ID }),
                );
                report.embedded++;
            }
        } catch (e: any) {
            report.failed += batch.length;
            report.error = e.message;
            LOG.error(`Nhúng mẻ ${i / EMBED_BATCH + 1} thất bại: ${e.message}`);
        }
    }

    LOG.info(`Nhúng xong: ${report.embedded} thành công, ${report.failed} lỗi, ${report.skipped} bỏ qua`);
    return report;
}

/** Xoá sạch kho. Dùng khi muốn nạp lại từ đầu. */
export async function clearLibrary(): Promise<number> {
    const db = await cds.connect.to('db');
    const rows = await db.run(SELECT.from(HISTORICAL_CASES).columns('ID'));
    if (!rows.length) return 0;

    await db.run(DELETE.from(HISTORICAL_TEAM));
    await db.run(DELETE.from(HISTORICAL_ACTIONS));
    await db.run(DELETE.from(HISTORICAL_CASES));

    LOG.info(`Đã xoá ${rows.length} case khỏi kho`);
    return rows.length;
}
