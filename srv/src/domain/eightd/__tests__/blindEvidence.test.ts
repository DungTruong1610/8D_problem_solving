/**
 * Test lớp che đáp án.
 *
 * Đây là bộ test quan trọng nhất trong dự án. Nếu bằng chứng mù rò dù chỉ một
 * mảnh kết luận, model sẽ chép lại thay vì suy luận — và nó vẫn cho ra kết quả
 * "đúng", vẫn trùng đáp án, vẫn trông thuyết phục. Không có test này thì không
 * có cách nào phát hiện.
 */

import fs from 'node:fs';
import path from 'node:path';
import { mapCase } from '../caseMapper';
import { auditBlindEvidence, buildBlindEvidence } from '../blindEvidence';
import { compareWithRecorded, normalizeFinding, type IndependentFinding } from '../independentAnalysis';

const MOCK_DIR = path.resolve(__dirname, '../../../../../mock-data/clean');
const load = (n: string) => JSON.parse(fs.readFileSync(path.join(MOCK_DIR, n), 'utf-8'));

const ALL = fs.readdirSync(MOCK_DIR)
    .filter((f) => f.startsWith('case-') && f.endsWith('.json') && !f.endsWith('.out.json'))
    .sort();

describe('buildBlindEvidence — cắt đúng thứ cần cắt', () => {
    const ctx = mapCase(load('case-8D-10048412.json'));
    const evidence = buildBlindEvidence(ctx);
    const blob = JSON.stringify(evidence);

    it('KHÔNG chứa chuỗi 5-Why của kỹ sư', () => {
        expect(ctx.fiveWhy.length).toBeGreaterThan(0);
        for (const step of ctx.fiveWhy) {
            expect(blob).not.toContain(step.answer);
            expect(blob).not.toContain(step.question);
        }
    });

    it('KHÔNG chứa cờ isRootCause', () => {
        expect(blob).not.toContain('isRootCause');
        expect(blob).not.toContain('is_root_cause');
    });

    it('KHÔNG chứa action khắc phục hay phòng ngừa', () => {
        expect(ctx.actions.corrective.length).toBeGreaterThan(0);
        for (const a of [...ctx.actions.corrective, ...ctx.actions.preventive]) {
            expect(blob).not.toContain(a.actionText);
        }
    });

    it('KHÔNG chứa mô tả FMEA', () => {
        expect(ctx.fmea).not.toBeNull();
        expect(blob).not.toContain(ctx.fmea!.description);
    });

    it('KHÔNG chứa lessons learned', () => {
        expect(ctx.lessonsLearned).not.toBeNull();
        expect(blob).not.toContain(ctx.lessonsLearned!.whatWorked);
        expect(blob).not.toContain(ctx.lessonsLearned!.whatDidnt);
    });

    it('GIỮ đủ 6 nhánh Ishikawa kèm mô tả điều tra', () => {
        expect(evidence.investigationFindings).toHaveLength(6);
        for (const r of ctx.ishikawa) {
            const found = evidence.investigationFindings.find((f) => f.category === r.category);
            expect(found?.finding).toBe(r.description);
        }
    });

    it('GIỮ số đo — đây là bằng chứng gốc mạnh nhất', () => {
        expect(evidence.inspections).toHaveLength(ctx.inspections.length);
        expect(blob).toContain('0.32mm');
    });

    it('GIỮ Is / Is-Not — công cụ khoanh vùng của D2', () => {
        expect(evidence.isIsNot?.is).toBe(ctx.isIsNot?.is);
    });

    it('GIỮ containment — hành động bảo vệ, không tiết lộ chẩn đoán', () => {
        expect(evidence.containmentTaken).toHaveLength(ctx.actions.containment.length);
    });
});

