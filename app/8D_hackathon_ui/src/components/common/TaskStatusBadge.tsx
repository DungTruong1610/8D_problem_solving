import { Badge, cn } from '@cnma/react-ui';
import { CircleCheck, CircleDashed, CircleDot } from 'lucide-react';
import { normalizeActionStatus } from '../../../../../shared/action-task';

/**
 * Trạng thái của một task 8D (Planned / Open / Done), theo palette trạng thái
 * của design system — không tự chọn màu ở từng trang.
 *
 *   Planned  chưa giao ra      → trung tính
 *   Open     đã giao, đang làm → `status-progress`
 *   Done     đã hoàn tất       → `status-completed`
 */
const TONE: Record<string, string> = {
    Planned: 'border-border bg-muted text-muted-foreground',
    Open: 'border-status-progress-border bg-status-progress text-status-progress-text',
    Done: 'border-status-completed-border bg-status-completed text-status-completed-text',
};

const ICON = {
    Planned: CircleDashed,
    Open: CircleDot,
    Done: CircleCheck,
} as const;

export function TaskStatusBadge({ status, className }: { status: string; className?: string }) {
    const norm = normalizeActionStatus(status);
    const Icon = ICON[norm as keyof typeof ICON] ?? CircleDashed;
    return (
        <Badge
            variant="outline"
            title={norm}
            className={cn('gap-1 whitespace-nowrap font-medium', TONE[norm] ?? TONE.Planned, className)}
        >
            <Icon className="size-3.5 shrink-0" />
            {norm}
        </Badge>
    );
}
