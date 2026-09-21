import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Card, Spinner } from '@cnma/react-ui';
import { GitBranch, Info } from 'lucide-react';
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
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold text-base">Similar past cases</h2>
                    <Badge variant="secondary" className="text-xs px-2.5 py-0.5 font-semibold">
                        {precedents.length} match{precedents.length === 1 ? '' : 'es'}
                    </Badge>
                </div>
                {data.maxScore > 0 && (
                    <span className="text-sm text-muted-foreground">
                        scored out of {data.maxScore}
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
                                className="group relative rounded-xl border border-border/70 bg-card p-4 space-y-2 hover:border-destructive/40 hover:shadow-xs transition-all cursor-pointer"
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

                                <div className="pt-1">
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
