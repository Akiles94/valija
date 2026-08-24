import { ipcMain } from "electron";
import type { Container } from "../../../../src/delivery/container.js";
import { CHANNELS } from "../../shared/ipc/channels.js";
import type { AppPreferencesStore } from "../application/ports/app-preferences.js";
import type { ClipboardPort } from "../application/ports/clipboard.js";
import type { FilePicker } from "../application/ports/file-picker.js";
import type { NodeProbe } from "../application/ports/node-probe.js";
import { createContentHandlers } from "./handlers/content-handlers.js";
import { createDialogHandlers } from "./handlers/dialog-handlers.js";
import { createImportHandlers } from "./handlers/import-handlers.js";
import { createPreferencesHandlers } from "./handlers/preferences-handlers.js";
import { createRelocationHandlers } from "./handlers/relocation-handlers.js";
import { createSyncHandlers } from "./handlers/sync-handlers.js";
import { createToolsHandlers } from "./handlers/tools-handlers.js";
import { createVaultHandlers } from "./handlers/vault-handlers.js";
import { SCHEMAS } from "./schemas.js";

export interface RegisterHandlersDeps {
  getContainer: () => Container;
  rebuildContainer: (newRoot: string) => void;
  preferencesStore: AppPreferencesStore;
  filePicker: FilePicker;
  clipboard: ClipboardPort;
  nodeProbe: NodeProbe;
}

type AnyHandler = (request: unknown) => unknown;

/** Builds the full handler map — one entry per channel in `channels.ts`, no more, no fewer. */
function buildHandlerMap(deps: RegisterHandlersDeps): Record<string, AnyHandler> {
  return {
    ...createVaultHandlers(deps.getContainer),
    ...createContentHandlers(deps.getContainer, deps.filePicker, deps.clipboard),
    ...createSyncHandlers(deps.getContainer),
    ...createRelocationHandlers(
      deps.getContainer,
      deps.rebuildContainer,
      deps.preferencesStore,
      deps.filePicker,
    ),
    ...createImportHandlers(deps.getContainer, deps.filePicker),
    ...createToolsHandlers(deps.getContainer, deps.nodeProbe),
    ...createPreferencesHandlers(deps.preferencesStore),
    ...createDialogHandlers(deps.filePicker),
  } as unknown as Record<string, AnyHandler>;
}

/**
 * Registers exactly the channels `channels.ts` enumerates: validate with
 * `schemas.ts`, call the matching handler, return. No `invoke("run", …)`
 * -shaped generic escape hatch — a channel present in `CHANNELS` with no
 * matching handler function throws at registration time, not silently.
 */
export function registerHandlers(deps: RegisterHandlersDeps): void {
  const handlers = buildHandlerMap(deps);

  for (const channel of CHANNELS) {
    const handler = handlers[channel];
    if (handler === undefined) {
      throw new Error(`No handler registered for channel "${channel}"`);
    }
    const schema = SCHEMAS[channel];
    ipcMain.handle(channel, (_event, rawRequest: unknown) => {
      const parsed = schema.safeParse(rawRequest);
      if (!parsed.success) {
        throw new Error(`Invalid request for channel "${channel}": ${parsed.error.message}`);
      }
      return handler(parsed.data);
    });
  }
}
