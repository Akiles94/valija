import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Container } from "../../../../../src/delivery/container.js";
import { resolveVaultPaths } from "../../../../../src/shared/infra/vault-paths.js";
import { FileVaultFolder } from "../../../../../src/vault/infra/file-vault-folder.js";
import { createSyncHandlers } from "./sync-handlers.js";

describe("sync-handlers — the read-only half of the Sync panel vault:status doesn't carry", () => {
  let root: string;

  afterEach(() => {
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  });

  it("reports no conflicts and no stale backups for a clean vault folder", () => {
    root = mkdtempSync(join(tmpdir(), "valija-sync-clean-"));
    const paths = resolveVaultPaths(root);
    // biome-ignore lint/suspicious/noExplicitAny: only folder is exercised here
    const container = { folder: new FileVaultFolder(paths) } as any as Container;

    const handlers = createSyncHandlers(() => container);
    const response = handlers["sync:status"]();

    expect(response.conflictedCopies).toEqual([]);
    expect(response.staleBackups).toEqual([]);
    expect(typeof response.resolvedStateHome).toBe("string");
    expect(response.resolvedStateHome.length).toBeGreaterThan(0);
  });

  it("surfaces a conflicted-copy file and a stale backup FileVaultFolder finds on disk", () => {
    root = mkdtempSync(join(tmpdir(), "valija-sync-dirty-"));
    const paths = resolveVaultPaths(root);
    writeFileSync(paths.db, "not a real db");
    writeFileSync(join(root, "vault (conflicted copy).db"), "conflict");
    writeFileSync(join(root, "vault.db.pre-002.bak"), "stale backup");

    // biome-ignore lint/suspicious/noExplicitAny: only folder is exercised here
    const container = { folder: new FileVaultFolder(paths) } as any as Container;
    const handlers = createSyncHandlers(() => container);
    const response = handlers["sync:status"]();

    expect(response.conflictedCopies.length).toBe(1);
    expect(response.staleBackups.length).toBe(1);
  });

  it("resolves VALIJA_STATE_HOME the same way the CLI does, honoring an override", () => {
    root = mkdtempSync(join(tmpdir(), "valija-sync-state-"));
    const paths = resolveVaultPaths(root);
    // biome-ignore lint/suspicious/noExplicitAny: only folder is exercised here
    const container = { folder: new FileVaultFolder(paths) } as any as Container;
    const handlers = createSyncHandlers(() => container);

    const overriddenHome = join(root, "custom-state-home");
    const previous = process.env.VALIJA_STATE_HOME;
    process.env.VALIJA_STATE_HOME = overriddenHome;
    try {
      const response = handlers["sync:status"]();
      expect(response.resolvedStateHome).toBe(overriddenHome);
    } finally {
      if (previous === undefined) {
        delete process.env.VALIJA_STATE_HOME;
      } else {
        process.env.VALIJA_STATE_HOME = previous;
      }
    }
  });
});
