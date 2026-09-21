/**
 * Bóc dataset thô thành `CaseContext` — thuần code, KHÔNG gọi AI.
 *
 * ── Vì sao bước này không dùng model ──
 * Gom action theo loại, tách dòng root cause, sắp 5-Why theo thứ tự — đều là
 * việc cơ học có luật rõ ràng. Đưa cho model làm là trả tiền và trả thời gian
 * để đổi lấy một xác suất sai khác 0. Ở đây xác suất đó bằng 0 và chạy vài ms.
 *
 * ── Vì sao đọc `data` chứ không `nested_case_view` ──
 * Hai khối chứa cùng dữ liệu. Nhưng `datasetValidator` kiểm tra `data`, nên
 * mapper cũng phải đọc `data` — nếu không, ta xác thực một khối rồi phân tích
 * khối khác, và một sai lệch giữa hai khối sẽ lọt qua mà không ai biết.
 * `nested_case_view` chỉ dùng làm phương án dự phòng.
 */

import {
    ACTION_TYPE_TO_STEP,
    ORIGIN_CUSTOMER,
    PipelineError,
    isValuation,
    originAllowsInspectionLot,
    type ActionRow,
    type CaseContext,
    type FiveWhyRow,
    type HistoricalInspectionLot,
    type InspectionRow,
    type IshikawaRow,
    type TeamRow,
    type Valuation,
} from './types';
import { isDeliberateNA, isRootCauseFlag } from './datasetValidator';

// ─────────────────────────────────────────────────────────────────────────────
// So sánh đo đạc với dung sai
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Số thực đầu tiên trong chuỗi. `'0.32mm'` → 0.32, `'Class 3'` → 3.
 *
 * Chấp nhận cả dấu phẩy thập phân kiểu Đức (`0,32 mm`) — dữ liệu SAP xuất theo
 * locale của người dùng, và một hệ thống chỉ hiểu dấu chấm sẽ đọc 0,32 thành 0.
 */
