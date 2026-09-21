/**
 * Test tầng re-rank — toàn bộ là HÀM THUẦN, không cần DB, không gọi AI.
 *
 * Khoá lại ba khế ước:
 *   1. `normalizeRerankOutput`: phòng thủ trước output model bừa (id lạ, score
 *      ngoài range, trùng id, thiếu id) — mọi trường hợp đều có hành vi xác định.
 *   2. `applyRerank`: toán trộn điểm — weight × score/100 có sàn, cộng vào tổng,
 *      và mỗi nhánh (đạt sàn / dưới sàn / không được chấm / cả lượt hỏng) để lại
 *      dấu vết đọc được trong `matchedOn`.
 *   3. `scoreCase` với tiêu chí `rerank`: tầng 1 đặt dòng 'none' giữ chỗ và trần
 *      điểm VẪN gồm weight — bật tiêu chí là trần nhích lên, đúng luật chung.
 */

import { applyRerank, normalizeRerankOutput, type RerankVerdict } from '../reranker';
import { scoreCase, type Criterion, type ScorableCase, type ScoreResult } from '../scoring';

const RERANK: Criterion = {
    criterionKey: 'rerank',
    label: 'Mechanism re-rank',
    description: 'Rank by same physical failure mechanism.',
    sourceField: '',
    matchType: 'rerank',
    weight: 3,
    minSimilarity: 0.5,
    enabled: true,
    sortOrder: 50,
};

const WORK_CENTER: Criterion = {
    criterionKey: 'workCenter',
    label: 'Work center',
    sourceField: 'workCenterId',
    matchType: 'exact',
    weight: 4,
    enabled: true,
    sortOrder: 10,
};

const CASE_A: ScorableCase = { notificationId: '8D-1', workCenterId: 'WC-01' };
const CASE_B: ScorableCase = { notificationId: '8D-2', workCenterId: 'WC-01' };

