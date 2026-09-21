import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    onSubmit: () => void | Promise<void>;
    onCancel?: () => void;
    submitLabel?: string;
    cancelLabel?: string;
    children: React.ReactNode;
    isLoading?: boolean;
}

export function FormDialog({
    open,
    onOpenChange,
    title,
    onSubmit,
    onCancel,
    submitLabel = 'Save',
    cancelLabel = 'Cancel',
    children,
    isLoading = false,
}: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl w-[90vw] md:w-full max-h-[90vh] overflow-y-auto p-4 md:p-6 rounded-xl">
                <DialogHeader>
                    <DialogTitle className="text-lg md:text-xl font-bold">{title}</DialogTitle>
                </DialogHeader>
                <div className="form-content py-2 md:py-4 grid grid-cols-1 gap-4">
                    {children}
                </div>
                <DialogFooter className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-2 sm:mt-4">
                    <Button
                        variant="outline"
                        onClick={() => {
                            onCancel?.();
                            onOpenChange(false);
                        }}
                        disabled={isLoading}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        onClick={async () => { await onSubmit(); }}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Saving...' : submitLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
