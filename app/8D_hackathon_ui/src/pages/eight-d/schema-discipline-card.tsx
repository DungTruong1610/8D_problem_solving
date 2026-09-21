import {
    Badge,
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn,
} from '@cnma/react-ui';
import { AlertCircle, AlertTriangle, CheckCircle2, Link2 } from 'lucide-react';
import {
    reviewStatusOf,
    type Discipline8D,
} from '@/services/eightd-service';
import { Markdown } from './markdown';
import { AiSuggestWidget, DecisionTableWidget, TeamRosterProvider, type RosterRow } from './team-roster-widget';
import {
    ComplaintReferenceWidget,
    IS_NOT_FIELD_KEYS,
    IsBoxWidget,
    IsIsNotSectionWidget,
    IsNotBasisWidget,
    IsNotBoxWidget,
    ProblemStatementWidget,
    W2H_FIELD_KEYS,
    W2hCellWidget,
    W2hSectionWidget,
} from './problem-widgets';
import { ActionCardsWidget, AiDraftWidget, IshikawaGridWidget, WhyChainWidget } from './cause-widgets';
import { assignedFieldFor } from '../../../../../shared/action-task';
import { ClosureGateWidget, FmeaLinkWidget } from './closure-widgets';

interface SnapshotField { key: string; label: string; widget: string; visible?: boolean; colSpan?: number; rowSpan?: number }
interface SnapshotGroup { id: string; label: string; fieldKeys: string[]; order?: number }
interface SnapshotSchema { fields: SnapshotField[]; groups?: SnapshotGroup[] }
interface Violation { ruleId: string; path: string; severity: 'error' | 'warning' | 'info'; message: string }
interface ValidationSnapshot { violations?: Violation[] }

const COLUMN_SPANS: Record<number, string> = {
    1: 'col-span-12 md:col-span-1', 2: 'col-span-12 md:col-span-2', 3: 'col-span-12 md:col-span-3',
    4: 'col-span-12 md:col-span-4', 5: 'col-span-12 md:col-span-5', 6: 'col-span-12 md:col-span-6',
    7: 'col-span-12 md:col-span-7', 8: 'col-span-12 md:col-span-8', 9: 'col-span-12 md:col-span-9',
    10: 'col-span-12 md:col-span-10', 11: 'col-span-12 md:col-span-11', 12: 'col-span-12',
};
const ROW_SPANS: Record<number, string> = { 2: 'row-span-2', 3: 'row-span-3', 4: 'row-span-4' };

/**
 * Widget tu ve nhan cua no ben trong.
 *
 * `FieldBlock` mac dinh in nhan field o tren moi o. Voi mot o 5W2H hay mot hop
 * Is/Is-Not - von da co nhan rieng ben trong dung theo mockup - thi thanh ra in
 * hai lan cung mot chu. Danh sach nay tat cai o tren, de nhan ben trong lam viec.
 */
const SELF_LABELLED_WIDGETS = new Set([
    'w2h-cell',
    'is-box',
    'isnot-box',
    'isnot-basis',
    'problem.isIsNotBasis',
    'complaint-reference',
    'ai-suggest',
    'decision-table',
    'problem-statement',
    'problem.statement',
    'statement',
    'action-cards',
    'containment.actions',
    'corrective.actions',
    'preventive.actions',
    'verification.actions',
    'actions',
    'ishikawa-grid',
    'rootCause.ishikawaBoard',
    'why-chain',
    'rootCause.fiveWhy',
    'ai-draft',
    'rootCause.statement',
    'fmea-link',
    'preventive.fmea',
    'closure-gate',
    'closure.gate',
]);

/**
 * Widget tu lo trang thai RONG cua no.
 *
 * `FieldValue` mac dinh thay gia tri rong thi tra ve ngay mot chu "Not provided"
 * tran - khong khung, khong nhan, lech han voi cac o ben canh. Voi mot o 5W2H
 * thi dung phai la o van con nguyen khung, ben trong ghi "Not tracked in current
 * dataset" bang chu nghieng; voi hop Is/Is-Not cung vay; con complaint reference
 * thi phai an han di.
 *
 * Nhung widget nay tu ve lay trang thai rong cua minh, nen phai duoc goi ke ca
 * khi khong co du lieu.
 */
