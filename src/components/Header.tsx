import { ShieldCheck, LogOut, Clock, Globe } from 'lucide-react';

interface HeaderProps {
    secondsRemaining: number;
    onLogout: () => void;
    isLoggingOut: boolean;
}

export default function Header({ secondsRemaining, onLogout, isLoggingOut }: HeaderProps) {
    const formatTime = (totalSeconds: number): string => {
        if (totalSeconds <= 0) return '00:00:00';
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [
            hours.toString().padStart(2, '0'),
            minutes.toString().padStart(2, '0'),
            seconds.toString().padStart(2, '0'),
        ].join(':');
    };

    return (
        <header className="max-w-4xl w-full mx-auto flex items-center justify-between border-b border-zinc-800 pb-4">
            {/* Clean Minimalist Brand */}
            <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-md bg-zinc-900 border border-zinc-800 text-notary-yellow">
                    <ShieldCheck className="w-5 h-5" />
                </div>
                <h1 className="text-base font-semibold text-white tracking-tight">
                    NotaryConnect
                </h1>
            </div>

            {/* Session Controls */}
            <div className="flex items-center gap-2.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 font-mono">
                    <Globe className="w-3.5 h-3.5 text-zinc-500" />
                    <span>IN</span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono">
                    <Clock className="w-3.5 h-3.5 text-notary-yellow" />
                    <span>Session:</span>
                    <span className="text-notary-yellow font-medium">
                        {formatTime(secondsRemaining)}
                    </span>
                </div>

                <button
                    onClick={onLogout}
                    disabled={isLoggingOut}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors text-xs font-medium cursor-pointer disabled:opacity-50"
                >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
                </button>
            </div>
        </header>
    );
}