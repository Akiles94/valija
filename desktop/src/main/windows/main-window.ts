import { BrowserWindow, app } from "electron";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "../..");

const CSP_HEADER =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; frame-src 'none'";

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      preload: resolve(__dirname, "preload/index.js"),
    },
    show: false,
  });

  // Apply security headers via onHeadersReceived
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [CSP_HEADER],
        },
      });
    }
  );

  // Deny navigation to non-file: targets
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) {
      event.preventDefault();
    }
  });

  // Deny window open attempts
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });

  // Deny permission requests
  mainWindow.webContents.session.setPermissionRequestHandler(() => false);

  // Enable devTools only in development
  if (app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.show();
  return mainWindow;
}
