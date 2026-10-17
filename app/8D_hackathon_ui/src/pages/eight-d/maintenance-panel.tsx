import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Card, Spinner, cn } from '@cnma/react-ui';
import { AlertTriangle, CalendarClock, History, Info, Wrench } from 'lucide-react';
import {
    MAINTENANCE_PLAN_KEY,
    decideMaintenanceProposal,
    eightDService,
    getMaintenanceHistory,
    proposeMaintenancePlan,
    saveDisciplineField,
    type Discipline8D,
    type MaintenancePlan,
    type MaintenanceProposal,
    type Report8D,
} from '@/services/eightd-service';

/**
 * Đề xuất bảo trì phòng ngừa ở D7.
 *
 * Mọi thứ trên panel là dữ kiện đã có: nguyên nhân gốc D4 đã duyệt, case đã đóng
 * cùng loại lỗi, ngày xảy ra thật. Không có dự báo — thiếu số đo thì panel nói
 * thẳng là thiếu, không điền thay.
 */

const CONTROL_LABEL: Record<string, string> = {
    'preventive-maintenance': 'Preventive maintenance',
    calibration: 'Calibration',
    'error-proofing': 'Error-proofing (poka-yoke)',
    'work-instruction': 'Work instruction',
    'incoming-inspection': 'Incoming inspection',
    'condition-monitoring': 'Condition monitoring',
    'inspection-frequency': 'Increase inspection frequency',
};

const STATUS_LABEL: Record<MaintenanceProposal['status'], { text: string; className: string }> = {
    Proposed: { text: 'Proposed', className: 'bg-muted text-muted-foreground' },
    Approved: { text: 'Approved', className: 'bg-success/15 text-success' },
    Rejected: { text: 'Rejected', className: 'bg-destructive/10 text-destructive' },
};

const errorText = (e: unknown) => {
    const err = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
    return err?.response?.data?.error?.message ?? err?.message ?? String(e);
};

function storedPlanOf(discipline: Discipline8D): MaintenancePlan | null {
    try {
        const plan = JSON.parse(discipline.resultJson || '{}')?.preventive?.maintenancePlan;
        return plan && Array.isArray(plan.proposals) ? plan : null;
    } catch {
        return null;
    }
}

const formatInterval = (p: MaintenanceProposal) => {
    if (!p.interval) return null;
    const { limit, actual, unit } = p.interval;
    return `${limit.toLocaleString('en-GB')} ${unit}${actual != null ? ` (actual ${actual.toLocaleString('en-GB')})` : ''}`;
};

/** Loại cần số mà không có số: nói rõ là chờ người nhập. */
const NEEDS_NUMBER = new Set(['preventive-maintenance', 'calibration', 'condition-monitoring']);

