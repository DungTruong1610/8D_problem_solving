import { useState } from 'react';
import { Badge, Button, cn } from '@cnma/react-ui';
import {
    Brain,
    Check,
    CheckCircle2,
    Code2,
    Copy,
    FileText,
    History,
    Info,
    LayoutList,
    ShieldCheck,
    Wrench,
    XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Hiển thị một bản ghi bằng chứng từ snapshot dưới dạng giao diện người dùng
 * trực quan, thân thiện (thay vì dump JSON thô hoặc in chữ null).
 * Có tuỳ chọn toggle sang xem JSON gốc cho developer khi cần.
 */

const CATEGORY_STYLES: Record<string, string> = {
    Man: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    Machine: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
    Method: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
    Material: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
    Measurement: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
    Environment: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
};

function formatKey(key: string): string {
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/[_\-]/g, ' ')
        .replace(/^\w/, (c) => c.toUpperCase())
        .trim();
}

function CopyButton({ value }: { value: unknown }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(value, null, 2));
        setCopied(true);
        toast.success('Evidence data copied to clipboard.');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
            title="Copy raw JSON"
        >
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy JSON'}
        </Button>
    );
}

function Empty() {
    return <span className="text-muted-foreground text-xs italic">No value recorded</span>;
}

function renderScalar(v: unknown) {
    if (v === null || v === undefined || v === '') return <Empty />;
    if (typeof v === 'boolean') {
        return (
            <Badge variant="outline" className={v ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]' : 'bg-muted text-muted-foreground text-[10px]'}>
                {v ? 'True' : 'False'}
            </Badge>
        );
    }
    return <span className="text-xs font-medium text-foreground">{String(v)}</span>;
}

/* ─────────────────────────────────────────────────────────────────────────────
   1. GIAO DIỆN CHẨN ĐOÁN ĐỘC LẬP (INDEPENDENT FINDING)
   ───────────────────────────────────────────────────────────────────────────── */
