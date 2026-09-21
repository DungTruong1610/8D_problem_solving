import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Badge,
    Button,
    Calendar,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Popover,
    PopoverContent,
    PopoverTrigger,
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
    AlignLeft,
    CalendarDays,
    CheckSquare,
    ClipboardList,
    Cpu,
    Edit2,
    Eye,
    Gauge,
    Hash,
    Leaf,
    Package,
    Paperclip,
    Sparkles,
    Tag,
    Target,
    Timer,
    User,
    X,
} from 'lucide-react';
import { TASK_STATUSES, normalizeActionStatus, type ActionTask } from '../../../../../shared/action-task';
import { classifyTaskCode, taskCodeGroupOf, taskCodeTextOf } from '../../../../../shared/task-catalogue';
import { getPartnerDirectory, listTaskEvidence } from '@/services/eightd-service';
import { useValueHelp } from '@/hooks/use-value-help';
import { ValueHelpInput } from '@/components/ui/ValueHelpInput';
import { VALUE_HELP_IDS, type ValueHelpEntry } from '@/services/value-help-service';
import { TaskEvidenceSection } from './task-evidence';

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

const STATUS_TONE: Record<string, string> = {
    'Planned': 'border-slate-300 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    'Open': 'border-sky-300 bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    'Done': 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
};

function StatusChip({ status }: { status: string }) {
    const norm = normalizeActionStatus(status);
    return (
        <span
            title={norm}
            className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[160px]',
                STATUS_TONE[norm] ?? STATUS_TONE['Planned'],
            )}
        >
            {norm}
        </span>
    );
}

/** Task được coi là đã publish nếu cờ published bật hoặc trạng thái không còn là Planned */
function isTaskPublished(task: ActionTask): boolean {
    if (typeof task.published === 'boolean') return task.published;
    const s = String(task.status || '').trim().toLowerCase();
    return s !== 'planned' && s !== 'not started' && s !== '';
}

/** Ô trống phải nói RÕ là chưa ai điền, không được để trắng như lỗi hiển thị. */
function Blank({ label }: { label: string }) {
    return <span className="italic text-muted-foreground/70">{label}</span>;
}

/** Ngày ISO hiển thị cho người đọc; chuỗi không phải ngày thì trả về rỗng. */
function formatDate(iso: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const parsed = new Date(`${iso}T00:00:00`);
    return Number.isNaN(parsed.getTime())
        ? ''
        : parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Ô chọn ngày với lịch Popover mở lên trên (dropdownPlacement='top'). */
function DatePickerField({
    id,
    value,
    onChange,
    dropdownPlacement = 'top',
}: {
    id?: string;
    value: string;
    onChange: (val: string) => void;
    dropdownPlacement?: 'top' | 'bottom';
}) {
    const [open, setOpen] = useState(false);

    const selectedDate = useMemo(() => {
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
        const d = new Date(`${value}T00:00:00`);
        return Number.isNaN(d.getTime()) ? undefined : d;
    }, [value]);

    const handleSelect = (date: Date | undefined) => {
        if (date) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            onChange(`${y}-${m}-${d}`);
        } else {
            onChange('');
        }
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    id={id}
                    type="button"
                    className="flex h-9 w-full items-center justify-between rounded-md border-2 border-[var(--input-border)] hover:border-[var(--input-border-hover)] focus-visible:border-[var(--color-brand)] outline-none bg-background px-3 py-1.5 text-sm text-foreground text-left transition-[color,box-shadow,border-color] cursor-pointer"
                >
                    <span className={cn('truncate', !value && 'text-muted-foreground')}>
                        {value ? formatDate(value) || value : 'YYYY-MM-DD'}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                        {value && (
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange('');
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.stopPropagation();
                                        onChange('');
                                    }
                                }}
                                className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
                                title="Clear date"
                            >
                                <X className="h-3.5 w-3.5" />
                            </span>
                        )}
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent
                side={dropdownPlacement}
                align="start"
                className="w-auto p-2 bg-popover border border-border shadow-md z-50"
            >
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleSelect}
                />
            </PopoverContent>
        </Popover>
    );
}

