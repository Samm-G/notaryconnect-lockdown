import { useState } from 'react';
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
                            Read-only &bull; {receipt.pageCount} {receipt.pageCount === 1 ? 'page' : 'pages'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={onReset}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-medium cursor-pointer transition-colors"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>New Document</span>
                </button>
            </div>

            {/* Prominent AUDIT ID Badge (Requested to stay visible) */}
            <div className="p-3 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 font-mono text-xs">
                <div className="flex items-center gap-2 truncate">
                    <ShieldCheck className="w-4 h-4 text-notary-yellow shrink-0" />
                    <span className="text-zinc-500 shrink-0">AUDIT ID:</span>
                    <span className="text-zinc-200 font-bold truncate">{receipt.auditId}</span>
                </div>
                <button
                    onClick={() => copyText(receipt.auditId, 'id')}
                    className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white shrink-0 transition-colors"
                    title="Copy Audit ID"
                >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
            </div>

            {/* Download Action Trigger */}
            <div className="space-y-2 pt-1">
                <button
                    onClick={onDownload}
                    className="w-full py-2.5 px-4 rounded-md bg-notary-gold hover:bg-notary-hover text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                    <Download className="w-4 h-4" />
                    <span>Download Locked PDF</span>
                </button>

                <p className="text-center text-[11px] text-zinc-500 flex items-center justify-center gap-1.5 font-mono">
                    <FileText className="w-3.5 h-3.5 text-zinc-600" />
                    <span className="truncate max-w-xs">{receipt.downloadFileName}</span>
                </p>
            </div>

            {/* Collapsible Technical Details Section (Hidden by default for simplicity) */}
            <div className="border-t border-zinc-800/80 pt-3">
                <button
                    type="button"
                    onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                    className="w-full flex items-center justify-between text-xs text-zinc-500 hover:text-zinc-300 font-mono py-1 cursor-pointer transition-colors"
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
                                onClick={() => copyText(receipt.sha256Original, 'orig')}
                                className="p-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 hover:border-zinc-700 cursor-pointer truncate"
                                title="Click to copy original SHA-256"
                            >
                                <span className="text-zinc-600 block text-[9px]">ORIGINAL:</span>
                                <span className="truncate block">{receipt.sha256Original}</span>
                            </div>
                            <div
                                onClick={() => copyText(receipt.sha256Final, 'final')}
                                className="p-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 hover:border-zinc-700 cursor-pointer truncate"
                                title="Click to copy locked SHA-256"
                            >
                                <span className="text-notary-yellow/80 block text-[9px]">FINAL LOCKED:</span>
                                <span className="truncate block">{receipt.sha256Final}</span>
                            </div>
                        </div>

                        {/* Compliance Storage Key */}
                        <div className="space-y-1 border-t border-zinc-800/80 pt-2">
                            <span className="text-zinc-500 text-[10px] block">R2 COMPLIANCE VAULT PATH</span>
                            <p className="text-zinc-400 text-[10px] truncate">
                                r2://kroldon-notary-audit/{receipt.manifestKey}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}