/**
 * Đọc/ghi báo cáo 8D.
 *
 * ── TUYỆT ĐỐI KHÔNG dùng `cds.tx()` ở tầng này ──
 * Driver SQLite của CAP giữ ĐÚNG MỘT connection cho mỗi tenant
 * (`libx/_runtime/sqlite/Service.js`), tuần tự hoá bằng cờ `_busy` và một hàng
 * đợi KHÔNG có timeout. Transaction chiếm connection ở `begin()` và chỉ nhả ở
 * `commit()`.
 *
 * Nghĩa là: tạo một transaction độc lập trong khi transaction khác đang mở =
 * tự khoá chính mình, treo vĩnh viễn. Bản đầu của file này mắc đúng lỗi đó —
 * `createReport` chạy lọt (chưa có tx nào mở), rồi `getGlobalModelConfig` mở tx
 * của request, rồi `saveResult` xếp hàng chờ mãi mãi. Cả bốn case seed đều treo
 * đủ 240 giây trước khi client bỏ cuộc.
 *
 * Mọi hàm ở đây dùng transaction sẵn có của lời gọi. Việc tách vòng đời được
 * giải quyết ở tầng trên bằng `cds.spawn` — xem `srv/src/services/eightDService.ts`.
 */

import cds from '@sap/cds';
import type { AnalyzeOutcome, CaseContext, DisciplineCode } from './types';
import {
    evaluateClosureGate,
    normalizeStatus,
    type ClosureGate,
    type ReviewStatus,
} from './review';
import {
    parseConfirmedFields,
} from './fieldConfirm';
import { assignedFieldFor, normalizeActionStatus, normalizeTasks } from '../../../../shared/action-task';
import { getPath } from './runtimeConfig';
import { writeClosedCaseToLibrary, type WriteBackResult } from './precedent/closedCaseWriteBack';

const REPORTS = 'cnma.proresolve.Reports';
const DISCIPLINES = 'cnma.proresolve.Disciplines';
const REVIEW_EVENTS = 'cnma.proresolve.ReviewEvents';
const TASK_EVIDENCES = 'cnma.proresolve.TaskEvidences';
const HISTORICAL_TEAM_MEMBERS = 'cnma.proresolve.HistoricalTeamMembers';

export interface ReportRow {
    ID: string;
    notificationId: string;
    status: string;
    sourcePayload: string;
}

/**
 * Ngày ISO, hoặc null cho mọi thứ khác.
 *
 * `customer.slaResponseDue` là chuỗi tự do: ngày ISO ở case Q1, và sentinel
 * 'N/A' / 'N/A - Internal Defect' ở case nội bộ. Cột `Reports.slaResponseDue`
 * là kiểu Date và tồn tại để so với hôm nay — nên bất cứ thứ gì không phải một
 * ngày thật đều phải thành null chứ không phải thành một ngày đoán ra.
 *
 * Kiểm cả regex lẫn `Date.parse`: '2026-13-45' khớp regex nhưng không phải ngày.
 */
export function isoDateOrNull(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    return Number.isNaN(Date.parse(s)) ? null : s;
}

/**
 * Số hiệu khiếu nại của khách, hoặc null khi case không có khách.
 *
 * `customer.complaintReference` cũng là chuỗi tự do như `slaResponseDue`, và ở
 * case nội bộ nó mang nguyên một câu tiếng Anh: 'N/A - internal defect, no
 * customer reference'. Đổ câu đó vào một cột dài 50 ký tự rồi hiển thị nó cạnh
 * nhãn Origin thì cột trông như có dữ liệu trong khi thực ra không có.
 *
 * Bắt mọi biến thể bắt đầu bằng 'N/A', không chỉ đúng hai chuỗi đã thấy: đây là
 * trường do người và do model điền, và danh sách sentinel sẽ còn dài ra.
 */
export function customerRefOrNull(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    if (!s) return null;
    if (/^n\s*\/?\s*a\b/i.test(s)) return null;
    return s.slice(0, 50);
}

/** Trưởng nhóm trong `team.assignedRoster` của D1. Cả hai trường đều có thể rỗng. */
export interface TeamLeaderRef {
    name: string | null;
    partnerId: string | null;
}

/**
 * Trưởng nhóm trong `team.assignedRoster` của D1, hoặc null nếu chưa chốt.
 *
 * Trả về CẢ hai trường thay vì một chuỗi đã chọn sẵn, vì hai trường trả lời hai
 * câu hỏi khác nhau: `name` là thứ hiển thị được, `partnerId` là thứ tra được
 * trong danh bạ. Bảng nhân sự trong dữ liệu thật chỉ lưu `partnerId` — gộp sớm
 * thành một chuỗi là vứt mất khoá tra cứu và ép worklist hiện số hiệu.
 */
export function teamLeaderRefFrom(resultJson: unknown): TeamLeaderRef | null {
    let data: any;
    try {
        data = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
    } catch { return null; }

    const roster = Array.isArray(data?.team?.assignedRoster) ? data.team.assignedRoster : [];
    const leader = roster.find((r: any) => r?.partnerRole === '8D Team Leader');
    if (!leader) return null;

    const name = String(leader.partnerName ?? '').trim();
    // `BP-100014` và `100014` là cùng một người. Danh bạ lưu dạng đã gọt tiền tố,
    // nên gọt ở đây, nếu không mọi lần tra đều trượt mà không báo gì.
    const partnerId = String(leader.partnerId ?? '').trim().replace(/^BP-/i, '');
    if (!name && !partnerId) return null;
    return { name: name || null, partnerId: partnerId || null };
}

/**
 * Tên trưởng nhóm suy ra CHỈ từ D1, không tra danh bạ.
 *
 * `partnerName` là thứ người đọc worklist cần; `partnerId` là thứ luôn có. Rơi
 * về ID còn hơn để trống — một ô trống nói "chưa chốt trưởng nhóm", điều đó ở
 * đây là sai. `syncTeamLeader` cải thiện thêm bằng cách tra danh bạ trước khi
 * chấp nhận số hiệu.
 */
export function teamLeaderFrom(resultJson: unknown): string | null {
    const ref = teamLeaderRefFrom(resultJson);
    return ref ? ref.name ?? ref.partnerId : null;
}

