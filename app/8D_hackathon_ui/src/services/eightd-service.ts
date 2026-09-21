import { BaseODataService } from './core/base-service';
import { ODataQueryBuilder } from './core/odata-helper';
import axiosInstance from './core/axios-instance';
import { queryClient } from '@/query-client';
import {
    normalizePrecedents as normalizeShape,
    parseStoredPrecedents as parseStoredShape,
} from '../../../../shared/precedent-shape';

/**
 * Truy cập EightDService.
 *
 * ── Vòng đời một report ──
 * `analyzeFromJson` trả về NGAY với ID của một report ở trạng thái `Analyzing`;
 * pipeline AI chạy ở nền trên server và mất 60-90 giây. Client phải theo dõi
 * qua trường `status`, không có cách nào chờ đồng bộ.
 *
 * Sở dĩ vậy vì driver SQLite của CAP chỉ có một connection: bọc lời gọi AI
 * trong một transaction đang mở sẽ khoá toàn bộ DB suốt thời gian đó, kể cả
 * chính request đi hỏi tiến độ.
 */

export type ReportStatus = 'Draft' | 'Analyzing' | 'Analyzed' | 'Failed' | 'Closed';

export interface Discipline8D {
    ID: string;
    code: string;
    sequence: number;
    title: string;
    summary: string;
    content: string;
    /** Chuỗi JSON — dùng `parseList()` để đọc. */
    actionItems: string | null;
    /** Chuỗi JSON các đường dẫn về CaseContext. */
    sources: string | null;
    confidence: number;
    /** false = không có dữ liệu nguồn, AI suy luận ra. D6 luôn false. */
    dataBacked: boolean;
    resultJson: string | null;
    formSchemaJson: string | null;
    validationJson: string | null;
    configVersion: string | null;
    aiGenerated: boolean;

    /** 'Draft' | 'Approved' | 'ChangeRequested'. Null ở report phân tích trước khi có cột này. */
    reviewStatus: ReviewStatus | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
    /** Lý do trả lại. Chỉ có nghĩa khi reviewStatus = 'ChangeRequested'. */
    reviewNote: string | null;

    /** JSON mảng các fieldKey của AI đã được confirm. */
    confirmedFieldsJson: string | null;
    /** 'NotStarted' | 'InProgress' | 'Completed'. */
    workState: DisciplineWorkState | null;
}

export type DisciplineWorkState = 'NotStarted' | 'InProgress' | 'Completed';

export const REVIEW_STATUSES = ['Draft', 'Approved', 'ChangeRequested'] as const;
export type ReviewStatus = typeof REVIEW_STATUSES[number];

export type ReviewDecision = 'approve' | 'request-change' | 'reopen';

/** Cổng đóng case — server tính, client chỉ hiển thị. */
export interface ClosureGate {
    canClose: boolean;
    approved: number;
    required: number;
    blocking: string[];
    reason: string;
}

export interface ReviewEvent {
    ID: string;
    reportID: string;
    disciplineCode: string;
    fromStatus: string;
    toStatus: string;
    note: string | null;
    actor: string;
    at: string;
}

export interface ReviewResult {
    disciplineID: string;
    code: string;
    fromStatus: ReviewStatus;
    toStatus: ReviewStatus;
    reviewedBy: string;
    reviewedAt: string;
    gate: ClosureGate;
}

/**
 * Trạng thái duyệt đã chuẩn hoá.
 *
 * Report phân tích TRƯỚC khi có cột duyệt đọc lên là null. Mặc định sai chiều ở
 * đây sẽ hiện toàn bộ dữ liệu cũ là "đã duyệt" và mở cổng đóng case cho chúng.
 */
export function reviewStatusOf(discipline: Pick<Discipline8D, 'reviewStatus'>): ReviewStatus {
    const value = discipline.reviewStatus;
    return value && (REVIEW_STATUSES as readonly string[]).includes(value) ? value : 'Draft';
}

/** Đọc mảng các fieldKey đã confirm từ chuỗi JSON. */
export function parseConfirmedFields(json: string | null | undefined): string[] {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed.map(String).map((s) => s.trim()).filter(Boolean) : [];
    } catch {
        return [];
    }
}

/** Trạng thái xử lý của bước D: Approved -> Completed; còn lại là InProgress hoặc NotStarted. */
export function workStateOf(discipline: Pick<Discipline8D, 'workState' | 'reviewStatus'>): DisciplineWorkState {
    if (reviewStatusOf(discipline) === 'Approved') return 'Completed';
    const ws = discipline.workState;
    if (ws === 'InProgress') return 'InProgress';
    return 'NotStarted';
}

