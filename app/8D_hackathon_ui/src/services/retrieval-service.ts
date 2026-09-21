import axiosInstance from './core/axios-instance';

/**
 * Cấu hình tìm tiền lệ: tiêu chí chấm điểm, ngưỡng, và prompt từng bước D.
 *
 * Đi qua axios instance dùng chung để có CSRF token — sau approuter của BTP
 * (bật `csrfProtection`) thì mọi PATCH và POST không có token đều trả 403.
 */

const AI = '/api/cnma/AI_SRV';
const EIGHTD = '/api/cnma/EIGHTD_SRV';

/** CAP gói kết quả action trong `value` dưới dạng chuỗi JSON. */
function unwrapAction<T>(data: unknown): T {
    const raw = data && typeof data === 'object' && 'value' in (data as any)
        ? (data as any).value
        : data;
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
}

/** Collection OData: `value` là MẢNG bản ghi, không phải chuỗi JSON. */
function unwrapList<T>(data: unknown): T[] {
    return ((data as any)?.value ?? []) as T[];
}

// ─────────────────────────────────────────────────────────────────────────────

export interface SimilarityCriterion {
    criterionKey: string;
    label: string;
    description: string | null;
    sourceTable: string | null;
    sourceField: string | null;
    matchType: string;
    weight: number;
    fallbackField: string | null;
    fallbackMatch: string | null;
    fallbackWeight: number | null;
    minSimilarity: number | null;
    enabled: boolean;
    sortOrder: number;
}

export interface RetrievalSettings {
    ID: string;
    minScore: number;
    topN: number;
    closedOnly: boolean;
}

export interface GraphRetrievalSettings {
    ID: string;
    engine: 'graph' | 'scoring';
    maxKeywords: number;
    fallbackEnabled: boolean;
}

/**
 * Một dòng trọng số graph. Tám dòng, D1…D8, server tự seed lúc khởi động.
 *
 * Trọng số để `null` nghĩa là bước KHÔNG cân loại bằng chứng đó — khác hẳn `0`,
 * và khác một cách nhìn thấy được: loại không được cân thì không bao giờ xuất
 * hiện trong đường bằng chứng. D7 để `wWorkCenter` null là có chủ ý.
 */
export interface GraphStepParams {
    stepCode: string;
    label: string | null;
    question: string | null;
    wWorkCenter: number | null;
    wMaterial: number | null;
    wMaterialFamily: number | null;
    wDefectCode: number | null;
    wKeywords: number | null;
    wContainment: number | null;
    wCorrective: number | null;
    wPreventive: number | null;
    keywordCap: number | null;
    minScore: number | null;
    topN: number | null;
    wRerank: number | null;
    rerankFloor: number | null;
    rerankQueryFrame: string | null;
    rerankCandidateFrame: string | null;
    rerankRubric: string | null;
    actionType: string | null;
    enabled: boolean;
    sortOrder: number | null;
}

/** Profile đang chạy, do server tính. Chỉ đọc. */
export interface EffectiveStepProfile {
    label: string;
    question: string;
    weights: Record<string, number>;
    keywordCap: number;
    minScore: number;
    topN: number;
    actionType?: string;
    rerank?: { weight: number; floor: number; queryFrame: string; candidateFrame: string; rubric: string };
}

export interface GraphStepDiagnostic {
    stepCode: string;
    /** false = dòng đã lưu bị từ chối, bị tắt, hoặc chưa có. */
    accepted: boolean;
    /** Lý do từ chối, nguyên văn từ backend. */
    violation: string | null;
    hasRow: boolean;
    enabled: boolean | null;
    effective: EffectiveStepProfile;
}

export interface GraphDiagnostics {
    engine: 'graph' | 'scoring';
    maxKeywords: number;
    fallbackEnabled: boolean;
    steps: GraphStepDiagnostic[];
}

export interface StepPrompt {
    stepCode: string;
    label: string;
    description: string | null;
    systemPrompt: string | null;
    userTemplate: string | null;
    inputSchemaJson: string | null;
    combinedPrompt: string | null;
    formSchemaJson: string | null;
    constraintsJson: string | null;
    enabled: boolean;
    version: number;
}

