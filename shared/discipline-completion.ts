/**
 * Một bước D được phép DUYỆT chưa — tính từ chính dữ liệu task, không từ lời
 * khai của người bấm.
 *
 * ── Vì sao có file này ──
 * Trước đây duyệt D3/D5/D7 trên UI đi kèm một vòng `map(status: 'Done')` lên
 * TOÀN BỘ task: bước được duyệt thì mọi việc trong nó "đã xong", dù chưa ai làm
 * việc nào. Đó là máy tự quyết thay người, đúng chỗ mà một bản 8D phải chứng
 * minh ngược lại. Giờ task chỉ thành Done qua thao tác riêng của người phụ trách
 * (upload bằng chứng, hoặc ghi chú thực thi khi bằng chứng không bắt buộc), và
 * bước chỉ duyệt được khi từng task đã như vậy.
 *
 * Đặt ở `shared/` để backend chặn (nguồn quyết định) và UI hiện checklist dùng
 * CÙNG một luật — hai bản luật thì sớm muộn sẽ nói hai điều khác nhau.
 */

import { normalizeActionStatus, normalizeTasks, type ActionTask } from './action-task';

/**
 * Bước nào phải DUYỆT xong thì bước này mới được bắt đầu / duyệt.
 *
 * Gần như nối đuôi D1→D8, trừ cặp D5/D6: D5 giao việc, D6 theo dõi chính những
 * việc đó tới Done — hai bước chạy song song, cùng mở khi D4 xong. D7 là chỗ hai
 * nhánh gặp lại, nên đợi cả hai. Backend (cổng thật) và UI cùng đọc bảng này.
 */
export const STEP_PREREQUISITES: Record<string, readonly string[]> = {
    D1: [],
    D2: ['D1'],
    D3: ['D2'],
    D4: ['D3'],
    D5: ['D4'],
    D6: ['D4'],
    D7: ['D5', 'D6'],
    D8: ['D7'],
};

/** Các bước tiên quyết của `code` chưa duyệt — rỗng nghĩa là đã mở khoá. */
export function blockingPrerequisites(code: string, isApproved: (code: string) => boolean): string[] {
    return (STEP_PREREQUISITES[code] ?? []).filter((prev) => !isApproved(prev));
}

/** Bước có task giao cho người, và nhánh JSON chứa task của từng bước. */
export const ACTION_STEP_PREFIX: Record<string, 'containment' | 'corrective' | 'preventive'> = {
    D3: 'containment',
    D5: 'corrective',
    D7: 'preventive',
};

export type CompletionIssue =
    | 'no-actions'
    | 'not-done'
    | 'no-assignee'
    | 'evidence-missing'
    | 'prerequisite-open';

export interface CompletionBlocker {
    /** Bước đang bị chặn. */
    code: string;
    issue: CompletionIssue;
    /** Task gây chặn, nếu chặn ở mức task. */
    taskId?: string;
    taskName?: string;
    /** Câu đọc được cho người — nêu đích danh task và việc còn thiếu. */
    message: string;
}

export interface CompletionVerdict {
    canApprove: boolean;
    blockers: CompletionBlocker[];
}

/** Task đã chốt (assignedActions) của một bước, chịu được cả hai kiểu lưu cũ/mới. */
export function assignedTasksOf(code: string, result: Record<string, any> | null | undefined): ActionTask[] {
    const prefix = ACTION_STEP_PREFIX[code];
    if (!prefix || !result) return [];
    return normalizeTasks(result?.[prefix]?.assignedActions ?? result?.assignedActions);
}

/** AI đã đề xuất hành động nào chưa (chưa cần ai nhận). */
function suggestedActionsOf(code: string, result: Record<string, any> | null | undefined): unknown[] {
    const prefix = ACTION_STEP_PREFIX[code];
    const list = prefix ? result?.[prefix]?.actions : null;
    return Array.isArray(list) ? list : [];
}

