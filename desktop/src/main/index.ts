import { join } from "node:path";
import { app, ipcMain } from "electron";
import { registerSpikeHandlers } from "./spike/spike-handlers.js";
import { createMainWindow, preloadFile } from "./windows/main-window.js";

// Bootstrap order is fixed (plan.md §3.A): name the app before any userData path is
// touched, take the single-instance lock before anything else can race the
// preferences file, then create the window last, only once everything it can call
// into is ready. Preferences (Slice 3), vault-root resolution and buildContainer
// (Slice 4) are not wired yet — this slice only proves the platform, so the window
// loads the throwaway spike renderer instead of the real app shell.
app.setName("Valija");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.whenReady().then(() => {
    registerSpikeHandlers(ipcMain);

    const preload = preloadFile(join(import.meta.dirname, "../preload"));
    const rendererUrl =
      process.env.ELECTRON_RENDERER_URL ??
      `file://${join(import.meta.dirname, "../renderer/index.html")}`;
    createMainWindow(rendererUrl, preload);
  });
}

// crashReporter is never started, and no telemetry dependency is ever imported —
// see dependency-parity.test.ts and the forbidden-pattern grep test in this same
// directory for the mechanical enforcement (§8.3, §8.5).
