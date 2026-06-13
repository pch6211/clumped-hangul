// 뭉친 한글 — Electron 메인 프로세스
// 같은 Vite 산출물을 웹/데스크탑이 공유한다.
//   · 개발(dev:desktop): ELECTRON_START_URL(=Vite dev 서버) 로드 → HMR 동작
//   · 배포/미리보기(build:desktop, start:desktop): 빌드된 dist/index.html 을 file:// 로드
const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

// dev 모드에서만 설정됨. 없으면 빌드된 dist 를 로드.
const startUrl = process.env.ELECTRON_START_URL;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: "#808080",
    title: "뭉친 한글 Clumped Hangul",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (startUrl) {
    win.loadURL(startUrl);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // 외부 링크(라이선스·후원 등)는 기본 브라우저로 열기
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
