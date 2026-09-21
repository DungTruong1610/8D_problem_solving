/**
 * Test cho `buildDefectPayload`.
 *
 * ── Vì sao đáng test kỹ đến vậy ──
 * Đây là chỗ dịch giữa hai mô hình dữ liệu, và mọi lỗi ở đây đều IM LẶNG: sai
 * tên khoá thì payload vẫn hợp lệ, validator vẫn cho qua, pipeline vẫn ra đủ tám
 * bước D — chỉ là thiếu mất một dữ kiện mà không ai biết. Cách duy nhất bắt được
 * là so từng khoá với hợp đồng payload trong `create-defect/index.tsx`.
 */

import { buildDefectPayload, type DefectRow, type DefectCharacteristicRow } from '../defectPayload';

const baseDefect = (over: Partial<DefectRow> = {}): DefectRow => ({
    defectId: '8D-10048412',
    origin: 'Q3 - Internal Defect',
    status: 'Open',
    symptomShortText: 'Burr on flange edge',
    foundDate: '2026-03-04',
    defectQuantity: 12,
    defectQuantityUom: 'PC',
    referenceNumber: 'PO-77120',
    plant: '1010',
    materialId: 'MAT-4471',
    materialDesc: 'Housing, cast aluminium',
    materialGroup: 'MG-HOUSING',
    batchId: 'B-2026-0033',
    workCenterId: 'WC-CNC-02',
    workCenterDesc: 'CNC milling cell 2',
    defectCodeGroup: 'QM-SURF',
    defectCode: 'SURF-014',
    defectText: 'Burr height above 0.2 mm',
    defectClass: 'Major',
    entryMode: 'during-inspection',
    inspectionLotId: '0000801234',
    reportedBy: 'L. Tran',
    coordinator: 'M. Nguyen',
    department: 'Quality Assurance',
    ...over,
});

describe('buildDefectPayload — hình dạng payload', () => {
    it('giữ đúng bộ khoá cấp cao nhất mà `builtPayloadObject` gửi', () => {
        const p = buildDefectPayload(baseDefect());

        // Danh sách này CHÍNH LÀ hợp đồng. Thêm/bớt khoá ở một trong hai đường
        // vào mà không sửa đường kia là chỗ hỏng mà test này sinh ra để bắt.
        expect(Object.keys(p).sort()).toEqual([
            'actions', 'batch', 'causesIshikawa', 'completionDate', 'costCopq',
            'customerReference', 'defect', 'defectQuantity', 'defectQuantityUom',
            'entryMode', 'fiveWhyChain', 'fmeaLink', 'foundDate', 'inspectionLotId',
            'inspections', 'isIsNot', 'lessonsLearned', 'material', 'notificationId',
            'origin', 'plant', 'quantityExtent', 'referenceNumber', 'responsibility',
            'status', 'symptomShortText', 'teamAssignments', 'teamSize', 'workCenter',
        ]);
    });

    it('chuyển thẳng các trường đầu của case', () => {
        const p = buildDefectPayload(baseDefect());
        expect(p.notificationId).toBe('8D-10048412');
        expect(p.origin).toBe('Q3 - Internal Defect');
        expect(p.symptomShortText).toBe('Burr on flange edge');
        expect(p.foundDate).toBe('2026-03-04');
        expect(p.referenceNumber).toBe('PO-77120');
        expect(p.plant).toBe('1010');
    });

    it('case mới mở luôn ở trạng thái In Process, không lấy trạng thái của bản ghi lỗi', () => {
        // `Defects.status` vẫn là `Open` ngay trước khi 8D mở ra — nếu chép cột
        // đó sang thì model đọc được một case "chưa ai đụng tới" trong khi nó
        // đang được phân tích.
        const p = buildDefectPayload(baseDefect({ status: 'Open' }));
        expect(p.status).toBe('In Process');
    });

    it('bỏ trống những gì mà chính 8D sắp sinh ra', () => {
        const p = buildDefectPayload(baseDefect());
        expect(p.causesIshikawa).toEqual([]);
        expect(p.fiveWhyChain).toEqual([]);
        expect(p.actions).toEqual([]);
        expect(p.teamAssignments).toEqual([]);
        expect(p.isIsNot).toBeNull();
        expect(p.fmeaLink).toBeNull();
        expect(p.costCopq).toBeNull();
        expect(p.lessonsLearned).toBeNull();
        expect(p.completionDate).toBeNull();
        expect(p.quantityExtent).toBeNull();
        expect(p.teamSize).toBeNull();
    });

    it('gom vật tư, lô hàng, mã lỗi và trạm làm việc thành nhóm', () => {
        const p = buildDefectPayload(baseDefect());
        expect(p.material).toEqual({
            materialId: 'MAT-4471',
            description: 'Housing, cast aluminium',
            materialGroup: 'MG-HOUSING',
            plant: '1010',
        });
        expect(p.batch).toEqual({ batchId: 'B-2026-0033', materialId: 'MAT-4471' });
        expect(p.defect).toEqual({
            defectCodeGroup: 'QM-SURF',
            defectCode: 'SURF-014',
            defectText: 'Burr height above 0.2 mm',
            defectClass: 'Major',
        });
        expect(p.workCenter).toEqual({ workCenterId: 'WC-CNC-02', description: 'CNC milling cell 2' });
        expect(p.responsibility).toEqual({
            reportedBy: 'L. Tran',
            coordinator: 'M. Nguyen',
            department: 'Quality Assurance',
        });
    });
});