/** Một bước trong chuỗi 5-Why do AI tự dựng khi chưa thấy đáp án. */
export interface DerivedWhyStep {
    stepNo: number;
    question: string;
    answer: string;
    evidence: string;
}

export interface IndependentFinding {
    rootCauseCategory: string;
    rootCauseStatement: string;
    derivedFiveWhy: DerivedWhyStep[];
    ruledOut: Array<{ category: string; reason: string }>;
    runnerUpCategory: string | null;
    runnerUpReason: string | null;
    confidence: number;
    evidenceGaps: string[];
}

export interface IndependentAnalysis {
    finding: IndependentFinding;
    verdict: {
        recordedCategory: string | null;
        aiCategory: string;
        agrees: boolean;
        aiStepCount: number;
        recordedStepCount: number;
    };
    /** Chỗ rò đáp án phát hiện lúc kiểm tra. Rỗng là sạch. */
    leaks: string[];
}

/** Một tiêu chí đã chấm, kèm lý do ăn hay không ăn điểm. */
export interface PrecedentBreakdown {
    criterionKey: string;
    label: string;
    level: 'exact' | 'fallback' | 'none';
    matchedOn: string | null;
    points: number;
    maxPoints: number;
}

export interface PrecedentTeamMember {
    partnerId: string;
    partnerName: string;
    functionTitle: string;
    partnerRole: string;
}

export interface PrecedentAction {
    lineNo: number;
    actionType: string;
    actionText: string;
    status: string;
}

export interface Precedent {
    notificationId: string;
    score: number;
    maxScore: number;
    breakdown: PrecedentBreakdown[];
    explanation: string;
    symptomShortText: string | null;
    sapStatus: string | null;
    completionDate: string | null;
    quantityExtent: string | null;
    workCenterId: string | null;
    workCenterDesc: string | null;
    defectCode: string | null;
    defectText: string | null;
    materialId: string | null;
    materialDesc: string | null;
    rootCauseCategory: string | null;
    copqEur: number | null;
    fmeaId: string | null;
    team: PrecedentTeamMember[];
    actions: PrecedentAction[];
}

/**
 * Kết quả tìm tiền lệ, đã chuẩn hoá từ hình dạng backend trả về.
 *
 * Backend trả `{ union, byStep, profileByStep }`. `findPrecedents` ở tầng service
 * đổi sang hình dạng dưới đây — đừng đọc thẳng `union` ở component, nếu không
 * mỗi lần backend đổi khoá là mọi nơi hiển thị đều hỏng cùng lúc.
 */
export interface PrecedentResult {
    /** Hợp của mọi bước, đã khử trùng — dùng cho danh sách chung. */
    precedents: Precedent[];
    /** Tiền lệ riêng cho từng bước D1–D8. Một bước có thể có, bước khác không. */
    byStep: Record<string, Precedent[]>;
    /** Vì sao rỗng. Null khi có tiền lệ. */
    reason: string | null;
    /** Thang điểm tối đa, lấy từ tiền lệ đầu tiên — nó thuộc về từng tiền lệ. */
    maxScore: number;
}

export interface Report8D {
    ID: string;
    notificationId: string;
    origin: string;
    symptomShortText: string;
    sapStatus: string;
    foundDate: string | null;
    completionDate: string | null;
    /** Câu mô tả phạm vi. Vẫn là đường dẫn bằng chứng D3 nên giữ lại. */
    quantityExtent: string;
    /** RKMNG/MGEIN: số lượng bị ảnh hưởng, tách số khỏi đơn vị để còn tính được. */
    defectQuantity: number | null;
    defectQuantityUom: string | null;
    teamSize: number | null;
    entryMode: string | null;
    inspectionLotId: string | null;
    /** Số của hệ thống khác: phiếu khiếu nại, phiếu giao hàng, ticket. */
    referenceNumber: string | null;
    /**
     * Số lỗi mà báo cáo này được mở ra từ đó. Null với case nhập bằng JSON —
     * chúng không đi qua một bản ghi lỗi nào trong hệ thống này.
     */
    sourceDefectId: string | null;

