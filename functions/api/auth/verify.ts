import type { EventContext } from '@cloudflare/workers-types';
import type { Env } from '../../../worker-configuration';
import { verifyTOTP } from '../../utils/totp';
import { generateClientFingerprint } from '../../utils/fingerprint';
import { signSessionToken } from '../../utils/jwt';
import { serializeSessionCookie } from '../../utils/cookies';
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '../../utils/rate-limiter';

interface VerifyRequestBody {
    code?: string;
}

export const onRequestPost = async (
    context: EventContext<Env, any, Record<string, unknown>>
) => {
    const { request, env } = context;

    // 1. Resolve Client IP and User-Agent
    const clientIp =
        request.headers.get('cf-connecting-ip') ||
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown-Device';

    // 2. Check Rate Limit
    const rateLimit = await checkRateLimit(env.RATE_LIMIT_KV, clientIp);
    if (!rateLimit.allowed) {
        return new Response(
            JSON.stringify({
                error: 'Too many failed attempts. Temporary 15-minute lock applied.',
                lockoutSecondsRemaining: rateLimit.lockoutSecondsRemaining,
            }),
            {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': String(rateLimit.lockoutSecondsRemaining),
                },
            }
        );
    }

    // 3. Parse JSON Body
    let body: VerifyRequestBody;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Malformed JSON payload.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const token = (body.code || '').trim();

    // Validate format early (Defensive 6-digit bound)
    if (!/^\d{6}$/.test(token)) {
        const updatedStatus = await recordFailedAttempt(env.RATE_LIMIT_KV, clientIp);
        return new Response(
            JSON.stringify({
                error: 'Invalid code format. Please provide a 6-digit numeric TOTP code.',
                remainingAttempts: updatedStatus.remainingAttempts,
            }),
            {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    // 4. Validate TOTP with +/- 1 Skew Window
    const isValid = await verifyTOTP(token, env.TOTP_SHARED_SECRET);

    if (!isValid) {
        const updatedStatus = await recordFailedAttempt(env.RATE_LIMIT_KV, clientIp);

        if (!updatedStatus.allowed) {
            return new Response(
                JSON.stringify({
                    error: 'Maximum failed attempts reached. IP locked for 15 minutes.',
                    lockoutSecondsRemaining: updatedStatus.lockoutSecondsRemaining,
                }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': String(updatedStatus.lockoutSecondsRemaining),
                    },
                }
            );
        }

        return new Response(
            JSON.stringify({
                error: 'Invalid or expired code. Please enter the current code from your authenticator app.',
                remainingAttempts: updatedStatus.remainingAttempts,
            }),
            {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    // 5. Success: Reset Rate Limiting
    await resetRateLimit(env.RATE_LIMIT_KV, clientIp);

    // 6. Generate Client Fingerprint & Sign 24-Hour JWT
    const fingerprint = await generateClientFingerprint(userAgent, clientIp);
    const sessionJwt = await signSessionToken('internal-legal-operator', fingerprint, env.JWT_SECRET);

    // 7. Issue HttpOnly, Secure, SameSite=Strict Cookie (24 hours = 86400 seconds)
    const cookieHeader = serializeSessionCookie(sessionJwt, 86400);

    return new Response(
        JSON.stringify({
            success: true,
            message: 'Authentication successful. 24-hour session established.',
            session: {
                role: 'Internal Legal Operator',
                jurisdiction: env.JURISDICTION || 'IN',
                expiresInSeconds: 86400,
            },
        }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': cookieHeader,
            },
        }
    );
};