import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveVaultPaths, type VaultPaths } from "../../../shared/infra/vault-paths.js";
import { copyGoldenVaultTo, readGoldenVaultManifest } from "../../../testing/golden-vault.js";
import { FakeKeychain, FixedClock, SeqIds } from "../../../testing/test-vault.js";
import { FileVaultFolder } from "../../infra/file-vault-folder.js";
import { FileVaultMover } from "../../infra/file-vault-mover.js";
import { FileVaultStore } from "../../infra/file-vault-store.js";
import { writeVaultHeader } from "../../infra/vault-header.js";
import type { VaultFolderInspection } from "../ports/vault-folder.js";
import type { VaultMover, VaultRootInspection } from "../ports/vault-mover.js";
import { RelocateVault } from "./relocate-vault.use-case.js";

const CLEAN_SOURCE_INSPECTION: VaultFolderInspection = {
  sidecars: [],
  conflictedCopies: [],
  staleBackups: [],
  looksLikeCloud: false,
};

const EMPTY_WRITABLE_DESTINATION: VaultRootInspection = {
  exists: true,
  writable: true,
  hasHeader: false,
  hasDb: false,
};

class FakeVaultFolder {
  constructor(private readonly inspection: VaultFolderInspection) {}
  inspect(): VaultFolderInspection {
    return this.inspection;
  }
}

class FakeVaultMover implements VaultMover {
  inspectResult: VaultRootInspection = EMPTY_WRITABLE_DESTINATION;
  matchesResult = true;
  throwOnCopy = false;
  throwOnRemove = false;
  throwOnDiscard = false;

  copyCalls: Array<{ from: VaultPaths; to: VaultPaths }> = [];
  matchesCalls: Array<{ from: VaultPaths; to: VaultPaths }> = [];
  discardCalls: VaultPaths[] = [];
  removeCalls: VaultPaths[] = [];

  inspect(): VaultRootInspection {
    return this.inspectResult;
  }

  copy(from: VaultPaths, to: VaultPaths): void {
    this.copyCalls.push({ from, to });
    if (this.throwOnCopy) throw new Error("simulated copy failure");
  }

  matches(from: VaultPaths, to: VaultPaths): boolean {
    this.matchesCalls.push({ from, to });
    return this.matchesResult;
  }

  discard(paths: VaultPaths): void {
    this.discardCalls.push(paths);
    if (this.throwOnDiscard) throw new Error("simulated discard failure");
  }

  remove(paths: VaultPaths): void {
    this.removeCalls.push(paths);
    if (this.throwOnRemove) throw new Error("simulated remove failure");
  }
}

const tmpRoots: string[] = [];
afterEach(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
  tmpRoots.length = 0;
});

function tempDir(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), `valija-relocate-${prefix}-`));
  tmpRoots.push(root);
  return root;
}

/** A locked, header-only vault — enough for RelocateVault's own reads; the db content is irrelevant to these orchestration tests. */
function makeLockedSourceStore(sourceRoot: string, vaultId = "01RELOCATESRC") {
  const paths = resolveVaultPaths(sourceRoot);
  writeVaultHeader(paths.header, {
    vaultId,
    schemaVersion: 1,
    kdf: { algorithm: "argon2id", memoryKiB: 8192, iterations: 1, parallelism: 1 },
    salt: new Uint8Array(16),
    createdAt: "2026-08-20T00:00:00Z",
  });
  const idGen = new SeqIds();
  const clock = new FixedClock();
  const store = new FileVaultStore(paths, idGen, clock);
  return { paths, store };
}

