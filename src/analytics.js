// 뭉친 한글 — 애널리틱스 (Microsoft Clarity 커스텀 이벤트/태그)
// [P0-4] main.js 에서 분리한 첫 기능 모듈. window.clarity 미로드(광고차단 등)여도 무해(try/catch).
//   _track(name)   : 커스텀 이벤트 — 대시보드 Filters/Funnels
//   _tag(key, val) : 커스텀 태그 — 세션 메타데이터 (255자 한도)
function _clarity() {
  try {
    if (typeof window.clarity === "function") window.clarity.apply(null, arguments);
  } catch (_) {}
}

export function _track(name) {
  if (name) _clarity("event", String(name));
}

export function _tag(key, val) {
  if (key == null || val == null) return;
  _clarity("set", String(key), String(val).slice(0, 255));
}
