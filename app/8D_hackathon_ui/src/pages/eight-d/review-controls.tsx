import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Button,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    cn,
} from '@cnma/react-ui';
import { CheckCircle2, CircleAlert, Lock, LockOpen, MessageSquareWarning, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
    listTaskEvidence,
    reviewDiscipline,
    reviewStatusOf,
    isStepUnlocked,
    STEP_CODES,
    saveDisciplineField,
    setDisciplineWorkState,
    type Discipline8D,
    type ReviewDecision,
    type ReviewStatus,
} from '@/services/eightd-service';
import { normalizeActionStatus } from '../../../../../shared/action-task';
import { evaluateDisciplineCompletion, type CompletionBlocker } from '../../../../../shared/discipline-completion';
import { AiProvenanceInfo } from './ai-provenance-info';
import { ReasonDialog } from './reason-dialog';

/** Bước có luật hoàn tất theo task (D6 đọc task của D5). */
const ACTION_CODES = new Set(['D3', 'D5', 'D6', 'D7']);

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
    reportID,
    discipline,
    siblings,
    caseContext,
    precedentsJson,
}: {
    reportID: string;
    discipline: Discipline8D;
    siblings?: Discipline8D[];
    liveFormSchemaJson?: string | null;
    caseContext?: string | Record<string, unknown> | null;
    precedentsJson?: string | null;
}) {
    const queryClient = useQueryClient();
    const allSiblings = siblings || [];
    const isApproved = reviewStatusOf(discipline) === 'Approved' || discipline.workState === 'Completed';
    const unlocked = isApproved || isStepUnlocked(discipline.code, allSiblings);
    const stepIdx = STEP_CODES.indexOf(discipline.code as any);
    const prevCode = stepIdx > 0 ? STEP_CODES[stepIdx - 1] : null;

    const currentStatus: 'NotStarted' | 'InProgress' | 'Completed' = isApproved
        ? 'Completed'
        : (unlocked && discipline.workState === 'InProgress' ? 'InProgress' : 'NotStarted');

    // Bằng chứng đã upload — cùng queryKey với bảng task, nên upload xong là
    // checklist bên dưới tự cập nhật.
    const { data: evidence } = useQuery({
        queryKey: ['8d', 'evidence', reportID],
        queryFn: () => listTaskEvidence(reportID),
        enabled: Boolean(reportID) && ACTION_CODES.has(discipline.code),
    });
    const completion = useMemo(
        () => evaluateDisciplineCompletion({
            code: discipline.code,
            resultJson: discipline.resultJson,
            evidenceTaskIds: (evidence ?? [])
                .filter((e) => e.disciplineCode === discipline.code)
                .map((e) => e.taskId),
            siblings: allSiblings.map((s) => ({ code: s.code, resultJson: s.resultJson })),
        }),
        [discipline.code, discipline.resultJson, evidence, allSiblings],
    );

    const [dialog, setDialog] = useState<'request-change' | 'reopen' | null>(null);

    const submit = useMutation({
        mutationFn: ({ decision, text }: { decision: ReviewDecision; text?: string }) =>
            reviewDiscipline(discipline.ID, decision, text),
        onSuccess: (result, { decision }) => {
            const title = decision === 'approve'
                ? `${result.code} — Complete`
                : decision === 'reopen'
                    ? `${result.code} reopened`
                    : `${result.code} sent back for changes`;
            toast.success(title, { description: result.gate.reason });
            setDialog(null);
            void queryClient.invalidateQueries({ queryKey: ['8d'] });
        },
        onError: (e: any) => {
            toast.error(e?.response?.data?.error?.message ?? e?.message ?? 'Could not save the review.');
        },
    });

    const busy = submit.isPending;
    const reviewStatus = reviewStatusOf(discipline);

    /**
     * Dropdown chỉ còn đổi TRẠNG THÁI LÀM VIỆC (chưa bắt đầu / đang làm). Duyệt,
     * trả về sửa và mở lại là QUYẾT ĐỊNH của người — mỗi cái một nút riêng, hai
     * cái sau bắt buộc có lý do. Trước đây cả ba nằm chung một ô chọn và "mở lại"
     * xảy ra ngầm khi ai đó đổi ô chọn của một bước đã duyệt.
     */
    const handleWorkStateChange = async (value: 'NotStarted' | 'InProgress') => {
        if (value === currentStatus) return;
        const parsed = parseJsonSafe(discipline.resultJson);
        try {
            await setDisciplineWorkState(discipline.ID, value);

            // Bắt đầu làm một bước hành động thì task đã lên kế hoạch chuyển sang Open
            // để người phụ trách nộp được bằng chứng. Không task nào thành Done ở đây.
            if (value === 'InProgress' && ['D3', 'D5', 'D7'].includes(discipline.code)) {
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

            toast.success(value === 'InProgress' ? 'Status: In process' : 'Status: Not started');
            void queryClient.invalidateQueries({ queryKey: ['8d'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error?.message ?? err?.message ?? 'Could not update status.');
        }
    };

    const approve = () => {
        if (!unlocked) {
            toast.error(`Cannot complete ${discipline.code}: complete the previous step (${prevCode}) first.`);
            return;
        }
        // Duyệt KHÔNG đổi trạng thái task nào. Từng task phải được người phụ trách
        // hoàn tất riêng (bằng chứng / ghi chú thực thi); ở đây chỉ kiểm tra rằng
        // điều đó đã xảy ra. Backend kiểm lại đúng luật này trước khi ghi.
        if (!completion.canApprove) {
            toast.error(`Cannot complete ${discipline.code} yet`, {
                description: completion.blockers.map((b) => b.message).join('\n'),
            });
            return;
        }
        submit.mutate({ decision: 'approve' });
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
                                {discipline.reviewedAt ? formatReviewedAt(discipline.reviewedAt) : 'All criteria verified'}
                            </span>
                        </div>
                    ) : (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            {currentStatus === 'InProgress'
                                ? 'In process — editing and confirmation enabled'
                                : !unlocked
                                    ? `Not started (locked) — complete previous step (${prevCode}) to unlock`
                                    : 'Not started (read-only) — switch status to "In process" to edit'}
                        </p>
                    )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {isApproved ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={busy}
                            onClick={() => setDialog('reopen')}
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reopen
                        </Button>
                    ) : (
                        <>
                            <Select
                                value={currentStatus}
                                disabled={busy || !unlocked}
                                onValueChange={(val) => handleWorkStateChange(val as 'NotStarted' | 'InProgress')}
                            >
                                <SelectTrigger className="h-9 w-[140px] px-3 text-sm font-medium bg-background" aria-label="Work status">
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
                                </SelectContent>
                            </Select>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                disabled={busy || !unlocked}
                                onClick={() => setDialog('request-change')}
                                title="Send this step back with a reason"
                            >
                                <MessageSquareWarning className="h-3.5 w-3.5" />
                                Request changes
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                className="gap-1.5"
                                disabled={busy || !unlocked || !completion.canApprove}
                                onClick={approve}
                                title={completion.canApprove ? `Approve ${discipline.code}` : 'Resolve the open items below first'}
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Approve step
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {reviewStatus === 'ChangeRequested' && discipline.reviewNote && (
                <div className="mt-3 rounded-md border border-warning/40 bg-warning/[0.06] px-3 py-2.5 text-sm">
                    <p className="font-medium text-foreground">
                        Changes requested{discipline.reviewedBy ? ` by ${discipline.reviewedBy}` : ''}
                        {discipline.reviewedAt ? <span className="font-normal text-muted-foreground"> · {formatReviewedAt(discipline.reviewedAt)}</span> : null}
                    </p>
                    <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{discipline.reviewNote}</p>
                </div>
            )}

            {!isApproved && unlocked && completion.blockers.length > 0 && (
                <CompletionChecklist code={discipline.code} blockers={completion.blockers} />
            )}

            <ReasonDialog
                open={dialog === 'request-change'}
                onOpenChange={(open) => setDialog(open ? 'request-change' : null)}
                title={`Request changes on ${discipline.code}`}
                description="The step goes back to In process and the owner sees your reason."
                placeholder={'What is wrong:\nWhat evidence is needed:\nWho should act:'}
                confirmLabel="Send back"
                busy={busy}
                onConfirm={(reason) => submit.mutate({ decision: 'request-change', text: reason })}
            />
            <ReasonDialog
                open={dialog === 'reopen'}
                onOpenChange={(open) => setDialog(open ? 'reopen' : null)}
                title={`Reopen ${discipline.code}`}
                description="This withdraws the approval. The step returns to In process and must be approved again."
                placeholder="Why is the approval being withdrawn? e.g. a new measurement contradicts the root cause"
                confirmLabel="Reopen step"
                busy={busy}
                onConfirm={(reason) => submit.mutate({ decision: 'reopen', text: reason })}
            />
        </div>
    );
}

function formatReviewedAt(value: string): string {
    return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Việc còn thiếu trước khi duyệt được bước, nêu đích danh từng task.
 *
 * Hiện ngay trên ô duyệt để người dùng không phải bấm Complete rồi mới biết bị
 * chặn vì đâu. Cùng luật với backend (`shared/discipline-completion.ts`).
 */
function CompletionChecklist({ code, blockers }: { code: string; blockers: CompletionBlocker[] }) {
    return (
        <div className="mt-3 rounded-md border border-warning/40 bg-warning/[0.06] px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <CircleAlert className="h-4 w-4 shrink-0 text-warning" />
                {code} can be completed once {blockers.length === 1 ? 'this item is' : `these ${blockers.length} items are`} done:
            </p>
            <ul className="mt-1.5 space-y-1 pl-6 text-sm text-muted-foreground">
                {blockers.map((b, i) => (
                    <li key={`${b.taskId ?? b.issue}-${i}`} className="list-disc">{b.message}</li>
                ))}
            </ul>
        </div>
    );
}
