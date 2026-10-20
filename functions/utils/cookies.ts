/**
 * Safe, zero-dependency cookie parser and serializer for Cloudflare Edge.
 */

export const SESSION_COOKIE_NAME = 'notary_session';

export function parseCookies(request: { headers: { get(name: string): string | null } }): Record<string, string> {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return {};

    const cookies: Record<string, string> = {};
    const items = cookieHeader.split(';');

    for (const item of items) {
        const [name, ...rest] = item.trim().split('=');
        if (name) {
            cookies[name] = decodeURIComponent(rest.join('='));
        }
    }

    return cookies;
}

export function serializeSessionCookie(token: string, maxAgeSeconds: number = 86400): string {
    if (maxAgeSeconds <= 0) {
        return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict`;
    }
    return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Strict`;
}