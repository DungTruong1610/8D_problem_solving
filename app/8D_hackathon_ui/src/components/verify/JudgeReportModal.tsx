import type { ReactNode } from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, cn } from '@cnma/react-ui';
import { CheckCircle2, CircleSlash, OctagonPause } from 'lucide-react';
import {
    JUDGE_STOP_LABEL,
    type JudgeDecision,
    type JudgeEvaluation,
} from '../../../../../shared/judge-evaluation';

/**
 * Báo cáo đầy đủ cho MỘT đầu vào trong sandbox giám khảo.
 *
 * Chỉ in những gì backend đã thật sự kiểm (`shared/judge-evaluation.ts`): dữ
 * kiện bóc từ đầu vào, số case đã đếm trong kho, các lần dừng theo luật. Bản cũ
 * in "pgvector cosine similarity 86%", "Autonomous D1–D8 drafting completed" và
 * một "Compliance Certificate" — không cái nào là kết quả của một phép kiểm.
 */

const DECISION: Record<JudgeDecision, { label: string; icon: typeof CheckCircle2; tone: string }> = {
    HANDLED_APPROPRIATELY: { label: 'Handled - no stop', icon: CheckCircle2, tone: 'text-success' },
    ESCALATED: { label: 'Stopped - handed to a person', icon: OctagonPause, tone: 'text-warning' },
    GRACEFULLY_REFUSED: { label: 'Refused', icon: CircleSlash, tone: 'text-muted-foreground' },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
            {children}
        </section>
    );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="break-words text-sm font-medium text-foreground">{value || <span className="font-normal text-muted-foreground">not provided</span>}</dd>
        </div>
    );
}

export function JudgeReportModal({
    isOpen,
    onClose,
    report,
}: {
    isOpen: boolean;
    onClose: () => void;
    report: JudgeEvaluation | null;
}) {
    if (!report) return null;
    const decision = report.decision === 'HANDLED_APPROPRIATELY' && report.stops.length > 0
        ? { ...DECISION.HANDLED_APPROPRIATELY, label: 'Handled - sign-off needed at closure' }
        : DECISION[report.decision];
    const Icon = decision.icon;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Icon className={cn('h-5 w-5', decision.tone)} />
                        {decision.label}
                    </DialogTitle>
                    <DialogDescription>
                        {report.facts.notificationId ?? 'Unidentified input'} · evaluated {new Date(report.timestamp).toLocaleString()} in {report.durationMs} ms
                    </DialogDescription>
                </DialogHeader>

                {report.simulated && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                        The backend could not be reached. This is the browser's simplified rule check, not the server evaluation - no case library was searched.
                    </div>
                )}

                <div className="space-y-5">
                    <p className="text-sm text-foreground">{report.reason}</p>

                    <Section title="Where the AI stopped">
                        {report.stops.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No stop - the input has measured facts, a precedent to compare with, and nothing above the AI's authority.</p>
                        ) : (
                            <ul className="divide-y rounded-lg border">
                                {report.stops.map((s) => (
                                    <li key={s.id} className="space-y-1 px-3 py-2.5 text-sm">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-foreground">{JUDGE_STOP_LABEL[s.type]}</span>
                                            <span className="rounded border px-1.5 py-px text-xs text-muted-foreground">{s.step}</span>
                                            {s.blocking && <span className="text-xs text-warning">blocking</span>}
                                        </div>
                                        <p className="text-foreground/90">{s.reason}</p>
                                        <p><span className="text-muted-foreground">Question for {s.requiredRole}:</span> {s.questionForHuman}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Section>

                    <Section title="What was read from the input">
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border px-3 py-2.5 sm:grid-cols-3">
                            <Field label="Document type" value={report.facts.documentType} />
                            <Field label="Work center" value={report.facts.workCenterId} />
                            <Field label="Material" value={report.facts.materialId} />
                            <Field label="Defect code" value={report.facts.defectCode} />
                            <div className="col-span-2"><Field label="Symptom" value={report.facts.symptom} /></div>
                        </dl>
                        {report.facts.measurements.length > 0 ? (
                            <ul className="space-y-0.5 text-sm">
                                {report.facts.measurements.map((m, i) => (
                                    <li key={i}><span className="text-muted-foreground">{m.characteristic}:</span> {m.measured || '-'} <span className="text-muted-foreground">vs spec</span> {m.spec || '-'}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground">No measurements in the input.</p>
                        )}
                    </Section>

                    <Section title="Precedent check">
                        <p className="text-sm text-foreground">
                            {report.precedentCheck.performed
                                ? `${report.precedentCheck.matchingCases} closed case(s) in the library with ${report.precedentCheck.basis}.`
                                : report.precedentCheck.basis}
                            {report.precedentCheck.sample.length > 0 && (
                                <span className="text-muted-foreground"> e.g. {report.precedentCheck.sample.join(', ')}</span>
                            )}
                        </p>
                    </Section>

                    {(report.validation.blocking.length > 0 || report.facts.gaps.length > 0) && (
                        <Section title="Data notes">
                            <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                                {report.validation.blocking.map((b) => <li key={b} className="text-foreground">{b}</li>)}
                                {report.facts.gaps.slice(0, 6).map((g) => <li key={g}>{g}</li>)}
                            </ul>
                        </Section>
                    )}

                    <Section title="Next step">
                        <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                            <p className="font-medium text-foreground">{report.nextStep.title}</p>
                            <p className="mt-0.5 text-muted-foreground">{report.nextStep.summary}</p>
                            {report.nextStep.questions.length > 0 && (
                                <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
                                    {report.nextStep.questions.map((q) => <li key={q}>{q}</li>)}
                                </ol>
                            )}
                            {report.nextStep.roles.length > 0 && (
                                <p className="mt-1.5 text-xs text-muted-foreground">Who: {report.nextStep.roles.join(', ')}</p>
                            )}
                        </div>
                    </Section>
                </div>

                <div className="flex justify-end pt-1">
                    <Button type="button" variant="outline" size="sm" onClick={onClose}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
