/**
 * Khi nào AI phải DỪNG và chuyển cho người — và vì sao, theo ba loại.
 *
 * ── Ba loại dừng ──
 *   1. unverified-facts   Dữ kiện đầu vào thiếu, mơ hồ hoặc mâu thuẫn. AI không
 *                         được khẳng định nguyên nhân gốc (D4) trên nền đó.
 *   2. outside-scope      Ngoài phạm vi quy trình / kho tri thức: không phải lỗi
 *                         sản xuất, hoặc không có tiền lệ nào để dựa vào. Từ chối
 *                         hoặc chuyển chuyên gia — không bịa tiền lệ.
 *   3. exceeds-authority  Việc AI soạn được nhưng KHÔNG được tự quyết: huỷ/thu hồi
 *                         lô, đổi SOP/FMEA, COPQ vượt ngưỡng, báo khách hàng.
 *
 * ── Vì sao là LUẬT chứ không hỏi LLM ──
 * Một lần dừng phải lặp lại được: cùng đầu vào thì cùng kết luận, Verify kiểm
 * được, và người nhận đọc được ĐÚNG dữ kiện nào gây dừng. Model tự khai "tôi
 * không chắc" thì không có tính chất nào trong ba điều đó.
 *
 * ── Chống báo lên thừa ──
 * Danh sách `gaps` của caseMapper KHÔNG phải lý do dừng: phần lớn nói "chưa có dữ
 * liệu D5/D7" — đúng là thứ AI được nhờ soạn. Dừng vì những dòng đó thì case
 * nào cũng dừng, và một hệ thống dừng ở mọi case là hệ thống không tự chủ.
 *
 * Module thuần: không import cds. Mọi ngưỡng nằm trong `STOP_CONFIG`.
 */

export const STOP_CONFIG = {
    /** COPQ (EUR) từ mức này trở lên cần Quality Manager ký trước khi đóng case. */
    copqSignOffEur: 10_000,
    /** Giá trị đo dài hơn số từ này là văn xuôi, không phải một con số đã chuẩn hoá. */
    maxWordsInMeasuredValue: 3,
    /** Hành động khoanh vùng vượt quyền QE: huỷ, thu hồi, xử lý cả lô. */
    lotDispositionPattern: /\b(scrap|recall|verschrott\w*|whole lot|entire lot|all lots|ganze charge)\b/i,
    /** Hành động phòng ngừa đổi tài liệu kiểm soát: cần chủ quy trình duyệt. */
    controlledDocumentPattern: /\b(SOP|FMEA|control plan|work instruction|PPAP)\b/i,
} as const;

export const STOP_TYPES = ['unverified-facts', 'outside-scope', 'exceeds-authority'] as const;
export type StopType = typeof STOP_TYPES[number];

export const STOP_TYPE_LABEL: Record<StopType, string> = {
    'unverified-facts': 'Unverified facts',
    'outside-scope': 'Outside scope',
    'exceeds-authority': 'Exceeds authority',
};

export interface Stop {
    /** Ổn định giữa các lần tính: `${type}:${rule}:${step}` — dùng làm khoá khi gỡ dừng. */
    id: string;
    type: StopType;
    rule: string;
    /** Bước mà lần dừng này chặn hoặc thuộc về. */
    step: string;
    /** Lý do, nêu đích danh dữ kiện. */
    reason: string;
    questionForHuman: string;
    requiredRole: string;
    /** true = bước `step` không duyệt được cho tới khi có người gỡ kèm ghi chú. */
    blocking: boolean;
    /** Dữ kiện gây dừng, để lưu vào vết khi gỡ. */
    facts: string[];
}

