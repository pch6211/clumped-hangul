// 뭉친 한글 — 직접 타이핑(몰입) 모드 [P2 프로토타입]
//
// 타입건틀렛처럼 "바로 타이핑하면 글자가 나오는" 경험의 프로토타입.
// 이 앱은 이미 #mainText 입력 → 캔버스에 큰 클럼프 한글로 라이브 렌더한다.
// 남은 마찰은 "입력창을 먼저 클릭해야 하는 것"뿐. 이 모듈은 그 마찰을 줄인다.
//
// 설계 제약: "아무 데서나 타이핑"과 "단일키 단축키(A/T/R/B/M)"는 양립 불가
//   (입력창 포커스 시 단축키가 자동 비활성 — main.js keydown 게이트).
// 그래서 이 프로토타입은 영구 UI 없이 키보드로 토글하는 비파괴 방식:
//   · 백틱( ` )  → 직접 타이핑 모드 진입 (입력창 포커스 + 단축키 자동 일시중지)
//   · Esc        → 종료
// 최종 UX(상시 type-anywhere / 큰 오버레이 등)는 docs/TYPING_MODE.md 옵션 참고.
(function () {
  "use strict";
  let on = false;
  let hintEl = null;
  let fadeTimer = 0;

  function field() {
    // 앱의 텍스트 입력은 지연 생성되고 PC(#mainText)/모바일(#mobileText)로 분기된다.
    // 보이는(레이아웃된) 것을 우선 선택.
    const cands = ["mainText", "mobileText"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    return (
      cands.find((el) => el.offsetParent !== null) ||
      cands[0] ||
      document.querySelector("textarea")
    );
  }

  function ensureHint() {
    if (hintEl) return hintEl;
    hintEl = document.createElement("div");
    hintEl.id = "chTypingHint";
    hintEl.style.cssText =
      "position:fixed;left:50%;bottom:64px;transform:translateX(-50%);" +
      "font-family:sans-serif;font-size:12px;letter-spacing:.3px;white-space:nowrap;" +
      "padding:6px 14px;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;" +
      "z-index:9999;pointer-events:none;opacity:0;transition:opacity .25s ease;";
    document.body.appendChild(hintEl);
    return hintEl;
  }

  function showHint(text) {
    const el = ensureHint();
    el.textContent = text;
    el.style.opacity = "1";
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => {
      if (on && hintEl) hintEl.style.opacity = "0";
    }, 2800);
  }

  function hideHint() {
    clearTimeout(fadeTimer);
    if (hintEl) hintEl.style.opacity = "0";
  }

  function enter() {
    const t = field();
    if (!t) {
      // 앱 입력창이 아직 생성 전(첫 상호작용 전)인 경우 — 안내만.
      showHint("입력창 준비 중 — 화면을 한 번 클릭/타이핑한 뒤 다시 시도하세요");
      return;
    }
    on = true;
    t.focus();
    try {
      t.setSelectionRange(t.value.length, t.value.length);
    } catch (_) {}
    showHint("직접 타이핑 모드 — 바로 입력하세요 · Esc 종료 (단축키 일시중지)");
  }

  function exit() {
    on = false;
    const t = field();
    if (t) t.blur();
    hideHint();
  }

  // capture 단계 — 기존 bubble 핸들러보다 먼저 백틱/Esc 를 처리.
  window.addEventListener(
    "keydown",
    (e) => {
      const tag = e.target && e.target.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA";
      // 입력창 포커스가 아닐 때만 백틱으로 진입 (포커스 중엔 백틱은 글자로 입력되게 둠)
      if (!inField && (e.key === "`" || e.code === "Backquote")) {
        e.preventDefault();
        enter();
        return;
      }
      if (on && e.key === "Escape") {
        // 설정 패널이 열려 있으면 기존 Esc(패널 닫기)를 양보
        const panel = document.getElementById("panel");
        if (panel && panel.classList.contains("open")) return;
        e.preventDefault();
        exit();
      }
    },
    true,
  );

  // 입력창에서 포커스가 빠지면(다른 곳 클릭 등) 모드 상태도 정리
  window.addEventListener(
    "focusout",
    (e) => {
      if (on && e.target && e.target.id === "mainText") {
        on = false;
        hideHint();
      }
    },
    true,
  );
})();
