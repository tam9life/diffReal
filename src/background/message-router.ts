import type { Message, Settings, ModelStatus } from '../shared/types';
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

    default:
      console.warn('[DiffReal] Unknown message type:', message.type);
      return;
  }
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
