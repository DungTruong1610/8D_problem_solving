/**
 * Chẩn đoán độc lập — bước khiến pipeline này khác một parser.
 *
 * Model chỉ nhận bằng chứng thô (xem `blindEvidence.ts`) và phải TỰ dựng chuỗi
 * 5-Why, TỰ chọn nhánh Ishikawa là nguyên nhân gốc, TỰ giải thích vì sao loại
 * năm nhánh còn lại. Chuỗi 5-Why và đáp án của kỹ sư đã bị cắt khỏi input, nên
 * không có gì để chép.
 *
 * Sau đó code đối chiếu kết luận của model với đáp án ghi trong dataset. Kết quả
 * đối chiếu là thứ chứng minh được: trùng nhau nghĩa là model suy luận đúng chứ
 * không phải đọc đáp án; lệch nhau lại càng đáng xem, vì khi đó nó phải nêu được
 * lý do và đôi khi lý do đó có giá trị.
 */

import { ISHIKAWA_CATEGORIES, type CaseContext } from './types';
import type { BlindEvidence } from './blindEvidence';

// ─────────────────────────────────────────────────────────────────────────────

export interface DerivedWhyStep {
    stepNo: number;
    question: string;
    answer: string;
    /** Bằng chứng cụ thể trong input chống lưng cho bước này. */
    evidence: string;
}

export interface RuledOut {
    category: string;
    reason: string;
}

/** Kết luận model tự rút ra, TRƯỚC khi biết đáp án. */
export interface IndependentFinding {
    rootCauseCategory: string;
    rootCauseStatement: string;
    derivedFiveWhy: DerivedWhyStep[];
    ruledOut: RuledOut[];
    /** Nhánh khả dĩ thứ hai — buộc model cân nhắc thay vì chốt vội. */
    runnerUpCategory: string | null;
    runnerUpReason: string | null;
    confidence: number;
    /** Dữ liệu model muốn có thêm để chắc chắn hơn. */
    evidenceGaps: string[];
}

/** Kết quả đối chiếu với đáp án của kỹ sư — do CODE tính, không hỏi model. */
export interface AgreementVerdict {
    recordedCategory: string | null;
    aiCategory: string;
    agrees: boolean | null;
    /** Số bước trong chuỗi 5-Why model tự dựng, so với chuỗi đã ghi. */
    aiStepCount: number;
    recordedStepCount: number;
}

export interface IndependentAnalysis {
    finding: IndependentFinding;
    verdict: AgreementVerdict;
    /** Chỗ rò đáp án phát hiện lúc kiểm tra bằng chứng mù. Rỗng là sạch. */
    leaks: string[];
}

// ─────────────────────────────────────────────────────────────────────────────

export const INDEPENDENT_SCHEMA = {
    type: 'object',
    properties: {
        rootCauseCategory: { type: 'string', enum: [...ISHIKAWA_CATEGORIES] },
        rootCauseStatement: {
            type: 'string',
            description: 'Ultra-concise one-sentence root cause statement naming the specific cause and category directly (e.g. "Undefined or missing milling process specification (Method)"). Max 150 characters.',
        },
        derivedFiveWhy: {
            type: 'array',
            minItems: 2,
            maxItems: 5,
            items: {
                type: 'object',
                properties: {
                    stepNo: { type: 'integer' },
                    question: { type: 'string' },
                    answer: { type: 'string' },
                    evidence: { type: 'string' },
                },
                required: ['stepNo', 'question', 'answer', 'evidence'],
            },
        },
        ruledOut: {
            type: 'array',
            minItems: 5,
            maxItems: 5,
            items: {
                type: 'object',
                properties: {
                    category: { type: 'string', enum: [...ISHIKAWA_CATEGORIES] },
                    reason: { type: 'string' },
                },
                required: ['category', 'reason'],
            },
        },
        runnerUpCategory: { type: 'string', nullable: true, enum: [...ISHIKAWA_CATEGORIES] },
        runnerUpReason: { type: 'string', nullable: true },
        confidence: { type: 'number' },
        evidenceGaps: { type: 'array', items: { type: 'string' } },
    },
    required: [
        'rootCauseCategory', 'rootCauseStatement', 'derivedFiveWhy',
        'ruledOut', 'confidence', 'evidenceGaps',
    ],
} as const;

// ─────────────────────────────────────────────────────────────────────────────

export const INDEPENDENT_SYSTEM_PROMPT = `
You are a senior quality engineer performing root cause analysis on a
manufacturing defect. You are seeing this case for the first time.

You receive the raw investigation evidence: the measurements taken, findings for
each of the six Ishikawa branches, an Is / Is-Not comparison, and the containment
actions already in place.

You do NOT receive anyone else's conclusion. There is no answer to copy. Work it
out from the evidence.

## YOUR TASK

1. Build a 5-Why chain, 2 to 5 steps. Keep questions short & crisp, and answers
   direct & punchy (max 1 concise sentence per step, stating the direct cause).
   Start from the observed defect and drive down until you reach a cause that,
   if fixed, prevents recurrence. Each step must cite the specific evidence that
   supports it.

2. Name the root cause branch: exactly one of Man, Machine, Method, Material,
   Measurement, Environment.

3. Write an ultra-concise rootCauseStatement: exactly 1 brief sentence stating
   the root cause directly (e.g. "Undefined or missing milling process specification (Method).").
   Do not write disclaimers or audit plans here.

4. Rule out the other five. Give a concrete 1-sentence reason for each, drawn from
   its finding (e.g. "Spindle runout measured 4um against 10um limit; within tolerance").
   "Not relevant" is not a reason.

5. Name the runner-up branch — the one you would investigate next if you turned
   out to be wrong — and say what would make you switch to it. If the evidence
   is genuinely unambiguous, set both runner-up fields to null.

6. Report your confidence honestly, and list what further evidence you would ask
   for.

## HOW TO WEIGH THE EVIDENCE

- A measured value outside its specification is the strongest signal available.
  Prefer branches whose finding carries a number that breaches a limit.
- A finding stating something was within limits, unchanged, certified or current
  is evidence AGAINST that branch.
- The Is / Is-Not comparison is decisive for scoping: whatever differs between
  the "is" side and the "is not" side is where the cause lives. If the defect
  follows a particular gauge, tool or lot rather than a line or a shift, the
  cause travels with that thing.
- Dates matter. A defect starting exactly when something changed points at that
  change.
- Distinguish the technical cause (the thing that physically went wrong) from
  the systemic cause (the reason the system allowed it). Drive the chain far
  enough to reach the systemic one where the evidence supports it.

## RULES

- Never invent a measurement, date, ID or name that is not in the evidence.
- Do not hedge across several branches. Choose one and defend it.
- Output valid JSON matching the schema. No prose outside the JSON.
`.trim();

