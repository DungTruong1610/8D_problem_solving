/**
 * Cắt `CaseContext` thành bộ bằng chứng MÙ cho bước chẩn đoán độc lập.
 *
 * ── Vì sao phải có file này ──
 * Golden Dataset đã chứa sẵn đáp án: dòng Ishikawa nào là nguyên nhân gốc, chuỗi
 * 5-Why đầy đủ, action khắc phục, liên kết FMEA. Đưa nguyên xi cho model rồi bảo
 * "hãy phân tích nguyên nhân" thì nó chỉ việc chép lại — và đó chính là lý do
 * báo cáo sinh ra trông không khác một parser có văn phong.
 *
 * Ở đây ta lấy đi mọi thứ tiết lộ kết luận, chỉ chừa lại bằng chứng thô mà một
 * kỹ sư chất lượng thực sự có trong tay khi bắt đầu điều tra. Model không thể
 * parse ra thứ không nằm trong input; nó buộc phải suy luận.
 *
 * ── Cắt gì và vì sao ──
 *   rootCause          đáp án, hiển nhiên phải giấu
 *   ishikawa.isRootCause  cờ đánh dấu đáp án trên từng dòng
 *   fiveWhy            chính là lập luận cần tái tạo
 *   actions.corrective 'Replace worn deburring tool' → lộ ngay nguyên nhân
 *   actions.preventive 'Add tool-life counter alarm'  → lộ ngay nguyên nhân
 *   fmea               'Deburring tool wear'          → lộ ngay nguyên nhân
 *   lessonsLearned     'Tool-life data isolated the root cause' → lộ ngay
 *
 * ── Giữ gì ──
 *   inspections        số đo thật, đây là bằng chứng gốc
 *   ishikawa mô tả     dữ liệu điều tra từng nhánh, KHÔNG có kết luận
 *   isIsNot            công cụ khoanh vùng kinh điển của D2
 *   actions.containment hành động bảo vệ, không nói gì về nguyên nhân
 *   header, product    bối cảnh
 */

import type { CaseContext } from './types';

export interface BlindEvidence {
    notificationId: string;
    origin: string;
    header: CaseContext['header'];
    product: CaseContext['product'];
    inspections: CaseContext['inspections'];
    historicalInspectionLots?: CaseContext['historicalInspectionLots'];
    isIsNot: CaseContext['isIsNot'];
    /** Sáu nhánh Ishikawa, ĐÃ BỎ cờ `isRootCause`. */
    investigationFindings: Array<{
        category: string;
        finding: string;
        metricValue: string | null;
        dataSource: string;
    }>;
    /** Chỉ hành động ngăn chặn — không tiết lộ chẩn đoán. */
    containmentTaken: CaseContext['actions']['containment'];
}

export function buildBlindEvidence(context: CaseContext): BlindEvidence {
    return {
        notificationId: context.notificationId,
        origin: context.origin,
        header: context.header,
        product: context.product,
        inspections: context.inspections,
        historicalInspectionLots: context.historicalInspectionLots,
        isIsNot: context.isIsNot,
        investigationFindings: context.ishikawa.map((r) => ({
            category: r.category,
            finding: r.description,
            metricValue: r.metricValue,
            dataSource: r.source,
        })),
        containmentTaken: context.actions.containment,
    };
}

/**
 * Kiểm tra bộ bằng chứng mù thật sự không rò đáp án.
 *
 * Chạy ở runtime trước mỗi lời gọi, không chỉ trong test: `CaseContext` sẽ còn
 * được thêm trường, và một trường mới vô tình mang theo kết luận sẽ âm thầm biến
 * bài kiểm tra độc lập thành trò hề mà không ai nhận ra.
 *
 * @returns Danh sách chỗ rò. Rỗng nghĩa là sạch.
 */
export function auditBlindEvidence(
    evidence: BlindEvidence,
    context: CaseContext,
): string[] {
    const leaks: string[] = [];
    const blob = JSON.stringify(evidence).toLowerCase();

    // Cờ đáp án không được xuất hiện dưới bất kỳ dạng nào.
    if (/"isrootcause"|"is_root_cause"/.test(blob)) {
        leaks.push('Cờ isRootCause vẫn còn trong bằng chứng mù.');
    }

    // Văn bản của chuỗi 5-Why không được lọt vào.
    for (const step of context.fiveWhy) {
        const fragment = step.answer.slice(0, 40).toLowerCase();
        if (fragment.length > 15 && blob.includes(fragment)) {
            leaks.push(`Câu trả lời 5-Why bước ${step.stepNo} bị rò.`);
        }
    }

    // Action khắc phục/phòng ngừa gọi thẳng tên nguyên nhân.
    for (const a of [...context.actions.corrective, ...context.actions.preventive]) {
        const fragment = a.actionText.slice(0, 40).toLowerCase();
        if (fragment.length > 15 && blob.includes(fragment)) {
            leaks.push(`Action ${a.actionType} #${a.lineNo} bị rò.`);
        }
    }

    if (context.fmea && blob.includes(context.fmea.description.toLowerCase())) {
        leaks.push('Mô tả FMEA bị rò.');
    }

    if (context.lessonsLearned) {
        const fragment = context.lessonsLearned.whatWorked.slice(0, 40).toLowerCase();
        if (fragment.length > 15 && blob.includes(fragment)) {
            leaks.push('Lessons learned bị rò.');
        }
    }

    return leaks;
}
