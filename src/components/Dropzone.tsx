import { useState, useRef, DragEvent, ChangeEvent, useEffect } from 'react';
import {
    UploadCloud,
    FileText,
    XCircle,
    CheckSquare,
    Square,
    ArrowRight,
    RefreshCw,
    Info,
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

    // Ingest files dropped anywhere on screen
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
            {/* Minimalist Flat Drop Area */}
            {!validation?.valid && (
                <div
                    data-dropzone="true"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border border-dashed rounded-lg p-8 sm:p-12 text-center cursor-pointer transition-colors ${isDragging
                            ? 'border-notary-yellow bg-zinc-900'
                            : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950'
                        }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.doc"
                        onChange={handleFileInputChange}
                        className="hidden"
                    />

                    <div className="w-12 h-12 mx-auto mb-3 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-notary-yellow">
                        <UploadCloud className="w-6 h-6" />
                    </div>

                    <p className="text-sm font-medium text-white">
                        Drag &amp; drop document anywhere
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                        or <span className="text-notary-yellow hover:underline">browse file</span> from your computer
                    </p>

                    <p className="text-[11px] text-zinc-500 mt-4 font-mono">
                        Supported: .pdf, .docx &bull; Max {MAX_PAGE_COUNT} pages &bull; Up to {MAX_FILE_SIZE_MB} MB
                    </p>
                </div>
            )}

            {/* Validation Error */}
            {validation && !validation.valid && (
                <div className="p-3.5 rounded-lg bg-zinc-950 border border-red-500/40 text-xs flex items-start justify-between gap-3 animate-fadeIn">
                    <div className="flex items-start gap-2.5">
                        <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-zinc-300">{validation.error}</p>
                    </div>
                    <button
                        onClick={handleReset}
                        className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs shrink-0 cursor-pointer"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Clean Selected File View */}
            {validation && validation.valid && validation.file && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-4 animate-fadeIn">
                    {/* File Header */}
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-md bg-zinc-900 border border-zinc-800 text-notary-yellow">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div className="truncate">
                                <h4 className="text-sm font-medium text-white truncate max-w-sm sm:max-w-md">
                                    {validation.file.name}
                                </h4>
                                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                                    {validation.fileSizeMb} MB
                                    {metrics ? ` • ${metrics.paperSizeName} ${metrics.orientation}` : ''}
                                    {validation.pageCount !== null ? ` • ${validation.pageCount} pages` : ''}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleReset}
                            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
                            title="Select different file"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Simple Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {/* Watermark Checkbox */}
                        <div
                            onClick={() => setApplyWatermark(!applyWatermark)}
                            className="p-3 rounded-md border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 cursor-pointer select-none flex items-center gap-2.5 transition-colors"
                        >
                            <div className="text-notary-yellow">
                                {applyWatermark ? (
                                    <CheckSquare className="w-4 h-4" />
                                ) : (
                                    <Square className="w-4 h-4 text-zinc-600" />
                                )}
                            </div>
                            <div className="text-xs">
                                <p className="text-zinc-200 font-medium">Add Confidential Watermark</p>
                                <p className="text-[11px] text-zinc-500">Overlay diagonal notary notice</p>
                            </div>
                        </div>

                        {/* Quality Mode Toggle */}
                        <div className="p-2.5 rounded-md border border-zinc-800 bg-zinc-900/50 flex items-center justify-between gap-2">
                            <span className="text-xs text-zinc-400 font-medium pl-1">File Size:</span>
                            <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setQualityMode('compressed')}
                                    className={`px-2.5 py-1 rounded transition-colors ${qualityMode === 'compressed'
                                            ? 'bg-zinc-800 text-white font-medium'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                >
                                    Standard
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setQualityMode('full')}
                                    className={`px-2.5 py-1 rounded transition-colors ${qualityMode === 'full'
                                            ? 'bg-zinc-800 text-white font-medium'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                >
                                    Maximum
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Clean Primary Button */}
                    <div className="pt-2">
                        <button
                            onClick={handleProceed}
                            disabled={isValidating}
                            className="w-full py-2.5 px-4 rounded-md bg-notary-gold hover:bg-notary-hover text-black font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <span>Generate read-only file</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Simple Information Notice */}
            <div className="flex items-center gap-2 text-xs text-zinc-500 px-1 font-mono">
                <Info className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                <span>Converts document into an uneditable, non-selectable PDF for legal filing.</span>
            </div>
        </div>
    );
}