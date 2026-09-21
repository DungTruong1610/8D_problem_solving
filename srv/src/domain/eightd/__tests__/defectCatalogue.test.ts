/**
 * Catalogue mã lỗi phải phủ trọn kho case.
 *
 * ── Vì sao đáng một bài test riêng ──
 * F4 nay là CỨNG (quyết định Q3): giá trị ngoài catalogue không lưu được. Một mã
 * có thật trong kho mà thiếu trong catalogue không còn là bất tiện — người vận
 * hành gặp đúng lỗi đó sẽ không ghi nhận được, và trên form không có đường vòng.
 *
 * `verifyDefectCatalogueCoverage` kiểm đúng việc này lúc khởi động, nhưng nó chỉ
 * GHI LOG. Log nằm trong file log của server sau khi deploy; bài test này nằm
 * trong CI trước khi deploy. Chỗ chặn phải là chỗ thứ hai.
 *
 * Nguồn đối chiếu là `mock-data/clean` chứ không phải `srv/data/case-library`:
 * bundle được SINH RA từ thư mục đó (`scripts/bundle-library.mjs`), nên đối chiếu
 * với bundle là đối chiếu với một bản sao có thể đã cũ.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DEFECT_CODES, DEFECT_CODE_GROUPS } from '../valueHelpSeeder';

const LIBRARY_DIR = path.resolve(__dirname, '../../../../../mock-data/clean');

/** Mã lỗi xuất hiện trong kho, kèm case đầu tiên mang nó — để báo lỗi chỉ được chỗ. */
function defectCodesInLibrary(): Map<string, string> {
    const found = new Map<string, string>();
    for (const file of fs.readdirSync(LIBRARY_DIR).filter((f) => f.endsWith('.json'))) {
        const raw = fs.readFileSync(path.join(LIBRARY_DIR, file), 'utf8');
        for (const m of raw.matchAll(/"defectCode"\s*:\s*"([^"]+)"/g)) {
            if (!found.has(m[1])) found.set(m[1], file);
        }
    }
    return found;
}

describe('catalogue mã lỗi', () => {
    const library = defectCodesInLibrary();
    const catalogue = new Map(DEFECT_CODES.map((c) => [c.key, c]));

    it('kho case đọc được và không rỗng', () => {
        // Regex không khớp gì cũng cho ra một Map rỗng, và một Map rỗng thì phủ
        // được bởi MỌI catalogue — bài test dưới sẽ xanh mà không kiểm gì cả.
        expect(library.size).toBeGreaterThan(0);
    });

    it('mọi mã lỗi trong kho đều chọn được trên form', () => {
        const uncovered = [...library.entries()]
            .filter(([code]) => !catalogue.has(code))
            .map(([code, file]) => `${code} (${file})`);

        expect(uncovered).toEqual([]);
    });

    it('mỗi mã có đúng một dòng', () => {
        expect(DEFECT_CODES).toHaveLength(catalogue.size);
    });

    it('mỗi mã trỏ vào một nhóm có thật', () => {
        const groups = new Set(DEFECT_CODE_GROUPS.map((g) => g.key));
        const orphans = DEFECT_CODES
            .filter((c) => !groups.has(c.codeGroup))
            .map((c) => `${c.key} → ${c.codeGroup}`);

        expect(orphans).toEqual([]);
    });

    it('mỗi mã mang một mức nghiêm trọng hợp lệ', () => {
        // Ba giá trị này chảy thẳng ra cột Severity của worklist (Phase 3). Một
        // giá trị lạ ở đây thành một ô không lọc được ở đó.
        const allowed = ['Critical', 'Major', 'Minor'];
        const invalid = DEFECT_CODES
            .filter((c) => !allowed.includes(c.defectClass))
            .map((c) => `${c.key} → ${c.defectClass}`);

        expect(invalid).toEqual([]);
    });

    it('mỗi mã có mô tả không rỗng', () => {
        // Mô tả là thứ người vận hành đọc trong ô chọn; mã trần không chọn được.
        const blank = DEFECT_CODES.filter((c) => !c.text?.trim()).map((c) => c.key);
        expect(blank).toEqual([]);
    });
});
