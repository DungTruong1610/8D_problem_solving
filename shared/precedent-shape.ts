/**
 * Đưa kết quả tìm tiền lệ của backend về hình dạng giao diện dùng.
 *
 * ── Vì sao nằm ở shared/ và có test ──
 * Đúng phép biến đổi này đã hỏng HAI lần liên tiếp, và cả hai lần đều hỏng im
 * lặng — không lỗi đỏ, không exception, chỉ là panel bình thản báo "không tìm
 * thấy case nào" trên một kết quả có đủ ba tiền lệ. Kiểu hỏng đó chỉ có test
 * mới bắt được, và test chỉ chạy được nếu hàm không dính vào React.
 *
 * ── Hình dạng backend trả về ──
 *   {
 *     union:         Precedent[]                        // hợp của mọi bước
 *     byStep:        { D1: { precedents, reason }, … }   // OBJECT, không phải mảng
 *     profileByStep: { D1: 'default', … }
 *   }
 *
 * Hai cái bẫy nằm đúng ở đó: không có khoá `precedents` phẳng như bản cũ, và
 * `byStep[code]` là một object kết quả chứ không phải mảng tiền lệ.
 */

/** Chỉ khai phần hình dạng mà phép chuẩn hoá thực sự chạm tới. */
export interface PrecedentLike {
    notificationId?: string;
    score?: number;
    maxScore?: number;
}

export interface NormalizedPrecedents<T = PrecedentLike> {
    /** Hợp của mọi bước, đã khử trùng. */
    precedents: T[];
    /** Tiền lệ riêng của từng bước D1–D8, đã bóc khỏi object kết quả. */
    byStep: Record<string, T[]>;
    /** Thang điểm tối đa — thuộc về TỪNG tiền lệ, không phải cả lượt tìm. */
    maxScore: number;
    /** Vì sao rỗng. Null khi có tiền lệ. */
    reason: string | null;
}

export const NO_PRECEDENT_REASON =
    'No closed case cleared the similarity threshold for this defect.';

export function normalizePrecedents<T = PrecedentLike>(raw: unknown): NormalizedPrecedents<T> {
    const root = (raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw
        : {}) as Record<string, unknown>;

    const union = Array.isArray(root.union) ? (root.union as T[]) : [];

    const rawByStep = (root.byStep && typeof root.byStep === 'object' && !Array.isArray(root.byStep)
        ? root.byStep
        : {}) as Record<string, unknown>;

    const byStep: Record<string, T[]> = {};
    for (const [code, result] of Object.entries(rawByStep)) {
        const list = (result as { precedents?: unknown } | null)?.precedents;
        byStep[code] = Array.isArray(list) ? (list as T[]) : [];
    }

    const first = union[0] as PrecedentLike | undefined;

    return {
        precedents: union,
        byStep,
        maxScore: typeof first?.maxScore === 'number' ? first.maxScore : 0,
        reason: union.length ? null : NO_PRECEDENT_REASON,
    };
}

/**
 * Đọc bản chụp tiền lệ đã lưu trên report.
 *
 * Trả `null` khi chưa có hoặc JSON hỏng, để phía gọi rơi về đường chấm tại chỗ —
 * tốt hơn là làm vỡ cả panel vì một chuỗi lỗi.
 */
export function parseStoredPrecedents<T = PrecedentLike>(
    precedentsJson: string | null | undefined,
): NormalizedPrecedents<T> | null {
    if (!precedentsJson) return null;
    try {
        return normalizePrecedents<T>(JSON.parse(precedentsJson));
    } catch {
        return null;
    }
}