/** Mã nhiệm vụ ở dạng chip, kèm mô tả trong tooltip để bảng không phải rộng thêm. */
function TaskCodeChip({ code }: { code: string }) {
    if (!code) return <Blank label="—" />;
    const text = taskCodeTextOf(code);
    return (
        <span
            title={text ? `${code} — ${text}` : code}
            className="inline-flex items-center rounded border border-border/70 bg-muted/50 px-2 py-0.5 font-mono text-sm font-medium text-foreground"
        >
            {code}
        </span>
    );
}

/** Huy hiệu Root Cause lấy từ D4 với màu sắc 6M Ishikawa tương ứng. */
function RootCauseChip({ category }: { category?: string | null }) {
    const raw = String(category ?? '').trim();
    if (!raw || raw === '—') {
        return <span className="text-muted-foreground font-mono text-sm">—</span>;
    }
    const cat = raw.toLowerCase();
    const isMan = cat === 'man';
    const isMachine = cat === 'machine';
    const isMethod = cat === 'method';
    const isMaterial = cat === 'material';
    const isMeasurement = cat === 'measurement';
    const isEnvironment = cat === 'environment';

    const Icon =
        isMan ? User :
        isMachine ? Cpu :
        isMethod ? ClipboardList :
        isMaterial ? Package :
        isMeasurement ? Gauge :
        isEnvironment ? Leaf : Sparkles;

    const toneClass =
        isMan ? 'border-pink-200 bg-pink-50/70 text-pink-700 dark:border-pink-850 dark:bg-pink-950/40 dark:text-pink-300' :
        isMachine ? 'border-blue-200 bg-blue-50/70 text-blue-700 dark:border-blue-850 dark:bg-blue-950/40 dark:text-blue-300' :
        isMethod ? 'border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-850 dark:bg-amber-950/40 dark:text-amber-300' :
        isMaterial ? 'border-orange-200 bg-orange-50/70 text-orange-700 dark:border-orange-850 dark:bg-orange-950/40 dark:text-orange-300' :
        isMeasurement ? 'border-cyan-200 bg-cyan-50/70 text-cyan-700 dark:border-cyan-850 dark:bg-cyan-950/40 dark:text-cyan-300' :
        isEnvironment ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700 dark:border-emerald-850 dark:bg-emerald-950/40 dark:text-emerald-300' :
        'border-primary/20 bg-primary/10 text-primary';

    const displayTitle = raw.charAt(0).toUpperCase() + raw.slice(1);

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-sm font-semibold border font-mono tracking-tight',
                toneClass,
            )}
            title={`Root Cause from D4: ${displayTitle}`}
        >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{displayTitle}</span>
        </span>
    );
}

/**
 * Ô chọn mã nhiệm vụ, dùng chung cho form Add và ô Edit.
 *
 * ── Vì sao đi qua `ValueHelpInput` chứ không phải một `Select` đọc thẳng
 * `TASK_CODES` ──
 * Đọc thẳng hằng số thì gọn hơn và không cần mạng. Nhưng danh mục nhiệm vụ là
 * danh mục SAP (catalog type 2) y như danh mục lỗi (type 9) — ngày nối S/4, cả
 * hai phải đổi nguồn bằng cách sửa `sourceType` của MỘT DÒNG trong
 * `ValueHelpList`, không phải bằng cách sửa component. Một trong hai ô đi đường
 * riêng là đúng cái chỗ ngày đó sẽ bị bỏ quên.
 *
 * ── Vì sao KHÔNG `strict` ──
 * Ô mã lỗi khoá cứng vì nó là khoá chấm điểm tiền lệ: sai mã là mất điểm âm
 * thầm. Mã nhiệm vụ thì không chấm điểm — nó phục vụ tra cứu. Chặn lưu một việc
 * chỉ vì bộ luật chưa có mã cho nó là đổi một bản ghi thiếu mã lấy một việc
 * không được giao cho ai. Ô trống nói đúng sự thật: chưa mã hoá được.
 *
 * ── Vì sao nhóm là ô đọc-only ──
 * Cùng lý do với nhóm mã lỗi: một mã chỉ thuộc đúng một nhóm. Cho sửa nhóm là mở
 * đường cho một cặp nhóm/mã không tồn tại trong danh mục.
 */
