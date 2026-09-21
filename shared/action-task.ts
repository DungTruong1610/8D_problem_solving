/**
 * Chuyển một hành động AI đề xuất thành một TASK giao được cho người.
 *
 * ── Vì sao là hai thứ khác nhau ──
 * Hành động AI đề xuất chỉ có mấy chữ: "Replace clamp pads". Đủ để đọc, không đủ
 * để giao việc. Muốn giao thì phải có người nhận, thời hạn, mô tả đủ để người
 * nhận hiểu mà không cần hỏi lại, và chỗ đính kèm bằng chứng khi làm xong.
 *
 * Nên bảng task KHÔNG phải là danh sách đề xuất được tô màu khác. Nó là bản ghi
 * riêng, do người xác nhận, và chỉ sinh ra khi có người bấm Accept — giống hệt
 * quan hệ giữa `team.roster` (AI đề xuất) và `team.assignedRoster` (kỹ sư chốt)
 * ở D1.
 *
 * Đặt ở `shared/` để jest của backend test được — cùng lý do với
 * `evidence-path.ts`, `precedent-shape.ts` và `step-status.ts`.
 */

import { classifyTaskCode, taskCodeGroupOf } from './task-catalogue';

export interface ActionTaskAttachment {
    name: string;
    /** Loại hiển thị trên chip: PDF, XLS, IMG… */
    kind: string;
}

export interface ActionTask {
    /** Ổn định trong suốt vòng đời hàng — dùng làm key của React và để sửa/xoá. */
    id: string;
    name: string;
    description: string;
    /** SAP Task Processor. */
    assignee: string;
    /** SAP Time Effort. Thời gian dự kiến, tính theo ngày. 0 nghĩa là chưa ước lượng. */
    durationDays: number;
    status: string;
    /** Đề xuất này đến từ đâu: 'AI suggestion' hoặc 'User added'. */
    origin: string;
    attachments: ActionTaskAttachment[];

    /**
     * ── Ba trường Quality Task còn thiếu so với SAP ──
     * `assignee` và `durationDays` ở trên ĐÃ là Task Processor và Time Effort —
     * chúng có từ đầu, chỉ là chưa được gọi bằng tên SAP. Phase 4 thêm nốt mã
     * nhiệm vụ, nhóm của nó, và hạn dự kiến.
     *
     * Mã suy ra bằng LUẬT từ tên task (`classifyTaskCode`), rồi người sửa được
     * nếu luật đoán sai. Không bắt gõ tay từ đầu: một ô mã bắt buộc gõ tay là ô
     * người ta sẽ chọn bừa mục đầu tiên cho xong.
     *
     * Rỗng nghĩa là CHƯA MÃ HOÁ ĐƯỢC, không phải "chưa quan trọng". Xem
     * `shared/task-catalogue.ts` để biết vì sao không đoán.
     */
    taskCode: string;
    taskCodeGroup: string;
    /** Ngày bắt đầu thực hiện, dạng ISO `YYYY-MM-DD`. */
    startDate?: string;
    /** Hạn dự kiến, dạng ISO `YYYY-MM-DD`. Rỗng nghĩa là chưa ai cam kết ngày nào. */
    plannedEndDate: string;

    /** Bật/tắt yêu cầu bằng chứng (D3/D5/D7). Default: true. */
    evidenceRequired?: boolean;
    /** Đã công bố task chưa (sau khi bấm Publish). */
    published?: boolean;
    /** Ghi chú thực thi / hoàn thành do người dùng nhập. */
    note?: string;
}

/** Hình dạng một hàng hành động do AI sinh (xem `corrective.actions` trong seed). */
export interface SuggestedAction {
    action?: string;
    actionText?: string;
    owner?: string;
    status?: string;
    origin?: string;
    protection?: string;
}

export const TASK_STATUSES = ['Planned', 'Open', 'Done'] as const;
export const D3_D7_TASK_STATUSES = ['Planned', 'Open', 'Done'] as const;
export const ACTION_TASK_STATUSES = ['Planned', 'Open', 'Done'] as const;

export type TaskStatus = typeof TASK_STATUSES[number];

