/**
 * Tầng 2 — judge chấm CHẤT LƯỢNG báo cáo, ba lượt gọi theo pha.
 *
 * ── Judge tồn tại để trả lời đúng MỘT câu ──
 * Đánh giá pipeline này thực ra là hai câu hỏi độc lập, và trộn chúng là cách
 * hỏng kinh điển:
 *
 *     ĐÚNG hay SAI   AI có kết luận đúng nguyên nhân không?   → có đáp án, CODE đo
 *     TỐT hay TỆ     Báo cáo có neo, có mạch, dùng được không? → không đáp án, JUDGE đo
 *
 * `aiAgreesWithRecord` đã trả lời câu đầu và KHÔNG cần judge. Nếu judge được cho
 * xem đáp án đã ghi trong lúc chấm chất lượng, nó lặng lẽ thoái hoá thành một máy
 * so đáp án — trả tiền để làm lại việc mà code đã làm miễn phí.
 *
 * ── Vì sao ba lượt theo pha, không tám lượt theo bước ──
 * Xem `rubrics.ts`. Điểm cốt lõi: `causal-coherence` chỉ quan sát được khi đọc
 * nhiều bước cùng lúc. Mỗi lượt NHÌN cả báo cáo nhưng chỉ CHẤM pha của nó.
 */

import cds from '@sap/cds';
import { complete } from '../../core/ai/llmClient';
import { callAndParse } from '../eightd/jsonExtract';
import {
    EVAL_PHASES,
    PHASE_STEPS,
    dimensionsFor,
    maxScoreFor,
    type EvalDimension,
    type EvalPhase,
    type EvalVerdict,
} from './rubrics';
import { rollUp, scorePhase, type DimensionVerdict, type ReportQuality } from './evalScoring';
import type { ComplianceReport } from './compliance';
import type { EightDResult } from '../eightd/types';

const LOG = cds.log('eval-judge');

/**
 * Activity riêng, KHÔNG dùng lại `reviewQuality`.
 *
 * `reviewQuality` đang gánh chẩn đoán mù và reranker. Thêm judge vào đó là ba
 * việc không liên quan chia nhau một tuyến model và một thinking budget — admin
 * không còn định tuyến riêng được cho việc nào.
 */
export const ACTIVITY_JUDGE = 'evaluateQuality';

/** Quá số này thì lượt gọi bị coi là treo. Chấm điểm không được phép chặn gì. */
const JUDGE_TIMEOUT_MS = Number(process.env.JUDGE_TIMEOUT_MS ?? 60_000);

/** Mỗi discipline đưa chừng này ký tự. Đủ để phán, không phình prompt. */
const STEP_CONTENT_CHARS = 1_200;

export interface JudgeInput {
    notificationId: string;
    result: EightDResult;
    /**
     * Kết quả tầng 1, đưa vào làm NGỮ CẢNH.
     *
     * Judge được đọc nó nhưng không chấm lại nó: điểm của judge chỉ phủ những gì
     * code không nhìn thấy được. Đưa vào để judge không phải đoán những điều đã
     * biết chắc — ví dụ D6 có `dataBacked=false` đúng luật hay không.
     */
    compliance?: Pick<ComplianceReport, 'failed' | 'antiFabricationFailures' | 'violationsByRule'>;
}

function buildSchema(phase: EvalPhase) {
    const dims = dimensionsFor(phase);
    return {
        type: 'object',
        properties: {
            phaseNotes: {
                type: 'string',
                maxLength: 500,
                description:
                    `FIRST: read the whole report, then say in one paragraph how the ${phase} phase `
                    + `(${PHASE_STEPS[phase].join(', ')}) holds up. No scores yet.`,
            },
            verdicts: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        dimensionId: { type: 'string', enum: dims.map((d) => d.id) },
                        // Lập luận đứng TRƯỚC phán quyết — cùng lý do như re-rank:
                        // model sinh theo thứ tự trường, nên phán quyết phải rơi
                        // xuống sau khi lý lẽ đã nằm trong ngữ cảnh.
                        reason: {
                            type: 'string',
                            maxLength: 300,
                            description: 'Reason BEFORE deciding. Then the verdict must follow it.',
                        },
                        evidence: {
                            type: 'string',
                            maxLength: 300,
                            description:
                                'A VERBATIM quote from the report, or a sources path. Mandatory. '
                                + 'If you cannot quote anything, use verdict "abstain".',
                        },
                        verdict: {
                            type: 'string',
                            enum: ['pass', 'partial', 'fail', 'n-a', 'abstain'],
                            description:
                                'pass = fully met · partial = partly · fail = not met · '
                                + 'n-a = does not apply to this phase · abstain = not enough in the report to judge.',
                        },
                    },
                    required: ['dimensionId', 'reason', 'evidence', 'verdict'],
                },
            },
        },
        required: ['phaseNotes', 'verdicts'],
    } as const;
}

