import { createContext, useContext, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Badge, cn } from '@cnma/react-ui';
import {
    Database,
    ExternalLink,
    GitBranch,
    Info,
    Link as LinkIcon,
    Search,
    Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    eightDService,
    parseList,
    parseStoredPrecedents,
    type Discipline8D,
    type Precedent,
    type Report8D,
} from '@/services/eightd-service';
import { EvidenceDrawer } from './evidence-drawer';

/* ─────────────────────────────────────────────────────────────────────────────
   Case Provenance Context (Shared caseContext & precedentsJson across 8D report)
   ───────────────────────────────────────────────────────────────────────── */

interface CaseProvenanceState {
    caseContext: string | Record<string, unknown> | null;
    precedentsJson: string | null;
    reportID?: string;
}

const CaseProvenanceContext = createContext<CaseProvenanceState>({
    caseContext: null,
    precedentsJson: null,
    reportID: '',
});

export function CaseProvenanceProvider({
    caseContext,
    precedentsJson,
    reportID,
    children,
}: {
    caseContext?: string | Record<string, unknown> | null;
    precedentsJson?: string | null;
    reportID?: string;
    children: ReactNode;
}) {
    return (
        <CaseProvenanceContext.Provider
            value={{
                caseContext: caseContext ?? null,
                precedentsJson: precedentsJson ?? null,
                reportID,
            }}
        >
            {children}
        </CaseProvenanceContext.Provider>
    );
}

export function useCaseProvenance() {
    return useContext(CaseProvenanceContext);
}

