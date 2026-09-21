/**
 * Mỗi bước D cân bằng chứng theo cách của riêng nó — và chấm điểm là HÀM THUẦN.
 *
 * ── Vì sao tám bộ trọng số, không phải một ──
 * Đây là lý do tồn tại của cả đợt này. Tám bước hỏi tám câu khác nhau, nên "case
 * nào đáng đọc" có tám nghĩa khác nhau:
 *
 *     D1 cần NGƯỜI đã làm loại việc này  ⇒ work center và họ vật tư nặng ký
 *     D4 cần CÙNG CƠ CHẾ HỎNG            ⇒ từ khoá nặng ký, work center gần như vô nghĩa
 *     D7 cần CHỖ KHÁC CÙNG RỦI RO        ⇒ họ vật tư nặng nhất, work center không tính
 *
 * Bản cũ dùng một phép đo cho cả tám và chỉ đổi trọng số, nên chỉnh cho D4 tốt lên
 * là làm D1 xấu đi. Ở đây mỗi bước còn chọn được cả LOẠI bằng chứng nó muốn.
 *
 * ── Vì sao chấm điểm tách hẳn khỏi truy vấn ──
 * Cùng lý do file `precedent/scoring.ts` đưa ra và lý do đó vẫn đúng: đây là chỗ
 * dễ sai nhất, và cái sai khó thấy nhất — một tiền lệ yếu lọt lưới trông y hệt
 * một tiền lệ mạnh. Hàm thuần thì test được bằng mấy object thường, không cần DB,
 * không cần graph.
 */

import type { EvidenceHit, EvidenceKind } from './probes';

export const STEP_CODES = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'] as const;
export type StepCode = (typeof STEP_CODES)[number];

export interface GraphStepProfile {
    label: string;
    /** Bước này hỏi gì. Đi thẳng vào log và vào phần nguồn hiện trên UI. */
    question: string;
    weights: Partial<Record<EvidenceKind, number>>;
    /**
     * Trần số từ khoá được tính điểm.
     *
     * Không có trần thì một case dài dòng trùng tám chữ vặt sẽ vượt mọi tín hiệu
     * khác chỉ nhờ độ dài. Có trần thì "trùng nhiều" vẫn thắng "trùng một" — đúng
     * thứ R3 đòi — mà không biến độ dài mô tả thành thước đo.
     */
    keywordCap: number;
    /**
     * Dưới ngưỡng ⇒ KHÔNG có tiền lệ, và nói thẳng ra như vậy.
     *
     * Ngưỡng phải đặt sao cho MỘT từ khoá chung không bao giờ tự nó đủ điểm. Đó
     * chính là dương tính giả `flange` trong `PRECEDENT-RETRIEVAL-REVIEW.md`.
     */
    minScore: number;
    topN: number;
    /** Loại hành động bước này quan tâm. Bỏ trống ⇒ không dò hành động. */
    actionType?: 'Containment' | 'Corrective' | 'Preventive';

    /**
     * Tầng 2: re-rank bằng model đọc CẢ HAI văn bản. Bỏ trống ⇒ bước này không re-rank.
     *
     * ── Vì sao dùng lại đúng tầng của engine chấm điểm ──
     * `precedent/reranker.ts` đã trả lời đúng câu hỏi này rồi, đã có test, và đã
     * có khế ước "điểm = trọng số × score/100, kèm lý do đọc được". Viết một
     * reranker thứ hai cho graph nghĩa là hai prompt, hai cách chuẩn hoá output,
     * hai chỗ phải sửa khi model đổi hành vi — và không ai biết bản nào đang chạy.
     *
     * Graph khác engine cũ ở chỗ TÌM, không ở chỗ đọc hai đoạn văn xem chúng có
     * cùng cơ chế hỏng hay không. Nên tầng 1 khác nhau, tầng 2 dùng chung.
     */
    rerank?: {
        /** Điểm tối đa re-rank cộng vào. Phải nhỏ hơn `minScore` — xem `normalizeStepParams`. */
        weight: number;
        /** Sàn trên thang 0–1 của điểm model. Dưới sàn ⇒ 0 điểm. */
        floor: number;
        /**
         * Khung chain-of-thought của RIÊNG bước này.
         *
         * ── Vì sao không phải một câu instruction chung ──
         * Lập luận phải bắt đầu từ đúng chỗ. `queryFrame` là MỐC mà mọi điểm số
         * được đo theo, và mốc đó khác nhau hoàn toàn giữa các bước: D4 xác lập
         * cơ chế hỏng, D3 xác lập cái đang bị phơi nhiễm, D7 xác lập tầm với hệ
         * thống. Dùng chung một khung nghĩa là bảy bước suy nghĩ theo câu hỏi của
         * bước thứ tám — và model sẽ trả lời trôi chảy, chỉ là trả lời sai câu.
         * Nhìn output không thấy: vẫn đúng schema, vẫn có điểm, vẫn có lý do.
         */
        queryFrame: string;
        candidateFrame: string;
        rubric: string;
    };
}

