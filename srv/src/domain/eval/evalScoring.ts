/**
 * Phán quyết của judge → điểm. HÀM THUẦN, không AI, không DB.
 *
 * ── Vì sao tách hẳn khỏi lượt gọi model ──
 * Cùng lý do `precedent/scoring.ts` và `graph/stepProfiles.ts` đã đưa ra, và lý
 * do đó ở đây còn nặng hơn: một điểm chất lượng SAI trông y hệt một điểm đúng.
 * Không có case nào "hiện ra sai" để ai đó nhận thấy — chỉ có một con số, và
 * người ta sẽ tin nó. Hàm thuần thì đối chiếu được bằng tay và test được bằng
 * mấy object thường.
 *
 * ── Luật tính điểm ──
 *   điểm pha    = Σ(điểm phán quyết × trọng số) / Σ(trọng số các chiều TÍNH ĐƯỢC)
 *   tính được   = chiều áp dụng cho pha đó VÀ phán quyết không phải n-a/abstain
 *
 * `abstain` và `n-a` rơi khỏi CẢ tử số lẫn mẫu số. Cho chúng 0 điểm sẽ trừng
 * phạt báo cáo vì một chiều không áp dụng được, hoặc vì judge không đủ dữ kiện —
 * hai chuyện không phải lỗi của báo cáo.
 */

import {
    EVAL_RUBRIC,
    EVAL_VERDICTS,
    VERDICT_POINTS,
    dimension,
    dimensionsFor,
    type EvalDimension,
    type EvalPhase,
    type EvalVerdict,
} from './rubrics';

export interface DimensionVerdict {
    dimensionId: EvalDimension;
    verdict: EvalVerdict;
    /**
     * Trích dẫn nguyên văn từ báo cáo, hoặc một đường dẫn `sources`.
     *
     * ── Vì sao BẮT BUỘC ──
     * Đây là luật chống bịa, áp lên chính judge. Một phán quyết không dẫn được
     * bằng chứng thì không phân biệt được với một phán quyết bịa ra — nên nó bị
     * hạ xuống `abstain` và rơi khỏi trần, thay vì được tính như một ý kiến.
     */
    evidence: string;
    /** Lý do một dòng. Không tham gia tính điểm; để người đọc soi lại. */
    reason?: string;
}

export interface PhaseScore {
    phase: EvalPhase;
    score: number;
    maxScore: number;
    /** `score / maxScore`, hoặc null khi không chiều nào tính được. */
    ratio: number | null;
    breakdown: Array<{
        dimensionId: EvalDimension;
        verdict: EvalVerdict;
        points: number;
        maxPoints: number;
        evidence: string;
        reason: string;
    }>;
    abstainCount: number;
}

/** Ngưỡng bằng chứng tối thiểu. Ngắn hơn thế thì không dẫn về đâu được. */
const MIN_EVIDENCE_CHARS = 12;

/**
 * Phán quyết thiếu bằng chứng bị hạ xuống `abstain`.
 *
 * Không loại bỏ hẳn: số lần phải hạ như thế CHÍNH LÀ tín hiệu về độ tin của
 * judge, và nó được đếm vào `abstainCount` để hiện ra ngoài. Một pha có quá
 * nhiều abstain phải bị đánh dấu chứ không phải được chấm điểm.
 */
function effectiveVerdict(v: DimensionVerdict): EvalVerdict {
    if (!EVAL_VERDICTS.includes(v.verdict)) return 'abstain';
    if (v.verdict === 'n-a' || v.verdict === 'abstain') return v.verdict;
    return String(v.evidence ?? '').trim().length >= MIN_EVIDENCE_CHARS ? v.verdict : 'abstain';
}

/**
 * Chấm một pha.
 *
 * Chiều mà judge KHÔNG trả về được coi là `abstain` — im lặng không phải là
 * `pass`. Chiều judge trả về mà pha này không áp dụng thì bị bỏ, không được
 * phép nới trần.
 */