    // ── Bốn cột của worklist (Phase 3.1) ──
    // Cả ba đã nằm trong `caseContext`, nhưng đó là LargeString chứa JSON: OData
    // không sắp xếp và không lọc theo nó được. Cột riêng là điều kiện để có cột
    // "Due Date" bấm sắp xếp được và chip lọc "Overdue" chạy được.
    /**
     * Hạn phản hồi khách. Chỉ Q1 mới có — Q2/Q3 để null theo quyết định Q12,
     * KHÔNG bịa hạn. Ô trống ở đây là câu trả lời đúng, không phải dữ liệu thiếu.
     */
    slaResponseDue: string | null;
    /** Người điều phối notification. Là chủ sở hữu dự phòng khi D1 chưa chốt. */
    coordinator: string | null;
    /** Trưởng nhóm 8D đã chốt ở D1. Null cho tới lúc đó — xem `syncTeamLeader`. */
    teamLeader: string | null;
    /**
     * Số hiệu khiếu nại của khách, ví dụ 'CC-2026-0442'. Null ở Q2/Q3.
     *
     * Đứng thay cho "tên khách hàng" mà kế hoạch xin ở cột Origin: dữ liệu không
     * có tên khách ở bất kỳ đâu, và số hiệu này là thứ duy nhất chỉ đích danh vụ
     * việc bên phía khách.
     */
    customerRef: string | null;

    /** WERKS — CHAR(4) số trần ('1000'). */
    plant: string;
    materialId: string;
    materialDesc: string;
    batchId: string;
    /** Nhóm mã lỗi. Đi kèm `defectCode`: mã chỉ duy nhất trong nhóm của nó. */
    defectCodeGroup: string;
    defectCode: string;
    defectText: string;
    /** SAP FECLAS. Hiện trên giao diện dưới nhãn "Severity". */
    defectClass: string;
    workCenterId: string;
    workCenterDesc: string;

    copqEur: number | null;
    rootCauseCategory: string | null;
    fmeaId: string | null;

    internalSummary: string | null;
    customerSummary: string | null;

    // ── Chẩn đoán độc lập ──
    /** JSON `IndependentAnalysis` — dùng `parseFinding()` để đọc. */
    aiFinding: string | null;
    aiRootCause: string | null;
    /** true = AI kết luận trùng kỹ sư mà không hề thấy đáp án. */
    aiAgreesWithRecord: boolean | null;
    aiConfidence: number | null;

    status: ReportStatus;
    sourcePayload?: string;
    caseContext?: string;
    /**
     * Bản chụp tiền lệ mà báo cáo này đã dựa vào, ghi lúc phân tích.
     *
     * Null ở report còn đang chạy, và ở report phân tích trước khi có cột này —
     * hai trường hợp đó mới phải gọi `findPrecedents` để chấm tại chỗ.
     */
    precedentsJson?: string | null;
    aiModelParse: string | null;
    aiModelAnalyze: string | null;
    analyzedAt: string | null;
    tokensUsed: number | null;
    durationMs: number | null;
    errorMessage: string | null;

    createdAt?: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
    disciplines?: Discipline8D[];
}

/** Cột đủ cho trang danh sách — đừng kéo về `sourcePayload` 50 KB mỗi dòng. */
const LIST_COLUMNS = [
    'ID', 'notificationId', 'sourceDefectId', 'origin', 'symptomShortText', 'materialId', 'materialDesc',
    'workCenterId', 'workCenterDesc', 'plant', 'rootCauseCategory', 'copqEur', 'status', 'analyzedAt', 'createdAt',
    'createdBy', 'modifiedAt', 'modifiedBy',
    // ── Worklist (Phase 3.2) ──
    // `foundDate` KHÔNG phải để tính Days Open — đồng hồ đó chạy từ `createdAt`.
    // Nó ở đây cho cột Response Lag: khoảng cách giữa lúc phát hiện lỗi và lúc mở
    // 8D. Hai con số khác nhau, và trước đây một cột giả vờ là cả hai.
    'foundDate', 'completionDate', 'slaResponseDue', 'coordinator', 'teamLeader', 'customerRef',
    // Mức nghiêm trọng: `defectClass` trên `Reports` gần như luôn null ở dữ liệu
    // hiện có, nên bảng tra tiếp theo `defectCode` trong danh mục F4. Kéo cả hai.
    'defectCode', 'defectClass',
    'tokensUsed', 'durationMs', 'errorMessage',
    'aiModelParse', 'aiModelAnalyze',
    // Cột chẩn đoán độc lập — nhẹ, và là thứ đáng nhìn nhất ở trang danh sách.
    'aiRootCause', 'aiAgreesWithRecord', 'aiConfidence',
];

class EightDService extends BaseODataService<Report8D> {
    constructor() {
        super('api/cnma/EIGHTD_SRV', 'Reports');
    }

