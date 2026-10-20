import { useToast, ToastType } from '../context/ToastContext';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export default function ToastContainer() {
    const { toasts, removeToast } = useToast();

    if (toasts.length === 0) return null;

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success':
                return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
            case 'warning':
                return <AlertTriangle className="w-4 h-4 text-notary-yellow shrink-0" />;
            case 'error':
                return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
            case 'info':
            default:
                return <Info className="w-4 h-4 text-zinc-300 shrink-0" />;
        }
    };

    const getBorderColor = (type: ToastType) => {
        switch (type) {
            case 'success':
                return 'border-emerald-500/40 bg-zinc-900/95';
            case 'warning':
                return 'border-notary-yellow/50 bg-zinc-900/95';
            case 'error':
                return 'border-red-500/50 bg-zinc-900/95';
            case 'info':
            default:
                return 'border-zinc-700 bg-zinc-900/95';
        }
    };

    return (
        <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`pointer-events-auto border rounded-xl p-3.5 shadow-2xl backdrop-blur-md flex items-start justify-between gap-3 transition-all duration-200 animate-fadeIn ${getBorderColor(
                        toast.type
                    )}`}
                >
                    <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">{getIcon(toast.type)}</div>
                        <div className="space-y-0.5">
                            <h4 className="text-xs font-semibold text-white tracking-tight">{toast.title}</h4>
                            {toast.message && (
                                <p className="text-[11px] text-notary-muted leading-relaxed font-mono">
                                    {toast.message}
                                </p>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => removeToast(toast.id)}
                        className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors shrink-0"
                        title="Dismiss"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            ))}
        </div>
    );
}