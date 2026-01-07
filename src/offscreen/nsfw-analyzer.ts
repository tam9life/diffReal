import { getNsfwModel } from './model-loader';
import type { NsfwCategories } from '../shared/types';

export interface NsfwResult {
  nsfwScore: number;
  categories: NsfwCategories;
}

export async function analyzeNsfw(imageElement: HTMLImageElement): Promise<NsfwResult> {
  const model = getNsfwModel();
  if (!model) {
    throw new Error('NSFW model not loaded');
  }

  const predictions = await model.classify(imageElement);

  const categories: NsfwCategories = {
    drawing: 0,
    neutral: 0,
    sexy: 0,
    porn: 0,
    hentai: 0,
  };

  for (const pred of predictions) {
    const className = pred.className.toLowerCase() as keyof NsfwCategories;
    if (className in categories) {
      categories[className] = pred.probability;
    }
  }

  const nsfwScore = categories.porn + categories.hentai + categories.sexy * 0.5;

  return {
    nsfwScore: Math.min(1, nsfwScore),
    categories,
  };
}

export async function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // crossOrigin 설정 안 함 - data URL만 사용하므로 필요 없음
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${e}`));
    img.src = dataUrl;
  });
}