// ─────────────────────────────────────────────────────────────────────────────
// normalizeRerankOutput
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeRerankOutput', () => {
    const sent = ['8D-2', '8D-3'];

    it('đọc đúng output tử tế', () => {
        const out = normalizeRerankOutput(
            { queryAnalysis: 'tool wear on a milled flange', rankings: [
                { notificationId: '8D-2', analysis: 'same worn insert, same flange', score: 85, reason: 'same worn tool mechanism' },
                { notificationId: '8D-3', analysis: 'material porosity, not tool wear', score: 20, reason: 'unrelated cause' },
            ] },
            sent,
        );
        expect(out.get('8D-2')).toEqual({
            score: 85, reason: 'same worn tool mechanism', analysis: 'same worn insert, same flange',
        });
        expect(out.get('8D-3')).toEqual({
            score: 20, reason: 'unrelated cause', analysis: 'material porosity, not tool wear',
        });
    });

    it('BỎ id lạ — model không được thêm case vào danh sách', () => {
        const out = normalizeRerankOutput(
            { rankings: [{ notificationId: '8D-999', score: 99, reason: 'x' }] },
            sent,
        );
        expect(out.size).toBe(0);
    });

    it('clamp score ngoài [0,100], bỏ dòng score không phải số', () => {
        const out = normalizeRerankOutput(
            { rankings: [
                { notificationId: '8D-2', score: 150, reason: 'a' },
                { notificationId: '8D-3', score: 'abc', reason: 'b' },
            ] },
            sent,
        );
        expect(out.get('8D-2')?.score).toBe(100);
        expect(out.has('8D-3')).toBe(false);
    });

    it('trùng id giữ lượt đầu; output không phải mảng ⇒ map rỗng', () => {
        const dup = normalizeRerankOutput(
            { rankings: [
                { notificationId: '8D-2', score: 70, reason: 'first' },
                { notificationId: '8D-2', score: 10, reason: 'second' },
            ] },
            sent,
        );
        expect(dup.get('8D-2')?.score).toBe(70);

        expect(normalizeRerankOutput({ rankings: 'not-an-array' }, sent).size).toBe(0);
        expect(normalizeRerankOutput(null, sent).size).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// scoreCase với tiêu chí rerank (tầng 1 giữ chỗ)
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreCase + rerank criterion', () => {
    it('tầng 1: dòng none 0 điểm, trần VẪN gồm weight của rerank', () => {
        const result = scoreCase(CASE_A, CASE_B, [WORK_CENTER, RERANK]);
        expect(result.score).toBe(4);          // chỉ work center ăn điểm
        expect(result.maxScore).toBe(7);       // 4 + 3 — rerank bật thì trần gồm nó
        const row = result.breakdown.find((b) => b.criterionKey === 'rerank');
        expect(row).toMatchObject({ level: 'none', points: 0, maxPoints: 3 });
    });

    it('rerank tắt ⇒ không dòng, không vào trần — hành vi cũ nguyên vẹn', () => {
        const result = scoreCase(CASE_A, CASE_B, [WORK_CENTER, { ...RERANK, enabled: false }]);
        expect(result.maxScore).toBe(4);
        expect(result.breakdown.find((b) => b.criterionKey === 'rerank')).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyRerank (toán trộn điểm)
// ─────────────────────────────────────────────────────────────────────────────

function stage1(): { notificationId: string; result: ScoreResult } {
    return { notificationId: '8D-2', result: scoreCase(CASE_A, CASE_B, [WORK_CENTER, RERANK]) };
}

describe('applyRerank', () => {
    it('đạt sàn: điểm = weight × score/100, cộng vào tổng, lý do vào matchedOn', () => {
        const item = stage1();
        const verdicts = new Map<string, RerankVerdict>([
            ['8D-2', { score: 80, reason: 'same mechanism', analysis: 'both show clamp slip on a thin flange' }],
        ]);
        applyRerank([item], RERANK, verdicts);

        const row = item.result.breakdown.find((b) => b.criterionKey === 'rerank')!;
        expect(row.points).toBe(2.4);                       // 3 × 0.8
        expect(row.level).toBe('exact');
        expect(row.matchedOn).toContain('80/100');
        expect(row.matchedOn).toContain('same mechanism');
        expect(item.result.score).toBe(6.4);                // 4 + 2.4
        expect(item.result.maxScore).toBe(7);               // trần không đổi
    });

    it('dưới sàn: 0 điểm, matchedOn nói rõ dưới sàn', () => {
        const item = stage1();
        applyRerank([item], RERANK, new Map([['8D-2', { score: 30, reason: 'weak', analysis: 'different mechanism' }]]));
        const row = item.result.breakdown.find((b) => b.criterionKey === 'rerank')!;
        expect(row.points).toBe(0);
        expect(item.result.score).toBe(4);
        expect(row.matchedOn).toContain('30/100 < floor 50');
    });

    it('model bỏ sót id: giữ none, matchedOn ghi "not scored"', () => {
        const item = stage1();
        applyRerank([item], RERANK, new Map());             // lượt gọi OK nhưng thiếu id này
        const row = item.result.breakdown.find((b) => b.criterionKey === 'rerank')!;
        expect(row.points).toBe(0);
        expect(row.matchedOn).toBe('not scored by reranker');
    });

    it('cả lượt re-rank hỏng (verdicts null): giữ tầng 1, matchedOn ghi unavailable', () => {
        const item = stage1();
        applyRerank([item], RERANK, null);
        const row = item.result.breakdown.find((b) => b.criterionKey === 'rerank')!;
        expect(row.points).toBe(0);
        expect(item.result.score).toBe(4);
        expect(row.matchedOn).toBe('rerank unavailable');
    });
});

describe('normalizeRerankOutput — phần chain-of-thought', () => {
    it('giữ lập luận của model, cắt ở 400 ký tự', () => {
        const long = 'x'.repeat(500);
        const out = normalizeRerankOutput(
            { queryAnalysis: 'clamp slip', rankings: [{ notificationId: 'A', analysis: long, score: 70, reason: 'r' }] },
            ['A'],
        );
        expect(out.get('A')!.analysis).toHaveLength(400);
    });

    /**
     * Output của bản prompt cũ (chưa có CoT) vẫn phải đọc được — nếu không thì
     * một lần đổi prompt sẽ làm mọi lượt re-rank đang chạy dở trở thành vô giá trị.
     */
    it('thiếu analysis ⇒ rỗng, KHÔNG loại dòng', () => {
        const out = normalizeRerankOutput({ rankings: [{ notificationId: 'A', score: 70, reason: 'r' }] }, ['A']);
        expect(out.get('A')).toEqual({ score: 70, reason: 'r', analysis: '' });
    });
});
