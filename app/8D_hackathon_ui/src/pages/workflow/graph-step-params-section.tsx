import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Badge,
    Button,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Spinner,
    Switch,
    Textarea,
    cn,
} from '@cnma/react-ui';
import { AlertTriangle, Check, Info, RotateCcw, Save, Scale } from 'lucide-react';
import { toast } from 'sonner';
import {
    getGraphStepDiagnostics,
    getGraphStepParams,
    updateGraphStepParams,
    type GraphStepDiagnostic,
    type GraphStepParams,
} from '@/services/retrieval-service';
import {
    ACTION_TYPES,
    WEIGHT_FIELDS,
    issueFor,
    parseNumberInput,
    validateStepParams,
} from './graph-step-validation';

/**
 * Trọng số truy hồi bằng graph, tám bước D1…D8.
 *
 * ── Vì sao màn hình này phải hiện "đang chạy" tách khỏi "đã lưu" ──
 * `normalizeStepParams` từ chối cả dòng khi nó vi phạm bất biến, rồi im lặng
 * dùng hằng số mặc định — dấu vết duy nhất là một dòng WARN trong log server.
 * Một màn hình chỉ hiện dòng đã lưu sẽ cho admin thấy đúng con số họ vừa gõ, nằm
 * yên trong ô, trong khi hệ thống chạy bằng con số khác. Nên mọi bước ở cột trái
 * đều mang phán quyết lấy từ backend, và bước bị từ chối nói ra lý do.
 *
 * ── Vì sao không có nút xoá ──
 * "Về mặc định" ở đây là tắt công tắc `enabled`, không phải xoá dòng: backend
 * đọc `enabled === false` rồi dùng mặc định NGAY, không coi đó là vi phạm, và
 * con số cũ vẫn nằm nguyên để bật lại. Xoá dòng cũng ra mặc định nhưng mất hết
 * những gì đã chỉnh — và service cũng không cấp quyền DELETE.
 */

const NUMBER_INPUT = 'h-8 text-xs tabular-nums';

function StatusDot({ diag }: { diag: GraphStepDiagnostic | undefined }) {
    if (!diag) return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />;
    if (diag.violation) return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />;
    if (!diag.accepted) return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />;
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />;
}

function NumberField({
    label,
    hint,
    value,
    error,
    onChange,
}: {
    label: string;
    hint?: string;
    value: number | null;
    error?: string | null;
    onChange: (v: number | null) => void;
}) {
    return (
        <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
            <Input
                type="number"
                value={value ?? ''}
                placeholder="—"
                onChange={(e) => onChange(parseNumberInput(e.target.value))}
                className={cn(NUMBER_INPUT, error && 'border-destructive focus-visible:ring-destructive/30')}
            />
            {error ? (
                <p className="text-[10.5px] leading-snug text-destructive">{error}</p>
            ) : hint ? (
                <p className="text-[10.5px] leading-snug text-muted-foreground">{hint}</p>
            ) : null}
        </div>
    );
}

function FrameField({
    label,
    hint,
    value,
    onChange,
}: {
    label: string;
    hint: string;
    value: string | null;
    onChange: (v: string | null) => void;
}) {
    return (
        <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
            <Textarea
                rows={3}
                value={value ?? ''}
                placeholder="Empty — the step's built-in frame is used"
                onChange={(e) => onChange(e.target.value.trim() === '' ? null : e.target.value)}
                className="text-xs leading-relaxed"
            />
            <p className="text-[10.5px] leading-snug text-muted-foreground">{hint}</p>
        </div>
    );
}