describe("RelocateVault — orchestration (fake VaultMover)", () => {
  it("refuses VAULT_MUST_BE_LOCKED when the keychain still holds the key — copy is never attempted", () => {
    const sourceRoot = tempDir("locked-check-src");
    const { paths, store } = makeLockedSourceStore(sourceRoot, "01UNLOCKEDVAULT");
    const keychain = new FakeKeychain();
    keychain.setKey("01UNLOCKEDVAULT", "deadbeef".repeat(8));
    const mover = new FakeVaultMover();
    const folder = new FakeVaultFolder(CLEAN_SOURCE_INSPECTION);
    const relocate = new RelocateVault(store, keychain, mover, folder, paths);

    const result = relocate.execute(tempDir("locked-check-dest"));

    expect(!result.ok && result.error.code).toBe("VAULT_MUST_BE_LOCKED");
    expect(mover.copyCalls).toHaveLength(0);
  });

  it("a refuseUnsafeRelocation refusal fires before any write — an occupied destination is refused, copy never called", () => {
    const sourceRoot = tempDir("occupied-src");
    const { paths, store } = makeLockedSourceStore(sourceRoot);
    const keychain = new FakeKeychain();
    const mover = new FakeVaultMover();
    mover.inspectResult = { ...EMPTY_WRITABLE_DESTINATION, hasHeader: true };
    const folder = new FakeVaultFolder(CLEAN_SOURCE_INSPECTION);
    const relocate = new RelocateVault(store, keychain, mover, folder, paths);

    const result = relocate.execute(tempDir("occupied-dest"));

    expect(!result.ok && result.error.code).toBe("RELOCATION_DESTINATION_OCCUPIED");
    expect(mover.copyCalls).toHaveLength(0);
  });

  it("refuses while the source has an unresolved fork artifact — copy never called", () => {
    const sourceRoot = tempDir("fork-src");
    const { paths, store } = makeLockedSourceStore(sourceRoot);
    const keychain = new FakeKeychain();
    const mover = new FakeVaultMover();
    const folder = new FakeVaultFolder({
      ...CLEAN_SOURCE_INSPECTION,
      conflictedCopies: [join(sourceRoot, "vault (conflicted copy).db")],
    });
    const relocate = new RelocateVault(store, keychain, mover, folder, paths);

    const result = relocate.execute(tempDir("fork-dest"));

    expect(!result.ok && result.error.code).toBe("RELOCATION_SOURCE_UNSETTLED");
    expect(mover.copyCalls).toHaveLength(0);
  });

  it("a copy failure discards the destination, reports RELOCATION_COPY_FAILED, and never calls remove", () => {
    const sourceRoot = tempDir("copy-fail-src");
    const { paths, store } = makeLockedSourceStore(sourceRoot);
    const keychain = new FakeKeychain();
    const mover = new FakeVaultMover();
    mover.throwOnCopy = true;
    const folder = new FakeVaultFolder(CLEAN_SOURCE_INSPECTION);
    const relocate = new RelocateVault(store, keychain, mover, folder, paths);

    const result = relocate.execute(tempDir("copy-fail-dest"));

    expect(!result.ok && result.error.code).toBe("RELOCATION_COPY_FAILED");
    expect(mover.discardCalls).toHaveLength(1);
    expect(mover.removeCalls).toHaveLength(0);
  });

  it("a verify failure (digest mismatch) discards the destination, reports RELOCATION_VERIFY_FAILED, and never calls remove", () => {
    const sourceRoot = tempDir("verify-fail-src");
    const { paths, store } = makeLockedSourceStore(sourceRoot);
    const keychain = new FakeKeychain();
    const mover = new FakeVaultMover();
    mover.matchesResult = false;
    const folder = new FakeVaultFolder(CLEAN_SOURCE_INSPECTION);
    const relocate = new RelocateVault(store, keychain, mover, folder, paths);

    const result = relocate.execute(tempDir("verify-fail-dest"));

    expect(!result.ok && result.error.code).toBe("RELOCATION_VERIFY_FAILED");
    expect(mover.discardCalls).toHaveLength(1);
    expect(mover.removeCalls).toHaveLength(0);
  });

  it("a source-removal failure rolls back: discards the destination, keeps the source, reports RELOCATION_COPY_FAILED naming the source", () => {
    const sourceRoot = tempDir("remove-fail-src");
    const { paths, store } = makeLockedSourceStore(sourceRoot);
    const keychain = new FakeKeychain();
    const mover = new FakeVaultMover();
    mover.throwOnRemove = true;
    const folder = new FakeVaultFolder(CLEAN_SOURCE_INSPECTION);
    const destinationRoot = tempDir("remove-fail-dest");
    // The destination's header must be real and valid for readVaultHeader
    // to succeed before the (faked) remove() call is reached.
    const destinationPaths = resolveVaultPaths(destinationRoot);
    writeVaultHeader(destinationPaths.header, {
      vaultId: "01RELOCATESRC",
      schemaVersion: 1,
      kdf: { algorithm: "argon2id", memoryKiB: 8192, iterations: 1, parallelism: 1 },
      salt: new Uint8Array(16),
      createdAt: "2026-08-20T00:00:00Z",
    });
    const relocate = new RelocateVault(store, keychain, mover, folder, paths);

    const result = relocate.execute(destinationRoot);

    expect(!result.ok && result.error.code).toBe("RELOCATION_COPY_FAILED");
    expect(!result.ok && result.error.message).toContain(sourceRoot);
    expect(mover.discardCalls).toHaveLength(1);
    expect(mover.discardCalls[0]?.root).toBe(destinationRoot);
  });

  it("if the rollback discard also fails, reports RELOCATION_ROLLBACK_FAILED naming both folders", () => {
    const sourceRoot = tempDir("rollback-fail-src");
    const { paths, store } = makeLockedSourceStore(sourceRoot);
    const keychain = new FakeKeychain();
    const mover = new FakeVaultMover();
    mover.throwOnRemove = true;
    mover.throwOnDiscard = true;
    const folder = new FakeVaultFolder(CLEAN_SOURCE_INSPECTION);
    const destinationRoot = tempDir("rollback-fail-dest");
    const destinationPaths = resolveVaultPaths(destinationRoot);
    writeVaultHeader(destinationPaths.header, {
      vaultId: "01RELOCATESRC",
      schemaVersion: 1,
      kdf: { algorithm: "argon2id", memoryKiB: 8192, iterations: 1, parallelism: 1 },
      salt: new Uint8Array(16),
      createdAt: "2026-08-20T00:00:00Z",
    });
    const relocate = new RelocateVault(store, keychain, mover, folder, paths);

    const result = relocate.execute(destinationRoot);

    expect(!result.ok && result.error.code).toBe("RELOCATION_ROLLBACK_FAILED");
    expect(!result.ok && result.error.message).toContain(sourceRoot);
    expect(!result.ok && result.error.message).toContain(destinationRoot);
  });

  it("a successful move calls remove on the source and returns the destination root and vault id", () => {
    const sourceRoot = tempDir("happy-src");
    const { paths, store } = makeLockedSourceStore(sourceRoot, "01HAPPYVAULT");
    const keychain = new FakeKeychain();
    const mover = new FakeVaultMover();
    const folder = new FakeVaultFolder(CLEAN_SOURCE_INSPECTION);
    const destinationRoot = tempDir("happy-dest");
    const destinationPaths = resolveVaultPaths(destinationRoot);
    writeVaultHeader(destinationPaths.header, {
      vaultId: "01HAPPYVAULT",
      schemaVersion: 1,
      kdf: { algorithm: "argon2id", memoryKiB: 8192, iterations: 1, parallelism: 1 },
      salt: new Uint8Array(16),
      createdAt: "2026-08-20T00:00:00Z",
    });
    const relocate = new RelocateVault(store, keychain, mover, folder, paths);

    const result = relocate.execute(destinationRoot);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ root: destinationRoot, vaultId: "01HAPPYVAULT" });
    }
    expect(mover.removeCalls).toHaveLength(1);
    expect(mover.removeCalls[0]?.root).toBe(sourceRoot);
  });
});

