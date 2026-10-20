import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import LoginView from './components/LoginView';
import Dropzone from './components/Dropzone';
import TelemetryProgress from './components/TelemetryProgress';
import type { SessionData } from './types/auth';
import type { DocumentValidationResult, ProcessingOptions } from './types/document';
import type { PipelineTelemetryState } from './types/telemetry';
import { executeDocumentLockdown, RasterResult } from './utils/rasterEngine';
import { Loader2, CheckCircle2, Download, RefreshCw, ShieldAlert, HardDrive } from 'lucide-react';

export default function App() {
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [secondsRemaining, setSecondsRemaining] = useState(0);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Transformation state machine
    const [isProcessing, setIsProcessing] = useState(false);
    const [telemetry, setTelemetry] = useState<PipelineTelemetryState | null>(null);
    const [processedResult, setProcessedResult] = useState<{
        result: RasterResult;
        originalFile: File;
    } | null>(null);
    const [pipelineError, setPipelineError] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

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

    // Pipeline Execution Trigger
    const handleDocumentAccepted = async (
        validation: DocumentValidationResult,
        options: ProcessingOptions
    ) => {
        if (!validation.file) return;

        setIsProcessing(true);
        setPipelineError(null);
        setProcessedResult(null);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setTelemetry({
            stage: 'normalizing',
            currentPage: 0,
            totalPages: validation.pageCount || 1,
            percentage: 5,
            detailMessage: 'Initializing 300 DPI lockdown pipeline...',
            error: null,
        });

        try {
            const result = await executeDocumentLockdown(
                validation.file,
                options,
                (stage, cur, total, percent, msg) => {
                    setTelemetry({
                        stage,
                        currentPage: cur,
                        totalPages: total,
                        percentage: percent,
                        detailMessage: msg,
                        error: null,
                    });
                },
                abortController.signal
            );

            setProcessedResult({
                result,
                originalFile: validation.file,
            });
        } catch (err: unknown) {
            if (abortController.signal.aborted) {
                setPipelineError('Lockdown process was cancelled.');
            } else {
                setPipelineError(err instanceof Error ? err.message : 'Transformation pipeline failed.');
            }
        } finally {
            setIsProcessing(false);
            abortControllerRef.current = null;
        }
    };

    const handleCancel = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setIsProcessing(false);
        setTelemetry(null);
    };

    const handleReset = () => {
        setProcessedResult(null);
        setTelemetry(null);
        setPipelineError(null);
    };

    const handleDownload = () => {
        if (!processedResult) return;
        const { result, originalFile } = processedResult;

        // Explicitly create blob, trigger instant download, and revoke immediately
        const blob = new Blob([result.lockedPdfBytes as Uint8Array<ArrayBuffer>], {
            type: 'application/pdf',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${originalFile.name.replace(/\.[^/.]+$/, '')}_LOCKED_NOTARY.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // RAM Sanitation
        setTimeout(() => URL.revokeObjectURL(url), 100);
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
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white tracking-tight">
                                    Notary Affidavit & Deed Lockdown
                                </h2>
                                <p className="text-xs text-notary-muted mt-0.5">
                                    Vector eradication, 300 DPI image flattening, and watermark sealing.
                                </p>
                            </div>

                            {processedResult && (
                                <button
                                    onClick={handleReset}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-medium cursor-pointer transition-colors"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>New Document</span>
                                </button>
                            )}
                        </div>

                        {/* Pipeline Error Banner */}
                        {pipelineError && (
                            <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center justify-between gap-3 animate-fadeIn">
                                <div className="flex items-center gap-2.5">
                                    <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                                    <span>{pipelineError}</span>
                                </div>
                                <button
                                    onClick={handleReset}
                                    className="px-2.5 py-1 rounded bg-red-900/50 hover:bg-red-800 border border-red-500/30 text-red-200 font-medium cursor-pointer"
                                >
                                    Dismiss
                                </button>
                            </div>
                        )}

                        {/* State 1: Dropzone (Idle) */}
                        {!isProcessing && !processedResult && (
                            <Dropzone onDocumentAccepted={handleDocumentAccepted} />
                        )}

                        {/* State 2: Telemetry Active (Processing) */}
                        {isProcessing && telemetry && (
                            <TelemetryProgress
                                telemetry={telemetry}
                                fileName={abortControllerRef.current ? 'Legal Document' : ''}
                                onCancel={handleCancel}
                            />
                        )}

                        {/* State 3: Ready for Download / Prepared for Phase 4 Signing */}
                        {processedResult && (
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6 animate-fadeIn">
                                <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
                                    <div className="p-2.5 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-400">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white">
                                            Document Lockdown Complete
                                        </h3>
                                        <p className="text-xs text-notary-muted font-mono mt-0.5">
                                            300 DPI Bitmaps Assembled &bull; Unselectable &bull;{' '}
                                            {processedResult.result.pageCount} Pages
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                                    <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-1">
                                        <span className="text-zinc-500">WATERMARK STATUS</span>
                                        <p className="text-zinc-200 font-semibold">
                                            {processedResult.result.watermarkApplied ? 'Burned (-45°)' : 'Disabled'}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-1">
                                        <span className="text-zinc-500">ENCODING QUALITY</span>
                                        <p className="text-zinc-200 font-semibold uppercase">
                                            {processedResult.result.qualityMode === 'compressed'
                                                ? 'JPEG 85%'
                                                : 'Lossless PNG'}
                                        </p>
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-lg bg-notary-badge/20 border border-notary-yellow/30 flex items-start gap-2.5 text-xs text-zinc-300">
                                    <HardDrive className="w-4 h-4 text-notary-yellow shrink-0 mt-0.5" />
                                    <p>
                                        Ready for download. Next, Phase 4 will bind this output to the PAdES cryptographic seal and atomic Cloudflare R2 compliance archival.
                                    </p>
                                </div>

                                <button
                                    onClick={handleDownload}
                                    className="w-full py-3 px-4 rounded-lg bg-notary-gold hover:bg-notary-hover text-black font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-notary-gold/20"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>Download Locked PDF</span>
                                </button>
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