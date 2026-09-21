/**
 * Ba phép đo thay cho một con số. HÀM THUẦN.
 *
 * ── Vì sao không phải một điểm chất lượng duy nhất ──
 * Bản đầu chấm một báo cáo ra `5/38`, rồi chấm LẠI CHÍNH NÓ ra `3.5/38`. Cùng
 * input, `temperature: 0`, hai kết quả. Nghĩa là một con số tuyệt đối ở đây không
 * so được giữa hai lượt chạy — mà so được giữa hai lượt chạy chính là toàn bộ lý
 * do tính năng này tồn tại.
 *
 * Nên thay vì tin vào điểm tuyệt đối, ba phép đo dưới đây được dựng theo thứ tự
 * độ tin cậy giảm dần:
 *
 *   1. sàn nhiễu     judge tự dao động bao nhiêu trên CÙNG một input
 *                    → không biết số này thì mọi số khác vô nghĩa
 *   2. độ bền        chênh lệch điểm giữa bản sạch và bản bẩn của cùng một case
 *                    → bền với nhiễu, vì cùng một judge chấm cả hai phía
 *   3. điểm tuyệt đối chỉ đọc được khi đã trừ đi sàn nhiễu
 *
 * Phép đo (2) cũng là phép đo ĐÚNG cho sản phẩm này: giá trị của AI ở đây là đọc
 * được dữ liệu SAP bẩn, nên câu hỏi thật không phải "báo cáo mấy điểm" mà là
 * "chất lượng tụt bao nhiêu khi dữ liệu bẩn đi".
 */

import { agreementEligibility, pairUp, type AgreementEligibility } from './dataset';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Sàn nhiễu của judge
// ─────────────────────────────────────────────────────────────────────────────

export interface NoiseFloor {
    /** Số lượt chấm lại trên cùng một báo cáo. */
    samples: number;
    min: number;
    max: number;
    mean: number;
    /** `max - min`. Đây là con số phải trừ đi trước khi tin một chênh lệch. */
    spread: number;
    /** Độ lệch chuẩn của mẫu. */
    stdDev: number;
    /** Chiều nào đổi phán quyết giữa các lượt — chỗ nhiễu thật sự sinh ra. */
    unstableDimensions: string[];
}

/**
 * Đo dao động của judge bằng cách chấm lại CÙNG một báo cáo nhiều lượt.
 *
 * ── Vì sao đây là phép đo đầu tiên phải chạy ──
 * Một harness đánh giá mà chưa đo nhiễu của chính nó thì không dùng được để kết
 * luận gì. "Điểm tăng 8%" không phân biệt được với "judge hôm nay chấm rộng tay"
 * cho tới khi biết 8% nằm trong hay ngoài sàn nhiễu.
 *
 * `unstableDimensions` là phần hữu dụng nhất: nó nói nhiễu đến từ chiều nào, và
 * thường đó là chiều có định nghĩa còn mơ hồ giữa `pass` và `partial` — tức là
 * một chỗ để sửa THANG CHẤM, không phải một chỗ để chấp nhận nhiễu.
 */
export function noiseFloor(
    runs: ReadonlyArray<{
        ratio: number | null;
        byDimension: ReadonlyArray<{ dimensionId: string; perPhase: Record<string, string | undefined> }>;
    }>,
): NoiseFloor | null {
    const ratios = runs.map((r) => r.ratio).filter((r): r is number => r !== null);
    if (ratios.length < 2) return null;

    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const variance = ratios.reduce((sum, r) => sum + (r - mean) ** 2, 0) / ratios.length;

    // Một chiều là bất định khi phán quyết của nó ở CÙNG một pha đổi giữa các lượt.
    const unstable = new Set<string>();
    const first = runs[0];
    for (const dim of first.byDimension) {
        for (const phase of Object.keys(dim.perPhase)) {
            const baseline = dim.perPhase[phase];
            for (const other of runs.slice(1)) {
                const cell = other.byDimension.find((d) => d.dimensionId === dim.dimensionId);
                if (cell && cell.perPhase[phase] !== baseline) unstable.add(dim.dimensionId);
            }
        }
    }

    return {
        samples: ratios.length,
        min: round3(Math.min(...ratios)),
        max: round3(Math.max(...ratios)),
        mean: round3(mean),
        spread: round3(Math.max(...ratios) - Math.min(...ratios)),
        stdDev: round3(Math.sqrt(variance)),
        unstableDimensions: [...unstable].sort(),
    };
}

/**
 * Một chênh lệch có vượt sàn nhiễu hay không.
 *
 * Đây là phép kiểm phải chạy TRƯỚC khi ai nói "cấu hình mới tốt hơn". Không có
 * nó, mọi so sánh giữa hai lượt chạy là đọc lá trà.
 */
