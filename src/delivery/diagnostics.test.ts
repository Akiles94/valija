import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LATEST_SCHEMA_VERSION } from "../shared/infra/migrations.js";
import { resolveVaultPaths } from "../shared/infra/vault-paths.js";
import { copyGoldenVaultTo, readGoldenVaultManifest } from "../testing/golden-vault.js";
import { setStoredSchemaVersion } from "../testing/schema-skew.js";
import { FakeDeviceIdentity, FakeKeychain, FixedClock, SeqIds } from "../testing/test-vault.js";
import { VaultStatus } from "../vault/application/use-cases/vault-status.use-case.js";
import { parseAutoLockTtl } from "../vault/domain/values/auto-lock-ttl.js";
import { FileVaultFolder } from "../vault/infra/file-vault-folder.js";
import { FileVaultStore } from "../vault/infra/file-vault-store.js";
import { CLIENTS } from "./cli/installer.js";
import type { Container } from "./container.js";
import { runDiagnostics } from "./diagnostics.js";

// `checkKeychain()` constructs a real `OsKeychain` directly (inherited from
// `doctor.ts`, not injected) — without this, every run here would write and
// delete a real `doctor-probe` entry in the developer's/CI's OS keychain,
// which can raise a real macOS ACL prompt during a plain `npm test` (W1).
// The fake still exercises the same roundtrip logic `checkKeychain` checks.
vi.mock("../vault/infra/keyring.js", () => ({
  OsKeychain: class {
    private store = new Map<string, string>();
    setKey(id: string, value: string) {
      this.store.set(id, value);
    }
    getKey(id: string) {
      return this.store.get(id) ?? null;
    }
    deleteKey(id: string) {
      return this.store.delete(id);
    }
  },
}));

const tmpHome = mkdtempSync(join(tmpdir(), "valija-diagnostics-home-"));
const originalHome = process.env.HOME;
beforeAll(() => {
  process.env.HOME = tmpHome;
});
afterAll(() => {
  rmSync(tmpHome, { recursive: true, force: true });
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
});

const EXPECTED_NAMES = [
  "node",
  "sqlcipher",
  "keychain",
  "vault",
  "journal",
  "sync",
  "lineage",
  "auto-lock",
  ...CLIENTS,
];

function containerOver(root: string, deps: Partial<Container> = {}): Container {
  const paths = resolveVaultPaths(root);
  const store = new FileVaultStore(paths, new SeqIds(), new FixedClock());
  const keychain = new FakeKeychain();
  const deviceIdentity = new FakeDeviceIdentity(new SeqIds());
  const folder = new FileVaultFolder(paths);
  const vaultStatus = new VaultStatus(
    store,
    keychain,
    deviceIdentity,
    folder,
    new FixedClock(),
    parseAutoLockTtl(undefined),
  );
  return { paths, folder, vaultStatus, ...deps } as unknown as Container;
}