export interface AiProvenanceInfoProps {
    fieldKey?: string;
    label?: string;
    discipline?: Discipline8D | null;
    caseContext?: string | Record<string, unknown> | null;
    precedentsJson?: string | null;
    customReasoning?: string[];
    className?: string;
    iconClassName?: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
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
 * Extract AI reasoning, data provenance, citations, and benchmark precedents.
 * Runs 100% on client side with ZERO impact on Analyze latency.
 */
export function extractAiProvenance({
    fieldKey,
    discipline,
    caseContext,
    precedentsJson,
    customReasoning,
}: {
    fieldKey?: string;
    discipline?: Discipline8D | null;
    caseContext?: string | Record<string, unknown> | null;
    precedentsJson?: string | null;
    customReasoning?: string[];
}) {
    const ctx = parseJsonSafe(caseContext);
    const discData = parseJsonSafe(discipline?.resultJson);
    const parsedPrecedentsResult = parseStoredPrecedents(precedentsJson);
    const precedents: Precedent[] = parsedPrecedentsResult?.precedents ?? (ctx?.precedents || []);
    const topPrecedent: Precedent | null = precedents[0] ?? null;

    const scoreVal = topPrecedent ? (
        (topPrecedent as any).similarityScore != null
            ? Number((topPrecedent as any).similarityScore)
            : topPrecedent.maxScore > 0
                ? topPrecedent.score / topPrecedent.maxScore
                : topPrecedent.score <= 1
                    ? topPrecedent.score
                    : topPrecedent.score / 100
    ) : 0;

    const notifId = ctx?.notificationId || ctx?.header?.notificationId || 'Active 8D Report';
    const defectCode = ctx?.product?.defectCode || ctx?.defect?.defectCode || ctx?.defectCode || 'DEF-QM';
    const defectText = ctx?.product?.defectText || ctx?.defect?.defectText || ctx?.header?.symptomShortText || ctx?.defectText || 'Manufacturing Quality Defect';
    const material = ctx?.product?.materialDesc || ctx?.product?.materialId || ctx?.materialDesc || ctx?.materialId || 'Machined Component';
    const workCenter = ctx?.product?.workCenterDesc || ctx?.product?.workCenterId || ctx?.workCenterDesc || ctx?.workCenterId || 'Production Work Center';
    const quantity = ctx?.header?.quantityExtent || ctx?.quantityExtent || 'Full Affected Lot';

    const bullets: string[] = [];
    const citations: string[] = [];

    // Extract citations from discipline.sources if available
    if (discipline?.sources) {
        const parsedSources = parseList(discipline.sources);
        citations.push(...parsedSources);
    }

    let method = 'QM Records & AI Inference';
    let methodType: 'sap' | 'vector' | 'ai' | 'hybrid' = 'sap';

    const code = discipline?.code || (fieldKey ? fieldKey.split('.')[0].toUpperCase() : 'D');
    const isDataBacked = discipline ? discipline.dataBacked : true;

    // 1. Classification & Precedent Benchmarking
    if (topPrecedent && scoreVal > 0.3) {
        methodType = 'vector';
        const scorePct = Math.round(scoreVal * 100);
        method = `Similarity Search (${scorePct}% match with ${topPrecedent.notificationId})`;
        bullets.push(`Citing past case: ${topPrecedent.notificationId} (${scorePct}% similarity) — "${topPrecedent.symptomShortText || topPrecedent.defectText || 'Similar completed 8D case'}"`);

        if (topPrecedent.materialDesc || topPrecedent.materialId) {
            bullets.push(`Precedent material: ${topPrecedent.materialId || 'MAT-QM'} — ${topPrecedent.materialDesc || 'Similar material'} (Work Center: ${topPrecedent.workCenterDesc || topPrecedent.workCenterId || 'Machining'})`);
        }

        if (precedents.length > 1) {
            const others = precedents.slice(1, 3).map((p) => {
                const s = Math.round(((p as any).similarityScore ?? (p.maxScore > 0 ? p.score / p.maxScore : p.score <= 1 ? p.score : p.score / 100)) * 100);
                return `${p.notificationId} (${s}%)`;
            }).join(', ');
            bullets.push(`Other reference cases: ${others}`);
        }
    } else if (!isDataBacked) {
        methodType = 'ai';
        method = 'AI Generative Synthesis';
        bullets.push(`Evidence basis: Notification ${notifId} — Synthesized from technical symptoms; no direct source record in current dataset.`);
    } else {
        methodType = 'sap';
        method = 'Direct QM Extraction';
        bullets.push(`Evidence basis: Extracted directly from QM inspection results and notification events (${notifId}).`);
    }

    // 2. Defect & Current Scope Info
    bullets.push(`Associated defect: ${defectCode} — "${defectText}".`);
    bullets.push(`Scope & asset: ${material} at ${workCenter} (Extent: ${quantity}).`);

    // 3. Telemetry & Inspection Measurements
    const inspections = Array.isArray(ctx?.inspections) ? ctx.inspections : [];
    const outOfSpecInspections = inspections.filter((i: any) => i.outOfSpec === true || (i.measuredValue && i.specValue));
    if (outOfSpecInspections.length > 0) {
        const inspSummary = outOfSpecInspections
            .slice(0, 2)
            .map((i: any) => `${i.characteristic || 'Measurement'}: ${i.measuredValue} (Spec: ${i.specValue})`)
            .join('; ');
        bullets.push(`Verified inspection values: ${inspSummary}.`);
    }

    // Context-sensitive citations if sources list is empty
    if (citations.length === 0) {
        if (code === 'D1' || fieldKey?.startsWith('team')) {
            if (ctx?.team?.leader || discData?.team?.leader) citations.push('team.leader');
            if (ctx?.team?.members?.length || discData?.team?.members?.length) citations.push('team.members');
        } else if (code === 'D2' || fieldKey?.startsWith('problem')) {
            citations.push('header.symptomShortText');
            if (inspections.length > 0) citations.push('inspections#1');
            if (ctx?.isIsNot || discData?.isIsNot) citations.push('isIsNot');
        } else if (code === 'D3' || fieldKey?.startsWith('containment')) {
            citations.push('header.quantityExtent');
            if (ctx?.actions?.containment?.length || discData?.containment?.actions?.length) citations.push('actions.containment#1');
        } else if (code === 'D4' || fieldKey?.startsWith('rootCause') || fieldKey?.startsWith('fiveWhy') || fieldKey?.startsWith('ishikawa')) {
            if (ctx?.fiveWhyChain?.length || discData?.fiveWhyChain?.length) citations.push('fiveWhy#1');
            if (ctx?.causesIshikawa?.length || discData?.causesIshikawa?.length) citations.push('ishikawa.Measurement');
        } else if (code === 'D5' || fieldKey?.startsWith('corrective')) {
            if (ctx?.actions?.corrective?.length || discData?.corrective?.actions?.length) citations.push('actions.corrective#1');
        } else if (code === 'D6' || fieldKey?.startsWith('verification')) {
            if (inspections.length > 0) citations.push('inspections#1');
        } else if (code === 'D7' || fieldKey?.startsWith('preventive') || fieldKey?.startsWith('fmea')) {
            if (ctx?.fmea?.fmeaId || discData?.fmea?.fmeaId) citations.push('fmea');
            if (ctx?.actions?.preventive?.length || discData?.preventive?.actions?.length) citations.push('actions.preventive#1');
        } else if (code === 'D8' || fieldKey?.startsWith('closure')) {
            if (ctx?.lessonsLearned || discData?.closure?.lessonsLearned) citations.push('lessonsLearned');
            if (ctx?.copqEur || discData?.closure?.copqEur) citations.push('copqEur');
        }
    }

    // 4. Engineering Rationale per Discipline / Field
    if (customReasoning && customReasoning.length > 0) {
        bullets.push(...customReasoning);
    } else if (fieldKey?.startsWith('fiveWhy')) {
        const match = fieldKey.match(/#(\d+)/);
        const stepNum = match ? parseInt(match[1], 10) : 1;
        const whyChain = ctx?.fiveWhyChain || discData?.fiveWhyChain || [];
        const currentWhy = whyChain[stepNum - 1];
        if (currentWhy) {
            bullets.push(`Reasoning & rationale: Step ${stepNum} investigates "${currentWhy.question}" ➔ "${currentWhy.answer}". ${topPrecedent ? `Correlated with root mechanism from precedent ${topPrecedent.notificationId}.` : 'Derived from technical root-cause investigation.'}`);
        } else {
            bullets.push(`Reasoning & rationale: Step ${stepNum} isolates underlying causes along the 5-Why chain ${topPrecedent ? `(benchmarked against ${topPrecedent.notificationId})` : ''} to reach root cause.`);
        }
    } else if (fieldKey?.startsWith('ishikawa')) {
        const cat = fieldKey.split('.')[1] || 'Measurement';
        const ishikawaRows = ctx?.causesIshikawa || discData?.causesIshikawa || [];
        const matchingRow = ishikawaRows.find((r: any) => String(r.category).toLowerCase() === cat.toLowerCase());
        if (matchingRow && (matchingRow.finding || matchingRow.description)) {
            const isRoot = matchingRow.isRootCause === true || matchingRow.isRootCause === 'Y' || matchingRow.isRootCause === 'true';
            bullets.push(`Assessment: ${isRoot ? 'Validated primary root cause category.' : 'Assessed contributing factor.'}`);
            bullets.push(`Observed finding: "${matchingRow.finding || matchingRow.description}".`);
        } else {
            bullets.push(`Assessment: Not assessed (No findings recorded under [${cat}]).`);
            bullets.push(`Observation: Neither QM source telemetry nor AI investigation identified contributing factors under [${cat}] for this defect.`);
        }
    } else if (code === 'D1' || fieldKey?.startsWith('team')) {
        bullets.push(`Reasoning & rationale: Cross-functional 8D team assembled with expertise in ${workCenter} and ${material} ${topPrecedent ? `(aligning with successful resolution team at ${topPrecedent.notificationId})` : ''}.`);
        const leader = discData?.team?.leader || ctx?.team?.leader;
        if (leader) {
            bullets.push(`Team Champion / Leader: ${leader}.`);
        }
    } else if (code === 'D2' || fieldKey?.startsWith('problem')) {
        bullets.push('Reasoning & rationale: Bounded using 5W2H and Is / Is-Not matrix to isolate exact defect occurrence boundaries.');
        const stmt = discData?.problem?.statement || ctx?.problem?.statement || ctx?.header?.symptomShortText;
        if (stmt) {
            bullets.push(`Problem statement: "${stmt}".`);
        }
    } else if (code === 'D3' || fieldKey?.startsWith('containment')) {
        bullets.push(`Reasoning & rationale: Emergency quarantine of ${quantity} to stop non-conforming parts reaching downstream processes or customers ${topPrecedent ? `(matching containment action in ${topPrecedent.notificationId})` : ''}.`);
        const cActions = discData?.containment?.actions || ctx?.actions?.containment;
        if (Array.isArray(cActions) && cActions.length > 0) {
            bullets.push(`Containment actions: ${cActions.length} quarantine action item(s) recorded.`);
        }
    } else if (code === 'D4' || fieldKey?.startsWith('rootCause')) {
        const rootCat = discData?.rootCause?.category || (discData?.rootCause as any)?.confirmedRootCategory || ctx?.rootCause?.category || 'Technical Cause';
        bullets.push(`Reasoning & rationale: 5-Why chain and Ishikawa 6M synthesis converged on [${rootCat}] ${topPrecedent ? `(consistent with validated root cause in ${topPrecedent.notificationId})` : ''}.`);
        const rootStmt = discData?.rootCause?.statement || discData?.rootCause?.description || ctx?.rootCause?.statement;
        if (rootStmt) {
            bullets.push(`Validated root cause mechanism: "${rootStmt}".`);
        }
    } else if (code === 'D5' || fieldKey?.startsWith('corrective')) {
        bullets.push(`Reasoning & rationale: Permanent corrective action targeting validated root mechanism ${topPrecedent ? `(leveraging proven solution from ${topPrecedent.notificationId})` : ''}.`);
        const pActions = discData?.corrective?.actions || ctx?.actions?.corrective;
        if (Array.isArray(pActions) && pActions.length > 0) {
            bullets.push(`Corrective action items: ${pActions.length} permanent action(s) defined.`);
        }
    } else if (code === 'D6' || fieldKey?.startsWith('verification')) {
        bullets.push('Reasoning & rationale: In-process re-verification plan established against engineering tolerances and action milestones.');
    } else if (code === 'D7' || fieldKey?.startsWith('preventive') || fieldKey?.startsWith('fmea')) {
        const fmeaId = discData?.fmea?.fmeaId || ctx?.fmea?.fmeaId || 'FMEA Record';
        bullets.push(`Reasoning & rationale: Updating work instructions and FMEA entry (${fmeaId}) to prevent recurrence.`);
        const prevActions = discData?.preventive?.actions || ctx?.actions?.preventive;
        if (Array.isArray(prevActions) && prevActions.length > 0) {
            bullets.push(`Preventive action items: ${prevActions.length} systemic prevention action(s) scheduled.`);
        }
    } else if (code === 'D8' || fieldKey?.startsWith('closure')) {
        bullets.push('Reasoning & rationale: Assessing 8D closure gate criteria, COPQ impact, and lessons learned.');
    }

    return {
        method,
        methodType,
        defectRef: `${defectCode} (${notifId})`,
        precedent: topPrecedent,
        citations: Array.from(new Set(citations)),
        bullets,
    };
}

export function AiProvenanceInfo({
    fieldKey,
    label,
    discipline,
    caseContext: propCaseContext,
    precedentsJson: propPrecedentsJson,
    customReasoning,
    className,
    iconClassName,
    side = 'top',
}: AiProvenanceInfoProps) {
    const inherited = useCaseProvenance();
    const caseContext = propCaseContext !== undefined ? propCaseContext : inherited.caseContext;
    const precedentsJson = propPrecedentsJson !== undefined ? propPrecedentsJson : inherited.precedentsJson;

    const navigate = useNavigate();
    const [evidencePath, setEvidencePath] = useState<string | null>(null);

    const provenance = extractAiProvenance({
        fieldKey,
        discipline,
        caseContext,
        precedentsJson,
        customReasoning,
    });

    const isVector = provenance.methodType === 'vector';
    const isAi = provenance.methodType === 'ai';

    const caseContextStr = typeof caseContext === 'string'
        ? caseContext
        : caseContext ? JSON.stringify(caseContext) : null;

    const handleOpenPrecedent = async (notificationId: string) => {
        try {
            const res = await eightDService.list();
            const rows = res.value ?? [];
            let found = rows.find((r: Report8D) => r.notificationId === notificationId);
            if (!found) {
                const digits = notificationId.replace(/\D/g, '');
                if (digits) {
                    found = rows.find((r: Report8D) => (r.notificationId ?? '').includes(digits));
                }
            }

            if (found) {
                toast.success(`Opening precedent 8D report: ${found.notificationId}`);
                navigate(`/8d/${found.ID}`);
            } else {
                toast.info(`Precedent case ${notificationId} is indexed in reference database.`);
            }
        } catch (err: any) {
            toast.error(`Could not open case: ${err?.message || String(err)}`);
        }
    };

    return (
        <>
            <TooltipPrimitive.Provider delayDuration={100}>
                <TooltipPrimitive.Root>
                    <TooltipPrimitive.Trigger asChild>
                        <button
                            type="button"
                            aria-label="Inspect AI reasoning and evidence provenance"
                            className={cn(
                                'inline-flex items-center justify-center p-1 rounded-full text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors cursor-help focus:outline-none focus:ring-1 focus:ring-primary/40',
                                className,
                            )}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Info className={cn('w-4 h-4', iconClassName)} />
                        </button>
                    </TooltipPrimitive.Trigger>
                    <TooltipPrimitive.Portal>
                        <TooltipPrimitive.Content
                            side={side}
                            align="start"
                            sideOffset={8}
                            className="z-50 max-w-sm sm:max-w-md p-4 bg-card text-card-foreground border border-border shadow-2xl rounded-xl text-sm space-y-2.5 text-left animate-in fade-in-0 zoom-in-95 pointer-events-auto ring-1 ring-black/5 dark:ring-white/10"
                        >
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-2">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                {isVector ? (
                                    <GitBranch className="w-4 h-4 text-info" />
                                ) : isAi ? (
                                    <Sparkles className="w-4 h-4 text-warning" />
                                ) : (
                                    <Database className="w-4 h-4 text-primary" />
                                )}
                                <span className="text-sm font-semibold">AI Rationale & Provenance</span>
                            </div>
                            <Badge
                                variant="outline"
                                className={cn(
                                    'text-xs px-2 py-0.5 font-medium border',
                                    isVector && 'bg-info/10 text-info border-info/30',
                                    isAi && 'bg-warning/10 text-warning border-warning/30',
                                    !isVector && !isAi && 'bg-primary/10 text-primary border-primary/30',
                                )}
                            >
                                {provenance.method}
                            </Badge>
                        </div>

                        {label && (
                            <div className="text-sm font-medium text-muted-foreground">
                                {fieldKey ? 'Field:' : 'Step:'} <strong className="text-foreground">{label}</strong>
                            </div>
                        )}

                        {/* Bullet Points */}
                        <ul className="space-y-1.5 text-foreground/90 leading-relaxed text-sm">
                            {provenance.bullets.map((bullet, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                    <span className="text-primary font-bold shrink-0 mt-0.5">•</span>
                                    <span className="break-words">{bullet}</span>
                                </li>
                            ))}
                        </ul>

                        {/* Interactive Citations */}
                        {provenance.citations.length > 0 && (
                            <div className="pt-2 border-t border-border/70">
                                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                                    <LinkIcon className="w-3.5 h-3.5 text-primary" />
                                    <span>Cited Evidence & Records (Click to inspect source fact):</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {provenance.citations.map((cite, i) => (
                                        <button
                                            key={`${cite}-${i}`}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEvidencePath(cite);
                                            }}
                                            title={`Inspect source record for ${cite}`}
                                            className="group inline-flex items-center gap-1 px-2.5 py-1 rounded bg-muted/80 hover:bg-primary/15 text-foreground/80 hover:text-primary font-mono text-xs transition-colors border border-border/80 cursor-pointer"
                                        >
                                            <Search className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                                            <span>{cite}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Interactive Precedent Hyperlink (Only when benchmarked via Similarity Search) */}
                        {isVector && provenance.precedent && (
                            <div className="pt-1.5">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (provenance.precedent?.notificationId) {
                                            handleOpenPrecedent(provenance.precedent.notificationId);
                                        }
                                    }}
                                    className="w-full flex items-center justify-between gap-2 p-2 rounded-lg bg-info/10 hover:bg-info/20 text-info border border-info/25 text-sm font-medium transition-colors cursor-pointer"
                                    title={`Navigate to precedent report ${provenance.precedent.notificationId}`}
                                >
                                    <span className="flex items-center gap-1.5 truncate">
                                        <GitBranch className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate">
                                            Referenced Precedent Case: <strong>{provenance.precedent.notificationId}</strong>
                                        </span>
                                    </span>
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                </button>
                            </div>
                        )}
                        </TooltipPrimitive.Content>
                    </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>
            </TooltipPrimitive.Provider>

            {/* Evidence Drawer Modal */}
            <EvidenceDrawer
                path={evidencePath}
                caseContext={caseContextStr}
                onClose={() => setEvidencePath(null)}
            />
        </>
    );
}

export default AiProvenanceInfo;
