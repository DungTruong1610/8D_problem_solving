/**
 * Hợp đồng dữ liệu của pipeline 8D.
 *
 *   raw JSON  →  CaseContext  →  EightDResult
 *
 * `CaseContext` là ranh giới quan trọng nhất trong toàn bộ tính năng: nó là tập
 * fact đã được xác minh. Mọi thứ sau nó chỉ được diễn đạt lại những fact này,
 * không được thêm fact mới. Model nào bịa ra một con số không có ở đây là sai,
 * và `sources` trên mỗi discipline tồn tại để bắt được điều đó.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Bước 1 — facts
// ─────────────────────────────────────────────────────────────────────────────

export const ORIGIN_INTERNAL = 'Q3 - Internal Defect';
export const ORIGIN_CUSTOMER = 'Q1 - Customer Complaint';
/**
 * Q2 — lỗi do nhà cung cấp.
 *
 * Đường nhập JSON vẫn ánh xạ được Q2 từ trước, và kho case có case Q2, nhưng
 * dropdown của form chỉ có Q1 và Q3. Nghĩa là có một loại case chỉ vào được hệ
 * thống qua cửa import, không ai gõ tay được — và không ai biết vì sao.
 */
export const ORIGIN_SUPPLIER = 'Q2 - Supplier Defect';

export type Origin =
    | typeof ORIGIN_INTERNAL
    | typeof ORIGIN_CUSTOMER
    | typeof ORIGIN_SUPPLIER;

/**
 * Nguồn gốc này có lô kiểm tra được không?
 *
 * Lô kiểm tra là một đối tượng của NHÀ MÁY MÌNH. Khiếu nại khách hàng đến sau
 * khi hàng đã rời cổng — cái lô kiểm tra đã đóng từ lâu, và nếu nó bắt được lỗi
 * này thì hàng đã không đi. Gắn một số lô vào case Q1 là dựng một mắt xích
 * không tồn tại, rồi mọi thứ đọc chuỗi đó về sau sẽ tin nó.
 *
 * Đặt ở đây chứ không nằm trong component: cả form lẫn pipeline phía server đều
 * cần cùng câu trả lời, và hai bản sao của một luật sẽ lệch nhau.
 */
export function originAllowsInspectionLot(origin: string): boolean {
    return String(origin ?? '').trim() !== ORIGIN_CUSTOMER;
}

export const ISHIKAWA_CATEGORIES = [
    'Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment',
] as const;
export type IshikawaCategory = (typeof ISHIKAWA_CATEGORIES)[number];

/** Ánh xạ do chính dataset khai ở `schema.enumerations.action_type_to_8d_step`. */
export const ACTION_TYPE_TO_STEP = {
    Containment: 'D3',
    Corrective: 'D5',
    Preventive: 'D7',
} as const;

export interface ActionRow {
    lineNo: number;
    actionType: string;
    actionText: string;
    status: string;

    /**
     * ── Ba trường Quality Task, chỉ có ở case đóng TRONG app ──
     * Dataset nhập vào không mang người thực hiện, công sức hay hạn của từng
     * hành động — nó chỉ mang một câu văn và một trạng thái. Nên ba trường này
     * là optional chứ không phải bắt buộc-nhưng-rỗng: `undefined` ở đây nói
     * "nguồn không có", khác hẳn với "có mà bỏ trống".
     *
     * `taskCode`/`taskCodeGroup` KHÔNG nằm ở đây: chúng suy ra từ `actionText`
     * ở đúng một chỗ (`writeHistoricalCase`), nên mọi đường vào kho đều mã hoá
     * bằng cùng một bộ luật.
     */
    taskProcessor?: string | null;
    timeEffort?: number | null;
    plannedEndDate?: string | null;
}

export interface TeamRow {
    partnerId: string;
    partnerName: string;
    functionTitle: string;
    partnerRole: string;
    email?: string | null;
    phone?: string | null;
}

/**
 * Phán quyết của người kiểm cho MỘT đặc tính — bước ③ của chuỗi SAP.
 *
 * Đây là dữ kiện, không phải suy luận: người kiểm nhìn số đo, đối chiếu spec, rồi
 * quyết. Có nó thì `outOfSpec` không còn phải đoán từ chuỗi.
 */
