import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from "@/presentation/components/ui/input";
import { Button } from "@/presentation/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/presentation/components/ui/select";
import { Constants } from "@/core/Constants";
import { DatePickerWithRange } from "@/presentation/components/ui/date-range-picker";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/presentation/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/presentation/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface FilterBarProps {
    filters: any;
    onFilterChange: (filters: any) => void;
    onSearch: () => void;
    availableObjectTypes?: string[];
}

export const FilterBar: React.FC<FilterBarProps> = ({ filters, onFilterChange, onSearch, availableObjectTypes = [] }) => {
    const { t } = useTranslation();
    const [openObjectType, setOpenObjectType] = useState(false);

    const handleInputChange = (key: string, value: any) => {
        onFilterChange({ [key]: value });
    };

    const currentObjectType = filters.objectType?.[0] || "";

    return (
        <div className="flex flex-wrap gap-4 p-4 bg-white rounded-lg shadow mb-4 items-end">
            {/* Object Type (Combobox) */}
            <div className="flex flex-col w-64">
                <label className="text-sm font-medium mb-1">{t('logTable.headers.objectType')}</label>
                <Popover open={openObjectType} onOpenChange={setOpenObjectType}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openObjectType}
                            className="w-full justify-between"
                        >
                            {currentObjectType
                                ? availableObjectTypes.find((type) => type === currentObjectType) || currentObjectType
                                : t('filterBar.filterByType')}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0">
                        <Command>
                            <CommandInput placeholder="Search object type..." />
                            <CommandList>
                                <CommandEmpty>No object type found.</CommandEmpty>
                                <CommandGroup>
                                    <CommandItem
                                        value="ALL"
                                        onSelect={() => {
                                            handleInputChange('objectType', []);
                                            setOpenObjectType(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                currentObjectType === "" ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        All
                                    </CommandItem>
                                    {availableObjectTypes.map((type) => (
                                        <CommandItem
                                            key={type}
                                            value={type}
                                            onSelect={(currentValue) => {
                                                handleInputChange('objectType', currentValue === currentObjectType ? [] : [currentValue]);
                                                setOpenObjectType(false);
                                            }}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    currentObjectType === type ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {type}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Object Key */}
            <div className="flex flex-col w-48">
                <label className="text-sm font-medium mb-1">{t('logTable.headers.objectKey')}</label>
                <Input
                    placeholder={t('filterBar.searchPlaceholder')}
                    value={filters.objectKey || ''}
                    onChange={(e) => handleInputChange('objectKey', e.target.value)}
                />
            </div>

            {/* Date Range */}
            <div className="flex flex-col">
                <label className="text-sm font-medium mb-1">{t('logTable.headers.processingDate')}</label>
                <DatePickerWithRange
                    date={filters.dateRange}
                    onDateChange={(range) => handleInputChange('dateRange', range)}
                />
            </div>

            {/* Event Status */}
            <div className="flex flex-col w-48">
                <label className="text-sm font-medium mb-1">{t('logTable.headers.status')}</label>
                <Select
                    onValueChange={(val) => handleInputChange('status', val === 'ALL' ? '' : val)}
                    defaultValue={filters.status || "ALL"}
                >
                    <SelectTrigger>
                        <SelectValue placeholder={t('filterBar.filterByStatus')} />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50 border shadow-lg max-h-[300px]">
                        <SelectItem value="ALL">All</SelectItem>
                        {Object.values(Constants.LOG_EVENT_STATUS).map(status => (
                            <SelectItem key={status} value={status}>{status.toUpperCase()}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Search Button */}
            <Button onClick={onSearch}>{t('filterBar.search')}</Button>
        </div>
    );
};
