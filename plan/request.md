## Q
목적: 현재 웹페이지의 이미지를 분석하여 실사체에 가까운지,
그림체에 가까운지 score 표시
타겟 사용자: 해당 웹페이지에서 실사체에 가까운 이미지를
검열하는 사이트 관리자
필수 기능
- 사용자가 입력한 크기 이상의 이미지 (기본값 512x512)에 대해
실사체에 가까울수록 1, 그림체에 가까울수록 0표시
- 해당 웹페이지에 있는 모든 이미지 index와 real score, nsfw
score 를 한 눈에 볼 수 있도록 함
- score threshold 기능: real score가 일정 이상인 이미지 표시 및
이동
- 성인 이미지 확률 표시
- 누구나 로그인 없이 웹페이지에서 바로 실행
추가 옵션
- 이미지 및 텍스트를 입력하여 유사한 객체가 있을 확률 표시(ex.
주름치마 입력시 웹페이지에서 이미지 위치 별 포함 확률)
실행 환경: 웹브라우저(chrome, firefox), client VGA 사용
언어: js
UI: 드래그로 이동할 수 있는 반투명 창
구현 예상: 객체 인식, 객체 별 일치율을 미리 학습한 모델 import
등. 만약 js 로 해당 웹페이지에서 바로 실행이 어려우면
huggingface space 에서 여러 모델을 미리 띄워놓고 있다가 js
plugin 혹은 js를 실행하는 plugin을 이용하여 각 이미지를 서버로
요청하는 방식도 가능
방향성: 더 좋은 방식으로 추천 및 진행
### plan
Review your answers

 ● 브라우저 확장 프로그램 vs Userscript 중 어떤 방식을
 선호하시나요?
   → Chrome Extension (권장)
 ● CLIP 모델 크기 (~350MB)가 괜찮으신가요? 첫 실행 시
 다운로드됩니다.
   → 괜찮음 (권장)
 ● 초기 지원 브라우저를 선택해주세요.
   → Chrome 우선 (권장)
 ● 추가 기능 중 우선순위가 높은 것을 선택해주세요.
   → MVP 먼저

계획 파일을 작성했습니다. 주요 내용 요약:

기술 스택:
- Chrome Extension (Manifest V3)
- CLIP (Transformers.js) - Real/Illustration 분류
- NSFWJS - 성인 콘텐츠 탐지
- WebGPU 가속 (WebGL fallback)

구현 단계:
1. 프로젝트 설정 (TypeScript + Webpack)
2. ML 모델 통합 (Offscreen Document에서 실행)
3. 이미지 탐지 및 분석 파이프라인
4. 드래그 가능한 반투명 UI 패널
5. 마무리 및 최적화

MVP 범위: Real Score + NSFW Score 표시, Threshold 필터링, 이미지 위치 이동

───────────────────────────────────────────────────────────────────
Ready to code?

Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
DiffReal - 이미지 실사체/그림체 분석 Chrome Extension

개요

웹페이지의 이미지를 분석하여 실사체(Real) vs 그림체(Illustration)
점수와 NSFW 점수를 표시하는 Chrome Extension

기술 스택

| 구성요소          | 기술                    | 용도
        |
|-------------------|-------------------------|------------------
---------|
| Extension         | Chrome Manifest V3      | 브라우저 확장
        |
| Real/Illustration | Transformers.js + CLIP  | Zero-shot 분류
(~350MB)   |
| NSFW Detection    | NSFWJS + TensorFlow.js  | 성인 콘텐츠 탐지
(~3MB)   |
| GPU 가속          | WebGPU (WebGL fallback) | 클라이언트 GPU
사용       |
| UI                | Vanilla JS + Shadow DOM | 드래그 가능한
반투명 패널 |

아키텍처

[Content Script] <---> [Service Worker] <---> [Offscreen
Document]
    │                       │                       │
 DOM 접근              메시지 라우팅            ML 추론
 UI 렌더링            상태 관리               WebGPU 접근
 이미지 탐지          오프스크린 관리          모델 로딩

파일 구조

