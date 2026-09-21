import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

type StatusType = 'success' | 'error' | 'warning' | 'info' | 'default';

const statusVariants: Record<StatusType, string> = {
    success: 'bg-green-100 text-green-800 border-green-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    default: 'bg-gray-100 text-gray-800 border-gray-200',
};

interface Props {
    status: StatusType | string;
    label: string;
    size?: 'sm' | 'md';
}

export function StatusBadge({ status, label, size = 'md' }: Props) {
    const variant = statusVariants[status as StatusType] || statusVariants.default;

    return (
        <Badge
            className={cn(
                'border',
                variant,
                size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
            )}
        >
            {label}
        </Badge>
    );
}
