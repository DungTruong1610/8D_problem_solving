/**
 * Test tiêu chí ngữ nghĩa (cosine).
 *
 * ── Vì sao vector dùng ở đây là vector TỰ CHẾ ──
 * Sinh vector thật cần gọi AI Core: chậm, tốn tiền, và kết quả đổi theo phiên
 * bản model — ba thứ không được phép có trong test đơn vị. Cái cần khoá lại ở
 * đây là CÔNG THỨC: cosine tính đúng chưa, sàn có chặn không, model khác nhau có
 * bị từ chối không, và một case không trùng khoá nào có tự vượt ngưỡng được không.
 *
 * Phần "vector thật có tìm ra case đúng không" được kiểm bằng
 * `scripts/measure-similarity.mjs` trên kho thật — nó là câu hỏi về DỮ LIỆU, không
 * phải về công thức.
 */

import {
    cosineSimilarity,
    parseEmbedding,
    scoreCase,
    explainScore,
    type Criterion,
    type ScorableCase,
} from '../scoring';
import { DEFAULT_CRITERIA } from '../defaults';

const CRITERIA: Criterion[] = DEFAULT_CRITERIA.map((c) => ({ ...c }));
const SEMANTIC = CRITERIA.find((c) => c.criterionKey === 'semantic')!;
const MODEL = 'text-embedding-3-small';

/**
 * Vector 8 chiều hợp thành một góc cho trước với vector đơn vị đầu tiên.
 * Nhờ vậy cosine giữa hai vector là con số ta CHỌN, không phải con số phải đoán.
 */
function vectorAtCosine(target: number): number[] {
    const v = [target, Math.sqrt(Math.max(0, 1 - target * target)), 0, 0, 0, 0, 0, 0];
    return v;
}
const BASE = [1, 0, 0, 0, 0, 0, 0, 0];

const caseWith = (over: Partial<ScorableCase>): ScorableCase => ({
    notificationId: '8D-X',
    workCenterId: null,
    defectCode: null,
    defectText: null,
    materialId: null,
    materialFamily: null,
    embeddingModel: MODEL,
    ...over,
});

// ─────────────────────────────────────────────────────────────────────────────

