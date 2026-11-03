import { Loader2, Shield } from 'lucide-react';
import type { PipelineTelemetryState } from '../types/telemetry';

interface TelemetryProgressProps {
    telemetry: PipelineTelemetryState;
    fileName: string;
    onCancel: () => void;
}

export default function TelemetryProgress({
    telemetry,
    onCancel,
}: TelemetryProgressProps) {
    return (
        <div className="glass-pill rounded-xl p-6 space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-notary-yellow/10 border border-notary-yellow/30 text-notary-yellow">
                        <Shield className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-white">Converting Document...</h3>
                        <p className="text-xs text-zinc-400 mt-0.5">{telemetry.detailMessage}</p>
                    </div>
                </div>

                {['normalizing', 'rasterizing', 'burning_watermark', 'assembling'].includes(telemetry.stage) && (
                    <button
                        onClick={onCancel}
                        className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 text-xs cursor-pointer transition-colors"
                    >
                        Cancel
                    </button>
                )}
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 text-notary-yellow animate-spin" />
                        <span>Processing</span>
                    </span>
                    <span className="text-notary-yellow font-semibold">{telemetry.percentage}%</span>
                </div>
                <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
                    <div
                        className="h-full bg-gradient-to-r from-notary-yellow to-notary-gold rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(250,204,21,0.5)]"
                        style={{ width: `${Math.min(100, Math.max(5, telemetry.percentage))}%` }}
                    />
                </div>
            </div>
        </div>
    );
}