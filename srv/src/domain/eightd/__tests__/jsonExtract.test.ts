/**
 * Test lớp bóc JSON.
 *
 * Trọng tâm là hành vi KHI HỎNG, vì đó là lúc lớp này tồn tại để làm gì. Đặc
 * biệt: output cụt vì hết token phải ném lỗi kể cả khi JSON tình cờ parse được —
 * một báo cáo thiếu nội dung nhưng trông như thành công là kiểu hỏng tệ nhất.
 */

import {
    assertNotTruncated,
    callAndParse,
    extractJson,
    stripFence,
} from '../jsonExtract';
import { PipelineError } from '../types';

describe('stripFence', () => {
    it('gỡ fence ```json', () => {
        expect(stripFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    });

    it('gỡ fence không ghi ngôn ngữ', () => {
        expect(stripFence('```\n{"a":1}\n```')).toBe('{"a":1}');
    });

    it('bỏ lời dẫn trước khối JSON', () => {
        expect(stripFence('Here is the result:\n{"a":1}')).toBe('{"a":1}');
    });

    it('bỏ lời kết sau khối JSON', () => {
        expect(stripFence('{"a":1}\nHope this helps!')).toBe('{"a":1}');
    });

    it('để nguyên JSON sạch', () => {
        expect(stripFence('{"a":1}')).toBe('{"a":1}');
    });

    it('xử lý được mảng ở cấp cao nhất', () => {
        expect(stripFence('```json\n[1,2,3]\n```')).toBe('[1,2,3]');
    });
});

describe('assertNotTruncated', () => {
    it.each(['length', 'MAX_TOKENS', 'max_tokens'])('ném lỗi khi finishReason = %s', (reason) => {
        expect(() => assertNotTruncated(reason, 'analyzeDefect')).toThrow(PipelineError);
    });

    it('thông báo lỗi chỉ ra chỗ cần sửa', () => {
        // `try/catch` trần sẽ IM LẶNG PASS nếu hàm không ném — đúng cái nó phải
        // bắt. Bọc bằng `toThrow` để không ném là đỏ.
        expect(() => assertNotTruncated('length', 'analyzeDefect')).toThrow(/analyzeDefect/);
        expect(() => assertNotTruncated('length', 'analyzeDefect')).toThrow(/BUDGET/);
    });

    it('kèm số thật của lượt gọi khi được truyền vào', () => {
        // Thiếu số này thì đọc lỗi xong vẫn không phân biệt được "trần đang thấp"
        // với "backend còn chạy code cũ nên trần mới chưa có hiệu lực".
        try {
            assertNotTruncated('length', 'analyzeDefect', {
                model: 'gemini-2.5-flash',
                maxTokens: 16_000,
                thinkingBudget: 0,
                produced: 15_998,
            });
            throw new Error('đáng lẽ phải ném');
        } catch (e: any) {
            expect(e.code).toBe(502);
            expect(e.message).toContain('gemini-2.5-flash');
            expect(e.message).toContain('max_tokens=16000');
            expect(e.message).toContain('thinkingBudget=0');
            expect(e.message).toContain('15998');
        }
    });

    it('thinkingBudget = 0 vẫn được in ra, không bị coi là vắng mặt', () => {
        // `0` là giá trị có ý nghĩa ở đây; lọc bằng falsy sẽ giấu mất nó.
        expect(() => assertNotTruncated('length', 'x', { thinkingBudget: 0 }))
            .toThrow(/thinkingBudget=0/);
    });

    it.each(['stop', 'STOP', undefined])('cho qua khi finishReason = %s', (reason) => {
        expect(() => assertNotTruncated(reason, 'parseData')).not.toThrow();
    });
});

describe('extractJson', () => {
    it('parse được JSON có fence', () => {
        expect(extractJson('```json\n{"ok":true}\n```', 'test')).toEqual({ ok: true });
    });

    it('ném 502 khi model trả chuỗi rỗng', () => {
        // Đây chính là triệu chứng khi thinking ăn hết token budget.
        try {
            extractJson('', 'parseData');
            throw new Error('lẽ ra phải ném lỗi');
        } catch (e: any) {
            expect(e).toBeInstanceOf(PipelineError);
            expect(e.code).toBe(502);
            expect(e.message).toContain('chuỗi rỗng');
        }
    });

    it('ném 502 kèm đoạn xem trước khi JSON hỏng', () => {
        try {
            extractJson('{"rootCauseCategory":', 'analyzeDefect');
            throw new Error('lẽ ra phải ném lỗi');
        } catch (e: any) {
            expect(e.code).toBe(502);
            expect((e.details as any).preview).toContain('rootCauseCategory');
        }
    });

    it('KHÔNG tự vá JSON hỏng', () => {
        // Vá vào sẽ cho ra bản ghi trông như thành công mà nội dung khuyết.
        expect(() => extractJson('{"a":1', 'test')).toThrow(PipelineError);
    });
});

describe('callAndParse', () => {
    it('trả kết quả ngay khi lần đầu thành công', async () => {
        const call = jest.fn().mockResolvedValue({ content: '{"a":1}', finishReason: 'stop' });
        const { value } = await callAndParse<{ a: number }>('test', call);

        expect(value).toEqual({ a: 1 });
        expect(call).toHaveBeenCalledTimes(1);
    });

    it('thử lại một lần và gắn kèm thông báo lỗi cho model', async () => {
        const call = jest.fn()
            .mockResolvedValueOnce({ content: 'not json at all', finishReason: 'stop' })
            .mockResolvedValueOnce({ content: '{"a":2}', finishReason: 'stop' });

        const { value } = await callAndParse<{ a: number }>('test', call);

        expect(value).toEqual({ a: 2 });
        expect(call).toHaveBeenCalledTimes(2);
        expect(call.mock.calls[0][0]).toBeUndefined();
        expect(call.mock.calls[1][0]).toContain('could not be parsed');
    });

    it('chỉ thử lại đúng một lần, không thử mãi', async () => {
        const call = jest.fn().mockResolvedValue({ content: 'rác', finishReason: 'stop' });
        await expect(callAndParse('test', call)).rejects.toThrow(PipelineError);
        expect(call).toHaveBeenCalledTimes(2);
    });

    it('KHÔNG thử lại khi lỗi là cụt token', async () => {
        // Gọi lại sẽ cụt y hệt — phải sửa ngân sách token, không phải thử lại.
        const call = jest.fn().mockResolvedValue({ content: '{"a":', finishReason: 'length' });
        await expect(callAndParse('test', call)).rejects.toThrow(/hết token/);
        expect(call).toHaveBeenCalledTimes(1);
    });
});
