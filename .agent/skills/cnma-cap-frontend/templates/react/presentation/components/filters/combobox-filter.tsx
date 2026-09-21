import React, { useState } from 'react';
import { Button } from "@/presentation/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/presentation/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/presentation/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComboboxFilterProps {
    /** Currently selected value */
    value: string;
    /** Callback when selection changes */
    onChange: (value: string) => void;
    /** Options to display */
    options: { label: string; value: string }[];
    /** Placeholder text when nothing selected */
    placeholder?: string;
    /** Whether to show search input */
    searchable?: boolean;
    /** Search input placeholder */
    searchPlaceholder?: string;
    /** Width class for the popover content */
    width?: string;
    /** Whether to use full width for dropdown */
    fullWidth?: boolean;
    /** Whether the combobox is disabled */
    disabled?: boolean;
}

/**
 * Reusable combobox filter (F4 value help)
 * following SAP Fiori pattern.
 */
export const ComboboxFilter: React.FC<ComboboxFilterProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    searchable = false,
    searchPlaceholder = 'Search...',
    width = 'w-48',
    fullWidth = false,
    disabled = false,
}) => {
    const [open, setOpen] = useState(false);

    const selectedLabel = options.find(opt => opt.value === value)?.label || placeholder;

    return (
        <Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        fullWidth ? "w-full" : width,
                        "justify-between h-10 truncate"
                    )}
                >
                    <span className="truncate">{value ? selectedLabel : placeholder}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className={cn(
                    "p-0 bg-white border shadow-lg",
                    fullWidth ? "w-[var(--radix-popover-trigger-width)]" : width
                )}
                align="start"
            >
                <Command>
                    {searchable && <CommandInput placeholder={searchPlaceholder} />}
                    <CommandList className="max-h-60 overflow-y-auto">
                        {searchable && <CommandEmpty>No results found.</CommandEmpty>}
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.value}
                                    onSelect={(currentValue) => {
                                        onChange(currentValue === value ? '' : currentValue);
                                        setOpen(false);
                                    }}
                                    className="truncate whitespace-nowrap overflow-hidden max-w-full"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};
