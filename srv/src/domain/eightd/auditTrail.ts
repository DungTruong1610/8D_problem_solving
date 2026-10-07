/**
 * Nội dung một dòng vết kiểm toán: ai làm gì, lúc nào, DỰA TRÊN DỮ KIỆN NÀO, VÌ SAO.
 *
 * ── Vì sao có module này ──
 * `ReviewEvents` trước đây chỉ có from/to/note/actor/at — trả lời được "ai duyệt
 * D4 lúc nào" nhưng không trả lời được "lúc duyệt, người đó đang nhìn số đo nào,
 * nguyên nhân nào, tiền lệ nào". Mà report thì đổi sau đó (chạy lại phân tích,
 * sửa task), nên đọc trạng thái HIỆN TẠI để đoán lại là nói dối. Bản chụp phải
 * được lưu ĐÚNG lúc quyết định.
 *
 * ── Chụp gì ──
 * Danh sách TRẮNG, không phải chép cả cục: chỉ những trường mà quyết định dựa vào
 * (nguyên nhân ứng viên, số đo so với spec, mã tiền lệ, trạng thái task), mỗi
 * chuỗi bị cắt ngắn, cả bản bị chặn kích thước. KHÔNG chép `sourcePayload`,
 * không chép tên người phụ trách task — id task và trạng thái là đủ để truy lại.
 *
 * Module thuần: không import cds, test được bằng dữ liệu bảng.
 */

export const AUDIT_EVENT_TYPES = ['approve', 'request-change', 'reopen', 'task-done', 'stop-resolved'] as const;
export type AuditEventType = typeof AUDIT_EVENT_TYPES[number];

/** Trần kích thước của mỗi cột JSON — đủ cho vài chục dữ kiện, không đủ để chép cả report. */
export const SNAPSHOT_MAX_CHARS = 4000;
export const BEFORE_AFTER_MAX_CHARS = 2000;
const TEXT_MAX = 160;
const LIST_MAX = 5;

const clip = (value: unknown, max = TEXT_MAX): string | null => {
    if (value === null || value === undefined) return null;
    const s = String(value).replace(/\s+/g, ' ').trim();
    if (!s) return null;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

function parse(value: unknown): any {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(String(value));
    } catch {
        return null;
    }
}

/**
 * JSON có trần kích thước. Vượt trần thì bỏ bớt mục cuối của các danh sách cho
 * tới khi vừa, rồi đánh dấu `truncated` — KHÔNG cắt giữa chuỗi JSON, vì một
 * bản chụp không parse được còn tệ hơn không có bản chụp.
 */
