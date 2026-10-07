/**
 * Nhãn engine tìm tiền lệ, và việc nó đi qua được lưu-đọc.
 *
 * Thứ cần giữ: màn hình phải nói đúng engine đã chạy, phân biệt "chọn chấm
 * điểm" với "rơi về chấm điểm vì graph / embedding không có", và dữ liệu cũ
 * không có trường này thì nói "không biết" chứ không đoán.
 */

import { engineLabel, makeEngineInfo, readEngineInfo } from '../../../../../shared/retrieval-engine';
import { NO_PRECEDENT_REASON, normalizePrecedents } from '../../../../../shared/precedent-shape';

describe('engineLabel', () => {
    it('graph', () => {
        expect(engineLabel({ engine: 'graph', semantic: 'n/a', fallbackReason: null })).toBe('Graph retrieval');
    });

    it('chấm điểm theo cấu hình — không phải dự phòng', () => {
        expect(engineLabel({ engine: 'scoring', semantic: 'not-configured', fallbackReason: null })).toBe('Attribute scoring');
        expect(engineLabel({ engine: 'scoring', semantic: 'used', fallbackReason: null })).toBe('Attribute + semantic scoring');
    });

    it('không nhúng được thì nói rõ là dự phòng, semantic không có', () => {
        expect(engineLabel({ engine: 'scoring', semantic: 'unavailable', fallbackReason: 'no JINA_API_KEY' }))
            .toBe('Scoring fallback — semantic search unavailable');
    });

    it('graph không chạy được thì nói rõ là dự phòng từ graph', () => {
        expect(engineLabel({ engine: 'scoring', semantic: 'used', fallbackReason: 'Graph retrieval failed: x.' }))
            .toBe('Scoring fallback — graph unavailable');
    });

    it('không chạy gì', () => {
        expect(engineLabel({ engine: 'none', semantic: 'n/a', fallbackReason: 'Precedent search failed.' }))
            .toBe('Precedent search did not run');
    });
});

describe('readEngineInfo', () => {
    it('đọc lại đúng thứ đã ghi', () => {
        const info = makeEngineInfo({ engine: 'scoring', semantic: 'unavailable', fallbackReason: 'x' });
        expect(readEngineInfo(JSON.parse(JSON.stringify(info)))).toEqual(info);
    });

    it('dữ liệu cũ / rác thì null — không đoán', () => {
        expect(readEngineInfo(undefined)).toBeNull();
        expect(readEngineInfo({ engine: 'quantum', semantic: 'used' })).toBeNull();
    });
});

describe('normalizePrecedents — engine và lý do cụ thể', () => {
    it('mang engine theo', () => {
        const engine = makeEngineInfo({ engine: 'graph', semantic: 'n/a', fallbackReason: null });
        expect(normalizePrecedents({ union: [], byStep: {}, engine }).engine).toEqual(engine);
    });

    it('không có engine (dữ liệu cũ) thì null', () => {
        expect(normalizePrecedents({ union: [], byStep: {} }).engine).toBeNull();
    });

    it('rỗng thì dùng lý do CỦA ENGINE, ưu tiên D4, thay vì câu chung', () => {
        const out = normalizePrecedents({
            union: [],
            byStep: {
                D1: { precedents: [], reason: 'D1 reason' },
                D4: { precedents: [], reason: 'No past case scores at least 3 of 16 (21 candidates).' },
            },
        });
        expect(out.reason).toBe('No past case scores at least 3 of 16 (21 candidates).');
    });

    it('không bước nào có lý do thì mới dùng câu chung', () => {
        expect(normalizePrecedents({ union: [], byStep: { D1: { precedents: [] } } }).reason).toBe(NO_PRECEDENT_REASON);
    });
});
