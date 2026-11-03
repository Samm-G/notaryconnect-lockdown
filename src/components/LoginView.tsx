import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { KeyRound, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';
import type { VerifyResponse } from '../types/auth';

interface LoginViewProps {
    onSuccess: () => void;
}

export default function LoginView({ onSuccess }: LoginViewProps) {
    const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
    const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    useEffect(() => {
        if (lockoutSeconds === null || lockoutSeconds <= 0) return;
        const interval = setInterval(() => {
            setLockoutSeconds((prev) => {
                if (prev === null || prev <= 1) {
                    clearInterval(interval);
                    setErrorMessage(null);
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [lockoutSeconds]);

    const handleDigitChange = (index: number, value: string) => {
        const numericChar = value.replace(/\D/g, '').slice(-1);
        const updated = [...digits];
        updated[index] = numericChar;
        setDigits(updated);
        setErrorMessage(null);

        if (numericChar && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        const fullCode = updated.join('');
        if (fullCode.length === 6) {
            submitCode(fullCode);
        }
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;

        const updated = [...digits];
        for (let i = 0; i < pasted.length; i++) {
            updated[i] = pasted[i];
        }
        setDigits(updated);

        if (pasted.length === 6) {
            submitCode(pasted);
        } else {
            inputRefs.current[Math.min(pasted.length, 5)]?.focus();
        }
    };

    const submitCode = async (codeToSubmit: string) => {
        if (codeToSubmit.length !== 6 || isLoading || (lockoutSeconds && lockoutSeconds > 0)) {
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            const response = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: codeToSubmit }),
            });

            const data: VerifyResponse = await response.json();

            if (response.ok && data.success) {
                onSuccess();
            } else {
                setErrorMessage(data.error || 'Invalid code.');
                if (typeof data.remainingAttempts === 'number') {
                    setRemainingAttempts(data.remainingAttempts);
                }
                if (data.lockoutSecondsRemaining) {
                    setLockoutSeconds(data.lockoutSecondsRemaining);
                }
                setDigits(['', '', '', '', '', '']);
                inputRefs.current[0]?.focus();
            }
        } catch {
            setErrorMessage('Connection error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-sm w-full mx-auto my-auto glass-panel rounded-2xl p-7 z-10">
            <div className="text-center mb-6">
                <div className="w-12 h-12 mx-auto mb-3 bg-notary-yellow/10 border border-notary-yellow/30 rounded-xl flex items-center justify-center text-notary-yellow shadow-[0_0_20px_rgba(250,204,21,0.2)]">
                    <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-semibold text-white">E-Stamp Sampark</h2>
                <p className="text-xs text-zinc-400 mt-1">
                    Enter 6-digit authenticator code
                </p>
            </div>

            {errorMessage && (
                <div className="mb-5 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                        <p>{errorMessage}</p>
                        {lockoutSeconds && lockoutSeconds > 0 ? (
                            <p className="font-mono text-red-300 mt-0.5">
                                Locked for {Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s
                            </p>
                        ) : remainingAttempts !== null ? (
                            <p className="text-zinc-400 mt-0.5">
                                {remainingAttempts} attempts left
                            </p>
                        ) : null}
                    </div>
                </div>
            )}

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    submitCode(digits.join(''));
                }}
                className="space-y-5"
            >
                <div className="flex justify-between gap-2">
                    {digits.map((digit, idx) => (
                        <input
                            key={idx}
                            ref={(el) => (inputRefs.current[idx] = el)}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={1}
                            value={digit}
                            disabled={isLoading || Boolean(lockoutSeconds && lockoutSeconds > 0)}
                            onChange={(e) => handleDigitChange(idx, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(idx, e)}
                            onPaste={handlePaste}
                            className={`w-11 h-12 text-center font-mono text-lg font-semibold rounded-xl border bg-white/[0.03] text-white transition-all outline-none ${digit
                                    ? 'border-notary-yellow/80 shadow-[0_0_12px_rgba(250,204,21,0.2)]'
                                    : 'border-white/10 hover:border-white/20 focus:border-notary-yellow'
                                } disabled:opacity-40`}
                        />
                    ))}
                </div>

                <button
                    type="submit"
                    disabled={
                        digits.join('').length !== 6 ||
                        isLoading ||
                        Boolean(lockoutSeconds && lockoutSeconds > 0)
                    }
                    className="w-full py-2.5 px-4 rounded-xl bg-notary-gold hover:bg-notary-hover text-black font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 glow-button"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Verifying...</span>
                        </>
                    ) : (
                        <>
                            <span>Continue</span>
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}