# 변경 이력 (Changelog)

이 프로젝트의 주요 변경을 기록한다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/),
버전은 [유의적 버전](https://semver.org/lang/ko/)을 따른다.

## [Unreleased] — Jisung_01 브랜치 (개발 인프라 개편)

### 추가
- 빌드 툴링: **Vite + TypeScript(점진) + Biome** 도입 (`package.json`, `vite.config.ts`,
  `tsconfig.json`, `biome.json`).
- 개발 지침·기록 문서: `CLAUDE.md`, `CHANGELOG.md`, `docs/DECISIONS.md`, `docs/PROJECT_NOTES.md`.
- `.claude/launch.json` (로컬 dev 서버 프리뷰 설정), `.gitignore`, `.editorconfig`.
- **Electron 데스크탑 듀얼 빌드**: `electron/main.cjs` + `dev:desktop`/`start:desktop`/`build:desktop`
  스크립트. 같은 Vite 번들을 웹·데스크탑이 공유. 오프스크린 capturePage로 렌더 검증 완료.
- **직접 타이핑 모드 프로토타입**: `src/typing-mode.js` (백틱 진입/Esc 종료). docs/TYPING_MODE.md.
- **폰트 익스포트 (정적 OTF)**: `src/font/build-font.js`(순수 빌더) + `src/font-export.js`
  (Ctrl/Cmd+Shift+F). 획→캡슐·노드→둥근사각 합집합 → opentype.js OTF. 라이브 4글리프
  생성 검증(OTTO). docs/FONT_EXPORT.md. 가변 TTF는 설계만(미구현).
- 의존성: opentype.js, polygon-clipping (폰트 빌드는 지연 import 로 별도 청크 분리).

### 변경
- **모노리식 `index.html`(13,096줄) → 모듈 분리**: 인라인 `<script>` 3블록을
  `src/main.js`(단일 모듈)로 추출. `index.html`은 667줄(HTML 셸+CSS)로 축소.
  동작은 그대로 보존 (실제 브라우저 검증 완료).
- 빌드 산출물이 263KB(gzip 91KB)로 번들·미니파이됨 (기존 729KB raw).

### 알려진 이슈
- `esbuild`(Vite dev 의존성) 권고 GHSA-gv7w-rqvm-qjhr — 악의적 `NPM_CONFIG_REGISTRY`
  환경에서만 악용되는 dev 전용 건. 수정 시 vite@8(breaking)이라 보류. 실사용 위험 낮음.

---

## [1.11] — 2026-05-23
- ㅅ↔ㅅ 결합 교점에 ㅗ를 새로 붙일 수 있게 됨
- 자모별 골격 슬라이더가 6개로 늘어남
- 임의 획 추가 분배가 자연스러워짐, 글자 수 많을수록 분할 노드 수 자동 감소
- 합성중성 ㅐㅒㅔㅖ가 쌍자음처럼 처리됨
- 편집창 새 노드도 호버·자석 본드 후보로 즉시 잡힘
- 획 중간 노드 삭제해도 양 이웃 자동 연결로 획 유지, 이어그리기 중 `Del` 삭제
- 노드 우클릭 메뉴에 투명/불투명 추가, 노드 자동 투명화 폐지
- 모바일 전용 UI 폐기, 길게 탭(0.5s)=우클릭
- 의견 보내기가 메일 클라이언트 없이 동작 (Umami 커스텀 이벤트)

## [1.10]
- 쌍자음·겹받침·합성모음을 단독 입력해도 내부 자모끼리 본드 결합 가능
- 한 획에 여러 획 동시 결합, 접합점 드래그 시 함께 끌려옴
- 한 글자에서 만든 본드가 같은 자모 가진 다른 모든 글자에 자동 적용
- 관리자 모드 "본드 위치 무관" 토글, 화면 글자 우클릭으로 편집창 진입

> 1.10 이전 이력은 [README.md](README.md)의 버전 노트 참조.
