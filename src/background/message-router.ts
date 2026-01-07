import type { Message, Settings, ModelStatus, CropImagePayload, CaptureImageResult } from '../shared/types';
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

    case 'CAPTURE_SCREEN':
      // 전체 화면 캡처 (crop 없이)
      return captureScreen();

    case 'CROP_IMAGE':
      // 스크린샷에서 특정 영역 crop
      return cropImage(message.payload as CropImagePayload);

    default:
      console.warn('[DiffReal] Unknown message type:', message.type);
      return;
  }
}

async function captureScreen(): Promise<CaptureImageResult> {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
    return { dataUrl };
  } catch (error) {
    console.error('[DiffReal] Failed to capture screen:', error);
    return { dataUrl: null, error: (error as Error).message };
  }
}

async function cropImage(payload: CropImagePayload): Promise<CaptureImageResult> {
  try {
    const { screenshot, rect, devicePixelRatio } = payload;

    // Base64 data URL을 Blob으로 변환
    const base64 = screenshot.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });

    // ImageBitmap 생성
    const img = await createImageBitmap(blob);

    // 실제 픽셀 좌표 계산
    const actualX = Math.round(rect.x * devicePixelRatio);
    const actualY = Math.round(rect.y * devicePixelRatio);
    const actualWidth = Math.round(rect.width * devicePixelRatio);
    const actualHeight = Math.round(rect.height * devicePixelRatio);

    // 캔버스에 crop
    const canvas = new OffscreenCanvas(actualWidth, actualHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.drawImage(img, actualX, actualY, actualWidth, actualHeight, 0, 0, actualWidth, actualHeight);

    // Blob으로 변환 후 data URL 생성
    const resultBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    const dataUrl = await blobToDataUrl(resultBlob);

    return { dataUrl };
  } catch (error) {
    console.error('[DiffReal] Failed to crop image:', error);
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
