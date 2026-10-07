/**
 * Ba loại dừng: dữ kiện chưa xác minh, ngoài phạm vi, vượt thẩm quyền.
 *
 * Mỗi luật có một ca PHẢI dừng và một ca KHÔNG được dừng — hệ thống dừng ở mọi
 * case thì không còn tự chủ, đúng điều đề bài trừ điểm.
 */

import {
    STOP_CONFIG,
    evaluateStops,
    incompleteInputStop,
    isAmbiguousMeasurement,
    notManufacturingStop,
    primaryStopType,
} from '../stops';

/** Một case sạch: có số đo chuẩn, nguyên nhân có số liệu, có tiền lệ, COPQ nhỏ, nội bộ. */
const clean = () => ({
    header: { symptomShortText: 'Flange edge burr above limit' },
    origin: 'Q3 - Internal Defect',
    isCustomerFacing: false,
    product: { workCenterId: 'WC-MILL-07', defectCode: 'DEF-0489' },
    inspections: [{ characteristic: 'Burr height', measuredValue: '0.26mm', specValue: 'max 0.10mm' }],
    ishikawa: [{ category: 'Machine', isRootCause: true, metricValue: '11,800 cycles' }],
    copqEur: 2500,
    actions: { containment: [{ actionText: 'Quarantine 61 units and re-inspect' }], corrective: [], preventive: [{ actionText: 'Add tool-life counter interlock' }] },
});

const ids = (stops: { id: string }[]) => stops.map((s) => s.id);

describe('evaluateStops — không báo lên thừa', () => {
    it('case sạch có tiền lệ thì KHÔNG dừng', () => {
        expect(evaluateStops({ caseContext: clean(), precedents: { count: 2 } })).toEqual([]);
    });

    it('các dòng `gaps` của caseMapper không phải lý do dừng', () => {
        const ctx = { ...clean(), gaps: ['No corrective action recorded — D5 has no source data.', 'No FMEA link'] };
        expect(evaluateStops({ caseContext: ctx, precedents: { count: 1 } })).toEqual([]);
    });

    it('chưa tìm tiền lệ (null) thì không dừng vì điều chưa biết', () => {
        expect(evaluateStops({ caseContext: clean(), precedents: null })).toEqual([]);
    });
});

describe('evaluateStops — 1. dữ kiện chưa xác minh', () => {
    it('không có số đo nào thì dừng và chặn D4', () => {
        const stops = evaluateStops({ caseContext: { ...clean(), inspections: [] } });
        expect(ids(stops)).toEqual(['unverified-facts:no-measurement:D4']);
        expect(stops[0].blocking).toBe(true);
        expect(stops[0].questionForHuman).toMatch(/measured/i);
    });

    it('giá trị đo là văn xuôi có dấu phẩy thập phân thì dừng (TC-02)', () => {
        const ctx = { ...clean(), inspections: [{ characteristic: 'Flange burr height', measuredValue: 'gemessen 0,32mm, Sollwert max 0,10mm' }] };
        const stops = evaluateStops({ caseContext: ctx });
        expect(ids(stops)).toEqual(['unverified-facts:ambiguous-measurement:D4']);
        expect(stops[0].reason).toContain('gemessen 0,32mm');
    });

    it('hồ sơ đổ lỗi không có số liệu trong khi mục khác có số đo lệch thì dừng (TC-03)', () => {
        const ctx = {
            ...clean(),
            ishikawa: [
                { category: 'Man', isRootCause: true, metricValue: null },
                { category: 'Machine', isRootCause: false, metricValue: '0.9mm vs 0.2mm max' },
            ],
        };
        const stops = evaluateStops({ caseContext: ctx });
        expect(ids(stops)).toEqual(['unverified-facts:record-contradicts-evidence:D4']);
        expect(stops[0].reason).toContain('Machine');
    });

    it('hồ sơ và chẩn đoán độc lập nói hai nguyên nhân khác nhau thì dừng', () => {
        const stops = evaluateStops({ caseContext: clean(), recordedRootCause: 'Man', independentRootCause: 'Machine' });
        expect(ids(stops)).toEqual(['unverified-facts:record-contradicts-evidence:D4']);
    });

    it('hồ sơ khớp chẩn đoán độc lập thì không dừng', () => {
        expect(evaluateStops({ caseContext: clean(), recordedRootCause: 'Machine', independentRootCause: 'machine' })).toEqual([]);
    });
});

