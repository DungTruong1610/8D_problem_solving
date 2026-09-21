import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Loader2, ChevronRight, ShieldX } from 'lucide-react';
import { Button } from '@cnma/react-ui';
import { Checkbox } from '@cnma/react-ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@cnma/react-ui';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationPrevious,
    PaginationNext,
} from '@cnma/react-ui';
import { ResizableTableHeader, useColumnWidths } from '@/components/ui/ResizableTableHeader';
import { useDateFormatter } from '@/hooks/use-date-formatter';
import { cn } from '@cnma/react-ui';

/**
 * Generic Column Definition for DataTable
 */
export interface DataTableColumn<T = any> {
    /** Unique key for the column (field name in data) */
    key: string;
    /** Translation key for header label */
    labelKey: string;
    /** Column width in pixels (optional, default: 150) */
    width?: number;
    /** Minimum column width in pixels (optional, default: 80) */
    minWidth?: number;
    /** Maximum column width in pixels (optional, for text wrapping) */
    maxWidth?: number;
    /** Whether this column is visible (default: true) */
    visible?: boolean;
    /** Render type for special formatting */
    renderType?: 'text' | 'link' | 'badge' | 'status' | 'date' | 'number' | 'duration' | 'custom';
    /** CSS classes for styling */
    className?: string;
    /** Custom render function (when renderType is 'custom') */
    render?: (value: any, row: T) => React.ReactNode;
    /** Badge color mapping for value-based styling */
    badgeColorMap?: Record<string, {
        bg: string;
        text: string;
    }>;
}

/**
 * Pagination configuration
 */
export interface PaginationConfig {
    page: number;
    pageSize: number;
    totalCount?: number | null;
    hasNextPage?: boolean;
    onPageChange: (page: number) => void;
}

/**
 * Selection configuration
 */
export interface SelectionConfig {
    enabled?: boolean;
    mode?: 'single' | 'multiple';
    selectedIds: Set<string>;
    onSelectionChange: (selectedIds: Set<string>) => void;
    getRowId: (row: any) => string;
}

/**
 * DataTable Props
 */
export interface DataTableProps<T = any> {
    /** Data items to display */
    data: T[];
    /** Column definitions */
    columns: DataTableColumn<T>[];
    /** Loading state */
    isLoading?: boolean;
    /** Placeholder data state (for optimistic updates) */
    isPlaceholderData?: boolean;
    /** Error object */
    error?: Error | null;
    /** Pagination configuration (optional) */
    pagination?: PaginationConfig;
    /** Selection configuration (optional) */
    selection?: SelectionConfig;
    /** Row click handler (optional) */
    onRowClick?: (row: T) => void;
    /** Optional predicate to determine if a row is clickable (default: all rows) */
    isRowClickable?: (row: T) => boolean;
    /**
     * Extra classes for a whole row, derived from the row itself.
     *
     * For state that belongs to the record rather than to one field — an overdue
     * case, a critical defect. Putting that in a cell hides it: a reader scanning
     * thirty rows sees the shape of the row, not the eleventh column. Returns
     * classes appended after the built-in ones, so a background here wins over
     * the default and the hover state still applies.
     */
    rowClassName?: (row: T) => string | undefined;
    /** Refresh handler (optional) */
    onRefresh?: () => void;
    /** Empty state message key */
    emptyMessageKey?: string;
    /** Error state message key */
    errorMessageKey?: string;
    /** Title to show above table (optional) */
    title?: string;
    /** Show footer with pagination (default: true) */
    showFooter?: boolean;
    /** Custom CSS class for container */
    className?: string;
    /** Scroll handler for infinite scroll (optional) */
    onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
    /** Maximum height for table with scroll (optional) */
    maxHeight?: string;
    /** Loading state for infinite scroll (optional) */
    isFetchingNextPage?: boolean;
    /** Variant: 'card' (boxed with border) or 'borderless' (flat, no container) */
    variant?: 'card' | 'borderless';
    /** Sticky header - header sticks to top when scrolling (for global scroll) */
    stickyHeader?: boolean;
    /** Sticky header offset - top position offset in pixels for sticky header (e.g., to position below other sticky elements) */
    stickyHeaderOffset?: number;
    /** Mobile render mode: 'table' keeps horizontal scroll table, 'card' renders each row as a vertical card on mobile */
    mobileRenderMode?: 'table' | 'card';
    /** Column filters state */
    columnFilters?: Record<string, any>;
    /** Callback when column filter is applied */
    onColumnFilterChange?: (key: string, filter: any | null) => void;
    /** Column sorting state */
    sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
    /** Callback when column sort is applied */
    onSortChange?: (key: string, dir: 'asc' | 'desc' | null) => void;
}

