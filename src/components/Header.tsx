import { ShieldCheck, LogOut, Clock, Globe, AlertTriangle } from 'lucide-react';

interface HeaderProps {
    secondsRemaining: number;
    onLogout: () => void;
    isLoggingOut: boolean;
}

export default function Header({ secondsRemaining, onLogout, isLoggingOut }: HeaderProps) {
    const isExpiringSoon = secondsRemaining > 0 && secondsRemaining <= 300; // 5 minutes

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
        <header className="max-w-4xl w-full mx-auto space-y-2.5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                {/* Minimalist Brand */}
                <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-notary-yellow">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h1 className="text-base font-semibold text-white tracking-tight">
                        NotaryConnect
                    </h1>
                </div>

                {/* Session Controls */}
                <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 font-mono">
                        <Globe className="w-3.5 h-3.5 text-zinc-500" />
                        <span>IN</span>
                    </div>

                    {/* Session Timer Pill */}
                    <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono transition-colors ${isExpiringSoon
                            ? 'bg-yellow-950/60 border-notary-yellow text-notary-yellow shadow-sm'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                            }`}
                        title={isExpiringSoon ? 'Session expiring soon. Please finish active work.' : 'Active 24-hour session'}
                    >
                        <Clock className={`w-3.5 h-3.5 ${isExpiringSoon ? 'text-notary-yellow animate-pulse' : 'text-zinc-500'}`} />
                        <span>Session:</span>
                        <span className={`font-semibold ${isExpiringSoon ? 'text-notary-yellow' : 'text-zinc-200'}`}>
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
            </div>

            {/* Subtle 5-Minute Warning Banner */}
            {isExpiringSoon && (
                <div className="p-2 rounded-md bg-zinc-950 border border-notary-yellow/40 text-xs flex items-center justify-between text-yellow-200/90 font-mono animate-fadeIn">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-notary-yellow shrink-0 animate-pulse" />
                        <span>Session will expire soon. Please download any active documents.</span>
                    </div>
                    <span className="text-notary-yellow font-bold text-[11px] shrink-0">
                        {formatTime(secondsRemaining)} left
                    </span>
                </div>
            )}
        </header>
    );
}