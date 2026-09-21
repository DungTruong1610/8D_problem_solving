/**
 * Advisor tầng 1 — triệu chứng đánh giá → cần chỉnh chỗ nào. HÀM THUẦN, không AI.
 *
 * ── Vì sao tầng này chạy trước và có thể là tầng DUY NHẤT ──
 * Phần lớn triệu chứng ánh xạ tới một chỗ chỉnh một cách máy móc, và phép ánh xạ
 * đó không được phép để model đoán. "11 trong 12 vi phạm đến từ `D1_GROUNDING`"
 * là một kết luận đầy đủ — nó trỏ thẳng vào một mã luật, kèm bằng chứng, không
 * cần lượt gọi model nào.
 *
 * Tầng 2 (model đề xuất diff cụ thể cho prompt) CHƯA làm, và có lý do: judge hiện
 * dao động tới 4 điểm trên cùng một input. Một advisor đề xuất sửa cấu hình dựa
 * trên nhiễu sẽ đề xuất tự tin và sai, rồi thay đổi đó làm pipeline xấu đi vĩnh
 * viễn thay vì chỉ báo cáo sai một lần. Bật tầng 2 sau khi sàn nhiễu đủ hẹp.
 *
 * ── Một luật của tầng này ──
 * Nó KHÔNG BAO GIỜ đề xuất nới `EIGHT_D_RULES`. Một ràng buộc nổ nhiều thường là
 * bằng chứng model đang sai, KHÔNG phải bằng chứng luật quá chặt — và chỗ đó là
 * lõi chống bịa, cố ý không cho cấu hình.
 */

import type { ComplianceReport } from './compliance';
import type { EvalDimension } from './rubrics';
import type { NoiseFloor } from './metrics';

/** Bề mặt chỉnh được. Không có `hardRule` — lõi chống bịa không nằm trong danh sách. */
export type LeverType =
    | 'stepPrompt'
    | 'constraint'
    | 'profileCriterion'
    | 'retrievalSetting'
    | 'graphStepParam'
    | 'modelRouting'
    /** Không phải chỗ chỉnh — vấn đề nằm ở thượng nguồn hoặc ở chính harness. */
    | 'notAConfigProblem';

export interface CandidateLever {
    type: LeverType;
    /** Khoá cụ thể: `"D5"` · `"D1_GROUNDING"` · `"activity:analyzeDefect"`. */
    targetKey: string;
    /** Chiều đánh giá đã dẫn tới đây. Null khi triệu chứng thuần deterministic. */
    fromDimension: EvalDimension | null;
    /** Bằng chứng đã có trong tay, không phải suy đoán. */
    evidence: string;
    /** Xếp hạng — cao hơn thì đáng xem trước. */
    rank: number;
}

export interface LeverInput {
    /** Tầng 1 gộp trên cả lượt chạy. */
    compliance: Pick<ComplianceReport, 'violationsByRule' | 'repairCount' | 'antiFabricationFailures'>;
    /** Chiều nào yếu, tính trên cả lượt chạy: `points / maxPoints`. */
    dimensionRatios: Partial<Record<EvalDimension, number | null>>;
    /** Số case mà tìm tiền lệ trả về rỗng, kèm lý do đã ghi. */
    emptyPrecedentCount: number;
    caseCount: number;
    /** Tổng số chiều bị abstain trên cả lượt chạy. */
    abstainCount: number;
    /** Sàn nhiễu đã đo. Null = chưa đo. */
    noise: NoiseFloor | null;
}

/** Dưới ngưỡng này thì một chiều bị coi là yếu. */
const WEAK_RATIO = 0.6;

/**
 * Xếp hạng các chỗ đáng chỉnh, kèm bằng chứng.
 *
 * Thứ tự trong hàm là thứ tự ưu tiên, và nó có chủ ý: những thứ làm CẢ PHÉP ĐO
 * mất giá trị phải đứng trước những thứ chỉ làm điểm thấp. Đề xuất sửa prompt
 * trong khi sàn nhiễu chưa đo là đề xuất dựa trên một con số chưa ai kiểm.
 */