export function GraphStepParamsSection() {
    const queryClient = useQueryClient();
    const [selected, setSelected] = useState<string>('D1');
    const [draft, setDraft] = useState<GraphStepParams | null>(null);

    const rowsQuery = useQuery({
        queryKey: ['graph', 'stepParams'],
        queryFn: getGraphStepParams,
        staleTime: 10_000,
    });

    const diagQuery = useQuery({
        queryKey: ['graph', 'diagnostics'],
        queryFn: getGraphStepDiagnostics,
        staleTime: 10_000,
    });

    const rows = useMemo(() => rowsQuery.data ?? [], [rowsQuery.data]);
    const stored = rows.find((r) => r.stepCode === selected) ?? null;
    const diagnostics = diagQuery.data;
    const diagByCode = useMemo(
        () => new Map((diagnostics?.steps ?? []).map((s) => [s.stepCode, s])),
        [diagnostics],
    );

    // Đổi bước ⇒ bỏ bản nháp dở. Giữ lại nghĩa là con số của bước trước lặng lẽ
    // đi theo sang bước sau, và một lần bấm Save sẽ ghi đè bằng số của bước khác.
    useEffect(() => {
        setDraft(stored ? { ...stored } : null);
    }, [stored]);

    const save = useMutation({
        mutationFn: (row: GraphStepParams) => {
            const { stepCode, ...patch } = row;
            return updateGraphStepParams(stepCode, patch);
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['graph', 'stepParams'] }),
                queryClient.invalidateQueries({ queryKey: ['graph', 'diagnostics'] }),
            ]);
            toast.success('Saved. Takes effect within 30 seconds (config cache).');
        },
        onError: (e: any) => {
            toast.error(e?.response?.data?.error?.message ?? e?.message ?? 'Could not save.');
        },
    });

    if (rowsQuery.isLoading || diagQuery.isLoading) {
        return (
            <div className="flex items-center gap-2 rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4" /> Loading graph step parameters…
            </div>
        );
    }

    if (rowsQuery.isError) {
        return (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                Could not load graph step parameters:{' '}
                {(rowsQuery.error as Error)?.message ?? 'unknown error'}
            </div>
        );
    }

    const issues = draft ? validateStepParams(draft) : [];
    const dirty = Boolean(draft && stored && JSON.stringify(draft) !== JSON.stringify(stored));
    const diag = diagByCode.get(selected);
    const inert = diagnostics && diagnostics.engine !== 'graph';

    return (
        <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Scale className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight">
                            Graph Retrieval Weights (D1 – D8)
                        </h2>
                        <p className="max-w-2xl text-xs text-muted-foreground">
                            How much each kind of shared evidence counts when the graph engine looks
                            for precedents. The Cypher queries stay in code; only these numbers are
                            configurable.
                        </p>
                    </div>
                </div>
            </div>

            {/*
              Cấu hình vẫn lưu được khi engine là `scoring` — người ta có thể đang
              chuẩn bị trước cho lần đổi engine. Cái sai duy nhất là tưởng nó đang
              chạy, nên chỗ đó mới là chỗ phải nói.
            */}
            {inert && (
                <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/[0.07] px-3 py-2.5 text-xs">
                    <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-warning" />
                    <p>
                        <strong className="font-semibold">These weights are not in effect.</strong>{' '}
                        The retrieval engine is currently{' '}
                        <span className="font-mono">{diagnostics?.engine}</span>, which does not read
                        this table. Changes are saved and will apply once the engine is switched to{' '}
                        <span className="font-mono">graph</span> above.
                    </p>
                </div>
            )}

            <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">

                {/* ── Cột trái: tám bước, kèm phán quyết của server ── */}
                <div className="min-w-0 space-y-1 lg:border-r lg:pr-4">
                    {rows.map((row) => {
                        const d = diagByCode.get(row.stepCode);
                        return (
                            <button
                                key={row.stepCode}
                                type="button"
                                onClick={() => setSelected(row.stepCode)}
                                className={cn(
                                    'flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer',
                                    selected === row.stepCode
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                )}
                            >
                                <StatusDot diag={d} />
                                <span className="shrink-0 font-mono font-bold">{row.stepCode}</span>
                                <span className="min-w-0 flex-1 truncate">{row.label ?? ''}</span>
                            </button>
                        );
                    })}

                    <p className="pt-3 text-[10.5px] leading-relaxed text-muted-foreground">
                        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-success align-middle" />
                        in force ·
                        <span className="mx-1 inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50 align-middle" />
                        built-in defaults ·
                        <span className="mx-1 inline-block h-1.5 w-1.5 rounded-full bg-destructive align-middle" />
                        rejected
                    </p>
                </div>

                {/* ── Cột phải: dòng đang chọn ── */}
                {!draft ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        No stored row for {selected}. The server seeds all eight steps on startup —
                        restart the service if this persists.
                    </p>
                ) : (
                    <div className="min-w-0 space-y-5">

                        {/* Phán quyết — nguồn là backend, không phải phép kiểm ở client */}
                        {diag?.violation ? (
                            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-xs">
                                <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-destructive" />
                                <p>
                                    <strong className="font-semibold">
                                        Rejected — the built-in defaults are running instead.
                                    </strong>
                                    <br />
                                    {diag.violation}
                                </p>
                            </div>
                        ) : diag && !diag.accepted ? (
                            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs">
                                <Info className="mt-px h-4 w-4 shrink-0 text-muted-foreground" />
                                <p>
                                    This step runs on its <strong className="font-semibold">built-in
                                    defaults</strong>. Turn on “Use these parameters” to apply the
                                    values below.
                                </p>
                            </div>
                        ) : diag ? (
                            <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/[0.06] px-3 py-2.5 text-xs">
                                <Check className="mt-px h-4 w-4 shrink-0 text-success" />
                                <p>
                                    These parameters are <strong className="font-semibold">in
                                    force</strong> for {selected}.
                                </p>
                            </div>
                        ) : null}

                        {/* ── Nhận dạng ── */}
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0 flex-1 space-y-1">
                                    <Label className="text-[11px] font-medium text-muted-foreground">
                                        Label
                                    </Label>
                                    <Input
                                        value={draft.label ?? ''}
                                        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="flex shrink-0 items-center gap-2 pt-5">
                                    <Switch
                                        checked={draft.enabled}
                                        onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
                                    />
                                    <Label className="text-xs font-medium">Use these parameters</Label>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[11px] font-medium text-muted-foreground">
                                    What this step asks
                                </Label>
                                <Textarea
                                    rows={2}
                                    value={draft.question ?? ''}
                                    onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                                    className="text-xs leading-relaxed"
                                />
                            </div>
                        </div>

                        {/* ── Trọng số ── */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                    Evidence weights
                                </h3>
                                <Badge variant="outline" className="text-[10px] font-normal">
                                    empty = not weighted at all
                                </Badge>
                            </div>
                            <p className="text-[10.5px] leading-snug text-muted-foreground">
                                An empty box differs from a zero: a kind that is not weighted never
                                appears in the evidence path. D7 leaves work centre empty on purpose —
                                prevention has to reach beyond the station that failed.
                            </p>

                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {WEIGHT_FIELDS.map(({ key, label }) => (
                                    <NumberField
                                        key={key}
                                        label={label}
                                        value={draft[key] as number | null}
                                        error={issueFor(issues, key)}
                                        onChange={(v) => setDraft({ ...draft, [key]: v })}
                                    />
                                ))}
                            </div>

                            {issueFor(issues, 'weights') && (
                                <p className="text-[10.5px] text-destructive">
                                    {issueFor(issues, 'weights')}
                                </p>
                            )}
                        </div>

                        {/* ── Ngưỡng ── */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                Thresholds
                            </h3>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <NumberField
                                    label="Keyword cap"
                                    hint="Most keywords that can score"
                                    value={draft.keywordCap}
                                    error={issueFor(issues, 'keywordCap')}
                                    onChange={(v) => setDraft({ ...draft, keywordCap: v })}
                                />
                                <NumberField
                                    label="Minimum score"
                                    hint="Below this: no precedent"
                                    value={draft.minScore}
                                    error={issueFor(issues, 'minScore')}
                                    onChange={(v) => setDraft({ ...draft, minScore: v })}
                                />
                                <NumberField
                                    label="Top N"
                                    hint="Candidates kept"
                                    value={draft.topN}
                                    error={issueFor(issues, 'topN')}
                                    onChange={(v) => setDraft({ ...draft, topN: v })}
                                />
                                <div className="space-y-1">
                                    <Label className="text-[11px] font-medium text-muted-foreground">
                                        Action type
                                    </Label>
                                    <Select
                                        value={draft.actionType ?? '__none__'}
                                        onValueChange={(v) =>
                                            setDraft({ ...draft, actionType: v === '__none__' ? null : v })
                                        }
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">None — no action probe</SelectItem>
                                            {ACTION_TYPES.map((t) => (
                                                <SelectItem key={t} value={t}>{t}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10.5px] leading-snug text-muted-foreground">
                                        Which actions this step scores
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── Tầng 2 ── */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                    Model re-rank (layer 2)
                                </h3>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        'text-[10px] font-normal',
                                        (draft.wRerank ?? 0) > 0
                                            ? 'border-info/30 bg-info/10 text-info'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    {(draft.wRerank ?? 0) > 0 ? 'on' : 'off'}
                                </Badge>
                            </div>
                            <p className="text-[10.5px] leading-snug text-muted-foreground">
                                Costs one model call per search. Weight 0 or empty turns it off; the
                                frames below stay ready so switching it on is one number, not a
                                rewrite.
                            </p>

                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <NumberField
                                    label="Re-rank weight"
                                    hint="Must stay below minimum score"
                                    value={draft.wRerank}
                                    error={issueFor(issues, 'wRerank')}
                                    onChange={(v) => setDraft({ ...draft, wRerank: v })}
                                />
                                <NumberField
                                    label="Re-rank floor (0–1)"
                                    hint="Empty = step default, 0 = no floor"
                                    value={draft.rerankFloor}
                                    error={issueFor(issues, 'rerankFloor')}
                                    onChange={(v) => setDraft({ ...draft, rerankFloor: v })}
                                />
                            </div>

                            <div className="space-y-3 pt-1">
                                <FrameField
                                    label="Query frame"
                                    hint="What the model must establish about the open case before it looks at any candidate."
                                    value={draft.rerankQueryFrame}
                                    onChange={(v) => setDraft({ ...draft, rerankQueryFrame: v })}
                                />
                                <FrameField
                                    label="Candidate frame"
                                    hint="Which direction to compare a candidate against that baseline."
                                    value={draft.rerankCandidateFrame}
                                    onChange={(v) => setDraft({ ...draft, rerankCandidateFrame: v })}
                                />
                                <FrameField
                                    label="Rubric"
                                    hint="What 0 and 100 mean for this step. Without it the model invents its own scale, and the scale moves between calls."
                                    value={draft.rerankRubric}
                                    onChange={(v) => setDraft({ ...draft, rerankRubric: v })}
                                />
                            </div>
                        </div>

                        {/* ── Lưu ── */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                            <p className="text-[11px] text-muted-foreground">
                                {issues.length > 0
                                    ? 'Fix the highlighted values — the server would reject this row and keep running the defaults.'
                                    : dirty
                                        ? 'Unsaved changes. Effective within 30 seconds of saving.'
                                        : 'No unsaved changes.'}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!dirty || save.isPending}
                                    onClick={() => setDraft(stored ? { ...stored } : null)}
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Revert
                                </Button>
                                <Button
                                    size="sm"
                                    disabled={!dirty || issues.length > 0 || save.isPending}
                                    onClick={() => draft && save.mutate(draft)}
                                >
                                    {save.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                                    Save {selected}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
