/**
 * Tầng 1 — tuân thủ. HÀM THUẦN, không AI, đối chiếu được bằng tay.
 *
 * ── Vì sao tầng này phải đi TRƯỚC judge ──
 * Đây là xương sống, và nó đáng tin tuyệt đối vì không có model nào tham gia.
 * Mọi thứ ở đây là luật đúng/sai: đủ tám discipline hay không, D6 có thật sự
 * `dataBacked = false` hay không, discipline khai `dataBacked` có còn `sources`
 * sau khi lọc hay không. Không có chỗ nào cho ý kiến.
 *
 * Phần lớn luật dưới đây đã tồn tại ở `scripts/run-analyze.ts` dưới dạng một
 * checklist pass/fail chạy tay và không sinh ra con số nào. File này nâng nó
 * thành một thẻ điểm — cùng luật, cùng kết luận, nhưng lưu được và so được giữa
 * hai lần chạy.
 *
 * ── Vì sao KHÔNG trộn điểm này vào điểm judge ──
 * Luật cứng của cả tính năng: ba tầng hiện ra thành ba con số riêng. Trộn một
 * điểm tất định vào ý kiến của một model sẽ phá đúng cái thông tin đáng giá —
 * và phá luôn khế ước "tính lại được bằng tay" mà cả hệ thống này dựa vào.
 */

import type { DisciplineDraft, EightDResult } from '../eightd/types';

/** Kết quả một phép kiểm. `n-a` khi case không có dữ kiện để kiểm. */
export type CheckOutcome = 'pass' | 'fail' | 'n-a';

export interface ComplianceCheck {
    id: string;
    label: string;
    outcome: CheckOutcome;
    /** Giá trị đã thấy, để người đọc không phải tự đi tra lại. */
    detail: string;
    /**
     * Phép kiểm này có phải luật CHỐNG BỊA hay không.
     *
     * Trượt một luật chống bịa nặng hơn hẳn trượt một luật hình thức: nó nghĩa là
     * báo cáo đang khẳng định một điều không có gì đỡ. Đánh dấu ở đây để thẻ điểm
     * nói được "trượt 2 phép, trong đó 1 phép chống bịa" thay vì chỉ "trượt 2".
     */
    antiFabrication?: boolean;
}

export interface ComplianceReport {
    checks: ComplianceCheck[];
    passed: number;
    failed: number;
    notApplicable: number;
    /** Số phép chống bịa bị trượt. Đây là con số phải nhìn trước tiên. */
    antiFabricationFailures: number;
    /** `passed / (passed + failed)`, hoặc null khi không phép nào áp dụng được. */
    ratio: number | null;
    /** Tổng vi phạm ràng buộc mà `postProcess` ghi lại, theo mã luật. */
    violationsByRule: Record<string, number>;
    violationCount: number;
    /** Số lần `postProcess` phải dựng lại một phần output. */
    repairCount: number;
}

/** Bối cảnh tối thiểu mà các phép kiểm cần. Cố ý hẹp để test không phải dựng cả CaseContext. */
export interface ComplianceInput {
    result: EightDResult;
    /** true khi origin = Q1 — quyết định `customerSummary` phải có hay phải null. */
    isCustomerFacing: boolean;
    /** Case này có preventive action nào được ghi hay không. */
    hasPreventiveActions: boolean;
    /** Chuỗi 5-Why mà AI tự dựng lúc chưa thấy đáp án. */
    derivedFiveWhyLength: number;
    /** Số nhánh AI đã loại trừ trong chẩn đoán mù. */
    ruledOutCount: number;
    /** Đường rò đáp án mà `auditBlindEvidence` phát hiện. Rỗng là đạt. */
    blindLeaks: readonly string[];
    /** `validationJson` của từng discipline, đã parse. */
    validation?: Partial<Record<string, {
        violations?: Array<{ ruleId?: string } | string>;
        repairs?: unknown[];
    }>>;
}

const EXPECTED_ORDER = 'D1,D2,D3,D4,D5,D6,D7,D8';

function step(result: EightDResult, code: string): DisciplineDraft | undefined {
    return result.disciplines.find((d) => d.code === code);
}

/**
 * Chạy toàn bộ phép kiểm tầng 1.
 *
 * Thứ tự các phép là thứ tự đọc: hình dạng báo cáo trước, rồi luật chống bịa,
 * rồi chất lượng lập luận. Ai đọc thẻ điểm từ trên xuống sẽ gặp lỗi nghiêm trọng
 * nhất trước.
 */
