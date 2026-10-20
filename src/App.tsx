import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import LoginView from './components/LoginView';
import Dropzone from './components/Dropzone';
import TelemetryProgress from './components/TelemetryProgress';
import ComplianceReceipt from './components/ComplianceReceipt';
import type { SessionData } from './types/auth';
import type { DocumentValidationResult, ProcessingOptions, AuditReceipt } from './types/document';
import type { PipelineTelemetryState } from './types/telemetry';
import { executeDocumentLockdown } from './utils/rasterEngine';
import { useGlobalDropTrap } from './hooks/useGlobalDropTrap';
import { useToast } from './context/ToastContext';
import { revokeBlobUrl } from './utils/memorySanitizer';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function App() {
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [secondsRemaining, setSecondsRemaining] = useState(0);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const [externalFile, setExternalFile] = useState<File | null>(null);

    const [isProcessing, setIsProcessing] = useState(false);
    const [telemetry, setTelemetry] = useState<PipelineTelemetryState | null>(null);
    const [receipt, setReceipt] = useState<AuditReceipt | null>(null);
    const [pipelineError, setPipelineError] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    const activeBlobUrlRef = useRef<string | null>(null);
    const hasWarnedExpiryRef = useRef<boolean>(false);
    const { showToast } = useToast();

    const { isWindowDragging } = useGlobalDropTrap({
        isEnabled: isAuthenticated && !isProcessing && !receipt,
        onFileDrop: (file: File) => {
            setExternalFile(file);
        },
    });

    const verifySession = useCallback(async () => {
        try {
            const response = await fetch('/api/auth/session');
            const data: SessionData = await response.json();
            if (data.authenticated && data.secondsRemaining && data.secondsRemaining > 0) {
                setIsAuthenticated(true);
                setSecondsRemaining(data.secondsRemaining);
                hasWarnedExpiryRef.current = false;
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

    // Clean memory on window unload
    useEffect(() => {
        return () => {
            if (activeBlobUrlRef.current) {
                revokeBlobUrl(activeBlobUrlRef.current);
            }
        };
    }, []);

    // Session countdown ticker with 5-minute warning & auto-lockout
    useEffect(() => {
        if (!isAuthenticated || secondsRemaining <= 0) return;

        const interval = setInterval(() => {
            setSecondsRemaining((prev) => {
                if (prev <= 300 && prev > 1 && !hasWarnedExpiryRef.current) {
                    hasWarnedExpiryRef.current = true;
                    showToast({
                        type: 'warning',
                        title: 'Session Expiring Soon',
                        message: 'Your session will expire in 5 minutes. Please complete active work.',
                    });
                }

                if (prev <= 1) {
                    clearInterval(interval);

                    // Full memory sanitization on session expiration
                    if (abortControllerRef.current) {
                        abortControllerRef.current.abort();
                    }
                    if (activeBlobUrlRef.current) {
                        revokeBlobUrl(activeBlobUrlRef.current);
                        activeBlobUrlRef.current = null;
                    }

                    setIsProcessing(false);
                    setTelemetry(null);
                    setReceipt(null);
                    setExternalFile(null);

                    showToast({
                        type: 'error',
                        title: 'Session Expired',
                        message: 'Your 24-hour session has concluded. Please re-authenticate to continue.',
                    });

                    setIsAuthenticated(false);
                    return 0;
                }

                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isAuthenticated, secondsRemaining, showToast]);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            // Memory cleanup
            if (activeBlobUrlRef.current) {
                revokeBlobUrl(activeBlobUrlRef.current);
                activeBlobUrlRef.current = null;
            }
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

    const handleDocumentAccepted = async (
        validation: DocumentValidationResult,
        options: ProcessingOptions
    ) => {
        if (!validation.file) return;

        setIsProcessing(true);
        setPipelineError(null);
        setReceipt(null);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setTelemetry({
            stage: 'normalizing',
            currentPage: 0,
            totalPages: validation.pageCount || 1,
            percentage: 5,
            detailMessage: 'Processing document...',
            error: null,
        });

        try {
            const rasterResult = await executeDocumentLockdown(
                validation.file,
                options,
                (stage, cur, total, percent, msg) => {
                    setTelemetry({
                        stage,
                        currentPage: cur,
                        totalPages: total,
                        percentage: Math.min(85, Math.max(5, percent)),
                        detailMessage: msg,
                        error: null,
                    });
                },
                abortController.signal
            );

            setTelemetry({
                stage: 'signing',
                currentPage: rasterResult.pageCount,
                totalPages: rasterResult.pageCount,
                percentage: 88,
                detailMessage: 'Applying legal digital seal...',
                error: null,
            });

            const formData = new FormData();
            formData.append('originalFile', validation.file);
            formData.append(
                'lockedPdf',
                new Blob([rasterResult.lockedPdfBytes as Uint8Array<ArrayBuffer>], {
                    type: 'application/pdf',
                }),
                'locked.pdf'
            );
            formData.append('pageCount', String(rasterResult.pageCount));
            formData.append('watermarkApplied', String(options.applyWatermark));
            formData.append('qualityMode', options.qualityMode);

            setTelemetry({
                stage: 'archiving',
                currentPage: rasterResult.pageCount,
                totalPages: rasterResult.pageCount,
                percentage: 94,
                detailMessage: 'Saving compliance record...',
                error: null,
            });

            const response = await fetch('/api/archive', {
                method: 'POST',
                body: formData,
                signal: abortController.signal,
            });

            if (!response.ok) {
                let errMessage = 'Archival failed.';
                try {
                    const errData = await response.json();
                    errMessage = errData.message || errData.error || errMessage;
                } catch {
                    // not JSON
                }
                throw new Error(errMessage);
            }

            const auditId = response.headers.get('X-Audit-ID') || crypto.randomUUID();
            const sha256Orig = response.headers.get('X-Audit-SHA256-Original') || 'N/A';
            const sha256Final = response.headers.get('X-Audit-SHA256-Final') || 'N/A';
            const manifestKey = response.headers.get('X-Audit-Manifest-Key') || 'N/A';

            const cleanBaseName = validation.file.name
                .replace(/[^a-zA-Z0-9._-]/g, '_')
                .replace(/\.[^/.]+$/, '');
            const downloadFileName = `${cleanBaseName}_LOCKED_NOTARY.pdf`;

            const signedPdfBlob = await response.blob();

            const newReceipt: AuditReceipt = {
                auditId,
                sha256Original: sha256Orig,
                sha256Final: sha256Final,
                manifestKey,
                downloadFileName,
                signedPdfBlob,
                originalFileName: validation.file.name,
                pageCount: rasterResult.pageCount,
                watermarkApplied: options.applyWatermark,
                qualityMode: options.qualityMode,
                timestamp: new Date().toISOString(),
            };

            setReceipt(newReceipt);

            // Auto-Trigger Download
            const blobUrl = URL.createObjectURL(signedPdfBlob);
            activeBlobUrlRef.current = blobUrl;

            const downloadLink = document.createElement('a');
            downloadLink.href = blobUrl;
            downloadLink.download = downloadFileName;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            // Immediate RAM flush
            setTimeout(() => {
                revokeBlobUrl(blobUrl);
                activeBlobUrlRef.current = null;
            }, 500);

            setTelemetry({
                stage: 'completed',
                currentPage: rasterResult.pageCount,
                totalPages: rasterResult.pageCount,
                percentage: 100,
                detailMessage: 'Document completed.',
                error: null,
            });
        } catch (err: unknown) {
            if (abortController.signal.aborted) {
                setPipelineError('Process was cancelled.');
            } else {
                setPipelineError(
                    err instanceof Error ? err.message : 'Transformation and archival failed.'
                );
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
        if (activeBlobUrlRef.current) {
            revokeBlobUrl(activeBlobUrlRef.current);
            activeBlobUrlRef.current = null;
        }
        setReceipt(null);
        setTelemetry(null);
        setPipelineError(null);
        setExternalFile(null);
    };

    const handleManualDownload = () => {
        if (!receipt) return;
        const blobUrl = URL.createObjectURL(receipt.signedPdfBlob);
        activeBlobUrlRef.current = blobUrl;

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = receipt.downloadFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => {
            revokeBlobUrl(blobUrl);
            activeBlobUrlRef.current = null;
        }, 500);
    };

    if (isCheckingSession) {
        return (
            <div className="min-h-screen bg-notary-dark flex flex-col items-center justify-center p-6 text-notary-light">
                <Loader2 className="w-6 h-6 text-notary-yellow animate-spin" />
            </div>
        );
    }

    return (
        <div
            className={`min-h-screen bg-notary-dark text-notary-light flex flex-col justify-between p-4 sm:p-6 transition-colors ${isWindowDragging ? 'ring-2 ring-notary-yellow/60 ring-inset bg-zinc-950' : ''
                }`}
        >
            {/* Header */}
            {isAuthenticated && (
                <Header
                    secondsRemaining={secondsRemaining}
                    onLogout={handleLogout}
                    isLoggingOut={isLoggingOut}
                />
            )}

            {/* Main Workspace */}
            <main className="w-full flex-1 flex flex-col items-center justify-center my-6">
                {!isAuthenticated ? (
                    <LoginView onSuccess={verifySession} />
                ) : (
                    <div className="max-w-xl w-full bg-zinc-950 border border-zinc-800 rounded-lg p-5 sm:p-6 shadow-xl">
                        {/* Header Title */}
                        <div className="mb-5">
                            <h2 className="text-base font-semibold text-white tracking-tight">
                                Document Lockdown
                            </h2>
                            <p className="text-xs text-zinc-500 mt-0.5">
                                Upload affidavit, contract, or deed to generate read-only signed copy.
                            </p>
                        </div>

                        {/* Error Banner */}
                        {pipelineError && (
                            <div className="mb-4 p-3 rounded-md bg-zinc-900 border border-red-500/40 text-xs flex items-center justify-between gap-3 text-red-300">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                                    <span>{pipelineError}</span>
                                </div>
                                <button
                                    onClick={handleReset}
                                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs cursor-pointer"
                                >
                                    Dismiss
                                </button>
                            </div>
                        )}

                        {/* State 1: Dropzone (Idle) */}
                        {!isProcessing && !receipt && (
                            <Dropzone
                                onDocumentAccepted={handleDocumentAccepted}
                                externalDroppedFile={externalFile}
                                onClearExternalFile={() => setExternalFile(null)}
                            />
                        )}

                        {/* State 2: Telemetry Active (Processing) */}
                        {isProcessing && telemetry && (
                            <TelemetryProgress
                                telemetry={telemetry}
                                fileName={abortControllerRef.current ? 'Document' : ''}
                                onCancel={handleCancel}
                            />
                        )}

                        {/* State 3: Ready State with Clean Receipt */}
                        {receipt && (
                            <ComplianceReceipt
                                receipt={receipt}
                                onReset={handleReset}
                                onDownload={handleManualDownload}
                            />
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="max-w-4xl w-full mx-auto text-center border-t border-zinc-900 pt-4 pb-2">
                <p className="text-xs text-zinc-600 font-mono">
                    NotaryConnect Lockdown v0.1.0 &bull; Strictly Confidential Legal Operations
                </p>
            </footer>
        </div>
    );
}