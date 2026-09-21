import { buildPhasePrompt, normalizeJudgeOutput, REPORT_MAX_SCORE, type JudgeInput } from '../judge';
import { EVAL_PHASES, PHASE_STEPS, dimensionsFor, maxScoreFor } from '../rubrics';
import { scorePhase } from '../evalScoring';
import type { DisciplineDraft, EightDResult } from '../../eightd/types';

const step = (code: string, over: Partial<DisciplineDraft> = {}): DisciplineDraft => ({
    code: code as DisciplineDraft['code'],
    sequence: Number(code.slice(1)),
    title: `${code} title`,
    summary: 's',
    content: `Content of ${code}. Burr height 0.22mm against a 0.08mm limit.`,
    actionItems: [],
    sources: ['actions.containment#1'],
    confidence: 0.83,
    dataBacked: code !== 'D6',
    ...over,
});

const REPORT: EightDResult = {
    internalSummary: 'Flange edge burr above limit after milling.',
    customerSummary: null,
    disciplines: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'].map((c) => step(c)),
};

const INPUT: JudgeInput = { notificationId: '8D-10048412', result: REPORT };

describe('buildPhasePrompt', () => {
    it('đánh dấu rõ bước nào CHẤM, bước nào chỉ là ngữ cảnh', () => {
        const p = buildPhasePrompt('cause', INPUT);
        for (const code of PHASE_STEPS.cause) {
            expect(p).toMatch(new RegExp(`### ${code}[^\\n]*GRADE THIS`));
        }
        expect(p).toMatch(/### D1[^\n]*context only/);
    });

    it('vẫn đưa CẢ báo cáo vào, kể cả bước ngoài pha', () => {
        const p = buildPhasePrompt('frame', INPUT);
        // `causal-coherence` chỉ quan sát được khi thấy các bước sau, nên D5..D8
        // phải có mặt dù pha Frame không chấm chúng.
        for (const code of ['D1', 'D2', 'D5', 'D8']) expect(p).toContain(`### ${code}`);
    });

    it('liệt kê đúng những chiều áp dụng cho pha, kèm trọng số', () => {
        const p = buildPhasePrompt('frame', INPUT);
        for (const d of dimensionsFor('frame')) expect(p).toContain(`${d.id} (weight ${d.weight})`);
        expect(p).not.toContain('actionability (weight');
    });

    it('đưa kết quả tầng 1 vào làm ngữ cảnh, và nói rõ đừng chấm lại', () => {
        const p = buildPhasePrompt('cause', {
            ...INPUT,
            compliance: { failed: 2, antiFabricationFailures: 1, violationsByRule: { D1_GROUNDING: 4 } },
        });
        expect(p).toMatch(/do not re-grade/i);
        expect(p).toContain('D1_GROUNDING×4');
        expect(p).toContain('1 of them anti-fabrication');
    });

    // ── Chốt chặn thiên lệch ─────────────────────────────────────────────────

    /**
     * Judge tồn tại để chấm CHẤT LƯỢNG. Cho nó xem đáp án đã ghi trong bộ dữ liệu
     * thì nó lặng lẽ thoái hoá thành một máy so đáp án — trả tiền để làm lại việc
     * mà `aiAgreesWithRecord` đã làm miễn phí, và con số thu được không còn đo
     * chất lượng nữa.
     *
     * Cùng tinh thần với `auditBlindEvidence`: kiểm trên chính chuỗi đã dựng.
     */
    it('prompt KHÔNG chứa đáp án đã ghi của bộ dữ liệu', () => {
        for (const phase of EVAL_PHASES) {
            const p = buildPhasePrompt(phase, INPUT);
            expect(p).not.toMatch(/rootCauseCategory/i);
            expect(p).not.toMatch(/recorded root cause/i);
        }
    });

    /** Neo phán quyết vào lời model tự đánh giá là bỏ đi tính độc lập của judge. */
    it('prompt KHÔNG chứa confidence model tự khai', () => {
        for (const phase of EVAL_PHASES) {
            const p = buildPhasePrompt(phase, INPUT);
            expect(p).not.toContain('0.83');
            expect(p).not.toMatch(/confidence/i);
        }
    });

    /** Biết model nào viết ra văn bản là một định kiến sẵn có. */
    it('prompt KHÔNG nói model nào đã sinh ra báo cáo', () => {
        for (const phase of EVAL_PHASES) {
            const p = buildPhasePrompt(phase, INPUT);
            expect(p).not.toMatch(/gemini|claude|gpt|haiku|sonnet/i);
        }
    });
});

describe('normalizeJudgeOutput', () => {
    const row = (dimensionId: string, verdict: string, evidence = 'a verbatim quote here') =>
        ({ dimensionId, verdict, evidence, reason: 'because' });

    it('đọc đúng output tử tế', () => {
        const out = normalizeJudgeOutput({ verdicts: [row('grounding', 'pass')] }, 'cause');
        expect(out).toEqual([{
            dimensionId: 'grounding', verdict: 'pass',
            evidence: 'a verbatim quote here', reason: 'because',
        }]);
    });

    it('BỎ chiều lạ — judge không được tự thêm chiều vào thang', () => {
        const out = normalizeJudgeOutput({ verdicts: [row('brilliance', 'pass')] }, 'cause');
        expect(out).toEqual([]);
    });

    it('BỎ chiều không áp dụng cho pha đó', () => {
        expect(normalizeJudgeOutput({ verdicts: [row('actionability', 'pass')] }, 'frame')).toEqual([]);
        expect(normalizeJudgeOutput({ verdicts: [row('actionability', 'pass')] }, 'close')).toHaveLength(1);
    });

    /**
     * Judge nói năng lộn xộn KHÔNG phải là báo cáo tệ. Phán quyết lạ rơi về
     * `abstain` (ra khỏi trần), chứ không về `fail` (trừ điểm).
     */
    it('phán quyết lạ ⇒ abstain, KHÔNG phải fail', () => {
        for (const bad of ['excellent', '', 'PASS!', null, 7]) {
            const out = normalizeJudgeOutput({ verdicts: [row('grounding', bad as any)] }, 'cause');
            expect(out[0].verdict).toBe('abstain');
        }
    });

    it('trùng chiều: giữ lượt đầu; output không phải mảng ⇒ rỗng', () => {
        const out = normalizeJudgeOutput(
            { verdicts: [row('grounding', 'fail'), row('grounding', 'pass')] }, 'cause');
        expect(out).toHaveLength(1);
        expect(out[0].verdict).toBe('fail');

        expect(normalizeJudgeOutput({ verdicts: 'nope' }, 'cause')).toEqual([]);
        expect(normalizeJudgeOutput(null, 'cause')).toEqual([]);
    });

    it('cắt bằng chứng và lý do ở 300 ký tự', () => {
        const out = normalizeJudgeOutput(
            { verdicts: [row('grounding', 'pass', 'x'.repeat(500))] }, 'cause');
        expect(out[0].evidence).toHaveLength(300);
    });

    /** Đi trọn đường: output thô → phán quyết → điểm. */
    it('nối được vào scorePhase và ra điểm đúng', () => {
        const out = normalizeJudgeOutput({
            verdicts: [row('grounding', 'pass'), row('gap-honesty', 'partial')],
        }, 'cause');
        const scored = scorePhase('cause', out);
        expect(scored.score).toBe(4);        // grounding 3 + gap-honesty 2×0.5
        expect(scored.maxScore).toBe(5);
    });
});

describe('REPORT_MAX_SCORE', () => {
    it('bằng tổng trần ba pha', () => {
        expect(REPORT_MAX_SCORE).toBe(EVAL_PHASES.reduce((n, p) => n + maxScoreFor(p), 0));
        expect(REPORT_MAX_SCORE).toBeGreaterThan(0);
    });
});