export function checkCompliance(input: ComplianceInput): ComplianceReport {
    const { result } = input;
    const codes = result.disciplines.map((d) => d.code).join(',');
    const checks: ComplianceCheck[] = [];

    const add = (
        id: string,
        label: string,
        outcome: CheckOutcome,
        detail = '',
        antiFabrication = false,
    ) => checks.push({ id, label, outcome, detail, ...(antiFabrication ? { antiFabrication } : {}) });

    // ── Hình dạng báo cáo ────────────────────────────────────────────────────
    add('all-eight', 'Đủ tám discipline',
        result.disciplines.length === 8 ? 'pass' : 'fail',
        `${result.disciplines.length}`);

    add('order', 'Đúng thứ tự D1…D8',
        codes === EXPECTED_ORDER ? 'pass' : 'fail', codes);

    add('sequence-matches-code', '`sequence` khớp thứ tự bước',
        result.disciplines.every((d, i) => d.sequence === i + 1) ? 'pass' : 'fail',
        result.disciplines.map((d) => d.sequence).join(','));

    add('internal-summary', 'internalSummary không rỗng',
        result.internalSummary?.trim() ? 'pass' : 'fail');

    // ── Luật chống bịa ───────────────────────────────────────────────────────
    //
    // Bốn phép dưới đây là lý do tồn tại của cả kiến trúc. Trượt một trong số
    // chúng nghĩa là báo cáo đang khẳng định một điều không có gì đỡ.

    const d6 = step(result, 'D6');
    add('d6-not-data-backed', 'D6 dataBacked = false',
        d6 ? (d6.dataBacked === false ? 'pass' : 'fail') : 'fail',
        d6 ? `dataBacked=${d6.dataBacked}` : 'thiếu D6', true);

    const unsourced = result.disciplines.filter((d) => d.dataBacked && d.sources.length === 0);
    add('sources-when-data-backed', 'Mọi discipline dataBacked đều có sources',
        unsourced.length === 0 ? 'pass' : 'fail',
        unsourced.map((d) => d.code).join(',') || '—', true);

    // Case KHÔNG có preventive action thì D7 phải tự khai là không có dữ liệu.
    // Đây là phép thử chống bịa quan trọng nhất — xem `mock-data/README.md`.
    const d7 = step(result, 'D7');
    if (input.hasPreventiveActions) {
        add('d7-honest-when-empty', 'D7 dataBacked = false khi case không có preventive action',
            'n-a', 'case có preventive action', true);
    } else {
        add('d7-honest-when-empty', 'D7 dataBacked = false khi case không có preventive action',
            d7 ? (d7.dataBacked === false ? 'pass' : 'fail') : 'fail',
            d7 ? `dataBacked=${d7.dataBacked}` : 'thiếu D7', true);
    }

    add('blind-no-leak', 'Bằng chứng mù không rò đáp án',
        input.blindLeaks.length === 0 ? 'pass' : 'fail',
        input.blindLeaks.join(' ') || '—', true);

    // ── Ràng buộc Q1-only ────────────────────────────────────────────────────
    add('customer-summary-matches-origin', 'customerSummary khớp origin',
        input.isCustomerFacing
            ? (result.customerSummary?.trim() ? 'pass' : 'fail')
            : (result.customerSummary === null ? 'pass' : 'fail'),
        input.isCustomerFacing ? 'Q1 — cần có' : 'Q3/Q2 — phải null');

    // ── Chất lượng lập luận độc lập ──────────────────────────────────────────
    add('derived-five-why', 'AI tự dựng chuỗi 5-Why ≥ 2 bước',
        input.derivedFiveWhyLength >= 2 ? 'pass' : 'fail',
        `${input.derivedFiveWhyLength} bước`);

    add('ruled-out', 'AI loại trừ ≥ 4 nhánh còn lại',
        input.ruledOutCount >= 4 ? 'pass' : 'fail', `${input.ruledOutCount} nhánh`);

    // ── Vi phạm ràng buộc do postProcess ghi lại ─────────────────────────────
    const { violationsByRule, violationCount, repairCount } = summariseValidation(input.validation);

    add('no-constraint-violations', 'Không vi phạm ràng buộc nào',
        violationCount === 0 ? 'pass' : 'fail',
        violationCount === 0 ? '—' : `${violationCount} vi phạm: ${topRules(violationsByRule)}`);

    const passed = checks.filter((c) => c.outcome === 'pass').length;
    const failed = checks.filter((c) => c.outcome === 'fail').length;

    return {
        checks,
        passed,
        failed,
        notApplicable: checks.filter((c) => c.outcome === 'n-a').length,
        antiFabricationFailures: checks.filter((c) => c.antiFabrication && c.outcome === 'fail').length,
        ratio: passed + failed > 0 ? Math.round((passed / (passed + failed)) * 100) / 100 : null,
        violationsByRule,
        violationCount,
        repairCount,
    };
}

/**
 * Gom `validationJson` của tám discipline thành phép đếm theo mã luật.
 *
 * Đếm theo MÃ LUẬT chứ không chỉ đếm tổng: "12 vi phạm" không nói được gì, còn
 * "11 trong 12 vi phạm đến từ `D1_GROUNDING`" thì trỏ thẳng vào chỗ phải sửa.
 * Đây cũng chính là đầu vào cho advisor ở bước sau.
 */
export function summariseValidation(
    validation: ComplianceInput['validation'],
): { violationsByRule: Record<string, number>; violationCount: number; repairCount: number } {
    const violationsByRule: Record<string, number> = {};
    let violationCount = 0;
    let repairCount = 0;

    for (const entry of Object.values(validation ?? {})) {
        if (!entry) continue;
        for (const v of entry.violations ?? []) {
            // Vi phạm có thể là object `{ruleId}` hoặc chuỗi thô, tuỳ bản đã ghi.
            // Không nhận ra mã thì gom vào `unknown` — bỏ đi sẽ làm tổng sai.
            const ruleId = typeof v === 'string' ? v : String(v?.ruleId ?? '').trim() || 'unknown';
            violationsByRule[ruleId] = (violationsByRule[ruleId] ?? 0) + 1;
            violationCount++;
        }
        repairCount += (entry.repairs ?? []).length;
    }

    return { violationsByRule, violationCount, repairCount };
}

/** Ba mã luật nổ nhiều nhất, dạng `D1_GROUNDING×7`. */
function topRules(byRule: Record<string, number>): string {
    return Object.entries(byRule)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([rule, n]) => `${rule}×${n}`)
        .join(', ');
}
