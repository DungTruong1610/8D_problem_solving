import {
    agreement,
    exceedsNoise,
    noiseFloor,
    robustness,
    type NoiseFloor,
} from '../metrics';
import {
    CONTESTED_ROOT_CAUSE,
    UNMARKED_ROOT_CAUSE,
    agreementEligibility,
    contestedEntry,
    pairUp,
    twinOf,
    variantOf,
} from '../dataset';

// ─────────────────────────────────────────────────────────────────────────────

describe('dataset — ghép cặp sạch/bẩn', () => {
    it('nhận đúng biến thể theo tiền tố', () => {
        expect(variantOf('8D-10048412')).toBe('clean');
        expect(variantOf('8D-90048412')).toBe('dirty');
        expect(variantOf('QM-0001')).toBe('unknown');
    });

    it('tìm được nửa còn lại của cặp, cả hai chiều', () => {
        expect(twinOf('8D-10048412')).toBe('8D-90048412');
        expect(twinOf('8D-90048412')).toBe('8D-10048412');
        expect(twinOf('QM-0001')).toBeNull();
    });

    /**
     * Cặp thiếu một nửa KHÔNG được im lặng bỏ đi: đó là dấu hiệu bộ dữ liệu nạp
     * thiếu, và bỏ qua sẽ làm phép đo độ bền chạy trên ít cặp hơn tưởng.
     */
    it('case lẻ đi vào unpaired, không bị bỏ', () => {
        const r = pairUp(['8D-10048412', '8D-90048412', '8D-10049010']);
        expect(r.pairs).toEqual([{ clean: '8D-10048412', dirty: '8D-90048412' }]);
        expect(r.unpaired).toEqual(['8D-10049010']);
    });

    it('không ghép một case hai lần', () => {
        const ids = ['8D-10048412', '8D-90048412', '8D-10048420', '8D-90048420'];
        const r = pairUp(ids);
        expect(r.pairs).toHaveLength(2);
        expect(r.unpaired).toEqual([]);
    });
});

