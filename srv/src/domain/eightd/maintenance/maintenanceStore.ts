/**
 * Đọc / ghi cho đề xuất bảo trì — luật nằm ở `rules.ts`, file này chỉ nối dữ liệu.
 *
 * Kế hoạch sống trong `resultJson` của D7 dưới khoá `preventive.maintenancePlan`,
 * ghi qua `saveDisciplineFieldValue` — cùng danh sách trắng, cùng khoá "bước đã
 * duyệt thì khoá", không có đường ghi thứ hai. Lịch sử bảo trì theo loại lỗi vì
 * thế không cần bảng riêng: nó là các đề xuất Approved trên D7 của mọi report
 * cùng mã lỗi + work center, và tự dày lên mỗi lần có người duyệt.
 */

import cds from '@sap/cds';
import { recordReviewEvent, saveDisciplineFieldValue } from '../eightDRepository';
import { normalizeStatus } from '../review';
import { HISTORICAL_CASES, fetchActions } from '../precedent/precedentRepository';
import {
    applyDecision,
    approvedProposalsOf,
    buildMaintenancePlan,
    carryDecisions,
    groupMaintenanceHistory,
    type HistoryCase,
    type HistoryOccurrence,
    type HistoryReport,
    type MaintenanceHistoryEntry,
    type MaintenanceHistoryGroup,
    type MaintenancePlan,
    type MaintenanceProposal,
} from './rules';

const LOG = cds.log('maintenance');
const REPORTS = 'cnma.proresolve.Reports';
const DISCIPLINES = 'cnma.proresolve.Disciplines';
export const MAINTENANCE_PLAN_KEY = 'preventive.maintenancePlan';
/** Cùng tập "đã đóng" với `precedentRepository` — chỉ case đã đóng mới có hành động đã áp dụng. */
const CLOSED_STATUSES = ['Completed', 'Closed'];

interface ReportRow {
    ID: string;
    notificationId: string;
    defectCode: string | null;
    workCenterId: string | null;
    foundDate: string | null;
    rootCauseCategory: string | null;
}

interface DisciplineRow {
    ID: string;
    code: string;
    report_ID: string;
    reviewStatus: string | null;
    resultJson: string | null;
}

const notFound = (msg: string) => Object.assign(new Error(msg), { code: 404 });

function storedPlanOf(resultJson: string | null): unknown {
    try {
        return JSON.parse(String(resultJson ?? '{}'))?.preventive?.maintenancePlan ?? null;
    } catch {
        return null;
    }
}

async function loadReport(reportID: string): Promise<{ report: ReportRow; d4: DisciplineRow | undefined; d7: DisciplineRow | undefined }> {
    const report = await SELECT.one.from(REPORTS)
        .columns('ID', 'notificationId', 'defectCode', 'workCenterId', 'foundDate', 'rootCauseCategory')
        .where({ ID: reportID }) as ReportRow | undefined;
    if (!report) throw notFound(`Report ${reportID} not found.`);
    const rows = await SELECT.from(DISCIPLINES)
        .columns('ID', 'code', 'report_ID', 'reviewStatus', 'resultJson')
        .where({ report_ID: reportID, code: { in: ['D4', 'D7'] } }) as DisciplineRow[];
    return { report, d4: rows.find((r) => r.code === 'D4'), d7: rows.find((r) => r.code === 'D7') };
}

/** Case đã đóng cùng mã lỗi + work center, kèm hành động phòng ngừa của chúng. */
async function fetchDefectTypeHistory(report: ReportRow): Promise<HistoryCase[]> {
    if (!report.defectCode || !report.workCenterId) return [];
    const cases = await SELECT.from(HISTORICAL_CASES)
        .columns('ID', 'notificationId', 'foundDate', 'completionDate', 'rootCauseCategory')
        .where({
            defectCode: report.defectCode,
            workCenterId: report.workCenterId,
            sapStatus: { in: CLOSED_STATUSES },
            notificationId: { '<>': report.notificationId },
        }) as { ID: string; notificationId: string; foundDate: string | null; completionDate: string | null; rootCauseCategory: string | null }[];
    const actions = await fetchActions(cases.map((c) => c.ID));
    return cases.map((c) => ({
        notificationId: c.notificationId,
        foundDate: c.foundDate,
        completionDate: c.completionDate,
        rootCauseCategory: c.rootCauseCategory,
        preventiveActions: actions
            .filter((a) => a.caseId === c.ID && a.actionType === 'Preventive')
            .map((a) => a.actionText),
    }));
}

/**
 * Dựng kế hoạch cho một report. KHÔNG ghi: UI lưu bằng `saveDisciplineField`, nên
 * người dùng xem trước rồi mới lưu. Quyết định đã có trên D7 được giữ lại.
 */
