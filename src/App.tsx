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
import { Loader2, ShieldAlert } from 'lucide-react';

export default function App() {
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [secondsRemaining, setSecondsRemaining] = useState(0);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Transformation & Archival state machine
    const [isProcessing, setIsProcessing] = useState(false);
    const [telemetry, setTelemetry] = useState<PipelineTelemetryState | null>(null);
    const [receipt, setReceipt] = useState<AuditReceipt | null>(null);
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

    // Atomic Pipeline Execution: Render &rarr; PAdES Sign &rarr; R2 Archival &rarr; Direct Download
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
            detailMessage: 'Initializing 300 DPI lockdown pipeline...',
            error: null,
        });

        try {
            // 1. Client-Side 300 DPI Rasterization & Watermark Burn-in
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

            // 2. Server-Side PAdES Sealing Stage Telemetry
            setTelemetry({
                stage: 'signing',
                currentPage: rasterResult.pageCount,
                totalPages: rasterResult.pageCount,
                percentage: 88,
                detailMessage: 'Cryptographically sealing with firm certificate (PAdES Part 2)...',
                error: null,
            });

            // 3. Construct Multipart Payload for Edge Archival
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

            // 4. Server-Side R2 Archival Telemetry
            setTelemetry({
                stage: 'archiving',
                currentPage: rasterResult.pageCount,
                totalPages: rasterResult.pageCount,
                percentage: 94,
                detailMessage: 'Dual-archiving to kroldon-notary-audit compliance vault...',
                error: null,
            });

            // 5. Atomic Request to /api/archive
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
                    // Response body was not JSON
                }
                throw new Error(errMessage);
            }

            // 6. Capture Compliance Headers
            const auditId = response.headers.get('X-Audit-ID') || crypto.randomUUID();
            const sha256Orig = response.headers.get('X-Audit-SHA256-Original') || 'N/A';
            const sha256Final = response.headers.get('X-Audit-SHA256-Final') || 'N/A';
            const manifestKey = response.headers.get('X-Audit-Manifest-Key') || 'N/A';

            const cleanBaseName = validation.file.name
                .replace(/[^a-zA-Z0-9._-]/g, '_')
                .replace(/\.[^/.]+$/, '');
            const downloadFileName = `${cleanBaseName}_LOCKED_NOTARY.pdf`;

            // 7. Receive Signed PDF Blob
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

            // 8. Auto-Trigger Immediate Browser Download (Atomic Gate Fulfilled)
            const blobUrl = URL.createObjectURL(signedPdfBlob);
            const downloadLink = document.createElement('a');
            downloadLink.href = blobUrl;
            downloadLink.download = downloadFileName;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            // RAM sanitation
            setTimeout(() => URL.revokeObjectURL(blobUrl), 200);

            setTelemetry({
                stage: 'completed',
                currentPage: rasterResult.pageCount,
                totalPages: rasterResult.pageCount,
                percentage: 100,
                detailMessage: 'Document locked, sealed, and archived.',
                error: null,
            });
        } catch (err: unknown) {
            if (abortController.signal.aborted) {
                setPipelineError('Lockdown process was cancelled.');
            } else {
                setPipelineError(
                    err instanceof Error ? err.message : 'Transformation and archival pipeline failed.'
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
        setReceipt(null);
        setTelemetry(null);
        setPipelineError(null);
    };

    const handleManualDownload = () => {
        if (!receipt) return;
        const blobUrl = URL.createObjectURL(receipt.signedPdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = receipt.downloadFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 200);
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
                                    Notary Affidavit &amp; Deed Lockdown
                                </h2>
                                <p className="text-xs text-notary-muted mt-0.5">
                                    Vector eradication, 300 DPI rasterization, PAdES digital seal &amp; R2 WORM archival.
                                </p>
                            </div>
                        </div>

                        {/* Error Banner */}
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
                        {!isProcessing && !receipt && (
                            <Dropzone onDocumentAccepted={handleDocumentAccepted} />
                        )}

                        {/* State 2: Telemetry Active (Processing: Rasterize &rarr; Sign &rarr; Archive) */}
                        {isProcessing && telemetry && (
                            <TelemetryProgress
                                telemetry={telemetry}
                                fileName={abortControllerRef.current ? 'Legal Document' : ''}
                                onCancel={handleCancel}
                            />
                        )}

                        {/* State 3: Ready State with Verified Compliance Receipt */}
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

            <footer className="max-w-6xl w-full mx-auto text-center border-t border-notary-border pt-4">
                <p className="text-xs text-notary-muted">
                    Notary Connect Lockdown Utility &bull; Strictly Confidential Legal Operations (IN)
                </p>
            </footer>
        </div>
    );
}