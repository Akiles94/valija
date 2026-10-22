import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { KdfParams, VaultCrypto } from "../application/ports/crypto.js";

/** Vault key size in bytes (256-bit, as SQLCipher expects). */
export const KEY_LENGTH = 32;
/** Random salt size in bytes for key derivation. */
export const SALT_LENGTH = 16;

/** Argon2id key derivation (the `argon2` native module) with salts from the OS random source. */
export class Argon2VaultCrypto implements VaultCrypto {
  async deriveKey(passphrase: string, salt: Uint8Array, params: KdfParams): Promise<Uint8Array> {
    const key = await argon2.hash(passphrase, {
      type: argon2.argon2id,
      raw: true,
      salt: Buffer.from(salt),
      memoryCost: params.memoryKiB,
      timeCost: params.iterations,
      parallelism: params.parallelism,
      hashLength: KEY_LENGTH,
    });
    // P-16: hand back a copy and zero argon2's own buffer — best effort, the copy is the caller's.
    const copy = new Uint8Array(key);
    key.fill(0);
    return copy;
  }

  generateSalt(): Uint8Array {
    return new Uint8Array(randomBytes(SALT_LENGTH));
  }
}

/** Encodes bytes as lowercase hex. */
export const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString("hex");
/** Decodes a hex string to bytes. */
export const fromHex = (hex: string): Uint8Array => new Uint8Array(Buffer.from(hex, "hex"));
