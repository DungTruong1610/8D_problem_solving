import { useEffect, useState } from 'react';
import {
    Badge, Button, Label, Select, SelectContent, SelectItem, SelectTrigger,
    SelectValue, Spinner, cn,
} from '@cnma/react-ui';
import { CheckCircle2, ChevronRight, FlaskConical, Play, Sparkles, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
    embedLibrary, getLibraryCases, previewScore,
    type LibraryCase, type ScorePreview,
} from '@/services/retrieval-service';

/**
 * Panel 3 — what the current settings actually do.
 *
 * Weights and thresholds are abstract until you see them applied. This scores
 * two real cases from the library with the profile as configured and says, in
 * one line, whether this step would have been shown that case at all.
 */

const LEVEL_STYLE: Record<string, string> = {
    exact: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
    fallback: 'border-amber-500/40 text-amber-600 dark:text-amber-400',
    none: 'border-border text-muted-foreground',
};

interface StepScorePanelProps {
    stepCode: string;
    profileKey: string;
    minScore: number;
    maxScore: number;
    /** Unsaved edits are not what the server scores with — say so. */
    dirty: boolean;
    defaultCollapsed?: boolean;
}

export function StepScorePanel({
    stepCode, profileKey, minScore, maxScore, dirty, defaultCollapsed = false,
}: StepScorePanelProps) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
    const [cases, setCases] = useState<LibraryCase[]>([]);
    const [caseA, setCaseA] = useState('');
    const [caseB, setCaseB] = useState('');
    const [result, setResult] = useState<ScorePreview | null>(null);
    const [running, setRunning] = useState(false);
    const [embedding, setEmbedding] = useState(false);

    const loadCases = () => getLibraryCases()
        .then((rows) => {
            setCases(rows);
            setCaseA((current) => current || rows[0]?.notificationId || '');
            setCaseB((current) => current || rows[1]?.notificationId || '');
        })
        .catch((e: any) => toast.error(`Could not load case library: ${e.message}`));

    useEffect(() => { void loadCases(); }, []);

    const embedded = cases.filter((c) => c.embeddingModel);
    const notEmbedded = cases.length - embedded.length;
    const qualifies = result && !result.error && result.score >= minScore;

    return (
        <aside
            className={cn(
                'relative flex shrink-0 flex-col border-l bg-card transition-all duration-300 ease-in-out',
                isCollapsed ? 'w-12 items-center' : 'w-80',
            )}
        >
            {isCollapsed ? (
                <div className="flex h-full w-full flex-col items-center justify-between py-3.5">
                    <div className="flex flex-col items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsCollapsed(false)}
                            className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10"
                            title="Expand Test Configuration"
                        >
                            <FlaskConical className="h-4 w-4" />
                        </Button>
                        <div
                            className="cursor-pointer [writing-mode:vertical-lr] text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors select-none py-2"
                            onClick={() => setIsCollapsed(false)}
                            title="Click to expand Test Configuration"
                        >
                            Test Configuration
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-1.5 text-center px-1">
                        <span className="text-xs text-muted-foreground font-mono">
                            {embedded.length}/{cases.length}
                        </span>
                        <div
                            className={cn(
                                'h-2 w-2 rounded-full',
                                notEmbedded === 0 ? 'bg-emerald-500' : 'bg-amber-500',
                            )}
                            title={`Embeddings: ${embedded.length}/${cases.length}`}
                        />
                    </div>
                </div>
            ) : (
                <>
                    <div className="border-b p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <FlaskConical className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-semibold">Test Configuration</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsCollapsed(true)}
                            className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
                            title="Collapse panel"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0">
                        <div className="space-y-4 p-3.5">
                            {dirty && (
                                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                                    Scores below use the <span className="font-semibold">saved</span> profile.
                            Save to test your current edits.
                        </div>
                    )}

                    {([['Case A', caseA, setCaseA], ['Case B', caseB, setCaseB]] as const).map(
                        ([label, value, setValue]) => (
                            <div key={label} className="space-y-1.5">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    {label}
                                </Label>
                                <Select value={value} onValueChange={setValue}>
                                    <SelectTrigger className="h-9 font-mono text-sm">
                                        <SelectValue placeholder="Select a case" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {cases.map((c) => (
                                            <SelectItem key={c.notificationId} value={c.notificationId} className="font-mono text-sm">
                                                {c.notificationId}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ),
                    )}

                    <Button
                        size="sm"
                        className="w-full gap-1.5 h-9 text-sm font-semibold"
                        disabled={!caseA || !caseB || caseA === caseB || running}
                        onClick={async () => {
                            setRunning(true);
                            try {
                                setResult(await previewScore(caseA, caseB, profileKey));
                            } catch (e: any) {
                                toast.error(`Scoring failed: ${e?.response?.data?.error?.message ?? e.message}`);
                            } finally {
                                setRunning(false);
                            }
                        }}
                    >
                        {running ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        Score this pair
                    </Button>

                    {result?.error && (
                        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-sm text-destructive">
                            {result.error}
                        </p>
                    )}

                    {result && !result.error && (
                        <div className="space-y-3">
                            <div
                                className={cn(
                                    'rounded-xl border p-3 text-center',
                                    qualifies
                                        ? 'border-emerald-500/40 bg-emerald-500/5'
                                        : 'border-border bg-muted/40',
                                )}
                            >
                                <div className="min-w-0 overflow-hidden font-mono text-3xl font-bold text-foreground truncate" title={`${result.score}/${result.maxScore}`}>
                                    {result.score}
                                    <span className="text-lg text-muted-foreground">/{result.maxScore}</span>
                                </div>
                                <div
                                    className={cn(
                                        'mt-1.5 flex items-center justify-center gap-1.5 text-sm font-semibold',
                                        qualifies
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    {qualifies
                                        ? <><CheckCircle2 className="h-3.5 w-3.5" /> {stepCode} would see this case</>
                                        : <><XCircle className="h-3.5 w-3.5" /> Below threshold {minScore} — {stepCode} would not</>}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                {result.breakdown.map((b) => (
                                    <div
                                        key={b.criterionKey}
                                        className="flex items-center justify-between gap-2 rounded-lg border bg-background px-2.5 py-2 text-xs"
                                    >
                                        <span className="min-w-0 flex-1 truncate font-medium text-foreground text-xs" title={b.label}>
                                            {b.label}
                                            {/* Preview chấm bằng code thuần, không gọi model — dòng
                                                re-rank vì thế luôn 0 ở đây. Nói thẳng thay vì để
                                                người xem tưởng tiêu chí hỏng. */}
                                            {b.criterionKey === 'rerank' && (
                                                <span className="ml-1.5 font-normal text-xs italic text-muted-foreground">
                                                    (LLM pass — not simulated in preview)
                                                </span>
                                            )}
                                        </span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Badge variant="outline" className={cn('h-4 px-1.5 text-xs font-semibold', LEVEL_STYLE[b.level])}>
                                                {b.level}
                                            </Badge>
                                            <span className="min-w-[3rem] shrink-0 text-right font-mono font-semibold text-foreground text-xs">
                                                {b.points}/{b.maxPoints}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {result.breakdown.some((b) => b.matchedOn) && (
                                <div className="space-y-1.5 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
                                    {result.breakdown.filter((b) => b.matchedOn).map((b) => (
                                        <div key={b.criterionKey} className="break-words leading-relaxed text-sm">
                                            <span className="font-semibold text-foreground">{b.label}:</span>{' '}
                                            <span className="font-mono text-xs text-foreground/80">{b.matchedOn}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-2 border-t p-3.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Embeddings</span>
                    <span className="font-mono font-medium text-foreground">
                        {embedded.length}/{cases.length}
                    </span>
                </div>
                {notEmbedded > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                        {notEmbedded} case{notEmbedded === 1 ? '' : 's'} cannot be matched by meaning yet.
                    </p>
                )}
                <Button
                    size="sm" variant="outline"
                    className="w-full gap-1.5 h-9 text-sm font-semibold"
                    disabled={embedding || cases.length === 0}
                    onClick={async () => {
                        setEmbedding(true);
                        try {
                            const report = await embedLibrary(false);
                            toast.success(
                                `Embedded ${report.embedded}, skipped ${report.skipped}, failed ${report.failed}.`,
                            );
                            await loadCases();
                        } catch (e: any) {
                            toast.error(`Embedding failed: ${e?.response?.data?.error?.message ?? e.message}`);
                        } finally {
                            setEmbedding(false);
                        }
                    }}
                >
                    {embedding ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Embed missing cases
                </Button>
                <div className="text-xs text-muted-foreground">
                    Reachable score <span className="font-mono font-semibold text-foreground">{maxScore}</span>
                    {' · '}threshold <span className="font-mono font-semibold text-foreground">{minScore}</span>
                </div>
            </div>
                </>
            )}
        </aside>
    );
}
