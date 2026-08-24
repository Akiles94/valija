import { app, BrowserWindow } from "electron";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { createMainWindow } from "./windows/main-window.js";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

// Order matters for security (see docs/§3.A)
// 1. Set application name before any app.getPath() calls
app.setName("Valija");

// 2. Request single-instance lock
const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
  process.exit(0);
}

// 3. Read preferences
// TODO: Implement FileAppPreferencesStore in Slice 3

// 4. Resolve vault root
// TODO: Implement vault root resolution in Slice 3

// 5. Build container
// TODO: Implement container building in Slice 4

// 6. Register IPC handlers
// TODO: Implement IPC handler registration in Slice 5

// 7. Handle app ready event
app.on("ready", async () => {
  // Create the browser window
  const mainWindow = createMainWindow();
  mainWindow.loadURL(
    `file://${resolve(__dirname, "../renderer/index.html")}`
  );
});

// Handle app quit
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Handle app activate (macOS)
app.on("activate", () => {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length === 0) {
    const mainWindow = createMainWindow();
    mainWindow.loadURL(
      `file://${resolve(__dirname, "../renderer/index.html")}`
    );
  }
});
