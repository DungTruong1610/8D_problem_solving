import { rollUp, scorePhase, type DimensionVerdict } from '../evalScoring';
import {
    EVAL_DIMENSIONS,
    EVAL_PHASES,
    EVAL_RUBRIC,
    PHASE_STEPS,
    dimensionsFor,
    maxScoreFor,
} from '../rubrics';

const EV = 'a verbatim quote from the report';

const v = (
    dimensionId: DimensionVerdict['dimensionId'],
    verdict: DimensionVerdict['verdict'],
    evidence = EV,
): DimensionVerdict => ({ dimensionId, verdict, evidence });

/** Mọi chiều áp dụng cho pha, cùng một phán quyết. */
const all = (phase: (typeof EVAL_PHASES)[number], verdict: DimensionVerdict['verdict']) =>
    dimensionsFor(phase).map((d) => v(d.id, verdict));

describe('thang chấm', () => {
    it('ba pha phủ đúng D1…D8, không chồng lấn, không hở', () => {
        const steps = EVAL_PHASES.flatMap((p) => PHASE_STEPS[p]);
        expect(steps.sort()).toEqual(['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8']);
        expect(new Set(steps).size).toBe(8);
    });

    it('mọi chiều có trọng số dương và một câu hỏi đọc được', () => {
        for (const d of EVAL_RUBRIC) {
            expect(d.weight).toBeGreaterThan(0);
            expect(d.question.length).toBeGreaterThan(40);
            expect(d.anchor.length).toBeGreaterThan(10);
        }
        expect(EVAL_RUBRIC.map((d) => d.id).sort()).toEqual([...EVAL_DIMENSIONS].sort());
    });

    /**
     * Pha Frame (D1+D2) không sinh ra hành động nào, nên trần của nó PHẢI thấp
     * hơn. Dùng một trần chung sẽ làm Frame không bao giờ đạt tối đa dù làm đúng
     * hết phần việc của nó — một hình phạt cho việc không làm việc của bước khác.
     */
    it('trần của Frame thấp hơn hai pha kia vì không có actionability', () => {
        expect(dimensionsFor('frame').map((d) => d.id)).not.toContain('actionability');
        expect(maxScoreFor('frame')).toBeLessThan(maxScoreFor('close'));
        expect(maxScoreFor('cause')).toBe(maxScoreFor('close'));
    });
});

