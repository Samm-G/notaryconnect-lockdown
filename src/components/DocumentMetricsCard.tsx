import { Ruler, Maximize2, Compass, HardDrive } from 'lucide-react';
import type { DocumentMetrics } from '../utils/documentInspector';

interface DocumentMetricsCardProps {
    metrics: DocumentMetrics;
    qualityMode: 'compressed' | 'full';
}

export default function DocumentMetricsCard({
    metrics,
    qualityMode,
}: DocumentMetricsCardProps) {
    const estimatedSize =
        qualityMode === 'compressed'
            ? metrics.estimatedCompressedMb
            : metrics.estimatedFullResolutionMb;

    return (
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-lg p-3.5 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800/80 pb-2 text-[11px]">
                <span className="flex items-center gap-1.5 font-semibold text-zinc-300">
                    <Ruler className="w-3.5 h-3.5 text-notary-yellow" />
                    <span>LAYOUT &amp; RASTER INSPECTION</span>
                </span>
                <span className="text-notary-yellow font-bold uppercase">
                    {metrics.paperSizeName} {metrics.orientation}
                </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                {/* Metric 1: Paper Format */}
                <div className="p-2 rounded bg-zinc-900/90 border border-zinc-800 space-y-0.5">
                    <span className="text-zinc-500 block text-[10px]">PAGE FORMAT</span>
                    <p className="text-zinc-200 font-bold truncate">{metrics.dimensionsMm}</p>
                </div>

                {/* Metric 2: 300 DPI Canvas Resolution */}
                <div className="p-2 rounded bg-zinc-900/90 border border-zinc-800 space-y-0.5">
                    <span className="text-zinc-500 block text-[10px] flex items-center gap-1">
                        <Maximize2 className="w-2.5 h-2.5 text-notary-yellow" />
                        <span>300 DPI CANVAS</span>
                    </span>
                    <p className="text-zinc-200 font-bold truncate">{metrics.canvasResolutionPx}</p>
                </div>

                {/* Metric 3: Orientation */}
                <div className="p-2 rounded bg-zinc-900/90 border border-zinc-800 space-y-0.5">
                    <span className="text-zinc-500 block text-[10px] flex items-center gap-1">
                        <Compass className="w-2.5 h-2.5 text-notary-yellow" />
                        <span>ORIENTATION</span>
                    </span>
                    <p className="text-zinc-200 font-bold truncate">{metrics.orientation}</p>
                </div>

                {/* Metric 4: Estimated File Budget */}
                <div className="p-2 rounded bg-zinc-900/90 border border-zinc-800 space-y-0.5">
                    <span className="text-zinc-500 block text-[10px] flex items-center gap-1">
                        <HardDrive className="w-2.5 h-2.5 text-emerald-400" />
                        <span>EST. FILE SIZE</span>
                    </span>
                    <p className="text-emerald-400 font-bold truncate">{estimatedSize}</p>
                </div>
            </div>
        </div>
    );
}