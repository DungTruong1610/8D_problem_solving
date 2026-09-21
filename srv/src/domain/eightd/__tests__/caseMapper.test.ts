/**
 * Test cho mapper — chạy trên FILE JSON THẬT trong mock-data/, không phải
 * fixture tự chế.
 *
 * Lý do: mapper tồn tại để hiểu đúng định dạng của nhóm. Test bằng fixture tự
 * viết chỉ chứng minh mapper hiểu được thứ chính tôi vừa bịa ra — nó sẽ vẫn xanh
 * trong khi dataset thật đã đổi hình dạng.
 */

import fs from 'node:fs';
import path from 'node:path';
import { evaluateOutOfSpec, formatSpecRange, mapCase, resolveOutOfSpec } from '../caseMapper';
import { originAllowsInspectionLot, PipelineError } from '../types';

const MOCK_DIR = path.resolve(__dirname, '../../../../../mock-data/clean');

/**
 * `beta/` là bộ Golden Dataset cũ, đóng băng có chủ đích. Đây là nơi duy nhất
 * còn khối `data` và `nested_case_view` — hai định dạng mapper vẫn phải đọc
 * được, nên phải có test chạy trên chúng.
 */
const LEGACY_DIR = path.resolve(__dirname, '../../../../../mock-data/beta');

function load(name: string) {
    return JSON.parse(fs.readFileSync(path.join(MOCK_DIR, name), 'utf-8'));
}

function loadLegacy(name: string) {
    return JSON.parse(fs.readFileSync(path.join(LEGACY_DIR, name), 'utf-8'));
}

const Q3_MACHINE = 'case-8D-10048412.json';   // gốc của nhóm
const Q1_MATERIAL = 'case-8D-10048577.json';
const Q3_METHOD = 'case-8D-10048603.json';
const Q1_MEASUREMENT = 'case-8D-10048651.json'; // thiếu preventive + fmea, cố ý

describe('evaluateOutOfSpec', () => {
    it.each([
        ['0.32mm', 'max 0.10mm', true],
        ['0.08mm', 'max 0.10mm', false],
        ['12 mbar*l/s', 'max 5 mbar*l/s', true],
        ['3.8%', 'max 1.0%', true],
        ['24.912mm', '24.950-25.000mm', true],
        ['24.980mm', '24.950-25.000mm', false],
        ['38um', '60-90um', true],
        ['75um', '60-90um', false],
        ['0.09mm', '0.05mm +/-0', true],
        ['Class 3', 'Class 0-1', true],
        ['Class 1', 'Class 0-1', false],
    ])('%s vs %s → outOfSpec=%s', (measured, spec, expected) => {
        expect(evaluateOutOfSpec(measured, spec)).toBe(expected);
    });

    it('trả null khi không parse được số đo', () => {
        expect(evaluateOutOfSpec('pass', 'max 0.10mm')).toBeNull();
    });

    it('trả null khi không hiểu định dạng spec — thà không biết còn hơn đoán sai', () => {
        expect(evaluateOutOfSpec('0.32mm', 'per drawing DOC-4610')).toBeNull();
    });
});

/**
 * Thứ tự ưu tiên của `resolveOutOfSpec`.
 *
 * `evaluateOutOfSpec` ở trên đọc MỘT CHUỖI tự do và trả null khi không hiểu.
 * Null đó không dừng ở chỗ nó sinh ra: `postProcess` chọn đặc tính Is/Is-Not
 * bằng `find((i) => i.outOfSpec)`, nên một dòng không kết luận được sẽ âm thầm
 * đẩy D2 sang so một đặc tính khác. Ba tầng dưới đây tồn tại để chuyện đó chỉ
 * còn xảy ra khi nguồn thực sự không ghi gì cả.
 */
