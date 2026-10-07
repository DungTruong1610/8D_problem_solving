import { useState, type ReactNode } from 'react';
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

    const verdictTone = compromised
        ? { ring: 'border-destructive/40 bg-destructive/[0.05]', icon: 'bg-destructive/10 text-destructive' }
        : agrees === true
            ? { ring: 'border-success/35 bg-success/[0.05]', icon: 'bg-success/10 text-success' }
            : agrees === false
                ? { ring: 'border-warning/45 bg-warning/[0.06]', icon: 'bg-warning/10 text-warning' }
                : { ring: 'border-border bg-muted/30', icon: 'bg-primary/10 text-primary' };

    const SectionTitle = ({ children }: { children: ReactNode }) => (
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>
    );

    return (
        <div role="region" aria-label="AI Referee independent root-cause check" className="space-y-5">
            {/* Kết luận một dòng */}
            <div className={cn('flex items-start gap-3 rounded-xl border p-4', verdictTone.ring)}>
                <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', verdictTone.icon)}>
                    <StatusIcon className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-foreground">{statusLabel}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{independenceCopy}</p>
                </div>
                {confidence !== null && (
                    <div className="shrink-0 text-right">
                        <p className="text-2xl font-semibold tabular-nums leading-none text-foreground">{confidence}%</p>
                        <p className="mt-1 text-xs text-muted-foreground">AI-stated confidence</p>
                    </div>
                )}
            </div>

            {/* So sánh hai nguyên nhân */}
            <div>
                <SectionTitle>Comparison</SectionTitle>
                <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                    <div className="rounded-xl border bg-card p-3.5">
                        <p className="text-xs text-muted-foreground">Recorded when analysis ran</p>
                        <div className="mt-1.5"><CategoryChip category={verdict.recordedCategory} /></div>
                    </div>
                    <ArrowRight className="mx-auto hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
                    <div className="rounded-xl border bg-card p-3.5">
                        <p className="text-xs text-muted-foreground">AI Referee finding</p>
                        <div className="mt-1.5"><CategoryChip category={finding.rootCauseCategory || verdict.aiCategory} /></div>
                    </div>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{comparisonLabel}</p>
            </div>

            {/* Giả thuyết */}
            <div>
                <SectionTitle>Hypothesis</SectionTitle>
                <blockquote className="rounded-r-lg border-l-4 border-primary/50 bg-muted/30 px-4 py-3 text-sm leading-relaxed text-foreground">
                    {finding.rootCauseStatement || 'The AI did not provide a root-cause statement.'}
                </blockquote>
            </div>

            {/* Bằng chứng */}
            <div>
                <SectionTitle>Evidence cited by AI</SectionTitle>
                {citedEvidence.length > 0 ? (
                    <ul className="space-y-2">
                        {citedEvidence.map((item, index) => (
                            <li key={`${index}-${item}`} className="flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm leading-relaxed">
                                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{index + 1}</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">No evidence snippets were returned. Review the source records before relying on this finding.</p>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">Generated from the submitted investigation — verify against the source records.</p>
            </div>

            {agrees === false && !compromised && (
                <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/[0.06] px-3 py-2.5 text-sm text-foreground">
                    <Scale className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                    <span>A disagreement is a signal to review the evidence. It does not prove either conclusion is wrong.</span>
                </div>
            )}

            {compromised && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/[0.06] px-3 py-2.5 text-sm">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                    <div>
                        <p className="font-semibold text-foreground">The blind-evidence audit found {leaks.length} possible answer leak{leaks.length === 1 ? '' : 's'}.</p>
                        <ul className="mt-1 list-inside list-disc text-muted-foreground">
                            {leaks.map((leak, index) => <li key={`${index}-${leak}`}>{leak}</li>)}
                        </ul>
                    </div>
                </div>
            )}

            {/* Chi tiết, mở khi cần */}
            <div className="rounded-xl border">
                <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
                    aria-expanded={open}
                    onClick={() => setOpen((value) => !value)}
                >
                    <span className="text-sm font-medium text-foreground">
                        Reasoning and inputs
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {derivedFiveWhy.length} 5-Why steps
                            {evidenceGaps.length > 0 ? ` · ${evidenceGaps.length} evidence gap${evidenceGaps.length === 1 ? '' : 's'}` : ''}
                            {ruledOut.length > 0 ? ` · ${ruledOut.length} ruled out` : ''}
                        </span>
                    </span>
                    <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
                </button>

                {open && (
                    <div className="space-y-5 border-t px-4 py-4">
                        <section>
                            <SectionTitle>What the AI received</SectionTitle>
                            <p className="text-sm leading-relaxed text-foreground/80">
                                Raw inspection measurements, investigation findings, Is / Is-Not evidence, case context, and containment actions.
                            </p>
                            <div className="mt-3"><SectionTitle>What was withheld</SectionTitle></div>
                            <p className="text-sm leading-relaxed text-foreground/80">
                                The recorded 5-Why chain, root-cause marker, corrective and preventive actions, FMEA link, and lessons learned.
                            </p>
                        </section>

                        {derivedFiveWhy.length > 0 && (
                            <section>
                                <SectionTitle>5-Why chain built by AI</SectionTitle>
                                <ol className="space-y-3">
                                    {derivedFiveWhy.map((step, index) => (
                                        <li key={`${step.stepNo ?? index}-${step.question}`} className="flex gap-3">
                                            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                                {step.stepNo ?? index + 1}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold">{step.question}</p>
                                                <p className="mt-0.5 text-sm text-foreground/85">{step.answer}</p>
                                                {step.evidence && <p className="mt-1 text-sm italic text-muted-foreground">Evidence: {step.evidence}</p>}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        )}

                        {ruledOut.length > 0 && (
                            <section>
                                <SectionTitle>Ruled out</SectionTitle>
                                <div className="space-y-2">
                                    {ruledOut.map((item, index) => (
                                        <div key={`${item.category}-${index}`} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                                            <CategoryChip category={item.category} className="shrink-0 opacity-80" />
                                            <p className="text-sm leading-relaxed text-foreground/80">{item.reason}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {finding.runnerUpCategory && (
                            <section>
                                <SectionTitle>Next most likely cause</SectionTitle>
                                <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
                                    <CategoryChip category={finding.runnerUpCategory} className="shrink-0" />
                                    <p className="text-sm leading-relaxed text-foreground/80">
                                        {finding.runnerUpReason || 'No switching evidence was provided.'}
                                    </p>
                                </div>
                            </section>
                        )}

                        {evidenceGaps.length > 0 && (
                            <section>
                                <SectionTitle>Evidence the AI would ask for</SectionTitle>
                                <ul className="space-y-1.5">
                                    {evidenceGaps.map((gap, index) => (
                                        <li key={`${index}-${gap}`} className="flex items-start gap-2 text-sm text-foreground/80">
                                            <HelpCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
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
                    </div>
                )}
            </div>

            {!readOnly && !compromised && onUseAsDraft && (
                <div className="flex items-center gap-3">
                    <Button type="button" size="sm" variant="outline" onClick={onUseAsDraft}>
                        Use AI wording as D4 draft
                    </Button>
                    <span className="text-xs text-muted-foreground">Fills the editor only — saving and approval stay separate.</span>
                </div>
            )}
        </div>
    );
}
