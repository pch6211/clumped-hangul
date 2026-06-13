// 뭉친 한글 — 폰트 빌더 (순수 함수, 테스트 가능)
//
// 입력: 글자별 기하 프리미티브(획=선분+둥근캡, 노드=둥근사각) — main.js 의 saveSVG 와 동일 모델.
// 출력: OTF ArrayBuffer (opentype.js).
//
// 파이프라인: 각 프리미티브를 다각형으로 → polygon-clipping 합집합 → 화면좌표(y↓)를
//   폰트좌표(y↑, em 스케일)로 변환 → opentype.Path → Glyph → Font.
// opentype.js / polygon-clipping 은 환경마다 export 형태가 정반대다:
//   · Vite(.mjs): named exports (Font/Glyph/Path, union ...) — default 없음
//   · node(cjs):  default 객체만
// 둘 다 호환되게 namespace 를 받고, named 키가 있으면 그대로, 없으면 default 를
// 동적으로(정적 .default 접근 경고 회피) 꺼낸다.
import * as _opentypeNS from "opentype.js";
import * as _pcNS from "polygon-clipping";
function _interop(ns, namedKey) {
  if (ns && ns[namedKey]) return ns; // named exports present (Vite)
  const keys = ns ? Object.keys(ns) : []; // node: ['default']
  return (ns && keys.length && ns[keys[0]]) || ns;
}
const opentype = _interop(_opentypeNS, "Font");
const polygonClipping = _interop(_pcNS, "union");

// 선분(둥근 캡, 폭 w)을 스타디움(capsule) 외곽 다각형으로.
function capsulePolygon(x0, y0, x1, y1, w, K = 10) {
  const r = w / 2;
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const pts = [];
  // 끝점 B 반원: ang-90° → ang+90° (우 → 정면 → 좌)
  for (let i = 0; i <= K; i++) {
    const a = ang - Math.PI / 2 + Math.PI * (i / K);
    pts.push([x1 + r * Math.cos(a), y1 + r * Math.sin(a)]);
  }
  // 끝점 A 반원: ang+90° → ang+270° (좌 → 뒤 → 우)
  for (let i = 0; i <= K; i++) {
    const a = ang + Math.PI / 2 + Math.PI * (i / K);
    pts.push([x0 + r * Math.cos(a), y0 + r * Math.sin(a)]);
  }
  return pts;
}

// 둥근 사각형(노드): 중심(cx,cy), 반변 r, 코너반경 cr. cr=0→사각, cr=r→원.
function roundedRectPolygon(cx, cy, r, cr, K = 6) {
  cr = Math.max(0, Math.min(cr, r));
  const x0 = cx - r,
    y0 = cy - r,
    x1 = cx + r,
    y1 = cy + r;
  const corners = [
    { ax: x1 - cr, ay: y0 + cr, a0: -Math.PI / 2, a1: 0 },
    { ax: x1 - cr, ay: y1 - cr, a0: 0, a1: Math.PI / 2 },
    { ax: x0 + cr, ay: y1 - cr, a0: Math.PI / 2, a1: Math.PI },
    { ax: x0 + cr, ay: y0 + cr, a0: Math.PI, a1: Math.PI * 1.5 },
  ];
  const pts = [];
  for (const c of corners) {
    for (let i = 0; i <= K; i++) {
      const a = c.a0 + (c.a1 - c.a0) * (i / K);
      pts.push([c.ax + cr * Math.cos(a), c.ay + cr * Math.sin(a)]);
    }
  }
  return pts;
}

