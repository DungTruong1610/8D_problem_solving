/**
 * Dựng payload phân tích 8D từ một bản ghi lỗi đã có.
 *
 * ── Vì sao cần file này ──
 * Pipeline 8D nhận vào một JSON case phẳng — cùng hình dạng mà popup "Record
 * Defect" vẫn dựng trong trình duyệt. Khi mở 8D TỪ một lỗi đã ghi (Phase 2.2),
 * dữ liệu đã nằm sẵn trong bảng `Defects`, nên chỗ dựng payload phải chuyển từ
 * trình duyệt về server.
 *
 * ── Vì sao là hàm thuần ──
 * Đây là ranh giới giữa hai mô hình dữ liệu: cột của SAP QM một bên,
 * `CaseContext` một bên. Sai một khoá ở đây thì báo cáo vẫn chạy, vẫn ra tám bước
 * D, chỉ là thiếu mất một dữ kiện — và không có gì báo, vì payload thiếu trường
 * là chuyện bình thường với dữ liệu nhập từ ngoài. Tách khỏi DB thì test được
 * bằng bảng dữ liệu.
 *
 * Hình dạng đầu ra phải khớp `builtPayloadObject` trong
 * `app/.../pages/create-defect/index.tsx`. Hai đường vào, MỘT hợp đồng payload —
 * nếu không thì `caseMapper` phải biết mình đang đọc payload của đường nào.
 */

import { ORIGIN_CUSTOMER, ORIGIN_SUPPLIER } from './eightd/types';

/** Cột của `cnma.proresolve.Defects` mà payload cần. Nhận `any` từ CAP nên khai lỏng. */
export interface DefectRow {
    defectId?: string | null;
    origin?: string | null;
    status?: string | null;
    symptomShortText?: string | null;
    foundDate?: string | null;
    defectQuantity?: number | string | null;
    defectQuantityUom?: string | null;
    referenceNumber?: string | null;
    plant?: string | null;
    materialId?: string | null;
    materialDesc?: string | null;
    materialGroup?: string | null;
    batchId?: string | null;
    workCenterId?: string | null;
    workCenterDesc?: string | null;
    defectCodeGroup?: string | null;
    defectCode?: string | null;
    defectText?: string | null;
    defectClass?: string | null;
    entryMode?: string | null;
    inspectionLotId?: string | null;
    reportedBy?: string | null;
    coordinator?: string | null;
    department?: string | null;
    complaintReference?: string | null;
    customerPlantContact?: string | null;
    slaResponseDue?: string | null;
}

export interface DefectCharacteristicRow {
    lineNo?: number | null;
    characteristic?: string | null;
    measuredValue?: string | null;
    specLowerLimit?: number | string | null;
    specUpperLimit?: number | string | null;
    specUom?: string | null;
    valuation?: string | null;
    equipment?: string | null;
}

const text = (v: unknown): string | null => {
    const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
    return s || null;
};

const num = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};

/**
 * Nguồn gốc này có lô kiểm tra được không?
 *
 * Gương của `originAllowsInspectionLot` — Q1 đến sau khi hàng đã rời cổng, nên
 * gắn một số lô vào đó là dựng một mắt xích không tồn tại. Ép lại ở đây chứ không
 * tin cột `entryMode`: bản ghi lỗi có thể đã đổi nguồn gốc sau khi lưu.
 */
function lotAllowed(origin: string | null): boolean {
    return origin !== ORIGIN_CUSTOMER;
}

/**
 * Ba ô khách hàng cho case KHÔNG hướng khách hàng.
 *
 * Chuỗi 'N/A - ...' là sentinel có chủ đích, không phải chỗ trống được che lại:
 * `isDeliberateNA` phía server nhận ra nó và hạ cờ `applicable`, nhờ đó model
 * không báo "thiếu thông tin khách hàng" cho một lỗi nội bộ vốn không có khách.
 * Để null thì nó lại báo thiếu.
 */
