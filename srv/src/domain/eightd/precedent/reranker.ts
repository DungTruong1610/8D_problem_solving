/**
 * Tầng 2 của tìm tiền lệ: re-rank bằng model đọc CẢ HAI văn bản.
 *
 * ── Vì sao cần tầng này ──
 * Tầng 1 so query và ứng viên TÁCH RỜI: cosine giữa hai vector nhúng sẵn, khớp
 * mã exact/keyword. Câu hỏi của D4 — "cùng cơ chế hỏng vật lý?" — cần model đọc
 * đồng thời hai đoạn mô tả và phán, điều mà không phép so tách rời nào làm được.
 * D5 tương tự: "action của case kia có gỡ được nguyên nhân của case này không".
 *
 * ── Vì sao listwise, một lượt gọi ──
 * K ứng viên (≤20) đi chung MỘT prompt, model trả điểm cho từng cái. Một lượt
 * gọi mỗi profile mỗi lần chạy — rẻ hơn K lượt pairwise và đủ tốt: model nhìn
 * được cả danh sách nên tự hiệu chỉnh thang điểm giữa các ứng viên.
 *
 * ── Khế ước với phần còn lại của hệ thống ──
 * Kết quả re-rank là MỘT dòng breakdown như mọi tiêu chí khác: điểm = trọng số
 * × (score/100), có sàn, kèm lý do model đưa ra trong `matchedOn` — đọc được
 * trên UI, không hộp đen. Re-rank hỏng ⇒ giữ nguyên xếp hạng tầng 1, không bao
 * giờ làm hỏng lượt tìm (cùng triết lý với embedding hỏng ở `embedQuery`).
 *
 * Instruction lấy từ `description` của tiêu chí `rerank` trong profile — mỗi
 * bước D hỏi một câu khác nhau, và câu hỏi đó là cấu hình, không phải hằng số.
 */

import cds from '@sap/cds';
import { complete } from '../../../core/ai/llmClient';
import { callAndParse } from '../jsonExtract';
import { BUDGET } from '../schemas';
import { round1, type Criterion, type CriterionHit, type ScoreResult } from './scoring';

const LOG = cds.log('precedent-rerank');

/** Activity dùng chung với chẩn đoán mù: chấm theo tiêu chí cố định, temp 0. */
const ACTIVITY_RERANK = 'reviewQuality';

/**
 * Quá số này thì lượt gọi bị coi là treo — giữ xếp hạng tầng 1 thay vì chờ.
 *
 * ── Vì sao 45s chứ không phải 20s như bản đầu ──
 * 20s được chọn cho prompt CHƯA có chain-of-thought. Sau khi thêm `queryAnalysis`
 * và `analysis` cho từng ứng viên, model phải sinh thêm vài trăm token trước khi
 * tới con số đầu tiên. Đo trên chính bộ dữ liệu này: 10 ứng viên mất **23.9s** —
 * tức bản 20s KHÔNG BAO GIỜ về kịp, và nó thất bại theo cách dễ bỏ qua nhất:
 * xếp hạng tầng 1 vẫn đứng, kết quả vẫn hợp lý, chỉ là tầng 2 chưa từng chạy.
 *
 * 45s cho pool đầy (20 ứng viên) một khoảng dự phòng gần gấp đôi mức đã đo. Đây
 * là một tầng TUỲ CHỌN chạy song song với các pha khác của lượt phân tích, nên
 * chờ thêm 25s không kéo dài tổng thời gian theo tỉ lệ đó.
 *
 * `RERANK_TIMEOUT_MS` ghi đè được để đo lại khi đổi model hoặc đổi prompt — và
 * PHẢI đo lại khi làm hai việc đó.
 */
const RERANK_TIMEOUT_MS = Number(process.env.RERANK_TIMEOUT_MS ?? 45_000);

/** Mỗi ứng viên chỉ đưa chừng này ký tự văn bản — đủ để phán, không phình prompt. */
const CANDIDATE_TEXT_CHARS = 700;
const QUERY_TEXT_CHARS = 1_400;

export interface RerankCandidate {
    notificationId: string;
    symptomShortText: string | null;
    searchText: string | null;
}

export interface RerankVerdict {
    /** 0-100, đã clamp. */
    score: number;
    /** Lý do một dòng của model — đi thẳng vào `breakdown.matchedOn`. */
    reason: string;
    /**
     * Lập luận của model TRƯỚC khi nó chấm điểm — phần chain-of-thought.
     *
     * Không đi vào `matchedOn` (dòng đó phải ngắn để đọc được trên UI) nhưng có
     * mặt ở đây để log và để soi khi một thứ hạng trông vô lý. Rỗng khi model bỏ
     * trường này, hoặc khi output đến từ một bản prompt cũ.
     */
    analysis: string;
}

