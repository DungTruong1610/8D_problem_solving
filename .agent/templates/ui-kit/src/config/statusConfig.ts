import { CheckCircle, Clock } from 'lucide-react';

export const STATUS_CONFIG = {
    PENDING: {
        label: 'Pending',
        icon: Clock,
        variant: 'warning'
    },
    COMPLETED: {
        label: 'Completed',
        icon: CheckCircle,
        variant: 'success'
    }
} as const;
