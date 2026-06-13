# CLAUDE.md — 뭉친 한글 개발 지침

이 파일은 Claude(및 사람 기여자)가 이 저장소에서 작업할 때 먼저 읽는 안내서다.
프로젝트 개요·아키텍처·빌드/실행/검증법·컨벤션을 담는다.

## 프로젝트

**뭉친 한글 (Clumped Hangul)** — 한글 모아쓰기를 물리 시뮬레이션으로 구현한 인터랙티브 웹 앱.
한 글자가 하나의 중심을 가지고, 자음·모음 획들이 중앙으로 끌려가며 서로 밀거나
파고들어 그 글자만의 균형을 찾는다.

- 라이브: https://clumped-hangul.com (GitHub Pages, `main` 브랜치의 루트 `index.html`)
- 라이선스: MIT
- 현재 버전: v1.11 (코드 주석엔 v1.12b 작업 흔적 있음)

## 아키텍처

### 파일 구조 (Phase 0 리팩터링 진행 중)
- `index.html` — HTML 셸 + 인라인 CSS. `<script type="module" src="/src/main.js">`로 앱 로드.
- `src/main.js` — 앱 전체 로직 (현재 ~12,400줄 단일 모듈). 기능별 모듈로 점진 분리 중.
  - 향후 목표 구조: `src/{analytics,jamo/,moimkkol/,physics/,flow,render/,export/,ui/,data/}`
- 외부 의존성(CDN): QRious(QR 생성), Microsoft Clarity(분석), Google AdSense(승인 대기·주석처리).
- 빌드: Vite. `dev`(HMR) / `build`(dist/ 단일 페이지, Pages 호환).

### 핵심 데이터 모델
- `world.bodies[]` — 각 body가 한 음절(글자).
  - `body.nodes[]` — `{x, y, ...}` 좌표점. 물리 시뮬레이션으로 움직임.
  - `body.edges[]` — `{a, b, transparent?}` 두 노드 인덱스를 잇는 획(선).
- `PARAMS` — 점 간격/크기(`nodeR`), 획 두께(`lineW`), 물리값(중력·반발·감쇠), 자석 힘 등.
- 글자 렌더 = 획(둥근 캡 선분=캡슐) + 노드(둥근 사각/원)를 그림.
  - **이 모델이 폰트 익스포트의 기반**: 획·노드를 닫힌 윤곽선으로 변환 → opentype.js.
- 자모 결합: 쌍자음(cho2↔cho1)/합성중성(jung1↔jung2)/겹받침(jong2↔jong1)은 한 박스가 대표하고 미러링.
- 본드(획 잇기): 같은 글자 내 자모 끝점을 끌어다 붙이면 결합. 같은 자모를 가진 모든 글자에 자동 적용.

### 초기화 흐름
- `src/main.js`는 `type=module`이라 DOM 파싱 후 실행되지만, 실제 DOM 초기화는 내부
  `document.addEventListener('DOMContentLoaded', ...)`(구 index.html 7891행)에 묶여 있어 타이밍 안전.
- 빈 입력 상태에선 캔버스가 기본 크기(300×150)로 대기하다가, 입력/리빌드 시 `resizeCanvas()`가
  뷰포트×dpr로 키운다. (그래서 첫 로드 직후 픽셀검사가 비어 보일 수 있음 — 정상)

## 빌드 / 실행 / 검증

```bash
npm install        # 의존성 (Vite, TypeScript, Biome)
npm run dev        # 개발 서버 (http://localhost:5173, HMR)
npm run build      # 프로덕션 빌드 → dist/
npm run preview    # 빌드 결과 미리보기
npm run typecheck  # tsc --noEmit (점진적 TS 전환용)
npm run lint       # biome check src
npm run format     # biome format --write src

# 데스크탑 (Electron) — 같은 Vite 번들을 웹/데스크탑이 공유 (진입점 electron/main.cjs)
npm run dev:desktop    # Vite dev + Electron 창 (HMR). ELECTRON_START_URL 로 localhost:5173 로드
npm run start:desktop  # 빌드된 dist/ 를 Electron 창으로 (vite build 선행 필요)
npm run build:desktop  # vite build + electron-builder → release/ 에 dmg/nsis/AppImage
```

### ⚠️ 앱 동작 검증 방법 (중요)
이 환경에서 **Claude Preview MCP(`preview_start`)는 dev 서버 기동에 실패**한다
(Claude.app `disclaimer` 헬퍼 래핑 문제로 포트 바인딩 안 됨). 대신:

1. **Bash로 직접** `npm run dev`를 **`run_in_background: true`**로 띄운다 (harness가 유지).
2. `curl -s --retry 6 --retry-connrefused http://localhost:5173/` 로 서버 기동 확인.
3. **Chrome MCP**(`mcp__Claude_in_Chrome__*`)로 검증:
   - `navigate` → `http://localhost:5173/`
   - `read_console_messages {onlyErrors:true}` → 런타임 에러 확인
   - `javascript_tool`로 캔버스 픽셀 검사 (배경색·그려진 픽셀 수). 빈 입력이면 textarea에
     값 넣고 `input` 이벤트 디스패치 → 캔버스가 리사이즈/렌더되는지 확인.
   - `computer {action:screenshot}` 로 시각 확인.
4. **절대 `pkill -f vite` 쓰지 말 것** — 다른 관리 서버까지 죽인다. PID 지정 kill만.

## 컨벤션

- **커밋 메시지: 한국어.** 제목 한 줄 + 본문(무엇을·왜). 기존 스타일 따름.
- **버전 태그 주석**: 함수/블록 위에 `// [v1.xx] 설명` 으로 변경 이력 추적 (기존 관습 유지).
- **동작 보존 원칙**: 리팩터링은 동작을 바꾸지 않는다. 큰 구조 변경은 단계마다 커밋 + 위 검증.
- **TypeScript**: `allowJs`로 느슨하게 시작. 모듈을 하나씩 `.ts`로 전환하며 타입 부여.
  React는 도입하지 않음(canvas/렌더 루프 앱이라 부적합).
- **브랜치**: 기능 브랜치 → PR → `main`. `main`은 라이브 사이트라 직접 커밋 금지.
- **소통(설명) 규칙**: 개발/전문 용어는 **처음 나올 때 항상 쉽게 풀어 설명**한다(초보·바이브코딩
  사용자 기준). 한 번 설명한 건 반복할 필요 없음. 새 개념은 [docs/CONCEPTS.md](docs/CONCEPTS.md)에 한 줄 추가.
- **세션 기록**: 매 세션(또는 주요 진척)마다 [docs/SESSION_LOG.md](docs/SESSION_LOG.md)(대화 핵심)·
  [docs/PROJECT_NOTES.md](docs/PROJECT_NOTES.md)(작업 로그)·[docs/CONCEPTS.md](docs/CONCEPTS.md)(용어)를 갱신한다.
  각 기록 끝엔 "NEXT(재개 시 바로 할 것)"를 남겨 크레딧 소진/세션 전환 후에도 즉시 이어갈 수 있게 한다.

## 배포
- 현재: `main`의 루트 `index.html`을 GitHub Pages가 서빙 (CNAME=clumped-hangul.com).
- Phase 0 이후: Vite 빌드(dist/)를 Action으로 Pages 배포 예정. main 머지 시 전환.

## 로드맵 / 작업 기록
- 결정 기록: [docs/DECISIONS.md](docs/DECISIONS.md)
- 누적 작업 로그·피드백: [docs/PROJECT_NOTES.md](docs/PROJECT_NOTES.md)
- 변경 이력: [CHANGELOG.md](CHANGELOG.md)
