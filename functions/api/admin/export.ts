import type { EventContext, R2Object } from '@cloudflare/workers-types';
import type { Env } from '../../../worker-configuration';
import { parseCookies, SESSION_COOKIE_NAME } from '../../utils/cookies';
import { verifySessionToken } from '../../utils/jwt';

export const onRequestGet = async (
    context: EventContext<Env, any, Record<string, unknown>>
) => {
    const { request, env } = context;
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'stats';

    // 1. Authenticate Request (Accepts Admin Bearer Token or Valid Session Cookie)
    const authHeader = request.headers.get('Authorization') || '';
    const isSecretBearer =
        Boolean(env.JWT_SECRET) && authHeader === `Bearer ${env.JWT_SECRET}`;

    const cookies = parseCookies(request);
    const sessionToken = cookies[SESSION_COOKIE_NAME];
    let isSessionValid = false;

    if (sessionToken && env.JWT_SECRET) {
        const payload = await verifySessionToken(sessionToken, env.JWT_SECRET);
        if (payload) isSessionValid = true;
    }

    if (!isSecretBearer && !isSessionValid) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized. Administrative credentials required.' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }

    if (!env.R2_BUCKET) {
        return new Response(
            JSON.stringify({ error: 'R2_BUCKET binding missing.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // -------------------------------------------------------------------------
    // ACTION: GET - Stream specific R2 object
    // -------------------------------------------------------------------------
    if (action === 'get') {
        const key = url.searchParams.get('key');
        if (!key) {
            return new Response(JSON.stringify({ error: 'Missing object key parameter.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const r2Object = await env.R2_BUCKET.get(key);
        if (!r2Object) {
            return new Response(JSON.stringify({ error: `Object not found: ${key}` }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const contentType =
            r2Object.httpMetadata?.contentType ||
            (key.endsWith('.pdf')
                ? 'application/pdf'
                : key.endsWith('.json')
                    ? 'application/json'
                    : 'application/octet-stream');

        return new Response(r2Object.body as unknown as BodyInit, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': String(r2Object.size),
                'X-R2-ETag': r2Object.etag,
            },
        });
    }

    // -------------------------------------------------------------------------
    // Helper: Collect all objects with full pagination
    // -------------------------------------------------------------------------
    const allObjects: R2Object[] = [];
    let truncated = true;
    let cursor: string | undefined = undefined;

    while (truncated) {
        const listResult = await env.R2_BUCKET.list({
            prefix: 'audit/',
            cursor,
            limit: 1000,
        });
        allObjects.push(...listResult.objects);
        truncated = listResult.truncated;
        if (listResult.truncated) {
            cursor = listResult.cursor;
        }
    }

    // -------------------------------------------------------------------------
    // ACTION: LIST - Return array of keys and sizes
    // -------------------------------------------------------------------------
    if (action === 'list') {
        const fileList = allObjects.map((obj) => ({
            key: obj.key,
            size: obj.size,
            uploaded: obj.uploaded.toISOString(),
            etag: obj.etag,
        }));

        return new Response(JSON.stringify({ total: fileList.length, objects: fileList }, null, 2), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // -------------------------------------------------------------------------
    // ACTION: STATS - Aggregate storage metrics & manifest details
    // -------------------------------------------------------------------------
    let totalBytes = 0;
    let originalFilesCount = 0;
    let lockedPdfCount = 0;
    let manifestCount = 0;

    const dateBreakdown: Record<string, number> = {};
    const transactions: string[] = [];

    for (const obj of allObjects) {
        totalBytes += obj.size;

        if (obj.key.includes('/original_')) {
            originalFilesCount++;
        } else if (obj.key.includes('/locked_')) {
            lockedPdfCount++;
        } else if (obj.key.endsWith('manifest.json')) {
            manifestCount++;
        }

        const parts = obj.key.split('/');
        if (parts.length >= 5) {
            const dateKey = `${parts[1]}/${parts[2]}/${parts[3]}`;
            dateBreakdown[dateKey] = (dateBreakdown[dateKey] || 0) + 1;

            const uuid = parts[4];
            if (!transactions.includes(uuid)) {
                transactions.push(uuid);
            }
        }
    }

    const statsPayload = {
        generatedUtc: new Date().toISOString(),
        bucket: 'kroldon-notary-audit',
        jurisdiction: 'IN (Bangalore, India)',
        totals: {
            distinctAuditTransactions: transactions.length,
            totalComplianceObjects: allObjects.length,
            originalDocumentsArchived: originalFilesCount,
            lockedPadesPdfDelivered: lockedPdfCount,
            auditManifestsCommitted: manifestCount,
            totalStorageBytes: totalBytes,
            totalStorageFormatted: `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`,
        },
        activityByDate: dateBreakdown,
    };

    return new Response(JSON.stringify(statsPayload, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
};