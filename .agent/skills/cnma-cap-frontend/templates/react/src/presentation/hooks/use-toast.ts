import { useState, useCallback, useRef, useEffect } from 'react';

interface ToastMessage {
    text: string;
    type: 'success' | 'error';
}

/**
 * Simple toast message hook with auto-dismiss and cleanup.
 * Usage:
 *   const { message, showSuccess, showError, clear } = useToast();
 *   showSuccess('Saved!');
 *   {message && <Alert variant={message.type === 'success' ? 'default' : 'destructive'}>{message.text}</Alert>}
 */
export function useToast(duration = 4000) {
    const [message, setMessage] = useState<ToastMessage | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clear = useCallback(() => {
        setMessage(null);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const show = useCallback((text: string, type: 'success' | 'error') => {
        clear();
        setMessage({ text, type });
        timerRef.current = setTimeout(() => setMessage(null), duration);
    }, [duration, clear]);

    const showSuccess = useCallback((text: string) => show(text, 'success'), [show]);
    const showError = useCallback((text: string) => show(text, 'error'), [show]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return { message, showSuccess, showError, clear };
}
