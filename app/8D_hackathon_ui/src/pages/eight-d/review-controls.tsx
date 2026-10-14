import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    cn,
} from '@cnma/react-ui';
import { AlertTriangle, CheckCircle2, Lock, LockOpen, Play, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
    listTaskEvidence,
    reviewDiscipline,
    reviewStatusOf,
    isStepUnlocked,
    pendingPrerequisites,
    saveDisciplineField,
    setDisciplineWorkState,
    type CaseStop,
    type Discipline8D,
    type ReviewDecision,
    type ReviewStatus,
} from '@/services/eightd-service';
import { normalizeActionStatus } from '../../../../../shared/action-task';
import { evaluateDisciplineCompletion } from '../../../../../shared/discipline-completion';
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
                        ? 'D1-D7 completed - the case can be closed.'
                        : <>Closure blocked by <strong className="font-medium text-foreground">{blocking.join(', ')}</strong></>}
                </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
                {disciplines.map((d) => {
                    const status = reviewStatusOf(d);
                    return (
                        <span
                            key={d.ID}
                            title={`${d.code} - ${STATUS_STYLE[status].label}`}
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

/**
 * Tiêu đề bước, ví dụ "D1 - Team Roster".
 *
 * Một số case lưu sẵn mã bước trong `title` ("D1 — Team Roster", dấu gạch dài
 * từ dữ liệu cũ); ghép thêm mã vào trước sẽ thành "D1 - D1 — Team Roster". Nên
 * bóc mã (và dấu gạch theo sau, dài hay ngắn) ra rồi ghép lại theo một kiểu.
 */
function stepHeading(code: string, title: string | null | undefined): string {
    const text = (title ?? '').trim().replace(new RegExp(`^${code}\\b\\s*[—–-]?\\s*`, 'i'), '');
    return text ? `${code} - ${text}` : code;
}

/** Ô quyết định và trạng thái nằm dưới nội dung của một bước. */
export function DisciplineReviewBox({
    reportID,
    stops = [],
    discipline,
    siblings,
    caseContext,
    precedentsJson,
}: {
    reportID: string;
    /** Các lần AI dừng thuộc về bước này (lọc sẵn theo `step`). */
    stops?: CaseStop[];
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
    // Bước còn chặn (D7 có thể chờ hai bước: "D5 and D6").
    const prevCode = pendingPrerequisites(discipline.code, allSiblings).join(' and ') || null;

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
            // D6 duyệt task của D5, và bằng chứng của chúng lưu dưới mã D5.
            evidenceTaskIds: (evidence ?? [])
                .filter((e) => e.disciplineCode === (discipline.code === 'D6' ? 'D5' : discipline.code))
                .map((e) => e.taskId),
            siblings: allSiblings.map((s) => ({ code: s.code, resultJson: s.resultJson })),
        }),
        [discipline.code, discipline.resultJson, evidence, allSiblings],
    );

    // Mở lại một bước đã duyệt cần lý do (backend bắt buộc) — hỏi trong popup,
    // chỉ khi người dùng bấm Reopen.
    const [reopenOpen, setReopenOpen] = useState(false);
    // Lý do không duyệt được — hiện trong cửa sổ báo lỗi thay vì toast.
    const [approveErrors, setApproveErrors] = useState<string[] | null>(null);
    const [starting, setStarting] = useState(false);

    const submit = useMutation({
        mutationFn: ({ decision, text }: { decision: ReviewDecision; text?: string }) =>
            reviewDiscipline(discipline.ID, decision, text),
        onSuccess: (result, { decision }) => {
            toast.success(decision === 'approve' ? `${result.code} - Complete` : `${result.code} reopened`, {
                description: result.gate.reason,
            });
            void queryClient.invalidateQueries({ queryKey: ['8d'] });
        },
        onError: (e: any, { decision }) => {
            const message = e?.response?.data?.error?.message ?? e?.message ?? 'Could not save the review.';
            if (decision === 'approve') setApproveErrors([message]);
            else toast.error(message);
        },
    });

    const busy = submit.isPending || starting;
    // AI đã dừng ở bước này và chưa ai gỡ: không duyệt được (backend cũng chặn).
    const openStops = stops.filter((s) => s.blocking && s.status === 'open');
    // Tính sẵn để nút Approve nhạt đi khi chưa đủ điều kiện.
    const approveBlockers = [
        ...openStops.map((s) => `AI stopped here - ${s.questionForHuman} (open "AI stops" at the top to resolve it)`),
        ...completion.blockers.map((b) => b.message),
    ];
    const canApprove = approveBlockers.length === 0;

    /** Đổi trạng thái làm việc của một bước CHƯA duyệt. */
    const changeWorkState = async (value: 'NotStarted' | 'InProgress') => {
        const parsed = parseJsonSafe(discipline.resultJson);
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
    };

    /**
     * Duyệt KHÔNG đổi trạng thái task nào: từng task phải được người phụ trách
     * hoàn tất riêng. Chưa đủ điều kiện thì chặn và liệt kê lý do trong cửa sổ
     * báo lỗi — không treo checklist cố định trên màn hình. Backend kiểm lại.
     */
    const approve = () => {
        if (!canApprove) {
            setApproveErrors(approveBlockers);
            return;
        }
        submit.mutate({ decision: 'approve' });
    };

    /**
     * Không bước nào tự chuyển sang "In process": bước trước xong chỉ MỞ KHOÁ
     * nút Start của bước sau — bắt đầu hay chưa là do người dùng bấm.
     */
    const startProcess = async () => {
        setStarting(true);
        try {
            await changeWorkState('InProgress');
            toast.success(`${discipline.code} - In process`);
            await queryClient.invalidateQueries({ queryKey: ['8d'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error?.message ?? err?.message ?? 'Could not start the step.');
        } finally {
            setStarting(false);
        }
    };

    const confirmReopen = async (reason: string) => {
        try {
            await submit.mutateAsync({ decision: 'reopen', text: reason });
            setReopenOpen(false);
        } catch {
            // Lỗi đã được toast trong onError của mutation.
        }
    };

    return (
        <div className="mt-4 rounded-lg border bg-muted/20 px-4 py-3" data-tour="case-review">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold tracking-tight text-foreground">
                            {stepHeading(discipline.code, discipline.title)}
                        </span>
                        {['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'].includes(discipline.code) && (
                            <AiProvenanceInfo
                                discipline={discipline}
                                label={stepHeading(discipline.code, discipline.title)}
                                caseContext={caseContext}
                                precedentsJson={precedentsJson}
                            />
                        )}
                    </div>

                    {currentStatus === 'Completed' ? (
                        <div className="mt-1 flex flex-col min-w-0">
                            <span className="text-sm font-medium text-foreground">
                                Completed{discipline.reviewedBy ? <> by <strong className="font-semibold text-foreground">{discipline.reviewedBy}</strong></> : ' - verified and approved'}
                            </span>
                            <span className="text-sm text-muted-foreground tabular-nums">
                                {discipline.reviewedAt ? formatReviewedAt(discipline.reviewedAt) : 'All criteria verified'}
                            </span>
                        </div>
                    ) : (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            {currentStatus === 'InProgress'
                                ? 'In process - editing and confirmation enabled'
                                : !unlocked
                                    ? `Not started (locked) - complete ${prevCode} to unlock`
                                    : 'Not started (read-only) - click "Start the process" to edit'}
                        </p>
                    )}
                </div>

                {/* Một nút duy nhất chỉ bước tiếp theo: Start → Approve → Reopen. */}
                <div className="flex shrink-0 items-center" data-tour="case-action">
                    {currentStatus === 'Completed' ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={busy}
                            onClick={() => setReopenOpen(true)}
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reopen
                        </Button>
                    ) : currentStatus === 'InProgress' ? (
                        <Button
                            type="button"
                            size="sm"
                            // Chưa đủ điều kiện: nhạt đi nhưng vẫn bấm được để xem lý do.
                            className={cn('gap-1.5', !canApprove && 'opacity-50 hover:opacity-60')}
                            disabled={busy}
                            aria-disabled={!canApprove}
                            onClick={approve}
                            title={canApprove ? `Approve ${discipline.code}` : `${discipline.code} is not ready to approve yet`}
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            className="gap-1.5"
                            disabled={busy || !unlocked}
                            onClick={startProcess}
                            title={unlocked ? `Start working on ${discipline.code}` : `Complete ${prevCode} first`}
                        >
                            <Play className="h-3.5 w-3.5" />
                            {starting ? 'Starting…' : 'Start the process'}
                        </Button>
                    )}
                </div>
            </div>

            <Dialog open={approveErrors !== null} onOpenChange={(next) => !next && setApproveErrors(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                            Cannot approve {discipline.code} yet
                        </DialogTitle>
                        <DialogDescription>
                            Resolve the following before approving this step:
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
                        {(approveErrors ?? []).map((reason, i) => (
                            <li key={i}>{reason}</li>
                        ))}
                    </ul>
                    <DialogFooter>
                        <Button type="button" onClick={() => setApproveErrors(null)}>
                            OK
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ReasonDialog
                open={reopenOpen}
                onOpenChange={setReopenOpen}
                title={`Reopen ${discipline.code}`}
                description="This withdraws the approval. The step must be completed again, and your reason is stored in the audit log."
                placeholder="Why is the approval being withdrawn? e.g. a new measurement contradicts the root cause"
                confirmLabel="Reopen step"
                busy={busy}
                onConfirm={confirmReopen}
            />
        </div>
    );
}

function formatReviewedAt(value: string): string {
    return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
