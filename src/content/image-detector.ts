import type { ImageInfo, Settings, CaptureImageResult } from '../shared/types';

let imageIdCounter = 0;

export function generateImageId(): string {
  return `diffreal-img-${++imageIdCounter}`;
}

export function detectImages(settings: Settings): ImageInfo[] {
  const images: ImageInfo[] = [];
  const { minWidth, minHeight } = settings;

  // Detect <img> elements
  const imgElements = document.querySelectorAll('img');
  for (const img of imgElements) {
    if (img.naturalWidth >= minWidth && img.naturalHeight >= minHeight) {
      const src = img.src || img.currentSrc;
      if (src && !src.startsWith('data:image/svg')) {
        images.push({
          id: generateImageId(),
          src,
          width: img.naturalWidth,
          height: img.naturalHeight,
          element: img,
          type: 'img',
        });
      }
    }
  }

  // Detect canvas elements
  const canvasElements = document.querySelectorAll('canvas');
  for (const canvas of canvasElements) {
    if (canvas.width >= minWidth && canvas.height >= minHeight) {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        images.push({
          id: generateImageId(),
          src: dataUrl,
          width: canvas.width,
          height: canvas.height,
          element: canvas,
          type: 'canvas',
        });
      } catch {
        // Canvas might be tainted
      }
    }
  }

  return images;
}

export async function getImageDataUrl(imageInfo: ImageInfo): Promise<string> {
  // 1. Data URL은 그대로 반환
  if (imageInfo.src.startsWith('data:')) {
    return imageInfo.src;
  }

  // 2. Same-origin 이미지는 canvas로 변환 시도
  if (imageInfo.element && imageInfo.element instanceof HTMLImageElement) {
    try {
      const dataUrl = await convertImageToDataUrl(imageInfo.element);
      if (dataUrl) {
        console.log('[DiffReal] Converted image via canvas');
        return dataUrl;
      }
    } catch (e) {
      console.log('[DiffReal] Canvas conversion failed (likely CORS), trying screen capture');
    }
  }

  // 3. Cross-origin 이미지는 스크린 캡처 사용
  if (imageInfo.element) {
    const dataUrl = await captureImageFromScreen(imageInfo.element);
    if (dataUrl) {
      console.log('[DiffReal] Captured image from screen');
      return dataUrl;
    }
  }

  throw new Error('Failed to get image data');
}

async function convertImageToDataUrl(img: HTMLImageElement): Promise<string | null> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 이 줄에서 CORS 이미지면 에러 발생 (의도적)
  ctx.drawImage(img, 0, 0);

  // toDataURL이 성공하면 same-origin 이미지
  return canvas.toDataURL('image/jpeg', 0.9);
}

async function captureImageFromScreen(element: HTMLElement): Promise<string | null> {
  // Scroll element into view first
  element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });

  // Wait for scroll to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  const rect = element.getBoundingClientRect();

  // Check if element is visible in viewport
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  // Ensure element is within viewport
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const visibleRect = {
    x: Math.max(0, rect.x),
    y: Math.max(0, rect.y),
    width: Math.min(rect.width, viewportWidth - Math.max(0, rect.x)),
    height: Math.min(rect.height, viewportHeight - Math.max(0, rect.y)),
  };

  if (visibleRect.width <= 0 || visibleRect.height <= 0) {
    return null;
  }

  const result = await chrome.runtime.sendMessage({
    type: 'CAPTURE_IMAGE',
    payload: {
      rect: visibleRect,
      devicePixelRatio: window.devicePixelRatio || 1,
    },
  }) as CaptureImageResult;

  return result?.dataUrl || null;
}

export function observeDOMChanges(
  callback: (mutations: MutationRecord[]) => void
): MutationObserver {
  const observer = new MutationObserver(callback);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'style', 'class'],
  });

  return observer;
}

export function scrollToImage(element: HTMLElement | null): void {
  if (!element) return;

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center',
  });

  // Highlight effect
  const originalOutline = element.style.outline;
  const originalTransition = element.style.transition;

  element.style.transition = 'outline 0.3s ease';
  element.style.outline = '4px solid #ff6b6b';

  setTimeout(() => {
    element.style.outline = originalOutline;
    setTimeout(() => {
      element.style.transition = originalTransition;
    }, 300);
  }, 2000);
}
