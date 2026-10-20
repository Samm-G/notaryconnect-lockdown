import { ShieldCheck, LogOut, Clock, Globe } from 'lucide-react';

interface HeaderProps {
    secondsRemaining: number;
    onLogout: () => void;
    isLoggingOut: boolean;
}

export default function Header({ secondsRemaining, onLogout, isLoggingOut }: HeaderProps) {
    // Format seconds into HH:MM:SS
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
        <header className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between border-b border-notary-border pb-4 gap-4">
            <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-notary-badge border border-notary-yellow/30 text-notary-yellow shadow-inner">
                    <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                        NotaryConnect{' '}
                        <span className="text-notary-yellow text-xs font-mono uppercase px-2 py-0.5 rounded bg-notary-yellow/10 border border-notary-yellow/30">
                            Lockdown v0.1.0
                        </span>
                    </h1>
                    <p className="text-xs text-notary-muted">law.kroldon.app &bull; Tamper-Evident Ingestion Vault</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* Jurisdiction Indicator */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-notary-border text-xs text-zinc-300 font-mono">
                    <Globe className="w-3.5 h-3.5 text-notary-yellow" />
                    <span>IN (India)</span>
                </div>

                {/* 24-Hour Session Countdown Timer */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-notary-border text-xs text-zinc-300 font-mono">
                    <Clock className="w-3.5 h-3.5 text-notary-yellow animate-pulse" />
                    <span>Session:</span>
                    <span className="text-notary-yellow font-bold tracking-wider">
                        {formatTime(secondsRemaining)}
                    </span>
                </div>

                {/* Manual Stateless Logout */}
                <button
                    onClick={onLogout}
                    disabled={isLoggingOut}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors text-xs font-medium cursor-pointer disabled:opacity-50"
                    title="Clear Session Cookie Immediately"
                >
                    <LogOut className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{isLoggingOut ? 'Locking...' : 'Lock / Sign Out'}</span>
                </button>
            </div>
        </header>
    );
}