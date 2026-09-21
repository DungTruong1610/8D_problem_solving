import { useQuery } from '@tanstack/react-query';
import { Spinner, cn } from '@cnma/react-ui';
import { getReviewTrail, type ReviewEvent } from '@/services/eightd-service';

/**
 * Vết duyệt của một case — ai làm gì, lúc nào.
 *
 * ── Vì sao là một panel riêng chứ không phải một dòng trong từng bước ──
 * Câu hỏi mà nó trả lời là câu hỏi về CẢ case: "case này đã qua mấy vòng, ai ký
 * cái gì". Rải mỗi bước một mẩu thì không ai dựng lại được trình tự.
 *
 * Đọc từ `ReviewEvents` — bảng chỉ-thêm, không sửa không xoá. `Disciplines`
 * chỉ giữ trạng thái HIỆN TẠI, nên một case bị trả lại rồi duyệt lại hai vòng
 * trông y hệt case duyệt thẳng nếu chỉ nhìn vào đó.
 */

/** Đổi một chuyển trạng thái thành câu người đọc được. */
function describe(event: ReviewEvent): string {
    const step = event.disciplineCode;
    switch (event.toStatus) {
        case 'Approved': return `Marked ${step} as complete`;
        case 'ChangeRequested': return `Sent ${step} back for changes`;
        case 'Draft': return `Reopened ${step}`;
        default: return `${step}: ${event.fromStatus} to ${event.toStatus}`;
    }
}

function formatTime(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
}

export function AuditTrailPanel({ reportID }: { reportID: string }) {
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['8d', 'trail', reportID],
        queryFn: () => getReviewTrail(reportID),
        enabled: !!reportID,
        staleTime: 0,
    });

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4" /> Loading trail…
            </div>
        );
    }

    if (isError) {
        // Nói thẳng thay vì hiện panel rỗng: rỗng nghĩa là "chưa ai duyệt", còn
        // đây là "không đọc được" — hai chuyện hoàn toàn khác nhau.
        return (
            <p className="px-3 py-6 text-sm text-muted-foreground">
                Audit trail unavailable: {(error as Error)?.message ?? 'unknown error'}
            </p>
        );
    }

    const trail = data?.trail ?? [];

    if (trail.length === 0) {
        return (
            <p className="px-3 py-6 text-sm text-muted-foreground">
                Nothing signed off yet. Approving a discipline records who did it and when.
            </p>
        );
    }

    return (
        <div className="max-h-[460px] overflow-y-auto px-3.5 py-2">
            <ol className="min-w-0 space-y-0">
                {trail.map((event, index) => (
                    <li
                        key={event.ID}
                        className={cn(
                            'min-w-0 border-l-2 py-2.5 pl-3',
                            // Sự kiện mới nhất đậm hơn — danh sách xếp mới trước.
                            index === 0 ? 'border-l-primary' : 'border-l-border',
                        )}
                    >
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-foreground truncate">
                                {event.actor || 'System'}
                            </span>
                            <span className="text-xs tabular-nums text-muted-foreground">
                                {formatTime(event.at)}
                            </span>
                        </div>
                        <div className="mt-1 break-words text-sm text-foreground/90 font-medium">{describe(event)}</div>
                        {event.note && (
                            <div className="mt-1 break-words rounded bg-muted/60 px-2.5 py-1 text-sm text-muted-foreground">
                                {event.note}
                            </div>
                        )}
                    </li>
                ))}
            </ol>
        </div>
    );
}
