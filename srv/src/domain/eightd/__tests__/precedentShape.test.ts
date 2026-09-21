/**
 * Chuẩn hoá kết quả tìm tiền lệ.
 *
 * ── Vì sao bộ test này tồn tại ──
 * Phép biến đổi này đã hỏng hai lần liên tiếp, và cả hai lần đều IM LẶNG: panel
 * hiện "No comparable case found" trên một kết quả có đủ ba tiền lệ. Không lỗi
 * đỏ, không exception — giao diện chỉ nói sai một cách bình tĩnh. Đó là kiểu
 * hỏng duy nhất mà test bắt được còn mắt thường thì không.
 *
 * Hai bug đã xảy ra, mỗi cái một ca dưới đây:
 *   1. đọc `raw.precedents` (khoá của bản cũ) thay vì `raw.union`
 *   2. coi `byStep[code]` là mảng, trong khi nó là object `{ precedents, … }`
 */

import {
    NO_PRECEDENT_REASON,
    normalizePrecedents,
    parseStoredPrecedents,
} from '../../../../../shared/precedent-shape';

/** Đúng hình dạng backend trả về, rút gọn. */
const RESPONSE = {
    union: [
        { notificationId: '8D-10048811', score: 4, maxScore: 16 },
        { notificationId: '8D-10048880', score: 4, maxScore: 16 },
    ],
    byStep: {
        D1: { precedents: [{ notificationId: '8D-10048811', score: 4, maxScore: 16 }], reason: null },
        D2: { precedents: [], reason: 'nothing cleared the threshold' },
    },
    profileByStep: { D1: 'default', D2: 'default' },
};

describe('normalizePrecedents', () => {
    it('đọc `union`, KHÔNG phải khoá `precedents` của bản cũ', () => {
        // Bug #1: backend bỏ khoá `precedents` phẳng khi chuyển sang tìm theo
        // từng bước. Đọc nhầm cho ra undefined -> [] -> panel báo không có gì.
        expect(normalizePrecedents(RESPONSE).precedents).toHaveLength(2);
    });

    it('bóc `precedents` ra khỏi object của từng bước', () => {
        // Bug #2: `byStep[code]` là object `{ precedents, reason }`, không phải
        // mảng. Coi nó là mảng cho ra rỗng ở cả tám bước.
        const out = normalizePrecedents(RESPONSE);
        expect(out.byStep.D1).toHaveLength(1);
        expect(out.byStep.D2).toEqual([]);
    });

    it('maxScore lấy từ tiền lệ đầu tiên, không phải từ gốc response', () => {
        expect(normalizePrecedents(RESPONSE).maxScore).toBe(16);
    });

    it('có tiền lệ thì reason là null', () => {
        expect(normalizePrecedents(RESPONSE).reason).toBeNull();
    });

    it('rỗng thì nêu lý do thay vì để trống', () => {
        const out = normalizePrecedents({ union: [], byStep: {} });
        expect(out.precedents).toEqual([]);
        expect(out.reason).toBe(NO_PRECEDENT_REASON);
        expect(out.maxScore).toBe(0);
    });

    it('đầu vào rác không làm vỡ', () => {
        for (const bad of [null, undefined, 42, 'text', [], { union: 'not-an-array' }]) {
            const out = normalizePrecedents(bad);
            expect(out.precedents).toEqual([]);
            expect(out.byStep).toEqual({});
        }
    });

    it('byStep có phần tử không phải object cũng thành mảng rỗng, không ném lỗi', () => {
        const out = normalizePrecedents({ union: [], byStep: { D1: null, D2: 'x', D3: { precedents: null } } });
        expect(out.byStep).toEqual({ D1: [], D2: [], D3: [] });
    });
});

describe('parseStoredPrecedents', () => {
    it('đọc được bản chụp đã lưu trên report', () => {
        const out = parseStoredPrecedents(JSON.stringify(RESPONSE));
        expect(out?.precedents).toHaveLength(2);
        expect(out?.byStep.D1).toHaveLength(1);
    });

    it('chưa có bản lưu thì trả null để phía gọi tự chấm tại chỗ', () => {
        for (const empty of [null, undefined, '']) {
            expect(parseStoredPrecedents(empty)).toBeNull();
        }
    });

    it('JSON hỏng trả null chứ không ném — panel không được vỡ vì một chuỗi lỗi', () => {
        expect(parseStoredPrecedents('{ this is not json')).toBeNull();
    });
});
