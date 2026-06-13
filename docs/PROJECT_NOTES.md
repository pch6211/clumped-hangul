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

### 다음 / 미해결
- P0-4: 기능 클러스터를 main.js에서 하나씩 분리 (analytics·data부터). 깊이 얽힌 건 문서화 후 보류.
- P0-6: GitHub Pages 빌드-배포 Action.
- P1: Electron 듀얼 빌드 → P2: 타이핑 UI → P3: 폰트 익스포트 → P4: Figma 재현.
- 확인 필요(낮은 우선순위): 빈 입력 첫 로드 시 기본 문구 렌더 타이밍이 원본과 동일한지 A/B 비교.
