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
    'preventive-maintenance': 'Bảo trì phòng ngừa',
    calibration: 'Hiệu chuẩn',
    'error-proofing': 'Chống sai (poka-yoke)',
    'work-instruction': 'Hướng dẫn công việc',
    'incoming-inspection': 'Kiểm tra đầu vào',
    'condition-monitoring': 'Giám sát điều kiện',
    'inspection-frequency': 'Tăng tần suất kiểm tra',
};

const STATUS_LABEL: Record<MaintenanceProposal['status'], { text: string; className: string }> = {
    Proposed: { text: 'Đề xuất', className: 'bg-muted text-muted-foreground' },
    Approved: { text: 'Đã duyệt', className: 'bg-success/15 text-success' },
    Rejected: { text: 'Từ chối', className: 'bg-destructive/10 text-destructive' },
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
    return `${limit.toLocaleString('vi-VN')} ${unit}${actual != null ? ` (thực tế ${actual.toLocaleString('vi-VN')})` : ''}`;
};

/** Ô khoảng cần số mà không có số: nói rõ là chờ người nhập. */
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
            if (!plan.refusal) toast.success(`Đã tạo ${plan.proposals.length} đề xuất`);
            void queryClient.invalidateQueries({ queryKey: ['8d'] });
        },
        onError: (e) => toast.error(`Không tạo được đề xuất: ${errorText(e)}`),
    });

    const decide = useMutation({
        mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
            decideMaintenanceProposal(report.ID, id, decision, notes[id] ?? ''),
        onSuccess: (p) => {
            toast.success(p.status === 'Approved' ? 'Đã duyệt đề xuất' : 'Đã từ chối đề xuất');
            void queryClient.invalidateQueries({ queryKey: ['8d'] });
            void queryClient.invalidateQueries({ queryKey: ['maintenance-history'] });
        },
        onError: (e) => toast.error(`Không ghi được quyết định: ${errorText(e)}`),
    });

    const openCase = async (notificationId: string) => {
        try {
            const found = (await eightDService.list()).value?.find((r: Report8D) => r.notificationId === notificationId);
            if (found) navigate(`/8d/${found.ID}`);
            else toast.info(`${notificationId} là case đã đóng trong kho tiền lệ — không có báo cáo 8D trong hệ thống.`);
        } catch (e) {
            toast.error(`Không mở được case: ${errorText(e)}`);
        }
    };

    const plan = stored;
    const editable = discipline.workState === 'InProgress' && discipline.reviewStatus !== 'Approved';

    return (
        <Card className="space-y-4 p-5" data-testid="maintenance-panel">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-destructive" />
                    <h3 className="text-sm font-semibold">Đề xuất bảo trì phòng ngừa</h3>
                    {defectCode && (
                        <span className="font-mono text-xs text-muted-foreground">{defectCode} · {workCenterId}</span>
                    )}
                </div>
                <Button type="button" size="sm" onClick={() => generate.mutate()} disabled={!editable || generate.isPending}>
                    {generate.isPending && <Spinner className="mr-2 h-3.5 w-3.5" />}
                    {plan ? 'Tạo lại đề xuất' : 'Tạo đề xuất'}
                </Button>
            </div>
            {!editable && (
                <p className="text-xs text-muted-foreground">Chuyển D7 sang “In process” để tạo hoặc duyệt đề xuất.</p>
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
                    Chưa có đề xuất. Bấm “Tạo đề xuất” để suy ra từ nguyên nhân gốc D4 đã duyệt và các case đã đóng cùng loại lỗi.
                </div>
            ) : (
                <>
                    {plan.stops.map((s) => (
                        <div key={s.id} className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/[0.06] px-3 py-2 text-xs">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                            <div>
                                <p className="font-medium text-foreground">{s.reason}</p>
                                <p className="mt-0.5 text-muted-foreground">{s.questionForHuman} — cần: {s.requiredRole}</p>
                            </div>
                        </div>
                    ))}

                    {!plan.proposals.length && <p className="text-sm text-muted-foreground">Không có đề xuất nào.</p>}
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
                                        <dt className="text-muted-foreground">Chu kỳ / ngưỡng</dt>
                                        <dd>
                                            {interval ?? (NEEDS_NUMBER.has(p.controlType)
                                                ? <span className="text-warning">Chưa có số đo — cần người nhập</span>
                                                : <span className="text-muted-foreground">Không áp dụng</span>)}
                                            {p.interval && <span className="ml-1 text-muted-foreground">từ “{p.interval.sourceText}”</span>}
                                        </dd>
                                        <dt className="text-muted-foreground">Người phụ trách</dt>
                                        <dd>{p.owner ?? <span className="text-muted-foreground">Chưa giao</span>}</dd>
                                        <dt className="text-muted-foreground">Căn cứ</dt>
                                        <dd>Nhóm {p.rootCauseCategory ?? '?'}{p.whyStepUsed ? ` · why #${p.whyStepUsed}` : ''}</dd>
                                        <dt className="text-muted-foreground">Case nguồn</dt>
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
                                                    aria-label="Ghi chú quyết định"
                                                    placeholder="Ghi chú (tuỳ chọn)"
                                                    value={notes[p.id] ?? ''}
                                                    onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                                                    className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                                                />
                                                <Button type="button" size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: p.id, decision: 'approve' })}>Duyệt</Button>
                                                <Button type="button" size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: p.id, decision: 'reject' })}>Từ chối</Button>
                                            </div>
                                        )
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            {status.text} bởi {p.decidedBy ?? '?'}{p.decidedAt ? ` lúc ${new Date(p.decidedAt).toLocaleString('vi-VN')}` : ''}
                                            {p.note ? ` — “${p.note}”` : ''}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <section className="space-y-2">
                        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <CalendarClock className="h-3.5 w-3.5" /> Các lần xảy ra của loại lỗi này
                        </h4>
                        {plan.occurrences.length < 2 ? (
                            <p className="text-xs text-muted-foreground">
                                Mới có {plan.occurrences.length} lần ghi nhận — chưa đủ để tính khoảng cách tái phát.
                            </p>
                        ) : (
                            <>
                                <ol className="space-y-1 text-xs">
                                    {plan.occurrences.map((o) => (
                                        <li key={`${o.notificationId}-${o.foundDate}`} className="flex gap-3">
                                            <span className="w-24 font-mono tabular-nums">{o.foundDate}</span>
                                            <span className={cn('font-mono', o.current && 'font-semibold text-destructive')}>
                                                {o.notificationId}{o.current ? ' (case này)' : ''}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                                <ul className="space-y-1 text-xs">
                                    {plan.intervals.gaps.map((g) => (
                                        <li key={`${g.from}-${g.to}`}>
                                            <span className={cn('mr-2 rounded px-1.5 py-0.5 font-medium', g.phase === 'after' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                                                {g.phase === 'after' ? 'Sau hành động' : 'Trước hành động'}
                                            </span>
                                            {g.from} → {g.to}: <span className="font-semibold tabular-nums">{g.days} ngày</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-xs text-muted-foreground">
                                    {plan.intervals.actionDate
                                        ? `Mốc hành động phòng ngừa: ${plan.intervals.actionDate} (ngày đóng case gần nhất). Chỉ số ngày thật, không dự báo.`
                                        : 'Chưa có case đóng nào làm mốc hành động. Chỉ số ngày thật, không dự báo.'}
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
                    <History className="h-3.5 w-3.5" /> Lịch sử bảo trì đã duyệt cho loại lỗi này
                </h4>
                {history.isLoading ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground"><Spinner className="h-3 w-3" /> Đang tải…</p>
                ) : history.error ? (
                    <p className="text-xs text-destructive">Không tải được lịch sử: {errorText(history.error)}</p>
                ) : !history.data?.length ? (
                    <p className="text-xs text-muted-foreground">Chưa có đề xuất nào được duyệt cho loại lỗi này.</p>
                ) : (
                    <ul className="space-y-1.5 text-xs" data-testid="maintenance-history">
                        {history.data.map((h) => (
                            <li key={`${h.reportID}-${h.id}`} className="rounded-md border border-border/60 px-3 py-2">
                                <span className="font-medium">{CONTROL_LABEL[h.controlType] ?? h.controlType}</span>
                                <span className="text-muted-foreground"> · {h.notificationId} · {h.decidedAt ? new Date(h.decidedAt).toLocaleDateString('vi-VN') : ''} · {h.decidedBy}</span>
                                <p className="mt-0.5">{h.task}</p>
                                <p className="mt-0.5 font-mono text-muted-foreground">Nguồn: {h.sourceCaseIds.join(', ')}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </Card>
    );
}
