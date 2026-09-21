import { DEFAULT_SETTINGS, normalizeSettings } from '../settings';

describe('normalizeSettings', () => {
    it('mặc định là engine graph khi không có dòng cấu hình', () => {
        expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
        expect(DEFAULT_SETTINGS.engine).toBe('graph');
    });

    it('nhận đúng hai giá trị engine, không phân biệt hoa thường', () => {
        expect(normalizeSettings({ engine: 'graph' }).engine).toBe('graph');
        expect(normalizeSettings({ engine: 'GRAPH' }).engine).toBe('graph');
        expect(normalizeSettings({ engine: 'scoring' }).engine).toBe('scoring');
        expect(normalizeSettings({ engine: 'SCORING' }).engine).toBe('scoring');
    });

    /**
     * Mặc định là `graph`. Chỉ khi khai rõ 'scoring' mới rơi về engine cũ.
     * Một giá trị lạ rơi về mặc định `graph`.
     */
    it('giá trị lạ rơi về mặc định graph chứ không ném', () => {
        for (const engine of ['grap', 'Graph engine', '', null, 42, {}]) {
            expect(normalizeSettings({ engine }).engine).toBe('graph');
        }
    });

    it('từ chối maxKeywords không dùng được, giữ mặc định', () => {
        for (const maxKeywords of [0, -5, NaN, 'nhiều', null, undefined]) {
            expect(normalizeSettings({ maxKeywords }).maxKeywords).toBe(DEFAULT_SETTINGS.maxKeywords);
        }
        expect(normalizeSettings({ maxKeywords: 12 }).maxKeywords).toBe(12);
        expect(normalizeSettings({ maxKeywords: 12.9 }).maxKeywords).toBe(12);
    });

    it('fallback chỉ tắt khi khai đúng false', () => {
        expect(normalizeSettings({}).fallbackEnabled).toBe(true);
        expect(normalizeSettings({ fallbackEnabled: null }).fallbackEnabled).toBe(true);
        expect(normalizeSettings({ fallbackEnabled: false }).fallbackEnabled).toBe(false);
    });
});
