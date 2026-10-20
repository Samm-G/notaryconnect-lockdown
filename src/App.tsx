import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import LoginView from './components/LoginView';
import type { SessionData } from './types/auth';
import { Loader2, FileCheck, Shield, HardDrive, CheckCircle2 } from 'lucide-react';

export default function App() {
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [secondsRemaining, setSecondsRemaining] = useState(0);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Introspect session state from edge
    const verifySession = useCallback(async () => {
        try {
            const response = await fetch('/api/auth/session');
            const data: SessionData = await response.json();
            if (data.authenticated && data.secondsRemaining && data.secondsRemaining > 0) {
                setIsAuthenticated(true);
                setSecondsRemaining(data.secondsRemaining);
            } else {
                setIsAuthenticated(false);
                setSecondsRemaining(0);
            }
        } catch {
            setIsAuthenticated(false);
        } finally {
            setIsCheckingSession(false);
        }
    }, []);

    useEffect(() => {
        verifySession();
    }, [verifySession]);

    // Session countdown ticker (decrements every second)
    useEffect(() => {
        if (!isAuthenticated || secondsRemaining <= 0) return;

        const interval = setInterval(() => {
            setSecondsRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setIsAuthenticated(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isAuthenticated, secondsRemaining]);

    // Manual stateless logout
    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } finally {
            setIsAuthenticated(false);
            setSecondsRemaining(0);
            setIsLoggingOut(false);
            // Clean URL if on an explicit path
            if (window.location.pathname !== '/login') {
                window.history.replaceState({}, '', '/login');
            }
        }
    };

    // Loading Screen while evaluating initial edge session
    if (isCheckingSession) {
        return (
            <div className="min-h-screen bg-notary-dark flex flex-col items-center justify-center p-6 text-notary-light">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-notary-yellow animate-spin" />
                    <span className="font-mono text-xs text-notary-muted uppercase tracking-wider">
                        Introspecting Edge Session...
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-notary-dark text-notary-light flex flex-col justify-between p-6">
            {/* Session Navigation Header */}
            {isAuthenticated && (
                <Header
                    secondsRemaining={secondsRemaining}
                    onLogout={handleLogout}
                    isLoggingOut={isLoggingOut}
                />
            )}

            {/* Main Workspace Body */}
            <main className="w-full flex-1 flex flex-col items-center justify-center my-6">
                {!isAuthenticated ? (
                    <LoginView onSuccess={verifySession} />
                ) : (
                    /* Authenticated Dashboard: Placeholder for Phase 3 Pipeline Dropzone */
                    <div className="max-w-3xl w-full bg-notary-card border border-notary-border rounded-xl p-8 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-notary-border pb-4 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white">24-Hour Operator Session Active</h2>
                                    <p className="text-xs text-notary-muted">Client-binding fingerprint verified &bull; Ready for document lockdown</p>
                                </div>
                            </div>
                            <span className="font-mono text-xs text-notary-yellow px-2.5 py-1 rounded bg-notary-yellow/10 border border-notary-yellow/30">
                                Phase 2 Complete
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1.5">
                                <div className="flex items-center gap-2 text-zinc-300 text-xs font-semibold">
                                    <FileCheck className="w-4 h-4 text-notary-yellow" />
                                    <span>Guardrail Policy</span>
                                </div>
                                <p className="text-xs text-notary-muted">Max 5 pages &bull; Max 25 MB &bull; .pdf, .docx, .doc</p>
                            </div>

                            <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1.5">
                                <div className="flex items-center gap-2 text-zinc-300 text-xs font-semibold">
                                    <Shield className="w-4 h-4 text-notary-yellow" />
                                    <span>Tamper-Seal Engine</span>
                                </div>
                                <p className="text-xs text-notary-muted">300 DPI Rasterize &bull; PAdES X.509 Cryptographic Seal</p>
                            </div>

                            <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1.5">
                                <div className="flex items-center gap-2 text-zinc-300 text-xs font-semibold">
                                    <HardDrive className="w-4 h-4 text-notary-yellow" />
                                    <span>Compliance Storage</span>
                                </div>
                                <p className="text-xs text-notary-muted">Atomic Dual-Archival to kroldon-notary-audit</p>
                            </div>
                        </div>

                        <div className="p-8 border-2 border-dashed border-zinc-700/80 rounded-xl bg-zinc-900/40 text-center">
                            <p className="text-sm text-zinc-300 font-medium">
                                Document Ingestion Pipeline (Phase 3) Ready for Scaffolding
                            </p>
                            <p className="text-xs text-notary-muted mt-1">
                                Drag-and-drop normalization, watermark overlay, and 300 DPI canvas flattening engine.
                            </p>
                        </div>
                    </div>
                )}
            </main>

            <footer className="max-w-6xl w-full mx-auto text-center border-t border-notary-border pt-4">
                <p className="text-xs text-notary-muted">
                    Notary Connect Lockdown Utility &bull; Strictly Confidential Legal Operations (IN)
                </p>
            </footer>
        </div>
    );
}