/**
 * Trọng số mặc định. Admin đè được qua bảng `GraphStepParams` mà không cần deploy.
 *
 * Con số chọn theo một luật đơn giản để còn giải thích được: một tín hiệu ĐỊNH
 * DANH (đúng work center, đúng vật tư) đáng 2–4; từ khoá đáng 2 MỖI TỪ tới trần.
 * Nên ở D4, hai từ chung (4) ngang một lần trùng vật tư, còn một từ chung (2)
 * không bao giờ tự nó qua ngưỡng.
 */
/**
 * Khung chain-of-thought của từng bước D.
 *
 * ── Đọc bảng này thế nào ──
 * `queryFrame` là thứ model phải xác lập về CASE ĐANG MỞ trước khi nhìn bất kỳ
 * ứng viên nào — nó là mốc. `candidateFrame` nói so chiều nào. `rubric` nói 0 và
 * 100 nghĩa là gì; thiếu nó thì model tự bịa một thang, và thang đó đổi giữa các
 * lượt gọi.
 *
 * ── Vì sao cả tám bước đều có khung, dù chỉ vài bước nên bật ──
 * Trọng số 0 tắt tầng 2, nhưng khung thì phải đúng SẴN. Ai bật một bước lên mà
 * khung của bước đó chưa có sẽ nhận lại lập luận theo câu hỏi của bước khác —
 * và không có gì báo, vì output vẫn hợp lệ.
 *
 * `docs/RERANK-PRECEDENT-RETRIEVAL.md` lập luận rằng D1, D3, D6 và D8 không đáng
 * bật: xếp hạng người là phép ĐẾM chứ không phải độ liên quan văn bản, và D6/D8
 * lấy rất ít từ truy hồi. Lập luận đó vẫn đúng và đó là lý do mọi trọng số ở đây
 * bằng 0. Khung vẫn phải có, để lúc ai đó muốn đo thử thì thứ họ đo là thật.
 */
