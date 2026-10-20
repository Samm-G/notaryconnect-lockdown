/**
 * Standards-compliant HS256 JWT engine using native Web Crypto.
 * Mints and verifies 24-hour duration-bounded session tokens.
 */

export interface SessionPayload {
    sub: string;       // Operator identity (e.g. "firm-operator")
    iat: number;       // Issued at (seconds)
    exp: number;       // Expiration (seconds, exactly T + 86400)
    jti: string;       // Unique JWT ID for tracking/revocation
    fpt: string;       // Client fingerprint: SHA-256(IP_Prefix + User-Agent)
}

function base64UrlEncode(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    return crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: { name: 'SHA-256' } },
        false,
        ['sign', 'verify']
    );
}

/**
 * Signs a new JWT with an exact 24-hour expiration window.
 */
export async function signSessionToken(
    subject: string,
    clientFingerprint: string,
    secret: string
): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const expiration = now + 86400; // 24 hours

    const header = {
        alg: 'HS256',
        typ: 'JWT',
    };

    const payload: SessionPayload = {
        sub: subject,
        iat: now,
        exp: expiration,
        jti: crypto.randomUUID(),
        fpt: clientFingerprint,
    };

    const encoder = new TextEncoder();
    const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
    const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
    const dataToSign = `${headerB64}.${payloadB64}`;

    const key = await getHmacKey(secret);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(dataToSign));
    const signatureB64 = base64UrlEncode(new Uint8Array(signature));

    return `${dataToSign}.${signatureB64}`;
}

/**
 * Verifies the JWT signature, 24-hour lifespan, and client fingerprint.
 */
export async function verifySessionToken(
    token: string,
    secret: string,
    expectedFingerprint?: string
): Promise<SessionPayload | null> {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [headerB64, payloadB64, signatureB64] = parts;
        const dataToVerify = `${headerB64}.${payloadB64}`;

        const encoder = new TextEncoder();
        const key = await getHmacKey(secret);
        const signatureBytes = base64UrlDecode(signatureB64);

        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            signatureBytes.buffer as ArrayBuffer,
            encoder.encode(dataToVerify).buffer as ArrayBuffer
        );

        if (!isValid) return null;

        const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
        const payload: SessionPayload = JSON.parse(payloadJson);

        const now = Math.floor(Date.now() / 1000);

        // Enforce 24-hour boundary
        if (!payload.exp || payload.exp < now) {
            return null;
        }

        // Enforce client-binding fingerprint if supplied
        if (expectedFingerprint && payload.fpt !== expectedFingerprint) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}