/** Số EUR có thể là chuỗi trong workbook — chỉ ghi khi ra được số thật. */
function numberOrNull(v: unknown): number | null {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/**
 * Tạo bản ghi ở trạng thái `Analyzing`.
 *
 * Gọi từ handler của request, nên nó commit ngay khi handler trả về — trước khi
 * pipeline AI bắt đầu chạy ở nền. Nhờ vậy UI thấy case "đang phân tích" ngay lập
 * tức thay vì chờ một phút không biết chuyện gì xảy ra.
 */
export async function createReport(
    payload: string,
    context: CaseContext,
    title?: string,
    /**
     * Số lỗi (`Defects.defectId`) mà báo cáo này mở ra từ đó — chỉ có ở đường
     * `startEightD`. Đường dán JSON để trống, vì payload dán vào không đến từ
     * một bản ghi lỗi nào trong hệ thống này.
     */
    sourceDefectId?: string | null,
    /**
     * Hai CAM KẾT do người mở 8D nhập, ghi đè giá trị suy từ payload.
     *
     * ── Vì sao là ghi đè chứ không phải một cột riêng ──
     * `slaResponseDue` suy từ `caseContext.customer.slaResponseDue` chỉ có giá
     * trị ở case Q1; case nội bộ ra null, và theo quyết định Q12 hệ thống KHÔNG
     * được tự bịa một hạn cho chúng. Nhưng "hệ thống không bịa" khác với "không
     * ai được cam kết": một điều phối viên gõ ngày vào ô này là một CON NGƯỜI
     * cam kết, và đó chính là thứ Q12 muốn có. Nên cùng một cột, hai đường ghi.
     *
     * Để trống thì rơi về giá trị suy từ payload — không phải ghi đè bằng null,
     * vì như thế mở 8D mà không nhập gì sẽ XOÁ mất hạn SLA thật của case Q1.
     */
    commitments?: {
        slaResponseDue?: string | null;
        coordinator?: string | null;
    },
): Promise<string> {
    const ID = cds.utils.uuid();

    const committedDue = isoDateOrNull(commitments?.slaResponseDue);
    const committedCoordinator = commitments?.coordinator?.trim() || null;

    await INSERT.into(REPORTS).entries({
        ID,
        status: 'Analyzing',
        sourceDefectId: sourceDefectId?.trim() || null,

        notificationId: context.notificationId,
        origin: context.origin,
        symptomShortText: title?.trim() || context.header.symptomShortText,
        sapStatus: context.header.status,
        foundDate: context.header.foundDate,
        completionDate: context.header.completionDate,
        quantityExtent: context.header.quantityExtent,
        defectQuantity: context.header.defectQuantity,
        defectQuantityUom: context.header.defectQuantityUom,
        teamSize: context.header.teamSize,
        // Ba cột này đã có trong `Reports` từ trước nhưng chưa ai ghi, nên luôn null
        // trong DB dù `caseContext` giữ đúng giá trị. Danh sách case lọc theo cột,
        // không theo JSON — để trống là tự làm mù bộ lọc.
        entryMode: context.header.entryMode ?? null,
        inspectionLotId: context.header.inspectionLotId ?? null,
        referenceNumber: context.header.referenceNumber ?? null,

        // Hai cột của worklist. `teamLeader` KHÔNG được đặt ở đây: lúc này chưa
        // có D1 nào, nên mọi giá trị viết vào cũng chỉ là phỏng đoán. Nó được
        // ghi khi kỹ sư chốt bảng nhân sự — xem `syncTeamLeader`.
        customerRef: customerRefOrNull(context.customer?.complaintReference),
        // Cam kết người dùng gõ đi trước; để trống thì rơi về giá trị suy từ
        // payload. KHÔNG phải `committedDue ?? null` — mở 8D mà bỏ trống ô hạn
        // sẽ xoá mất SLA thật của một case Q1.
        slaResponseDue: committedDue ?? isoDateOrNull(context.customer?.slaResponseDue),
        coordinator: committedCoordinator ?? context.responsibility?.coordinator ?? null,

        plant: context.product.plant,
        materialId: context.product.materialId,
        materialDesc: context.product.materialDesc,
        batchId: context.product.batchId,
        defectCodeGroup: context.product.defectCodeGroup,
        defectCode: context.product.defectCode,
        defectText: context.product.defectText,
        defectClass: context.product.defectClass,
        workCenterId: context.product.workCenterId,
        workCenterDesc: context.product.workCenterDesc,

        copqEur: numberOrNull(context.copqEur),
        rootCauseCategory: context.rootCause?.category ?? null,
        fmeaId: context.fmea?.fmeaId ?? null,

        sourcePayload: payload,
        caseContext: JSON.stringify(context),
    });

    return ID;
}

export interface PartialDisciplineItem {
    discipline: import('./types').DisciplineDraft;
    runtime?: {
        resultJson?: string;
        formSchemaJson?: string;
        validationJson?: string;
        configVersion?: string;
    };
}

/** Ghi/Cập nhật một discipline riêng lẻ vào DB cho báo cáo. */
export async function savePartialDiscipline(
    reportID: string,
    item: PartialDisciplineItem,
): Promise<void> {
    const d = item.discipline;
    await DELETE.from(DISCIPLINES).where({ report_ID: reportID, code: d.code });
    await INSERT.into(DISCIPLINES).entries({
        ID: cds.utils.uuid(),
        report_ID: reportID,
        code: d.code,
        sequence: d.sequence,
        title: d.title,
        summary: d.summary,
        content: d.content,
        actionItems: JSON.stringify(d.actionItems ?? []),
        sources: JSON.stringify(d.sources ?? []),
        confidence: d.confidence,
        dataBacked: d.dataBacked,
        resultJson: item.runtime?.resultJson ?? JSON.stringify(d.data ?? {}),
        formSchemaJson: item.runtime?.formSchemaJson ?? null,
        validationJson: item.runtime?.validationJson ?? null,
        configVersion: item.runtime?.configVersion ?? null,
        aiGenerated: true,
        reviewStatus: 'Draft',
        workState: 'InProgress',
    });
}

/**
 * Sửa hạn cam kết và người điều phối của một case đã tạo.
 *
 * Khác `createReport`: ở đây `null` nghĩa là XOÁ, không phải "rơi về giá trị suy
 * từ payload". Đây là màn hình sửa — người dùng xoá ô ngày là muốn ô đó trống.
 *
 * Trả về `false` khi không có dòng nào mang `reportID` đó, để tầng service phân
 * biệt "sửa xong" với "không tìm thấy" mà không phải truy vấn thêm một lần.
 */
export async function setCaseCommitments(
    reportID: string,
    commitments: { slaResponseDue: string | null; coordinator: string | null },
): Promise<boolean> {
    const affected = await UPDATE(REPORTS)
        .set({
            slaResponseDue: commitments.slaResponseDue,
            coordinator: commitments.coordinator,
        })
        .where({ ID: reportID });
    return Number(affected) > 0;
}

/** Ghi context, chẩn đoán mù và tiền lệ sớm cho report để UI đọc được ngay. */
export async function saveReportContext(
    reportID: string,
    context: CaseContext,
    independent?: unknown,
    precedents?: unknown,
): Promise<void> {
    const ind = independent as
        | { finding?: { confidence?: number }; verdict?: { recordedCategory?: string | null; aiCategory?: string; agrees?: boolean | null } }
        | undefined;
    // Ghi lại ba cột worklist từ context ĐÃ làm giàu. `createReport` viết chúng
    // từ context thô; `enrichFromDatabase` có thể BỔ SUNG đúng mấy trường này, và
    // bỏ qua ở đây thì cột sẽ nói một đằng, `caseContext` một nẻo — sai lệch
    // không bao giờ báo lỗi, chỉ hiện sai ngày đến hạn.
    //
    // ── Vì sao "bổ sung" chứ không phải "ghi đè" ──
    // Hai cột `slaResponseDue` và `coordinator` có thể đã mang CAM KẾT do người mở
    // 8D gõ tay (xem `commitments` ở `createReport`). Làm giàu từ DB rồi ghi đè
    // thẳng sẽ lặng lẽ thay ngày người ta vừa hứa bằng ngày suy từ payload — đúng
    // cái người dùng cố ý sửa. Nên chỉ lấp chỗ trống, không đụng vào chỗ đã có.
    const current = await SELECT.one
        .from(REPORTS)
        .columns('slaResponseDue', 'coordinator')
        .where({ ID: reportID });

    const enrichedDue = isoDateOrNull(context.customer?.slaResponseDue);
    const enrichedCoordinator = context.responsibility?.coordinator ?? null;

    await UPDATE(REPORTS).set({
        caseContext: JSON.stringify(context),
        customerRef: customerRefOrNull(context.customer?.complaintReference),
        slaResponseDue: current?.slaResponseDue ?? enrichedDue,
        coordinator: current?.coordinator ?? enrichedCoordinator,
        precedentsJson: precedents ? JSON.stringify(precedents) : null,
        aiFinding: ind ? JSON.stringify(ind) : null,
        aiRootCause: ind?.verdict?.aiCategory ?? null,
        aiAgreesWithRecord: ind?.verdict?.recordedCategory ? (ind.verdict.agrees ?? null) : null,
        aiConfidence: numberOrNull(ind?.finding?.confidence),
    }).where({ ID: reportID });
}

/** Hoàn tất phân tích report: ghi hai bản tóm tắt, cập nhật status Analyzed và số đo. */
export async function finalizeReport(
    reportID: string,
    summaryInfo: {
        internalSummary?: string | null;
        customerSummary?: string | null;
        models: { parse: string; analyze: string };
        tokensUsed: number;
        durationMs: number;
    },
): Promise<void> {
    await UPDATE(REPORTS).set({
        status: 'Analyzed',
        internalSummary: summaryInfo.internalSummary ?? null,
        customerSummary: summaryInfo.customerSummary ?? null,
        aiModelParse: summaryInfo.models.parse,
        aiModelAnalyze: summaryInfo.models.analyze,
        analyzedAt: new Date().toISOString(),
        tokensUsed: summaryInfo.tokensUsed,
        durationMs: summaryInfo.durationMs,
        errorMessage: null,
    }).where({ ID: reportID });
}

/** Ghi kết quả và chuyển sang `Analyzed`. Xoá disciplines cũ trước — xem `reanalyze`. */
export async function saveResult(reportID: string, outcome: AnalyzeOutcome): Promise<void> {
    const { result, context, models, tokensUsed, durationMs } = outcome;

    await DELETE.from(DISCIPLINES).where({ report_ID: reportID });
    for (const d of result.disciplines) {
        await savePartialDiscipline(reportID, {
            discipline: d,
            runtime: outcome.runtime?.[d.code],
        });
    }

    await saveReportContext(reportID, context, outcome.independent, outcome.precedents);

    await finalizeReport(reportID, {
        internalSummary: result.internalSummary,
        customerSummary: result.customerSummary,
        models,
        tokensUsed,
        durationMs,
    });
}

/** Ghi kết quả cho các bước downstream và cập nhật summary của report mà không xoá các bước trước. */
export async function saveDownstreamResult(
    reportID: string,
    outcome: AnalyzeOutcome,
    downstreamCodes: readonly DisciplineCode[],
): Promise<void> {
    const { result, models, tokensUsed, durationMs } = outcome;

    for (const d of result.disciplines) {
        if (downstreamCodes.includes(d.code)) {
            await savePartialDiscipline(reportID, {
                discipline: d,
                runtime: outcome.runtime?.[d.code],
            });
        }
    }

    await finalizeReport(reportID, {
        internalSummary: result.internalSummary,
        customerSummary: result.customerSummary,
        models,
        tokensUsed,
        durationMs,
    });
}

/**
 * Đánh dấu thất bại.
 *
 * Giữ lại bản ghi thay vì xoá: một lần chạy hỏng có `errorMessage` thì còn debug
 * được, xoá đi thì người dùng chỉ thấy "không có gì xảy ra".
 */
export async function markFailed(reportID: string, message: string): Promise<void> {
    await UPDATE(REPORTS).set({
        status: 'Failed',
        // Cột giới hạn 1000 ký tự — cắt ở đây chứ đừng để DB ném lỗi rồi nuốt
        // mất nguyên nhân thật.
        errorMessage: message.slice(0, 1000),
    }).where({ ID: reportID });
}

/** Bản ghi tối thiểu cần cho `reanalyze`. `null` khi không tìm thấy. */
export async function getReportForRerun(reportID: string): Promise<ReportRow | null> {
    const row = await SELECT.one.from(REPORTS)
        .columns('ID', 'notificationId', 'status', 'sourcePayload')
        .where({ ID: reportID });
    return (row as ReportRow) ?? null;
}

/** Đặt lại trạng thái trước khi chạy lại, xoá luôn lỗi của lần trước. */
export async function markAnalyzing(reportID: string): Promise<void> {
    await UPDATE(REPORTS)
        .set({ status: 'Analyzing', errorMessage: null })
        .where({ ID: reportID });
}

/**
 * Đưa những bản ghi kẹt ở `Analyzing` về `Failed`.
 *
 * Chạy lúc khởi động. Job nền sống trong tiến trình; server chết giữa chừng thì
 * bản ghi kẹt ở `Analyzing` vĩnh viễn và UI quay vòng mãi không dừng. Dọn lúc
 * boot là cách duy nhất để phân biệt "đang chạy" với "đã chết từ lần trước".
 *
 * @returns Số bản ghi đã dọn
 */
export async function sweepStuckAnalyzing(): Promise<number> {
    const stuck = await SELECT.from(REPORTS).columns('ID').where({ status: 'Analyzing' });
    if (!stuck.length) return 0;

    await UPDATE(REPORTS).set({
        status: 'Failed',
        errorMessage: 'Server khởi động lại trong lúc đang phân tích. Chạy lại để có kết quả.',
    }).where({ status: 'Analyzing' });

    return stuck.length;
}

/** Mot dong nhom 8D nguoi dung da chot cho D1. */
export interface AssignedTeamRow {
    partnerId: string;
    partnerName: string;
    functionTitle: string;
    partnerRole: string;
}

/**
 * Ghi nhom 8D da chot vao `team.assignedRoster` cua discipline D1.
 *
 * -- Vi sao merge chu khong ghi de ca resultJson --
 * `resultJson` chua toan bo ket luan cua AI cho buoc do. Client gui len ca cuc
 * roi ghi de nghia la moi lan luu nhom, moi phan con lai deu bi thay bang ban
 * ma trinh duyet dang giu - va mot tab mo tu truoc se lang le keo du lieu cu ve.
 * Doc-sua-ghi o server chi dung mot khoa thi khong co duong nao de chuyen do xay ra.
 *
 * `aiGenerated` giu nguyen `true`: buoc nay VAN do AI sinh, chi rieng danh sach
 * nguoi la do con nguoi chot. Ha co xuong `false` se noi doi ve phan con lai.
 */
/**
 * Đồng bộ `Reports.teamLeader` sau mỗi lần `team.assignedRoster` của D1 đổi.
 *
 * -- Vi sao goi tu ca hai duong ghi --
 * `assignedRoster` sua duoc bang hai loi goi khac nhau: bang nhan su rieng
 * (`saveAssignedTeam`) va duong ghi truong chung (`saveDisciplineFieldValue`).
 * Chi dong bo o mot duong nghia la duong con lai lang le lam cot worklist lech
 * khoi D1 - va lech kieu do khong bao gio bao loi, no chi hien sai ten.
 *
 * Roster rong hoac khong co truong nhom thi ghi null: "chua chot" la mot cau
 * tra loi that, con de nguyen ten cu la noi doi ve mot nguoi da bi go ra.
 */
async function syncTeamLeader(reportID: string | null | undefined, data: unknown): Promise<void> {
    if (!reportID) return;
    await UPDATE(REPORTS).set({ teamLeader: await resolveTeamLeaderName(data) }).where({ ID: reportID });
}

/**
 * Tên trưởng nhóm để hiện trên worklist — tra danh bạ khi D1 chỉ lưu số hiệu.
 *
 * Bảng nhân sự lưu `{ partnerId, partnerRole }` và KHÔNG lưu tên: tên là dữ liệu
 * chủ, nhân bản nó vào từng case là để nó lệch khi người ta đổi tên. Nhưng cột
 * worklist thì phải đọc được — "100014" không nói cho ai biết ai đang giữ case.
 *
 * Nên tra `HistoricalTeamMembers`, đúng cái danh bạ mà widget bảng nhân sự dùng.
 * Không thấy thì vẫn ghi số hiệu: một số hiệu còn tra tay được, một ô trống thì
 * nói sai rằng chưa ai được giao.
 */
async function resolveTeamLeaderName(data: unknown): Promise<string | null> {
    const ref = teamLeaderRefFrom(data);
    if (!ref) return null;
    if (ref.name) return ref.name;
    if (!ref.partnerId) return null;

    // Danh bạ có một dòng cho mỗi lần tham gia case, nên cùng một người xuất hiện
    // nhiều lần — lấy dòng đầu có tên, thay vì dòng đầu bất kỳ (dòng đó có thể
    // rỗng tên và làm hỏng cả phép tra).
    const rows = await SELECT.from(HISTORICAL_TEAM_MEMBERS)
        .columns('partnerName')
        .where({ partnerId: { in: [ref.partnerId, `BP-${ref.partnerId}`] } });

    for (const row of rows ?? []) {
        const name = String((row as any).partnerName ?? '').trim();
        if (name) return name;
    }
    return ref.partnerId;
}

export async function saveAssignedTeam(
    disciplineID: string,
    roster: AssignedTeamRow[],
): Promise<void> {
    const row = await SELECT.one.from(DISCIPLINES)
        .columns('ID', 'code', 'report_ID', 'resultJson', 'reviewStatus', 'workState')
        .where({ ID: disciplineID });
    if (!row) throw Object.assign(new Error(`Discipline ${disciplineID} not found.`), { code: 404 });
    if (normalizeStatus((row as any).reviewStatus) === 'Approved') {
        throw Object.assign(
            new Error(`Discipline ${row.code} has been completed and locked. Reopen the step to make changes.`),
            { code: 400 },
        );
    }
    if ((row as any).workState !== 'InProgress') {
        throw Object.assign(
            new Error(`Discipline ${row.code} is not in process (current status: ${(row as any).workState ?? 'NotStarted'}). Switch status to 'In process' to edit.`),
            { code: 400 },
        );
    }
    if (row.code !== 'D1') {
        throw Object.assign(
            new Error(`Only D1 has a team roster to save; this discipline is ${row.code}.`),
            { code: 400 },
        );
    }

    // resultJson hong hoac rong khong duoc lam hong luon thao tac luu: nhom nguoi
    // dung vua gan la du lieu that, con phan AI thi da hong san tu truoc.
    let data: Record<string, unknown> = {};
    try {
        const parsed = JSON.parse(String(row.resultJson ?? '{}'));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            data = parsed as Record<string, unknown>;
        }
    } catch { /* bat dau tu object rong */ }

    const team = data.team && typeof data.team === 'object' && !Array.isArray(data.team)
        ? { ...(data.team as Record<string, unknown>) }
        : {};
    team.assignedRoster = roster;

    const next = { ...data, team };
    await UPDATE(DISCIPLINES)
        .set({ resultJson: JSON.stringify(next) })
        .where({ ID: disciplineID });
    await syncTeamLeader((row as any).report_ID, next);

    cds.log('eightd-repo').info(`Saved 8D team for discipline ${disciplineID}: ${roster.length} member(s)`);
}


