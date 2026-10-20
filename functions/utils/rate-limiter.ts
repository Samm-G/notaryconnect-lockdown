import type { KVNamespace } from '@cloudflare/workers-types';

export interface RateLimitStatus {
    allowed: boolean;
    remainingAttempts: number;
    lockoutSecondsRemaining: number;
}

interface KVRateLimitRecord {
    attempts: number;
    lockedUntil: number | null; // UTC timestamp in seconds
}

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_SECONDS = 900; // 15 minutes

function getRateLimitKey(ip: string): string {
    return `ratelimit:totp:${ip}`;
}

/**
 * Checks if the IP is currently locked out.
 */
export async function checkRateLimit(
    kv: KVNamespace,
    ip: string
): Promise<RateLimitStatus> {
    if (!kv) {
        return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS, lockoutSecondsRemaining: 0 };
    }

    const key = getRateLimitKey(ip);
    const data = await kv.get<KVRateLimitRecord>(key, 'json');

    if (!data) {
        return {
            allowed: true,
            remainingAttempts: MAX_FAILED_ATTEMPTS,
            lockoutSecondsRemaining: 0,
        };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);

    // Check active lockout
    if (data.lockedUntil && data.lockedUntil > nowSeconds) {
        return {
            allowed: false,
            remainingAttempts: 0,
            lockoutSecondsRemaining: data.lockedUntil - nowSeconds,
        };
    }

    const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - data.attempts);
    return {
        allowed: remaining > 0,
        remainingAttempts: remaining,
        lockoutSecondsRemaining: 0,
    };
}

/**
 * Records a failed attempt. Locks the IP for 15 minutes if attempts reach 10.
 */
export async function recordFailedAttempt(
    kv: KVNamespace,
    ip: string
): Promise<RateLimitStatus> {
    if (!kv) {
        return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS, lockoutSecondsRemaining: 0 };
    }

    const key = getRateLimitKey(ip);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const existing = await kv.get<KVRateLimitRecord>(key, 'json');

    let attempts = (existing?.attempts || 0) + 1;
    let lockedUntil: number | null = existing?.lockedUntil || null;

    if (attempts >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = nowSeconds + LOCKOUT_SECONDS;
    }

    const record: KVRateLimitRecord = { attempts, lockedUntil };

    // Write record with KV TTL of 15 minutes (900 seconds)
    await kv.put(key, JSON.stringify(record), { expirationTtl: LOCKOUT_SECONDS });

    const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - attempts);
    const lockoutSecondsRemaining = (lockedUntil && lockedUntil > nowSeconds) ? (lockedUntil - nowSeconds) : 0;

    return {
        allowed: lockoutSecondsRemaining === 0 && remaining > 0,
        remainingAttempts: remaining,
        lockoutSecondsRemaining,
    };
}

/**
 * Resets the failed attempt counter upon successful login.
 */
export async function resetRateLimit(kv: KVNamespace, ip: string): Promise<void> {
    if (!kv) return;
    const key = getRateLimitKey(ip);
    await kv.delete(key);
}