const SELF_EMPTY_WIDGETS = new Set([
    'w2h-cell', 'is-box', 'isnot-box', 'isnot-basis', 'problem.isIsNotBasis', 'complaint-reference',
    'ai-suggest', 'decision-table', 'problem-statement',
    // `ishikawa-grid` doc tu caseContext chu khong tu gia tri field, nen gia tri
    // luon rong — khong co mat o day thi no khong bao gio duoc goi.
    // Hai cai con lai tu ve dong "chua co gi", de nguoi doc biet la trong that
    // chu khong phai man hinh hong.
    'ishikawa-grid', 'why-chain', 'action-cards',
    // `ai-draft` tu ve dong "may khong ket luan duoc" — do la thong tin, khong phai o rong.
    'ai-draft',
    // 'fmea-link' phai ve duoc trang thai CHUA lien ket — do la lo hong that cua
    // case, khong phai o trong. 'closure-gate' thi khong doc gia tri field nao ca.
    'fmea-link', 'closure-gate',
]);

function parseObject<T>(value: string | null | undefined): T | null {
    if (!value) return null;
    try { const parsed = JSON.parse(value) as unknown; return parsed && typeof parsed === 'object' ? parsed as T : null; } catch { return null; }
}

function getPath(root: unknown, path: string): unknown {
    let current = root;
    for (const segment of path.split('.')) {
        const match = segment.match(/^([^#]+)#(\d+)$/);
        if (match) {
            current = current && typeof current === 'object' ? (current as Record<string, unknown>)[match[1]] : undefined;
            current = Array.isArray(current) ? current[Number(match[2]) - 1] : undefined;
        } else current = current && typeof current === 'object' ? (current as Record<string, unknown>)[segment] : undefined;
    }
    return current;
}

function humanize(value: string): string { return value.replace(/#(\d+)/g, ' $1').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function compactValue(value: unknown): string {
    if (value == null) return 'Source exists but has no value';
    if (typeof value !== 'object') return String(value);
    if (Array.isArray(value)) return `${value.length} record${value.length === 1 ? '' : 's'}`;
    const record = value as Record<string, unknown>;
    const summary = ['partnerName', 'name', 'actionText', 'description', 'answer', 'measuredValue', 'symptomShortText'].map((key) => record[key]).find((item) => typeof item === 'string' && item);
    return summary ? String(summary) : Object.entries(record).slice(0, 3).map(([key, item]) => `${humanize(key)}: ${String(item ?? '-')}`).join(' · ');
}

const SIX_M_CATEGORIES = ['Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment'] as const;

function isTruthy(val: unknown): boolean {
    if (!val) return false;
    if (val === true || val === 1 || val === '1') return true;
    const s = String(val).trim().toLowerCase();
    return s === 'true' || s === 'x' || s === 'yes';
}

function normalizeCategoryName(raw: unknown): string | null {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '—' || trimmed === '-') return null;
    const matched = SIX_M_CATEGORIES.find((m) => m.toLowerCase() === trimmed.toLowerCase());
    return matched || (trimmed.charAt(0).toUpperCase() + trimmed.slice(1));
}

export function extractAiRootCause(
    d4Data: Record<string, unknown> | null,
    context: Record<string, unknown> | null,
): string | null {
    if (!d4Data && !context) return null;

    // 1. Tìm trong bảng ishikawaBoard (ở mọi vị trí có thể trong d4Data hoặc context)
    const ishikawaBoard = (
        (d4Data?.rootCause as any)?.ishikawaBoard ||
        d4Data?.['rootCause.ishikawaBoard'] ||
        d4Data?.ishikawaBoard ||
        (d4Data?.rootCause as any)?.ishikawa ||
        d4Data?.ishikawa ||
        context?.ishikawa ||
        (context?.rootCause as any)?.ishikawaBoard ||
        []
    );

    if (Array.isArray(ishikawaBoard) && ishikawaBoard.length > 0) {
        // A. Dòng có cờ isRootCause
        const rootRow = ishikawaBoard.find((r) => r && isTruthy(r.isRootCause));
        if (rootRow?.category) {
            const cat = normalizeCategoryName(rootRow.category);
            if (cat) return cat;
        }
        // B. Dòng có finding thực tế (khác 'not assessed', 'not provided', '—')
        const assessedRow = ishikawaBoard.find((r) => {
            const f = String(r?.finding ?? r?.description ?? '').trim().toLowerCase();
            return f && f !== 'not assessed' && f !== 'not provided' && f !== '—' && f !== '-';
        });
        if (assessedRow?.category) {
            const cat = normalizeCategoryName(assessedRow.category);
            if (cat) return cat;
        }
    }

    // 2. Tìm trong context.rootCause
    const ctxRoot = context?.rootCause;
    if (ctxRoot) {
        if (typeof ctxRoot === 'object' && (ctxRoot as any).category) {
            const cat = normalizeCategoryName((ctxRoot as any).category);
            if (cat) return cat;
        }
        if (typeof ctxRoot === 'string') {
            const cat = normalizeCategoryName(ctxRoot);
            if (cat) return cat;
        }
    }

    // 3. Tìm trong d4Data.rootCause.category
    const d4Root = (d4Data?.rootCause as any);
    if (d4Root && typeof d4Root === 'object' && d4Root.category) {
        const cat = normalizeCategoryName(d4Root.category);
        if (cat) return cat;
    }

    // 4. Tìm trong rootCause.statement (ví dụ: "(Machine)", "Machine: ...", "Root cause: Method")
    const statement = String(
        d4Root?.statement ||
        d4Data?.['rootCause.statement'] ||
        d4Data?.statement ||
        ''
    );
    if (statement) {
        for (const m of SIX_M_CATEGORIES) {
            const regex = new RegExp(`\\b${m}\\b`, 'i');
            if (regex.test(statement)) {
                return m;
            }
        }
    }

    // 5. Tìm trong fiveWhy
    const fiveWhy = (
        d4Root?.fiveWhy ||
        d4Data?.['rootCause.fiveWhy'] ||
        d4Data?.fiveWhy ||
        context?.fiveWhy ||
        []
    );
    if (Array.isArray(fiveWhy) && fiveWhy.length > 0) {
        const rootStep = fiveWhy.find((s) => s && isTruthy(s.isRootCauseStep));
        const text = String(rootStep?.answer ?? rootStep?.why ?? '');
        for (const m of SIX_M_CATEGORIES) {
            if (new RegExp(`\\b${m}\\b`, 'i').test(text)) return m;
        }
    }

    // 6. Tìm trong custom findings
    const customFindings = (
        d4Data?.ishikawaCustomFindings ||
        (d4Data?.rootCause as any)?.ishikawaCustomFindings ||
        {}
    );
    if (customFindings && typeof customFindings === 'object') {
        const keys = Object.keys(customFindings);
        if (keys.length > 0) {
            const cat = normalizeCategoryName(keys[0]);
            if (cat) return cat;
        }
    }

    return null;
}

export function resolveD4RootCause(
    d4: Discipline8D | undefined,
    caseContext?: unknown,
): string {
    if (!d4) return '—';

    let d4Data: Record<string, unknown> | null = null;
    try {
        d4Data = typeof d4.resultJson === 'object' && d4.resultJson !== null
            ? (d4.resultJson as Record<string, unknown>)
            : JSON.parse(d4.resultJson || '{}');
    } catch {
        d4Data = {};
    }

    let parsedContext: Record<string, unknown> | null = null;
    try {
        parsedContext = typeof caseContext === 'object' && caseContext !== null
            ? (caseContext as Record<string, unknown>)
            : JSON.parse(String(caseContext || '{}'));
    } catch {
        parsedContext = {};
    }

    const isD4Completed = reviewStatusOf(d4) === 'Approved' || d4.reviewStatus === 'Approved';

    // Root Cause do AI suy luận (aiRoot):
    const aiRoot = extractAiRootCause(d4Data, parsedContext);

    // Root Cause do người dùng chọn / chốt:
    const userSelected = normalizeCategoryName(
        d4Data?.confirmedRootCategory ||
        d4Data?.selectedRootCategory ||
        (d4Data?.rootCause as any)?.selectedRootCategory ||
        (d4Data?.rootCause as any)?.confirmedRootCategory
    );

    // Quy tắc nghiệp vụ:
    // - Khi D4 đã Complete:
    //   Hiển thị userSelected (nếu người dùng có đổi).
    //   Nếu người dùng không đổi (hoặc chưa từng chọn khác AI), hiển thị aiRoot!
    // - Khi D4 chưa Complete:
    //   Hiển thị aiRoot! (Người dùng có click chọn khác ở D4 nhưng chưa bấm Complete thì D5 vẫn giữ nguyên aiRoot).
    if (isD4Completed) {
        return userSelected || aiRoot || '—';
    }

    return aiRoot || userSelected || '—';
}

function ObjectTable({ rows }: { rows: Array<Record<string, unknown>> }) {
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    if (!rows.length) return <span className="text-sm italic text-muted-foreground">No rows returned</span>;
    return (
        <div className="max-w-full overflow-x-auto rounded-lg border bg-card">
            <Table className="table-auto">
                <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                        {columns.map((column) => (
                            <TableHead
                                key={column}
                                className="min-w-32 whitespace-nowrap px-4 py-3 align-middle font-semibold"
                            >
                                {humanize(column)}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row, index) => (
                        <TableRow key={index}>
                            {columns.map((column) => (
                                <TableCell
                                    key={column}
                                    className="align-top whitespace-normal break-words px-4 py-3"
                                >
                                    {String(row[column] ?? '-')}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function EvidenceList({ paths, context }: { paths: string[]; context: Record<string, unknown> | null }) {
    return <div className="space-y-2">{paths.map((path) => {
        const value = context ? getPath(context, path) : undefined;
        const description = value === undefined && path.startsWith('precedents#') ? 'Similar completed case retrieved during analysis' : value === undefined && path.startsWith('derivedFacts') ? 'Derived from verified case measurements during enrichment' : compactValue(value);
        return <div key={path} className="flex min-w-0 items-start gap-3 rounded-lg border bg-muted/20 p-3"><div className="shrink-0 rounded-full bg-info-bg p-1.5 text-info"><Link2 className="h-3.5 w-3.5" /></div><div className="min-w-0"><div className="break-words text-sm font-medium">{humanize(path)}</div><div className="break-words text-sm text-muted-foreground">{description}</div><code className="mt-1 block break-all text-sm text-muted-foreground/70">{path}</code></div></div>;
    })}</div>;
}

function FieldValue({ field, value, context, disciplineID, data, siblings, readOnly = false, reportID = '', disciplineCode = '' }: { field: SnapshotField; value: unknown; context: Record<string, unknown> | null; disciplineID: string; data: Record<string, unknown>; siblings: Discipline8D[]; readOnly?: boolean; reportID?: string; disciplineCode?: string }) {
    const isLocked = readOnly;
    if ((value === undefined || value === null || value === '') && !SELF_EMPTY_WIDGETS.has(field.widget)) return <span className="text-sm italic text-muted-foreground">Not provided</span>;
    if (field.widget === 'evidence-list' && Array.isArray(value)) return <EvidenceList paths={value.map(String)} context={context} />;
    // Hai widget co HANH VI cua D1. Chung khong tu giu state - state nhom nam
    // trong `TeamRosterProvider` boc quanh ca the, vi nut "Accept all suggested"
    // o field nay phai them nguoi vao BANG o field kia.
    //
    // Nhan ca `field.key` vi `formSchemaJson` duoc chup vao tung discipline luc
    // phan tich: report chay truoc thay doi nay mang widget cu trong snapshot.
    if (field.widget === 'ai-suggest' || field.key === 'team.roster') {
        return <AiSuggestWidget roster={Array.isArray(value) ? value as RosterRow[] : []} readOnly={isLocked} />;
    }
    if (field.widget === 'decision-table' || field.key === 'team.assignedRoster') {
        return <DecisionTableWidget readOnly={isLocked} />;
    }

    // ── Widget cua D2 ────────────────────────────────────────────────────────
    // `complaint-reference` doc thang CaseContext (du lieu SAP da xac thuc), nen
    // bo qua `value` - AI khong ghi vao khoa nay.
    if (field.widget === 'complaint-reference') {
        return <ComplaintReferenceWidget caseContext={context} />;
    }
    if (field.widget === 'problem-statement') {
        return <ProblemStatementWidget
            statement={value}
            override={getPath(data, 'problem.statementOverride')}
            disciplineID={disciplineID}
            readOnly={isLocked}
        />;
    }
    if (field.widget === 'w2h-cell') {
        return <W2hCellWidget label={field.label || humanize(field.key)} value={value} disciplineID={disciplineID} fieldKey={field.key} readOnly={isLocked} />;
    }
    if (field.widget === 'is-box') return <IsBoxWidget value={value} disciplineID={disciplineID} fieldKey={field.key} readOnly={isLocked} />;
    if (field.widget === 'isnot-box') return <IsNotBoxWidget value={value} disciplineID={disciplineID} fieldKey={field.key} readOnly={isLocked} />;
    if (field.widget === 'isnot-basis' || field.key === 'problem.isIsNotBasis') {
        return <IsNotBasisWidget value={value} disciplineID={disciplineID} fieldKey={field.key} readOnly={isLocked} />;
    }
    // D4/D3 — ba widget nay phai dung TRUOC nhanh Array chung ben duoi, neu khong
    // `ObjectTable` nuot het va lai ve ra bang phang nhu cu.
    if (field.widget === 'why-chain') return <WhyChainWidget value={value} disciplineID={disciplineID} fieldKey={field.key} readOnly={isLocked} />;
    if (field.widget === 'ishikawa-grid') {
        return (
            <IshikawaGridWidget
                context={context}
                proposed={value}
                disciplineID={disciplineID}
                savedFindings={getPath(data, 'ishikawaCustomFindings')}
                savedRootCategory={getPath(data, 'selectedRootCategory')}
                readOnly={isLocked}
            />
        );
    }
    if (field.widget === 'action-cards') {
        const d4 = siblings?.find((d) => d.code === 'D4');
        const d4RootCause = disciplineCode === 'D5' ? resolveD4RootCause(d4, context) : '—';
        return (
            <ActionCardsWidget
                value={value}
                disciplineID={disciplineID}
                fieldKey={field.key}
                acceptedValue={getPath(data, assignedFieldFor(field.key))}
                readOnly={isLocked}
                reportID={reportID}
                disciplineCode={disciplineCode}
                rootCause={d4RootCause}
            />
        );
    }
    if (field.widget === 'ai-draft') return <AiDraftWidget value={value} disciplineID={disciplineID} readOnly={isLocked} reportID={reportID} fieldKey={field.key} />;
    if (field.widget === 'fmea-link') return <FmeaLinkWidget value={value} />;
    // Cổng đóng case là sự thật về CẢ report, nên nó đọc trạng thái duyệt của các
    // bước anh em chứ không đọc `resultJson` — để model tự trả lời câu này là để
    // nó tự cấp phép đóng case.
    if (field.widget === 'closure-gate') return <ClosureGateWidget siblings={siblings} />;
    if (field.widget === 'markdown' || field.widget === 'textarea') return <Markdown>{String(value)}</Markdown>;
    if (field.widget === 'status') return <Badge variant={/ready|agree|complete|verified|effective/i.test(String(value)) ? 'success' : 'secondary'} className="max-w-full whitespace-normal break-words text-left leading-relaxed">{String(value)}</Badge>;
    if (typeof value === 'boolean') return <Badge variant={value ? 'success' : 'secondary'}>{value ? 'Yes' : 'No'}</Badge>;
    if (Array.isArray(value)) {
        if (value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) return <ObjectTable rows={value as Array<Record<string, unknown>>} />;
        if (field.widget === 'warning-list') return <div className="space-y-2">{value.length ? value.map((item, index) => <div key={index} className="flex gap-2 rounded-md bg-warning-bg px-3 py-2 text-sm text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{String(item)}</span></div>) : <div className="flex gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" />No open gaps</div>}</div>;
        return <div className="flex flex-wrap gap-1.5">{value.map((item, index) => <Badge key={`${String(item)}-${index}`} variant="outline" className="max-w-full whitespace-normal break-words">{String(item)}</Badge>)}</div>;
    }
    if (typeof value === 'object') return <pre className="max-w-full overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm">{JSON.stringify(value, null, 2)}</pre>;
    return <span className="break-words whitespace-pre-wrap text-sm font-normal leading-relaxed">{String(value)}</span>;
}

export function FieldBlock({
    field,
    value,
    violations,
    context,
    disciplineID,
    data,
    siblings,
    readOnly = false,
    reportID = '',
    disciplineCode = '',
}: {
    field: SnapshotField;
    value: unknown;
    violations: Violation[];
    context: Record<string, unknown> | null;
    disciplineID: string;
    data: Record<string, unknown>;
    siblings: Discipline8D[];
    readOnly?: boolean;
    reportID?: string;
    disciplineCode?: string;
}) {
    const hasError = violations.some((item) => item.severity === 'error');
    const hasWarning = violations.some((item) => item.severity === 'warning');
    const isSelfLabelled = SELF_LABELLED_WIDGETS.has(field.widget) || SELF_LABELLED_WIDGETS.has(field.key);

    return (
        <div className={cn(
            'min-w-0 transition-all',
            isSelfLabelled ? 'p-0' : 'overflow-hidden rounded-xl p-3.5 border bg-card shadow-xs border-border/70',
            COLUMN_SPANS[Math.min(12, Math.max(1, field.colSpan ?? 12))],
            ROW_SPANS[field.rowSpan ?? 1],
            field.widget === 'callout' && 'border-l-4 border-l-info bg-info-bg/40 p-4',
            hasError && 'border border-destructive/40 bg-error-bg/40',
            hasWarning && !hasError && 'border border-warning/40 bg-warning-bg/30',
        )}>
            {!isSelfLabelled && (
                <div className="mb-2.5 pb-1.5 border-b border-border/60 flex min-w-0 items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="min-w-0 break-words text-base font-bold uppercase tracking-wider text-foreground/90">
                            {field.label || humanize(field.key)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        {hasError && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                        {hasWarning && !hasError && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />}
                    </div>
                </div>
            )}
            <div className="min-w-0">
                <FieldValue
                    field={field}
                    value={value}
                    context={context}
                    disciplineID={disciplineID}
                    data={data}
                    siblings={siblings}
                    readOnly={readOnly}
                    reportID={reportID}
                    disciplineCode={disciplineCode}
                />
            </div>
            {violations.length > 0 && (
                <div className="mt-2 space-y-1">
                    {violations.map((violation, index) => (
                        <div key={index} className={cn('text-sm', violation.severity === 'error' ? 'text-destructive' : 'text-warning')}>
                            {violation.message}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function isExcludedField(code: string, key: string, label?: string, value?: unknown): boolean {
    const l = (label || '').toLowerCase();
    if (code === 'D2' && (key === 'problem.isIsNotStatus' || key === 'isIsNotStatus')) {
        if (!value || value === 'Not provided' || !String(value).trim()) return true;
    }
    if (code === 'D1' && (key === 'team.suggestionStatus' || key === 'suggestionStatus')) {
        if (!value || value === 'Not provided' || !String(value).trim()) return true;
    }
    if (code === 'D3') {
        if (
            key === 'containment.gaps'
            || key === 'sources'
            || key === 'containment.objective'
            || key === 'objective'
            || l.includes('containment objective')
            || l.includes('objective')
        ) return true;
    }
    if (code === 'D4' && (key === 'rootCause.evidenceGaps' || key === 'sources')) return true;
    if (code === 'D5') {
        if (
            key === 'sources'
            || key === 'corrective.objective'
            || key === 'objective'
            || key === 'corrective.rootCauseCoverage'
            || key === 'corrective.coverageAssessment'
            || key === 'corrective.uncoveredCauses'
            || key === 'corrective.uncoveredRootCauseElements'
            || key === 'rootCauseCoverage'
            || key === 'coverageAssessment'
            || key === 'uncoveredCauses'
            || key === 'uncoveredRootCauseElements'
            || key === 'howEachActionRemovesTheCause'
        ) return true;
        if (
            l.includes('corrective objective')
            || l.includes('objective')
            || l.includes('removes the cause')
            || l.includes('removes cause')
            || l.includes('not yet covered')
            || l.includes('uncovered cause')
            || l.includes('root cause coverage')
            || l.includes('coverage assessment')
            || l.includes('evidence and traceability')
            || l.includes('source records')
            || l.includes('evidence sources')
        ) return true;
    }
    if (code === 'D6') {
        if (
            key === 'sources'
            || key === 'verification.objective'
            || key === 'verification.plan'
            || key === 'verification.evidenceStatus'
            || key === 'verification.status'
            || key === 'evidenceStatus'
            || key === 'verification.whatIsStillUnproven'
            || key === 'verification.unproven'
            || key === 'verification.gaps'
            || key === 'verification.unprovenGaps'
            || key === 'whatIsStillUnproven'
            || key === 'unproven'
            || key === 'objective'
            || key === 'plan'
        ) return true;
        if (
            l.includes('verification objective')
            || l.includes('verification plan')
            || l.includes('objective')
            || l.includes('plan')
            || l.includes('evidence status')
            || l.includes('unproven')
            || l.includes('evidence and traceability')
            || l.includes('source records')
            || l.includes('evidence sources')
        ) return true;
    }
    if (code === 'D7') {
        if (
            key === 'preventive.fmea'
            || key === 'fmea'
            || key.includes('fmea')
            || key === 'sources'
            || key === 'preventive.objective'
            || key === 'objective'
            || key === 'preventive.systemicScope'
            || key === 'preventive.whereElseThisApplies'
            || key === 'preventive.whereElse'
            || key === 'systemicScope'
            || key === 'whereElseThisApplies'
            || key === 'whereElse'
            || key === 'preventive.gaps'
            || key === 'preventive.openGaps'
            || key === 'preventive.preventiveGaps'
            || key === 'preventive.openPreventiveGaps'
            || key === 'openPreventiveGaps'
            || key === 'preventiveGaps'
            || key === 'openGaps'
            || key === 'gaps'
        ) return true;
        if (
            l.includes('fmea')
            || l.includes('preventive objective')
            || l.includes('objective')
            || l.includes('where else')
            || l.includes('systemic scope')
            || l.includes('preventive gap')
            || l.includes('open gap')
            || l.includes('open preventive')
            || l.includes('evidence and traceability')
            || l.includes('source records')
            || l.includes('evidence sources')
        ) return true;
    }
    if (code === 'D8') {
        if (
            key === 'sources'
            || key === 'closure.openItems'
            || key === 'closure.stillOpenAtClosure'
            || key === 'closure.openGaps'
            || key === 'closure.gaps'
            || key === 'openItems'
            || key === 'stillOpenAtClosure'
            || key === 'stillOpen'
        ) return true;
        if (
            l.includes('still open')
            || l.includes('open items')
            || l.includes('evidence and traceability')
            || l.includes('source records')
            || l.includes('evidence sources')
        ) return true;
    }
    return false;
}

export function SchemaDisciplineCard({ discipline, caseContext, liveFormSchemaJson, siblings = [], reportID = '' }: {
    discipline: Discipline8D;
    caseContext?: string;
    siblings?: Discipline8D[];
    reportID?: string;
    /**
     * Bo cuc dang cau hinh trong Form Editor, doc song tu `StepPrompts`.
     *
     * Duoc uu tien hon ban chup trong `discipline.formSchemaJson`: nguoi dung
     * chinh bo cuc roi F5 la thay ngay, khong phai chay lai ca pipeline AI chi
     * de keo mot field ra khoi layout group.
     *
     * Roi ve ban chup khi chua nap xong hoac buoc D nay chua co cau hinh - man
     * hinh trong trong luc dang tai la mot bug nhin thay duoc, con hien ban chup
     * cu them mot nhip thi khong ai nhan ra.
     */
    liveFormSchemaJson?: string | null;
}) {
    const live = parseObject<SnapshotSchema>(liveFormSchemaJson);
    // `binding` la ten cu cua `key` trong Form Editor. Ban chup da duoc
    // `normalizeStepConfig` doi sang `key`, ban song thi chua - khong quy ve mot
    // moi thi field vua keo vao lang le khong tim thay du lieu.
    const schema = live
        ? {
            ...live,
            fields: (live.fields ?? []).map((field) => ({
                ...field,
                key: String((field as { binding?: string }).binding?.trim() || field.key),
            })),
        }
        : parseObject<SnapshotSchema>(discipline.formSchemaJson);
    const data = parseObject<Record<string, unknown>>(discipline.resultJson) ?? {};
    const context = parseObject<Record<string, unknown>>(caseContext);
    const validation = parseObject<ValidationSnapshot>(discipline.validationJson);
    if (!schema) return null;
    const fieldMap = new Map(schema.fields.map((field) => [field.key, field]));
    const groups = [...(schema.groups ?? [])].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
    // KHONG co fallback "khong group thi hien het field".
    //
    // Layout group la thu quyet dinh cai gi len bao cao: keo field vao group thi
    // no hien, keo ra thi khong. Fallback cu bien "toi da bo het field ra" thanh
    // "hien toan bo field" - dung nguoc lai y nguoi dung, va khong co cach nao
    // dung Form Editor de tao ra mot buoc rong.
    const visibleGroups = groups;
    const violations = validation?.violations ?? [];
    const isCompleted = reviewStatusOf(discipline) === 'Approved';
    const isReadOnly = isCompleted;

    const W2H_SET = new Set<string>(W2H_FIELD_KEYS);
    const IS_NOT_SET = new Set<string>(IS_NOT_FIELD_KEYS);

    const isD1 = discipline.code === 'D1';
    const hasD1Roster = isD1 && (fieldMap.has('team.roster') || Boolean(getPath(data, 'team.roster')));
    const hasD1AssignedRoster = isD1 && (fieldMap.has('team.assignedRoster') || Boolean(getPath(data, 'team.assignedRoster')));

    const d1OtherGroups = isD1
        ? visibleGroups.map((g) => ({
            ...g,
            fieldKeys: g.fieldKeys.filter((k) => k !== 'team.roster' && k !== 'team.assignedRoster'),
        })).filter((g) => g.fieldKeys.length > 0)
        : visibleGroups;

    const content = (
        <div className="min-w-0 space-y-3">
                {hasD1Roster && (
                    <AiSuggestWidget
                        roster={getPath(data, 'team.roster') as RosterRow[]}
                        readOnly={isReadOnly}
                    />
                )}

                {hasD1AssignedRoster && (
                    <DecisionTableWidget
                        readOnly={isReadOnly}
                    />
                )}

                {d1OtherGroups.length > 0 && (
                    <div className="space-y-4">
                        {d1OtherGroups.map((group) => {
                            const renderedComposite = new Set<string>();

                            return (
                                <div key={group.id} className="grid min-w-0 grid-flow-dense grid-cols-12 gap-4">
                                    {group.fieldKeys.map((key) => {
                                        const field = fieldMap.get(key);
                                        if (!field || field.visible === false || isExcludedField(discipline.code, key, field.label, getPath(data, key))) return null;

                                        if (discipline.code === 'D2' && W2H_SET.has(key)) {
                                            if (renderedComposite.has('5W2H')) return null;
                                            renderedComposite.add('5W2H');
                                            return (
                                                <W2hSectionWidget
                                                    key="5W2H_SECTION"
                                                    data={data}
                                                    disciplineID={discipline.ID}
                                                    readOnly={isReadOnly}
                                                />
                                            );
                                        }

                                        if (discipline.code === 'D2' && IS_NOT_SET.has(key)) {
                                            if (renderedComposite.has('IS_NOT')) return null;
                                            renderedComposite.add('IS_NOT');
                                            return (
                                                <IsIsNotSectionWidget
                                                    key="IS_NOT_SECTION"
                                                    data={data}
                                                    disciplineID={discipline.ID}
                                                    readOnly={isReadOnly}
                                                />
                                            );
                                        }

                                        const fieldViolations = violations.filter((item) => item.path === `data.${key}` || item.path === key);

                                        return (
                                            <FieldBlock
                                                key={key}
                                                field={field}
                                                value={getPath(data, key)}
                                                violations={fieldViolations}
                                                context={context}
                                                disciplineID={discipline.ID}
                                                data={data}
                                                siblings={siblings}
                                                readOnly={isReadOnly}
                                                reportID={reportID || (discipline as any).report_ID || (discipline as any).reportID || ''}
                                                disciplineCode={discipline.code}
                                            />
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );

        if (isD1) {
            return (
                <TeamRosterProvider disciplineID={discipline.ID} caseContext={context} savedRoster={getPath(data, 'team.assignedRoster')} readOnly={isReadOnly}>
                    {content}
                </TeamRosterProvider>
            );
        }

        return content;
    }
