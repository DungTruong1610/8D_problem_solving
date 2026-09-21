import { useState, useEffect } from 'react';
import { globalEvents, EVENT_TYPES } from '../../lib/events';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface ToastMessage {
    id: number;
    message: string;
    type: 'error' | 'success' | 'info';
}

export const GlobalToast = () => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    useEffect(() => {
        let id = 0;

        const addToast = (message: string, type: 'error' | 'success' | 'info') => {
            const toastId = ++id;
            setToasts(prev => [...prev, { id: toastId, message, type }]);

            // Auto-dismiss after 4 seconds
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== toastId));
            }, 4000);
        };

        const handleApiError = (msg: string) => addToast(`Error: ${msg}`, 'error');
        const handleShowToast = (msg: string) => addToast(msg, 'info');

        globalEvents.on(EVENT_TYPES.API_ERROR, handleApiError);
        globalEvents.on(EVENT_TYPES.SHOW_TOAST, handleShowToast);

        return () => {
            globalEvents.off(EVENT_TYPES.API_ERROR, handleApiError);
            globalEvents.off(EVENT_TYPES.SHOW_TOAST, handleShowToast);
        };
    }, []);

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const getToastStyles = (type: ToastMessage['type']) => {
        switch (type) {
            case 'error':
                return 'bg-red-50 border-red-200 text-red-800';
            case 'success':
                return 'bg-green-50 border-green-200 text-green-800';
            default:
                return 'bg-blue-50 border-blue-200 text-blue-800';
        }
    };

    const getIcon = (type: ToastMessage['type']) => {
        switch (type) {
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-500" />;
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            default:
                return <Info className="w-5 h-5 text-blue-500" />;
        }
    };

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-[300px] max-w-md animate-in fade-in slide-in-from-bottom-2 ${getToastStyles(toast.type)}`}
                >
                    {getIcon(toast.type)}
                    <span className="flex-1 text-sm font-medium">{toast.message}</span>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="p-1 rounded-md hover:bg-black/5 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};
