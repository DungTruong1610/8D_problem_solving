/**
 * Chất lượng vector nhúng — lớp chặn cuối trước khi ghi vào kho.
 *
 * Vector toàn số 0 là dấu hiệu provider "nhúng thất bại nhưng vẫn trả về đủ
 * chiều" (Gemini provider cũ làm đúng vậy khi API lỗi). Nếu lọt vào DB kèm nhãn
 * model hợp lệ thì:
 *
 *   1. `cosineSimilarity` trả `null` (mẫu số bằng 0) — tiêu chí ngữ nghĩa im
 *      lặng cho 0 điểm, không lỗi, không log;
 *   2. lần nhúng sau thấy `embeddingModel` khớp nên bỏ qua — vector rác ở lại
 *      vĩnh viễn.
 *
 * Chặn ở cửa ghi rẻ hơn nhiều so với đi tìm nguyên nhân "điểm ngữ nghĩa luôn
 * bằng 0" về sau.
 */

/** `true` khi vector rỗng hoặc mọi phần tử đều là 0 / không phải số hữu hạn. */
export function isDegenerateVector(vec: unknown): boolean {
  if (!Array.isArray(vec) || vec.length === 0) return true;
  for (const v of vec) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v !== 0) return false;
  }
  return true;
}
