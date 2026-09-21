/**
 * Ghép đoạn văn đem đi nhúng cho một case.
 *
 * ── Vì sao chỗ này quan trọng hơn cả việc chọn model ──
 * Vector chỉ biết đúng những gì nằm trong đoạn văn này. Ghép ẩu thì không model
 * nào cứu được. Theo mục 3 của `docs/8d-vector-search-design.md`.
 *
 * ── Đưa vào cái gì ──
 * CHỮ MÔ TẢ HIỆN TƯỢNG: triệu chứng, mã lỗi đã giải nghĩa, nơi sản xuất, vật tư,
 * kết quả điều tra từng nhánh, nguyên nhân gốc, hành động đã làm.
 *
 * ── KHÔNG đưa vào, và vì sao ──
 *   số đo, số lượng, chi phí   embedding mù với độ lớn: `10cm` và `10m` gần như
 *                              trùng nhau. Chúng đã nằm ở cột SQL có kiểu.
 *   ngày tháng                 vector không có khái niệm thứ tự thời gian
 *   mã thô chưa giải nghĩa     `DEF-0489` với `DEF-0512` khác một ký tự, vector
 *                              coi như một. Đã có cột riêng để lọc chính xác.
 *   ID kỹ thuật, UUID          không mang nghĩa
 *
 * Nói cách khác: cái gì so BẰNG được thì để cột, cái gì chỉ so GIỐNG được mới
 * cho vào đây.
 */

import type { CaseContext } from '../types';

/** Bỏ dòng rỗng và gộp khoảng trắng — đoạn văn phải ổn định để vector ổn định. */
function tidy(lines: (string | null | undefined)[]): string {
    return lines
        .map((l) => (l ?? '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
}

/**
 * Đoạn văn nhúng của một case.
 *
 * Nhận `CaseContext` để dùng chung một đường đọc dữ liệu với cả pipeline — kho
 * lịch sử và case đang mở phải được ghép bằng CÙNG hàm này, nếu không thì vector
 * hai bên nằm ở hai phân bố khác nhau và cosine mất ý nghĩa.
 */
export function buildSearchText(ctx: CaseContext): string {
    const p = ctx.product;

    const ishikawa = ctx.ishikawa
        .filter((r) => r.description)
        .map((r) => `- ${r.category}: ${r.description}`);

    const actions = [
        ...ctx.actions.containment.map((a) => `- Containment: ${a.actionText}`),
        ...ctx.actions.corrective.map((a) => `- Corrective: ${a.actionText}`),
        ...ctx.actions.preventive.map((a) => `- Preventive: ${a.actionText}`),
    ];

    // Chuỗi 5-Why là lập luận nhân quả — phần giàu nghĩa nhất của một case, và
    // là chỗ hai case "cùng một kiểu hỏng" giống nhau rõ nhất dù mã lỗi khác.
    const fiveWhy = ctx.fiveWhy.map((r) => `- ${r.question} ${r.answer}`);

    return tidy([
        `Defect: ${p.defectText || '(not catalogued)'}.`,
        `Symptom: ${ctx.header.symptomShortText}.`,
        `Part: ${p.materialDesc || p.materialId}.`,
        `Produced at: ${p.workCenterDesc || p.workCenterId}.`,

        ishikawa.length ? 'Investigation findings:' : null,
        ...ishikawa,

        ctx.rootCause ? `Root cause (${ctx.rootCause.category}): ${ctx.rootCause.description}.` : null,

        fiveWhy.length ? 'Causal chain:' : null,
        ...fiveWhy,

        actions.length ? 'Actions taken:' : null,
        ...actions,

        ctx.lessonsLearned?.whatWorked ? `What worked: ${ctx.lessonsLearned.whatWorked}.` : null,
        ctx.lessonsLearned?.whatDidnt ? `What did not: ${ctx.lessonsLearned.whatDidnt}.` : null,
    ]);
}

/**
 * Đoạn văn truy vấn cho một case ĐANG MỞ.
 *
 * Cố ý dùng chung `buildSearchText`: case đang mở thường chưa có nguyên nhân gốc
 * hay hành động khắc phục, nên đoạn văn của nó ngắn hơn — nhưng phải được ghép
 * theo cùng công thức, nếu không thì đang so hai thứ khác loại.
 */
export const buildQueryText = buildSearchText;
