# DiffReal

웹페이지의 이미지를 분석하여 실사체(Real) vs 그림체(Illustration) 점수와 NSFW 점수를 표시하는 Chrome Extension

## 주요 기능

| 기능 | 설명 |
|------|------|
| Real Score | 0-1 (1=실사체, 0=그림체) |
| NSFW Score | 0-1 (성인 콘텐츠 확률) |
| Min Size | 최소 이미지 크기 필터 (기본 512x512) |
| Threshold | Real Score 임계값 필터링 |
| Go 버튼 | 해당 이미지로 스크롤 이동 + 하이라이트 |

## 기술 스택

| 구성요소 | 기술 | 용도 |
|----------|------|------|
| Extension | Chrome Manifest V3 | 브라우저 확장 |
| Real/Illustration | Transformers.js + CLIP | Zero-shot 분류 (~350MB) |
| NSFW Detection | NSFWJS + TensorFlow.js | 성인 콘텐츠 탐지 (~3MB) |
| GPU 가속 | WebGPU (WebGL fallback) | 클라이언트 GPU 사용 |
| UI | Shadow DOM | 드래그 가능한 반투명 패널 |

## 설치 방법

### 1. 빌드

```bash
npm install    # 의존성 설치
npm run build  # 프로덕션 빌드
```

### 2. Chrome에 설치

1. Chrome에서 `chrome://extensions` 열기
2. 우측 상단 "개발자 모드" 활성화
3. "압축 해제된 확장 프로그램을 로드합니다" 클릭
4. `dist` 폴더 선택

## 사용 방법

1. **패널 열기**: 확장 아이콘 클릭 → "Open Panel" 버튼
2. **이미지 스캔**: "Scan Page" 버튼 클릭
3. **결과 확인**: 각 이미지의 Real/NSFW 점수 확인
4. **이미지 이동**: "Go" 버튼으로 해당 이미지로 스크롤

### UI 패널

```
+----------------------------------------------------------+
| [=] DiffReal                                   [_] [X]   |
+----------------------------------------------------------+
| Min Size: [512] x [512] px                               |
+----------------------------------------------------------+
| Real Threshold: [====|======] 0.50                       |
+----------------------------------------------------------+
| #  | Image   | Real | NSFW | Status | Action             |
|----|---------|------|------|--------|---------------------|
| 1  | [thumb] | 0.92 | 0.03 | done   | [Go]               |
| 2  | [thumb] | 0.15 | 0.01 | done   | [Go]               |
+----------------------------------------------------------+
| Analyzed: 2/2 | CLIP: Ready | NSFW: Ready | WebGPU      |
+----------------------------------------------------------+
```

## 개발

```bash
npm run dev    # 개발 모드 (watch)
npm run build  # 프로덕션 빌드
npm run clean  # dist 폴더 삭제
```

### 프로젝트 구조

```
diffReal/
├── dist/                        # 빌드 출력 (Chrome에서 로드)
├── src/
│   ├── background/              # Service Worker
│   │   ├── index.ts             # 진입점
│   │   ├── offscreen-manager.ts # Offscreen 문서 관리
│   │   └── message-router.ts    # 메시지 라우팅
│   ├── content/                 # Content Script
│   │   ├── index.ts             # 진입점
│   │   ├── image-detector.ts    # DOM 이미지 탐지
│   │   └── floating-panel/      # UI 컴포넌트
│   ├── offscreen/               # ML 추론 (WebGPU 접근)
│   │   ├── index.ts             # 진입점
│   │   ├── model-loader.ts      # 모델 로딩/캐싱
│   │   ├── clip-analyzer.ts     # Real/Illustration 분류
│   │   └── nsfw-analyzer.ts     # NSFW 탐지
│   ├── popup/                   # 확장 팝업 설정
│   └── shared/                  # 공통 타입/상수
├── public/icons/                # 확장 아이콘
├── package.json
├── tsconfig.json
├── webpack.config.js
└── manifest.json
```

## 아키텍처

```
[Content Script] <---> [Service Worker] <---> [Offscreen Document]
      │                       │                       │
   DOM 접근              메시지 라우팅            ML 추론
   UI 렌더링            상태 관리               WebGPU 접근
   이미지 탐지          오프스크린 관리          모델 로딩
```

## 참고 사항

- 첫 실행 시 CLIP 모델 (~350MB)을 다운로드합니다
- 이후 브라우저에 캐시되어 빠르게 로드됩니다
- WebGPU 지원 브라우저에서 최적의 성능을 발휘합니다
- WebGPU 미지원 시 WebGL로 자동 폴백됩니다

## 추후 확장 예정

- [ ] 텍스트 검색 (CLIP text-to-image)
- [ ] 이미지 유사도 검색
- [ ] 배치 내보내기 (CSV/JSON)
- [ ] Firefox 지원

## 라이선스

MIT