/**
 * Nhung khoa trong `resultJson` ma NGUOI DUNG duoc ghi, theo tung buoc D.
 *
 * Danh sach trang, khong phai danh sach den: them mot buoc D moi thi phai chu y
 * khai bao o day. Khoa nao khong co trong danh sach thi bi tu choi - ke ca khi
 * client gui len dung ten.
 *
 * Moi khoa deu la khoa RIENG cua nguoi dung. Khong khoa nao trung voi khoa AI
 * ghi, nen mot lan luu khong bao gio de mat ket luan cua may.
 */
const HUMAN_WRITABLE_FIELDS: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
    D1: new Set(['team.assignedRoster', 'team.roster']),
    D2: new Set([
        'problem.statementOverride',
        'problem.what',
        'problem.where',
        'problem.when',
        'problem.who',
        'problem.how',
        'problem.extent',
        'problem.is',
        'problem.isNot',
        'problem.isIsNotBasis',
    ]),
    D3: new Set(['containment.actions', 'containment.actionsOverride', 'containment.assignedActions', 'actionItems', 'actions']),
    D4: new Set([
        'whyChain',
        'ishikawaCustomFindings',
        'selectedRootCategory',
        'confirmedRootCategory',
        'rootCause.whyChain',
        'rootCause.ishikawa',
        'rootCause.fiveWhy',
        'rootCause.customFindings',
        'rootCause.statement',
        'rootCause.statementOverride',
        'statement',
    ]),
    D5: new Set(['corrective.actions', 'corrective.assignedActions', 'actionItems', 'actions']),
    D6: new Set(['verification.plan', 'verification.assignedActions', 'implementation.actions', 'implementation.assignedActions', 'actionItems', 'actions']),
    D7: new Set(['preventive.actions', 'preventive.assignedActions', 'preventive.fmea', 'prevention.actions', 'prevention.assignedActions', 'actionItems', 'actions']),
    D8: new Set(['closure.notes', 'closure.teamRecognition', 'closure.lessonsWhatWorked', 'closure.lessonsWhatDidNot']),
});

