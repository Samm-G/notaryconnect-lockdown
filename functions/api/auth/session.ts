import type { EventContext } from '@cloudflare/workers-types';
import type { Env } from '../../../worker-configuration';
import { parseCookies, SESSION_COOKIE_NAME } from '../../utils/cookies';
import { generateClientFingerprint } from '../../utils/fingerprint';
import { verifySessionToken } from '../../utils/jwt';

export const onRequestGet = async (
    context: EventContext<Env, any, Record<string, unknown>>
) => {
    const { request, env } = context;

    const cookies = parseCookies(request);
    const token = cookies[SESSION_COOKIE_NAME];

    if (!token) {
        return new Response(
            JSON.stringify({ authenticated: false, reason: 'No session cookie present' }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    // Compute expected fingerprint from the active request
    const clientIp =
        request.headers.get('cf-connecting-ip') ||
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown-Device';
    const expectedFingerprint = await generateClientFingerprint(userAgent, clientIp);

    const payload = await verifySessionToken(token, env.JWT_SECRET, expectedFingerprint);

    if (!payload) {
        return new Response(
            JSON.stringify({ authenticated: false, reason: 'Session expired, tampered, or device mismatch' }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const secondsRemaining = Math.max(0, payload.exp - nowSeconds);

    return new Response(
        JSON.stringify({
            authenticated: true,
            user: payload.sub,
            jurisdiction: env.JURISDICTION || 'IN',
            expiresAt: payload.exp * 1000,
            secondsRemaining,
        }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
        }
    );
};