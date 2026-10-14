import { useState } from 'react';
import {
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    cn,
} from '@cnma/react-ui';
import { ArrowRight, Check, CheckCircle2, Clock, Copy, FileJson, Hand, XCircle } from 'lucide-react';
import { JUDGE_STOP_LABEL } from '../../../../../shared/judge-evaluation';
import type { TestCaseResult } from '@/pages/guide/guide-data';

/** Phần mô tả tĩnh của một test case (tên, nhóm, file input) — không phải kết quả. */
export interface TestCaseMeta {
    id: string;
    title: string;
    quadrant: string;
    jsonPath: string;
}

interface TestCaseReportModalProps {
    meta: TestCaseMeta | null;
    /** Kết quả của LẦN CHẠY VỪA RỒI. Popup chỉ hiện thứ đã đo được. */
    result: TestCaseResult | null;
    executedAt: string | null;
    canOpenCase: boolean;
    onOpenCase: () => void;
    onClose: () => void;
}

/** Tên khoá trong `details` → nhãn đọc được. */
function humanize(key: string): string {
    return key
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (c) => c.toUpperCase());
}

function isPrecedentList(v: unknown): v is { notificationId: string; explanation: string }[] {
    return Array.isArray(v) && v.every((x) => x && typeof x === 'object' && 'notificationId' in x);
}

function DetailValue({ value }: { value: unknown }) {
    if (value === null || value === undefined || value === '') {
        return <span className="text-muted-foreground">None</span>;
    }
    if (isPrecedentList(value)) {
        return value.length === 0 ? (
            <span className="text-muted-foreground">None qualified</span>
        ) : (
            <ul className="space-y-1">
                {value.map((p) => (
                    <li key={p.notificationId} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-mono font-semibold text-foreground">{p.notificationId}</span>
                        <span className="text-muted-foreground">{p.explanation}</span>
                    </li>
                ))}
            </ul>
        );
    }
    if (Array.isArray(value)) {
        return (
            <ul className="list-disc space-y-1 pl-4">
                {value.map((v, i) => <li key={i}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</li>)}
            </ul>
        );
    }
    if (typeof value === 'object') {
        return (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                    <div key={k} className="contents">
                        <dt className="text-muted-foreground">{humanize(k)}</dt>
                        <dd className="text-foreground">{String(v)}</dd>
                    </div>
                ))}
            </dl>
        );
    }
    return <span className="break-words text-foreground">{String(value)}</span>;
}

function buildCopyText(meta: TestCaseMeta, result: TestCaseResult, executedAt: string | null): string {
    const lines = [
        `${meta.id} - ${meta.title} (${meta.quadrant})`,
        `Status: ${result.status} in ${result.durationMs}ms${executedAt ? `, run at ${new Date(executedAt).toLocaleString()}` : ''}`,
        `Input file: ${meta.jsonPath}`,
        '',
        `Input: ${result.inputSummary}`,
        `Expected: ${result.expectedBehavior}`,
        `Actual: ${result.actualBehavior}`,
    ];
    if (result.stops?.length) {
        lines.push('', 'Stops:');
        for (const s of result.stops) lines.push(`- [${s.type}] ${s.step}: ${s.reason} (asks ${s.requiredRole}: ${s.questionForHuman})`);
    }
    lines.push('', 'Measured details:', JSON.stringify(result.details ?? {}, null, 2));
    return lines.join('\n');
}

/**
 * Tóm tắt MỘT test case từ kết quả chạy thật.
 *
 * Bản trước là một bài viết tay soạn từ Sprint 1 — "PASS", "1528ms", "100%
 * similarity on pgvector", cả ma trận D1-D8 "COMPLETE" — hiện y nguyên dù lần
 * chạy có ra sao. Giờ mọi thứ trong popup đều đọc từ `result`; chưa chạy thì
 * không có gì để tóm tắt.
 */
