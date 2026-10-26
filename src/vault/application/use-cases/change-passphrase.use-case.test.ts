import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { SqliteVaultSessions } from "../../../context/infra/vault-sessions.js";
import { type DomainError, err, type Result } from "../../../shared/domain/result.js";
import { LATEST_SCHEMA_VERSION, schemaVersion } from "../../../shared/infra/migrations.js";
import { openVaultDb } from "../../../shared/infra/sqlite.js";
import { makePassphraseVault, type PassphraseVault } from "../../../testing/passphrase-vault.js";
import { setStoredSchemaVersion, snapshotVaultFiles } from "../../../testing/schema-skew.js";
import {
  FakeDeviceIdentity,
  FakeKeychain,
  FixedClock,
  SeqIds,
} from "../../../testing/test-vault.js";
import { vaultError } from "../../domain/errors.js";
import type { LineageStamp } from "../../domain/services/vault-lineage.js";
import { parseAutoLockTtl } from "../../domain/values/auto-lock-ttl.js";
import { createDeviceId } from "../../domain/values/device-id.js";
import { Argon2VaultCrypto } from "../../infra/argon2.js";
import { FileVaultFolder } from "../../infra/file-vault-folder.js";
import { FileVaultStore } from "../../infra/file-vault-store.js";
import { SqliteLineageStore } from "../../infra/sqlite-lineage-store.js";
import { SqliteVaultRekeyer } from "../../infra/sqlite-vault-rekeyer.js";
import { SessionGuard } from "../policies/session-guard.js";
import type { KeychainPort } from "../ports/keychain.js";
import type { RekeyRequest, VaultRekeyer } from "../ports/vault-rekeyer.js";
import type { VaultHeaderData } from "../ports/vault-store.js";
import { ChangePassphrase, type ChangePassphraseInput } from "./change-passphrase.use-case.js";
import { UnlockVault } from "./unlock-vault.use-case.js";

