import { ensureOffscreenDocument } from './offscreen-manager';
import { handleMessage, loadSettings } from './message-router';
import type { Message } from '../shared/types';

console.log('[DiffReal] Background service worker started');

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[DiffReal] Extension installed');
  await loadSettings();
  await ensureOffscreenDocument();
  chrome.runtime.sendMessage({ type: 'INIT_MODELS', target: 'offscreen' }).catch(() => {
    // Offscreen might not be ready yet
  });
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[DiffReal] Browser started');
  await loadSettings();
});

chrome.runtime.onMessage.addListener((message: Message & { target?: string }, sender, sendResponse) => {
  if (message.target === 'offscreen') {
    return false;
  }

  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('[DiffReal] Message handling error:', error);
      sendResponse({ error: error.message });
    });

  return true;
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
  }
});
