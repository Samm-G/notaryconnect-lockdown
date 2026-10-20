import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import LoginView from './components/LoginView';
import Dropzone from './components/Dropzone';
import type { SessionData } from './types/auth';
import type { DocumentValidationResult, ProcessingOptions } from './types/document';
import { executeDocumentLockdown } from './utils/rasterEngine';
import {
    Loader2,
    CheckCircle2,
    AlertCircle,
    FileText,
    Download,
    RefreshCw,
    ShieldCheck,
} from 'lucide-react';

interface TelemetryState {
    stage: string;
    currentPage: number;
    totalPages: number;
    percentage: number;
}

export default function App() {
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [secondsRemaining, setSecondsRemaining] = useState(0);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Active processing state
    const [isProcessing, setIsProcessing] = useState(false);
    const [telemetry, setTelemetry] = useState<TelemetryState | null>(null);
    const [processingError, setProcessingError] = useState<string | null>(null);

    // Completed document download state
    const [completedDoc, setCompletedDoc] = useState<{
        fileName: string;
        pdfBytes: Uint8Array;
        pageCount: number;
    } | null>(null);

    // Introspect session state from Cloudflare Edge
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
            setCompletedDoc(null);
            if (window.location.pathname !== '/login') {
                window.history.replaceState({}, '', '/login');
            }
        }
    };

    // Pipeline execution trigger
    const handleDocumentAccepted = async (
        validation: DocumentValidationResult,
        options: ProcessingOptions
    ) => {
        if (!validation.file) return;

        setIsProcessing(true);
        setProcessingError(null);
        setCompletedDoc(null);
        setTelemetry({
            stage: 'initializing',
            currentPage: 0,
            totalPages: 0,
            percentage: 5,
        });

        try {
            const result = await executeDocumentLockdown(
                validation.file,
                options,
                (stage, current, total, percent) => {
                    setTelemetry({
                        stage,
                        currentPage: current,
                        totalPages: total,
                        percentage: percent,
                    });
                }
            );

            const baseName = validation.file.name.replace(/\.[^/.]+$/, '');
            const outputFileName = `${baseName}_LOCKED_NOTARY.pdf`;

            setCompletedDoc({
                fileName: outputFileName,
                pdfBytes: result.lockedPdfBytes,
                pageCount: result.pageCount,
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'An error occurred during document transformation.';
            setProcessingError(msg);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = () => {
        if (!completedDoc) return;

        // Convert Uint8Array to Blob for standard browser download
        const blob = new Blob([completedDoc.pdfBytes as Uint8Array<ArrayBuffer>], {
            type: 'application/pdf',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = completedDoc.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // RAM Sanitation
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    };

    const handleResetWorkspace = () => {
        setCompletedDoc(null);
        setProcessingError(null);
        setTelemetry(null);
    };

    // Human-readable telemetry stage labels
    const getStageLabel = (stage: string): string => {
        switch (stage) {
            case 'initializing':
                return 'Parsing Document Structure & Layout...';
            case 'rendering_page':
                return 'Rendering Pages to 300 DPI Canvas Bitmaps...';
            case 'burning_watermark':
                return 'Burning "NotaryConnect - Confidential" Watermark...';
            case 'encoding_bitmap':
                return 'Compressing Bitmaps & Eliminating Text Layers...';
            case 'assembling_pdf':
                return 'Assembling Unselectable PDF Container...';
            case 'completed':
                return 'Lockdown Transformation Complete!';
            default:
                return 'Processing Document...';
        }
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
                    <div className="max-w-2xl w-full bg-notary-card border border-notary-border rounded-xl p-8 shadow-2xl">
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                                    Notary Affidavit & Deed Lockdown
                                </h2>
                                <p className="text-xs text-notary-muted mt-1">
                                    Client-side vector eradication, 300 DPI canvas rasterization, and tamper-evident sealing.
                                </p>
                            </div>
                        </div>

                        {/* Stage 1: Active Ingestion & Dropzone */}
                        {!isProcessing && !completedDoc && (
                            <Dropzone onDocumentAccepted={handleDocumentAccepted} />
                        )}

                        {/* Stage 2: Processing & Telemetry Loader */}
                        {isProcessing && telemetry && (
                            <div className="py-12 px-6 text-center space-y-6 bg-zinc-900/60 border border-zinc-800 rounded-xl animate-fadeIn">
                                <div className="w-16 h-16 mx-auto bg-notary-badge border border-notary-yellow/30 rounded-2xl flex items-center justify-center text-notary-yellow shadow-inner">
                                    <Loader2 className="w-8 h-8 animate-spin" />
                                </div>

                                <div className="space-y-2">
                                    <h3 className="text-base font-semibold text-white">
                                        {getStageLabel(telemetry.stage)}
                                    </h3>
                                    {telemetry.totalPages > 0 && (
                                        <p className="text-xs font-mono text-notary-yellow">
                                            Processing Page {telemetry.currentPage} of {telemetry.totalPages}
                                        </p>
                                    )}
                                </div>

                                {/* Progress Bar */}
                                <div className="max-w-md mx-auto space-y-1.5">
                                    <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden border border-zinc-700">
                                        <div
                                            className="bg-notary-gold h-full transition-all duration-200 ease-out"
                                            style={{ width: `${telemetry.percentage}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[11px] font-mono text-notary-muted">
                                        <span>300 DPI Raster Engine</span>
                                        <span>{telemetry.percentage}%</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Stage 3: Error Feedback */}
                        {processingError && !isProcessing && (
                            <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start justify-between gap-3 animate-fadeIn my-4">
                                <div className="flex items-start gap-2.5">
                                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-red-300">Transformation Failed</p>
                                        <p className="mt-0.5 leading-relaxed text-red-200/90">{processingError}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleResetWorkspace}
                                    className="px-2.5 py-1 rounded bg-red-900/50 hover:bg-red-800/60 border border-red-500/30 text-red-200 font-medium shrink-0 cursor-pointer"
                                >
                                    Reset
                                </button>
                            </div>
                        )}

                        {/* Stage 4: Processing Completion & Verification Card */}
                        {completedDoc && !isProcessing && (
                            <div className="bg-zinc-900 border border-emerald-500/40 rounded-xl p-6 space-y-6 animate-fadeIn">
                                <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
                                    <div className="p-2.5 rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-400">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                                            Document Lockdown Complete
                                        </h3>
                                        <p className="text-xs text-notary-muted mt-0.5">
                                            Vector elements eradicated &bull; 300 DPI rasterized &bull; Zero selectable text
                                        </p>
                                    </div>
                                </div>

                                <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3 font-mono text-xs text-zinc-300">
                                    <div className="flex justify-between items-center text-white font-semibold border-b border-zinc-800 pb-2">
                                        <span className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-notary-yellow" />
                                            {completedDoc.fileName}
                                        </span>
                                        <span className="text-emerald-400 font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30">
                                            Flattened
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 pt-1">
                                        <div>
                                            <span>Pages Processed:</span>{' '}
                                            <strong className="text-zinc-200">{completedDoc.pageCount}</strong>
                                        </div>
                                        <div>
                                            <span>Visual Resolution:</span>{' '}
                                            <strong className="text-zinc-200">300 DPI</strong>
                                        </div>
                                        <div>
                                            <span>Text Selection:</span>{' '}
                                            <strong className="text-emerald-400">DISABLED</strong>
                                        </div>
                                        <div>
                                            <span>Integrity Seal:</span>{' '}
                                            <strong className="text-notary-yellow">READY</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        onClick={handleDownload}
                                        className="flex-1 py-3 px-4 rounded-lg bg-notary-gold hover:bg-notary-hover text-black font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-notary-gold/20"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span>Download Locked PDF</span>
                                    </button>

                                    <button
                                        onClick={handleResetWorkspace}
                                        className="py-3 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        <span>Process Another</span>
                                    </button>
                                </div>

                                <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 flex items-center gap-2 text-[11px] text-notary-muted">
                                    <ShieldCheck className="w-4 h-4 text-notary-yellow shrink-0" />
                                    <span>
                                        Proceeding to Phase 4: Server-Side PAdES Cryptographic Signing & R2 Compliance Dual-Archival.
                                    </span>
                                </div>
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