import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/presentation/components/ui/dialog";
import { Button } from "@/presentation/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

export type ActionResultType = 'success' | 'error' | 'info';

interface ActionResultDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: ActionResultType;
    title?: string;
    message: string;
}

export const ActionResultDialog: React.FC<ActionResultDialogProps> = ({
    open,
    onOpenChange,
    type,
    title,
    message
}) => {
    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle2 className="h-6 w-6 text-green-600" />;
            case 'error':
                return <XCircle className="h-6 w-6 text-destructive" />;
            default:
                return null;
        }
    };

    const getTitle = () => {
        if (title) return title;
        switch (type) {
            case 'success': return 'Success';
            case 'error': return 'Error';
            default: return 'Notification';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {getIcon()}
                        {getTitle()}
                    </DialogTitle>
                </DialogHeader>
                <div className="py-4 text-sm text-text-secondary">
                    {message}
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
