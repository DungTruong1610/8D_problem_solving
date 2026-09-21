import { rankLevers, type LeverInput } from '../leverCorrelation';
import type { NoiseFloor } from '../metrics';

const NOISE: NoiseFloor = {
    samples: 3, min: 0.7, max: 0.72, mean: 0.71, spread: 0.02, stdDev: 0.01,
    unstableDimensions: [],
};

const input = (over: Partial<LeverInput> = {}): LeverInput => ({
    compliance: { violationsByRule: {}, repairCount: 0, antiFabricationFailures: 0 },
    dimensionRatios: {},
    emptyPrecedentCount: 0,
    caseCount: 10,
    abstainCount: 0,
    noise: NOISE,
    ...over,
});

const find = (levers: ReturnType<typeof rankLevers>, key: string) =>
    levers.find((l) => l.targetKey === key);

describe('rankLevers — thứ tự ưu tiên', () => {
    /**
     * Những thứ làm CẢ PHÉP ĐO mất giá trị phải đứng trước những thứ chỉ làm điểm
     * thấp. Đề xuất sửa prompt khi sàn nhiễu chưa đo là đề xuất dựa trên một con
     * số chưa ai kiểm.
     */
    it('sàn nhiễu chưa đo ⇒ đứng đầu, và nói rõ đừng chỉnh gì trước đó', () => {
        const levers = rankLevers(input({
            noise: null,
            dimensionRatios: { grounding: 0.2 },
        }));
        expect(levers[0].targetKey).toBe('noiseFloor');
        expect(levers[0].type).toBe('notAConfigProblem');
        expect(levers[0].evidence).toMatch(/--repeat/);
    });

    it('sàn nhiễu rộng ⇒ chỉ sang sửa THANG CHẤM, không sửa cấu hình pipeline', () => {
        const levers = rankLevers(input({
            noise: { ...NOISE, spread: 0.18, unstableDimensions: ['grounding', 'specificity'] },
        }));
        const top = levers[0];
        expect(top.targetKey).toBe('rubric-ambiguity');
        expect(top.evidence).toContain('18%');
        expect(top.evidence).toContain('grounding, specificity');
        expect(top.evidence).toMatch(/không phải chỗ sửa cấu hình/);
    });

    /**
     * Abstain nhiều nghĩa là báo cáo quá mỏng để chấm — vấn đề thượng nguồn.
     * Advisor phải nói thẳng thay vì bịa ra một chỗ chỉnh.
     */
    it('abstain nhiều ⇒ báo là vấn đề thượng nguồn, KHÔNG phải chỗ chỉnh', () => {
        const levers = rankLevers(input({ abstainCount: 70, caseCount: 10 }));
        const thin = find(levers, 'thin-reports')!;
        expect(thin.type).toBe('notAConfigProblem');
        expect(thin.evidence).toMatch(/quá mỏng/);
    });

    it('mọi thứ ổn ⇒ không đề xuất gì', () => {
        expect(rankLevers(input())).toEqual([]);
    });
});

describe('rankLevers — vi phạm ràng buộc', () => {
    it('xếp mã luật nổ nhiều nhất lên trước, kèm tỉ lệ', () => {
        const levers = rankLevers(input({
            compliance: {
                violationsByRule: { D1_GROUNDING: 11, D2_UNITS: 1 },
                repairCount: 0, antiFabricationFailures: 0,
            },
        }));
        const first = levers.find((l) => l.type === 'constraint')!;
        expect(first.targetKey).toBe('D1_GROUNDING');
        expect(first.evidence).toContain('11/12');
        expect(first.evidence).toContain('92%');
    });

    /**
     * Luật của tầng này: một ràng buộc nổ nhiều là bằng chứng MODEL đang sai, chứ
     * không phải bằng chứng luật quá chặt. Lõi chống bịa cố ý không cho cấu hình.
     */
    it('mặc định là SIẾT prompt, không nới luật', () => {
        const levers = rankLevers(input({
            compliance: {
                violationsByRule: { D1_GROUNDING: 9 }, repairCount: 0, antiFabricationFailures: 0,
            },
        }));
        expect(find(levers, 'D1_GROUNDING')!.evidence).toMatch(/không phải bằng chứng.*quá chặt/s);
    });

    it('chỉ nêu ba mã đầu, không xả cả danh sách', () => {
        const levers = rankLevers(input({
            compliance: {
                violationsByRule: { A: 5, B: 4, C: 3, D: 2, E: 1 },
                repairCount: 0, antiFabricationFailures: 0,
            },
        }));
        expect(levers.filter((l) => l.type === 'constraint')).toHaveLength(3);
    });
});

