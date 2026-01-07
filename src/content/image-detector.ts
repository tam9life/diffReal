import type { ImageInfo, Settings, CaptureImageResult } from '../shared/types';

let imageIdCounter = 0;

export function generateImageId(): string {
  return `diffreal-img-${++imageIdCounter}`;
}

export function detectImages(settings: Settings): ImageInfo[] {
  const images: ImageInfo[] = [];
  const { minWidth, minHeight } = settings;

  // Detect <img> elements (위치 정보만 수집, 이미지 데이터 접근 안 함)
  const imgElements = document.querySelectorAll('img');
  for (const img of imgElements) {
    if (img.naturalWidth >= minWidth && img.naturalHeight >= minHeight) {
      // src는 표시용으로만 사용 (접근하지 않음)
      const src = img.src || img.currentSrc || '';
      if (!src.startsWith('data:image/svg')) {
        images.push({
          id: generateImageId(),
          src: src.substring(0, 100), // 표시용 짧은 URL만 저장
          width: img.naturalWidth,
          height: img.naturalHeight,
          element: img,
          type: 'img',
        });
      }
    }
  }

  // Detect canvas elements (toDataURL 사용 안 함)
  const canvasElements = document.querySelectorAll('canvas');
  for (const canvas of canvasElements) {
    if (canvas.width >= minWidth && canvas.height >= minHeight) {
      images.push({
        id: generateImageId(),
        src: '[canvas]',
        width: canvas.width,
        height: canvas.height,
        element: canvas,
        type: 'canvas',
      });
    }
  }

  return images;
}

// 이미지별 캡처된 데이터 저장소
const capturedImages = new Map<string, string>();

/**
 * 모든 이미지를 자동 스크롤하며 캡처
 */
export async function captureAllImages(images: ImageInfo[]): Promise<void> {
  if (images.length === 0) return;

  const uncaptured = images.filter(img => !capturedImages.has(img.id));
  if (uncaptured.length === 0) return;

  console.log(`[DiffReal] Capturing ${uncaptured.length} images with auto-scroll`);

  // 현재 스크롤 위치 저장
  const originalScrollY = window.scrollY;

  // 페이지 최상단으로
  window.scrollTo(0, 0);
  await sleep(200);

  const viewportHeight = window.innerHeight;
  const pageHeight = document.documentElement.scrollHeight;
  let currentScrollY = 0;

  // 스크롤하면서 화면에 보이는 이미지 캡처
  while (currentScrollY < pageHeight) {
    // 현재 화면 캡처 요청
    const screenshotResult = await chrome.runtime.sendMessage({
      type: 'CAPTURE_SCREEN',
    }) as CaptureImageResult;

    if (screenshotResult?.dataUrl) {
      // 현재 뷰포트에 보이는 이미지들 찾기
      for (const img of uncaptured) {
        if (capturedImages.has(img.id)) continue;
        if (!img.element) continue;

        const rect = img.element.getBoundingClientRect();

        // 이미지가 현재 뷰포트 내에 충분히 보이는지 확인
        if (isElementVisible(rect, viewportHeight)) {
          // 이미지 영역 crop 요청
          const cropResult = await chrome.runtime.sendMessage({
            type: 'CROP_IMAGE',
            payload: {
              screenshot: screenshotResult.dataUrl,
              rect: {
                x: Math.max(0, rect.x),
                y: Math.max(0, rect.y),
                width: Math.min(rect.width, window.innerWidth - Math.max(0, rect.x)),
                height: Math.min(rect.height, viewportHeight - Math.max(0, rect.y)),
              },
              devicePixelRatio: window.devicePixelRatio || 1,
            },
          }) as CaptureImageResult;

          if (cropResult?.dataUrl) {
            capturedImages.set(img.id, cropResult.dataUrl);
            console.log(`[DiffReal] Captured: ${img.id}`);
          }
        }
      }
    }

    // 모든 이미지 캡처 완료 확인
    const remaining = uncaptured.filter(img => !capturedImages.has(img.id));
    if (remaining.length === 0) break;

    // 다음 영역으로 스크롤
    currentScrollY += viewportHeight * 0.8; // 80%씩 스크롤 (겹침 허용)
    window.scrollTo(0, currentScrollY);
    await sleep(150);
  }

  // 원래 스크롤 위치로 복원
  window.scrollTo(0, originalScrollY);

  console.log(`[DiffReal] Capture complete. Total: ${capturedImages.size}/${images.length}`);
}

function isElementVisible(rect: DOMRect, viewportHeight: number): boolean {
  // 이미지가 뷰포트 내에 50% 이상 보이면 캡처
  const visibleTop = Math.max(0, rect.top);
  const visibleBottom = Math.min(viewportHeight, rect.bottom);
  const visibleHeight = visibleBottom - visibleTop;

  return visibleHeight > 0 && visibleHeight >= rect.height * 0.5;
}

export async function getImageDataUrl(imageInfo: ImageInfo): Promise<string> {
  // 이미 캡처된 이미지 반환
  const cached = capturedImages.get(imageInfo.id);
  if (cached) {
    return cached;
  }

  // 캡처되지 않은 경우 개별 캡처 시도
  if (!imageInfo.element) {
    throw new Error('No element to capture');
  }

  const dataUrl = await captureImageFromScreen(imageInfo.element);
  if (dataUrl) {
    capturedImages.set(imageInfo.id, dataUrl);
    return dataUrl;
  }

  throw new Error('Failed to capture image');
}

async function captureImageFromScreen(element: HTMLElement): Promise<string | null> {
  // 요소를 뷰포트 중앙으로 스크롤
  element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
  await sleep(150);

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

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

  // 화면 캡처 후 crop
  const screenshotResult = await chrome.runtime.sendMessage({
    type: 'CAPTURE_SCREEN',
  }) as CaptureImageResult;

  if (!screenshotResult?.dataUrl) {
    return null;
  }

  const cropResult = await chrome.runtime.sendMessage({
    type: 'CROP_IMAGE',
    payload: {
      screenshot: screenshotResult.dataUrl,
      rect: visibleRect,
      devicePixelRatio: window.devicePixelRatio || 1,
    },
  }) as CaptureImageResult;

  return cropResult?.dataUrl || null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function clearCapturedImages(): void {
  capturedImages.clear();
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
