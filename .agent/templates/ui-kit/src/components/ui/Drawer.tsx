import * as React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    /** Width of the drawer (default: 'md' = 400px) */
    size?: 'sm' | 'md' | 'lg' | 'xl';
    /** ID for the drawer title (used for aria-labelledby) */
    titleId?: string;
    /** ID for the drawer description (used for aria-describedby) */
    descriptionId?: string;
}

const sizeMap = {
    sm: 'max-w-sm',   // 384px
    md: 'max-w-md',   // 448px
    lg: 'max-w-lg',   // 512px
    xl: 'max-w-xl',   // 576px
};

/**
 * Accessible Drawer component with focus trap and ARIA support
 */
export const Drawer: React.FC<DrawerProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    titleId,
    descriptionId,
}) => {
    const drawerRef = React.useRef<HTMLDivElement>(null);
    const closeButtonRef = React.useRef<HTMLButtonElement>(null);
    const previousActiveElement = React.useRef<HTMLElement | null>(null);

    // Focus trap: Get all focusable elements
    const getFocusableElements = React.useCallback(() => {
        if (!drawerRef.current) return [];
        const focusableSelectors = [
            'button:not([disabled])',
            'a[href]',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
        ].join(', ');
        return Array.from(drawerRef.current.querySelectorAll<HTMLElement>(focusableSelectors));
    }, []);

    // Handle focus trap
    const handleKeyDown = React.useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
            return;
        }

        if (e.key !== 'Tab') return;

        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Shift + Tab: Move to last element if on first
        if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
        }
        // Tab: Move to first element if on last
        else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
        }
    }, [getFocusableElements, onClose]);

    // Manage focus when drawer opens/closes
    React.useEffect(() => {
        if (isOpen) {
            // Store currently focused element
            previousActiveElement.current = document.activeElement as HTMLElement;

            // Focus the close button when drawer opens
            setTimeout(() => {
                closeButtonRef.current?.focus();
            }, 50);

            // Add keyboard event listener
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';

            // Restore focus to previously focused element
            if (!isOpen && previousActiveElement.current) {
                previousActiveElement.current.focus();
            }
        };
    }, [isOpen, handleKeyDown]);

    const generatedTitleId = titleId || 'drawer-title';

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/40 z-40"
                        onClick={onClose}
                        aria-hidden="true"
                    />

                    {/* Drawer Panel */}
                    <motion.div
                        ref={drawerRef}
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className={`fixed top-0 right-0 h-full ${sizeMap[size]} w-full bg-white shadow-2xl z-50 flex flex-col`}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={generatedTitleId}
                        aria-describedby={descriptionId}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                            <h2
                                id={generatedTitleId}
                                className="text-lg font-semibold text-slate-900"
                            >
                                {title || 'Details'}
                            </h2>
                            <Button
                                ref={closeButtonRef}
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                aria-label="Close drawer"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default Drawer;