/**
 * Ghi mot khoa vao `resultJson` cua mot discipline.
 *
 * Doc-sua-ghi o SERVER chu khong nhan ca cuc `resultJson` tu client: nhan ca cuc
 * nghia la mot tab mo tu truoc bam Save se lang le keo moi thu khac ve ban cu.
 */
export async function saveDisciplineFieldValue(
    disciplineID: string,
    fieldKey: string,
    value: unknown,
): Promise<void> {
    const row = await SELECT.one.from(DISCIPLINES)
        .columns('ID', 'code', 'report_ID', 'resultJson', 'reviewStatus', 'workState')
        .where({ ID: disciplineID });
    if (!row) throw Object.assign(new Error(`Discipline ${disciplineID} not found.`), { code: 404 });
    const isApproved = normalizeStatus((row as any).reviewStatus) === 'Approved';
    const isTaskActionUpdate = fieldKey.endsWith('.assignedActions') || fieldKey === 'assignedActions';

    if (isApproved && !isTaskActionUpdate) {
        throw Object.assign(
            new Error(`Discipline ${row.code} has been completed and locked. Reopen the step to make changes.`),
            { code: 400 },
        );
    }
    if ((row as any).workState !== 'InProgress') {
        throw Object.assign(
            new Error(`Discipline ${row.code} is not in process (current status: ${(row as any).workState ?? 'NotStarted'}). Switch status to 'In process' to edit.`),
            { code: 400 },
        );
    }

    const allowed = HUMAN_WRITABLE_FIELDS[String(row.code)];
    if (!allowed?.has(fieldKey)) {
        throw Object.assign(
            new Error(`"${fieldKey}" is not user-writable on ${row.code}. `
                + `Allowed: ${allowed ? [...allowed].join(', ') || 'none' : 'none'}.`),
            { code: 400 },
        );
    }

    // resultJson hong khong duoc lam hong luon thao tac luu: thu nguoi dung vua
    // nhap la du lieu that, con phan AI thi da hong san tu truoc.
    let data: Record<string, unknown> = {};
    try {
        const parsed = JSON.parse(String(row.resultJson ?? '{}'));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            data = parsed as Record<string, unknown>;
        }
    } catch { /* bat dau tu object rong */ }

    // Khoa dang `a.b` la object long nhau trong resultJson, khong phai mot khoa
    // phang co dau cham - dat sai tang thi `getPath` o UI khong bao gio tim thay.
    const parts = fieldKey.split('.');
    let cursor = data;
    for (const part of parts.slice(0, -1)) {
        const next = cursor[part];
        cursor[part] = next && typeof next === 'object' && !Array.isArray(next)
            ? { ...(next as Record<string, unknown>) } : {};
        cursor = cursor[part] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]] = value;

    if (!isApproved) {
        // Tự động chuyển NotStarted -> InProgress khi có thao tác sửa thật
        const currentWorkState = String((row as any).workState ?? 'NotStarted');
        const nextWorkState = currentWorkState === 'NotStarted' ? 'InProgress' : currentWorkState;

        await UPDATE(DISCIPLINES).set({
            resultJson: JSON.stringify(data),
            workState: nextWorkState,
        }).where({ ID: disciplineID });
    } else {
        await UPDATE(DISCIPLINES).set({
            resultJson: JSON.stringify(data),
        }).where({ ID: disciplineID });
    }

    if (fieldKey === 'team.assignedRoster') {
        await syncTeamLeader((row as any).report_ID, data);
    }

    cds.log('eightd-repo').info(`Saved ${fieldKey} on discipline ${disciplineID} (${row.code})`);
}