export function buildIndependentPrompt(evidence: BlindEvidence): string {
    return [
        '## DEFECT EVIDENCE',
        '```json',
        JSON.stringify(evidence, null, 1),
        '```',
        '',
        'Diagnose the root cause from this evidence alone.',
    ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Đối chiếu kết luận của model với đáp án ghi trong dataset.
 *
 * Do CODE tính, KHÔNG hỏi model — bảo chính model tự chấm xem nó có đúng không
 * là mời nó nói dối, và tệ hơn, là mời nó nhìn thấy đáp án.
 */
export function compareWithRecorded(
    finding: IndependentFinding,
    context: CaseContext,
): AgreementVerdict {
    const recorded = context?.rootCause?.category ?? null;
    const aiCategory = finding?.rootCauseCategory || null;
    return {
        recordedCategory: recorded,
        aiCategory: aiCategory as any,
        agrees: (recorded !== null && aiCategory !== null)
            ? (recorded.toLowerCase() === aiCategory.toLowerCase())
            : null,
        aiStepCount: finding?.derivedFiveWhy?.length ?? 0,
        recordedStepCount: context?.fiveWhy?.length ?? 0,
    };
}

/**
 * Chuẩn hoá kết quả model trả về.
 *
 * Đặc biệt: model hay quên loại trừ chính nhánh nó đã chọn, hoặc liệt kê thừa.
 * Sửa im lặng ở đây thì UI hiện ra một danh sách vô lý, nên ta cắt gọn và để
 * `postProcess` của tầng trên lo phần ghi nhận.
 */
export function normalizeFinding(raw: any): IndependentFinding {
    if (!raw || typeof raw !== 'object') {
        return {
            rootCauseCategory: 'Unknown',
            rootCauseStatement: '',
            derivedFiveWhy: [],
            ruledOut: [],
            runnerUpCategory: null,
            runnerUpReason: null,
            confidence: 0,
            evidenceGaps: [],
        };
    }

    // Model có thể trả về rootCauseCategory, rootCauseBranch, hoặc category
    const chosen = raw.rootCauseCategory || raw.rootCauseBranch || raw.category || 'Unknown';

    // Model có thể trả về ruledOut dạng array hoặc rulingOut dạng object { Man: "...", Machine: "..." }
    let ruledOutRaw = raw.ruledOut;
    if (!Array.isArray(ruledOutRaw) && raw.rulingOut && typeof raw.rulingOut === 'object') {
        ruledOutRaw = Object.entries(raw.rulingOut).map(([k, v]) => ({
            category: k,
            reason: typeof v === 'string' ? v : JSON.stringify(v),
        }));
    }

    const ruledOut = (Array.isArray(ruledOutRaw) ? ruledOutRaw : [])
        .filter((r: any) => r && (r.category || r.branch) !== chosen)
        .map((r: any) => ({
            category: r.category || r.branch || 'Unknown',
            reason: r.reason || '',
        }))
        .filter((r, i, arr) => arr.findIndex((x) => x.category === r.category) === i);

    // Model có thể trả về derivedFiveWhy, chain, hoặc fiveWhy
    let fiveWhyRaw = raw.derivedFiveWhy || raw.chain || raw.fiveWhy;
    if (!Array.isArray(fiveWhyRaw)) fiveWhyRaw = [];

    const fiveWhy = fiveWhyRaw
        .slice(0, 5)
        .map((s: any, i: number) => ({
            stepNo: s.stepNo ?? i + 1,
            question: s.question ?? s.why ?? `Why step ${i + 1}?`,
            answer: s.answer ?? s.why ?? '',
            evidence: s.evidence ?? '',
        }));

    let confidence = Number(raw.confidence);
    if (!Number.isFinite(confidence)) confidence = 0;
    confidence = Math.min(1, Math.max(0, confidence));

    const runnerUpCat = raw.runnerUpCategory || raw.runnerUpBranch || null;
    const runnerUpCategory = runnerUpCat === chosen ? null : runnerUpCat;
    const runnerUpReason = runnerUpCategory
        ? (raw.runnerUpReason || raw.runnerUpSwitchCondition || null)
        : null;

    const evidenceGaps = Array.isArray(raw.evidenceGaps)
        ? raw.evidenceGaps
        : Array.isArray(raw.furtherEvidence)
            ? raw.furtherEvidence
            : [];

    return {
        ...raw,
        rootCauseCategory: chosen,
        rootCauseStatement: raw.rootCauseStatement || '',
        derivedFiveWhy: fiveWhy,
        ruledOut,
        runnerUpCategory,
        runnerUpReason,
        confidence,
        evidenceGaps,
    };
}