    /**
     * Khoá là Edm.Guid, viết TRẦN chứ không bọc nháy.
     *
     * `formatKey` mặc định của lớp cha bọc chuỗi trong dấu nháy đơn — đúng với
     * khoá kiểu String, nhưng OData v4 quy định Guid literal không có nháy, nên
     * `Reports('3f2a…')` sẽ trả 400.
     */
    protected formatKey(id: string | number): string {
        return String(id);
    }

    /**
     * Danh sách, mới nhất trước.
     *
     * Kèm `code` + `reviewStatus` của tám discipline để bảng vẽ được cột tiến độ
     * "x/8 đã duyệt". Chỉ hai cột đó, KHÔNG kéo `content`/`resultJson` — chúng là
     * LargeString và sẽ biến một truy vấn danh sách thành vài megabyte.
     */
    async list() {
        return this.getList(
            new ODataQueryBuilder()
                .select(LIST_COLUMNS)
                .expand('disciplines($select=code,reviewStatus)')
                .orderBy('createdAt', 'desc')
                .count(),
        );
    }

    /**
     * Một report kèm đủ 8 discipline.
     *
     * `$orderby=sequence` là BẮT BUỘC — OData không đảm bảo thứ tự nếu không nói
     * rõ, và một báo cáo 8D hiện lộn xộn D5 trước D2 thì vô nghĩa.
     */
    async getWithDisciplines(id: string) {
        return this.getById(
            id,
            new ODataQueryBuilder().expand('disciplines($orderby=sequence)'),
        );
    }

    /** Chỉ trạng thái — dùng cho vòng poll, tránh kéo cả báo cáo về mỗi 3 giây. */
    async getStatus(id: string) {
        return this.getById(
            id,
            new ODataQueryBuilder().select(['ID', 'status', 'errorMessage']),
        ) as Promise<Pick<Report8D, 'ID' | 'status' | 'errorMessage'>>;
    }

    /**
     * Xếp lịch phân tích một Golden Dataset.
     * @returns ID của report vừa tạo, đang ở trạng thái `Analyzing`
     */
    async analyzeFromJson(payload: string, title = ''): Promise<string> {
        const res = await axiosInstance.post<{ value: string }>(
            `${this.serviceName}/analyzeFromJson`,
            { payload, title },
        );
        return res.data.value;
    }

    /**
     * Sửa hạn cam kết và người điều phối của một case đang chạy.
     *
     * Chuỗi rỗng nghĩa là XOÁ trường đó — khác `startEightD`, nơi để trống nghĩa
     * là "lấy giá trị suy từ payload". Đây là màn hình sửa, không phải màn hình
     * tạo, nên ô trống phải mang đúng nghĩa người dùng thấy.
     */
    async setCaseCommitments(
        reportID: string,
        commitments: { dueDate?: string | null; coordinator?: string | null },
    ): Promise<string> {
        const res = await axiosInstance.post<{ value: string }>(
            `${this.serviceName}/setCaseCommitments`,
            {
                reportID,
                dueDate: commitments.dueDate ?? '',
                coordinator: commitments.coordinator ?? '',
            },
        );
        return res.data.value;
    }

    /** Chạy lại trên payload đã lưu. Ghi đè toàn bộ disciplines cũ. */
    async reanalyze(reportID: string): Promise<string> {
        const res = await axiosInstance.post<{ value: string }>(
            `${this.serviceName}/reanalyze`,
            { reportID },
        );
        return res.data.value;
    }

    /**
     * Nạp case vào kho tiền lệ.
     *
     * ── Vì sao không tạo từng dòng bằng OData ──
     * Bản đầu của hộp thoại Import JSON gọi `POST HistoricalCases` cho từng phần
     * tử và tự tay map khoảng 20 trường. Dòng sinh ra thiếu `defectKeywords`,
     * `searchText`, `attributesJson` và toàn bộ nhóm 8D — tức là nó nằm trong
     * kho, hiện ra trên màn hình, và ăn 0 điểm ở mọi tiêu chí. Nhìn từ ngoài
     * giống hệt "không có case nào tương tự".
     *
     * Action này đi qua đúng bộ mapper mà pipeline phân tích dùng, nên hiểu cả
     * bốn định dạng payload và tính đủ mọi cột dẫn xuất. Thay thế theo
     * `notificationId`, nên nạp lại cùng một bộ dữ liệu là an toàn.
     *
     * @param payload Mảng JSON các case, hoặc một case đơn lẻ.
     * @returns JSON `SeedReport`: { inserted, replaced, skipped[], total }
     */
    async seedCaseLibrary(payload: unknown): Promise<{
        inserted: number;
        replaced: number;
        skipped: Array<{ index: number; notificationId: string | null; reason: string }>;
        total: number;
    }> {
        const res = await axiosInstance.post<{ value: string }>(
            `${this.serviceName}/seedCaseLibrary`,
            { payload: typeof payload === 'string' ? payload : JSON.stringify(payload) },
        );
        return JSON.parse(res.data.value);
    }

