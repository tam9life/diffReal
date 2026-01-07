import { getClipPipeline } from './model-loader';
import { REALISM_LABELS } from '../shared/constants';
import { loadImageFromDataUrl } from './nsfw-analyzer';

export interface ClipResult {
  realScore: number;
  scores: {
    label: string;
    score: number;
  }[];
}

interface ClassificationResult {
  label: string;
  score: number;
}

export async function analyzeRealism(imageData: string): Promise<ClipResult> {
  const pipeline = getClipPipeline();
  if (!pipeline) {
    throw new Error('CLIP model not loaded');
  }

  const allLabels = [...REALISM_LABELS.real, ...REALISM_LABELS.illustration];

  // Convert base64 to HTMLImageElement for transformers.js
  const img = await loadImageFromDataUrl(imageData);
  const rawResults = await pipeline(img, allLabels);

  // Handle both single result and array of results
  const results: ClassificationResult[] = Array.isArray(rawResults)
    ? (rawResults as ClassificationResult[]).flat()
    : [rawResults as ClassificationResult];

  const scores = results.map((r) => ({
    label: r.label,
    score: r.score,
  }));

  let realTotal = 0;
  let illustrationTotal = 0;

  for (const result of results) {
    if (REALISM_LABELS.real.includes(result.label)) {
      realTotal += result.score;
    } else {
      illustrationTotal += result.score;
    }
  }

  const total = realTotal + illustrationTotal;
  const realScore = total > 0 ? realTotal / total : 0.5;

  return {
    realScore,
    scores,
  };
}
