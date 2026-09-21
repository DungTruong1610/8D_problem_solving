import { useState } from 'react';
import {
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    cn,
} from '@cnma/react-ui';
import { Check, Copy, Database, Search, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { resolveEvidencePath } from '../../../../../shared/evidence-path';

/**
 * Renders resolved evidence value: plain string/number, formatted JSON, or structured key-value table.
 */
function EvidenceValue({ value }: { value: unknown }) {
    const [copied, setCopied] = useState(false);

    if (value === null) return <span className="italic text-muted-foreground">null</span>;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return <span className="break-words font-mono text-sm font-medium">{String(value)}</span>;
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(value, null, 2));
        setCopied(true);
        toast.success('Evidence data copied to clipboard.');
        setTimeout(() => setCopied(false), 2000);
    };

    // Array of objects: Render cleanly structured cards
    if (Array.isArray(value)) {
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-border/60">
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Record List ({value.length} items)
                    </span>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-sm px-2.5 text-muted-foreground hover:text-foreground gap-1.5"
                        onClick={handleCopy}
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied' : 'Copy JSON'}
                    </Button>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {value.map((item, idx) => (
                        <div key={idx} className="rounded-lg border bg-muted/25 p-3 text-sm space-y-1">
                            <span className="inline-block rounded bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary text-xs mb-1">
                                #{idx + 1}
                            </span>
                            {item && typeof item === 'object' ? (
                                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                                    {Object.entries(item).map(([k, v]) => (
                                        <div key={k} className="contents">
                                            <dt className="font-mono text-muted-foreground font-medium">{k}:</dt>
                                            <dd className="break-words font-mono text-foreground">
                                                {v === null || v === '' ? <span className="italic text-muted-foreground">empty</span> : (typeof v === 'object' ? JSON.stringify(v) : String(v))}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            ) : (
                                <p className="font-mono">{String(item)}</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

    // Flat object rendered as key/value table
    if (record && Object.values(record).every((v) => v === null || typeof v !== 'object')) {
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-border/60">
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Record Attributes
                    </span>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-sm px-2.5 text-muted-foreground hover:text-foreground gap-1.5"
                        onClick={handleCopy}
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied' : 'Copy JSON'}
                    </Button>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 py-1">
                    {Object.entries(record).map(([k, v]) => (
                        <div key={k} className="contents">
                            <dt className="font-mono text-sm font-medium text-muted-foreground">{k}</dt>
                            <dd className="break-words font-mono text-sm text-foreground">
                                {v === null || v === '' ? <span className="italic text-muted-foreground">empty</span> : String(v)}
                            </dd>
                        </div>
                    ))}
                </dl>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-end">
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-sm px-2.5 text-muted-foreground hover:text-foreground gap-1.5"
                    onClick={handleCopy}
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy JSON'}
                </Button>
            </div>
            <pre className="max-h-80 overflow-auto rounded bg-muted/60 p-3 font-mono text-sm leading-relaxed">
                {JSON.stringify(value, null, 2)}
            </pre>
        </div>
    );
}

export function EvidenceDrawer({
    path,
    caseContext,
    onClose,
}: {
    path: string | null;
    caseContext: string | null | undefined;
    onClose: () => void;
}) {
    if (!path) return null;

    let root: unknown = null;
    let parseError: string | null = null;
    try {
        root = caseContext ? JSON.parse(caseContext) : null;
    } catch (e: any) {
        parseError = e?.message ?? 'caseContext is not valid JSON.';
    }

    const resolved = parseError ? null : resolveEvidencePath(root, path);

    return (
        <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl md:max-w-3xl overflow-hidden">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-1">
                        <Database className="w-4 h-4 text-primary shrink-0" />
                        <DialogTitle className="font-mono text-sm sm:text-base break-all">{path}</DialogTitle>
                        {resolved?.found && (
                            <Badge variant="outline" className="text-xs px-2.5 py-0.5 font-semibold bg-success/10 text-success border-success/30">
                                Verified Fact
                            </Badge>
                        )}
                    </div>
                    <DialogDescription className="text-sm">
                        Raw evidence record extracted directly from QM system at case analysis time.
                    </DialogDescription>
                </DialogHeader>

                {parseError && (
                    <p className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        <TriangleAlert className="mt-px h-4 w-4 shrink-0" />
                        Case context could not be read: {parseError}
                    </p>
                )}

                {resolved && !resolved.found && (
                    <p className="flex items-start gap-2 rounded border border-warning/40 bg-warning/[0.06] px-3 py-2 text-sm">
                        <TriangleAlert className="mt-px h-4 w-4 shrink-0 text-warning" />
                        <span>
                            <strong className="font-semibold">Path cannot be resolved in snapshot:</strong> {resolved.reason}
                        </span>
                    </p>
                )}

                {resolved?.found && (
                    <div className="min-w-0 rounded-xl border bg-card/60 p-4 text-sm shadow-xs">
                        <EvidenceValue value={resolved.value} />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * Clickable source chips list.
 */
export function SourceChips({
    sources,
    caseContext,
    className,
}: {
    sources: string[];
    caseContext: string | null | undefined;
    className?: string;
}) {
    const [open, setOpen] = useState<string | null>(null);

    return (
        <>
            <div className={cn('flex flex-wrap gap-1.5', className)}>
                {sources.map((source, i) => (
                    <button
                        key={`${source}-${i}`}
                        type="button"
                        onClick={() => setOpen(source)}
                        title="Show the record behind this source"
                        className="group inline-flex max-w-full items-center gap-1 break-all rounded bg-muted px-2.5 py-1 font-mono text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary cursor-pointer"
                    >
                        <Search className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                        {source}
                    </button>
                ))}
            </div>
            <EvidenceDrawer path={open} caseContext={caseContext} onClose={() => setOpen(null)} />
        </>
    );
}
