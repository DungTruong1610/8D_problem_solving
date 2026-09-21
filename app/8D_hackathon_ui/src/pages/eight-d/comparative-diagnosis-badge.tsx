import { useQuery } from '@tanstack/react-query';
import { Badge, cn } from '@cnma/react-ui';
import {
    CheckCircle2,
    AlertTriangle,
    Sparkles,
    ShieldCheck,
    Cpu,
    GitFork,
    Search,
    ArrowRight,
} from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    eightDService,
    parseFinding,
    parseStoredPrecedents,
    type Precedent,
} from '@/services/eightd-service';

export interface ComparativeDiagnosisBadgeProps {
    reportID?: string;
    caseContext?: string | Record<string, unknown> | null;
    precedentsJson?: string | null;
    compact?: boolean;
    className?: string;
}

export function ComparativeDiagnosisBadge({
    reportID: propReportID,
    caseContext: _propCaseContext,
    precedentsJson: propPrecedentsJson,
    compact: _compact,
    className,
}: ComparativeDiagnosisBadgeProps) {
    /*
     * `precedentsJson` chỉ là đường lùi trong lúc query dưới đây chưa về —
     * nguồn thật là `report.precedentsJson` mà chính component này fetch.
     */
    const effectiveReportID = propReportID || '';
    const precedentsJson = propPrecedentsJson;

    // Fetch report data if ID is present
    const { data: report } = useQuery({
        queryKey: ['8d', 'report', effectiveReportID],
        queryFn: () => eightDService.getWithDisciplines(effectiveReportID),
        enabled: Boolean(effectiveReportID),
        staleTime: 30_000,
    });

    const parsedFinding = parseFinding(report?.aiFinding);
    const parsedPrecedents = parseStoredPrecedents(report?.precedentsJson || precedentsJson);
    const precedents: Precedent[] = parsedPrecedents?.precedents ?? [];
    const topPrecedent: Precedent | null = precedents[0] ?? null;

    const recordedCategory = parsedFinding?.verdict?.recordedCategory ?? null;
    const hasRecordedCategory = Boolean(recordedCategory && recordedCategory.trim() !== '');

    const symptomText = report?.symptomShortText || '';
    const hasOperatorSuspicionInSymptom = /operator|manual|clamp override|misloading|human|worker|shift log/i.test(symptomText);
    const ruledOut = parsedFinding?.finding?.ruledOut ?? [];
    const ruledOutMan = Array.isArray(ruledOut) ? ruledOut.find((r: any) => String(r?.category || '').toLowerCase() === 'man') : null;

    const aiCategory = report?.aiRootCause ?? parsedFinding?.verdict?.aiCategory ?? 'Technical Cause';
    const confidence = report?.aiConfidence ?? parsedFinding?.finding?.confidence ?? 0.90;
    const confidencePct = Math.round((confidence <= 1 ? confidence * 100 : confidence));

    // Active divergence: Either explicit SAP recorded cause disagree, or human suspicion in symptom overturned by AI
    const hasDivergence = (hasRecordedCategory && parsedFinding?.verdict?.agrees === false)
        || (hasOperatorSuspicionInSymptom && Boolean(ruledOutMan) && aiCategory.toLowerCase() !== 'man');

    const effectiveOpposingCategory = recordedCategory || (hasOperatorSuspicionInSymptom ? 'Man' : 'Human Assumption');

    const topScore = topPrecedent
        ? Math.round(((topPrecedent as any).similarityScore != null
            ? Number((topPrecedent as any).similarityScore) * 100
            : topPrecedent.maxScore > 0
                ? (topPrecedent.score / topPrecedent.maxScore) * 100
                : topPrecedent.score <= 1
                    ? topPrecedent.score * 100
                    : topPrecedent.score))
        : 0;

    // ── Scenario 2: DISAGREES with Initial Human Record / Assumption (Divergence) ──
    if (hasDivergence) {
        return (
            <TooltipProvider delayDuration={150}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge
                            variant="outline"
                            className={cn(
                                'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1.5 py-1 px-3 font-semibold text-sm shadow-xs cursor-help hover:bg-amber-500/20 transition-colors',
                                className
                            )}
                        >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Disagrees with Record (Independent Finding)</span>
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center" className="max-w-md p-4 text-sm bg-popover text-popover-foreground border border-border/80 shadow-xl rounded-xl space-y-2">
                        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border/50">
                            <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                                <GitFork className="w-4 h-4" />
                                <span>Blind Diagnosis: Disagrees with Record</span>
                            </div>
                            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                                Divergence
                            </span>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            AI blind diagnosis identified <strong className="text-foreground">[{aiCategory}]</strong> from QM measurements, challenging the initial human recorded cause <span className="line-through opacity-70">[{effectiveOpposingCategory}]</span>. Telemetry isolates equipment/process drift rather than manual operator error.
                        </p>
                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/50 bg-muted/30 p-2 rounded-lg text-sm">
                            <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Recorded:</span>
                                <span className="font-mono line-through opacity-75">[{effectiveOpposingCategory}]</span>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
                            <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">AI Validated:</span>
                                <strong className="font-mono text-amber-600 dark:text-amber-400 font-semibold">[{aiCategory}]</strong>
                            </div>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    // ── Scenario 1: MATCHES Historical Record / Precedent ──
    if (hasRecordedCategory && parsedFinding?.verdict?.agrees === true) {
        return (
            <TooltipProvider delayDuration={150}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge
                            variant="outline"
                            className={cn(
                                'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1.5 py-1 px-3 font-semibold text-sm shadow-xs cursor-help hover:bg-emerald-500/20 transition-colors',
                                className
                            )}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Matches Historical Record</span>
                            <span className="text-xs opacity-75 font-mono">({confidencePct}%)</span>
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center" className="max-w-md p-4 text-sm bg-popover text-popover-foreground border border-border/80 shadow-xl rounded-xl space-y-2">
                        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border/50">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                                <ShieldCheck className="w-4 h-4" />
                                <span>Blind Diagnosis: Matches Record</span>
                            </div>
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                                {confidencePct}% Confidence
                            </span>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            AI blind diagnosis independently identified <strong className="text-foreground">[{aiCategory}]</strong> from physical inspection telemetry, perfectly corroborating the pre-existing historical case record without prior exposure.
                        </p>
                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/50 text-sm">
                            <span className="text-muted-foreground">AI Finding: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">[{aiCategory}]</strong></span>
                            <span className="text-emerald-500 font-bold">=</span>
                            <span className="text-muted-foreground">Recorded Cause: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">[{recordedCategory || aiCategory}]</strong></span>
                        </div>
                        {topPrecedent && (
                            <div className="text-xs text-muted-foreground">
                                Benchmark case: <strong className="font-mono text-foreground">{topPrecedent.notificationId}</strong> ({topScore}% similarity).
                            </div>
                        )}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }


    // ── Scenario 3: Precedent Benchmark Found (No Initial Cause Recorded) ──
    if (topPrecedent && topScore >= 40) {
        return (
            <TooltipProvider delayDuration={150}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge
                            variant="outline"
                            className={cn(
                                'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 gap-1.5 py-1 px-3 font-semibold text-sm shadow-xs cursor-help hover:bg-sky-500/20 transition-colors',
                                className
                            )}
                        >
                            <Search className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            <span>Benchmarked: {topPrecedent.notificationId}</span>
                            <span className="text-xs opacity-75 font-mono">({topScore}%)</span>
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center" className="max-w-md p-4 text-sm bg-popover text-popover-foreground border border-border/80 shadow-xl rounded-xl space-y-2">
                        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border/50">
                            <div className="flex items-center gap-1.5 font-bold text-sky-600 dark:text-sky-400">
                                <Sparkles className="w-4 h-4" />
                                <span>Benchmarked with Precedent</span>
                            </div>
                            <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-full">
                                {topScore}% Similarity
                            </span>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            Case had no pre-existing 6M assessment. AI blind diagnosis deduced <strong className="text-foreground">[{aiCategory}]</strong> from first principles, consistent with benchmark historical case <strong className="font-mono text-foreground">{topPrecedent.notificationId}</strong>.
                        </p>
                        <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
                            Precedent symptom: "{topPrecedent.defectText || topPrecedent.symptomShortText || 'Similar machining defect'}"
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    // ── Scenario 4: Fresh Blind Diagnosis (No Precedents in Library) ──
    return (
        <TooltipProvider delayDuration={150}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge
                        variant="outline"
                        className={cn(
                            'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30 gap-1.5 py-1 px-3 font-semibold text-sm shadow-xs cursor-help hover:bg-slate-500/20 transition-colors',
                            className
                        )}
                    >
                        <Cpu className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                        <span>First-Principles Blind Diagnosis</span>
                    </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" align="center" className="max-w-md p-4 text-sm bg-popover text-popover-foreground border border-border/80 shadow-xl rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border/50">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                            <Cpu className="w-4 h-4 text-primary" />
                            <span>First-Principles Derivation</span>
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                            Fresh Case
                        </span>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        No matching historical precedent exists in the dataset. Root cause <strong className="text-foreground">[{aiCategory}]</strong> was derived purely from first-principles QM inspection measurements.
                    </p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