function parse(value: unknown): Record<string, any> | null {
    if (!value) return null;
    if (typeof value === 'object') return value as Record<string, any>;
    try {
        const parsed = JSON.parse(String(value));
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

export interface CompletionInput {
    code: string;
    /** `resultJson` của bước đang duyệt — chuỗi hoặc đã parse. */
    resultJson: unknown;
    /**
     * Task id đã có file bằng chứng (bảng `TaskEvidences`) của bước sở hữu task:
     * chính bước này với D3/D7, và D5 khi đang duyệt D6 (task D5 nộp bằng chứng
     * ở màn hình D6 nhưng vẫn lưu dưới mã D5). Thiếu tham số nghĩa là không biết
     * — coi như chưa có bằng chứng nào, vì "không tra được" không phải là "đã có".
     */
    evidenceTaskIds?: Iterable<string>;
    /** Các bước anh em, cho luật liên bước (D6 đọc task của D5). */
    siblings?: { code: string; resultJson: unknown }[];
}

const label = (task: ActionTask) => `${task.name || task.id}`;

/**
 * Từng task phải có người phụ trách, đã Done, và có bằng chứng NẾU task đó yêu
 * cầu bằng chứng. Task không yêu cầu bằng chứng thì KHÔNG bị đòi thêm — "không
 * yêu cầu" khác "đang thiếu".
 *
 * `code` là bước đang duyệt (bị chặn); `owner` là bước sở hữu task — khác nhau
 * khi D6 duyệt task của D5.
 */
function taskExecutionBlockers(
    code: string,
    owner: string,
    tasks: ActionTask[],
    evidenceTaskIds: Iterable<string> | undefined,
): CompletionBlocker[] {
    const blockers: CompletionBlocker[] = [];
    const evidence = new Set(evidenceTaskIds ?? []);
    for (const task of tasks) {
        const ref = { code, taskId: task.id, taskName: task.name };
        if (!task.assignee) {
            blockers.push({ ...ref, issue: 'no-assignee', message: `${owner} task "${label(task)}" has no assignee.` });
        }
        const status = normalizeActionStatus(task.status);
        if (status !== 'Done') {
            blockers.push({ ...ref, issue: 'not-done', message: `${owner} task "${label(task)}" is ${status}, not Done.` });
        }
        // Bằng chứng: file trong TaskEvidences, hoặc file đính kèm lưu sẵn trong
        // task (dữ liệu nạp từ kho/seed mang theo `attachments`).
        const required = task.evidenceRequired ?? true;
        const hasEvidence = evidence.has(task.id) || task.attachments.length > 0;
        if (required && !hasEvidence) {
            blockers.push({
                ...ref,
                issue: 'evidence-missing',
                message: `${owner} task "${label(task)}" requires completion evidence and none is uploaded.`,
            });
        }
    }
    return blockers;
}

/**
 * Luật duyệt cho từng bước. Trả danh sách chặn rỗng nghĩa là duyệt được.
 *
 * - D3/D7: luật thực thi đầy đủ cho từng task (xem `taskExecutionBlockers`).
 *   D7 còn cần ít nhất một hành động.
 * - D5: chỉ là GIAO VIỆC — duyệt được ngay khi có ít nhất một task đã có người
 *   nhận. Việc làm xong và nộp bằng chứng thuộc về D6, nên D5 không đòi Done.
 * - D6: quản lý thực thi task của D5 — mọi task D5 phải có người, Done, và có
 *   bằng chứng nếu bắt buộc; D5 chưa giao task nào thì chưa có gì để kiểm.
 * - Bước khác: không có luật task — cổng D8 nằm ở `evaluateClosureGate`.
 */
export function evaluateDisciplineCompletion(input: CompletionInput): CompletionVerdict {
    const { code } = input;
    const blockers: CompletionBlocker[] = [];
    const result = parse(input.resultJson);

    if (code === 'D5') {
        if (!assignedTasksOf('D5', result).some((t) => t.assignee)) {
            blockers.push({
                code,
                issue: 'no-actions',
                message: 'D5 has no assigned corrective task yet - assign at least one task to an owner.',
            });
        }
    } else if (ACTION_STEP_PREFIX[code]) {
        const tasks = assignedTasksOf(code, result);
        if (code === 'D7' && tasks.length === 0 && suggestedActionsOf(code, result).length === 0) {
            blockers.push({
                code,
                issue: 'no-actions',
                message: 'D7 has no preventive action yet - add or accept at least one.',
            });
        }
        blockers.push(...taskExecutionBlockers(code, code, tasks, input.evidenceTaskIds));
    }

    if (code === 'D6') {
        const d5 = (input.siblings ?? []).find((s) => s.code === 'D5');
        const d5Tasks = assignedTasksOf('D5', parse(d5?.resultJson));
        if (d5Tasks.length === 0) {
            blockers.push({
                code,
                issue: 'prerequisite-open',
                message: 'D5 has no assigned corrective task yet - there is nothing to verify.',
            });
        }
        blockers.push(...taskExecutionBlockers(code, 'D5', d5Tasks, input.evidenceTaskIds));
    }

    return { canApprove: blockers.length === 0, blockers };
}

/** Một câu gộp cho thông báo lỗi 400. */
export function describeBlockers(blockers: CompletionBlocker[]): string {
    if (blockers.length === 0) return '';
    const head = `Cannot approve ${blockers[0].code}: ${blockers.length} item${blockers.length > 1 ? 's' : ''} still open.`;
    return [head, ...blockers.map((b) => `• ${b.message}`)].join('\n');
}
