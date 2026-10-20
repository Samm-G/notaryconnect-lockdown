import { Loader2, CheckCircle2, Shield, Stamp, FileCheck } from 'lucide-react';
import type { PipelineTelemetryState } from '../types/telemetry';

interface TelemetryProgressProps {
    telemetry: PipelineTelemetryState;
    fileName: string;
    onCancel: () => void;
}

export default function TelemetryProgress({
    telemetry,
    fileName,
    onCancel,
}: TelemetryProgressProps) {
    const steps = [
        {
            id: 'norm',
            label: 'Layout Normalization',
            active: telemetry.stage === 'normalizing',
            done: ['rasterizing', 'burning_watermark', 'assembling', 'completed'].includes(telemetry.stage),
        },
        {
            id: 'raster',
            label: `300 DPI Rasterization ${telemetry.totalPages > 0 ? `(${telemetry.currentPage}/${telemetry.totalPages})` : ''}`,
            active: telemetry.stage === 'rasterizing',
            done: ['burning_watermark', 'assembling', 'completed'].includes(telemetry.stage),
        },
        {
            id: 'wm',
            label: 'Watermark Burn-In',
            active: telemetry.stage === 'burning_watermark',
            done: ['assembling', 'completed'].includes(telemetry.stage),
        },
        {
            id: 'pack',
            label: 'Vector Eradication & Assembly',
            active: telemetry.stage === 'assembling',
            done: telemetry.stage === 'completed',
        },
    ];

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-notary-badge border border-notary-yellow/30 text-notary-yellow">
                        <Shield className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white tracking-tight truncate max-w-sm">
                            {fileName}
                        </h3>
                        <p className="text-xs text-notary-muted font-mono mt-0.5">
                            Anti-Tampering 300 DPI Pipeline In Progress
                        </p>
                    </div>
                </div>

                <button
                    onClick={onCancel}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-medium cursor-pointer transition-colors"
                >
                    Cancel
                </button>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-zinc-300 truncate max-w-xs">{telemetry.detailMessage}</span>
                    <span className="text-notary-yellow font-bold">{telemetry.percentage}%</span>
                </div>
                <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 p-0.5">
                    <div
                        className="h-full bg-gradient-to-r from-notary-yellow to-notary-gold rounded-full transition-all duration-200"
                        style={{ width: `${Math.min(100, Math.max(5, telemetry.percentage))}%` }}
                    />
                </div>
            </div>

            {/* Granular Pipeline Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {steps.map((step) => (
                    <div
                        key={step.id}
                        className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 transition-all ${step.active
                            ? 'bg-notary-badge/30 border-notary-yellow/50 text-white shadow-sm'
                            : step.done
                                ? 'bg-zinc-900/60 border-zinc-800 text-zinc-300'
                                : 'bg-zinc-950/40 border-zinc-800/60 text-zinc-500'
                            }`}
                    >
                        {step.done ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : step.active ? (
                            <Loader2 className="w-4 h-4 text-notary-yellow animate-spin shrink-0" />
                        ) : (
                            <div className="w-4 h-4 rounded-full border border-zinc-600 shrink-0" />
                        )}
                        <span className="font-medium truncate">{step.label}</span>
                    </div>
                ))}
            </div>

            {/* Active Security Guarantees */}
            <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between text-[11px] text-notary-muted font-mono">
                <div className="flex items-center gap-1.5">
                    <Stamp className="w-3.5 h-3.5 text-notary-yellow" />
                    <span>Resolution: 300 DPI</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Vector Eradication: Enforced</span>
                </div>
            </div>
        </div>
    );
}