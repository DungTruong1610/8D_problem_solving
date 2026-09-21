import { Badge, cn } from '@cnma/react-ui';
import { Loader2 } from 'lucide-react';
import type { ReportStatus } from '@/services/eightd-service';

/**
 * Huy hiệu trạng thái của một report 8D.
 *
 * Không dùng `StatusBadge` của thư viện vì nó ánh xạ theo từ vựng nghiệp vụ
 * chung (Approved / In Progress / …). Bộ trạng thái ở đây là của pipeline —
 * Analyzing, Analyzed, Failed — nên tự khai màu cho đúng nghĩa.
 */

const STYLES: Record<ReportStatus, string> = {
    Draft: 'bg-muted text-muted-foreground border-border',
    Analyzing: 'bg-info/10 text-info border-info/20',
    Analyzed: 'bg-success/10 text-success border-success/20',
    Failed: 'bg-destructive/10 text-destructive border-destructive/20',
    Closed: 'bg-muted text-muted-foreground border-border',
};

export function ReportStatusBadge({
    status,
    className,
}: {
    status: ReportStatus;
    className?: string;
}) {
    const style = STYLES[status] ?? STYLES.Draft;

    return (
        <Badge variant="outline" className={cn('gap-1.5 font-medium', style, className)}>
            {status === 'Analyzing' && <Loader2 className="h-3 w-3 animate-spin" />}
            {status}
        </Badge>
    );
}
