export type PipelineStage =
    | 'idle'
    | 'normalizing'
    | 'rasterizing'
    | 'burning_watermark'
    | 'assembling'
    | 'signing'
    | 'archiving'
    | 'completed'
    | 'error';

export interface PipelineTelemetryState {
    stage: PipelineStage;
    currentPage: number;
    totalPages: number;
    percentage: number;
    detailMessage: string;
    error: string | null;
}