/**
 * Xác nhận hoặc gỡ xác nhận một trường thông tin AI trong bước D.
 */
export async function confirmDisciplineField(
    disciplineID: string,
    fieldKey: string,
    confirmed: boolean,
): Promise<{ confirmedFields: string[] }> {
    const row = await SELECT.one.from(DISCIPLINES)
        .columns('ID', 'code', 'report_ID', 'resultJson', 'reviewStatus', 'confirmedFieldsJson', 'workState')
        .where({ ID: disciplineID });
    if (!row) throw Object.assign(new Error(`Discipline ${disciplineID} not found.`), { code: 404 });
    if (normalizeStatus((row as any).reviewStatus) === 'Approved') {
        throw Object.assign(
            new Error(`Discipline ${row.code} has been completed and locked. Reopen the step to make changes.`),
            { code: 400 },
        );
    }
    if ((row as any).workState !== 'InProgress') {
        throw Object.assign(
            new Error(`Discipline ${row.code} is not in process (current status: ${(row as any).workState ?? 'NotStarted'}). Switch status to 'In process' to confirm fields.`),
            { code: 400 },
        );
    }

    if (confirmed) {
        // CỔNG CHẶN SERVER: Kiểm tra bằng chứng hoàn thành (evidence) cho các task đã Done
        let resultData: Record<string, unknown> = {};
        try {
            resultData = JSON.parse(String((row as any).resultJson ?? '{}'));
        } catch { /* empty */ }

        const assignedKey = assignedFieldFor(fieldKey);
        const tasksRaw = getPath(resultData, assignedKey) || getPath(resultData, fieldKey);
        const tasks = normalizeTasks(tasksRaw);
        const doneTasks = tasks.filter((t) => t.status === 'Done');

        if (doneTasks.length > 0) {
            const reportID = String((row as any).report_ID ?? '');
            const disciplineCode = String(row.code ?? '');
            const evidences = await SELECT.from(TASK_EVIDENCES)
                .columns('taskId')
                .where({ reportID, disciplineCode });
            const evidenceTaskIds = new Set(evidences.map((e: any) => String(e.taskId)));
            const missingEvidence = doneTasks.filter((t) => !evidenceTaskIds.has(t.id));
            if (missingEvidence.length > 0) {
                const names = missingEvidence.map((t) => t.name || t.id).join(', ');
                throw Object.assign(
                    new Error(
                        `Cannot confirm "${fieldKey}": ${missingEvidence.length} task(s) marked Done are missing completion evidence (${names}). Please upload PDF evidence before confirming.`,
                    ),
                    { code: 400 },
                );
            }
        }
    }

    const keys = fieldKey.split(',').map((k) => k.trim()).filter(Boolean);
    const currentList = parseConfirmedFields((row as any).confirmedFieldsJson);
    const set = new Set(currentList);
    for (const k of keys) {
        if (confirmed) {
            set.add(k);
        } else {
            set.delete(k);
        }
    }
    const nextConfirmed = [...set];

    await UPDATE(DISCIPLINES).set({
        confirmedFieldsJson: JSON.stringify(nextConfirmed),
    }).where({ ID: disciplineID });

    cds.log('eightd-repo').info(
        `${confirmed ? 'Confirmed' : 'Unconfirmed'} ${fieldKey} on discipline ${disciplineID} (${row.code})`,
    );
    return { confirmedFields: nextConfirmed };
}

