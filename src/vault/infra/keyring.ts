import { Entry } from "@napi-rs/keyring";
import type { KeychainPort } from "../application/ports/keychain.js";

const SERVICE = "valija";

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