export interface StopInput {
    /** `CaseContext` (đã parse) — hoặc dạng tương thích từ caseMapper. */
    caseContext: any;
    /** Nguyên nhân gốc trên hồ sơ (`Reports.rootCauseCategory`), nếu có. */
    recordedRootCause?: string | null;
    /** Kết quả chẩn đoán độc lập từ số đo (`Reports.aiRootCause`), nếu có. */
    independentRootCause?: string | null;
    /**
     * Tiền lệ cho D4: số case đạt ngưỡng, kèm lý do khi bằng 0. `null` = chưa
     * tìm (report chưa phân tích) — KHÔNG dừng vì điều chưa biết.
     */
    precedents?: { count: number; reason?: string | null; basis?: string | null } | null;
    /** Câu hành động AI đề xuất / người đã nhận ở từng bước (D3, D7). */
    stepActions?: Partial<Record<'D3' | 'D7', string[]>>;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const norm = (s: unknown) => text(s).toLowerCase();

/**
 * Giá trị đo có phải một con số đã chuẩn hoá không.
 *
 * "0.26mm", "Class 3", "38 um" — được. "gemessen 0,32mm, Sollwert max 0,10mm" —
 * không: con số trong đó do parser BÓC RA từ văn xuôi, có dấu phẩy thập phân, và
 * người nhập chưa từng xác nhận nó là 0.32 hay 32.
 */
export function isAmbiguousMeasurement(value: unknown): boolean {
    const s = text(value);
    if (!s) return false;
    if (/\d,\d/.test(s)) return true;
    return s.split(/\s+/).length > STOP_CONFIG.maxWordsInMeasuredValue;
}

const hasNumber = (value: unknown) => /\d/.test(text(value));

function stop(type: StopType, rule: string, step: string, fields: Omit<Stop, 'id' | 'type' | 'rule' | 'step'>): Stop {
    return { id: `${type}:${rule}:${step}`, type, rule, step, ...fields };
}

/** Nguyên nhân được hồ sơ đánh dấu, và dòng Ishikawa có số đo mâu thuẫn với nó. */
function contradictingEvidence(ctx: any): { flagged: string; flaggedMetric: string | null; measured: { category: string; metric: string } | null } | null {
    const rows: any[] = Array.isArray(ctx?.ishikawa) ? ctx.ishikawa : [];
    const flaggedRow = rows.find((r) => r?.isRootCause === true || r?.isRootCause === 'Y');
    const flagged = text(flaggedRow?.category) || text(ctx?.rootCause?.category);
    if (!flagged) return null;
    const flaggedMetric = text(flaggedRow?.metricValue) || null;
    const measuredRow = rows.find((r) => r !== flaggedRow && text(r?.metricValue) && norm(r?.category) !== norm(flagged)
        && /vs|max|min|spec|>|</i.test(text(r?.metricValue)));
    return {
        flagged,
        flaggedMetric,
        measured: measuredRow ? { category: text(measuredRow.category), metric: text(measuredRow.metricValue) } : null,
    };
}

/**
 * Tính các lần dừng của một case. Rỗng nghĩa là AI được đi tiếp.
 */
export function evaluateStops(input: StopInput): Stop[] {
    const ctx = input.caseContext ?? {};
    const stops: Stop[] = [];
    const inspections: any[] = Array.isArray(ctx.inspections) ? ctx.inspections : [];
    const symptom = short(text(ctx?.header?.symptomShortText) || 'this defect', 70);

    // ── 1. Dữ kiện chưa xác minh ────────────────────────────────────────────
    const measured = inspections.filter((i) => hasNumber(i?.measuredValue));
    if (measured.length === 0) {
        stops.push(stop('unverified-facts', 'no-measurement', 'D4', {
            reason: inspections.length === 0
                ? `No inspection result is on record for "${symptom}" — there is nothing to measure the root cause against.`
                : `${inspections.length} inspection row(s) are on record but none carries a measured number.`,
            questionForHuman: 'Which characteristic was measured, what value was found, and what is its specification?',
            requiredRole: 'Quality Engineer',
            blocking: true,
            facts: inspections.slice(0, 3).map((i) => `${text(i?.characteristic) || '?'}: "${text(i?.measuredValue)}"`),
        }));
    }

    const ambiguous = inspections.filter((i) => isAmbiguousMeasurement(i?.measuredValue));
    if (ambiguous.length > 0) {
        const first = ambiguous[0];
        stops.push(stop('unverified-facts', 'ambiguous-measurement', 'D4', {
            reason: `Measured value for "${text(first?.characteristic) || 'an inspection'}" is free text ("${short(text(first?.measuredValue), 70)}"); the number used downstream was parsed out of it and has not been confirmed.`,
            questionForHuman: `Confirm the measured value and unit for ${ambiguous.map((i) => `"${text(i?.characteristic) || '?'}"`).join(', ')} (e.g. is "0,32" 0.32 mm?).`,
            requiredRole: 'Quality Engineer',
            blocking: true,
            facts: ambiguous.slice(0, 3).map((i) => `${text(i?.characteristic) || '?'}: "${short(text(i?.measuredValue), 80)}"`),
        }));
    }

    const recorded = text(input.recordedRootCause);
    const independent = text(input.independentRootCause);
    const evidence = contradictingEvidence(ctx);
    if (recorded && independent && norm(recorded) !== norm(independent)) {
        stops.push(stop('unverified-facts', 'record-contradicts-evidence', 'D4', {
            reason: `The record names "${recorded}" as root cause, but the independent check from the measurements points to "${independent}".`,
            questionForHuman: `Which evidence supports "${recorded}"? If none, should the root cause be changed to "${independent}"?`,
            requiredRole: 'Quality Engineer',
            blocking: true,
            facts: [`recorded: ${recorded}`, `independent check: ${independent}`],
        }));
    } else if (evidence?.measured && !evidence.flaggedMetric) {
        stops.push(stop('unverified-facts', 'record-contradicts-evidence', 'D4', {
            reason: `The record blames "${evidence.flagged}" with no measurement behind it, while "${evidence.measured.category}" has a measured deviation (${short(evidence.measured.metric, 60)}).`,
            questionForHuman: `Which evidence supports "${evidence.flagged}"? If none, should the root cause be "${evidence.measured.category}"?`,
            requiredRole: 'Quality Engineer',
            blocking: true,
            facts: [`recorded: ${evidence.flagged} (no metric)`, `${evidence.measured.category}: ${evidence.measured.metric}`],
        }));
    }

    // ── 2. Ngoài phạm vi ────────────────────────────────────────────────────
    if (input.precedents && input.precedents.count === 0) {
        const wc = text(ctx?.product?.workCenterId);
        const code = text(ctx?.product?.defectCode);
        stops.push(stop('outside-scope', 'no-precedent', 'D4', {
            reason: input.precedents.reason
                ? `No precedent qualifies: ${short(text(input.precedents.reason), 200)}`
                : `No closed case in the library matches ${[wc, code].filter(Boolean).join(' + ') || 'this defect'}. The AI will not cite or adapt a precedent.`,
            questionForHuman: `Who is the subject-matter expert for ${code || 'this defect type'}${wc ? ` on ${wc}` : ''}, and what should be checked first?`,
            requiredRole: 'Subject-matter expert',
            // Không chặn duyệt: QE vẫn quyết định D4 bằng bằng chứng của chính case
            // này. Lần dừng nói rằng AI KHÔNG đem tiền lệ ra làm căn cứ.
            blocking: false,
            facts: [input.precedents.basis || `matching cases: 0`],
        }));
    }

    // ── 3. Vượt thẩm quyền ──────────────────────────────────────────────────
    const copq = Number(ctx?.copqEur);
    if (Number.isFinite(copq) && copq >= STOP_CONFIG.copqSignOffEur) {
        stops.push(stop('exceeds-authority', 'copq-sign-off', 'D8', {
            reason: `Cost of poor quality is €${copq.toLocaleString('en-US')}, at or above the €${STOP_CONFIG.copqSignOffEur.toLocaleString('en-US')} sign-off limit.`,
            questionForHuman: 'Has the Quality Manager reviewed the cost and agreed to close the case?',
            requiredRole: 'Quality Manager',
            blocking: true,
            facts: [`copqEur: ${copq}`],
        }));
    }

    if (ctx?.isCustomerFacing === true) {
        stops.push(stop('exceeds-authority', 'customer-notification', 'D8', {
            reason: 'This is a customer complaint (Q1). What the customer is told — and when — is not the AI\'s call.',
            questionForHuman: 'Who informs the customer of the root cause and corrective action, and has it been sent?',
            requiredRole: 'Customer Quality Engineer',
            blocking: true,
            facts: [`origin: ${text(ctx?.origin)}`],
        }));
    }

    const sourceActions = (list: unknown) => (Array.isArray(list) ? list.map((a: any) => text(a?.actionText ?? a?.action ?? a?.name)) : []);
    const d3 = [...sourceActions(ctx?.actions?.containment), ...(input.stepActions?.D3 ?? [])].filter(Boolean);
    const lot = d3.find((a) => STOP_CONFIG.lotDispositionPattern.test(a));
    if (lot) {
        stops.push(stop('exceeds-authority', 'lot-disposition', 'D3', {
            reason: `Containment includes a lot disposition: "${short(lot, 110)}".`,
            questionForHuman: 'Who authorises scrapping / recalling this material, and for which lots exactly?',
            requiredRole: 'Quality Manager',
            blocking: true,
            facts: [lot],
        }));
    }

    const d7 = [...sourceActions(ctx?.actions?.preventive), ...(input.stepActions?.D7 ?? [])].filter(Boolean);
    const doc = d7.find((a) => STOP_CONFIG.controlledDocumentPattern.test(a));
    if (doc) {
        stops.push(stop('exceeds-authority', 'controlled-document-change', 'D7', {
            reason: `Prevention changes a controlled document: "${short(doc, 110)}".`,
            questionForHuman: 'Which process owner approves this document change, and under which revision?',
            requiredRole: 'Process owner',
            blocking: true,
            facts: [doc],
        }));
    }

    return stops;
}

/** Loại dừng chính để in ở một ô bảng: dữ kiện > phạm vi > thẩm quyền. */
export function primaryStopType(stops: Stop[]): StopType | null {
    for (const type of STOP_TYPES) {
        if (stops.some((s) => s.type === type)) return type;
    }
    return null;
}

/** Lần dừng cho một đầu vào không phải lỗi sản xuất (dùng ở sandbox giám khảo). */
export function notManufacturingStop(reason: string): Stop {
    return stop('outside-scope', 'not-a-manufacturing-defect', 'D1', {
        reason,
        questionForHuman: 'This is not a quality notification. Should it be routed to another process instead?',
        requiredRole: 'Requester',
        blocking: true,
        facts: [reason],
    });
}

/** Đầu vào thiếu trường bắt buộc: dữ kiện chưa đủ để mở 8D. */
export function incompleteInputStop(missing: string[]): Stop {
    return stop('unverified-facts', 'incomplete-input', 'D1', {
        reason: `Required fields are missing: ${missing.join(', ')}.`,
        questionForHuman: `Please provide ${missing.join(', ')} so the defect can be identified.`,
        requiredRole: 'Quality Engineer',
        blocking: true,
        facts: missing,
    });
}
