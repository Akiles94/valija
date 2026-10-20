import { Entry } from "@napi-rs/keyring";
import type { KeychainPort } from "../application/ports/keychain.js";

const SERVICE = "valija";

/** OS keychain adapter (`@napi-rs/keyring`): one entry per vault id under the `valija` service. */
export class OsKeychain implements KeychainPort {
  setKey(vaultId: string, keyHex: string): void {
    new Entry(SERVICE, vaultId).setPassword(keyHex);
  }

  getKey(vaultId: string): string | null {
    try {
      return new Entry(SERVICE, vaultId).getPassword();
    } catch {
      return null;
    }
  }

  deleteKey(vaultId: string): boolean {
    try {
      return new Entry(SERVICE, vaultId).deletePassword();
    } catch {
      return false;
    }
  }
}
