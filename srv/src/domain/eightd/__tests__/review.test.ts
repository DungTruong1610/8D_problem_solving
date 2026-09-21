/**
 * Cổng đóng case D8 và ánh xạ quyết định duyệt.
 *
 * Luật này quyết định một case 8D có được đóng hay không, nên nó phải đúng ở cả
 * những trường hợp xấu — report hỏng giữa chừng, hàng cũ chưa có cột duyệt, mã
 * bước lạ. Đóng nhầm một case chưa duyệt xong là lỗi nhìn thấy được trong audit.
 */

import {
    CLOSURE_PREREQUISITES,
    evaluateClosureGate,
    isReviewDecision,
    normalizeStatus,
    statusForDecision,
} from '../review';

const all = (status: string) => CLOSURE_PREREQUISITES.map((code) => ({ code, reviewStatus: status }));

describe('evaluateClosureGate', () => {
    it('duyệt đủ D1-D7 thì mở cổng', () => {
        const gate = evaluateClosureGate(all('Approved'));
        expect(gate.canClose).toBe(true);
        expect(gate.approved).toBe(7);
        expect(gate.blocking).toEqual([]);
    });

    it('D8 KHÔNG nằm trong điều kiện — tự nó không chặn chính nó', () => {
        const gate = evaluateClosureGate([...all('Approved'), { code: 'D8', reviewStatus: 'Draft' }]);
        expect(gate.canClose).toBe(true);
    });

    it('một bước chưa duyệt là chặn, và nêu đúng tên bước', () => {
        const rows = all('Approved').map((d) => (d.code === 'D4' ? { ...d, reviewStatus: 'Draft' } : d));
        const gate = evaluateClosureGate(rows);
        expect(gate.canClose).toBe(false);
        expect(gate.blocking).toEqual(['D4']);
        expect(gate.approved).toBe(6);
        expect(gate.reason).toContain('D4');
    });

    it('ChangeRequested cũng là chặn, không phải "gần xong"', () => {
        const rows = all('Approved').map((d) => (d.code === 'D2' ? { ...d, reviewStatus: 'ChangeRequested' } : d));
        expect(evaluateClosureGate(rows).canClose).toBe(false);
    });

    it('bước THIẾU HẲN cũng chặn — report hỏng giữa chừng không được lọt cổng', () => {
        // Đây là chỗ dễ sai nhất: chỉ đếm hàng có mặt thì một report sinh được
        // 5 discipline sẽ "duyệt đủ 5/5" và mở cổng.
        const partial = all('Approved').filter((d) => d.code !== 'D6' && d.code !== 'D7');
        const gate = evaluateClosureGate(partial);
        expect(gate.canClose).toBe(false);
        expect(gate.blocking).toEqual(['D6', 'D7']);
    });

    it('danh sách rỗng chặn cả 7 bước, không phải "không có gì để chặn"', () => {
        const gate = evaluateClosureGate([]);
        expect(gate.canClose).toBe(false);
        expect(gate.blocking).toEqual([...CLOSURE_PREREQUISITES]);
        expect(gate.approved).toBe(0);
    });

    it('giữ đúng thứ tự D1..D7 khi liệt kê bước chặn', () => {
        const gate = evaluateClosureGate([
            { code: 'D7', reviewStatus: 'Draft' },
            { code: 'D1', reviewStatus: 'Draft' },
            { code: 'D4', reviewStatus: 'Draft' },
        ]);
        expect(gate.blocking).toEqual(['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']);
    });
});

describe('normalizeStatus', () => {
    it('hàng cũ chưa có cột duyệt được coi là Draft, không phải đã duyệt', () => {
        // Cột reviewStatus thêm sau, nên mọi report phân tích trước đó đọc lên là
        // null. Mặc định sai chiều ở đây là mở cổng cho toàn bộ dữ liệu cũ.
        for (const v of [null, undefined, '', 'Approved ', 'approved', 'nonsense', 42]) {
            expect(normalizeStatus(v)).toBe('Draft');
        }
        expect(normalizeStatus('Approved')).toBe('Approved');
    });
});

describe('statusForDecision', () => {
    it('ánh xạ đủ ba quyết định', () => {
        expect(statusForDecision('approve')).toBe('Approved');
        expect(statusForDecision('request-change')).toBe('ChangeRequested');
        expect(statusForDecision('reopen')).toBe('Draft');
    });

    it('chỉ nhận đúng ba giá trị đó', () => {
        for (const v of ['reject', 'APPROVE', '', null, undefined]) {
            expect(isReviewDecision(v)).toBe(false);
        }
    });
});
