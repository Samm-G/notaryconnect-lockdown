import { PDFDocument } from 'pdf-lib';
import type { DocumentValidationResult, SupportedFormat } from '../types/document';

// Configurable operational limits with defaults (15 pages, 50 MB)
export const MAX_PAGE_COUNT = Number(import.meta.env.VITE_MAX_PAGE_COUNT) || 15;
export const MAX_FILE_SIZE_MB = Number(import.meta.env.VITE_MAX_FILE_SIZE_MB) || 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function detectFormat(file: File): SupportedFormat {
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();

    if (name.endsWith('.pdf') || type === 'application/pdf') {
        return 'pdf';
    }
    if (
        name.endsWith('.docx') ||
        type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
        return 'docx';
    }
    if (name.endsWith('.doc') || type === 'application/msword') {
        return 'doc';
    }

    return 'unsupported';
}

export async function validateDocument(file: File): Promise<DocumentValidationResult> {
    const fileSizeMb = Number((file.size / (1024 * 1024)).toFixed(2));
    const format = detectFormat(file);

    // 1. Configurable File Size Guardrail
    if (file.size > MAX_FILE_SIZE_BYTES) {
        return {
            valid: false,
            file,
            format,
            pageCount: null,
            fileSizeMb,
            error: `File size exceeds the ${MAX_FILE_SIZE_MB} MB limit (Detected: ${fileSizeMb} MB). Please reduce file size.`,
            warning: null,
        };
    }

    // 2. Format Guardrail
    if (format === 'unsupported') {
        return {
            valid: false,
            file,
            format,
            pageCount: null,
            fileSizeMb,
            error: 'Unsupported file format. Please upload a .pdf, .docx, or .doc file.',
            warning: null,
        };
    }

    // 3. Legacy .doc Interception
    if (format === 'doc') {
        return {
            valid: false,
            file,
            format,
            pageCount: null,
            fileSizeMb,
            error: 'Legacy .doc format detected. Please save as standard .docx or export to .pdf in Microsoft Word and retry.',
            warning: null,
        };
    }

    // 4. Configurable Page Count Guardrail (PDF)
    if (format === 'pdf') {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
            const pageCount = pdfDoc.getPageCount();

            if (pageCount > MAX_PAGE_COUNT) {
                return {
                    valid: false,
                    file,
                    format,
                    pageCount,
                    fileSizeMb,
                    error: `Document exceeds the ${MAX_PAGE_COUNT}-page limit for standard notary lockdown (Detected: ${pageCount} pages). Please split the document.`,
                    warning: null,
                };
            }

            return {
                valid: true,
                file,
                format,
                pageCount,
                fileSizeMb,
                error: null,
                warning: null,
            };
        } catch {
            return {
                valid: false,
                file,
                format,
                pageCount: null,
                fileSizeMb,
                error: 'Unable to parse PDF structure. The file may be password-protected or corrupted.',
                warning: null,
            };
        }
    }

    // 5. For modern .docx, format & size are validated; page count is enforced in Task 3.2 normalizer
    return {
        valid: true,
        file,
        format,
        pageCount: null,
        fileSizeMb,
        error: null,
        warning: null,
    };
}