/**
 * Image Classifier using transformers.js
 */

const MODEL_ID = 'onnx-community/Deep-Fake-Detector-v2-Model-ONNX';

export class ImageClassifier {
  constructor() {
    this.pipeline = null;
    this.RawImage = null;
    this.mode = 'unknown';
    this.ready = false;
  }

  async initialize() {
    const { pipeline, RawImage } = await import('@huggingface/transformers');

    this.pipeline = await pipeline('image-classification', MODEL_ID, {
      device: 'cpu'
    });
    this.RawImage = RawImage;

    this.mode = 'local';
    this.ready = true;
  }

  async classify(imageData) {
    if (!this.ready) {
      await this.initialize();
    }

    try {
      let image;

      if (imageData.startsWith('data:')) {
        // Extract base64 data from data URL
        const base64Data = imageData.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');

        // Create RawImage from buffer
        image = await this.RawImage.fromBlob(new Blob([buffer]));
      } else {
        // For regular URLs
        image = await this.RawImage.fromURL(imageData);
      }

      const results = await this.pipeline(image);
      return this.processResults(results);
    } catch (error) {
      throw new Error(`Classification failed: ${error.message}`);
    }
  }

  processResults(results) {
    const realism = results.find(r =>
      r.label === 'Realism' ||
      r.label === 'Real' ||
      r.label.toLowerCase().includes('real')
    );

    const deepfake = results.find(r =>
      r.label === 'Deepfake' ||
      r.label === 'Fake' ||
      r.label.toLowerCase().includes('fake')
    );

    let score, confidence;

    if (realism) {
      score = realism.score;
      confidence = realism.score;
    } else if (deepfake) {
      score = 1 - deepfake.score;
      confidence = deepfake.score;
    } else {
      score = results[0].score;
      confidence = results[0].score;
    }

    return {
      score: Math.round(score * 10000) / 10000,
      label: score > 0.5 ? 'realistic' : 'ai_image',
      confidence: Math.round(confidence * 10000) / 10000,
      mode: this.mode,
      raw: results
    };
  }
}
