import type { ReactNode } from 'react';
import { Button, Textarea, cn } from '@cnma/react-ui';
import {
    AlignLeft,
    CalendarDays,
    Check,
    CircleAlert,
    CircleCheck,
    ClipboardList,
    Hash,
    Info,
    Paperclip,
    Target,
    Timer,
    User,
} from 'lucide-react';
import { normalizeActionStatus, type ActionTask } from '../../../../../../shared/action-task';
import { taskCodeTextOf } from '../../../../../../shared/task-catalogue';
import { TaskEvidenceSection } from '../task-evidence';
import { Blank, RootCauseChip, TaskCodeChip, formatDate } from './task-fields';

function Section({ icon: Icon, title, action, children }: {
    icon: typeof AlignLeft;
    title: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Icon className="size-4 text-muted-foreground" />
                    {title}
                </h3>
                {action}
            </div>
            {children}
        </section>
    );
}

/** Một dòng khoá - giá trị ở cột thông tin bên phải. */
function DetailRow({ icon: Icon, label, children }: { icon: typeof User; label: string; children: ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-2.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 space-y-0.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="break-words text-sm font-medium text-foreground">{children}</dd>
            </div>
        </div>
    );
}

/**
 * Vòng đời Planned → Open → Done của task D3/D7 (và task D5 chạy ở D6), để người
 * xem thấy ngay task đang ở đâu và bước tiếp theo cần gì.
 */
