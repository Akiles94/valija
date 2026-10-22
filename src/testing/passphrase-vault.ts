import { ulid } from "ulid";
import { resolveVaultPaths, type VaultPaths } from "../shared/infra/vault-paths.js";
import type { KdfParams } from "../vault/application/ports/crypto.js";
import { bytesToHex } from "../vault/domain/values/key-hex.js";
import { Argon2VaultCrypto } from "../vault/infra/argon2.js";
import { FileVaultStore } from "../vault/infra/file-vault-store.js";

/** A test passphrase — not a secret, and strong enough for parsePassphrase. */
export const TEST_PASSPHRASE = "correct horse battery staple";

/** Fast Argon2id parameters, so a passphrase open costs milliseconds instead of a second. */
export const FAST_KDF: KdfParams = {
  algorithm: "argon2id",
  memoryKiB: 8192,
  iterations: 1,
  parallelism: 1,
};

export interface PassphraseVault {
  paths: VaultPaths;
  vaultId: string;
  /** The derived key — what the recovery kit holds, and what an unlock puts in a keychain. */
  keyHex: string;
  passphrase: string;
}

/** An initialized, LOCKED vault at `root` whose key derives from `passphrase` (real Argon2id, fast params). */
export async function makePassphraseVault(
  root: string,
  passphrase = TEST_PASSPHRASE,
): Promise<PassphraseVault> {
  const paths = resolveVaultPaths(root);
  const clock = { now: () => new Date() };
  const store = new FileVaultStore(paths, { next: () => ulid() }, clock);
  const crypto = new Argon2VaultCrypto();
  const salt = crypto.generateSalt();
  const vaultId = ulid();
  const keyHex = bytesToHex(await crypto.deriveKey(passphrase, salt, FAST_KDF));
  store.writeHeader({
    vaultId,
    schemaVersion: 1,
    kdf: FAST_KDF,
    salt,
    createdAt: clock.now().toISOString(),
  });
  const initialized = store.initializeDb(keyHex);
  if (!initialized.ok) throw new Error(initialized.error.message);
  return { paths, vaultId, keyHex, passphrase };
}
