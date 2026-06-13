# 프로젝트 노트 (누적 작업 로그 · 피드백)

작업 세션마다 "목표 → 한 일 → 결과/검증 → 다음/미해결"을 시간순으로 누적한다.
최신 항목이 위로 온다.

---

## 2026-06-13 — Phase 0 개발 인프라 개편 (Jisung_01 브랜치)

### 배경 / 사용자 요청
- 단일 HTML 파일 관리의 문제 진단 + 파일 분리
- 개발 언어/방식 제안 (TS/React/Next 등)
- 버전·지침·작업기록 관리 방식 정립
- 기능: 타입(폰트) 직접 익스포트 (정적 OTF / 가변 TTF, A→B 애니메이션)
- UI: ① 타입건틀렛식 화면 직접 타이핑 ② Electron 데스크탑(웹과 동시 유지)
  ③ 주요 장면을 Figma에 수정가능 버전으로 재현 + 양방향 연동
  (Figma 파일: lWFd1we5CA40PRk5e8YJHV, node 0:1)

### 확정된 방향 (ADR 참조)
- 스택: **Vite + TypeScript(점진), React 없음** (ADR-001)
- 데스크탑: **Electron** (ADR-002)
- 분할: **안전 점진 방식** (ADR-003)
- 진행: 사용자 수면 중 자율 진행, 단계마다 커밋+`Jisung_01` 푸시, `main`·PR은 안 건드림. 아침 리뷰.

### 한 일 / 결과
- **P0-1** ✅ 툴링 스캐폴드(Vite 6.4.3 / TS 5.7 / Biome) + `npm install`. 코드 무변경으로
  기존 index.html이 Vite에서 빌드·서빙됨 확인. (커밋 `688443d`)
- **P0-2** ✅ 인라인 `<script>` 3블록 → `src/main.js`(12,435줄) 단일 모듈 추출.
  index.html 13,096→667줄. **실제 Chrome 검증**: 콘솔 에러 0, 입력 시 캔버스 5120×2526
  리사이즈, 배경색·한글 글자(8,917px)·HUD·텍스트입력·푸터 정상. 빌드 263KB(gzip 91KB).
  (커밋 `85c8506`)
- **P0-5** 🔄 문서화: CLAUDE.md / CHANGELOG.md / DECISIONS.md / PROJECT_NOTES.md 작성.

### 검증 환경 메모 (중요)
- Claude **Preview MCP는 이 환경에서 dev 서버 기동 실패** (Claude.app disclaimer 래핑 문제).
  → Bash `npm run dev`(run_in_background) + **Chrome MCP**로 검증하는 워크플로우 확립. CLAUDE.md에 기록.
- `pkill -f vite` 금지(다른 관리 서버까지 죽임) — PID 지정 kill만.

### 한 일 / 결과 (이어서 — 야간 자율 진행 전체)
- **P0-6** ✅ GitHub Pages 빌드-배포 Action(휴면). (커밋 `72f93b8`)
- **P1** ✅ Electron 듀얼 빌드. electron/main.cjs + dev/start/build:desktop. 오프스크린
  capturePage로 dist 렌더 검증(한글·HUD·푸터 정상). (커밋 `0aa017f`)
- **P2** 🟡 타이핑 UI — 타당성 확인(앱이 이미 라이브 렌더) + 비파괴 프로토타입(src/typing-mode.js,
  백틱/Esc) + docs/TYPING_MODE.md(설계 옵션 3). 최종 UX는 사용자와 확정 예정. (커밋 `d93d7d3`)
- **P3** ✅ 폰트 익스포트(정적 OTF). src/font/build-font.js(순수)+src/font-export.js(Ctrl/Cmd+Shift+F).
  node 단위테스트 + 라이브 "뭉친 한글"→4글리프 OTF(OTTO) 검증. 가변 TTF는 설계만(docs/FONT_EXPORT.md).
  (커밋 `c115bf7`)
- **P4** 🟡 Figma 연동 — 연결·권한·파일구조(빈 "UI" 페이지) 확인, 디자인 토큰 추출, 워크플로우+재현
  계획 문서화(docs/FIGMA_WORKFLOW.md). 실제 Figma 빌드는 디자이너 방향 확인 후 협업으로.

### 다음 / 미해결 (아침 리뷰 후)
- **P4 Figma 빌드**: 어느 장면부터·어느 충실도로 만들지 정하고 use_figma 로 시작 (figma-use 스킬 필요).
- **P2 타이핑 UI 최종 UX**: 옵션 1(모드 토글)/2(상시+보조키)/3(풀스크린) 중 선택.
- **P3 가변 TTF**: 토폴로지-안정 기하(합집합 off) + fontTools(varLib) 파이프라인.
- **P0-4 추가 파일분할**: main.js 기능 클러스터 분리 (typeof 전역패턴 179곳 주의 — 협업 권장).
- 낮은 우선순위: 폰트 글로벌 메트릭 통일, TTF(쿼드라틱) 출력, 빈입력 첫로드 기본문구 타이밍(원본과 동일·회귀 아님 확인됨).
