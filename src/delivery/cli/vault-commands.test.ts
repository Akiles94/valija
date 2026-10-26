import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { schemaVersion } from "../../shared/infra/migrations.js";
import { openVaultDb } from "../../shared/infra/sqlite.js";
import { resolveVaultPaths } from "../../shared/infra/vault-paths.js";
import {
  FakeDeviceIdentity,
  FakeKeychain,
  FixedClock,
  makeUnlockedVault,
  SeqIds,
} from "../../testing/test-vault.js";
import { CreateVault } from "../../vault/application/use-cases/create-vault.use-case.js";
import { UnlockVault } from "../../vault/application/use-cases/unlock-vault.use-case.js";
import { VaultStatus } from "../../vault/application/use-cases/vault-status.use-case.js";
import { parseAutoLockTtl } from "../../vault/domain/values/auto-lock-ttl.js";
import { Argon2VaultCrypto } from "../../vault/infra/argon2.js";
import { FileVaultFolder } from "../../vault/infra/file-vault-folder.js";
import { FileVaultStore } from "../../vault/infra/file-vault-store.js";
import type { Container } from "../container.js";
import { statusCommand, unlockCommand } from "./vault-commands.js";

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

describe("statusCommand — a leftover pre-rekey backup (§5.4, P-16)", () => {
  function statusLines(files: string[]): string[] {
    const vault = makeUnlockedVault();
    for (const file of files) writeFileSync(join(vault.paths.root, file), "x");
    const folder = new FileVaultFolder(vault.paths);
    const vaultStatus = new VaultStatus(
      vault.store,
      vault.keychain,
      vault.deviceIdentity,
      folder,
      vault.clock,
      parseAutoLockTtl(undefined),
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      statusCommand({ paths: vault.paths, folder, vaultStatus } as unknown as Container);
      return log.mock.calls.map((call) => String(call[0]));
    } finally {
      log.mockRestore();
      rmSync(vault.paths.root, { recursive: true, force: true });
    }
  }

  it("prints one backup: line naming the file and the PREVIOUS key", () => {
    const lines = statusLines(["vault.db.pre-rekey.bak"]);
    const backupLines = lines.filter((line) => line.startsWith("backup:"));
    expect(backupLines).toHaveLength(1);
    expect(backupLines[0]).toContain("vault.db.pre-rekey.bak");
    expect(backupLines[0]).toContain("PREVIOUS");
  });

  it("prints no backup: line without one (a migration backup is not listed)", () => {
    const lines = statusLines(["vault.db.pre-003.bak"]);
    expect(lines.some((line) => line.startsWith("backup:"))).toBe(false);
  });
});
