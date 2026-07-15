import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { KdfParams } from "../application/ports/crypto.js";
import { toHex } from "./argon2.js";
import { readVaultHeader, type VaultHeader, writeVaultHeader } from "./vault-header.js";

const KDF: KdfParams = { algorithm: "argon2id", memoryKiB: 8192, iterations: 1, parallelism: 1 };

const tmp = mkdtempSync(join(tmpdir(), "valija-header-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("VaultHeader", () => {
  it("round-trips write and read", () => {
    const path = join(tmp, "vault.json");
    const header: VaultHeader = {
      vaultId: "01TESTVAULTID",
      schemaVersion: 1,
      kdf: KDF,
      salt: new Uint8Array(randomBytes(16)),
      createdAt: new Date().toISOString(),
    };
    writeVaultHeader(path, header);
    const read = readVaultHeader(path);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.value.vaultId).toBe(header.vaultId);
      expect(read.value.kdf).toEqual(header.kdf);
      expect(toHex(read.value.salt)).toBe(toHex(header.salt));
    }
  });

  it("returns VAULT_NOT_FOUND for a missing file", () => {
    const r = readVaultHeader(join(tmp, "nope.json"));
    expect(!r.ok && r.error.code).toBe("VAULT_NOT_FOUND");
  });

  it("returns STORAGE_ERROR for invalid JSON and for a malformed header", () => {
    const garbled = join(tmp, "garbled.json");
    writeFileSync(garbled, "not json at all", "utf8");
    const r1 = readVaultHeader(garbled);
    expect(!r1.ok && r1.error.code).toBe("STORAGE_ERROR");

    const wrongShape = join(tmp, "wrong-shape.json");
    writeFileSync(wrongShape, JSON.stringify({ hello: "world" }), "utf8");
    const r2 = readVaultHeader(wrongShape);
    expect(!r2.ok && r2.error.code).toBe("STORAGE_ERROR");
  });
});
