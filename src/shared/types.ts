export interface ImageInfo {
  id: string;
  src: string;
  width: number;
  height: number;
  element: HTMLElement | null;
  type: 'img' | 'background' | 'canvas';
}

export interface NsfwCategories {
  drawing: number;
  neutral: number;
  sexy: number;
  porn: number;
  hentai: number;
}

export interface AnalysisResult {
  imageId: string;
  realScore: number;
  nsfwScore: number;
  nsfwCategories: NsfwCategories;
  timestamp: number;
}

export interface ImageAnalysisItem extends ImageInfo {
  analysis?: AnalysisResult;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  error?: string;
}

export interface Settings {
  minWidth: number;
  minHeight: number;
  realThreshold: number;
  nsfwThreshold: number;
  autoAnalyze: boolean;
  showOverlay: boolean;
}

export interface ModelStatus {
  clip: 'loading' | 'ready' | 'error';
  nsfw: 'loading' | 'ready' | 'error';
  clipProgress: number;
  nsfwProgress: number;
  gpuBackend: 'webgpu' | 'webgl' | 'cpu';
}

export type MessageType =
  | 'ANALYZE_IMAGE'
  | 'ANALYSIS_RESULT'
  | 'ANALYSIS_ERROR'
  | 'GET_MODEL_STATUS'
  | 'MODEL_STATUS'
  | 'MODEL_PROGRESS'
  | 'INIT_MODELS'
  | 'TOGGLE_PANEL'
  | 'UPDATE_SETTINGS'
  | 'GET_SETTINGS'
  | 'FETCH_IMAGE'
  | 'CAPTURE_IMAGE';

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
}

export interface AnalyzeImagePayload {
  imageId: string;
  imageData: string;
}

export interface AnalysisResultPayload extends AnalysisResult {}

export interface AnalysisErrorPayload {
  imageId: string;
  error: string;
}

export interface ModelProgressPayload {
  model: 'clip' | 'nsfw';
  progress: number;
  status: string;
}

export interface FetchImagePayload {
  url: string;
}

export interface FetchImageResult {
  dataUrl: string | null;
  error?: string;
}

export interface CaptureImagePayload {
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  devicePixelRatio: number;
}

export interface CaptureImageResult {
  dataUrl: string | null;
  error?: string;
}
