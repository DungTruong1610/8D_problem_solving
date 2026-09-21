import React, { useState, useCallback, useRef } from 'react';
import { TableHead } from '@cnma/react-ui';
import { Filter } from 'lucide-react';
import { ColumnFilterPopover, type ColumnFilterState } from './ColumnFilterPopover';

interface ResizableTableHeaderProps {
    children: React.ReactNode;
    columnKey: string;
    initialWidth?: number;
    minWidth?: number;
    onWidthChange?: (key: string, width: number) => void;
    className?: string;
    filter?: ColumnFilterState;
    onFilterApply?: (key: string, filter: ColumnFilterState | null) => void;
    onSortApply?: (key: string, direction: 'asc' | 'desc' | null) => void;
    sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
    dataType?: string;
}

/**
 * A resizable table header cell with a draggable right border.
 * Uses requestAnimationFrame + direct DOM style mutation during drag to avoid
 * re-rendering the entire table on every mousemove event, eliminating scroll lag.
 */
export function ResizableTableHeader({
    children,
    columnKey,
    initialWidth = 150,
    minWidth = 50,
    onWidthChange,
    className = '',
    filter,
    onFilterApply,
    onSortApply,
    sortConfig,
    dataType,
}: ResizableTableHeaderProps) {
    const [width, setWidth] = useState(initialWidth);
    const [isResizing, setIsResizing] = useState(false);
    const [showFilter, setShowFilter] = useState(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);
    const currentWidthRef = useRef(initialWidth);
    const rafRef = useRef<number | null>(null);
    const thRef = useRef<HTMLTableCellElement>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Remove focus from any active input to prevent it from keeping focus during/after resize
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        
        setIsResizing(true);
        startXRef.current = e.clientX;
        startWidthRef.current = currentWidthRef.current;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            // Cancel any pending RAF to avoid queuing multiple frames
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                const delta = moveEvent.clientX - startXRef.current;
                const newWidth = Math.max(minWidth, startWidthRef.current + delta);
                currentWidthRef.current = newWidth;
                // Mutate DOM directly — zero React re-renders during drag
                if (thRef.current) {
                    thRef.current.style.width = `${newWidth}px`;
                }
                // Propagate to colgroup / body table sync
                onWidthChange?.(columnKey, newWidth);
            });
        };

        const handleMouseUp = () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            setIsResizing(false);
            // Commit final width to React state once on mouseup (single re-render)
            setWidth(currentWidthRef.current);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [minWidth, columnKey, onWidthChange]);

    const isRightAligned = className.includes('text-right');
    const hasFilter = !!filter && (
        filter.operator === 'isEmpty' ||
        filter.operator === 'isNotEmpty' ||
        filter.operator === 'today' ||
        filter.operator === 'thisMonth' ||
        (filter.value !== undefined && filter.value !== '')
    );

    const showFilterTrigger = !!onFilterApply || !!onSortApply;

    return (
        <TableHead
            ref={thRef}
            style={{ width: `${width}px`, minWidth: `${minWidth}px`, position: 'relative' }}
            className={`group select-none cursor-pointer ${hasFilter ? 'bg-primary/5' : ''} ${className}`}
            onClick={(e) => {
                if (!isResizing && showFilterTrigger) {
                    e.stopPropagation();
                    setShowFilter(prev => !prev);
                }
            }}
        >
            <div className={`flex items-center gap-1 pr-2 ${isRightAligned ? 'justify-end w-full' : 'justify-between'}`}>
                <span className="truncate text-sm font-semibold">{children}</span>
                {hasFilter && <Filter size={13} className="text-primary shrink-0" />}
            </div>
            {/* Resize handle */}
            <div
                className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize 
          hover:bg-[var(--color-primary)] transition-colors
          ${isResizing ? 'bg-[var(--color-primary)]' : 'bg-transparent group-hover:bg-border'}`}
                onMouseDown={handleMouseDown}
                onClick={(e) => e.stopPropagation()}
            />
            {/* Filter Popover */}
            {showFilter && showFilterTrigger && (
                <ColumnFilterPopover
                    column={{
                        key: columnKey,
                        label: String(children || ''),
                        dataType: dataType,
                    }}
                    filter={filter}
                    onApply={(key, f) => onFilterApply?.(key, f)}
                    onSort={(key, dir) => onSortApply?.(key, dir)}
                    sortConfig={sortConfig || null}
                    onClose={() => setShowFilter(false)}
                    anchorRef={thRef}
                />
            )}
        </TableHead>
    );
}

/**
 * Hook to manage column widths state
 */
export function useColumnWidths(columns: { key: string; width?: number }[]) {
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        const initial: Record<string, number> = {};
        columns.forEach((col) => {
            initial[col.key] = col.width || 150;
        });
        return initial;
    });

    const handleWidthChange = useCallback((key: string, width: number) => {
        setColumnWidths((prev) => ({ ...prev, [key]: width }));
    }, []);

    return { columnWidths, handleWidthChange };
}