export interface ScoreBreakdown {
    criterionKey: string;
    label: string;
    level: 'exact' | 'fallback' | 'none';
    matchedOn: string | null;
    points: number;
    maxPoints: number;
}

export interface ScorePreview {
    caseA?: { notificationId: string; symptomShortText: string | null };
    caseB?: { notificationId: string; symptomShortText: string | null };
    score: number;
    maxScore: number;
    breakdown: ScoreBreakdown[];
    explanation: string;
    error?: string;
}

export interface EmbedReport {
    model: string;
    embedded: number;
    skipped: number;
    failed: number;
    total: number;
    error?: string;
}

export interface LibraryCase {
    notificationId: string;
    symptomShortText: string | null;
    sapStatus: string | null;
    embeddingModel: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────

export async function getCriteria(): Promise<SimilarityCriterion[]> {
    const res = await axiosInstance.get(`${AI}/SimilarityCriteria?$orderby=sortOrder`);
    return unwrapList<SimilarityCriterion>(res.data);
}

export async function updateCriterion(
    key: string,
    patch: Partial<SimilarityCriterion>,
): Promise<void> {
    await axiosInstance.patch(`${AI}/SimilarityCriteria(criterionKey='${key}')`, patch);
}

export async function createCriterion(row: Partial<SimilarityCriterion>): Promise<void> {
    await axiosInstance.post(`${AI}/SimilarityCriteria`, row);
}

export async function deleteCriterion(key: string): Promise<void> {
    await axiosInstance.delete(`${AI}/SimilarityCriteria(criterionKey='${key}')`);
}

/**
 * Đổi chỗ hai bước.
 *
 * Ghi tuần tự chứ không song song: cả hai lệnh PATCH đi vào cùng một bảng, và
 * driver SQLite của CAP chỉ có một connection — bắn song song thì lệnh thứ hai
 * xếp hàng sau lệnh thứ nhất mà vẫn nằm trong transaction của nó.
 */
export async function swapCriterionOrder(
    a: SimilarityCriterion,
    b: SimilarityCriterion,
): Promise<void> {
    await updateCriterion(a.criterionKey, { sortOrder: b.sortOrder });
    await updateCriterion(b.criterionKey, { sortOrder: a.sortOrder });
}

/**
 * Cột trên `HistoricalCases` đem ra so được.
 *
 * Danh sách cứng có chủ đích: người dùng gõ tự do một tên cột không tồn tại thì
 * tiêu chí lặng lẽ không bao giờ ăn điểm — không lỗi, không cảnh báo, chỉ là
 * mãi 0 điểm.
 */
export const COMPARABLE_FIELDS = [
    { field: 'workCenterId', label: 'Work centre', note: 'Production work center', sourceTable: 'HistoricalCases · GD 4 WorkCenters' },
    { field: 'defectCode', label: 'Defect code', note: 'Catalogued defect code', sourceTable: 'HistoricalCases · GD 3 Defects' },
    { field: 'defectKeywords', label: 'Defect keywords', note: 'Extracted keywords from defect description', sourceTable: 'HistoricalCases · GD 3 Defects (Keywords)' },
    { field: 'materialId', label: 'Material', note: 'Material part number', sourceTable: 'HistoricalCases · GD 1 Materials' },
    { field: 'materialFamily', label: 'Material group', note: 'Material group classification (MATKL)', sourceTable: 'HistoricalCases · GD 1 Materials (Family)' },
    { field: 'batchId', label: 'Batch', note: 'Batch number', sourceTable: 'HistoricalCases · Batch Records' },
    { field: 'rootCauseCategory', label: 'Root cause category', note: 'Ishikawa root cause branch', sourceTable: 'HistoricalCases · 5-Why & Ishikawa' },
    { field: 'origin', label: 'Origin', note: 'Q1 customer complaint / Q3 internal defect', sourceTable: 'HistoricalCases · Case Header (Q1/Q3)' },
    { field: 'fmeaId', label: 'FMEA', note: 'FMEA record link', sourceTable: 'HistoricalCases · FMEA Registry' },
    { field: 'embedding', label: 'Case narrative (vector)', note: 'Used for cosine vector similarity matching', sourceTable: 'HistoricalCases.searchText (embedding)' },
] as const;

export const AVAILABLE_SOURCE_TABLES = [
    { value: 'HistoricalCases · GD 4 WorkCenters', label: 'HistoricalCases · GD 4 WorkCenters' },
    { value: 'HistoricalCases · GD 3 Defects', label: 'HistoricalCases · GD 3 Defects' },
    { value: 'HistoricalCases · GD 3 Defects (Keywords)', label: 'HistoricalCases · GD 3 Defects (Keywords)' },
    { value: 'HistoricalCases · GD 1 Materials', label: 'HistoricalCases · GD 1 Materials' },
    { value: 'HistoricalCases · GD 1 Materials (Family)', label: 'HistoricalCases · GD 1 Materials (Family)' },
    { value: 'HistoricalCases · Batch Records', label: 'HistoricalCases · Batch Records' },
    { value: 'HistoricalCases · 5-Why & Ishikawa', label: 'HistoricalCases · 5-Why & Ishikawa' },
    { value: 'HistoricalCases · Case Header (Q1/Q3)', label: 'HistoricalCases · Case Header (Q1/Q3)' },
    { value: 'HistoricalCases · FMEA Registry', label: 'HistoricalCases · FMEA Registry' },
    { value: 'HistoricalCases.searchText (embedding)', label: 'HistoricalCases.searchText (embedding)' },
    { value: 'NotificationHeader · QM', label: 'NotificationHeader · QM' },
    { value: 'DefectItem · QM', label: 'DefectItem · QM' },
    { value: 'InspectionLot · QM', label: 'InspectionLot · QM' },
] as const;

/** Matching methods handled in `scoring.ts`. */
export const MATCH_METHODS = [
    {
        value: 'exact',
        label: 'Exact',
        hint: 'Exact string match (trimmed, case-insensitive). Empty values do not match empty values.',
    },
    {
        value: 'keyword',
        label: 'Keyword',
        hint: 'Matches at least one token after removing stop words and short terms.',
    },
    {
        value: 'cosine',
        label: 'Vector',
        hint: 'Semantic similarity between narratives. Score = weight × cosine.',
    },
] as const;

export async function getSettings(): Promise<RetrievalSettings | null> {
    const res = await axiosInstance.get(`${AI}/RetrievalSettings`);
    return unwrapList<RetrievalSettings>(res.data)[0] ?? null;
}

export async function updateSettings(patch: Partial<RetrievalSettings>): Promise<void> {
    await axiosInstance.patch(`${AI}/RetrievalSettings(ID='GLOBAL')`, patch);
}

export async function getGraphRetrievalSettings(): Promise<GraphRetrievalSettings | null> {
    const res = await axiosInstance.get(`${AI}/GraphRetrievalSettings`);
    return unwrapList<GraphRetrievalSettings>(res.data)[0] ?? null;
}

export async function updateGraphRetrievalSettings(patch: Partial<GraphRetrievalSettings>): Promise<void> {
    await axiosInstance.patch(`${AI}/GraphRetrievalSettings(ID='GLOBAL')`, patch);
}

export async function getGraphStepParams(): Promise<GraphStepParams[]> {
    const res = await axiosInstance.get(`${AI}/GraphStepParams?$orderby=stepCode`);
    return unwrapList<GraphStepParams>(res.data);
}

export async function updateGraphStepParams(
    stepCode: string,
    patch: Partial<GraphStepParams>,
): Promise<void> {
    await axiosInstance.patch(`${AI}/GraphStepParams(stepCode='${stepCode}')`, patch);
}

/**
 * Phán quyết của backend cho từng bước.
 *
 * Phải hỏi server chứ không tự kiểm ở client: luật từ chối nằm trong
 * `normalizeStepParams`, và một bản sao ở đây sẽ lệch đi lúc nào không biết —
 * đúng bằng triệu chứng mà màn hình này sinh ra để chữa.
 */
export async function getGraphStepDiagnostics(): Promise<GraphDiagnostics> {
    const res = await axiosInstance.get(`${AI}/graphStepDiagnostics()`);
    const raw = typeof res.data === 'string' ? res.data : res.data?.value ?? '{}';
    return JSON.parse(raw) as GraphDiagnostics;
}

export async function previewScore(
    caseA: string,
    caseB: string,
    profileKey = 'default',
): Promise<ScorePreview> {
    const a = encodeURIComponent(caseA);
    const b = encodeURIComponent(caseB);
    const p = encodeURIComponent(profileKey);
    const res = await axiosInstance.get(
        `${AI}/previewScore(caseA='${a}',caseB='${b}',profileKey='${p}')`,
    );
    return unwrapAction<ScorePreview>(res.data);
}

export async function resetRetrievalConfig(
    scope: 'criteria' | 'settings' | 'prompts' | 'profiles' | 'all' | `prompt:${string}`,
) {
    const res = await axiosInstance.post(`${AI}/resetRetrievalConfig`, { scope });
    return unwrapAction<unknown>(res.data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Object Schema — profile chấm điểm theo từng bước D
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Một field SAP gửi lên, đã đo trên kho thật.
 *
 * `occurrence`, `distinctValues` và `note` không phải trang trí: chúng là thứ
 * duy nhất cho biết một field có phân biệt được gì không TRƯỚC khi admin gán
 * trọng số cho nó. Xem `srv/src/domain/eightd/precedent/sourceFields.ts`.
 */
export interface SourceFieldInfo {
    path: string;
    label: string;
    group: string;
    multiValued: boolean;
    occurrence: number;
    caseCount: number;
    distinctValues: number;
    sampleValues: string[];
    column: string | null;
    /** Lọc trước được bằng SQL. Field chỉ nằm trong JSON thì phải quét cả kho. */
    indexed: boolean;
    origin: 'sap' | 'derived';
    sourceTable: string;
    methods: string[];
    note: string;
}

export interface SourceFieldCatalog {
    caseCount: number;
    fields: SourceFieldInfo[];
    error?: string;
}

export interface RetrievalProfile {
    profileKey: string;
    label: string;
    description: string | null;
    minScore: number;
    topN: number;
    closedOnly: boolean;
    isSystem: boolean;
    sortOrder: number;
}

/** Cùng hình dạng với `SimilarityCriterion`, thêm khoá profile. */
export interface ProfileCriterion extends SimilarityCriterion {
    profile_profileKey: string;
}

export interface StepBinding {
    stepCode: string;
    label: string | null;
    profile_profileKey: string;
    sortOrder: number | null;
}

export const STEP_CODES = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'] as const;

export async function getSourceFieldCatalog(): Promise<SourceFieldCatalog> {
    const res = await axiosInstance.get(`${AI}/getSourceFieldCatalog()`);
    return unwrapAction<SourceFieldCatalog>(res.data);
}

export async function getProfiles(): Promise<RetrievalProfile[]> {
    const res = await axiosInstance.get(`${AI}/RetrievalProfiles?$orderby=sortOrder`);
    return unwrapList<RetrievalProfile>(res.data);
}

export async function updateProfile(
    profileKey: string,
    patch: Partial<RetrievalProfile>,
): Promise<void> {
    await axiosInstance.patch(`${AI}/RetrievalProfiles(profileKey='${profileKey}')`, patch);
}

export async function getProfileCriteria(): Promise<ProfileCriterion[]> {
    const res = await axiosInstance.get(`${AI}/ProfileCriteria?$orderby=sortOrder`);
    return unwrapList<ProfileCriterion>(res.data);
}

/**
 * Khoá OData của một tiêu chí. Khoá ghép (profile, criterionKey) chứ không phải
 * UUID — nó nói thẳng ra bất biến "một khoá tiêu chí chỉ xuất hiện một lần trong
 * một profile", thay vì để bất biến đó nằm ngầm trong một ràng buộc unique.
 */
function criterionRef(profileKey: string, criterionKey: string): string {
    return `${AI}/ProfileCriteria(profile_profileKey='${encodeURIComponent(profileKey)}'`
        + `,criterionKey='${encodeURIComponent(criterionKey)}')`;
}

export async function createProfileCriterion(row: Partial<ProfileCriterion>): Promise<void> {
    await axiosInstance.post(`${AI}/ProfileCriteria`, row);
}

export async function updateProfileCriterion(
    profileKey: string,
    criterionKey: string,
    patch: Partial<ProfileCriterion>,
): Promise<void> {
    await axiosInstance.patch(criterionRef(profileKey, criterionKey), patch);
}

export async function deleteProfileCriterion(
    profileKey: string,
    criterionKey: string,
): Promise<void> {
    await axiosInstance.delete(criterionRef(profileKey, criterionKey));
}

/**
 * Đổi chỗ hai tiêu chí. Ghi tuần tự, cùng lý do với `swapCriterionOrder`:
 * driver SQLite của CAP chỉ có một connection.
 */
export async function swapProfileCriterionOrder(
    profileKey: string,
    a: ProfileCriterion,
    b: ProfileCriterion,
): Promise<void> {
    await updateProfileCriterion(profileKey, a.criterionKey, { sortOrder: b.sortOrder });
    await updateProfileCriterion(profileKey, b.criterionKey, { sortOrder: a.sortOrder });
}

export async function getStepBindings(): Promise<StepBinding[]> {
    const res = await axiosInstance.get(`${AI}/StepRetrievalBindings?$orderby=stepCode`);
    return unwrapList<StepBinding>(res.data);
}

export async function updateStepBinding(stepCode: string, profileKey: string): Promise<void> {
    await axiosInstance.patch(`${AI}/StepRetrievalBindings(stepCode='${stepCode}')`, {
        profile_profileKey: profileKey,
    });
}

export async function cloneRetrievalProfile(input: {
    sourceKey: string;
    profileKey: string;
    label: string;
    description?: string;
}): Promise<void> {
    await axiosInstance.post(`${AI}/cloneRetrievalProfile`, {
        sourceKey: input.sourceKey,
        profileKey: input.profileKey,
        label: input.label,
        description: input.description ?? '',
    });
}

/**
 * Trạng thái MONG MUỐN của một profile. Server làm cho khớp.
 *
 * `criteria` và `steps` thay thế toàn bộ tập cũ — client gửi trạng thái muốn có
 * chứ không gửi diff. Diff phía client là dựng lại một bộ đồng bộ hoá ở tầng UI,
 * và bộ đó sẽ lệch khỏi server ngay lần đầu có hai tab cùng mở.
 */
export interface SaveProfilePayload {
    label?: string;
    description?: string | null;
    minScore?: number;
    topN?: number;
    closedOnly?: boolean;
    criteria?: Array<Partial<ProfileCriterion>>;
    /**
     * Thành viên field — thay thế danh sách field, GIỮ NGUYÊN trọng số/cách so
     * của những field đã có. Đây là đường mà trang Object Schema dùng.
     *
     * Gửi `criteria` từ Object Schema sẽ ghi đè trọng số bằng bản đã nạp lúc mở
     * trang, tức là xoá mọi chỉnh sửa từ tab Similarity kể từ lúc đó — âm thầm,
     * chỉ vì ai đó kéo thêm một field.
     */
    criteriaFields?: Array<Pick<ProfileCriterion,
        'criterionKey' | 'label' | 'description' | 'sourceTable' | 'sourceField' | 'matchType'>>;
    steps?: string[];
}

export async function saveRetrievalProfile(
    profileKey: string,
    payload: SaveProfilePayload,
): Promise<void> {
    await axiosInstance.post(`${AI}/saveRetrievalProfile`, {
        profileKey,
        payload: JSON.stringify(payload),
    });
}

export async function deleteRetrievalProfile(profileKey: string): Promise<{ rebound: string[] }> {
    const res = await axiosInstance.post(`${AI}/deleteRetrievalProfile`, { profileKey });
    return unwrapAction<{ rebound: string[] }>(res.data);
}

// ── Prompt từng bước D ───────────────────────────────────────────────────────

export async function getStepPrompts(): Promise<StepPrompt[]> {
    const res = await axiosInstance.get(`${AI}/StepPrompts?$orderby=stepCode`);
    return unwrapList<StepPrompt>(res.data);
}

export async function updateStepPrompt(
    stepCode: string,
    patch: Partial<StepPrompt>,
): Promise<void> {
    await axiosInstance.patch(`${AI}/StepPrompts(stepCode='${stepCode}')`, patch);
}

// ── Kho case ─────────────────────────────────────────────────────────────────

export async function getLibraryCases(): Promise<LibraryCase[]> {
    // `$select` bỏ hẳn cột `embedding` — mỗi vector ~30 KB, kéo cả kho về chỉ để
    // đổ vào một ô chọn là tự làm chậm trang mà không được gì.
    const select = encodeURIComponent('notificationId,symptomShortText,sapStatus,embeddingModel');
    const orderby = encodeURIComponent('notificationId');
    const res = await axiosInstance.get(
        `${EIGHTD}/HistoricalCases?$select=${select}&$orderby=${orderby}`,
    );
    return unwrapList<LibraryCase>(res.data);
}

export async function embedLibrary(force = false): Promise<EmbedReport> {
    const res = await axiosInstance.post(`${EIGHTD}/embedCaseLibrary`, { force });
    return unwrapAction<EmbedReport>(res.data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tổng quan cho trang Workflow
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowSnapshot {
    /** Tiêu chí đang bật và trần điểm — quyết định bước tìm tiền lệ. */
    criteriaEnabled: number;
    criteriaTotal: number;
    maxScore: number;
    hasVectorStep: boolean;

    minScore: number;
    topN: number;
    closedOnly: boolean;

    libraryCount: number;
    embeddedCount: number;
    embeddingModel: string | null;

    /** Prompt bước D đã có nội dung / tổng số bước. */
    promptsFilled: number;
    promptsTotal: number;

    /** Model mặc định và ghi đè theo activity, đọc từ cấu hình chung. */
    defaultModel: string | null;
    activityModels: Record<string, string>;
    modelsInRegistry: number;

    reportsAnalyzed: number;
    reportsTotal: number;
}

/**
 * Gom mọi thứ trang Workflow cần trong một lần.
 *
 * Từng phần hỏng riêng thì trả giá trị trung tính chứ không làm hỏng cả trang:
 * mục đích của trang là cho thấy chỗ nào ĐÃ cấu hình và chỗ nào chưa, nên một
 * phần chưa cấu hình là thông tin, không phải lỗi.
 */
export async function getWorkflowSnapshot(): Promise<WorkflowSnapshot> {
    const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
        try {
            return await fn();
        } catch {
            return fallback;
        }
    };

    const [criteria, settings, prompts, cases, aiConfigRaw, models, reports] = await Promise.all([
        safe(getCriteria, [] as SimilarityCriterion[]),
        safe(getSettings, null),
        safe(getStepPrompts, [] as StepPrompt[]),
        safe(getLibraryCases, [] as LibraryCase[]),
        safe(async () => {
            const r = await axiosInstance.get(`${AI}/getGlobalAiConfig()`);
            return unwrapAction<Record<string, any>>(r.data) ?? {};
        }, {} as Record<string, any>),
        safe(async () => {
            const r = await axiosInstance.get(`${AI}/AIModels?$select=modelId`);
            return unwrapList<{ modelId: string }>(r.data);
        }, [] as { modelId: string }[]),
        safe(async () => {
            const r = await axiosInstance.get(`${EIGHTD}/Reports?$select=ID,status`);
            return unwrapList<{ ID: string; status: string }>(r.data);
        }, [] as { ID: string; status: string }[]),
    ]);

    const embedded = cases.filter((c) => c.embeddingModel);

    return {
        criteriaEnabled: criteria.filter((c) => c.enabled).length,
        criteriaTotal: criteria.length,
        maxScore: criteria.filter((c) => c.enabled).reduce((s, c) => s + (c.weight ?? 0), 0),
        hasVectorStep: criteria.some((c) => c.enabled && c.matchType === 'cosine'),

        minScore: settings?.minScore ?? 0,
        topN: settings?.topN ?? 0,
        closedOnly: settings?.closedOnly ?? true,

        libraryCount: cases.length,
        embeddedCount: embedded.length,
        embeddingModel: embedded[0]?.embeddingModel ?? null,

        promptsFilled: prompts.filter((p) => (p.systemPrompt ?? '').trim()).length,
        promptsTotal: prompts.length,

        defaultModel: aiConfigRaw?.model ?? null,
        activityModels: (aiConfigRaw?.models ?? {}) as Record<string, string>,
        modelsInRegistry: models.length,

        reportsAnalyzed: reports.filter((r) => r.status === 'Analyzed').length,
        reportsTotal: reports.length,
    };
}
