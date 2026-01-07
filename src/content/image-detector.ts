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
  // Canvas 요소는 이미 data URL로 저장됨
  if (imageInfo.src.startsWith('data:')) {
    return imageInfo.src;
  }

  // 모든 이미지는 스크린 캡처로만 처리 (CORS 완전 우회)
  if (!imageInfo.element) {
    throw new Error('No element to capture');
  }

  const dataUrl = await captureImageFromScreen(imageInfo.element);
  if (dataUrl) {
    console.log('[DiffReal] Captured image from screen');
    return dataUrl;
  }

  throw new Error('Failed to capture image');
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
