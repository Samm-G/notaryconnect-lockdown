/**
 * Standards-compliant PAdES Part 2 (ISO 32000-1 / ETSI TS 102 778-2) PDF Signer.
 * Operates natively in Cloudflare Workers / V8 isolates using Web Crypto & pdf-lib.
 */

import {
    PDFDocument,
    PDFName,
    PDFDict,
    PDFArray,
    PDFHexString,
    PDFString,
    PDFNumber,
} from 'pdf-lib';

export interface SigningMetadata {
    signerName: string; // e.g. "NotaryConnect Secure Document Vault"
    reason: string; // e.g. "Affidavit Non-Repudiation & Lockdown Integrity"
    location: string; // e.g. "Bangalore, India"
    contactInfo?: string;
}

// ---------------------------------------------------------------------------
// 1. DER / ASN.1 Binary Serialization Utilities
// ---------------------------------------------------------------------------

function derLength(len: number): Uint8Array {
    if (len < 128) {
        return new Uint8Array([len]);
    }
    const bytes: number[] = [];
    let temp = len;
    while (temp > 0) {
        bytes.unshift(temp & 0xff);
        temp = temp >> 8;
    }
    return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function derEncode(tag: number, ...contents: (Uint8Array | number[])[]): Uint8Array {
    let totalLength = 0;
    for (const c of contents) {
        totalLength += c.length;
    }
    const lenBytes = derLength(totalLength);
    const result = new Uint8Array(1 + lenBytes.length + totalLength);
    result[0] = tag;
    result.set(lenBytes, 1);
    let offset = 1 + lenBytes.length;
    for (const c of contents) {
        result.set(c instanceof Uint8Array ? c : new Uint8Array(c), offset);
        offset += c.length;
    }
    return result;
}

const derSequence = (...contents: (Uint8Array | number[])[]) => derEncode(0x30, ...contents);
const derSet = (...contents: (Uint8Array | number[])[]) => derEncode(0x31, ...contents);
const derOctetString = (bytes: Uint8Array) => derEncode(0x04, bytes);
const derContextTag = (tagNumber: number, ...contents: (Uint8Array | number[])[]) =>
    derEncode(0xa0 | tagNumber, ...contents);

function derOID(oidStr: string): Uint8Array {
    const parts = oidStr.split('.').map(Number);
    const bytes: number[] = [40 * parts[0] + parts[1]];
    for (let i = 2; i < parts.length; i++) {
        let val = parts[i];
        if (val < 128) {
            bytes.push(val);
        } else {
            const b: number[] = [];
            b.push(val & 0x7f);
            val = val >> 7;
            while (val > 0) {
                b.unshift((val & 0x7f) | 0x80);
                val = val >> 7;
            }
            bytes.push(...b);
        }
    }
    return derEncode(0x06, bytes);
}

function derInteger(bytes: Uint8Array | number): Uint8Array {
    if (typeof bytes === 'number') {
        return derEncode(0x02, [bytes]);
    }
    if (bytes[0] & 0x80) {
        return derEncode(0x02, new Uint8Array([0x00, ...bytes]));
    }
    return derEncode(0x02, bytes);
}

function derUTCTime(date: Date): Uint8Array {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const str =
        date.getUTCFullYear().toString().slice(2) +
        pad(date.getUTCMonth() + 1) +
        pad(date.getUTCDate()) +
        pad(date.getUTCHours()) +
        pad(date.getUTCMinutes()) +
        pad(date.getUTCSeconds()) +
        'Z';
    const encoder = new TextEncoder();
    return derEncode(0x17, encoder.encode(str));
}

// ---------------------------------------------------------------------------
// 2. Cryptographic Parsing & CMS / PKCS#7 Construction
// ---------------------------------------------------------------------------

function pemToBinary(pem: string): Uint8Array {
    const cleaned = pem
        .replace(/-----[A-Z ]+-----/g, '')
        .replace(/\\n/g, '')
        .replace(/[\r\n\s]/g, '');
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function extractIssuerAndSerial(certDer: Uint8Array): { issuer: Uint8Array; serial: Uint8Array } {
    let pos = 0;
    if (certDer[pos++] !== 0x30) throw new Error('Invalid X.509 certificate');
    if (certDer[pos] & 0x80) pos += (certDer[pos] & 0x7f) + 1;
    else pos += 1;

    if (certDer[pos++] !== 0x30) throw new Error('Invalid TBSCertificate');
    if (certDer[pos] & 0x80) pos += (certDer[pos] & 0x7f) + 1;
    else pos += 1;

    if (certDer[pos] === 0xa0) {
        pos += 1;
        pos += certDer[pos] + 1;
    }

    if (certDer[pos] !== 0x02) throw new Error('Certificate serial number missing');
    const serialStart = pos;
    pos += 1;
    let serialLen = certDer[pos];
    if (serialLen & 0x80) {
        const lenOfLen = serialLen & 0x7f;
        pos += 1;
        serialLen = 0;
        for (let i = 0; i < lenOfLen; i++) serialLen = (serialLen << 8) | certDer[pos++];
    } else {
        pos += 1;
    }
    pos += serialLen;
    const serialBytes = certDer.slice(serialStart, pos);

    if (certDer[pos++] !== 0x30) throw new Error('Invalid AlgorithmIdentifier');
    if (certDer[pos] & 0x80) pos += (certDer[pos] & 0x7f) + 1;
    else pos += 1;
    while (pos < certDer.length && certDer[pos] !== 0x30) pos++;

    const issuerStart = pos;
    if (certDer[pos++] !== 0x30) throw new Error('Invalid Issuer');
    let issuerLen = certDer[pos];
    if (issuerLen & 0x80) {
        const lenOfLen = issuerLen & 0x7f;
        pos += 1;
        issuerLen = 0;
        for (let i = 0; i < lenOfLen; i++) issuerLen = (issuerLen << 8) | certDer[pos++];
    } else {
        pos += 1;
    }
    pos += issuerLen;
    const issuerBytes = certDer.slice(issuerStart, pos);

    return { issuer: issuerBytes, serial: serialBytes };
}

async function buildPkcs7Signature(
    documentHash: Uint8Array,
    signingKeyPem: string,
    signingCertPem: string
): Promise<Uint8Array> {
    const privateKeyDer = pemToBinary(signingKeyPem);
    const certDer = pemToBinary(signingCertPem);
    const { issuer, serial } = extractIssuerAndSerial(certDer);

    const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        privateKeyDer.buffer as ArrayBuffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
        false,
        ['sign']
    );

    const signingTime = new Date();

    const attrContentType = derSequence(
        derOID('1.2.840.113549.1.9.3'),
        derSet(derOID('1.2.840.113549.1.7.1'))
    );

    const attrSigningTime = derSequence(
        derOID('1.2.840.113549.1.9.5'),
        derSet(derUTCTime(signingTime))
    );

    const attrMessageDigest = derSequence(
        derOID('1.2.840.113549.1.9.4'),
        derSet(derOctetString(documentHash))
    );

    const signedAttributesRaw = derEncode(
        0x31,
        attrContentType,
        attrMessageDigest,
        attrSigningTime
    );

    const signatureBytes = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        privateKey,
        signedAttributesRaw.buffer as ArrayBuffer
    );

    const signerInfo = derSequence(
        derInteger(1),
        derSequence(issuer, serial),
        derSequence(derOID('2.16.840.1.101.3.4.2.1'), derEncode(0x05)),
        derContextTag(0, attrContentType, attrMessageDigest, attrSigningTime),
        derSequence(derOID('1.2.840.113549.1.1.1'), derEncode(0x05)),
        derOctetString(new Uint8Array(signatureBytes))
    );

    const signedData = derSequence(
        derInteger(1),
        derSet(derSequence(derOID('2.16.840.1.101.3.4.2.1'), derEncode(0x05))),
        derSequence(derOID('1.2.840.113549.1.7.1')),
        derContextTag(0, certDer),
        derSet(signerInfo)
    );

    return derSequence(derOID('1.2.840.113549.1.7.2'), derContextTag(0, signedData));
}