/**
 * Khung nội dung mà MỘT bước D đặt ra cho tầng 2.
 *
 * ── Vì sao ba mảnh, không phải một câu instruction ──
 * Bản đầu chỉ có một chuỗi instruction, còn phần lập luận thì ghi cứng trong
 * schema: "state what failure mechanism the OPEN CASE shows". Đó là câu hỏi của
 * D4 nằm nhầm chỗ. Bật re-rank cho D1 thì model được bảo suy nghĩ về cơ chế hỏng
 * trong khi D1 hỏi về NGƯỜI — và nó sẽ trả lời trôi chảy, chỉ là trả lời sai câu.
 *
 * Sai kiểu đó không lộ ra ở output: vẫn đúng schema, vẫn có điểm, vẫn có lý do
 * nghe hợp lý. Nên khung phải là dữ liệu của bước, không phải hằng số của module.
 *
 * Thủ tục thì ngược lại — lập luận trước, chấm sau, không bịa id — giống nhau ở
 * mọi bước, nên nó ở lại `SYSTEM_PROMPT`.
 */
export interface RerankFrame {
    /** Model phải xác lập GÌ về case đang mở, trước khi nhìn bất kỳ ứng viên nào. */
    queryFrame: string;
    /** So chiều nào giữa ứng viên và mốc vừa xác lập. */
    candidateFrame: string;
    /** 0 và 100 nghĩa là gì Ở BƯỚC NÀY. Thiếu thì model tự bịa thang, và thang đó đổi giữa các lượt. */
    rubric: string;
}

/**
 * Một câu instruction đơn → khung đầy đủ.
 *
 * Engine chấm điểm lấy instruction từ `ProfileCriteria.description`, tức đúng một
 * chuỗi. Hàm này bọc nó lại để cả hai engine đi qua CÙNG một đường, thay vì
 * `rerankCandidates` phải nhận hai kiểu tham số khác nhau.
 */
export function frameFromInstruction(instruction: string): RerankFrame {
    const text = instruction.trim() || 'Rank candidates by overall relevance to the open case.';
    return {
        queryFrame:
            'State what the open case is about, in the terms this instruction cares about, '
            + 'from its evidence alone. Mention no candidate.',
        candidateFrame:
            'Say where this candidate agrees or differs from that, in those same terms. Name the evidence.',
        rubric: text,
    };
}

/**
 * ── Vì sao thứ tự trường trong schema này quan trọng ──
 * Model sinh JSON theo thứ tự trường. `queryAnalysis` đứng trước `rankings`, và
 * trong mỗi mục `analysis` đứng trước `score`, nên con số được sinh RA SAU khi
 * lập luận đã nằm trong ngữ cảnh — đó chính là chain-of-thought. Đảo lại thì
 * `analysis` chỉ còn là lời biện minh viết sau cho một con số đã trót chọn, và
 * nhìn output thì hai đằng giống hệt nhau.
 *
 * ── Vì sao CoT bằng trường output chứ không bằng extended thinking ──
 * `thinkingBudget` hợp lệ (≥1024) sẽ làm CDK xoá `temperature` — Anthropic cấm
 * temperature đi kèm extended thinking (xem `effectiveThinkingBudget`). Mất
 * temperature 0 là mất tính tất định, đúng thứ tầng này cần nhất. Lập luận bằng
 * trường output giữ được cả hai: model vẫn suy nghĩ ra chữ, mà vẫn temp 0.
 */
function buildRerankSchema(frame: RerankFrame) {
    return {
    type: 'object',
    properties: {
        queryAnalysis: {
            type: 'string',
            maxLength: 600,
            description:
                `FIRST: ${frame.queryFrame} `
                + 'Do not mention any candidate here. This is the reference every score is measured against.',
        },
        rankings: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    notificationId: { type: 'string' },
                    analysis: {
                        type: 'string',
                        maxLength: 400,
                        description:
                            `Reason BEFORE scoring: ${frame.candidateFrame} `
                            + 'Measure it against queryAnalysis. Then the score must follow what you just wrote.',
                    },
                    score: {
                        type: 'number',
                        description: `Relevance 0-100. ${frame.rubric}`,
                    },
                    reason: {
                        type: 'string',
                        maxLength: 200,
                        description: 'One short sentence summarising the analysis, for the audit trail.',
                    },
                },
                required: ['notificationId', 'analysis', 'score', 'reason'],
            },
        },
    },
    required: ['queryAnalysis', 'rankings'],
    } as const;
}

