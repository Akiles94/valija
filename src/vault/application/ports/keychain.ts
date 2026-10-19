/**
 * The OS keychain, holding the vault key while the vault is unlocked; removing the key is what
 * locks it.
 */
export interface KeychainPort {
  setKey(vaultId: string, keyHex: string): void;
  getKey(vaultId: string): string | null;
  deleteKey(vaultId: string): boolean;
}
