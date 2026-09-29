import { useState } from 'react';
import { Badge, Button, Card, cn } from '@cnma/react-ui';
import {
    ArrowRight,
    Brain,
    Check,
    ChevronDown,
    HelpCircle,
    Loader2,
    Scale,
    ShieldAlert,
    TriangleAlert,
} from 'lucide-react';
import type {
    IndependentAnalysis,
    Precedent,
    ReportStatus,
} from '@/services/eightd-service';

const CATEGORY_STYLES: Record<string, string> = {
    Man: 'bg-warning/10 text-warning border-warning/20',
    Machine: 'bg-info/10 text-info border-info/20',
    Method: 'bg-primary/10 text-primary border-primary/20',
    Material: 'bg-warning/15 text-warning border-warning/30',
    Measurement: 'bg-info/15 text-info border-info/30',
    Environment: 'bg-success/10 text-success border-success/20',
};

function CategoryChip({ category, className }: { category: string | null; className?: string }) {
    if (!category) return <span className="text-sm text-muted-foreground">No cause recorded</span>;
    return (
        <Badge
            variant="outline"
            className={cn(
                'font-semibold text-sm px-2.5 py-0.5',
                CATEGORY_STYLES[category] ?? 'bg-muted text-muted-foreground',
                className,
            )}
        >
            {category}
        </Badge>
    );
}

function confidencePercent(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return null;
    return Math.round(parsed * 100);
}

function statusCopy(status?: ReportStatus, isLoading = false) {
    if (isLoading) {
        return {
            title: 'Loading the independent check',
            description: 'The saved AI Referee result is being retrieved.',
            icon: Loader2,
            iconClass: 'animate-spin text-info',
            tone: 'border-info/25 bg-info/5',
        };
    }
    if (status === 'Analyzing') {
        return {
            title: 'AI Referee check in progress',
            description: 'The independent root-cause check will appear here when it is available.',
            icon: Loader2,
            iconClass: 'animate-spin text-info',
            tone: 'border-info/25 bg-info/5',
        };
    }
    if (status === 'Failed') {
        return {
            title: 'No independent result is available',
            description: 'The report analysis did not complete. Retry the analysis to generate a referee check.',
            icon: ShieldAlert,
            iconClass: 'text-destructive',
            tone: 'border-destructive/25 bg-destructive/5',
        };
    }
    return {
        title: 'No independent result is stored for this report',
        description: 'This report may predate the AI Referee check or may not contain a valid saved result.',
        icon: HelpCircle,
        iconClass: 'text-muted-foreground',
        tone: 'border-border bg-muted/20',
    };
}