describe("runDiagnostics", () => {
  let root: string;

  afterEach(() => {
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  });

  it("returns the same check names, in the same order, doctor.ts always printed — including one row per client", async () => {
    root = mkdtempSync(join(tmpdir(), "valija-diagnostics-"));
    const container = containerOver(root);

    const checks = await runDiagnostics(container);

    expect(checks.map((c) => c.name)).toEqual(EXPECTED_NAMES);
  });

  it("reports an uninitialized vault plainly, without throwing", async () => {
    root = mkdtempSync(join(tmpdir(), "valija-diagnostics-"));
    const container = containerOver(root);

    const checks = await runDiagnostics(container);
    const vaultCheck = checks.find((c) => c.name === "vault");

    expect(vaultCheck?.ok).toBe(false);
    expect(vaultCheck?.detail).toContain("not initialized");
  });

  it("reports an unlocked, at-rest golden vault with its real lineage", async () => {
    root = mkdtempSync(join(tmpdir(), "valija-diagnostics-golden-"));
    const manifest = readGoldenVaultManifest();
    copyGoldenVaultTo(root);
    const paths = resolveVaultPaths(root);
    const store = new FileVaultStore(paths, new SeqIds(), new FixedClock());
    const keychain = new FakeKeychain();
    keychain.setKey(manifest.vaultId, manifest.keyHex);
    const deviceIdentity = new FakeDeviceIdentity(new SeqIds());
    const folder = new FileVaultFolder(paths);
    const clock = new FixedClock(new Date(manifest.generatedAt));
    const vaultStatus = new VaultStatus(
      store,
      keychain,
      deviceIdentity,
      folder,
      clock,
      parseAutoLockTtl(undefined),
    );
    const container = { paths, folder, vaultStatus } as unknown as Container;

    const checks = await runDiagnostics(container);

    const vaultCheck = checks.find((c) => c.name === "vault");
    expect(vaultCheck?.ok).toBe(true);
    expect(vaultCheck?.detail).toContain("unlocked");

    const journalCheck = checks.find((c) => c.name === "journal");
    expect(journalCheck?.ok).toBe(true);
    expect(journalCheck?.detail).toContain("single file at rest");

    const lineageCheck = checks.find((c) => c.name === "lineage");
    expect(lineageCheck?.ok).toBe(true);
    expect(lineageCheck?.detail).toContain("generation");
  });

  it("flags a leftover pre-rekey backup on the sync row — not fatal — with the locked-vault advice", async () => {
    root = mkdtempSync(join(tmpdir(), "valija-diagnostics-rekey-"));
    copyGoldenVaultTo(root);
    const backup = join(root, "vault.db.pre-rekey.bak");
    writeFileSync(backup, "x");

    const checks = await runDiagnostics(containerOver(root));

    const sync = checks.find((c) => c.name === "sync");
    expect(sync?.ok).toBe(false);
    expect(sync?.fatal).toBeUndefined();
    expect(sync?.detail).toContain("PREVIOUS");
    expect(sync?.detail).toContain(backup);
    expect(sync?.detail).toContain('if "valija unlock" works with your current passphrase');
    expect(checks.map((c) => c.name)).toEqual(EXPECTED_NAMES);
  });

  it("shortens the pre-rekey advice to 'delete it' when the vault is unlocked", async () => {
    root = mkdtempSync(join(tmpdir(), "valija-diagnostics-rekey-unlocked-"));
    const manifest = readGoldenVaultManifest();
    copyGoldenVaultTo(root);
    writeFileSync(join(root, "vault.db.pre-rekey.bak"), "x");
    const paths = resolveVaultPaths(root);
    const keychain = new FakeKeychain();
    keychain.setKey(manifest.vaultId, manifest.keyHex);
    const folder = new FileVaultFolder(paths);
    const vaultStatus = new VaultStatus(
      new FileVaultStore(paths, new SeqIds(), new FixedClock()),
      keychain,
      new FakeDeviceIdentity(new SeqIds()),
      folder,
      new FixedClock(new Date(manifest.generatedAt)),
      parseAutoLockTtl(undefined),
    );

    const checks = await runDiagnostics({ paths, folder, vaultStatus } as unknown as Container);

    const sync = checks.find((c) => c.name === "sync");
    expect(sync?.ok).toBe(false);
    expect(sync?.detail).toContain("PREVIOUS");
    expect(sync?.detail).toContain("the vault opens with your current key — delete it");
    expect(sync?.detail).not.toContain("restore it");
  });

  it("carries the DomainError code alongside the message when VaultStatus fails, on every status-derived check", async () => {
    root = mkdtempSync(join(tmpdir(), "valija-diagnostics-corrupt-"));
    const paths = resolveVaultPaths(root);
    mkdirSync(paths.root, { recursive: true });
    writeFileSync(paths.header, "not valid json", "utf8");
    const container = containerOver(root);

    const checks = await runDiagnostics(container);

    for (const name of ["vault", "journal", "lineage", "auto-lock"]) {
      const check = checks.find((c) => c.name === name);
      expect(check?.ok).toBe(false);
      expect(check?.errorCode).toBe("STORAGE_ERROR");
      expect(check?.detail.length).toBeGreaterThan(0);
    }
  });

  it("reports every AI-client check as not-found in a fresh HOME, never throwing", async () => {
    root = mkdtempSync(join(tmpdir(), "valija-diagnostics-"));
    const container = containerOver(root);

    const checks = await runDiagnostics(container);

    for (const client of CLIENTS) {
      const clientCheck = checks.find((c) => c.name === client);
      expect(clientCheck?.ok).toBe(false);
      expect(clientCheck?.detail).toBe("config not found");
    }
  });

  it("reports a vault newer than this valija on the vault row — not fatal — and skips the lineage", async () => {
    root = mkdtempSync(join(tmpdir(), "valija-diagnostics-newer-"));
    const manifest = readGoldenVaultManifest();
    copyGoldenVaultTo(root);
    const paths = resolveVaultPaths(root);
    setStoredSchemaVersion(paths.db, manifest.keyHex, LATEST_SCHEMA_VERSION + 1);
    const keychain = new FakeKeychain();
    keychain.setKey(manifest.vaultId, manifest.keyHex);
    const folder = new FileVaultFolder(paths);
    const vaultStatus = new VaultStatus(
      new FileVaultStore(paths, new SeqIds(), new FixedClock()),
      keychain,
      new FakeDeviceIdentity(new SeqIds()),
      folder,
      new FixedClock(),
      parseAutoLockTtl(undefined),
    );
    const container = { paths, folder, vaultStatus } as unknown as Container;

    const checks = await runDiagnostics(container);

    expect(checks.map((c) => c.name)).toEqual(EXPECTED_NAMES);
    const vaultCheck = checks.find((c) => c.name === "vault");
    expect(vaultCheck).toEqual({
      name: "vault",
      ok: false,
      detail: `schema v${LATEST_SCHEMA_VERSION + 1} is newer than this valija (supports v${LATEST_SCHEMA_VERSION}) — update valija`,
      errorCode: "VAULT_SCHEMA_TOO_NEW",
    });
    expect(vaultCheck?.fatal).toBeUndefined();
    const lineageCheck = checks.find((c) => c.name === "lineage");
    expect(lineageCheck?.detail).toBe("not read — the vault's schema is newer than this valija");
  });
});
