import { PDFDocument } from 'pdf-lib';
import type { DocumentValidationResult, SupportedFormat } from '../types/document';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_PAGE_COUNT = 5;

/**
 * Sniffs format from extension and MIME type.
 */
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

/**
 * Validates file size, format, and page count before processing.
 */
export async function validateDocument(file: File): Promise<DocumentValidationResult> {
    const fileSizeMb = Number((file.size / (1024 * 1024)).toFixed(2));
    const format = detectFormat(file);

    // 1. Guardrail: 25 MB Size Bound
    if (file.size > MAX_FILE_SIZE_BYTES) {
        return {
            valid: false,
            file,
            format,
            pageCount: null,
            fileSizeMb,
            error: `File size exceeds the 25 MB limit (Detected: ${fileSizeMb} MB). Please compress or reduce image resolution.`,
            warning: null,
        };
    }

    // 2. Guardrail: Format Validation
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

    // 3. Guardrail: Legacy .doc Interception (FRD Exception Handling)
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

    // 4. Guardrail: PDF Page Count Pre-Flight Check (<= 5 pages)
    if (format === 'pdf') {
        try {
            const arrayBuffer = await file.arrayBuffer();
            // Fast parsing without font decompression
            const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
            const pageCount = pdfDoc.getPageCount();

            if (pageCount > MAX_PAGE_COUNT) {
                return {
                    valid: false,
                    file,
                    format,
                    pageCount,
                    fileSizeMb,
                    error: `Document exceeds the 5-page limit for standard notary lockdown (Detected: ${pageCount} pages). Please split the document.`,
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

    // 5. For modern .docx, page count is finalized during rendering
    return {
        valid: true,
        file,
        format,
        pageCount: null, // Computed during layout normalization
        fileSizeMb,
        error: null,
        warning: null,
    };
}