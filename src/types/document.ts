export type SupportedFormat = 'pdf' | 'docx' | 'doc' | 'unsupported';

export type QualityMode = 'compressed' | 'full';

export interface ProcessingOptions {
    applyWatermark: boolean; // Default: true
    qualityMode: QualityMode; // Default: 'compressed' (JPEG 85%)
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

export interface AuditReceipt {
    auditId: string;
    sha256Original: string;
    sha256Final: string;
    manifestKey: string;
    downloadFileName: string;
    signedPdfBlob: Blob;
    originalFileName: string;
    pageCount: number;
    watermarkApplied: boolean;
    qualityMode: QualityMode;
    timestamp: string;
}