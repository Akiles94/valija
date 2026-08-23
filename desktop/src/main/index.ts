import { join } from "node:path";
import { app } from "electron";
import { buildContainer, type Container } from "../../../src/delivery/container.js";
import { resolveVaultRoot } from "./application/policies/vault-location.js";
import { ElectronClipboard } from "./infra/electron-clipboard.js";
import { ElectronFilePicker } from "./infra/electron-file-picker.js";
import { FileAppPreferencesStore } from "./infra/file-app-preferences-store.js";
import { registerHandlers } from "./ipc/register-handlers.js";
import { createMainWindow, preloadFile } from "./windows/main-window.js";

// Bootstrap order is fixed (plan.md §3.A): name the app before any userData
// path is touched, take the single-instance lock before anything else can
// race the preferences file, read preferences, resolve the vault root,
// compose the container, register IPC handlers, and only then create the
// window — nothing renderer-facing exists before everything it can call into
// is ready.
app.setName("Valija");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.whenReady().then(() => {
    const preferencesStore = new FileAppPreferencesStore(app.getPath("userData"));
    const preferences = preferencesStore.read();
    const vaultRoot = resolveVaultRoot(process.env, preferences);

    let container: Container = buildContainer(vaultRoot === undefined ? {} : { vaultRoot });
    const getContainer = (): Container => container;
    /** Called after a successful relocation (Slice 8) to point every handler at the new root. */
    const rebuildContainer = (newRoot: string): void => {
      container = buildContainer({ vaultRoot: newRoot });
    };
    void rebuildContainer; // wired to relocation-handlers.ts in Slice 8

    const filePicker = new ElectronFilePicker();
    const clipboard = new ElectronClipboard();

    registerHandlers({ getContainer, preferencesStore, filePicker, clipboard });

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
