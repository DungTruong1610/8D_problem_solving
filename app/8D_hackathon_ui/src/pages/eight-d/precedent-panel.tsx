import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, Spinner } from '@cnma/react-ui';
import { GitBranch, Info, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { eightDService, parseStoredPrecedents, type PrecedentResult, type Report8D } from '@/services/eightd-service';

/**
 * Case tiền lệ của một hồ sơ — thiết kế đơn giản, mở thẳng case khi click.
 */
export function PrecedentPanel({ reportID, precedentsJson }: {
    reportID: string;
    precedentsJson?: string | null;
}) {
    const navigate = useNavigate();
    const stored = parseStoredPrecedents(precedentsJson);
    const [expandedCoT, setExpandedCoT] = useState<Record<string, boolean>>({});

    const { data: fetched, isLoading, error } = useQuery<PrecedentResult>({
        queryKey: ['precedents', reportID],
        queryFn: () => eightDService.findPrecedents(reportID),
        enabled: !stored,
        staleTime: 60_000,
    });

    const data = stored ?? fetched;

    const handleOpenCase = async (notificationId: string) => {
        try {
            const res = await eightDService.list();
            const rows = res.value ?? [];
            
            // 1. Exact match by notificationId
            let found = rows.find((r: Report8D) => r.notificationId === notificationId);

            // 2. Substring or numeric match if notificationId format varies
            if (!found) {
                const digits = notificationId.replace(/\D/g, '');
                if (digits) {
                    found = rows.find((r: Report8D) => (r.notificationId ?? '').includes(digits));
                }
            }

            if (found) {
                toast.success(`Opening 8D Report: ${found.notificationId}`);
                navigate(`/8d/${found.ID}`);
            } else if (rows.length > 0) {
                // If this is a historical reference case not yet in active Reports, open the first available report
                toast.info(`Historical case ${notificationId} reference (opening active report ${rows[0].notificationId})`);
                navigate(`/8d/${rows[0].ID}`);
            } else {
                toast.error(`Case ${notificationId} not found in database.`);
            }
        } catch (err) {
            toast.error(`Could not open case: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    if (isLoading) {
        return (
            <Card className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4" />
                Searching past cases…
            </Card>
        );
    }

    if (error || !data) {
        return (
            <Card className="p-5 text-sm text-muted-foreground">
                Could not search past cases: {(error as Error)?.message ?? 'unknown error'}
            </Card>
        );
    }

    const precedents = Array.isArray(data.precedents) ? data.precedents : [];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-destructive" />
                    <h3 className="font-semibold text-sm">Case Library & Precedents</h3>
                </div>
                {precedents.length > 0 && (
                    <span className="text-xs text-muted-foreground font-mono">
                        {precedents.length} match{precedents.length === 1 ? '' : 'es'}
                    </span>
                )}
            </div>

            {!precedents.length ? (
                <Card className="flex items-start gap-3 border-dashed p-5">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="space-y-1">
                        <p className="text-sm font-medium">No comparable case found</p>
                        <p className="text-sm text-muted-foreground">{data.reason}</p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-3">
                    {precedents.map((p) => {
                        const scoreDisplay = p.maxScore ? `${p.score}/${p.maxScore}` : `${p.score}`;
                        const summaryText = p.symptomShortText || p.explanation || 'No summary text available';

                        return (
                            <div
                                key={p.notificationId}
                                onClick={() => handleOpenCase(p.notificationId)}
                                className="group relative rounded-xl border border-border/70 bg-card p-4 space-y-2.5 hover:border-destructive/40 hover:shadow-xs transition-all cursor-pointer"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-base text-foreground group-hover:text-destructive transition-colors">
                                        {p.notificationId}
                                    </span>
                                    <span className="font-bold text-base text-destructive tabular-nums">
                                        {scoreDisplay}
                                    </span>
                                </div>

                                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                                    {summaryText}
                                </p>

                                {p.rerankReason && (
                                    <div className="flex items-start gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5 text-xs text-blue-700 dark:text-blue-300">
                                        <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                                        <div>
                                            <span className="font-semibold">Lý do đối chiếu AI: </span>
                                            <span>{p.rerankReason}</span>
                                        </div>
                                    </div>
                                )}

                                {p.rerankAnalysis && (
                                    <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedCoT(prev => ({ ...prev, [p.notificationId]: !prev[p.notificationId] }))}
                                            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <Sparkles className="w-3 h-3 text-amber-500" />
                                            <span>Phân tích cơ chế hỏng (AI Chain-of-Thought)</span>
                                            {expandedCoT[p.notificationId] ? (
                                                <ChevronUp className="w-3 h-3" />
                                            ) : (
                                                <ChevronDown className="w-3 h-3" />
                                            )}
                                        </button>

                                        {expandedCoT[p.notificationId] && (
                                            <div className="mt-1.5 rounded-md bg-muted/60 border border-border/60 p-2.5 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans">
                                                {p.rerankAnalysis}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="pt-1 flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-destructive underline underline-offset-2 hover:opacity-80">
                                        View root cause &rarr;
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
