import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from "@/presentation/components/ui/input";
import { Button } from "@/presentation/components/ui/button";
import { X } from 'lucide-react';
// import * as Constants from '@/core/Constants'; // Import your constants
import { MultiComboboxFilter } from "@/presentation/components/filters/MultiComboboxFilter";
import { ComboboxFilter } from "@/presentation/components/filters/ComboboxFilter";
import { DateRangeFilter } from "@/presentation/components/filters/DateRangeFilter";

interface FilterBarProps {
    filters: Record<string, any>; // Define your filter shape here
    onFilterChange: (newFilters: Record<string, unknown>) => void;
    onSearch: () => void;
    onClear: () => void;
    // Add other props like available options
    availableObjectTypes?: string[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
    filters,
    onFilterChange,
    onSearch,
    onClear,
    availableObjectTypes = []
}) => {
    const { t } = useTranslation();

    const handleInputChange = (key: string, value: unknown) => {
        onFilterChange({ [key]: value });
    };

    // Example options
    const objectTypeOptions = availableObjectTypes.map(type => ({ label: type, value: type }));

    return (
        <div className="p-4 bg-white rounded-lg shadow mb-4 relative z-20">
            {/* Responsive Grid: 1 col mobile, 2 col tablet, 3+ col desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
                {/* Example: Multi-Select Filter */}
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('filterBar.objectType')}</label>
                    <MultiComboboxFilter
                        values={filters?.objectType || []}
                        onChange={(vals) => handleInputChange('objectType', vals)}
                        options={objectTypeOptions}
                        placeholder={t('filterBar.selectType')}
                        width="w-full"
                    />
                </div>

                {/* Example: Input Filter */}
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('filterBar.search')}</label>
                    <Input
                        className="w-full"
                        placeholder={t('filterBar.searchPlaceholder')}
                        value={filters?.search || ''}
                        onChange={(e) => handleInputChange('search', e.target.value)}
                    />
                </div>

                {/* Example: Date Range Filter */}
                <div className="flex flex-col sm:col-span-2 lg:col-span-2">
                    <label className="text-sm font-medium mb-1">{t('filterBar.dateRange')}</label>
                    <DateRangeFilter
                        startDate={filters?.dateRange?.start}
                        endDate={filters?.dateRange?.end}
                        onChange={(range) => handleInputChange('dateRange', range)}
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                <Button onClick={onClear} variant="outline" className="flex-1 sm:flex-none">
                    <X className="h-4 w-4 mr-2" />
                    {t('filterBar.clear')}
                </Button>
                <Button onClick={onSearch} className="flex-1 sm:flex-none">
                    {t('filterBar.search')}
                </Button>
            </div>
        </div>
    );
};