describe('parseEmbedding', () => {
    it('đọc được chuỗi JSON từ DB', () => {
        expect(parseEmbedding('[1,2,3]')).toEqual([1, 2, 3]);
    });

    it('đọc được mảng truyền thẳng', () => {
        expect(parseEmbedding([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it.each([null, undefined, '', '   ', 'không phải json', '[]', '{}'])(
        '%s → null', (v) => expect(parseEmbedding(v)).toBeNull(),
    );
});

describe('cosineSimilarity', () => {
    it('hai vector trùng nhau → 1', () => {
        expect(cosineSimilarity([1, 2, 3], [1, 2, 3])!).toBeCloseTo(1, 6);
    });

    it('hai vector vuông góc → 0', () => {
        expect(cosineSimilarity([1, 0], [0, 1])!).toBeCloseTo(0, 6);
    });

    it('không phụ thuộc độ dài vector — tự chuẩn hoá', () => {
        // Bẫy số ② trong tài liệu thiết kế: đừng tin API đã chuẩn hoá sẵn.
        expect(cosineSimilarity([3, 0], [7, 0])!).toBeCloseTo(1, 6);
    });

    it('dựng được vector có cosine cho trước — nền tảng của các test dưới', () => {
        expect(cosineSimilarity(BASE, vectorAtCosine(0.75))!).toBeCloseTo(0.75, 6);
    });

    it('thiếu vector một bên → null, KHÔNG phải 0', () => {
        // 0 nghĩa là "đã so và không giống". null nghĩa là "chưa so được".
        // Trả 0 sẽ che mất việc kho chưa được nhúng.
        expect(cosineSimilarity(null, [1, 0])).toBeNull();
        expect(cosineSimilarity([1, 0], '')).toBeNull();
    });

    it('khác số chiều → null', () => {
        expect(cosineSimilarity([1, 0], [1, 0, 0])).toBeNull();
    });

    it('khác MODEL nhúng → null, dù cùng số chiều', () => {
        // Bẫy số ①: vector của hai model không nằm chung một không gian. So
        // chúng ra một con số trông hợp lý nhưng vô nghĩa.
        expect(cosineSimilarity([1, 0], [1, 0], 'text-embedding-3-small', 'gemini-embedding')).toBeNull();
    });

    it('vector toàn số 0 → null', () => {
        expect(cosineSimilarity([0, 0], [1, 0])).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('scoreCase — tiêu chí ngữ nghĩa', () => {
    const score = (cos: number, over: Partial<ScorableCase> = {}) =>
        scoreCase(
            caseWith({ embedding: BASE }),
            caseWith({ notificationId: '8D-Y', embedding: vectorAtCosine(cos), ...over }),
            CRITERIA,
        );

    it('điểm = trọng số × cosine', () => {
        // 5 × 0.80 = 4.0
        const r = score(0.8);
        expect(r.breakdown.find((b) => b.criterionKey === 'semantic')!.points).toBe(4);
    });

    it('dưới sàn → 0 điểm, và nói rõ là dưới sàn', () => {
        const hit = score(0.60).breakdown.find((b) => b.criterionKey === 'semantic')!;
        expect(hit.points).toBe(0);
        expect(hit.level).toBe('none');
        expect(hit.matchedOn).toContain('0.600');
        expect(hit.matchedOn).toContain(`< ${SEMANTIC.minSimilarity}`);
    });

    it('ngay tại sàn thì tính', () => {
        expect(score(Number(SEMANTIC.minSimilarity)).breakdown
            .find((b) => b.criterionKey === 'semantic')!.points).toBeGreaterThan(0);
    });

    it('chưa nhúng → matchedOn là null, phân biệt với "đã so nhưng không đủ gần"', () => {
        const r = scoreCase(
            caseWith({ embedding: BASE }),
            caseWith({ notificationId: '8D-Y', embedding: null }),
            CRITERIA,
        );
        const hit = r.breakdown.find((b) => b.criterionKey === 'semantic')!;
        expect(hit.points).toBe(0);
        expect(hit.matchedOn).toBeNull();
    });

    it('trần điểm tính cả trọng số ngữ nghĩa', () => {
        expect(score(0.9).maxScore).toBe(16);   // 4 + 4 + 3 + 5
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('điều vector làm được mà luật không', () => {
    /**
     * Đây là lý do tồn tại của cả tính năng: hai case KHÔNG trùng work center,
     * KHÔNG trùng mã lỗi, KHÔNG trùng vật tư, KHÔNG chung một từ khoá nào — mà
     * vẫn là cùng một kiểu hỏng, chỉ được viết bằng chữ khác.
     *
     * Trên dữ liệu thật đó là cặp 8D-10048412 ↔ 8D-10048420 (cosine 0.726).
     */
    const open = caseWith({
        notificationId: '8D-10048412',
        workCenterId: 'WC-MILL-07',
        defectCode: 'DEF-0489',
        defectText: 'Flange edge burr above limit',
        materialId: 'MAT-10247',
        materialFamily: 'MG-HOUSING',
        embedding: BASE,
    });
    const other = (cos: number) => caseWith({
        notificationId: '8D-10048420',
        workCenterId: 'WC-BROACH-01',
        defectCode: 'DEF-1610',
        defectText: 'Raised metal ridge at bore mouth',
        materialId: 'MAT-11500',
        materialFamily: 'MG-DRIVE',
        embedding: vectorAtCosine(cos),
    });

    it('ba tiêu chí luật cho ĐÚNG 0 điểm', () => {
        const rulesOnly = CRITERIA.filter((c) => c.criterionKey !== 'semantic');
        expect(scoreCase(open, other(0.726), rulesOnly).score).toBe(0);
    });

    it('thêm ngữ nghĩa thì tự vượt ngưỡng 3', () => {
        const r = scoreCase(open, other(0.726), CRITERIA);
        expect(r.score).toBeCloseTo(3.6, 5);
        expect(r.score).toBeGreaterThanOrEqual(3);
        expect(explainScore(r)).toBe('3.6/16 — Similar description cosine 0.726');
    });

    it('tắt tiêu chí ngữ nghĩa thì case này biến mất khỏi kết quả', () => {
        const off = CRITERIA.map((c) => (c.criterionKey === 'semantic' ? { ...c, enabled: false } : c));
        const r = scoreCase(open, other(0.726), off);
        expect(r.score).toBe(0);
        expect(r.maxScore).toBe(11);
    });

    it('giống về chữ nhưng dưới sàn thì KHÔNG được vớt lên', () => {
        // Nền cosine của văn bản lỗi sản xuất tiếng Anh đã ~0.6 dù chẳng liên
        // quan. Không có sàn thì mọi case đều được cộng điểm và thứ hạng vô nghĩa.
        expect(scoreCase(open, other(0.636), CRITERIA).score).toBe(0);
    });
});