export function rankLevers(input: LeverInput): CandidateLever[] {
    const out: CandidateLever[] = [];

    // ── Ưu tiên 0: những thứ làm phép đo mất giá trị ─────────────────────────

    if (!input.noise) {
        out.push({
            type: 'notAConfigProblem',
            targetKey: 'noiseFloor',
            fromDimension: null,
            evidence:
                'Sàn nhiễu của judge CHƯA được đo. Mọi chênh lệch điểm dưới đây chưa phân biệt '
                + 'được với dao động của chính judge. Chạy `--repeat` trước khi chỉnh bất cứ thứ gì.',
            rank: 100,
        });
    } else if (input.noise.spread >= 0.1) {
        out.push({
            type: 'notAConfigProblem',
            targetKey: 'rubric-ambiguity',
            fromDimension: null,
            evidence:
                `Judge dao động ${Math.round(input.noise.spread * 100)}% trên cùng một báo cáo`
                + (input.noise.unstableDimensions.length
                    ? ` (bất định ở: ${input.noise.unstableDimensions.join(', ')})`
                    : '')
                + '. Đây là chỗ sửa ĐỊNH NGHĨA của thang chấm, không phải chỗ sửa cấu hình pipeline.',
            rank: 95,
        });
    }

    // Abstain nhiều nghĩa là báo cáo quá mỏng để chấm — vấn đề thượng nguồn.
    // Advisor phải nói thẳng điều đó thay vì bịa ra một chỗ chỉnh.
    const abstainPerCase = input.caseCount > 0 ? input.abstainCount / input.caseCount : 0;
    if (abstainPerCase >= 6) {
        out.push({
            type: 'notAConfigProblem',
            targetKey: 'thin-reports',
            fromDimension: null,
            evidence:
                `Trung bình ${abstainPerCase.toFixed(1)} chiều bị abstain mỗi case. Báo cáo quá mỏng `
                + 'để chấm — vấn đề nằm ở lượt sinh báo cáo, không ở thang chấm hay cấu hình truy hồi.',
            rank: 90,
        });
    }

    // ── Ưu tiên 1: vi phạm ràng buộc, theo mã luật ───────────────────────────
    //
    // Đây là tín hiệu deterministic mạnh nhất: mã luật đã nằm trong
    // `validationJson`, không cần suy đoán gì.
    const rules = Object.entries(input.compliance.violationsByRule)
        .sort((a, b) => b[1] - a[1]);
    const totalViolations = rules.reduce((n, [, c]) => n + c, 0);

    for (const [ruleId, count] of rules.slice(0, 3)) {
        const share = totalViolations ? count / totalViolations : 0;
        out.push({
            type: 'constraint',
            targetKey: ruleId,
            fromDimension: null,
            evidence:
                `${count}/${totalViolations} vi phạm (${Math.round(share * 100)}%) đến từ ${ruleId}. `
                + 'Một ràng buộc nổ nhiều thường là bằng chứng MODEL đang sai, không phải bằng chứng '
                + 'luật quá chặt — nên hướng mặc định là siết prompt của bước đó, không phải nới luật.',
            rank: 80 + Math.round(share * 10),
        });
    }

    // ── Ưu tiên 2: grounding yếu — phân biệt hai nguyên nhân khác hẳn nhau ───
    const grounding = input.dimensionRatios.grounding;
    if (grounding !== null && grounding !== undefined && grounding < WEAK_RATIO) {
        const emptyShare = input.caseCount ? input.emptyPrecedentCount / input.caseCount : 0;
        if (emptyShare >= 0.3) {
            // Không neo được vì KHÔNG CÓ GÌ để neo vào — đây là chuyện của truy
            // hồi, không phải chuyện của prompt. Siết prompt ở đây làm mọi thứ tệ
            // hơn: model sẽ nói "không có dữ liệu" nhiều hơn, đúng nhưng vô dụng.
            out.push({
                type: 'retrievalSetting',
                targetKey: 'minScore / topN',
                fromDimension: 'grounding',
                evidence:
                    `grounding ở ${Math.round(grounding * 100)}% VÀ ${input.emptyPrecedentCount}/`
                    + `${input.caseCount} case không có tiền lệ nào vượt ngưỡng. Model không neo được vì `
                    + 'không có gì để neo — hạ ngưỡng hoặc nới topN, đừng siết prompt.',
                rank: 75,
            });
        } else {
            out.push({
                type: 'stepPrompt',
                targetKey: 'combinedPrompt',
                fromDimension: 'grounding',
                evidence:
                    `grounding ở ${Math.round(grounding * 100)}% nhưng tiền lệ VẪN tìm được `
                    + `(chỉ ${input.emptyPrecedentCount}/${input.caseCount} case rỗng). Có dữ liệu để neo `
                    + 'mà model không neo — đây là chuyện của prompt.',
                rank: 70,
            });
        }
    }

    // ── Ưu tiên 3: các chiều yếu còn lại → đúng bề mặt của chúng ─────────────
    const byDimension: Partial<Record<EvalDimension, { type: LeverType; key: string; note: string }>> = {
        specificity: {
            type: 'constraint',
            key: 'formSchemaJson (minLength / enum)',
            note: 'Output mỏng về cấu trúc thường siết được bằng hợp đồng field, rẻ hơn sửa prompt.',
        },
        'gap-honesty': {
            type: 'stepPrompt',
            key: 'combinedPrompt',
            note: 'Bịa một giá trị nghe hợp lý thay vì nói "không có dữ liệu" là chuyện của hướng dẫn bước.',
        },
        'method-discipline': {
            type: 'stepPrompt',
            key: 'combinedPrompt',
            note: 'Ranh giới containment / corrective / preventive nằm trong guide của ba bước đó.',
        },
        'causal-coherence': {
            type: 'modelRouting',
            key: 'activity:analyzeDefect',
            note: 'Mạch nhân quả đứt giữa các bước thường là năng lực suy luận, không phải câu chữ.',
        },
        actionability: {
            type: 'stepPrompt',
            key: 'combinedPrompt',
            note: 'Ngưỡng nghiệm thu đo được là yêu cầu tường minh trong guide D6.',
        },
    };

    for (const [dim, lever] of Object.entries(byDimension) as Array<[EvalDimension, typeof byDimension[EvalDimension]]>) {
        const ratio = input.dimensionRatios[dim];
        if (ratio === null || ratio === undefined || ratio >= WEAK_RATIO) continue;
        out.push({
            type: lever!.type,
            targetKey: lever!.key,
            fromDimension: dim,
            evidence: `${dim} ở ${Math.round(ratio * 100)}%. ${lever!.note}`,
            rank: 60 - Math.round(ratio * 10),
        });
    }

    // ── Ưu tiên 4: postProcess phải dựng lại nhiều ──────────────────────────
    if (input.compliance.repairCount >= input.caseCount) {
        out.push({
            type: 'modelRouting',
            targetKey: 'activity:analyzeDefect',
            fromDimension: null,
            evidence:
                `${input.compliance.repairCount} lần postProcess phải dựng lại output trên `
                + `${input.caseCount} case. Output sai hình dạng ở mức đó thường là model hoặc thinking `
                + 'budget, không phải câu chữ của prompt.',
            rank: 55,
        });
    }

    return out.sort((a, b) => b.rank - a.rank || a.targetKey.localeCompare(b.targetKey));
}
