import { useState, useCallback } from 'react';

interface ConfirmConfig {
    title: string;
    description: string;
    confirmLabel?: string;
    variant?: 'default' | 'destructive';
}

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    onConfirm: () => void;
    confirmLabel: string;
    cancelLabel: string;
    variant: 'default' | 'destructive';
}

/**
 * Hook for imperative confirm dialog usage.
 * Usage:
 *   const { confirmProps, confirm } = useConfirmDialog();
 *   confirm({ title: 'Delete?', description: '...' }, async () => { ... });
 *   <ConfirmDialog {...confirmProps} />
 */
export function useConfirmDialog() {
    const [open, setOpen] = useState(false);
    const [config, setConfig] = useState<ConfirmConfig & { onConfirm: () => void }>({
        title: '',
        description: '',
        onConfirm: () => {},
    });

    const confirm = useCallback((cfg: ConfirmConfig, onConfirm: () => void | Promise<void>) => {
        setConfig({ ...cfg, onConfirm: () => onConfirm() });
        setOpen(true);
    }, []);

    const confirmProps: ConfirmDialogProps = {
        open,
        onOpenChange: setOpen,
        title: config.title,
        description: config.description,
        onConfirm: config.onConfirm,
        confirmLabel: config.confirmLabel || 'Confirm',
        cancelLabel: 'Cancel',
        variant: config.variant || 'default',
    };

    return { confirmProps, confirm };
}