/**
 * Default cell renderer based on column renderType
 */
function DefaultCellRenderer<T>({
    column,
    value,
    row,
}: {
    column: DataTableColumn<T>;
    value: any;
    row: T;
}) {
    const { formatDate } = useDateFormatter();
    const { t } = useTranslation();

    // Custom render function takes precedence
    if (column.render) {
        return <>{column.render(value, row)}</>;
    }

    switch (column.renderType) {
        case 'link':
            return (
                <span className={column.className || 'text-primary font-medium'}>
                    {value}
                </span>
            );

        case 'badge':
            // Use badgeColorMap if provided, otherwise fall back to generic gray
            const colorConfig = column.badgeColorMap?.[value];
            const badgeClasses = colorConfig
                ? `${colorConfig.bg} ${colorConfig.text}`
                : 'bg-secondary text-secondary-foreground';

            return (
                <div className="flex items-center justify-start gap-2">
                    <span className={`px-2.5 py-0.5 text-sm font-semibold rounded-full ${badgeClasses}`}>
                        {value || '-'}
                    </span>
                </div>
            );

        // 'status' CO Y KHONG co nhanh mac dinh: moi mien co bo trang thai rieng.
        // Khai renderType 'custom' kem render de dung badge cua chinh mien do.

        case 'date':
            return value ? formatDate(value as string) : '-';

        case 'number':
            return (
                <span className={column.className || 'text-sm text-foreground'}>
                    {value ?? 0}
                </span>
            );

        case 'duration':
            return (
                <span className={column.className || 'text-sm text-muted-foreground'}>
                    {value ? `${value} ${t('common.days', 'days')}` : '-'}
                </span>
            );

        case 'text':
        default:
            return (
                <span className={column.className}>
                    {value ?? '-'}
                </span>
            );
    }
}

/**
 * DataTable - A reusable, configurable table component
 *
 * Features:
 * - Configurable columns with multiple render types
 * - Resizable column headers
 * - Row selection (single or multiple)
 * - Pagination (using reusable UI components)
 * - Loading and error states
 * - Row click handling
 */
