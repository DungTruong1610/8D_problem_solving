import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    cn,
} from '@cnma/react-ui';
import { Lock, LockOpen } from 'lucide-react';
import { toast } from 'sonner';
import {
    reviewDiscipline,
    reviewStatusOf,
    saveDisciplineField,
    setDisciplineWorkState,
    type Discipline8D,
    type ReviewDecision,
    type ReviewStatus,
} from '@/services/eightd-service';
import { normalizeActionStatus } from '../../../../../shared/action-task';
import { AiProvenanceInfo } from './ai-provenance-info';

/**
 * Duyệt từng bước 8D.
 */

const STATUS_STYLE: Record<ReviewStatus, { label: string; dot: string; text: string }> = {
    Draft: { label: 'Draft', dot: 'bg-muted-foreground/50', text: 'text-muted-foreground' },
    Approved: { label: 'Complete', dot: 'bg-success', text: 'text-success' },
    ChangeRequested: { label: 'Change requested', dot: 'bg-warning', text: 'text-warning' },
};

export function ReviewStatusDot({ status, className }: { status: ReviewStatus; className?: string }) {
    return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', STATUS_STYLE[status].dot, className)} />;
}

/** Dải tổng quan đầu trang: đã duyệt mấy bước, cái gì đang chặn đóng case. */
export function ClosureGateBar({ disciplines }: { disciplines: Discipline8D[] }) {
    const prerequisites = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];
    const byCode = new Map(disciplines.map((d) => [d.code, reviewStatusOf(d)]));
    const blocking = prerequisites.filter((code) => byCode.get(code) !== 'Approved');
    const approved = prerequisites.length - blocking.length;
    const canClose = blocking.length === 0;
    const pct = Math.round((approved / prerequisites.length) * 100);

    return (
        <div className={cn(
            'rounded-lg border px-4 py-3',
            canClose ? 'border-success/30 bg-success/[0.04]' : 'border-border bg-muted/20',
        )}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {canClose
                    ? <LockOpen className="h-4 w-4 shrink-0 text-success" />
                    : <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />}

                <span className="text-sm font-semibold">
                    {approved} of {prerequisites.length} disciplines complete
                </span>

                <div className="h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-border">
                    <div
                        className={cn('h-full rounded-full transition-all', canClose ? 'bg-success' : 'bg-primary')}
                        style={{ width: `${pct}%` }}
                    />
                </div>

                <span className="text-sm text-muted-foreground">
                    {canClose
                        ? 'D1–D7 completed — the case can be closed.'
                        : <>Closure blocked by <strong className="font-medium text-foreground">{blocking.join(', ')}</strong></>}
                </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
                {disciplines.map((d) => {
                    const status = reviewStatusOf(d);
                    return (
                        <span
                            key={d.ID}
                            title={`${d.code} — ${STATUS_STYLE[status].label}`}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-sm font-medium',
                                status === 'Approved' && 'border-success/30 text-success',
                                status === 'ChangeRequested' && 'border-warning/40 text-warning',
                                status === 'Draft' && 'border-border text-muted-foreground',
                            )}
                        >
                            <ReviewStatusDot status={status} />
                            {d.code}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}

function parseJsonSafe(val: unknown): Record<string, any> | null {
    if (!val) return null;
    if (typeof val === 'object') return val as Record<string, any>;
    try {
        const parsed = JSON.parse(String(val));
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

/** Ô quyết định và trạng thái nằm dưới nội dung của một bước. */
export function DisciplineReviewBox({
    discipline,
    siblings,
    caseContext,
    precedentsJson,
}: {
    discipline: Discipline8D;
    siblings?: Discipline8D[];
    liveFormSchemaJson?: string | null;
    caseContext?: string | Record<string, unknown> | null;
    precedentsJson?: string | null;
}) {
    const queryClient = useQueryClient();
    const isApproved = reviewStatusOf(discipline) === 'Approved' || discipline.workState === 'Completed';
    const currentStatus: 'NotStarted' | 'InProgress' | 'Completed' = isApproved
        ? 'Completed'
        : (discipline.workState === 'InProgress' ? 'InProgress' : 'NotStarted');

    const submit = useMutation({
        mutationFn: ({ decision, text }: { decision: ReviewDecision; text?: string }) =>
            reviewDiscipline(discipline.ID, decision, text),
        onSuccess: (result) => {
            toast.success(`${result.code} — ${result.toStatus === 'Approved' ? 'Complete' : 'In process'}`, {
                description: result.gate.reason,
            });
            void queryClient.invalidateQueries({ queryKey: ['8d'] });
        },
        onError: (e: any) => {
            toast.error(e?.response?.data?.error?.message ?? e?.message ?? 'Could not save the review.');
        },
    });

    const busy = submit.isPending;

    const handleStatusChange = async (value: 'NotStarted' | 'InProgress' | 'Completed') => {
        if (value === currentStatus) return;

        const parsed = parseJsonSafe(discipline.resultJson);

        // 1. Validation Logic
        if (value === 'Completed') {
            if (discipline.code === 'D6') {
                const allDiscs = siblings || [];
                const actionSteps = allDiscs.filter((d) => d.code === 'D5');

                const uncompletedTasks: { step: string; text: string; status: string }[] = [];

                for (const d of actionSteps) {
                    const parsedD = parseJsonSafe(d.resultJson);
                    const keyPrefix = 'corrective';
                    const currentTasks = parsedD?.[keyPrefix]?.assignedActions || parsedD?.assignedActions;
                    if (Array.isArray(currentTasks) && currentTasks.length > 0) {
                        for (const t of currentTasks) {
                            const normStatus = normalizeActionStatus(t?.status);
                            if (normStatus !== 'Done') {
                                uncompletedTasks.push({
                                    step: d.code,
                                    text: t?.name || t?.actionText || t?.action || 'Task',
                                    status: normStatus || 'Planned',
                                });
                            }
                        }
                    }
                }

                if (uncompletedTasks.length > 0) {
                    toast.error('There are tasks in D5 still not complete.');
                    return;
                }
            } else if (discipline.code === 'D5') {
                const assigned = parsed?.corrective?.assignedActions || parsed?.assignedActions;
                const actions = parsed?.corrective?.actions;
                const hasActions = (Array.isArray(assigned) && assigned.length > 0) || (Array.isArray(actions) && actions.length > 0);
                if (!hasActions) {
                    toast.error('Cannot complete D5: Please add or accept at least one corrective action before completing this step.');
                    return;
                }
            } else if (discipline.code === 'D7') {
                const assigned = parsed?.preventive?.assignedActions || parsed?.assignedActions;
                const actions = parsed?.preventive?.actions;
                const hasPreventive = (Array.isArray(assigned) && assigned.length > 0) || (Array.isArray(actions) && actions.length > 0);
                if (!hasPreventive) {
                    toast.error('Cannot complete D7: Please add or accept at least one preventive action before completing this step.');
                    return;
                }
            }
        }

        try {
            if (value === 'Completed') {

                if (['D3', 'D5', 'D7'].includes(discipline.code)) {
                    // Khi các bước D3, D5, D7 hoàn thành: chuyển task chưa Done -> Done
                    const keyPrefix = discipline.code === 'D3' ? 'containment' : discipline.code === 'D5' ? 'corrective' : 'preventive';
                    const assignedField = `${keyPrefix}.assignedActions`;
                    const currentTasks = parsed?.[keyPrefix]?.assignedActions || parsed?.assignedActions;
                    if (Array.isArray(currentTasks) && currentTasks.length > 0) {
                        const updatedTasks = currentTasks.map((t: any) => ({
                            ...t,
                            status: 'Done',
                        }));
                        await saveDisciplineField(discipline.ID, assignedField, updatedTasks);
                    }
                }

                submit.mutate({ decision: 'approve' });
            } else if (value === 'InProgress') {
                if (isApproved) {
                    await reviewDiscipline(discipline.ID, 'reopen');
                }
                await setDisciplineWorkState(discipline.ID, value);

                // Tự động đồng bộ task khi bước chuyển InProgress: chuyển Planned -> Open
                if (['D3', 'D5', 'D7'].includes(discipline.code)) {
                    const keyPrefix = discipline.code === 'D3' ? 'containment' : discipline.code === 'D5' ? 'corrective' : 'preventive';
                    const assignedField = `${keyPrefix}.assignedActions`;
                    const currentTasks = parsed?.[keyPrefix]?.assignedActions || parsed?.assignedActions;
                    if (Array.isArray(currentTasks) && currentTasks.length > 0) {
                        const updatedTasks = currentTasks.map((t: any) => ({
                            ...t,
                            status: normalizeActionStatus(t.status) === 'Planned' ? 'Open' : normalizeActionStatus(t.status),
                        }));
                        await saveDisciplineField(discipline.ID, assignedField, updatedTasks);
                    }
                }

                toast.success(`Status: In process`);
                void queryClient.invalidateQueries({ queryKey: ['8d'] });
            } else {
                if (isApproved) {
                    await reviewDiscipline(discipline.ID, 'reopen');
                }
                await setDisciplineWorkState(discipline.ID, value);
                toast.success(`Status: Not started`);
                void queryClient.invalidateQueries({ queryKey: ['8d'] });
            }
        } catch (err: any) {
            toast.error(err?.response?.data?.error?.message ?? err?.message ?? 'Could not update status.');
        }
    };

    return (
        <div className="mt-4 rounded-lg border bg-muted/20 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold tracking-tight text-foreground">
                            {discipline.code} — {discipline.title}
                        </span>
                        {['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'].includes(discipline.code) && (
                            <AiProvenanceInfo
                                discipline={discipline}
                                label={`${discipline.code} — ${discipline.title}`}
                                caseContext={caseContext}
                                precedentsJson={precedentsJson}
                            />
                        )}
                    </div>

                    {currentStatus === 'Completed' ? (
                        <div className="mt-1 flex flex-col min-w-0">
                            <span className="text-sm font-medium text-foreground">
                                Completed{discipline.reviewedBy ? <> by <strong className="font-semibold text-foreground">{discipline.reviewedBy}</strong></> : ' — verified and approved'}
                            </span>
                            <span className="text-sm text-muted-foreground tabular-nums">
                                {discipline.reviewedAt
                                    ? new Date(discipline.reviewedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                    : 'All criteria verified'}
                            </span>
                        </div>
                    ) : (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            {currentStatus === 'InProgress'
                                ? 'In process — editing and confirmation enabled'
                                : 'Not started (read-only) — switch status to "In process" to edit'}
                        </p>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                    <Select
                        value={currentStatus}
                        disabled={busy}
                        onValueChange={(val) => handleStatusChange(val as 'NotStarted' | 'InProgress' | 'Completed')}
                    >
                        <SelectTrigger className="h-9 w-[150px] px-3 text-sm font-medium bg-background">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="NotStarted">
                                <div className="flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                                    <span>Not started</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="InProgress">
                                <div className="flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    <span>In process</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="Completed">
                                <div className="flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                    <span>Complete</span>
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