function TaskLifecycle({ status, evidenceRequired }: { status: string; evidenceRequired: boolean }) {
    const current = normalizeActionStatus(status);
    const steps = [
        { key: 'Planned', label: 'Planned', hint: 'Drafted, not yet sent' },
        { key: 'Open', label: 'Open', hint: 'Published to the assignee' },
        { key: 'Done', label: 'Done', hint: evidenceRequired ? 'Completion evidence uploaded' : 'Execution note or evidence saved' },
    ];
    const currentIndex = steps.findIndex((s) => s.key === current);

    return (
        <ol className="space-y-0">
            {steps.map((step, i) => {
                const reached = i < currentIndex || current === 'Done';
                const isCurrent = i === currentIndex && current !== 'Done';
                return (
                    <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
                        {i < steps.length - 1 && (
                            <span
                                aria-hidden
                                className={cn('absolute left-2.5 top-6 h-full w-px', reached ? 'bg-success/40' : 'bg-border')}
                            />
                        )}
                        <span
                            className={cn(
                                'relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs',
                                reached && 'border-success/40 bg-success-bg text-success',
                                isCurrent && 'border-info bg-info-bg text-info ring-2 ring-info/20',
                                !reached && !isCurrent && 'border-border bg-background text-muted-foreground',
                            )}
                        >
                            {reached ? <Check className="size-3" /> : i + 1}
                        </span>
                        <div className="min-w-0 -mt-0.5">
                            <p className={cn('text-sm font-medium', reached || isCurrent ? 'text-foreground' : 'text-muted-foreground')}>
                                {step.label}
                                {isCurrent && <span className="ml-1.5 text-xs font-normal text-info">current</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">{step.hint}</p>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

/** Nói rõ task cần gì để thành Done — thay cho dải màu không có ngữ cảnh. */
function CompletionCallout({ task, readOnly }: { task: ActionTask; readOnly: boolean }) {
    const done = normalizeActionStatus(task.status) === 'Done';
    const required = task.evidenceRequired ?? true;
    const tone = done
        ? { icon: CircleCheck, box: 'border-success/30 bg-success-bg', iconClass: 'text-success', title: 'Completed', text: readOnly ? 'Completion criteria are met.' : 'Completion criteria are met. You can still add evidence or update the notes.' }
        : required
            ? { icon: CircleAlert, box: 'border-warning/30 bg-warning-bg', iconClass: 'text-warning', title: 'Evidence required', text: 'Upload at least one completion document (PDF) to mark this task Done.' }
            : { icon: Info, box: 'border-border bg-muted/40', iconClass: 'text-muted-foreground', title: 'Evidence optional', text: 'Saving an execution note or uploading a document marks this task Done.' };
    const Icon = tone.icon;
    return (
        <div className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-3', tone.box)}>
            <Icon className={cn('mt-0.5 size-4 shrink-0', tone.iconClass)} />
            <div className="space-y-0.5 text-sm">
                <p className="font-semibold text-foreground">{tone.title}</p>
                <p className="text-muted-foreground">{tone.text}</p>
            </div>
        </div>
    );
}

/** Màn hình xem một task (icon mắt). */
export function TaskDetailView({
    task,
    disciplineCode,
    isD3orD7,
    readOnly,
    reportID,
    rootCause,
    note,
    onNoteChange,
    onSaveNote,
    onEvidenceUploaded,
}: {
    task: ActionTask;
    disciplineCode: string;
    isD3orD7: boolean;
    readOnly: boolean;
    reportID: string;
    rootCause: string;
    note: string;
    onNoteChange: (note: string) => void;
    onSaveNote: () => void;
    onEvidenceUploaded: () => void;
}) {
    const isD3D7 = disciplineCode === 'D3' || disciplineCode === 'D7';
    const unassigned = !task.assignee || /^unassigned\b/i.test(task.assignee);
    const noteDirty = note !== (task.note ?? '');

    return (
        <div className="grid gap-6 md:grid-cols-3">
            <div className="min-w-0 space-y-6 md:col-span-2">
                <Section icon={AlignLeft} title="Description & instructions">
                    {task.description ? (
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{task.description}</p>
                    ) : (
                        <p className="text-sm italic text-muted-foreground">No description or instructions recorded.</p>
                    )}
                </Section>

                {isD3orD7 && (
                    <Section
                        icon={ClipboardList}
                        title="Execution notes"
                        action={!readOnly && (
                            <Button type="button" size="sm" variant="outline" disabled={!noteDirty} onClick={onSaveNote}>
                                Save note
                            </Button>
                        )}
                    >
                        <Textarea
                            value={note}
                            disabled={readOnly}
                            onChange={(e) => onNoteChange(e.target.value)}
                            onBlur={() => { if (noteDirty) onSaveNote(); }}
                            rows={3}
                            className="min-h-20 resize-y bg-background text-sm leading-relaxed"
                            placeholder="What was done, what was found, and anything the next person should know..."
                        />
                    </Section>
                )}

                {reportID && disciplineCode && (
                    <div className="space-y-3">
                        {isD3orD7 && <CompletionCallout task={task} readOnly={readOnly} />}
                        <TaskEvidenceSection
                            reportID={reportID}
                            disciplineCode={disciplineCode}
                            task={task}
                            readOnly={readOnly}
                            onEvidenceUploaded={onEvidenceUploaded}
                        />
                    </div>
                )}

                {task.attachments && task.attachments.length > 0 && (
                    <Section icon={Paperclip} title={`Attachments (${task.attachments.length})`}>
                        <ul className="flex flex-wrap gap-2">
                            {task.attachments.map((file) => (
                                <li key={file.name} className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-sm">
                                    <span className="font-medium text-foreground">{file.kind}</span>
                                    <span className="text-muted-foreground">{file.name}</span>
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}
            </div>

            <aside className="space-y-4">
                <div className="rounded-xl border bg-card px-4 py-2 shadow-sm">
                    <h3 className="border-b py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</h3>
                    <dl className="divide-y">
                        <DetailRow icon={User} label="Assignee">
                            {unassigned ? <Blank label={task.assignee || 'Unassigned'} /> : task.assignee}
                        </DetailRow>
                        <DetailRow icon={Timer} label="Duration">
                            {task.durationDays > 0 ? `${task.durationDays} day${task.durationDays > 1 ? 's' : ''}` : <Blank label="Not estimated" />}
                        </DetailRow>
                        <DetailRow icon={CalendarDays} label="Start date">
                            {formatDate(task.startDate ?? '') || <Blank label="No start date" />}
                        </DetailRow>
                        <DetailRow icon={Target} label="Planned end date">
                            {formatDate(task.plannedEndDate) || <Blank label="No date committed" />}
                        </DetailRow>
                        {disciplineCode === 'D5' ? (
                            <DetailRow icon={Target} label="Root cause (from D4)">
                                <RootCauseChip category={rootCause} />
                            </DetailRow>
                        ) : !isD3D7 && (
                            <DetailRow icon={Hash} label="Task code">
                                {task.taskCode ? (
                                    <span className="space-y-1">
                                        <span className="flex flex-wrap items-center gap-1.5">
                                            <TaskCodeChip code={task.taskCode} />
                                            {task.taskCodeGroup && <span className="font-mono text-xs text-muted-foreground">{task.taskCodeGroup}</span>}
                                        </span>
                                        <span className="block text-xs font-normal text-muted-foreground">
                                            {taskCodeTextOf(task.taskCode) ?? 'Not in the task catalogue.'}
                                        </span>
                                    </span>
                                ) : <Blank label="Not coded" />}
                            </DetailRow>
                        )}
                    </dl>
                </div>

                {isD3orD7 && (
                    <div className="rounded-xl border bg-card p-4 shadow-sm">
                        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progress</h3>
                        <TaskLifecycle status={task.status} evidenceRequired={task.evidenceRequired ?? true} />
                    </div>
                )}
            </aside>
        </div>
    );
}
