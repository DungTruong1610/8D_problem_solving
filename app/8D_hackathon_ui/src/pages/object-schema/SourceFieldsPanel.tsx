import { useMemo, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
    Badge, Input, cn,
} from '@cnma/react-ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Database, GripVertical, Search, Sigma, X, Zap } from 'lucide-react';
import type { SourceFieldInfo } from '@/services/retrieval-service';

/**
 * Panel 1 — All available SAP source fields scanned from historical cases.
 */

function riskOf(field: SourceFieldInfo): 'none' | 'constant' | 'unique' {
    if (field.origin === 'derived' || field.occurrence === 0) return 'none';
    if (field.distinctValues <= 1) return 'constant';
    if (field.distinctValues === field.occurrence && field.occurrence > 2) return 'unique';
    return 'none';
}

const RISK_STYLE: Record<string, string> = {
    constant: 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 dark:bg-amber-500/10',
    unique: 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 dark:bg-amber-500/10',
    none: 'border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5',
};

function FieldChip({ field, disabled }: { field: SourceFieldInfo; disabled: boolean }) {
    const drag = useDraggable({ id: `source-${field.path}`, disabled, data: { field } });
    const risk = riskOf(field);

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    ref={drag.setNodeRef}
                    {...drag.attributes}
                    {...drag.listeners}
                    className={cn(
                        'group relative flex w-full min-w-0 max-w-full items-center gap-2 rounded-lg border p-2 text-sm transition-all duration-150',
                        RISK_STYLE[risk],
                        disabled
                            ? 'cursor-not-allowed opacity-45 grayscale-[0.3]'
                            : 'cursor-grab hover:shadow-xs active:cursor-grabbing',
                        drag.isDragging && 'opacity-25 scale-95 ring-2 ring-primary/40',
                    )}
                >
                    <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-muted-foreground" />
                    
                    <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate font-semibold text-foreground min-w-0 text-sm">{field.label}</span>
                            {disabled && (
                                <Badge variant="secondary" className="h-4.5 shrink-0 px-1.5 font-mono text-xs font-semibold">
                                    Added
                                </Badge>
                            )}
                        </div>
                        <p className="truncate font-mono text-xs text-muted-foreground/80">{field.path}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                        {field.indexed && (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" title="Indexed SQL column">
                                <Zap className="h-3 w-3" />
                            </span>
                        )}
                        {field.multiValued && (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-sky-500/10 text-sky-600 dark:text-sky-400" title="Multi-valued collection">
                                <Sigma className="h-3 w-3" />
                            </span>
                        )}
                    </div>
                </div>
            </TooltipTrigger>
            <TooltipContent
                side="right"
                className="max-w-85 space-y-2 rounded-xl border border-red-200 bg-white p-3.5 text-sm text-slate-800 shadow-2xl dark:border-red-200 dark:bg-white dark:text-slate-800"
            >
                <div className="flex items-start justify-between gap-2 border-b border-red-100 pb-1.5">
                    <span className="min-w-0 flex-1 break-all font-mono text-sm font-bold text-red-600 leading-tight">
                        {field.path}
                    </span>
                    <span className="shrink-0 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-xs font-semibold text-red-700">
                        {field.origin === 'derived' ? 'Derived' : 'Source Field'}
                    </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-700">{field.note}</p>
                {field.sampleValues.length > 0 && (
                    <div className="rounded-lg border border-red-100 bg-red-50/70 p-2 font-mono text-xs text-slate-700">
                        <span className="font-sans font-bold text-red-700">Samples: </span>
                        {field.sampleValues.join(' · ')}
                    </div>
                )}
                <div className="flex items-center gap-2 pt-0.5 font-mono text-xs text-slate-500">
                    <span>{field.occurrence} cases</span>
                    <span>•</span>
                    <span>{field.distinctValues} unique values</span>
                    <span>•</span>
                    <span className={field.indexed ? 'font-bold text-red-600' : 'text-slate-600'}>
                        {field.indexed ? 'SQL Indexed' : 'JSON Scanned'}
                    </span>
                </div>
            </TooltipContent>
        </Tooltip>
    );
}

interface SourceFieldsPanelProps {
    fields: SourceFieldInfo[];
    caseCount: number;
    usedPaths: Set<string>;
}