const RERANK_FRAMES = {
    D1: {
        queryFrame:
            'State which capabilities this problem demands — the equipment involved, the measurement '
            + 'in doubt, the process step that failed, the function that must sign it off. Name no people.',
        candidateFrame:
            'Did this case demand those same capabilities of its team? Judge what its team actually had '
            + 'to do, not how similar the defect looks.',
        rubric:
            '100 = its team faced the same demands and would transfer directly. 50 = one capability in '
            + 'common. 0 = a different kind of problem needing a different room of people.',
    },
    D2: {
        queryFrame:
            'State the boundary of this problem: which part, which station, which characteristic is out '
            + 'of specification, and by how much. Say what is measurably wrong, not what caused it.',
        candidateFrame:
            'Does this case sit inside that boundary or just outside it? Both are useful — inside sharpens '
            + 'the IS, just outside sharpens the IS-NOT. Say which, and on which dimension.',
        rubric:
            '100 = same boundary on the same characteristic. 60 = differs on exactly one dimension, which '
            + 'makes it a strong IS-NOT. 0 = unrelated boundary, useful for neither.',
    },
    D3: {
        queryFrame:
            'State what is exposed right now and must be protected: how much is in transit, in stock, or '
            + 'already at the customer, and where the next escape would happen. Ignore root cause.',
        candidateFrame:
            'Did this case face the same exposure, so its containment would protect the same thing? An '
            + 'identical defect with a different exposure needs different containment.',
        rubric:
            '100 = same exposure, its containment transfers as-is. 50 = same exposure, different scale. '
            + '0 = different exposure, its containment protects something else.',
    },
    D4: {
        queryFrame:
            'State what physical failure mechanism the open case shows, from its evidence alone — what '
            + 'moved, wore, deformed or drifted, and why that produces this symptom.',
        candidateFrame:
            'What mechanism does this candidate show, and where does it agree or differ from that? Judge '
            + 'the described physics.',
        rubric:
            '100 = the same mechanism, textbook. 0 = unrelated. Sharing a defect code or a work centre is '
            + 'not evidence of a shared mechanism, and differing on both does not rule one out.',
    },
    D5: {
        queryFrame:
            'State the root cause this case has arrived at, and what would have to physically change for '
            + 'it to stop recurring. Distinguish removing the cause from catching its output.',
        candidateFrame:
            "Would this candidate's corrective action remove THAT cause? Screening, sorting or reworking "
            + 'output does not remove a cause, however similar the two cases look.',
        rubric:
            '100 = its action removes this exact cause. 50 = it removes a neighbouring cause on the same '
            + 'chain. 0 = it only contains, or addresses something else.',
    },
    D6: {
        queryFrame:
            'State what would count as proof that this problem is gone: which characteristic, measured how, '
            + 'over what population and for how long. Name the number that would have to hold.',
        candidateFrame:
            'Did this case produce that kind of proof, so its verification plan transfers? Judge the '
            + 'evidence it generated, not the fix it applied.',
        rubric:
            '100 = same kind of proof, measurable the same way. 50 = proof exists but on a different '
            + 'characteristic. 0 = closed without transferable verification.',
    },
    D7: {
        queryFrame:
            'State how far this risk reaches beyond this case: which family of parts, which processes and '
            + 'which FMEA entry would have to change for it not to appear somewhere else.',
        candidateFrame:
            'Does this case show the same risk reaching the same way? A case at the same station but a '
            + 'different mechanism does not extend the reach; a case elsewhere with the same mechanism does.',
        rubric:
            '100 = same systemic reach, its preventive action generalises. 50 = same mechanism, narrower '
            + 'reach. 0 = local and unrelated.',
    },
    D8: {
        queryFrame:
            'State what a complete closure looks like for this problem: what has to be shown, what has to '
            + 'be handed over, and what typically stays open afterwards.',
        candidateFrame:
            'Did this case close on those terms? Judge the completeness of its closure and what it left '
            + 'open, not how similar the defect was.',
        rubric:
            '100 = closed on the same terms, its lessons transfer. 50 = closed, but leaving different '
            + 'items open. 0 = closed on terms that say nothing about this case.',
    },
} as const;

