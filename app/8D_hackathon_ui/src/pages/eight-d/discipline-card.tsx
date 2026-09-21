import { useState } from 'react';
import { Badge, Button, Card, cn } from '@cnma/react-ui';
import { ChevronDown, TriangleAlert } from 'lucide-react';
import { parseList, type Discipline8D } from '@/services/eightd-service';
import { Markdown } from './markdown';

/**
 * Một discipline trong dòng thời gian 8D.
 *
 * ── Vì sao `dataBacked` được nhấn mạnh đến thế ──
 * Dataset không có dữ liệu verification, nên D6 luôn là ĐỀ XUẤT chứ không phải
 * sự thật đã kiểm chứng; case thiếu preventive action thì D7 cũng vậy. Nếu giao
 * diện hiển thị chúng giống hệt các discipline có dữ liệu thật, người đọc sẽ
 * tưởng đó là chuyện đã xảy ra. Đó là kiểu hiểu sai nguy hiểm nhất mà một công
 * cụ như thế này có thể gây ra, nên nó được đánh dấu ở cả viền, huy hiệu lẫn
 * dòng chú thích.
 *
 * ── Vì sao card không còn liệt kê nguồn ──
 * `sources` được lưu theo DISCIPLINE chứ không theo từng trường, nên rải chúng
 * ra đây chỉ lặp lại cùng một tập bằng chứng ở tám chỗ. Chúng nằm trọn ở tab
 * Evidence, nơi một bản ghi được nhiều bước trích dẫn hiện ra đúng như vậy —
 * điều mà bản rải rác không cho thấy được.
 */

function confidenceStyle(score: number): string {
    if (score >= 0.8) return 'bg-success/10 text-success border-success/20';
    if (score >= 0.5) return 'bg-warning/10 text-warning border-warning/20';
    return 'bg-destructive/10 text-destructive border-destructive/20';
}

export function DisciplineCard({ discipline }: { discipline: Discipline8D }) {
    const [open, setOpen] = useState(true);

    let actionItems = parseList(discipline.actionItems);
    if (actionItems.length === 0 && discipline.resultJson) {
        try {
            const data = JSON.parse(discipline.resultJson);
            const actionsArr = data.containment?.actions || data.corrective?.actions || data.preventive?.actions;
            if (Array.isArray(actionsArr) && actionsArr.length > 0) {
                actionItems = actionsArr.map((a: any) => typeof a === 'string' ? a : (a.actionText || a.action || a.description || JSON.stringify(a)));
            }
            const rosterArr = data.team?.roster || data.team?.assignedRoster;
            if (Array.isArray(rosterArr) && rosterArr.length > 0 && actionItems.length === 0) {
                actionItems = rosterArr.map((r: any) => `${r.name || r.partnerId || 'Member'} - ${r.assigned8DRole || r.partnerRole || r.organizationalRole || '8D Team Member'}`);
            }
        } catch {
            // ignore
        }
    }
    const inferred = !discipline.dataBacked;

    return (
        <Card
            className={cn(
                'min-w-0 overflow-hidden p-0 transition-colors',
                inferred && 'border-warning/40 bg-warning/[0.02]',
            )}
        >
            <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen((v) => !v)}
                className="flex h-auto w-full min-w-0 items-start justify-start gap-3 whitespace-normal p-4 text-left transition-colors hover:bg-muted/40"
            >
                {/* Mã discipline */}
                <div
                    className={cn(
                        'shrink-0 w-11 h-11 rounded-lg flex items-center justify-center font-bold text-sm',
                        inferred
                            ? 'bg-warning/15 text-warning'
                            : 'bg-primary/10 text-primary',
                    )}
                >
                    {discipline.code}
                </div>

                <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm text-foreground">{discipline.title}</h3>

                        <Badge
                            variant="outline"
                            className={cn('text-sm tabular-nums px-2.5 py-0.5', confidenceStyle(discipline.confidence))}
                        >
                            {Math.round(discipline.confidence * 100)}%
                        </Badge>

                        {inferred && (
                            <Badge
                                variant="outline"
                                className="text-sm gap-1 bg-warning/10 text-warning border-warning/30 px-2.5 py-0.5"
                            >
                                <TriangleAlert className="w-3.5 h-3.5" />
                                No source data
                            </Badge>
                        )}
                    </div>

                    <p className="mt-1.5 max-w-full break-words text-sm font-normal leading-relaxed text-muted-foreground">
                        {discipline.summary}
                    </p>

                    {inferred && (
                        <p className="mt-1.5 break-words text-sm font-normal text-warning">
                            Proposed by AI — the dataset holds no evidence for this discipline.
                        </p>
                    )}
                </div>

                <ChevronDown
                    className={cn(
                        'w-4 h-4 shrink-0 text-muted-foreground transition-transform mt-1',
                        open && 'rotate-180',
                    )}
                />
            </Button>

            {open && (
                <div className="min-w-0 space-y-4 border-t border-border/60 px-4 pb-4 pt-0">
                    <div className="pt-4">
                        <Markdown>{discipline.content}</Markdown>
                    </div>

                    {actionItems.length > 0 && (
                        <div>
                            <h4 className="text-base font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                Action items
                            </h4>
                            <ul className="space-y-1.5">
                                {actionItems.map((item, i) => (
                                    <li key={i} className="flex min-w-0 gap-2 text-sm">
                                        <span className="text-primary mt-0.5">→</span>
                                        <span className="min-w-0 break-words">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                </div>
            )}
        </Card>
    );
}
