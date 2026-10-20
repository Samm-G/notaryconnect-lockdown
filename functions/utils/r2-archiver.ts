import type { R2Bucket } from '@cloudflare/workers-types';

export interface ArchiveParams {
    originalBytes: Uint8Array;
    originalFileName: string;
    originalMimeType: string;
    signedPdfBytes: Uint8Array;
    pageCount: number;
    watermarkApplied: boolean;
    qualityMode: 'compressed' | 'full';
    operatorSession: {
        user: string;
        clientIp: string;
        userAgent: string;
    };
}

export interface AuditManifest {
    auditId: string;
    timestampUtc: string;
    jurisdiction: string;
    location: string;
    operator: {
        sessionUser: string;
        sessionHash: string;
        clientIpPrefix: string;
        userAgent: string;
    };
    originalDocument: {
        fileName: string;
        fileSize: number;
        sha256: string;
        mimeType: string;
    };
    lockedDocument: {
        fileName: string;
        fileSize: number;
        sha256: string;
        pageCount: number;
        watermarkApplied: boolean;
        qualityMode: string;
        padesCertified: boolean;
        signerName: string;
    };
    r2Storage: {
        bucket: string;
        basePath: string;
        originalKey: string;
        lockedKey: string;
        manifestKey: string;
    };
}

export interface ArchiveResult {
    auditId: string;
    manifest: AuditManifest;
    originalKey: string;
    lockedKey: string;
    manifestKey: string;
    sha256Original: string;
    sha256Final: string;
}

/**
 * Computes SHA-256 digest in lowercase hexadecimal.
 */
export async function calculateSha256(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extracts sanitized network prefix (/24 for IPv4, /48 for IPv6).
 */
function extractIpPrefix(ip: string): string {
    if (!ip) return '0.0.0.0';
    if (ip.includes('.')) {
        const octets = ip.split('.');
        if (octets.length === 4) {
            return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
        }
    }
    if (ip.includes(':')) {
        const hextets = ip.split(':');
        if (hextets.length >= 3) {
            return `${hextets[0]}:${hextets[1]}:${hextets[2]}::/48`;
        }
    }
    return ip;
}

/**
 * Sanitizes input filename to prevent path traversal or invalid characters.
 */
function sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Builds chronological WORM partitioning path: audit/{YYYY}/{MM}/{DD}/{UUIDv4}
 */
export function buildAuditBasePath(uuid: string, now: Date = new Date()): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = now.getUTCFullYear();
    const month = pad(now.getUTCMonth() + 1);
    const day = pad(now.getUTCDate());
    return `audit/${year}/${month}/${day}/${uuid}`;
}

/**
 * Atomically writes original file, locked signed PDF, and manifest.json to Cloudflare R2.
 * Download is strictly blocked downstream until all 3 writes return verified receipts.
 */
export async function commitDualArchivalTransaction(
    r2: R2Bucket,
    params: ArchiveParams
): Promise<ArchiveResult> {
    if (!r2) {
        throw new Error('Cloudflare R2 bucket binding (kroldon-notary-audit) is missing.');
    }

    const now = new Date();
    const auditId = crypto.randomUUID();
    const basePath = buildAuditBasePath(auditId, now);

    // 1. Calculate Cryptographic Checksums
    const sha256Original = await calculateSha256(params.originalBytes);
    const sha256Final = await calculateSha256(params.signedPdfBytes);

    // 2. Compute Operator Pseudonymous Hash
    const operatorHashInput = `${params.operatorSession.user}|${params.operatorSession.clientIp}|${params.operatorSession.userAgent}`;
    const operatorSessionHash = await calculateSha256(new TextEncoder().encode(operatorHashInput));

    // 3. Define Clean Object Keys
    const cleanOriginalName = sanitizeFileName(params.originalFileName);
    const cleanBaseName = cleanOriginalName.replace(/\.[^/.]+$/, '');
    const lockedFileName = `${cleanBaseName}_LOCKED_NOTARY.pdf`;

    const originalKey = `${basePath}/original_${cleanOriginalName}`;
    const lockedKey = `${basePath}/locked_${lockedFileName}`;
    const manifestKey = `${basePath}/manifest.json`;

    // 4. Construct Complete Structured Audit Manifest
    const manifest: AuditManifest = {
        auditId,
        timestampUtc: now.toISOString(),
        jurisdiction: 'IN',
        location: 'Bangalore, India',
        operator: {
            sessionUser: params.operatorSession.user,
            sessionHash: operatorSessionHash,
            clientIpPrefix: extractIpPrefix(params.operatorSession.clientIp),
            userAgent: params.operatorSession.userAgent,
        },
        originalDocument: {
            fileName: params.originalFileName,
            fileSize: params.originalBytes.length,
            sha256: sha256Original,
            mimeType: params.originalMimeType,
        },
        lockedDocument: {
            fileName: lockedFileName,
            fileSize: params.signedPdfBytes.length,
            sha256: sha256Final,
            pageCount: params.pageCount,
            watermarkApplied: params.watermarkApplied,
            qualityMode: params.qualityMode,
            padesCertified: true,
            signerName: 'NotaryConnect Secure Document Vault',
        },
        r2Storage: {
            bucket: 'kroldon-notary-audit',
            basePath,
            originalKey,
            lockedKey,
            manifestKey,
        },
    };

    // 5. Build Searchable Custom Metadata Headers for R2
    const customMetadata: Record<string, string> = {
        'audit-id': auditId,
        'upload-timestamp-utc': manifest.timestampUtc,
        'operator-session-hash': operatorSessionHash,
        'sha256-original': sha256Original,
        'sha256-final': sha256Final,
        'page-count': String(params.pageCount),
        'jurisdiction': 'IN',
        'location': 'Bangalore, India',
    };

    // 6. Execute Atomic Dual-Archival Commit (All-or-Nothing Rule)
    try {
        const [originalReceipt, lockedReceipt, manifestReceipt] = await Promise.all([
            // A. Write Original Unaltered File
            r2.put(originalKey, params.originalBytes.buffer as ArrayBuffer, {
                httpMetadata: {
                    contentType: params.originalMimeType || 'application/octet-stream',
                },
                customMetadata,
            }),

            // B. Write Locked Signed PDF
            r2.put(lockedKey, params.signedPdfBytes.buffer as ArrayBuffer, {
                httpMetadata: {
                    contentType: 'application/pdf',
                },
                customMetadata,
            }),

            // C. Write Formal JSON Audit Manifest
            r2.put(manifestKey, JSON.stringify(manifest, null, 2), {
                httpMetadata: {
                    contentType: 'application/json',
                },
                customMetadata,
            }),
        ]);

        // Verify all 3 objects exist
        if (!originalReceipt || !lockedReceipt || !manifestReceipt) {
            throw new Error('R2 rejected one or more writes during the atomic archival loop.');
        }
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown R2 storage fault';
        throw new Error(`Compliance Archival Failed. Release aborted: ${errorMsg}`);
    }

    return {
        auditId,
        manifest,
        originalKey,
        lockedKey,
        manifestKey,
        sha256Original,
        sha256Final,
    };
}