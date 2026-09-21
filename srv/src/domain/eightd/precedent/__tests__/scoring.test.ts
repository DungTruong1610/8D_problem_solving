/**
 * Test công thức chấm điểm tương đồng.
 *
 * ── Vì sao bộ test này quan trọng hơn vẻ ngoài của nó ──
 * Acceptance criteria #2 và #6 của requirement đòi *"recompute the score by hand
 * to confirm the AI's number matches"*. Bộ test này CHÍNH LÀ phép tính tay đó,
 * viết ra một lần thay vì làm lại mỗi lần demo. Mọi con số kỳ vọng dưới đây đều
 * suy được từ công thức 4/4/2/3/1 mà không cần chạy code.
 *
 * Phần cuối chạy trên CHÍNH mock data thật, vì một công thức đúng trên fixture
 * tự chế mà không tìm ra tiền lệ nào trên dữ liệu thật thì vô dụng.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
    explainScore,
    normalizeId,
    scoreCase,
    sharedKeywordCount,
    tokenizeDefectText,
    type Criterion,
    type ScorableCase,
} from '../scoring';
import { DEFAULT_CRITERIA } from '../defaults';
import { extractDeepCase, mapCase } from '../../caseMapper';

/**
 * CHỈ ba tiêu chí theo luật — cố ý bỏ tiêu chí ngữ nghĩa ra.
 *
 * File này khoá lại công thức 4/4/2/3/1 và trần 11 mà acceptance criteria của
 * requirement dựa vào. Tiêu chí ngữ nghĩa cho điểm liên tục và nâng trần lên 16,
 * nên trộn vào đây sẽ làm mọi con số đối chiếu tay mất nghĩa.
 *
 * Phần ngữ nghĩa có file riêng: `semanticScoring.test.ts`.
 */
const CRITERIA: Criterion[] = DEFAULT_CRITERIA
    .filter((c) => c.matchType !== 'cosine')
    .map((c) => ({ ...c }));

const CURRENT: ScorableCase = {
    notificationId: '8D-CURRENT',
    workCenterId: 'WC-MILL-07',
    defectCode: 'DEF-0489',
    defectText: 'Flange edge burr above limit',
    materialId: 'MAT-10247',
    materialFamily: 'MG-HOUSING',
};

const candidate = (over: Partial<ScorableCase>): ScorableCase => ({
    notificationId: '8D-OTHER',
    workCenterId: null,
    defectCode: null,
    defectText: null,
    materialId: null,
    materialFamily: null,
    ...over,
});

// ─────────────────────────────────────────────────────────────────────────────

describe('tokenizeDefectText', () => {
    it('bỏ từ nối và token quá ngắn', () => {
        // 'above' là từ nối, không có token nào dưới 4 ký tự sống sót.
        expect(tokenizeDefectText('Flange edge burr above limit')).toBe('burr edge flange limit');
    });

    it('tất định — cùng input luôn cùng output, không phụ thuộc thứ tự từ', () => {
        expect(tokenizeDefectText('burr flange')).toBe(tokenizeDefectText('Flange, BURR!'));
    });

    it('khử trùng lặp', () => {
        expect(tokenizeDefectText('crack crack hairline')).toBe('crack hairline');
    });

    it('chuỗi rỗng cho ra rỗng, không phải một token rỗng', () => {
        expect(tokenizeDefectText('')).toBe('');
        expect(tokenizeDefectText(null)).toBe('');
    });
});

describe('sharedKeywordCount', () => {
    it('đếm token chung', () => {
        expect(sharedKeywordCount('burr edge flange limit', 'flange porosity sealing')).toBe(1);
    });

    it('rỗng không bao giờ khớp rỗng', () => {
        expect(sharedKeywordCount('', '')).toBe(0);
    });
});

