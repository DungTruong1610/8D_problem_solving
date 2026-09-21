import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    Card,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    cn,
} from '@cnma/react-ui';
import { CircleDashed, CircleDot, CircleCheck, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
    saveDisciplineField,
    type Discipline8D,
} from '@/services/eightd-service';
import {
    normalizeActionStatus,
    normalizeTasks,
} from '../../../../../shared/action-task';
import { TaskTable } from './action-table';
import { resolveD4RootCause } from './schema-discipline-card';

export interface CaseActionRow {
    id?: string;
    lineNo: number;
    actionType?: string;
    actionText: string;
    status: string;
    owner?: string;
    targetDate?: string;
    originDisciplineCode?: 'D3' | 'D5' | 'D7';
    originDisciplineID?: string;
}

export interface CaseActions {
    containment?: CaseActionRow[];
    corrective?: CaseActionRow[];
    preventive?: CaseActionRow[];
}

/** Nhóm hành động cho D6 — chỉ nhận actions từ D5 (Permanent Corrective Actions). */
const GROUPS: { key: keyof CaseActions; label: string; step: 'D5' }[] = [
    { key: 'corrective', label: 'Permanent Corrective Actions', step: 'D5' },
];

/**
 * Trạng thái thực thi → Visual Badge & Icon phân biệt rõ ràng (Planned, Open, Done).
 */
function statusStyle(status: string): { icon: typeof CircleDot; className: string } {
    const s = normalizeActionStatus(status);
    if (s === 'Done') return { icon: CircleCheck, className: 'text-emerald-600 dark:text-emerald-400' };
    if (s === 'Open') return { icon: CircleDot, className: 'text-sky-600 dark:text-sky-400' };
    return { icon: CircleDashed, className: 'text-slate-500 dark:text-slate-400' };
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
 * Thu thập và hợp nhất action từ D5 (cả từ caseContext và các task đã được tạo trong D5).
 */
export function getMergedCaseActions(
    caseContext: string | null | undefined,
    disciplines?: Discipline8D[],
): CaseActions {
    const result: CaseActions = {
        containment: [],
        corrective: [],
        preventive: [],
    };

    if (disciplines && disciplines.length > 0) {
        for (const d of disciplines) {
            // D6 chỉ nhận action từ D5 khi D5 ở trạng thái InProgress hoặc Approved
            if (d.code !== 'D5') continue;

            const isStepActive = d.workState === 'InProgress' || d.reviewStatus === 'Approved';
            if (!isStepActive) continue;

            const parsed = parseJsonSafe(d.resultJson);
            if (!parsed) continue;

            const extractRows = (assignedVal: any) => {
                if (Array.isArray(assignedVal)) return assignedVal;
                return [];
            };

            const rows = extractRows(
                parsed.corrective?.assignedActions ?? parsed.assignedActions ?? parsed.corrective?.actions ?? parsed.actions,
            );
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                const text = r?.name || r?.actionText || r?.action || r?.description;
                if (text && !result.corrective?.some((ex) => ex.actionText === String(text))) {
                    result.corrective?.push({
                        id: r.id || `${d.code}-${i}`,
                        lineNo: (result.corrective.length + 1),
                        actionType: 'Corrective',
                        actionText: String(text),
                        status: normalizeActionStatus(r.status),
                        owner: r.assignee || r.owner || '',
                        originDisciplineCode: 'D5',
                        originDisciplineID: d.ID,
                    });
                }
            }
        }
    }

    if (caseContext) {
        const directActions = parseCaseActions(caseContext) || {};
        if (result.corrective?.length === 0 && directActions.corrective) {
            result.corrective = directActions.corrective;
        }
    }

    return result;
}

