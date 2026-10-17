/**
 * Đề xuất bảo trì / kiểm soát phòng ngừa — LUẬT, không hỏi model.
 *
 * ── Vì sao không "dự đoán bảo trì" ──
 * App không có nhật ký bảo trì, không có danh mục thiết bị, không có dữ liệu cảm
 * biến. Dự đoán trên nền đó là bịa số — trái đúng nguyên tắc của sản phẩm (TC-04
 * thà từ chối còn hơn trích một tiền lệ yếu). Nên ở đây chỉ dùng thứ con người
 * ĐÃ duyệt: nguyên nhân gốc D4 (chuỗi 5-Why + Ishikawa có đánh dấu) và hành động
 * phòng ngừa của case đã đóng cùng loại lỗi.
 *
 * ── Vì sao loại kiểm soát do luật quyết ──
 * Một mã sai trông y hệt mã đúng và được đếm y hệt — cùng lý do `classifyTaskCode`
 * là luật. Bảo trì chỉ là MỘT loại kiểm soát: nguyên nhân thuộc Method thì đáp án
 * là sửa hướng dẫn công việc, không phải lịch bảo trì.
 *
 * ── Đi sâu, không đi ngang ──
 * "Lỗi người vận hành" là bề mặt. Khi nhóm được đánh dấu là Man, đi XUỐNG chuỗi
 * 5-Why tới câu sâu nhất chỉ ra một nguyên nhân hệ thống mà nhà máy kiểm soát
 * được. Không xếp hạng các nhóm nguyên nhân và không nhặt một nhóm người đã đánh
 * N chỉ để "có đáp án bảo trì" — dữ liệu chỉ có Y/N, xếp hạng là phán xét chưa
 * ai duyệt.
 *
 * ── Không bịa số ──
 * Khoảng / ngưỡng chỉ được bóc từ chính văn bản số đo ("41,200 of 30,000
 * strokes"). Không có thì để null và dừng hỏi người.
 *
 * Module thuần: không import cds, test được bằng dữ liệu bảng.
 */

import type { Stop } from '../stops';

export const CATEGORIES = ['Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment'] as const;
export type Category = typeof CATEGORIES[number];

export type ControlType =
    | 'preventive-maintenance'
    | 'calibration'
    | 'error-proofing'
    | 'work-instruction'
    | 'incoming-inspection'
    | 'condition-monitoring'
    /** Chỉ dùng khi không có nguyên nhân nào kiểm soát được — không phải một lịch bảo trì. */
    | 'inspection-frequency';

/** Bảng ánh xạ của Master Idea. Đổi bảng này là đổi định nghĩa của tính năng. */
export const CATEGORY_CONTROL: Record<Category, ControlType> = {
    Machine: 'preventive-maintenance',
    Measurement: 'calibration',
    Man: 'error-proofing',
    Method: 'work-instruction',
    Material: 'incoming-inspection',
    Environment: 'condition-monitoring',
};

/** Loại kiểm soát chỉ có nghĩa khi có một con số (chu kỳ / ngưỡng). */
const NEEDS_INTERVAL = new Set<ControlType>(['preventive-maintenance', 'calibration', 'condition-monitoring']);

const CONTROL_LABEL: Record<ControlType, string> = {
    'preventive-maintenance': 'Preventive maintenance / tool-life limit',
    calibration: 'Calibrate the measuring equipment',
    'error-proofing': 'Error-proofing (poka-yoke)',
    'work-instruction': 'Revise the work instruction',
    'incoming-inspection': 'Incoming inspection / supplier action',
    'condition-monitoring': 'Monitor environmental conditions',
    'inspection-frequency': 'Increase inspection frequency',
};

/**
 * Từ khoá nhận ra nguyên nhân HỆ THỐNG trong một câu why — chỉ dùng khi nhóm
 * được đánh dấu là Man. Thứ tự là thứ tự ưu tiên khi một câu khớp nhiều nhóm.
 */
