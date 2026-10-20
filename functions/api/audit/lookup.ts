import type { EventContext } from '@cloudflare/workers-types';
import type { Env } from '../../../worker-configuration';
import { parseCookies, SESSION_COOKIE_NAME } from '../../utils/cookies';
import { verifySessionToken } from '../../utils/jwt';
import { generateClientFingerprint } from '../../utils/fingerprint';

export const onRequestGet = async (
    context: EventContext<Env, any, Record<string, unknown>>
) => {
    const { request, env } = context;
    const url = new URL(request.url);
    const auditId = url.searchParams.get('id')?.trim();

    // 1. Session Authorization Gate
    const cookies = parseCookies(request);
    const token = cookies[SESSION_COOKIE_NAME];

    if (!token) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized. Valid operator session required.' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const clientIp =
        request.headers.get('cf-connecting-ip') ||
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown-Device';

    const expectedFingerprint = await generateClientFingerprint(userAgent, clientIp);
    const session = await verifySessionToken(token, env.JWT_SECRET, expectedFingerprint);

    if (!session) {
        return new Response(
            JSON.stringify({ error: 'Session invalid or expired.' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // 2. Validate UUID format
    if (!auditId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(auditId)) {
        return new Response(
            JSON.stringify({ error: 'Invalid Audit UUID format. Must be a standard 36-character UUIDv4.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // 3. Resolve R2 Manifest Path (Check KV index first, fallback to R2 listing)
    let manifestKey = await env.RATE_LIMIT_KV.get(`audit:index:${auditId}`);

    if (!manifestKey) {
        // Fallback: search R2 bucket prefixes
        const listResult = await env.R2_BUCKET.list({ prefix: 'audit/' });
        const match = listResult.objects.find(
            (obj) => obj.key.includes(auditId) && obj.key.endsWith('manifest.json')
        );
        if (match) {
            manifestKey = match.key;
        }
    }

    if (!manifestKey) {
        return new Response(
            JSON.stringify({ error: `Audit record not found for ID: ${auditId}` }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // 4. Retrieve Immutable Manifest from Cloudflare R2
    const r2Object = await env.R2_BUCKET.get(manifestKey);
    if (!r2Object) {
        return new Response(
            JSON.stringify({ error: 'Audit manifest file missing from R2 storage.' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const manifestJson = await r2Object.text();

    return new Response(manifestJson, {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
    });
};