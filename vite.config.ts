import { defineConfig } from "vite";

// 뭉친 한글 — Vite 설정
// 루트의 index.html 이 진입점. 빌드 결과는 dist/ 에 단일 페이지로 산출되며
// GitHub Pages 배포(clumped-hangul.com)와 호환된다.
export default defineConfig({
  root: ".",
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // 거대 단일 모듈(현재 main.js)을 통째로 두기 위해 인라인 한계를 넉넉히.
    assetsInlineLimit: 0,
  },
  server: {
    port: 5173,
    open: false,
    host: true,
  },
});
