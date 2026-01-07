import type { ImageInfo, Settings } from '../shared/types';

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

  // Detect background images
  const allElements = document.querySelectorAll('*');
  for (const el of allElements) {
    const style = window.getComputedStyle(el);
    const bgImage = style.backgroundImage;

    if (bgImage && bgImage !== 'none' && bgImage.startsWith('url(')) {
      const urlMatch = bgImage.match(/url\(["']?(.+?)["']?\)/);
      if (urlMatch && urlMatch[1]) {
        const src = urlMatch[1];
        if (!src.startsWith('data:image/svg')) {
          // Create a temporary image to get dimensions
          const tempImg = new Image();
          tempImg.src = src;

          // We'll check dimensions when loaded
          images.push({
            id: generateImageId(),
            src,
            width: 0, // Will be updated
            height: 0,
            element: el as HTMLElement,
            type: 'background',
          });
        }
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

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageInfo.src;
  });
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
