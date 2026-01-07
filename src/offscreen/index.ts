import { initModels, getModelStatus, setProgressCallback } from './model-loader';
import { analyzeRealism } from './clip-analyzer';
import { analyzeNsfw, loadImageFromDataUrl } from './nsfw-analyzer';
import type { Message, AnalyzeImagePayload, AnalysisResult, ModelStatus } from '../shared/types';

console.log('[DiffReal] Offscreen document loaded');

setProgressCallback((status: ModelStatus) => {
  chrome.runtime.sendMessage({
    type: 'MODEL_PROGRESS',
    payload: status,
  });
});

chrome.runtime.onMessage.addListener((message: Message & { target?: string }, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;

  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      console.error('[DiffReal] Message handling error:', error);
      sendResponse({ error: error.message });
    });

  return true;
});

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case 'INIT_MODELS':
      return initModels();

    case 'GET_MODEL_STATUS':
      return getModelStatus();

    case 'ANALYZE_IMAGE':
      return analyzeImage(message.payload as AnalyzeImagePayload);

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

async function analyzeImage(payload: AnalyzeImagePayload): Promise<AnalysisResult> {
  const { imageId, imageData } = payload;

  try {
    const img = await loadImageFromDataUrl(imageData);

    const [clipResult, nsfwResult] = await Promise.all([
      analyzeRealism(imageData),
      analyzeNsfw(img),
    ]);

    return {
      imageId,
      realScore: clipResult.realScore,
      nsfwScore: nsfwResult.nsfwScore,
      nsfwCategories: nsfwResult.categories,
      timestamp: Date.now(),
    };
  } catch (error) {
    throw new Error(`Analysis failed for image ${imageId}: ${(error as Error).message}`);
  }
}

initModels().then(() => {
  console.log('[DiffReal] Models initialized');
}).catch((error) => {
  console.error('[DiffReal] Model initialization failed:', error);
});
