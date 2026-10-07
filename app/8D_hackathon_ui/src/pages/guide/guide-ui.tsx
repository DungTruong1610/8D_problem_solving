import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, cn } from '@cnma/react-ui';

/** Title + one-line description that opens every tab, so all five read alike. */
export function TabIntro({ title, description, action }: {
    title: string;
    description: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

export function GuideCard({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <div className={cn('rounded-xl border bg-card p-5 shadow-xs', className)}>
            {children}
        </div>
    );
}

export function IconTile({ children }: { children: ReactNode }) {
    return (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {children}
        </div>
    );
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            // Clipboard is blocked outside secure contexts; nothing useful to do.
        }
    };

    return (
        <Button type="button" variant="outline" size="sm" onClick={copy} className="gap-1.5">
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
            <span>{copied ? 'Copied' : label}</span>
        </Button>
    );
}