export function TestCaseReportModal({ meta, result, executedAt, canOpenCase, onOpenCase, onClose }: TestCaseReportModalProps) {
    const [copied, setCopied] = useState(false);
    const open = Boolean(meta && result);
    const passed = result?.status === 'PASS';

    const copy = async () => {
        if (!meta || !result) return;
        try {
            await navigator.clipboard.writeText(buildCopyText(meta, result, executedAt));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard bị chặn (trang không ở HTTPS / không có quyền) — nút giữ nguyên.
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
                {meta && result && (
                    <>
                        <DialogHeader className="space-y-2 border-b px-6 py-5 text-left">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">{meta.id}</span>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        'gap-1 font-semibold',
                                        passed ? 'border-success/30 bg-success-bg text-success' : 'border-destructive/30 bg-error-bg text-destructive',
                                    )}
                                >
                                    {passed ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                                    {result.status}
                                </Badge>
                                <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                                    <Clock className="size-3.5" />
                                    {result.durationMs}ms
                                </span>
                            </div>
                            <DialogTitle className="text-lg">{meta.title}</DialogTitle>
                            <DialogDescription>
                                {meta.quadrant} - live run{executedAt ? ` at ${new Date(executedAt).toLocaleString()}` : ''}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5 overflow-y-auto px-6 py-5 text-sm">
                            <section className="space-y-1.5">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Input</h3>
                                <p className="text-foreground">{result.inputSummary}</p>
                                <p className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                                    <FileJson className="size-3.5" />
                                    {meta.jsonPath}
                                </p>
                            </section>

                            <section className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1.5 rounded-lg border bg-muted/30 p-4">
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expected</h3>
                                    <p className="text-foreground">{result.expectedBehavior}</p>
                                </div>
                                <div
                                    className={cn(
                                        'space-y-1.5 rounded-lg border p-4',
                                        passed ? 'border-success/30 bg-success-bg' : 'border-destructive/30 bg-error-bg',
                                    )}
                                >
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actual (this run)</h3>
                                    <p className="text-foreground">{result.actualBehavior}</p>
                                </div>
                            </section>

                            <section className="space-y-2">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Where the AI stopped</h3>
                                {result.stops && result.stops.length > 0 ? (
                                    <ul className="space-y-2">
                                        {result.stops.map((s) => (
                                            <li key={s.id} className="space-y-1 rounded-lg border p-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="outline" className="font-semibold">{JUDGE_STOP_LABEL[s.type]}</Badge>
                                                    <span className="font-mono text-xs text-muted-foreground">{s.step}</span>
                                                    {!s.blocking && <span className="text-xs text-muted-foreground">non-blocking</span>}
                                                </div>
                                                <p className="text-foreground">{s.reason}</p>
                                                <p className="inline-flex items-start gap-1.5 text-muted-foreground">
                                                    <Hand className="mt-0.5 size-3.5 shrink-0" />
                                                    <span>Asks {s.requiredRole}: {s.questionForHuman}</span>
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-muted-foreground">No stop - the AI may proceed.</p>
                                )}
                            </section>

                            <section className="space-y-2">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Measured in this run</h3>
                                <dl className="divide-y rounded-lg border">
                                    {Object.entries(result.details ?? {}).map(([key, value]) => (
                                        <div key={key} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[12rem_1fr] sm:gap-4">
                                            <dt className="text-muted-foreground">{humanize(key)}</dt>
                                            <dd><DetailValue value={value} /></dd>
                                        </div>
                                    ))}
                                </dl>
                            </section>
                        </div>

                        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-6 py-4 sm:justify-between">
                            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copy}>
                                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                                {copied ? 'Copied' : 'Copy summary'}
                            </Button>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    disabled={!canOpenCase}
                                    title={canOpenCase ? undefined : `No 8D report for ${result.notificationId ?? meta.id} in this database`}
                                    onClick={onOpenCase}
                                >
                                    Open case
                                    <ArrowRight className="size-3.5" />
                                </Button>
                                <Button type="button" size="sm" onClick={onClose}>Close</Button>
                            </div>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
