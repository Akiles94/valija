import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LATEST_SCHEMA_VERSION } from "../../../shared/infra/migrations.js";
import { probeSchemaVersion } from "../../../shared/infra/sqlite.js";
import { makePassphraseVault, TEST_PASSPHRASE } from "../../../testing/passphrase-vault.js";
import { RecordingKeychain } from "../../../testing/recording-keychain.js";
import { setStoredSchemaVersion, snapshotVaultFiles } from "../../../testing/schema-skew.js";
import { DEFAULT_KDF_PARAMS } from "../../../vault/application/ports/crypto.js";
import type { WriteStamp } from "../../../vault/domain/values/write-stamp.js";
import { renderRecoveryKit } from "../../../vault/infra/recovery-kit.js";
import { buildContainer } from "../../container.js";
import { createVault, openVault } from "./vault-lifecycle.js";

vi.mock("../../../vault/infra/keyring.js", async () => ({
  OsKeychain: (await import("../../../testing/recording-keychain.js")).RecordingKeychain,
}));

const tmp = mkdtempSync(join(tmpdir(), "valija-sdk-lifecycle-"));
const originalEnv = { ...process.env };
let n = 0;
const freshRoot = () => join(tmp, `vault-${++n}`);
const CLIENT = "acme-notes";
const STRONG = "a long and unusual passphrase for tests";

beforeEach(() => {
  RecordingKeychain.reset();
  process.env.HOME = join(tmp, "home");
  process.env.VALIJA_STATE_HOME = join(tmp, `state-${++n}`);
  delete process.env.VALIJA_HOME;
  delete process.env.VALIJA_AUTOLOCK_MINUTES;
  delete process.env.VALIJA_PROJECT;
});

afterAll(() => {
  process.env = originalEnv;
  rmSync(tmp, { recursive: true, force: true });
});

const codeOf = (r: { ok: true } | { ok: false; error: { code: string } }) =>
  r.ok ? "ok" : r.error.code;

const backups = (root: string) => readdirSync(root).filter((f) => f.includes(".pre-"));

describe("openVault — Mode K (keychain session)", () => {
  it("no vault at the root → VAULT_NOT_FOUND, and no key is read", async () => {
    const r = await openVault({ client: CLIENT, vaultRoot: freshRoot() });
    expect(codeOf(r)).toBe("VAULT_NOT_FOUND");
    expect(RecordingKeychain.calls).toEqual([]);
  });

  it("opens a locked vault (header only), then each call returns VAULT_LOCKED", async () => {
    const vault = await makePassphraseVault(freshRoot());
    const r = await openVault({ client: CLIENT, vaultRoot: vault.paths.root });
    expect(r.ok && r.value.mode).toBe("keychain-session");
    expect(r.ok && r.value.vaultId).toBe(vault.vaultId);
    expect(RecordingKeychain.calls).toEqual([]);
    if (!r.ok) return;
    expect(codeOf(await r.value.listProjects())).toBe("VAULT_LOCKED");
    expect(codeOf(await r.value.save({ project: "p", content: "c" }))).toBe("VAULT_LOCKED");
  });

  it("with Valija unlocked, a save lands in the shared vault with source = client", async () => {
    const vault = await makePassphraseVault(freshRoot());
    RecordingKeychain.store.set(vault.vaultId, vault.keyHex);
    const r = await openVault({ client: CLIENT, vaultRoot: vault.paths.root });
    if (!r.ok) throw new Error(r.error.message);
    const saved = await r.value.save({
      project: "acme-roadmap",
      content: "We ship offline first.",
    });
    expect(saved.ok).toBe(true);
    const shown = buildContainer({ vaultRoot: vault.paths.root }).showProject.execute({
      project: "acme-roadmap",
    });
    expect(shown.ok && shown.value.map((i) => i.source)).toEqual([CLIENT]);
  });

  it("lock() is the global LockVault: the CLI is locked too (D-B)", async () => {
    const vault = await makePassphraseVault(freshRoot());
    RecordingKeychain.store.set(vault.vaultId, vault.keyHex);
    const r = await openVault({ client: CLIENT, vaultRoot: vault.paths.root });
    if (!r.ok) throw new Error(r.error.message);
    expect((await r.value.lock()).ok).toBe(true);
    expect(RecordingKeychain.store.has(vault.vaultId)).toBe(false);
    const status = buildContainer({ vaultRoot: vault.paths.root }).vaultStatus.execute();
    expect(status.ok && status.value.unlocked).toBe(false);
    expect(codeOf(await r.value.listProjects())).toBe("VAULT_LOCKED");
  });

  it("the shared idle TTL expiring deletes the OS key at the next SDK call", async () => {
    const vault = await makePassphraseVault(freshRoot());
    RecordingKeychain.store.set(vault.vaultId, vault.keyHex);
    buildContainer().deviceIdentity.recordActivity(
      vault.vaultId,
      new Date(Date.now() - 16 * 60_000),
    );
    const r = await openVault({ client: CLIENT, vaultRoot: vault.paths.root });
    if (!r.ok) throw new Error(r.error.message);
    expect(codeOf(await r.value.listProjects())).toBe("VAULT_LOCKED");
    expect(RecordingKeychain.store.has(vault.vaultId)).toBe(false);
  });

  it("resolves the vault through VALIJA_HOME when no vaultRoot is given (D-C)", async () => {
    const vault = await makePassphraseVault(freshRoot());
    process.env.VALIJA_HOME = vault.paths.root;
    const r = await openVault({ client: CLIENT });
    expect(r.ok && r.value.vaultId).toBe(vault.vaultId);
  });
});

