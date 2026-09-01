import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { resolveVaultPaths } from "../shared/infra/vault-paths.js";
import { copyGoldenVaultTo, readGoldenVaultManifest } from "../testing/golden-vault.js";
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
});
