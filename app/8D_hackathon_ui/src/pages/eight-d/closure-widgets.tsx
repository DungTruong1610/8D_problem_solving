import { cn } from '@cnma/react-ui';
import { Lock, LockOpen, Link2, Link2Off } from 'lucide-react';
import { reviewStatusOf, type Discipline8D } from '@/services/eightd-service';
import { AiProvenanceInfo } from './ai-provenance-info';

/**
 * Widget cua D7 va D8.
 */

/* ─────────────────────────────────────────────────────────────────────────────
   D7 — Lien ket FMEA
   ───────────────────────────────────────────────────────────────────────── */

interface FmeaLink {
    fmeaId?: string;
    id?: string;
    description?: string;
    change?: string;
    currentRating?: string | number;
    proposedRating?: string | number;
}

/**
 * The lien ket FMEA.
 *
 * -- Vi sao khong phai mot dong text --
 * D7 chi thuc su "chan tai dien" khi thay doi duoc ghi vao FMEA. Mot cau van ke
 * rang "nen cap nhat FMEA" khong kiem duoc; mot the co ma FMEA, xep hang truoc
 * va sau thi kiem duoc. Truong hop CHUA lien ket phai hien ro chu khong an di —
 * do la lo hong that trong case, khong phai o trong cua man hinh.
 */
export function FmeaLinkWidget({ value }: { value: unknown }) {
    const row = value && typeof value === 'object' && !Array.isArray(value)
        ? (value as FmeaLink)
        : null;
    const id = row?.fmeaId ?? row?.id;

    if (!id) {
        return (
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/[0.06] p-3">
                <Link2Off className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="min-w-0 text-sm">
                    <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-warning">No FMEA entry linked</p>
                        <AiProvenanceInfo fieldKey="preventive.fmea" label="FMEA Entry" />
                    </div>
                    <p className="mt-0.5 break-words text-muted-foreground">
                        {row?.description
                            || 'Nothing stops this failure mode returning on another part or line until an FMEA entry is updated.'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-lg border bg-card p-3">
            <div className="flex items-start gap-2">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            FMEA
                        </div>
                        <AiProvenanceInfo fieldKey="preventive.fmea" label={`FMEA: ${id}`} />
                    </div>
                    <p className="break-words font-mono text-sm font-semibold">{id}</p>
                    {row?.description && (
                        <p className="mt-0.5 break-words text-sm">{row.description}</p>
                    )}
                    {row?.change && (
                        <p className="mt-1 break-words text-sm text-muted-foreground">{row.change}</p>
                    )}
                </div>
            </div>

            {(row?.currentRating != null || row?.proposedRating != null) && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t pt-2.5 text-sm">
                    {row.currentRating != null && (
                        <span className="rounded border bg-muted px-2.5 py-0.5 font-medium">
                            Current: {String(row.currentRating)}
                        </span>
                    )}
                    {row.proposedRating != null && (
                        <span className="rounded border border-success/30 bg-success/10 px-2.5 py-0.5 text-success font-medium">
                            Proposed: {String(row.proposedRating)}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   D8 — Cong dong case
   ───────────────────────────────────────────────────────────────────────── */

const PREREQUISITES = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];

/**
 * Cong dong case, doc trang thai duyet cua D1-D7.
 *
 * -- Vi sao doc tu cac buoc anh em chu khong tu resultJson --
 * "Case nay dong duoc chua" la mot su that ve CA report, khong phai mot ket luan
 * de AI viet ra. Cho model tra loi cau do la cho no tu cap phep dong case —
 * dung dieu tai lieu yeu cau khong bao gio duoc xay ra.
 */
export function ClosureGateWidget({ siblings }: { siblings: Discipline8D[] }) {
    const byCode = new Map(siblings.map((d) => [d.code, reviewStatusOf(d)]));
    const blocking = PREREQUISITES.filter((code) => byCode.get(code) !== 'Approved');
    const canClose = blocking.length === 0;
    const approved = PREREQUISITES.length - blocking.length;

    return (
        <div className={cn(
            'rounded-lg border p-3',
            canClose ? 'border-success/30 bg-success/[0.06]' : 'border-warning/40 bg-warning/[0.06]',
        )}>
            <div className="flex items-start gap-2">
                {canClose
                    ? <LockOpen className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    : <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
                <div className="min-w-0 text-sm">
                    {canClose ? (
                        <>
                            <p className="font-semibold text-success">Ready to close</p>
                            <p className="mt-0.5 text-muted-foreground">
                                All {PREREQUISITES.length} disciplines D1–D7 are approved. A quality
                                engineer can now close the case; the AI never closes it.
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="font-semibold text-warning">
                                Not ready to close — {approved} of {PREREQUISITES.length} approved
                            </p>
                            <p className="mt-0.5 break-words text-muted-foreground">
                                Waiting on <strong className="font-medium text-foreground">{blocking.join(', ')}</strong>.
                                Approve each remaining discipline on its own tab.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
