import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Button,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    Textarea,
    cn,
} from '@cnma/react-ui';
import {
    CheckSquare,
    Edit2,
    Eye,
    Sparkles,
    User,
} from 'lucide-react';
import { TASK_STATUSES, type ActionTask } from '../../../../../shared/action-task';
import { classifyTaskCode, taskCodeGroupOf } from '../../../../../shared/task-catalogue';
import { listTaskEvidence } from '@/services/eightd-service';
import { ValueHelpInput } from '@/components/ui/ValueHelpInput';
import { TaskStatusBadge } from '@/components/common/TaskStatusBadge';
import {
    Blank,
    DatePickerField,
    RootCauseChip,
    TaskCodeChip,
    TaskCodeField,
    TaskDetailDialog,
    isTaskPublished,
    usePartnerValueHelp,
} from './task-detail';

/**
 * Bảng việc đã chốt của một bước D.
 *
 * ── Vì sao tách khỏi thẻ đề xuất ──
 * `ActionCardsWidget` bên trên hiển thị thứ AI ĐỀ XUẤT. Bảng này hiển thị thứ kỹ
 * sư ĐÃ NHẬN. Trộn hai thứ vào một danh sách rồi phân biệt bằng màu là cách chắc
 * chắn để tới lúc audit không ai nói được việc nào đã có người chịu trách nhiệm.
 * Cùng quan hệ với `team.roster` → `team.assignedRoster` ở D1.
 *
 * Bảng hiển thị 7 cột: Task | Code | Assignee | Duration | Status | Evidence | (actions).
 *
 * ── Vì sao cột Code nằm trong bảng, còn hạn dự kiến thì không ──
 * Phase 4 đổi câu hỏi "lần trước gặp lỗi này chúng ta đã làm gì" từ một phép đọc
 * văn bản thành một phép đếm. Thứ trả tiền cho việc đó là MÃ, nên mã phải nhìn
 * thấy được ngay ở danh sách. `plannedEndDate` là dữ liệu vận hành của một việc
 * cụ thể — nó thuộc về ô chi tiết, và nhét thêm một cột ngày vào bảng chỉ làm
 * bảng chật đi mà không trả lại gì cho việc tra cứu.
 */

/**
 * Cột của bảng nhiệm vụ, kèm bề rộng tối thiểu.
 *
 * ── Vì sao phải ghim bề rộng ──
 * Bảng là `w-full` và sáu cột còn lại đều `whitespace-nowrap`, nên trình duyệt
 * lấy đủ chỗ cho chúng trước rồi mới dồn phần thừa cho cột Task — cột DUY NHẤT
 * được phép xuống dòng. Với sáu cột thì phần thừa còn đủ; thêm cột Code vào là
 * Task co xuống còn vài chục pixel và câu hành động rơi mỗi dòng một chữ.
 *
 * Ghim sàn cho Task rồi để `overflow-x-auto` ngoài bảng lo phần tràn: cuộn ngang
 * là thứ người dùng hiểu được, còn một cột dựng đứng thì không.
 */