// ---------------------------------------------------------------------------
// 3. Native PDF Structure Generation & ByteRange Injection
// ---------------------------------------------------------------------------

const PLACEHOLDER_HEX_LENGTH = 8192; // 4096-byte DER container

export async function signPdfPades(
    pdfBytes: Uint8Array,
    signingKeyPem: string,
    signingCertPem: string,
    metadata: SigningMetadata
): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const pdfDateStr = `D:${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(
        now.getUTCDate()
    )}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

    // 1. Register Signature Dictionary via pdf-lib (Guarantees 100% valid PDF object model)
    const sigDict = pdfDoc.context.obj({
        Type: 'Sig',
        Filter: 'Adobe.PPKLite',
        Subtype: 'adbe.pkcs7.detached',
        // Four 10-digit integers reserve fixed 53-byte space for ByteRange
        ByteRange: [
            PDFNumber.of(1000000000),
            PDFNumber.of(1000000000),
            PDFNumber.of(1000000000),
            PDFNumber.of(1000000000),
        ],
        Contents: PDFHexString.of('0'.repeat(PLACEHOLDER_HEX_LENGTH)),
        Reason: PDFString.of(metadata.reason),
        Location: PDFString.of(metadata.location),
        Name: PDFString.of(metadata.signerName),
        M: PDFString.of(pdfDateStr),
    });
    const sigRef = pdfDoc.context.register(sigDict);

    // 2. Register Widget Annotation
    const firstPage = pdfDoc.getPage(0);
    const widgetDict = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        FT: 'Sig',
        Rect: [0, 0, 0, 0],
        V: sigRef,
        T: PDFString.of('NotaryConnectSeal'),
        F: 4,
        P: firstPage.ref,
    });
    const widgetRef = pdfDoc.context.register(widgetDict);

    // 3. Attach to first page annotations
    let annots = firstPage.node.lookup(PDFName.of('Annots'));
    if (!annots || !(annots instanceof PDFArray)) {
        annots = pdfDoc.context.obj([]);
        firstPage.node.set(PDFName.of('Annots'), annots);
    }
    (annots as PDFArray).push(widgetRef);

    // 4. Attach to Document Catalog AcroForm
    let acroForm = pdfDoc.catalog.lookup(PDFName.of('AcroForm'));
    if (!acroForm || !(acroForm instanceof PDFDict)) {
        const newAcroForm = pdfDoc.context.obj({
            Fields: [widgetRef],
            SigFlags: 3,
        });
        pdfDoc.catalog.set(PDFName.of('AcroForm'), newAcroForm);
    } else {
        let fields = acroForm.lookup(PDFName.of('Fields'));
        if (!fields || !(fields instanceof PDFArray)) {
            fields = pdfDoc.context.obj([widgetRef]);
            acroForm.set(PDFName.of('Fields'), fields);
        } else {
            fields.push(widgetRef);
        }
        acroForm.set(PDFName.of('SigFlags'), PDFNumber.of(3));
    }

    // 5. Serialize PDF cleanly without object stream compression so byte ranges are plain text
    const preparedPdf = await pdfDoc.save({ useObjectStreams: false });

    // 6. Locate ByteRange and Contents markers in binary buffer
    const latin1Str = new TextDecoder('latin1').decode(preparedPdf);

    const byteRangeIdx = latin1Str.indexOf('/ByteRange');
    if (byteRangeIdx === -1) throw new Error('Missing /ByteRange in serialized PDF');
    const bracketOpen = latin1Str.indexOf('[', byteRangeIdx);
    const bracketClose = latin1Str.indexOf(']', bracketOpen);

    const contentsMarker = '/Contents <';
    const contentsIdx = latin1Str.indexOf(contentsMarker);
    if (contentsIdx === -1) throw new Error('Missing /Contents in serialized PDF');
    const hexStart = contentsIdx + contentsMarker.length;
    const hexEnd = latin1Str.indexOf('>', hexStart);

    const byte1Start = 0;
    const byte1Len = hexStart - 1; // Includes '<'
    const byte2Start = hexEnd + 1; // After '>'
    const byte2Len = preparedPdf.length - byte2Start;

    // Format exact ByteRange values, padded to fit the exact placeholder slot
    const rangeNums = `${byte1Start} ${byte1Len} ${byte2Start} ${byte2Len}`;
    const totalSlotWidth = bracketClose - bracketOpen - 1;
    const paddedRange = ` ${rangeNums} `.padEnd(totalSlotWidth, ' ');

    const enc = new TextEncoder();
    preparedPdf.set(enc.encode(paddedRange), bracketOpen + 1);

    // 7. Compute SHA-256 Digest over ByteRange Span 1 and Span 2
    const span1 = preparedPdf.subarray(byte1Start, byte1Start + byte1Len);
    const span2 = preparedPdf.subarray(byte2Start, byte2Start + byte2Len);

    const digestBuffer = new Uint8Array(span1.length + span2.length);
    digestBuffer.set(span1, 0);
    digestBuffer.set(span2, span1.length);

    const hashBuffer = await crypto.subtle.digest('SHA-256', digestBuffer);
    const documentHash = new Uint8Array(hashBuffer);

    // 8. Sign Document Hash with RSA-SHA256 PKCS#7
    const pkcs7Der = await buildPkcs7Signature(documentHash, signingKeyPem, signingCertPem);

    let pkcs7Hex = '';
    for (let i = 0; i < pkcs7Der.length; i++) {
        pkcs7Hex += pkcs7Der[i].toString(16).padStart(2, '0').toUpperCase();
    }

    if (pkcs7Hex.length > PLACEHOLDER_HEX_LENGTH) {
        throw new Error('PKCS#7 signature exceeded placeholder allocation');
    }

    pkcs7Hex = pkcs7Hex.padEnd(PLACEHOLDER_HEX_LENGTH, '0');

    // Overwrite the placeholder zeros with the real cryptographic signature
    preparedPdf.set(enc.encode(pkcs7Hex), hexStart);

    return preparedPdf;
}