export const DEFAULT_STEP_PROFILES: Record<StepCode, GraphStepProfile> = {
    D1: {
        label: 'Establish the Team',
        question: 'Ai đã xử lý loại lỗi này, ở trạm này, trên họ vật tư này?',
        weights: { workCenter: 4, materialFamily: 3, material: 2, keywords: 1 },
        keywordCap: 3, minScore: 3, topN: 5,
        rerank: { weight: 0, floor: 0.5, ...RERANK_FRAMES.D1 },
    },
    D2: {
        label: 'Describe the Problem',
        question: 'Lỗi này đã xuất hiện ở đâu, trên vật tư nào, với mã lỗi nào?',
        weights: { defectCode: 4, material: 3, workCenter: 2, keywords: 2 },
        keywordCap: 3, minScore: 4, topN: 3,
        rerank: { weight: 0, floor: 0.5, ...RERANK_FRAMES.D2 },
    },
    D3: {
        label: 'Interim Containment Actions',
        question: 'Lần trước chặn tạm loại lỗi này bằng cách nào?',
        weights: { keywords: 2, materialFamily: 2, workCenter: 2, containment: 2 },
        keywordCap: 3, minScore: 4, topN: 3, actionType: 'Containment',
        rerank: { weight: 0, floor: 0.5, ...RERANK_FRAMES.D3 },
    },
    D4: {
        label: 'Root Cause Analysis',
        question: 'Chi tiết này hỏng theo cơ chế nào?',
        // Từ khoá PHẢI áp đảo ở đây, và con số này đến từ một lần chạy shadow
        // thật chứ không phải từ trực giác. Với bộ 2/2/1/1 ban đầu, case
        // `8D-10049030` (chung 3 từ: burr, edge, limit) hoà 6-6 với `8D-10049010`
        // (chung đúng 1 từ `flange`, nhưng cùng trạm và cùng vật tư) — tức là R3
        // quay lại qua cửa sau, ở đúng bước quan tâm tới cơ chế hỏng nhất.
        //
        // Cùng trạm và cùng vật tư vẫn được tính, nhưng chỉ đủ để phá thế hoà chứ
        // không đủ để lật thứ hạng: giờ 3 từ chung được 9, còn 1 từ + trạm + họ
        // vật tư được 5. Cả hai vẫn hiện ra, nhưng đúng thứ tự.
        weights: { keywords: 3, materialFamily: 1, workCenter: 1 },
        // Ngưỡng 5 vì trọng số từ khoá là 3: một từ chung (3) không thể tự nó qua,
        // hai từ chung (6) thì qua. Đổi trọng số mà quên đổi ngưỡng là mở lại R3.
        keywordCap: 4, minScore: 5, topN: 3,
        // Câu hỏi của D4 là câu hỏi mà mọi phép so tách rời đều trả lời tệ: hai
        // case cùng cơ chế hỏng thường mang mã lỗi khác nhau và mô tả khác hẳn
        // nhau. Trọng số 0 = TẮT — bật lên là một con số trong `GraphStepParams`,
        // không phải một lần deploy. Cùng thái độ Thanh đã đặt cho D4/D5 ở
        // engine chấm điểm: seed sẵn nhưng không tự bật.
        rerank: { weight: 0, floor: 0.5, ...RERANK_FRAMES.D4 },
    },
    D5: {
        label: 'Permanent Corrective Actions',
        question: 'Cách sửa nào đã thật sự đóng được nguyên nhân này?',
        weights: { keywords: 2, materialFamily: 2, corrective: 3 },
        keywordCap: 3, minScore: 4, topN: 3, actionType: 'Corrective',
        rerank: { weight: 0, floor: 0.5, ...RERANK_FRAMES.D5 },
    },
    D6: {
        label: 'Verify Effectiveness',
        question: 'Bằng chứng nào cho thấy bản sửa đã có tác dụng?',
        weights: { keywords: 2, materialFamily: 1, corrective: 3 },
        keywordCap: 2, minScore: 4, topN: 3, actionType: 'Corrective',
        rerank: { weight: 0, floor: 0.5, ...RERANK_FRAMES.D6 },
    },
    D7: {
        label: 'Prevent Recurrence',
        question: 'Chỗ nào khác cũng mang rủi ro này?',
        // Work center KHÔNG có trọng số: phòng ngừa là mở rộng ra ngoài trạm đã
        // hỏng, nên thưởng điểm cho việc cùng trạm là đi ngược mục đích của bước.
        weights: { materialFamily: 4, material: 2, preventive: 3, keywords: 1 },
        keywordCap: 2, minScore: 4, topN: 3, actionType: 'Preventive',
        rerank: { weight: 0, floor: 0.5, ...RERANK_FRAMES.D7 },
    },
    D8: {
        label: 'Closure and Recognition',
        question: 'Case tương đương nào đã đóng trọn vẹn?',
        weights: { workCenter: 2, materialFamily: 2, keywords: 1 },
        keywordCap: 2, minScore: 3, topN: 3,
        rerank: { weight: 0, floor: 0.5, ...RERANK_FRAMES.D8 },
    },
};

export interface ScoredCase {
    notificationId: string;
    score: number;
    /** Chỉ những bằng chứng THẬT SỰ ăn điểm ở bước này. */
    evidence: Array<{ kind: EvidenceKind; detail: string; count: number; points: number }>;
}

/**
 * Bằng chứng thô + trọng số của bước → danh sách case đã chấm, sắp giảm dần.
 *
 * Hàm thuần. Không DB, không graph, không AI.
 *
 * Bằng chứng có `kind` mà bước này không cân thì bị BỎ QUA, không phải tính 0 —
 * khác biệt lộ ra ở đường bằng chứng: D7 không được phép in ra "cùng work center"
 * như một lý do, vì với D7 đó không phải lý do.
 */
