/**
 * Kết quả đánh giá MỘT đầu vào lạ (sandbox giám khảo / `--judge-input`).
 *
 * ── Vì sao có hợp đồng riêng ──
 * Bản cũ trả về và hiển thị những thứ không xảy ra: "similarity 88%" hay "24%"
 * gán cứng, "Autonomous D1–D8 drafting completed" trong khi không report nào
 * được tạo, tám dòng D1–D8 bịa sẵn, và một điểm tự chấm "4 / 4". Đề bài chấm 0
 * cho đúng kiểu đó: kết quả sai mà khẳng định là đúng.
 *
 * Mọi trường ở đây là thứ đã thật sự được kiểm: dữ kiện bóc từ chính đầu vào,
 * số case trong kho đã đếm, và các lần dừng theo luật `stops.ts`. Sandbox KHÔNG
 * tạo report và nói rõ điều đó.
 */

export type JudgeDecision = 'HANDLED_APPROPRIATELY' | 'ESCALATED' | 'GRACEFULLY_REFUSED';

/** Trùng với `StopType` của backend — `shared/` không import được `srv/`. */
export type JudgeStopType = 'unverified-facts' | 'outside-scope' | 'exceeds-authority';

export const JUDGE_STOP_LABEL: Record<JudgeStopType, string> = {
    'unverified-facts': 'Unverified facts',
    'outside-scope': 'Outside scope',
    'exceeds-authority': 'Exceeds authority',
};

export interface JudgeStop {
    id: string;
    type: JudgeStopType;
    step: string;
    reason: string;
    questionForHuman: string;
    requiredRole: string;
    blocking: boolean;
}

export interface JudgeEvaluation {
    decision: JudgeDecision;
    /** Một câu, nêu đúng lý do quyết định. */
    reason: string;
    timestamp: string;
    durationMs: number;
    /** Loại dừng chính (dữ kiện > phạm vi > thẩm quyền), null khi không dừng. */
    primaryStopType: JudgeStopType | null;
    stops: JudgeStop[];
    facts: {
        notificationId: string | null;
        documentType: string;
        symptom: string | null;
        materialId: string | null;
        workCenterId: string | null;
        defectCode: string | null;
        measurements: { characteristic: string; measured: string; spec: string }[];
        /** Dữ liệu thiếu mà caseMapper ghi nhận — thông tin, không phải lý do dừng. */
        gaps: string[];
    };
    validation: {
        /** Lỗi chặn của bộ kiểm dataset. */
        blocking: string[];
        warnings: number;
    };
    precedentCheck: {
        performed: boolean;
        matchingCases: number;
        /** Tiêu chí đã đếm, ví dụ "same work center WC-MILL-07 and defect code DEF-0910". */
        basis: string;
        sample: string[];
    };
    nextStep: {
        title: string;
        summary: string;
        questions: string[];
        roles: string[];
    };
    /** Chỉ phía UI đặt: backend không trả lời được, đây là luật chạy tại trình duyệt. */
    simulated?: boolean;
}
