/** Argon2id cost parameters, stored in the vault header so a key can always be re-derived. */
export interface KdfParams {
  readonly algorithm: "argon2id";
  readonly memoryKiB: number;
  readonly iterations: number;
  readonly parallelism: number;
}

/** Cost parameters new vaults are created with: 64 MiB of memory, 3 passes, 1 lane. */
export const DEFAULT_KDF_PARAMS: KdfParams = {
  algorithm: "argon2id",
  memoryKiB: 64 * 1024,
  iterations: 3,
  parallelism: 1,
};

/** Key derivation port: turns a passphrase plus salt into the 32-byte vault key. */
export interface VaultCrypto {
  /** Derive a 32-byte raw key from a passphrase. */
  deriveKey(passphrase: string, salt: Uint8Array, params: KdfParams): Promise<Uint8Array>;
  generateSalt(): Uint8Array;
}
