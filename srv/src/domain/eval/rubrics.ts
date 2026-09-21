/**
 * Thang chấm chất lượng báo cáo 8D — sáu chiều, ba pha.
 *
 * ── Vì sao thang này neo vào `GUIDE_SOURCE` chứ không tự nghĩ ra ──
 * `prompts.ts` đã định nghĩa "tốt" nghĩa là gì cho từng bước D: D2 phải nêu giá
 * trị đo so với spec KÈM đơn vị, D4 phải ra một PHÁN QUYẾT chứ không phải một kế
 * hoạch điều tra, D6 phải viết được ngưỡng nghiệm thu có số. Một thang chấm bịa
 * ra từ đầu sẽ đo một thứ khác với thứ hệ thống đang được yêu cầu làm — và khi
 * hai thứ đó lệch nhau, con số trở thành vô nghĩa mà vẫn trông có nghĩa.
 *
 * Mỗi chiều dưới đây ghi rõ nó neo vào câu nào trong guide.
 *
 * ── Vì sao ba pha, không phải tám bước ──
 * Tám lượt gọi model cho tám bước là tám lần trả tiền cho cùng một ngữ cảnh. Ba
 * pha phủ hết tám bước trong ba lượt, và quan trọng hơn: `causal-coherence` chỉ
 * quan sát được KHI đọc nhiều bước cùng lúc. Chấm từng bước riêng thì chiều đó
 * không tồn tại.
 *
 * Mỗi lượt gọi NHÌN cả báo cáo nhưng chỉ CHẤM pha của nó — nên pha Close thấy
 * được kết luận D4 lúc phán xét liệu D5 có thật sự gỡ đúng nguyên nhân đó.
 *
 * ── Vì sao là hằng số trong code, không phải bảng cấu hình ──
 * Cùng đường mà `DEFAULT_CRITERIA` đã đi: hằng số trước, bảng sau. `breakdownJson`
 * lưu `dimensionId`, nên chuyển thang sang bảng về sau KHÔNG làm mất hiệu lực dữ
 * liệu lịch sử.
 */

/** Pha chấm. Ba pha phủ đúng tám bước, không chồng lấn, không hở. */
export const EVAL_PHASES = ['frame', 'cause', 'close'] as const;
export type EvalPhase = (typeof EVAL_PHASES)[number];

/** Bước D nào thuộc pha nào. Hợp lại phải đúng D1…D8, mỗi bước một lần. */
export const PHASE_STEPS: Record<EvalPhase, readonly string[]> = {
    frame: ['D1', 'D2'],
    cause: ['D3', 'D4'],
    close: ['D5', 'D6', 'D7', 'D8'],
};

export const EVAL_DIMENSIONS = [
    'grounding',
    'causal-coherence',
    'gap-honesty',
    'specificity',
    'method-discipline',
    'actionability',
] as const;
export type EvalDimension = (typeof EVAL_DIMENSIONS)[number];

/** `pass` 1.0 · `partial` 0.5 · `fail` 0.0 · `n-a`/`abstain` rơi khỏi trần. */
export const EVAL_VERDICTS = ['pass', 'partial', 'fail', 'n-a', 'abstain'] as const;
export type EvalVerdict = (typeof EVAL_VERDICTS)[number];

export const VERDICT_POINTS: Record<EvalVerdict, number | null> = {
    pass: 1,
    partial: 0.5,
    fail: 0,
    // `null` = KHÔNG tính vào trần. Khác 0 ở chỗ quyết định: 0 điểm hạ tỉ lệ,
    // còn không áp dụng thì không được phép hạ nó.
    'n-a': null,
    abstain: null,
};

export interface RubricDimension {
    id: EvalDimension;
    label: string;
    /** Câu hỏi gửi cho judge. Đây là toàn bộ định nghĩa của chiều này. */
    question: string;
    weight: number;
    /** Neo vào guide nào trong `prompts.ts` — để sửa guide thì biết chiều nào đổi theo. */
    anchor: string;
    /** Pha nào KHÔNG áp dụng chiều này. Trống ⇒ áp dụng cả ba. */
    notApplicableIn?: readonly EvalPhase[];
}