describe('dataset — ba nhóm case cho agreement', () => {
    it('case không ai đánh dấu nguyên nhân ⇒ unmarked', () => {
        for (const id of UNMARKED_ROOT_CAUSE) {
            expect(agreementEligibility(id)).toBe('unmarked');
        }
    });

    it('case kỹ sư ghi sai ⇒ contested ở bản có đáp án', () => {
        for (const c of CONTESTED_ROOT_CAUSE) {
            expect(agreementEligibility(`8D-1${c.tail}`)).toBe('contested');
        }
    });

    /**
     * `8D-…48903` nằm ở cả hai danh sách, và đó không phải trùng lặp: bản sạch có
     * kỹ sư ghi `Method` (sai), bản bẩn thì không ai kịp đánh dấu. Không ai ghi
     * thì không có gì để tranh chấp, nên `unmarked` phải thắng — đảo thứ tự sẽ
     * khẳng định AI lệch với một bản ghi không tồn tại.
     */
    it('cùng một case: bản sạch contested, bản bẩn unmarked', () => {
        expect(agreementEligibility('8D-10048903')).toBe('contested');
        expect(agreementEligibility('8D-90048903')).toBe('unmarked');
    });

    it('case bình thường ⇒ measurable', () => {
        expect(agreementEligibility('8D-10048412')).toBe('measurable');
    });

    it('mỗi case bị tranh chấp có nêu lý do và đáp án AI đúng', () => {
        for (const c of CONTESTED_ROOT_CAUSE) {
            expect(c.recorded).not.toBe(c.aiExpected);
            expect(c.why.length).toBeGreaterThan(30);
            expect(contestedEntry(`8D-1${c.tail}`)).toBe(c);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────

const run = (ratio: number | null, cells: Record<string, Record<string, string>> = {}) => ({
    ratio,
    byDimension: Object.entries(cells).map(([dimensionId, perPhase]) => ({ dimensionId, perPhase })),
});

describe('noiseFloor', () => {
    /**
     * Đây là phép đo đầu tiên phải chạy. Một harness chưa đo nhiễu của chính nó
     * thì không dùng để kết luận gì được: "điểm tăng 8%" không phân biệt được với
     * "judge hôm nay chấm rộng tay".
     */
    it('đo min, max, spread và độ lệch chuẩn', () => {
        const r = noiseFloor([run(0.5), run(0.4), run(0.45)])!;
        expect(r.samples).toBe(3);
        expect(r.min).toBe(0.4);
        expect(r.max).toBe(0.5);
        expect(r.spread).toBe(0.1);
        expect(r.mean).toBe(0.45);
        expect(r.stdDev).toBeGreaterThan(0);
    });

    it('một mẫu ⇒ null, vì một lượt chạy không đo được dao động', () => {
        expect(noiseFloor([run(0.5)])).toBeNull();
        expect(noiseFloor([])).toBeNull();
    });

    it('bỏ qua lượt không chấm được, không coi là 0', () => {
        const r = noiseFloor([run(0.5), run(null), run(0.5)])!;
        expect(r.samples).toBe(2);
        expect(r.spread).toBe(0);
    });

    /**
     * Phần hữu dụng nhất: nhiễu đến từ CHIỀU NÀO. Thường đó là chiều có định
     * nghĩa còn mơ hồ giữa `pass` và `partial` — một chỗ để sửa THANG CHẤM, không
     * phải một chỗ để chấp nhận nhiễu.
     */
    it('chỉ ra chiều nào đổi phán quyết giữa các lượt', () => {
        const r = noiseFloor([
            run(0.5, { grounding: { cause: 'pass' }, specificity: { cause: 'fail' } }),
            run(0.4, { grounding: { cause: 'partial' }, specificity: { cause: 'fail' } }),
        ])!;
        expect(r.unstableDimensions).toEqual(['grounding']);
    });

    it('mọi phán quyết y nguyên ⇒ không chiều nào bất định', () => {
        const cells = { grounding: { cause: 'pass' } };
        expect(noiseFloor([run(0.5, cells), run(0.5, cells)])!.unstableDimensions).toEqual([]);
    });
});

describe('exceedsNoise', () => {
    const floor: NoiseFloor = {
        samples: 3, min: 0.4, max: 0.5, mean: 0.45, spread: 0.1, stdDev: 0.04,
        unstableDimensions: [],
    };

    it('chênh lệch trong sàn nhiễu KHÔNG được coi là thay đổi thật', () => {
        expect(exceedsNoise(0.08, floor)).toBe(false);
        expect(exceedsNoise(-0.1, floor)).toBe(false);
    });

    it('chênh lệch vượt sàn thì mới tính', () => {
        expect(exceedsNoise(0.15, floor)).toBe(true);
        expect(exceedsNoise(-0.2, floor)).toBe(true);
    });

    /** Chưa đo sàn ⇒ KHÔNG kết luận gì. Mặc định phải là "chưa biết", không phải "có". */
    it('chưa đo sàn ⇒ không kết luận', () => {
        expect(exceedsNoise(0.9, null)).toBe(false);
    });
});

describe('robustness — chênh lệch sạch ↔ bẩn', () => {
    /**
     * Phép đo đáng tin hơn điểm tuyệt đối: cả hai phía đi qua CÙNG một judge
     * trong CÙNG một lượt chạy, nên nhiễu chung triệt tiêu phần lớn khi lấy hiệu.
     *
     * Và nó cũng là phép đo ĐÚNG cho sản phẩm: hai bộ mô tả cùng một sự thật, nên
     * chênh lệch lớn nghĩa là AI đang phụ thuộc vào dữ liệu đã được dọn sẵn.
     */
    it('tính chênh lệch từng cặp và trung bình', () => {
        const r = robustness([
            { notificationId: '8D-10048412', ratio: 0.8 },
            { notificationId: '8D-90048412', ratio: 0.6 },
            { notificationId: '8D-10048420', ratio: 0.7 },
            { notificationId: '8D-90048420', ratio: 0.7 },
        ]);
        expect(r.pairs).toHaveLength(2);
        expect(r.pairs[0].gap).toBe(0.2);
        expect(r.pairs[1].gap).toBe(0);
        expect(r.meanGap).toBe(0.1);
    });

    it('nêu cặp tụt sâu nhất — chỗ đọc dữ liệu bẩn kém nhất', () => {
        const r = robustness([
            { notificationId: '8D-10048412', ratio: 0.9 },
            { notificationId: '8D-90048412', ratio: 0.3 },
            { notificationId: '8D-10048420', ratio: 0.7 },
            { notificationId: '8D-90048420', ratio: 0.65 },
        ]);
        expect(r.worst!.clean).toBe('8D-10048412');
        expect(r.worst!.gap).toBe(0.6);
    });

    /** Bản bẩn chấm CAO hơn là chuyện lạ, nhưng không phải vấn đề của độ bền. */
    it('bản bẩn cao hơn cho gap âm, và không bị coi là tệ nhất', () => {
        const r = robustness([
            { notificationId: '8D-10048412', ratio: 0.5 },
            { notificationId: '8D-90048412', ratio: 0.8 },
            { notificationId: '8D-10048420', ratio: 0.7 },
            { notificationId: '8D-90048420', ratio: 0.6 },
        ]);
        expect(r.pairs.find((p) => p.clean === '8D-10048412')!.gap).toBe(-0.3);
        expect(r.worst!.clean).toBe('8D-10048420');
    });

    it('một nửa không chấm được ⇒ gap null, không tính vào trung bình', () => {
        const r = robustness([
            { notificationId: '8D-10048412', ratio: 0.8 },
            { notificationId: '8D-90048412', ratio: null },
        ]);
        expect(r.pairs[0].gap).toBeNull();
        expect(r.meanGap).toBeNull();
        expect(r.worst).toBeNull();
    });

    it('báo case lẻ ra ngoài', () => {
        const r = robustness([{ notificationId: '8D-10049010', ratio: 0.8 }]);
        expect(r.pairs).toEqual([]);
        expect(r.unpaired).toEqual(['8D-10049010']);
    });
});

describe('agreement — ba nhóm, không gộp', () => {
    it('chỉ case đo được vào tỉ lệ', () => {
        const r = agreement([
            { notificationId: '8D-10048412', agreed: true },
            { notificationId: '8D-10048420', agreed: false },
            { notificationId: '8D-10049010', agreed: true },
            { notificationId: '8D-10049020', agreed: true },
        ]);
        expect(r.measurableCount).toBe(4);
        expect(r.measurableRate).toBe(0.75);
    });

    /**
     * Bất biến quan trọng nhất của phép đo này. Trên hai case kỹ sư ghi sai,
     * `agreed = false` là câu trả lời ĐÚNG. Gộp vào tỉ lệ nghĩa là trừng phạt
     * pipeline vì đã đúng — và tối ưu theo con số đó dạy nó nhường một kỹ sư sai.
     */
    it('case bị tranh chấp KHÔNG vào tỉ lệ, và bất đồng được ghi là ĐÚNG', () => {
        const contestedId = `8D-1${CONTESTED_ROOT_CAUSE[0].tail}`;
        const r = agreement([
            { notificationId: '8D-10048412', agreed: true },
            { notificationId: contestedId, agreed: false },
        ]);
        expect(r.measurableCount).toBe(1);
        expect(r.measurableRate).toBe(1);

        expect(r.contested).toHaveLength(1);
        expect(r.contested[0].agreed).toBe(false);
        expect(r.contested[0].correctBehaviour).toBe(true);
    });

    it('đồng ý với một bản ghi SAI bị đánh dấu là hành vi không đúng', () => {
        const contestedId = `8D-1${CONTESTED_ROOT_CAUSE[1].tail}`;
        const r = agreement([{ notificationId: contestedId, agreed: true }]);
        expect(r.contested[0].correctBehaviour).toBe(false);
    });

    /** Không ai ghi đáp án ⇒ không đo được, KHÔNG phải 0%. */
    it('case không có đáp án bị đếm riêng, không kéo tỉ lệ xuống', () => {
        const r = agreement([
            { notificationId: '8D-10048412', agreed: true },
            ...UNMARKED_ROOT_CAUSE.map((id) => ({ notificationId: id, agreed: null })),
        ]);
        expect(r.measurableRate).toBe(1);
        expect(r.unmarkedCount).toBe(UNMARKED_ROOT_CAUSE.length);
    });

    it('không case nào đo được ⇒ null, không phải 0', () => {
        expect(agreement([{ notificationId: '8D-10048412', agreed: null }]).measurableRate).toBeNull();
    });
});
