import type { ImageInfo, Settings, FetchImageResult } from '../shared/types';

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
  if (imageInfo.src.startsWith('data:')) {
    return imageInfo.src;
  }

  // Use background script to fetch image (bypasses CORS)
  const result = await chrome.runtime.sendMessage({
    type: 'FETCH_IMAGE',
    payload: { url: imageInfo.src },
  }) as FetchImageResult;

  if (result.dataUrl) {
    return result.dataUrl;
  }

  throw new Error(result.error || 'Failed to fetch image');
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
