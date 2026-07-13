import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import type { VaultHeaderData } from "../application/ports/vault-store.js";
import { vaultErr } from "../domain/errors.js";

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

export type VaultHeader = VaultHeaderData;

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
    return vaultErr("VAULT_NOT_FOUND", `No vault header found at ${path}. Run "valija init".`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return vaultErr("STORAGE_ERROR", `Vault header at ${path} is not valid JSON.`);
  }
  const parsed = headerSchema.safeParse(raw);
  if (!parsed.success) {
    return vaultErr(
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
