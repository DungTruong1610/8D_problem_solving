import { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
    Badge, Button, Input, Label, Switch, cn,
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@cnma/react-ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Boxes, Check, Code2, Copy, GripVertical, Info, LayoutGrid, Sigma, Sparkles,
    Target, Trash2, Users, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    STEP_CODES, type ProfileCriterion, type SourceFieldInfo,
} from '@/services/retrieval-service';
import type { ProfileDraft } from '@/hooks/use-object-schema';

/**
 * Panel 2 — the whole profile: which fields it compares, how heavily each one
 * counts, and the thresholds that decide what qualifies.
 *
 * Fields and weights live on one screen on purpose. Dropping a field changes the
 * reachable score, and the threshold only means something against that score —
 * split across two screens, neither could show the consequence of its own edit.
 */

const STEP_METADATA: Record<string, { title: string; subtitle: string }> = {
    D1: { title: 'Team Formation', subtitle: 'Team members & expert roles' },
    D2: { title: 'Problem Description', subtitle: 'Defect symptoms & scope' },
    D3: { title: 'Containment Actions', subtitle: 'Interim containment actions' },
    D4: { title: 'Root Cause Analysis', subtitle: 'Ishikawa & 5-Why analysis' },
    D5: { title: 'Corrective Actions', subtitle: 'Permanent corrective action plan' },
    D6: { title: 'Implementation', subtitle: 'Action verification & audit' },
    D7: { title: 'Preventive Actions', subtitle: 'FMEA & process prevention' },
    D8: { title: 'Team Recognition', subtitle: 'Case closure & lessons learned' },
};

