/**
 * Trạng thái duyệt của từng bước 8D và cổng đóng case ở D8.
 *
 * ── Vì sao là module thuần ──
 * Không import cds, không chạm DB. Nhờ vậy luật "được đóng case chưa" test được
 * bằng bảng dữ liệu thay vì phải dựng một report thật trên HANA — và đây đúng là
 * loại luật phải đúng 100%: đóng nhầm một case chưa duyệt xong là lỗi nghiệp vụ
 * nhìn thấy được trong audit.
 */

/** Ba trạng thái duy nhất. Không có 'Rejected': 8D không bỏ bước, chỉ trả lại để sửa. */
export const REVIEW_STATUSES = ['Draft', 'Approved', 'ChangeRequested'] as const;
export type ReviewStatus = typeof REVIEW_STATUSES[number];

/** Quyết định người dùng bấm được. Ánh xạ 1-1 sang trạng thái đích. */
export const REVIEW_DECISIONS = ['approve', 'request-change', 'reopen'] as const;
export type ReviewDecision = typeof REVIEW_DECISIONS[number];

const DECISION_TO_STATUS: Record<ReviewDecision, ReviewStatus> = {
    approve: 'Approved',
    'request-change': 'ChangeRequested',
    // Gỡ duyệt: dùng khi ai đó bấm nhầm, hoặc khi dữ liệu nguồn đổi và kết luận
    // cũ không còn đứng vững. Đưa về Draft chứ không xoá vết — ReviewEvents giữ.
    reopen: 'Draft',
};

export function isReviewStatus(value: unknown): value is ReviewStatus {
    return typeof value === 'string' && (REVIEW_STATUSES as readonly string[]).includes(value);
}

export function isReviewDecision(value: unknown): value is ReviewDecision {
    return typeof value === 'string' && (REVIEW_DECISIONS as readonly string[]).includes(value);
}

export function statusForDecision(decision: ReviewDecision): ReviewStatus {
    return DECISION_TO_STATUS[decision];
}

/** Chuẩn hoá giá trị đọc từ DB. Hàng cũ có `reviewStatus` null vì được ghi trước khi có cột này. */
export function normalizeStatus(value: unknown): ReviewStatus {
    return isReviewStatus(value) ? value : 'Draft';
}

export interface DisciplineReviewState {
    code: string;
    reviewStatus?: string | null;
}

/** Bảy bước phải duyệt xong thì D8 mới mở. D8 tự nó không nằm trong điều kiện. */
export const CLOSURE_PREREQUISITES = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'] as const;

export interface ClosureGate {
    /** Đủ điều kiện đóng case chưa. */
    canClose: boolean;
    /** Số bước trong D1-D7 đã Approved. */
    approved: number;
    /** Tổng số bước phải duyệt — luôn là 7, để UI khỏi hardcode. */
    required: number;
    /** Mã bước đang chặn, theo đúng thứ tự D1..D7. */
    blocking: string[];
    /** Câu giải thích sẵn cho UI và cho D8. */
    reason: string;
}

/**
 * Trả lời "case này đóng được chưa" từ trạng thái duyệt của các bước.
 *
 * Bước thiếu hẳn trong danh sách cũng tính là chặn, không phải bỏ qua: một report
 * hỏng giữa chừng chỉ sinh được 5 discipline, và im lặng cho qua nghĩa là cổng
 * mở ra cho đúng những case tệ nhất.
 */
export function evaluateClosureGate(disciplines: readonly DisciplineReviewState[]): ClosureGate {
    const byCode = new Map(disciplines.map((d) => [d.code, normalizeStatus(d.reviewStatus)]));
    const blocking = CLOSURE_PREREQUISITES.filter((code) => byCode.get(code) !== 'Approved');
    const required = CLOSURE_PREREQUISITES.length;
    const approved = required - blocking.length;

    return {
        canClose: blocking.length === 0,
        approved,
        required,
        blocking: [...blocking],
        reason: blocking.length === 0
            ? `All ${required} disciplines D1-D7 are approved. The case can be closed.`
            : `${approved} of ${required} approved. Blocked by ${blocking.join(', ')}.`,
    };
}
