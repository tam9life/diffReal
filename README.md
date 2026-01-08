# diffReal

웹페이지의 이미지를 분석하여 **realistic (1)** 또는 **AI-generated (0)** 점수를 표시하는 CLI 도구입니다.

## 기능

- 웹페이지의 이미지를 자동으로 감지하고 분석 (기본: 300x300px 이상)
- 로컬 AI 추론 (transformers.js) - API 키 불필요
- 최고 점수 이미지 표시
- 이미지 크기 임계값 설정 가능
- 브라우저 세션 유지 (로그인 필요 사이트 지원)
- Cloudflare 우회 (stealth 모드)
- Windows, macOS, Linux 지원

## 설치

### npm 글로벌 설치 (권장)
```bash
npm install -g diffreal-cli
```

### tgz 파일로 설치 (어디서나 diffreal 명령 사용)
```bash
npm install -g ./dist/diffreal-cli-1.0.0.tgz
```

### 소스에서 설치
```bash
cd cli
npm install -g .
```

## 사용법

### 명령줄
```bash
# 기본 사용
diffreal https://example.com

# 이미지 크기 임계값 설정 (최소 100px 이상만 분석)
diffreal --size 100 https://example.com
diffreal -s 300 https://pinterest.com/search/pins/?q=cat

# 도움말
diffreal --help
```

### 인터랙티브 모드
```bash
diffreal
```

### 인터랙티브 명령어

| 명령어 | 설명 |
|--------|------|
| `<URL>` | 해당 페이지 이미지 분석 |
| `size <N>` | 최소 이미지 크기 설정 (예: `size 100`) |
| `login` | 브라우저 열어서 로그인 (30초 대기) |
| `headless` | 헤드리스 모드 ON/OFF 토글 |
| `quit` | 종료 |

## 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-s, --size <N>` | 최소 이미지 크기 (픽셀) | 300 |
| `-h, --help` | 도움말 표시 | - |

## 점수 해석

- **점수 > 0.5**: REAL (사실적 사진) - 녹색 표시
- **점수 <= 0.5**: AI (AI 생성 이미지) - 주황색 표시

## 출력 예시

```
📷 25개 이미지 발견

[1/25] 분석 중... [████████░░░░░░░░░░░░] 0.397 AI
[2/25] 분석 중... [███████████░░░░░░░░░] 0.569 REAL
...

════════════════════════════════════════════════════════════
📊 분석 결과 요약
════════════════════════════════════════════════════════════
총 이미지: 25개
Realistic: 5개
AI Image: 20개
평균 점수: 0.392
────────────────────────────────────────────────────────────
🏆 최고 점수 이미지:
   점수: 0.892
   URL: https://example.com/image.jpg
════════════════════════════════════════════════════════════
```

## 로그인 필요 / Cloudflare 사이트

로그인이 필요하거나 Cloudflare 보호가 있는 사이트:

```bash
diffreal
# URL> headless     # 헤드리스 모드 OFF
# URL> login        # 브라우저 열림 - 30초 내 로그인/캡차 해결
# 세션 자동 저장됨
# URL> https://arca.live/b/aiartreal/158431018
```

### 세션 저장 위치
- **Windows**: `%USERPROFILE%\.diffreal\browser-data`
- **macOS/Linux**: `~/.diffreal/browser-data`

## 플랫폼별 참고사항

### Windows
- **Windows Terminal** 또는 **PowerShell** 사용 권장 (이모지/컬러 지원)
- 첫 실행 시 Chrome 자동 다운로드
- 문자 깨짐 시: `chcp 65001` 실행 후 시작

### macOS / Linux
- 별도 설정 없이 바로 사용 가능
- 첫 실행 시 Chrome 자동 다운로드

## 요구사항

- Node.js >= 18.0.0
- 디스크 공간 ~300MB (Chrome + 모델)

## 기술 스택

- **모델**: [Deep-Fake-Detector-v2-Model-ONNX](https://huggingface.co/onnx-community/Deep-Fake-Detector-v2-Model-ONNX) (ViT 기반, 92% 정확도)
- **추론**: transformers.js (로컬 CPU)
- **브라우저 자동화**: Puppeteer + Stealth Plugin
- **플랫폼**: Windows, macOS, Linux

## 프로젝트 구조

```
diffReal/
├── cli/                    # CLI 소스
│   ├── index.js            # 메인 CLI
│   ├── classifier.js       # 이미지 분류기
│   ├── package.json
│   └── README.md
├── dist/                   # 배포 파일
│   └── diffreal-cli-x.x.x.tgz
└── README.md
```

## 문제 해결

### Windows에서 Chrome 찾기 실패
```bash
npx puppeteer browsers install chrome
```

### Cloudflare 계속 차단
1. `headless` 실행하여 헤드리스 모드 OFF
2. `login` 실행하여 브라우저 열기
3. 사이트 접속 후 캡차 수동 해결
4. 30초 대기 후 세션 저장
5. URL 다시 입력

### 이미지가 너무 적게 발견됨
크기 임계값 낮추기:
```bash
diffreal --size 50 https://example.com
```

### 첫 실행이 느림
첫 실행 시 다운로드:
1. Chrome 브라우저 (~150MB)
2. AI 모델 (~90MB)

이후 실행은 빠릅니다.

## 라이선스

MIT
