import type {
  AppPreferencesMessage,
  PreferencesWriteRequest,
} from "../../../shared/ipc/messages.js";
import type { AppPreferencesStore } from "../../application/ports/app-preferences.js";

/** Handlers for the `preferences:*` channels; a write can never change the vault path. */
export function createPreferencesHandlers(store: AppPreferencesStore) {
  return {
    "preferences:read": (): AppPreferencesMessage => store.read(),
    // vaultPath is never part of the request (§8.6) — it is carried forward
    // from the current file, untouched, until a handle-resolved path sets it
    // (Slice 8's relocation wizard).
    "preferences:write": (req: PreferencesWriteRequest): void => {
      store.write({ ...store.read(), ...req });
    },
  };
}