describe('scorePhase', () => {
    it('toàn pass ⇒ đạt đúng trần, tỉ lệ 1', () => {
        const r = scorePhase('cause', all('cause', 'pass'));
        expect(r.score).toBe(maxScoreFor('cause'));
        expect(r.maxScore).toBe(maxScoreFor('cause'));
        expect(r.ratio).toBe(1);
    });

    it('toàn fail ⇒ 0 điểm nhưng trần KHÔNG đổi', () => {
        const r = scorePhase('cause', all('cause', 'fail'));
        expect(r.score).toBe(0);
        expect(r.maxScore).toBe(maxScoreFor('cause'));
        expect(r.ratio).toBe(0);
    });

    it('partial ăn đúng một nửa trọng số', () => {
        const r = scorePhase('cause', [v('grounding', 'partial')]);
        // grounding trọng số 3 → 1.5. Năm chiều còn lại abstain nên rơi khỏi trần.
        expect(r.score).toBe(1.5);
        expect(r.maxScore).toBe(3);
    });

    /**
     * `n-a` và `abstain` phải rơi khỏi CẢ tử số lẫn mẫu số. Cho chúng 0 điểm là
     * trừng phạt báo cáo vì một chiều không áp dụng được, hoặc vì judge không đủ
     * dữ kiện — hai chuyện không phải lỗi của báo cáo.
     */
    it('n-a và abstain rơi khỏi trần, không phải ăn 0 điểm', () => {
        const r = scorePhase('cause', [
            v('grounding', 'pass'),
            v('causal-coherence', 'n-a'),
            v('gap-honesty', 'abstain'),
        ]);
        expect(r.score).toBe(3);
        expect(r.maxScore).toBe(3);   // chỉ grounding tính vào trần
        expect(r.ratio).toBe(1);
    });

    /**
     * Luật chống bịa áp lên chính judge. Một phán quyết không dẫn được bằng chứng
     * thì không phân biệt được với một phán quyết bịa ra.
     */
    it('phán quyết KHÔNG có bằng chứng bị hạ xuống abstain', () => {
        const r = scorePhase('cause', [v('grounding', 'pass', '')]);
        expect(r.breakdown.find((b) => b.dimensionId === 'grounding')!.verdict).toBe('abstain');
        expect(r.score).toBe(0);
        expect(r.maxScore).toBe(0);
        // Sáu chiều của pha: một bị hạ vì thiếu bằng chứng, năm chiều judge không
        // trả về. Tất cả đều là abstain.
        expect(r.abstainCount).toBe(dimensionsFor('cause').length);
    });

    it('bằng chứng quá ngắn cũng bị hạ — "ok" không dẫn về đâu được', () => {
        expect(scorePhase('cause', [v('grounding', 'pass', 'ok')]).breakdown[0].verdict)
            .toBe('abstain');
    });

    it('chiều judge KHÔNG trả về ⇒ abstain, không phải pass', () => {
        const r = scorePhase('cause', [v('grounding', 'pass')]);
        const missing = r.breakdown.find((b) => b.dimensionId === 'causal-coherence')!;
        expect(missing.verdict).toBe('abstain');
        expect(missing.reason).toMatch(/không trả về/);
    });

    it('chiều lạ bị BỎ — judge không được tự thêm chiều vào thang', () => {
        const r = scorePhase('cause', [
            v('grounding', 'pass'),
            { dimensionId: 'brilliance' as any, verdict: 'pass', evidence: EV },
        ]);
        expect(r.breakdown.map((b) => b.dimensionId)).not.toContain('brilliance');
        expect(r.maxScore).toBe(3);
    });

    /**
     * Chiều không áp dụng vẫn xuất hiện trong breakdown — mang `n-a`, 0 trần — để
     * ma trận 6×3 đủ ô. Nhưng nó KHÔNG được nới trần, kể cả khi judge cố chấm nó.
     */
    it('chiều không áp dụng: có ô n-a nhưng KHÔNG nới trần', () => {
        const r = scorePhase('frame', [
            ...all('frame', 'pass'),
            v('actionability', 'pass'),
        ]);
        expect(r.maxScore).toBe(maxScoreFor('frame'));

        const cell = r.breakdown.find((b) => b.dimensionId === 'actionability')!;
        expect(cell.verdict).toBe('n-a');
        expect(cell.maxPoints).toBe(0);
        expect(cell.reason).toMatch(/không áp dụng/);
    });

    it('breakdown luôn đủ sáu chiều, ở mọi pha', () => {
        for (const phase of EVAL_PHASES) {
            expect(scorePhase(phase, []).breakdown).toHaveLength(EVAL_DIMENSIONS.length);
        }
    });

    it('trùng chiều: giữ lượt xuất hiện đầu', () => {
        const r = scorePhase('cause', [v('grounding', 'fail'), v('grounding', 'pass')]);
        expect(r.breakdown.find((b) => b.dimensionId === 'grounding')!.verdict).toBe('fail');
    });

    it('không chiều nào tính được ⇒ ratio null, không phải 0', () => {
        const r = scorePhase('cause', []);
        expect(r.maxScore).toBe(0);
        expect(r.ratio).toBeNull();
    });
});

describe('rollUp', () => {
    it('cộng ba pha và dựng ma trận chiều × pha', () => {
        const r = rollUp(EVAL_PHASES.map((p) => scorePhase(p, all(p, 'pass'))));
        expect(r.score).toBe(r.maxScore);
        expect(r.ratio).toBe(1);
        expect(r.byDimension.map((d) => d.dimensionId).sort()).toEqual([...EVAL_DIMENSIONS].sort());
    });

    /**
     * Đây là thứ đáng nhìn nhất của cả tính năng: một con số tổng nói "7/10", còn
     * ma trận nói "grounding ổn, actionability yếu ở Close" — tức nói được phải
     * sửa gì.
     */
    it('ma trận chỉ ra được chiều nào yếu ở pha nào', () => {
        const r = rollUp([
            scorePhase('frame', all('frame', 'pass')),
            scorePhase('cause', all('cause', 'pass')),
            scorePhase('close', [
                ...dimensionsFor('close').filter((d) => d.id !== 'actionability').map((d) => v(d.id, 'pass')),
                v('actionability', 'fail'),
            ]),
        ]);
        const action = r.byDimension.find((d) => d.dimensionId === 'actionability')!;
        expect(action.perPhase.frame).toBe('n-a');    // không áp dụng ở Frame
        expect(action.perPhase.close).toBe('fail');
        expect(action.points).toBeLessThan(action.maxPoints);

        const grounding = r.byDimension.find((d) => d.dimensionId === 'grounding')!;
        expect(grounding.points).toBe(grounding.maxPoints);
    });

    it('gộp số abstain của cả ba pha', () => {
        const r = rollUp(EVAL_PHASES.map((p) => scorePhase(p, [])));
        expect(r.abstainCount).toBe(EVAL_PHASES.reduce((n, p) => n + dimensionsFor(p).length, 0));
        expect(r.ratio).toBeNull();
    });
});
