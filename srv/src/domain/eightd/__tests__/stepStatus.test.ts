/**
 * Trạng thái bước trên UI phải suy từ ĐÚNG đồ thị mà backend dùng.
 *
 * Hai bảng phụ thuộc nằm ở hai nơi — `srv/.../stepGraph.ts` cho việc điều phối,
 * `shared/step-status.ts` cho việc hiển thị. Hai bản sao thì sớm muộn cũng lệch,
 * và triệu chứng lúc đó rất khó lần: UI báo một bước "đang sinh" trong khi
 * backend còn chưa xếp nó vào đợt nào. Test đầu tiên ở đây tồn tại để chuyện đó
 * không xảy ra âm thầm.
 */

import { STEP_BLOCKED_BY, STEP_ORDER, blockedBy, stepProgress } from '../../../../../shared/step-status';
import { STEP_DEPENDENCIES } from '../stepGraph';
import { DISCIPLINE_CODES } from '../types';

describe('bảng phụ thuộc của FE phải khớp backend', () => {
    it('cùng tập mã bước', () => {
        expect([...STEP_ORDER]).toEqual([...DISCIPLINE_CODES]);
    });

    it.each([...DISCIPLINE_CODES])('%s khai cùng một danh sách ở cả hai nơi', (code) => {
        expect([...STEP_BLOCKED_BY[code]].sort()).toEqual([...STEP_DEPENDENCIES[code]].sort());
    });
});

describe('stepProgress', () => {
    it('bước đã có dữ liệu là ready, kể cả khi vẫn đang phân tích', () => {
        expect(stepProgress('D1', ['D1'], true)).toBe('ready');
        expect(stepProgress('D1', ['D1'], false)).toBe('ready');
    });

    it('không phân tích và chưa có dữ liệu thì là pending, không phải waiting', () => {
        expect(stepProgress('D4', [], false)).toBe('pending');
    });

    it('D1 và D2 sinh ngay từ đầu — không chờ ai', () => {
        expect(stepProgress('D1', [], true)).toBe('generating');
        expect(stepProgress('D2', [], true)).toBe('generating');
    });

    it('D4 CHỜ khi D2 chưa xong, và chuyển sang generating ngay khi D2 xong', () => {
        expect(stepProgress('D4', ['D1'], true)).toBe('waiting');
        expect(stepProgress('D4', ['D1', 'D2'], true)).toBe('generating');
    });

    it('D8 vẫn chờ dù đã có sáu bước — thiếu một bước phụ thuộc là vẫn chờ', () => {
        expect(stepProgress('D8', ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'], true)).toBe('waiting');
        expect(stepProgress('D8', ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'], true)).toBe('generating');
    });

    it('không bao giờ có chuyện cả tám bước cùng generating — đó là bản sửa cũ nói dối', () => {
        const live = STEP_ORDER.filter((code) => stepProgress(code, [], true) === 'generating');
        expect(live).toEqual(['D1', 'D2']);
    });

    it('nhận Set cũng như mảng — bên gọi không phải nhớ dùng kiểu nào', () => {
        expect(stepProgress('D3', new Set(['D2']), true)).toBe('generating');
        expect(stepProgress('D3', ['D2'], true)).toBe('generating');
    });
});

describe('blockedBy', () => {
    it('nêu đúng bước còn thiếu, để UI nói được đang chờ ai', () => {
        expect(blockedBy('D5', ['D3'])).toEqual(['D4']);
    });

    it('rỗng khi đã sẵn sàng', () => {
        expect(blockedBy('D5', ['D3', 'D4'])).toEqual([]);
        expect(blockedBy('D1', [])).toEqual([]);
    });
});