export function ReasoningPanel({
    analysis,
    reportStatus,
    loading = false,
    precedent,
    readOnly = false,
    onUseAsDraft,
}: {
    analysis: IndependentAnalysis | null;
    reportStatus?: ReportStatus;
    loading?: boolean;
    precedent?: Precedent | null;
    readOnly?: boolean;
    /** Copies the independent finding into the unsaved D4 editor draft. */
    onUseAsDraft?: () => void;
}) {
    const [open, setOpen] = useState(false);

    if (!analysis) {
        const state = statusCopy(reportStatus, loading);
        const StatusIcon = state.icon;
        return (
            <Card
                role="status"
                aria-live="polite"
                className={cn('p-4 border', state.tone)}
            >
                <div className="flex items-start gap-3">
                    <StatusIcon className={cn('mt-0.5 h-5 w-5 shrink-0', state.iconClass)} />
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-semibold text-base">AI Referee</h2>
                            <span className="text-sm font-medium">{state.title}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{state.description}</p>
                    </div>
                </div>
            </Card>
        );
    }

    const { finding, verdict } = analysis;
    const leaks = Array.isArray(analysis.leaks) ? analysis.leaks.filter(Boolean) : [];
    const derivedFiveWhy = Array.isArray(finding.derivedFiveWhy) ? finding.derivedFiveWhy : [];
    const ruledOut = Array.isArray(finding.ruledOut) ? finding.ruledOut : [];
    const evidenceGaps = Array.isArray(finding.evidenceGaps) ? finding.evidenceGaps : [];
    const confidence = confidencePercent(finding.confidence);
    const compromised = leaks.length > 0;
    const agrees = verdict.agrees;
    const StatusIcon = compromised
        ? TriangleAlert
        : agrees === true
            ? Check
            : agrees === false
                ? Scale
                : Brain;
    const statusLabel = compromised
        ? 'Blind check integrity needs review'
        : agrees === true
            ? 'AI independently corroborated the recorded cause'
            : agrees === false
                ? 'AI Referee found a disagreement'
                : 'AI produced an independent hypothesis';
    const statusTone = compromised
        ? 'border-destructive/40 bg-destructive/[0.04]'
        : agrees === true
            ? 'border-success/35 bg-success/[0.025]'
            : agrees === false
                ? 'border-warning/45 bg-warning/[0.035]'
                : 'border-info/30 bg-info/[0.025]';
    const statusIconTone = compromised
        ? 'bg-destructive/10 text-destructive'
        : agrees === true
            ? 'bg-success/10 text-success'
            : agrees === false
                ? 'bg-warning/10 text-warning'
                : 'bg-info/10 text-info';
    const comparisonLabel = compromised
        ? 'Comparison shown; independence is not guaranteed'
        : agrees === true
            ? 'Same category'
            : agrees === false
                ? 'Different categories'
                : 'No recorded cause to compare';
    const independenceCopy = compromised
        ? 'The blind-evidence audit found possible answer leaks. Treat this comparison as potentially non-independent.'
        : 'The AI formed its finding from investigation evidence without seeing the recorded 5-Why chain or root-cause marker.';
    const citedEvidence = derivedFiveWhy
        .map((step) => String(step.evidence ?? '').trim())
        .filter(Boolean)
        .slice(0, 2);
    const precedentScore = precedent
        ? Math.round(precedent.maxScore > 0
            ? (precedent.score / precedent.maxScore) * 100
            : precedent.score <= 1
                ? precedent.score * 100
                : precedent.score)
        : null;

    return (
        <Card
            role="region"
            aria-label="AI Referee independent root-cause check"
            className={cn('overflow-hidden border-2 p-0', statusTone)}
        >
            <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', statusIconTone)}>
                        <Brain className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-bold">AI Referee</h2>
                            <Badge variant="outline" className="text-xs font-medium">
                                Independent root-cause check
                            </Badge>
                        </div>
                        <div className="mt-1 flex items-start gap-2 text-sm font-semibold">
                            <StatusIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>{statusLabel}</span>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {independenceCopy}
                        </p>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                    <div className="min-w-0 rounded-lg border border-border/70 bg-background/70 p-3">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Cause recorded when analysis ran
                        </div>
                        <CategoryChip category={verdict.recordedCategory} />
                    </div>
                    <div className="hidden items-center justify-center text-muted-foreground sm:flex" aria-hidden="true">
                        <ArrowRight className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 rounded-lg border border-border/70 bg-background/70 p-3">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            AI Referee finding
                        </div>
                        <CategoryChip category={finding.rootCauseCategory || verdict.aiCategory} />
                    </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{comparisonLabel}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {confidence !== null && <span>AI-stated confidence: <strong className="text-foreground">{confidence}%</strong></span>}
                        <span>5-Why built: <strong className="text-foreground">{derivedFiveWhy.length}</strong> steps</span>
                    </span>
                </div>

                <p className="mt-3 break-words text-sm font-medium leading-relaxed text-foreground">
                    {finding.rootCauseStatement || 'The AI did not provide a root-cause statement.'}
                </p>

                <section className="mt-3 rounded-lg border border-border/70 bg-background/65 p-3" aria-label="Evidence cited by AI">
                    {citedEvidence.length > 0 ? (
                        <>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Evidence cited by AI
                            </h3>
                            <ul className="mt-2 space-y-1.5">
                                {citedEvidence.map((item, index) => (
                                    <li key={`${index}-${item}`} className="flex items-start gap-2 text-sm leading-relaxed">
                                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-2 text-xs text-muted-foreground">
                                AI-cited text is generated from the submitted investigation. Verify it against the source records.
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No evidence snippets were returned for this finding. Review the source records before relying on it.
                        </p>
                    )}
                </section>

                {agrees === false && !compromised && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
                        <Scale className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>A disagreement is a signal to review the evidence. It does not prove either conclusion is wrong.</span>
                    </div>
                )}

                {compromised && (
                    <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <div>
                            <p className="font-semibold">The blind-evidence audit found {leaks.length} possible answer leak{leaks.length === 1 ? '' : 's'}.</p>
                            <ul className="mt-1 list-inside list-disc">
                                {leaks.map((leak, index) => <li key={`${index}-${leak}`}>{leak}</li>)}
                            </ul>
                            <p className="mt-1">Treat this comparison as potentially non-independent.</p>
                        </div>
                    </div>
                )}

                {evidenceGaps.length > 0 && (
                    <p className="mt-3 text-sm text-muted-foreground">
                        <HelpCircle className="mr-1 inline h-4 w-4 align-[-3px]" aria-hidden="true" />
                        The AI flagged {evidenceGaps.length} evidence gap{evidenceGaps.length === 1 ? '' : 's'} for human review.
                    </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="-ml-2 gap-1.5 text-sm"
                        aria-expanded={open}
                        onClick={() => setOpen((value) => !value)}
                    >
                        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
                        {open ? 'Hide reasoning and inputs' : 'Review reasoning and inputs'}
                    </Button>
                    {!readOnly && !compromised && onUseAsDraft && (
                        <Button type="button" size="sm" variant="outline" onClick={onUseAsDraft}>
                            Use AI wording as D4 draft
                        </Button>
                    )}
                    {readOnly && (
                        <span className="text-xs text-muted-foreground">D4 is approved and read-only.</span>
                    )}
                </div>
                {!readOnly && !compromised && onUseAsDraft && (
                    <p className="mt-1 text-xs text-muted-foreground">
                        This fills the D4 editor only. Saving and approval remain separate engineer actions.
                    </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                    Comparison uses the cause recorded when this analysis ran. The current D4 conclusion remains editable below.
                </p>
            </div>

            {open && (
                <div className="space-y-5 border-t border-border/70 bg-background/50 px-4 py-5 sm:px-5">
                    <section>
                        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">What the AI received</h3>
                        <p className="text-sm leading-relaxed text-foreground/80">
                            Raw inspection measurements, investigation findings, Is / Is-Not evidence, case context, and containment actions.
                        </p>
                        <h3 className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">What was withheld</h3>
                        <p className="text-sm leading-relaxed text-foreground/80">
                            The recorded 5-Why chain, root-cause marker, corrective and preventive actions, FMEA link, and lessons learned.
                        </p>
                    </section>

                    {derivedFiveWhy.length > 0 && (
                        <section>
                            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">5-Why chain built by AI</h3>
                            <ol className="space-y-3">
                                {derivedFiveWhy.map((step, index) => (
                                    <li key={`${step.stepNo ?? index}-${step.question}`} className="flex gap-3">
                                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                            {step.stepNo ?? index + 1}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold">{step.question}</p>
                                            <p className="mt-0.5 text-sm text-foreground/85">{step.answer}</p>
                                            {step.evidence && <p className="mt-1 text-sm italic text-muted-foreground">AI-cited evidence: {step.evidence}</p>}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                            <p className="mt-2 text-xs text-muted-foreground">Evidence text is not a source-record link; verify it against the original case data.</p>
                        </section>
                    )}

                    {ruledOut.length > 0 && (
                        <section>
                            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Branches considered and ruled out</h3>
                            <div className="space-y-2">
                                {ruledOut.map((item, index) => (
                                    <div key={`${item.category}-${index}`} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 p-3">
                                        <CategoryChip category={item.category} className="shrink-0 opacity-80" />
                                        <p className="text-sm leading-relaxed text-foreground/80">{item.reason}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {finding.runnerUpCategory && (
                        <section>
                            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Next most likely cause</h3>
                            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 p-3">
                                <CategoryChip category={finding.runnerUpCategory} className="shrink-0" />
                                <p className="text-sm leading-relaxed text-foreground/80">
                                    {finding.runnerUpReason || 'No switching evidence was provided.'}
                                </p>
                            </div>
                        </section>
                    )}

                    {evidenceGaps.length > 0 && (
                        <section>
                            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                                <HelpCircle className="h-4 w-4" aria-hidden="true" /> Evidence the AI would ask for
                            </h3>
                            <ul className="space-y-1.5">
                                {evidenceGaps.map((gap, index) => (
                                    <li key={`${index}-${gap}`} className="flex items-start gap-2 text-sm text-foreground/80">
                                        <span className="text-muted-foreground" aria-hidden="true">·</span>
                                        <span>{gap}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {precedent && (
                        <section className="rounded-lg border border-info/25 bg-info/[0.04] p-3">
                            <h3 className="text-sm font-semibold">Related closed case · {precedent.notificationId}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {precedentScore !== null ? `${precedentScore}% similarity. ` : ''}
                                A precedent is a reference, not proof of this case's root cause.
                            </p>
                            {(precedent.defectText || precedent.symptomShortText) && (
                                <p className="mt-2 text-sm text-foreground/80">{precedent.defectText || precedent.symptomShortText}</p>
                            )}
                            {precedent.rerankReason && (
                                <p className="mt-2 text-sm text-info">Match rationale: {precedent.rerankReason}</p>
                            )}
                        </section>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                        <span>Recorded 5-Why steps: <strong className="text-foreground">{verdict.recordedStepCount}</strong></span>
                        <span>Independent 5-Why steps: <strong className="text-foreground">{verdict.aiStepCount}</strong></span>
                    </div>
                </div>
            )}
        </Card>
    );
}
