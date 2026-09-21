import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Card, cn } from '@cnma/react-ui';
import { ChevronDown, Database, Info, TriangleAlert } from 'lucide-react';
import type { Discipline8D, Report8D } from '@/services/eightd-service';
import { buildEvidenceIndex, type EvidenceFact } from './evidence-model';
import { describeEvidence, summarizeValue, type SourceKind } from './evidence-source';
import { EvidenceValue } from './evidence-value';
import { PrecedentPanel } from './precedent-panel';

/**
 * Bằng chứng của cả case — mỗi mẩu một dòng.
 *
 * ── Vì sao một dòng, không phải cây với khung chi tiết ──
 * Câu hỏi người duyệt đặt ra chỉ có một: "chỗ này AI lấy ở đâu ra". Một dòng trả
 * lời trọn câu đó — đây là cái gì, giá trị bao nhiêu, nằm trong hệ thống nào.
 * Bấm vào thì bản ghi gốc bung ra NGAY DƯỚI: mất ngữ cảnh là mất đúng thứ đang
 * cần đối chiếu.
 *
 * ── Vì sao ba trạng thái, không phải hai ──
 * "Xem được" và "hỏng" là chưa đủ. Nhánh `enrichment` không được lưu cùng report,
 * nên trích dẫn vào đó không xem lại được NHƯNG cũng không sai. Gộp nó vào ô
 * "hỏng" là vu cho AI bịa một thứ nó không bịa.
 */

const SOURCE_STYLE: Record<SourceKind, string> = {
    sap: 'border-primary/30 bg-primary/10 text-primary',
    external: 'border-warning/40 bg-warning/10 text-warning',
    derived: 'border-border bg-muted/60 text-muted-foreground',
};