describe("openVault — Mode P (in process)", () => {
  it("a passphrase opens the vault in process; saves work with no OS keychain call", async () => {
    const vault = await makePassphraseVault(freshRoot());
    const r = await openVault({
      client: CLIENT,
      vaultRoot: vault.paths.root,
      passphrase: TEST_PASSPHRASE,
    });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.mode).toBe("in-process");
    expect(r.value.forkNotice).toBeUndefined();
    expect((await r.value.save({ project: "p", content: "c" })).ok).toBe(true);
    expect(RecordingKeychain.constructions).toBe(0);
    expect(RecordingKeychain.calls).toEqual([]);
  });

  it("the recovery key opens it too, in either case", async () => {
    const vault = await makePassphraseVault(freshRoot());
    for (const recoveryKey of [vault.keyHex, vault.keyHex.toUpperCase()]) {
      const r = await openVault({ client: CLIENT, vaultRoot: vault.paths.root, recoveryKey });
      expect(r.ok && r.value.mode).toBe("in-process");
      if (r.ok) expect((await r.value.listProjects()).ok).toBe(true);
    }
  });

  it.each([
    ["a wrong passphrase", { passphrase: "not the passphrase" }],
    ["a malformed recovery key", { recoveryKey: "abc" }],
    ["a wrong recovery key", { recoveryKey: "0".repeat(64) }],
  ])("%s → WRONG_PASSPHRASE", async (_label, credential) => {
    const vault = await makePassphraseVault(freshRoot());
    const r = await openVault({ client: CLIENT, vaultRoot: vault.paths.root, ...credential });
    expect(codeOf(r)).toBe("WRONG_PASSPHRASE");
  });

  it("both credentials → INVALID_INPUT, before anything runs", async () => {
    const vault = await makePassphraseVault(freshRoot());
    const r = await openVault({
      client: CLIENT,
      vaultRoot: vault.paths.root,
      passphrase: TEST_PASSPHRASE,
      recoveryKey: vault.keyHex,
    } as never);
    expect(codeOf(r)).toBe("INVALID_INPUT");
  });

  it("an invalid client → INVALID_INPUT", async () => {
    expect(codeOf(await openVault({ client: "Acme Notes" }))).toBe("INVALID_INPUT");
  });

  it("two handles are independent: closing one leaves the other open", async () => {
    const vault = await makePassphraseVault(freshRoot());
    const options = { client: CLIENT, vaultRoot: vault.paths.root, passphrase: TEST_PASSPHRASE };
    const one = await openVault(options);
    const two = await openVault(options);
    if (!one.ok || !two.ok) throw new Error("open failed");
    await one.value.close();
    expect(codeOf(await one.value.listProjects())).toBe("VAULT_LOCKED");
    expect((await two.value.listProjects()).ok).toBe(true);
  });

  it("never reads the OS keychain, even when Valija's own session holds the key", async () => {
    const vault = await makePassphraseVault(freshRoot());
    RecordingKeychain.store.set(vault.vaultId, vault.keyHex);
    RecordingKeychain.clearRecord();
    const r = await openVault({
      client: CLIENT,
      vaultRoot: vault.paths.root,
      passphrase: "wrong one",
    });
    expect(codeOf(r)).toBe("WRONG_PASSPHRASE");
    expect(RecordingKeychain.calls).toEqual([]);
    expect(RecordingKeychain.constructions).toBe(0);
  });

  it("a detected fork is a non-fatal forkNotice with valija unlock's wording; nothing is deleted", async () => {
    const vault = await makePassphraseVault(freshRoot());
    const first = await openVault({
      client: CLIENT,
      vaultRoot: vault.paths.root,
      passphrase: TEST_PASSPHRASE,
    });
    if (!first.ok) throw new Error(first.error.message);
    await first.value.save({ project: "p", content: "one" });
    await first.value.close();
    // This device "last saw" a different write at the same generation: provable divergence.
    const cli = buildContainer({ vaultRoot: vault.paths.root });
    RecordingKeychain.store.set(vault.vaultId, vault.keyHex);
    const status = cli.vaultStatus.execute();
    const generation = status.ok ? (status.value.generation ?? 0) : 0;
    cli.deviceIdentity.recordSeen(vault.vaultId, {
      generation: generation as never,
      writeStamp: "01FORKEDSTAMP0000000000000" as WriteStamp,
    });
    const cliUnlock = await cli.unlockVault.execute({ recoveryKeyHex: vault.keyHex });
    const expected = cliUnlock.ok ? cliUnlock.value.fork?.notice.message : undefined;
    expect(expected).toMatch(/another device/);

    const r = await openVault({
      client: CLIENT,
      vaultRoot: vault.paths.root,
      passphrase: TEST_PASSPHRASE,
    });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.forkNotice).toEqual({ generation, message: expected });
    const listed = await r.value.listProjects();
    expect(listed.ok && listed.value.map((p) => p.itemCount)).toEqual([1]);
  });
});

