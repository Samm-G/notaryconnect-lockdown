import { PDFDocument } from 'pdf-lib';

export interface DocumentMetrics {
    paperSizeName: string;          // e.g. "A4", "US Letter", "Legal", "Custom"
    dimensionsMm: string;           // e.g. "210 × 297 mm"
    orientation: 'Portrait' | 'Landscape' | 'Mixed';
    canvasResolutionPx: string;     // e.g. "2480 × 3508 px"
    pageCount: number;
    dpi: number;
    estimatedCompressedMb: string;  // e.g. "1.5 – 3.2 MB"
    estimatedFullResolutionMb: string; // e.g. "5.0 – 11.0 MB"
}

const PT_TO_MM = 25.4 / 72; // ~0.352778 mm per PDF point

function matchPaperFormat(widthMm: number, heightMm: number): { name: string; orientation: 'Portrait' | 'Landscape' } {
    const w = Math.round(widthMm);
    const h = Math.round(heightMm);
    const min = Math.min(w, h);
    const max = Math.max(w, h);
    const isPortrait = heightMm >= widthMm;
    const orientation: 'Portrait' | 'Landscape' = isPortrait ? 'Portrait' : 'Landscape';

    // A4: 210 x 297 mm (+/- 3mm tolerance)
    if (Math.abs(min - 210) <= 3 && Math.abs(max - 297) <= 3) {
        return { name: 'A4', orientation };
    }

    // US Letter: 216 x 279 mm (8.5 x 11 in)
    if (Math.abs(min - 216) <= 3 && Math.abs(max - 279) <= 3) {
        return { name: 'US Letter', orientation };
    }

    // US Legal: 216 x 356 mm (8.5 x 14 in)
    if (Math.abs(min - 216) <= 3 && Math.abs(max - 356) <= 3) {
        return { name: 'Legal', orientation };
    }

    return { name: 'Custom', orientation };
}

export async function inspectDocumentMetrics(file: File): Promise<DocumentMetrics> {
    const fileName = file.name.toLowerCase();

    // 1. PDF Inspection via pdf-lib
    if (fileName.endsWith('.pdf')) {
        try {
            const buffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
            const pageCount = pdfDoc.getPageCount();
            const firstPage = pdfDoc.getPage(0);
            const { width, height } = firstPage.getSize();

            const widthMm = width * PT_TO_MM;
            const heightMm = height * PT_TO_MM;

            const { name, orientation } = matchPaperFormat(widthMm, heightMm);

            // Compute exact 300 DPI Canvas Pixel Dimensions (300 / 72 scale factor)
            const scale300Dpi = 300 / 72;
            const canvasWidthPx = Math.round(width * scale300Dpi);
            const canvasHeightPx = Math.round(height * scale300Dpi);

            // Estimated size ranges based on page count
            const minComp = (pageCount * 0.4).toFixed(1);
            const maxComp = (pageCount * 0.85).toFixed(1);
            const minFull = (pageCount * 1.5).toFixed(1);
            const maxFull = (pageCount * 3.2).toFixed(1);

            return {
                paperSizeName: name,
                dimensionsMm: `${Math.round(widthMm)} × ${Math.round(heightMm)} mm`,
                orientation,
                canvasResolutionPx: `${canvasWidthPx} × ${canvasHeightPx} px`,
                pageCount,
                dpi: 300,
                estimatedCompressedMb: `~${minComp} – ${maxComp} MB`,
                estimatedFullResolutionMb: `~${minFull} – ${maxFull} MB`,
            };
        } catch {
            // Fallback if parsing fails
        }
    }

    // 2. Word (.docx) Default Metrics (Standard A4 Legal Practice in India)
    // At 300 DPI, standard A4 is 2480 x 3508 px
    return {
        paperSizeName: 'A4',
        dimensionsMm: '210 × 297 mm',
        orientation: 'Portrait',
        canvasResolutionPx: '2480 × 3508 px',
        pageCount: 1, // Finalized during normalization
        dpi: 300,
        estimatedCompressedMb: '~0.6 – 2.5 MB',
        estimatedFullResolutionMb: '~2.5 – 6.0 MB',
    };
}