/**
 * THỦ TỤC — giống nhau ở mọi bước D.
 *
 * Cố ý không nói gì về cơ chế hỏng, về người, hay về hành động khắc phục: đó là
 * NỘI DUNG, và nội dung đến từ `RerankFrame` của từng bước. Nhét một ví dụ cụ
 * thể vào đây là ghi cứng câu hỏi của một bước lên cả bảy bước còn lại.
 */
const SYSTEM_PROMPT = `You are re-ranking historical quality-management (8D) cases against one open case.

Score each candidate 0-100 for how relevant it is UNDER THE GIVEN INSTRUCTION - not for generic
similarity. Two cases can look alike on paper and be irrelevant to the question asked, and two
that share nothing on paper can be exactly what the question is after.

Work in this order, and do not shortcut it:
1. queryAnalysis - read the OPEN CASE alone and establish what the instruction asks you to
   establish. Mention no candidate. This is the reference everything else is measured against.
2. For each candidate, write analysis FIRST, then let the score follow from what you just wrote.

A score that does not follow from its own analysis is the failure this stage exists to prevent.

Rules:
- Score every candidate exactly once, using its notificationId verbatim.
- reason is a one-line summary of analysis, not a separate judgement.
- Return ONLY JSON matching the schema. No prose, no code fences.`;

function clip(text: string | null | undefined, max: number): string {
    const t = String(text ?? '').replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function buildUserPrompt(
    frame: RerankFrame,
    queryText: string,
    candidates: readonly RerankCandidate[],
): string {
    const list = candidates
        .map((c, i) =>
            `${i + 1}. [${c.notificationId}] ${clip(c.symptomShortText, 160)}\n`
            + `   ${clip(c.searchText, CANDIDATE_TEXT_CHARS)}`)
        .join('\n');

    return `## INSTRUCTION
${frame.rubric.trim()}

## WHAT TO ESTABLISH FIRST, ABOUT THE OPEN CASE
${frame.queryFrame.trim()}

## WHAT TO COMPARE, FOR EACH CANDIDATE
${frame.candidateFrame.trim()}

## OPEN CASE (the query)
${clip(queryText, QUERY_TEXT_CHARS)}

## CANDIDATES (${candidates.length})
${list}`;
}

/**
 * Chuẩn hoá output model thành map id → verdict — HÀM THUẦN, test không cần AI.
 *
 * Luật phòng thủ:
 *   - id lạ (không nằm trong danh sách gửi đi) bị BỎ — model không được thêm case
 *   - id thiếu thì vắng mặt trong map — dòng của nó ở lại mức 'none'
 *   - score ngoài [0,100] bị clamp; không phải số ⇒ bỏ dòng đó
 *   - trùng id: giữ lượt xuất hiện đầu tiên
 */
export function normalizeRerankOutput(
    value: unknown,
    sentIds: readonly string[],
): Map<string, RerankVerdict> {
    const allowed = new Set(sentIds);
    const out = new Map<string, RerankVerdict>();

    const rows = (value as { rankings?: unknown } | null)?.rankings;
    if (!Array.isArray(rows)) return out;

    for (const row of rows) {
        const id = String((row as any)?.notificationId ?? '').trim();
        if (!id || !allowed.has(id) || out.has(id)) continue;

        const rawScore = Number((row as any)?.score);
        if (!Number.isFinite(rawScore)) continue;
        const score = Math.min(100, Math.max(0, rawScore));

        const reason = String((row as any)?.reason ?? '').trim().slice(0, 200);
        // Bản prompt cũ không có trường này — thiếu thì để rỗng, không loại dòng.
        const analysis = String((row as any)?.analysis ?? '').trim().slice(0, 400);
        out.set(id, { score, reason, analysis });
    }
    return out;
}

/**
 * Gọi model xếp hạng lại. Ném lỗi khi hỏng — NGƯỜI GỌI quyết định fallback,
 * vì chỉ người gọi biết xếp hạng tầng 1 đang có gì để giữ lại.
 */
export async function rerankCandidates(
    frame: RerankFrame,
    queryText: string,
    candidates: readonly RerankCandidate[],
): Promise<Map<string, RerankVerdict>> {
    if (!candidates.length) return new Map();

    const sentIds = candidates.map((c) => c.notificationId);

    const timeout = new Promise<never>((_, reject) => {
        const t = setTimeout(
            () => reject(new Error(`Re-rank quá ${RERANK_TIMEOUT_MS / 1000}s`)),
            RERANK_TIMEOUT_MS,
        );
        // Không giữ event loop sống chỉ vì cái đồng hồ này.
        (t as unknown as { unref?: () => void }).unref?.();
    });

    const call = callAndParse<{ rankings: unknown }>('rerank', async (repairHint) => {
        const res = await complete(
            [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: repairHint
                        ? `${buildUserPrompt(frame, queryText, candidates)}\n\n## CORRECTION\n${repairHint}`
                        : buildUserPrompt(frame, queryText, candidates),
                },
            ],
            {
                activity: ACTIVITY_RERANK,
                // temp 0 + budget dưới ngưỡng 1024: xếp hạng phải tất định hết
                // mức có thể — cùng lý do và cùng cơ chế với chẩn đoán mù.
                temperature: 0,
                max_tokens: BUDGET.rerank.maxTokens,
                thinkingBudget: BUDGET.rerank.thinkingBudget,
                responseMimeType: 'application/json',
                responseSchema: buildRerankSchema(frame) as unknown as Record<string, unknown>,
            },
        );
        return { content: res.content, finishReason: res.finishReason };
    });

    const started = Date.now();
    const { value } = await Promise.race([call, timeout]);
    const elapsed = Date.now() - started;
    const verdicts = normalizeRerankOutput(value, sentIds);

    // Lập luận về CASE ĐANG MỞ là mốc mà mọi điểm số được đo theo. Không log nó
    // thì khi một thứ hạng trông vô lý, chẳng còn gì để soi ngoài con số.
    const queryAnalysis = String((value as { queryAnalysis?: unknown } | null)?.queryAnalysis ?? '').trim();

    LOG.info(
        `Re-rank: ${verdicts.size}/${candidates.length} ứng viên được chấm trong ${elapsed}ms`
        + (verdicts.size < candidates.length ? ' (phần thiếu giữ mức none)' : '')
        + (queryAnalysis ? ` · cơ chế model đọc ra: ${queryAnalysis.slice(0, 200)}` : ''),
    );
    return verdicts;
}