export function normalizeActionStatus(status?: string): 'Planned' | 'Open' | 'Done' {
    const s = String(status ?? '').trim().toLowerCase();
    if (s.includes('done') || s.includes('implement') || s.includes('complete') || s.includes('verifi')) return 'Done';
    if (s === 'open' || s.includes('open') || s.includes('progress') || s.includes('process') || s.includes('doing')) return 'Open';
    return 'Planned';
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Ngày ISO, hoặc rỗng.
 *
 * Cùng thái độ với `isoDateOrNull` ở worklist: một chuỗi không phải ngày mà được
 * giữ lại sẽ hiện lên cột hạn trông y hệt một hạn thật. Ô trống nói đúng sự thật
 * là chưa ai chốt ngày.
 */
const isoDate = (value: unknown): string => {
    const s = text(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    return Number.isNaN(Date.parse(s)) ? '' : s;
};

/**
 * Tên hiển thị của một hành động, từ bất kỳ biến thể khoá nào.
 *
 * Model đã từng trả về `action`, và ở bản cũ hơn là `actionText`. Chấp nhận cả
 * hai ở ĐÚNG MỘT chỗ, thay vì rải `?? row.actionText` khắp nơi rồi quên một chỗ.
 */
export function actionLabel(action: SuggestedAction): string {
    return text(action.action) || text(action.actionText);
}

/**
 * Đường dẫn trường chứa task đã chốt, suy từ trường chứa đề xuất.
 *
 *   containment.actions  →  containment.assignedActions
 *   corrective.actions   →  corrective.assignedActions
 *
 * Quy ước này giống D1 (`team.roster` → `team.assignedRoster`) nên người cấu
 * hình Form Editor không phải học thêm luật mới.
 */
export function assignedFieldFor(suggestionField: string): string {
    const parts = suggestionField.split('.');
    parts[parts.length - 1] = 'assignedActions';
    return parts.join('.');
}

/**
 * Dựng task từ một đề xuất.
 *
 * Những trường AI không nói gì được để TRỐNG chứ không bịa: người nhận và thời
 * hạn là cam kết của một con người, và một giá trị mặc định trông như đã có
 * người chịu trách nhiệm là kiểu nói dối tệ nhất trong bảng phân công.
 * `owner` do AI đề xuất thì giữ, vì đó là đề xuất có căn cứ chứ không phải bịa.
 */
export function taskFromAction(action: SuggestedAction, seed: string): ActionTask {
    const name = actionLabel(action);
    // Mã đọc ra từ chính câu AI viết. Đây là chỗ Phase 4 thực sự trả tiền: người
    // dùng bấm Accept một câu văn và nhận lại một việc ĐÃ CÓ MÃ, không phải một
    // ô chọn nữa phải điền. Luật không nhận ra thì để trống — ô trống ở đây là
    // lời mời chọn tay, còn một mã bừa thì không ai biết là bừa.
    const coded = classifyTaskCode(name);
    return {
        id: `task-${seed}`,
        name,
        // Mô tả mặc định lặp lại tên là vô ích; để trống thì ô detail nói thẳng
        // là chưa có, và người dùng biết mình cần viết gì vào đó.
        description: text(action.protection),
        assignee: text(action.owner),
        durationDays: 0,
        status: 'Planned',
        origin: text(action.origin) || 'AI suggestion',
        attachments: [],
        taskCode: coded?.taskCode ?? '',
        taskCodeGroup: coded?.taskCodeGroup ?? '',
        // Hạn là cam kết của một con người, y như người nhận việc. AI không đặt
        // hạn hộ — cùng lý do `assignee` không có giá trị mặc định.
        plannedEndDate: '',
        evidenceRequired: true,
        published: false,
        note: '',
    };
}

/** Đọc mảng task đã lưu, bỏ qua thứ không dùng được thay vì làm hỏng cả bảng. */
export function normalizeTasks(value: unknown): ActionTask[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((row, index) => {
        if (!row || typeof row !== 'object') return [];
        const item = row as Record<string, unknown>;
        const name = text(item.name) || actionLabel(item as SuggestedAction);
        if (!name) return [];
        const duration = Number(item.durationDays);
        // Task lưu TRƯỚC Phase 4 không có ba trường mới. Suy lại mã từ tên khi ô
        // trống là cách những task đó tự có mã ở lần mở kế tiếp, thay vì phải
        // chạy một migration lên JSON nằm trong `resultJson`.
        const stored = text(item.taskCode);
        const coded = stored ? null : classifyTaskCode(name);
        const itemStatus = text(item.status) || 'Planned';
        const isPublished = item.published !== undefined
            ? Boolean(item.published)
            : Boolean(itemStatus && !['Planned', 'Not started', 'planned'].includes(itemStatus));
        return [{
            id: text(item.id) || `task-${index}`,
            name,
            description: text(item.description),
            assignee: text(item.assignee) || text(item.owner),
            durationDays: Number.isFinite(duration) && duration > 0 ? duration : 0,
            status: itemStatus,
            origin: text(item.origin) || 'User added',
            taskCode: stored || coded?.taskCode || '',
            // Nhóm suy từ mã chứ không đọc từ dữ liệu lưu: hai ô đó phải khớp
            // nhau, và tra lại từ danh mục thì chúng không thể lệch.
            taskCodeGroup: taskCodeGroupOf(stored) || coded?.taskCodeGroup || '',
            startDate: isoDate(item.startDate) || undefined,
            plannedEndDate: isoDate(item.plannedEndDate),
            evidenceRequired: item.evidenceRequired !== undefined ? Boolean(item.evidenceRequired) : true,
            published: isPublished,
            note: text(item.note),
            attachments: Array.isArray(item.attachments)
                ? item.attachments.flatMap((a) => {
                    const att = a as Record<string, unknown>;
                    const attName = text(att?.name);
                    return attName ? [{ name: attName, kind: text(att.kind) || 'FILE' }] : [];
                })
                : [],
        }];
    });
}

/**
 * Thêm task mới vào danh sách, bỏ qua cái đã có.
 *
 * Trùng tính theo TÊN chứ không theo id: bấm Accept hai lần trên cùng một đề
 * xuất sinh ra hai id khác nhau nhưng vẫn là một việc, và bảng phân công có hai
 * dòng giống hệt là lỗi người dùng nhìn thấy ngay.
 */
export function mergeTasks(existing: ActionTask[], incoming: ActionTask[]): ActionTask[] {
    const seen = new Set(existing.map((task) => task.name.toLowerCase()));
    const fresh = incoming.filter((task) => {
        const key = task.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    return fresh.length ? [...existing, ...fresh] : existing;
}

/** Đề xuất đã được nhận vào bảng task chưa. */
export function isAccepted(action: SuggestedAction, tasks: ActionTask[]): boolean {
    const label = actionLabel(action).toLowerCase();
    return Boolean(label) && tasks.some((task) => task.name.toLowerCase() === label);
}
