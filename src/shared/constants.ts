export const DEFAULT_SETTINGS = {
  minWidth: 512,
  minHeight: 512,
  realThreshold: 0.5,
  nsfwThreshold: 0.5,
  autoAnalyze: true,
  showOverlay: true,
};

export const CLIP_MODEL_ID = 'Xenova/clip-vit-base-patch32';

export const REALISM_LABELS = {
  real: [
    'a real photograph taken with a camera',
    'a photograph of a real person or scene',
    'photorealistic image',
    'a photo',
  ],
  illustration: [
    'digital art illustration',
    'cartoon or anime drawing',
    'computer generated artwork',
    'painting or artistic rendering',
    'a drawing',
    'an illustration',
  ],
};

export const STORAGE_KEYS = {
  SETTINGS: 'diffreal_settings',
  MODEL_CACHE: 'diffreal_model_cache',
};

export const ANALYSIS_BATCH_SIZE = 5;
export const ANALYSIS_DELAY_MS = 100;

export const PANEL_DEFAULT_POSITION = {
  x: 20,
  y: 20,
};

export const PANEL_DIMENSIONS = {
  width: 400,
  minHeight: 300,
  maxHeight: 600,
};