describe('resolveOutOfSpec', () => {
    const base = { measuredValue: '', specValue: '', specLowerLimit: null, specUpperLimit: null, valuation: null };

    it('phán quyết của người kiểm thắng mọi thứ khác', () => {
        // Số đo 0.32 vượt trần 0.10, nhưng người kiểm đã ghi Accepted — có thể vì
        // một sai lệch được duyệt. Mapper KHÔNG lật lại phán quyết đó.
        expect(resolveOutOfSpec({
            ...base, measuredValue: '0.32', specValue: 'max 0.10mm',
            specUpperLimit: 0.1, valuation: 'Accepted',
        })).toBe(false);

        expect(resolveOutOfSpec({
            ...base, measuredValue: '0.04', specUpperLimit: 0.1, valuation: 'Rejected',
        })).toBe(true);
    });

    it('không có phán quyết thì so số đo với giới hạn số', () => {
        expect(resolveOutOfSpec({ ...base, measuredValue: '0.32 mm', specUpperLimit: 0.1 })).toBe(true);
        expect(resolveOutOfSpec({ ...base, measuredValue: '0.04 mm', specUpperLimit: 0.1 })).toBe(false);
        expect(resolveOutOfSpec({ ...base, measuredValue: '38 um', specLowerLimit: 60 })).toBe(true);
        expect(resolveOutOfSpec({ ...base, measuredValue: '24.912', specLowerLimit: 24.95, specUpperLimit: 25 })).toBe(true);
        expect(resolveOutOfSpec({ ...base, measuredValue: '24.98', specLowerLimit: 24.95, specUpperLimit: 25 })).toBe(false);
    });

    it('giới hạn số thắng chuỗi spec khi hai bên nói khác nhau', () => {
        // Chuỗi cũ nói trần 0.50, ô số nói 0.10. Ô số là thứ được nhập có cấu
        // trúc; chuỗi là di sản. Đọc chuỗi ở đây sẽ ra false.
        expect(resolveOutOfSpec({
            ...base, measuredValue: '0.32', specValue: 'max 0.50mm', specUpperLimit: 0.1,
        })).toBe(true);
    });

    it('lùi về parser chuỗi khi không có cả phán quyết lẫn giới hạn', () => {
        expect(resolveOutOfSpec({ ...base, measuredValue: '0.32mm', specValue: 'max 0.10mm' })).toBe(true);
        expect(resolveOutOfSpec({ ...base, measuredValue: 'Class 3', specValue: 'Class 0-1' })).toBe(true);
    });

    it('có giới hạn nhưng số đo không phải số thì vẫn thử parser chuỗi', () => {
        // 'pass' không so được với 0.10 — nhưng đó không phải lý do để bỏ qua
        // chuỗi spec, vốn có thể mô tả một hạng chứ không phải một số.
        expect(resolveOutOfSpec({
            ...base, measuredValue: 'Class 3', specValue: 'Class 0-1', specUpperLimit: 1,
        })).toBe(true);
    });

    it('trả null khi nguồn không ghi gì kết luận được', () => {
        expect(resolveOutOfSpec({ ...base, measuredValue: '0.32mm', specValue: 'per drawing DOC-4610' })).toBeNull();
        expect(resolveOutOfSpec({ ...base, measuredValue: '0.32mm' })).toBeNull();
    });
});

describe('formatSpecRange', () => {
    it.each([
        [0.05, 0.1, 'mm', '0.05 – 0.1 mm'],
        [null, 0.1, 'mm', 'max 0.1 mm'],
        [60, null, 'um', 'min 60 um'],
        [null, 0.1, null, 'max 0.1'],
        [null, null, 'mm', ''],
    ])('(%s, %s, %s) → "%s"', (lo, hi, uom, expected) => {
        expect(formatSpecRange(lo, hi, uom)).toBe(expected);
    });
});