export async function proposeMaintenancePlan(reportID: string): Promise<MaintenancePlan> {
    const { report, d4, d7 } = await loadReport(reportID);
    const plan = buildMaintenancePlan({
        notificationId: report.notificationId,
        defectCode: report.defectCode,
        workCenterId: report.workCenterId,
        foundDate: report.foundDate,
        d4Approved: !!d4 && normalizeStatus(d4.reviewStatus) === 'Approved',
        d4Result: d4?.resultJson ?? null,
        recordedRootCauseCategory: report.rootCauseCategory,
        history: await fetchDefectTypeHistory(report),
    });
    LOG.info(`Maintenance plan for ${report.notificationId}: ${plan.proposals.length} proposal(s), ${plan.stops.length} stop(s)${plan.refusal ? ' - refused' : ''}`);
    return carryDecisions(storedPlanOf(d7?.resultJson ?? null), plan);
}

/**
 * Duyệt / từ chối một đề xuất. Ghi trạng thái lên D7 và một dòng vết, trong cùng
 * transaction của request — một trong hai hỏng thì cả hai cuộn lại.
 */
export async function decideMaintenanceProposal(
    reportID: string,
    proposalId: string,
    decision: 'approve' | 'reject',
    note: string | null,
    actor: string,
): Promise<MaintenanceProposal> {
    const { report, d7 } = await loadReport(reportID);
    if (!d7) throw notFound(`Report ${reportID} has no D7 step.`);
    const stored = storedPlanOf(d7.resultJson);
    if (!stored) throw Object.assign(new Error('No saved maintenance plan on D7. Generate and save one first.'), { code: 400 });

    const { plan, proposal, fromStatus } = applyDecision(stored, proposalId, decision, note, actor);
    await saveDisciplineFieldValue(d7.ID, MAINTENANCE_PLAN_KEY, plan, actor);
    await recordReviewEvent({
        reportID,
        disciplineCode: 'D7',
        eventType: 'maintenance-decision',
        subjectId: proposalId.slice(0, 64),
        fromStatus,
        toStatus: proposal.status,
        reason: proposal.note,
        snapshot: {
            step: 'D7',
            notificationId: report.notificationId,
            controlType: proposal.controlType,
            task: proposal.task.slice(0, 240),
            interval: proposal.interval,
            whyStepUsed: proposal.whyStepUsed,
            sourceCaseIds: proposal.sourceCaseIds.slice(0, 5),
        },
        actor,
    });
    return proposal;
}

/** Report kèm kế hoạch đã lưu trên D7 — nguồn chung của cả hai cách đọc lịch sử. */
async function reportsWithPlans(where?: { defectCode: string; workCenterId: string }): Promise<HistoryReport[]> {
    const query = SELECT.from(REPORTS)
        .columns('ID', 'notificationId', 'defectCode', 'defectText', 'workCenterId', 'workCenterDesc', 'foundDate');
    const reports = await (where ? query.where(where) : query) as Omit<HistoryReport, 'plan'>[];
    if (!reports.length) return [];
    const d7s = await SELECT.from(DISCIPLINES)
        .columns('report_ID', 'resultJson')
        .where({ report_ID: { in: reports.map((r) => r.ID) }, code: 'D7' }) as { report_ID: string; resultJson: string | null }[];
    const planBy = new Map(d7s.map((d) => [d.report_ID, storedPlanOf(d.resultJson)]));
    return reports.map((r) => ({ ...r, plan: planBy.get(r.ID) ?? null }));
}

/** Đề xuất đã DUYỆT của một loại lỗi trên mọi report, mới nhất trước. */
export async function getMaintenanceHistory(defectCode: string, workCenterId: string): Promise<MaintenanceHistoryEntry[]> {
    return (await reportsWithPlans({ defectCode, workCenterId }))
        .flatMap((r) => approvedProposalsOf(r.plan).map((p) => ({ ...p, reportID: r.ID, notificationId: r.notificationId })))
        .sort((a, b) => String(b.decidedAt ?? '').localeCompare(String(a.decidedAt ?? '')));
}

/**
 * Mọi đề xuất đã duyệt, gom theo loại lỗi — tab "Maintenance History" ở Master Data.
 * Là một góc nhìn TÍNH RA trên D7 đã duyệt, không phải bảng: duyệt thêm là tự dày lên.
 */
export async function listMaintenanceHistory(): Promise<MaintenanceHistoryGroup[]> {
    const reports = await reportsWithPlans();
    const closedCases = await SELECT.from(HISTORICAL_CASES)
        .columns('notificationId', 'defectCode', 'workCenterId', 'foundDate')
        .where({ sapStatus: { in: CLOSED_STATUSES } }) as HistoryOccurrence[];
    return groupMaintenanceHistory(reports, closedCases);
}
