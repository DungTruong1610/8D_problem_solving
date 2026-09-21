/**
 * Thứ tự sinh tám bước 8D.
 *
 * Sinh từng bước cho phép trả kết quả sớm ra UI, nhưng chạy tuần tự D1→D8 thì
 * tám lượt gọi model xếp hàng nối đuôi nhau — chậm hơn hẳn một lượt gọi gộp mà
 * bản đầu tiên đã dùng. Thực tế 8D KHÔNG phải một chuỗi thẳng: D1 (nhóm) và D2
 * (mô tả vấn đề) chẳng cần biết gì về nhau, D3 (chặn tạm) và D4 (nguyên nhân
 * gốc) đều chỉ dựa vào D2.
 *
 * Nên ở đây khai báo phụ thuộc THẬT, rồi xếp bước thành từng đợt theo mức
 * topo. Bước cùng một đợt chạy song song; đợt sau chỉ bắt đầu khi đợt trước
 * xong, nên mỗi bước vẫn nhìn thấy đúng những bước nó cần.
 *
 * Khai báo phụ thuộc thay vì viết cứng danh sách đợt là có chủ ý: sửa một cạnh
 * thì các đợt tự tính lại: không thể xảy ra chuyện đổi thứ tự rồi quên cập nhật.
 */

import { DISCIPLINE_CODES, type DisciplineCode } from './types';

/**
 * `X: [Y]` nghĩa là Y phải XONG trước khi X bắt đầu.
 *
 * ── Đây là ràng buộc THỨ TỰ, không phải bộ lọc ngữ cảnh ──
 * Prompt của một bước nhận TẤT CẢ những bước đã xong tính tới đầu đợt của nó,
 * không chỉ riêng những bước khai ở đây. Nên bảng này là mức TỐI THIỂU được bảo
 * đảm: khai `D5: ['D3','D4']` nghĩa là D5 chắc chắn thấy D3 và D4 — trên thực
 * tế nó thấy cả D1, D2 nữa vì hai bước đó đã xong từ đợt đầu.
 *
 * ── Vì sao chặt hơn là đáng ──
 * Sinh song song mà không ràng buộc thì D4 có thể kết luận nguyên nhân gốc theo
 * một hướng trong khi D2 mô tả vấn đề theo hướng khác — hai phần của cùng một
 * báo cáo nói hai chuyện, và không ai biết tin phần nào. Mỗi cạnh dưới đây là
 * một chỗ mà sự lệch đó sẽ lộ ra trước mặt khách hàng.
 *
 *   D3, D4 ← D2   Không chặn tạm hay truy nguyên nhân cho một vấn đề chưa được
 *                 mô tả xong. Đây là cạnh quan trọng nhất.
 *   D5 ← D3, D4   Hành động khắc phục phải gỡ đúng nguyên nhân gốc (D4), và
 *                 phải biết cái gì đã được chặn tạm (D3) để không làm trùng,
 *                 đồng thời nói được biện pháp tạm nào sẽ gỡ bỏ khi fix vĩnh
 *                 viễn có hiệu lực.
 *   D6 ← D4, D5   Xác minh là chứng minh hành động (D5) đã triệt tiêu nguyên
 *                 nhân (D4). Thiếu một trong hai thì tiêu chí nghiệm thu không
 *                 neo vào đâu cả.
 *   D7 ← D4, D5   Phòng ngừa mở rộng bản sửa ra toàn hệ thống, nên phải biết cả
 *                 nguyên nhân lẫn bản sửa. (Bản trước cố tình cắt cạnh D5 để
 *                 tiết kiệm một đợt — hoá ra không tiết kiệm được gì, xem
 *                 test về số đợt.)
 *   D8 ← D5..D7   Đóng case tổng kết những gì đã làm và những gì còn dở.
 *
 * D1 và D2 không phụ thuộc ai nên chạy ngay đợt đầu — người dùng mở được nhóm
 * 8D và bản mô tả vấn đề trong khoảng 15 giây đầu.
 */
export const STEP_DEPENDENCIES: Record<DisciplineCode, readonly DisciplineCode[]> = {
    D1: [],
    D2: [],
    D3: ['D2'],
    D4: ['D2'],
    D5: ['D3', 'D4'],
    D6: ['D4', 'D5'],
    D7: ['D4', 'D5'],
    D8: ['D5', 'D6', 'D7'],
};

/**
 * Xếp các bước thành từng đợt chạy song song theo mức topo.
 *
 * Mức của một bước = 1 + mức lớn nhất trong các bước nó phụ thuộc; bước không
 * phụ thuộc ai ở mức 0. Bước cùng mức không thể phụ thuộc lẫn nhau nên chạy
 * song song được.
 *
 * Phụ thuộc trỏ ra ngoài `codes` bị BỎ QUA chứ không làm hỏng kế hoạch — nhờ
 * vậy sinh lại một phần (ví dụ chỉ D5..D8) vẫn dùng được đúng hàm này.
 *
 * @throws {Error} khi đồ thị có chu trình — thà hỏng lúc khởi động còn hơn sinh
 *   ra một báo cáo thiếu bước mà không ai để ý.
 */
export function planStepWaves(
    codes: readonly DisciplineCode[] = DISCIPLINE_CODES,
    dependencies: Record<DisciplineCode, readonly DisciplineCode[]> = STEP_DEPENDENCIES,
): DisciplineCode[][] {
    const inScope = new Set(codes);
    const level = new Map<DisciplineCode, number>();

    const resolve = (code: DisciplineCode, seen: DisciplineCode[]): number => {
        const cached = level.get(code);
        if (cached !== undefined) return cached;
        if (seen.includes(code)) {
            throw new Error(`Phụ thuộc vòng giữa các bước 8D: ${[...seen, code].join(' → ')}`);
        }
        const deps = (dependencies[code] ?? []).filter((dep) => inScope.has(dep));
        const value = deps.length
            ? 1 + Math.max(...deps.map((dep) => resolve(dep, [...seen, code])))
            : 0;
        level.set(code, value);
        return value;
    };

    const waves: DisciplineCode[][] = [];
    for (const code of codes) {
        const index = resolve(code, []);
        (waves[index] ??= []).push(code);
    }
    // Mảng thưa khi một mức không có bước nào; `filter` bỏ ô trống để bên gọi
    // chỉ việc lặp tuần tự.
    return waves.filter((wave) => wave?.length);
}