export function DataTable<T = any>({
    data,
    columns,
    isLoading = false,
    isPlaceholderData = false,
    error = null,
    pagination,
    selection,
    onRowClick,
    isRowClickable,
    rowClassName,
    onRefresh,
    emptyMessageKey = 'common.noData',
    errorMessageKey = 'common.error',
    title,
    showFooter = true,
    className = '',
    onScroll,
    maxHeight,
    isFetchingNextPage = false,
    variant = 'card',
    stickyHeader = false,
    stickyHeaderOffset = 0,
    mobileRenderMode = 'table',
    columnFilters,
    onColumnFilterChange,
    sortConfig,
    onSortChange,
}: DataTableProps<T>) {
    const { t } = useTranslation();

    // Mobile detection for card render mode
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
    useEffect(() => {
        const mql = window.matchMedia('(max-width: 767px)');
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, []);

    const showMobileCards = mobileRenderMode === 'card' && isMobile;

    // Filter to visible columns only
    const visibleColumns = useMemo(
        () => columns.filter((col) => col.visible !== false),
        [columns]
    );

    // Column widths for resizable headers
    const { columnWidths, handleWidthChange } = useColumnWidths(
        visibleColumns.map((col) => ({ key: col.key, width: col.width || 150 }))
    );

    // Compute total table width and shared colgroup for split-table alignment
    const totalTableWidth = useMemo(() => {
        let total = 0;
        visibleColumns.forEach((col) => {
            total += columnWidths[col.key] || col.width || 150;
        });
        if (onRowClick) total += 24; // chevron column
        return total;
    }, [visibleColumns, columnWidths, onRowClick]);

    const renderColGroup = useCallback(() => (
        <colgroup>
            {visibleColumns.map((column) => (
                <col key={column.key} style={{ width: `${columnWidths[column.key] || column.width || 150}px` }} />
            ))}
            {onRowClick && <col style={{ width: '24px' }} />}
        </colgroup>
    ), [visibleColumns, columnWidths, onRowClick]);

    // Sticky header refs and state
    const headerRef = useRef<HTMLTableSectionElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const headerScrollRef = useRef<HTMLDivElement>(null);

    // Sticky bottom scrollbar proxy ref
    const scrollProxyRef = useRef<HTMLDivElement>(null);

    // Three-way scroll sync: header ↔ body ↔ proxy
    // Key principle: NEVER drop a scroll event. Always capture the latest scrollLeft.
    // Use RAF only to batch the DOM *writes*, not to skip reads.
    useEffect(() => {
        const body = tableContainerRef.current;
        const header = headerScrollRef.current;
        const proxy = scrollProxyRef.current;
        if (!body) return;

        // Update proxy inner width to match the body's scrollable width
        const updateProxyWidth = () => {
            if (proxy) {
                const proxyInner = proxy.firstElementChild as HTMLElement;
                if (proxyInner) {
                    proxyInner.style.width = `${body.scrollWidth}px`;
                }
                proxy.style.display =
                    body.scrollWidth > body.clientWidth ? '' : 'none';
            }
        };
        updateProxyWidth();

        const resizeObserver = new ResizeObserver(updateProxyWidth);
        resizeObserver.observe(body);
        if (body.firstElementChild) {
            resizeObserver.observe(body.firstElementChild);
        }

        // Track which element is actively being scrolled by the user
        // and the latest scrollLeft value (captured synchronously in event handler)
        let activeSource: 'header' | 'body' | 'proxy' | null = null;
        let latestScrollLeft = 0;
        let rafScheduled = false;

        const scheduleSync = (source: 'header' | 'body' | 'proxy', scrollLeft: number) => {
            // Always update to the latest values — never drop
            activeSource = source;
            latestScrollLeft = scrollLeft;

            if (!rafScheduled) {
                rafScheduled = true;
                requestAnimationFrame(() => {
                    rafScheduled = false;
                    const src = activeSource;
                    const left = latestScrollLeft;
                    // Write to the other two elements
                    if (header && src !== 'header') header.scrollLeft = left;
                    if (src !== 'body') body.scrollLeft = left;
                    if (proxy && src !== 'proxy') proxy.scrollLeft = left;
                    activeSource = null;
                });
            }
        };

        const onBodyScroll = () => scheduleSync('body', body.scrollLeft);
        const onHeaderScroll = () => { if (header) scheduleSync('header', header.scrollLeft); };
        const onProxyScroll = () => { if (proxy) scheduleSync('proxy', proxy.scrollLeft); };

        body.addEventListener('scroll', onBodyScroll, { passive: true });
        header?.addEventListener('scroll', onHeaderScroll, { passive: true });
        proxy?.addEventListener('scroll', onProxyScroll, { passive: true });

        return () => {
            resizeObserver.disconnect();
            body.removeEventListener('scroll', onBodyScroll);
            header?.removeEventListener('scroll', onHeaderScroll);
            proxy?.removeEventListener('scroll', onProxyScroll);
        };
    }, [data, visibleColumns]);


    // Selection handlers
    const handleSelectAll = useCallback(
        (checked: boolean) => {
            if (!selection) return;
            if (checked) {
                const allIds = new Set(data.map((row) => selection.getRowId(row)));
                selection.onSelectionChange(allIds);
            } else {
                selection.onSelectionChange(new Set());
            }
        },
        [data, selection]
    );

    const handleSelectRow = useCallback(
        (id: string, checked: boolean) => {
            if (!selection) return;

            if (selection.mode === 'single') {
                // Single selection mode - only one item selected at a time
                if (checked) {
                    selection.onSelectionChange(new Set([id]));
                } else {
                    selection.onSelectionChange(new Set());
                }
            } else {
                // Multiple selection mode
                const newSelected = new Set(selection.selectedIds);
                if (checked) {
                    newSelected.add(id);
                } else {
                    newSelected.delete(id);
                }
                selection.onSelectionChange(newSelected);
            }
        },
        [selection]
    );

    const handleRowClickInternal = useCallback(
        (row: T) => {
            if (onRowClick) {
                onRowClick(row);
            }
        },
        [onRowClick]
    );

    const showLoading = isLoading && !isPlaceholderData && data.length === 0;
    const showCheckboxColumn = selection?.enabled !== false && selection;

    // Pagination handlers
    const handlePrevPage = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            if (pagination && pagination.page > 1 && !isLoading) {
                pagination.onPageChange(pagination.page - 1);
            }
        },
        [pagination, isLoading]
    );

    const handleNextPage = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            if (pagination && pagination.hasNextPage && !isLoading) {
                pagination.onPageChange(pagination.page + 1);
            }
        },
        [pagination, isLoading]
    );

    // Borderless variant (for worklist pages with global scroll)
    if (variant === 'borderless') {
        // Mobile card rendering
        if (showMobileCards) {
            return (
                <div className={cn("bg-card rounded-xl shadow-sm border-0", className)}>
                    {title && (
                        <div className="py-3">
                            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                        </div>
                    )}

                    {showLoading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    )}

                    {data.length === 0 && !isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {error ? (
                                (error as any)?.isForbidden ? (
                                    <div className="flex flex-col items-center gap-2 py-4">
                                        <ShieldX className="w-10 h-10 text-destructive" />
                                        <span className="font-semibold text-destructive">{t('auth.accessDenied')}</span>
                                        <span className="text-sm">{t('auth.contactAdmin')}</span>
                                    </div>
                                ) : t(errorMessageKey)
                            ) : t(emptyMessageKey)}
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {data.map((row, index) => {
                                const rowId = selection?.getRowId(row) || `row-${index}`;
                                const isSelected = selection?.selectedIds.has(rowId);
                                const clickable = !onRowClick || !isRowClickable || isRowClickable(row);
                                // First column = title, rest = detail fields
                                const [titleCol, ...detailCols] = visibleColumns;
                                if (!titleCol) return null; // Guard: skip render if no columns loaded yet

                                return (
                                    <div
                                        key={rowId}
                                        className={`px-3 py-2.5 transition-colors ${rowClassName?.(row) ?? ''} ${onRowClick
                                            ? clickable
                                                ? 'active:bg-muted cursor-pointer'
                                                : 'cursor-not-allowed opacity-60'
                                            : ''
                                            } ${isSelected ? 'bg-primary/5' : ''}`}
                                        onClick={() => handleRowClickInternal(row)}
                                        style={{ opacity: isPlaceholderData ? 0.6 : 1 }}
                                    >
                                        {/* Title row: checkbox + first column value + chevron */}
                                        <div className="flex items-start gap-3">
                                            {showCheckboxColumn && (
                                                <div onClick={(e) => e.stopPropagation()} className="shrink-0 pt-0.5">
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={(checked) =>
                                                            handleSelectRow(rowId, checked as boolean)
                                                        }
                                                        aria-label={t('common.selectRow', { id: rowId })}
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm text-foreground break-words">
                                                    <DefaultCellRenderer column={titleCol} value={(row as any)[titleCol.key]} row={row} />
                                                </div>
                                            </div>
                                            {onRowClick && (
                                                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                            )}
                                        </div>

                                        {/* Detail fields as aligned label: value grid */}
                                        <div className={`mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm ${showCheckboxColumn ? 'pl-7' : ''}`}>
                                            {detailCols.map((column) => {
                                                const value = (row as any)[column.key];
                                                if (value === null || value === undefined || value === '') return null;
                                                return (
                                                    <React.Fragment key={column.key}>
                                                        <span className="font-semibold text-foreground whitespace-nowrap">{t(column.labelKey)}:</span>
                                                        <span className="text-foreground break-words min-w-0 [&_.rounded-full]:!bg-transparent [&_.rounded-full]:!p-0 [&_.rounded-full]:!border-0 [&_.rounded-full]:!shadow-none [&_.rounded-full]:!rounded-none">
                                                            <DefaultCellRenderer column={column} value={value} row={row} />
                                                        </span>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {isFetchingNextPage && (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                    )}

                    {showFooter && onRefresh && (
                        <div className="py-3 flex items-center justify-end">
                            <Button variant="ghost" size="sm" onClick={onRefresh} className="gap-1" disabled={isLoading}>
                                <RefreshCw className="w-4 h-4" />
                                {t('common.refresh', 'Refresh')}
                            </Button>
                        </div>
                    )}
                </div>
            );
        }

        // Desktop / table mode
        return (
            <div className={cn("bg-card rounded-xl shadow-sm border-0", className)}>
                {/* Title */}
                {title && (
                    <div className="py-3">
                        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                    </div>
                )}

                {/* Sticky Header — separate table, outside the scroll container so sticky works */}
                {stickyHeader ? (
                    <div
                        ref={headerScrollRef}
                        className="sm:sticky sm:z-20 bg-muted sm:shadow-sm overflow-hidden dt-scroll-host"
                        style={{ top: `${stickyHeaderOffset}px`, scrollbarWidth: 'none' }}
                    >
                        <Table style={{ tableLayout: 'fixed', width: '100%', minWidth: `${totalTableWidth}px` }}>
                            {renderColGroup()}
                            <TableHeader ref={headerRef} className="bg-muted">
                                <TableRow className="bg-muted">
                                    {visibleColumns.map((column, index) => (
                                        <ResizableTableHeader
                                            key={column.key}
                                            columnKey={column.key}
                                            initialWidth={column.width || 150}
                                            minWidth={column.minWidth || 80}
                                            onWidthChange={handleWidthChange}
                                            className={`bg-muted ${index === 0 && !showCheckboxColumn ? 'pl-6' : ''} ${column.className || ''}`}
                                            filter={columnFilters?.[column.key]}
                                            onFilterApply={onColumnFilterChange}
                                            onSortApply={onSortChange}
                                            sortConfig={sortConfig}
                                            dataType={(column as any).dataType}
                                        >
                                            {index === 0 && showCheckboxColumn ? (
                                                <div className="flex items-center gap-2">
                                                    {selection.mode !== 'single' && (
                                                        <Checkbox
                                                            checked={data.length > 0 && selection.selectedIds.size === data.length}
                                                            onCheckedChange={handleSelectAll}
                                                            aria-label={t('common.selectAll', 'Select all')}
                                                            className="shrink-0"
                                                        />
                                                    )}
                                                    <span>{t(column.labelKey)}</span>
                                                </div>
                                            ) : (
                                                t(column.labelKey)
                                            )}
                                        </ResizableTableHeader>
                                    ))}
                                    {onRowClick && <TableHead className="w-[24px] bg-muted" />}
                                </TableRow>
                            </TableHeader>
                        </Table>
                    </div>
                ) : null}

                {/* Table Body — scrollable container (header inline when not sticky).
                    dt-scroll-host: neutralize @cnma/react-ui's injected `overflow-auto`
                    table wrapper so THIS div owns horizontal scroll (see theme.css).
                    scrollbar-hidden: hide this div's own bar in both engines — the sticky
                    proxy below is the single visible horizontal scrollbar. */}
                <div
                    className="relative overflow-x-auto scrollbar-hidden dt-scroll-host"
                    ref={tableContainerRef}
                >
                    <Table style={{ tableLayout: 'fixed', width: '100%', minWidth: `${totalTableWidth}px` }}>
                        {renderColGroup()}
                        {/* Inline header when not sticky (no split needed) */}
                        {!stickyHeader && (
                            <TableHeader ref={headerRef} className="bg-muted">
                                <TableRow className="bg-muted">
                                    {visibleColumns.map((column, index) => (
                                        <ResizableTableHeader
                                            key={column.key}
                                            columnKey={column.key}
                                            initialWidth={column.width || 150}
                                            minWidth={column.minWidth || 80}
                                            onWidthChange={handleWidthChange}
                                            className={`${index === 0 && !showCheckboxColumn ? 'pl-6' : ''} ${column.className || ''}`}
                                            filter={columnFilters?.[column.key]}
                                            onFilterApply={onColumnFilterChange}
                                            onSortApply={onSortChange}
                                            sortConfig={sortConfig}
                                            dataType={(column as any).dataType}
                                        >
                                            {index === 0 && showCheckboxColumn ? (
                                                <div className="flex items-center gap-2">
                                                    {selection.mode !== 'single' && (
                                                        <Checkbox
                                                            checked={data.length > 0 && selection.selectedIds.size === data.length}
                                                            onCheckedChange={handleSelectAll}
                                                            aria-label={t('common.selectAll', 'Select all')}
                                                            className="shrink-0"
                                                        />
                                                    )}
                                                    <span>{t(column.labelKey)}</span>
                                                </div>
                                            ) : (
                                                t(column.labelKey)
                                            )}
                                        </ResizableTableHeader>
                                    ))}
                                    {onRowClick && <TableHead className="w-[24px]" />}
                                </TableRow>
                            </TableHeader>
                        )}
                        <TableBody className="relative">
                            {showLoading && (
                                <TableRow>
                                    <TableCell colSpan={visibleColumns.length + (onRowClick ? 1 : 0)} className="h-32">
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                            {data.length === 0 && !isLoading ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={visibleColumns.length + (onRowClick ? 1 : 0)}
                                        className="text-center py-8 text-muted-foreground"
                                    >
                                        {error ? (
                                            (error as any)?.isForbidden ? (
                                                <div className="flex flex-col items-center gap-2 py-4">
                                                    <ShieldX className="w-10 h-10 text-destructive" />
                                                    <span className="font-semibold text-destructive">{t('auth.accessDenied')}</span>
                                                    <span className="text-sm">{t('auth.contactAdmin')}</span>
                                                </div>
                                            ) : t(errorMessageKey)
                                        ) : t(emptyMessageKey)}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.map((row, index) => {
                                    const rowId = selection?.getRowId(row) || `row-${index}`;
                                    const isSelected = selection?.selectedIds.has(rowId);
                                    const clickable = !onRowClick || !isRowClickable || isRowClickable(row);

                                    return (
                                        <TableRow
                                            key={rowId}
                                            className={`group transition-colors ${onRowClick
                                                ? clickable
                                                    ? 'hover:bg-muted cursor-pointer'
                                                    : 'cursor-not-allowed opacity-60'
                                                : ''
                                                } ${isSelected ? 'bg-primary/5' : ''} ${rowClassName?.(row) ?? ''}`}
                                            onClick={() => handleRowClickInternal(row)}
                                            style={{ opacity: isPlaceholderData ? 0.6 : 1 }}
                                        >
                                            {visibleColumns.map((column, index) => {
                                                const isBadgeCol = column.renderType === 'badge' || column.renderType === 'status';
                                                return (
                                                    <TableCell
                                                        key={column.key}
                                                        style={{
                                                            width: `${columnWidths[column.key]}px`,
                                                            minWidth: `${column.minWidth || 60}px`,
                                                            ...(column.maxWidth && { maxWidth: `${column.maxWidth}px` }),
                                                        }}
                                                        className={`${isBadgeCol ? "whitespace-normal" : "whitespace-normal break-words overflow-hidden"} ${index === 0 && !showCheckboxColumn ? 'pl-6' : ''} ${column.className || ''}`}
                                                    >
                                                        {index === 0 && showCheckboxColumn ? (
                                                            <div className="flex items-center gap-2">
                                                                <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                                                                    <Checkbox
                                                                        checked={isSelected}
                                                                        onCheckedChange={(checked) =>
                                                                            handleSelectRow(rowId, checked as boolean)
                                                                        }
                                                                        aria-label={t('common.selectRow', { id: rowId })}
                                                                    />
                                                                </div>
                                                                <DefaultCellRenderer
                                                                    column={column}
                                                                    value={(row as any)[column.key]}
                                                                    row={row}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <DefaultCellRenderer
                                                                column={column}
                                                                value={(row as any)[column.key]}
                                                                row={row}
                                                            />
                                                        )}
                                                    </TableCell>
                                                );
                                            })}
                                            {onRowClick && (
                                                <TableCell className="w-[24px] px-0 pr-2 text-right text-muted-foreground">
                                                    <ChevronRight className="w-4 h-4 inline-block" />
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>

                    {/* Infinite scroll loading indicator */}
                    {isFetchingNextPage && (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                    )}
                </div>

                {/* Sticky horizontal scrollbar proxy — always visible at the bottom of viewport */}
                <div
                    ref={scrollProxyRef}
                    className="sticky bottom-0 z-10 overflow-x-auto"
                    style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'hsl(var(--border)) transparent',
                    }}
                >
                    <div style={{ height: '1px' }} />
                </div>

                {/* Footer - simplified for borderless */}
                {showFooter && onRefresh && (
                    <div className="py-3 flex items-center justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onRefresh}
                            className="gap-1"
                            disabled={isLoading}
                        >
                            <RefreshCw className="w-4 h-4" />
                            {t('common.refresh', 'Refresh')}
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    // Card variant (default - boxed with border)
    return (
        <div className={cn("bg-card rounded-xl shadow-sm border-2 border-border hover:border-[var(--color-primary)] transition-all overflow-hidden", className)}>
            {/* Title */}
            {title && (
                <div className="px-6 py-3 border-b border-border">
                    <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                </div>
            )}

            {/* Table Content */}
            <div
                className="relative overflow-x-auto"
                style={{
                    ...(maxHeight && {
                        maxHeight,
                        overflowY: 'auto',
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'hsl(var(--border)) transparent',
                    })
                }}
                onScroll={onScroll}
            >
                <Table style={{ tableLayout: 'fixed' }}>
                    <TableHeader>
                        <TableRow className="bg-muted">
                            {showCheckboxColumn && (
                                <TableHead className="px-1" style={{ width: '25px', minWidth: '25px', whiteSpace: 'nowrap' }}>
                                    {selection.mode !== 'single' && (
                                        <Checkbox
                                            checked={data.length > 0 && selection.selectedIds.size === data.length}
                                            onCheckedChange={handleSelectAll}
                                            aria-label={t('common.selectAll', 'Select all')}
                                        />
                                    )}
                                </TableHead>
                            )}
                            {visibleColumns.map((column, index) => (
                                <ResizableTableHeader
                                    key={column.key}
                                    columnKey={column.key}
                                    initialWidth={column.width || 150}
                                    minWidth={column.minWidth || 80}
                                    onWidthChange={handleWidthChange}
                                    className={`${index === 0 && !showCheckboxColumn ? 'pl-6' : ''} ${column.className || ''}`}
                                    filter={columnFilters?.[column.key]}
                                    onFilterApply={onColumnFilterChange}
                                    onSortApply={onSortChange}
                                    sortConfig={sortConfig}
                                    dataType={(column as any).dataType}
                                >
                                    {t(column.labelKey)}
                                </ResizableTableHeader>
                            ))}
                            {onRowClick && <TableHead className="w-[24px]" />}
                        </TableRow>
                    </TableHeader>
                    <TableBody className="relative">
                        {showLoading && (
                            <TableRow>
                                <TableCell colSpan={visibleColumns.length + (showCheckboxColumn ? 1 : 0) + (onRowClick ? 1 : 0)} className="h-64">
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {data.length === 0 && !isLoading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={visibleColumns.length + (showCheckboxColumn ? 1 : 0) + (onRowClick ? 1 : 0)}
                                    className="text-center py-8 text-muted-foreground"
                                >
                                    {error ? (
                                        (error as any)?.isForbidden ? (
                                            <div className="flex flex-col items-center gap-2 py-4">
                                                <ShieldX className="w-10 h-10 text-destructive" />
                                                <span className="font-semibold text-destructive">{t('auth.accessDenied')}</span>
                                                <span className="text-sm">{t('auth.contactAdmin')}</span>
                                            </div>
                                        ) : t(errorMessageKey)
                                    ) : t(emptyMessageKey)}
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((row, index) => {
                                // Fallback trên chỉ số, giống hai chỗ render kia.
                                //
                                // Trước đây là `|| ''`: bảng nào KHÔNG truyền `selection`
                                // thì mọi dòng nhận cùng một key rỗng, và React mất khả
                                // năng phân biệt dòng này với dòng kia — trạng thái cục
                                // bộ của một dòng có thể dính sang dòng khác khi danh
                                // sách được lọc hay sắp lại. Worklist 8D là đúng một
                                // bảng như vậy: 26 dòng, 25 cảnh báo trùng key.
                                const rowId = selection?.getRowId(row) || `row-${index}`;
                                const isSelected = selection?.selectedIds.has(rowId);

                                return (
                                    <TableRow
                                        key={rowId}
                                        data-state={isSelected ? 'selected' : undefined}
                                        className={`hover:bg-muted transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : ''} ${rowClassName?.(row) ?? ''}`}
                                        onClick={() => handleRowClickInternal(row)}
                                        style={{ opacity: isPlaceholderData ? 0.6 : 1 }}
                                    >
                                        {showCheckboxColumn && (
                                            <TableCell className="px-1" style={{ width: '25px', minWidth: '25px', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={(checked) =>
                                                        handleSelectRow(rowId, checked as boolean)
                                                    }
                                                    aria-label={t('common.selectRow', { id: rowId })}
                                                />
                                            </TableCell>
                                        )}
                                        {visibleColumns.map((column, index) => {
                                            const isBadgeCol = column.renderType === 'badge' || column.renderType === 'status';
                                            return (
                                                <TableCell
                                                    key={column.key}
                                                    style={{
                                                        width: `${columnWidths[column.key]}px`,
                                                        minWidth: `${column.minWidth || 80}px`,
                                                        ...(column.maxWidth && { maxWidth: `${column.maxWidth}px` }),
                                                    }}
                                                    className={`${isBadgeCol ? "whitespace-normal" : "whitespace-normal break-words"} ${index === 0 && !showCheckboxColumn ? 'pl-6' : ''} ${column.className || ''}`}
                                                >
                                                    <DefaultCellRenderer
                                                        column={column}
                                                        value={(row as any)[column.key]}
                                                        row={row}
                                                    />
                                                </TableCell>
                                            );
                                        })}
                                        {onRowClick && (
                                            <TableCell className="w-[24px] px-0 pr-2 text-right text-muted-foreground">
                                                <ChevronRight className="w-4 h-4 inline-block opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>

                {/* Infinite scroll loading indicator */}
                {isFetchingNextPage && (
                    <div className="flex items-center justify-center py-4 bg-muted">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                )}
            </div>

            {/* Footer with Pagination - Using Reusable UI Components */}
            {showFooter && (pagination || onRefresh) && (
                <div className="border-t border-border px-6 py-3 flex items-center justify-between bg-muted rounded-b-xl">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {onRefresh && (
                            <>
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>
                                    {isLoading ? t('common.updating', 'Updating...') : t('common.lastUpdated', 'Last updated')}
                                </span>
                            </>
                        )}
                        {pagination?.totalCount != null && (
                            <span className="ml-2 font-medium">
                                ({pagination.totalCount} {t('common.items', 'items')})
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {pagination && (
                            <Pagination>
                                <PaginationContent>
                                    <PaginationItem>
                                        <PaginationPrevious
                                            href="#"
                                            onClick={handlePrevPage}
                                            aria-disabled={pagination.page === 1 || isLoading}
                                            className={pagination.page === 1 || isLoading ? 'pointer-events-none opacity-50' : ''}
                                        />
                                    </PaginationItem>
                                    <PaginationItem>
                                        <span className="text-sm font-medium text-foreground px-3">
                                            {t('common.page', 'Page')} {pagination.page}
                                        </span>
                                    </PaginationItem>
                                    <PaginationItem>
                                        <PaginationNext
                                            href="#"
                                            onClick={handleNextPage}
                                            aria-disabled={!pagination.hasNextPage || isLoading}
                                            className={!pagination.hasNextPage || isLoading ? 'pointer-events-none opacity-50' : ''}
                                        />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        )}
                        {onRefresh && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onRefresh}
                                className="gap-1 ml-2"
                                disabled={isLoading}
                            >
                                <RefreshCw className="w-4 h-4" />
                                {t('common.refresh', 'Refresh')}
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default DataTable;