const SYSTEM_PROMPT = `You are grading the WRITING QUALITY of an 8D quality-management report.

You are NOT checking whether the conclusion is factually right. You cannot know that, and something
else already measures it. You are judging whether the report is grounded, coherent, honest about
what it does not know, specific, methodologically disciplined and actionable.

Two rules decide whether your grade is worth anything:
1. Every verdict MUST carry evidence — a verbatim quote from the report, or a sources path. A
   verdict you cannot quote for is not a judgement, it is a guess. Use "abstain" instead.
2. Reason first, then decide. A verdict that does not follow from its own reason is the failure
   this whole stage exists to prevent.

Do not reward length. A short report that says "no measurement was recorded" is BETTER than a long
one that invents a plausible number. Grade only the phase you are asked about, using the rest of
the report as context.

Return ONLY JSON matching the schema. No prose, no code fences.`;

function clip(text: unknown, max: number): string {
    const t = String(text ?? '').replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Dựng prompt cho một pha.
 *
 * ── Ba thứ CỐ Ý không có trong prompt ──
 *   đáp án đã ghi (`rootCauseCategory`)  judge sẽ thoái hoá thành máy so đáp án
 *   `confidence` model tự khai            neo phán quyết vào lời tự đánh giá
 *   tên model đã sinh ra văn bản          neo phán quyết vào định kiến về model
 *
 * Cả ba đều bị kiểm bằng test trên chuỗi prompt đã dựng, cùng tinh thần với
 * `auditBlindEvidence`.
 */
export function buildPhasePrompt(
    phase: EvalPhase,
    input: JudgeInput,
): string {
    const inScope = new Set(PHASE_STEPS[phase]);

    const body = input.result.disciplines
        .map((d) => {
            const mark = inScope.has(d.code) ? '→ GRADE THIS' : '   context only';
            return `### ${d.code} ${d.title}   [${mark}]\n`
                + `dataBacked: ${d.dataBacked} · sources: ${d.sources.join(', ') || '(none)'}\n`
                + `${clip(d.content, STEP_CONTENT_CHARS)}`;
        })
        .join('\n\n');

    const dims = dimensionsFor(phase)
        .map((d) => `- ${d.id} (weight ${d.weight}): ${d.question}`)
        .join('\n');

    const layer1 = input.compliance
        ? `\n## DETERMINISTIC CHECKS ALREADY DONE (context — do not re-grade these)\n`
          + `${input.compliance.failed} check(s) failed, `
          + `${input.compliance.antiFabricationFailures} of them anti-fabrication. `
          + `Constraint violations: ${Object.entries(input.compliance.violationsByRule)
              .map(([r, n]) => `${r}×${n}`).join(', ') || 'none'}.\n`
        : '';

    return `## PHASE TO GRADE
${phase} — steps ${PHASE_STEPS[phase].join(', ')}

## DIMENSIONS
${dims}
${layer1}
## THE REPORT
${body}

## OVERALL SUMMARY THE REPORT GIVES OF ITSELF
${clip(input.result.internalSummary, 800)}`;
}

/**
 * Chuẩn hoá output judge → danh sách phán quyết. HÀM THUẦN.
 *
 * Luật phòng thủ, cùng tinh thần với `normalizeRerankOutput`:
 *   - chiều lạ bị BỎ — judge không được tự thêm chiều vào thang
 *   - phán quyết lạ ⇒ `abstain`, không phải `fail`: judge nói năng lộn xộn không
 *     phải là báo cáo tệ
 *   - trùng chiều: giữ lượt đầu
 *   - thiếu bằng chứng thì `scorePhase` hạ xuống `abstain`, không xử ở đây
 */
export function normalizeJudgeOutput(
    value: unknown,
    phase: EvalPhase,
): DimensionVerdict[] {
    const allowed = new Set<string>(dimensionsFor(phase).map((d) => d.id));
    const rows = (value as { verdicts?: unknown } | null)?.verdicts;
    if (!Array.isArray(rows)) return [];

    const seen = new Set<string>();
    const out: DimensionVerdict[] = [];

    for (const row of rows) {
        const id = String((row as any)?.dimensionId ?? '').trim();
        if (!allowed.has(id) || seen.has(id)) continue;
        seen.add(id);

        const raw = String((row as any)?.verdict ?? '').trim();
        const verdict = (['pass', 'partial', 'fail', 'n-a', 'abstain'] as const)
            .find((v) => v === raw) ?? 'abstain';

        out.push({
            dimensionId: id as EvalDimension,
            verdict: verdict as EvalVerdict,
            evidence: String((row as any)?.evidence ?? '').trim().slice(0, 300),
            reason: String((row as any)?.reason ?? '').trim().slice(0, 300),
        });
    }
    return out;
}

async function judgePhase(phase: EvalPhase, input: JudgeInput) {
    const timeout = new Promise<never>((_, reject) => {
        const t = setTimeout(
            () => reject(new Error(`Judge ${phase} quá ${JUDGE_TIMEOUT_MS / 1000}s`)),
            JUDGE_TIMEOUT_MS,
        );
        (t as unknown as { unref?: () => void }).unref?.();
    });

    const call = callAndParse<{ verdicts: unknown }>(`judge:${phase}`, async (repairHint) => {
        const user = buildPhasePrompt(phase, input);
        const res = await complete(
            [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: repairHint ? `${user}\n\n## CORRECTION\n${repairHint}` : user },
            ],
            {
                activity: ACTIVITY_JUDGE,
                // temp 0 vì cùng một báo cáo phải nhận cùng một điểm. Một thang
                // chấm nhảy giữa hai lượt chạy thì không so được hai lần chạy.
                temperature: 0,
                max_tokens: 3_000,
                responseMimeType: 'application/json',
                responseSchema: buildSchema(phase) as unknown as Record<string, unknown>,
            },
        );
        return { content: res.content, finishReason: res.finishReason };
    });

    const { value } = await Promise.race([call, timeout]);
    return scorePhase(phase, normalizeJudgeOutput(value, phase));
}

