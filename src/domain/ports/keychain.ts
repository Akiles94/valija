export interface KeychainPort {
  setKey(vaultId: string, keyHex: string): void;
  getKey(vaultId: string): string | null;
  deleteKey(vaultId: string): boolean;
}
