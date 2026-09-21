import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/presentation/components/ui/dialog";
import { Button } from "@/presentation/components/ui/button";
import { ScrollArea } from "@/presentation/components/ui/scroll-area";
import { Copy } from "lucide-react";

interface PayloadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    payload?: string;
}

export const PayloadDialog: React.FC<PayloadDialogProps> = ({ open, onOpenChange, payload }) => {
    const handleCopy = () => {
        if (payload) {
            navigator.clipboard.writeText(payload);
            // Optionally add toast notification here
        }
    };

    let formattedPayload = payload;
    try {
        if (payload) {
            formattedPayload = JSON.stringify(JSON.parse(payload), null, 2);
        }
    } catch (e) {
        // Not JSON, display as is
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle>Log Payload</DialogTitle>
                    <DialogDescription>
                        View the raw payload data for this event.
                    </DialogDescription>
                </DialogHeader>
                <div className="relative rounded-md border bg-muted p-4 font-mono text-sm max-h-[60vh] overflow-hidden">
                    <Button
                        size="icon"
                        variant="outline"
                        className="absolute right-4 top-4 h-8 w-8"
                        onClick={handleCopy}
                    >
                        <Copy className="h-4 w-4" />
                    </Button>
                    <ScrollArea className="h-[50vh] w-full">
                        <pre className="whitespace-pre-wrap break-all">
                            {formattedPayload || "No payload content."}
                        </pre>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
};
