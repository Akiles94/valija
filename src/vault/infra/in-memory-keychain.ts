import type { KeychainPort } from "../application/ports/keychain.js";

/**
 * SDK Mode P and createVault (D-A): the derived key lives only in this object, in this process.
 * It never reaches the OS keychain, so unlocking a product never unlocks the user's AI tools (§11.1).
 * Best effort wiping (§11.3): owned bytes are zeroed on delete; strings handed out by getKey cannot be.
 */
export class InMemoryKeychain implements KeychainPort {
  private readonly keys = new Map<string, Buffer>();

  setKey(vaultId: string, keyHex: string): void {
    this.deleteKey(vaultId);
    this.keys.set(vaultId, Buffer.from(keyHex, "utf8"));
  }

  getKey(vaultId: string): string | null {
    return this.keys.get(vaultId)?.toString("utf8") ?? null;
  }

  deleteKey(vaultId: string): boolean {
    this.keys.get(vaultId)?.fill(0);
    return this.keys.delete(vaultId);
  }
}
