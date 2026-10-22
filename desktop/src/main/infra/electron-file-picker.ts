import { basename } from "node:path";
import { dialog } from "electron";
import type { FilePicker } from "../application/ports/file-picker.js";

let nextHandleId = 0;

/**
 * Wraps Electron's native dialogs. Every chosen path is stored under a
 * generated handle rather than ever crossing the IPC boundary itself — the
 * renderer gets a display name, never the path (§8.6).
 */
export class ElectronFilePicker implements FilePicker {
  private readonly handles = new Map<string, string>();
  /** Project folders get their own map (P-10): one handle never means two things. */
  private readonly projectFolders = new Map<string, string>();

  chooseImportFile(): { handle: string; displayName: string; path: string } | null {
    const result = dialog.showOpenDialogSync({
      properties: ["openFile"],
      filters: [{ name: "Chat export", extensions: ["json", "zip"] }],
    });
    const path = result?.[0];
    if (path === undefined) return null;
    return this.mint(path);
  }

  chooseExportTarget(suggestedName: string): string | null {
    return dialog.showSaveDialogSync({ defaultPath: suggestedName }) ?? null;
  }

  chooseVaultFolder(): { handle: string; displayName: string; path: string } | null {
    const result = dialog.showOpenDialogSync({ properties: ["openDirectory"] });
    const path = result?.[0];
    if (path === undefined) return null;
    return this.mint(path);
  }

  resolveHandle(handle: string): string | undefined {
    return this.handles.get(handle);
  }

  chooseProjectFolder(): { handle: string; displayName: string; path: string } | null {
    const result = dialog.showOpenDialogSync({ properties: ["openDirectory"] });
    const path = result?.[0];
    if (path === undefined) return null;
    return mintInto(this.projectFolders, "pf", path);
  }

  resolveProjectFolder(handle: string): string | undefined {
    return this.projectFolders.get(handle);
  }

  private mint(path: string): { handle: string; displayName: string; path: string } {
    return mintInto(this.handles, "fh", path);
  }
}

function mintInto(
  handles: Map<string, string>,
  prefix: "fh" | "pf",
  path: string,
): { handle: string; displayName: string; path: string } {
  const handle = `${prefix}-${++nextHandleId}`;
  handles.set(handle, path);
  return { handle, displayName: basename(path), path };
}
