import type { ReactNode } from 'react';
import {
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
} from '@cnma/react-ui';
import { TASK_STATUSES } from '../../../../../../shared/action-task';
import { TaskStatusBadge } from '@/components/common/TaskStatusBadge';
import { DatePickerField, RootCauseChip, TaskCodeField, usePartnerValueHelp } from './task-fields';
import { ValueHelpInput } from '@/components/ui/ValueHelpInput';

/** Bản nháp đang sửa — chỉ những ô người dùng gõ được. */
export interface TaskDraft {
    name: string;
    assignee: string;
    durationDays: string;
    status: string;
    description: string;
    taskCode: string;
    startDate: string;
    plannedEndDate: string;
}

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
    return (
        <section className="grid gap-4 py-5 first:pt-0 last:pb-0 md:grid-cols-4 md:gap-6">
            <div className="space-y-1 md:col-span-1">
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
            </div>
            <div className="min-w-0 space-y-4 md:col-span-3">{children}</div>
        </section>
    );
}

function Field({ label, htmlFor, required, hint, error, children }: {
    label: string;
    htmlFor?: string;
    required?: boolean;
    hint?: string;
    error?: string | null;
    children: ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
                {label}
                {required && <span className="ml-0.5 text-destructive">*</span>}
            </Label>
            {children}
            {error ? (
                <p className="text-xs font-medium text-destructive">{error}</p>
            ) : hint ? (
                <p className="text-xs text-muted-foreground">{hint}</p>
            ) : null}
        </div>
    );
}

/**
 * Form sửa một task (icon bút chì). Các ô hiện theo bước, giống hệt trước:
 * D5 (và D6 cho task D5) có nguyên nhân gốc từ D4; D3/D7 chỉ có lịch; bước khác
 * có thêm mã nhiệm vụ.
 */
export function TaskEditForm({
    taskId,
    draft,
    onChange,
    disciplineCode,
    isD3orD7,
    taskStatus,
    rootCause,
}: {
    taskId: string;
    draft: TaskDraft;
    onChange: (patch: Partial<TaskDraft>) => void;
    disciplineCode: string;
    isD3orD7: boolean;
    taskStatus: string;
    rootCause: string;
}) {
    const partnerVh = usePartnerValueHelp();
    const id = (suffix: string) => `task-edit-${taskId}-${suffix}`;
    const showsCoding = disciplineCode !== 'D3' && disciplineCode !== 'D7';

    return (
        <div className="divide-y">
            <FormSection title="Task" description="What has to be done, and how the owner knows it is done.">
                <Field
                    label="Task name"
                    htmlFor={id('name')}
                    required
                    error={draft.name.trim() ? null : 'A task needs a name.'}
                >
                    <Textarea
                        id={id('name')}
                        value={draft.name}
                        onChange={(e) => onChange({ name: e.target.value })}
                        rows={2}
                        className="min-h-14 resize-y bg-background text-sm leading-relaxed"
                        placeholder="e.g. Replace the worn deburring tool on EQ-MILL07-002"
                    />
                </Field>
                <Field label="Description & instructions" htmlFor={id('description')} hint="Scope, acceptance criteria or the check to perform.">
                    <Textarea
                        id={id('description')}
                        value={draft.description}
                        onChange={(e) => onChange({ description: e.target.value })}
                        rows={4}
                        className="min-h-20 bg-background text-sm leading-relaxed"
                        placeholder="Detailed instructions, scope of work, or criteria..."
                    />
                </Field>
            </FormSection>

            <FormSection title="Assignment" description="Who owns the task and how long it should take.">
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                    <Field label="Assignee" hint="Pick from the team directory.">
                        <ValueHelpInput
                            value={draft.assignee}
                            onChange={(assignee) => onChange({ assignee })}
                            entries={partnerVh.entries}
                            loading={partnerVh.loading}
                            quiet
                            dropdownPlacement="top"
                            inputClassName="text-sm"
                            placeholder="e.g. Quality Engineer"
                            catalogLabel="the team directory"
                        />
                    </Field>
                    </div>
                    <Field label="Duration (days)" htmlFor={id('duration')}>
                        <Input
                            id={id('duration')}
                            type="number"
                            min={0}
                            placeholder="0"
                            value={draft.durationDays}
                            onChange={(e) => onChange({ durationDays: e.target.value })}
                            className="bg-background text-sm"
                        />
                    </Field>
                </div>
                {isD3orD7 ? (
                    <Field label="Status" hint="Changes through Publish, an execution note or uploaded evidence.">
                        <div><TaskStatusBadge status={taskStatus} /></div>
                    </Field>
                ) : (
                    <Field label="Status">
                        <Select value={draft.status} onValueChange={(status) => onChange({ status })}>
                            <SelectTrigger className="w-full bg-background text-sm sm:w-56">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {TASK_STATUSES.map((st) => (
                                    <SelectItem key={st} value={st} className="text-sm">{st}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                )}
            </FormSection>

            <FormSection title="Schedule" description="When work starts and the date the team commits to.">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Start date" htmlFor={id('start')}>
                        <DatePickerField id={id('start')} value={draft.startDate} onChange={(startDate) => onChange({ startDate })} />
                    </Field>
                    <Field label="Planned end date" htmlFor={id('due')}>
                        <DatePickerField id={id('due')} value={draft.plannedEndDate} onChange={(plannedEndDate) => onChange({ plannedEndDate })} />
                    </Field>
                </div>
            </FormSection>

            {showsCoding && (
                <FormSection
                    title={disciplineCode === 'D5' ? 'Root cause' : 'Coding'}
                    description={disciplineCode === 'D5'
                        ? 'The corrective action targets the root cause concluded in D4.'
                        : 'The task code makes "what did we do last time" a count instead of a read.'}
                >
                    {disciplineCode === 'D5' ? (
                        <Field label="Root cause (from D4)" hint="Read-only. Change it in D4.">
                            <div><RootCauseChip category={rootCause} /></div>
                        </Field>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <TaskCodeField
                                code={draft.taskCode}
                                onCodeChange={(taskCode) => onChange({ taskCode })}
                                suggestedFrom={draft.name}
                                idPrefix={`task-edit-${taskId}`}
                            />
                        </div>
                    )}
                </FormSection>
            )}
        </div>
    );
}