export function TaskTable({
    tasks,
    onChange,
    readOnly = false,
    reportID = '',
    disciplineCode = '',
    rootCause = '',
    overrideActionDiscipline = false,
}: {
    tasks: ActionTask[];
    onChange: (next: ActionTask[]) => void;
    readOnly?: boolean;
    reportID?: string;
    disciplineCode?: string;
    rootCause?: string;
    /** When true, forces isD3orD7=true regardless of disciplineCode.
     *  Used by D6 to embed D5 tasks with full operational controls (evidence, publish, notes). */
    overrideActionDiscipline?: boolean;
}) {
    const [selectedTask, setSelectedTask] = useState<ActionTask | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [adding, setAdding] = useState(false);
    const partnerVh = usePartnerValueHelp();

    const isD5 = disciplineCode === 'D5';
    // D5 operational features are now in D6. Only D3 and D7 retain them in their own view.
    // When overrideActionDiscipline=true (D6 embedding), all features are unlocked.
    const isD3orD7 = overrideActionDiscipline || disciplineCode === 'D3' || disciplineCode === 'D7';

    // Evidence column is hidden in pure D5 view — managed in D6 instead.
    const showEvidenceColumn = isD3orD7 || !isD5;
    const headers: Array<{ label: string; className?: string }> = useMemo(() => [
        { label: 'Task', className: 'min-w-[240px]' },
        ...(isD5 ? [{ label: 'Root Cause', className: 'whitespace-nowrap' }] : []),
        ...(!isD5 && !isD3orD7 ? [{ label: 'Code' }] : []),
        { label: 'Assignee' },
        { label: 'Duration' },
        { label: 'Status' },
        ...(showEvidenceColumn ? [{ label: 'Evidence' }] : []),
        { label: '' },
    ], [isD5, isD3orD7, showEvidenceColumn]);

    const [newTaskName, setNewTaskName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newAssignee, setNewAssignee] = useState('');
    const [newDurationDays, setNewDurationDays] = useState<number | string>('');
    const [newStatus, setNewStatus] = useState<string>(TASK_STATUSES[0]);
    const [newTaskCode, setNewTaskCode] = useState('');
    const [newPlannedEndDate, setNewPlannedEndDate] = useState('');

    const { data: evidences = [] } = useQuery({
        queryKey: ['8d', 'evidence', reportID],
        queryFn: () => listTaskEvidence(reportID),
        enabled: Boolean(reportID),
    });

    const persist = onChange;

    const removeTask = (id: string) => {
        persist(tasks.filter((t) => t.id !== id));
    };

    const updateTask = (updated: ActionTask, keepOpen = false) => {
        const next = tasks.map((t) => (t.id === updated.id ? updated : t));
        persist(next);
        if (keepOpen) {
            setSelectedTask(updated);
        } else {
            setSelectedTask(null);
        }
    };

    const handleCreateTask = () => {
        const name = newTaskName.trim();
        if (!name) return;
        // Không ép người dùng bấm nút gợi ý: bỏ trống ô mã thì suy từ tên, hệt như
        // `taskFromAction` làm với một đề xuất được Accept. Việc gõ tay và việc
        // nhận từ AI phải ra cùng một kết quả, không thì thống kê theo mã sẽ nói
        // rằng việc do người tự thêm "ít khi có mã" — một kết luận về form nhập
        // liệu bị đọc nhầm thành một kết luận về nhà máy.
        const code = newTaskCode.trim().toUpperCase() || classifyTaskCode(name)?.taskCode || '';
        persist([...tasks, {
            id: `task-manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            name,
            description: newDescription.trim(),
            assignee: newAssignee.trim(),
            durationDays: Math.max(0, Number(newDurationDays) || 0),
            status: isD3orD7 ? 'Planned' : (newStatus || TASK_STATUSES[0]),
            origin: 'User added',
            attachments: [],
            taskCode: code,
            taskCodeGroup: taskCodeGroupOf(code) ?? '',
            startDate: undefined,
            plannedEndDate: newPlannedEndDate,
            evidenceRequired: true,
            published: false,
            note: '',
        }]);
        setNewTaskName('');
        setNewDescription('');
        setNewAssignee('');
        setNewDurationDays('');
        setNewStatus(TASK_STATUSES[0]);
        setNewTaskCode('');
        setNewPlannedEndDate('');
        setAdding(false);
    };

    return (
        <div className="min-w-0 overflow-hidden rounded-xl border bg-card p-4 shadow-xs transition-all border-border/70">
            <div className="mb-3 pb-2 border-b border-border/60 flex min-w-0 items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <CheckSquare className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 break-words text-base font-bold tracking-tight text-foreground">
                        Assigned Tasks
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {!readOnly && !adding && (
                        <button
                            type="button"
                            onClick={() => setAdding(true)}
                            className="rounded-md border border-input bg-card px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60 disabled:opacity-50 cursor-pointer"
                        >
                            Add
                        </button>
                    )}
                </div>
            </div>

            <div className="max-w-full overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            {headers.map(({ label, className }, index) => (
                                <th
                                    key={index}
                                    className={cn(
                                        'border-b px-2.5 py-2 text-left text-sm font-semibold uppercase tracking-wide text-muted-foreground',
                                        className,
                                    )}
                                >
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tasks.length === 0 ? (
                            <tr>
                                <td colSpan={headers.length} className="px-2.5 py-5 text-center text-sm font-normal text-muted-foreground">
                                    No task accepted yet. Use <span className="font-medium text-foreground">Accept</span> on a
                                    suggestion above, or add one by hand.
                                </td>
                            </tr>
                        ) : tasks.map((task) => {
                            const taskFiles = evidences.filter(
                                (e) => e.taskId === task.id && (disciplineCode ? e.disciplineCode === disciplineCode : true),
                            );
                            const isMissingEvidence = task.status === 'Done' && (task.evidenceRequired ?? true) && taskFiles.length === 0;
                            const isPublished = isTaskPublished(task);

                            return (
                                <tr
                                    key={task.id}
                                    className={cn(
                                        readOnly && 'opacity-90',
                                        isMissingEvidence && 'bg-amber-500/10 dark:bg-amber-500/15',
                                    )}
                                >
                                    <td className="border-b px-2.5 py-2 align-middle">
                                        <span className="flex items-center gap-1.5 text-sm">
                                            {task.origin === 'AI suggestion' && (
                                                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                                            )}
                                            <span className="font-normal text-foreground">{task.name}</span>
                                        </span>
                                    </td>
                                    {isD5 && (
                                        <td className="border-b px-2.5 py-2 align-middle whitespace-nowrap text-sm font-normal">
                                            <RootCauseChip category={(task as any)?.rootCause || rootCause} />
                                        </td>
                                    )}
                                    {!isD5 && !isD3orD7 && (
                                        <td className="border-b px-2.5 py-2 align-middle whitespace-nowrap text-sm font-normal">
                                            <TaskCodeChip code={task.taskCode} />
                                        </td>
                                    )}
                                    <td className="border-b px-2.5 py-2 align-middle text-sm font-normal">
                                        {task.assignee
                                            ? <span className="inline-flex items-center gap-1.5 text-foreground">
                                                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span>{task.assignee}</span>
                                            </span>
                                            : <Blank label="Unassigned" />}
                                    </td>
                                    <td className="border-b px-2.5 py-2 align-middle text-sm font-normal tabular-nums">
                                        {task.durationDays > 0 ? `${task.durationDays}d` : <Blank label="-" />}
                                    </td>
                                    <td className="border-b px-2.5 py-2 align-middle whitespace-nowrap">
                                        <TaskStatusBadge status={task.status} />
                                    </td>
                                    {showEvidenceColumn && (
                                        <td className="border-b px-2.5 py-2 align-middle whitespace-nowrap text-sm font-normal">
                                            {isD3orD7 ? (
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={task.evidenceRequired ?? true}
                                                        disabled={readOnly}
                                                        onCheckedChange={(checked) => {
                                                            const next = tasks.map((t) => (t.id === task.id ? { ...t, evidenceRequired: checked } : t));
                                                            persist(next);
                                                        }}
                                                    />
                                                    <span className={cn('text-xs font-medium', (task.evidenceRequired ?? true) ? 'text-foreground' : 'text-muted-foreground')}>
                                                        {(task.evidenceRequired ?? true) ? 'Required' : 'Optional'}
                                                    </span>
                                                </div>
                                            ) : (
                                                task.status !== 'Done' ? (
                                                    <span className="text-muted-foreground">-</span>
                                                ) : taskFiles.length === 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setSelectedTask(task); setIsEditMode(false); }}
                                                        className="inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-sm font-semibold text-warning hover:bg-warning/20 transition-colors cursor-pointer"
                                                        title="Completion evidence required. Click to view or upload."
                                                    >
                                                        Required
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setSelectedTask(task); setIsEditMode(false); }}
                                                        className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-sm font-semibold text-success hover:bg-success/20 transition-colors cursor-pointer"
                                                        title="View attached evidence"
                                                    >
                                                        {taskFiles.length} {taskFiles.length === 1 ? 'PDF' : 'PDFs'}
                                                    </button>
                                                )
                                            )}
                                        </td>
                                    )}
                                    <td className="border-b px-2.5 py-2 text-right align-middle">
                                        <div className="inline-flex items-center gap-1 justify-end">
                                            {isD3orD7 ? (
                                                <>
                                                    {(!isPublished && !readOnly) ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => { setSelectedTask(task); setIsEditMode(true); }}
                                                            aria-label="Edit task"
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                                            title="Edit task"
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => { setSelectedTask(task); setIsEditMode(false); }}
                                                            aria-label="View details"
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                                            title="View details"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                    {!readOnly && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeTask(task.id)}
                                                            className="rounded-md px-2.5 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-muted/60 cursor-pointer"
                                                            title="Remove task"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </>
                                            ) : isD5 ? (
                                                /* D5 thuần: không có eye/pencil — chỉ Remove.
                                                   Operational controls (evidence, notes, publish) đã được chuyển sang D6. */
                                                <>
                                                    {!readOnly && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeTask(task.id)}
                                                            className="rounded-md px-2.5 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-muted/60 cursor-pointer"
                                                            title="Remove task"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setSelectedTask(task); setIsEditMode(false); }}
                                                        aria-label="View details"
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                                        title="View details"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </button>
                                                    {!readOnly && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => { setSelectedTask(task); setIsEditMode(true); }}
                                                                aria-label="Edit task"
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                                                title="Edit task"
                                                            >
                                                                <Edit2 className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeTask(task.id)}
                                                                className="rounded-md px-2.5 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-muted/60 cursor-pointer"
                                                                title="Remove task"
                                                            >
                                                                Remove
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {!readOnly && adding && (
                <div className="mt-3 rounded-lg border bg-muted/20 p-3.5 space-y-3">
                    <p className="text-base font-semibold text-foreground">Add New Task</p>
                    <div className="space-y-1.5">
                        <Label className="text-sm font-semibold text-muted-foreground">
                            Task Name <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            placeholder="e.g. Replace clamp pads and perform calibration..."
                            value={newTaskName}
                            onChange={(e) => setNewTaskName(e.target.value)}
                            rows={2}
                            className="text-sm font-normal leading-relaxed bg-background min-h-[56px] resize-y"
                            autoFocus
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-sm font-semibold text-muted-foreground">
                            Description & Instructions
                        </Label>
                        <Textarea
                            placeholder="Detailed instructions, scope of work, or criteria..."
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            rows={2}
                            className="text-sm leading-relaxed bg-background min-h-[60px]"
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
                        <div className="space-y-1.5 sm:col-span-6">
                            <Label className="text-sm font-semibold text-muted-foreground">
                                Assignee
                            </Label>
                            <ValueHelpInput
                                value={newAssignee}
                                onChange={setNewAssignee}
                                entries={partnerVh.entries}
                                loading={partnerVh.loading}
                                quiet
                                dropdownPlacement="top"
                                inputClassName="text-sm"
                                placeholder="e.g. Quality Engineer"
                                catalogLabel="the team directory"
                            />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label className="text-sm font-semibold text-muted-foreground">
                                Duration (Days)
                            </Label>
                            <Input
                                type="number"
                                min={0}
                                placeholder="0"
                                value={newDurationDays}
                                onChange={(e) => setNewDurationDays(e.target.value)}
                                className="h-9 text-sm bg-background"
                            />
                        </div>
                        {isD3orD7 ? (
                            <div className="space-y-1.5 sm:col-span-4">
                                <Label className="text-sm font-semibold text-muted-foreground">
                                    Status
                                </Label>
                                <div className="flex items-center h-9">
                                    <TaskStatusBadge status="Planned" />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1.5 sm:col-span-4">
                                <Label className="text-sm font-semibold text-muted-foreground">
                                    Status
                                </Label>
                                <Select value={newStatus} onValueChange={setNewStatus}>
                                    <SelectTrigger className="h-9 text-sm bg-background w-full">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent side="top">
                                        {TASK_STATUSES.map((st) => (
                                            <SelectItem key={st} value={st} className="text-sm">
                                                {st}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    {/* Quality Task coding / Root Cause */}
                    {isD5 ? (
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-semibold text-muted-foreground">
                                    Root Cause (from D4)
                                </Label>
                                <div className="flex items-center h-9">
                                    <RootCauseChip category={rootCause} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="new-task-due" className="text-sm font-semibold text-muted-foreground">
                                    Planned End Date
                                </Label>
                                <DatePickerField
                                    id="new-task-due"
                                    value={newPlannedEndDate}
                                    onChange={setNewPlannedEndDate}
                                    dropdownPlacement="top"
                                />
                            </div>
                        </div>
                    ) : isD3orD7 ? (
                        <div className="space-y-1.5 sm:col-span-1">
                            <Label htmlFor="new-task-due" className="text-sm font-semibold text-muted-foreground">
                                Planned End Date
                            </Label>
                            <DatePickerField
                                id="new-task-due"
                                value={newPlannedEndDate}
                                onChange={setNewPlannedEndDate}
                                dropdownPlacement="top"
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                            <TaskCodeField
                                code={newTaskCode}
                                onCodeChange={setNewTaskCode}
                                suggestedFrom={newTaskName}
                                idPrefix="new-task"
                            />
                            <div className="space-y-1.5">
                                <Label htmlFor="new-task-due" className="text-sm font-semibold text-muted-foreground">
                                    Planned End Date
                                </Label>
                                <DatePickerField
                                    id="new-task-due"
                                    value={newPlannedEndDate}
                                    onChange={setNewPlannedEndDate}
                                    dropdownPlacement="top"
                                />
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                        <Button size="sm" onClick={handleCreateTask} disabled={!newTaskName.trim()} className="h-9 text-sm px-3">
                            Add task
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="h-9 text-sm px-3">
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {selectedTask && (
                <TaskDetailDialog
                    task={selectedTask}
                    initialEditing={isEditMode}
                    readOnly={readOnly}
                    reportID={reportID}
                    disciplineCode={disciplineCode}
                    rootCause={rootCause}
                    overrideActionDiscipline={overrideActionDiscipline}
                    onClose={() => setSelectedTask(null)}
                    onSave={(updated) => updateTask(updated, true)}
                />
            )}
        </div>
    );
}