describe('mapCase — trường đo có cấu trúc', () => {
    const withRows = (inspections: unknown[]) => mapCase({
        notificationId: '8D-TEST-SPEC-01',
        origin: 'Q3 - Internal Defect',
        symptomShortText: 'Burr on flange',
        status: 'In Process',
        inspections,
    });

    it('dựng specValue để hiển thị khi nguồn chỉ gửi giới hạn số', () => {
        const ctx = withRows([{ characteristic: 'Burr height', measured_value: '0.32', spec_upper_limit: 0.1, spec_uom: 'mm' }]);
        expect(ctx.inspections[0].specValue).toBe('max 0.1 mm');
        expect(ctx.inspections[0].specUpperLimit).toBe(0.1);
        expect(ctx.inspections[0].outOfSpec).toBe(true);
    });

    it('nhận valuation và không lật lại nó', () => {
        const ctx = withRows([{ characteristic: 'Burr height', measured_value: '0.32', spec_upper_limit: 0.1, valuation: 'Accepted' }]);
        expect(ctx.inspections[0].valuation).toBe('Accepted');
        expect(ctx.inspections[0].outOfSpec).toBe(false);
    });

    it('bỏ qua valuation lạ thay vì coi nó là Accepted', () => {
        const ctx = withRows([{ characteristic: 'Burr height', measured_value: '0.32', valuation: 'OK' }]);
        expect(ctx.inspections[0].valuation).toBeNull();
        expect(ctx.inspections[0].outOfSpec).toBeNull();
    });

    it('báo gap đích danh dòng không kết luận được', () => {
        const ctx = withRows([
            { characteristic: 'Burr height', measured_value: '0.32', spec_upper_limit: 0.1 },
            { characteristic: 'Pocket depth', measured_value: '12.84' },
        ]);
        expect(ctx.gaps.some((g) => /Pocket depth/.test(g) && /not judged/i.test(g))).toBe(true);
        // Dòng kết luận được thì không bị nhắc tên.
        expect(ctx.gaps.some((g) => /Burr height/.test(g))).toBe(false);
    });

    it('không báo gap khi KHÔNG dòng nào kết luận được — đó là gap "thiếu số đo", đã có chỗ khác lo', () => {
        const ctx = withRows([{ characteristic: 'Pocket depth', measured_value: '12.84' }]);
        expect(ctx.gaps.some((g) => /not judged/i.test(g))).toBe(false);
    });
});

describe('mapCase — số lượng bị ảnh hưởng', () => {
    const withQty = (extra: Record<string, unknown>) => mapCase({
        notificationId: '8D-TEST-QTY-01',
        origin: 'Q3 - Internal Defect',
        symptomShortText: 'Burr on flange',
        status: 'In Process',
        ...extra,
    });

    it('tách số khỏi đơn vị', () => {
        const ctx = withQty({ defect_quantity: 61, defect_quantity_uom: 'PC' });
        expect(ctx.header.defectQuantity).toBe(61);
        expect(ctx.header.defectQuantityUom).toBe('PC');
        // Câu mô tả vẫn có — nó là đường dẫn bằng chứng D3 mà prompt đang trích.
        expect(ctx.header.quantityExtent).toBe('61 PC');
    });

    it('câu mô tả gõ tay vẫn thắng chuỗi tự ghép', () => {
        const ctx = withQty({ quantity_extent: '128 units affected', defect_quantity: 61 });
        expect(ctx.header.quantityExtent).toBe('128 units affected');
        expect(ctx.header.defectQuantity).toBe(61);
    });

    it('không tự bóc số ra khỏi câu mô tả', () => {
        // '128 units affected' có thể là 128 cái, 128 kg, hay 128 pallet. Đoán ở
        // đây là biến một câu người đọc hiểu thành một con số máy tính sai.
        const ctx = withQty({ quantity_extent: '128 units affected' });
        expect(ctx.header.defectQuantity).toBeNull();
    });
});

