import type { EventContext } from '@cloudflare/workers-types';
import type { Env } from '../../worker-configuration';
import { parseCookies, SESSION_COOKIE_NAME } from '../utils/cookies';
import { verifySessionToken } from '../utils/jwt';
import { generateClientFingerprint } from '../utils/fingerprint';
import { signPdfPades } from '../utils/pades-signer';
import { commitDualArchivalTransaction } from '../utils/r2-archiver';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_PAGE_COUNT = 15;

export const onRequestPost = async (
    context: EventContext<Env, any, Record<string, unknown>>
) => {
    const { request, env } = context;

    // 1. Session Verification & Client Fingerprint Authentication Gate
    const cookies = parseCookies(request);
    const token = cookies[SESSION_COOKIE_NAME];

    if (!token) {
        return new Response(
            JSON.stringify({
                error: 'Unauthorized',
                message: 'A valid 24-hour operator session is required.',
            }),
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
            JSON.stringify({
                error: 'Unauthorized',
                message: 'Session token expired, invalid, or client fingerprint mismatch.',
            }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // 2. Parse Multipart Payload
    let formData: any;
    try {
        formData = await request.formData();
    } catch {
        return new Response(
            JSON.stringify({ error: 'Invalid form payload. Expected multipart/form-data.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const originalFile = formData.get('originalFile') as File | null;
    const lockedPdfBlob = formData.get('lockedPdf') as File | null;
    const pageCountStr = formData.get('pageCount') as string | null;
    const watermarkAppliedStr = formData.get('watermarkApplied') as string | null;
    const qualityModeStr = formData.get('qualityMode') as string | null;

    // 3. Defensive Ingestion Guardrails
    if (!originalFile || !lockedPdfBlob) {
        return new Response(
            JSON.stringify({
                error: 'Missing required files. Both originalFile and lockedPdf are required.',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    if (originalFile.size > MAX_FILE_SIZE_BYTES) {
        return new Response(
            JSON.stringify({
                error: `Original file exceeds maximum limit of 50 MB (Detected: ${(originalFile.size / (1024 * 1024)).toFixed(2)} MB).`,
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const pageCount = parseInt(pageCountStr || '1', 10);
    if (isNaN(pageCount) || pageCount < 1 || pageCount > MAX_PAGE_COUNT) {
        return new Response(
            JSON.stringify({
                error: `Page count (${pageCount}) exceeds the 15-page bound.`,
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const watermarkApplied = watermarkAppliedStr === 'true';
    const qualityMode = (qualityModeStr === 'full' ? 'full' : 'compressed') as 'compressed' | 'full';

    try {
        // 4. Extract Binary Buffers
        const originalBytes = new Uint8Array(await originalFile.arrayBuffer());
        const rasterPdfBytes = new Uint8Array(await lockedPdfBlob.arrayBuffer());

        // 5. Cryptographically Seal PDF with PAdES Part 2 RSA-SHA256 Digital Signature
        const signedPdfBytes = await signPdfPades(
            rasterPdfBytes,
            env.SIGNING_KEY_PEM,
            env.SIGNING_CERT_PEM,
            {
                signerName: 'NotaryConnect Secure Document Vault',
                reason: 'Affidavit Non-Repudiation & Lockdown Integrity',
                location: 'Bangalore, India',
                contactInfo: 'compliance@law.kroldon.app',
            }
        );

        // 6. Commit Atomic Dual-Archival Transaction to Cloudflare R2
        const archiveResult = await commitDualArchivalTransaction(env.R2_BUCKET, {
            originalBytes,
            originalFileName: originalFile.name,
            originalMimeType: originalFile.type || 'application/octet-stream',
            signedPdfBytes,
            pageCount,
            watermarkApplied,
            qualityMode,
            operatorSession: {
                user: session.sub,
                clientIp,
                userAgent,
            },
        });

        // 7. Atomic Delivery: Stream Signed PDF directly to client with compliance headers
        const cleanBaseName = originalFile.name
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/\.[^/.]+$/, '');
        const outputFilename = `${cleanBaseName}_LOCKED_NOTARY.pdf`;

        return new Response(signedPdfBytes.buffer as ArrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${outputFilename}"`,
                'Content-Length': String(signedPdfBytes.length),
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                // Compliance Receipt Headers
                'X-Audit-ID': archiveResult.auditId,
                'X-Audit-SHA256-Original': archiveResult.sha256Original,
                'X-Audit-SHA256-Final': archiveResult.sha256Final,
                'X-Audit-Manifest-Key': archiveResult.manifestKey,
                'X-Audit-Status': 'COMMITTED_200_OK',
                // Expose headers to browser fetch clients
                'Access-Control-Expose-Headers':
                    'Content-Disposition, Content-Length, X-Audit-ID, X-Audit-SHA256-Original, X-Audit-SHA256-Final, X-Audit-Manifest-Key, X-Audit-Status',
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal pipeline error';
        // Atomic Gate: User is NEVER granted a download if signing or R2 archival encounters an error
        return new Response(
            JSON.stringify({
                error: 'Compliance Archival Failed',
                message: `Document download blocked: ${message}`,
                status: 'ABORTED',
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};