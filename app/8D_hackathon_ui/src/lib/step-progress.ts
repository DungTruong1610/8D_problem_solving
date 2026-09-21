export type StepStatus = 'NotStarted' | 'InProcess' | 'Complete';

const STEP_CODES = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'];
const STEP_LABELS: Record<string, string> = {
    D1: 'Team', D2: 'Problem', D3: 'Containment', D4: 'Root Cause',
    // D8 là "Team Recognition" ở mọi nơi khác (case-stepper, /workflow,
    // case-workload, object-schema). "Congratulate" sót lại ở đây là một tên
    // thứ hai cho cùng một bước — người dùng thấy hai chữ khác nhau sẽ đi tìm
    // hai bước khác nhau.
    D5: 'Corrective Actions', D6: 'Implementation', D7: 'Prevention', D8: 'Team Recognition'
};

function stepStatusOf(approved: boolean, hasEvidence: boolean): StepStatus {
    if (approved) return 'Complete';
    if (hasEvidence) return 'InProcess';
    return 'NotStarted';
}

function isReadyToComplete(approved: boolean, hasEvidence: boolean): boolean {
    return !approved && hasEvidence;
}

function completeness(statuses: StepStatus[]): number {
    return statuses.filter((s) => s === 'Complete').length;
}

function computeStepEvidence(_input: any): Record<string, boolean> {
    return {};
}

import { reviewStatusOf, type Discipline8D, type Report8D } from '@/services/eightd-service';

/**
 * Tiến độ tám bước của một case.
 *
 * ── Vì sao là một hàm dùng chung ──
 * Worklist hiện "x/8 steps", trang chi tiết hiện chấm màu cho từng bước. Hai màn
 * hình phải nói CÙNG một con số. Tính riêng ở mỗi nơi thì chúng sẽ lệch nhau vào
 * đúng lúc dữ liệu ở rìa — và người dùng sẽ tin màn hình nào?
 */

export interface StepProgressItem {
    code: string;
    label: string;
    status: StepStatus;
    /** Đã có dữ liệu nhưng chưa ai ký — chỗ để màn hình nhắc "chốt đi". */
    readyToComplete: boolean;
    /** Dòng trong bảng Disciplines, nếu report đã phân tích xong. */
    discipline: Discipline8D | null;
}

export interface StepProgress {
    steps: StepProgressItem[];
    /** Số bước đã Complete, 0..8. */
    completed: number;
    total: number;
}

/** Bóc `actions` khỏi chuỗi caseContext. Hỏng thì coi như không có action nào. */
function readActions(caseContext: string | null | undefined) {
    if (!caseContext) return {};
    try {
        const parsed = JSON.parse(caseContext);
        const actions = parsed?.actions;
        return actions && typeof actions === 'object' && !Array.isArray(actions) ? actions : {};
    } catch {
        return {};
    }
}

/** Nhóm 8D đã có người chưa — đọc từ D1 nếu có, nếu không thì từ `teamSize`. */
function hasTeam(report: Report8D, byCode: Map<string, Discipline8D>): boolean {
    if ((report.teamSize ?? 0) > 0) return true;
    const d1 = byCode.get('D1');
    if (!d1?.resultJson) return false;
    try {
        const roster = JSON.parse(d1.resultJson)?.team?.roster;
        return Array.isArray(roster) && roster.length > 0;
    } catch {
        return false;
    }
}

export function getStepProgress(report: Report8D): StepProgress {
    const disciplines = report.disciplines ?? [];
    const byCode = new Map(disciplines.map((d) => [d.code, d]));
    const actions = readActions(report.caseContext) as Record<string, { status?: string }[]>;

    const evidence = computeStepEvidence({
        hasTeam: hasTeam(report, byCode),
        hasSymptom: Boolean(report.symptomShortText),
        containment: actions.containment,
        corrective: actions.corrective,
        preventive: actions.preventive,
        hasRootCause: Boolean(report.rootCauseCategory),
        // `sapStatus` la trang thai ben SAP, khac `status` cua pipeline phan tich.
        // Lay nham thi moi report vua chay xong deu hien D8 da dong.
        isClosed: ['Completed', 'Closed'].includes(String(report.sapStatus ?? '')),
    });

    const steps: StepProgressItem[] = STEP_CODES.map((code: string) => {
        const discipline = byCode.get(code) ?? null;
        const approved = discipline ? reviewStatusOf(discipline) === 'Approved' : false;
        const hasEvidence = evidence[code] ?? false;
        return {
            code,
            label: STEP_LABELS[code] ?? code,
            status: stepStatusOf(approved, hasEvidence),
            readyToComplete: isReadyToComplete(approved, hasEvidence),
            discipline,
        };
    });

    return { steps, completed: completeness(steps.map((s) => s.status)), total: steps.length };
}