export function scoreEvidence(
    hits: readonly EvidenceHit[],
    profile: GraphStepProfile,
): ScoredCase[] {
    return finalizeScores(accumulateEvidence(hits, profile), profile);
}

/**
 * Cộng điểm và sắp xếp — KHÔNG cắt ngưỡng, KHÔNG cắt top-N.
 *
 * ── Vì sao phải tách khỏi bước cắt ──
 * Tầng re-rank chen vào GIỮA hai việc đó. Cắt theo `minScore` trước khi re-rank
 * sẽ loại oan đúng những case mà tầng 2 sinh ra để cứu: một case chỉ chung một
 * từ khoá nhưng cùng cơ chế hỏng thì tầng 1 cho điểm thấp, và nó chỉ vượt ngưỡng
 * NHỜ re-rank. Đây là bài học của `scoreWithProfile` ở engine chấm điểm, chép
 * sang vì lý do y hệt.
 */
export function accumulateEvidence(
    hits: readonly EvidenceHit[],
    profile: GraphStepProfile,
): ScoredCase[] {
    const byCase = new Map<string, ScoredCase>();

    for (const hit of hits) {
        const weight = profile.weights[hit.kind];
        if (!weight) continue;

        const multiplier = hit.kind === 'keywords'
            ? Math.min(hit.count, profile.keywordCap)
            : 1;
        const points = weight * multiplier;
        if (points <= 0) continue;

        const entry = byCase.get(hit.notificationId)
            ?? { notificationId: hit.notificationId, score: 0, evidence: [] };
        entry.score += points;
        entry.evidence.push({ kind: hit.kind, detail: hit.detail, count: hit.count, points });
        byCase.set(hit.notificationId, entry);
    }

    return [...byCase.values()].map(sortEvidence).sort(byScore);
}

/** Bằng chứng nặng nhất đứng trước — dòng đầu của đường bằng chứng phải là lý do CHÍNH. */
function sortEvidence(c: ScoredCase): ScoredCase {
    return {
        ...c,
        evidence: [...c.evidence].sort((a, b) => b.points - a.points || a.kind.localeCompare(b.kind)),
    };
}

/**
 * Chốt bằng mã case khi điểm bằng nhau — cùng input phải cho cùng thứ tự, nếu
 * không thì `precedents#1` đổi giữa hai lần chạy trên cùng một dữ liệu.
 */
const byScore = (a: ScoredCase, b: ScoredCase) =>
    b.score - a.score || a.notificationId.localeCompare(b.notificationId);

/** Áp ngưỡng và cắt top-N. Chạy SAU re-rank, trên điểm cuối cùng. */
export function finalizeScores(
    scored: readonly ScoredCase[],
    profile: GraphStepProfile,
): ScoredCase[] {
    return scored
        .filter((c) => c.score >= profile.minScore)
        .map(sortEvidence)
        .sort(byScore)
        .slice(0, profile.topN);
}

/**
 * Gắn phán quyết re-rank vào các case đã chấm ở tầng 1 — HÀM THUẦN.
 *
 * Cùng công thức với `applyRerank` của engine chấm điểm, và cố ý như vậy: điểm
 * `= trọng số × score/100`, có sàn, lý do đọc được. Hai engine cho cùng một con
 * số trên cùng một phán quyết, nên so kết quả hai bên mới có nghĩa.
 *
 * Khác một chỗ: ở đây bằng chứng là một MỤC được THÊM VÀO, không phải một dòng
 * giữ chỗ được điền — graph không biết trước case nào sẽ vào pool, nên không có
 * chỗ nào để giữ.
 *
 * `verdicts` null (cả lượt re-rank hỏng) ⇒ không thêm gì, xếp hạng tầng 1 đứng
 * nguyên. Mất một tầng vẫn còn tầng kia; đổi cả lượt tìm lấy một sự cố của model
 * thì không đáng.
 */
