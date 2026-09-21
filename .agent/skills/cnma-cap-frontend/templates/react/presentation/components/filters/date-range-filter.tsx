import React from 'react';
import { Input } from "@/presentation/components/ui/input";

interface DateRangeFilterProps {
    /** Start date */
    startDate?: Date;
    /** End date */
    endDate?: Date;
    /** Callback when date range changes */
    onChange: (range: { start: Date; end: Date } | undefined) => void;
}

/**
 * Reusable date range filter with two HTML date inputs (From — To).
 * Matches SAP Fiori DatePicker pattern.
 */
export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
    startDate,
    endDate,
    onChange,
}) => {
    const formatDate = (d?: Date) => d ? d.toISOString().slice(0, 10) : '';

    return (
        <div className="flex gap-2 items-center">
            <Input
                type="date"
                className="flex-1 min-w-[130px]" // Use flex-1 to fill space, min-w to prevent crushing
                value={formatDate(startDate)}
                onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                        onChange({
                            start: new Date(val + 'T00:00:00'),
                            end: endDate || new Date(val + 'T23:59:59')
                        });
                    } else {
                        onChange(undefined);
                    }
                }}
                max={formatDate(endDate) || undefined}
            />
            <span className="text-sm text-muted-foreground shrink-0">—</span>
            <Input
                type="date"
                className="flex-1 min-w-[130px]"
                value={formatDate(endDate)}
                onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                        onChange({
                            start: startDate || new Date(val + 'T00:00:00'),
                            end: new Date(val + 'T23:59:59')
                        });
                    } else {
                        onChange(undefined);
                    }
                }}
                min={formatDate(startDate) || undefined}
            />
        </div>
    );
};
