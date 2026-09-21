import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
}

/**
 * Skeleton loading component for shimmer effect
 */
export function Skeleton({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                'animate-pulse rounded-md bg-slate-200',
                className
            )}
            aria-hidden="true"
        />
    );
}

/**
 * Page loading skeleton with header and content areas
 */
export function PageLoadingSkeleton() {
    return (
        <div className="animate-in fade-in duration-300" role="status" aria-label="Loading page">
            {/* Header skeleton */}
            <div className="flex items-center justify-between mb-6">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-10 w-32" />
            </div>

            {/* Content skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-4">
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-60 w-full" />
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-48 w-full" />
                </div>
            </div>

            <span className="sr-only">Loading content...</span>
        </div>
    );
}

/**
 * Card loading skeleton
 */
export function CardSkeleton({ className }: SkeletonProps) {
    return (
        <div className={cn('p-4 rounded-lg border border-slate-200 bg-white', className)}>
            <div className="space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
            </div>
        </div>
    );
}

/**
 * List loading skeleton
 */
export function ListSkeleton({ count = 5 }: { count?: number }) {
    return (
        <div className="space-y-3" role="status" aria-label="Loading list">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 bg-white">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                </div>
            ))}
            <span className="sr-only">Loading list items...</span>
        </div>
    );
}

/**
 * Table loading skeleton
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
    return (
        <div className="rounded-lg border border-slate-200 overflow-hidden" role="status" aria-label="Loading table">
            {/* Header */}
            <div className="bg-slate-50 p-4 flex gap-4 border-b border-slate-200">
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} className="h-4 flex-1" />
                ))}
            </div>

            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={rowIndex} className="p-4 flex gap-4 border-b border-slate-100 last:border-0">
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <Skeleton key={colIndex} className="h-4 flex-1" />
                    ))}
                </div>
            ))}
            <span className="sr-only">Loading table data...</span>
        </div>
    );
}
