import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Container } from "../../../../../src/delivery/container.js";
import { LATEST_SCHEMA_VERSION } from "../../../../../src/shared/infra/migrations.js";
import { resolveVaultPaths } from "../../../../../src/shared/infra/vault-paths.js";
import {
  FakeDeviceIdentity,
  FakeKeychain,
  FixedClock,
  SeqIds,
} from "../../../../../src/testing/test-vault.js";
import { VaultStatus } from "../../../../../src/vault/application/use-cases/vault-status.use-case.js";
import { parseAutoLockTtl } from "../../../../../src/vault/domain/values/auto-lock-ttl.js";
import { FileVaultFolder } from "../../../../../src/vault/infra/file-vault-folder.js";
import { FileVaultStore } from "../../../../../src/vault/infra/file-vault-store.js";
import type { ClipboardPort } from "../../application/ports/clipboard.js";

vi.mock("electron", () => ({
  app: { getVersion: () => "0.3.0" },
}));

// `runDiagnostics`' `checkKeychain()` constructs a real `OsKeychain` directly
// — without this, `diagnostics:run` here would write/delete a real
// `doctor-probe` entry in the developer's/CI's OS keychain (W1).
vi.mock("../../../../../src/vault/infra/keyring.js", () => ({
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

const { createDiagnosticsHandlers } = await import("./diagnostics-handlers.js");

function containerOver(root: string): Container {
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
  return { paths, folder, vaultStatus } as unknown as Container;
}

function fakeClipboard(): ClipboardPort & { text: string | null } {
  return {
    text: null,
    writeText(text: string) {
      this.text = text;
    },
  };
}

describe("diagnostics-handlers", () => {
  let root: string;

  afterEach(() => {
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  });

  it("diagnostics:run returns runDiagnostics' own checks, unmodified", async () => {
    root = mkdtempSync(join(tmpdir(), "valija-diagnostics-handlers-"));
    const container = containerOver(root);
    const clipboard = fakeClipboard();
    const handlers = createDiagnosticsHandlers(() => container, clipboard);

    const response = await handlers["diagnostics:run"]();

    expect(response.checks.map((c) => c.name)).toEqual([
      "node",
      "sqlcipher",
      "keychain",
      "vault",
      "journal",
      "sync",
      "lineage",
      "auto-lock",
      "claude-code",
      "claude-desktop",
      "cursor",
    ]);
  });

  it("diagnostics:copyReport writes an English report built from the given checks, the app version, and the vault's paths/schema — never recomputing the checks itself", async () => {
    root = mkdtempSync(join(tmpdir(), "valija-diagnostics-handlers-"));
    const container = containerOver(root);
    const clipboard = fakeClipboard();
    const handlers = createDiagnosticsHandlers(() => container, clipboard);

    handlers["diagnostics:copyReport"]({
      checks: [{ name: "node", ok: true, detail: "v22.22.2 (need >=22)", fatal: true }],
    });

    expect(clipboard.text).toContain("App version: 0.3.0");
    expect(clipboard.text).toContain(`App schema version (latest known): ${LATEST_SCHEMA_VERSION}`);
    expect(clipboard.text).toContain(`Vault path: ${root}`);
    expect(clipboard.text).toContain("[OK] node: v22.22.2 (need >=22)");
    // Generation is unknown on a fresh, uninitialized vault — never thrown over.
    expect(clipboard.text).toContain("Generation: unknown");
  });

  it("diagnostics:copyReport never re-runs the disclosed keychain probe — it never calls runDiagnostics itself", async () => {
    root = mkdtempSync(join(tmpdir(), "valija-diagnostics-handlers-"));
    const container = containerOver(root);
    const clipboard = fakeClipboard();
    const handlers = createDiagnosticsHandlers(() => container, clipboard);

    // Passing an empty checks array proves the handler doesn't call
    // runDiagnostics (and therefore doesn't re-run checkKeychain's
    // write-and-delete probe) itself — it only formats whatever the renderer
    // already fetched. It does call `vaultStatus.execute()` again, for the
    // report's `generation` field — that's a plain keychain *read*, not the
    // disclosed probe, and is covered by the "unlocked" assertions in the
    // handler-level golden-fixture test.
    handlers["diagnostics:copyReport"]({ checks: [] });

    expect(clipboard.text).toContain("Checks:");
    expect(clipboard.text?.trim().endsWith("Checks:")).toBe(true);
  });
});