export function scorePhase(
    phase: EvalPhase,
    verdicts: readonly DimensionVerdict[],
): PhaseScore {
    const byId = new Map<EvalDimension, DimensionVerdict>();
    for (const v of verdicts) {
        const known = dimension(v.dimensionId);
        // Chiều lạ ⇒ bỏ. Judge không được phép tự thêm chiều vào thang.
        if (!known) continue;
        if (!byId.has(v.dimensionId)) byId.set(v.dimensionId, v);
    }

    let score = 0;
    let maxScore = 0;
    let abstainCount = 0;
    const breakdown: PhaseScore['breakdown'] = [];

    const applicable = new Set(dimensionsFor(phase).map((d) => d.id));

    // Đi qua TOÀN BỘ sáu chiều, không chỉ những chiều áp dụng được.
    //
    // ── Vì sao ma trận phải đủ 18 ô ──
    // Chiều không áp dụng cho pha này vẫn phải có một ô mang `n-a`. Bỏ trống thì
    // trên ma trận 6×3 nó nhìn y hệt "judge không trả lời" — mà hai chuyện đó
    // khác nhau hoàn toàn: một cái là luật của thang, một cái là thiếu dữ liệu.
    for (const dim of EVAL_RUBRIC) {
        const raw = byId.get(dim.id);
        const verdict: EvalVerdict = !applicable.has(dim.id)
            ? 'n-a'
            : raw ? effectiveVerdict(raw) : 'abstain';
        const unit = VERDICT_POINTS[verdict];

        if (unit === null) {
            abstainCount += verdict === 'abstain' ? 1 : 0;
            breakdown.push({
                dimensionId: dim.id,
                verdict,
                points: 0,
                maxPoints: 0,
                evidence: applicable.has(dim.id) ? raw?.evidence?.trim() ?? '' : '',
                reason: !applicable.has(dim.id)
                    ? `không áp dụng cho pha ${phase}`
                    : raw?.reason?.trim() ?? (raw ? '' : 'judge không trả về chiều này'),
            });
            continue;
        }

        const points = round2(unit * dim.weight);
        score = round2(score + points);
        maxScore += dim.weight;
        breakdown.push({
            dimensionId: dim.id,
            verdict,
            points,
            maxPoints: dim.weight,
            evidence: raw!.evidence.trim(),
            reason: raw?.reason?.trim() ?? '',
        });
    }

    return {
        phase,
        score,
        maxScore,
        ratio: maxScore > 0 ? round2(score / maxScore) : null,
        breakdown,
        abstainCount,
    };
}

export interface ReportQuality {
    byPhase: PhaseScore[];
    /**
     * Ma trận 6 × 3 — điểm từng chiều trên từng pha.
     *
     * Đây là thứ đáng nhìn nhất: một con số tổng nói "báo cáo 7/10", còn ma trận
     * nói "grounding ổn, actionability yếu ở pha Close" — tức nói được phải sửa gì.
     */
    byDimension: Array<{
        dimensionId: EvalDimension;
        perPhase: Partial<Record<EvalPhase, EvalVerdict>>;
        points: number;
        maxPoints: number;
    }>;
    score: number;
    maxScore: number;
    /** `score / maxScore` trên toàn báo cáo, hoặc null khi không chấm được gì. */
    ratio: number | null;
    abstainCount: number;
}

/** Gộp ba pha thành điểm báo cáo + ma trận chiều × pha. */
export function rollUp(phases: readonly PhaseScore[]): ReportQuality {
    const byDimension = new Map<EvalDimension, {
        dimensionId: EvalDimension;
        perPhase: Partial<Record<EvalPhase, EvalVerdict>>;
        points: number;
        maxPoints: number;
    }>();

    let score = 0;
    let maxScore = 0;
    let abstainCount = 0;

    for (const phase of phases) {
        score = round2(score + phase.score);
        maxScore += phase.maxScore;
        abstainCount += phase.abstainCount;

        for (const row of phase.breakdown) {
            const entry = byDimension.get(row.dimensionId)
                ?? { dimensionId: row.dimensionId, perPhase: {}, points: 0, maxPoints: 0 };
            entry.perPhase[phase.phase] = row.verdict;
            entry.points = round2(entry.points + row.points);
            entry.maxPoints += row.maxPoints;
            byDimension.set(row.dimensionId, entry);
        }
    }

    return {
        byPhase: [...phases],
        byDimension: [...byDimension.values()],
        score,
        maxScore,
        ratio: maxScore > 0 ? round2(score / maxScore) : null,
        abstainCount,
    };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