export const VALUATIONS = ['Accepted', 'Rejected'] as const;
export type Valuation = (typeof VALUATIONS)[number];

export function isValuation(v: unknown): v is Valuation {
    return VALUATIONS.includes(String(v ?? '').trim() as Valuation);
}

export interface InspectionRow {
    characteristic: string;
    measuredValue: string;
    /**
     * Spec dạng chuỗi để HIỂN THỊ và để trích dẫn trong 8D.
     *
     * Dựng từ hai giới hạn bên dưới khi có chúng; ở dữ liệu cũ (workbook, JSON
     * import) đây là văn bản tự do và là thứ duy nhất có. Không còn là nguồn duy
     * nhất để kết luận vượt spec — xem `resolveOutOfSpec`.
     */
    specValue: string;
    /**
     * Giới hạn dưới / trên đã tách thành SỐ, và đơn vị đứng riêng.
     *
     * ── Vì sao tách ──
     * Một chuỗi 'max 0.10mm' phải được parse lại mỗi lần muốn so, và parse hỏng
     * thì `outOfSpec` về null — trong khi `postProcess` chọn đặc tính cho Is/Is-Not
     * DỰA TRÊN `outOfSpec`. Nghĩa là một lỗi parse âm thầm đổi luôn đặc tính mà D2
     * đem ra so sánh. Số thì không parse hỏng được.
     *
     * `null` ở một vế nghĩa là spec một phía: chỉ `max` hoặc chỉ `min`. Cả hai null
     * nghĩa là dòng này chưa khai giới hạn — và khi đó `valuation` phải gánh.
     */
    specLowerLimit: number | null;
    specUpperLimit: number | null;
    specUom: string | null;
    /** Bước ③ của SAP. Người kiểm quyết định; ta không suy ra hộ. */
    valuation: Valuation | null;
    equipment?: string | null;
    /**
     * Có vượt spec không.
     *
     * Thứ tự nguồn: `valuation` → hai giới hạn số → parse chuỗi `specValue` (chỉ
     * còn cho dữ liệu cũ). `null` khi không nguồn nào kết luận được. Để null chứ
     * không đoán — một phán quyết sai ở đây sẽ được model dùng làm bằng chứng cho
     * D2 và D4.
     */
    outOfSpec: boolean | null;
}

export interface HistoricalInspectionLot {
    lotId: string;
    materialId: string;
    characteristic: string;
    equipment?: string | null;
    /** Work center của lô. Có thật trên bảng chứ không cắt từ mã equipment. */
    workCenterId?: string | null;
    measuredValue?: string | null;
    conforming: boolean;
    lotDate?: string | null;
    plant?: string | null;
}

export interface IshikawaRow {
    category: string;
    description: string;
    metricValue: string | null;
    isRootCause: boolean;
    source: string;
}

export interface FiveWhyRow {
    stepNo: number;
    question: string;
    answer: string;
    evidenceCitation: string;
    /** Bước được đánh dấu '(root cause)' trong câu hỏi. */
    isRootCauseStep: boolean;
}

/**
 * Tập fact đã xác minh của một case. Đây là thứ duy nhất được gửi cho model ở
 * bước sinh 8D — dataset thô không bao giờ đi thẳng vào prompt.
 */
export interface CaseContext {
    notificationId: string;
    origin: Origin | string;
    /** true khi origin = Q1. Quyết định có sinh customerSummary hay không. */
    isCustomerFacing: boolean;