export function ActionChecklist({
    actions,
    disciplines,
    caseContext,
    reportID = '',
    rootCause = '',
}: {
    actions?: CaseActions | null;
    disciplines?: Discipline8D[];
    caseContext?: string | null;
    /** Report ID forwarded to TaskTable for evidence upload. */
    reportID?: string;
    /** Root cause forwarded to TaskTable for display. */
    rootCause?: string;
}) {
    const queryClient = useQueryClient();
    const effectiveActions = (disciplines && disciplines.length > 0)
        ? getMergedCaseActions(caseContext, disciplines)
        : (actions || getMergedCaseActions(caseContext, undefined));

    const groups = GROUPS.map((g) => ({ ...g, rows: effectiveActions?.[g.key] ?? [] }));

    // D5 discipline — nguồn dữ liệu duy nhất cho D6
    const d5Discipline = disciplines?.find((d) => d.code === 'D5');

    // Kế thừa root cause từ D4 hệt như D5
    const d4Discipline = disciplines?.find((d) => d.code === 'D4');
    const d4RootCause = resolveD4RootCause(d4Discipline, caseContext);
    const effectiveRootCause = (rootCause && rootCause !== '—') ? rootCause : d4RootCause;

    // Danh sách tasks thực tế của D5
    const d5Tasks = d5Discipline
        ? normalizeTasks(
            (() => {
                const parsed = parseJsonSafe(d5Discipline.resultJson) || {};
                return parsed.corrective?.assignedActions
                    ?? parsed.assignedActions
                    ?? [];
            })()
        )
        : [];

    // Đếm số lượng task và số task Done cho bộ track status của D6
    const total = d5Tasks.length > 0
        ? d5Tasks.length
        : groups.reduce((sum, g) => sum + g.rows.length, 0);

    const doneCount = d5Tasks.length > 0
        ? d5Tasks.filter((t) => normalizeActionStatus(t.status) === 'Done').length
        : groups.reduce(
            (sum, g) => sum + g.rows.filter((r) => normalizeActionStatus(r.status) === 'Done').length,
            0,
        );

    const [updatingKey, setUpdatingKey] = useState<string | null>(null);

    // Khi các bước D3, D5, D7 chưa InProgress hoặc chưa có action nào: Hiện hướng dẫn trực quan
    if (total === 0) {
        return (
            <Card className="p-6 text-center border-dashed bg-muted/20">
                <div className="flex flex-col items-center justify-center gap-2">
                    <CircleDashed className="w-8 h-8 text-muted-foreground/60" />
                    <p className="text-sm font-semibold text-foreground">No active actions in D5 yet</p>
                    <p className="text-sm text-muted-foreground max-w-md">
                        Action tasks will automatically appear here for verification once corrective actions (D5) step is switched to <strong className="text-foreground">In process</strong>.
                    </p>
                </div>
            </Card>
        );
    }

    const handleTaskStatusChange = async (
        row: CaseActionRow,
        newStatus: string,
    ) => {
        if (!row.originDisciplineID || !disciplines) return;
        const disc = disciplines.find((d) => d.ID === row.originDisciplineID);
        if (!disc) return;

        const parsed = parseJsonSafe(disc.resultJson) || {};
        const keyPrefix = 'corrective';
        const assignedField = `${keyPrefix}.assignedActions`;

        let taskList = parsed[keyPrefix]?.assignedActions || parsed.assignedActions || [];
        if (!Array.isArray(taskList) || taskList.length === 0) {
            const rawActions = parsed[keyPrefix]?.actions || [];
            taskList = rawActions.map((a: any, i: number) => ({
                id: `${disc.code}-${i}`,
                name: a.name || a.action || a.actionText || a.description,
                description: a.description || '',
                assignee: a.assignee || a.owner || '',
                status: a.status || 'Planned',
            }));
        }

        const updatedList = taskList.map((t: any) => {
            const tText = t.name || t.action || t.actionText || t.description;
            if (tText === row.actionText || (row.id && t.id === row.id)) {
                return { ...t, status: newStatus };
            }
            return t;
        });

        try {
            setUpdatingKey(row.actionText);
            await saveDisciplineField(disc.ID, assignedField, updatedList);
            toast.success(`Action status updated: ${newStatus}`);
            void queryClient.invalidateQueries({ queryKey: ['8d'] });
        } catch (err: any) {
            const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Could not update action status.';
            toast.error(msg);
        } finally {
            setUpdatingKey(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Prominent Header Banner */}
            <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                                Action Implementation & Verification Status
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1 leading-normal">
                                Track execution and verify effectiveness of permanent corrective actions (D5).
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                        <div className={cn(
                            "flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-sm font-semibold shadow-2xs",
                            doneCount === total && total > 0
                                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400 dark:bg-emerald-950/40"
                                : "bg-primary/5 text-foreground border-border/80"
                        )}>
                            <span className={cn(
                                "flex h-2 w-2 rounded-full shrink-0",
                                doneCount === total && total > 0 ? "bg-emerald-500" : "bg-primary animate-pulse"
                            )} />
                            <span>
                                <strong className="font-bold text-foreground text-sm">{doneCount}</strong> of <strong className="font-bold text-foreground text-sm">{total}</strong> Actions Done
                            </span>
                        </div>
                    </div>
                </div>

                {total > 0 && (
                    <div className="mt-3.5 pt-3 border-t border-border/50 flex items-center gap-3">
                        <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                                className={cn(
                                    "h-full transition-all duration-500 rounded-full",
                                    doneCount === total ? "bg-emerald-500" : "bg-primary"
                                )}
                                style={{ width: `${Math.round((doneCount / total) * 100)}%` }}
                            />
                        </div>
                        <span className="text-sm font-medium tabular-nums text-muted-foreground shrink-0">
                            {Math.round((doneCount / total) * 100)}% Complete
                        </span>
                    </div>
                )}
            </div>

            {/* D6 operational task table — full TaskTable với overrideActionDiscipline=true
                để unlock evidence toggle, Publish button, Execution Notes giống D3/D7.
                disciplineCode="D5" giữ đúng discipline ID cho evidence upload. */}
            {d5Discipline ? (
                <TaskTable
                    tasks={d5Tasks}
                    onChange={async (updatedTasks) => {
                        try {
                            await saveDisciplineField(d5Discipline.ID, 'corrective.assignedActions', updatedTasks);
                            void queryClient.invalidateQueries({ queryKey: ['8d'] });
                        } catch (err: any) {
                            const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Could not save task changes.';
                            toast.error(msg);
                        }
                    }}
                    readOnly={false}
                    reportID={reportID}
                    disciplineCode="D5"
                    rootCause={effectiveRootCause}
                    overrideActionDiscipline={true}
                />
            ) : (
                /* Fallback: giữ lại checklist tĩnh nếu disciplines chưa load xong */
                <div className="space-y-4">
                    {groups.map((group) => {
                        if (group.rows.length === 0) return null;
                        return (
                            <div key={group.key} className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-base font-semibold text-foreground">{group.label}</span>
                                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-sm text-muted-foreground">
                                        {group.step}
                                    </span>
                                </div>

                                <ul className="space-y-2">
                                    {group.rows.map((row) => {
                                        const { icon: Icon, className } = statusStyle(row.status);
                                        const isUpdating = updatingKey === row.actionText;
                                        const norm = normalizeActionStatus(row.status);

                                        return (
                                            <li
                                                key={`${group.key}-${row.lineNo}-${row.actionText}`}
                                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:border-border/80 transition-colors"
                                            >
                                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                                    <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', className)} />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="break-words text-sm font-normal text-foreground">
                                                            {row.actionText}
                                                        </p>
                                                        {row.owner && (
                                                            <p className="text-sm text-muted-foreground mt-0.5">
                                                                Owner: <span className="font-normal text-foreground/80">{row.owner}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                                    <Select
                                                        value={norm}
                                                        disabled={isUpdating || !row.originDisciplineID}
                                                        onValueChange={(val) => handleTaskStatusChange(row, val)}
                                                    >
                                                        <SelectTrigger
                                                            className={cn(
                                                                'h-9 w-[145px] px-2.5 text-sm font-semibold border transition-colors',
                                                                norm === 'Done' && 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
                                                                norm === 'Open' && 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
                                                                norm === 'Planned' && 'bg-slate-100/90 text-slate-700 border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700',
                                                            )}
                                                        >
                                                            <SelectValue placeholder="Select status" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Planned">
                                                                <div className="flex items-center gap-1.5">
                                                                    <CircleDashed className="h-4 w-4 text-slate-500" />
                                                                    <span>Planned</span>
                                                                </div>
                                                            </SelectItem>
                                                            <SelectItem value="Open">
                                                                <div className="flex items-center gap-1.5">
                                                                    <CircleDot className="h-4 w-4 text-sky-500" />
                                                                    <span>Open</span>
                                                                </div>
                                                            </SelectItem>
                                                            <SelectItem value="Done">
                                                                <div className="flex items-center gap-1.5">
                                                                    <CircleCheck className="h-4 w-4 text-emerald-500" />
                                                                    <span>Done</span>
                                                                </div>
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            )}

            <p className="text-sm text-muted-foreground pt-1">
                Actions are defined and managed in D5 (Permanent Corrective Actions).
            </p>
        </div>
    );
}


/** Bóc `actions` khỏi chuỗi caseContext. Hỏng thì trả null chứ không làm vỡ trang. */
export function parseCaseActions(caseContext: string | null | undefined): CaseActions | null {
    if (!caseContext) return null;
    try {
        const parsed = JSON.parse(caseContext);
        const actions = parsed?.actions;
        return actions && typeof actions === 'object' && !Array.isArray(actions) ? actions : null;
    } catch {
        return null;
    }
}
