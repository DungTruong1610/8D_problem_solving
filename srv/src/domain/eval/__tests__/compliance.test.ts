import { checkCompliance, summariseValidation, type ComplianceInput } from '../compliance';
import type { DisciplineDraft, EightDResult } from '../../eightd/types';

const step = (code: string, over: Partial<DisciplineDraft> = {}): DisciplineDraft => ({
    code: code as DisciplineDraft['code'],
    sequence: Number(code.slice(1)),
    title: `${code} title`,
    summary: 'summary',
    content: 'content',
    actionItems: [],
    sources: ['actions.containment#1'],
    confidence: 0.8,
    dataBacked: code !== 'D6',
    ...over,
});

const result = (over: Partial<EightDResult> = {}): EightDResult => ({
    internalSummary: 'A burr above limit on the flange edge after milling.',
    customerSummary: null,
    disciplines: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'].map((c) =>
        step(c, c === 'D6' ? { dataBacked: false, sources: [] } : {})),
    ...over,
});

const input = (over: Partial<ComplianceInput> = {}): ComplianceInput => ({
    result: result(),
    isCustomerFacing: false,
    hasPreventiveActions: true,
    derivedFiveWhyLength: 3,
    ruledOutCount: 5,
    blindLeaks: [],
    ...over,
});

const outcome = (r: ReturnType<typeof checkCompliance>, id: string) =>
    r.checks.find((c) => c.id === id)!.outcome;

describe('checkCompliance — báo cáo hợp lệ', () => {
    it('không trượt phép nào, tỉ lệ 1', () => {
        const r = checkCompliance(input());
        expect(r.failed).toBe(0);
        expect(r.antiFabricationFailures).toBe(0);
        expect(r.ratio).toBe(1);
    });

    it('mọi phép đều có nhãn đọc được và id ổn định', () => {
        const r = checkCompliance(input());
        expect(new Set(r.checks.map((c) => c.id)).size).toBe(r.checks.length);
        for (const c of r.checks) expect(c.label.length).toBeGreaterThan(5);
    });
});

describe('checkCompliance — hình dạng báo cáo', () => {
    it('bắt thiếu discipline', () => {
        const r = checkCompliance(input({
            result: result({ disciplines: result().disciplines.slice(0, 7) }),
        }));
        expect(outcome(r, 'all-eight')).toBe('fail');
        expect(outcome(r, 'order')).toBe('fail');
    });

    it('bắt sai thứ tự', () => {
        const d = result().disciplines;
        const r = checkCompliance(input({
            result: result({ disciplines: [d[1], d[0], ...d.slice(2)] }),
        }));
        expect(outcome(r, 'order')).toBe('fail');
    });

    it('bắt sequence lệch khỏi thứ tự bước', () => {
        const d = result().disciplines.map((x, i) => ({ ...x, sequence: i === 3 ? 99 : x.sequence }));
        expect(outcome(checkCompliance(input({ result: result({ disciplines: d }) })), 'sequence-matches-code'))
            .toBe('fail');
    });

    it('bắt internalSummary rỗng', () => {
        expect(outcome(checkCompliance(input({ result: result({ internalSummary: '  ' }) })), 'internal-summary'))
            .toBe('fail');
    });
});

describe('checkCompliance — luật chống bịa', () => {
    /**
     * D6 xác minh hiệu lực, mà bộ dữ liệu này KHÔNG mang bằng chứng xác minh nào.
     * D6 khai `dataBacked = true` nghĩa là nó vừa bịa ra một bằng chứng.
     */
    it('D6 khai dataBacked = true bị tính là lỗi chống bịa', () => {
        const d = result().disciplines.map((x) => x.code === 'D6' ? { ...x, dataBacked: true } : x);
        const r = checkCompliance(input({ result: result({ disciplines: d }) }));
        expect(outcome(r, 'd6-not-data-backed')).toBe('fail');
        expect(r.antiFabricationFailures).toBeGreaterThan(0);
    });

    it('discipline khai dataBacked mà không có sources bị bắt, và nêu tên bước', () => {
        const d = result().disciplines.map((x) => x.code === 'D4' ? { ...x, sources: [] } : x);
        const r = checkCompliance(input({ result: result({ disciplines: d }) }));
        expect(outcome(r, 'sources-when-data-backed')).toBe('fail');
        expect(r.checks.find((c) => c.id === 'sources-when-data-backed')!.detail).toBe('D4');
    });

    /**
     * Phép thử chống bịa quan trọng nhất — xem `mock-data/README.md`. Case không
     * có preventive action nào thì D7 phải tự khai là không có dữ liệu.
     */
    it('case không có preventive action: D7 phải khai dataBacked = false', () => {
        const d = result().disciplines.map((x) => x.code === 'D7' ? { ...x, dataBacked: true } : x);
        const r = checkCompliance(input({
            hasPreventiveActions: false,
            result: result({ disciplines: d }),
        }));
        expect(outcome(r, 'd7-honest-when-empty')).toBe('fail');
        expect(r.antiFabricationFailures).toBeGreaterThan(0);
    });

    it('case CÓ preventive action: phép đó là n-a, không phải pass', () => {
        const r = checkCompliance(input({ hasPreventiveActions: true }));
        expect(outcome(r, 'd7-honest-when-empty')).toBe('n-a');
        // `n-a` phải rơi khỏi mẫu số, không được làm tỉ lệ trông đẹp lên.
        expect(r.notApplicable).toBeGreaterThan(0);
    });

    it('bằng chứng mù rò đáp án bị bắt và nêu đường rò', () => {
        const r = checkCompliance(input({ blindLeaks: ['rootCause.category'] }));
        expect(outcome(r, 'blind-no-leak')).toBe('fail');
        expect(r.checks.find((c) => c.id === 'blind-no-leak')!.detail).toContain('rootCause.category');
    });
});

