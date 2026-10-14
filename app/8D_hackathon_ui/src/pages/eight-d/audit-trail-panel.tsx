import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Spinner, cn } from '@cnma/react-ui';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { getReviewTrail, type ReviewEvent } from '@/services/eightd-service';

/**
 * Vết duyệt của một case — ai làm gì, lúc nào, DỰA TRÊN DỮ KIỆN NÀO, VÌ SAO.
 *
 * ── Vì sao là một panel riêng chứ không phải một dòng trong từng bước ──
 * Câu hỏi mà nó trả lời là câu hỏi về CẢ case: "case này đã qua mấy vòng, ai ký
 * cái gì". Rải mỗi bước một mẩu thì không ai dựng lại được trình tự.
 *
 * Đọc từ `ReviewEvents` — bảng chỉ-thêm, không sửa không xoá. Mỗi dòng đọc theo
 * thứ tự Hành động → Dữ kiện đầu vào → Lý do → Trước/Sau. Dữ kiện là bản chụp
 * lưu ĐÚNG lúc quyết định; dòng cũ không có bản chụp thì nói thẳng là không lưu,
 * KHÔNG dựng lại từ trạng thái hiện tại của report.
 */

const ALL = '__all__';

/** Đổi một dòng vết thành câu người đọc được. */
function describe(event: ReviewEvent): string {
    const step = event.disciplineCode;
    switch (event.eventType) {
        case 'approve': return `Approved ${step}`;
        case 'request-change': return `Sent ${step} back for changes`;
        case 'reopen': return `Reopened ${step}`;
        case 'task-done': return `Completed task ${event.subjectId ?? ''} in ${step}`.replace('  ', ' ');
        case 'stop-resolved': return `Resolved an AI stop on ${step}`;
        default:
            break;
    }
    // Dòng ghi trước khi có `eventType`: suy từ trạng thái đích như trước.
    switch (event.toStatus) {
        case 'Approved': return `Approved ${step}`;
        case 'ChangeRequested': return `Sent ${step} back for changes`;
        case 'Draft': return `Reopened ${step}`;
        default: return `${step}: ${event.fromStatus} to ${event.toStatus}`;
    }
}