    /** Chạy lại các bước downstream (D5..D8) sau khi sửa D4. */
    async reanalyzeDownstream(reportID: string, fromStep: string = 'D5'): Promise<string> {
        const res = await axiosInstance.post<{ value: string }>(
            `${this.serviceName}/reanalyzeDownstream`,
            { reportID, fromStep },
        );
        return res.data.value;
    }

    /**
     * Case tiền lệ của một report, kèm điểm và diễn giải từng tiêu chí.
     *
     * Gọi được ngay khi report vừa tạo — nó chỉ cần `caseContext`, không chờ AI.
     * Nhờ vậy panel tiền lệ hiện trong khoảng 2 giây trong khi báo cáo còn đang
     * chạy 100 giây ở nền.
     */
    async findPrecedents(reportID: string): Promise<PrecedentResult> {
        const res = await axiosInstance.get<{ value: string }>(
            `${this.serviceName}/findPrecedents(reportID='${encodeURIComponent(reportID)}')`,
        );
        return normalizePrecedents(JSON.parse(res.data.value));
    }
}

/**
 * Chuẩn hoá kết quả tiền lệ — dùng chung với backend qua .
 *
 * Đặt ở shared/ CÓ CHỦ ĐÍCH: phép biến đổi này đã hỏng hai lần và cả hai lần đều
 * im lặng, nên nó cần test. Test chỉ chạy được nếu hàm không dính vào React.
 */
/**
 * Bọc lại để chốt kiểu `Precedent` giàu của giao diện.
 *
 * Module shared cố tình chỉ khai phần hình dạng mà phép chuẩn hoá thực sự chạm
 * tới — nếu nó biết đủ 19 trường của `Precedent` thì backend và frontend lại dính
 * vào nhau qua một kiểu chỉ phục vụ việc hiển thị.
 */
export function normalizePrecedents(raw: unknown): PrecedentResult {
    return normalizeShape<Precedent>(raw);
}

export function parseStoredPrecedents(precedentsJson: string | null | undefined): PrecedentResult | null {
    return parseStoredShape<Precedent>(precedentsJson);
}

export const eightDService = new EightDService();

// ─────────────────────────────────────────────────────────────────────────────
// Trợ giúp hiển thị
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Đọc cột chuỗi JSON thành mảng.
 *
 * `actionItems` và `sources` lưu dạng chuỗi JSON vì CDS không có kiểu mảng.
 * Bản ghi cũ hoặc hỏng thì trả mảng rỗng — một trang chi tiết trắng vì
 * `JSON.parse` ném lỗi thì tệ hơn nhiều so với việc thiếu vài dòng.
 */
export function parseList(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return [];
    }
}

/**
 * Đọc `aiFinding` thành object.
 *
 * Trả `null` khi chưa có hoặc hỏng — panel sẽ ẩn đi. Report chạy trước khi có
 * bước chẩn đoán mù sẽ rơi vào trường hợp này, và đó là hành vi đúng.
 */
export function parseFinding(raw: string | null | undefined): IndependentAnalysis | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed?.finding && parsed?.verdict ? (parsed as IndependentAnalysis) : null;
    } catch {
        return null;
    }
}

export function isCustomerComplaint(origin: string | null | undefined): boolean {
    return String(origin ?? '').startsWith('Q1');
}

/** 'Q1 - Customer Complaint' → 'Q1'. Cột danh sách hẹp, tên đầy đủ không vừa. */
export function originShort(origin: string | null | undefined): string {
    return String(origin ?? '').split(' ')[0] || '—';
}

/**
 * Mot Business Partner chon duoc cho nhom 8D.
 *
 * `email`/`phone` co trong schema (`HistoricalTeamMembers`) va co chu dich -
 * comment trong `case-library.cds` ghi ro "Auto-fill khi nguoi dung chon
 * partner. Rule-based, khong phai AI sinh". Nhung `librarySeeder` dang seed
 * `null` cho ca hai vi mock data khong he co chung, nen kieu du lieu phai cho
 * phep `null` thay vi hua mot thu chua ton tai.
 */