function TaskCodeField({
    code,
    onCodeChange,
    suggestedFrom,
    idPrefix,
}: {
    code: string;
    onCodeChange: (code: string) => void;
    /** Tên task đang gõ — dùng để gợi ý mã khi ô còn trống. */
    suggestedFrom: string;
    idPrefix: string;
}) {
    const taskCodeVh = useValueHelp(VALUE_HELP_IDS.taskCode);
    const suggestion = code ? null : classifyTaskCode(suggestedFrom)?.taskCode ?? null;
    // Nhóm suy từ mã bằng đúng hàm mà `normalizeTasks` dùng, nên thứ hiện trên
    // màn hình và thứ được lưu xuống không thể lệch nhau.
    const group = taskCodeGroupOf(code) ?? '';

    return (
        <>
            <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-task-code`} className="text-sm font-semibold text-muted-foreground">
                    Task Code
                </Label>
                <ValueHelpInput
                    id={`${idPrefix}-task-code`}
                    value={code}
                    onChange={onCodeChange}
                    entries={taskCodeVh.entries}
                    loading={taskCodeVh.loading}
                    quiet
                    dropdownPlacement="top"
                    catalogLabel="the task catalogue"
                    placeholder="e.g. TSK-1010"
                    inputClassName="text-sm"
                />
                {suggestion && (
                    <button
                        type="button"
                        onClick={() => onCodeChange(suggestion)}
                        className="flex items-start gap-1 text-left text-sm leading-snug text-primary hover:underline cursor-pointer"
                    >
                        <Sparkles className="mt-px h-3.5 w-3.5 shrink-0" />
                        <span>Suggested from the task name: {suggestion} — {taskCodeTextOf(suggestion)}</span>
                    </button>
                )}
            </div>
            <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-muted-foreground">Code Group</Label>
                <Input
                    value={group}
                    readOnly
                    placeholder="— from Task Code —"
                    className="h-9 text-sm bg-muted/40 font-mono"
                />
            </div>
        </>
    );
}

function usePartnerValueHelp() {
    const { data: partners = [], isLoading } = useQuery({
        queryKey: ['partnerDirectory'],
        queryFn: getPartnerDirectory,
        staleTime: 5 * 60 * 1000,
    });

    const entries: ValueHelpEntry[] = useMemo(() => {
        return partners.map((p) => {
            const cleanId = p.partnerId.replace(/^BP-/i, '');
            const titlePart = p.functionTitle ? ` (${p.functionTitle})` : '';
            return {
                key: `${cleanId} — ${p.partnerName}${titlePart}`,
                text: p.email || p.functionTitle || '',
                partnerId: cleanId,
                partnerName: p.partnerName,
                functionTitle: p.functionTitle,
            };
        });
    }, [partners]);

    return { entries, loading: isLoading };
}

function TaskDetail({
    task,
    initialEditing = false,
    readOnly = false,
    reportID = '',
    disciplineCode = '',
    rootCause = '',
    overrideActionDiscipline = false,
    onClose,
    onSave,
}: {
    task: ActionTask | null;
    initialEditing?: boolean;
    readOnly?: boolean;
    reportID?: string;
    disciplineCode?: string;
    rootCause?: string;
    /** When true, forces D3/D7 operational behaviour (Publish, Evidence, Notes)
     *  regardless of disciplineCode. Used when TaskDetail is embedded inside D6. */
    overrideActionDiscipline?: boolean;
    onClose: () => void;
    onSave: (updatedTask: ActionTask) => void;
}) {
    // D5 operational features are managed in D6. When overrideActionDiscipline=true
    // (D6 embedding), unlock full D3/D7 flow: Publish button, Evidence, Notes.
    const isD3orD7 = overrideActionDiscipline || disciplineCode === 'D3' || disciplineCode === 'D7';
    const partnerVh = usePartnerValueHelp();
    const [isEditing, setIsEditing] = useState(initialEditing);
    const [name, setName] = useState(task?.name ?? '');
    const [assignee, setAssignee] = useState(task?.assignee ?? '');
    const [durationDays, setDurationDays] = useState<number | string>(task?.durationDays ? String(task.durationDays) : '');
    const [status, setStatus] = useState(task?.status || 'Planned');
    const [description, setDescription] = useState(task?.description ?? '');
    const [taskCode, setTaskCode] = useState(task?.taskCode ?? '');
    const [plannedEndDate, setPlannedEndDate] = useState(task?.plannedEndDate ?? '');
    const [startDate, setStartDate] = useState(task?.startDate ?? '');
    const [note, setNote] = useState(task?.note ?? '');

    useEffect(() => {
        if (!task) return;
        setName(task.name);
        setAssignee(task.assignee);
        setDurationDays(task.durationDays ? String(task.durationDays) : '');
        setStatus(task.status || 'Planned');
        setDescription(task.description);
        setTaskCode(task.taskCode);
        setStartDate(task.startDate ?? '');
        setPlannedEndDate(task.plannedEndDate);
        setNote(task.note ?? '');
    }, [task]);

    useEffect(() => {
        setIsEditing(initialEditing);
    }, [task?.id, initialEditing]);

    if (!task) return null;

    const handleClose = () => {
        if (isD3orD7 && !isEditing && note !== (task.note ?? '')) {
            const isEvidenceReq = task.evidenceRequired ?? true;
            const shouldMarkDone = !isEvidenceReq && task.status === 'Open' && note.trim().length > 0;
            const nextStatus = shouldMarkDone ? 'Done' : task.status;
            onSave({
                ...task,
                note: note.trim(),
                status: nextStatus,
            });
        }
        onClose();
    };

    const handleSave = () => {
        const code = taskCode.trim().toUpperCase();
        onSave({
            ...task,
            name: name.trim() || task.name,
            assignee: assignee.trim(),
            durationDays: Math.max(0, Number(durationDays) || 0),
            status: isD3orD7 ? (task.status || 'Planned') : status,
            description: description.trim(),
            taskCode: code,
            taskCodeGroup: taskCodeGroupOf(code) ?? '',
            startDate: startDate || undefined,
            plannedEndDate,
            note: note.trim(),
            published: task.published,
            evidenceRequired: task.evidenceRequired,
        });
        setIsEditing(false);
        if (isD3orD7) {
            onClose();
        }
    };

    const handlePublish = () => {
        const code = taskCode.trim().toUpperCase();
        onSave({
            ...task,
            name: name.trim() || task.name,
            assignee: assignee.trim(),
            durationDays: Math.max(0, Number(durationDays) || 0),
            status: 'Open',
            published: true,
            description: description.trim(),
            taskCode: code,
            taskCodeGroup: taskCodeGroupOf(code) ?? '',
            startDate: startDate || undefined,
            plannedEndDate,
            note: note.trim(),
            evidenceRequired: task.evidenceRequired ?? true,
        });
        setIsEditing(false);
        onClose();
    };

    const handleSaveNote = () => {
        const isEvidenceReq = task.evidenceRequired ?? true;
        const shouldMarkDone = !isEvidenceReq && task.status === 'Open' && note.trim().length > 0;
        const nextStatus = shouldMarkDone ? 'Done' : task.status;
        onSave({
            ...task,
            note: note.trim(),
            status: nextStatus,
        });
    };

    return (
        <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
            <DialogContent className="w-[calc(100%-2rem)] sm:max-w-3xl md:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="space-y-2 border-b pb-3">
                    <div className="flex items-center justify-between gap-2 pr-6">
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <CheckSquare className="h-4 w-4" />
                            </span>
                            <div>
                                <DialogTitle className="text-base font-semibold">
                                    {isEditing ? 'Edit Task Details' : 'Task Details'}
                                </DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground">
                                    {isEditing
                                        ? 'Update task assignment, schedule, and scope'
                                        : 'View detailed task instructions and assignment status'}
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {task.origin === 'AI suggestion' ? (
                                <Badge variant="outline" className="gap-1 text-sm font-normal border-primary/30 text-primary bg-primary/5 px-2.5 py-0.5">
                                    <Sparkles className="h-3.5 w-3.5" /> AI Suggestion
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="gap-1 text-sm font-normal text-muted-foreground px-2.5 py-0.5">
                                    <User className="h-3.5 w-3.5" /> User Added
                                </Badge>
                            )}
                            <StatusChip status={isEditing ? (isD3orD7 ? (task.status || 'Planned') : status) : task.status} />
                        </div>
                    </div>
                </DialogHeader>

                {isEditing ? (
                    <div className="space-y-4 pt-2">
                        {/* Task Name */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-muted-foreground">
                                Task Name <span className="text-destructive">*</span>
                            </Label>
                            <Textarea
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                rows={2}
                                className="text-sm font-normal leading-relaxed bg-background min-h-[56px] resize-y"
                                placeholder="Task name..."
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-muted-foreground">
                                Description & Instructions
                            </Label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className="text-sm leading-relaxed bg-background min-h-[80px]"
                                placeholder="Detailed instructions, scope of work, or criteria..."
                            />
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                            <div className="space-y-1.5 sm:col-span-6">
                                <Label className="text-sm font-semibold text-muted-foreground">
                                    Assignee
                                </Label>
                                <ValueHelpInput
                                    value={assignee}
                                    onChange={setAssignee}
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
                                    value={durationDays}
                                    onChange={(e) => setDurationDays(e.target.value)}
                                    className="h-9 text-sm bg-background"
                                />
                            </div>
                            {isD3orD7 ? (
                                <div className="space-y-1.5 sm:col-span-4">
                                    <Label className="text-sm font-semibold text-muted-foreground">
                                        Status
                                    </Label>
                                    <div className="flex items-center h-9">
                                        <StatusChip status={task.status || 'Planned'} />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-1.5 sm:col-span-4">
                                    <Label className="text-sm font-semibold text-muted-foreground">
                                        Status
                                    </Label>
                                    <Select value={status} onValueChange={setStatus}>
                                        <SelectTrigger className="h-9 text-sm bg-background w-full">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent side="top">
                                            {TASK_STATUSES.map((st) => (
                                                <SelectItem key={st} value={st} className="text-sm">{st}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {/* Quality Task coding / Root Cause */}
                        {disciplineCode === 'D5' ? (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-semibold text-muted-foreground">
                                        Root Cause (from D4)
                                    </Label>
                                    <div className="flex items-center h-9">
                                        <RootCauseChip category={(task as any)?.rootCause || rootCause} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor={`task-detail-${task.id}-start`} className="text-sm font-semibold text-muted-foreground">
                                        Start Date
                                    </Label>
                                    <DatePickerField
                                        id={`task-detail-${task.id}-start`}
                                        value={startDate}
                                        onChange={setStartDate}
                                        dropdownPlacement="top"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor={`task-detail-${task.id}-due`} className="text-sm font-semibold text-muted-foreground">
                                        Planned End Date
                                    </Label>
                                    <DatePickerField
                                        id={`task-detail-${task.id}-due`}
                                        value={plannedEndDate}
                                        onChange={setPlannedEndDate}
                                        dropdownPlacement="top"
                                    />
                                </div>
                            </div>
                        ) : (disciplineCode === 'D3' || disciplineCode === 'D7') ? (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor={`task-detail-${task.id}-start`} className="text-sm font-semibold text-muted-foreground">
                                        Start Date
                                    </Label>
                                    <DatePickerField
                                        id={`task-detail-${task.id}-start`}
                                        value={startDate}
                                        onChange={setStartDate}
                                        dropdownPlacement="top"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor={`task-detail-${task.id}-due`} className="text-sm font-semibold text-muted-foreground">
                                        Planned End Date
                                    </Label>
                                    <DatePickerField
                                        id={`task-detail-${task.id}-due`}
                                        value={plannedEndDate}
                                        onChange={setPlannedEndDate}
                                        dropdownPlacement="top"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                                <TaskCodeField
                                    code={taskCode}
                                    onCodeChange={setTaskCode}
                                    suggestedFrom={name}
                                    idPrefix={`task-detail-${task.id}`}
                                />
                                <div className="space-y-1.5">
                                    <Label htmlFor={`task-detail-${task.id}-start`} className="text-sm font-semibold text-muted-foreground">
                                        Start Date
                                    </Label>
                                    <DatePickerField
                                        id={`task-detail-${task.id}-start`}
                                        value={startDate}
                                        onChange={setStartDate}
                                        dropdownPlacement="top"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor={`task-detail-${task.id}-due`} className="text-sm font-semibold text-muted-foreground">
                                        Planned End Date
                                    </Label>
                                    <DatePickerField
                                        id={`task-detail-${task.id}-due`}
                                        value={plannedEndDate}
                                        onChange={setPlannedEndDate}
                                        dropdownPlacement="top"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-3 border-t">
                            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-9 text-sm px-3">
                                Cancel
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleSave} disabled={!name.trim()} className="h-9 text-sm px-3">
                                Save changes
                            </Button>
                            {isD3orD7 && !task.published && (
                                <Button
                                    size="sm"
                                    variant="default"
                                    onClick={handlePublish}
                                    disabled={!name.trim()}
                                    className="h-9 text-sm px-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                                >
                                    Publish
                                </Button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 pt-2">
                        {/* Task Title Box */}
                        <div className="rounded-lg border bg-card p-3.5 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                                <Target className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                <span>Task Statement</span>
                            </div>
                            <p className="text-sm font-normal leading-relaxed text-foreground break-words">
                                {task.name}
                            </p>
                        </div>

                        {/* Attribute Cards Grid */}
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                            <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                                    <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    <span>Assignee</span>
                                </div>
                                <div className="text-sm font-normal text-foreground truncate">
                                    {task.assignee || <Blank label="Unassigned" />}
                                </div>
                            </div>

                            <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                                    <Timer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                    <span>Duration</span>
                                </div>
                                <div className="text-sm font-normal text-foreground">
                                    {task.durationDays > 0 ? `${task.durationDays} day${task.durationDays > 1 ? 's' : ''}` : <Blank label="Not estimated" />}
                                </div>
                            </div>

                            <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                                    <Tag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                    <span>Status</span>
                                </div>
                                <div>
                                    <StatusChip status={task.status} />
                                </div>
                            </div>

                            {/* Task Code / Root Cause */}
                            {disciplineCode === 'D5' ? (
                                <div className="rounded-lg border bg-muted/20 p-3 space-y-1 sm:col-span-1">
                                    <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                                        <Sparkles className="h-4 w-4 text-primary" />
                                        <span>Root Cause</span>
                                    </div>
                                    <div className="pt-0.5">
                                        <RootCauseChip category={(task as any)?.rootCause || rootCause} />
                                    </div>
                                </div>
                            ) : (disciplineCode === 'D3' || disciplineCode === 'D7') ? null : (
                                <div className="rounded-lg border bg-muted/20 p-3 space-y-1 sm:col-span-1">
                                    <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                                        <Hash className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                        <span>Task Code</span>
                                    </div>
                                    {task.taskCode ? (
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <TaskCodeChip code={task.taskCode} />
                                                {task.taskCodeGroup && (
                                                    <span className="font-mono text-sm text-muted-foreground">
                                                        {task.taskCodeGroup}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm font-normal leading-snug text-muted-foreground">
                                                {taskCodeTextOf(task.taskCode) ?? 'Not in the task catalogue.'}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-sm font-normal">
                                            <Blank label="Not coded" />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Start Date */}
                            <div className={cn(
                                'rounded-lg border bg-muted/20 p-3 space-y-1',
                                (disciplineCode === 'D3' || disciplineCode === 'D7') ? 'sm:col-span-1' : 'sm:col-span-1',
                            )}>
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                                    <CalendarDays className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                                    <span>Start Date</span>
                                </div>
                                <div className="text-sm font-normal text-foreground">
                                    {formatDate(task.startDate ?? '') || <Blank label="No start date" />}
                                </div>
                            </div>

                            {/* Planned End Date */}
                            <div className={cn(
                                'rounded-lg border bg-muted/20 p-3 space-y-1',
                                (disciplineCode === 'D3' || disciplineCode === 'D7') ? 'sm:col-span-2' : 'sm:col-span-1',
                            )}>
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                                    <CalendarDays className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                    <span>Planned End Date</span>
                                </div>
                                <div className="text-sm font-normal text-foreground">
                                    {formatDate(task.plannedEndDate) || <Blank label="No date committed" />}
                                </div>
                            </div>
                        </div>

                        {/* Description Section */}
                        <div className="rounded-lg border bg-muted/10 p-3.5 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                                <AlignLeft className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                                <span>Description & Instructions</span>
                            </div>
                            <div className="text-sm font-normal leading-relaxed text-foreground whitespace-pre-wrap break-words">
                                {task.description ? (
                                    task.description
                                ) : (
                                    <span className="italic text-muted-foreground">No description or instructions recorded.</span>
                                )}
                            </div>
                        </div>

                        {/* Execution Notes Section (D3 & D7) */}
                        {isD3orD7 && (
                            <div className="rounded-lg border bg-card p-3.5 space-y-2 border-border/80">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                        <ClipboardList className="h-4 w-4 text-primary" />
                                        <span>Execution Notes & Remarks</span>
                                    </div>
                                    {!readOnly && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleSaveNote}
                                            className="h-7 text-xs px-2.5 font-medium cursor-pointer"
                                        >
                                            Save Note
                                        </Button>
                                    )}
                                </div>
                                <Textarea
                                    value={note}
                                    disabled={readOnly}
                                    onChange={(e) => setNote(e.target.value)}
                                    onBlur={() => {
                                        if (note !== (task.note ?? '')) {
                                            handleSaveNote();
                                        }
                                    }}
                                    rows={3}
                                    className="text-sm leading-relaxed bg-background min-h-[70px] resize-y"
                                    placeholder="Enter execution details, findings, or notes..."
                                />
                                {!(task.evidenceRequired ?? true) && task.status === 'Open' && (
                                    <p className="text-xs text-muted-foreground italic">
                                        Evidence document is optional for this task. Saving an execution note will mark this task as Done.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Completion Evidence Section */}
                        {reportID && disciplineCode && (
                            <div className="space-y-2">
                                {isD3orD7 && (
                                    <div className={cn(
                                        'p-2.5 rounded-lg border text-sm',
                                        task.status === 'Done'
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
                                            : (task.evidenceRequired ?? true)
                                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200'
                                                : 'bg-muted/40 border-border/70 text-muted-foreground'
                                    )}>
                                        {task.status === 'Done' ? (
                                            <span>
                                                <strong>Status: Done.</strong> Completion criteria satisfied. You may still upload additional evidence or update remarks.
                                            </span>
                                        ) : (task.evidenceRequired ?? true) ? (
                                            <span>
                                                <strong>Evidence Requirement:</strong> Upload at least one completion document below to mark this task as <strong>Done</strong>.
                                            </span>
                                        ) : (
                                            <span>
                                                <strong>Evidence Optional:</strong> Document upload is optional. Adding an execution note above or uploading a document will mark this task as <strong>Done</strong>.
                                            </span>
                                        )}
                                    </div>
                                )}
                                <TaskEvidenceSection
                                    reportID={reportID}
                                    disciplineCode={disciplineCode}
                                    task={task}
                                    readOnly={readOnly}
                                    onEvidenceUploaded={() => {
                                        const s = String(task.status || '').trim().toLowerCase();
                                        if (isD3orD7 && s === 'open') {
                                            onSave({
                                                ...task,
                                                status: 'Done',
                                            });
                                        }
                                    }}
                                />
                            </div>
                        )}

                        {/* Attachments Section */}
                        {task.attachments && task.attachments.length > 0 && (
                            <div className="space-y-1.5">
                                <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                    Attachments ({task.attachments.length})
                                </div>
                                <ul className="flex flex-wrap gap-2">
                                    {task.attachments.map((file) => (
                                        <li
                                            key={file.name}
                                            className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-sm"
                                        >
                                            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="font-medium text-foreground">{file.kind}</span>
                                            <span className="text-muted-foreground">{file.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t">
                            {!readOnly && (!isD3orD7 || !isTaskPublished(task)) && (
                                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="h-9 text-sm gap-1.5 px-3">
                                    <Edit2 className="h-3.5 w-3.5" /> Edit Task
                                </Button>
                            )}
                            <Button size="sm" variant="default" onClick={handleClose} className="h-9 text-sm px-3">
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

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
                                        {task.durationDays > 0 ? `${task.durationDays}d` : <Blank label="—" />}
                                    </td>
                                    <td className="border-b px-2.5 py-2 align-middle whitespace-nowrap">
                                        <StatusChip status={task.status} />
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
                                                    <span className="text-muted-foreground">—</span>
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
                                    <StatusChip status="Planned" />
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
                <TaskDetail
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



