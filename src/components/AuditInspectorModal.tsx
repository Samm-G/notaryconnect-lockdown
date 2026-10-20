import { useState } from 'react';
import {
    ShieldCheck,
    Search,
    X,
    FileCheck,
    Clock,
    HardDrive,
    Copy,
    Check,
    Loader2,
    AlertCircle,
    Hash,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface AuditInspectorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AuditInspectorModal({ isOpen, onClose }: AuditInspectorModalProps) {
    const [auditIdInput, setAuditIdInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [manifestData, setManifestData] = useState<any | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const { showToast } = useToast();

    if (!isOpen) return null;

    const handleLookup = async () => {
        const cleanId = auditIdInput.trim();
        if (!cleanId) return;

        setIsLoading(true);
        setErrorMessage(null);
        setManifestData(null);

        try {
            const response = await fetch(`/api/audit/lookup?id=${encodeURIComponent(cleanId)}`);
            const data = await response.json();

            if (!response.ok) {
                setErrorMessage(data.error || 'Failed to locate audit trail.');
            } else {
                setManifestData(data);
            }
        } catch {
            setErrorMessage('Network connection error while querying R2.');
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text: string, keyName: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(keyName);
        setTimeout(() => setCopiedKey(null), 2000);
        showToast({
            type: 'info',
            title: 'Copied to Clipboard',
            message: text,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="max-w-2xl w-full bg-zinc-950 border border-zinc-800 rounded-lg p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-notary-yellow">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">
                                Chain of Custody Inspector
                            </h3>
                            <p className="text-xs text-zinc-500 font-mono mt-0.5">
                                Administrative Compliance &bull; Cloudflare R2 WORM Manifest Verification
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={auditIdInput}
                        onChange={(e) => setAuditIdInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                        placeholder="Enter 36-character Audit UUID (e.g. d3b07384-...)"
                        className="flex-1 px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 font-mono focus:border-notary-yellow outline-none"
                    />
                    <button
                        onClick={handleLookup}
                        disabled={isLoading || !auditIdInput.trim()}
                        className="px-4 py-2 rounded-md bg-notary-gold hover:bg-notary-hover text-black font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        <span>Lookup</span>
                    </button>
                </div>

                {/* Error Alert */}
                {errorMessage && (
                    <div className="p-3 rounded-md bg-zinc-900 border border-red-500/40 text-xs text-red-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* Results View */}
                {manifestData && (
                    <div className="p-4 rounded-md bg-zinc-900/60 border border-zinc-800 space-y-4 font-mono text-xs animate-fadeIn">
                        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                                <FileCheck className="w-4 h-4" />
                                <span>Verified Legal Record</span>
                            </span>
                            <span className="text-zinc-500 text-[11px]">
                                {manifestData.jurisdiction} ({manifestData.location})
                            </span>
                        </div>

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                                <span className="text-zinc-500 flex items-center gap-1 text-[10px]">
                                    <Clock className="w-3 h-3 text-notary-yellow" />
                                    <span>UPLOAD TIMESTAMP (UTC)</span>
                                </span>
                                <p className="text-zinc-200">{manifestData.timestampUtc}</p>
                            </div>

                            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                                <span className="text-zinc-500 flex items-center gap-1 text-[10px]">
                                    <ShieldCheck className="w-3 h-3 text-notary-yellow" />
                                    <span>OPERATOR SESSION</span>
                                </span>
                                <p className="text-zinc-200 truncate">{manifestData.operator?.sessionUser || 'Operator'}</p>
                                <p className="text-zinc-500 text-[10px] truncate">IP: {manifestData.operator?.clientIpPrefix}</p>
                            </div>
                        </div>

                        {/* Checksums */}
                        <div className="space-y-2">
                            <span className="text-zinc-400 font-semibold text-[11px] flex items-center gap-1">
                                <Hash className="w-3 h-3 text-notary-yellow" />
                                <span>Chain of Custody Checksums</span>
                            </span>

                            <div className="space-y-1.5 text-[10px]">
                                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2">
                                    <div className="truncate">
                                        <span className="text-zinc-500 block">ORIGINAL FILE SHA-256</span>
                                        <span className="text-zinc-300 truncate block select-all">{manifestData.originalDocument?.sha256}</span>
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard(manifestData.originalDocument?.sha256, 'orig')}
                                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white shrink-0"
                                    >
                                        {copiedKey === 'orig' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                </div>

                                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2">
                                    <div className="truncate">
                                        <span className="text-notary-yellow block">SIGNED LOCKED PDF SHA-256</span>
                                        <span className="text-zinc-300 truncate block select-all">{manifestData.lockedDocument?.sha256}</span>
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard(manifestData.lockedDocument?.sha256, 'final')}
                                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white shrink-0"
                                    >
                                        {copiedKey === 'final' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* R2 WORM Path */}
                        <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-[10px] space-y-1">
                            <span className="text-zinc-500 flex items-center gap-1">
                                <HardDrive className="w-3 h-3 text-notary-yellow" />
                                <span>R2 WORM REPOSITORY LOCATION</span>
                            </span>
                            <p className="text-zinc-400 truncate select-all">
                                r2://{manifestData.r2Storage?.bucket}/{manifestData.r2Storage?.basePath}/
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}