describe("a vault behind this SDK (D-H)", () => {
  async function behindVault() {
    const vault = await makePassphraseVault(freshRoot());
    setStoredSchemaVersion(vault.paths.db, vault.keyHex, LATEST_SCHEMA_VERSION - 1);
    return vault;
  }
  const marker = (v: { paths: { db: string }; keyHex: string }) =>
    probeSchemaVersion(v.paths.db, v.keyHex);

  it("Mode K: every call → VAULT_UPGRADE_REQUIRED; nothing is migrated", async () => {
    const vault = await behindVault();
    RecordingKeychain.store.set(vault.vaultId, vault.keyHex);
    const r = await openVault({ client: CLIENT, vaultRoot: vault.paths.root });
    if (!r.ok) throw new Error(r.error.message);
    expect(codeOf(await r.value.listProjects())).toBe("VAULT_UPGRADE_REQUIRED");
    expect(codeOf(await r.value.save({ project: "p", content: "c" }))).toBe(
      "VAULT_UPGRADE_REQUIRED",
    );
    expect(marker(vault)).toBe(LATEST_SCHEMA_VERSION - 1);
    expect(backups(vault.paths.root)).toEqual([]);
  });

  it("Mode P: the open → VAULT_UPGRADE_REQUIRED; nothing is migrated", async () => {
    const vault = await behindVault();
    const r = await openVault({
      client: CLIENT,
      vaultRoot: vault.paths.root,
      passphrase: TEST_PASSPHRASE,
    });
    expect(codeOf(r)).toBe("VAULT_UPGRADE_REQUIRED");
    expect(marker(vault)).toBe(LATEST_SCHEMA_VERSION - 1);
  });

  it("allowUpgrade migrates through the shared runner, leaving no backup behind", async () => {
    const p = await behindVault();
    const opened = await openVault({
      client: CLIENT,
      vaultRoot: p.paths.root,
      passphrase: TEST_PASSPHRASE,
      allowUpgrade: true,
    });
    expect(opened.ok).toBe(true);
    expect(marker(p)).toBe(LATEST_SCHEMA_VERSION);
    expect(backups(p.paths.root)).toEqual([]);

    const k = await behindVault();
    RecordingKeychain.store.set(k.vaultId, k.keyHex);
    const handle = await openVault({ client: CLIENT, vaultRoot: k.paths.root, allowUpgrade: true });
    if (!handle.ok) throw new Error(handle.error.message);
    expect((await handle.value.listProjects()).ok).toBe(true);
    expect(marker(k)).toBe(LATEST_SCHEMA_VERSION);
    expect(backups(k.paths.root)).toEqual([]);
  });

  it("the CLI still auto-migrates (D-I)", async () => {
    const vault = await behindVault();
    RecordingKeychain.store.set(vault.vaultId, vault.keyHex);
    expect(buildContainer({ vaultRoot: vault.paths.root }).listProjects.execute().ok).toBe(true);
    expect(marker(vault)).toBe(LATEST_SCHEMA_VERSION);
  });
});

