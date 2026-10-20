import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastItem {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
}

interface ToastContextValue {
    showToast: (toast: Omit<ToastItem, 'id'>, durationMs?: number) => void;
    removeToast: (id: string) => void;
    toasts: ToastItem[];
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showToast = useCallback(
        (toast: Omit<ToastItem, 'id'>, durationMs = 4000) => {
            const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const newToast: ToastItem = { ...toast, id };

            setToasts((prev) => [...prev, newToast]);

            if (durationMs > 0) {
                setTimeout(() => {
                    removeToast(id);
                }, durationMs);
            }
        },
        [removeToast]
    );

    return (
        <ToastContext.Provider value={{ showToast, removeToast, toasts }}>
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}