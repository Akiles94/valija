import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { KdfParams, VaultCrypto } from "../application/ports/crypto.js";

export const KEY_LENGTH = 32;
export const SALT_LENGTH = 16;

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
    return new Uint8Array(key);
  }

  generateSalt(): Uint8Array {
    return new Uint8Array(randomBytes(SALT_LENGTH));
  }
}

export const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString("hex");
export const fromHex = (hex: string): Uint8Array => new Uint8Array(Buffer.from(hex, "hex"));
