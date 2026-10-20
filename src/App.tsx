import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import LoginView from './components/LoginView';
import Dropzone from './components/Dropzone';
import type { SessionData } from './types/auth';
import type { DocumentValidationResult, ProcessingOptions } from './types/document';
import { Loader2 } from 'lucide-react';

export default function App() {
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [secondsRemaining, setSecondsRemaining] = useState(0);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Active document configuration state
    const [activeDocument, setActiveDocument] = useState<{
        validation: DocumentValidationResult;
        options: ProcessingOptions;
    } | null>(null);

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

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } finally {
            setIsAuthenticated(false);
            setSecondsRemaining(0);
            setIsLoggingOut(false);
            if (window.location.pathname !== '/login') {
                window.history.replaceState({}, '', '/login');
            }
        }
    };

    const handleDocumentAccepted = (
        validation: DocumentValidationResult,
        options: ProcessingOptions
    ) => {
        setActiveDocument({ validation, options });
        // Handled in Task 3.2 & Task 3.3 by the conversion and rasterization engine
    };

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
            {isAuthenticated && (
                <Header
                    secondsRemaining={secondsRemaining}
                    onLogout={handleLogout}
                    isLoggingOut={isLoggingOut}
                />
            )}

            <main className="w-full flex-1 flex flex-col items-center justify-center my-6">
                {!isAuthenticated ? (
                    <LoginView onSuccess={verifySession} />
                ) : (
                    <div className="max-w-2xl w-full bg-notary-card border border-notary-border rounded-xl p-8 shadow-2xl">
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-white tracking-tight">
                                Notary Affidavit & Deed Lockdown
                            </h2>
                            <p className="text-xs text-notary-muted mt-1">
                                Upload your document to apply the anti-tampering 300 DPI rasterization and digital seal.
                            </p>
                        </div>

                        {/* Dropzone & Configuration Controls */}
                        <Dropzone onDocumentAccepted={handleDocumentAccepted} />

                        {/* Status indicator when file is selected */}
                        {activeDocument && (
                            <div className="mt-4 p-3 rounded-lg bg-zinc-900 border border-notary-yellow/40 text-xs text-zinc-300 font-mono flex items-center justify-between">
                                <span>Staged for Task 3.2 Normalization:</span>
                                <span className="text-notary-yellow font-bold">
                                    {activeDocument.validation.file?.name}
                                </span>
                            </div>
                        )}
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