export const EVAL_RUBRIC: readonly RubricDimension[] = Object.freeze([
    {
        id: 'grounding',
        label: 'Grounding',
        question:
            'Does every factual claim trace to a real fact in the case or a cited precedent? '
            + 'Flag any invented person, measurement, batch, equipment id or action.',
        weight: 3,
        anchor: 'Lý do tồn tại của cả kiến trúc: CaseContext, sources, chẩn đoán mù.',
    },
    {
        id: 'causal-coherence',
        label: 'Causal coherence',
        question:
            'Does the chain symptom → cause → action → verification hold together ACROSS steps? '
            + 'Does each step build on what the earlier ones concluded, or contradict them?',
        weight: 3,
        anchor: 'D5 "name the step of the D4 chain it removes"; D8 "check D1 through D7".',
    },
    {
        id: 'gap-honesty',
        label: 'Gap honesty',
        question:
            'Where the case has no data, does the report SAY so instead of filling in something '
            + 'plausible? Reward an explicit gap; penalise a confident sentence with nothing behind it.',
        weight: 2,
        anchor: 'D2 "một ô không có nguồn thì nói thẳng, không được nhận một giá trị nghe hợp lý".',
    },
    {
        id: 'specificity',
        label: 'Specificity',
        question:
            'Are measured values given against specification WITH units, and are equipment, batch '
            + 'and part ids named? Or is it vague prose that could describe any defect?',
        weight: 2,
        anchor: 'D2 "giá trị đo so với spec, kèm đơn vị"; D4 "một PHÁN QUYẾT, không phải kế hoạch điều tra".',
    },
    {
        id: 'method-discipline',
        label: 'Method discipline',
        question:
            'Does each step do its OWN job? Containment must not be corrective, corrective must not '
            + 'be preventive, D4 must not confirm its own root cause, D6 must not claim proof it does not have.',
        weight: 2,
        anchor: 'Ranh giới khai tường minh trong guide D3/D5/D7; D4 "bạn không bao giờ tự xác nhận nguyên nhân gốc".',
    },
    {
        id: 'actionability',
        label: 'Actionability',
        question:
            'Could a quality engineer act on this immediately — owner, acceptance threshold, scope — '
            + 'or would they have to come back and ask?',
        weight: 1,
        anchor: 'D6 "trở lại trong dung sai 0.50mm trên 30 chi tiết liên tiếp" là kế hoạch; "theo dõi quy trình" thì không.',
        // Pha Frame (D1+D2) không sinh ra hành động nào, nên chấm nó ở đây là
        // trừ điểm một bước vì không làm việc của bước khác.
        notApplicableIn: ['frame'],
    },
]);

const BY_ID = new Map(EVAL_RUBRIC.map((d) => [d.id, d]));

export function dimension(id: EvalDimension): RubricDimension | undefined {
    return BY_ID.get(id);
}

/** Các chiều áp dụng cho một pha, giữ nguyên thứ tự khai báo. */
export function dimensionsFor(phase: EvalPhase): readonly RubricDimension[] {
    return EVAL_RUBRIC.filter((d) => !d.notApplicableIn?.includes(phase));
}

/**
 * Trần điểm của một pha — tổng trọng số các chiều ÁP DỤNG được.
 *
 * Trần không cố định giữa các pha, và đó là chủ ý: pha Frame không có
 * `actionability` nên trần của nó thấp hơn. Dùng một trần chung sẽ làm pha Frame
 * không bao giờ đạt điểm tối đa dù làm đúng hết mọi việc thuộc phần nó.
 */
export function maxScoreFor(phase: EvalPhase): number {
    return dimensionsFor(phase).reduce((sum, d) => sum + d.weight, 0);
}
