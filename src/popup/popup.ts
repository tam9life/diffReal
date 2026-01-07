import type { Settings, ModelStatus } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/constants';

let settings: Settings = { ...DEFAULT_SETTINGS };

async function init(): Promise<void> {
  settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }) || settings;
  updateUI();

  const modelStatus = await chrome.runtime.sendMessage({ type: 'GET_MODEL_STATUS' });
  if (modelStatus) {
    updateModelStatus(modelStatus);
  }

  setupEventListeners();
}

function updateUI(): void {
  const minWidthInput = document.getElementById('minWidth') as HTMLInputElement;
  const minHeightInput = document.getElementById('minHeight') as HTMLInputElement;
  const realThresholdInput = document.getElementById('realThreshold') as HTMLInputElement;
  const nsfwThresholdInput = document.getElementById('nsfwThreshold') as HTMLInputElement;
  const autoAnalyzeInput = document.getElementById('autoAnalyze') as HTMLInputElement;
  const showOverlayInput = document.getElementById('showOverlay') as HTMLInputElement;

  if (minWidthInput) minWidthInput.value = String(settings.minWidth);
  if (minHeightInput) minHeightInput.value = String(settings.minHeight);
  if (realThresholdInput) realThresholdInput.value = String(settings.realThreshold);
  if (nsfwThresholdInput) nsfwThresholdInput.value = String(settings.nsfwThreshold);
  if (autoAnalyzeInput) autoAnalyzeInput.checked = settings.autoAnalyze;
  if (showOverlayInput) showOverlayInput.checked = settings.showOverlay;

  updateSliderValue('realThreshold', settings.realThreshold);
  updateSliderValue('nsfwThreshold', settings.nsfwThreshold);
}

function updateSliderValue(id: string, value: number): void {
  const valueEl = document.getElementById(`${id}Value`);
  if (valueEl) {
    valueEl.textContent = value.toFixed(2);
  }
}

function updateModelStatus(status: ModelStatus): void {
  const clipStatus = document.getElementById('clipStatus');
  const nsfwStatus = document.getElementById('nsfwStatus');
  const gpuStatus = document.getElementById('gpuStatus');

  if (clipStatus) {
    clipStatus.className = `popup-status-badge ${status.clip}`;
    clipStatus.textContent = status.clip === 'loading'
      ? `Loading ${status.clipProgress}%`
      : status.clip === 'ready' ? 'Ready' : 'Error';
  }

  if (nsfwStatus) {
    nsfwStatus.className = `popup-status-badge ${status.nsfw}`;
    nsfwStatus.textContent = status.nsfw === 'loading'
      ? `Loading ${status.nsfwProgress}%`
      : status.nsfw === 'ready' ? 'Ready' : 'Error';
  }

  if (gpuStatus) {
    gpuStatus.className = 'popup-status-badge ready';
    gpuStatus.textContent = status.gpuBackend.toUpperCase();
  }
}

function setupEventListeners(): void {
  const togglePanelBtn = document.getElementById('togglePanel');
  togglePanelBtn?.addEventListener('click', async () => {
    // 서비스 워커 우회: 직접 content script에 메시지 전송
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
    }
    window.close();
  });

  const minWidthInput = document.getElementById('minWidth') as HTMLInputElement;
  const minHeightInput = document.getElementById('minHeight') as HTMLInputElement;

  minWidthInput?.addEventListener('change', () => {
    saveSettings({ minWidth: parseInt(minWidthInput.value, 10) || 512 });
  });

  minHeightInput?.addEventListener('change', () => {
    saveSettings({ minHeight: parseInt(minHeightInput.value, 10) || 512 });
  });

  const realThresholdInput = document.getElementById('realThreshold') as HTMLInputElement;
  realThresholdInput?.addEventListener('input', () => {
    const value = parseFloat(realThresholdInput.value);
    updateSliderValue('realThreshold', value);
    saveSettings({ realThreshold: value });
  });

  const nsfwThresholdInput = document.getElementById('nsfwThreshold') as HTMLInputElement;
  nsfwThresholdInput?.addEventListener('input', () => {
    const value = parseFloat(nsfwThresholdInput.value);
    updateSliderValue('nsfwThreshold', value);
    saveSettings({ nsfwThreshold: value });
  });

  const autoAnalyzeInput = document.getElementById('autoAnalyze') as HTMLInputElement;
  autoAnalyzeInput?.addEventListener('change', () => {
    saveSettings({ autoAnalyze: autoAnalyzeInput.checked });
  });

  const showOverlayInput = document.getElementById('showOverlay') as HTMLInputElement;
  showOverlayInput?.addEventListener('change', () => {
    saveSettings({ showOverlay: showOverlayInput.checked });
  });

  const resetSettingsLink = document.getElementById('resetSettings');
  resetSettingsLink?.addEventListener('click', async (e) => {
    e.preventDefault();
    settings = { ...DEFAULT_SETTINGS };
    await saveSettings(settings);
    updateUI();
  });
}

async function saveSettings(newSettings: Partial<Settings>): Promise<void> {
  settings = { ...settings, ...newSettings };
  await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: newSettings });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'MODEL_PROGRESS' || message.type === 'MODEL_STATUS') {
    updateModelStatus(message.payload);
  }
});

document.addEventListener('DOMContentLoaded', init);
