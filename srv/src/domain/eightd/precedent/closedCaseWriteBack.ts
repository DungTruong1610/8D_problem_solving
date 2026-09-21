/**
 * Ghi case vừa đóng ở D8 ngược vào kho tiền lệ.
 *
 * ── Vì sao phải có bước này ──
 * Trước Phase 5, `HistoricalCases` chỉ được ghi ở đúng một chỗ: action nạp hàng
 * loạt. Nghĩa là app này KHÔNG BAO GIỜ học từ chính những case nó đóng — kho
 * đứng yên ở đúng số dòng lúc go-live, và mọi tiền lệ mà D1/D3/D4/D5/D8 trích
 * dẫn đều là dữ liệu di trú. Case thứ 200 do app xử lý vẫn được so với đúng bộ
 * case cũ như case thứ nhất.
 *
 * ── Vì sao dựng lại CaseContext chứ không ghi thẳng `Reports` ──
 * `Reports.caseContext` là bản chụp lúc PHÂN TÍCH: nó ghi những gì SAP đưa vào,
 * trước khi con người kết luận. Còn thứ đáng làm tiền lệ lại nằm ở
 * `Disciplines.resultJson` — nguyên nhân gốc đã duyệt, nhóm 8D đã chốt, hành
 * động đã giao, bài học đã viết. Ghi thẳng bối cảnh phân tích vào kho nghĩa là
 * lưu lại câu hỏi và vứt đi câu trả lời.
 *
 * Nên: lấy `caseContext` làm nền (nó giữ nguyên phần dữ kiện SAP), rồi PHỦ lên
 * đó kết luận của từng bước D.
 *
 * ── Vì sao `buildClosedCaseContext` là hàm thuần ──
 * Nó là chỗ dễ sai nhất của cả luồng: đọc JSON tự do do model sinh và người sửa,
 * với hai biến thể khoá ở mỗi trường (`actions` / `assignedActions`,
 * `statement` / `statementOverride`). Tách khỏi DB thì test được bằng bảng dữ
 * liệu, thay vì phải đóng một case thật mới biết mình map sai.
 */

import cds from '@sap/cds';
import type {
    ActionRow,
    CaseContext,
    FiveWhyRow,
    IshikawaRow,
    TeamRow,
} from '../types';
import { actionLabel, type SuggestedAction } from '../../../../../shared/action-task';
import { writeHistoricalCase } from './librarySeeder';

const LOG = cds.log('closed-case-writeback');

const REPORTS = 'cnma.proresolve.Reports';
const DISCIPLINES = 'cnma.proresolve.Disciplines';