/**
 * Đặt trạng thái xử lý (workState) của bước D (NotStarted <-> InProgress).
 */
export async function setDisciplineWorkState(
    disciplineID: string,
    newWorkState: string,
): Promise<{ workState: string }> {
    const state = String(newWorkState ?? '').trim();
    if (state !== 'NotStarted' && state !== 'InProgress' && state !== 'Completed') {
        throw Object.assign(
            new Error(`Invalid workState "${state}". Allowed values: NotStarted, InProgress, Completed.`),
            { code: 400 },
        );
    }

    const row = await SELECT.one.from(DISCIPLINES)
        .columns('ID', 'code', 'reviewStatus', 'workState')
        .where({ ID: disciplineID });
    if (!row) throw Object.assign(new Error(`Discipline ${disciplineID} not found.`), { code: 404 });

    const reviewStatus = state === 'Completed' ? 'Approved' : 'Draft';

    await UPDATE(DISCIPLINES).set({
        workState: state,
        reviewStatus: reviewStatus,
    }).where({ ID: disciplineID });

    cds.log('eightd-repo').info(`Set workState to ${state} on discipline ${disciplineID} (${row.code})`);
    return { workState: state };
}

// ─────────────────────────────────────────────────────────────────────────────
// Duyệt từng bước
// ─────────────────────────────────────────────────────────────────────────────

export interface ReviewResult {
    disciplineID: string;
    code: string;
    fromStatus: ReviewStatus;
    toStatus: ReviewStatus;
    reviewedBy: string;
    reviewedAt: string;
    gate: ClosureGate;
    /** Chỉ có khi vừa duyệt D8: case đã đóng và đã ghi vào kho tiền lệ hay chưa. */
    closure?: {
        reportClosed: boolean;
        libraryWrite: WriteBackResult | null;
        /** Lý do không ghi được vào kho. Có mặt nghĩa là case đã đóng nhưng kho chưa học được gì. */
        libraryError?: string;
    };
}

/**
 * Ghi một quyết định duyệt, kèm một dòng vết KHÔNG XOÁ được.
 *
 * Hai thao tác ghi phải đi cùng nhau: trạng thái hiện tại để UI và cổng D8 đọc,
 * và dòng lịch sử để trả lời được "đã qua mấy vòng". Ghi trạng thái mà quên vết
 * thì một case bị trả lại rồi duyệt lại trông y hệt case duyệt thẳng.
 *
 * `actor` lấy từ `req.user` ở tầng service, KHÔNG nhận từ client — chữ ký mà
 * client tự khai được thì không phải chữ ký.
 */
export async function reviewDiscipline(
    disciplineID: string,
    toStatus: ReviewStatus,
    note: string | null,
    actor: string,
): Promise<ReviewResult> {
    const row = await SELECT.one.from(DISCIPLINES)
        .columns('ID', 'code', 'reviewStatus', 'report_ID', 'formSchemaJson', 'confirmedFieldsJson', 'workState')
        .where({ ID: disciplineID });
    if (!row) throw Object.assign(new Error(`Discipline ${disciplineID} not found.`), { code: 404 });

    const reportID = String((row as any).report_ID ?? '');
    const fromStatus = normalizeStatus((row as any).reviewStatus);
    const at = new Date().toISOString();

    let nextWorkState = String((row as any).workState ?? 'NotStarted');

    if (toStatus === 'Approved') {
        /**
         * Duyệt D8 = ĐÓNG CASE. Cổng phải chặn ở đây, không chỉ ở màn hình.
         *
         * `EightDService.cds` đã tuyên bố "D8 chỉ mở khi D1-D7 Approved" từ đầu,
         * nhưng chỗ duy nhất kiểm điều đó là UI — một lời gọi thẳng vào action
         * vẫn đóng được một case còn ba bước dở dang. Từ Phase 5 việc này còn
         * kéo theo một dòng ghi vào kho tiền lệ, nên một case đóng non không chỉ
         * sai trong audit: nó trở thành bằng chứng cho những case sau.
         */
        if (String(row.code ?? '') === 'D8') {
            const prereqs = await SELECT.from(DISCIPLINES)
                .columns('code', 'reviewStatus')
                .where({ report_ID: reportID });
            const gate = evaluateClosureGate(prereqs as any[]);
            if (!gate.canClose) {
                throw Object.assign(new Error(`Cannot close the case. ${gate.reason}`), { code: 400 });
            }
        }

        if (String(row.code ?? '') === 'D6') {
            const siblings = await SELECT.from(DISCIPLINES)
                .columns('code', 'resultJson')
                .where({ report_ID: reportID });

            for (const s of siblings) {
                if (String(s.code) === 'D5') {
                    let parsed: any = {};
                    try {
                        parsed = JSON.parse(String(s.resultJson ?? '{}'));
                    } catch { /* empty */ }
                    const keyPrefix = 'corrective';
                    const tasks = parsed?.[keyPrefix]?.assignedActions || parsed?.assignedActions || [];
                    if (Array.isArray(tasks) && tasks.length > 0) {
                        for (const t of tasks) {
                            const status = normalizeActionStatus(t?.status);
                            if (status !== 'Done') {
                                const taskName = t?.name || t?.actionText || t?.action || 'Task';
                                throw Object.assign(
                                    new Error(`There are tasks in D5 still not complete.`),
                                    { code: 400 },
                                );
                            }
                        }
                    }
                }
            }
        }
        nextWorkState = 'Completed';
    } else if (toStatus === 'Draft') {
        nextWorkState = 'InProgress';
    } else if (toStatus === 'ChangeRequested') {
        nextWorkState = 'InProgress';
    }

    await UPDATE(DISCIPLINES).set({
        reviewStatus: toStatus,
        reviewedBy: actor,
        reviewedAt: at,
        // Ghi chú thuộc về quyết định vừa rồi. Duyệt xong mà giữ lại ghi chú của
        // lần trả lại trước thì màn hình nói ngược với trạng thái.
        reviewNote: note ?? null,
        workState: nextWorkState,
    }).where({ ID: disciplineID });

    await INSERT.into(REVIEW_EVENTS).entries({
        reportID,
        disciplineCode: String(row.code ?? ''),
        fromStatus,
        toStatus,
        note: note ?? null,
        actor,
        at,
    });

    // Đọc lại CẢ report để tính cổng: cổng là thuộc tính của toàn case, không suy
    // ra được từ một bước vừa đổi.
    const siblings = await SELECT.from(DISCIPLINES)
        .columns('code', 'reviewStatus')
        .where({ report_ID: reportID });

    cds.log('eightd-repo').info(
        `Review ${row.code} ${fromStatus} -> ${toStatus} by ${actor} on report ${reportID}`,
    );

    const closure = toStatus === 'Approved' && String(row.code ?? '') === 'D8'
        ? await closeCase(reportID, at)
        : undefined;

    return {
        disciplineID,
        code: String(row.code ?? ''),
        fromStatus,
        toStatus,
        reviewedBy: actor,
        reviewedAt: at,
        gate: evaluateClosureGate(siblings as any[]),
        ...(closure ? { closure } : {}),
    };
}