describe('buildDefectPayload — chuẩn hoá giá trị', () => {
    it('chuỗi rỗng và khoảng trắng thành null, không phải chuỗi rỗng', () => {
        const p = buildDefectPayload(baseDefect({ batchId: '   ', workCenterDesc: '' }));
        expect((p.batch as any).batchId).toBeNull();
        expect((p.workCenter as any).description).toBeNull();
    });

    it('cắt khoảng trắng thừa quanh giá trị', () => {
        const p = buildDefectPayload(baseDefect({ materialId: '  MAT-4471  ' }));
        expect((p.material as any).materialId).toBe('MAT-4471');
    });

    it('symptomShortText thiếu thì là chuỗi rỗng — validator cần thấy trường này', () => {
        const p = buildDefectPayload(baseDefect({ symptomShortText: null }));
        expect(p.symptomShortText).toBe('');
    });

    it('đọc được số lượng lỗi ở cả dạng số lẫn chuỗi', () => {
        expect(buildDefectPayload(baseDefect({ defectQuantity: 12 })).defectQuantity).toBe(12);
        expect(buildDefectPayload(baseDefect({ defectQuantity: '12.5' })).defectQuantity).toBe(12.5);
        expect(buildDefectPayload(baseDefect({ defectQuantity: '12,5' })).defectQuantity).toBe(12.5);
        expect(buildDefectPayload(baseDefect({ defectQuantity: null })).defectQuantity).toBeNull();
        expect(buildDefectPayload(baseDefect({ defectQuantity: 'n/a' })).defectQuantity).toBeNull();
    });

    it('không có nguồn gốc thì mặc định là lỗi nội bộ', () => {
        const p = buildDefectPayload(baseDefect({ origin: null }));
        expect(p.origin).toBe('Q3 - Internal Defect');
    });
});

describe('buildDefectPayload — lô kiểm tra', () => {
    it('giữ số lô khi lỗi được phát hiện trong lúc kiểm tra', () => {
        const p = buildDefectPayload(baseDefect());
        expect(p.entryMode).toBe('during-inspection');
        expect(p.inspectionLotId).toBe('0000801234');
    });

    it('bỏ số lô khi lỗi được ghi ngoài quy trình kiểm tra', () => {
        const p = buildDefectPayload(baseDefect({
            entryMode: 'outside-inspection',
            inspectionLotId: '0000801234',
        }));
        expect(p.inspectionLotId).toBeNull();
    });

    it('khiếu nại khách hàng thì KHÔNG bao giờ mang số lô, dù cột còn giữ giá trị cũ', () => {
        // Bản ghi lỗi có thể đã đổi nguồn gốc sau khi lưu, để lại `entryMode`
        // và số lô của lần nhập trước. Q1 xảy ra sau khi hàng đã rời cổng, nên
        // gắn lô vào đó là dựng một mắt xích không tồn tại.
        const p = buildDefectPayload(baseDefect({
            origin: 'Q1 - Customer Complaint',
            entryMode: 'during-inspection',
            inspectionLotId: '0000801234',
        }));
        expect(p.entryMode).toBe('outside-inspection');
        expect(p.inspectionLotId).toBeNull();
    });

    it('không có entryMode thì coi như ngoài quy trình kiểm tra', () => {
        const p = buildDefectPayload(baseDefect({ entryMode: null, inspectionLotId: '0000801234' }));
        expect(p.entryMode).toBe('outside-inspection');
        expect(p.inspectionLotId).toBeNull();
    });
});