export function exceedsNoise(delta: number, floor: NoiseFloor | null): boolean {
    if (!floor) return false;
    return Math.abs(delta) > floor.spread;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Độ bền trước dữ liệu bẩn
// ─────────────────────────────────────────────────────────────────────────────

export interface RobustnessGap {
    clean: string;
    dirty: string;
    cleanRatio: number | null;
    dirtyRatio: number | null;
    /** `clean − dirty`. Dương = bản bẩn bị chấm thấp hơn. */
    gap: number | null;
}

export interface RobustnessReport {
    pairs: RobustnessGap[];
    /** Chênh lệch trung bình, chỉ tính các cặp đo được cả hai phía. */
    meanGap: number | null;
    /** Cặp tụt sâu nhất — chỗ pipeline đọc dữ liệu bẩn kém nhất. */
    worst: RobustnessGap | null;
    /** Cặp thiếu một nửa. Không im lặng bỏ đi: đó là dấu hiệu nạp thiếu dữ liệu. */
    unpaired: string[];
}

/**
 * Chênh lệch chất lượng giữa bản sạch và bản bẩn của cùng một case.
 *
 * ── Vì sao phép đo này đáng tin hơn điểm tuyệt đối ──
 * Cả hai phía đi qua CÙNG một judge, CÙNG một thang, trong CÙNG một lượt chạy.
 * Nhiễu chung triệt tiêu phần lớn khi lấy hiệu. Một điểm tuyệt đối thì gánh trọn
 * nhiễu đó.
 *
 * ── Vì sao nó cũng là phép đo đúng cho sản phẩm ──
 * `mock-data/README.md`: hai bộ mô tả CÙNG một sự thật, chỉ khác cách ghi. Nên
 * một pipeline đọc được dữ liệu SAP bẩn PHẢI cho chênh lệch nhỏ. Chênh lệch lớn
 * nghĩa là AI đang phụ thuộc vào việc dữ liệu đã được ai đó dọn sẵn — mà dọn sẵn
 * là đúng thứ không tồn tại vào ngày đầu một defect thật xuất hiện.
 */
export function robustness(
    scores: ReadonlyArray<{ notificationId: string; ratio: number | null }>,
): RobustnessReport {
    const byId = new Map(scores.map((s) => [s.notificationId, s.ratio]));
    const { pairs, unpaired } = pairUp(scores.map((s) => s.notificationId));

    const rows: RobustnessGap[] = pairs.map(({ clean, dirty }) => {
        const cleanRatio = byId.get(clean) ?? null;
        const dirtyRatio = byId.get(dirty) ?? null;
        return {
            clean,
            dirty,
            cleanRatio,
            dirtyRatio,
            gap: cleanRatio !== null && dirtyRatio !== null
                ? round3(cleanRatio - dirtyRatio)
                : null,
        };
    });

    const gaps = rows.map((r) => r.gap).filter((g): g is number => g !== null);

    return {
        pairs: rows,
        meanGap: gaps.length ? round3(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null,
        // Tụt sâu nhất, không phải chênh lệch tuyệt đối lớn nhất: bản bẩn chấm
        // CAO hơn bản sạch là chuyện lạ nhưng không phải vấn đề của độ bền.
        worst: gaps.length
            ? rows.filter((r) => r.gap !== null).reduce((a, b) => (b.gap! > a.gap! ? b : a))
            : null,
        unpaired,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Độ trùng đáp án — ba nhóm, không gộp
// ─────────────────────────────────────────────────────────────────────────────

export interface AgreementReport {
    /** Chỉ các case có đáp án KHÔNG bị tranh chấp. Đây là con số duy nhất đáng gọi là tỉ lệ. */
    measurableRate: number | null;
    measurableCount: number;
    /**
     * Case kỹ sư ghi sai. `agreed = false` ở đây là câu trả lời ĐÚNG.
     *
     * Báo riêng vì gộp vào tỉ lệ sẽ trừng phạt pipeline vì đã đúng — và tối ưu
     * theo con số đó dạy nó nhường một kỹ sư đang sai.
     */
    contested: Array<{ notificationId: string; agreed: boolean; correctBehaviour: boolean }>;
    /** Case không ai ghi đáp án. Không đo được, KHÔNG phải 0%. */
    unmarkedCount: number;
}

export function agreement(
    cases: ReadonlyArray<{ notificationId: string; agreed: boolean | null }>,
): AgreementReport {
    const buckets = new Map<AgreementEligibility, typeof cases[number][]>([
        ['measurable', []], ['contested', []], ['unmarked', []],
    ]);
    for (const c of cases) buckets.get(agreementEligibility(c.notificationId))!.push(c);

    const measurable = buckets.get('measurable')!.filter((c) => c.agreed !== null);

    return {
        measurableRate: measurable.length
            ? round3(measurable.filter((c) => c.agreed).length / measurable.length)
            : null,
        measurableCount: measurable.length,
        contested: buckets.get('contested')!.map((c) => ({
            notificationId: c.notificationId,
            agreed: c.agreed === true,
            // Trên case bị tranh chấp, KHÔNG đồng ý với bản ghi mới là đúng.
            correctBehaviour: c.agreed === false,
        })),
        unmarkedCount: buckets.get('unmarked')!.length,
    };
}

function round3(n: number): number {
    return Math.round(n * 1000) / 1000;
}