/**
 * Đóng case và cho kho tiền lệ học nó.
 *
 * ── Vì sao đóng report ở đây chứ không để UI gọi thêm một action ──
 * Duyệt D8 CHÍNH LÀ hành vi đóng case; tách thành hai lời gọi nghĩa là tồn tại
 * một trạng thái "D8 đã duyệt nhưng report vẫn mở", và mọi màn hình đọc
 * `report.status` sẽ nói ngược với vết duyệt.
 *
 * ── Vì sao lỗi ghi kho KHÔNG làm hỏng việc đóng case ──
 * Case đã được con người duyệt xong tám bước; từ chối đóng nó vì kho tiền lệ ghi
 * hỏng là để một sự cố phụ chặn kết luận nghiệp vụ. Nhưng cũng KHÔNG nuốt lỗi:
 * `libraryError` đi thẳng lên kết quả trả về, vì một kho lặng lẽ không nhận case
 * mới đúng là thứ không ai phát hiện ra cho tới khi gợi ý bắt đầu nghèo đi.
 */
async function closeCase(reportID: string, at: string): Promise<NonNullable<ReviewResult['closure']>> {
    await UPDATE(REPORTS).set({
        status: 'Closed',
        // `status` là trạng thái pipeline, `sapStatus` là trạng thái phía SAP —
        // kho tiền lệ lọc theo cột thứ hai (`CLOSED_STATUSES`), nên thiếu nó thì
        // dòng vừa ghi không bao giờ được chọn làm ứng viên.
        sapStatus: 'Completed',
        completionDate: at.slice(0, 10),
    }).where({ ID: reportID });

    try {
        const libraryWrite = await writeClosedCaseToLibrary(reportID);
        if (libraryWrite.skippedReason) {
            cds.log('eightd-repo').warn(
                `Case ${reportID} đã đóng nhưng không vào kho tiền lệ: ${libraryWrite.skippedReason}`,
            );
            return { reportClosed: true, libraryWrite, libraryError: libraryWrite.skippedReason };
        }
        return { reportClosed: true, libraryWrite };
    } catch (e: any) {
        cds.log('eightd-repo').error(
            `Case ${reportID} đã đóng nhưng ghi kho tiền lệ thất bại: ${e.message}`,
        );
        return { reportClosed: true, libraryWrite: null, libraryError: e.message };
    }
}

/** Vết duyệt của một report, mới nhất trước. Dùng cho panel audit trên UI. */
export async function getReviewTrail(reportID: string): Promise<Record<string, unknown>[]> {
    return SELECT.from(REVIEW_EVENTS)
        .where({ reportID })
        .orderBy('at desc') as unknown as Record<string, unknown>[];
}

