import { describe, expect, it } from "vitest";
import type { KdfParams } from "../application/ports/crypto.js";
import { Argon2VaultCrypto, fromHex, KEY_LENGTH, SALT_LENGTH, toHex } from "./argon2.js";

// Small params so tests stay fast; determinism is independent of cost.
const TEST_PARAMS: KdfParams = {
  algorithm: "argon2id",
  memoryKiB: 8 * 1024,
  iterations: 1,
  parallelism: 1,
};

const crypto = new Argon2VaultCrypto();

describe("Argon2VaultCrypto", () => {
  it("derives a deterministic 32-byte key for same passphrase and salt", async () => {
    const salt = crypto.generateSalt();
    const k1 = await crypto.deriveKey("correct horse battery staple", salt, TEST_PARAMS);
    const k2 = await crypto.deriveKey("correct horse battery staple", salt, TEST_PARAMS);
    expect(k1).toHaveLength(KEY_LENGTH);
    expect(toHex(k1)).toBe(toHex(k2));
  });

  it("different salt or passphrase produces a different key", async () => {
    const saltA = crypto.generateSalt();
    const saltB = crypto.generateSalt();
    const base = await crypto.deriveKey("passphrase", saltA, TEST_PARAMS);
    const otherSalt = await crypto.deriveKey("passphrase", saltB, TEST_PARAMS);
    const otherPass = await crypto.deriveKey("passphrase2", saltA, TEST_PARAMS);
    expect(toHex(otherSalt)).not.toBe(toHex(base));
    expect(toHex(otherPass)).not.toBe(toHex(base));
  });

  it("generates random salts of the right length", () => {
    const a = crypto.generateSalt();
    const b = crypto.generateSalt();
    expect(a).toHaveLength(SALT_LENGTH);
    expect(toHex(a)).not.toBe(toHex(b));
  });

  it("hex round-trips", () => {
    const salt = crypto.generateSalt();
    expect(toHex(fromHex(toHex(salt)))).toBe(toHex(salt));
  });
});
