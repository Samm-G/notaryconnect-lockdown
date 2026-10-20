import React from 'react';
import { ShieldCheck, Lock, FileText } from 'lucide-react';

export default function App() {
    return (
        <div className="min-h-screen flex flex-col justify-between p-6">
            <header className="max-w-6xl w-full mx-auto flex items-center justify-between border-b border-notary-border pb-4">
                <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-notary-badge border border-notary-yellow/30 text-notary-yellow">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                            NotaryConnect <span className="text-notary-yellow text-xs font-mono uppercase px-2 py-0.5 rounded bg-notary-yellow/10 border border-notary-yellow/30">Lockdown v1.0</span>
                        </h1>
                        <p className="text-xs text-notary-muted">law.kroldon.app • Internal Legal Ingestion Pipeline</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                        <span className="w-2 h-2 rounded-full bg-notary-yellow animate-pulse"></span>
                        Edge Ready
                    </span>
                </div>
            </header>

            <main className="max-w-xl w-full mx-auto my-12 bg-notary-card border border-notary-border rounded-xl p-8 shadow-2xl">
                <div className="text-center mb-6">
                    <div className="w-12 h-12 mx-auto mb-4 bg-zinc-900 border border-notary-border rounded-full flex items-center justify-center text-notary-yellow">
                        <Lock className="w-6 h-6" />
                    </div>
                    <h2 className="text-lg font-semibold text-white">System Initialization Active</h2>
                    <p className="text-sm text-notary-muted mt-1">
                        Task 1.1 Complete. Ready for Cloudflare Bindings and Cryptographic Seed Configuration.
                    </p>
                </div>

                <div className="space-y-3 font-mono text-xs bg-zinc-900/80 p-4 rounded-lg border border-zinc-800 text-zinc-400">
                    <div className="flex justify-between items-center text-zinc-300 border-b border-zinc-800 pb-2">
                        <span>ENVIRONMENT STATUS</span>
                        <span className="text-notary-yellow font-bold">READY</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Jurisdiction:</span>
                        <span className="text-zinc-200">IN (India)</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Theme Tokens:</span>
                        <span className="text-zinc-200">Zinc Charcoal / Notary Amber</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Storage Spec:</span>
                        <span className="text-zinc-200">R2 (kroldon-notary-audit)</span>
                    </div>
                </div>
            </main>

            <footer className="max-w-6xl w-full mx-auto text-center border-t border-notary-border pt-4">
                <p className="text-xs text-notary-muted">
                    Notary Connect Lockdown Utility &bull; Strictly Confidential Legal Operations
                </p>
            </footer>
        </div>
    );
}