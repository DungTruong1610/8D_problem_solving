import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Textarea,
    cn,
} from '@cnma/react-ui';
import {
    AlertTriangle,
    Check,
    ClipboardList,
    Cpu,
    Edit3,
    Gauge,
    Leaf,
    Loader2,
    Package,
    RefreshCw,
    Sparkles,
    Star,
    Trash2,
    User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { reanalyzeDownstream, saveDisciplineField } from '@/services/eightd-service';
import { TaskTable } from './action-table';
import {
    actionLabel,
    assignedFieldFor,
    isAccepted,
    mergeTasks,
    normalizeTasks,
    taskFromAction,
    type ActionTask,
} from '../../../../../shared/action-task';
import { ComparativeDiagnosisBadge } from './comparative-diagnosis-badge';
import { AiProvenanceInfo } from './ai-provenance-info';

const DEFAULT_DURATION_BY_DISCIPLINE: Record<string, number> = {
    D3: 1,
    D5: 2,
    D7: 3,
};

/**
 * Các widget cho D4 (Root Cause) và các bước hành động (D3, D5, D6, D7).
 *
 * Triết lý widget độc lập: mỗi khối trên Form Editor là một field độc lập,
 * không widget nào phụ thuộc vào tên bước D hay số bước cố định.
 */

// ── 5-Why Chain ─────────────────────────────────────────────────────────────

interface WhyStep {
    stepNo?: number;
    step?: number;
    why?: string;
    question?: string;
    answer?: string;
    isRootCause?: boolean;
    isRoot?: boolean;
}

function truthy(val: unknown): boolean {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return /^(true|yes|1|x)$/i.test(val.trim());
    return false;
}

function stepNumber(row: WhyStep, index: number): number {
    return Number(row.stepNo ?? row.step ?? index + 1);
}

/**
 * Buoc nao la ket luan goc.
 *
 * Uu tien co `isRootCause` neu du lieu co. Khong co thi coi buoc CUOI la goc —
 * dung quy uoc cua ban mockup. Doan mo ta cung chap nhan chu "(root cause)" viet
 * thang trong cau hoi, vi Golden Dataset danh dau kieu do.
 */
function isRootStep(row: WhyStep, index: number, total: number): boolean {
    if (typeof row.isRootCause === 'boolean') return row.isRootCause;
    if (typeof row.isRoot === 'boolean') return row.isRoot;
    if (/\(root cause\)/i.test(String(row.question ?? row.why ?? ''))) return true;
    return index === total - 1;
}

export function WhyChainWidget({ value, disciplineID, fieldKey, readOnly = false }: {
    value: unknown;
    disciplineID?: string;
    fieldKey?: string;
    readOnly?: boolean;
}) {
    const initialRows: WhyStep[] = Array.isArray(value) ? (value as WhyStep[]) : [];
    const [steps, setSteps] = useState<WhyStep[]>(initialRows);
    const [isAdding, setIsAdding] = useState(false);
    const [newQuestion, setNewQuestion] = useState('');
    const [newAnswer, setNewAnswer] = useState('');

    const initialRootIndex = steps.findIndex((row, idx) => isRootStep(row, idx, steps.length));
    const [selectedRootIndex, setSelectedRootIndex] = useState<number | null>(
        initialRootIndex >= 0 ? initialRootIndex : (steps.length ? steps.length - 1 : null),
    );

    useEffect(() => {
        const rows: WhyStep[] = Array.isArray(value) ? (value as WhyStep[]) : [];
        setSteps(rows);
        const rootIdx = rows.findIndex((row, idx) => isRootStep(row, idx, rows.length));
        setSelectedRootIndex(rootIdx >= 0 ? rootIdx : (rows.length ? rows.length - 1 : null));
    }, [value]);

    const handleAddStep = () => {
        if (!newQuestion.trim()) return;
        const newStep: WhyStep = {
            stepNo: steps.length + 1,
            question: newQuestion.trim(),
            answer: newAnswer.trim() || 'Pending verification',
        };
        const nextSteps = [...steps, newStep];
        setSteps(nextSteps);
        setNewQuestion('');
        setNewAnswer('');
        setIsAdding(false);

        if (disciplineID) {
            saveDisciplineField(disciplineID, fieldKey || 'whyChain', nextSteps)
                .then(() => toast.success('Why-step saved to server.'))
                .catch((err) => toast.error(`Failed to save step: ${err.message}`));
        }
    };

    const handleSetRoot = (index: number) => {
        setSelectedRootIndex(index);
        const nextSteps = steps.map((s, i) => ({ ...s, isRootCause: i === index }));
        setSteps(nextSteps);
        if (disciplineID) {
            saveDisciplineField(disciplineID, fieldKey || 'whyChain', nextSteps)
                .then(() => toast.success('Root cause step updated.'))
                .catch((err) => toast.error(`Failed to save: ${err.message}`));
        }
    };

    const handleRemoveStep = (index: number) => {
        const nextSteps = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepNo: i + 1 }));
        setSteps(nextSteps);
        if (disciplineID) {
            saveDisciplineField(disciplineID, fieldKey || 'whyChain', nextSteps)
                .then(() => toast.success('Step removed.'))
                .catch((err) => toast.error(`Failed to save: ${err.message}`));
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-base font-bold text-foreground">
                    5-Why chain
                </span>
            </div>

            {steps.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">
                    No 5-Why chain recorded for this case yet.
                </p>
            ) : (
                <div className="space-y-2.5">
                    {steps.map((row, index) => {
                        const isRoot = selectedRootIndex === index;
                        return (
                            <div
                                key={index}
                                className={cn(
                                    'group relative flex min-w-0 items-start justify-between gap-3 rounded-lg border p-3.5 transition-colors',
                                    isRoot
                                        ? 'border-destructive/40 bg-destructive/[0.03] shadow-xs'
                                        : 'border-border bg-card hover:border-border/80',
                                )}
                            >
                                <div className="flex gap-3 min-w-0 flex-1">
                                    <span
                                        className={cn(
                                            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                                            isRoot
                                                ? 'bg-destructive text-destructive-foreground ring-2 ring-destructive/20'
                                                : 'bg-muted text-muted-foreground group-hover:bg-foreground group-hover:text-background',
                                        )}
                                    >
                                        {stepNumber(row, index)}
                                    </span>
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="break-words text-sm font-semibold text-foreground">
                                                {row.question ?? row.why ?? '—'}
                                            </p>
                                            {isRoot && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-sm font-bold uppercase tracking-wider text-destructive border border-destructive/20">
                                                    <Star className="h-3.5 w-3.5 fill-current" />
                                                    Root cause
                                                </span>
                                            )}
                                        </div>
                                        <p className="break-words text-sm text-muted-foreground leading-relaxed">
                                            {row.answer ?? '—'}
                                        </p>
                                    </div>
                                </div>

                                {!readOnly && (
                                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                                        {!isRoot && (
                                            <button
                                                type="button"
                                                onClick={() => handleSetRoot(index)}
                                                className="text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md px-2.5 py-1 border border-transparent hover:border-destructive/20 cursor-pointer flex items-center gap-1.5"
                                                title="Mark this step as root cause"
                                            >
                                                <Star className="h-3.5 w-3.5" />
                                                Set root cause
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveStep(index)}
                                            className="text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md p-1 border border-transparent hover:border-destructive/20 cursor-pointer"
                                            title="Delete step"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {!readOnly && (
                isAdding ? (
                    <div className="rounded-lg border bg-muted/20 p-3.5 space-y-3">
                        <p className="text-base font-semibold text-foreground">Add 5-Why Step</p>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-muted-foreground">
                                Question <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                type="text"
                                placeholder="Why did this happen? (e.g. Why did the clamp slip?)"
                                value={newQuestion}
                                onChange={(e) => setNewQuestion(e.target.value)}
                                className="h-9 text-sm bg-background"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-muted-foreground">
                                Answer / Finding
                            </Label>
                            <Input
                                type="text"
                                placeholder="Enter finding or verification result..."
                                value={newAnswer}
                                onChange={(e) => setNewAnswer(e.target.value)}
                                className="h-9 text-sm bg-background"
                            />
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <Button size="sm" onClick={handleAddStep} disabled={!newQuestion.trim()} className="h-9 text-sm px-3">
                                Add step
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="h-9 text-sm px-3">
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button size="sm" variant="outline" onClick={() => setIsAdding(true)} className="h-9 text-sm px-3">
                        + Add why-step
                    </Button>
                )
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   D4 — Luoi Ishikawa 6M
   ───────────────────────────────────────────────────────────────────────── */

/** Thu tu 6M co dinh — doc theo hang quen thuoc, khong theo thu tu du lieu tra ve. */
const SIX_M = ['Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment'] as const;

function getSixMMeta(category: string): { icon: any; colorClass: string; bgClass: string; title: string } {
    const cat = category.toLowerCase().trim();
    if (cat === 'man') {
        return { icon: User, colorClass: 'text-pink-600 dark:text-pink-400', bgClass: 'bg-pink-500/10', title: 'MAN' };
    }
    if (cat === 'machine') {
        return { icon: Cpu, colorClass: 'text-blue-600 dark:text-blue-400', bgClass: 'bg-blue-500/10', title: 'MACHINE' };
    }
    if (cat === 'method') {
        return { icon: ClipboardList, colorClass: 'text-amber-600 dark:text-amber-400', bgClass: 'bg-amber-500/10', title: 'METHOD' };
    }
    if (cat === 'material') {
        return { icon: Package, colorClass: 'text-orange-600 dark:text-orange-400', bgClass: 'bg-orange-500/10', title: 'MATERIAL' };
    }
    if (cat === 'measurement') {
        return { icon: Gauge, colorClass: 'text-cyan-600 dark:text-cyan-400', bgClass: 'bg-cyan-500/10', title: 'MEASUREMENT' };
    }
    if (cat === 'environment') {
        return { icon: Leaf, colorClass: 'text-emerald-600 dark:text-emerald-400', bgClass: 'bg-emerald-500/10', title: 'ENVIRONMENT' };
    }
    return { icon: Sparkles, colorClass: 'text-muted-foreground', bgClass: 'bg-muted', title: category.toUpperCase() };
}

interface CauseRow {
    category?: string;
    description?: string;
    finding?: string;
    metricValue?: string;
    metric?: string;
    isRootCause?: boolean | string;
    source?: string;
}

/**
 * Sáu nhánh Ishikawa, nhánh được chọn tô đỏ.
 */
export function IshikawaGridWidget({
    context,
    proposed,
    disciplineID,
    savedFindings,
    savedRootCategory,
    readOnly = false,
}: {
    context: unknown;
    proposed?: unknown;
    disciplineID?: string;
    savedFindings?: unknown;
    savedRootCategory?: unknown;
    readOnly?: boolean;
}) {
    const root = context && typeof context === 'object' ? (context as Record<string, unknown>) : null;
    const recorded: CauseRow[] = Array.isArray(root?.ishikawa) ? (root.ishikawa as CauseRow[]) : [];
    const suggested: CauseRow[] = Array.isArray(proposed)
        ? (proposed as CauseRow[]).filter((r) => String(r?.finding ?? r?.description ?? '').trim())
        : [];

    const usingProposal = recorded.length === 0 && suggested.length > 0;
    const rows: CauseRow[] = recorded.length ? recorded : suggested;

    const byCategory = new Map(
        rows.map((r) => [String(r.category ?? '').trim().toLowerCase(), r]),
    );

    const initialRoot = SIX_M.find((cat) => {
        const row = byCategory.get(cat.toLowerCase());
        return row ? truthy(row.isRootCause) : false;
    });

    const parsedSavedFindings = (savedFindings && typeof savedFindings === 'object' && !Array.isArray(savedFindings))
        ? (savedFindings as Record<string, string>)
        : {};
    const parsedSavedRoot = typeof savedRootCategory === 'string' && savedRootCategory.trim()
        ? savedRootCategory.trim()
        : null;

    const [selectedRootCategory, setSelectedRootCategory] = useState<string | null>(parsedSavedRoot ?? initialRoot ?? null);
    const [customFindings, setCustomFindings] = useState<Record<string, string>>(parsedSavedFindings);
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    useEffect(() => {
        if (savedFindings && typeof savedFindings === 'object' && !Array.isArray(savedFindings)) {
            setCustomFindings(savedFindings as Record<string, string>);
        }
        if (typeof savedRootCategory === 'string' && savedRootCategory.trim()) {
            setSelectedRootCategory(savedRootCategory.trim());
        }
    }, [savedFindings, savedRootCategory]);

    const startEditing = (cat: string, currentText: string) => {
        setEditingCategory(cat);
        setEditValue(currentText === 'Not assessed' ? '' : currentText);
    };

    const saveEditing = (cat: string) => {
        if (editValue.trim()) {
            const nextFindings = { ...customFindings, [cat]: editValue.trim() };
            setCustomFindings(nextFindings);
            if (disciplineID) {
                saveDisciplineField(disciplineID, 'ishikawaCustomFindings', nextFindings)
                    .then(() => toast.success(`Saved finding for ${cat}`))
                    .catch((err) => toast.error(`Failed to save: ${err.message}`));
            }
        }
        setEditingCategory(null);
    };

    const handleSelectRoot = (cat: string) => {
        setSelectedRootCategory(cat);
        if (disciplineID) {
            saveDisciplineField(disciplineID, 'selectedRootCategory', cat)
                .then(() => toast.success(`Marked ${cat} as root cause`))
                .catch((err) => toast.error(`Failed to save: ${err.message}`));
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-base font-bold text-foreground">
                    Ishikawa
                </span>
            </div>

            {usingProposal && (
                <p className="rounded-md border border-warning/40 bg-warning/[0.07] px-3 py-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-warning-foreground">Proposed by AI.</span>{' '}
                    This case has no recorded 6M assessment in system. The findings below are
                    the AI reading the evidence, not a confirmed assessment — review each
                    one before relying on it.
                </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SIX_M.map((category) => {
                const meta = getSixMMeta(category);
                const Icon = meta.icon;
                const row = byCategory.get(category.toLowerCase());
                const isRoot = selectedRootCategory
                    ? selectedRootCategory.toLowerCase() === category.toLowerCase()
                    : (row ? truthy(row.isRootCause) : false);
                const originalText = row?.description ?? row?.finding ?? '';
                const text = customFindings[category] ?? originalText;
                const metric = row?.metricValue ?? row?.metric;
                const isEditingThis = editingCategory === category;

                return (
                    <div
                        key={category}
                        className={cn(
                            'min-w-0 rounded-lg border p-3.5 flex flex-col justify-between',
                            isRoot ? 'border-destructive bg-destructive/[0.05]' : 'border-border bg-card',
                        )}
                    >
                        <div>
                            <div className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-bold', meta.bgClass, meta.colorClass)}>
                                        <Icon className="h-3.5 w-3.5" />
                                    </span>
                                    <h4 className="text-base font-bold uppercase tracking-wider text-foreground/90">{meta.title}</h4>
                                    <AiProvenanceInfo
                                        fieldKey={`ishikawa.${category}`}
                                        label={`Ishikawa ${meta.title}`}
                                        caseContext={root}
                                        customReasoning={
                                            text
                                                ? [
                                                    isRoot ? 'Assessment: Validated primary root cause branch.' : 'Assessment: Evaluated contributing factor.',
                                                    `Observed finding: "${text}"${metric ? ` (Metric: ${metric})` : ''}.`,
                                                ]
                                                : [
                                                    'Assessment: Not assessed (No findings).',
                                                    `Observation: Neither QM source telemetry nor AI root-cause investigation identified contributing factors under [${category}] for this defect.`,
                                                ]
                                        }
                                    />
                                </div>
                                {!isEditingThis && !readOnly && (
                                    <button
                                        type="button"
                                        onClick={() => startEditing(category, text || 'Not assessed')}
                                        className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                                    >
                                        Edit
                                    </button>
                                )}
                            </div>

                            {isEditingThis ? (
                                <div className="mt-2 space-y-2">
                                    <Textarea
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        placeholder="Enter finding for this 6M category..."
                                        className="w-full min-h-[90px] text-sm bg-background p-2.5 rounded-md border leading-relaxed resize-y focus-visible:ring-1 focus-visible:ring-primary"
                                        autoFocus
                                    />
                                    <div className="flex items-center justify-end gap-1.5 pt-0.5">
                                        <Button size="sm" className="h-8 text-sm px-3 font-medium" onClick={() => saveEditing(category)}>
                                            Save
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-8 text-sm px-2.5 font-medium" onClick={() => setEditingCategory(null)}>
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <p className={cn(
                                    'mt-1.5 break-words text-sm leading-relaxed',
                                    text ? 'text-foreground font-normal' : 'italic text-muted-foreground',
                                )}>
                                    {text || 'Not assessed'}
                                </p>
                            )}

                            {metric && !isEditingThis && (
                                <span className="mt-2 inline-block rounded-full border bg-muted px-2.5 py-0.5 text-sm font-medium">
                                    {metric}
                                </span>
                            )}
                        </div>

                        <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between">
                            {isRoot ? (
                                <div className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-destructive">
                                    <Star className="h-3.5 w-3.5 fill-current" />
                                    Root cause
                                </div>
                            ) : !readOnly ? (
                                <button
                                    type="button"
                                    onClick={() => handleSelectRoot(category)}
                                    className="text-sm font-medium text-primary hover:underline cursor-pointer"
                                >
                                    Set as root cause
                                </button>
                            ) : (
                                <span className="text-sm text-muted-foreground italic">Non-root factor</span>
                            )}
                        </div>
                    </div>
                );
            })}
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   D3 — The action
   ───────────────────────────────────────────────────────────────────────── */

export interface ActionRow {
    action?: string;
    actionText?: string;
    owner?: string;
    assignee?: string;
    status?: string;
    origin?: string;
}

function cleanActionText(rawText: string | undefined): string {
    let text = String(rawText ?? '').trim();
    if (!text) return '—';
    text = text.replace(/^(Proposed|Recorded)\s+containment\s+action(\s+based\s+on\s+precedent\s+[A-Z0-9-]+)?:?\s*/i, '');
    text = text.replace(/^(Proposed|Recorded)\s+action:?\s*/i, '');
    text = text.replace(/^(Precedent\s+proposed\s+action|Precedent\s+action):?\s*/i, '');
    return text.trim() || '—';
}

export function ActionCardsWidget({
    value,
    emptyLabel = 'No action logged yet.',
    disciplineID,
    fieldKey,
    acceptedValue,
    readOnly = false,
    reportID = '',
    disciplineCode = '',
    rootCause = '',
}: {
    value: unknown;
    emptyLabel?: string;
    disciplineID?: string;
    fieldKey?: string;
    /** Task đã nhận, đọc từ `<prefix>.assignedActions` của chính discipline này. */
    acceptedValue?: unknown;
    readOnly?: boolean;
    reportID?: string;
    disciplineCode?: string;
    rootCause?: string;
}) {
    const initialRows: ActionRow[] = Array.isArray(value) ? (value as ActionRow[]) : [];
    const [actions, setActions] = useState<ActionRow[]>(initialRows);

    // Bảng task là bản ghi RIÊNG, không phải danh sách đề xuất tô màu khác. Giữ
    // bản sao ở đây để nút đổi ngay sang "Added" mà không phải chờ poll một vòng.
    const [tasks, setTasks] = useState<ActionTask[]>(() => normalizeTasks(acceptedValue));
    const assignedField = assignedFieldFor(fieldKey || 'containment.actions');

    useEffect(() => {
        const initialRows: ActionRow[] = Array.isArray(value) ? (value as ActionRow[]) : [];
        setActions(initialRows);
    }, [value]);

    useEffect(() => {
        setTasks(normalizeTasks(acceptedValue));
    }, [acceptedValue]);

    const accept = (rows: ActionRow[]) => {
        const defaultDuration = DEFAULT_DURATION_BY_DISCIPLINE[disciplineCode] ?? 1;

        // Compute start date = today (local date, ISO format)
        const today = new Date();
        const startDate = today.toISOString().slice(0, 10); // "YYYY-MM-DD"

        // Compute planned end date = startDate + defaultDuration days
        const endDateObj = new Date(today);
        endDateObj.setDate(endDateObj.getDate() + defaultDuration);
        const plannedEndDate = endDateObj.toISOString().slice(0, 10);

        const incoming = rows
            .filter((row) => actionLabel(row))
            .map((row, i): ActionTask => ({
                ...taskFromAction(row, `${Date.now().toString(36)}-${i}`),
                status: 'Planned',
                published: false,
                durationDays: defaultDuration,
                startDate,
                plannedEndDate,
            }));
        const next = mergeTasks(tasks, incoming);
        if (next === tasks) {
            toast.info('Already in the task list.');
            return;
        }
        persistTasks(next, incoming.length > 1 ? `${next.length - tasks.length} tasks added.` : 'Task added.');
    };

    const persistTasks = (next: ActionTask[], message = 'Task list saved.') => {
        setTasks(next);
        if (!disciplineID) return;
        saveDisciplineField(disciplineID, assignedField, next)
            .then(() => toast.success(message))
            .catch((err) => toast.error(`Could not save: ${err.message}`));
    };

    const pending = actions.filter((row) => actionLabel(row) && !isAccepted(row, tasks));

    return (
        <div className="space-y-4">
            {/* Box 1: AI Suggested Actions */}
            <div className="rounded-xl border p-4 shadow-xs transition-all border-primary/25 bg-primary/[0.03]">
                <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-primary/10">
                    <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Sparkles className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-base font-bold tracking-tight text-foreground">
                            AI Suggested Actions
                        </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {!readOnly && pending.length > 0 && (
                            <button
                                type="button"
                                onClick={() => accept(pending)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 hover:shadow active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                            >
                                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                <span>Accept all suggested ({pending.length})</span>
                            </button>
                        )}
                    </div>
                </div>

                {actions.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">{emptyLabel}</p>
                ) : (
                    <div className="space-y-2">
                        {actions.map((row, index) => {
                            const rawText = row.action ?? row.actionText ?? '';
                            const text = cleanActionText(rawText);
                            return (
                                <div
                                    key={index}
                                    className="flex items-start justify-between gap-2.5 py-1 px-1 rounded-md transition-colors hover:bg-primary/[0.04]"
                                >
                                    <div className="flex items-start gap-2 min-w-0">
                                        <span className="mt-2.5 h-1 w-1 rounded-full bg-foreground/90 shrink-0" />
                                        <div className="space-y-1 min-w-0">
                                            <p className="break-words text-sm font-normal text-foreground leading-relaxed">{text}</p>
                                            {row.owner && (
                                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                    <User className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                                                    <span className="font-medium text-foreground/85">{row.owner}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 ml-2 pt-0.5">
                                        {isAccepted(row, tasks) ? (
                                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-success whitespace-nowrap">
                                                <Check className="h-3.5 w-3.5" />
                                                <span>Accepted</span>
                                            </span>
                                        ) : !readOnly ? (
                                            <button
                                                type="button"
                                                onClick={() => accept([row])}
                                                className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline hover:text-primary/80 transition-colors cursor-pointer whitespace-nowrap"
                                            >
                                                <Check className="h-3.5 w-3.5" />
                                                <span>Accept</span>
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Box 2: Assigned Tasks (Separate Standalone Box) */}
            <TaskTable
                tasks={tasks}
                onChange={persistTasks}
                readOnly={readOnly}
                reportID={reportID}
                disciplineCode={disciplineCode}
                rootCause={rootCause}
            />
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Khoi ban nhap cua AI
   ───────────────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────────────────
   Khối kết luận Root Cause (AI Draft + Chỉnh sửa & Chạy lại các bước sau)
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Kết luận Root Cause do AI soạn hoặc kỹ sư chỉnh sửa.
 * Cho phép chỉnh sửa nội dung kết luận và cảnh báo xác nhận chạy lại các bước downstream (D5..D8).
 */
export function AiDraftWidget({
    value,
    disciplineID,
    readOnly = false,
    reportID = '',
    fieldKey = 'rootCause.statement',
}: {
    value: unknown;
    disciplineID?: string;
    readOnly?: boolean;
    reportID?: string;
    fieldKey?: string;
}) {
    const queryClient = useQueryClient();
    const params = useParams<{ id?: string }>();
    const effectiveReportID = reportID || params.id || '';
    const text = typeof value === 'string' ? value.trim() : '';
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(text);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!editing) {
            setDraft(text);
        }
    }, [text, editing]);

    const handleStartEdit = () => {
        setDraft(text);
        setEditing(true);
    };

    const handleCancel = () => {
        setDraft(text);
        setEditing(false);
    };

    const handleRequestSave = () => {
        if (draft.trim() === text) {
            setEditing(false);
            return;
        }
        setConfirmOpen(true);
    };

    const handleSaveAndReanalyze = async (reanalyze: boolean) => {
        if (!disciplineID) return;
        setSaving(true);
        try {
            const nextValue = draft.trim();
            await saveDisciplineField(disciplineID, fieldKey || 'rootCause.statement', nextValue);
            toast.success('Đã lưu kết luận nguyên nhân gốc.');
            setConfirmOpen(false);
            setEditing(false);

            if (reanalyze && effectiveReportID) {
                toast.info('Starting re-analysis of downstream steps (D5, D6, D7, D8)...');
                await reanalyzeDownstream(effectiveReportID, 'D5');
                toast.success('Scheduled re-analysis of steps D5-D8.');
            }

            await queryClient.invalidateQueries({ queryKey: ['8d'] });
        } catch (e: any) {
            toast.error(e?.response?.data?.error?.message || e.message || 'Error saving root cause.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="relative rounded-xl border border-primary/25 bg-primary/[0.03] p-4 shadow-xs transition-all">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-primary/15">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-base font-bold text-foreground">
                        {disciplineID ? 'Root cause conclusion' : 'AI Draft'}
                    </span>
                    <ComparativeDiagnosisBadge compact reportID={effectiveReportID} />
                </div>
                {!readOnly && disciplineID && !editing && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2.5 text-sm text-muted-foreground hover:text-foreground gap-1.5"
                        onClick={handleStartEdit}
                    >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                    </Button>
                )}
            </div>

            {editing ? (
                <div className="space-y-3 pt-1">
                    <Textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={3}
                        placeholder="Enter concise root cause conclusion..."
                        className="text-sm leading-relaxed resize-y bg-background font-normal"
                        autoFocus
                    />
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">
                            {draft.length} characters
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-sm"
                                onClick={handleCancel}
                                disabled={saving}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                variant="default"
                                className="h-8 text-sm gap-1.5"
                                onClick={handleRequestSave}
                                disabled={saving || !draft.trim()}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="min-w-0">
                    {text ? (
                        <p className="break-words text-sm leading-relaxed text-foreground font-normal">
                            {text}
                        </p>
                    ) : (
                        <p className="text-sm italic text-muted-foreground">
                            The AI produced no conclusion for this step.
                        </p>
                    )}
                </div>
            )}

            {/* Warning Confirmation Modal */}
            <Dialog open={confirmOpen} onOpenChange={(open) => { if (!open && !saving) setConfirmOpen(false); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-warning mb-1">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <DialogTitle className="text-base font-bold text-foreground">
                                Confirm Root Cause Modification
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-sm text-muted-foreground leading-relaxed pt-1">
                            Modifying the Root Cause in D4 impacts subsequent action and prevention steps:
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
                        <div className="font-semibold text-warning-foreground flex items-center gap-1.5">
                            <RefreshCw className="h-3.5 w-3.5" />
                            Downstream dependencies to be updated:
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1">
                            <li><strong className="text-foreground">D5 (Corrective Actions):</strong> Realignment with new root cause.</li>
                            <li><strong className="text-foreground">D6 (Verification Plan):</strong> Validation against new mechanism.</li>
                            <li><strong className="text-foreground">D7 (Preventive Actions):</strong> Recurrence prevention and FMEA link.</li>
                            <li><strong className="text-foreground">D8 (Closure & Lessons):</strong> Summary and team closure gates.</li>
                        </ul>
                    </div>

                    <div className="text-sm text-muted-foreground">
                        The system will save the new root cause and automatically re-analyze from D5 onward.
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmOpen(false)}
                            disabled={saving}
                            className="h-8 text-sm"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSaveAndReanalyze(false)}
                            disabled={saving}
                            className="h-8 text-sm"
                        >
                            Save D4 Only
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleSaveAndReanalyze(true)}
                            disabled={saving}
                            className="h-8 text-sm gap-1.5 bg-primary font-semibold"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Save & Reanalyze D5-D8
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