export interface PartnerDirectoryEntry {
    partnerId: string;
    partnerName: string;
    functionTitle: string;
    email: string | null;
    phone: string | null;
}

/**
 * Danh ba Business Partner, gom tu kho case lich su.
 *
 * -- Vi sao gom o client chu khong phai mot endpoint rieng --
 * `HistoricalTeamMembers` la mot dong MOI LAN mot nguoi tham gia MOT case, nen
 * mot nguoi lam 5 case se co 5 dong. Danh ba can moi nguoi mot dong. Gom o day
 * tranh phai them mot function moi vao `EightDService.cds` chi de lam mot phep
 * distinct - kho nay chi vai chuc dong, khong dang mot vong deploy.
 *
 * Giu lai ban ghi co `email`/`phone` khi trung `partnerId`: cac dong cua cung
 * mot nguoi khong nhat thiet day du nhu nhau.
 */
export async function getPartnerDirectory(): Promise<PartnerDirectoryEntry[]> {
    const response = await axiosInstance.get(
        'api/cnma/EIGHTD_SRV/HistoricalTeamMembers'
        + '?$select=partnerId,partnerName,functionTitle,email,phone&$top=5000',
    );
    const rows = (response.data?.value ?? response.data ?? []) as Array<Record<string, unknown>>;
    const merged = new Map<string, PartnerDirectoryEntry>();
    for (const row of Array.isArray(rows) ? rows : []) {
        const rawId = String(row.partnerId ?? '').trim();
        const partnerId = rawId.replace(/^BP-/i, '');
        if (!partnerId) continue;
        const partnerName = String(row.partnerName ?? '').trim() || partnerId;
        const slug = partnerName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
        const digits = partnerId.replace(/\D/g, '').padStart(4, '0').slice(-4);
        const entry: PartnerDirectoryEntry = {
            partnerId,
            partnerName,
            functionTitle: String(row.functionTitle ?? '').trim(),
            email: (row.email as string | null) || (slug ? `${slug}@proresolve.com` : `${partnerId.toLowerCase()}@proresolve.com`),
            phone: (row.phone as string | null) || `+49 89 2018 ${digits}`,
        };
        const existing = merged.get(partnerId);
        merged.set(partnerId, existing
            ? {
                ...existing,
                functionTitle: existing.functionTitle || entry.functionTitle,
                email: existing.email || entry.email,
                phone: existing.phone || entry.phone,
            }
            : entry);
    }
    return [...merged.values()].sort((a, b) => a.partnerName.localeCompare(b.partnerName));
}

/** Mot dong nhom 8D nguoi dung da chot cho D1. */
export interface AssignedTeamRow {
    partnerId: string;
    partnerName: string;
    functionTitle: string;
    partnerRole: string;
}

/**
 * Luu nhom 8D da chot cua D1 xuong DB.
 *
 * Chi ghi khoa `team.assignedRoster` trong `resultJson` cua discipline - phan
 * `team.roster` do AI de xuat khong bi dung toi, nen van doi chieu duoc "AI de
 * xuat ai" voi "nguoi dung chot ai". Server validate lai toan bo (vai tro hop le,
 * khong trung partner, toi da mot truong nhom), nen loi tra ve tu day la loi that
 * chu khong phai canh bao co the bo qua.
 */
export async function saveTeamRoster(
    disciplineID: string,
    roster: AssignedTeamRow[],
): Promise<number> {
    const response = await axiosInstance.post('api/cnma/EIGHTD_SRV/saveTeamRoster', {
        disciplineID,
        roster: JSON.stringify(roster),
    });

    queryClient.setQueriesData<{ disciplines?: Discipline8D[] }>({ queryKey: ['8d', 'report'] }, (old) => {
        if (!old || !old.disciplines) return old;
        return {
            ...old,
            disciplines: old.disciplines.map((d) => {
                if (d.ID !== disciplineID) return d;
                let data: Record<string, unknown> = {};
                try {
                    data = JSON.parse(d.resultJson || '{}');
                } catch { /* empty */ }
                const team = data.team && typeof data.team === 'object' && !Array.isArray(data.team)
                    ? { ...(data.team as Record<string, unknown>) }
                    : {};
                team.assignedRoster = roster;
                return {
                    ...d,
                    resultJson: JSON.stringify({ ...data, team }),
                };
            }),
        };
    });
    void queryClient.invalidateQueries({ queryKey: ['8d', 'report'] });

    const raw = response.data?.value ?? response.data;
    try {
        return (typeof raw === 'string' ? JSON.parse(raw) : raw)?.saved ?? roster.length;
    } catch {
        return roster.length;
    }
}