diffReal/
├── manifest.json              # MV3 매니페스트
├── package.json               # NPM 의존성
├── webpack.config.js          # 빌드 설정
├── tsconfig.json              # TypeScript 설정
│
├── src/
│   ├── background/
│   │   ├── index.ts           # Service Worker 진입점
│   │   ├── offscreen-manager.ts  # 오프스크린 문서 관리
│   │   └── message-router.ts  # 컨텍스트 간 메시징
│   │
│   ├── offscreen/
│   │   ├── offscreen.html     # 오프스크린 문서
│   │   ├── index.ts           # 오프스크린 진입점
│   │   ├── model-loader.ts    # 모델 초기화 및 캐싱
│   │   ├── nsfw-analyzer.ts   # NSFWJS 래퍼
│   │   ├── clip-analyzer.ts   # CLIP 추론 래퍼
│   │   └── image-processor.ts # 이미지 전처리
│   │
│   ├── content/
│   │   ├── index.ts           # Content Script 진입점
│   │   ├── image-detector.ts  # DOM 이미지 탐지
│   │   ├── floating-panel/
│   │   │   ├── FloatingPanel.ts  # 메인 패널 (드래그)
│   │   │   ├── ImageList.ts   # 이미지 목록
│   │   │   ├── ThresholdSlider.ts  # 필터 슬라이더
│   │   │   └── styles.css     # 패널 스타일
│   │   └── highlight-overlay.ts  # 이미지 하이라이트
│   │
│   ├── popup/
│   │   ├── popup.html         # 설정 UI
│   │   ├── popup.ts           # 설정 로직
│   │   └── popup.css          # 설정 스타일
│   │
│   └── shared/
│       ├── types.ts           # TypeScript 인터페이스
│       ├── constants.ts       # 설정 상수
│       └── messages.ts        # 메시지 타입 정의
│
└── public/
   └── icons/                 # 확장 아이콘 (16, 48, 128px)

구현 단계

Phase 1: 프로젝트 설정 (MVP 기반)

1. npm 프로젝트 초기화 (TypeScript)
2. Webpack 멀티 엔트리 빌드 설정
3. manifest.json 작성 (MV3)
4. 기본 확장 구조 생성

Phase 2: ML 모델 통합

1. Offscreen Document 인프라 구축
2. Transformers.js + CLIP 통합 (WebGPU)
3. NSFWJS + TensorFlow.js 통합
4. IndexedDB 모델 캐싱 구현
5. 로딩 진행률 표시

Phase 3: 이미지 탐지 및 분석

1. DOM 이미지 스캔 (img, background-image, canvas)
2. MutationObserver로 동적 콘텐츠 감지
3. 최소 크기 필터링 (기본 512x512)
4. CLIP Real/Illustration 분류
5. NSFWJS 분류
6. 배치 처리 최적화

Phase 4: UI 구현

1. Shadow DOM 격리 패널
2. 드래그 기능 구현
3. 이미지 목록 (썸네일, 점수)
4. Threshold 슬라이더
5. "이미지로 이동" 기능
6. 이미지 하이라이트 오버레이

Phase 5: 마무리

1. Popup 설정 UI
2. 성능 최적화
3. 에러 처리
4. 테스트

핵심 구현 세부사항

CLIP Zero-Shot 분류 라벨

const REALISM_LABELS = [
 'a real photograph taken with a camera',
 'a photograph of a real person or scene',
 'photorealistic image',
 'digital art illustration',
 'cartoon or anime drawing',
 'computer generated artwork',
 'painting or artistic rendering',
];

분석 결과 타입

interface AnalysisResult {
 realScore: number;      // 0-1 (1=실사체)
 nsfwScore: number;      // 0-1 (성인 콘텐츠 확률)
 nsfwCategories: {
   drawing: number;
   neutral: number;
   sexy: number;
   porn: number;
   hentai: number;
 };
}

UI 패널 구조

+----------------------------------------------------------+
| [=] DiffReal                                   [_] [X]   |
+----------------------------------------------------------+
| 최소 크기: [512] x [512] px                               |
+----------------------------------------------------------+
| Real Score 임계값: [====|======] 0.5                     |
+----------------------------------------------------------+
| #  | 미리보기 | Real | NSFW | 상태                        |
|----|---------|------|------|----------------------------|
| 1  | [thumb] | 0.92 | 0.03 | [이동]                     |
| 2  | [thumb] | 0.15 | 0.01 | [이동]                     |
+----------------------------------------------------------+
| 분석: 15/42 | 모델: Ready | GPU: WebGPU                  |
+----------------------------------------------------------+

주요 파일 (구현 우선순위)

1. /workspaces/diffReal/manifest.json - 확장 매니페스트
2. /workspaces/diffReal/src/offscreen/model-loader.ts - 모델
로딩/캐싱
3. /workspaces/diffReal/src/offscreen/clip-analyzer.ts -
Real/Illustration 분류
4. /workspaces/diffReal/src/offscreen/nsfw-analyzer.ts - NSFW
탐지
5.
/workspaces/diffReal/src/content/floating-panel/FloatingPanel.ts
- UI 패널
6. /workspaces/diffReal/src/content/image-detector.ts - 이미지
탐지
7. /workspaces/diffReal/src/background/offscreen-manager.ts -
오프스크린 관리

의존성

{
 "dependencies": {
   "@huggingface/transformers": "^3.x",
   "@tensorflow/tfjs": "^4.x",
   "nsfwjs": "^2.x"
 },
 "devDependencies": {
   "typescript": "^5.x",
   "webpack": "^5.x",
   "webpack-cli": "^5.x",
   "ts-loader": "^9.x",
   "copy-webpack-plugin": "^12.x"
 }
}

추후 확장 (Phase 2+)

- 텍스트 검색 (CLIP text-to-image)
- 이미지 유사도 검색
- 배치 내보내기 (CSV/JSON)
- Firefox 지원