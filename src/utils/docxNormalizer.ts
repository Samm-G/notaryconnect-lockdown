import * as docx from 'docx-preview';
import { toCanvas } from 'html-to-image';
import { MAX_PAGE_COUNT } from './documentValidator';

export interface NormalizedPageCanvas {
    pageNumber: number;
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
}

export type NormalizationProgressCallback = (
    stage: 'parsing' | 'rendering_pages' | 'complete',
    currentPage: number,
    totalPages: number
) => void;

/**
 * Normalizes a .docx file into standardized 300 DPI HTML5 Canvases.
 * Preserves fonts, footnotes, nested tables, signature placeholders, and legal margins.
 * Enforces the configurable MAX_PAGE_COUNT guardrail.
 */
export async function normalizeDocxToCanvases(
    docxFile: File | Blob,
    onProgress?: NormalizationProgressCallback
): Promise<NormalizedPageCanvas[]> {
    // 1. Create an isolated off-screen host container attached to DOM
    const host = document.createElement('div');
    host.id = `docx-normalizer-host-${Date.now()}`;
    host.style.position = 'fixed';
    host.style.top = '-100000px';
    host.style.left = '-100000px';
    host.style.width = '210mm'; // Standard A4 legal base width
    host.style.backgroundColor = '#ffffff';
    host.style.opacity = '0';
    host.style.pointerEvents = 'none';
    host.style.zIndex = '-9999';

    document.body.appendChild(host);

    try {
        if (onProgress) onProgress('parsing', 0, 0);

        // 2. Render OpenXML structure using docx-preview
        await docx.renderAsync(docxFile, host, undefined, {
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            breakPages: true,
            useBase64URL: true,
            renderChanges: false,
            renderHeaders: true,
            renderFooters: true,
            renderFootnotes: true,
        });

        // Small yield to let browser complete style calculation
        await new Promise((resolve) => setTimeout(resolve, 50));

        // 3. Query rendered pages / sections
        // docx-preview generates sections or wrappers for each page
        let pageNodes = Array.from(host.querySelectorAll<HTMLElement>('section.docx, .docx-page'));

        // Fallback: If docx-preview wrapped in a single section, inspect child section wrappers
        if (pageNodes.length === 0) {
            const wrapper = host.querySelector<HTMLElement>('.docx-wrapper');
            if (wrapper && wrapper.children.length > 0) {
                pageNodes = Array.from(wrapper.children) as HTMLElement[];
            } else {
                pageNodes = [host];
            }
        }

        const totalPages = pageNodes.length;

        // 4. Enforce configurable MAX_PAGE_COUNT guardrail
        if (totalPages > MAX_PAGE_COUNT) {
            throw new Error(
                `Word document exceeds the ${MAX_PAGE_COUNT}-page limit for standard notary lockdown (Detected: ${totalPages} pages). Please split the document.`
            );
        }

        const pageCanvases: NormalizedPageCanvas[] = [];

        // Standard 300 DPI scale: 300 DPI / 96 CSS DPI = 3.125
        const DPI_300_SCALE = 300 / 96;

        // 5. Convert each rendered HTML page section into a 300 DPI HTML5 Canvas
        for (let i = 0; i < totalPages; i++) {
            const pageEl = pageNodes[i];
            if (onProgress) onProgress('rendering_pages', i + 1, totalPages);

            // Explicit white background to prevent transparent page bleeding
            pageEl.style.backgroundColor = '#ffffff';

            const canvas = await toCanvas(pageEl, {
                pixelRatio: DPI_300_SCALE,
                backgroundColor: '#ffffff',
                cacheBust: true,
            });

            pageCanvases.push({
                pageNumber: i + 1,
                canvas,
                width: canvas.width,
                height: canvas.height,
            });

            // Yield event loop to prevent UI stutter
            await new Promise((resolve) => requestAnimationFrame(resolve));
        }

        if (onProgress) onProgress('complete', totalPages, totalPages);

        return pageCanvases;
    } finally {
        // 6. Strict memory sanitation: Detach temporary rendering DOM host
        if (document.body.contains(host)) {
            document.body.removeChild(host);
        }
    }
}