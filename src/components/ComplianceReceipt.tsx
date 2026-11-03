import { useState, KeyboardEvent } from 'react';
import {
    CheckCircle2,
    Download,
    Copy,
    Check,
    ShieldCheck,
    ChevronDown,
    RefreshCw,
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
            title: 'Copied',
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
            message: receipt.downloadFileName,
        });
    };

    return (
        <div className="glass-pill rounded-xl p-5 space-y-4 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white">File Ready</h3>
                        <p className="text-xs text-zinc-400 font-mono">
                            {receipt.pageCount} {receipt.pageCount === 1 ? 'page' : 'pages'} &bull; {formattedFileSize} MB
                        </p>
                    </div>
                </div>

                <button
                    onClick={onReset}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 text-xs font-medium cursor-pointer transition-colors"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>New File</span>
                </button>
            </div>

            {/* Prominent AUDIT ID Badge */}
            <div className="p-3 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between gap-3 font-mono text-xs">
                <div className="flex items-center gap-2 truncate">
                    <ShieldCheck className="w-4 h-4 text-notary-yellow shrink-0" />
                    <span className="text-zinc-400 shrink-0">AUDIT ID:</span>
                    <span className="text-white font-semibold truncate select-all">{receipt.auditId}</span>
                </div>
                <button
                    onClick={() => copyText(receipt.auditId, 'id')}
                    onKeyDown={(e) => handleKeyDownCopy(e, receipt.auditId, 'id')}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white shrink-0 transition-colors"
                    title="Copy Audit ID"
                >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
            </div>

            {/* Download CTA */}
            <button
                onClick={handleDownloadClick}
                className="w-full py-2.5 px-4 rounded-xl bg-notary-gold hover:bg-notary-hover text-black font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer glow-button"
            >
                <Download className="w-4 h-4" />
                <span>Download Locked PDF</span>
            </button>

            {/* Collapsible Info Element */}
            <div className="border-t border-white/10 pt-2">
                <button
                    type="button"
                    onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                    className="w-full flex items-center justify-between text-xs text-zinc-400 hover:text-zinc-200 font-mono py-1 cursor-pointer transition-colors"
                >
                    <span>Technical Info</span>
                    <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${isDetailsOpen ? 'rotate-180 text-notary-yellow' : ''
                            }`}
                    />
                </button>

                {isDetailsOpen && (
                    <div className="mt-2 p-3 rounded-xl bg-black/40 border border-white/10 space-y-2.5 font-mono text-[11px] animate-fadeIn">
                        <div
                            onClick={() => copyText(receipt.sha256Original, 'orig')}
                            className="p-2 rounded-lg bg-white/[0.02] border border-white/5 text-zinc-400 cursor-pointer truncate"
                        >
                            <span className="text-zinc-500 block text-[9px]">ORIGINAL SHA-256</span>
                            <span className="truncate block select-all">{receipt.sha256Original}</span>
                        </div>
                        <div
                            onClick={() => copyText(receipt.sha256Final, 'final')}
                            className="p-2 rounded-lg bg-white/[0.02] border border-white/5 text-zinc-400 cursor-pointer truncate"
                        >
                            <span className="text-notary-yellow/80 block text-[9px]">LOCKED SHA-256</span>
                            <span className="truncate block select-all">{receipt.sha256Final}</span>
                        </div>
                        <div className="pt-1 text-[10px] text-zinc-500 truncate">
                            Vault: r2://kroldon-notary-audit/{receipt.manifestKey}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}