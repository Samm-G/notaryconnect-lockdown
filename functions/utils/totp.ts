/**
 * RFC 6238 TOTP Engine using native Web Crypto HMAC-SHA1.
 * Supports +/- 1 time-step window skew tolerance (90-second total window).
 */

// Base32 decoding adhering to RFC 4648
export function base32Decode(base32: string): Uint8Array {
    const cleaned = base32.toUpperCase().replace(/[\s=-]/g, '');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (let i = 0; i < cleaned.length; i++) {
        const idx = alphabet.indexOf(cleaned[i]);
        if (idx === -1) {
            throw new Error(`Invalid Base32 character: ${cleaned[i]}`);
        }
        value = (value << 5) | idx;
        bits += 5;

        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }

    return new Uint8Array(output);
}

/**
 * Computes a 6-digit TOTP code for a specific time-step counter.
 */
async function generateHOTP(secretBytes: Uint8Array, counter: number): Promise<string> {
    // Convert 64-bit integer counter to 8-byte big-endian buffer
    const counterBuffer = new Uint8Array(8);
    let temp = counter;
    for (let i = 7; i >= 0; i--) {
        counterBuffer[i] = temp & 0xff;
        temp = Math.floor(temp / 256);
    }

    // Import HMAC-SHA1 key via Web Crypto (explicit ArrayBuffer cast for TypeScript strictness)
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        secretBytes.buffer as ArrayBuffer,
        { name: 'HMAC', hash: { name: 'SHA-1' } },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer.buffer as ArrayBuffer);
    const hmac = new Uint8Array(signature);

    // Dynamic truncation (RFC 4226 Section 5.4)
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
}

/**
 * Validates a user-supplied 6-digit token against the shared secret.
 * Evaluates T-1, T, and T+1 to tolerate clock skew.
 */
export async function verifyTOTP(
    token: string,
    base32Secret: string,
    timeStepSeconds = 30
): Promise<boolean> {
    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
        return false;
    }

    const secretBytes = base32Decode(base32Secret);
    const currentCounter = Math.floor(Date.now() / 1000 / timeStepSeconds);

    // Check [current - 1, current, current + 1]
    const windowSteps = [currentCounter - 1, currentCounter, currentCounter + 1];

    for (const step of windowSteps) {
        const validOtp = await generateHOTP(secretBytes, step);
        if (timingSafeEqual(token, validOtp)) {
            return true;
        }
    }

    return false;
}

/**
 * Generates the current valid TOTP token (used for testing and validation).
 */
export async function generateCurrentTOTP(
    base32Secret: string,
    timeStepSeconds = 30
): Promise<string> {
    const secretBytes = base32Decode(base32Secret);
    const currentCounter = Math.floor(Date.now() / 1000 / timeStepSeconds);
    return generateHOTP(secretBytes, currentCounter);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
        mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
}