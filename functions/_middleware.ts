import type { EventContext } from '@cloudflare/workers-types';
import type { Env } from '../worker-configuration';
import { parseCookies, SESSION_COOKIE_NAME } from './utils/cookies';
import { verifySessionToken } from './utils/jwt';
import { generateClientFingerprint } from './utils/fingerprint';

const PUBLIC_API_PATHS = [
    '/api/auth/verify',
    '/api/auth/session',
    '/api/auth/logout',
    '/api/health',
];

export const onRequest = async (
    context: EventContext<Env, any, Record<string, unknown>>
) => {
    const { request, env, next } = context;
    const url = new URL(request.url);
    const pathname = url.pathname;

    const clientIp =
        request.headers.get('cf-connecting-ip') ||
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown-Device';

    let isAuthenticated = false;

    // 1. Check for Administrative Bearer Secret (For CLI Pipeline Scripts)
    const authHeader = request.headers.get('Authorization') || '';
    if (env.JWT_SECRET && authHeader === `Bearer ${env.JWT_SECRET}`) {
        isAuthenticated = true;
    }

    // 2. Check for Operator Session Cookie
    if (!isAuthenticated) {
        const cookies = parseCookies(request);
        const token = cookies[SESSION_COOKIE_NAME];

        if (token && env.JWT_SECRET) {
            const expectedFingerprint = await generateClientFingerprint(userAgent, clientIp);
            const sessionPayload = await verifySessionToken(token, env.JWT_SECRET, expectedFingerprint);
            if (sessionPayload) {
                isAuthenticated = true;
            }
        }
    }

    // 3. Handle /login route
    if (pathname === '/login') {
        if (isAuthenticated) {
            return Response.redirect(new URL('/', url.origin).toString(), 302);
        }
        if (env.ASSETS) {
            return env.ASSETS.fetch(new URL('/', url.origin));
        }
        return next();
    }

    // 4. Handle Public API Endpoints
    const isPublicApi = PUBLIC_API_PATHS.some(
        (publicPath) => pathname === publicPath || pathname.startsWith(publicPath + '/')
    );
    if (isPublicApi) {
        return next();
    }

    // 5. Handle Protected API Endpoints (/api/*)
    if (pathname.startsWith('/api/')) {
        if (!isAuthenticated) {
            return new Response(
                JSON.stringify({
                    error: 'Unauthorized',
                    message: 'A valid 24-hour TOTP session or administrative bearer key is required.',
                    code: 'SESSION_EXPIRED_OR_MISSING',
                }),
                {
                    status: 401,
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-store, no-cache, must-revalidate',
                    },
                }
            );
        }
        return next();
    }

    // 6. Handle Protected Application Routes
    if (!isAuthenticated) {
        return Response.redirect(new URL('/login', url.origin).toString(), 302);
    }

    return next();
};