import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { type DomainError, domainErr, ok, type Result } from "../../domain/errors.js";
import type { KdfParams } from "../../domain/ports/crypto.js";

const headerSchema = z.object({
  vaultId: z.string().min(1),
  schemaVersion: z.literal(1),
  kdf: z.object({
    algorithm: z.literal("argon2id"),
    memoryKiB: z.number().int().positive(),
    iterations: z.number().int().positive(),
    parallelism: z.number().int().positive(),
  }),
  saltBase64: z.string().min(1),
  createdAt: z.string(),
});

export interface VaultHeader {
  vaultId: string;
  schemaVersion: 1;
  kdf: KdfParams;
  salt: Uint8Array;
  createdAt: string;
}

export function writeVaultHeader(path: string, header: VaultHeader): void {
  const json = {
    vaultId: header.vaultId,
    schemaVersion: header.schemaVersion,
    kdf: header.kdf,
    saltBase64: Buffer.from(header.salt).toString("base64"),
    createdAt: header.createdAt,
  };
  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`, "utf8");
}

export function readVaultHeader(path: string): Result<VaultHeader, DomainError> {
  if (!existsSync(path)) {
    return domainErr("VAULT_NOT_FOUND", `No vault header found at ${path}. Run "valija init".`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return domainErr("STORAGE_ERROR", `Vault header at ${path} is not valid JSON.`);
  }
  const parsed = headerSchema.safeParse(raw);
  if (!parsed.success) {
    return domainErr(
      "STORAGE_ERROR",
      `Vault header at ${path} is malformed: ${parsed.error.message}`,
    );
  }
  const h = parsed.data;
  return ok({
    vaultId: h.vaultId,
    schemaVersion: h.schemaVersion,
    kdf: h.kdf,
    salt: new Uint8Array(Buffer.from(h.saltBase64, "base64")),
    createdAt: h.createdAt,
  });
}