describe('mapCase — case gốc của nhóm', () => {
    const ctx = mapCase(load(Q3_MACHINE));

    it('bóc đúng case header', () => {
        expect(ctx.notificationId).toBe('8D-10048412');
        expect(ctx.origin).toBe('Q3 - Internal Defect');
        expect(ctx.isCustomerFacing).toBe(false);
        expect(ctx.header.quantityExtent).toBe('128 units affected');
        expect(ctx.header.completionDate).toBeNull();
    });

    it('join master data qua khoá ngoại', () => {
        expect(ctx.product.materialId).toBe('MAT-10247');
        expect(ctx.product.materialDesc).toBe('Bracket Housing X240');
        expect(ctx.product.workCenterDesc).toBe('CNC Milling Line 7');
    });

    it('tách đúng dòng root cause trong 6 dòng Ishikawa', () => {
        expect(ctx.ishikawa).toHaveLength(6);
        expect(ctx.rootCause?.category).toBe('Machine');
        expect(ctx.rootCause?.metricValue).toBe('11,800 cycles');
        expect(ctx.ishikawa.filter((r) => r.isRootCause)).toHaveLength(1);
    });

    it('sắp 5-Why theo thứ tự và đánh dấu bước root cause', () => {
        expect(ctx.fiveWhy.map((r) => r.stepNo)).toEqual([1, 2, 3]);
        const rc = ctx.fiveWhy.filter((r) => r.isRootCauseStep);
        expect(rc).toHaveLength(1);
        expect(rc[0].stepNo).toBe(2);
        expect(rc[0].evidenceCitation).toContain('EQ-MILL07-002');
    });

    it('gom action theo ánh xạ action_type → bước 8D', () => {
        expect(ctx.actions.containment).toHaveLength(1);
        expect(ctx.actions.corrective).toHaveLength(1);
        expect(ctx.actions.preventive).toHaveLength(1);
        expect(ctx.actions.preventive[0].status).toBe('Planned');
    });

    it('tách leader khỏi members', () => {
        expect(ctx.team.leader?.partnerName).toBe('Heli Weber');
        expect(ctx.team.members).toHaveLength(3);
        expect(ctx.team.members.every((m) => m.partnerRole === '8D Team Member')).toBe(true);
    });

    it('so sánh số đo với dung sai', () => {
        const burr = ctx.inspections.find((i) => i.characteristic === 'Flange burr height');
        expect(burr?.outOfSpec).toBe(true);
    });

    it('coi chuỗi "N/A -" là không áp dụng, không phải thiếu dữ liệu', () => {
        expect(ctx.customer.applicable).toBe(false);
        expect(ctx.customer.complaintReference).toContain('N/A');
        // Không được báo gap: case nội bộ vốn dĩ không có khách hàng.
        expect(ctx.gaps.some((g) => /customer/i.test(g))).toBe(false);
    });
});

describe('mapCase — case Q1 khách hàng', () => {
    const ctx = mapCase(load(Q1_MATERIAL));

    it('bật cờ customer-facing và giữ dữ liệu khách hàng thật', () => {
        expect(ctx.isCustomerFacing).toBe(true);
        expect(ctx.customer.applicable).toBe(true);
        expect(ctx.customer.complaintReference).toBe('CC-2026-0442');
        expect(ctx.customer.slaResponseDue).toBe('2026-07-09');
    });

    it('nhận root cause Material', () => {
        expect(ctx.rootCause?.category).toBe('Material');
    });

    it('lấy được COPQ và FMEA', () => {
        expect(ctx.copqEur).toBe(28900);
        expect(ctx.fmea?.fmeaId).toBe('FMEA-CAST03-07');
    });

    it('gom nhiều action cùng loại', () => {
        expect(ctx.actions.containment).toHaveLength(2);
        expect(ctx.actions.containment.map((a) => a.lineNo)).toEqual([1, 2]);
    });
});

describe('mapCase — case cố ý thiếu dữ liệu', () => {
    const ctx = mapCase(load(Q1_MEASUREMENT));

    it('báo gap khi không có preventive action', () => {
        expect(ctx.actions.preventive).toHaveLength(0);
        expect(ctx.gaps.some((g) => /preventive/i.test(g))).toBe(true);
    });

    it('báo gap khi không có FMEA link', () => {
        expect(ctx.fmea).toBeNull();
        expect(ctx.gaps.some((g) => /FMEA/i.test(g))).toBe(true);
    });

    it('vẫn bóc được phần dữ liệu có', () => {
        expect(ctx.rootCause?.category).toBe('Measurement');
        expect(ctx.actions.containment).toHaveLength(2);
        expect(ctx.team.leader?.partnerName).toBe('Thien Tu');
    });
});

describe('mapCase — chuỗi 5-Why dài hơn', () => {
    it('giữ đủ 4 bước và đúng thứ tự', () => {
        const ctx = mapCase(load(Q3_METHOD));
        expect(ctx.fiveWhy).toHaveLength(4);
        expect(ctx.fiveWhy.map((r) => r.stepNo)).toEqual([1, 2, 3, 4]);
        expect(ctx.fiveWhy.filter((r) => r.isRootCauseStep)[0].stepNo).toBe(4);
    });
});

