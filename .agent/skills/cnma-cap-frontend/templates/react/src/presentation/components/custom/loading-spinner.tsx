import { cn } from '@/lib/utils';

interface Props {
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    label?: string;
    fullScreen?: boolean;
}

export function LoadingSpinner({
    size = 'md',
    showLabel = false,
    label = 'Loading...',
    fullScreen = false,
}: Props) {
    const sizeClass = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    }[size];

    const spinner = (
        <div
            className={cn(
                'inline-block animate-spin rounded-full border-2 border-solid border-current border-r-transparent',
                sizeClass
            )}
            role="status"
            aria-label={label}
        >
            <span className="sr-only">{label}</span>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-white/80 z-50">
                <div className="flex flex-col items-center gap-4">
                    {spinner}
                    {showLabel && <p className="text-sm text-gray-600">{label}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            {spinner}
            {showLabel && <span className="text-sm text-gray-600">{label}</span>}
        </div>
    );
}