    header: {
        symptomShortText: string;
        status: string;
        foundDate: string | null;
        completionDate: string | null;
        /**
         * Chuỗi hiển thị của lượng ảnh hưởng ('128 units affected', hoặc '128 PC'
         * ghép từ hai trường dưới).
         *
         * GIỮ LẠI dù đã có số: nó là một `evidence path` mà model được phép trích
         * dẫn (`header.quantityExtent`), và toàn bộ kho tiền lệ lưu bằng cột này.
         * Bỏ đi là đổi hợp đồng trích dẫn của mọi case cũ để lấy về đúng một trường
         * mà UI chỉ đem ra in.
         */
        quantityExtent: string;
        /**
         * Lượng ảnh hưởng dạng SỐ, kèm đơn vị. Đây mới là thứ đếm được.
         *
         * `null` ở case cũ: workbook chỉ ghi văn xuôi, và ép một câu chữ thành số
         * là tự nhận rủi ro parse sai để đổi lấy một con số không ai kiểm chứng.
         */
        defectQuantity: number | null;
        defectQuantityUom: string | null;
        teamSize: number | null;
        entryMode?: string | null;
        inspectionLotId?: string | null;
        /** Số tham chiếu bên ngoài (khiếu nại của khách, phiếu giao của NCC, ticket). */
        referenceNumber?: string | null;
    };

    product: {
        /**
         * Nhà máy (WERKS). Chuỗi rỗng ở dữ liệu cũ — workbook không khai nhà máy.
         * Cần cho F4 lô kiểm tra (lọc theo vật tư + nhà máy) ở bước sau.
         */
        plant: string;
        materialId: string;
        materialDesc: string;
        /**
         * Nhóm vật tư (MATKL của SAP). Dùng cho tiêu chí "cùng họ vật tư: +1"
         * khi tìm tiền lệ.
         *
         * Chuỗi rỗng khi nguồn không khai nhóm — khi đó tiêu chí đó không bao
         * giờ ăn điểm. Cố ý không suy ra từ tiền tố mã vật tư: `MAT-10247` và
         * `MAT-10318` giống nhau bốn ký tự đầu mà chẳng liên quan gì nhau.
         */
        materialGroup: string;
        batchId: string;
        /**
         * Nhóm mã lỗi (catalog type 9). Mã lỗi chỉ duy nhất TRONG một nhóm, nên
         * `defectCode` một mình là khoá thiếu vế — hai nhóm khác nhau có thể cùng
         * dùng mã `0001`.
         *
         * Chuỗi rỗng khi nguồn cũ không khai nhóm. Case import từ workbook nằm hết
         * ở nhóm này; đừng suy ngược nhóm từ mã, vì suy sai thì D2 in ra một khoá
         * nghe rất SAP mà tra không ra.
         */
        defectCodeGroup: string;
        defectCode: string;
        defectText: string;
        /**
         * Mức nghiêm trọng của mã lỗi (SAP FECLAS). Lấy từ danh mục qua F4, không
         * do người nhập gõ — cùng một mã lỗi phải luôn có cùng mức, nếu không thì
         * xếp hạng ưu tiên giữa các case mất hết ý nghĩa.
         */
        defectClass: string;
        workCenterId: string;
        workCenterDesc: string;
    };

    inspections: InspectionRow[];

    /** Lịch sử kiểm tra theo lô — nguồn dân số để phân tích Is / Is-Not. */
    historicalInspectionLots?: HistoricalInspectionLot[];

    isIsNot: { is: string; isNot: string; notes: string | null } | null;

    /** Dòng Ishikawa có `is_root_cause = 'Y'`. Dataset đảm bảo đúng một dòng. */
    rootCause: {
        category: string;
        description: string;
        metricValue: string | null;
        source: string;
    } | null;

    ishikawa: IshikawaRow[];
    fiveWhy: FiveWhyRow[];

    /** Đã gom sẵn theo `ACTION_TYPE_TO_STEP`. Mảng rỗng = case chưa có loại đó. */
    actions: {
        containment: ActionRow[];  // → D3
        corrective: ActionRow[];   // → D5
        preventive: ActionRow[];   // → D7
    };

    team: {
        leader: TeamRow | null;
        members: TeamRow[];
    };

    fmea: { fmeaId: string; description: string; workCenterId?: string | null; materialId?: string | null } | null;
    copqEur: number | null;
    lessonsLearned: { whatWorked: string; whatDidnt: string } | null;

    customer: {
        complaintReference: string | null;
        plantContact: string | null;
        slaResponseDue: string | null;
        /**
         * false với case Q3 — khi đó ba trường trên là chuỗi 'N/A - ...' CÓ CHỦ
         * ĐÍCH, không phải thiếu dữ liệu. Phân biệt hai thứ này để model không
         * báo "thiếu thông tin khách hàng" cho một lỗi nội bộ vốn không có khách.
         */
        applicable: boolean;
    };

