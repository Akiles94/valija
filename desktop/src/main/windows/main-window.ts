import { join } from "node:path";
import { app, BrowserWindow, session } from "electron";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'none'",
  "font-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
].join("; ");

export function createMainWindow(loadUrl: string, preloadPath: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: !app.isPackaged,
      preload: preloadPath,
    },
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [CSP],
      },
    });
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file:")) event.preventDefault();
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  window.loadURL(loadUrl);
  return window;
}

export const preloadFile = (dir: string): string => join(dir, "index.js");
