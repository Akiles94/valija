import type { Container } from "../../../../../src/delivery/container.js";
import { resolveStatePaths } from "../../../../../src/shared/infra/state-paths.js";
import type { SyncStatusResponse } from "../../../shared/ipc/messages.js";

/**
 * The half of the Sync panel `vault:status` doesn't already carry.
 * `container.folder` is already the same `VaultFolder` port `VaultStatus`
 * itself reads `sidecars` from (§9 "same use case, same content") — this
 * just reads the other three fields off the same infallible `inspect()`.
 * `resolveStatePaths()` is resolved fresh here rather than threaded through
 * `Container`, mirroring how `main/index.ts` already resolves `VALIJA_HOME`
 * directly rather than storing it.
 */
export function createSyncHandlers(getContainer: () => Container) {
  return {
    "sync:status": (): SyncStatusResponse => {
      const { conflictedCopies, staleBackups, looksLikeCloud } = getContainer().folder.inspect();
      return {
        conflictedCopies,
        staleBackups,
        looksLikeCloud,
        resolvedStateHome: resolveStatePaths().root,
      };
    },
  };
}