describe("createVault (D-D)", () => {
  it("creates only vault.json and vault.db, with valija init's KDF parameters, open in Mode P", async () => {
    const root = freshRoot();
    const r = await createVault({ client: CLIENT, vaultRoot: root, passphrase: STRONG });
    if (!r.ok) throw new Error(r.error.message);
    expect(readdirSync(root).sort()).toEqual(["vault.db", "vault.json"]);
    const header = JSON.parse(readFileSync(join(root, "vault.json"), "utf8"));
    expect(header.kdf).toEqual(DEFAULT_KDF_PARAMS);
    expect(header.vaultId).toBe(r.value.vaultId);
    expect(r.value.vault.mode).toBe("in-process");
    expect(r.value.vault.vaultId).toBe(r.value.vaultId);
    expect((await r.value.vault.save({ project: "p", content: "c" })).ok).toBe(true);
    expect(RecordingKeychain.constructions).toBe(0);
  });

  it("the kit is renderRecoveryKit's text, and its key opens the vault", async () => {
    const root = freshRoot();
    const r = await createVault({ client: CLIENT, vaultRoot: root, passphrase: STRONG });
    if (!r.ok) throw new Error(r.error.message);
    const keyHex = r.value.recoveryKit.match(/\b[0-9a-f]{64}\b/)?.[0] ?? "";
    const header = JSON.parse(readFileSync(join(root, "vault.json"), "utf8"));
    expect(r.value.recoveryKit).toBe(renderRecoveryKit(r.value.vaultId, keyHex, header.createdAt));
    const reopened = await openVault({ client: CLIENT, vaultRoot: root, recoveryKey: keyHex });
    expect(reopened.ok).toBe(true);
  });

  it("an existing vault → VAULT_ALREADY_EXISTS, and its files are untouched", async () => {
    const vault = await makePassphraseVault(freshRoot());
    const before = snapshotVaultFiles(vault.paths);
    const r = await createVault({
      client: CLIENT,
      vaultRoot: vault.paths.root,
      passphrase: STRONG,
    });
    expect(codeOf(r)).toBe("VAULT_ALREADY_EXISTS");
    expect(snapshotVaultFiles(vault.paths)).toEqual(before);
  });

  it("a weak passphrase → WEAK_PASSPHRASE, and no folder is created", async () => {
    const root = freshRoot();
    const r = await createVault({ client: CLIENT, vaultRoot: root, passphrase: "short" });
    expect(codeOf(r)).toBe("WEAK_PASSPHRASE");
    expect(existsSync(root)).toBe(false);
  });

  it("validates the client and the passphrase type", async () => {
    expect(codeOf(await createVault({ client: "", passphrase: STRONG }))).toBe("INVALID_INPUT");
    expect(codeOf(await createVault({ client: CLIENT, passphrase: 7 } as never))).toBe(
      "INVALID_INPUT",
    );
  });
});