/** Cổng đóng case, đọc thẳng từ DB. */
export async function getClosureGate(reportID: string): Promise<ClosureGate> {
    const rows = await SELECT.from(DISCIPLINES)
        .columns('code', 'reviewStatus')
        .where({ report_ID: reportID });
    return evaluateClosureGate(rows as any[]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Quản lý bằng chứng hoàn thành (Task Completion Evidence)
// ─────────────────────────────────────────────────────────────────────────────

export interface TaskEvidenceRow {
    ID: string;
    reportID: string;
    disciplineCode: string;
    taskId: string;
    fileName: string;
    fileSize: number;
    mediaType: string;
    uploadedBy: string;
    uploadedAt: string;
}

export function findTaskInResultJson(resultJson: string | null | undefined, taskId: string): { status: string } | null {
    if (!resultJson) return null;
    try {
        const data = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
        if (!data || typeof data !== 'object') return null;

        const candidateArrays: unknown[] = [];
        if (data.containment?.assignedActions) candidateArrays.push(data.containment.assignedActions);
        if (data.corrective?.assignedActions) candidateArrays.push(data.corrective.assignedActions);
        if (data.preventive?.assignedActions) candidateArrays.push(data.preventive.assignedActions);
        if (Array.isArray(data.assignedActions)) candidateArrays.push(data.assignedActions);
        if (Array.isArray(data.tasks)) candidateArrays.push(data.tasks);

        for (const val of Object.values(data)) {
            if (Array.isArray(val)) candidateArrays.push(val);
            else if (val && typeof val === 'object') {
                for (const subVal of Object.values(val as Record<string, unknown>)) {
                    if (Array.isArray(subVal)) candidateArrays.push(subVal);
                }
            }
        }

        for (const arr of candidateArrays) {
            const normalized = normalizeTasks(arr);
            const found = normalized.find((t) => t.id === taskId);
            if (found) return found;
        }
        return null;
    } catch {
        return null;
    }
}

export function markTaskStatusInResultJson(
    resultJson: string | null | undefined,
    taskId: string,
    newStatus: string,
): string | null {
    if (!resultJson) return null;
    try {
        const data = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
        if (!data || typeof data !== 'object') return null;

        let modified = false;
        const updateArray = (arr: unknown[]) => {
            if (!Array.isArray(arr)) return;
            for (let i = 0; i < arr.length; i++) {
                const item = arr[i];
                if (item && typeof item === 'object' && (item as any).id === taskId) {
                    (item as any).status = newStatus;
                    modified = true;
                }
            }
        };

        if (data.containment?.assignedActions) updateArray(data.containment.assignedActions);
        if (data.corrective?.assignedActions) updateArray(data.corrective.assignedActions);
        if (data.preventive?.assignedActions) updateArray(data.preventive.assignedActions);
        if (Array.isArray(data.assignedActions)) updateArray(data.assignedActions);
        if (Array.isArray(data.tasks)) updateArray(data.tasks);

        for (const val of Object.values(data)) {
            if (Array.isArray(val)) updateArray(val);
            else if (val && typeof val === 'object') {
                for (const subVal of Object.values(val as Record<string, unknown>)) {
                    if (Array.isArray(subVal)) updateArray(subVal);
                }
            }
        }

        return modified ? JSON.stringify(data) : null;
    } catch {
        return null;
    }
}

export async function createTaskEvidence(params: {
    reportID: string;
    disciplineCode: string;
    taskId: string;
    fileName: string;
    fileSize: number;
    mediaType: string;
    content?: any;
    actor: string;
}): Promise<TaskEvidenceRow> {
    const { reportID, disciplineCode, taskId, fileName, fileSize, mediaType, content, actor } = params;

    if (mediaType !== 'application/pdf') {
        throw Object.assign(new Error('Only PDF files are allowed.'), { code: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (fileSize > MAX_SIZE) {
        const actualMb = (fileSize / (1024 * 1024)).toFixed(2);
        throw Object.assign(
            new Error(`File size exceeds 10 MB limit (actual: ${actualMb} MB).`),
            { code: 400 },
        );
    }

    const discipline = await SELECT.one.from(DISCIPLINES)
        .columns('ID', 'code', 'reviewStatus', 'resultJson', 'workState')
        .where({ report_ID: reportID, code: disciplineCode });
    if (!discipline) {
        throw Object.assign(new Error(`Discipline ${disciplineCode} not found for report ${reportID}.`), { code: 404 });
    }

    const isActionStep = ['D3', 'D5', 'D7'].includes(String(disciplineCode));
    if (normalizeStatus((discipline as any).reviewStatus) === 'Approved' && !isActionStep) {
        throw Object.assign(
            new Error(`Discipline ${disciplineCode} has been completed and locked. Reopen the step to make changes.`),
            { code: 400 },
        );
    }
    if ((discipline as any).workState !== 'InProgress') {
        throw Object.assign(
            new Error(`Discipline ${disciplineCode} is not in process. Switch status to 'In process' to upload evidence.`),
            { code: 400 },
        );
    }

    const task = findTaskInResultJson((discipline as any).resultJson, taskId);
    const taskStatus = String(task?.status || '').trim().toLowerCase();
    const allowedStatuses = isActionStep
        ? ['open', 'done', 'verified']
        : ['done', 'verified'];

    if (!task || !allowedStatuses.includes(taskStatus)) {
        throw Object.assign(
            new Error(`Evidence can only be uploaded for tasks with status ${allowedStatuses.join(' or ')}.`),
            { code: 400 },
        );
    }

    const ID = cds.utils.uuid();
    const uploadedAt = new Date().toISOString();

    await INSERT.into(TASK_EVIDENCES).entries({
        ID,
        reportID,
        disciplineCode,
        taskId,
        fileName: fileName || 'evidence.pdf',
        fileSize,
        mediaType,
        content: content ?? null,
        uploadedBy: actor || 'anonymous',
        uploadedAt,
    });

    if (taskStatus === 'open') {
        const updatedJson = markTaskStatusInResultJson((discipline as any).resultJson, taskId, 'Done');
        if (updatedJson) {
            await UPDATE(DISCIPLINES)
                .set({ resultJson: updatedJson })
                .where({ ID: (discipline as any).ID });
        }
    }

    cds.log('eightd-repo').info(
        `Created task evidence ${ID} (${fileName}) for task ${taskId} on report ${reportID} (${disciplineCode}) by ${actor}`,
    );

    return {
        ID,
        reportID,
        disciplineCode,
        taskId,
        fileName: fileName || 'evidence.pdf',
        fileSize,
        mediaType,
        uploadedBy: actor || 'anonymous',
        uploadedAt,
    };
}

export async function deleteTaskEvidence(evidenceID: string): Promise<{ deleted: string }> {
    const row = await SELECT.one.from(TASK_EVIDENCES)
        .columns('ID', 'reportID', 'disciplineCode', 'taskId', 'fileName')
        .where({ ID: evidenceID });
    if (!row) {
        throw Object.assign(new Error(`Evidence ${evidenceID} not found.`), { code: 404 });
    }

    const discipline = await SELECT.one.from(DISCIPLINES)
        .columns('ID', 'code', 'reviewStatus', 'workState')
    if (discipline) {
        const isActionStep = ['D3', 'D5', 'D7'].includes(String((row as any).disciplineCode));
        if (normalizeStatus((discipline as any).reviewStatus) === 'Approved' && !isActionStep) {
            throw Object.assign(
                new Error(`Discipline ${(row as any).disciplineCode} has been completed and locked. Reopen the step to make changes.`),
                { code: 400 },
            );
        }
        if ((discipline as any).workState !== 'InProgress') {
            throw Object.assign(
                new Error(`Discipline ${(row as any).disciplineCode} is not in process. Switch status to 'In process' to delete evidence.`),
                { code: 400 },
            );
        }
    }

    await DELETE.from(TASK_EVIDENCES).where({ ID: evidenceID });
    cds.log('eightd-repo').info(`Deleted task evidence ${evidenceID}`);
    return { deleted: evidenceID };
}

export async function listTaskEvidence(reportID: string): Promise<TaskEvidenceRow[]> {
    const rows = await SELECT.from(TASK_EVIDENCES)
        .columns('ID', 'reportID', 'disciplineCode', 'taskId', 'fileName', 'fileSize', 'mediaType', 'uploadedBy', 'uploadedAt')
        .where({ reportID })
        .orderBy('uploadedAt desc');
    return rows as unknown as TaskEvidenceRow[];
}