describe('mapCase — phương án dự phòng và lỗi', () => {
    it('map được từ nested_case_view khi không có khối data', () => {
        const raw = loadLegacy(Q3_MACHINE);
        const ctx = mapCase({ nested_case_view: raw.nested_case_view });

        expect(ctx.notificationId).toBe('8D-10048412');
        expect(ctx.rootCause?.category).toBe('Machine');
        expect(ctx.actions.containment).toHaveLength(1);
        expect(ctx.team.leader?.partnerName).toBe('Heli Weber');
        expect(ctx.product.materialDesc).toBe('Bracket Housing X240');
    });

    it('cho ra cùng root cause dù đọc data hay nested_case_view', () => {
        const raw = loadLegacy(Q1_MATERIAL);
        const fromData = mapCase(raw);
        const fromNested = mapCase({ nested_case_view: raw.nested_case_view });

        expect(fromNested.rootCause?.category).toBe(fromData.rootCause?.category);
        expect(fromNested.fiveWhy).toHaveLength(fromData.fiveWhy.length);
        expect(fromNested.actions.corrective).toHaveLength(fromData.actions.corrective.length);
    });

    it('ném PipelineError 400 khi payload không phải Golden Dataset', () => {
        expect(() => mapCase({ hello: 'world' })).toThrow(PipelineError);
        try {
            mapCase({ hello: 'world' });
        } catch (e: any) {
            expect(e.code).toBe(400);
        }
    });

    it('bóc đúng trường responsibility khi payload có section 4', () => {
        const raw = {
            notificationId: '8D-TEST-RESP-01',
            origin: 'Q3 - Internal Defect',
            symptomShortText: 'Test defect symptom',
            status: 'In Process',
            responsibility: {
                reportedBy: 'Local Developer',
                coordinator: 'Quality Admin',
                department: 'QA Dept',
            },
        };
        const ctx = mapCase(raw);
        expect(ctx.responsibility).toEqual({
            reportedBy: 'Local Developer',
            coordinator: 'Quality Admin',
            department: 'QA Dept',
        });
    });
});

/**
 * Payload do popup "Record Defect" dựng — KHÔNG phải Golden Dataset, nên nó đi
 * nhánh flat business JSON của mapper.
 *
 * Đây là hình dạng duy nhất mà phân loại lỗi đầy đủ (nhóm mã + mã + mức nghiêm
 * trọng) đi qua. Mã lỗi chỉ duy nhất TRONG một nhóm: rơi mất nhóm ở bất kỳ khâu
 * nào thì khoá còn thiếu vế, và không có gì đỏ lên để báo — case vẫn lưu được,
 * chỉ là D2 in ra một mã tra không ra.
 */
describe('mapCase — payload từ popup Record Defect', () => {
    const popupPayload = {
        notificationId: '8D-TEST-CLS-01',
        origin: 'Q3 - Internal Defect',
        symptomShortText: 'Rough edge felt on flange after milling',
        status: 'In Process',
        referenceNumber: 'DN-77421',
        plant: '2000',
        material: { materialId: 'MAT-10247', description: 'Bracket Housing X240', materialGroup: 'MG-BRACKET', plant: '2000' },
        defect: {
            defectCodeGroup: 'QM-SUR',
            defectCode: 'SUR-0003',
            defectText: 'Burr on machined edge',
            defectClass: 'Major',
        },
        workCenter: { workCenterId: 'WC-MILL-07', description: 'CNC Milling Line 7' },
    };

    it('giữ đủ nhóm mã, mã, mô tả và mức nghiêm trọng từ MỘT lần chọn', () => {
        const ctx = mapCase(popupPayload);
        expect(ctx.product.defectCodeGroup).toBe('QM-SUR');
        expect(ctx.product.defectCode).toBe('SUR-0003');
        expect(ctx.product.defectText).toBe('Burr on machined edge');
        expect(ctx.product.defectClass).toBe('Major');
    });

    it('giữ nhà máy và số tham chiếu ngoài', () => {
        const ctx = mapCase(popupPayload);
        expect(ctx.product.plant).toBe('2000');
        expect(ctx.header.referenceNumber).toBe('DN-77421');
    });

    it('nhận cả tên snake_case và tên "severity" của workbook cũ', () => {
        const ctx = mapCase({
            ...popupPayload,
            defect: {
                defect_code_group: 'QM-DIM',
                defect_code: 'DIM-0001',
                defect_text: 'Bore diameter out of tolerance',
                severity: 'Critical',
            },
        });
        expect(ctx.product.defectCodeGroup).toBe('QM-DIM');
        expect(ctx.product.defectClass).toBe('Critical');
    });

    it('để trống nhóm chứ không suy ngược từ mã khi nguồn không khai', () => {
        const ctx = mapCase({
            ...popupPayload,
            defect: { defectCode: 'SUR-0003', defectText: 'Burr on machined edge' },
        });
        expect(ctx.product.defectCode).toBe('SUR-0003');
        expect(ctx.product.defectCodeGroup).toBe('');
        expect(ctx.product.defectClass).toBe('');
    });
});

