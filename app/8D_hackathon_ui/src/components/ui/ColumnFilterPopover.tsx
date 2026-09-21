import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Input, Button, DatePicker } from '@cnma/react-ui';
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Check,
  HelpCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNumberFormatter } from '@/hooks/use-number-formatter';

// ── Popover positioning constants ──────────────────────────────────
const POPOVER_WIDTH = 280;
const POPOVER_ESTIMATED_HEIGHT = 400;
const POPOVER_GAP = 2;
const VIEWPORT_PADDING = 8;

export interface ColumnFilterState {
  operator: string;
  value: string;
  valueTo?: string;
}

export interface ColumnConfig {
  key: string;
  label: string;
  dataType?: string;
  widgetType?: string;
  minWidth?: number;
}

interface ColumnFilterPopoverProps {
  column: ColumnConfig;
  filter?: ColumnFilterState;
  onApply: (columnKey: string, filter: ColumnFilterState | null) => void;
  onSort: (columnKey: string, direction: 'asc' | 'desc' | null) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

const TEXT_OPERATORS = [
  { key: 'contains', labelKey: 'common.filter.contains', fallback: 'Contains' },
  { key: 'equals', labelKey: 'common.filter.equals', fallback: 'Equals' },
  { key: 'notEquals', labelKey: 'common.filter.notEquals', fallback: 'Does Not Equal' },
  { key: 'startsWith', labelKey: 'common.filter.startsWith', fallback: 'Starts With' },
  { key: 'isEmpty', labelKey: 'common.filter.isEmpty', fallback: 'Is Empty' },
  { key: 'isNotEmpty', labelKey: 'common.filter.isNotEmpty', fallback: 'Is Not Empty' },
];

const NUMBER_OPERATORS = [
  { key: 'equals', labelKey: 'common.filter.equals', fallback: 'Equals' },
  { key: 'notEquals', labelKey: 'common.filter.notEquals', fallback: 'Does Not Equal' },
  { key: 'greaterThan', labelKey: 'common.filter.greaterThan', fallback: 'Is Greater Than' },
  { key: 'greaterThanOrEqual', labelKey: 'common.filter.greaterThanOrEqual', fallback: 'Is Greater Than or Equal To' },
  { key: 'lessThan', labelKey: 'common.filter.lessThan', fallback: 'Is Less Than' },
  { key: 'lessThanOrEqual', labelKey: 'common.filter.lessThanOrEqual', fallback: 'Is Less Than or Equal To' },
  { key: 'between', labelKey: 'common.filter.between', fallback: 'Is Between' },
  { key: 'isEmpty', labelKey: 'common.filter.isEmpty', fallback: 'Is Empty' },
  { key: 'isNotEmpty', labelKey: 'common.filter.isNotEmpty', fallback: 'Is Not Empty' },
];

const DATE_OPERATORS = [
  { key: 'equals', labelKey: 'common.filter.equals', fallback: 'Equals' },
  { key: 'notEquals', labelKey: 'common.filter.notEquals', fallback: 'Does Not Equal' },
  { key: 'greaterThan', labelKey: 'common.filter.greaterThan', fallback: 'Is Greater Than' },
  { key: 'greaterThanOrEqual', labelKey: 'common.filter.greaterThanOrEqual', fallback: 'Is Greater Than or Equal To' },
  { key: 'lessThan', labelKey: 'common.filter.lessThan', fallback: 'Is Less Than' },
  { key: 'lessThanOrEqual', labelKey: 'common.filter.lessThanOrEqual', fallback: 'Is Less Than or Equal To' },
  { key: 'between', labelKey: 'common.filter.between', fallback: 'Is Between' },
  { key: 'today', labelKey: 'common.filter.today', fallback: 'Today' },
  { key: 'thisMonth', labelKey: 'common.filter.thisMonth', fallback: 'This Month' },
  { key: 'isEmpty', labelKey: 'common.filter.isEmpty', fallback: 'Is Empty' },
  { key: 'isNotEmpty', labelKey: 'common.filter.isNotEmpty', fallback: 'Is Not Empty' },
];

const BOOLEAN_OPERATORS = [
  { key: 'true', labelKey: 'common.filter.isTrue', fallback: 'Is True' },
  { key: 'false', labelKey: 'common.filter.isFalse', fallback: 'Is False' },
  { key: 'isEmpty', labelKey: 'common.filter.isEmpty', fallback: 'Is Empty' },
  { key: 'isNotEmpty', labelKey: 'common.filter.isNotEmpty', fallback: 'Is Not Empty' },
];

const getColumnType = (column: ColumnConfig): 'date' | 'number' | 'boolean' | 'text' => {
  const dt = column.dataType?.toLowerCase();
  const wt = column.widgetType?.toLowerCase();
  if (dt === 'date' || wt === 'datepicker' || wt === 'date') {
    return 'date';
  }
  if (
    dt === 'decimal' ||
    dt === 'double' ||
    dt === 'int' ||
    dt === 'integer' ||
    dt === 'float' ||
    dt === 'number' ||
    wt === 'number'
  ) {
    return 'number';
  }
  if (dt === 'boolean' || wt === 'checkbox') {
    return 'boolean';
  }
  return 'text';
};

export function ColumnFilterPopover({
  column,
  filter,
  onApply,
  onSort,
  sortConfig,
  onClose,
  anchorRef
}: ColumnFilterPopoverProps) {
  const { t } = useTranslation();
  const { formatNumber, normalizeForDB } = useNumberFormatter();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Detect column type
  const colType = useMemo(() => getColumnType(column), [column]);

  // Operator list based on column type
  const operators = useMemo(() => {
    switch (colType) {
      case 'date':
        return DATE_OPERATORS;
      case 'number':
        return NUMBER_OPERATORS;
      case 'boolean':
        return BOOLEAN_OPERATORS;
      case 'text':
      default:
        return TEXT_OPERATORS;
    }
  }, [colType]);

  // Initial state values
  const defaultOp = useMemo(() => {
    if (colType === 'date') return 'between';
    if (colType === 'number') return 'equals';
    if (colType === 'boolean') return 'true';
    return 'contains';
  }, [colType]);

  const [selectedOp, setSelectedOp] = useState<string>(filter?.operator || defaultOp);
  // For number columns, format DB value ("1234.56") to locale display ("1.234,56" for de)
  const [localVal, setLocalVal] = useState<string>(
    colType === 'number' && filter?.value ? String(formatNumber(filter.value)) : (filter?.value || '')
  );
  const [localValTo, setLocalValTo] = useState<string>(
    colType === 'number' && filter?.valueTo ? String(formatNumber(filter.valueTo)) : (filter?.valueTo || '')
  );

  // Dates state for date pickers
  const [localDate, setLocalDate] = useState<string>(filter?.value || '');
  const [localDateTo, setLocalDateTo] = useState<string>(filter?.valueTo || '');

  // Position calculation: snap to anchor header cell.
  const [flipAbove, setFlipAbove] = useState(false);

  useEffect(() => {
    const updatePosition = () => {
      if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();

        let left = rect.left;
        if (left + POPOVER_WIDTH > window.innerWidth - VIEWPORT_PADDING) {
          left = rect.right - POPOVER_WIDTH;
        }
        left = Math.max(VIEWPORT_PADDING, left);

        const spaceBelow = window.innerHeight - rect.bottom;
        const shouldFlip = spaceBelow < POPOVER_ESTIMATED_HEIGHT + POPOVER_GAP;
        setFlipAbove(shouldFlip);

        if (shouldFlip) {
          const top = Math.max(VIEWPORT_PADDING, rect.top - POPOVER_ESTIMATED_HEIGHT - POPOVER_GAP);
          setPos({ top, left });
        } else {
          setPos({ top: rect.bottom + POPOVER_GAP, left });
        }
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [anchorRef]);

  // Second pass:Snap bottom to header top
  useEffect(() => {
    if (flipAbove && popoverRef.current && anchorRef.current) {
      const popoverHeight = popoverRef.current.offsetHeight;
      const rect = anchorRef.current.getBoundingClientRect();
      const top = Math.max(VIEWPORT_PADDING, rect.top - popoverHeight - POPOVER_GAP);
      setPos(prev => prev ? { ...prev, top } : prev);
    }
  }, [flipAbove, anchorRef]);

  // Close when clicking outside popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isCalendarClick = !!(target instanceof Element && target.closest('[data-radix-popper-content-wrapper], .rdp, .react-day-picker'));
      if (isCalendarClick) return;

      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        anchorRef.current && !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, anchorRef]);

  // Determine if input is needed for current operator
  const needsInput = useMemo(() => {
    return !(
      selectedOp === 'isEmpty' ||
      selectedOp === 'isNotEmpty' ||
      selectedOp === 'today' ||
      selectedOp === 'thisMonth' ||
      colType === 'boolean'
    );
  }, [selectedOp, colType]);

  const isBetweenOp = selectedOp === 'between';

  const [pendingSort, setPendingSort] = useState<'asc' | 'desc' | null>(
    sortConfig?.key === column.key ? sortConfig.direction : null
  );

  const handleSort = (dir: 'asc' | 'desc') => {
    setPendingSort(prev => (prev === dir ? null : dir));
  };

  const handleClear = () => {
    onApply(column.key, null);
    onSort(column.key, null);
    onClose();
  };

  const handleApply = () => {
    let finalVal = localVal;
    let finalValTo = localValTo;

    if (colType === 'date') {
      finalVal = localDate;
      finalValTo = localDateTo;
    } else if (colType === 'number') {
      finalVal = normalizeForDB(localVal);
      finalValTo = normalizeForDB(localValTo);
    }

    const currentSortDir = sortConfig?.key === column.key ? sortConfig.direction : null;
    if (pendingSort !== currentSortDir) {
      onSort(column.key, pendingSort);
    }

    onApply(column.key, {
      operator: selectedOp,
      value: finalVal,
      valueTo: isBetweenOp ? finalValTo : undefined,
    });
    onClose();
  };

  if (!pos) return null;

  const isCurrentSort = (dir: 'asc' | 'desc') => pendingSort === dir;

  return ReactDOM.createPortal(
    <div
      ref={popoverRef}
      className="fixed z-50 bg-card border border-border rounded-lg shadow-xl p-3 w-[280px] flex flex-col gap-2.5 text-foreground"
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Sorting Options */}
      <div className="flex flex-col gap-0.5 text-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleSort('asc')}
          className={`flex items-center gap-2.5 px-2 py-1.5 justify-start h-auto font-normal ${
            isCurrentSort('asc') ? 'bg-primary/5 text-primary font-medium' : ''
          }`}
        >
          <ArrowUp size={14} className="text-muted-foreground" />
          <span className="flex-1 text-left">{t('common.sortAscending', 'Sort Ascending')}</span>
          {isCurrentSort('asc') && <Check size={14} className="text-primary" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleSort('desc')}
          className={`flex items-center gap-2.5 px-2 py-1.5 justify-start h-auto font-normal ${
            isCurrentSort('desc') ? 'bg-primary/5 text-primary font-medium' : ''
          }`}
        >
          <ArrowDown size={14} className="text-muted-foreground" />
          <span className="flex-1 text-left">{t('common.sortDescending', 'Sort Descending')}</span>
          {isCurrentSort('desc') && <Check size={14} className="text-primary" />}
        </Button>
      </div>

      <hr className="border-border" />

      {/* 2. Clear Filter Option */}
      <div className="text-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={!filter}
          className="flex items-center gap-2.5 px-2 py-1.5 justify-start h-auto font-normal w-full text-destructive disabled:opacity-40"
        >
          <Trash2 size={14} className="shrink-0" />
          <span className="flex-1 text-left">{t('common.clearFilter', 'Clear Filter')}</span>
        </Button>
      </div>

      <hr className="border-border" />

      {/* 3. Operators List */}
      <div className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto pr-0.5 text-sm">
        {operators.map((op) => {
          const isActive = selectedOp === op.key;
          return (
            <Button
              key={op.key}
              variant="ghost"
              size="sm"
              onClick={() => setSelectedOp(op.key)}
              className={`flex items-center gap-2.5 px-2 py-1 justify-start h-auto font-normal ${
                isActive ? 'bg-primary/5 text-primary font-medium' : ''
              }`}
            >
              <span className="w-4 shrink-0 flex items-center justify-center">
                {isActive && <Check size={14} className="text-primary" />}
              </span>
              <span className="flex-1 truncate text-left">{t(op.labelKey, op.fallback)}</span>
            </Button>
          );
        })}
      </div>

      {/* 4. Dynamic Inputs */}
      {needsInput && (
        <>
          <hr className="border-border" />
          <div className="flex flex-col gap-2 p-1 text-sm">
            {colType === 'date' ? (
              isBetweenOp ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground">{t('common.from', 'From:')}</span>
                    <DatePicker
                      value={localDate || undefined}
                      onChange={setLocalDate}
                      className="w-full h-9 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground">{t('common.to', 'To:')}</span>
                    <DatePicker
                      value={localDateTo || undefined}
                      onChange={setLocalDateTo}
                      className="w-full h-9 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">{t('common.date', 'Date:')}</span>
                  <DatePicker
                    value={localDate || undefined}
                    onChange={setLocalDate}
                    className="w-full h-9 text-sm"
                  />
                </div>
              )
            ) : colType === 'number' ? (
              isBetweenOp ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground">{t('common.from', 'From:')}</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={localVal}
                      onChange={(e) => setLocalVal(e.target.value)}
                      placeholder={t('common.filter.startValue', 'Start value')}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground">{t('common.to', 'To:')}</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={localValTo}
                      onChange={(e) => setLocalValTo(e.target.value)}
                      placeholder={t('common.filter.endValue', 'End value')}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">{t('common.value', 'Value:')}</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={localVal}
                    onChange={(e) => setLocalVal(e.target.value)}
                    placeholder={t('common.filter.enterValue', 'Enter value')}
                    className="h-9 text-sm"
                  />
                </div>
              )
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">{t('common.value', 'Value:')}</span>
                <Input
                  type="text"
                  value={localVal}
                  onChange={(e) => setLocalVal(e.target.value)}
                  placeholder={t('common.filter.enterFilterText', 'Enter filter text...')}
                  className="h-9 text-sm"
                />
              </div>
            )}
          </div>
        </>
      )}

      <hr className="border-border" />

      {/* 5. Footer Buttons */}
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground p-1 h-auto"
          title={t('common.filter.help', 'Filter Help')}
        >
          <HelpCircle size={15} />
        </Button>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 text-sm font-medium"
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleApply}
            className="h-8 text-sm font-semibold px-3"
          >
            {t('common.ok', 'OK')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