const METHODS = [
    { value: 'exact', label: 'Exact Match', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', hint: 'Values must be equal, ignoring case and surrounding spaces. For array fields, sharing any one value counts as a match.' },
    { value: 'keyword', label: 'Keyword Match', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30', hint: 'Matches when the two texts share at least one keyword, after dropping filler and short words.' },
    { value: 'family', label: 'Family Group', className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30', hint: 'Equality on a grouping field — used for "same material family".' },
    { value: 'cosine', label: 'Vector (Cosine)', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30', hint: 'Semantic closeness between two case narratives. Score = weight × cosine similarity.' },
    { value: 'rerank', label: 'LLM Re-rank', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30', hint: 'A second-stage pass: an LLM reads the open case and each top candidate together and scores them against the instruction below. Score = weight × (model score / 100). Costs one model call per search.' },
] as const;

const METHOD_BY_VALUE = new Map(METHODS.map((m) => [m.value, m]));

/** Small labelled control with the explanation moved into a hover tooltip. */
function Setting({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                </Label>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/50 hover:text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-64 text-sm">{hint}</TooltipContent>
                </Tooltip>
            </div>
            {children}
        </div>
    );
}

function FieldCard({
    criterion: c, field, maxScore, onPatch, onRemove,
}: {
    criterion: ProfileCriterion;
    field: SourceFieldInfo | undefined;
    maxScore: number;
    onPatch: (patch: Partial<ProfileCriterion>) => void;
    onRemove: () => void;
}) {
    const drag = useDraggable({
        id: `criterion-${c.criterionKey}`,
        data: { criterionKey: c.criterionKey },
    });
    const methodKey = c.matchType || 'exact';
    const methodInfo = METHOD_BY_VALUE.get(methodKey as typeof METHODS[number]['value'])
        ?? { label: methodKey, className: 'bg-muted text-muted-foreground', hint: '' };
    const labelText = field?.label || c.label || c.sourceField;
    const share = maxScore > 0 && c.enabled ? Math.round(((c.weight ?? 0) / maxScore) * 100) : 0;

    return (
        <div
            ref={drag.setNodeRef}
            className={cn(
                'group relative rounded-xl border bg-card p-3 shadow-xs transition-all',
                c.enabled ? 'hover:border-primary/40 hover:shadow-sm' : 'bg-muted/40 opacity-70',
                drag.isDragging && 'opacity-30 scale-98 ring-2 ring-primary/40',
            )}
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                        {...drag.attributes}
                        {...drag.listeners}
                        className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground/60 transition-colors hover:text-foreground active:cursor-grabbing"
                        title="Drag out to remove"
                    >
                        <GripVertical className="h-4 w-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-foreground">{labelText}</div>
                        <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                            <span className="truncate rounded bg-muted/70 px-1.5 py-0.5">
                                {methodKey === 'rerank' ? 'LLM · stage-2 pass' : c.sourceField}
                            </span>
                            {field?.indexed && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Zap className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-sm">
                                        Indexed column — filtered in SQL before scoring.
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            {field?.multiValued && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Sigma className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-sm">
                                        Multiple values per case.
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 shrink-0 pl-7 sm:pl-0">
                    <Select
                        value={methodKey}
                        onValueChange={(v) => onPatch({
                            matchType: v,
                            ...(v === 'cosine'
                                ? {
                                    minSimilarity: c.minSimilarity ?? 0.7,
                                    sourceField: 'embedding',
                                    fallbackMatch: null, fallbackField: null, fallbackWeight: null,
                                }
                                : {}),
                            ...(v === 'rerank'
                                ? {
                                    // Sàn trên thang 0-1 của điểm model (50/100).
                                    minSimilarity: c.minSimilarity ?? 0.5,
                                    // Re-rank không đọc field nào — model đọc văn bản hai case.
                                    sourceField: '',
                                    fallbackMatch: null, fallbackField: null, fallbackWeight: null,
                                }
                                : {}),
                        })}
                    >
                        <SelectTrigger className={cn('h-8 w-32 sm:w-36 border text-xs font-semibold', methodInfo.className)}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {METHODS.map((m) => (
                                <SelectItem key={m.value} value={m.value} className="text-sm">
                                    {m.label}
                                    {field?.methods.includes(m.value) && (
                                        <Badge variant="outline" className="ml-2 h-4 px-1 text-xs font-semibold">
                                            suggested
                                        </Badge>
                                    )}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="flex items-center gap-1">
                        <Input
                            type="number" min={0} max={99}
                            value={c.weight ?? 0}
                            className="h-8 w-14 text-right text-sm font-semibold"
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                if (Number.isFinite(v) && v >= 0) onPatch({ weight: v });
                            }}
                        />
                        <span className="w-7 text-right font-mono text-xs text-muted-foreground">
                            {share}%
                        </span>
                    </div>

                    <Switch checked={c.enabled} onCheckedChange={(enabled) => onPatch({ enabled })} />

                    <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        onClick={onRemove}
                        title="Remove from profile"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {methodKey === 'cosine' && (
                <div className="mt-2.5 flex items-center gap-2 border-t pt-2.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                        Minimum cosine
                    </Label>
                    <Input
                        type="number" min={0} max={1} step={0.01}
                        value={c.minSimilarity ?? 0.7}
                        className="h-8 w-20 text-right text-sm font-semibold"
                        onChange={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isFinite(v) && v >= 0 && v <= 1) onPatch({ minSimilarity: v });
                        }}
                    />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/60" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-72 text-sm">
                            Unrelated English defect narratives already sit around 0.60. A floor below
                            that scores every pair and lets baseline noise decide the ranking.
                        </TooltipContent>
                    </Tooltip>
                </div>
            )}

            {methodKey === 'rerank' && (
                <div className="mt-2.5 space-y-2 border-t pt-2.5">
                    <div className="flex items-center gap-2">
                        <Label className="text-xs font-semibold text-muted-foreground">
                            Minimum score
                        </Label>
                        <Input
                            type="number" min={0} max={1} step={0.05}
                            value={c.minSimilarity ?? 0.5}
                            className="h-8 w-20 text-right text-sm font-semibold"
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                if (Number.isFinite(v) && v >= 0 && v <= 1) onPatch({ minSimilarity: v });
                            }}
                        />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/60" />
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-72 text-sm">
                                On the model's 0–1 scale: 0.5 means a candidate scoring below 50/100
                                gets zero points from this criterion.
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs font-semibold text-muted-foreground">
                            Rerank instruction — the question the model ranks by
                        </Label>
                        <textarea
                            value={c.description ?? ''}
                            rows={2}
                            placeholder='e.g. "Rank by same physical failure mechanism; ignore superficial code matches."'
                            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm leading-relaxed"
                            onChange={(e) => onPatch({ description: e.target.value })}
                        />
                    </div>
                </div>
            )}

            {!field && methodKey !== 'rerank' && (
                <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                    Field <span className="font-mono font-semibold">{c.sourceField}</span> is not in the
                    catalog — this criterion can never score.
                </div>
            )}
        </div>
    );
}

interface ProfileConfigPanelProps {
    draft: ProfileDraft;
    profileKey: string;
    fieldByPath: Map<string, SourceFieldInfo>;
    ownerByStep: Record<string, string>;
    profileLabelOf: (profileKey: string) => string;
    isDragging: boolean;
    maxScore: number;
    /** Fixed to one 8D step — the step editor embeds it this way, so hide the picker. */
    lockedStepCode?: string;
    onChange: (patch: Partial<ProfileDraft>) => void;
}

export function ProfileConfigPanel({
    draft, profileKey, fieldByPath, ownerByStep, profileLabelOf, isDragging, maxScore,
    lockedStepCode, onChange,
}: ProfileConfigPanelProps) {
    const [activeTab, setActiveTab] = useState<'visual' | 'json'>('visual');
    const [copied, setCopied] = useState(false);
    const drop = useDroppable({ id: 'profile-fields' });

    const jsonString = JSON.stringify({
        profileKey,
        label: draft.label,
        description: draft.description,
        assignedStep: draft.steps[0] ?? null,
        retrieval: { minScore: draft.minScore, topN: draft.topN, closedOnly: draft.closedOnly },
        maxScore,
        criteria: draft.fields.map((c) => ({
            criterionKey: c.criterionKey,
            sourceField: c.sourceField,
            matchType: c.matchType || 'exact',
            weight: c.weight ?? 1,
            minSimilarity: c.minSimilarity ?? null,
            enabled: Boolean(c.enabled),
        })),
    }, null, 2);

    const patchField = (criterionKey: string, patch: Partial<ProfileCriterion>) => onChange({
        fields: draft.fields.map((f) => (f.criterionKey === criterionKey ? { ...f, ...patch } : f)),
    });

    const enabledCount = draft.fields.filter((f) => f.enabled).length;

    return (
        <main className="flex min-w-0 flex-1 flex-col bg-muted/20 overflow-hidden">
            <div className="border-b bg-card p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-semibold text-foreground min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Boxes className="h-4 w-4" />
                        </div>
                        <span className="truncate text-sm">
                            {lockedStepCode
                                ? `${lockedStepCode} · ${STEP_METADATA[lockedStepCode]?.title ?? ''} — Similarity Schema`
                                : 'Profile Configuration'}
                        </span>
                    </div>

                    <div className="flex items-center gap-1 rounded-lg bg-muted/80 p-1 text-sm font-medium shrink-0">
                        {([['visual', LayoutGrid, 'Visual Editor'], ['json', Code2, 'JSON Schema']] as const)
                            .map(([id, Icon, text]) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setActiveTab(id)}
                                    className={cn(
                                        'flex items-center gap-1.5 rounded-md px-3 py-1 transition-all',
                                        activeTab === id
                                            ? 'bg-background text-foreground shadow-xs font-semibold'
                                            : 'text-muted-foreground hover:bg-background/40 hover:text-foreground',
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {text}
                                </button>
                            ))}
                    </div>
                </div>
            </div>

            {activeTab === 'json' ? (
                <div className="flex flex-1 flex-col overflow-hidden p-4">
                    <div className="flex items-center justify-between rounded-t-xl border border-b-0 bg-card px-4 py-2.5">
                        <div className="flex items-center gap-2">
                            <Code2 className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold text-foreground">{profileKey}.json</span>
                        </div>
                        <Button
                            size="sm" variant="outline"
                            className="h-8 gap-1.5 text-sm font-semibold"
                            onClick={() => {
                                void navigator.clipboard.writeText(jsonString);
                                setCopied(true);
                                toast.success('JSON schema copied to clipboard');
                                setTimeout(() => setCopied(false), 2000);
                            }}
                        >
                            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied ? 'Copied' : 'Copy JSON'}
                        </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-b-xl border bg-slate-950 p-4 font-mono text-sm text-slate-100 dark:bg-slate-900">
                        <pre className="whitespace-pre-wrap leading-relaxed">{jsonString}</pre>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0">
                    <div className="space-y-4 p-4 w-full min-w-0">
                        {/* ── Identity ── */}
                        <div className="grid gap-3 rounded-xl border bg-card p-3.5 shadow-xs grid-cols-1 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Profile Name
                                </Label>
                                <Input
                                    value={draft.label}
                                    className="h-8.5 text-sm font-medium"
                                    placeholder="e.g. Root Cause Analysis Profile"
                                    onChange={(e) => onChange({ label: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Description
                                </Label>
                                <Input
                                    value={draft.description}
                                    className="h-8.5 text-sm"
                                    placeholder="What kind of similarity does this profile capture?"
                                    onChange={(e) => onChange({ description: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* ── Retrieval settings + reachable score ── */}
                        <div className="rounded-xl border bg-card p-3.5 shadow-xs">
                            <div className="mb-3 flex items-center gap-2 border-b pb-2.5">
                                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                                    <Target className="h-3.5 w-3.5" />
                                </div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                                    Retrieval Settings
                                </h3>
                            </div>

                            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                                <Setting
                                    label="Min Score"
                                    hint="Below this score nothing is surfaced at all — the step is told there is no precedent rather than handed a weak one."
                                >
                                    <Input
                                        type="number" min={0} step={0.5}
                                        value={draft.minScore}
                                        className="h-8.5 text-right text-sm font-semibold"
                                        onChange={(e) => {
                                            const v = Number(e.target.value);
                                            if (Number.isFinite(v) && v >= 0) onChange({ minScore: v });
                                        }}
                                    />
                                </Setting>

                                <Setting label="Top N" hint="How many precedents this step receives, best match first.">
                                    <Input
                                        type="number" min={1} max={20}
                                        value={draft.topN}
                                        className="h-8.5 text-right text-sm font-semibold"
                                        onChange={(e) => {
                                            const v = Number(e.target.value);
                                            if (Number.isFinite(v) && v >= 1) onChange({ topN: v });
                                        }}
                                    />
                                </Setting>

                                <Setting label="Closed Only" hint="Only completed or closed cases qualify as precedents.">
                                    <div className="flex h-8.5 items-center">
                                        <Switch
                                            checked={draft.closedOnly}
                                            onCheckedChange={(v) => onChange({ closedOnly: v })}
                                        />
                                    </div>
                                </Setting>

                                <Setting
                                    label="Reachable Score"
                                    hint="The weights of every enabled field. Disabling a field lowers this ceiling too, so 5 out of 8 still reads as a strong match."
                                >
                                    <div className="flex h-8.5 min-w-0 items-baseline gap-1.5 overflow-hidden">
                                        <span className="min-w-0 truncate font-mono text-xl font-bold text-foreground" title={String(maxScore)}>
                                            {maxScore}
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {enabledCount}/{draft.fields.length} on
                                        </span>
                                    </div>
                                </Setting>
                            </div>
                        </div>

                        {/* ── 8D binding (standalone page only) ── */}
                        {!lockedStepCode && (
                            <div className="rounded-xl border bg-card p-3.5 shadow-xs">
                                <div className="mb-3 flex items-center gap-2 border-b pb-2.5">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                                        <Users className="h-3.5 w-3.5" />
                                    </div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                                        Assigned 8D Step
                                    </h3>
                                </div>

                                <Select
                                    value={draft.steps[0] ?? 'none'}
                                    onValueChange={(val) => onChange({ steps: val === 'none' ? [] : [val] })}
                                >
                                    <SelectTrigger className="h-9 max-w-md text-sm font-medium">
                                        <SelectValue placeholder="Select an 8D step..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none" className="text-sm text-muted-foreground">
                                            None (Unassigned)
                                        </SelectItem>
                                        {STEP_CODES.map((code) => {
                                            const meta = STEP_METADATA[code] ?? { title: code, subtitle: '' };
                                            const owner = ownerByStep[code];
                                            const isOwnedByOther = owner && owner !== profileKey;
                                            return (
                                                <SelectItem key={code} value={code} className="text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-primary">{code}</span>
                                                        <span>{meta.title}</span>
                                                        {isOwnedByOther && (
                                                            <span className="text-xs text-muted-foreground">
                                                                (currently {profileLabelOf(owner)})
                                                            </span>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* ── Criteria dropzone ── */}
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                    Matching Criteria ({draft.fields.length})
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    Drag in from the catalog · drag out to remove
                                </span>
                            </div>

                            <div
                                ref={drop.setNodeRef}
                                className={cn(
                                    'min-h-72 space-y-2.5 rounded-xl border-2 border-dashed p-3.5 transition-all duration-150',
                                    drop.isOver
                                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                                        : isDragging
                                            ? 'border-primary/40 bg-primary/5'
                                            : 'border-border/70 bg-card/60',
                                )}
                            >
                                {draft.fields.map((c) => (
                                    <FieldCard
                                        key={c.criterionKey}
                                        criterion={c}
                                        field={fieldByPath.get(c.sourceField ?? '')}
                                        maxScore={maxScore}
                                        onPatch={(patch) => patchField(c.criterionKey, patch)}
                                        onRemove={() => onChange({
                                            fields: draft.fields.filter((f) => f.criterionKey !== c.criterionKey),
                                        })}
                                    />
                                ))}

                                {!draft.fields.length && (
                                    <div className="flex min-h-60 flex-col items-center justify-center text-center">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                            <Sparkles className="h-6 w-6" />
                                        </div>
                                        <p className="mt-3 text-sm font-semibold text-foreground">
                                            No matching criteria yet
                                        </p>
                                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                                            Drag fields from the catalog on the left to decide what makes two
                                            cases similar.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
