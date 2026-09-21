import { useState, useCallback, useEffect, useMemo } from 'react';

interface UsePaginationOptions {
    pageSize?: number;
    onPageChange?: (page: number) => void;
}

/**
 * Hook to manage client-side pagination / infinite scroll.
 *
 * Usage:
 *   const { paginatedItems, hasMore, loadMore } = usePagination(allItems, { pageSize: 20 });
 */
export function usePagination<T>(items: T[], options: UsePaginationOptions = {}) {
    const pageSize = options.pageSize ?? 20;
    const [currentPage, setCurrentPage] = useState(1);

    // Slice from beginning to end of current page (cumulative load)
    const paginatedItems = useMemo(() => items.slice(0, currentPage * pageSize), [items, currentPage, pageSize]);

    const hasMore = paginatedItems.length < items.length;

    const loadMore = useCallback(() => {
        setCurrentPage((prev) => prev + 1);
        options.onPageChange?.(currentPage + 1);
    }, [currentPage, options]);

    const reset = useCallback(() => setCurrentPage(1), []);

    // Reset to page 1 whenever the total item count changes (e.g. filter applied)
    useEffect(() => {
        setCurrentPage(1);
    }, [items.length]);

    return {
        paginatedItems,
        currentPage,
        pageSize,
        hasMore,
        loadMore,
        reset,
        totalItems: items.length,
        totalPages: Math.ceil(items.length / pageSize),
    };
}
