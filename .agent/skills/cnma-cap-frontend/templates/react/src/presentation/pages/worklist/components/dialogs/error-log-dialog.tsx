import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/presentation/components/ui/dialog";
import { ScrollArea } from "@/presentation/components/ui/scroll-area";

interface ErrorLogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    errorDetail?: string;
}

export const ErrorLogDialog: React.FC<ErrorLogDialogProps> = ({ open, onOpenChange, errorDetail }) => {
    const formatError = (error: string | undefined | null) => {
        if (!error) return 'No error details available.';
        try {
            // Try to parse as JSON and pretty print
            const jsonObj = JSON.parse(error);
            return JSON.stringify(jsonObj, null, 2);
        } catch (e) {
            // Not JSON, return as is
            return error;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Error Details</DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 w-full rounded-md border p-4 bg-slate-50">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words text-text-primary">
                        {formatError(errorDetail)}
                    </pre>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};