/**
 * Ghi mot o do nguoi dung nhap tren mot buoc D.
 *
 * Server chi chap nhan nhung khoa nam trong danh sach cho phep cua buoc do, va
 * moi khoa deu tach khoi ban AI viet - nen mot lan luu khong the lam mat ket
 * luan cua may. Loi tra ve tu day la loi that, khong phai canh bao bo qua duoc.
 *
 * Gui `null` de XOA phan sua va quay ve ban AI.
 */
export async function saveDisciplineField(
    disciplineID: string,
    fieldKey: string,
    value: unknown,
): Promise<void> {
    await axiosInstance.post('api/cnma/EIGHTD_SRV/saveDisciplineField', {
        disciplineID,
        fieldKey,
        valueJson: JSON.stringify(value ?? null),
    });

    queryClient.setQueriesData<{ disciplines?: Discipline8D[] }>({ queryKey: ['8d', 'report'] }, (old) => {
        if (!old || !old.disciplines) return old;
        return {
            ...old,
            disciplines: old.disciplines.map((d) => {
                if (d.ID !== disciplineID) return d;
                let data: Record<string, unknown> = {};
                try {
                    data = JSON.parse(d.resultJson || '{}');
                } catch { /* empty */ }
                const parts = fieldKey.split('.');
                let cursor: any = data;
                for (const part of parts.slice(0, -1)) {
                    cursor[part] = cursor[part] && typeof cursor[part] === 'object' && !Array.isArray(cursor[part])
                        ? { ...cursor[part] } : {};
                    cursor = cursor[part];
                }
                cursor[parts[parts.length - 1]] = value;

                const currentWs = d.workState || 'NotStarted';
                const nextWs = currentWs === 'NotStarted' ? 'InProgress' : currentWs;

                return {
                    ...d,
                    resultJson: JSON.stringify(data),
                    workState: nextWs,
                };
            }),
        };
    });
    void queryClient.invalidateQueries({ queryKey: ['8d', 'report'] });
}

/**
 * Xác nhận (Confirm) hoặc hủy xác nhận một trường thông tin AI của bước D.
 */
export async function confirmDisciplineField(
    disciplineID: string,
    fieldKey: string,
    confirmed: boolean,
): Promise<string[]> {
    const response = await axiosInstance.post('api/cnma/EIGHTD_SRV/confirmDisciplineField', {
        disciplineID,
        fieldKey,
        confirmed,
    });

    queryClient.setQueriesData<{ disciplines?: Discipline8D[] }>({ queryKey: ['8d', 'report'] }, (old) => {
        if (!old || !old.disciplines) return old;
        return {
            ...old,
            disciplines: old.disciplines.map((d) => {
                if (d.ID !== disciplineID) return d;
                const currentConfirmed = parseConfirmedFields(d.confirmedFieldsJson);
                const set = new Set(currentConfirmed);
                if (confirmed) {
                    set.add(fieldKey);
                } else {
                    set.delete(fieldKey);
                }
                const nextConfirmed = [...set];
                const currentWs = d.workState || 'NotStarted';
                const nextWs = currentWs === 'NotStarted' ? 'InProgress' : currentWs;

                return {
                    ...d,
                    confirmedFieldsJson: JSON.stringify(nextConfirmed),
                    workState: nextWs,
                };
            }),
        };
    });
    void queryClient.invalidateQueries({ queryKey: ['8d'] });

    const raw = response.data?.value ?? response.data;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed?.confirmedFields ?? [];
}

/**
 * Cập nhật trạng thái xử lý (workState) cho bước D ('NotStarted' | 'InProgress' | 'Completed').
 */
export async function setDisciplineWorkState(
    disciplineID: string,
    workState: DisciplineWorkState,
): Promise<string> {
    const response = await axiosInstance.post('api/cnma/EIGHTD_SRV/setDisciplineWorkState', {
        disciplineID,
        workState,
    });

    const nextReviewStatus: ReviewStatus = workState === 'Completed' ? 'Approved' : 'Draft';

    queryClient.setQueriesData<{ disciplines?: Discipline8D[] }>({ queryKey: ['8d', 'report'] }, (old) => {
        if (!old || !old.disciplines) return old;
        return {
            ...old,
            disciplines: old.disciplines.map((d) => {
                if (d.ID !== disciplineID) return d;
                return {
                    ...d,
                    workState,
                    reviewStatus: nextReviewStatus,
                };
            }),
        };
    });
    void queryClient.invalidateQueries({ queryKey: ['8d'] });

    const raw = response.data?.value ?? response.data;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed?.workState ?? workState;
}

