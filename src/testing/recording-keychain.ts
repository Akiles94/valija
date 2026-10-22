import type { KeychainPort } from "../vault/application/ports/keychain.js";

export type KeychainCall = { method: "setKey" | "getKey" | "deleteKey"; vaultId: string };

/**
 * A `vi.mock` stand-in for `OsKeychain` (§11.1): every instance shares one static store, and every
 * construction and call is recorded — so a test can prove a path never built nor touched it.
 *
 *   vi.mock("…/vault/infra/keyring.js", async () => ({
 *     OsKeychain: (await import("…/testing/recording-keychain.js")).RecordingKeychain,
 *   }));
 */
export class RecordingKeychain implements KeychainPort {
  static readonly store = new Map<string, string>();
  static readonly calls: KeychainCall[] = [];
  static constructions = 0;

  constructor() {
    RecordingKeychain.constructions += 1;
  }

  /** Forget every key, call and construction (between tests). */
  static reset(): void {
    RecordingKeychain.store.clear();
    RecordingKeychain.calls.length = 0;
    RecordingKeychain.constructions = 0;
  }

  /** Forget the record but keep the keys (after a test's own setup). */
  static clearRecord(): void {
    RecordingKeychain.calls.length = 0;
    RecordingKeychain.constructions = 0;
  }

  setKey(vaultId: string, keyHex: string): void {
    RecordingKeychain.calls.push({ method: "setKey", vaultId });
    RecordingKeychain.store.set(vaultId, keyHex);
  }

  getKey(vaultId: string): string | null {
    RecordingKeychain.calls.push({ method: "getKey", vaultId });
    return RecordingKeychain.store.get(vaultId) ?? null;
  }

  deleteKey(vaultId: string): boolean {
    RecordingKeychain.calls.push({ method: "deleteKey", vaultId });
    return RecordingKeychain.store.delete(vaultId);
  }
}
