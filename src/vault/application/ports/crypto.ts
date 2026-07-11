export interface KdfParams {
  readonly algorithm: "argon2id";
  readonly memoryKiB: number;
  readonly iterations: number;
  readonly parallelism: number;
}

export const DEFAULT_KDF_PARAMS: KdfParams = {
  algorithm: "argon2id",
  memoryKiB: 64 * 1024,
  iterations: 3,
  parallelism: 1,
};

export interface VaultCrypto {
  /** Derive a 32-byte raw key from a passphrase. */
  deriveKey(passphrase: string, salt: Uint8Array, params: KdfParams): Promise<Uint8Array>;
  generateSalt(): Uint8Array;
}
