export type SupportedFormat = 'pdf' | 'docx' | 'doc' | 'unsupported';

export type QualityMode = 'compressed' | 'full';

export interface ProcessingOptions {
    applyWatermark: boolean;       // Default: true
    qualityMode: QualityMode;      // Default: 'compressed' (JPEG 85%)
}

export interface DocumentValidationResult {
    valid: boolean;
    file: File | null;
    format: SupportedFormat;
    pageCount: number | null;
    fileSizeMb: number;
    error: string | null;
    warning: string | null;
}