import type { Message, Settings, ModelStatus, FetchImagePayload, FetchImageResult, CaptureImagePayload, CaptureImageResult } from '../shared/types';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants';
import { ensureOffscreenDocument } from './offscreen-manager';

let currentSettings: Settings = { ...DEFAULT_SETTINGS };
let modelStatus: ModelStatus | null = null;

export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  if (result[STORAGE_KEYS.SETTINGS]) {
    currentSettings = { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
  }
  return currentSettings;
}

export async function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  currentSettings = { ...currentSettings, ...settings };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: currentSettings });
  return currentSettings;
}

export function getSettings(): Settings {
  return currentSettings;
}

export async function sendToOffscreen<T>(message: Message): Promise<T> {
  await ensureOffscreenDocument();
  return chrome.runtime.sendMessage({ ...message, target: 'offscreen' });
}

export async function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (message.type) {
    case 'INIT_MODELS':
      return sendToOffscreen(message);

    case 'GET_MODEL_STATUS':
      if (modelStatus) return modelStatus;
      return sendToOffscreen(message);

    case 'ANALYZE_IMAGE':
      return sendToOffscreen(message);

    case 'MODEL_PROGRESS':
      modelStatus = message.payload as ModelStatus;
      broadcastToTabs(message);
      return;

    case 'MODEL_STATUS':
      modelStatus = message.payload as ModelStatus;
      return modelStatus;

    case 'GET_SETTINGS':
      return getSettings();

    case 'UPDATE_SETTINGS':
      const newSettings = await saveSettings(message.payload as Partial<Settings>);
      broadcastToTabs({ type: 'UPDATE_SETTINGS', payload: newSettings });
      return newSettings;

    case 'TOGGLE_PANEL':
      if (sender.tab?.id) {
        return chrome.tabs.sendMessage(sender.tab.id, message);
      }
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id) {
        return chrome.tabs.sendMessage(activeTab.id, message);
      }
      return;

    case 'FETCH_IMAGE':
      console.log('[DiffReal] Background: FETCH_IMAGE received');
      return fetchImageAsDataUrl((message.payload as FetchImagePayload).url);

    case 'CAPTURE_IMAGE':
      console.log('[DiffReal] Background: CAPTURE_IMAGE received');
      if (!sender.tab?.id) {
        return { dataUrl: null, error: 'No tab ID' };
      }
      return captureImageFromTab(sender.tab.id, message.payload as CaptureImagePayload);

    default:
      console.warn('[DiffReal] Unknown message type:', message.type);
      return;
  }
}

async function fetchImageAsDataUrl(url: string): Promise<FetchImageResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    return { dataUrl };
  } catch (error) {
    console.error('[DiffReal] Failed to fetch image:', url, error);
    return { dataUrl: null, error: (error as Error).message };
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function captureImageFromTab(tabId: number, payload: CaptureImagePayload): Promise<CaptureImageResult> {
  try {
    const { rect, devicePixelRatio } = payload;

    // Capture the visible tab
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });

    // Create offscreen canvas to crop the image
    const img = await loadImage(screenshotDataUrl);

    // Calculate actual pixel coordinates (accounting for device pixel ratio)
    const actualX = Math.round(rect.x * devicePixelRatio);
    const actualY = Math.round(rect.y * devicePixelRatio);
    const actualWidth = Math.round(rect.width * devicePixelRatio);
    const actualHeight = Math.round(rect.height * devicePixelRatio);

    // Create canvas and crop
    const canvas = new OffscreenCanvas(actualWidth, actualHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.drawImage(img, actualX, actualY, actualWidth, actualHeight, 0, 0, actualWidth, actualHeight);

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    const dataUrl = await blobToDataUrl(blob);

    return { dataUrl };
  } catch (error) {
    console.error('[DiffReal] Failed to capture image:', error);
    return { dataUrl: null, error: (error as Error).message };
  }
}

function loadImage(src: string): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    fetch(src)
      .then(res => res.blob())
      .then(blob => createImageBitmap(blob))
      .then(resolve)
      .catch(reject);
  });
}

async function broadcastToTabs(message: Message): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {
        // Tab might not have content script
      });
    }
  }
}
