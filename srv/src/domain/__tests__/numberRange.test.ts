/**
 * Test cấp số.
 *
 * Điều cần chứng minh không phải "cộng một" — mà là điều xảy ra khi HAI người
 * cộng một cùng lúc. Nên `tx` ở đây là một bản giả có thể kể lại đúng kịch bản
 * đó: đọc xong rồi bị người khác chen vào trước khi kịp ghi.
 */

import { allocateNumber, formatNumber, numericPart, raiseNumberRange } from '../numberRange';

interface Range { object: string; prefix: string; currentValue: number; width: number }

/**
 * `tx` giả — một bảng NumberRanges trong bộ nhớ.
 *
 * `onBeforeUpdate` là cái móc để dựng cảnh tranh chấp: nó chạy giữa lúc đọc và
 * lúc ghi, đúng khe hở mà compare-and-swap phải bịt.
 */
function makeTx(rows: Range[], onBeforeUpdate?: (attempt: number) => void) {
    let attempt = 0;
    const store = rows.map((r) => ({ ...r }));
    return {
        store,
        async run(q: any) {
            const kind = q.SELECT ? 'SELECT' : 'UPDATE';
            if (kind === 'SELECT') {
                const where = q.SELECT.where;
                const object = whereValue(where, 'object');
                return store.find((r) => r.object === object);
            }
            onBeforeUpdate?.(attempt++);
            const where = q.UPDATE.where;
            const object = whereValue(where, 'object');
            const expected = whereValue(where, 'currentValue');
            const row = store.find((r) => r.object === object);
            if (!row || row.currentValue !== expected) return 0;
            row.currentValue = q.UPDATE.data.currentValue;
            return 1;
        },
    };
}

/** CQN `where` là mảng phẳng: [{ref:['x']}, '=', {val:1}, 'and', ...]. */
function whereValue(where: any[], field: string): any {
    for (let i = 0; i < where.length; i++) {
        if (where[i]?.ref?.[0] === field && where[i + 1] === '=') return where[i + 2]?.val;
    }
    return undefined;
}

describe('formatNumber', () => {
    it.each([
        ['8D-', 10049121, 8, '8D-10049121'],
        ['', 10000109, 10, '0010000109'],
        ['', 7, 4, '0007'],
        [null, 42, 2, '42'],
        // Số dài hơn width thì KHÔNG cắt: cắt là bịa ra một mã khác.
        ['', 123456, 3, '123456'],
    ])('%s + %s (width %s) → %s', (prefix, value, width, expected) => {
        expect(formatNumber(prefix as any, value, width)).toBe(expected);
    });
});

describe('numericPart', () => {
    it.each([
        ['8D-10049121', 10049121],
        ['0010000109', 10000109],
        ['LOT-07', 7],
        ['no digits here', null],
        ['', null],
        [null, null],
    ])('%s → %s', (code, expected) => {
        expect(numericPart(code as any)).toBe(expected);
    });
});

describe('allocateNumber', () => {
    const DEFECT: Range = { object: 'DEFECT', prefix: '8D-', currentValue: 10049120, width: 8 };

    it('cấp số kế tiếp và ghi lại bộ đếm', async () => {
        const tx = makeTx([DEFECT]);
        expect(await allocateNumber(tx, 'DEFECT')).toBe('8D-10049121');
        expect(tx.store[0].currentValue).toBe(10049121);
    });

    it('hai lượt liên tiếp ra hai số khác nhau', async () => {
        const tx = makeTx([DEFECT]);
        const a = await allocateNumber(tx, 'DEFECT');
        const b = await allocateNumber(tx, 'DEFECT');
        expect(a).not.toBe(b);
        expect([a, b]).toEqual(['8D-10049121', '8D-10049122']);
    });

    /**
     * Cảnh tranh chấp thật: ta đọc 10049120, rồi người khác cấp mất số đó trước
     * khi ta kịp ghi. UPDATE của ta khớp 0 dòng — và ta phải đọc lại rồi lấy số
     * kế tiếp, KHÔNG được trả về số đã bị người kia lấy.
     */
    it('người khác giành mất số thì đọc lại và lấy số sau', async () => {
        let store: any;
        const tx = makeTx([DEFECT], (attempt) => {
            if (attempt === 0) store.currentValue = 10049121; // người khác vừa cấp
        });
        store = tx.store[0];
        expect(await allocateNumber(tx, 'DEFECT')).toBe('8D-10049122');
        expect(tx.store[0].currentValue).toBe(10049122);
    });

    it('nhảy qua số đã bị dữ liệu nhập từ ngoài chiếm', async () => {
        const taken = new Set(['8D-10049121', '8D-10049122']);
        const tx = makeTx([DEFECT]);
        const code = await allocateNumber(tx, 'DEFECT', async (c) => taken.has(c));
        expect(code).toBe('8D-10049123');
        // Bộ đếm phải đi theo, nếu không lần cấp sau lại đâm vào đúng chỗ đó.
        expect(tx.store[0].currentValue).toBe(10049123);
    });

    it('nói rõ tên đối tượng khi dải số chưa được khai báo', async () => {
        const tx = makeTx([]);
        await expect(allocateNumber(tx, 'MISSING')).rejects.toThrow(/MISSING/);
    });

    it('bỏ cuộc thay vì lặp vô hạn khi mọi số đều đã bị chiếm', async () => {
        const tx = makeTx([DEFECT]);
        await expect(allocateNumber(tx, 'DEFECT', async () => true)).rejects.toThrow(/attempts/);
    });
});

describe('raiseNumberRange', () => {
    it('kéo bộ đếm lên khi mã nhập từ ngoài vượt qua nó', async () => {
        const tx = makeTx([{ object: 'DEFECT', prefix: '8D-', currentValue: 100, width: 8 }]);
        await raiseNumberRange(tx, 'DEFECT', 500);
        expect(tx.store[0].currentValue).toBe(500);
    });

    it('KHÔNG bao giờ hạ bộ đếm — số đã cấp là đã cấp', async () => {
        const tx = makeTx([{ object: 'DEFECT', prefix: '8D-', currentValue: 500, width: 8 }]);
        await raiseNumberRange(tx, 'DEFECT', 100);
        expect(tx.store[0].currentValue).toBe(500);
    });

    it('im lặng khi dải số không tồn tại — đây là việc phụ, không phải cổng chặn', async () => {
        const tx = makeTx([]);
        await expect(raiseNumberRange(tx, 'MISSING', 5)).resolves.toBeUndefined();
    });
});