const NEW_PASSPHRASE = "a different test phrase";
const HEX_RUN = /[0-9a-f]{64}/i;
const tmp = mkdtempSync(join(tmpdir(), "valija-change-passphrase-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
let n = 0;

/** Records every request and answers with a scripted result (precondition cases never reach it). */
class FakeVaultRekeyer implements VaultRekeyer {
  readonly requests: RekeyRequest[] = [];
  constructor(private readonly result: Result<LineageStamp, DomainError>) {}
  rekey(request: RekeyRequest): Result<LineageStamp, DomainError> {
    this.requests.push(request);
    return this.result;
  }
}

/** Records every setKey; throws on the key it is told to refuse (the OS keychain failing, D-H). */
class RecordingKeychain extends FakeKeychain {
  readonly sets: string[] = [];
  refuse: string | null = null;
  override setKey(vaultId: string, keyHex: string): void {
    if (keyHex === this.refuse) throw new Error("keychain write refused");
    this.sets.push(keyHex);
    super.setKey(vaultId, keyHex);
  }
}

interface Fixture {
  vault: PassphraseVault;
  store: FileVaultStore;
  keychain: RecordingKeychain;
  deviceIdentity: FakeDeviceIdentity;
  clock: FixedClock;
  ids: SeqIds;
  rekeyer: VaultRekeyer;
  changePassphrase: ChangePassphrase;
}

/** A passphrase vault written once (generation 0), locked unless `unlocked`, real rekeyer unless faked. */
async function fixture(
  options: { unlocked?: boolean; rekeyer?: VaultRekeyer; folderName?: string } = {},
): Promise<Fixture> {
  const parent = join(tmp, `case-${++n}`);
  mkdirSync(parent, { recursive: true });
  const vault = await makePassphraseVault(join(parent, options.folderName ?? "vault"));
  const ids = new SeqIds();
  const clock = new FixedClock();
  writeOnce(vault, ids, clock);
  const store = new FileVaultStore(vault.paths, ids, clock);
  const keychain = new RecordingKeychain();
  if (options.unlocked) keychain.setKey(vault.vaultId, vault.keyHex);
  keychain.sets.length = 0;
  const deviceIdentity = new FakeDeviceIdentity(ids);
  const rekeyer = options.rekeyer ?? new SqliteVaultRekeyer(vault.paths, ids, clock);
  const changePassphrase = new ChangePassphrase(
    store,
    new Argon2VaultCrypto(),
    keychain,
    new FileVaultFolder(vault.paths),
    deviceIdentity,
    rekeyer,
    clock,
  );
  return { vault, store, keychain, deviceIdentity, clock, ids, rekeyer, changePassphrase };
}

function writeOnce(vault: PassphraseVault, ids: SeqIds, clock: FixedClock): void {
  const db = openVaultDb(vault.paths.db, vault.keyHex);
  db.transaction(() => new SqliteLineageStore(db, ids, clock).bump(createDeviceId(ids)))();
  db.close();
}

function headerOf(f: Fixture): VaultHeaderData {
  const header = f.store.readHeader();
  if (!header.ok) throw new Error(header.error.message);
  return header.value;
}

function input(f: Fixture, overrides: Partial<ChangePassphraseInput> = {}): ChangePassphraseInput {
  return {
    current: { passphrase: f.vault.passphrase },
    newPassphrase: NEW_PASSPHRASE,
    otherDevicesConfirmed: false,
    ...overrides,
  };
}

/** Unlocks through a second, independent "process": its own keychain and device identity. */
async function unlocksWith(
  f: Fixture,
  credential: { passphrase?: string; recoveryKeyHex?: string },
) {
  const ids = new SeqIds();
  const unlock = new UnlockVault(
    new FileVaultStore(f.vault.paths, ids, f.clock),
    new Argon2VaultCrypto(),
    new FakeKeychain(),
    new FakeDeviceIdentity(ids),
    f.clock,
  );
  const result = await unlock.execute(credential);
  return result.ok ? "ok" : result.error.code;
}

describe("ChangePassphrase — success", () => {
  for (const unlocked of [false, true]) {
    it(`re-keys a vault that was ${unlocked ? "unlocked" : "locked"}: only the new credentials open it`, async () => {
      const f = await fixture({ unlocked });
      const header = readFileSync(f.vault.paths.header);

      const result = await f.changePassphrase.execute(input(f));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const out = result.value;
      expect(out.vaultId).toBe(f.vault.vaultId);
      expect(out.keyHex).not.toBe(f.vault.keyHex);
      expect(out.generation).toBe(1);
      expect(out.unlockedOnThisDevice).toBe(true);
      expect(out.createdAt).toBe(headerOf(f).createdAt);
      expect(out.issuedAt).toBe(f.clock.now().toISOString());
      expect(await unlocksWith(f, { passphrase: NEW_PASSPHRASE })).toBe("ok");
      expect(await unlocksWith(f, { recoveryKeyHex: out.keyHex })).toBe("ok");
      expect(await unlocksWith(f, { passphrase: f.vault.passphrase })).toBe("WRONG_PASSPHRASE");
      expect(await unlocksWith(f, { recoveryKeyHex: f.vault.keyHex })).toBe("WRONG_PASSPHRASE");
      expect(f.keychain.getKey(f.vault.vaultId)).toBe(out.keyHex);
      expect(f.deviceIdentity.lastActivityAt(f.vault.vaultId)).toEqual(f.clock.now());
      const lineage = f.store.readLineage(out.keyHex);
      expect(lineage.ok && f.deviceIdentity.lastSeen(f.vault.vaultId)).toEqual({
        generation: 1,
        writeStamp: lineage.ok ? lineage.value?.writeStamp : undefined,
      });
      expect(readFileSync(f.vault.paths.header).equals(header)).toBe(true);
    });
  }

  it("accepts the recovery key as the current credential, resetting a forgotten passphrase (D-G)", async () => {
    const f = await fixture();

    const result = await f.changePassphrase.execute(
      input(f, { current: { recoveryKeyHex: f.vault.keyHex.toUpperCase() } }),
    );

    expect(result.ok).toBe(true);
    expect(await unlocksWith(f, { passphrase: NEW_PASSPHRASE })).toBe("ok");
    expect(await unlocksWith(f, { passphrase: f.vault.passphrase })).toBe("WRONG_PASSPHRASE");
    expect(result.ok && f.keychain.getKey(f.vault.vaultId)).toBe(result.ok && result.value.keyHex);
  });

  it("re-keys a behind-schema vault without migrating it or taking a migration backup (D-J)", async () => {
    const f = await fixture();
    setStoredSchemaVersion(f.vault.paths.db, f.vault.keyHex, LATEST_SCHEMA_VERSION - 1);

    const result = await f.changePassphrase.execute(input(f));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const db = openVaultDb(f.vault.paths.db, result.value.keyHex);
    expect(schemaVersion(db)).toBe(LATEST_SCHEMA_VERSION - 1);
    db.close();
    expect(readdirSync(f.vault.paths.root).sort()).toEqual(["vault.db", "vault.json"]);
  });

  it("proceeds in a cloud folder once the user confirmed other devices are locked and synced", async () => {
    const f = await fixture({ folderName: "Dropbox" });

    const result = await f.changePassphrase.execute(input(f, { otherDevicesConfirmed: true }));

    expect(result.ok).toBe(true);
  });
});

describe("ChangePassphrase — every refusal changes nothing", () => {
  const never = () => new FakeVaultRekeyer(err(vaultError("STORAGE_ERROR", "never called")));

  async function refused(
    f: Fixture,
    overrides: Partial<ChangePassphraseInput>,
    expectedCode: string,
  ): Promise<DomainError> {
    const before = snapshotVaultFiles(f.vault.paths);
    const keyBefore = f.keychain.getKey(f.vault.vaultId);
    const result = await f.changePassphrase.execute(input(f, overrides));
    expect(!result.ok && result.error.code).toBe(expectedCode);
    expect(snapshotVaultFiles(f.vault.paths)).toEqual(before);
    expect(f.keychain.getKey(f.vault.vaultId)).toBe(keyBefore);
    expect(f.keychain.sets).toEqual([]);
    expect((f.rekeyer as FakeVaultRekeyer).requests).toEqual([]);
    if (result.ok) throw new Error("expected a refusal");
    expect(result.error.message).not.toMatch(HEX_RUN);
    expect(result.error.message).not.toContain(f.vault.passphrase);
    expect(result.error.message).not.toContain(NEW_PASSPHRASE);
    return result.error;
  }

  it("no vault header → VAULT_NOT_FOUND", async () => {
    const f = await fixture({ rekeyer: never() });
    rmSync(f.vault.paths.root, { recursive: true });
    mkdirSync(f.vault.paths.root);
    const result = await f.changePassphrase.execute(input(f));
    expect(!result.ok && result.error.code).toBe("VAULT_NOT_FOUND");
    expect(readdirSync(f.vault.paths.root)).toEqual([]);
    expect((f.rekeyer as FakeVaultRekeyer).requests).toEqual([]);
  });

  for (const leftover of [
    "vault.db-journal",
    "vault (Oscar's conflicted copy 2026-10-01).db",
    "vault.db.pre-003.bak",
    "vault.db.pre-rekey.bak",
  ]) {
    it(`an unsettled folder (${leftover}) → VAULT_FOLDER_UNSETTLED naming it`, async () => {
      const f = await fixture({ rekeyer: never() });
      writeFileSync(join(f.vault.paths.root, leftover), "x");
      const error = await refused(f, {}, "VAULT_FOLDER_UNSETTLED");
      expect(error.message).toContain(leftover);
    });
  }

  it("a weak new passphrase → WEAK_PASSPHRASE", async () => {
    const f = await fixture({ rekeyer: never() });
    await refused(f, { newPassphrase: "short" }, "WEAK_PASSPHRASE");
  });

  it("a wrong current passphrase or a malformed recovery key → WRONG_PASSPHRASE", async () => {
    const f = await fixture({
      unlocked: true,
      rekeyer: never(),
    });
    await refused(f, { current: { passphrase: "not the passphrase" } }, "WRONG_PASSPHRASE");
    await refused(f, { current: { recoveryKeyHex: "abc" } }, "WRONG_PASSPHRASE");
  });

  it("a vault newer than this valija → VAULT_SCHEMA_TOO_NEW", async () => {
    const f = await fixture({ rekeyer: never() });
    setStoredSchemaVersion(f.vault.paths.db, f.vault.keyHex, LATEST_SCHEMA_VERSION + 1);
    await refused(f, {}, "VAULT_SCHEMA_TOO_NEW");
  });

  it("the same passphrase again → PASSPHRASE_UNCHANGED, also when proving it with the recovery key", async () => {
    const f = await fixture({ rekeyer: never() });
    await refused(f, { newPassphrase: f.vault.passphrase }, "PASSPHRASE_UNCHANGED");
    await refused(
      f,
      { current: { recoveryKeyHex: f.vault.keyHex }, newPassphrase: f.vault.passphrase },
      "PASSPHRASE_UNCHANGED",
    );
  });

  it("a cloud folder without the confirmation → VAULT_FOLDER_UNSETTLED (P-6 backstop)", async () => {
    const f = await fixture({
      folderName: "Dropbox",
      rekeyer: never(),
    });
    const error = await refused(f, { otherDevicesConfirmed: false }, "VAULT_FOLDER_UNSETTLED");
    expect(error.message).toContain("synced folder");
  });

  it("checks in spec order: a weak new passphrase wins over a wrong current one, an unsettled folder over both", async () => {
    const f = await fixture({ rekeyer: never() });
    const wrong = { current: { passphrase: "not the passphrase" } };
    await refused(f, { ...wrong, newPassphrase: "short" }, "WEAK_PASSPHRASE");
    writeFileSync(join(f.vault.paths.root, "vault.db.pre-rekey.bak"), "x");
    await refused(f, wrong, "VAULT_FOLDER_UNSETTLED");
  });

  it("passes a rekeyer refusal through (disk space) and leaves the keychain alone", async () => {
    const rekeyer = new FakeVaultRekeyer(
      err(vaultError("STORAGE_ERROR", "Not enough free disk space. Nothing was changed.")),
    );
    const f = await fixture({ unlocked: true, rekeyer });

    const result = await f.changePassphrase.execute(input(f));

    expect(!result.ok && result.error.message).toContain("disk space");
    expect(rekeyer.requests).toHaveLength(1);
    expect(rekeyer.requests[0]?.currentKeyHex).toBe(f.vault.keyHex);
    expect(f.keychain.getKey(f.vault.vaultId)).toBe(f.vault.keyHex);
    expect(f.keychain.sets).toEqual([]);
    expect(f.deviceIdentity.lastSeen(f.vault.vaultId)).toBeNull();
  });
});

describe("ChangePassphrase — this device afterwards (§5.3)", () => {
  it("when the keychain refuses the new key: success, locked here, never the old key, new passphrase unlocks", async () => {
    const f = await fixture({ unlocked: true });
    const header = headerOf(f);
    const derived = await new Argon2VaultCrypto().deriveKey(
      NEW_PASSPHRASE,
      header.salt,
      header.kdf,
    );
    f.keychain.refuse = Buffer.from(derived).toString("hex");

    const result = await f.changePassphrase.execute(input(f));

    expect(result.ok && result.value.unlockedOnThisDevice).toBe(false);
    expect(f.keychain.getKey(f.vault.vaultId)).toBeNull();
    expect(f.keychain.sets).toEqual([]);
    expect(await unlocksWith(f, { passphrase: NEW_PASSPHRASE })).toBe("ok");
  });

  it("a session that read the old key just before the change fails closed afterwards, never re-storing it", async () => {
    const f = await fixture({ unlocked: true });
    const staleKey = f.vault.keyHex;
    // Another process on this device: it read the old key before the commit and uses it after.
    const staleView: KeychainPort = {
      getKey: () => staleKey,
      setKey: (vaultId, keyHex) => f.keychain.setKey(vaultId, keyHex),
      deleteKey: (vaultId) => f.keychain.deleteKey(vaultId),
    };
    const sessions = new SqliteVaultSessions(
      f.vault.paths,
      staleView,
      f.deviceIdentity,
      new SessionGuard(f.deviceIdentity, staleView, f.clock, parseAutoLockTtl(undefined)),
      f.ids,
      f.clock,
    );

    const changed = await f.changePassphrase.execute(input(f));
    const late = sessions.withSession(() => ({ ok: true, value: "read" }) as const);

    expect(changed.ok).toBe(true);
    expect(!late.ok && late.error.code).toBe("VAULT_LOCKED");
    expect(f.keychain.getKey(f.vault.vaultId)).toBeNull();
    expect(f.keychain.sets).toEqual([changed.ok ? changed.value.keyHex : "?"]);
    expect(f.keychain.sets).not.toContain(staleKey);
    expect(await unlocksWith(f, { passphrase: NEW_PASSPHRASE })).toBe("ok");
  });
});
