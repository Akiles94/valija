import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Container } from "../../../../../src/delivery/container.js";
import {
  copyGoldenVaultTo,
  readGoldenVaultManifest,
  readGoldenVaultSeed,
} from "../../../../../src/testing/golden-vault.js";
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
// `doctor-probe` entry in the developer's/CI's OS keychain (W1). This is
// separate from the `FakeKeychain` below, which stands in for the vault's
// own key.
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

function fakeClipboard(): ClipboardPort & { text: string | null } {
  return {
    text: null,
    writeText(text: string) {
      this.text = text;
    },
  };
}

/**
 * Plan item 81's own named test: "a test asserts the payload contains none
 * of the golden vault's item strings." Runs the real `diagnostics:run` →
 * `diagnostics:copyReport` sequence against an unlocked, seeded golden
 * vault — the one arrangement where the report *could* leak vault content
 * if `buildDiagnosticsReport` ever grew a field that read from the vault
 * store rather than from the fields the plan documents (checks, versions,
 * OS, vault path, schema version, generation).
 */
describe("diagnostics:copyReport's payload against a real, seeded golden vault", () => {
  let root: string;

  afterEach(() => {
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  });

  it("carries none of the golden vault's project names or item content", async () => {
    root = mkdtempSync(join(tmpdir(), "valija-diagnostics-golden-"));
    const manifest = readGoldenVaultManifest();
    const seed = readGoldenVaultSeed();
    const paths = copyGoldenVaultTo(root);

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
    const clipboard = fakeClipboard();
    const handlers = createDiagnosticsHandlers(() => container, clipboard);

    const { checks } = await handlers["diagnostics:run"]();
    handlers["diagnostics:copyReport"]({ checks });

    expect(clipboard.text).not.toBeNull();
    const report = clipboard.text ?? "";

    for (const project of seed.projects) {
      // A word-boundary match, not a plain substring: the fixture's project
      // names ("alpha", "beta") are short enough that a plain `.toContain`
      // could coincidentally match an unrelated fragment (a path, a version
      // string) and make this assertion either vacuous or spuriously red.
      expect(report).not.toMatch(new RegExp(`\\b${project.name}\\b`, "i"));
    }
    for (const item of seed.items) {
      // A short/common substring could coincidentally appear in unrelated
      // report text (a path, a version string) — item bodies in the fixture
      // are long enough that a real leak, not a coincidence, is what this
      // would catch.
      expect(report).not.toContain(item.content);
    }
  });
});
