/**
 * Giải đường dẫn nguồn.
 *
 * Đây là thứ đứng sau lời hứa "mọi khẳng định truy được về một fact". Giải sai
 * một cách âm thầm thì UI báo "không tìm thấy bằng chứng" cho đúng những trích
 * dẫn hợp lệ — và người xem sẽ kết luận là AI bịa.
 */

import { resolveEvidencePath, resolveEvidencePaths } from '../../../../../shared/evidence-path';

const CONTEXT = {
    origin: 'Q3 - Internal Defect',
    header: { quantityExtent: '340 units affected', status: 'In Process' },
    product: { materialId: 'MAT-10234', batchId: 'B-48213' },
    fiveWhy: [
        { stepNo: 1, question: 'Why crack?', answer: 'Chamfer undersized' },
        { stepNo: 2, question: 'Why undersized?', answer: 'Die wear', isRootCause: true },
    ],
    ishikawa: [
        { category: 'Machine', finding: 'Forming die wear', isRootCause: true },
        { category: 'Measurement', finding: 'No in-line gauge' },
    ],
    actions: {
        containment: [{ action: 'Quarantine B-48213', status: 'Done' }],
    },
    team: { leader: 'Minh Dinh' },
    gaps: ['No reporter recorded'],
};

describe('resolveEvidencePath', () => {
    it('giải field lồng bằng dấu chấm', () => {
        expect(resolveEvidencePath(CONTEXT, 'header.quantityExtent'))
            .toMatchObject({ found: true, value: '340 units affected' });
    });

    it('giải cả nút, không chỉ lá', () => {
        expect(resolveEvidencePath(CONTEXT, 'team'))
            .toMatchObject({ found: true, value: { leader: 'Minh Dinh' } });
    });

    it('#N đếm từ 1, KHÔNG phải từ 0', () => {
        // Lệch một đơn vị ở đây nghĩa là trích dẫn chỉ sang bằng chứng bên cạnh —
        // sai âm thầm, và nhìn vẫn rất hợp lý.
        expect(resolveEvidencePath(CONTEXT, 'fiveWhy#1'))
            .toMatchObject({ found: true, value: CONTEXT.fiveWhy[0] });
        expect(resolveEvidencePath(CONTEXT, 'fiveWhy#2'))
            .toMatchObject({ found: true, value: CONTEXT.fiveWhy[1] });
    });

    it('#N vượt số phần tử là không tìm thấy, và nói rõ có mấy phần tử', () => {
        const r = resolveEvidencePath(CONTEXT, 'fiveWhy#7');
        expect(r.found).toBe(false);
        expect(r.reason).toContain('2 entries');
    });

    it('#0 không hợp lệ', () => {
        expect(resolveEvidencePath(CONTEXT, 'fiveWhy#0').found).toBe(false);
    });

    it('tên category tra được mảng Ishikawa', () => {
        expect(resolveEvidencePath(CONTEXT, 'ishikawa.Machine'))
            .toMatchObject({ found: true, value: CONTEXT.ishikawa[0] });
    });

    it('tra category không phân biệt hoa thường', () => {
        expect(resolveEvidencePath(CONTEXT, 'ishikawa.measurement').found).toBe(true);
    });

    it('category không có thì báo rõ, không trả bừa phần tử đầu', () => {
        const r = resolveEvidencePath(CONTEXT, 'ishikawa.Method');
        expect(r.found).toBe(false);
        expect(r.reason).toContain('Method');
    });

    it('kết hợp dấu chấm và #N', () => {
        expect(resolveEvidencePath(CONTEXT, 'actions.containment#1'))
            .toMatchObject({ found: true, value: { action: 'Quarantine B-48213', status: 'Done' } });
    });

    it('#N trên thứ không phải mảng là lỗi, không im lặng', () => {
        const r = resolveEvidencePath(CONTEXT, 'team#1');
        expect(r.found).toBe(false);
        expect(r.reason).toContain('not a list');
    });

    it('field không tồn tại báo đúng tên field', () => {
        const r = resolveEvidencePath(CONTEXT, 'product.serialNumber');
        expect(r.found).toBe(false);
        expect(r.reason).toContain('serialNumber');
    });

    it('đường dẫn rỗng hoặc rác không làm vỡ', () => {
        for (const p of ['', '   ']) expect(resolveEvidencePath(CONTEXT, p).found).toBe(false);
        expect(resolveEvidencePath(null, 'header.status').found).toBe(false);
    });

    it('giải nhiều đường dẫn giữ nguyên thứ tự', () => {
        const out = resolveEvidencePaths(CONTEXT, ['origin', 'nope', 'fiveWhy#2']);
        expect(out.map((r) => r.found)).toEqual([true, false, true]);
        expect(out.map((r) => r.path)).toEqual(['origin', 'nope', 'fiveWhy#2']);
    });
});
