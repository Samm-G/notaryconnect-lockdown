import { useState, KeyboardEvent } from 'react';
import {
    CheckCircle2,
    Download,
    Copy,
    Check,
    ShieldCheck,
    ChevronDown,
    RefreshCw,
    FileText,
} from 'lucide-react';
import type { AuditReceipt } from '../types/document';
import { useToast } from '../context/ToastContext';

interface ComplianceReceiptProps {
    receipt: AuditReceipt;
    onReset: () => void;
    onDownload: () => void;
}

export default function ComplianceReceipt({
    receipt,
    onReset,
    onDownload,
}: ComplianceReceiptProps) {
    const [copiedId, setCopiedId] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const { showToast } = useToast();

    const formattedFileSize = (receipt.signedPdfBlob.size / (1024 * 1024)).toFixed(2);

    const copyText = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        if (label === 'id') {
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 2000);
        }
        showToast({
            type: 'info',
            title: 'Copied to Clipboard',
            message: text,
        });
    };

    const handleKeyDownCopy = (e: KeyboardEvent, text: string, label: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            copyText(text, label);
        }
    };

    const handleDownloadClick = () => {
        onDownload();
        showToast({
            type: 'success',
            title: 'Download Started',
            message: `${receipt.downloadFileName} (${formattedFileSize} MB)`,
        });
    };

    return (
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 sm:p-6 space-y-5 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white">
                            Document Ready &amp; Locked
                        </h3>
                        <p className="text-xs text-zinc-500 font-mono mt-0.5">
                            Read-only &bull; {receipt.pageCount} {receipt.pageCount === 1 ? 'page' : 'pages'} &bull; {formattedFileSize} MB
                        </p>
                    </div>
                </div>

                <button
                    onClick={onReset}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-medium cursor-pointer transition-colors"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>New Document</span>
                </button>
            </div>

            {/* Prominent AUDIT ID Badge */}
            <div className="p-3 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 font-mono text-xs">
                <div className="flex items-center gap-2 truncate">
                    <ShieldCheck className="w-4 h-4 text-notary-yellow shrink-0" />
                    <span className="text-zinc-500 shrink-0">AUDIT ID:</span>
                    <span className="text-zinc-200 font-bold truncate select-all">{receipt.auditId}</span>
                </div>
                <button
                    onClick={() => copyText(receipt.auditId, 'id')}
                    onKeyDown={(e) => handleKeyDownCopy(e, receipt.auditId, 'id')}
                    className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white shrink-0 transition-colors focus:ring-1 focus:ring-notary-yellow outline-none"
                    title="Copy Audit ID"
                    aria-label="Copy Audit Reference ID"
                >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
            </div>

            {/* Download Action Trigger */}
            <div className="space-y-2 pt-1">
                <button
                    onClick={handleDownloadClick}
                    className="w-full py-3 px-4 rounded-md bg-notary-gold hover:bg-notary-hover text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm focus:ring-2 focus:ring-notary-yellow outline-none"
                >
                    <Download className="w-4 h-4" />
                    <span>Download Locked PDF</span>
                    <span className="text-xs font-mono opacity-80">({formattedFileSize} MB)</span>
                </button>

                <p className="text-center text-[11px] text-zinc-500 flex items-center justify-center gap-1.5 font-mono truncate px-2">
                    <FileText className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                    <span className="truncate">{receipt.downloadFileName}</span>
                </p>
            </div>

            {/* Collapsible Technical Details Section */}
            <div className="border-t border-zinc-800/80 pt-3">
                <button
                    type="button"
                    onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                    className="w-full flex items-center justify-between text-xs text-zinc-500 hover:text-zinc-300 font-mono py-1 cursor-pointer transition-colors focus:outline-none"
                >
                    <span>Audit &amp; Technical Details</span>
                    <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${isDetailsOpen ? 'rotate-180 text-notary-yellow' : ''
                            }`}
                    />
                </button>

                {isDetailsOpen && (
                    <div className="mt-3 p-3 rounded-md bg-zinc-900/60 border border-zinc-800 space-y-3 font-mono text-[11px] animate-fadeIn">
                        {/* SHA-256 Checksums */}
                        <div className="space-y-1.5">
                            <span className="text-zinc-500 text-[10px] block">CRYPTOGRAPHIC CHECKSUMS (SHA-256)</span>
                            <div
                                tabIndex={0}
                                onClick={() => copyText(receipt.sha256Original, 'orig')}
                                onKeyDown={(e) => handleKeyDownCopy(e, receipt.sha256Original, 'orig')}
                                className="p-2 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 hover:border-zinc-700 cursor-pointer truncate transition-colors focus:ring-1 focus:ring-notary-yellow outline-none"
                                title="Click to copy original SHA-256"
                            >
                                <span className="text-zinc-600 block text-[9px]">ORIGINAL:</span>
                                <span className="truncate block select-all">{receipt.sha256Original}</span>
                            </div>
                            <div
                                tabIndex={0}
                                onClick={() => copyText(receipt.sha256Final, 'final')}
                                onKeyDown={(e) => handleKeyDownCopy(e, receipt.sha256Final, 'final')}
                                className="p-2 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 hover:border-zinc-700 cursor-pointer truncate transition-colors focus:ring-1 focus:ring-notary-yellow outline-none"
                                title="Click to copy locked SHA-256"
                            >
                                <span className="text-notary-yellow/80 block text-[9px]">FINAL LOCKED:</span>
                                <span className="truncate block select-all">{receipt.sha256Final}</span>
                            </div>
                        </div>

                        {/* Compliance Storage Key */}
                        <div className="space-y-1 border-t border-zinc-800/80 pt-2">
                            <span className="text-zinc-500 text-[10px] block">R2 COMPLIANCE VAULT PATH</span>
                            <p className="text-zinc-400 text-[10px] truncate select-all">
                                r2://kroldon-notary-audit/{receipt.manifestKey}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}