import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, cn } from '@cnma/react-ui';
import { CheckCircle2, OctagonPause } from 'lucide-react';
import { toast } from 'sonner';
import { resolveStop, type CaseStop, type StopType } from '@/services/eightd-service';
import { ReasonDialog } from './reason-dialog';

/**
 * "AI stopped here" — những chỗ AI không được tự đi tiếp, và ai phải trả lời.
 *
 * Ba loại, mỗi loại một màu tiết chế (viền + chấm, không tô nền cả khối):
 * dữ kiện chưa xác minh / ngoài phạm vi / vượt thẩm quyền. Lần dừng `blocking`
 * khoá nút duyệt của đúng bước đó (cả ở backend) cho tới khi có người gỡ kèm ghi
 * chú — ghi chú đó vào nhật ký kiểm toán cùng dữ kiện gây dừng.
 */

export const STOP_TYPE_META: Record<StopType, { label: string; hint: string; dot: string; border: string }> = {
    'unverified-facts': {
        label: 'Unverified facts',
        hint: 'Input data is missing, ambiguous or contradictory — the AI will not assert a conclusion on it.',
        dot: 'bg-warning',
        border: 'border-l-warning',
    },
    'outside-scope': {
        label: 'Outside scope',
        hint: 'Nothing in the process or case library covers this — the AI will not invent a precedent.',
        dot: 'bg-info',
        border: 'border-l-info',
    },
    'exceeds-authority': {
        label: 'Exceeds authority',
        hint: 'The AI can draft this, but a person with the right role must decide.',
        dot: 'bg-primary',
        border: 'border-l-primary',
    },
};

function formatTime(value?: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StopRow({ stop, onResolve }: { stop: CaseStop; onResolve: (stop: CaseStop) => void }) {
    const meta = STOP_TYPE_META[stop.type];
    const open = stop.status === 'open';
    return (
        <li className={cn('border-l-2 py-2.5 pl-3', open ? meta.border : 'border-l-border')}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                            <span className={cn('h-2 w-2 rounded-full', open ? meta.dot : 'bg-muted-foreground/40')} />
                            {meta.label}
                        </span>
                        <span className="rounded border px-1.5 py-px text-xs font-medium text-muted-foreground">{stop.step}</span>
                        {stop.blocking && open && (
                            <span className="text-xs font-medium text-warning">blocks {stop.step} approval</span>
                        )}
                    </div>
                    <p className="mt-1 text-sm text-foreground/90">{stop.reason}</p>
                    <p className="mt-1 text-sm">
                        <span className="text-muted-foreground">Question for {stop.requiredRole}: </span>
                        <span className="text-foreground">{stop.questionForHuman}</span>
                    </p>
                    {stop.status === 'resolved' && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                            <span>
                                Resolved by <strong className="font-medium text-foreground">{stop.resolvedBy}</strong>
                                {stop.resolvedAt ? ` · ${formatTime(stop.resolvedAt)}` : ''}: {stop.resolution}
                            </span>
                        </p>
                    )}
                    {stop.status === 'step-approved' && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span>{stop.step} was approved{stop.resolvedBy ? ` by ${stop.resolvedBy}` : ''} before this check existed — no separate resolution note.</span>
                        </p>
                    )}
                </div>
                {open && (
                    <Button type="button" variant="outline" size="sm" onClick={() => onResolve(stop)}>
                        Resolve
                    </Button>
                )}
            </div>
        </li>
    );
}

export function StopsPanel({ reportID, stops, isError }: { reportID: string; stops: CaseStop[]; isError?: boolean }) {
    const queryClient = useQueryClient();
    const [target, setTarget] = useState<CaseStop | null>(null);

    const resolve = useMutation({
        mutationFn: ({ stopId, note }: { stopId: string; note: string }) => resolveStop(reportID, stopId, note),
        onSuccess: () => {
            toast.success('Stop resolved', { description: 'Your note was added to the audit trail.' });
            setTarget(null);
            void queryClient.invalidateQueries({ queryKey: ['8d'] });
        },
        onError: (e: any) => {
            toast.error(e?.response?.data?.error?.message ?? e?.message ?? 'Could not resolve the stop.');
        },
    });

    if (isError) {
        return (
            <div className="rounded-lg border border-destructive/40 bg-destructive/[0.04] px-4 py-3 text-sm text-muted-foreground">
                Could not check where the AI must stop for this case. Approvals are still checked on the server.
            </div>
        );
    }
    if (stops.length === 0) return null;

    const open = stops.filter((s) => s.status === 'open');

    return (
        <section className="rounded-lg border bg-card px-4 py-3" aria-label="AI stopped here">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <OctagonPause className={cn('h-4 w-4 shrink-0', open.length ? 'text-warning' : 'text-muted-foreground')} />
                <h2 className="text-sm font-semibold text-foreground">
                    {open.length ? `AI stopped here — ${open.length} open` : 'AI stops — all handled'}
                </h2>
                <span className="text-sm text-muted-foreground">
                    The AI hands these to a person instead of guessing. Resolving one records your note in the audit trail.
                </span>
            </div>
            <ul className="mt-2 divide-y">
                {stops.map((stop) => (
                    <StopRow key={stop.id} stop={stop} onResolve={setTarget} />
                ))}
            </ul>

            <ReasonDialog
                open={target !== null}
                onOpenChange={(o) => { if (!o) setTarget(null); }}
                title={target ? `Resolve: ${STOP_TYPE_META[target.type].label} (${target.step})` : 'Resolve stop'}
                description={target ? target.questionForHuman : ''}
                placeholder={target?.type === 'exceeds-authority'
                    ? 'Who approved it, and what was decided?'
                    : 'Your answer, and where it can be checked (document, measurement, person)'}
                confirmLabel="Resolve stop"
                busy={resolve.isPending}
                onConfirm={(note) => target && resolve.mutate({ stopId: target.id, note })}
            />
        </section>
    );
}
