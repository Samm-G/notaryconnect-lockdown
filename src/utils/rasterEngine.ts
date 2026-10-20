import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { ProcessingOptions } from '../types/document';
import { normalizeDocxToCanvases } from './docxNormalizer';
import { MAX_PAGE_COUNT } from './documentValidator';

// Initialize PDF.js worker using Vite local bundled worker asset
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export type PipelineTelemetryCallback = (
    stage: 'initializing' | 'rendering_page' | 'burning_watermark' | 'encoding_bitmap' | 'assembling_pdf' | 'completed',
    currentPage: number,
    totalPages: number,
    percentage: number
) => void;

export interface RasterResult {
    lockedPdfBytes: Uint8Array;
    pageCount: number;
    qualityMode: 'compressed' | 'full';
    watermarkApplied: boolean;
}

/**
 * Permanently burns the diagonal "NotaryConnect - Confidential" watermark
 * directly into the canvas bitmap pixels before export.
 */
export function burnWatermarkOntoCanvas(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((-45 * Math.PI) / 180);

    const fontSize = Math.floor(width / 17);
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(100, 100, 100, 0.16)';
    ctx.fillText('NotaryConnect - Confidential', 0, 0);

    ctx.restore();
}

/**
 * Encodes an HTML5 Canvas to a high-density image byte array based on compression mode.
 */
async function canvasToBitmapBytes(
    canvas: HTMLCanvasElement,
    qualityMode: 'compressed' | 'full'
): Promise<{ bytes: Uint8Array; format: 'jpeg' | 'png' }> {
    const mimeType = qualityMode === 'compressed' ? 'image/jpeg' : 'image/png';
    const quality = qualityMode === 'compressed' ? 0.85 : 1.0;

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            async (blob) => {
                if (!blob) {
                    reject(new Error('Failed to extract bitmap from canvas.'));
                    return;
                }
                const arrayBuffer = await blob.arrayBuffer();
                resolve({
                    bytes: new Uint8Array(arrayBuffer),
                    format: qualityMode === 'compressed' ? 'jpeg' : 'png',
                });
            },
            mimeType,
            quality
        );
    });
}

/**
 * Suppresses macOS Preview Live Text and Chrome Searchify.
 * By placing an invisible, off-screen anchor glyph in the content stream,
 * PDF readers recognize the page as already having a native text stream,
 * completely disabling automatic on-device AI OCR without exposing document text.
 */
function suppressLiveTextOcr(page: any, font: any): void {
    page.drawText('.', {
        x: -100,
        y: -100,
        size: 0.1,
        font,
        opacity: 0,
    });
}

/**
 * Processes a PDF file.
 */
async function processPdfPipeline(
    file: File,
    options: ProcessingOptions,
    onTelemetry?: PipelineTelemetryCallback
): Promise<RasterResult> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    if (totalPages > MAX_PAGE_COUNT) {
        throw new Error(
            `Document exceeds the ${MAX_PAGE_COUNT}-page limit (Detected: ${totalPages} pages). Please split the document.`
        );
    }

    // Create clean PDF document without any vector text or form layers
    const assembledPdf = await PDFDocument.create();
    const font = await assembledPdf.embedFont(StandardFonts.Helvetica);
    const DPI_300_SCALE = 300 / 72;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const progressPercent = Math.round(((pageNum - 1) / totalPages) * 100);

        if (onTelemetry) {
            onTelemetry('rendering_page', pageNum, totalPages, progressPercent);
        }

        const page = await pdfDoc.getPage(pageNum);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scaledViewport = page.getViewport({ scale: DPI_300_SCALE });

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(scaledViewport.width);
        canvas.height = Math.floor(scaledViewport.height);

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
            throw new Error(`Failed to acquire 2D canvas context for page ${pageNum}.`);
        }

        // Render page to 300 DPI canvas bitmap
        await page.render({
            canvasContext: ctx,
            viewport: scaledViewport,
        }).promise;

        // Conditionally burn watermark into bitmap pixels
        if (options.applyWatermark) {
            if (onTelemetry) {
                onTelemetry('burning_watermark', pageNum, totalPages, progressPercent);
            }
            burnWatermarkOntoCanvas(canvas);
        }

        if (onTelemetry) {
            onTelemetry('encoding_bitmap', pageNum, totalPages, progressPercent);
        }
        const { bytes: imageBytes, format } = await canvasToBitmapBytes(canvas, options.qualityMode);

        const embeddedImage =
            format === 'jpeg'
                ? await assembledPdf.embedJpg(imageBytes)
                : await assembledPdf.embedPng(imageBytes);

        const newPage = assembledPdf.addPage([unscaledViewport.width, unscaledViewport.height]);

        // Draw the flattened 300 DPI bitmap
        newPage.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: unscaledViewport.width,
            height: unscaledViewport.height,
        });

        // Suppress Apple Preview Live Text (No draggable annotations, zero visual artifacts)
        suppressLiveTextOcr(newPage, font);

        // Memory sanitation
        canvas.width = 0;
        canvas.height = 0;

        await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    if (onTelemetry) {
        onTelemetry('assembling_pdf', totalPages, totalPages, 95);
    }

    const lockedPdfBytes = await assembledPdf.save();

    if (onTelemetry) {
        onTelemetry('completed', totalPages, totalPages, 100);
    }

    return {
        lockedPdfBytes,
        pageCount: totalPages,
        qualityMode: options.qualityMode,
        watermarkApplied: options.applyWatermark,
    };
}