// 한 글자 기하 → opentype.Glyph
function buildGlyph(g, ctx) {
  const { unitsPerEm, sideBearing, capSegs, rrSegs, globalScale, gMaxY } = ctx;
  const polys = [];
  for (const s of g.segments) polys.push([capsulePolygon(s.x0, s.y0, s.x1, s.y1, s.w, capSegs)]);
  for (const d of g.dots) {
    if (d.r > 0) polys.push([roundedRectPolygon(d.x, d.y, d.r, d.cornerR, rrSegs)]);
  }

  // 합집합 (실패 시 개별 다각형 유지 — nonzero fill 로 여전히 채워짐)
  let merged;
  if (polys.length === 0) merged = [];
  else {
    try {
      merged = polygonClipping.union(...polys);
    } catch (_e) {
      merged = polys.map((p) => [p[0]]);
    }
  }

  const bb = g.bbox;
  // 모든 글자가 동일 배율(globalScale) + 동일 세로 기준(gMaxY=전체 하단=공통 베이스라인)을 써서
  // 글자 간 상대 크기·정렬을 보존한다 (앱 화면의 배치를 그대로 폰트로 옮김).
  const scale = globalScale;
  const tx = (x) => (x - bb.x) * scale + sideBearing; // 글자 좌측을 사이드베어링 위치에
  const ty = (y) => (gMaxY - y) * scale; // 화면 y↓ → 폰트 y↑, 공통 베이스라인

  const path = new opentype.Path();
  for (const polygon of merged) {
    for (const ring of polygon) {
      if (!ring || ring.length < 3) continue;
      ring.forEach((pt, i) => {
        const fx = tx(pt[0]);
        const fy = ty(pt[1]);
        if (i === 0) path.moveTo(fx, fy);
        else path.lineTo(fx, fy);
      });
      path.close();
    }
  }

  const advanceWidth = Math.max(unitsPerEm * 0.2, bb.w * scale + sideBearing * 2);
  const cp = g.ch ? g.ch.codePointAt(0) : 0;
  return new opentype.Glyph({
    name: g.ch ? "uni" + cp.toString(16).toUpperCase().padStart(4, "0") : "glyph",
    unicode: cp || undefined,
    advanceWidth: Math.round(advanceWidth),
    path,
  });
}

/**
 * 글자 기하 배열 → OTF ArrayBuffer.
 * @param {Array} glyphs  [{ch, segments, dots, bbox}]
 * @param {Object} options
 * @returns {ArrayBuffer}
 */
export function buildFont(glyphs, options = {}) {
  const opt = {
    familyName: options.familyName || "뭉친한글 Clumped Hangul",
    styleName: options.styleName || "Regular",
    unitsPerEm: options.unitsPerEm || 1000,
    glyphHeight: options.glyphHeight || 700,
    sideBearing: options.sideBearing ?? 60,
    capSegs: options.capSegs || 10,
    rrSegs: options.rrSegs || 6,
  };

  const notdef = new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: Math.round(opt.unitsPerEm * 0.5),
    path: new opentype.Path(),
  });

  // 문자 중복 제거 (먼저 나온 것 사용), 빈/공백 제외 → 빌드 대상 선별
  const seen = new Set();
  const targets = [];
  const skipped = [];
  for (const g of glyphs) {
    const ch = g.ch || "";
    if (!ch.trim() || seen.has(ch)) continue;
    if (!g.segments.length && !g.dots.length) {
      skipped.push(ch);
      continue;
    }
    seen.add(ch);
    targets.push(g);
  }

  // 글로벌 메트릭: 모든 대상 글자를 한 배율·한 베이스라인으로 (글자별 독립 스케일 대신).
  //   가장 큰 글자 높이가 glyphHeight 가 되도록 배율을 잡고, 전체 하단을 공통 베이스라인으로.
  let maxH = 0;
  let gMaxY = -Infinity;
  for (const g of targets) {
    maxH = Math.max(maxH, g.bbox.h);
    gMaxY = Math.max(gMaxY, g.bbox.y + g.bbox.h);
  }
  const globalScale = maxH > 0 ? opt.glyphHeight / maxH : 1;
  if (!isFinite(gMaxY)) gMaxY = 0;
  const ctx = { ...opt, globalScale, gMaxY };

  const built = [notdef];
  for (const g of targets) built.push(buildGlyph(g, ctx));

  const font = new opentype.Font({
    familyName: opt.familyName,
    styleName: opt.styleName,
    unitsPerEm: opt.unitsPerEm,
    ascender: Math.round(opt.glyphHeight),
    descender: -Math.round(opt.unitsPerEm - opt.glyphHeight),
    glyphs: built,
  });

  return { buffer: font.toArrayBuffer(), glyphCount: built.length - 1, skipped };
}