export function MaintenancePanel({ report, discipline }: { report: Report8D; discipline: Discipline8D }) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const stored = storedPlanOf(discipline);
    const [refusal, setRefusal] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const defectCode = report.defectCode ?? '';
    const workCenterId = report.workCenterId ?? '';

    const history = useQuery({
        queryKey: ['maintenance-history', defectCode, workCenterId],
        queryFn: () => getMaintenanceHistory(defectCode, workCenterId),
        enabled: !!defectCode && !!workCenterId,
    });

    const generate = useMutation({
        mutationFn: async () => {
            const plan = await proposeMaintenancePlan(report.ID);
            if (plan.refusal) return plan;
            await saveDisciplineField(discipline.ID, MAINTENANCE_PLAN_KEY, plan);
            return plan;
        },
        onSuccess: (plan) => {
            setRefusal(plan.refusal);
            if (!plan.refusal) toast.success(`Generated ${plan.proposals.length} proposal${plan.proposals.length === 1 ? '' : 's'}`);
            void queryClient.invalidateQueries({ queryKey: ['8d'] });
            // Tạo lại thay nội dung của cả đề xuất đã duyệt — lịch sử đọc từ đó.
            void queryClient.invalidateQueries({ queryKey: ['maintenance-history'] });
        },
        onError: (e) => toast.error(`Could not generate proposals: ${errorText(e)}`),
    });

    const decide = useMutation({
        mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
            decideMaintenanceProposal(report.ID, id, decision, notes[id] ?? ''),
        onSuccess: (p) => {
            toast.success(p.status === 'Approved' ? 'Proposal approved' : 'Proposal rejected');
            void queryClient.invalidateQueries({ queryKey: ['8d'] });
            void queryClient.invalidateQueries({ queryKey: ['maintenance-history'] });
        },
        onError: (e) => toast.error(`Could not save the decision: ${errorText(e)}`),
    });

    const openCase = async (notificationId: string) => {
        try {
            const found = (await eightDService.list()).value?.find((r: Report8D) => r.notificationId === notificationId);
            if (found) navigate(`/8d/${found.ID}`);
            else toast.info(`${notificationId} is a closed case in the case library - it has no 8D report in this system.`);
        } catch (e) {
            toast.error(`Could not open case: ${errorText(e)}`);
        }
    };

    const plan = stored;
    const editable = discipline.workState === 'InProgress' && discipline.reviewStatus !== 'Approved';

    return (
        <Card className="space-y-4 p-5" data-testid="maintenance-panel">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-destructive" />
                    <h3 className="text-sm font-semibold">Preventive Maintenance Proposals</h3>
                    {defectCode && (
                        <span className="font-mono text-xs text-muted-foreground">{defectCode} · {workCenterId}</span>
                    )}
                </div>
                <Button type="button" size="sm" onClick={() => generate.mutate()} disabled={!editable || generate.isPending}>
                    {generate.isPending && <Spinner className="mr-2 h-3.5 w-3.5" />}
                    {plan ? 'Regenerate proposals' : 'Generate proposals'}
                </Button>
            </div>
            {!editable && (
                <p className="text-xs text-muted-foreground">Switch D7 to “In process” to generate or decide on proposals.</p>
            )}

            {refusal && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/[0.06] px-3 py-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <span>{refusal}</span>
                </div>
            )}

            {!plan ? (
                <div className="flex items-start gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    No proposals yet. Click “Generate proposals” to derive them from the approved D4 root cause and closed cases of the same defect type.
                </div>
            ) : (
                <>
                    {plan.stops.map((s) => (
                        <div key={s.id} className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/[0.06] px-3 py-2 text-xs">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                            <div>
                                <p className="font-medium text-foreground">{s.reason}</p>
                                <p className="mt-0.5 text-muted-foreground">{s.questionForHuman} - needs: {s.requiredRole}</p>
                            </div>
                        </div>
                    ))}

                    {!plan.proposals.length && <p className="text-sm text-muted-foreground">No proposals.</p>}
                    <div className="space-y-3">
                        {plan.proposals.map((p) => {
                            const status = STATUS_LABEL[p.status] ?? STATUS_LABEL.Proposed;
                            const interval = formatInterval(p);
                            return (
                                <div key={p.id} className="space-y-2 rounded-xl border border-border/70 p-4" data-testid="maintenance-proposal">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-sm font-semibold">{CONTROL_LABEL[p.controlType] ?? p.controlType}</span>
                                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', status.className)}>{status.text}</span>
                                    </div>
                                    <p className="text-sm leading-relaxed">{p.task}</p>
                                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                                        <dt className="text-muted-foreground">Interval / limit</dt>
                                        <dd>
                                            {interval ?? (NEEDS_NUMBER.has(p.controlType)
                                                ? <span className="text-warning">No measurement yet - needs a person to enter it</span>
                                                : <span className="text-muted-foreground">Not applicable</span>)}
                                            {p.interval && <span className="ml-1 text-muted-foreground">from “{p.interval.sourceText}”</span>}
                                        </dd>
                                        <dt className="text-muted-foreground">Owner</dt>
                                        <dd>{p.owner ?? <span className="text-muted-foreground">Unassigned</span>}</dd>
                                        <dt className="text-muted-foreground">Basis</dt>
                                        <dd>{p.rootCauseCategory ?? '?'}{p.whyStepUsed ? ` · why #${p.whyStepUsed}` : ''}</dd>
                                        <dt className="text-muted-foreground">Source cases</dt>
                                        <dd className="flex flex-wrap gap-2">
                                            {p.sourceCaseIds.map((id) => (
                                                <button key={id} type="button" onClick={() => openCase(id)} className="font-mono text-destructive underline underline-offset-2 hover:opacity-80">
                                                    {id}
                                                </button>
                                            ))}
                                        </dd>
                                    </dl>
                                    {p.status === 'Proposed' ? (
                                        editable && (
                                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                                <input
                                                    aria-label="Decision note"
                                                    placeholder="Note (optional)"
                                                    value={notes[p.id] ?? ''}
                                                    onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                                                    className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                                                />
                                                <Button type="button" size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: p.id, decision: 'approve' })}>Approve</Button>
                                                <Button type="button" size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: p.id, decision: 'reject' })}>Reject</Button>
                                            </div>
                                        )
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            {status.text} by {p.decidedBy ?? '?'}{p.decidedAt ? ` on ${new Date(p.decidedAt).toLocaleString('en-GB')}` : ''}
                                            {p.note ? ` - “${p.note}”` : ''}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <section className="space-y-2">
                        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <CalendarClock className="h-3.5 w-3.5" /> Occurrences of this defect type
                        </h4>
                        {plan.occurrences.length < 2 ? (
                            <p className="text-xs text-muted-foreground">
                                Only {plan.occurrences.length} occurrence{plan.occurrences.length === 1 ? '' : 's'} recorded - not enough to compute recurrence gaps.
                            </p>
                        ) : (
                            <>
                                <ol className="space-y-1 text-xs">
                                    {plan.occurrences.map((o) => (
                                        <li key={`${o.notificationId}-${o.foundDate}`} className="flex gap-3">
                                            <span className="w-24 font-mono tabular-nums">{o.foundDate}</span>
                                            <span className={cn('font-mono', o.current && 'font-semibold text-destructive')}>
                                                {o.notificationId}{o.current ? ' (this case)' : ''}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                                <ul className="space-y-1 text-xs">
                                    {plan.intervals.gaps.map((g) => (
                                        <li key={`${g.from}-${g.to}`}>
                                            <span className={cn('mr-2 rounded px-1.5 py-0.5 font-medium', g.phase === 'after' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                                                {g.phase === 'after' ? 'After action' : 'Before action'}
                                            </span>
                                            {g.from} → {g.to}: <span className="font-semibold tabular-nums">{g.days} days</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-xs text-muted-foreground">
                                    {plan.intervals.actionDate
                                        ? `Preventive action date: ${plan.intervals.actionDate} (latest case closure). Real day counts only, no forecast.`
                                        : 'No closed case to mark a preventive action yet. Real day counts only, no forecast.'}
                                </p>
                            </>
                        )}
                        {plan.pastPreventiveActions.length > 0 && (
                            <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                                {plan.pastPreventiveActions.map((a, i) => (
                                    <li key={i}><span className="font-mono">{a.caseId}</span>: {a.text}</li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}

            <section className="space-y-2 border-t pt-3">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <History className="h-3.5 w-3.5" /> Approved maintenance history for this defect type
                </h4>
                {history.isLoading ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground"><Spinner className="h-3 w-3" /> Loading…</p>
                ) : history.error ? (
                    <p className="text-xs text-destructive">Could not load history: {errorText(history.error)}</p>
                ) : !history.data?.length ? (
                    <p className="text-xs text-muted-foreground">No approved proposals for this defect type yet.</p>
                ) : (
                    <ul className="space-y-1.5 text-xs" data-testid="maintenance-history">
                        {history.data.map((h) => (
                            <li key={`${h.reportID}-${h.id}`} className="rounded-md border border-border/60 px-3 py-2">
                                <span className="font-medium">{CONTROL_LABEL[h.controlType] ?? h.controlType}</span>
                                <span className="text-muted-foreground"> · {h.notificationId} · {h.decidedAt ? new Date(h.decidedAt).toLocaleDateString('en-GB') : ''} · {h.decidedBy}</span>
                                <p className="mt-0.5">{h.task}</p>
                                <p className="mt-0.5 font-mono text-muted-foreground">Sources: {h.sourceCaseIds.join(', ')}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </Card>
    );
}