/**
 * Processes a modern .docx file.
 */
async function processDocxPipeline(
    file: File,
    options: ProcessingOptions,
    onTelemetry?: PipelineTelemetryCallback
): Promise<RasterResult> {
    if (onTelemetry) {
        onTelemetry('initializing', 0, 0, 5);
    }

    const pageCanvases = await normalizeDocxToCanvases(file, (_stage, cur, total) => {
        if (onTelemetry) {
            onTelemetry('rendering_page', cur, total, Math.round((cur / (total || 1)) * 50));
        }
    });

    const totalPages = pageCanvases.length;
    if (totalPages > MAX_PAGE_COUNT) {
        throw new Error(
            `Word document exceeds the ${MAX_PAGE_COUNT}-page limit (Detected: ${totalPages} pages). Please split the document.`
        );
    }

    const assembledPdf = await PDFDocument.create();
    const font = await assembledPdf.embedFont(StandardFonts.Helvetica);
    const DPI_300_SCALE = 300 / 72;

    for (let i = 0; i < totalPages; i++) {
        const pageObj = pageCanvases[i];
        const pageNum = i + 1;
        const progressPercent = 50 + Math.round((pageNum / totalPages) * 45);

        if (options.applyWatermark) {
            if (onTelemetry) {
                onTelemetry('burning_watermark', pageNum, totalPages, progressPercent);
            }
            burnWatermarkOntoCanvas(pageObj.canvas);
        }

        if (onTelemetry) {
            onTelemetry('encoding_bitmap', pageNum, totalPages, progressPercent);
        }

        const { bytes: imageBytes, format } = await canvasToBitmapBytes(
            pageObj.canvas,
            options.qualityMode
        );

        const embeddedImage =
            format === 'jpeg'
                ? await assembledPdf.embedJpg(imageBytes)
                : await assembledPdf.embedPng(imageBytes);

        const widthPt = pageObj.width / DPI_300_SCALE;
        const heightPt = pageObj.height / DPI_300_SCALE;

        const newPage = assembledPdf.addPage([widthPt, heightPt]);
        newPage.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: widthPt,
            height: heightPt,
        });

        // Suppress Apple Preview Live Text
        suppressLiveTextOcr(newPage, font);

        pageObj.canvas.width = 0;
        pageObj.canvas.height = 0;

        await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    if (onTelemetry) {
        onTelemetry('assembling_pdf', totalPages, totalPages, 98);
    }

    const lockedPdfBytes = await assembledPdf.save();

    if (onTelemetry) {
        onTelemetry('completed', totalPages, totalPages, 100);
    }

    return {
        lockedPdfBytes,
        pageCount: totalPages,
        qualityMode: options.qualityMode,
        watermarkApplied: options.applyWatermark,
    };
}

export async function executeDocumentLockdown(
    file: File,
    options: ProcessingOptions,
    onTelemetry?: PipelineTelemetryCallback
): Promise<RasterResult> {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.pdf')) {
        return processPdfPipeline(file, options, onTelemetry);
    }

    if (fileName.endsWith('.docx')) {
        return processDocxPipeline(file, options, onTelemetry);
    }

    throw new Error(`Unsupported document extension for lockdown: ${file.name}`);
}