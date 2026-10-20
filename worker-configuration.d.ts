import type { R2Bucket, KVNamespace, Fetcher } from '@cloudflare/workers-types';

export interface Env {
    // Cloudflare Storage Bindings
    R2_BUCKET: R2Bucket;
    RATE_LIMIT_KV: KVNamespace;

    // Cloudflare Pages Static Asset Fetcher
    ASSETS?: Fetcher;

    // Environment Variables
    ENVIRONMENT: string;
    APP_NAME: string;
    APP_DOMAIN: string;
    JURISDICTION: string;

    // Environment Secrets (Injected via Cloudflare Pages Secrets)
    JWT_SECRET: string;
    TOTP_SHARED_SECRET: string;
    SIGNING_KEY_PEM: string;
    SIGNING_CERT_PEM: string;
}

// Global typing for Pages Function EventContext
declare global {
    type PagesFunctionEnv = Env;
}