/**
 * Gắn kết quả re-rank vào các bản chấm tầng 1 — HÀM THUẦN.
 *
 * Với mỗi ứng viên: tìm dòng breakdown của tiêu chí re-rank (tầng 1 đã đặt sẵn
 * mức 'none' giữ chỗ — xem `scoreCase`), rồi:
 *   - có verdict và đạt sàn  ⇒ điểm = weight × score/100, lý do vào `matchedOn`
 *   - có verdict, dưới sàn   ⇒ 0 điểm, `matchedOn` nói rõ dưới sàn bao nhiêu
 *   - không có verdict       ⇒ 0 điểm, `matchedOn` ghi chú vì sao (model bỏ sót
 *                              hoặc cả lượt re-rank hỏng)
 *
 * KHÔNG sort, KHÔNG cắt top-N ở đây — đó là việc của `scoreWithProfile`, nơi
 * biết ngưỡng và luật tie-break. Hàm này chỉ làm đúng một việc: cập nhật điểm.
 */
export function applyRerank(
    results: ReadonlyArray<{ notificationId: string; result: ScoreResult }>,
    criterion: Criterion,
    verdicts: ReadonlyMap<string, RerankVerdict> | null,
    unavailableNote = 'rerank unavailable',
): void {
    const weight = Number(criterion.weight) || 0;
    const floor = Number(criterion.minSimilarity ?? 0);

    for (const { notificationId, result } of results) {
        const row = result.breakdown.find(
            (b: CriterionHit) => b.criterionKey === criterion.criterionKey,
        );
        if (!row) continue;

        const verdict = verdicts?.get(notificationId);
        if (!verdict) {
            row.matchedOn = verdicts ? 'not scored by reranker' : unavailableNote;
            continue;
        }

        const normalized = verdict.score / 100;
        if (normalized >= floor) {
            const points = round1(weight * normalized);
            row.level = 'exact';
            row.points = points;
            row.matchedOn = `rerank ${verdict.score}/100 — ${verdict.reason}`;
            result.score = round1(result.score + points);
        } else {
            row.matchedOn = `rerank ${verdict.score}/100 < floor ${floor * 100}`;
        }
    }
}