const SYSTEM_CAUSE_KEYWORDS: [Category, RegExp][] = [
    ['Machine', /\b(machine|tool|broach|insert|spindle|fixture|die|mou?ld|wear|tool[- ]?life|strokes?|cycles?|maintenance|PM plan|lubricat\w*|controller)\b/i],
    ['Measurement', /\b(gauges?|gages?|calibrat\w*|measur\w*|R&R|CMM|sensor|instrument|torque wrench)\b/i],
    ['Method', /\b(procedure|instruction|SOP|DOC-\d+|checklist|standard work|no step|work method)\b/i],
    ['Material', /\b(supplier|raw material|incoming|certificate|mill cert)\b/i],
    ['Environment', /\b(temperature|humidity|dust|contamination|ambient|vibration)\b/i],
];

/** Nguyên nhân nằm ngoài tầm kiểm soát của nhà máy. Khớp ⇒ câu why đó không dùng được. */
const EXTERNAL_CAUSE = /\b(force majeure|natural disaster|earthquake|flood|typhoon|storm|lightning|grid (?:power )?(?:outage|failure)|utility (?:outage|failure)|customer misuse|misused by (?:the )?customer|in transit|transport damage|carrier damage|outside (?:our|the plant'?s) control|uncontrollable)\b/i;

// ─────────────────────────────────────────────────────────────────────────────
// Chuẩn hoá D4
// ─────────────────────────────────────────────────────────────────────────────

export interface WhyStep {
    step: number;
    answer: string;
    evidence: string | null;
}

export interface RootCauseInput {
    /** Nhóm 6M người đã đánh dấu là nguyên nhân gốc. */
    category: Category | null;
    statement: string | null;
    /** Phát hiện + số đo của các dòng Ishikawa được đánh dấu — nguồn bóc khoảng/ngưỡng. */
    markedEvidence: string[];
    whyChain: WhyStep[];
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

export function normalizeCategory(v: unknown): Category | null {
    const s = str(v).toLowerCase();
    if (!s) return null;
    if (/^(machine|tool|equipment)/.test(s)) return 'Machine';
    if (/^measure/.test(s)) return 'Measurement';
    if (/^(man|people|person|operator|manpower)/.test(s)) return 'Man';
    if (/^method/.test(s)) return 'Method';
    if (/^material/.test(s)) return 'Material';
    if (/^(environment|mother)/.test(s)) return 'Environment';
    return null;
}

function parseObject(v: unknown): Record<string, any> {
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, any>;
    try {
        const p = JSON.parse(String(v ?? ''));
        return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
    } catch {
        return {};
    }
}

/**
 * Đọc được cả hai dạng đang tồn tại:
 *   resultJson D4 của report  rootCause.ishikawaBoard[{finding, isRootCause: bool}] + rootCause.fiveWhy[{step, answer, evidence}]
 *   case nguồn (mock-data)    causesIshikawa[{description, isRootCause: 'Y'}] + fiveWhyChain[{stepNo, answer, evidenceCitation}]
 * Thiếu nhóm được đánh dấu thì rơi về `fallbackCategory` (`Reports.rootCauseCategory`).
 */
export function normalizeRootCause(d4Result: unknown, fallbackCategory?: string | null): RootCauseInput {
    const data = parseObject(d4Result);
    const rc = parseObject(data.rootCause);
    const board: any[] = [rc.ishikawa, rc.ishikawaBoard, data.causesIshikawa].find(Array.isArray) ?? [];
    const marked = board.filter((b) => b?.isRootCause === true || b?.isRootCause === 'Y');
    const chain: any[] = [rc.whyChain, rc.fiveWhy, data.whyChain, data.fiveWhyChain].find(Array.isArray) ?? [];

    return {
        category: normalizeCategory(data.confirmedRootCategory)
            ?? normalizeCategory(marked[0]?.category)
            ?? normalizeCategory(rc.category)
            ?? normalizeCategory(fallbackCategory),
        statement: str(rc.statement) || null,
        markedEvidence: marked.flatMap((b) => [str(b.finding ?? b.description), str(b.metricValue)]).filter(Boolean),
        whyChain: chain
            .map((w, i) => ({
                step: Number(w?.step ?? w?.stepNo) || i + 1,
                answer: str(w?.answer),
                evidence: str(w?.evidence ?? w?.evidenceCitation) || null,
            }))
            .filter((w) => w.answer)
            .sort((a, b) => a.step - b.step),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phân loại
// ─────────────────────────────────────────────────────────────────────────────

export interface ControlClassification {
    /** false = không có câu why nào nhà máy kiểm soát được (chuỗi rỗng hoặc toàn nguyên nhân ngoài). */
    controllable: boolean;
    category: Category | null;
    controlType: ControlType | null;
    whyStepUsed: number | null;
    whyText: string | null;
    reason: string;
}

/**
 * Nhóm do NGƯỜI đánh dấu quyết định loại kiểm soát. Câu why sâu nhất kiểm soát
 * được cho `whyStepUsed` và nội dung task. Riêng nhóm Man: đi xuống chuỗi để tìm
 * nguyên nhân hệ thống — chỉ giữ Man khi không câu nào chỉ ra hệ thống.
 */
export function classifyControl(rootCause: RootCauseInput): ControlClassification {
    const controllable = rootCause.whyChain.filter((w) => !EXTERNAL_CAUSE.test(`${w.answer} ${w.evidence ?? ''}`));
    if (!controllable.length) {
        return {
            controllable: false, category: rootCause.category, controlType: null, whyStepUsed: null, whyText: null,
            reason: rootCause.whyChain.length
                ? 'Every answer in the 5-Why chain points to a cause outside what the plant controls.'
                : 'The 5-Why chain is empty - there is no controllable cause to build on.',
        };
    }
    const deepest = controllable[controllable.length - 1];

    if (rootCause.category === 'Man') {
        for (const w of [...controllable].reverse()) {
            const hit = SYSTEM_CAUSE_KEYWORDS.find(([, re]) => re.test(w.answer));
            if (hit) {
                return {
                    controllable: true, category: hit[0], controlType: CATEGORY_CONTROL[hit[0]],
                    whyStepUsed: w.step, whyText: w.answer,
                    reason: `Surface cause is Man; why #${w.step} points to a ${hit[0]} system cause.`,
                };
            }
        }
    }

    if (!rootCause.category) {
        return {
            controllable: true, category: null, controlType: null, whyStepUsed: deepest.step, whyText: deepest.answer,
            reason: 'D4 has no 6M category marked as the root cause (Ishikawa Y).',
        };
    }
    return {
        controllable: true, category: rootCause.category, controlType: CATEGORY_CONTROL[rootCause.category],
        whyStepUsed: deepest.step, whyText: deepest.answer,
        reason: `${rootCause.category} is marked as the root cause; using the deepest why #${deepest.step}.`,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Khoảng / ngưỡng
// ─────────────────────────────────────────────────────────────────────────────

export interface Interval {
    limit: number;
    actual: number | null;
    unit: string;
    /** Đoạn văn bản số đo sinh ra con số — để người đọc kiểm lại. */
    sourceText: string;
}

const UNIT = '(strokes?|cycles?|shots?|hits?|parts?|pcs|pieces?|hours?|hrs?|days?|weeks?|months?|shifts?)';
const NUM = '(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)';
const UNIT_CANON: [RegExp, string][] = [
    [/^stroke/, 'strokes'], [/^cycle/, 'cycles'], [/^shot/, 'shots'], [/^hit/, 'hits'],
    [/^(part|pcs|piece)/, 'parts'], [/^(hour|hr)/, 'hours'], [/^day/, 'days'], [/^week/, 'weeks'],
    [/^month/, 'months'], [/^shift/, 'shifts'],
];
const canonUnit = (u: string) => UNIT_CANON.find(([re]) => re.test(u.toLowerCase()))?.[1] ?? u.toLowerCase();
// Dấu phẩy chỉ được hiểu là phân cách hàng nghìn ("41,200"). "0,32" không khớp NUM
// nên không bao giờ bị đọc nhầm thành 32.
const toNumber = (s: string) => Number(s.replace(/,/g, ''));

const PATTERNS: { re: RegExp; read: (m: RegExpMatchArray) => Omit<Interval, 'sourceText'> }[] = [
    // "41,200 of 30,000 strokes" · "41,200 strokes against a 30,000 stroke limit"
    {
        re: new RegExp(`${NUM}\\s*(?:${UNIT}\\s+)?(?:of|vs\\.?|against(?:\\s+an?)?)\\s+${NUM}[\\s-]*${UNIT}`, 'i'),
        read: (m) => ({ actual: toNumber(m[1]), limit: toNumber(m[3]), unit: canonUnit(m[4]) }),
    },
    // "every 500 cycles"
    {
        re: new RegExp(`every\\s+${NUM}\\s*${UNIT}`, 'i'),
        read: (m) => ({ actual: null, limit: toNumber(m[1]), unit: canonUnit(m[2]) }),
    },
    // "30,000 stroke limit" · "90-day interval"
    {
        re: new RegExp(`${NUM}[\\s-]*${UNIT}\\s+(?:replacement\\s+)?(?:limit|interval)`, 'i'),
        read: (m) => ({ actual: null, limit: toNumber(m[1]), unit: canonUnit(m[2]) }),
    },
];

/** Bóc khoảng / ngưỡng từ văn bản số đo thật. Không bóc được ⇒ null. KHÔNG BAO GIỜ tự đặt số. */
export function extractInterval(evidence: string | readonly string[]): Interval | null {
    for (const text of (typeof evidence === 'string' ? [evidence] : evidence)) {
        for (const p of PATTERNS) {
            const m = str(text).match(p.re);
            if (m) {
                const value = p.read(m);
                if (Number.isFinite(value.limit) && value.limit > 0) return { ...value, sourceText: m[0] };
            }
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Khoảng cách tái phát
// ─────────────────────────────────────────────────────────────────────────────

export interface RecurrenceGap {
    from: string;
    to: string;
    days: number;
    /** after = lần xảy ra kết thúc khoảng này nằm SAU ngày áp dụng hành động. */
    phase: 'before' | 'after';
}

export interface RecurrenceResult {
    dates: string[];
    actionDate: string | null;
    gaps: RecurrenceGap[];
    before: number[];
    after: number[];
}

const DAY_MS = 86_400_000;
const isoDay = (v: string) => (/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const dayNumber = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY_MS;

/**
 * Số ngày thật giữa các lần xảy ra liên tiếp của một loại lỗi, tách trước / sau
 * ngày áp dụng hành động phòng ngừa. Chỉ số đã xảy ra — không có dự báo.
 */
export function recurrenceIntervals(occurrences: readonly string[], actionDate: string | null): RecurrenceResult {
    const dates = [...new Set(occurrences.map(isoDay).filter((d): d is string => !!d))].sort();
    const action = actionDate ? isoDay(actionDate) : null;
    const gaps: RecurrenceGap[] = [];
    for (let i = 1; i < dates.length; i++) {
        gaps.push({
            from: dates[i - 1],
            to: dates[i],
            days: dayNumber(dates[i]) - dayNumber(dates[i - 1]),
            phase: action && dates[i] > action ? 'after' : 'before',
        });
    }
    return {
        dates,
        actionDate: action,
        gaps,
        before: gaps.filter((g) => g.phase === 'before').map((g) => g.days),
        after: gaps.filter((g) => g.phase === 'after').map((g) => g.days),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dựng kế hoạch
// ─────────────────────────────────────────────────────────────────────────────

export type ProposalStatus = 'Proposed' | 'Approved' | 'Rejected';

export interface MaintenanceProposal {
    /** Cố định giữa các lần tạo lại — để quyết định cũ không bị mất. */
    id: string;
    controlType: ControlType;
    task: string;
    interval: Interval | null;
    owner: string | null;
    rootCauseCategory: Category | null;
    whyStepUsed: number | null;
    sourceCaseIds: string[];
    status: ProposalStatus;
    decidedBy?: string | null;
    decidedAt?: string | null;
    note?: string | null;
}

export interface HistoryCase {
    notificationId: string;
    foundDate: string | null;
    completionDate: string | null;
    rootCauseCategory: string | null;
    preventiveActions: string[];
}

export interface PlanInput {
    notificationId: string;
    defectCode: string | null;
    workCenterId: string | null;
    foundDate: string | null;
    d4Approved: boolean;
    d4Result: unknown;
    recordedRootCauseCategory: string | null;
    /** Case ĐÃ ĐÓNG cùng mã lỗi + work center, không gồm case hiện tại. */
    history: HistoryCase[];
}

export interface MaintenancePlan {
    defectType: { defectCode: string | null; workCenterId: string | null };
    /** Có giá trị ⇒ từ chối, không có đề xuất nào. */
    refusal: string | null;
    classification: ControlClassification | null;
    occurrences: { notificationId: string; foundDate: string; current: boolean }[];
    intervals: RecurrenceResult;
    pastPreventiveActions: { caseId: string; text: string }[];
    proposals: MaintenanceProposal[];
    stops: Stop[];
    generatedAt: string;
}

function planStop(type: Stop['type'], rule: string, fields: Pick<Stop, 'reason' | 'questionForHuman' | 'requiredRole' | 'facts'>): Stop {
    return { id: `${type}:${rule}:D7`, type, rule, step: 'D7', blocking: false, ...fields };
}

export function buildMaintenancePlan(input: PlanInput, now = new Date().toISOString()): MaintenancePlan {
    const occurrences = [
        ...input.history
            .filter((h) => h.foundDate)
            .map((h) => ({ notificationId: h.notificationId, foundDate: String(h.foundDate).slice(0, 10), current: false })),
        ...(input.foundDate ? [{ notificationId: input.notificationId, foundDate: input.foundDate.slice(0, 10), current: true }] : []),
    ].sort((a, b) => a.foundDate.localeCompare(b.foundDate));

    // Ngày áp dụng hành động = case đóng muộn nhất TRƯỚC lần xảy ra hiện tại.
    const current = input.foundDate?.slice(0, 10) ?? null;
    const actionDate = input.history
        .map((h) => h.completionDate?.slice(0, 10) ?? '')
        .filter((d) => d && (!current || d <= current))
        .sort()
        .pop() ?? null;

    const base: MaintenancePlan = {
        defectType: { defectCode: input.defectCode, workCenterId: input.workCenterId },
        refusal: null,
        classification: null,
        occurrences,
        intervals: recurrenceIntervals(occurrences.map((o) => o.foundDate), actionDate),
        pastPreventiveActions: input.history.flatMap((h) => h.preventiveActions.map((text) => ({ caseId: h.notificationId, text }))),
        proposals: [],
        stops: [],
        generatedAt: now,
    };

    if (!input.d4Approved) {
        return { ...base, refusal: 'D4 is not approved yet - proposals are only made on a root cause a person has approved.' };
    }

    const rootCause = normalizeRootCause(input.d4Result, input.recordedRootCauseCategory);
    const cls = classifyControl(rootCause);
    base.classification = cls;

    if (!cls.controllable) {
        return {
            ...base,
            proposals: [{
                id: 'inspection-frequency:0',
                controlType: 'inspection-frequency',
                task: `${CONTROL_LABEL['inspection-frequency']} for this defect type until someone identifies a cause the plant controls.`,
                interval: null,
                owner: null,
                rootCauseCategory: rootCause.category,
                whyStepUsed: null,
                sourceCaseIds: [input.notificationId],
                status: 'Proposed',
            }],
            stops: [planStop('outside-scope', 'maintenance-no-controllable-cause', {
                reason: cls.reason,
                questionForHuman: 'Is this cause really outside what the plant controls? If not, add a why that points to a cause the plant controls.',
                requiredRole: 'Quality Manager',
                facts: rootCause.whyChain.map((w) => `why #${w.step}: ${w.answer}`),
            })],
        };
    }

    if (!cls.controlType || !cls.category) {
        return {
            ...base,
            stops: [planStop('unverified-facts', 'maintenance-no-root-category', {
                reason: cls.reason,
                questionForHuman: 'Which 6M category is the root cause? Mark it on the D4 Ishikawa, then regenerate the proposals.',
                requiredRole: 'Quality Engineer',
                facts: rootCause.statement ? [rootCause.statement] : [],
            })],
        };
    }

    // Case đóng chỉ được trích làm nguồn khi cùng nhóm nguyên nhân — trích một case
    // khác nguyên nhân là gán cho đề xuất một bằng chứng nó không có.
    const sourceCaseIds = [
        input.notificationId,
        ...input.history.filter((h) => normalizeCategory(h.rootCauseCategory) === cls.category).map((h) => h.notificationId),
    ];
    const usedWhy = rootCause.whyChain.find((w) => w.step === cls.whyStepUsed);
    const evidence = [...rootCause.markedEvidence, usedWhy?.answer ?? '', usedWhy?.evidence ?? ''];

    const drafts: Omit<MaintenanceProposal, 'status' | 'owner' | 'rootCauseCategory' | 'whyStepUsed' | 'sourceCaseIds'>[] = [{
        id: `${cls.controlType}:${cls.whyStepUsed ?? 0}`,
        controlType: cls.controlType,
        task: `${CONTROL_LABEL[cls.controlType]} - addresses: ${cls.whyText}`,
        interval: NEEDS_INTERVAL.has(cls.controlType) ? extractInterval(evidence) : null,
    }];
    if (cls.controlType === 'error-proofing') {
        // Poka-yoke không ai kiểm thì sẽ hỏng âm thầm — nên kèm một mục PM kiểm nó.
        drafts.push({
            id: `preventive-maintenance:poka-yoke:${cls.whyStepUsed ?? 0}`,
            controlType: 'preventive-maintenance',
            task: 'Add a maintenance checklist item: verify the error-proofing (poka-yoke) device still works.',
            interval: extractInterval(evidence),
        });
    }

    const proposals: MaintenanceProposal[] = drafts.map((d) => ({
        ...d,
        owner: null,
        rootCauseCategory: cls.category,
        whyStepUsed: cls.whyStepUsed,
        sourceCaseIds,
        status: 'Proposed',
    }));

    const stops = proposals
        .filter((p) => !p.interval && (NEEDS_INTERVAL.has(p.controlType)))
        .map((p) => planStop('unverified-facts', `maintenance-interval-missing:${p.id}`, {
            reason: `The evidence has no measured interval or limit for "${CONTROL_LABEL[p.controlType]}".`,
            questionForHuman: 'What is the interval or limit? A person must enter it from a real measurement - the system does not set numbers.',
            requiredRole: 'Maintenance Engineer',
            facts: evidence.filter(Boolean).slice(0, 5),
        }));

    return { ...base, proposals, stops };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quyết định của người
// ─────────────────────────────────────────────────────────────────────────────

/** Tạo lại không được xoá quyết định đã có: đề xuất cùng id giữ trạng thái cũ. */
export function carryDecisions(previous: unknown, next: MaintenancePlan): MaintenancePlan {
    const prev = parseObject(previous);
    const decided = new Map<string, MaintenanceProposal>(
        (Array.isArray(prev.proposals) ? prev.proposals : [])
            .filter((p: any) => p?.id && p.status && p.status !== 'Proposed')
            .map((p: any) => [String(p.id), p]),
    );
    return {
        ...next,
        proposals: next.proposals.map((p) => {
            const old = decided.get(p.id);
            return old ? { ...p, status: old.status, decidedBy: old.decidedBy ?? null, decidedAt: old.decidedAt ?? null, note: old.note ?? null } : p;
        }),
    };
}

export interface DecisionResult {
    plan: Record<string, any>;
    proposal: MaintenanceProposal;
    fromStatus: ProposalStatus;
}

/** Ghi quyết định lên MỘT đề xuất. Danh tính do server truyền vào, không nhận từ client. */
export function applyDecision(
    storedPlan: unknown,
    proposalId: string,
    decision: 'approve' | 'reject',
    note: string | null,
    actor: string,
    now = new Date().toISOString(),
): DecisionResult {
    const plan = parseObject(storedPlan);
    const list: MaintenanceProposal[] = Array.isArray(plan.proposals) ? plan.proposals : [];
    const target = list.find((p) => p?.id === proposalId);
    if (!target) throw Object.assign(new Error(`Proposal ${proposalId} not found in the saved maintenance plan.`), { code: 404 });

    const proposal: MaintenanceProposal = {
        ...target,
        status: decision === 'approve' ? 'Approved' : 'Rejected',
        decidedBy: actor,
        decidedAt: now,
        note: str(note) || null,
    };
    return {
        plan: { ...plan, proposals: list.map((p) => (p.id === proposalId ? proposal : p)) },
        proposal,
        fromStatus: target.status ?? 'Proposed',
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lịch sử bảo trì theo loại lỗi (Master Data)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Đề xuất ĐÃ DUYỆT trong một kế hoạch đã lưu trên D7. Chỗ DUY NHẤT đọc kế hoạch
 * thành danh sách lịch sử — tab Master Data và panel D7 phải thấy cùng một tập.
 */
export function approvedProposalsOf(storedPlan: unknown): MaintenanceProposal[] {
    const plan = parseObject(storedPlan);
    return (Array.isArray(plan.proposals) ? plan.proposals : [])
        .filter((p: MaintenanceProposal | null) => p?.status === 'Approved');
}

export interface HistoryReport {
    ID: string;
    notificationId: string;
    defectCode: string | null;
    defectText: string | null;
    workCenterId: string | null;
    workCenterDesc: string | null;
    foundDate: string | null;
    /** `preventive.maintenancePlan` trên D7 của report, nếu có. */
    plan: unknown;
}

export interface HistoryOccurrence {
    notificationId: string;
    defectCode: string | null;
    workCenterId: string | null;
    foundDate: string | null;
}

export interface MaintenanceHistoryEntry extends MaintenanceProposal {
    reportID: string;
    notificationId: string;
}

export interface MaintenanceHistoryGroup {
    defectCode: string;
    defectText: string | null;
    workCenterId: string;
    workCenterDesc: string | null;
    /** Số case thật (có ngày phát hiện) của loại lỗi này — report và case đã đóng, không đếm trùng. */
    occurrenceCount: number;
    /** Khoảng ngày giữa hai lần xảy ra gần nhất. null khi chưa đủ 2 lần — không bao giờ ước lượng. */
    latestGapDays: number | null;
    proposals: MaintenanceHistoryEntry[];
}

const typeKey = (defectCode: string | null, workCenterId: string | null) => `${defectCode ?? ''}|${workCenterId ?? ''}`;

/**
 * Gom đề xuất đã duyệt theo loại lỗi (mã lỗi + work center). Chỉ loại lỗi có ít
 * nhất một đề xuất đã duyệt mới thành nhóm; nhóm có quyết định mới nhất đứng đầu.
 */
export function groupMaintenanceHistory(reports: readonly HistoryReport[], closedCases: readonly HistoryOccurrence[]): MaintenanceHistoryGroup[] {
    const groups = new Map<string, MaintenanceHistoryGroup>();
    for (const r of reports) {
        if (!r.defectCode || !r.workCenterId) continue;
        const approved = approvedProposalsOf(r.plan);
        if (!approved.length) continue;
        const key = typeKey(r.defectCode, r.workCenterId);
        const group = groups.get(key) ?? {
            defectCode: r.defectCode,
            defectText: r.defectText,
            workCenterId: r.workCenterId,
            workCenterDesc: r.workCenterDesc,
            occurrenceCount: 0,
            latestGapDays: null,
            proposals: [],
        };
        group.proposals.push(...approved.map((p) => ({ ...p, reportID: r.ID, notificationId: r.notificationId })));
        groups.set(key, group);
    }

    for (const [key, group] of groups) {
        // Một case có thể nằm ở cả `Reports` lẫn kho case đóng (case đóng trong app
        // được ghi bù vào kho) — đếm theo mã case, không theo dòng.
        const foundBy = new Map<string, string>();
        for (const o of [...closedCases, ...reports]) {
            if (typeKey(o.defectCode, o.workCenterId) === key && o.foundDate) foundBy.set(o.notificationId, String(o.foundDate).slice(0, 10));
        }
        const { gaps } = recurrenceIntervals([...foundBy.values()], null);
        group.occurrenceCount = foundBy.size;
        group.latestGapDays = gaps.length ? gaps[gaps.length - 1].days : null;
        group.proposals.sort((a, b) => String(b.decidedAt ?? '').localeCompare(String(a.decidedAt ?? '')));
    }

    return [...groups.values()].sort((a, b) =>
        String(b.proposals[0]?.decidedAt ?? '').localeCompare(String(a.proposals[0]?.decidedAt ?? '')));
}