export function capJson(value: Record<string, unknown> | null, max: number): string | null {
    if (!value) return null;
    let text = JSON.stringify(value);
    if (text.length <= max) return text;

    const copy: Record<string, unknown> = JSON.parse(text);
    const lists = Object.keys(copy).filter((k) => Array.isArray(copy[k]));
    while (text.length > max && lists.some((k) => (copy[k] as unknown[]).length > 0)) {
        const longest = lists.reduce((a, b) => ((copy[a] as unknown[]).length >= (copy[b] as unknown[]).length ? a : b));
        (copy[longest] as unknown[]).pop();
        copy.truncated = true;
        text = JSON.stringify(copy);
    }
    if (text.length <= max) return text;
    return JSON.stringify({ truncated: true, note: 'Snapshot exceeded the size limit and was not stored in full.' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Dữ kiện chung của case
// ─────────────────────────────────────────────────────────────────────────────

export interface ReportFacts {
    notificationId?: string | null;
    caseContext?: unknown;
    precedentsJson?: unknown;
    rootCauseCategory?: string | null;
    aiRootCause?: string | null;
    aiModelAnalyze?: string | null;
    analyzedAt?: string | null;
}

/** Số đo so với spec, ưu tiên các đặc tính ngoài spec. */
export function measurementsOf(caseContext: unknown): { characteristic: string | null; measured: string | null; spec: string | null; outOfSpec: boolean | null }[] {
    const ctx = parse(caseContext);
    const list = Array.isArray(ctx?.inspections) ? ctx.inspections : [];
    return [...list]
        .sort((a: any, b: any) => Number(Boolean(b?.outOfSpec)) - Number(Boolean(a?.outOfSpec)))
        .slice(0, LIST_MAX)
        .map((i: any) => ({
            characteristic: clip(i?.characteristic, 80),
            measured: clip(i?.measuredValue, 40),
            spec: clip(i?.specValue, 40),
            outOfSpec: typeof i?.outOfSpec === 'boolean' ? i.outOfSpec : null,
        }));
}

/** Mã tiền lệ mà bước này đã được cho xem, hoặc lý do không có. */
export function precedentsFor(precedentsJson: unknown, code: string): { ids: { notificationId: string; score: number | null }[]; reason: string | null } {
    const p = parse(precedentsJson);
    const step = p?.byStep?.[code];
    const list: any[] = Array.isArray(step?.precedents) ? step.precedents
        : Array.isArray(p?.union) ? p.union
            : Array.isArray(p) ? p : [];
    const ids = list
        .filter((x) => x?.notificationId)
        .slice(0, LIST_MAX)
        .map((x) => ({ notificationId: String(x.notificationId), score: typeof x.score === 'number' ? x.score : null }));
    return { ids, reason: ids.length === 0 ? clip(step?.reason, 240) : null };
}

/**
 * Mã truy vết lượt phân tích AI đã sinh ra bản nháp. Không có bảng "AI run"
 * riêng, nên dùng cặp model + thời điểm phân tích — duy nhất cho mỗi lượt chạy
 * của một report, và khớp với thứ trang chi tiết hiển thị.
 */
export function traceIdOf(report: ReportFacts | null | undefined): string | null {
    if (!report?.analyzedAt) return null;
    const at = String(report.analyzedAt);
    return clip(report.aiModelAnalyze ? `${report.aiModelAnalyze}@${at}` : `analysis@${at}`, 64);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bản chụp cho từng loại quyết định
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_PREFIX: Record<string, string> = { D3: 'containment', D5: 'corrective', D7: 'preventive' };

function tasksOf(code: string, result: any): { taskId: string; status: string | null; evidenceRequired: boolean }[] {
    const prefix = ACTION_PREFIX[code];
    const list = prefix ? (result?.[prefix]?.assignedActions ?? result?.assignedActions) : null;
    return (Array.isArray(list) ? list : [])
        .filter((t: any) => t && typeof t === 'object')
        .slice(0, 12)
        .map((t: any, i: number) => ({
            taskId: String(t.id ?? `task-${i}`),
            status: clip(t.status, 20),
            evidenceRequired: t.evidenceRequired !== false,
        }));
}

/** Nguyên nhân ứng viên D4, chịu được các dạng `rootCause` khác nhau giữa các phiên bản prompt. */
export function rootCauseCandidateOf(d4Result: unknown): { statement: string | null; category: string | null; markedRootCauses: string[] } {
    const rc = parse(d4Result)?.rootCause ?? {};
    const board: any[] = Array.isArray(rc.ishikawa) ? rc.ishikawa : Array.isArray(rc.ishikawaBoard) ? rc.ishikawaBoard : [];
    const marked = board
        .filter((b) => b?.isRootCause === true || b?.isRootCause === 'Y')
        .slice(0, 3)
        .map((b) => clip(`${b.category ?? '?'}: ${b.description ?? b.finding ?? ''}`, TEXT_MAX) ?? '')
        .filter(Boolean);
    return { statement: clip(rc.statement, 240), category: clip(rc.category, 30), markedRootCauses: marked };
}

export interface DecisionSnapshotInput {
    code: string;
    resultJson: unknown;
    summary?: string | null;
    report?: ReportFacts | null;
    evidenceTaskIds?: Iterable<string>;
}

/**
 * Dữ kiện mà một quyết định duyệt / trả / mở lại dựa vào, tại đúng thời điểm đó.
 */
export function buildDecisionSnapshot(input: DecisionSnapshotInput): Record<string, unknown> {
    const { code, report } = input;
    const result = parse(input.resultJson);
    const snapshot: Record<string, unknown> = {
        step: code,
        notificationId: report?.notificationId ?? null,
        stepSummary: clip(input.summary, 240),
    };

    if (code === 'D2' || code === 'D4') {
        snapshot.measurements = measurementsOf(report?.caseContext);
    }
    if (code === 'D4') {
        snapshot.rootCause = rootCauseCandidateOf(result);
        snapshot.recordedRootCauseCategory = report?.rootCauseCategory ?? null;
        snapshot.aiIndependentRootCause = report?.aiRootCause ?? null;
    }
    if (code === 'D4' || code === 'D5' || code === 'D7') {
        const prec = precedentsFor(report?.precedentsJson, code);
        snapshot.precedents = prec.ids;
        if (prec.reason) snapshot.precedentsNote = prec.reason;
    }
    if (ACTION_PREFIX[code]) {
        const evidence = new Set(input.evidenceTaskIds ?? []);
        snapshot.tasks = tasksOf(code, result).map((t) => ({ ...t, hasEvidence: evidence.has(t.taskId) }));
    }
    return snapshot;
}

/** Dữ kiện của một lần hoàn tất task. */
export function buildTaskDoneSnapshot(input: {
    code: string;
    taskId: string;
    taskName?: string | null;
    outcome?: string | null;
    evidenceIds?: string[];
    via: 'evidence-upload' | 'execution-note';
}): Record<string, unknown> {
    return {
        step: input.code,
        taskId: input.taskId,
        task: clip(input.taskName, 120),
        outcome: clip(input.outcome, 240),
        evidenceIds: (input.evidenceIds ?? []).slice(0, LIST_MAX),
        via: input.via,
    };
}

/**
 * Task nào vừa chuyển sang Done giữa hai phiên bản danh sách task.
 *
 * Dùng cho đường ghi ghi chú thực thi: client gửi cả danh sách, server so với
 * bản đang lưu để biết đúng task nào vừa được người hoàn tất.
 */
export function newlyDoneTasks(before: unknown, after: unknown): { id: string; name: string | null; note: string | null; fromStatus: string }[] {
    const isDone = (s: unknown) => /done|complete|implement|verifi/i.test(String(s ?? ''));
    const prev = new Map<string, any>(
        (Array.isArray(before) ? before : []).filter((t: any) => t?.id).map((t: any) => [String(t.id), t]),
    );
    return (Array.isArray(after) ? after : [])
        .filter((t: any) => t?.id && isDone(t.status) && !isDone(prev.get(String(t.id))?.status))
        .map((t: any) => ({
            id: String(t.id),
            name: clip(t.name ?? t.action ?? t.actionText, 120),
            note: clip(t.note, 240),
            fromStatus: String(prev.get(String(t.id))?.status ?? 'new'),
        }));
}

/** Map trạng thái trước/sau — chỉ những trường thực sự đổi. */
export function beforeAfter(changes: Record<string, [unknown, unknown]>): Record<string, unknown> | null {
    const out: Record<string, unknown> = {};
    for (const [key, [before, after]] of Object.entries(changes)) {
        if (before !== after) out[key] = { before: before ?? null, after: after ?? null };
    }
    return Object.keys(out).length ? out : null;
}