export function SourceFieldsPanel({ fields, caseCount, usedPaths }: SourceFieldsPanelProps) {
    const [query, setQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'indexed' | 'derived'>('all');
    const drop = useDroppable({ id: 'source-fields' });

    const groups = useMemo(() => {
        const needle = query.trim().toLowerCase();
        let matched = needle
            ? fields.filter((f) =>
                f.path.toLowerCase().includes(needle) || f.label.toLowerCase().includes(needle))
            : fields;

        if (filterType === 'indexed') {
            matched = matched.filter((f) => f.indexed);
        } else if (filterType === 'derived') {
            matched = matched.filter((f) => f.origin === 'derived');
        }

        const byGroup = new Map<string, SourceFieldInfo[]>();
        for (const field of matched) {
            const list = byGroup.get(field.group) ?? [];
            list.push(field);
            byGroup.set(field.group, list);
        }
        return [...byGroup.entries()].sort(([a], [b]) => {
            if (a === 'derived') return 1;
            if (b === 'derived') return -1;
            return a.localeCompare(b);
        });
    }, [fields, query, filterType]);

    return (
        <aside
            ref={drop.setNodeRef}
            className={cn(
                'flex w-64 shrink-0 flex-col border-r bg-card/50 transition-colors overflow-hidden',
                drop.isOver && 'bg-destructive/10 ring-2 ring-inset ring-destructive/40',
            )}
        >
            {/* Header */}
            <div className="border-b p-3.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Database className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-semibold">Source Field Catalog</span>
                    </div>
                    <Badge variant="secondary" className="h-5 font-mono text-xs font-semibold px-1.5">
                        {fields.length}
                    </Badge>
                </div>

                <p className="mt-1.5 text-sm text-muted-foreground leading-normal">
                    {caseCount > 0
                        ? `Scanned from ${caseCount} historical 8D cases. Drag fields into the profile to include them in similarity scoring.`
                        : 'No historical cases found. Load case library to scan source fields.'}
                </p>

                {/* Search Bar */}
                <div className="relative mt-3">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search field or path..."
                        className="h-9 pl-8.5 pr-8 text-sm shadow-none focus-visible:ring-1"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Quick Filters */}
                <div className="mt-2 flex items-center gap-1 rounded-md bg-muted/60 p-0.5 text-xs">
                    <button
                        type="button"
                        onClick={() => setFilterType('all')}
                        className={cn(
                            'flex-1 rounded py-1 font-medium transition-all',
                            filterType === 'all'
                                ? 'bg-background text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        All ({fields.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterType('indexed')}
                        className={cn(
                            'flex-1 rounded py-1 font-medium transition-all',
                            filterType === 'indexed'
                                ? 'bg-background text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        Indexed ({fields.filter((f) => f.indexed).length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterType('derived')}
                        className={cn(
                            'flex-1 rounded py-1 font-medium transition-all',
                            filterType === 'derived'
                                ? 'bg-background text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        Derived ({fields.filter((f) => f.origin === 'derived').length})
                    </button>
                </div>
            </div>

            {/* Field Groups List */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0">
                <div className="space-y-4 p-3 w-full min-w-0">
                    {groups.map(([group, groupFields]) => (
                        <div key={group} className="space-y-1.5 w-full min-w-0">
                            <div className="flex items-center justify-between px-1 min-w-0">
                                <span className="truncate text-xs font-semibold tracking-wider uppercase text-muted-foreground min-w-0">
                                    {group === 'derived' ? 'Derived Metrics' : group}
                                </span>
                                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                    {groupFields.length} {groupFields.length === 1 ? 'field' : 'fields'}
                                </span>
                            </div>
                            <div className="space-y-1 w-full min-w-0">
                                {groupFields.map((field) => (
                                    <FieldChip
                                        key={field.path}
                                        field={field}
                                        disabled={usedPaths.has(field.path)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}

                    {!groups.length && (
                        <div className="flex min-h-32 flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground">
                            <Database className="mb-2 h-6 w-6 opacity-30" />
                            <p className="font-medium text-foreground">No fields match filter</p>
                            <p className="mt-1 text-xs">
                                {fields.length
                                    ? 'Try adjusting your search or category filter.'
                                    : 'Scan case library to generate source fields.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Legend Footer */}
            <div className="space-y-1.5 border-t bg-card/80 p-3 text-xs text-muted-foreground w-full min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Zap className="h-3 w-3" />
                    </span>
                    <span className="truncate">Indexed column (Fast SQL pre-filtering)</span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-sky-500/10 text-sky-600 dark:text-sky-400">
                        <Sigma className="h-3 w-3" />
                    </span>
                    <span className="truncate">Multi-valued collection</span>
                </div>
            </div>
        </aside>
    );
}