/**
 * Ghi quyet dinh duyet cua ky su cho MOT buoc D.
 *
 * Server la noi quyet dinh: no lay danh tinh nguoi bam tu ngu canh xac thuc chu
 * khong tu payload, bat buoc phai co `note` khi tra lai, va tra ve luon trang
 * thai cong dong case sau thao tac - nen client khong phai tu tinh lai.
 */
export async function reviewDiscipline(
    disciplineID: string,
    decision: ReviewDecision,
    note?: string | null,
): Promise<ReviewResult> {
    const response = await axiosInstance.post('api/cnma/EIGHTD_SRV/reviewDiscipline', {
        disciplineID,
        decision,
        note: note ?? '',
    });
    const raw = response.data?.value ?? response.data;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

/** Vet duyet + cong dong case cua mot report. Moi nhat truoc. */
export async function getReviewTrail(
    reportID: string,
): Promise<{ gate: ClosureGate; trail: ReviewEvent[] }> {
    const response = await axiosInstance.get(
        `api/cnma/EIGHTD_SRV/getReviewTrail(reportID='${encodeURIComponent(reportID)}')`,
    );
    const raw = response.data?.value ?? response.data;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// Task Completion Evidence (PDF Attachments)
// ─────────────────────────────────────────────────────────────────────────────

export interface TaskEvidenceItem {
    ID: string;
    reportID: string;
    disciplineCode: string;
    taskId: string;
    fileName: string;
    fileSize: number;
    mediaType: string;
    uploadedBy: string;
    uploadedAt: string;
}

export async function listTaskEvidence(reportID: string): Promise<TaskEvidenceItem[]> {
    const response = await axiosInstance.get(
        `api/cnma/EIGHTD_SRV/listTaskEvidence(reportID='${encodeURIComponent(reportID)}')`,
    );
    const raw = response.data?.value ?? response.data;
    return typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
}

export async function uploadTaskEvidence(params: {
    reportID: string;
    disciplineCode: string;
    taskId: string;
    file: File;
}): Promise<TaskEvidenceItem> {
    const { reportID, disciplineCode, taskId, file } = params;

    // Client-side validation
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('Only PDF files are allowed.');
    }
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE) {
        const actualMb = (file.size / (1024 * 1024)).toFixed(2);
        throw new Error(`File size exceeds 10 MB limit (actual: ${actualMb} MB).`);
    }

    // 1. Create entity metadata record
    const createRes = await axiosInstance.post('api/cnma/EIGHTD_SRV/TaskEvidences', {
        reportID,
        disciplineCode,
        taskId,
        fileName: file.name,
        fileSize: file.size,
        mediaType: 'application/pdf',
    });
    const created = createRes.data?.value ?? createRes.data;
    const evidenceID = created?.ID;
    if (!evidenceID) throw new Error('Failed to create evidence record.');

    // 2. Stream binary content
    await axiosInstance.put(`api/cnma/EIGHTD_SRV/TaskEvidences(${evidenceID})/content`, file, {
        headers: {
            'Content-Type': 'application/pdf',
        },
    });

    void queryClient.invalidateQueries({ queryKey: ['8d', 'evidence'] });
    void queryClient.invalidateQueries({ queryKey: ['8d'] });

    return {
        ID: evidenceID,
        reportID,
        disciplineCode,
        taskId,
        fileName: file.name,
        fileSize: file.size,
        mediaType: 'application/pdf',
        uploadedBy: created?.uploadedBy || '',
        uploadedAt: created?.uploadedAt || new Date().toISOString(),
    };
}

export async function deleteTaskEvidence(evidenceID: string): Promise<void> {
    await axiosInstance.delete(`api/cnma/EIGHTD_SRV/TaskEvidences(${evidenceID})`);
    void queryClient.invalidateQueries({ queryKey: ['8d', 'evidence'] });
    void queryClient.invalidateQueries({ queryKey: ['8d'] });
}

export function getEvidenceDownloadUrl(evidenceID: string): string {
    return `/api/cnma/EIGHTD_SRV/TaskEvidences(${evidenceID})/content`;
}

export async function reanalyzeDownstream(reportID: string, fromStep: string = 'D5'): Promise<string> {
    return eightDService.reanalyzeDownstream(reportID, fromStep);
}
