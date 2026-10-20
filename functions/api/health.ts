import type { EventContext } from '@cloudflare/workers-types';
import type { Env } from '../../worker-configuration';

export const onRequestGet = async (context: EventContext<Env, any, Record<string, unknown>>) => {
    const startTime = Date.now();
    const errors: string[] = [];

    // 1. Probe Cloudflare R2 Storage Binding (kroldon-notary-audit)
    let r2Status = 'disconnected';
    try {
        if (!context.env.R2_BUCKET) {
            throw new Error('R2_BUCKET binding missing');
        }
        // Perform non-destructive probe against the audit bucket
        await context.env.R2_BUCKET.list({ limit: 1 });
        r2Status = 'connected';
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown R2 failure';
        errors.push(`R2 Probe Error: ${message}`);
        r2Status = 'error';
    }

    // 2. Probe Cloudflare KV Namespace Binding (RATE_LIMIT_KV)
    let kvStatus = 'disconnected';
    try {
        if (!context.env.RATE_LIMIT_KV) {
            throw new Error('RATE_LIMIT_KV binding missing');
        }
        // Read probe from distributed KV
        await context.env.RATE_LIMIT_KV.get('__health_probe__');
        kvStatus = 'connected';
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown KV failure';
        errors.push(`KV Probe Error: ${message}`);
        kvStatus = 'error';
    }

    // 3. Validate Cryptographic Secrets (Check presence & headers without leaking values)
    const isTotpConfigured = Boolean(
        context.env.TOTP_SHARED_SECRET && context.env.TOTP_SHARED_SECRET.length >= 16
    );

    const isJwtConfigured = Boolean(
        context.env.JWT_SECRET && context.env.JWT_SECRET.length >= 32
    );

    const isSigningKeyConfigured = Boolean(
        context.env.SIGNING_KEY_PEM && context.env.SIGNING_KEY_PEM.includes('BEGIN PRIVATE KEY')
    );

    const isSigningCertConfigured = Boolean(
        context.env.SIGNING_CERT_PEM && context.env.SIGNING_CERT_PEM.includes('BEGIN CERTIFICATE')
    );

    const allSecretsConfigured =
        isTotpConfigured &&
        isJwtConfigured &&
        isSigningKeyConfigured &&
        isSigningCertConfigured;

    if (!allSecretsConfigured) {
        if (!isTotpConfigured) errors.push('Secret Missing: TOTP_SHARED_SECRET');
        if (!isJwtConfigured) errors.push('Secret Missing: JWT_SECRET');
        if (!isSigningKeyConfigured) errors.push('Secret Missing: SIGNING_KEY_PEM');
        if (!isSigningCertConfigured) errors.push('Secret Missing: SIGNING_CERT_PEM');
    }

    const isHealthy = r2Status === 'connected' && kvStatus === 'connected' && allSecretsConfigured;
    const latencyMs = Date.now() - startTime;

    const payload = {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        latency_ms: latencyMs,
        environment: {
            name: context.env.APP_NAME || 'NotaryConnect Lockdown Utility',
            domain: context.env.APP_DOMAIN || 'law.kroldon.app',
            jurisdiction: context.env.JURISDICTION || 'IN',
            deployment: context.env.ENVIRONMENT || 'production',
        },
        storage: {
            r2_audit_vault: {
                bucket: 'kroldon-notary-audit',
                status: r2Status,
            },
            kv_rate_limiter: {
                binding: 'RATE_LIMIT_KV',
                status: kvStatus,
            },
        },
        cryptography: {
            totp_seed: isTotpConfigured ? 'configured' : 'missing',
            jwt_session_engine: isJwtConfigured ? 'configured' : 'missing',
            pades_x509_certificate: isSigningCertConfigured ? 'configured' : 'missing',
            pades_private_key: isSigningKeyConfigured ? 'configured' : 'missing',
        },
        ...(errors.length > 0 ? { errors } : {}),
    };

    return new Response(JSON.stringify(payload, null, 2), {
        status: isHealthy ? 200 : 503,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Health-Latency': `${latencyMs}ms`,
        },
    });
};