function firstNumber(s: string): number | null {
    const m = String(s).match(/-?\d+(?:[.,]\d+)?/);
    if (!m) return null;
    const n = Number(m[0].replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

/**
 * Ô trống theo kiểu người nhập.
 *
 * `''`, `'-'`, `'n.a.'`, `'k.A.'` đều nghĩa là "không có" nhưng không phải null,
 * nên code không tự nhận ra. Không quy chúng về null thì model sẽ tưởng đó là
 * nội dung thật và trích dẫn nguyên văn dấu gạch ngang vào báo cáo.
 *
 * Chuỗi 'N/A - ...' KHÔNG nằm ở đây: đó là giá trị có chủ đích, xử lý riêng.
 */
const BLANKISH = new Set(['', '-', '--', 'n.a.', 'n/a.', 'k.a.', 'na', 'kein', 'none']);

function isBlankish(v: unknown): boolean {
    if (v == null) return true;
    const s = String(v).trim().toLowerCase();
    return BLANKISH.has(s);
}

/** Cắt khoảng trắng thừa quanh mã — dữ liệu qua Excel hay dính. */
function id(v: unknown): string {
    return String(v ?? '').trim();
}

/**
 * Đưa ngày về ISO `YYYY-MM-DD`.
 *
 * SAP xuất ngày theo locale của transaction, nên cùng một file có thể lẫn
 * `03.08.2026` (Đức), `03-AUG-26` (ALV cũ) và `2026-08-03`. Giữ nguyên chuỗi thì
 * model phải tự đoán, và nó sẽ đoán sai thứ tự ngày/tháng ở đúng những ngày
 * mập mờ như 03.08 với 08.03.
 */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function normalizeDate(value: unknown): string | null {
    if (isBlankish(value)) return null;
    const s = String(value).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const dmy = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
    if (dmy) {
        const [, d, m, y] = dmy;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    const alv = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
    if (alv) {
        const [, d, mon, yy] = alv;
        const mi = MONTHS.indexOf(mon.toLowerCase());
        if (mi >= 0) {
            return `20${yy}-${String(mi + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
    }

    // Không nhận ra định dạng: trả nguyên chuỗi chứ không đoán. Model đọc được
    // '3rd of August' còn hơn nhận một ngày sai do ta suy diễn.
    return s;
}

/**
 * Dựng vị từ kiểm tra từ chuỗi spec. `null` khi không hiểu được định dạng —
 * và khi đó `outOfSpec` để null chứ không đoán.
 *
 * Hiểu được: 'max 0.10mm' · 'min 2.0' · '24.950-25.000mm' · '0.05mm +/-0' ·
 *            '60-90um' · 'Class 0-1'
 */
function parseSpec(spec: string): ((v: number) => boolean) | null {
    const s = String(spec).toLowerCase().replace(/±/g, '+/-');

    const max = s.match(/max\s*(-?\d+(?:[.,]\d+)?)/);
    if (max) {
        const limit = Number(max[1].replace(',', '.'));
        return (v) => v <= limit;
    }

    const min = s.match(/min\s*(-?\d+(?:[.,]\d+)?)/);
    if (min) {
        const limit = Number(min[1].replace(',', '.'));
        return (v) => v >= limit;
    }

    // Kiểm tra '+/-' TRƯỚC dải giá trị: '0.05mm +/-0' cũng chứa dấu gạch nối.
    const tol = s.match(/(-?\d+(?:[.,]\d+)?)\s*[a-z%*/]*\s*\+\/-\s*(\d+(?:[.,]\d+)?)/);
    if (tol) {
        const nominal = Number(tol[1].replace(',', '.'));
        const delta = Number(tol[2].replace(',', '.'));
        return (v) => Math.abs(v - nominal) <= delta;
    }

    const range = s.match(/(-?\d+(?:[.,]\d+)?)\s*-\s*(-?\d+(?:[.,]\d+)?)/);
    if (range) {
        const lo = Number(range[1].replace(',', '.'));
        const hi = Number(range[2].replace(',', '.'));
        return (v) => v >= Math.min(lo, hi) && v <= Math.max(lo, hi);
    }

    return null;
}

/**
 * Xếp một nhãn action tự do vào đúng loại của 8D.
 *
 * Golden Dataset dùng đúng ba chuỗi Containment / Corrective / Preventive, và
 * `schema.enumerations.action_type_to_8d_step` ánh xạ chúng sang D3 / D5 / D7.
 * Dữ liệu thật thì viết tay: `Sofortmassnahme`, `SM`, `Korrekturmassnahme`,
 * `KM`, `vorbeugend`, hoặc bỏ trống.
 *
 * Chỉ nhận diện những biến thể QUEN THUỘC. Không đoán mò: nhãn lạ trả `null` và
 * được ghi vào `gaps` để model biết có action chưa xếp được vào discipline nào,
 * thay vì lặng lẽ nhét bừa vào D3.
 */
const ACTION_ALIASES: Array<[keyof typeof ACTION_TYPE_TO_STEP, RegExp]> = [
    ['Containment', /^(containment|sofortmassnahme|sofortma|sm|eindaemmung|eindämmung|interim)/i],
    ['Corrective', /^(corrective|korrekturmassnahme|korrektur|km|abstellmassnahme|abstell)/i],
    ['Preventive', /^(preventive|vorbeugemassnahme|vorbeuge|vm|vorbeugend|prevention)/i],
];

export function classifyAction(label: unknown): keyof typeof ACTION_TYPE_TO_STEP | null {
    const s = String(label ?? '').trim();
    if (!s) return null;
    for (const [type, pattern] of ACTION_ALIASES) {
        if (pattern.test(s)) return type;
    }
    return null;
}

/**
 * `true` = vượt spec. `null` = không đủ cơ sở để kết luận.
 *
 * Đây là ĐƯỜNG LÙI, không phải đường chính — xem `resolveOutOfSpec`. Chỉ còn dùng
 * cho dòng cũ chỉ có spec dạng văn bản.
 */
export function evaluateOutOfSpec(measured: string, spec: string): boolean | null {
    const value = firstNumber(measured);
    if (value === null) return null;
    const inSpec = parseSpec(spec);
    if (!inSpec) return null;
    return !inSpec(value);
}

/** Số hợp lệ, hoặc `null`. Chuỗi rỗng và 'abc' đều ra null, `0` thì không. */
function num(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').trim());
    return Number.isFinite(n) ? n : null;
}

/**
 * Kết luận vượt spec, theo thứ tự ĐỘ TIN CẬY GIẢM DẦN.
 *
 * ① `valuation` — phán quyết của người kiểm (bước ③ của SAP). Là dữ kiện được ghi
 *    lại, không phải suy luận của ta. Có nó thì không cần gì thêm.
 * ② Hai giới hạn số — phép so sánh xác định, không parse chuỗi nên không hỏng được.
 * ③ Parse `specValue` — chỉ cho dữ liệu cũ. Đây chính là chỗ vẫn còn đoán, và là
 *    lý do hai bước trên tồn tại.
 *
 * ── Vì sao thứ tự này chứ không lấy số làm chuẩn ──
 * Một đặc tính có thể bị từ chối vì lý do mà hai giới hạn không tả được (vết xước
 * ngoài vùng đo, mẫu hỏng khi tháo). Người kiểm đã nói 'Rejected' thì ta không có
 * tư cách lật lại bằng một phép so sánh hẹp hơn cái họ nhìn thấy.
 */
export function resolveOutOfSpec(input: {
    measuredValue: string;
    specValue: string;
    specLowerLimit: number | null;
    specUpperLimit: number | null;
    valuation: Valuation | null;
}): boolean | null {
    if (input.valuation) return input.valuation === 'Rejected';

    const value = firstNumber(input.measuredValue);
    const { specLowerLimit: lo, specUpperLimit: hi } = input;
    if (value !== null && (lo !== null || hi !== null)) {
        if (lo !== null && value < lo) return true;
        if (hi !== null && value > hi) return true;
        return false;
    }

    return evaluateOutOfSpec(input.measuredValue, input.specValue);
}

/**
 * Chuỗi spec để hiển thị, dựng từ hai giới hạn.
 *
 * Chỉ dựng khi chưa có chuỗi sẵn: `specValue` người dùng gõ hoặc workbook mang
 * theo là NGUYÊN VĂN của họ, và một câu diễn đạt lại luôn mất thông tin ('per
 * drawing DOC-4610' không có giới hạn nào để dựng lại).
 */
export function formatSpecRange(
    lo: number | null, hi: number | null, uom: string | null,
): string {
    const u = uom ? ` ${uom}` : '';
    if (lo !== null && hi !== null) return `${lo} – ${hi}${u}`;
    if (hi !== null) return `max ${hi}${u}`;
    if (lo !== null) return `min ${lo}${u}`;
    return '';
}

// ─────────────────────────────────────────────────────────────────────────────

type Row = Record<string, any>;

function rows(src: Row, key: string): Row[] {
    const v = src?.[key];
    return Array.isArray(v) ? v : [];
}

function one(src: Row, key: string): Row | null {
    return rows(src, key)[0] ?? null;
}

/**
 * `null` cho ô trống — kể cả các biến thể người nhập gõ tay.
 * Giữ nguyên chuỗi 'N/A - ...' vì đó là giá trị có chủ đích.
 */
export function cleanField(v: unknown): string {
    let s = String(v ?? '').trim();
    const egMatch = s.match(/e\.g\.\s*([^)]+)/i);
    if (
        s.startsWith('Characteristic')
        || s.startsWith('Equipment')
        || s.startsWith('Spec')
        || s.startsWith('Measured')
    ) {
        if (egMatch && egMatch[1]) {
            s = egMatch[1].trim();
        }
    }
    s = s.replace(/\(links to [^)]+\)/gi, '').trim();
    s = s.replace(/^e\.g\.\s*/i, '').trim();
    return s;
}

function text(v: unknown): string | null {
    if (isBlankish(v)) return null;
    const s = cleanField(v);
    return s.length > 0 ? s : null;
}

/**
 * Chuyển `nested_case_view` về hình dạng phẳng giống `data`, để mapper chỉ phải
 * hiểu một hình dạng duy nhất.
 */
function flattenNested(nested: Row): Row {
    const nid = nested.notification_id ?? nested.notificationId;
    const stamp = (r: Row) => ({ notification_id: nid, ...r });
    const node = (k: string) => {
        const n = nested[k];
        if (!n || typeof n !== 'object') return null;
        const clean: Row = {};
        for (const [key, val] of Object.entries(n)) if (!key.startsWith('_')) clean[key] = val;
        return clean;
    };

    const header = node('header') ?? {};
    const material = node('material') ?? {};
    const batch = node('batch') ?? {};
    const defect = node('defect') ?? {};
    const wc = node('work_center') ?? {};
    const fmea = node('fmea_link');

    return {
        materials: material.material_id ? [material] : [],
        batches: batch.batch_id ? [batch] : [],
        defect_catalog: defect.defect_code ? [defect] : [],
        work_centers: wc.work_center_id ? [wc] : [],
        notifications: [{
            notification_id: nid,
            material_id: material.material_id,
            plant: material.plant,
            batch_id: batch.batch_id,
            defect_code: defect.defect_code,
            // Nhóm mã đi theo mã: mã lỗi chỉ duy nhất trong một nhóm.
            defect_code_group: defect.defect_code_group ?? defect.code_group,
            work_center_id: wc.work_center_id,
            ...header,
        }],
        inspections: (nested.inspections?.rows ?? nested.inspections ?? []).map(stamp),
        causes_ishikawa: (nested.causes_ishikawa?.rows ?? nested.causes_ishikawa ?? []).map(stamp),
        actions: (nested.actions?.rows ?? nested.actions ?? []).map(stamp),
        five_why_chain: (nested.five_why_chain?.rows ?? nested.five_why_chain ?? []).map(stamp),
        team_assignments: (nested.team_assignments?.rows ?? nested.team_assignments ?? []).map(stamp),
        fmea_link: fmea?.fmea_id ? [stamp(fmea)] : [],
        cost_copq: node('cost_copq') ? [stamp(node('cost_copq')!)] : [],
        lessons_learned: node('lessons_learned') ? [stamp(node('lessons_learned')!)] : [],
        is_is_not: node('is_is_not') ? [stamp(node('is_is_not')!)] : [],
        customer_reference: node('customer_reference') ? [stamp(node('customer_reference')!)] : [],
        responsibility: node('responsibility') ? [stamp(node('responsibility')!)] : [],
        spc_process_data: [],
    };
}

/**
 * Trích xuất và chuẩn hoá mọi định dạng JSON đầu vào (Deep Structure Business JSON,
 * OData response wrapper, legacy Golden Dataset) thành cấu trúc chuẩn.
 */
export function extractDeepCase(raw: any): Row | null {
    if (!raw || typeof raw !== 'object') return null;

    // 1. Giải bọc OData wrapper (`value: [...]` hoặc `value: {...}`)
    let obj = raw;
    if ('value' in raw) {
        if (Array.isArray(raw.value) && raw.value.length > 0) {
            obj = raw.value[0];
        } else if (raw.value && typeof raw.value === 'object' && !Array.isArray(raw.value)) {
            obj = raw.value;
        }
    }

    if (!obj || typeof obj !== 'object') return null;

    // 2. Format legacy `data`
    if (obj.data && typeof obj.data === 'object' && Array.isArray(obj.data.notifications)) {
        return obj.data;
    }

    // 3. Format legacy `nested_case_view`
    if (obj.nested_case_view && typeof obj.nested_case_view === 'object') {
        return flattenNested(obj.nested_case_view);
    }

    // 4. Định dạng Deep Structure Business JSON (OData / Real business object)
    const nid = obj.notificationId ?? obj.notification_id ?? obj.notification ?? obj.ID ?? obj.document;
    if (!nid && !obj.notifications && !obj.symptomShortText && !obj.symptom_short_text) {
        return null;
    }

    const getArray = (val: any): Row[] => {
        if (Array.isArray(val)) return val;
        if (val && typeof val === 'object' && Array.isArray(val.rows)) return val.rows;
        if (val && typeof val === 'object') return [val];
        return [];
    };

    const getObj = (val: any): Row | null => {
        if (!val || typeof val !== 'object') return null;
        if (Array.isArray(val)) return val[0] ?? null;
        return val;
    };

    const stamp = (r: Row) => ({ notification_id: nid, ...r });

    const material = getObj(obj.material ?? obj.materials);
    const batch = getObj(obj.batch ?? obj.batches);
    const defect = getObj(obj.defect ?? obj.defectCatalog ?? obj.defect_catalog);
    const wc = getObj(obj.workCenter ?? obj.workCenterId ?? obj.work_center ?? obj.work_centers);

    const header = {
        symptom_short_text: obj.symptomShortText ?? obj.symptom_short_text ?? obj.symptomText ?? obj.symptom ?? obj.description,
        team_size: obj.teamSize ?? obj.team_size,
        origin: obj.origin,
        customer_facing_summary: obj.customerFacingSummary ?? obj.customer_facing_summary,
        internal_facing_summary: obj.internalFacingSummary ?? obj.internal_facing_summary,
        status: obj.status ?? obj.sapStatus ?? obj.sap_status,
        completion_date: obj.completionDate ?? obj.completion_date,
        found_date: obj.foundDate ?? obj.found_date,
        quantity_extent: obj.quantityExtent ?? obj.quantity_extent,
        defect_quantity: obj.defectQuantity ?? obj.defect_quantity,
        defect_quantity_uom: obj.defectQuantityUom ?? obj.defect_quantity_uom,
        entry_mode: obj.entryMode ?? obj.entry_mode,
        inspection_lot_id: obj.inspectionLotId ?? obj.inspection_lot_id,
        reference_number: obj.referenceNumber ?? obj.reference_number,
    };

    const inspections = getArray(obj.inspections).map((r) => stamp({
        characteristic: r.characteristic,
        measured_value: r.measuredValue ?? r.measured_value,
        spec_value: r.specValue ?? r.spec_value,
        // Ba trường số + phán quyết là đường CHÍNH từ 1.4 trở đi; `spec_value` ở
        // trên chỉ còn là chuỗi hiển thị và đường lùi cho payload cũ.
        spec_lower_limit: r.specLowerLimit ?? r.spec_lower_limit,
        spec_upper_limit: r.specUpperLimit ?? r.spec_upper_limit,
        spec_uom: r.specUom ?? r.spec_uom ?? r.unit,
        valuation: r.valuation,
        equipment: r.equipment ?? r.fixture,
    }));

    const histLots = getArray(obj.historicalInspectionLots ?? obj.historical_inspection_lots).map((r) => stamp({
        lot_id: r.lotId ?? r.lot_id,
        material_id: r.materialId ?? r.material_id,
        characteristic: r.characteristic,
        equipment: r.equipment,
        work_center_id: r.workCenterId ?? r.work_center_id,
        measured_value: r.measuredValue ?? r.measured_value,
        conforming: r.conforming,
        lot_date: r.lotDate ?? r.lot_date,
        plant: r.plant,
    }));

    const ishikawa = getArray(obj.causesIshikawa ?? obj.causes_ishikawa ?? obj.ishikawa).map((r) => stamp({
        category: r.category,
        description: r.description,
        metric_value: r.metricValue ?? r.metric_value,
        is_root_cause: r.isRootCause ?? r.is_root_cause,
        source: r.source,
    }));

    const fiveWhy = getArray(obj.fiveWhyChain ?? obj.five_why_chain ?? obj.fiveWhy ?? obj.five_why).map((r) => stamp({
        step_no: r.stepNo ?? r.step_no,
        question: r.question,
        answer: r.answer,
        evidence_citation: r.evidenceCitation ?? r.evidence_citation,
    }));

    const actions = getArray(obj.actions).map((r) => stamp({
        line_no: r.lineNo ?? r.line_no,
        action_type: r.actionType ?? r.action_type,
        action_text: r.actionText ?? r.action_text,
        status: r.status,
    }));

    const team = getArray(obj.teamAssignments ?? obj.team_assignments ?? obj.team).map((r) => stamp({
        partner_id: String(r.partnerId ?? r.partner_id ?? '').replace(/^BP-/i, ''),
        partner_name: r.partnerName ?? r.partner_name,
        function_title: r.functionTitle ?? r.function_title,
        partner_role: r.partnerRole ?? r.partner_role,
        email: r.email,
        phone: r.phone,
    }));

    const fmea = getObj(obj.fmeaLink ?? obj.fmea_link ?? obj.fmea);
    const fmeaList = fmea ? [stamp({
        fmea_id: fmea.fmeaId ?? fmea.fmea_id,
        description: fmea.description,
    })] : [];

    const cost = getObj(obj.costCopq ?? obj.cost_copq ?? obj.cost);
    const copqVal = typeof obj.copqEur === 'number' ? obj.copqEur : (cost?.costOfPoorQualityEur ?? cost?.cost_of_poor_quality_eur ?? cost?.copqEur);
    const costList = copqVal != null ? [stamp({ cost_of_poor_quality_eur: copqVal })] : [];

    const ll = getObj(obj.lessonsLearned ?? obj.lessons_learned);
    const llList = ll ? [stamp({
        what_worked: ll.whatWorked ?? ll.what_worked,
        what_didnt: ll.whatDidnt ?? ll.what_didnt,
    })] : [];

    const iin = getObj(obj.isIsNot ?? obj.is_is_not);
    const iinList = iin ? [stamp({
        is_where_when_it_happens: iin.isWhereWhenItHappens ?? iin.is_where_when_it_happens ?? iin.is,
        is_not_where_when_it_doesnt: iin.isNotWhereWhenItDoesnt ?? iin.is_not_where_when_it_doesnt ?? iin.isNot,
        notes: iin.notes,
    })] : [];

    const cref = getObj(obj.customerReference ?? obj.customer_reference);
    const crefList = cref ? [stamp({
        complaint_reference: cref.complaintReference ?? cref.complaint_reference,
        customer_plant_contact: cref.customerPlantContact ?? cref.customer_plant_contact,
        sla_response_due: cref.slaResponseDue ?? cref.sla_response_due,
    })] : [];

    const resp = getObj(obj.responsibility ?? obj.responsibility_info);
    const respList = resp ? [stamp({
        reported_by: resp.reportedBy ?? resp.reported_by,
        coordinator: resp.coordinator,
        department: resp.department,
    })] : [];

    const matId = material?.materialId ?? material?.material_id ?? obj.materialId ?? obj.material_id;
    const matDesc = material?.description ?? obj.materialDesc ?? obj.material_desc;
    const matGroup = material?.materialGroup ?? material?.material_group
        ?? obj.materialGroup ?? obj.material_group;
    const plant = material?.plant ?? obj.plant ?? obj.plantId ?? obj.plant_id;

    const batchId = batch?.batchId ?? batch?.batch_id ?? obj.batchId ?? obj.batch_id;

    const defCode = defect?.defectCode ?? defect?.defect_code ?? obj.defectCode ?? obj.defect_code;
    const defText = defect?.defectText ?? defect?.defect_text ?? obj.defectText ?? obj.defect_text;
    // Nhóm và mức nghiêm trọng nhận cả `codeGroup`/`code_group` lẫn `severity`: form
    // gửi tên này, workbook cũ gửi tên kia, và cả hai đều là dữ liệu thật.
    const defGroup = defect?.defectCodeGroup ?? defect?.defect_code_group ?? defect?.codeGroup ?? defect?.code_group
        ?? obj.defectCodeGroup ?? obj.defect_code_group;
    const defClass = defect?.defectClass ?? defect?.defect_class ?? defect?.severity
        ?? obj.defectClass ?? obj.defect_class;

    const wcId = wc?.workCenterId ?? wc?.work_center_id ?? obj.workCenterId ?? obj.work_center_id;
    const wcDesc = wc?.description ?? obj.workCenterDesc ?? obj.work_center_desc;

    return {
        materials: matId ? [{ material_id: matId, description: matDesc, material_group: matGroup, plant }] : [],
        batches: batchId ? [{ batch_id: batchId, material_id: matId }] : [],
        defect_catalog: defCode
            ? [{ defect_code: defCode, defect_text: defText, defect_code_group: defGroup, defect_class: defClass }]
            : [],
        work_centers: wcId ? [{ work_center_id: wcId, description: wcDesc }] : [],
        notifications: [{
            notification_id: nid,
            material_id: matId,
            plant,
            batch_id: batchId,
            defect_code: defCode,
            defect_code_group: defGroup,
            work_center_id: wcId,
            ...header,
        }],
        inspections,
        causes_ishikawa: ishikawa,
        actions,
        five_why_chain: fiveWhy,
        team_assignments: team,
        fmea_link: fmeaList,
        cost_copq: costList,
        lessons_learned: llList,
        is_is_not: iinList,
        customer_reference: crefList,
        responsibility: respList,
        historical_inspection_lots: histLots,
        spc_process_data: [],
    };
}

// ─────────────────────────────────────────────────────────────────────────────

export function mapCase(raw: any): CaseContext {
    const data: Row | null = extractDeepCase(raw);

    if (!data) {
        throw new PipelineError(
            "Payload không đúng cấu trúc case 8D (Deep Structure JSON hoặc Golden Dataset).",
            400,
        );
    }

    const note = one(data, 'notifications');
    if (!note) throw new PipelineError('Dataset không có dòng notifications nào.', 400);

    const gaps: string[] = [];
    const origin = String(note.origin ?? '');
    const isCustomerFacing = origin === ORIGIN_CUSTOMER;

    const material = one(data, 'materials') ?? {};
    const batch = one(data, 'batches') ?? {};
    const defect = one(data, 'defect_catalog') ?? {};
    const workCenter = one(data, 'work_centers') ?? {};

    // ── Đo đạc ──
    const inspections: InspectionRow[] = rows(data, 'inspections').map((r) => {
        const char = cleanField(r.characteristic);
        const measured = cleanField(r.measured_value ?? r.measuredValue);
        const lo = num(r.spec_lower_limit ?? r.specLowerLimit);
        const hi = num(r.spec_upper_limit ?? r.specUpperLimit);
        const uom = text(r.spec_uom ?? r.specUom ?? r.unit);
        const valuation: Valuation | null = isValuation(r.valuation)
            ? (String(r.valuation).trim() as Valuation)
            : null;
        // Chuỗi người dùng gõ được ưu tiên giữ nguyên văn; chỉ khi không có mới
        // dựng câu từ hai giới hạn.
        const spec = cleanField(r.spec_value ?? r.specValue) || formatSpecRange(lo, hi, uom);
        return {
            characteristic: char,
            measuredValue: measured,
            specValue: spec,
            specLowerLimit: lo,
            specUpperLimit: hi,
            specUom: uom,
            valuation,
            equipment: text(r.equipment ?? r.fixture),
            outOfSpec: resolveOutOfSpec({
                measuredValue: measured, specValue: spec,
                specLowerLimit: lo, specUpperLimit: hi, valuation,
            }),
        };
    }).filter((i) => i.characteristic || i.measuredValue || i.specValue || i.equipment);

    const historicalLots: HistoricalInspectionLot[] = rows(data, 'historical_inspection_lots').map((r) => ({
        lotId: String(r.lot_id ?? ''),
        materialId: String(r.material_id ?? ''),
        characteristic: String(r.characteristic ?? ''),
        equipment: text(r.equipment),
        workCenterId: text(r.work_center_id),
        measuredValue: text(r.measured_value),
        conforming: Boolean(r.conforming),
        lotDate: normalizeDate(r.lot_date),
        plant: text(r.plant),
    }));
    if (!inspections.length) gaps.push('No inspection results — D2 cannot be quantified from measurements.');
    if (inspections.length && inspections.every((i) => i.outOfSpec === null)) {
        gaps.push('Inspection values could not be compared with the specification automatically.');
    }
    // Một dòng không kết luận được là một dòng KHÔNG có valuation và KHÔNG có giới
    // hạn số — tức là người nhập bỏ trống cả hai lối, chứ không phải parser hỏng.
    // Nói đích danh đặc tính nào, vì đó là thứ người sửa cần biết.
    const unresolved = inspections.filter((i) => i.outOfSpec === null).map((i) => i.characteristic || '(unnamed)');
    if (unresolved.length && unresolved.length < inspections.length) {
        gaps.push(`No valuation or numeric limits recorded for ${unresolved.join(', ')} — those rows were not judged.`);
    }
    const outOfSpecInspections = inspections.filter((i) => i.outOfSpec === true);
    if (outOfSpecInspections.length > 1) {
        const comparedChar = outOfSpecInspections[0].characteristic;
        const uncomparedChars = outOfSpecInspections.slice(1).map((i) => i.characteristic).join(', ');
        gaps.push(
            `Is/Is-Not was computed for ${comparedChar}. ${uncomparedChars} is also out of specification and was not compared.`,
        );
    }

    // ── Ishikawa + root cause ──
    const ishikawa: IshikawaRow[] = rows(data, 'causes_ishikawa').map((r) => ({
        category: String(r.category ?? ''),
        description: String(r.description ?? ''),
        metricValue: text(r.metric_value),
        isRootCause: isRootCauseFlag(r.is_root_cause),
        source: String(r.source ?? ''),
    }));
    const rootRow = ishikawa.find((r) => r.isRootCause) ?? null;
    if (!rootRow) gaps.push('No Ishikawa row is flagged as the root cause — D4 rests on the 5-Why chain alone.');

    // ── 5-Why ──
    const fiveWhy: FiveWhyRow[] = rows(data, 'five_why_chain')
        .map((r) => ({
            stepNo: Number(r.step_no),
            question: String(r.question ?? ''),
            answer: String(r.answer ?? ''),
            evidenceCitation: String(r.evidence_citation ?? ''),
            isRootCauseStep: String(r.question ?? '').toLowerCase().includes('(root cause)'),
        }))
        .sort((a, b) => a.stepNo - b.stepNo);
    if (!fiveWhy.length) gaps.push('No 5-Why chain — D4 has no causal reasoning to cite.');

    // ── Actions, gom theo ánh xạ do dataset khai ──
    const toAction = (r: Row): ActionRow => ({
        lineNo: Number(r.line_no),
        actionType: String(r.action_type ?? ''),
        actionText: String(r.action_text ?? ''),
        status: String(r.status ?? ''),
    });
    const allActions = rows(data, 'actions').map(toAction).sort((a, b) => a.lineNo - b.lineNo);
    const byType = (t: keyof typeof ACTION_TYPE_TO_STEP) =>
        allActions.filter((a) => classifyAction(a.actionType) === t);

    const actions = {
        containment: byType('Containment'),
        corrective: byType('Corrective'),
        preventive: byType('Preventive'),
    };
    const unclassified = allActions.filter((a) => classifyAction(a.actionType) === null);
    if (unclassified.length) {
        gaps.push(
            `${unclassified.length} action(s) have no recognisable type and could not be assigned ` +
            'to D3, D5 or D7.',
        );
    }
    if (!actions.containment.length) gaps.push('No containment action recorded — D3 has no source data.');
    if (!actions.corrective.length) gaps.push('No corrective action recorded — D5 has no source data.');
    if (!actions.preventive.length) gaps.push('No preventive action recorded — D7 has no source data.');

    // ── Team ──
    const teamRows: TeamRow[] = rows(data, 'team_assignments').map((r) => ({
        partnerId: String(r.partner_id ?? '').replace(/^BP-/i, ''),
        partnerName: String(r.partner_name ?? ''),
        functionTitle: String(r.function_title ?? ''),
        partnerRole: String(r.partner_role ?? ''),
        email: r.email ? String(r.email) : null,
        phone: r.phone ? String(r.phone) : null,
    }));
    // Vai trò hay bị bỏ trống. Không có ai được đánh dấu thì lấy người đầu tiên
    // làm trưởng nhóm — thứ tự dòng trong SAP thường phản ánh đúng điều đó — và
    // ghi nhận là suy đoán để model biết mà không khẳng định chắc chắn.
    let leader = teamRows.find((r) => r.partnerRole === '8D Team Leader') ?? null;
    if (!leader && teamRows.length) {
        leader = teamRows[0];
        gaps.push('No team leader was marked; assuming the first listed member leads the team.');
    }
    const members = teamRows.filter((r) => r !== leader);
    if (!teamRows.length) gaps.push('No 8D team members recorded — D1 has no source data.');

    // ── Phần còn lại ──
    const fmeaRow = one(data, 'fmea_link');
    const fmea = fmeaRow?.fmea_id
        ? { fmeaId: String(fmeaRow.fmea_id), description: String(fmeaRow.description ?? '') }
        : null;
    if (!fmea) gaps.push('No FMEA link — D7 cannot reference an existing failure-mode entry.');

    const costRow = one(data, 'cost_copq');
    const rawCopq = costRow?.cost_of_poor_quality_eur;
    const copqEur = isBlankish(rawCopq) ? null : firstNumber(String(rawCopq));
    if (copqEur === null) gaps.push('No cost of poor quality recorded.');

    // Một dòng lessons learned mà cả hai vế đều trống thì không phải lessons
    // learned — nó là một hàng bảng rỗng. Trả null để D8 biết là thiếu dữ liệu,
    // thay vì nhận hai chuỗi rỗng rồi tưởng có nội dung.
    const llRow = one(data, 'lessons_learned');
    const whatWorked = text(llRow?.what_worked);
    const whatDidnt = text(llRow?.what_didnt);
    const lessonsLearned = whatWorked || whatDidnt
        ? { whatWorked: whatWorked ?? '', whatDidnt: whatDidnt ?? '' }
        : null;
    if (!lessonsLearned) gaps.push('No lessons learned recorded — D8 has no source data.');

    // Is/Is-Not chỉ có giá trị khi có ít nhất một vế. Cả hai trống thì bỏ hẳn —
    // đây là công cụ khoanh vùng của D2, và một bảng rỗng không khoanh được gì.
    const iinRow = one(data, 'is_is_not');
    const iinIs = text(iinRow?.is_where_when_it_happens);
    const iinIsNot = text(iinRow?.is_not_where_when_it_doesnt);
    const isIsNot = iinIs || iinIsNot
        ? { is: iinIs ?? '', isNot: iinIsNot ?? '', notes: text(iinRow?.notes) }
        : null;
    if (!isIsNot) {
        gaps.push('No Is / Is-Not comparison recorded — the problem boundary is undefined.');
    }

    // ── Khách hàng ──
    // Với case Q3, ba trường này là chuỗi 'N/A - ...' CÓ CHỦ ĐÍCH. Giữ nguyên
    // giá trị và hạ cờ `applicable`, để model biết đây là "không áp dụng" chứ
    // không phải "thiếu dữ liệu".
    //
    // Mã khiếu nại RỖNG cũng là "không dùng được", ngang với sentinel 'N/A - ...'.
    // Trước đây form lấp chỗ trống bằng 'CC-2026-PENDING' nên trường hợp này chưa
    // bao giờ tới đây; giờ form gửi null, và null phải hạ cờ chứ không được đi
    // tiếp thành một case Q1 trông như có tham chiếu khách hàng.
    const crefRow = one(data, 'customer_reference');
    const custApplicable =
        isCustomerFacing &&
        !!crefRow &&
        !!text(crefRow.complaint_reference) &&
        !isDeliberateNA(crefRow.complaint_reference);
    const customer = {
        complaintReference: text(crefRow?.complaint_reference),
        plantContact: text(crefRow?.customer_plant_contact),
        slaResponseDue: text(crefRow?.sla_response_due),
        applicable: custApplicable,
    };
    if (isCustomerFacing && !custApplicable) {
        gaps.push('Customer complaint case but no usable customer reference data.');
    }

    // ── Lượng ảnh hưởng ──
    // Số và đơn vị là nguồn; `quantityExtent` chỉ được ghép khi case KHÔNG mang
    // sẵn chuỗi. Chiều ngược lại — parse '128 units affected' ra số — cố tình
    // không làm: 'units' không phải đơn vị đo, và đoán ra 'PC' là bịa.
    const defectQuantity = num(note.defect_quantity);
    const defectQuantityUom = text(note.defect_quantity_uom);
    const defectQuantityText = defectQuantity !== null
        ? `${defectQuantity}${defectQuantityUom ? ` ${defectQuantityUom}` : ''}`
        : '';

    // ── Cách phát hiện ──
    // Khiếu nại khách hàng không có lô kiểm tra (xem `originAllowsInspectionLot`).
    // Payload vẫn có thể mang một số lô — form cũ cho gõ, và file import thì
    // không ai kiểm. Bỏ nó ở ĐÂY, tại ranh giới fact, thay vì để nó đi tiếp và
    // được trích dẫn như bằng chứng. Có gap để việc bỏ đi không diễn ra âm thầm.
    const lotAllowed = originAllowsInspectionLot(origin);
    const rawLotId = text(note.inspection_lot_id);
    const inspectionLotId = lotAllowed ? rawLotId : null;
    if (!lotAllowed && rawLotId) {
        gaps.push(
            `Inspection lot ${rawLotId} was recorded against a customer complaint and has been dropped — `
            + 'a customer complaint is raised after delivery, so it has no inspection lot of ours.',
        );
    }
    const entryMode = lotAllowed ? text(note.entry_mode) : 'outside-inspection';

    // ── Trách nhiệm & người báo cáo ──
    const respRow = one(data, 'responsibility');
    const responsibility = {
        reportedBy: text(respRow?.reported_by ?? respRow?.reportedBy ?? note.reported_by ?? note.reportedBy),
        coordinator: text(respRow?.coordinator ?? note.coordinator),
        department: text(respRow?.department ?? note.department),
    };

    return {
        notificationId: id(note.notification_id),
        origin,
        isCustomerFacing,
        header: {
            symptomShortText: String(note.symptom_short_text ?? ''),
            status: String(note.status ?? ''),
            foundDate: normalizeDate(note.found_date),
            completionDate: normalizeDate(note.completion_date),
            quantityExtent: String(note.quantity_extent ?? '') || defectQuantityText,
            defectQuantity,
            defectQuantityUom,
            teamSize: typeof note.team_size === 'number' ? note.team_size : null,
            entryMode,
            inspectionLotId,
            referenceNumber: text(note.reference_number),
        },
        product: {
            plant: id(note.plant ?? material.plant),
            materialId: id(note.material_id ?? material.material_id),
            materialDesc: id(material.description),
            materialGroup: id(material.material_group ?? note.material_group),
            batchId: id(note.batch_id ?? batch.batch_id),
            // Nhóm đọc từ notification TRƯỚC, vì đó là nhóm đã chọn cho case này;
            // dòng catalogue chỉ là bản sao và có thể thiếu ở dữ liệu cũ.
            defectCodeGroup: id(note.defect_code_group ?? defect.defect_code_group),
            defectCode: id(note.defect_code ?? defect.defect_code),
            defectText: id(defect.defect_text),
            defectClass: id(defect.defect_class ?? note.defect_class),
            workCenterId: id(note.work_center_id ?? workCenter.work_center_id),
            workCenterDesc: id(workCenter.description),
        },
        inspections,
        historicalInspectionLots: historicalLots.length > 0 ? historicalLots : undefined,
        isIsNot,
        rootCause: rootRow
            ? {
                category: rootRow.category,
                description: rootRow.description,
                metricValue: rootRow.metricValue,
                source: rootRow.source,
            }
            : null,
        ishikawa,
        fiveWhy,
        actions,
        team: { leader, members },
        fmea,
        copqEur,
        lessonsLearned,
        customer,
        responsibility,
        unmapped: {},
        gaps,
    };
}