function formatSnapshotTime(value: string | null | undefined): string | null {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function EvidenceRow({ fact }: { fact: EvidenceFact }) {
    const [open, setOpen] = useState(false);
    const { title, source } = describeEvidence(fact.path, fact.value);

    return (
        <div className="min-w-0 border-b border-border/60 last:border-b-0">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 px-1 py-2.5">
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                    {title}
                </span>

                {fact.state === 'resolved' ? (
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        title="Show the exact record this came from"
                        className="group inline-flex min-w-0 max-w-full items-center gap-1 rounded text-left text-sm font-medium text-primary underline decoration-primary/35 underline-offset-[3px] transition-colors hover:decoration-primary cursor-pointer"
                    >
                        <span className="min-w-0 break-words">{summarizeValue(fact.value)}</span>
                        <ChevronDown
                            className={cn(
                                'h-3.5 w-3.5 shrink-0 opacity-50 transition-transform group-hover:opacity-100',
                                open && 'rotate-180',
                            )}
                        />
                    </button>
                ) : fact.state === 'unavailable' ? (
                    <span
                        title={fact.reason}
                        className="inline-flex min-w-0 items-center gap-1.5 text-sm italic text-muted-foreground"
                    >
                        <Info className="h-3.5 w-3.5 shrink-0" />
                        Not kept with the report
                    </span>
                ) : (
                    /*
                      `postProcess` đã lọc mọi đường dẫn không giải được trước khi
                      lưu, nên còn sót nghĩa là bản chụp và trích dẫn đã lệch nhau.
                      Nói ra chứ không ẩn đi — nhưng bằng câu người đọc hiểu được,
                      không phải bằng đoạn đường dẫn thô.
                    */
                    <span
                        title={fact.reason}
                        className="inline-flex min-w-0 items-center gap-1.5 text-sm text-warning"
                    >
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                        Cannot be shown — the record is missing from the saved case
                    </span>
                )}

                <span className="flex-1" />

                <span
                    title={source.detail}
                    className={cn(
                        'shrink-0 cursor-help rounded border px-1.5 py-0.5 font-mono text-[10.5px] font-medium',
                        SOURCE_STYLE[source.kind],
                    )}
                >
                    {source.kind === 'external' && '⚠ '}
                    {source.label}
                </span>
            </div>

            {open && fact.state === 'resolved' && (
                <div className="mb-2.5 min-w-0 rounded-lg border bg-muted/25 p-3.5">
                    <p className="mb-2 font-mono text-[10.5px] text-muted-foreground">
                        {fact.path}
                        {fact.citedBy.length > 1 && ` · also used by ${fact.citedBy.join(', ')}`}
                    </p>
                    <EvidenceValue value={fact.value} />
                </div>
            )}
        </div>
    );
}

export function EvidenceTab({
    report,
    disciplines,
    focus,
}: {
    report: Report8D;
    disciplines: Discipline8D[];
    /**
     * Yêu cầu cuộn tới một discipline, do badge ở tab 8D Disciplines phát ra.
     * Mang theo `seq` để bấm lại cùng một bước vẫn là một yêu cầu mới.
     */
    focus?: { code: string; seq: number } | null;
}) {
    const index = useMemo(() => buildEvidenceIndex(disciplines, report), [disciplines, report]);

    const handledSeq = useRef(0);
    const groupRefs = useRef<Record<string, HTMLElement | null>>({});
    const [highlight, setHighlight] = useState<string | null>(null);

    useEffect(() => {
        if (!focus || focus.seq === handledSeq.current) return;
        handledSeq.current = focus.seq;
        setHighlight(focus.code);
        groupRefs.current[focus.code]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, [focus]);

    const snapshotTime = formatSnapshotTime(report.analyzedAt);
    const groups = index.groups.filter((g) => g.facts.length > 0 || !g.dataBacked);

    return (
        <div className="min-w-0 space-y-5">

            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    {index.resolvedCount} of {index.facts.length} records the AI cited can be opened
                    here{snapshotTime && <> · case captured <span className="tabular-nums">{snapshotTime}</span></>}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn('rounded border px-1.5 py-0.5 font-mono text-[10.5px]', SOURCE_STYLE.sap)}>
                        Verified Fact
                    </span>
                    <span className={cn('rounded border px-1.5 py-0.5 font-mono text-[10.5px]', SOURCE_STYLE.external)}>
                        ⚠ External / Assumed
                    </span>
                    <span className={cn('rounded border px-1.5 py-0.5 font-mono text-[10.5px]', SOURCE_STYLE.derived)}>
                        Worked out
                    </span>
                </div>
            </div>

            {index.parseError && (
                <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    <TriangleAlert className="mt-px h-4 w-4 shrink-0" />
                    The saved case could not be read: {index.parseError}
                </p>
            )}

            {index.facts.length === 0 && !index.parseError ? (
                <Card className="flex flex-col items-center justify-center gap-2 border-dashed p-12 text-center">
                    <Database className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm font-medium">Nothing cited yet</p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                        No step in this report points to a record from the saved case.
                        Run the analysis to fill this in.
                    </p>
                </Card>
            ) : (
                groups.map((group) => (
                    <Card
                        key={group.code}
                        ref={(el: HTMLElement | null) => { groupRefs.current[group.code] = el; }}
                        className={cn(
                            'min-w-0 scroll-mt-4 overflow-hidden p-0 transition-colors',
                            highlight === group.code && 'ring-2 ring-primary/40',
                        )}
                    >
                        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
                            <span className="font-mono text-xs font-bold">{group.code}</span>
                            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                {group.title}
                            </span>
                            {group.facts.length > 0 && (
                                <Badge variant="outline" className="text-[10px] tabular-nums">
                                    {group.facts.length} source{group.facts.length === 1 ? '' : 's'}
                                </Badge>
                            )}
                            {!group.dataBacked && (
                                <Badge
                                    variant="outline"
                                    className="gap-1 border-warning/30 bg-warning/10 text-[10px] text-warning"
                                >
                                    <TriangleAlert className="h-3 w-3" />
                                    Suggested by AI
                                </Badge>
                            )}
                        </div>

                        <div className="px-3 py-1">
                            {group.facts.length === 0 ? (
                                <p className="px-1 py-3 text-xs italic text-muted-foreground">
                                    Nothing in the case backs this step — it is a suggestion, not
                                    something the records show happened.
                                </p>
                            ) : (
                                group.facts.map((fact) => (
                                    <EvidenceRow key={fact.path} fact={fact} />
                                ))
                            )}
                        </div>
                    </Card>
                ))
            )}

            <PrecedentPanel reportID={report.ID} precedentsJson={report.precedentsJson} />
        </div>
    );
}
