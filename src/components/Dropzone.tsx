import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import {
    UploadCloud,
    FileText,
    AlertTriangle,
    XCircle,
    Sliders,
    CheckSquare,
    Square,
    Layers,
    ArrowRight,
    RefreshCw,
} from 'lucide-react';
import type { DocumentValidationResult, ProcessingOptions } from '../types/document';
import { validateDocument } from '../utils/documentValidator';

interface DropzoneProps {
    onDocumentAccepted: (validation: DocumentValidationResult, options: ProcessingOptions) => void;
}

export default function Dropzone({ onDocumentAccepted }: DropzoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [validation, setValidation] = useState<DocumentValidationResult | null>(null);

    // Configuration options with requested defaults
    const [applyWatermark, setApplyWatermark] = useState(true);
    const [qualityMode, setQualityMode] = useState<'compressed' | 'full'>('compressed');

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const processFile = async (file: File) => {
        setIsValidating(true);
        setValidation(null);
        try {
            const result = await validateDocument(file);
            setValidation(result);
        } finally {
            setIsValidating(false);
        }
    };

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

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await processFile(e.dataTransfer.files[0]);
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
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-6">
            {/* Drag-and-Drop Area */}
            {!validation?.valid && (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${isDragging
                            ? 'border-notary-yellow bg-notary-yellow/5 scale-[1.01]'
                            : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/60'
                        }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.doc"
                        onChange={handleFileInputChange}
                        className="hidden"
                    />

                    <div className="w-16 h-16 mx-auto mb-4 bg-zinc-800/80 border border-zinc-700 rounded-2xl flex items-center justify-center text-notary-yellow shadow-inner">
                        <UploadCloud className="w-8 h-8" />
                    </div>

                    <h3 className="text-base font-semibold text-white">
                        Drag & Drop Legal Document Here
                    </h3>
                    <p className="text-xs text-notary-muted mt-1.5 max-w-sm mx-auto">
                        Upload affidavits, deeds, or notary agreements in{' '}
                        <span className="text-zinc-300 font-mono">.pdf</span>,{' '}
                        <span className="text-zinc-300 font-mono">.docx</span>, or{' '}
                        <span className="text-zinc-300 font-mono">.doc</span> format.
                    </p>

                    <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-300 font-mono">
                        <span>Limit: &le; 5 Pages</span>
                        <span>&bull;</span>
                        <span>&le; 25 MB</span>
                    </div>
                </div>
            )}

            {/* Validation Error Banner */}
            {validation && !validation.valid && (
                <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start justify-between gap-3 animate-fadeIn">
                    <div className="flex items-start gap-2.5">
                        <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-red-300">Validation Guardrail Triggered</p>
                            <p className="mt-0.5 leading-relaxed text-red-200/90">{validation.error}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleReset}
                        className="px-2.5 py-1 rounded bg-red-900/50 hover:bg-red-800/60 border border-red-500/30 text-red-200 font-medium shrink-0 cursor-pointer"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Valid Document Ingestion Preview Card */}
            {validation && validation.valid && validation.file && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5 animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-notary-badge border border-notary-yellow/30 text-notary-yellow">
                                <FileText className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white tracking-tight truncate max-w-md">
                                    {validation.file.name}
                                </h4>
                                <div className="flex items-center gap-2 mt-1 text-xs text-notary-muted font-mono">
                                    <span className="uppercase px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                                        {validation.format}
                                    </span>
                                    <span>&bull;</span>
                                    <span>{validation.fileSizeMb} MB</span>
                                    {validation.pageCount !== null && (
                                        <>
                                            <span>&bull;</span>
                                            <span className="text-emerald-400 font-semibold">
                                                {validation.pageCount} / 5 Pages Verified
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleReset}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                            title="Select different file"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Configuration Options Panel */}
                    <div className="space-y-4 pt-1">
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                            <Sliders className="w-4 h-4 text-notary-yellow" />
                            <span>Lockdown Transformation Options</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Option 1: Watermark Checkbox */}
                            <div
                                onClick={() => setApplyWatermark(!applyWatermark)}
                                className={`p-3.5 rounded-lg border cursor-pointer select-none transition-all ${applyWatermark
                                        ? 'bg-notary-badge/30 border-notary-yellow/40 text-white'
                                        : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 text-notary-yellow">
                                        {applyWatermark ? (
                                            <CheckSquare className="w-5 h-5" />
                                        ) : (
                                            <Square className="w-5 h-5 text-zinc-500" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-zinc-200">
                                            Diagonal Watermark
                                        </p>
                                        <p className="text-[11px] text-notary-muted mt-0.5">
                                            Burns <span className="font-mono text-zinc-300">"NotaryConnect - Confidential"</span> at -45&deg; into bitmap pixels.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Option 2: Full Resolution vs Compressed Toggle */}
                            <div className="p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                                        <Layers className="w-4 h-4 text-notary-yellow" />
                                        Image Encoding
                                    </span>
                                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-notary-yellow">
                                        {qualityMode === 'compressed' ? 'JPEG 85%' : 'Lossless PNG'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                                    <button
                                        type="button"
                                        onClick={() => setQualityMode('compressed')}
                                        className={`py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${qualityMode === 'compressed'
                                                ? 'bg-notary-gold text-black font-semibold shadow'
                                                : 'text-zinc-400 hover:text-white'
                                            }`}
                                    >
                                        Compressed
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setQualityMode('full')}
                                        className={`py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${qualityMode === 'full'
                                                ? 'bg-notary-gold text-black font-semibold shadow'
                                                : 'text-zinc-400 hover:text-white'
                                            }`}
                                    >
                                        Full Resolution
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Trigger */}
                    <div className="pt-2">
                        <button
                            onClick={handleProceed}
                            disabled={isValidating}
                            className="w-full py-3 px-4 rounded-lg bg-notary-gold hover:bg-notary-hover text-black font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-notary-gold/20"
                        >
                            <span>Execute 300 DPI Lockdown Pipeline</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Pre-Processing Informational Notice */}
            <div className="p-3.5 rounded-lg bg-zinc-900/40 border border-zinc-800 flex items-start gap-2.5 text-xs text-notary-muted">
                <AlertTriangle className="w-4 h-4 text-notary-yellow shrink-0 mt-0.5" />
                <p>
                    Documents undergo client-side vector eradication. All selectable text, form tags, and glyph tables are permanently converted into flattened 300 DPI bitmaps prior to cryptographic sealing.
                </p>
            </div>
        </div>
    );
}