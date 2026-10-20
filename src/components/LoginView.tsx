import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { KeyRound, ShieldAlert, ArrowRight, Loader2, Info } from 'lucide-react';
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

    // Focus the first input on mount
    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    // Lockout countdown timer
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
        // Only accept numeric inputs
        const numericChar = value.replace(/\D/g, '').slice(-1);
        const updated = [...digits];
        updated[index] = numericChar;
        setDigits(updated);
        setErrorMessage(null);

        // Auto-advance cursor to next box
        if (numericChar && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits are populated
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
                setErrorMessage(data.error || 'Authentication challenge failed.');
                if (typeof data.remainingAttempts === 'number') {
                    setRemainingAttempts(data.remainingAttempts);
                }
                if (data.lockoutSecondsRemaining) {
                    setLockoutSeconds(data.lockoutSecondsRemaining);
                }
                // Reset inputs on failure
                setDigits(['', '', '', '', '', '']);
                inputRefs.current[0]?.focus();
            }
        } catch {
            setErrorMessage('Network connection error. Verify edge worker is reachable.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-md w-full mx-auto my-auto bg-notary-card border border-notary-border rounded-xl p-8 shadow-2xl">
            <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto mb-4 bg-zinc-900 border border-notary-yellow/30 rounded-2xl flex items-center justify-center text-notary-yellow shadow-inner">
                    <KeyRound className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">Operator Authentication</h2>
                <p className="text-xs text-notary-muted mt-1.5 leading-relaxed">
                    Enter the 6-digit rolling verification code from your <strong className="text-zinc-300">Google Authenticator</strong> or <strong className="text-zinc-300">1Password</strong> app.
                </p>
            </div>

            {/* Lockout or Error Alert */}
            {errorMessage && (
                <div className="mb-6 p-3.5 rounded-lg bg-red-950/50 border border-red-500/40 text-red-300 text-xs flex items-start gap-2.5 animate-fadeIn">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="font-semibold">{errorMessage}</p>
                        {lockoutSeconds && lockoutSeconds > 0 ? (
                            <p className="font-mono text-red-200">
                                Lockout active: {Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s remaining.
                            </p>
                        ) : remainingAttempts !== null ? (
                            <p className="text-zinc-400">
                                Attempts remaining before 15-minute lock: <strong className="text-notary-yellow">{remainingAttempts}</strong>
                            </p>
                        ) : null}
                    </div>
                </div>
            )}

            {/* 6-Digit Segmented Code Input */}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    submitCode(digits.join(''));
                }}
                className="space-y-6"
            >
                <div className="flex justify-between gap-2 sm:gap-3">
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
                            className={`w-11 h-13 sm:w-12 sm:h-14 text-center font-mono text-xl sm:text-2xl font-bold rounded-lg border bg-zinc-900/90 text-white transition-all outline-none ${digit
                                ? 'border-notary-yellow ring-1 ring-notary-yellow/40 shadow-sm'
                                : 'border-zinc-700 hover:border-zinc-500 focus:border-notary-yellow focus:ring-1 focus:ring-notary-yellow'
                                } disabled:opacity-40 disabled:cursor-not-allowed`}
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
                    className="w-full py-3 px-4 rounded-lg bg-notary-gold hover:bg-notary-hover text-black font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-notary-gold/20"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Verifying Cryptographic Seed...</span>
                        </>
                    ) : (
                        <>
                            <span>Establish 24-Hour Session</span>
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </form>

            {/* Security Metadata Footer */}
            <div className="mt-6 pt-5 border-t border-notary-border/60 flex items-start gap-2 text-[11px] text-notary-muted leading-tight">
                <Info className="w-4 h-4 text-notary-yellow shrink-0 mt-0.5" />
                <p>
                    Enforces RFC 6238 TOTP with client-binding fingerprinting. Sessions automatically terminate after 24 hours.
                </p>
            </div>
        </div>
    );
}