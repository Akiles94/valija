import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { schemaVersion } from "../../shared/infra/migrations.js";
import { openVaultDb } from "../../shared/infra/sqlite.js";
import { resolveVaultPaths } from "../../shared/infra/vault-paths.js";
import { FakeDeviceIdentity, FakeKeychain, FixedClock, SeqIds } from "../../testing/test-vault.js";
import { CreateVault } from "../../vault/application/use-cases/create-vault.use-case.js";
import { UnlockVault } from "../../vault/application/use-cases/unlock-vault.use-case.js";
import { Argon2VaultCrypto } from "../../vault/infra/argon2.js";
import { FileVaultStore } from "../../vault/infra/file-vault-store.js";
import type { Container } from "../container.js";
import { unlockCommand } from "./vault-commands.js";

const PASSPHRASE = "correct horse battery staple";
const tmp = mkdtempSync(join(tmpdir(), "valija-unlock-command-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("unlockCommand — the CLI keeps migrating silently (D-J(b))", () => {
  it("unlocks a behind-schema vault via the recovery-key path with no confirmation prompt", async () => {
    const paths = resolveVaultPaths(join(tmp, "behind"));
    const idGen = new SeqIds();
    const clock = new FixedClock();
    const store = new FileVaultStore(paths, idGen, clock);
    const crypto = new Argon2VaultCrypto();
    const keychain = new FakeKeychain();
    const deviceIdentity = new FakeDeviceIdentity(idGen);

    const created = await new CreateVault(
      store,
      crypto,
      keychain,
      deviceIdentity,
      clock,
      idGen,
    ).execute(PASSPHRASE);
    if (!created.ok) throw new Error(created.error.message);
    const { keyHex, vaultId } = created.value;

    const db = openVaultDb(paths.db, keyHex);
    db.prepare(
      "INSERT INTO meta (key, value) VALUES ('schema_version', '2') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run();
    db.close();
    keychain.deleteKey(vaultId);

    const container = {
      paths,
      unlockVault: new UnlockVault(store, crypto, keychain, deviceIdentity, clock),
    } as unknown as Container;

    // The recovery-key branch never calls promptHidden, so this exercises
    // unlockCommand's real call site without needing to mock stdin.
    await unlockCommand(container, { recoveryKey: keyHex });

    expect(keychain.getKey(vaultId)).toBe(keyHex);
    const rawDb = openVaultDb(paths.db, keyHex);
    expect(schemaVersion(rawDb)).toBeGreaterThan(2);
    rawDb.close();
  });
});