/**
 * Q1 không có lô kiểm tra.
 *
 * Chạy trên case Q1 thật, thêm một số lô vào — đúng thứ mà form cũ cho gõ và file
 * import không ai kiểm. Điều cần chứng minh: số đó bị bỏ, VÀ việc bỏ đi được ghi
 * lại. Bỏ âm thầm cũng tệ ngang giữ lại: sau này không ai truy được vì sao lô
 * biến mất.
 */
describe('mapCase — nguồn gốc quyết định lô kiểm tra', () => {
    it('bỏ lô kiểm tra trên case Q1 và ghi lại một gap', () => {
        const ctx = mapCase({
            ...load(Q1_MATERIAL),
            entryMode: 'during-inspection',
            inspectionLotId: '0010000001',
        });
        expect(ctx.header.inspectionLotId).toBeNull();
        expect(ctx.header.entryMode).toBe('outside-inspection');
        expect(ctx.gaps.some((g) => g.includes('0010000001'))).toBe(true);
    });

    it('không sinh gap khi case Q1 vốn không mang lô nào', () => {
        const ctx = mapCase(load(Q1_MATERIAL));
        expect(ctx.header.inspectionLotId).toBeNull();
        expect(ctx.gaps.some((g) => g.includes('Inspection lot'))).toBe(false);
    });

    it('giữ nguyên lô kiểm tra trên case Q3', () => {
        const ctx = mapCase({
            ...load(Q3_MACHINE),
            entryMode: 'during-inspection',
            inspectionLotId: '0010000042',
        });
        expect(ctx.header.inspectionLotId).toBe('0010000042');
        expect(ctx.header.entryMode).toBe('during-inspection');
    });

    it('giữ nguyên lô kiểm tra trên case Q2 — nhà cung cấp có lô nhập hàng', () => {
        const ctx = mapCase({
            ...load(Q3_MACHINE),
            origin: 'Q2 - Supplier Defect',
            entryMode: 'during-inspection',
            inspectionLotId: '0010000099',
        });
        expect(ctx.header.inspectionLotId).toBe('0010000099');
    });
});

/**
 * Luật đặt ở `types.ts` chứ không nằm trong component, vì cả form lẫn pipeline
 * đều cần cùng câu trả lời. Test nó trực tiếp: đây là một lệnh cấm HẸP cho Q1,
 * không phải danh sách trắng — nguồn gốc lạ phải được cho qua, nếu không mọi
 * dữ liệu cũ sẽ mất lô kiểm tra một cách âm thầm.
 */
describe('originAllowsInspectionLot', () => {
    it.each([
        ['Q1 - Customer Complaint', false],
        ['  Q1 - Customer Complaint  ', false],
        ['Q2 - Supplier Defect', true],
        ['Q3 - Internal Defect', true],
        ['Q6 - something nobody has seen', true],
        ['', true],
    ])('%s → %s', (origin, expected) => {
        expect(originAllowsInspectionLot(origin)).toBe(expected);
    });
});