describe('buildDefectPayload — ba ô khách hàng', () => {
    it('khiếu nại khách hàng thì lấy đúng giá trị đã nhập', () => {
        const p = buildDefectPayload(baseDefect({
            origin: 'Q1 - Customer Complaint',
            complaintReference: 'CC-99120',
            customerPlantContact: 'K. Weber, Plant 2100',
            slaResponseDue: '48h',
        }));
        expect(p.customerReference).toEqual({
            complaintReference: 'CC-99120',
            customerPlantContact: 'K. Weber, Plant 2100',
            slaResponseDue: '48h',
        });
    });

    it('lỗi nội bộ nhận sentinel N/A chứ không phải null', () => {
        // Để null thì validator báo "thiếu thông tin khách hàng" cho một lỗi
        // vốn không có khách hàng nào. `isDeliberateNA` nhận ra chuỗi này và hạ
        // cờ `applicable` — đó là khác biệt giữa "không áp dụng" và "bỏ sót".
        const p = buildDefectPayload(baseDefect({ origin: 'Q3 - Internal Defect' })).customerReference as any;
        expect(p.complaintReference).toBe('N/A - internal defect, no customer reference');
        expect(p.customerPlantContact).toBe('N/A');
        expect(p.slaResponseDue).toBe('N/A');
    });

    it('lỗi nhà cung cấp nói rõ là lỗi nhà cung cấp', () => {
        const p = buildDefectPayload(baseDefect({ origin: 'Q2 - Supplier Defect' })).customerReference as any;
        expect(p.complaintReference).toBe('N/A - supplier defect, no customer reference');
    });

    it('case khách hàng bỏ trống ô nào thì ô đó là null — KHÔNG che bằng N/A', () => {
        // Với case Q1 thì thiếu thật là thiếu thật, và validator phải nói ra.
        const p = buildDefectPayload(baseDefect({
            origin: 'Q1 - Customer Complaint',
            complaintReference: null,
            customerPlantContact: null,
            slaResponseDue: null,
        })).customerReference as any;
        expect(p.complaintReference).toBeNull();
        expect(p.customerPlantContact).toBeNull();
        expect(p.slaResponseDue).toBeNull();
    });
});

describe('buildDefectPayload — đặc tính kiểm tra', () => {
    const chars: DefectCharacteristicRow[] = [
        {
            lineNo: 2,
            characteristic: 'Burr height',
            measuredValue: '0.31',
            specLowerLimit: 0,
            specUpperLimit: 0.2,
            specUom: 'mm',
            valuation: 'Rejected',
            equipment: 'CMM-07',
        },
        {
            lineNo: 1,
            characteristic: 'Flange diameter',
            measuredValue: '48.02',
            specLowerLimit: '47.9',
            specUpperLimit: '48.1',
            specUom: 'mm',
            valuation: 'Accepted',
            equipment: 'CMM-07',
        },
    ];

    it('không có đặc tính nào thì mảng rỗng', () => {
        expect(buildDefectPayload(baseDefect()).inspections).toEqual([]);
    });

    it('sắp theo lineNo chứ không theo thứ tự DB trả về', () => {
        const rows = buildDefectPayload(baseDefect(), chars).inspections as any[];
        expect(rows.map((r) => r.characteristic)).toEqual(['Flange diameter', 'Burr height']);
    });

    it('đổi giới hạn quy cách sang số — D2 cần so sánh, không cần chuỗi', () => {
        const rows = buildDefectPayload(baseDefect(), chars).inspections as any[];
        expect(rows[0]).toEqual({
            characteristic: 'Flange diameter',
            measuredValue: '48.02',
            specLowerLimit: 47.9,
            specUpperLimit: 48.1,
            specUom: 'mm',
            valuation: 'Accepted',
            equipment: 'CMM-07',
        });
    });

    it('giữ giới hạn 0 — 0 là một giới hạn thật, không phải ô trống', () => {
        const rows = buildDefectPayload(baseDefect(), chars).inspections as any[];
        expect(rows[1].specLowerLimit).toBe(0);
    });

    it('bỏ dòng không có tên đặc tính', () => {
        const rows = buildDefectPayload(baseDefect(), [
            ...chars,
            { lineNo: 3, characteristic: '  ', measuredValue: '1' },
        ]).inspections as any[];
        expect(rows).toHaveLength(2);
    });

    it('thiếu giá trị đo thì là chuỗi rỗng, còn giới hạn thiếu thì là null', () => {
        const rows = buildDefectPayload(baseDefect(), [
            { lineNo: 1, characteristic: 'Surface finish' },
        ]).inspections as any[];
        expect(rows[0].measuredValue).toBe('');
        expect(rows[0].specLowerLimit).toBeNull();
        expect(rows[0].specUpperLimit).toBeNull();
    });

    it('không sửa mảng đặc tính mà người gọi truyền vào', () => {
        const input = [...chars];
        buildDefectPayload(baseDefect(), input);
        expect(input.map((c) => c.lineNo)).toEqual([2, 1]);
    });
});
