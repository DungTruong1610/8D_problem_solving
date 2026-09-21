import React from 'react';
import { Button } from "@/presentation/components/ui/button";
import { Loader2 } from "lucide-react";

interface ActionToolbarProps {
    onExport: () => void;
    onReprocessBulk: () => void;
    onReprocessByFilter: () => void;
    hasSelection: boolean;
    isExporting?: boolean;
    isReprocessing?: boolean;
    totalCount: number;
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
    onExport,
    onReprocessBulk,
    onReprocessByFilter,
    hasSelection,
    isExporting,
    isReprocessing,
    totalCount
}) => {
    return (
        <div className="flex justify-between items-center mb-4 px-4 py-2">
            <h2 className="text-lg font-semibold">Log Records ({totalCount})</h2>
            <div className="flex gap-2">
                <Button variant="outline" onClick={onExport} disabled={isExporting}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Export Excel
                </Button>

                <Button
                    variant="secondary"
                    onClick={onReprocessBulk}
                    disabled={!hasSelection || isReprocessing}
                >
                    {isReprocessing && hasSelection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Reprocess Selected
                </Button>

                <Button
                    variant="destructive"
                    onClick={onReprocessByFilter}
                    disabled={isReprocessing}
                >
                    {isReprocessing && !hasSelection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Reprocess All (Filter)
                </Button>
            </div>
        </div>
    );
};
