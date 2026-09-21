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
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/presentation/components/ui/badge";

interface MultiComboboxFilterProps {
    /** Currently selected values */
    values: string[];
    /** Callback when selection changes */
    onChange: (values: string[]) => void;
    /** Options to display */
    options: { label: string; value: string }[];
    /** Placeholder text when nothing selected */
    placeholder?: string;
    /** Search input placeholder */
    searchPlaceholder?: string;
    /** Width class */
    width?: string;
}

/**
 * Reusable multi-select combobox filter (F4 value help)
 * matching SAP UI5 MultiComboBox behavior.
 */
export const MultiComboboxFilter: React.FC<MultiComboboxFilterProps> = ({
    values,
    onChange,
    options,
    placeholder = 'Select...',
    searchPlaceholder = 'Search...',
    width = 'w-64',
}) => {
    const [open, setOpen] = useState(false);

    const toggleValue = (val: string) => {
        if (values.includes(val)) {
            onChange(values.filter(v => v !== val));
        } else {
            onChange([...values, val]);
        }
    };

    const removeValue = (val: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(values.filter(v => v !== val));
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(width, "justify-between h-auto min-h-9")}
                >
                    <div className="flex flex-wrap gap-1 flex-1 text-left">
                        {values.length > 0 ? (
                            values.map(v => {
                                const label = options.find(o => o.value === v)?.label || v;
                                return (
                                    <Badge
                                        key={v}
                                        variant="secondary"
                                        className="text-xs px-1.5 py-0"
                                    >
                                        {label}
                                        <X
                                            className="ml-1 h-3 w-3 cursor-pointer"
                                            onClick={(e) => removeValue(v, e)}
                                        />
                                    </Badge>
                                );
                            })
                        ) : (
                            <span className="text-muted-foreground">{placeholder}</span>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className={cn(width, "p-0 bg-white border shadow-lg")}>
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup>
                            {/* Clear All option */}
                            <CommandItem
                                value="__CLEAR_ALL__"
                                onSelect={() => {
                                    onChange([]);
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        values.length === 0 ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                All
                            </CommandItem>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.value}
                                    onSelect={() => toggleValue(option.value)}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            values.includes(option.value) ? "opacity-100" : "opacity-0"
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