describe('evaluateStops — 2. ngoài phạm vi', () => {
    it('không có tiền lệ thì dừng, không chặn duyệt, nêu lý do (TC-04)', () => {
        const stops = evaluateStops({ caseContext: clean(), precedents: { count: 0, basis: '0 cases share WC-MILL-07 + DEF-0910' } });
        expect(ids(stops)).toEqual(['outside-scope:no-precedent:D4']);
        expect(stops[0].blocking).toBe(false);
        expect(stops[0].facts).toEqual(['0 cases share WC-MILL-07 + DEF-0910']);
    });

    it('đầu vào không phải lỗi sản xuất', () => {
        const s = notManufacturingStop('Invoice INV-1 is a finance document.');
        expect(s).toMatchObject({ type: 'outside-scope', blocking: true });
    });
});

describe('evaluateStops — 3. vượt thẩm quyền', () => {
    it('COPQ từ ngưỡng trở lên thì chặn D8 chờ Quality Manager', () => {
        const stops = evaluateStops({ caseContext: { ...clean(), copqEur: STOP_CONFIG.copqSignOffEur }, precedents: { count: 1 } });
        expect(ids(stops)).toEqual(['exceeds-authority:copq-sign-off:D8']);
        expect(stops[0].requiredRole).toBe('Quality Manager');
    });

    it('COPQ dưới ngưỡng thì không', () => {
        expect(evaluateStops({ caseContext: { ...clean(), copqEur: STOP_CONFIG.copqSignOffEur - 1 }, precedents: { count: 1 } })).toEqual([]);
    });

    it('khiếu nại khách hàng: báo khách không phải việc của AI', () => {
        const stops = evaluateStops({ caseContext: { ...clean(), isCustomerFacing: true, origin: 'Q1' }, precedents: { count: 1 } });
        expect(ids(stops)).toEqual(['exceeds-authority:customer-notification:D8']);
    });

    it('khoanh vùng có huỷ / thu hồi lô thì chặn D3; cách ly thường thì không', () => {
        const scrap = evaluateStops({ caseContext: clean(), precedents: { count: 1 }, stepActions: { D3: ['Scrap the entire lot B-55901'] } });
        expect(ids(scrap)).toEqual(['exceeds-authority:lot-disposition:D3']);
        expect(evaluateStops({ caseContext: clean(), precedents: { count: 1 }, stepActions: { D3: ['Quarantine 61 units'] } })).toEqual([]);
    });

    it('phòng ngừa đổi SOP/FMEA thì chặn D7 chờ chủ quy trình', () => {
        const stops = evaluateStops({ caseContext: clean(), precedents: { count: 1 }, stepActions: { D7: ['Update FMEA-MILL07-03 severity for tool over-cycling'] } });
        expect(ids(stops)).toEqual(['exceeds-authority:controlled-document-change:D7']);
    });
});

describe('helpers', () => {
    it('isAmbiguousMeasurement', () => {
        expect(isAmbiguousMeasurement('0.26mm')).toBe(false);
        expect(isAmbiguousMeasurement('Class 3')).toBe(false);
        expect(isAmbiguousMeasurement('38 um')).toBe(false);
        expect(isAmbiguousMeasurement('0,32 mm')).toBe(true);
        expect(isAmbiguousMeasurement('roughly about point three two millimetres')).toBe(true);
        expect(isAmbiguousMeasurement('')).toBe(false);
    });

    it('primaryStopType ưu tiên dữ kiện > phạm vi > thẩm quyền', () => {
        const stops = evaluateStops({
            caseContext: { ...clean(), inspections: [], copqEur: 50_000 },
            precedents: { count: 0 },
        });
        expect(primaryStopType(stops)).toBe('unverified-facts');
        expect(primaryStopType([])).toBeNull();
    });

    it('id lần dừng ổn định giữa hai lần tính', () => {
        const a = evaluateStops({ caseContext: { ...clean(), inspections: [] } });
        const b = evaluateStops({ caseContext: { ...clean(), inspections: [] } });
        expect(ids(a)).toEqual(ids(b));
    });

    it('incompleteInputStop liệt kê trường thiếu', () => {
        expect(incompleteInputStop(['notificationId', 'symptomShortText']).reason).toContain('notificationId, symptomShortText');
    });
});
