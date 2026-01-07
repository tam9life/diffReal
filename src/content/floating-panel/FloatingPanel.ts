import type { ImageAnalysisItem, Settings, ModelStatus } from '../../shared/types';
import { DEFAULT_SETTINGS, PANEL_DEFAULT_POSITION } from '../../shared/constants';
import styles from './styles.css';

export class FloatingPanel {
  private container: HTMLDivElement;
  private shadowRoot: ShadowRoot;
  private panel: HTMLDivElement;
  private imageListEl: HTMLTableSectionElement | null = null;
  private footerEl: HTMLDivElement | null = null;

  private images: ImageAnalysisItem[] = [];
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private modelStatus: ModelStatus | null = null;
  private isVisible = false;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private position = { ...PANEL_DEFAULT_POSITION };

  private onSettingsChange?: (settings: Partial<Settings>) => void;
  private onScanRequest?: () => void;
  private onImageClick?: (imageId: string) => void;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'diffreal-container';
    this.shadowRoot = this.container.attachShadow({ mode: 'closed' });

    this.panel = document.createElement('div');
    this.panel.className = 'diffreal-panel hidden';

    this.injectStyles();
    this.render();
    this.setupDragListeners();

    document.body.appendChild(this.container);
  }

  private injectStyles(): void {
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    this.shadowRoot.appendChild(styleEl);
  }

  private render(): void {
    this.panel.innerHTML = `
      <div class="diffreal-header">
        <div class="diffreal-title">
          <div class="diffreal-title-icon"></div>
          DiffReal
        </div>
        <div class="diffreal-header-buttons">
          <button class="diffreal-header-btn minimize" title="Minimize">−</button>
          <button class="diffreal-header-btn close" title="Close">×</button>
        </div>
      </div>

      <div class="diffreal-controls">
        <div class="diffreal-control-row">
          <span class="diffreal-control-label">Min Size:</span>
          <div class="diffreal-size-inputs">
            <input type="number" class="diffreal-size-input" id="minWidth" value="${this.settings.minWidth}" min="1">
            <span>×</span>
            <input type="number" class="diffreal-size-input" id="minHeight" value="${this.settings.minHeight}" min="1">
            <span>px</span>
          </div>
        </div>
        <div class="diffreal-control-row">
          <span class="diffreal-control-label">Real Threshold:</span>
          <div class="diffreal-threshold-slider">
            <input type="range" class="diffreal-slider" id="realThreshold"
                   min="0" max="1" step="0.05" value="${this.settings.realThreshold}">
            <span class="diffreal-threshold-value" id="realThresholdValue">${this.settings.realThreshold.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div class="diffreal-image-list">
        <table class="diffreal-image-table">
          <thead class="diffreal-table-header">
            <tr>
              <th style="width: 40px">#</th>
              <th style="width: 50px">Image</th>
              <th style="width: 70px">Real</th>
              <th style="width: 70px">NSFW</th>
              <th style="width: 80px">Status</th>
              <th style="width: 60px"></th>
            </tr>
          </thead>
          <tbody id="imageListBody"></tbody>
        </table>
        <div class="diffreal-empty" id="emptyState">
          <div class="diffreal-empty-icon">📷</div>
          <div>No images found</div>
          <button class="diffreal-scan-btn" id="scanBtn">Scan Page</button>
        </div>
      </div>

      <div class="diffreal-footer">
        <div class="diffreal-footer-stat">
          Analyzed: <span class="value" id="analyzedCount">0</span>/<span id="totalCount">0</span>
        </div>
        <div class="diffreal-model-status">
          <span class="diffreal-model-badge loading" id="clipStatus">CLIP</span>
          <span class="diffreal-model-badge loading" id="nsfwStatus">NSFW</span>
          <span class="diffreal-model-badge" id="gpuStatus">CPU</span>
        </div>
      </div>
    `;

    this.shadowRoot.appendChild(this.panel);
    this.imageListEl = this.panel.querySelector('#imageListBody');
    this.footerEl = this.panel.querySelector('.diffreal-footer');

    this.setupEventListeners();
    this.updatePosition();
  }

  private setupEventListeners(): void {
    const closeBtn = this.panel.querySelector('.diffreal-header-btn.close');
    closeBtn?.addEventListener('click', () => this.hide());

    const minimizeBtn = this.panel.querySelector('.diffreal-header-btn.minimize');
    minimizeBtn?.addEventListener('click', () => this.toggleMinimize());

    const scanBtn = this.panel.querySelector('#scanBtn');
    scanBtn?.addEventListener('click', () => this.onScanRequest?.());

    const minWidthInput = this.panel.querySelector('#minWidth') as HTMLInputElement;
    const minHeightInput = this.panel.querySelector('#minHeight') as HTMLInputElement;
    const realThresholdInput = this.panel.querySelector('#realThreshold') as HTMLInputElement;

    minWidthInput?.addEventListener('change', () => {
      this.onSettingsChange?.({ minWidth: parseInt(minWidthInput.value, 10) || 512 });
    });

    minHeightInput?.addEventListener('change', () => {
      this.onSettingsChange?.({ minHeight: parseInt(minHeightInput.value, 10) || 512 });
    });

    realThresholdInput?.addEventListener('input', () => {
      const value = parseFloat(realThresholdInput.value);
      const valueEl = this.panel.querySelector('#realThresholdValue');
      if (valueEl) valueEl.textContent = value.toFixed(2);
      this.onSettingsChange?.({ realThreshold: value });
      this.updateImageList();
    });
  }

  private setupDragListeners(): void {
    const header = this.panel.querySelector('.diffreal-header') as HTMLElement;

    header?.addEventListener('mousedown', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.diffreal-header-btn')) return;

      this.isDragging = true;
      this.dragOffset = {
        x: e.clientX - this.position.x,
        y: e.clientY - this.position.y,
      };

      document.addEventListener('mousemove', this.handleDrag);
      document.addEventListener('mouseup', this.handleDragEnd);
    });
  }

  private handleDrag = (e: MouseEvent): void => {
    if (!this.isDragging) return;

    this.position = {
      x: Math.max(0, Math.min(window.innerWidth - 420, e.clientX - this.dragOffset.x)),
      y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - this.dragOffset.y)),
    };

    this.updatePosition();
  };

  private handleDragEnd = (): void => {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.handleDrag);
    document.removeEventListener('mouseup', this.handleDragEnd);
  };

  private updatePosition(): void {
    this.panel.style.left = `${this.position.x}px`;
    this.panel.style.top = `${this.position.y}px`;
  }

  private toggleMinimize(): void {
    const content = this.panel.querySelector('.diffreal-controls') as HTMLElement;
    const imageList = this.panel.querySelector('.diffreal-image-list') as HTMLElement;
    const footer = this.panel.querySelector('.diffreal-footer') as HTMLElement;

    const isMinimized = content.style.display === 'none';

    content.style.display = isMinimized ? '' : 'none';
    imageList.style.display = isMinimized ? '' : 'none';
    footer.style.display = isMinimized ? '' : 'none';
  }

  public show(): void {
    this.isVisible = true;
    this.panel.classList.remove('hidden');
  }

  public hide(): void {
    this.isVisible = false;
    this.panel.classList.add('hidden');
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public isShown(): boolean {
    return this.isVisible;
  }

  public setImages(images: ImageAnalysisItem[]): void {
    this.images = images;
    this.updateImageList();
    this.updateFooter();
  }

  public updateImage(imageId: string, updates: Partial<ImageAnalysisItem>): void {
    const index = this.images.findIndex(img => img.id === imageId);
    if (index !== -1) {
      this.images[index] = { ...this.images[index], ...updates };
      this.updateImageRow(imageId);
      this.updateFooter();
    }
  }

  public setSettings(settings: Settings): void {
    this.settings = settings;
    this.updateSettingsUI();
    this.updateImageList();
  }

  public setModelStatus(status: ModelStatus): void {
    this.modelStatus = status;
    this.updateModelStatusUI();
  }

  private updateSettingsUI(): void {
    const minWidthInput = this.panel.querySelector('#minWidth') as HTMLInputElement;
    const minHeightInput = this.panel.querySelector('#minHeight') as HTMLInputElement;
    const realThresholdInput = this.panel.querySelector('#realThreshold') as HTMLInputElement;
    const realThresholdValue = this.panel.querySelector('#realThresholdValue');

    if (minWidthInput) minWidthInput.value = String(this.settings.minWidth);
    if (minHeightInput) minHeightInput.value = String(this.settings.minHeight);
    if (realThresholdInput) realThresholdInput.value = String(this.settings.realThreshold);
    if (realThresholdValue) realThresholdValue.textContent = this.settings.realThreshold.toFixed(2);
  }

  private updateImageList(): void {
    if (!this.imageListEl) return;

    const emptyState = this.panel.querySelector('#emptyState') as HTMLElement;

    if (this.images.length === 0) {
      this.imageListEl.innerHTML = '';
      if (emptyState) emptyState.style.display = '';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    this.imageListEl.innerHTML = this.images.map((img, index) => this.renderImageRow(img, index)).join('');

    this.imageListEl.querySelectorAll('.diffreal-goto-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const imageId = (btn as HTMLElement).dataset.imageId;
        if (imageId) this.onImageClick?.(imageId);
      });
    });
  }

  private renderImageRow(img: ImageAnalysisItem, index: number): string {
    const isFiltered = img.analysis && img.analysis.realScore < this.settings.realThreshold;
    const realScoreClass = this.getScoreClass(img.analysis?.realScore, 'real');
    const nsfwScoreClass = this.getScoreClass(img.analysis?.nsfwScore, 'nsfw');

    return `
      <tr class="diffreal-image-row ${isFiltered ? 'filtered' : ''}" data-image-id="${img.id}">
        <td>${index + 1}</td>
        <td>
          <img class="diffreal-thumbnail" src="${img.src}" alt="" loading="lazy">
        </td>
        <td>
          ${img.analysis
            ? `<span class="diffreal-score ${realScoreClass}">${img.analysis.realScore.toFixed(2)}</span>`
            : '-'
          }
        </td>
        <td>
          ${img.analysis
            ? `<span class="diffreal-score ${nsfwScoreClass}">${img.analysis.nsfwScore.toFixed(2)}</span>`
            : '-'
          }
        </td>
        <td>
          <span class="diffreal-status ${img.status}">${img.status}</span>
        </td>
        <td>
          <button class="diffreal-goto-btn" data-image-id="${img.id}">Go</button>
        </td>
      </tr>
    `;
  }

  private updateImageRow(imageId: string): void {
    const row = this.imageListEl?.querySelector(`[data-image-id="${imageId}"]`);
    if (!row) return;

    const img = this.images.find(i => i.id === imageId);
    if (!img) return;

    const index = this.images.indexOf(img);
    row.outerHTML = this.renderImageRow(img, index);

    const newRow = this.imageListEl?.querySelector(`[data-image-id="${imageId}"]`);
    newRow?.querySelector('.diffreal-goto-btn')?.addEventListener('click', () => {
      this.onImageClick?.(imageId);
    });
  }

  private getScoreClass(score: number | undefined, type: 'real' | 'nsfw'): string {
    if (score === undefined) return '';
    if (type === 'real') {
      if (score >= 0.7) return 'real-high';
      if (score >= 0.4) return 'real-medium';
      return 'real-low';
    } else {
      if (score >= 0.7) return 'nsfw-high';
      if (score >= 0.3) return 'nsfw-medium';
      return 'nsfw-low';
    }
  }

  private updateFooter(): void {
    const analyzedCount = this.panel.querySelector('#analyzedCount');
    const totalCount = this.panel.querySelector('#totalCount');

    const completed = this.images.filter(img => img.status === 'complete').length;

    if (analyzedCount) analyzedCount.textContent = String(completed);
    if (totalCount) totalCount.textContent = String(this.images.length);
  }

  private updateModelStatusUI(): void {
    if (!this.modelStatus) return;

    const clipStatus = this.panel.querySelector('#clipStatus');
    const nsfwStatus = this.panel.querySelector('#nsfwStatus');
    const gpuStatus = this.panel.querySelector('#gpuStatus');

    if (clipStatus) {
      clipStatus.className = `diffreal-model-badge ${this.modelStatus.clip}`;
      if (this.modelStatus.clip === 'loading') {
        clipStatus.textContent = `CLIP ${this.modelStatus.clipProgress}%`;
      } else {
        clipStatus.textContent = 'CLIP';
      }
    }

    if (nsfwStatus) {
      nsfwStatus.className = `diffreal-model-badge ${this.modelStatus.nsfw}`;
      if (this.modelStatus.nsfw === 'loading') {
        nsfwStatus.textContent = `NSFW ${this.modelStatus.nsfwProgress}%`;
      } else {
        nsfwStatus.textContent = 'NSFW';
      }
    }

    if (gpuStatus) {
      gpuStatus.textContent = this.modelStatus.gpuBackend.toUpperCase();
      gpuStatus.className = 'diffreal-model-badge ready';
    }
  }

  public onSettings(callback: (settings: Partial<Settings>) => void): void {
    this.onSettingsChange = callback;
  }

  public onScan(callback: () => void): void {
    this.onScanRequest = callback;
  }

  public onImageSelect(callback: (imageId: string) => void): void {
    this.onImageClick = callback;
  }

  public destroy(): void {
    this.container.remove();
  }
}
