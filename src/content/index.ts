import { FloatingPanel } from './floating-panel/FloatingPanel';
import { detectImages, getImageDataUrl, scrollToImage, observeDOMChanges } from './image-detector';
import type { Message, Settings, ImageAnalysisItem, ModelStatus, AnalysisResult } from '../shared/types';
import { DEFAULT_SETTINGS, ANALYSIS_BATCH_SIZE, ANALYSIS_DELAY_MS } from '../shared/constants';

console.log('[DiffReal] Content script loaded');

let panel: FloatingPanel | null = null;
let settings: Settings = { ...DEFAULT_SETTINGS };
let images: ImageAnalysisItem[] = [];
let isAnalyzing = false;
let analysisQueue: string[] = [];

async function init(): Promise<void> {
  panel = new FloatingPanel();

  panel.onSettings(handleSettingsChange);
  panel.onScan(handleScanRequest);
  panel.onImageSelect(handleImageSelect);

  settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }) || settings;
  panel.setSettings(settings);

  const modelStatus = await chrome.runtime.sendMessage({ type: 'GET_MODEL_STATUS' });
  if (modelStatus) {
    panel.setModelStatus(modelStatus);
  }

  await chrome.runtime.sendMessage({ type: 'INIT_MODELS' });

  observeDOMChanges(handleDOMChanges);
}

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case 'TOGGLE_PANEL':
      const payload = message.payload as { show?: boolean } | undefined;
      if (payload?.show !== undefined) {
        payload.show ? panel?.show() : panel?.hide();
      } else {
        panel?.toggle();
      }
      return panel?.isShown();

    case 'MODEL_PROGRESS':
    case 'MODEL_STATUS':
      panel?.setModelStatus(message.payload as ModelStatus);
      return;

    case 'UPDATE_SETTINGS':
      settings = message.payload as Settings;
      panel?.setSettings(settings);
      return;

    case 'ANALYSIS_RESULT':
      handleAnalysisResult(message.payload as AnalysisResult);
      return;

    default:
      return;
  }
}

function handleSettingsChange(newSettings: Partial<Settings>): void {
  settings = { ...settings, ...newSettings };
  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: newSettings });

  if (newSettings.minWidth !== undefined || newSettings.minHeight !== undefined) {
    handleScanRequest();
  }
}

function handleScanRequest(): void {
  const detected = detectImages(settings);

  images = detected.map(img => ({
    ...img,
    status: 'pending' as const,
  }));

  panel?.setImages(images);

  if (images.length > 0) {
    startAnalysis();
  }
}

function handleImageSelect(imageId: string): void {
  const image = images.find(img => img.id === imageId);
  if (image?.element) {
    scrollToImage(image.element);

    const row = document.querySelector(`[data-image-id="${imageId}"]`);
    row?.classList.add('highlight');
    setTimeout(() => row?.classList.remove('highlight'), 2000);
  }
}

function handleDOMChanges(mutations: MutationRecord[]): void {
  let hasNewImages = false;

  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLImageElement) {
          hasNewImages = true;
          break;
        }
        if (node instanceof HTMLElement && node.querySelector('img')) {
          hasNewImages = true;
          break;
        }
      }
    }
  }

  if (hasNewImages && settings.autoAnalyze && panel?.isShown()) {
    // Debounce
    setTimeout(() => handleScanRequest(), 500);
  }
}

async function startAnalysis(): Promise<void> {
  if (isAnalyzing) return;
  isAnalyzing = true;

  analysisQueue = images
    .filter(img => img.status === 'pending')
    .map(img => img.id);

  await processAnalysisQueue();

  isAnalyzing = false;
}

async function processAnalysisQueue(): Promise<void> {
  while (analysisQueue.length > 0) {
    const batch = analysisQueue.splice(0, ANALYSIS_BATCH_SIZE);

    await Promise.all(batch.map(async (imageId) => {
      const image = images.find(img => img.id === imageId);
      if (!image) return;

      try {
        image.status = 'analyzing';
        panel?.updateImage(imageId, { status: 'analyzing' });

        const imageData = await getImageDataUrl(image);

        const result = await chrome.runtime.sendMessage({
          type: 'ANALYZE_IMAGE',
          payload: { imageId, imageData },
          target: 'offscreen',
        });

        if (result && !('error' in result)) {
          handleAnalysisResult(result as AnalysisResult);
        } else {
          throw new Error((result as { error: string })?.error || 'Analysis failed');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        image.status = 'error';
        image.error = errorMessage;
        panel?.updateImage(imageId, { status: 'error', error: errorMessage });
      }
    }));

    if (analysisQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, ANALYSIS_DELAY_MS));
    }
  }
}

function handleAnalysisResult(result: AnalysisResult): void {
  const image = images.find(img => img.id === result.imageId);
  if (!image) return;

  image.status = 'complete';
  image.analysis = result;
  panel?.updateImage(result.imageId, { status: 'complete', analysis: result });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
