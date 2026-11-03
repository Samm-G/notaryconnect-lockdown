import { useState, useRef, DragEvent, ChangeEvent, useEffect } from 'react';
import {
    UploadCloud,
    FileText,
    XCircle,
    CheckSquare,
    Square,
    ArrowRight,
    RefreshCw,
} from 'lucide-react';
import type { DocumentValidationResult, ProcessingOptions } from '../types/document';
import {
    validateDocument,
    MAX_PAGE_COUNT,
    MAX_FILE_SIZE_MB,
} from '../utils/documentValidator';
import { inspectDocumentMetrics, DocumentMetrics } from '../utils/documentInspector';

interface DropzoneProps {
    onDocumentAccepted: (validation: DocumentValidationResult, options: ProcessingOptions) => void;
    externalDroppedFile?: File | null;
    onClearExternalFile?: () => void;
}

export default function Dropzone({
    onDocumentAccepted,
    externalDroppedFile,
    onClearExternalFile,
}: DropzoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [validation, setValidation] = useState<DocumentValidationResult | null>(null);
    const [metrics, setMetrics] = useState<DocumentMetrics | null>(null);

    const [applyWatermark, setApplyWatermark] = useState(true);
    const [qualityMode, setQualityMode] = useState<'compressed' | 'full'>('compressed');

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const processFile = async (file: File) => {
        setIsValidating(true);
        setValidation(null);
        setMetrics(null);
        try {
            const result = await validateDocument(file);
            setValidation(result);

            if (result.valid) {
                const detectedMetrics = await inspectDocumentMetrics(file);
                setMetrics(detectedMetrics);
            }
        } finally {
            setIsValidating(false);
        }
    };

    useEffect(() => {
        if (externalDroppedFile) {
            processFile(externalDroppedFile);
            onClearExternalFile?.();
        }
    }, [externalDroppedFile]);

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            await processFile(files[0]);
        }
    };

    const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            await processFile(e.target.files[0]);
        }
    };

    const handleProceed = () => {
        if (validation && validation.valid && validation.file) {
            onDocumentAccepted(validation, {
                applyWatermark,
                qualityMode,
            });
        }
    };

    const handleReset = () => {
        setValidation(null);
        setMetrics(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-4">
            {!validation?.valid && (
                <div
                    data-dropzone="true"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${isDragging
                            ? 'border-notary-yellow bg-notary-yellow/10 shadow-[0_0_30px_rgba(250,204,21,0.15)]'
                            : 'border-white/15 hover:border-notary-yellow/40 bg-white/[0.02] hover:bg-white/[0.04]'
                        }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.doc"
                        onChange={handleFileInputChange}
                        className="hidden"
                    />

                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-notary-yellow/10 border border-notary-yellow/30 flex items-center justify-center text-notary-yellow shadow-[0_0_20px_rgba(250,204,21,0.15)]">
                        <UploadCloud className="w-6 h-6" />
                    </div>

                    <p className="text-sm font-medium text-white">
                        Drop document here or <span className="text-notary-yellow underline">browse</span>
                    </p>
                    <p className="text-xs text-zinc-400 mt-1.5 font-mono">
                        PDF or DOCX &bull; Max {MAX_PAGE_COUNT} pages ({MAX_FILE_SIZE_MB} MB)
                    </p>
                </div>
            )}

            {validation && !validation.valid && (
                <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <p className="text-red-200">{validation.error}</p>
                    </div>
                    <button
                        onClick={handleReset}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 text-xs shrink-0 cursor-pointer"
                    >
                        Retry
                    </button>
                </div>
            )}

            {validation && validation.valid && validation.file && (
                <div className="glass-pill rounded-xl p-5 space-y-4 animate-fadeIn">
                    {/* File Summary */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                        <div className="flex items-center gap-3 truncate">
                            <div className="p-2 rounded-lg bg-notary-yellow/10 border border-notary-yellow/30 text-notary-yellow shrink-0">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div className="truncate">
                                <h4 className="text-sm font-medium text-white truncate max-w-xs sm:max-w-md">
                                    {validation.file.name}
                                </h4>
                                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                                    {validation.fileSizeMb} MB
                                    {metrics ? ` • ${metrics.paperSizeName}` : ''}
                                    {validation.pageCount !== null ? ` • ${validation.pageCount} pages` : ''}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleReset}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                            title="Change file"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Simple Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div
                            onClick={() => setApplyWatermark(!applyWatermark)}
                            className="p-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer select-none flex items-center gap-2.5 transition-all"
                        >
                            <div className="text-notary-yellow">
                                {applyWatermark ? (
                                    <CheckSquare className="w-4 h-4" />
                                ) : (
                                    <Square className="w-4 h-4 text-zinc-500" />
                                )}
                            </div>
                            <span className="text-xs text-zinc-200 font-medium">Add Watermark</span>
                        </div>

                        <div className="p-2 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between gap-2">
                            <span className="text-xs text-zinc-400 font-medium pl-2">Quality:</span>
                            <div className="grid grid-cols-2 gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setQualityMode('compressed')}
                                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${qualityMode === 'compressed'
                                            ? 'bg-notary-yellow/20 text-notary-yellow font-medium'
                                            : 'text-zinc-400 hover:text-zinc-200'
                                        }`}
                                >
                                    Standard
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setQualityMode('full')}
                                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${qualityMode === 'full'
                                            ? 'bg-notary-yellow/20 text-notary-yellow font-medium'
                                            : 'text-zinc-400 hover:text-zinc-200'
                                        }`}
                                >
                                    High
                                </button>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleProceed}
                        disabled={isValidating}
                        className="w-full py-2.5 px-4 rounded-xl bg-notary-gold hover:bg-notary-hover text-black font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer glow-button"
                    >
                        <span>Generate read-only file</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}