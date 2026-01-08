#!/usr/bin/env node
/**
 * diffReal CLI
 * URL을 입력하면 페이지의 이미지를 분석하여 realistic/illustration 점수 표시
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ImageClassifier } from './classifier.js';
import readline from 'readline';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Enable stealth mode to bypass Cloudflare
puppeteer.use(StealthPlugin());

// Platform detection
const isWindows = process.platform === 'win32';

// Configuration
const CONFIG = {
  minImageSize: 300,  // Default minimum image size (width & height)
  userDataDir: path.join(os.homedir(), '.diffreal', 'browser-data'),
  headless: true,
};

class DiffRealCLI {
  constructor() {
    this.classifier = new ImageClassifier();
    this.browser = null;
  }

  async initialize() {
    console.log('\n🔄 모델 로딩 중...');
    await this.classifier.initialize();
    console.log(`✅ 모델 로드 완료 (${this.classifier.mode})\n`);
  }

  async launchBrowser() {
    if (this.browser) return this.browser;

    // Ensure user data dir exists
    fs.mkdirSync(CONFIG.userDataDir, { recursive: true });

    console.log('🌐 브라우저 시작 중...');

    // Platform-specific browser args
    const browserArgs = [
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ];

    // Linux-specific args
    if (!isWindows) {
      browserArgs.push('--no-sandbox', '--disable-setuid-sandbox');
    }

    this.browser = await puppeteer.launch({
      headless: CONFIG.headless,
      userDataDir: CONFIG.userDataDir,
      args: browserArgs
    });

    console.log('✅ 브라우저 시작됨');
    console.log(`   (세션 저장 위치: ${CONFIG.userDataDir})\n`);
    return this.browser;
  }

  async analyzeUrl(url) {
    const browser = await this.launchBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      console.log(`📄 페이지 로딩: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      // Scroll to load lazy images
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 500;
          const timer = setInterval(() => {
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= document.body.scrollHeight) {
              clearInterval(timer);
              window.scrollTo(0, 0);
              resolve();
            }
          }, 100);
        });
      });

      // Wait for images to load
      await new Promise(r => setTimeout(r, 3000));

      console.log('🔍 이미지 검색 중...');
      const images = await this.extractImages(page);

      if (images.length === 0) {
        console.log('⚠️  분석할 이미지가 없습니다.\n');
        await page.close();
        return [];
      }

      console.log(`📷 ${images.length}개 이미지 발견\n`);

      const results = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        process.stdout.write(`[${i + 1}/${images.length}] 분석 중... `);

        try {
          const result = await this.classifier.classify(img.data);
          results.push({
            index: i + 1,
            src: img.src,
            width: img.width,
            height: img.height,
            ...result
          });

          const scoreBar = this.createScoreBar(result.score);
          const label = result.score > 0.5 ? '\x1b[32mREAL\x1b[0m' : '\x1b[33mAI\x1b[0m';
          console.log(`${scoreBar} ${result.score.toFixed(3)} ${label}`);
        } catch (error) {
          console.log(`❌ 실패: ${error.message}`);
        }
      }

      this.printSummary(results);
      await page.close();
      return results;

    } catch (error) {
      console.error(`❌ 에러: ${error.message}`);
      await page.close();
      throw error;
    }
  }

  async extractImages(page) {
    const minSize = CONFIG.minImageSize;

    const imageData = await page.evaluate(async (minSize) => {
      const images = [];
      const seen = new Set();

      // Regular img elements
      const imgElements = document.querySelectorAll('img');
      for (const img of imgElements) {
        const src = img.src || img.dataset.src || img.dataset.lazySrc;
        if (!src || seen.has(src)) continue;
        if (src.startsWith('data:image/svg')) continue;

        // For lazy-loaded images, check actual dimensions or use attributes
        const width = img.naturalWidth || parseInt(img.getAttribute('width')) || 0;
        const height = img.naturalHeight || parseInt(img.getAttribute('height')) || 0;

        if (width >= minSize && height >= minSize) {
          seen.add(src);
          images.push({ src, width, height });
        } else if (src && !img.naturalWidth) {
          // Image not loaded yet, include if src exists
          seen.add(src);
          images.push({ src, width: 0, height: 0 });
        }
      }

      // Also check for background images in content area
      const contentArea = document.querySelector('.article-content, .content, article, main, .fr-view');
      if (contentArea) {
        const bgElements = contentArea.querySelectorAll('[style*="background-image"]');
        for (const el of bgElements) {
          const match = el.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
          if (match && match[1] && !seen.has(match[1])) {
            seen.add(match[1]);
            images.push({ src: match[1], width: 300, height: 300 });
          }
        }
      }

      console.log(`[Debug] Found ${images.length} images on page`);
      return images;
    }, minSize);

    // Fetch each image with page context (cookies/session)
    const results = [];
    for (const img of imageData) {
      try {
        const data = await page.evaluate(async (src) => {
          try {
            const response = await fetch(src, { credentials: 'include' });
            if (!response.ok) return null;
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            return null;
          }
        }, img.src);

        if (data) {
          results.push({ ...img, data });
        }
      } catch (e) {
        // Skip
      }
    }

    return results;
  }

  createScoreBar(score, length = 20) {
    const filled = Math.round(score * length);
    const empty = length - filled;
    const color = score > 0.5 ? '\x1b[32m' : '\x1b[33m';
    return `${color}[${'█'.repeat(filled)}${'░'.repeat(empty)}]\x1b[0m`;
  }

  printSummary(results) {
    const successful = results.filter(r => !r.error);
    const realistic = successful.filter(r => r.score > 0.5);
    const aiImage = successful.filter(r => r.score <= 0.5);

    console.log('\n' + '═'.repeat(60));
    console.log('📊 분석 결과 요약');
    console.log('═'.repeat(60));
    console.log(`총 이미지: ${results.length}개`);
    console.log(`\x1b[32mRealistic: ${realistic.length}개\x1b[0m`);
    console.log(`\x1b[33mAI Image: ${aiImage.length}개\x1b[0m`);

    if (successful.length > 0) {
      const avgScore = successful.reduce((sum, r) => sum + r.score, 0) / successful.length;
      console.log(`평균 점수: ${avgScore.toFixed(3)}`);

      // Show highest score image
      const highest = successful.reduce((max, r) => r.score > max.score ? r : max, successful[0]);
      console.log('─'.repeat(60));
      console.log(`🏆 최고 점수 이미지:`);
      console.log(`   점수: \x1b[32m${highest.score.toFixed(3)}\x1b[0m`);
      console.log(`   URL: ${highest.src}`);
    }
    console.log('═'.repeat(60) + '\n');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async runInteractive() {
    await this.initialize();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('═'.repeat(60));
    console.log('  diffReal - 이미지 Realistic/Illustration 분류기');
    console.log('═'.repeat(60));
    console.log('URL을 입력하면 해당 페이지의 이미지를 분석합니다.');
    console.log('로그인이 필요한 사이트는 먼저 headless off 후 로그인하세요.');
    console.log('\n명령어:');
    console.log('  quit       - 종료');
    console.log('  headless   - 헤드리스 모드 토글 (현재: ON)');
    console.log('  login      - 브라우저 열어서 로그인 (30초 대기)');
    console.log(`  size <N>   - 최소 이미지 크기 설정 (현재: ${CONFIG.minImageSize}px)`);
    console.log('');

    const prompt = () => {
      rl.question('\x1b[36mURL>\x1b[0m ', async (input) => {
        const trimmed = input.trim();

        if (!trimmed) {
          prompt();
          return;
        }

        if (trimmed === 'quit' || trimmed === 'exit' || trimmed === 'q') {
          console.log('\n👋 종료합니다.\n');
          await this.close();
          rl.close();
          process.exit(0);
        }

        if (trimmed === 'headless') {
          CONFIG.headless = !CONFIG.headless;
          console.log(`헤드리스 모드: ${CONFIG.headless ? 'ON' : 'OFF'}`);
          if (this.browser) {
            await this.close();
            console.log('(브라우저 재시작됨)\n');
          }
          prompt();
          return;
        }

        if (trimmed === 'login') {
          console.log('\n🔐 로그인 모드 - 브라우저를 열고 30초 동안 로그인하세요...');
          const oldHeadless = CONFIG.headless;
          CONFIG.headless = false;
          if (this.browser) await this.close();

          const browser = await this.launchBrowser();
          const page = await browser.newPage();
          await page.goto('about:blank');

          console.log('로그인할 사이트 URL을 브라우저에 직접 입력하세요.');
          console.log('30초 후 자동으로 닫힙니다...\n');

          await new Promise(r => setTimeout(r, 30000));
          await page.close();
          CONFIG.headless = oldHeadless;
          console.log('✅ 로그인 세션이 저장되었습니다.\n');
          prompt();
          return;
        }

        if (trimmed.startsWith('size ') || trimmed.startsWith('size=')) {
          const sizeStr = trimmed.replace(/^size[= ]/, '');
          const size = parseInt(sizeStr, 10);
          if (isNaN(size) || size < 10) {
            console.log('❌ 유효한 크기를 입력하세요 (예: size 300)\n');
          } else {
            CONFIG.minImageSize = size;
            console.log(`✅ 최소 이미지 크기: ${size}px\n`);
          }
          prompt();
          return;
        }

        let url = trimmed;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }

        try {
          await this.analyzeUrl(url);
        } catch (error) {
          console.error(`\n❌ 분석 실패: ${error.message}\n`);
        }

        prompt();
      });
    };

    prompt();
  }
}

// Parse command line arguments
function parseArgs(args) {
  const result = { url: null, size: null, help: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-s' || arg === '--size') {
      result.size = parseInt(args[++i], 10);
    } else if (arg.startsWith('--size=')) {
      result.size = parseInt(arg.split('=')[1], 10);
    } else if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else if (!arg.startsWith('-')) {
      result.url = arg;
    }
  }
  return result;
}

function showHelp() {
  console.log(`
diffreal - 이미지 Realistic/Illustration 분류기

사용법:
  diffreal [options] [url]

옵션:
  -s, --size <N>   최소 이미지 크기 (기본값: 300px)
  -h, --help       도움말 표시

예시:
  diffreal https://example.com
  diffreal --size 100 https://example.com
  diffreal -s 300 https://pinterest.com/search/pins/?q=cat

인터랙티브 모드:
  diffreal
`);
}

// Main
const cli = new DiffRealCLI();
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  showHelp();
  process.exit(0);
}

if (args.size && args.size >= 10) {
  CONFIG.minImageSize = args.size;
}

if (args.url) {
  // Single URL mode
  console.log(`\n⚙️  설정: 최소 이미지 크기 = ${CONFIG.minImageSize}px\n`);
  cli.initialize().then(async () => {
    try {
      let url = args.url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      await cli.analyzeUrl(url);
    } finally {
      await cli.close();
    }
  });
} else {
  // Interactive mode
  cli.runInteractive();
}
