import type {
  AppPreferencesMessage,
  PreferencesWriteRequest,
} from "../../../shared/ipc/messages.js";
import type { AppPreferencesStore } from "../../application/ports/app-preferences.js";

/**
 * `onAutoLockChanged`, when given, is called with the new value only when a
 * write actually changes `autoLockMinutes` — CONNECT D5: a TTL chosen in
 * Settings must reach the desktop's own `SessionGuard` (via the caller's
 * container rebuild), not just sit in the preferences file. Optional so
 * every other caller of this handler (and its existing tests) is unaffected.
 */
export function createPreferencesHandlers(
  store: AppPreferencesStore,
  onAutoLockChanged?: (minutes: number | null) => void,
) {
  return {
    "preferences:read": (): AppPreferencesMessage => store.read(),
    // vaultPath is never part of the request (§8.6) — it is carried forward
    // from the current file, untouched, until a handle-resolved path sets it
    // (Slice 8's relocation wizard).
    "preferences:write": (req: PreferencesWriteRequest): void => {
      const previous = store.read();
      const next = { ...previous, ...req };
      store.write(next);
      if (next.autoLockMinutes !== previous.autoLockMinutes) {
        onAutoLockChanged?.(next.autoLockMinutes);
      }
    },
  };
}