describe('rankLevers — grounding yếu: hai nguyên nhân khác hẳn nhau', () => {
    /**
     * Đây là phép phân biệt đáng giá nhất của tầng này. `grounding` yếu vì KHÔNG
     * CÓ GÌ để neo vào là chuyện của truy hồi; siết prompt ở đó làm mọi thứ tệ
     * hơn — model sẽ nói "không có dữ liệu" nhiều hơn, đúng nhưng vô dụng.
     */
    it('grounding yếu + nhiều case không có tiền lệ ⇒ chỉ vào TRUY HỒI', () => {
        const levers = rankLevers(input({
            dimensionRatios: { grounding: 0.3 },
            emptyPrecedentCount: 6,
            caseCount: 10,
        }));
        const lever = levers.find((l) => l.fromDimension === 'grounding')!;
        expect(lever.type).toBe('retrievalSetting');
        expect(lever.evidence).toMatch(/đừng siết prompt/);
    });

    it('grounding yếu nhưng VẪN tìm được tiền lệ ⇒ chỉ vào PROMPT', () => {
        const levers = rankLevers(input({
            dimensionRatios: { grounding: 0.3 },
            emptyPrecedentCount: 1,
            caseCount: 10,
        }));
        const lever = levers.find((l) => l.fromDimension === 'grounding')!;
        expect(lever.type).toBe('stepPrompt');
        expect(lever.evidence).toMatch(/dữ liệu để neo mà model không neo/);
    });

    it('grounding tốt ⇒ không đề xuất gì cho nó', () => {
        const levers = rankLevers(input({
            dimensionRatios: { grounding: 0.9 }, emptyPrecedentCount: 6,
        }));
        expect(levers.find((l) => l.fromDimension === 'grounding')).toBeUndefined();
    });
});

describe('rankLevers — chiều yếu → đúng bề mặt của nó', () => {
    it.each([
        ['specificity', 'constraint'],
        ['gap-honesty', 'stepPrompt'],
        ['method-discipline', 'stepPrompt'],
        ['causal-coherence', 'modelRouting'],
        ['actionability', 'stepPrompt'],
    ] as const)('%s yếu ⇒ %s', (dim, expectedType) => {
        const levers = rankLevers(input({ dimensionRatios: { [dim]: 0.2 } }));
        const lever = levers.find((l) => l.fromDimension === dim)!;
        expect(lever.type).toBe(expectedType);
        expect(lever.evidence).toContain('20%');
    });

    it('chiều không đo được ⇒ bỏ qua, không đoán', () => {
        expect(rankLevers(input({ dimensionRatios: { specificity: null } }))).toEqual([]);
    });
});

describe('rankLevers — postProcess phải dựng lại nhiều', () => {
    it('sửa nhiều hơn số case ⇒ chỉ vào tuyến model, không vào câu chữ', () => {
        const levers = rankLevers(input({
            compliance: { violationsByRule: {}, repairCount: 12, antiFabricationFailures: 0 },
            caseCount: 10,
        }));
        const lever = find(levers, 'activity:analyzeDefect')!;
        expect(lever.type).toBe('modelRouting');
        expect(lever.evidence).toMatch(/không phải câu chữ/);
    });
});

describe('rankLevers — bất biến', () => {
    it('KHÔNG BAO GIỜ đề xuất nới lõi chống bịa', () => {
        const levers = rankLevers(input({
            noise: null,
            compliance: {
                violationsByRule: { D1_GROUNDING: 20, D6_NO_PROOF: 15 },
                repairCount: 30, antiFabricationFailures: 8,
            },
            dimensionRatios: {
                grounding: 0.1, 'gap-honesty': 0.1, specificity: 0.1,
                'method-discipline': 0.1, 'causal-coherence': 0.1, actionability: 0.1,
            },
            emptyPrecedentCount: 8,
            abstainCount: 60,
        }));
        /*
         * Kiểm phải bắt được lời KHUYÊN nới luật, không bắt câu phủ định nó.
         * Bản đầu của test này dùng /nới luật/ và đỏ trên chính câu
         * "…không phải nới luật" — tức nó đang phạt đúng cái nó muốn thấy.
         */
        for (const l of levers) {
            expect(['hardRule', 'eightDRules']).not.toContain(l.type);
            expect(l.evidence).not.toMatch(/(nên|hãy|đề xuất)\s+nới/i);
            expect(l.evidence).not.toMatch(/relax (the )?(rule|guardrail)/i);
        }
        /*
         * Lever sinh ra TỪ MỘT MÃ LUẬT đã nổ phải kèm hướng siết prompt.
         *
         * Thu hẹp đúng phạm vi: `specificity` yếu cũng sinh lever `constraint`,
         * nhưng nó trỏ vào `formSchemaJson` và lời khuyên đúng ở đó là siết HỢP
         * ĐỒNG FIELD. Bản đầu của test đòi mọi lever `constraint` phải nói "siết
         * prompt" và đỏ trên chính hành vi đúng.
         */
        const ruleIds = Object.keys({ D1_GROUNDING: 0, D6_NO_PROOF: 0 });
        for (const l of levers.filter((x) => ruleIds.includes(x.targetKey))) {
            expect(l.evidence).toMatch(/siết prompt/);
        }
    });

    it('luôn sắp theo rank giảm dần, và tất định', () => {
        const i = input({
            compliance: { violationsByRule: { B: 3, A: 3 }, repairCount: 0, antiFabricationFailures: 0 },
            dimensionRatios: { specificity: 0.2, actionability: 0.2 },
        });
        const first = rankLevers(i);
        const second = rankLevers(i);
        expect(first.map((l) => l.targetKey)).toEqual(second.map((l) => l.targetKey));
        for (let k = 1; k < first.length; k++) {
            expect(first[k - 1].rank).toBeGreaterThanOrEqual(first[k].rank);
        }
    });
});
