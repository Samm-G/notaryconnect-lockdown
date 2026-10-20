import { useState } from 'react';
import {
    CheckCircle2,
    Download,
    Copy,
    Check,
    ShieldCheck,
    HardDrive,
    FileText,
    RefreshCw,
    Hash,
} from 'lucide-react';
import type { AuditReceipt } from '../types/document';

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
    const [copiedOrigHash, setCopiedOrigHash] = useState(false);
    const [copiedFinalHash, setCopiedFinalHash] = useState(false);

    const copyToClipboard = (text: string, type: 'id' | 'orig' | 'final') => {
        navigator.clipboard.writeText(text);
        if (type === 'id') {
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 2000);
        } else if (type === 'orig') {
            setCopiedOrigHash(true);
            setTimeout(() => setCopiedOrigHash(false), 2000);
        } else {
            setCopiedFinalHash(true);
            setTimeout(() => setCopiedFinalHash(false), 2000);
        }
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6 animate-fadeIn">
            {/* Header Badge */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-400">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white tracking-tight">
                            Document Sealed &amp; Archived
                        </h3>
                        <p className="text-xs text-notary-muted font-mono mt-0.5">
                            Dual-Archival Confirmed &bull; {receipt.pageCount} Pages &bull; PAdES Part 2 Signed
                        </p>
                    </div>
                </div>

                <button
                    onClick={onReset}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-medium cursor-pointer transition-colors"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>New Document</span>
                </button>
            </div>

            {/* Audit Reference ID Badge */}
            <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3 font-mono text-xs">
                <div className="flex items-center gap-2 truncate">
                    <ShieldCheck className="w-4 h-4 text-notary-yellow shrink-0" />
                    <span className="text-zinc-500 shrink-0">AUDIT ID:</span>
                    <span className="text-zinc-200 font-bold truncate">{receipt.auditId}</span>
                </div>
                <button
                    onClick={() => copyToClipboard(receipt.auditId, 'id')}
                    className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white shrink-0 transition-colors"
                    title="Copy Audit UUID"
                >
                    {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
            </div>

            {/* Cryptographic Checksums (Chain of Custody) */}
            <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <Hash className="w-4 h-4 text-notary-yellow" />
                    <span>Cryptographic Checksums (SHA-256)</span>
                </div>

                <div className="space-y-2 font-mono text-[11px]">
                    {/* Original Document Checksum */}
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between gap-2">
                        <div className="truncate">
                            <span className="text-zinc-500 block text-[10px]">ORIGINAL SOURCE DOCUMENT</span>
                            <span className="text-zinc-300 truncate block">{receipt.sha256Original}</span>
                        </div>
                        <button
                            onClick={() => copyToClipboard(receipt.sha256Original, 'orig')}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white shrink-0"
                            title="Copy Original SHA-256"
                        >
                            {copiedOrigHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                    </div>

                    {/* Locked Document Checksum */}
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between gap-2">
                        <div className="truncate">
                            <span className="text-notary-yellow block text-[10px]">FINAL LOCKED &amp; SIGNED PDF</span>
                            <span className="text-zinc-300 truncate block">{receipt.sha256Final}</span>
                        </div>
                        <button
                            onClick={() => copyToClipboard(receipt.sha256Final, 'final')}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white shrink-0"
                            title="Copy Signed SHA-256"
                        >
                            {copiedFinalHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Compliance Vault WORM Path */}
            <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80 flex items-start gap-2.5 text-xs">
                <HardDrive className="w-4 h-4 text-notary-yellow shrink-0 mt-0.5" />
                <div className="space-y-1 font-mono text-[11px] truncate">
                    <span className="text-zinc-400 block font-semibold">R2 Compliance Trail Committed:</span>
                    <span className="text-zinc-500 truncate block">r2://kroldon-notary-audit/{receipt.manifestKey}</span>
                </div>
            </div>

            {/* Download Action Trigger */}
            <div className="pt-2 space-y-2">
                <button
                    onClick={onDownload}
                    className="w-full py-3 px-4 rounded-lg bg-notary-gold hover:bg-notary-hover text-black font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-notary-gold/20"
                >
                    <Download className="w-4 h-4" />
                    <span>Download Locked PDF</span>
                </button>

                <p className="text-center text-[11px] text-notary-muted flex items-center justify-center gap-1.5 font-mono">
                    <FileText className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{receipt.downloadFileName}</span>
                </p>
            </div>
        </div>
    );
}