describe('auditBlindEvidence — bắt được rò rỉ', () => {
    it.each(ALL)('%s: bằng chứng mù sạch', (file) => {
        const ctx = mapCase(load(file));
        expect(auditBlindEvidence(buildBlindEvidence(ctx), ctx)).toEqual([]);
    });

    it('bắt được khi cờ isRootCause lọt vào', () => {
        const ctx = mapCase(load('case-8D-10048412.json'));
        const leaky = buildBlindEvidence(ctx) as any;
        leaky.investigationFindings[1].isRootCause = true;

        expect(auditBlindEvidence(leaky, ctx).join(' ')).toMatch(/isRootCause/);
    });

    it('bắt được khi câu trả lời 5-Why lọt vào', () => {
        const ctx = mapCase(load('case-8D-10048412.json'));
        const leaky = buildBlindEvidence(ctx) as any;
        leaky.investigationFindings[1].finding = ctx.fiveWhy[1].answer;

        expect(auditBlindEvidence(leaky, ctx).join(' ')).toMatch(/5-Why/);
    });

    it('bắt được khi action khắc phục lọt vào', () => {
        const ctx = mapCase(load('case-8D-10048412.json'));
        const leaky = buildBlindEvidence(ctx) as any;
        leaky.containmentTaken = [...ctx.actions.containment, ...ctx.actions.corrective];

        expect(auditBlindEvidence(leaky, ctx).join(' ')).toMatch(/Corrective/);
    });

    it('bắt được khi mô tả FMEA lọt vào', () => {
        const ctx = mapCase(load('case-8D-10048412.json'));
        const leaky = buildBlindEvidence(ctx) as any;
        leaky.header = { ...leaky.header, note: ctx.fmea!.description };

        expect(auditBlindEvidence(leaky, ctx).join(' ')).toMatch(/FMEA/);
    });
});

describe('compareWithRecorded — do CODE tính, không hỏi model', () => {
    const ctx = mapCase(load('case-8D-10048412.json')); // đáp án: Machine

    const finding = (category: string): IndependentFinding => ({
        rootCauseCategory: category,
        rootCauseStatement: 'x',
        derivedFiveWhy: [
            { stepNo: 1, question: 'q', answer: 'a', evidence: 'e' },
            { stepNo: 2, question: 'q', answer: 'a', evidence: 'e' },
        ],
        ruledOut: [],
        runnerUpCategory: null,
        runnerUpReason: null,
        confidence: 0.8,
        evidenceGaps: [],
    });

    it('báo TRÙNG khi AI chọn đúng nhánh kỹ sư ghi', () => {
        const v = compareWithRecorded(finding('Machine'), ctx);
        expect(v.recordedCategory).toBe('Machine');
        expect(v.agrees).toBe(true);
    });

    it('báo LỆCH khi AI chọn nhánh khác', () => {
        const v = compareWithRecorded(finding('Method'), ctx);
        expect(v.agrees).toBe(false);
        expect(v.aiCategory).toBe('Method');
        expect(v.recordedCategory).toBe('Machine');
    });

    it('đếm số bước của cả hai chuỗi để so độ sâu lập luận', () => {
        const v = compareWithRecorded(finding('Machine'), ctx);
        expect(v.aiStepCount).toBe(2);
        expect(v.recordedStepCount).toBe(ctx.fiveWhy.length);
    });
});

describe('normalizeFinding', () => {
    const base: IndependentFinding = {
        rootCauseCategory: 'Machine',
        rootCauseStatement: 'Tool worn past limit',
        derivedFiveWhy: [
            { stepNo: 7, question: 'q1', answer: 'a1', evidence: 'e1' },
            { stepNo: 9, question: 'q2', answer: 'a2', evidence: 'e2' },
        ],
        ruledOut: [
            { category: 'Man', reason: 'r' },
            { category: 'Machine', reason: 'nhánh đã chọn, phải bị bỏ' },
            { category: 'Man', reason: 'trùng, phải bị bỏ' },
        ],
        runnerUpCategory: 'Machine',
        runnerUpReason: 'r',
        confidence: 1.7,
        evidenceGaps: [],
    };

    it('đánh số lại các bước 5-Why từ 1', () => {
        expect(normalizeFinding(base).derivedFiveWhy.map((s) => s.stepNo)).toEqual([1, 2]);
    });

    it('bỏ nhánh đã chọn khỏi danh sách loại trừ', () => {
        const cats = normalizeFinding(base).ruledOut.map((r) => r.category);
        expect(cats).not.toContain('Machine');
    });

    it('bỏ mục loại trừ trùng lặp', () => {
        expect(normalizeFinding(base).ruledOut.filter((r) => r.category === 'Man')).toHaveLength(1);
    });

    it('bỏ runner-up khi nó trùng lựa chọn chính — vô nghĩa', () => {
        const n = normalizeFinding(base);
        expect(n.runnerUpCategory).toBeNull();
        expect(n.runnerUpReason).toBeNull();
    });

    it('kẹp confidence về khoảng 0..1', () => {
        expect(normalizeFinding(base).confidence).toBe(1);
        expect(normalizeFinding({ ...base, confidence: -3 }).confidence).toBe(0);
        expect(normalizeFinding({ ...base, confidence: NaN }).confidence).toBe(0);
    });
});