export interface JudgeResult extends ReportQuality {
    notificationId: string;
    /** Pha nào hỏng và vì sao. Rỗng là cả ba pha đều chấm được. */
    errors: Array<{ phase: EvalPhase; message: string }>;
}

/**
 * Chấm cả báo cáo — ba pha.
 *
 * Pha hỏng thì ghi vào `errors` và pha đó được chấm bằng toàn `abstain`, tức nó
 * rơi khỏi trần thay vì bị tính 0 điểm. Một sự cố của model không được phép biến
 * thành một báo cáo tệ.
 *
 * Tuần tự chứ không `Promise.all`: ba lượt gọi cùng một activity, chạy song song
 * chỉ làm chúng xếp hàng trong semaphore của CDK mà không nhanh hơn.
 */
export async function judgeReport(input: JudgeInput): Promise<JudgeResult> {
    const phases = [];
    const errors: JudgeResult['errors'] = [];

    for (const phase of EVAL_PHASES) {
        try {
            phases.push(await judgePhase(phase, input));
        } catch (e: any) {
            errors.push({ phase, message: e.message });
            LOG.warn(`Judge ${phase} hỏng (${e.message}) — pha này rơi khỏi trần.`);
            phases.push(scorePhase(phase, []));
        }
    }

    const rolled = rollUp(phases);
    LOG.info(
        `Judge ${input.notificationId}: ${rolled.score}/${rolled.maxScore}`
        + ` (${rolled.ratio === null ? 'không chấm được' : `${Math.round(rolled.ratio * 100)}%`})`
        + ` · ${rolled.abstainCount} abstain`
        + (errors.length ? ` · ${errors.length} pha hỏng` : ''),
    );

    return { ...rolled, notificationId: input.notificationId, errors };
}

/** Trần điểm của cả báo cáo — tổng ba pha. Hằng số, dùng để hiển thị. */
export const REPORT_MAX_SCORE = EVAL_PHASES.reduce((sum, p) => sum + maxScoreFor(p), 0);