function formatTime(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

function parse(value: string | null | undefined): Record<string, any> | null {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Bản chụp → các dòng "nhãn: giá trị" cho người không phải kỹ sư phần mềm đọc.
 * Chỉ trình bày những gì có trong bản chụp; không tra thêm gì từ report hiện tại.
 */
function snapshotLines(snapshot: Record<string, any>): { label: string; value: string }[] {
    const lines: { label: string; value: string }[] = [];
    const rc = snapshot.rootCause;
    if (rc?.statement || rc?.category) {
        lines.push({ label: 'Root cause on record', value: rc.statement ?? rc.category });
    }
    if (Array.isArray(rc?.markedRootCauses) && rc.markedRootCauses.length) {
        lines.push({ label: 'Marked as root cause', value: rc.markedRootCauses.join(' · ') });
    }
    if (snapshot.aiIndependentRootCause || snapshot.recordedRootCauseCategory) {
        lines.push({
            label: 'Category',
            value: `recorded ${snapshot.recordedRootCauseCategory ?? '-'} · AI independent check ${snapshot.aiIndependentRootCause ?? '-'}`,
        });
    }
    if (Array.isArray(snapshot.measurements) && snapshot.measurements.length) {
        lines.push({
            label: 'Measurements',
            value: snapshot.measurements
                .map((m: any) => `${m.characteristic ?? '?'} ${m.measured ?? '?'} vs ${m.spec ?? '?'}${m.outOfSpec ? ' (out of spec)' : ''}`)
                .join(' · '),
        });
    }
    if (Array.isArray(snapshot.precedents)) {
        lines.push({
            label: 'Precedents shown',
            value: snapshot.precedents.length
                ? snapshot.precedents.map((p: any) => `${p.notificationId}${p.score != null ? ` (score ${p.score})` : ''}`).join(', ')
                : (snapshot.precedentsNote ?? 'none'),
        });
    }
    if (Array.isArray(snapshot.tasks) && snapshot.tasks.length) {
        lines.push({
            label: 'Tasks',
            value: snapshot.tasks
                .map((t: any) => `${t.taskId} ${t.status ?? '?'}${t.evidenceRequired ? (t.hasEvidence ? ', evidence on file' : ', evidence missing') : ', evidence optional'}`)
                .join(' · '),
        });
    }
    if (snapshot.taskId) {
        lines.push({ label: 'Task', value: [snapshot.taskId, snapshot.task].filter(Boolean).join(' - ') });
        lines.push({ label: 'Completed via', value: snapshot.via === 'evidence-upload' ? 'evidence upload' : 'execution note' });
        if (Array.isArray(snapshot.evidenceIds) && snapshot.evidenceIds.length) {
            lines.push({ label: 'Evidence', value: snapshot.evidenceIds.join(', ') });
        }
    }
    if (snapshot.stopType) {
        lines.push({ label: 'Stop', value: `${snapshot.stopType}${snapshot.stopReason ? ` - ${snapshot.stopReason}` : ''}` });
    }
    if (lines.length === 0 && snapshot.stepSummary) {
        lines.push({ label: 'Step summary', value: snapshot.stepSummary });
    }
    if (snapshot.truncated) {
        lines.push({ label: 'Note', value: 'Snapshot was trimmed to its size limit.' });
    }
    return lines;
}

const LABEL: Record<string, string> = {
    reviewStatus: 'Review',
    workState: 'Work',
    taskStatus: 'Task',
};

function EventCard({ event, latest }: { event: ReviewEvent; latest: boolean }) {
    const snapshot = parse(event.inputSnapshotJson);
    const changes = parse(event.beforeAfterJson);
    const reason = event.reason ?? event.note;
    // Dòng ghi trước khi có cột mới: mọi cột mới đều null.
    const legacy = event.eventType == null;

    const changeList = changes
        ? Object.entries(changes)
        : (event.fromStatus || event.toStatus)
            ? [['reviewStatus', { before: event.fromStatus, after: event.toStatus }] as [string, any]]
            : [];

    return (
        <li className={cn('min-w-0 border-l-2 py-3 pl-3.5', latest ? 'border-l-primary' : 'border-l-border')}>
            {/* Hành động */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-sm font-semibold text-foreground">{describe(event)}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{formatTime(event.at)}</span>
            </div>
            <p className="text-xs text-muted-foreground">by <span className="font-medium text-foreground">{event.actor || 'System'}</span></p>

            <dl className="mt-2 space-y-1.5 text-sm">
                {/* Dữ kiện đầu vào */}
                <div className="grid grid-cols-[108px_1fr] gap-x-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground pt-0.5">Input data</dt>
                    <dd className="min-w-0 text-foreground/90">
                        {snapshot ? (
                            <ul className="space-y-0.5">
                                {snapshotLines(snapshot).map((line) => (
                                    <li key={line.label} className="break-words">
                                        <span className="text-muted-foreground">{line.label}:</span> {line.value}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <span className="italic text-muted-foreground">
                                {legacy ? 'Not recorded at the time (logged before input snapshots existed).' : 'No input snapshot recorded.'}
                            </span>
                        )}
                    </dd>
                </div>

                {/* Lý do */}
                <div className="grid grid-cols-[108px_1fr] gap-x-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground pt-0.5">Reason</dt>
                    <dd className="min-w-0 whitespace-pre-line break-words text-foreground/90">
                        {reason || <span className="italic text-muted-foreground">{event.eventType === 'approve' || event.toStatus === 'Approved' ? 'No note - the step evidence above is the basis.' : 'No reason recorded.'}</span>}
                    </dd>
                </div>

                {/* Trước / sau */}
                {changeList.length > 0 && (
                    <div className="grid grid-cols-[108px_1fr] gap-x-3">
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground pt-0.5">Before / after</dt>
                        <dd className="flex min-w-0 flex-wrap gap-1.5">
                            {changeList.map(([field, value]) => (
                                <span key={field} className="inline-flex items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 text-xs">
                                    <span className="text-muted-foreground">{LABEL[field] ?? field}</span>
                                    <span>{String(value?.before ?? '-')}</span>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-medium text-foreground">{String(value?.after ?? '-')}</span>
                                </span>
                            ))}
                        </dd>
                    </div>
                )}

                {event.traceId && (
                    <div className="grid grid-cols-[108px_1fr] gap-x-3">
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground pt-0.5">AI run</dt>
                        <dd className="min-w-0 break-all font-mono text-xs text-muted-foreground">{event.traceId}</dd>
                    </div>
                )}
            </dl>
        </li>
    );
}

function FilterSelect({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
}) {
    return (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {label}
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
                <option value={ALL}>All</option>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
        </label>
    );
}

export function AuditTrailPanel({ reportID }: { reportID: string }) {
    const [step, setStep] = useState(ALL);
    const [actor, setActor] = useState(ALL);
    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ['8d', 'trail', reportID],
        queryFn: () => getReviewTrail(reportID),
        enabled: !!reportID,
        staleTime: 0,
    });

    const trail = data?.trail ?? [];
    const steps = useMemo(() => [...new Set(trail.map((e) => e.disciplineCode).filter(Boolean))].sort(), [trail]);
    const actors = useMemo(() => [...new Set(trail.map((e) => e.actor).filter(Boolean))].sort(), [trail]);
    const visible = trail.filter((e) => (step === ALL || e.disciplineCode === step) && (actor === ALL || e.actor === actor));

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4" /> Loading trail…
            </div>
        );
    }

    if (isError) {
        // Nói thẳng thay vì hiện panel rỗng: rỗng nghĩa là "chưa ai duyệt", còn
        // đây là "không đọc được" — hai chuyện hoàn toàn khác nhau.
        return (
            <div className="flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/[0.06] px-3 py-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="min-w-0">
                    <p className="font-medium text-foreground">Could not load the audit trail.</p>
                    <p className="break-words text-muted-foreground">{(error as Error)?.message ?? 'Unknown error'} - this is a loading error, not an empty trail.</p>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="mt-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-50"
                    >
                        {isFetching ? 'Retrying…' : 'Retry'}
                    </button>
                </div>
            </div>
        );
    }

    if (trail.length === 0) {
        return (
            <p className="px-3 py-6 text-sm text-muted-foreground">
                No decisions recorded yet. Approving, sending back or reopening a step - or completing a task - adds an entry here.
            </p>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3 border-b pb-2.5">
                <FilterSelect label="Step" value={step} options={steps} onChange={setStep} />
                <FilterSelect label="Actor" value={actor} options={actors} onChange={setActor} />
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {visible.length} of {trail.length} entries
                </span>
            </div>
            {visible.length === 0 ? (
                <p className="px-1 py-4 text-sm text-muted-foreground">No entries match these filters.</p>
            ) : (
                <ol className="max-h-[60vh] min-w-0 overflow-y-auto pr-1">
                    {visible.map((event, index) => (
                        <EventCard key={event.ID} event={event} latest={index === 0 && step === ALL && actor === ALL} />
                    ))}
                </ol>
            )}
        </div>
    );
}