/** Chỉ cần hai cột này để dựng lại kết luận — cố ý không nhận cả hàng. */
export interface DisciplineResultRow {
    code: string;
    resultJson?: string | null;
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function parseResult(raw: unknown): Record<string, any> {
    if (raw && typeof raw === 'object') return raw as Record<string, any>;
    const s = text(raw);
    if (!s) return {};
    try {
        const parsed = JSON.parse(s);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        // JSON hỏng ở MỘT bước không được làm hỏng cả lần ghi kho: phần còn lại
        // của case vẫn đáng lưu, và nền `caseContext` vẫn đứng vững.
        return {};
    }
}

function arrayOf(v: unknown): any[] {
    return Array.isArray(v) ? v.filter((x) => x != null) : [];
}

/**
 * Số EUR từ một ô người gõ tự do — chỉ nhận khi ra được số thật.
 *
 * ── Vì sao không chỉ `Number(...)` ──
 * Ô COPQ ở D8 là văn bản: '18,500 EUR', '18.500,00', 'Not quantified'. Hai luật
 * ở đây đều là chỗ đã từng sai câm:
 *
 *  · Bỏ hết ký tự không phải số rồi `Number('')` cho ra **0**, không phải NaN.
 *    Nghĩa là 'Not quantified' sẽ ghi 0 EUR vào kho — một con số trông như đã đo,
 *    và nó kéo trung bình chi phí của mọi case xuống mà không ai thấy.
 *
 *  · Dấu phân cách thì mơ hồ: '18,500' là 18500 kiểu Anh, '18,50' là 18,5 kiểu
 *    Đức. Luật dùng ở đây là luật chung của cả hai: dấu đứng SAU cùng là dấu thập
 *    phân khi có cả hai loại; còn một dấu đơn lẻ theo sau đúng ba chữ số thì là
 *    dấu phần nghìn. Đoán sai chiều này ghi 18,5 EUR thay cho 18.500.
 */
function numberOrNull(v: unknown): number | null {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;

    let s = String(v).replace(/[^\d.,-]/g, '');
    if (!/\d/.test(s)) return null;

    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastDot >= 0 && lastComma >= 0) {
        const dec = Math.max(lastDot, lastComma);
        s = `${s.slice(0, dec).replace(/[.,]/g, '')}.${s.slice(dec + 1).replace(/[.,]/g, '')}`;
    } else if (lastDot >= 0 || lastComma >= 0) {
        const parts = s.split(lastDot >= 0 ? '.' : ',');
        const grouped = parts.length > 2 || /^\d{3}$/.test(parts[parts.length - 1]);
        s = grouped ? parts.join('') : parts.join('.');
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

/**
 * Danh sách hành động đã CHỐT của một bước, ưu tiên bảng người giao việc.
 *
 * `assignedActions` là thứ con người xác nhận; `actions` mới chỉ là đề xuất của
 * AI. Kho tiền lệ phải lưu cái đã chốt — trích dẫn một hành động chưa ai nhận
 * làm bằng chứng cho case sau là dựng tiền lệ trên một lời đề nghị.
 *
 * ── Vì sao ba trường Quality Task chỉ lấy được ở nhánh `assignedActions` ──
 * Người thực hiện, công sức và hạn là những thứ CON NGƯỜI điền trên bảng phân
 * công. Nhánh `actions` là đề xuất thô của AI, không có chúng — nên một case
 * đóng mà chưa ai chốt task sẽ vào kho với ba ô trống, và điều đó là đúng.
 */
function actionsOf(result: Record<string, any>, key: string, type: string): ActionRow[] {
    const branch = result?.[key] ?? {};
    const rows = arrayOf(branch.assignedActions).length
        ? arrayOf(branch.assignedActions)
        : arrayOf(branch.actions);

    return rows
        .map((row) => ({
            actionText: text(row?.name) || actionLabel(row as SuggestedAction),
            status: text(row?.status) || 'Planned',
            taskProcessor: text(row?.assignee) || text(row?.owner) || null,
            // `durationDays: 0` nghĩa là CHƯA ƯỚC LƯỢNG, không phải "tốn 0 ngày".
            // Ghi 0 vào kho là biến "chưa ai ước lượng" thành một ước lượng.
            timeEffort: Number(row?.durationDays) > 0 ? Number(row.durationDays) : null,
            plannedEndDate: text(row?.plannedEndDate) || null,
        }))
        .filter((row) => row.actionText)
        // Đánh số LẠI sau khi lọc: `lineNo` là số dòng người đọc thấy trong panel
        // tiền lệ, nên một khoảng trống ở giữa trông như case bị mất một hành động.
        .map((row, i) => ({ lineNo: i + 1, actionType: type, ...row }));
}

/** Nhóm 8D đã chốt ở D1, giữ lại email/phone của bản gốc theo `partnerId`. */
function teamOf(result: Record<string, any>, base: CaseContext['team']): CaseContext['team'] | null {
    const roster = arrayOf(result?.team?.assignedRoster);
    if (!roster.length) return null;

    const contactById = new Map<string, TeamRow>();
    for (const m of [...(base.leader ? [base.leader] : []), ...base.members]) {
        contactById.set(String(m.partnerId), m);
    }

    const rows: TeamRow[] = roster.flatMap((r) => {
        const partnerId = text(r?.partnerId);
        if (!partnerId) return [];
        const known = contactById.get(partnerId);
        return [{
            partnerId,
            partnerName: text(r?.partnerName) || known?.partnerName || '',
            functionTitle: text(r?.functionTitle) || known?.functionTitle || '',
            partnerRole: text(r?.partnerRole) || known?.partnerRole || '8D Team Member',
            email: known?.email ?? null,
            phone: known?.phone ?? null,
        }];
    });
    if (!rows.length) return null;

    const leaderIndex = rows.findIndex((r) => /leader/i.test(r.partnerRole));
    return leaderIndex >= 0
        ? { leader: rows[leaderIndex], members: rows.filter((_, i) => i !== leaderIndex) }
        : { leader: null, members: rows };
}

/**
 * Phủ kết luận của tám bước D lên bối cảnh lúc phân tích.
 *
 * Nguyên tắc xuyên suốt: bước D nào KHÔNG nói gì thì giữ nguyên bản nền. Ghi đè
 * bằng giá trị rỗng là cách chắc chắn nhất để một case đóng đúng quy trình lại
 * vào kho nghèo hơn chính bản phân tích của nó.
 */
export function buildClosedCaseContext(
    base: CaseContext,
    disciplines: readonly DisciplineResultRow[],
): CaseContext {
    const byCode = new Map<string, Record<string, any>>();
    for (const d of disciplines) byCode.set(String(d.code ?? ''), parseResult(d.resultJson));

    const d1 = byCode.get('D1') ?? {};
    const d2 = byCode.get('D2') ?? {};
    const d3 = byCode.get('D3') ?? {};
    const d4 = byCode.get('D4') ?? {};
    const d5 = byCode.get('D5') ?? {};
    const d7 = byCode.get('D7') ?? {};
    const d8 = byCode.get('D8') ?? {};

    const ctx: CaseContext = {
        ...base,
        header: { ...base.header },
        product: { ...base.product },
        team: { leader: base.team?.leader ?? null, members: [...(base.team?.members ?? [])] },
        actions: {
            containment: [...(base.actions?.containment ?? [])],
            corrective: [...(base.actions?.corrective ?? [])],
            preventive: [...(base.actions?.preventive ?? [])],
        },
    };

    // ── D1 · nhóm đã chốt ────────────────────────────────────────────────────
    const team = teamOf(d1, ctx.team);
    if (team) {
        ctx.team = team;
        ctx.header.teamSize = (team.leader ? 1 : 0) + team.members.length;
    }

    // ── D2 · phát biểu vấn đề ────────────────────────────────────────────────
    // Bản kỹ sư sửa thắng bản AI viết: đó là toàn bộ lý do `statementOverride`
    // tồn tại thành một field riêng thay vì ghi đè lên `statement`.
    const statement = text(d2?.problem?.statementOverride) || text(d2?.problem?.statement);
    if (statement) ctx.header.symptomShortText = statement;

    const is = arrayOf(d2?.problem?.is).map(text).filter(Boolean);
    const isNot = arrayOf(d2?.problem?.isNot).map(text).filter(Boolean);
    if (is.length || isNot.length) {
        ctx.isIsNot = {
            is: is.join('; '),
            isNot: isNot.join('; '),
            notes: text(d2?.problem?.isIsNotBasis) || base.isIsNot?.notes || null,
        };
    }

    // ── D3 / D5 / D7 · hành động đã giao ─────────────────────────────────────
    const containment = actionsOf(d3, 'containment', 'Containment');
    const corrective = actionsOf(d5, 'corrective', 'Corrective');
    const preventive = actionsOf(d7, 'preventive', 'Preventive');
    if (containment.length) ctx.actions.containment = containment;
    if (corrective.length) ctx.actions.corrective = corrective;
    if (preventive.length) ctx.actions.preventive = preventive;

    // ── D4 · nguyên nhân gốc ─────────────────────────────────────────────────
    const board = arrayOf(d4?.rootCause?.ishikawaBoard);
    if (board.length) {
        const ishikawa: IshikawaRow[] = board.flatMap((r) => {
            const category = text(r?.category);
            const description = text(r?.finding);
            if (!category || !description) return [];
            return [{
                category,
                description,
                metricValue: null,
                isRootCause: Boolean(r?.isRootCause),
                source: text(r?.source) || 'recorded',
            }];
        });
        if (ishikawa.length) ctx.ishikawa = ishikawa;
    }

    const fiveWhy = arrayOf(d4?.rootCause?.fiveWhy).flatMap((r, i): FiveWhyRow[] => {
        const question = text(r?.why);
        if (!question) return [];
        const stepNo = Number(r?.step);
        return [{
            stepNo: Number.isFinite(stepNo) && stepNo > 0 ? stepNo : i + 1,
            question,
            answer: text(r?.answer),
            evidenceCitation: text(r?.evidence),
            isRootCauseStep: /root cause/i.test(question),
        }];
    });
    if (fiveWhy.length) ctx.fiveWhy = fiveWhy;

    const rootStatement = text(d4?.rootCause?.statement);
    // Nhánh 6M được đánh dấu là gốc THẮNG `rootCauseCategory` lúc phân tích:
    // chính nó là kết luận vừa được duyệt, còn cột kia là giá trị SAP mang sang.
    const rootBranch = ctx.ishikawa?.find((r) => r.isRootCause) ?? null;
    if (rootStatement || rootBranch) {
        ctx.rootCause = {
            category: rootBranch?.category ?? base.rootCause?.category ?? '',
            description: rootStatement || rootBranch?.description || base.rootCause?.description || '',
            metricValue: base.rootCause?.metricValue ?? null,
            source: rootBranch?.source ?? base.rootCause?.source ?? 'D4',
        };
    }

    // ── D8 · bài học và chi phí ──────────────────────────────────────────────
    const whatWorked = text(d8?.closure?.lessonsWhatWorked);
    const whatDidnt = text(d8?.closure?.lessonsWhatDidNot);
    if (whatWorked || whatDidnt) {
        ctx.lessonsLearned = {
            whatWorked: whatWorked || base.lessonsLearned?.whatWorked || '',
            whatDidnt: whatDidnt || base.lessonsLearned?.whatDidnt || '',
        };
    }

    const copq = numberOrNull(d8?.closure?.costOfPoorQuality);
    if (copq !== null) ctx.copqEur = copq;

    return ctx;
}

export interface WriteBackResult {
    /** ID dòng kho vừa ghi. Null khi bỏ qua (không có gì để ghi). */
    historicalCaseID: string | null;
    notificationId: string | null;
    replaced: boolean;
    skippedReason?: string;
}

/**
 * Đọc report đã đóng, dựng bối cảnh, ghi vào kho.
 *
 * Không mở transaction riêng — xem lời cảnh báo đầu `eightDRepository.ts`: driver
 * SQLite của CAP chỉ có một connection cho mỗi tenant, nên tạo tx lồng trong tx
 * của request là tự khoá chính mình.
 */
export async function writeClosedCaseToLibrary(reportID: string): Promise<WriteBackResult> {
    const db = await cds.connect.to('db');

    const report = await SELECT.one.from(REPORTS)
        .columns('ID', 'notificationId', 'caseContext', 'sourcePayload', 'completionDate')
        .where({ ID: reportID });

    if (!report) {
        return { historicalCaseID: null, notificationId: null, replaced: false, skippedReason: `Report ${reportID} not found.` };
    }

    const notificationId = text(report.notificationId);
    if (!notificationId) {
        // Không tự cấp số ở đây: một dòng kho không tra ngược được về case nào
        // trong SAP thì không dùng làm tiền lệ được, và cấp số mới chỉ tạo ra một
        // mã trông hợp lệ mà không tồn tại ở đâu cả.
        return { historicalCaseID: null, notificationId: null, replaced: false, skippedReason: 'Report has no notification ID.' };
    }

    let base: CaseContext;
    try {
        base = JSON.parse(String(report.caseContext ?? '')) as CaseContext;
    } catch {
        return { historicalCaseID: null, notificationId, replaced: false, skippedReason: 'Report has no usable caseContext.' };
    }
    if (!base || typeof base !== 'object' || !base.header || !base.product) {
        return { historicalCaseID: null, notificationId, replaced: false, skippedReason: 'Report has no usable caseContext.' };
    }
    base.notificationId = notificationId;

    const disciplines: DisciplineResultRow[] = await SELECT.from(DISCIPLINES)
        .columns('code', 'resultJson')
        .where({ report_ID: reportID }) as unknown as DisciplineResultRow[];

    const ctx = buildClosedCaseContext(base, disciplines);

    let raw: unknown = null;
    try {
        raw = JSON.parse(String(report.sourcePayload ?? 'null'));
    } catch { /* payload hỏng thì dòng kho vẫn ghi được, chỉ mất phần tra ngược. */ }

    const completionDate = report.completionDate
        ? String(report.completionDate)
        : new Date().toISOString().slice(0, 10);

    const { ID, replaced } = await writeHistoricalCase(db, ctx, raw ?? { closedInApp: true, reportID }, {
        provenance: 'closed-in-app',
        sourceReportID: reportID,
        sapStatus: 'Completed',
        completionDate,
    });

    LOG.info(
        `Case ${notificationId} ${replaced ? 'ghi đè' : 'thêm mới'} vào kho tiền lệ từ report ${reportID}.`,
    );

    return { historicalCaseID: ID, notificationId, replaced };
}
