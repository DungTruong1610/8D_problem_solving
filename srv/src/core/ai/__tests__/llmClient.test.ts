/**
 * Chốt hành vi thinking budget với model Claude.
 *
 * Nguồn bất định đã tìm ra bằng đo đạc: CDK cứ thấy `thinkingBudget` là gắn
 * `thinking_budget` vào params cho Claude — KỂ CẢ 0 — rồi xoá `temperature`
 * (Anthropic cấm temperature đi kèm extended thinking). Hệ quả: mọi lượt
 * `stepAnalyze` khai `temperature: 0.2, thinkingBudget: 0` thực chất chạy Haiku
 * ở temperature mặc định 1.0, và D4 lúc ra Ishikawa lúc không.
 *
 * Budget dưới ngưỡng 1024 của Anthropic không bao giờ bật được thinking, nên
 * `effectiveThinkingBudget` phải bỏ nó đi để temperature sống sót.
 */

import { effectiveThinkingBudget } from '../llmClient';

describe('effectiveThinkingBudget', () => {
    it.each([0, 256, 1023])('bỏ budget %s với model Claude — dưới ngưỡng 1024 là no-op chỉ tốn temperature', (budget) => {
        expect(effectiveThinkingBudget('anthropic--claude-4.5-haiku', budget)).toBeUndefined();
        expect(effectiveThinkingBudget('claude-4.5-sonnet', budget)).toBeUndefined();
    });

    it('giữ budget hợp lệ >= 1024 với Claude — khi đó temperature bị bỏ là đúng luật Anthropic', () => {
        expect(effectiveThinkingBudget('anthropic--claude-4.5-haiku', 1024)).toBe(1024);
        expect(effectiveThinkingBudget('anthropic--claude-4.5-haiku', 4096)).toBe(4096);
    });

    it('không đụng model họ khác — với Gemini 2.5, budget 0 có nghĩa thật (tắt thinking)', () => {
        expect(effectiveThinkingBudget('gemini-2.5-flash', 0)).toBe(0);
        expect(effectiveThinkingBudget('gemini-2.5-pro', 256)).toBe(256);
        expect(effectiveThinkingBudget('gpt-4o', 0)).toBe(0);
    });

    it('undefined giữ nguyên undefined', () => {
        expect(effectiveThinkingBudget('anthropic--claude-4.5-haiku', undefined)).toBeUndefined();
    });
});
