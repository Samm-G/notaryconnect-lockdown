import type { EventContext } from '@cloudflare/workers-types';
import type { Env } from '../worker-configuration';
import { parseCookies, SESSION_COOKIE_NAME } from './utils/cookies';
import { verifySessionToken } from './utils/jwt';
import { generateClientFingerprint } from './utils/fingerprint';

// Paths accessible without an active 24-hour session
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

    // 1. Resolve Client IP and User-Agent for fingerprint verification
    const clientIp =
        request.headers.get('cf-connecting-ip') ||
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown-Device';

    // 2. Validate Session Cookie
    const cookies = parseCookies(request);
    const token = cookies[SESSION_COOKIE_NAME];

    let isAuthenticated = false;

    if (token && env.JWT_SECRET) {
        const expectedFingerprint = await generateClientFingerprint(userAgent, clientIp);
        const sessionPayload = await verifySessionToken(token, env.JWT_SECRET, expectedFingerprint);
        if (sessionPayload) {
            isAuthenticated = true;
        }
    }

    // 3. Handle /login route
    if (pathname === '/login') {
        // If user is already authenticated, redirect them directly to the app root '/'
        if (isAuthenticated) {
            return Response.redirect(new URL('/', url.origin).toString(), 302);
        }
        // Serve the SPA shell so the React login view can render
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

    // 5. Handle Protected API Endpoints (e.g. /api/archive, /api/sign, etc.)
    if (pathname.startsWith('/api/')) {
        if (!isAuthenticated) {
            return new Response(
                JSON.stringify({
                    error: 'Unauthorized',
                    message: 'A valid 24-hour TOTP session is required to access this compliance endpoint.',
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

    // 6. Handle Protected Document Routes (Application Root '/' and subpaths)
    if (!isAuthenticated) {
        // Zero-leak gate: Unauthenticated users are redirected to /login before any app UI is exposed
        return Response.redirect(new URL('/login', url.origin).toString(), 302);
    }

    // 7. Authenticated user accessing protected application shell -> Proceed
    return next();
};