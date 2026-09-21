/**
 * Trạng thái từng bước 8D trong lúc phân tích, suy từ đồ thị phụ thuộc.
 *
 * ── Vì sao cần file này ──
 * Backend sinh tám bước theo từng ĐỢT song song (xem `srv/.../stepGraph.ts`),
 * nên bước về đích KHÔNG theo thứ tự D1..D8: D7 thường xong trước D6. Trước đây
 * FE đoán bước đang chạy bằng `index === disciplines.length`, tức giả định chạy
 * nối đuôi — sai ngay từ đợt thứ hai. Sửa tạm bằng cách báo "Generating…" cho
 * mọi bước chưa có dữ liệu thì không sai nữa, nhưng nói dối theo hướng khác:
 * D8 hiện "đang sinh" trong khi nó còn phải chờ ba đợt.
 *
 * Nằm ở `shared/` để jest của backend test được — cùng lý do với
 * `evidence-path.ts` và `precedent-shape.ts`.
 *
 * Bảng dưới đây phải khớp `STEP_DEPENDENCIES` bên backend. Có test đối chiếu hai
 * bảng, nên lệch nhau là đỏ chứ không âm thầm trôi.
 */

export const STEP_ORDER = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'] as const;
export type StepCode = (typeof STEP_ORDER)[number];

/** Bước phải xong trước khi bước này bắt đầu. Bản sao của backend, có test canh. */
export const STEP_BLOCKED_BY: Record<StepCode, readonly StepCode[]> = {
    D1: [],
    D2: [],
    D3: ['D2'],
    D4: ['D2'],
    D5: ['D3', 'D4'],
    D6: ['D4', 'D5'],
    D7: ['D4', 'D5'],
    D8: ['D5', 'D6', 'D7'],
};

export type StepProgress =
    /** Đã có dữ liệu trong DB. */
    | 'ready'
    /** Mọi bước nó chờ đã xong, nên nó đang được sinh ngay lúc này. */
    | 'generating'
    /** Còn thiếu ít nhất một bước nó chờ. */
    | 'waiting'
    /** Không phân tích, và cũng chưa có dữ liệu. */
    | 'pending';

/**
 * Suy trạng thái hiển thị của một bước.
 *
 * @param code       bước cần biết trạng thái
 * @param completed  mã của những bước ĐÃ có dữ liệu
 * @param analyzing  báo cáo có đang chạy phân tích không
 */
export function stepProgress(
    code: StepCode,
    completed: Iterable<string>,
    analyzing: boolean,
): StepProgress {
    const done = completed instanceof Set ? completed : new Set(completed);
    if (done.has(code)) return 'ready';
    if (!analyzing) return 'pending';
    // Chờ chính xác là "còn một bước mình phụ thuộc chưa xong". Phân biệt được
    // hai trạng thái này mới cho người dùng biết còn bao lâu nữa tới lượt mình
    // — thay vì tám con quay giống hệt nhau quay cùng lúc.
    return STEP_BLOCKED_BY[code].every((dep) => done.has(dep)) ? 'generating' : 'waiting';
}

/** Những bước còn thiếu khiến `code` chưa chạy được. Rỗng khi nó sẵn sàng. */
export function blockedBy(code: StepCode, completed: Iterable<string>): StepCode[] {
    const done = completed instanceof Set ? completed : new Set(completed);
    return STEP_BLOCKED_BY[code].filter((dep) => !done.has(dep));
}