describe("RelocateVault — a real move on a real filesystem (golden vault, FileVaultMover)", () => {
  it("after a successful move, the old folder has neither vault file, and the vault opens at the new location with the same passphrase, vault id, and lineage generation", () => {
    const manifest = readGoldenVaultManifest();
    const sourceRoot = tempDir("real-move-src");
    const referenceRoot = tempDir("real-move-reference");
    copyGoldenVaultTo(sourceRoot);
    copyGoldenVaultTo(referenceRoot); // untouched copy, read only for the "expected" generation

    const idGen = new SeqIds();
    const clock = new FixedClock();
    const sourcePaths = resolveVaultPaths(sourceRoot);
    const store = new FileVaultStore(sourcePaths, idGen, clock);
    const referenceStore = new FileVaultStore(resolveVaultPaths(referenceRoot), idGen, clock);
    const expectedLineage = referenceStore.readLineage(manifest.keyHex);
    expect(expectedLineage.ok).toBe(true);

    const keychain = new FakeKeychain(); // empty — the vault is locked
    const folder = new FileVaultFolder(sourcePaths);
    const mover = new FileVaultMover();
    const relocate = new RelocateVault(store, keychain, mover, folder, sourcePaths);

    // A native folder picker only ever offers an *existing* directory
    // (§8.6) — the destination here is one, exactly like a real one would be.
    const destinationRoot = tempDir("real-move-dest");
    const result = relocate.execute(destinationRoot);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.vaultId).toBe(manifest.vaultId);
    expect(result.value.root).toBe(destinationRoot);

    expect(existsSync(sourcePaths.header)).toBe(false);
    expect(existsSync(sourcePaths.db)).toBe(false);

    const destinationPaths = resolveVaultPaths(destinationRoot);
    const destinationStore = new FileVaultStore(destinationPaths, idGen, clock);
    const verifyKey = destinationStore.verifyKey(manifest.keyHex);
    expect(verifyKey.ok).toBe(true);

    const movedLineage = destinationStore.readLineage(manifest.keyHex);
    expect(movedLineage.ok).toBe(true);
    if (movedLineage.ok && expectedLineage.ok) {
      expect(movedLineage.value).toEqual(expectedLineage.value);
    }
  });
});
