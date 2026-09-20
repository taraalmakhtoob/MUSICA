export interface VideoMetadata {
  title: string;
  thumbnail: string;
  duration: string;
  channelName: string;
}

export interface ConversionResult {
  success: boolean;
  downloadUrl: string;
  filename: string;
  metadata?: VideoMetadata;
  fileSize?: string;
}

export type ConverterState = 'idle' | 'processing' | 'complete' | 'error';