describe('checkCompliance — ràng buộc Q1-only', () => {
    it('Q3 phải để customerSummary null', () => {
        expect(outcome(checkCompliance(input({
            isCustomerFacing: false,
            result: result({ customerSummary: 'Dear customer…' }),
        })), 'customer-summary-matches-origin')).toBe('fail');
    });

    it('Q1 phải CÓ customerSummary', () => {
        expect(outcome(checkCompliance(input({ isCustomerFacing: true })), 'customer-summary-matches-origin'))
            .toBe('fail');
        expect(outcome(checkCompliance(input({
            isCustomerFacing: true,
            result: result({ customerSummary: 'Dear customer…' }),
        })), 'customer-summary-matches-origin')).toBe('pass');
    });
});

describe('checkCompliance — lập luận độc lập', () => {
    it('chuỗi 5-Why dưới 2 bước bị bắt', () => {
        expect(outcome(checkCompliance(input({ derivedFiveWhyLength: 1 })), 'derived-five-why')).toBe('fail');
    });

    it('loại trừ dưới 4 nhánh bị bắt', () => {
        expect(outcome(checkCompliance(input({ ruledOutCount: 3 })), 'ruled-out')).toBe('fail');
    });
});

describe('summariseValidation', () => {
    it('đếm theo MÃ LUẬT, không chỉ đếm tổng', () => {
        const r = summariseValidation({
            D1: { violations: [{ ruleId: 'D1_GROUNDING' }, { ruleId: 'D1_GROUNDING' }], repairs: ['x'] },
            D4: { violations: [{ ruleId: 'D4_NO_SELF_CONFIRM' }], repairs: [] },
        });
        expect(r.violationsByRule).toEqual({ D1_GROUNDING: 2, D4_NO_SELF_CONFIRM: 1 });
        expect(r.violationCount).toBe(3);
        expect(r.repairCount).toBe(1);
    });

    it('vi phạm dạng chuỗi thô vẫn đếm được', () => {
        expect(summariseValidation({ D2: { violations: ['D2_UNITS'] } }).violationsByRule)
            .toEqual({ D2_UNITS: 1 });
    });

    /**
     * Vi phạm không nhận ra mã vẫn phải được ĐẾM, gom vào `unknown`. Bỏ đi sẽ làm
     * tổng sai theo hướng trông đẹp hơn thực tế.
     */
    it('vi phạm thiếu mã gom vào unknown, không bị bỏ', () => {
        const r = summariseValidation({ D3: { violations: [{}, { ruleId: '  ' }] } });
        expect(r.violationsByRule).toEqual({ unknown: 2 });
        expect(r.violationCount).toBe(2);
    });

    it('không có validation ⇒ tất cả bằng 0, không ném', () => {
        expect(summariseValidation(undefined)).toEqual({
            violationsByRule: {}, violationCount: 0, repairCount: 0,
        });
    });

    it('vi phạm ràng buộc hiện ra trong thẻ điểm kèm mã nổ nhiều nhất', () => {
        const r = checkCompliance(input({
            validation: { D1: { violations: [{ ruleId: 'D1_GROUNDING' }, { ruleId: 'D1_GROUNDING' }] } },
        }));
        expect(outcome(r, 'no-constraint-violations')).toBe('fail');
        expect(r.checks.find((c) => c.id === 'no-constraint-violations')!.detail)
            .toContain('D1_GROUNDING×2');
    });
});
