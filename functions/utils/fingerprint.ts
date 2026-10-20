/**
 * Generates an encrypted client-binding fingerprint using SHA-256 over:
 * - Sanitized User-Agent
 * - Network prefix (/24 for IPv4, /48 for IPv6)
 *
 * This mitigates session hijacking if a cookie is stolen and used from a different network or device.
 */

export function extractNetworkPrefix(ip: string): string {
    if (!ip) return '0.0.0.0';

    // IPv4: retain first 3 octets (e.g. 192.168.1.0/24)
    if (ip.includes('.')) {
        const octets = ip.split('.');
        if (octets.length === 4) {
            return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
        }
    }

    // IPv6: retain first 3 hextets (e.g. 2001:db8:85a3::/48)
    if (ip.includes(':')) {
        const hextets = ip.split(':');
        if (hextets.length >= 3) {
            return `${hextets[0]}:${hextets[1]}:${hextets[2]}::/48`;
        }
    }

    return ip;
}

export async function generateClientFingerprint(userAgent: string, ip: string): Promise<string> {
    const prefix = extractNetworkPrefix(ip);
    const normalizedUa = (userAgent || '').trim().toLowerCase();
    const rawString = `${prefix}|${normalizedUa}`;

    const encoder = new TextEncoder();
    const data = encoder.encode(rawString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}