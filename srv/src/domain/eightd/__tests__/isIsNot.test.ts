import { computeIsIsNot } from '../isIsNot';
import type { HistoricalInspectionLot } from '../types';

describe('computeIsIsNot', () => {
    const sampleLots: HistoricalInspectionLot[] = [
        { lotId: 'LOT-01', materialId: 'MAT-10247', characteristic: 'Flange burr height', equipment: 'WC-MILL-07-F1', conforming: false },
        { lotId: 'LOT-02', materialId: 'MAT-10247', characteristic: 'Flange burr height', equipment: 'WC-MILL-07-F1', conforming: false },
        { lotId: 'LOT-03', materialId: 'MAT-10247', characteristic: 'Flange burr height', equipment: 'WC-MILL-07-F1', conforming: false },
        { lotId: 'LOT-04', materialId: 'MAT-10247', characteristic: 'Flange burr height', equipment: 'WC-MILL-07-F2', conforming: true },
        { lotId: 'LOT-05', materialId: 'MAT-10247', characteristic: 'Flange burr height', equipment: 'WC-MILL-07-F2', conforming: true },
        { lotId: 'LOT-06', materialId: 'MAT-10247', characteristic: 'Flange burr height', equipment: 'WC-MILL-07-F2', conforming: true },
    ];

    it('tính toán chính xác IS và IS NOT khi có độ tương phản rõ rệt (>= 25%)', () => {
        const res = computeIsIsNot(sampleLots, 'Flange burr height');
        expect(res.applicable).toBe(true);
        expect(res.is?.[0]).toContain('WC-MILL-07-F1');
        expect(res.is?.[0]).toContain('100% non-conforming');
        expect(res.isNot?.[0]).toContain('WC-MILL-07-F2');
        expect(res.isNot?.[0]).toContain('0% non-conforming');
        expect(res.isIsNotBasis).toContain('Flange burr height');
        expect(res.lotIds).toEqual(['LOT-01', 'LOT-02', 'LOT-03', 'LOT-04', 'LOT-05', 'LOT-06']);
    });

    it('trả về applicable=false khi không có đặc tính đo lường', () => {
        const res = computeIsIsNot(sampleLots, '');
        expect(res.applicable).toBe(false);
        expect(res.reason).toContain('Not applicable — this defect has no measurable characteristic.');
    });

    it('trả về applicable=false khi không có dữ liệu lô lịch sử', () => {
        const res = computeIsIsNot([], 'Flange burr height');
        expect(res.applicable).toBe(false);
        expect(res.reason).toContain('Cannot compare — there is no measurement history for this part.');
    });

    it('trả về applicable=false khi chỉ có 1 nhóm thiết bị', () => {
        const singleGroupLots: HistoricalInspectionLot[] = [
            { lotId: 'LOT-01', materialId: 'MAT-10247', characteristic: 'Flange burr height', equipment: 'WC-MILL-07-F1', conforming: false },
            { lotId: 'LOT-02', materialId: 'MAT-10247', characteristic: 'Flange burr height', equipment: 'WC-MILL-07-F1', conforming: true },
        ];
        const res = computeIsIsNot(singleGroupLots, 'Flange burr height');
        expect(res.applicable).toBe(false);
        expect(res.reason).toContain('insufficient inspection lots across different equipment groups');
    });

    it('trả về applicable=false khi độ tương phản giữa các nhóm quá thấp (< 25%)', () => {
        const lowContrastLots: HistoricalInspectionLot[] = [
            { lotId: 'LOT-01', materialId: 'MAT-10247', characteristic: 'Flange burr height', equipment: 'EQ-1', conforming: false },
            { lotId: 'LOT-02', materialId: 'MAT-10247', characteristic: 'Flange burr height', equipment: 'EQ-1', conforming: true },
            { lotId: 'LOT-03', materialId: 'MAT-10247', characteristic: 'Flange burr height', equipment: 'EQ-2', conforming: false },
            { lotId: 'LOT-04', materialId: 'MAT-10247', characteristic: 'Flange burr height', equipment: 'EQ-2', conforming: true },
        ];
        const res = computeIsIsNot(lowContrastLots, 'Flange burr height');
        expect(res.applicable).toBe(false);
        expect(res.reason).toContain('No significant contrast across equipment groups');
    });
});