function customerReference(defect: DefectRow, origin: string | null) {
    if (origin === ORIGIN_CUSTOMER) {
        return {
            complaintReference: text(defect.complaintReference),
            customerPlantContact: text(defect.customerPlantContact),
            slaResponseDue: text(defect.slaResponseDue),
        };
    }
    const kind = origin === ORIGIN_SUPPLIER ? 'supplier defect' : 'internal defect';
    return {
        complaintReference: `N/A - ${kind}, no customer reference`,
        customerPlantContact: 'N/A',
        slaResponseDue: 'N/A',
    };
}

/**
 * Bản ghi lỗi → payload case phẳng.
 *
 * Những mảng để rỗng (`causesIshikawa`, `fiveWhyChain`, `actions`,
 * `teamAssignments`) là ĐÚNG chứ không phải thiếu: một lỗi vừa ghi nhận chưa có
 * phân tích nguyên nhân nào cả. Đó chính là thứ 8D sắp làm ra.
 */
export function buildDefectPayload(
    defect: DefectRow,
    characteristics: readonly DefectCharacteristicRow[] = [],
): Record<string, unknown> {
    const origin = text(defect.origin) ?? 'Q3 - Internal Defect';
    const materialId = text(defect.materialId);
    const entryMode = lotAllowed(origin)
        ? (text(defect.entryMode) ?? 'outside-inspection')
        : 'outside-inspection';

    return {
        notificationId: text(defect.defectId),
        origin,
        symptomShortText: text(defect.symptomShortText) ?? '',
        // Lỗi đang được mở 8D — đó chính là 'In Process' phía SAP. Không lấy
        // `defect.status`: cột đó là vòng đời của bản ghi lỗi (`Open` khi mở 8D),
        // còn payload cần trạng thái của CASE tại thời điểm phân tích.
        status: 'In Process',
        foundDate: text(defect.foundDate),
        completionDate: null,
        // Server ghép `quantityExtent` từ số + đơn vị. Vẫn gửi khoá (null) để
        // hợp đồng payload không đổi hình giữa hai đường vào.
        quantityExtent: null,
        defectQuantity: num(defect.defectQuantity),
        defectQuantityUom: text(defect.defectQuantityUom),
        entryMode,
        inspectionLotId: entryMode === 'during-inspection' ? text(defect.inspectionLotId) : null,
        referenceNumber: text(defect.referenceNumber),
        plant: text(defect.plant),
        teamSize: null,
        material: {
            materialId,
            description: text(defect.materialDesc),
            materialGroup: text(defect.materialGroup),
            plant: text(defect.plant),
        },
        batch: {
            batchId: text(defect.batchId),
            materialId,
        },
        defect: {
            defectCodeGroup: text(defect.defectCodeGroup),
            defectCode: text(defect.defectCode),
            defectText: text(defect.defectText),
            defectClass: text(defect.defectClass),
        },
        workCenter: {
            workCenterId: text(defect.workCenterId),
            description: text(defect.workCenterDesc),
        },
        inspections: [...characteristics]
            .sort((a, b) => (Number(a.lineNo) || 0) - (Number(b.lineNo) || 0))
            .filter((c) => text(c.characteristic))
            .map((c) => ({
                characteristic: text(c.characteristic),
                measuredValue: text(c.measuredValue) ?? '',
                specLowerLimit: num(c.specLowerLimit),
                specUpperLimit: num(c.specUpperLimit),
                specUom: text(c.specUom),
                valuation: text(c.valuation),
                equipment: text(c.equipment),
            })),
        responsibility: {
            reportedBy: text(defect.reportedBy),
            coordinator: text(defect.coordinator),
            department: text(defect.department),
        },
        causesIshikawa: [],
        fiveWhyChain: [],
        actions: [],
        teamAssignments: [],
        isIsNot: null,
        fmeaLink: null,
        costCopq: null,
        lessonsLearned: null,
        customerReference: customerReference(defect, origin),
    };
}