    /** Người báo cáo, điều phối và phòng ban liên quan (Section 4 Responsibility). */
    responsibility: {
        reportedBy: string | null;
        coordinator: string | null;
        department: string | null;
    };

    /**
     * Những gì mapper không nhận ra. Bước AI parseData đọc phần này để bắt các
     * trường mà export SAP thật có nhưng Golden Dataset chưa có.
     */
    unmapped: Record<string, unknown>;

    /** Cảnh báo từ mapper: dữ liệu thiếu hoặc bất thường, không đủ để chặn. */
    gaps: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Bước 2 — báo cáo
// ─────────────────────────────────────────────────────────────────────────────

export const DISCIPLINE_CODES = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'] as const;
export const STEP_CODES = DISCIPLINE_CODES;
export type DisciplineCode = (typeof DISCIPLINE_CODES)[number];
export type StepCode = DisciplineCode;

export const DISCIPLINE_TITLES: Record<DisciplineCode, string> = {
    D1: 'Establish the Team',
    D2: 'Describe the Problem',
    D3: 'Interim Containment Actions',
    D4: 'Root Cause Analysis',
    D5: 'Permanent Corrective Actions',
    D6: 'Verify Effectiveness',
    D7: 'Prevent Recurrence',
    D8: 'Closure and Recognition',
};

export interface DisciplineDraft {
    code: DisciplineCode;
    sequence: number;
    title: string;
    /** 1-2 câu, plain text, ≤500 ký tự. */
    summary: string;
    /** Markdown. */
    content: string;
    actionItems: string[];
    /**
     * Đường dẫn về CaseContext, ví dụ 'actions.containment#1',
     * 'ishikawa.Machine', 'fiveWhy#2'. Rỗng nghĩa là discipline này không dựa
     * trên fact nào — chỉ chấp nhận được khi `dataBacked` là false.
     */
    sources: string[];
    confidence: number;
    /** false = không có dữ liệu nguồn, model suy luận. D6 luôn false. */
    dataBacked: boolean;
    /** Flexible D1-D4 output. Form Editor field keys are paths inside this object. */
    data?: Record<string, unknown>;
}

export interface EightDResult {
    internalSummary: string;
    /** null khi origin = Q3 — ràng buộc Q1-ONLY-CUSTOMER-FIELDS. */
    customerSummary: string | null;
    /** Đúng 8 phần tử, sắp theo `sequence`. */
    disciplines: DisciplineDraft[];
}

export interface AnalyzeOutcome {
    context: CaseContext;
    result: EightDResult;
    /**
     * Kết luận model tự rút ra khi CHƯA thấy đáp án, kèm kết quả đối chiếu.
     * Kiểu để lỏng ở đây nhằm tránh vòng import với `independentAnalysis.ts`.
     */
    independent: unknown;
    models: { parse: string; analyze: string };
    /**
     * Tiền lệ đã chấm điểm trong lượt chạy này — `{ union, byStep, profileByStep }`.
     *
     * Kiểu để lỏng vì `findPrecedents.ts` import ngược lại file này. Nó được lưu
     * nguyên văn vào `Reports.precedentsJson` để màn hình đọc lại đúng bộ tiền lệ
     * mà báo cáo đã dựa vào, thay vì chấm lại và có thể ra kết quả khác.
     */
    precedents?: unknown;
    tokensUsed: number;
    durationMs: number;
    /** Ghi chú của postProcess: chỗ nào phải chữa sau khi model trả về. */
    repairs: string[];
    runtime?: Partial<Record<DisciplineCode, {
        formSchemaJson: string;
        validationJson: string;
        configVersion: string;
        resultJson: string;
    }>>;
}

/** Lỗi có mã HTTP, để tầng service ánh xạ thẳng sang `req.error`. */
export class PipelineError extends Error {
    constructor(
        message: string,
        readonly code: number = 500,
        readonly details?: unknown,
    ) {
        super(message);
        this.name = 'PipelineError';
    }
}