describe('normalizeId', () => {
    it.each([
        ['  MAT-10247 ', 'MAT-10247'],
        ['mat-10247', 'MAT-10247'],
        [null, ''],
    ])('%s → %s', (input, expected) => {
        expect(normalizeId(input)).toBe(expected);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('scoreCase — tính tay theo công thức 4/4/2/3/1', () => {
    it('trùng cả ba khoá = 11/11, đúng trần của requirement', () => {
        const r = scoreCase(CURRENT, candidate({
            workCenterId: 'WC-MILL-07',
            defectCode: 'DEF-0489',
            materialId: 'MAT-10247',
            materialFamily: 'MG-HOUSING',
        }), CRITERIA);

        expect(r.score).toBe(11);
        expect(r.maxScore).toBe(11);
        expect(r.breakdown.every((b) => b.level === 'exact')).toBe(true);
    });

    it('work center + material, defect khác = 7/11 — chính ví dụ trong requirement', () => {
        const r = scoreCase(CURRENT, candidate({
            workCenterId: 'WC-MILL-07',
            defectCode: 'DEF-9999',
            defectText: 'Pocket depth inconsistent across units',
            materialId: 'MAT-10247',
            materialFamily: 'MG-HOUSING',
        }), CRITERIA);

        expect(r.score).toBe(7);   // 4 + 0 + 3
    });

    it('work center + cùng họ vật tư = 5/11', () => {
        const r = scoreCase(CURRENT, candidate({
            workCenterId: 'WC-MILL-07',
            defectCode: 'DEF-1015',
            defectText: 'Port thread depth insufficient',
            materialId: 'MAT-10905',
            materialFamily: 'MG-HOUSING',
        }), CRITERIA);

        expect(r.score).toBe(5);   // 4 + 0 + 1
        expect(r.breakdown.find((b) => b.criterionKey === 'material')?.level).toBe('fallback');
    });

    it('trùng từ khoá + cùng họ = 3/11, vừa đúng ngưỡng', () => {
        const r = scoreCase(CURRENT, candidate({
            workCenterId: 'WC-CAST-03',
            defectCode: 'DEF-0512',
            defectText: 'Porosity at sealing flange face',
            materialId: 'MAT-10318',
            materialFamily: 'MG-HOUSING',
        }), CRITERIA);

        expect(r.score).toBe(3);   // 0 + 2 + 1
        expect(r.breakdown.find((b) => b.criterionKey === 'defectCode')?.matchedOn).toBe('flange');
    });

    it('mức dự phòng KHÔNG cộng dồn với mức chính', () => {
        // Trùng defect code VÀ trùng từ khoá: chỉ được 4, không phải 4+2.
        // Cộng dồn sẽ phá trần 11 và phá luôn mốc 7/11 của requirement.
        const r = scoreCase(CURRENT, candidate({
            defectCode: 'DEF-0489',
            defectText: 'Flange edge burr above limit',
        }), CRITERIA);

        expect(r.score).toBe(4);
    });

    it('không trùng gì = 0', () => {
        const r = scoreCase(CURRENT, candidate({
            workCenterId: 'WC-PAINT-03',
            defectCode: 'DEF-1455',
            defectText: 'Paint gloss out of specification',
            materialId: 'MAT-11388',
            materialFamily: 'MG-TRIM',
        }), CRITERIA);

        expect(r.score).toBe(0);
    });

    it('hai case cùng THIẾU dữ liệu không được cộng điểm cho nhau', () => {
        const blank = candidate({});
        const r = scoreCase(blank, candidate({}), CRITERIA);
        expect(r.score).toBe(0);
    });

    it('khoảng trắng thừa và sai hoa thường vẫn khớp', () => {
        const r = scoreCase(CURRENT, candidate({ materialId: '  mat-10247 ' }), CRITERIA);
        expect(r.score).toBe(3);
    });
});

describe('cấu hình thật sự điều khiển điểm', () => {
    it('đổi trọng số thì điểm đổi theo', () => {
        const heavier = CRITERIA.map((c) =>
            c.criterionKey === 'workCenter' ? { ...c, weight: 10 } : c);

        const cand = candidate({ workCenterId: 'WC-MILL-07' });
        expect(scoreCase(CURRENT, cand, CRITERIA).score).toBe(4);
        expect(scoreCase(CURRENT, cand, heavier).score).toBe(10);
    });

    it('tắt một tiêu chí thì HẠ luôn trần, không chỉ hạ điểm', () => {
        const noMaterial = CRITERIA.map((c) =>
            c.criterionKey === 'material' ? { ...c, enabled: false } : c);

        const r = scoreCase(CURRENT, candidate({
            workCenterId: 'WC-MILL-07',
            materialId: 'MAT-10247',
        }), noMaterial);

        expect(r.score).toBe(4);
        expect(r.maxScore).toBe(8);   // 11 - 3
        expect(r.breakdown).toHaveLength(2);
    });
});

describe('explainScore', () => {
    it('nói rõ điểm đến từ đâu', () => {
        const r = scoreCase(CURRENT, candidate({
            workCenterId: 'WC-MILL-07',
            materialId: 'MAT-10247',
        }), CRITERIA);

        expect(explainScore(r)).toBe('7/11 — Work center WC-MILL-07, Material MAT-10247');
    });

    it('nói thẳng khi không có gì khớp', () => {
        expect(explainScore(scoreCase(CURRENT, candidate({}), CRITERIA)))
            .toBe('0/11 — no matching criteria');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Trên DỮ LIỆU THẬT
//
// Một công thức đúng trên fixture tự chế mà không tìm ra tiền lệ nào trên
// mock-data thì vô dụng — và đó chính là tình trạng trước khi bộ dữ liệu được
// sinh lại có cụm trùng nhau.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_DIR = path.resolve(__dirname, '../../../../../../mock-data/clean');

function scorable(file: string): ScorableCase {
    const raw = JSON.parse(fs.readFileSync(path.join(MOCK_DIR, file), 'utf-8'));
    const ctx = mapCase(raw);
    expect(extractDeepCase(raw)).toBeTruthy();
    return {
        notificationId: ctx.notificationId,
        workCenterId: ctx.product.workCenterId,
        defectCode: ctx.product.defectCode,
        defectText: ctx.product.defectText,
        defectKeywords: tokenizeDefectText(ctx.product.defectText),
        materialId: ctx.product.materialId,
        materialFamily: ctx.product.materialGroup,
    };
}

describe('mock-data thật — case 8D-10048412 phải có tiền lệ', () => {
    const open = () => scorable('case-8D-10048412.json');

    it.each([
        ['case-8D-10048880.json', 7],   // cùng work center + cùng material
        ['case-8D-10048811.json', 5],   // cùng work center + cùng họ vật tư
        ['case-8D-10048577.json', 3],   // trùng từ khoá 'flange' + cùng họ vật tư
    ])('%s → %s điểm', (file, expected) => {
        expect(scoreCase(open(), scorable(file), CRITERIA).score).toBe(expected);
    });

    it('ba mức điểm đi qua ba đường khác nhau — đủ để demo cả công thức', () => {
        const levels = (f: string) =>
            scoreCase(open(), scorable(f), CRITERIA)
                .breakdown.map((b) => `${b.criterionKey}:${b.level}`);

        expect(levels('case-8D-10048880.json')).toEqual(
            ['workCenter:exact', 'defectCode:none', 'material:exact']);
        expect(levels('case-8D-10048811.json')).toEqual(
            ['workCenter:exact', 'defectCode:none', 'material:fallback']);
        expect(levels('case-8D-10048577.json')).toEqual(
            ['workCenter:none', 'defectCode:fallback', 'material:fallback']);
    });

    it('materialGroup thật sự đến được từ mock data — nếu không thì mức +1 chết lặng', () => {
        expect(scorable('case-8D-10048412.json').materialFamily).toBe('MG-HOUSING');
    });
});

describe('mock-data thật — case 8D-10048651 KHÔNG được có tiền lệ', () => {
    it('mọi case khác đều dưới ngưỡng 3', () => {
        const open = scorable('case-8D-10048651.json');
        const others = fs.readdirSync(MOCK_DIR)
            .filter((f) => f.endsWith('.json') && !f.includes('10048651'));

        const best = Math.max(...others.map((f) => scoreCase(open, scorable(f), CRITERIA).score));
        // Đây là điều kiện để acceptance criteria #7 demo được:
        // "no suggestion available" thay vì bịa ra một nhóm.
        expect(best).toBeLessThan(3);
    });
});
