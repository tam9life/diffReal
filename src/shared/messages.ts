import type {
  Message,
  AnalyzeImagePayload,
  AnalysisResultPayload,
  AnalysisErrorPayload,
  ModelProgressPayload,
  ModelStatus,
  Settings,
} from './types';

export function createMessage<T>(type: Message['type'], payload?: T): Message<T> {
  return { type, payload };
}

export const Messages = {
  analyzeImage: (payload: AnalyzeImagePayload) =>
    createMessage('ANALYZE_IMAGE', payload),

  analysisResult: (payload: AnalysisResultPayload) =>
    createMessage('ANALYSIS_RESULT', payload),

  analysisError: (payload: AnalysisErrorPayload) =>
    createMessage('ANALYSIS_ERROR', payload),

  getModelStatus: () => createMessage('GET_MODEL_STATUS'),

  modelStatus: (payload: ModelStatus) =>
    createMessage('MODEL_STATUS', payload),

  modelProgress: (payload: ModelProgressPayload) =>
    createMessage('MODEL_PROGRESS', payload),

  initModels: () => createMessage('INIT_MODELS'),

  togglePanel: (show?: boolean) => createMessage('TOGGLE_PANEL', { show }),

  updateSettings: (payload: Partial<Settings>) =>
    createMessage('UPDATE_SETTINGS', payload),

  getSettings: () => createMessage('GET_SETTINGS'),
};

export async function sendToBackground<T = unknown>(message: Message): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

export async function sendToTab<T = unknown>(tabId: number, message: Message): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message);
}

export async function sendToOffscreen<T = unknown>(message: Message): Promise<T> {
  return chrome.runtime.sendMessage({ ...message, target: 'offscreen' });
}
