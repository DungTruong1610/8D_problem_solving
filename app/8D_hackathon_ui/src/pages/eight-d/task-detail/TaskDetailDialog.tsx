import { useEffect, useState } from 'react';
import {
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@cnma/react-ui';
import { Edit2, ShieldAlert, ShieldCheck, Sparkles, User, Wrench } from 'lucide-react';
import { taskCodeGroupOf } from '../../../../../../shared/task-catalogue';
import type { ActionTask } from '../../../../../../shared/action-task';
import { TaskStatusBadge } from '@/components/common/TaskStatusBadge';
import { TaskDetailView } from './TaskDetailView';
import { TaskEditForm, type TaskDraft } from './TaskEditForm';
import { TaskCodeChip, isTaskPublished } from './task-fields';

/** Bước sở hữu task, để người xem biết mình đang mở việc của bước nào. */
const STEP_CONTEXT: Record<string, { label: string; icon: typeof ShieldAlert }> = {
    D3: { label: 'D3 · Containment task', icon: ShieldAlert },
    D5: { label: 'D5 · Corrective task', icon: Wrench },
    D7: { label: 'D7 · Preventive task', icon: ShieldCheck },
};

function toDraft(task: ActionTask | null): TaskDraft {
    return {
        name: task?.name ?? '',
        assignee: task?.assignee ?? '',
        durationDays: task?.durationDays ? String(task.durationDays) : '',
        status: task?.status || 'Planned',
        description: task?.description ?? '',
        taskCode: task?.taskCode ?? '',
        startDate: task?.startDate ?? '',
        plannedEndDate: task?.plannedEndDate ?? '',
    };
}

export interface TaskDetailDialogProps {
    task: ActionTask | null;
    initialEditing?: boolean;
    readOnly?: boolean;
    reportID?: string;
    disciplineCode?: string;
    rootCause?: string;
    /** Bật luồng vận hành D3/D7 (Publish, bằng chứng, ghi chú) bất kể `disciplineCode`.
     *  Dùng khi popup mở từ D6 cho task của D5. */
    overrideActionDiscipline?: boolean;
    onClose: () => void;
    onSave: (updatedTask: ActionTask) => void;
}

/**
 * Popup một task: xem (icon mắt) hoặc sửa (icon bút chì).
 *
 * File này chỉ giữ state và các thao tác lưu. Hai màn hình nằm ở
 * `TaskDetailView` và `TaskEditForm`. Luật lưu / publish / ghi chú giữ nguyên
 * như trước khi tách: chỉ phần trình bày thay đổi.
 */
export function TaskDetailDialog({
    task,
    initialEditing = false,
    readOnly = false,
    reportID = '',
    disciplineCode = '',
    rootCause = '',
    overrideActionDiscipline = false,
    onClose,
    onSave,
}: TaskDetailDialogProps) {
    // Task D5 được vận hành ở D6: khi override bật, mở đủ luồng D3/D7.
    const isD3orD7 = overrideActionDiscipline || disciplineCode === 'D3' || disciplineCode === 'D7';
    const [isEditing, setIsEditing] = useState(initialEditing);
    const [draft, setDraft] = useState<TaskDraft>(() => toDraft(task));
    const [note, setNote] = useState(task?.note ?? '');

    useEffect(() => {
        if (!task) return;
        setDraft(toDraft(task));
        setNote(task.note ?? '');
    }, [task]);

    useEffect(() => {
        setIsEditing(initialEditing);
    }, [task?.id, initialEditing]);

    if (!task) return null;

    const context = STEP_CONTEXT[disciplineCode] ?? { label: `${disciplineCode || 'Task'} · Task`, icon: Wrench };
    const ContextIcon = context.icon;
    const contextLabel = overrideActionDiscipline ? `${context.label}, tracked in D6` : context.label;
    const canEdit = !readOnly && (!isD3orD7 || !isTaskPublished(task));

    /** Ghi chú thực thi — task không bắt buộc bằng chứng thì ghi chú làm nó Done. */
    const noteOutcome = (): ActionTask => {
        const isEvidenceReq = task.evidenceRequired ?? true;
        const shouldMarkDone = !isEvidenceReq && task.status === 'Open' && note.trim().length > 0;
        return { ...task, note: note.trim(), status: shouldMarkDone ? 'Done' : task.status };
    };

    const handleClose = () => {
        if (isD3orD7 && !isEditing && note !== (task.note ?? '')) onSave(noteOutcome());
        onClose();
    };

    const fromDraft = (): ActionTask => {
        const code = draft.taskCode.trim().toUpperCase();
        return {
            ...task,
            name: draft.name.trim() || task.name,
            assignee: draft.assignee.trim(),
            durationDays: Math.max(0, Number(draft.durationDays) || 0),
            description: draft.description.trim(),
            taskCode: code,
            taskCodeGroup: taskCodeGroupOf(code) ?? '',
            startDate: draft.startDate || undefined,
            plannedEndDate: draft.plannedEndDate,
            note: note.trim(),
        };
    };

    const handleSave = () => {
        onSave({
            ...fromDraft(),
            status: isD3orD7 ? (task.status || 'Planned') : draft.status,
            published: task.published,
            evidenceRequired: task.evidenceRequired,
        });
        setIsEditing(false);
        if (isD3orD7) onClose();
    };

    const handlePublish = () => {
        onSave({
            ...fromDraft(),
            status: 'Open',
            published: true,
            evidenceRequired: task.evidenceRequired ?? true,
        });
        setIsEditing(false);
        onClose();
    };

    const nameMissing = !draft.name.trim();
    const shownStatus = isEditing ? (isD3orD7 ? (task.status || 'Planned') : draft.status) : task.status;

    return (
        <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
            <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
                <DialogHeader className="space-y-3 border-b bg-muted/30 px-6 py-5 pr-12 text-left">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <ContextIcon className="size-3.5" />
                        </span>
                        <span>{isEditing ? `Edit · ${contextLabel}` : contextLabel}</span>
                    </div>
                    <DialogTitle className="text-lg font-semibold leading-snug text-foreground">
                        {isEditing ? (draft.name.trim() || 'Untitled task') : task.name}
                    </DialogTitle>
                    <DialogDescription asChild>
                        <div className="flex flex-wrap items-center gap-2">
                            <TaskStatusBadge status={shownStatus} />
                            {task.origin === 'AI suggestion' ? (
                                <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 font-normal text-primary">
                                    <Sparkles className="size-3.5" /> AI suggestion
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                                    <User className="size-3.5" /> Added by user
                                </Badge>
                            )}
                            {!isEditing && task.taskCode && <TaskCodeChip code={task.taskCode} />}
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                    {isEditing ? (
                        <TaskEditForm
                            taskId={task.id}
                            draft={draft}
                            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
                            disciplineCode={disciplineCode}
                            isD3orD7={isD3orD7}
                            taskStatus={task.status || 'Planned'}
                            rootCause={(task as { rootCause?: string }).rootCause || rootCause}
                        />
                    ) : (
                        <TaskDetailView
                            task={task}
                            disciplineCode={disciplineCode}
                            isD3orD7={isD3orD7}
                            readOnly={readOnly}
                            reportID={reportID}
                            rootCause={(task as { rootCause?: string }).rootCause || rootCause}
                            note={note}
                            onNoteChange={setNote}
                            onSaveNote={() => onSave(noteOutcome())}
                            onEvidenceUploaded={() => {
                                if (isD3orD7 && String(task.status || '').trim().toLowerCase() === 'open') {
                                    onSave({ ...task, status: 'Done' });
                                }
                            }}
                        />
                    )}
                </div>

                <div className="flex flex-col-reverse gap-3 border-t bg-muted/30 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                        {isEditing
                            ? (isD3orD7 && !task.published
                                ? 'Publish sends the task to its assignee and opens it for evidence.'
                                : 'Changes are saved to this step only.')
                            : (isD3orD7 && isTaskPublished(task)
                                ? 'Published tasks are no longer editable. Record progress with notes and evidence.'
                                : '')}
                    </p>
                    <div className="flex items-center justify-end gap-2">
                        {isEditing ? (
                            <>
                                <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                                <Button type="button" variant="outline" onClick={handleSave} disabled={nameMissing}>
                                    Save changes
                                </Button>
                                {isD3orD7 && !task.published && (
                                    <Button type="button" onClick={handlePublish} disabled={nameMissing}>Publish</Button>
                                )}
                            </>
                        ) : (
                            <>
                                {canEdit && (
                                    <Button type="button" variant="outline" className="gap-1.5" onClick={() => setIsEditing(true)}>
                                        <Edit2 className="size-3.5" /> Edit task
                                    </Button>
                                )}
                                <Button type="button" onClick={handleClose}>Close</Button>
                            </>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
