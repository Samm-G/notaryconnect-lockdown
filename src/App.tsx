import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import LoginView from './components/LoginView';
import Dropzone from './components/Dropzone';
import TelemetryProgress from './components/TelemetryProgress';
import ComplianceReceipt from './components/ComplianceReceipt';
import AuditInspectorModal from './components/AuditInspectorModal';
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
    const [isInspectorOpen, setIsInspectorOpen] = useState(false);

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

    useEffect(() => {
        return () => {
            if (activeBlobUrlRef.current) {
                revokeBlobUrl(activeBlobUrlRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!isAuthenticated || secondsRemaining <= 0) return;

        const interval = setInterval(() => {
            setSecondsRemaining((prev) => {
                if (prev <= 300 && prev > 1 && !hasWarnedExpiryRef.current) {
                    hasWarnedExpiryRef.current = true;
                    showToast({
                        type: 'warning',
                        title: 'Session Expiring Soon',
                        message: '5 minutes remaining.',
                    });
                }

                if (prev <= 1) {
                    clearInterval(interval);
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
                        message: 'Please sign in again.',
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
            detailMessage: 'Preparing pages...',
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
                detailMessage: 'Applying digital seal...',
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
                detailMessage: 'Finalizing...',
                error: null,
            });

            const response = await fetch('/api/archive', {
                method: 'POST',
                body: formData,
                signal: abortController.signal,
            });

            if (!response.ok) {
                let errMessage = 'Conversion failed.';
                try {
                    const errData = await response.json();
                    errMessage = errData.message || errData.error || errMessage;
                } catch {
                    // ignore
                }
                throw new Error(errMessage);
            }

            const auditId = response.headers.get('X-Audit-ID') || crypto.randomUUID();
            const sha256Orig = response.headers.get('X-Audit-SHA256-Original') || 'N/A';
            const sha256Final = response.headers.get('X-Audit-SHA256-Final') || 'N/A';
            const manifestKey = response.headers.get('X-Audit-Manifest-Key') || 'N/A';

            const suffix = import.meta.env.VITE_FILENAME_SUFFIX || '_NC';
            const cleanBaseName = validation.file.name
                .replace(/[^a-zA-Z0-9._-]/g, '_')
                .replace(/\.[^/.]+$/, '');
            const downloadFileName = `${cleanBaseName}${suffix}.pdf`;

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

            const blobUrl = URL.createObjectURL(signedPdfBlob);
            activeBlobUrlRef.current = blobUrl;

            const downloadLink = document.createElement('a');
            downloadLink.href = blobUrl;
            downloadLink.download = downloadFileName;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            setTimeout(() => {
                revokeBlobUrl(blobUrl);
                activeBlobUrlRef.current = null;
            }, 500);

            setTelemetry({
                stage: 'completed',
                currentPage: rasterResult.pageCount,
                totalPages: rasterResult.pageCount,
                percentage: 100,
                detailMessage: 'Completed.',
                error: null,
            });
        } catch (err: unknown) {
            if (abortController.signal.aborted) {
                setPipelineError('Cancelled.');
            } else {
                setPipelineError(
                    err instanceof Error ? err.message : 'Conversion failed.'
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
            className={`relative min-h-screen bg-[#070709] text-notary-light flex flex-col justify-between p-4 sm:p-6 overflow-hidden transition-all ${isWindowDragging ? 'ring-2 ring-notary-yellow/70 ring-inset' : ''
                }`}
        >
            {/* Subtle Ambient Background Glows */}
            <div className="pointer-events-none fixed top-[-15%] left-1/2 -translate-x-1/2 w-[550px] h-[350px] bg-notary-yellow/[0.07] rounded-full blur-[130px] z-0" />
            <div className="pointer-events-none fixed bottom-[-20%] left-1/3 w-[450px] h-[300px] bg-amber-500/[0.04] rounded-full blur-[120px] z-0" />

            {/* Header */}
            {isAuthenticated && (
                <Header
                    secondsRemaining={secondsRemaining}
                    onLogout={handleLogout}
                    isLoggingOut={isLoggingOut}
                />
            )}

            {/* Main Frosted Glass Workspace */}
            <main className="w-full flex-1 flex flex-col items-center justify-center my-6 z-10">
                {!isAuthenticated ? (
                    <LoginView onSuccess={verifySession} />
                ) : (
                    <div className="max-w-lg w-full glass-panel rounded-2xl p-6 sm:p-7">
                        <div className="mb-5">
                            <h2 className="text-base font-semibold text-white">
                                Convert to Read-Only PDF
                            </h2>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Upload your document to lock and seal it.
                            </p>
                        </div>

                        {pipelineError && (
                            <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs flex items-center justify-between gap-3 text-red-200">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                                    <span>{pipelineError}</span>
                                </div>
                                <button
                                    onClick={handleReset}
                                    className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs cursor-pointer"
                                >
                                    Dismiss
                                </button>
                            </div>
                        )}

                        {!isProcessing && !receipt && (
                            <Dropzone
                                onDocumentAccepted={handleDocumentAccepted}
                                externalDroppedFile={externalFile}
                                onClearExternalFile={() => setExternalFile(null)}
                            />
                        )}

                        {isProcessing && telemetry && (
                            <TelemetryProgress
                                telemetry={telemetry}
                                fileName={abortControllerRef.current ? 'Document' : ''}
                                onCancel={handleCancel}
                            />
                        )}

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

            {/* Minimalist Footer */}
            <footer className="max-w-3xl w-full mx-auto flex items-center justify-between border-t border-white/[0.06] pt-4 pb-1 text-xs text-zinc-500 font-mono z-10">
                <p>E-Stamp Sampark &bull; v0.1.0</p>
                {isAuthenticated && (
                    <button
                        onClick={() => setIsInspectorOpen(true)}
                        className="text-zinc-500 hover:text-zinc-300 hover:underline cursor-pointer transition-colors"
                    >
                        Audit Lookup
                    </button>
                )}
            </footer>

            <AuditInspectorModal
                isOpen={isInspectorOpen}
                onClose={() => setIsInspectorOpen(false)}
            />
        </div>
    );
}