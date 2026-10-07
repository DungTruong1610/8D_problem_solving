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
     * Task id đã có file bằng chứng (bảng `TaskEvidences`) của CHÍNH bước này.
     * Thiếu tham số nghĩa là không biết — coi như chưa có bằng chứng nào, vì
     * "không tra được" không phải là "đã có".
     */
    evidenceTaskIds?: Iterable<string>;
    /** Các bước anh em, cho luật liên bước (D6 đọc task của D5). */
    siblings?: { code: string; resultJson: unknown }[];
}

const label = (task: ActionTask) => `${task.name || task.id}`;

/**
 * Luật duyệt cho từng bước. Trả danh sách chặn rỗng nghĩa là duyệt được.
 *
 * - D3/D5/D7: mỗi task đã giao phải có người phụ trách, đã Done, và có bằng
 *   chứng NẾU task đó yêu cầu bằng chứng. Task không yêu cầu bằng chứng thì
 *   KHÔNG bị đòi thêm — "không yêu cầu" khác "đang thiếu".
 *   D5/D7 còn cần ít nhất một hành động (giữ nguyên luật cũ của UI).
 * - D6: mọi task khắc phục của D5 phải Done (luật cũ của backend, dời vào đây).
 * - Bước khác: không có luật task — cổng D8 nằm ở `evaluateClosureGate`.
 */
export function evaluateDisciplineCompletion(input: CompletionInput): CompletionVerdict {
    const { code } = input;
    const blockers: CompletionBlocker[] = [];
    const result = parse(input.resultJson);

    if (ACTION_STEP_PREFIX[code]) {
        const tasks = assignedTasksOf(code, result);
        const evidence = new Set(input.evidenceTaskIds ?? []);

        if ((code === 'D5' || code === 'D7') && tasks.length === 0 && suggestedActionsOf(code, result).length === 0) {
            blockers.push({
                code,
                issue: 'no-actions',
                message: `${code} has no ${code === 'D5' ? 'corrective' : 'preventive'} action yet — add or accept at least one.`,
            });
        }

        for (const task of tasks) {
            const ref = { code, taskId: task.id, taskName: task.name };
            if (!task.assignee) {
                blockers.push({ ...ref, issue: 'no-assignee', message: `${code} task "${label(task)}" has no assignee.` });
            }
            const status = normalizeActionStatus(task.status);
            if (status !== 'Done') {
                blockers.push({ ...ref, issue: 'not-done', message: `${code} task "${label(task)}" is ${status}, not Done.` });
            }
            // Bằng chứng: file trong TaskEvidences, hoặc file đính kèm lưu sẵn trong
            // task (dữ liệu nạp từ kho/seed mang theo `attachments`).
            const required = task.evidenceRequired ?? true;
            const hasEvidence = evidence.has(task.id) || task.attachments.length > 0;
            if (required && !hasEvidence) {
                blockers.push({
                    ...ref,
                    issue: 'evidence-missing',
                    message: `${code} task "${label(task)}" requires completion evidence and none is uploaded.`,
                });
            }
        }
    }

    if (code === 'D6') {
        const d5 = (input.siblings ?? []).find((s) => s.code === 'D5');
        for (const task of assignedTasksOf('D5', parse(d5?.resultJson))) {
            const status = normalizeActionStatus(task.status);
            if (status !== 'Done') {
                blockers.push({
                    code,
                    issue: 'prerequisite-open',
                    taskId: task.id,
                    taskName: task.name,
                    message: `D5 task "${label(task)}" is ${status} — verify effectiveness only after every corrective action is Done.`,
                });
            }
        }
    }

    return { canApprove: blockers.length === 0, blockers };
}

/** Một câu gộp cho thông báo lỗi 400. */
export function describeBlockers(blockers: CompletionBlocker[]): string {
    if (blockers.length === 0) return '';
    const head = `Cannot approve ${blockers[0].code}: ${blockers.length} item${blockers.length > 1 ? 's' : ''} still open.`;
    return [head, ...blockers.map((b) => `• ${b.message}`)].join('\n');
}