export function applyRerankToScored(
    scored: readonly ScoredCase[],
    rerank: NonNullable<GraphStepProfile['rerank']>,
    verdicts: ReadonlyMap<string, { score: number; reason: string }> | null,
): ScoredCase[] {
    if (!verdicts) return [...scored];

    return scored.map((c) => {
        const verdict = verdicts.get(c.notificationId);
        // Model bỏ sót case này, hoặc chấm dưới sàn ⇒ không cộng, và KHÔNG thêm
        // một mục 0 điểm: đường bằng chứng chỉ được nói tới thứ thật sự ăn điểm.
        if (!verdict || verdict.score / 100 < rerank.floor) return c;

        const points = Math.round(rerank.weight * (verdict.score / 100) * 10) / 10;
        if (points <= 0) return c;

        return sortEvidence({
            ...c,
            score: Math.round((c.score + points) * 10) / 10,
            evidence: [...c.evidence, {
                kind: 'rerank' as const,
                detail: `${verdict.score}/100 — ${verdict.reason}`,
                count: 1,
                points,
            }],
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Cấu hình admin đè lên mặc định
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_TYPES = ['Containment', 'Corrective', 'Preventive'] as const;

/** Cột trọng số trên `GraphStepParams` → khoá loại bằng chứng. */
const WEIGHT_COLUMNS: ReadonlyArray<readonly [string, EvidenceKind]> = [
    ['wWorkCenter', 'workCenter'],
    ['wMaterial', 'material'],
    ['wMaterialFamily', 'materialFamily'],
    ['wDefectCode', 'defectCode'],
    ['wKeywords', 'keywords'],
    ['wContainment', 'containment'],
    ['wCorrective', 'corrective'],
    ['wPreventive', 'preventive'],
];

function positiveInt(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export interface NormalizedStepParams {
    profile: GraphStepProfile;
    /** Null khi dòng cấu hình dùng được. Ngược lại: vì sao nó bị từ chối. */
    violation: string | null;
}

/**
 * Một dòng `GraphStepParams` → profile dùng được. HÀM THUẦN.
 *
 * ── Bất biến file này tồn tại để bảo vệ ──
 * `wKeywords` PHẢI nhỏ hơn `minScore`. Vi phạm nó nghĩa là MỘT từ khoá chung tự
 * mình đủ điểm làm tiền lệ — và đó chính xác là lỗi R3 mà cả đợt này sinh ra để
 * đóng: hai case chỉ chung chữ `flange` được đối xử như một case khớp thật.
 *
 * ── Vì sao TỪ CHỐI cả dòng thay vì kẹp lại con số ──
 * Kẹp lại thì admin lưu thành công, thấy con số mình gõ hiện trên màn hình, mà
 * hệ thống đang chạy một con số khác. Từ chối cả dòng và rơi về mặc định là thô
 * hơn, nhưng nó không bao giờ nói dối về thứ đang thật sự chạy — và người gọi có
 * `violation` để nói ra chỗ sai.
 */
export function normalizeStepParams(
    code: StepCode,
    row: unknown,
    fallback: GraphStepProfile = DEFAULT_STEP_PROFILES[code],
): NormalizedStepParams {
    if (!row || typeof row !== 'object') return { profile: fallback, violation: null };
    const r = row as Record<string, unknown>;

    if (r.enabled === false) return { profile: fallback, violation: null };

    const weights: Partial<Record<EvidenceKind, number>> = {};
    for (const [column, kind] of WEIGHT_COLUMNS) {
        const weight = positiveInt(r[column]);
        // Null/0 ⇒ bước KHÔNG cân loại này. Khác 0 ở chỗ nhìn thấy được: loại
        // không được cân thì không bao giờ xuất hiện trong đường bằng chứng.
        if (weight !== null) weights[kind] = weight;
    }

    const keywordCap = positiveInt(r.keywordCap) ?? fallback.keywordCap;
    const minScore = positiveInt(r.minScore) ?? fallback.minScore;
    const topN = positiveInt(r.topN) ?? fallback.topN;

    if (!Object.keys(weights).length) {
        return {
            profile: fallback,
            violation: `${code}: không có trọng số nào > 0, bước này sẽ không bao giờ tìm được tiền lệ.`,
        };
    }

    // Re-rank chịu ĐÚNG ràng buộc như từ khoá, và vì cùng một lý do: không tín
    // hiệu đơn lẻ nào được phép tự mình biến một case thành tiền lệ.
    const rerankWeight = positiveInt(r.wRerank) ?? 0;
    if (rerankWeight >= minScore) {
        return {
            profile: fallback,
            violation:
                `${code}: wRerank=${rerankWeight} ≥ minScore=${minScore}, nên chỉ cần model thích một `
                + 'case là case đó thành tiền lệ, kể cả khi nó không chung một quan hệ nào trong graph. '
                + 'Như vậy là vứt bỏ đúng thứ đã chọn graph để có. Dùng mặc định.',
        };
    }

    const keywordWeight = weights.keywords ?? 0;
    if (keywordWeight >= minScore) {
        return {
            profile: fallback,
            violation:
                `${code}: wKeywords=${keywordWeight} ≥ minScore=${minScore}, nên MỘT từ khoá chung `
                + 'tự nó đủ điểm làm tiền lệ. Đó chính là lỗi R3 đã đóng '
                + '(hai case chỉ chung chữ "flange" bị coi như khớp thật). Dùng mặc định.',
        };
    }

    const actionType = ACTION_TYPES.find((t) => t === String(r.actionType ?? '').trim());

    // Trọng số 0 hoặc null ⇒ không re-rank. Sàn và câu hỏi vẫn rơi về mặc định
    // của bước, nên bật lại chỉ là gõ một con số chứ không phải nhớ lại cả bộ.
    // `Number(null)` là 0, và 0 lọt mọi phép kiểm khoảng — nhưng sàn 0 nghĩa là
    // KHÔNG CÓ SÀN, tức mọi phán quyết của model đều được tính, đúng ngược với ý
    // định. Ô trống phải rơi về mặc định, không phải rơi về 0.
    const hasFloor = r.rerankFloor !== null && r.rerankFloor !== undefined && r.rerankFloor !== '';
    const rawFloor = Number(r.rerankFloor);
    const rerank = rerankWeight > 0
        ? {
            weight: rerankWeight,
            floor: hasFloor && Number.isFinite(rawFloor) && rawFloor >= 0 && rawFloor <= 1
                ? rawFloor
                : fallback.rerank?.floor ?? 0.5,
            // Ô trống ⇒ dùng khung mặc định CỦA BƯỚC ĐÓ, không phải một khung
            // chung: sửa một mảnh không được phép làm hai mảnh kia thành của bước khác.
            queryFrame: String(r.rerankQueryFrame ?? '').trim() || fallback.rerank?.queryFrame || '',
            candidateFrame: String(r.rerankCandidateFrame ?? '').trim() || fallback.rerank?.candidateFrame || '',
            rubric: String(r.rerankRubric ?? '').trim() || fallback.rerank?.rubric || '',
        }
        : undefined;

    return {
        profile: {
            label: String(r.label ?? fallback.label),
            question: String(r.question ?? fallback.question),
            weights,
            keywordCap,
            minScore,
            topN,
            ...(actionType ? { actionType } : {}),
            ...(rerank ? { rerank } : {}),
        },
        violation: null,
    };
}

/** Một dòng người đọc hiểu: `"6 điểm — 3 từ khoá chung (burr, edge, limit), cùng họ vật tư MG-HOUSING"`. */
export function explainEvidence(scored: ScoredCase): string {
    const parts = scored.evidence.map((e) => {
        switch (e.kind) {
            case 'keywords': return `${e.count} từ khoá chung (${e.detail})`;
            case 'workCenter': return `cùng work center ${e.detail}`;
            case 'material': return `cùng vật tư ${e.detail}`;
            case 'materialFamily': return `cùng họ vật tư ${e.detail}`;
            case 'defectCode': return `cùng mã lỗi ${e.detail}`;
            case 'containment': return `đã chặn tạm bằng ${e.detail}`;
            case 'corrective': return `đã khắc phục bằng ${e.detail}`;
            case 'preventive': return `đã phòng ngừa bằng ${e.detail}`;
            case 'rerank': return `model xếp hạng ${e.detail}`;
            default: return e.detail;
        }
    });
    return `${scored.score} điểm — ${parts.join(', ')}`;
}