function IndependentEvidenceView({ data }: { data: Record<string, any> }) {
    const finding = data.finding || data;
    const category = finding.rootCauseCategory || 'Unknown';
    const statement = finding.rootCauseStatement || '';
    const fiveWhys: Array<any> = Array.isArray(finding.derivedFiveWhy) ? finding.derivedFiveWhy : [];
    const ruledOut: Array<any> = Array.isArray(finding.ruledOut) ? finding.ruledOut : [];
    const confidence = Number(finding.confidence || 0);
    const confidencePct = Math.round(confidence <= 1 ? confidence * 100 : confidence);
    const runnerUp = finding.runnerUpCategory;

    return (
        <div className="space-y-3.5">
            {/* Header: Kết luận nguyên nhân gốc + Confidence */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border/80 bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Brain className="h-4 w-4" />
                    </div>
                    <div>
                        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                            Identified Root Cause Branch
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                                variant="outline"
                                className={cn('text-xs font-bold px-2 py-0.5', CATEGORY_STYLES[category] || 'bg-muted text-foreground')}
                            >
                                {category}
                            </Badge>
                            {runnerUp && (
                                <span className="text-[11px] text-muted-foreground">
                                    (Runner-up: <strong className="text-foreground">{runnerUp}</strong>)
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>{confidencePct}% Confidence</span>
                </div>
            </div>

            {/* Statement */}
            {statement && (
                <div className="rounded-lg border-l-4 border-l-primary bg-primary/5 p-3 text-xs leading-relaxed text-foreground">
                    <span className="font-semibold text-primary block mb-0.5">Root Cause Statement:</span>
                    {statement}
                </div>
            )}

            {/* Derived 5-Why Chain */}
            {fiveWhys.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        <span>Derived 5-Why Causal Chain ({fiveWhys.length} steps)</span>
                    </div>

                    <div className="relative space-y-2.5 pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/80">
                        {fiveWhys.map((step, idx) => (
                            <div
                                key={idx}
                                className="relative rounded-lg border border-border/70 bg-card p-3 shadow-xs space-y-1"
                            >
                                <span className="absolute -left-[19px] top-3 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                                    {step.stepNo || idx + 1}
                                </span>

                                <div className="text-xs font-medium text-muted-foreground">
                                    <span className="font-bold text-foreground">Q:</span> {step.question}
                                </div>
                                <div className="text-xs font-semibold text-foreground">
                                    <span className="font-bold text-primary">A:</span> {step.answer}
                                </div>
                                {step.evidence && (
                                    <div className="mt-1 inline-block rounded bg-muted/60 px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                                        Evidence: "{step.evidence}"
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 6M Ruled Out */}
            {ruledOut.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
                        <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Ruled Out 6M Branches ({ruledOut.length} categories eliminated)</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {ruledOut.map((item, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs"
                            >
                                <Badge
                                    variant="outline"
                                    className={cn('shrink-0 text-[10.5px] font-bold', CATEGORY_STYLES[item.category] || 'bg-muted')}
                                >
                                    {item.category}
                                </Badge>
                                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                                    {item.reason}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   2. GIAO DIỆN TIỀN LỆ LỊCH SỬ (HISTORICAL PRECEDENT)
   ───────────────────────────────────────────────────────────────────────────── */
function PrecedentEvidenceView({ precedent }: { precedent: Record<string, any> }) {
    const notificationId = precedent.notificationId || 'Unknown ID';
    const score = Number(precedent.score || 0);
    const maxScore = Number(precedent.maxScore || 10);
    const scorePct = Math.round(maxScore > 0 ? (score / maxScore) * 100 : score);
    const breakdown: Array<any> = Array.isArray(precedent.breakdown) ? precedent.breakdown : [];
    const actions: Array<any> = Array.isArray(precedent.actions) ? precedent.actions : [];

    return (
        <div className="space-y-3.5">
            {/* Header: Case ID + Score */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border/80 bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
                        <History className="h-4 w-4" />
                    </div>
                    <div>
                        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                            Benchmark Historical Case
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-sm font-bold text-foreground">
                                {notificationId}
                            </span>
                            {precedent.sapStatus && (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                                    {precedent.sapStatus}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400 border border-blue-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{score}/{maxScore} pts ({scorePct}% Match)</span>
                </div>
            </div>

            {/* Key Properties Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-lg border border-border/70 bg-card p-3 text-xs">
                <div>
                    <span className="text-muted-foreground text-[11px] block">Material:</span>
                    <span className="font-medium text-foreground">
                        {precedent.materialId || precedent.materialDesc ? `${precedent.materialId || ''} ${precedent.materialDesc ? `· ${precedent.materialDesc}` : ''}` : <Empty />}
                    </span>
                </div>
                <div>
                    <span className="text-muted-foreground text-[11px] block">Work Center:</span>
                    <span className="font-medium text-foreground">
                        {precedent.workCenterId || precedent.workCenterDesc ? `${precedent.workCenterId || ''} ${precedent.workCenterDesc ? `· ${precedent.workCenterDesc}` : ''}` : <Empty />}
                    </span>
                </div>
                <div>
                    <span className="text-muted-foreground text-[11px] block">Defect Description:</span>
                    <span className="font-medium text-foreground">
                        {precedent.defectText || precedent.symptomShortText || <Empty />}
                    </span>
                </div>
                <div>
                    <span className="text-muted-foreground text-[11px] block">Historical Root Cause:</span>
                    {precedent.rootCauseCategory ? (
                        <Badge
                            variant="outline"
                            className={cn('text-[10.5px] font-bold mt-0.5', CATEGORY_STYLES[precedent.rootCauseCategory] || 'bg-muted')}
                        >
                            {precedent.rootCauseCategory}
                        </Badge>
                    ) : <Empty />}
                </div>
            </div>

            {/* Criteria Breakdown */}
            {breakdown.length > 0 && (
                <div className="space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                        Matching Criteria Points
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {breakdown.map((item, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]',
                                    item.points > 0 ? 'bg-emerald-500/5 border-emerald-500/30 text-foreground' : 'bg-muted/40 border-border text-muted-foreground'
                                )}
                            >
                                <span className="font-medium">{formatKey(item.label || item.criterionKey)}:</span>
                                {item.matchedOn && <span className="font-mono text-[10px] text-muted-foreground">"{item.matchedOn}"</span>}
                                <span className={cn('font-bold', item.points > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
                                    +{item.points} pts
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions Taken in this precedent */}
            {actions.length > 0 && (
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
                        <Wrench className="h-3.5 w-3.5 text-primary" />
                        <span>Actions Proven Effective in this Case ({actions.length})</span>
                    </div>

                    <div className="space-y-1.5">
                        {actions.map((act, idx) => (
                            <div
                                key={idx}
                                className="flex items-start justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs"
                            >
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[10px] font-semibold bg-primary/5 text-primary border-primary/20">
                                            {act.actionType || 'Action'}
                                        </Badge>
                                        <span className="font-medium text-foreground">{act.actionText}</span>
                                    </div>
                                </div>
                                {act.status && (
                                    <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
                                        {act.status}
                                    </Badge>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. GIAO DIỆN BẢNG THUỘC TÍNH TỔNG QUÁT (GENERAL FORMATTED VIEW)
   ───────────────────────────────────────────────────────────────────────────── */
function GeneralFormattedView({ record }: { record: Record<string, unknown> }) {
    const scalarEntries = Object.entries(record).filter(([_, v]) => v === null || typeof v !== 'object');
    const complexEntries = Object.entries(record).filter(([_, v]) => v !== null && typeof v === 'object');

    return (
        <div className="space-y-3">
            {scalarEntries.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border/70 bg-card p-3">
                    {scalarEntries.map(([k, v]) => (
                        <div key={k} className="flex flex-col">
                            <span className="text-[11px] font-semibold text-muted-foreground">
                                {formatKey(k)}
                            </span>
                            <div className="mt-0.5">{renderScalar(v)}</div>
                        </div>
                    ))}
                </div>
            )}

            {complexEntries.map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border/70 bg-muted/15 p-3 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary block">
                        {formatKey(k)} {Array.isArray(v) && `(${v.length} items)`}
                    </span>
                    {Array.isArray(v) ? (
                        <div className="space-y-2">
                            {v.map((item, idx) => (
                                <div key={idx} className="rounded border bg-card p-2.5 text-xs">
                                    {item && typeof item === 'object' ? (
                                        <GeneralFormattedView record={item as Record<string, unknown>} />
                                    ) : (
                                        <span>{String(item)}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <GeneralFormattedView record={v as Record<string, unknown>} />
                    )}
                </div>
            ))}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   4. COMPONENT CHÍNH (EVIDENCE VALUE)
   ───────────────────────────────────────────────────────────────────────────── */
export function EvidenceValue({ value }: { value: unknown }) {
    const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');

    // ── Xử lý khi giá trị rỗng / null (Không bao giờ in ra chữ "null" thô) ──
    if (value === null || value === undefined) {
        return (
            <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3.5 py-3 text-xs">
                <Info className="h-4 w-4 shrink-0 text-muted-foreground/70 mt-0.5" />
                <div className="space-y-0.5">
                    <p className="font-semibold text-foreground">No value recorded on this case</p>
                    <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                        This property was not populated in the initial quality notification.
                        The AI derived the necessary findings and actions using physical telemetry and benchmark precedents.
                    </p>
                </div>
            </div>
        );
    }

    if (typeof value === 'string') {
        if (!value.trim()) {
            return (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>No text recorded</span>
                </div>
            );
        }
        return <span className="break-words font-mono text-sm font-medium">{value}</span>;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return <span className="break-words font-mono text-sm font-medium">{String(value)}</span>;
    }

    // Nhận diện loại dữ liệu chuyên biệt
    const isIndependent = Boolean(
        value &&
        typeof value === 'object' &&
        (('rootCauseCategory' in (value as any)) || ('finding' in (value as any) && typeof (value as any).finding === 'object' && 'rootCauseCategory' in (value as any).finding))
    );

    const isPrecedent = Boolean(
        value &&
        typeof value === 'object' &&
        (('notificationId' in (value as any)) || ('breakdown' in (value as any) && Array.isArray((value as any).breakdown)))
    );

    return (
        <div className="space-y-2.5">
            {/* Thanh điều khiển trên cùng: Chuyển đổi giữa [Xem trực quan] và [Xem JSON thô] */}
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md border border-border/40">
                    <button
                        type="button"
                        onClick={() => setViewMode('formatted')}
                        className={cn(
                            'flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer',
                            viewMode === 'formatted'
                                ? 'bg-background text-foreground shadow-xs font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <LayoutList className="h-3 w-3" />
                        <span>Formatted View</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('raw')}
                        className={cn(
                            'flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer',
                            viewMode === 'raw'
                                ? 'bg-background text-foreground shadow-xs font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <Code2 className="h-3 w-3" />
                        <span>Raw JSON</span>
                    </button>
                </div>

                <CopyButton value={value} />
            </div>

            {/* Nội dung hiển thị */}
            {viewMode === 'raw' ? (
                <pre className="max-h-80 overflow-auto rounded-lg border bg-muted/60 p-3 font-mono text-xs leading-relaxed">
                    {JSON.stringify(value, null, 2)}
                </pre>
            ) : isIndependent ? (
                <IndependentEvidenceView data={value as Record<string, any>} />
            ) : isPrecedent ? (
                <PrecedentEvidenceView precedent={value as Record<string, any>} />
            ) : Array.isArray(value) ? (
                value.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                        <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>No records in list</span>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                            {value.map((item, idx) => (
                                <div key={idx} className="space-y-1 rounded-lg border bg-card p-3 text-xs">
                                    <span className="mb-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                                        Item #{idx + 1}
                                    </span>
                                    {item && typeof item === 'object' ? (
                                        <GeneralFormattedView record={item as Record<string, unknown>} />
                                    ) : (
                                        <p className="font-mono">{String(item)}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )
            ) : Object.keys(value as object).length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>No attributes recorded</span>
                </div>
            ) : (
                <GeneralFormattedView record={value as Record<string, unknown>} />
            )}
        </div>
    );
}
