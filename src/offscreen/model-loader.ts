import { pipeline, env } from '@huggingface/transformers';
import * as nsfwjs from 'nsfwjs';
import * as tf from '@tensorflow/tfjs';
import { CLIP_MODEL_ID } from '../shared/constants';
import type { ModelStatus } from '../shared/types';

env.allowLocalModels = false;
env.useBrowserCache = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClipPipeline = any;

let clipPipeline: ClipPipeline | null = null;
let nsfwModel: nsfwjs.NSFWJS | null = null;

let modelStatus: ModelStatus = {
  clip: 'loading',
  nsfw: 'loading',
  clipProgress: 0,
  nsfwProgress: 0,
  gpuBackend: 'cpu',
};

type ProgressCallback = (status: ModelStatus) => void;
let progressCallback: ProgressCallback | null = null;

export function setProgressCallback(callback: ProgressCallback): void {
  progressCallback = callback;
}

function updateStatus(updates: Partial<ModelStatus>): void {
  modelStatus = { ...modelStatus, ...updates };
  progressCallback?.(modelStatus);
}

async function initBackend(): Promise<'webgpu' | 'webgl' | 'cpu'> {
  try {
    if ('gpu' in navigator) {
      const adapter = await (navigator as Navigator & { gpu: GPU }).gpu.requestAdapter();
      if (adapter) {
        await tf.setBackend('webgpu');
        await tf.ready();
        console.log('[DiffReal] Using WebGPU backend');
        return 'webgpu';
      }
    }
  } catch (e) {
    console.log('[DiffReal] WebGPU not available, falling back to WebGL');
  }

  try {
    await tf.setBackend('webgl');
    await tf.ready();
    console.log('[DiffReal] Using WebGL backend');
    return 'webgl';
  } catch (e) {
    console.log('[DiffReal] WebGL not available, using CPU');
    await tf.setBackend('cpu');
    await tf.ready();
    return 'cpu';
  }
}

export async function loadClipModel(): Promise<ClipPipeline> {
  if (clipPipeline) return clipPipeline;

  updateStatus({ clip: 'loading', clipProgress: 0 });

  try {
    clipPipeline = await pipeline('zero-shot-image-classification', CLIP_MODEL_ID, {
      progress_callback: (progress: { progress?: number; status?: string }) => {
        if (progress.progress !== undefined) {
          updateStatus({ clipProgress: Math.round(progress.progress) });
        }
      },
    });

    updateStatus({ clip: 'ready', clipProgress: 100 });
    console.log('[DiffReal] CLIP model loaded');
    return clipPipeline;
  } catch (error) {
    updateStatus({ clip: 'error' });
    console.error('[DiffReal] Failed to load CLIP model:', error);
    throw error;
  }
}

export async function loadNsfwModel(): Promise<nsfwjs.NSFWJS> {
  if (nsfwModel) return nsfwModel;

  updateStatus({ nsfw: 'loading', nsfwProgress: 0 });

  try {
    updateStatus({ nsfwProgress: 30 });
    nsfwModel = await nsfwjs.load();
    updateStatus({ nsfw: 'ready', nsfwProgress: 100 });
    console.log('[DiffReal] NSFW model loaded');
    return nsfwModel;
  } catch (error) {
    updateStatus({ nsfw: 'error' });
    console.error('[DiffReal] Failed to load NSFW model:', error);
    throw error;
  }
}

export async function initModels(): Promise<ModelStatus> {
  const backend = await initBackend();
  updateStatus({ gpuBackend: backend });

  await Promise.all([
    loadClipModel().catch(() => null),
    loadNsfwModel().catch(() => null),
  ]);

  return modelStatus;
}

export function getModelStatus(): ModelStatus {
  return modelStatus;
}

export function getClipPipeline(): ClipPipeline | null {
  return clipPipeline;
}

export function getNsfwModel(): nsfwjs.NSFWJS | null {
  return nsfwModel;
}
