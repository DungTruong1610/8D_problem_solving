import React from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/presentation/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface ReprocessByFilterConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    matchCount?: number; // Optional count if available from backend
}

export const ReprocessByFilterConfirmDialog: React.FC<ReprocessByFilterConfirmDialogProps> = ({ open, onOpenChange, onConfirm }) => {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        Confirm Mass Reprocessing
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2" asChild>
                        <div className="text-sm text-muted-foreground">
                            <p>
                                Are you sure you want to reprocess <strong>ALL</strong> logs matching the current filter?
                            </p>
                            <p className="font-semibold text-text-primary mt-2">
                                This action might take a significant amount of time and affect system performance.
                            </p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        Yes, Reprocess All
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};
