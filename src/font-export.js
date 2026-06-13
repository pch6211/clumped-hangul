// 뭉친 한글 — 폰트 익스포트 오케스트레이터 [P3]
//
// main.js 가 노출한 window.__chFontGeometry() 로 현재 화면 글자들의 기하를 읽어
// build-font.js(순수 빌더)로 OTF 를 만들고 다운로드한다.
//   트리거: Ctrl/Cmd + Shift + F  (또는 window.exportClumpedFont())
//
// build-font.js(+opentype.js·polygon-clipping)는 무거우므로 export 시점에만
// 동적 import 한다 → 초기 번들을 가볍게 유지(별도 청크로 분리).

function toast(msg, ms = 2600) {
  let el = document.getElementById("chFontToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "chFontToast";
    el.style.cssText =
      "position:fixed;left:50%;bottom:64px;transform:translateX(-50%);" +
      "font-family:sans-serif;font-size:12px;letter-spacing:.3px;white-space:nowrap;" +
      "padding:6px 14px;border-radius:999px;background:rgba(0,0,0,.6);color:#fff;" +
      "z-index:9999;pointer-events:none;opacity:0;transition:opacity .25s ease;";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.style.opacity = "0";
  }, ms);
}

function download(buffer, filename) {
  const blob = new Blob([buffer], { type: "font/otf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function tsName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return (
    "뭉친한글_" +
    d.getFullYear() +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    "_" +
    p(d.getHours()) +
    p(d.getMinutes()) +
    ".otf"
  );
}

export async function exportClumpedFont(options = {}) {
  const getGeom = window.__chFontGeometry;
  if (typeof getGeom !== "function") {
    toast("폰트 익스포트: 앱이 아직 준비되지 않았어요");
    window.__chLastFont = { error: "no-hook" };
    return null;
  }
  const geom = getGeom();
  if (!geom || !geom.glyphs || geom.glyphs.length === 0) {
    toast("내보낼 글자가 없어요 — 먼저 텍스트를 입력하세요");
    window.__chLastFont = { error: "no-glyphs" };
    return null;
  }
  let result;
  try {
    toast("폰트 생성 중…", 1500);
    const { buildFont } = await import("./font/build-font.js");
    result = buildFont(geom.glyphs, options);
  } catch (e) {
    toast("폰트 생성 실패: " + (e && e.message ? e.message : e));
    window.__chLastFont = { error: String(e) };
    return null;
  }
  const { buffer, glyphCount, skipped } = result;
  // 검증/디버그용 요약 (다운로드 없이도 확인 가능)
  const head = new Uint8Array(buffer.slice(0, 4));
  const magic = String.fromCharCode(...head);
  window.__chLastFont = { glyphCount, bytes: buffer.byteLength, magic, skipped };

  if (!options.noDownload) {
    download(buffer, tsName());
    toast(`폰트 내보냄 — ${glyphCount}자 (.otf)`);
  }
  return result;
}

// 전역 노출 (콘솔/테스트용)
if (typeof window !== "undefined") window.exportClumpedFont = exportClumpedFont;

// 단축키: Ctrl/Cmd + Shift + F (capture 단계 — 기존 핸들러와 독립)
window.addEventListener(
  "keydown",
  (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.code === "KeyF") {
      e.preventDefault();
      exportClumpedFont();
    }
  },
  true,
);
