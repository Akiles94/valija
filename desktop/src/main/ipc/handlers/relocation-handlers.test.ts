import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientConfigPath, installIntoClient } from "../../../../../src/delivery/cli/installer.js";
import type { Container } from "../../../../../src/delivery/container.js";
import { makeUnlockedVault } from "../../../../../src/testing/test-vault.js";
import { LockVault } from "../../../../../src/vault/application/use-cases/lock-vault.use-case.js";
import { RelocateVault } from "../../../../../src/vault/application/use-cases/relocate-vault.use-case.js";
import { FileVaultFolder } from "../../../../../src/vault/infra/file-vault-folder.js";
import { FileVaultMover } from "../../../../../src/vault/infra/file-vault-mover.js";
import type {
  AppPreferences,
  AppPreferencesStore,
} from "../../application/ports/app-preferences.js";
import type { FilePicker } from "../../application/ports/file-picker.js";
import { createRelocationHandlers } from "./relocation-handlers.js";

// clientConfigPath resolves against homedir() — redirect HOME for this file
// only, exactly like installer.test.ts, so nothing here ever touches a real
// config on the machine running the suite.
const tmpHome = mkdtempSync(join(tmpdir(), "valija-relocation-home-"));
const originalHome = process.env.HOME;
process.env.HOME = tmpHome;
afterAll(() => {
  rmSync(tmpHome, { recursive: true, force: true });
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
});

const tmpRoots: string[] = [];
afterEach(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
  tmpRoots.length = 0;
});

function tempDir(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), `valija-relocation-${prefix}-`));
  tmpRoots.push(root);
  return root;
}

/** clientConfigPath's directory (e.g. ~/.cursor/) may not exist yet in a fresh temp HOME. */
function writeRawClientConfig(configPath: string, content: string): void {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, content);
}

function makePreferencesStore(): AppPreferencesStore & { written: AppPreferences[] } {
  const written: AppPreferences[] = [];
  let current: AppPreferences = {
    vaultPath: null,
    theme: "system",
    language: "system",
    tourSeen: false,
  };
  return {
    written,
    read: () => current,
    write: (next) => {
      current = next;
      written.push(next);
    },
  };
}

function makeFilePicker(handleToPath: Record<string, string>): FilePicker {
  return {
    chooseImportFile: () => null,
    chooseExportTarget: () => null,
    chooseVaultFolder: () => null,
    resolveHandle: (handle) => handleToPath[handle],
  };
}

/** A real locked vault (unlocked vault, then locked) with a real header + db to copy. */
function makeLockedVaultContainer() {
  const vault = makeUnlockedVault();
  vault.keychain.deleteKey(vault.vaultId); // start locked
  const folder = new FileVaultFolder(vault.paths);
  const mover = new FileVaultMover();
  const container = {
    paths: vault.paths,
    folder,
    mover,
    lockVault: new LockVault(vault.store, vault.keychain, folder, vault.deviceIdentity),
    relocateVault: new RelocateVault(vault.store, vault.keychain, mover, folder, vault.paths),
    // biome-ignore lint/suspicious/noExplicitAny: only the fields above are exercised by relocation-handlers.ts
  } as any as Container;
  return { vault, container };
}

describe("relocation-handlers — preflight lists exactly the clients currently in mcpServers", () => {
  beforeEach(() => {
    for (const client of ["claude-code", "claude-desktop", "cursor"] as const) {
      rmSync(clientConfigPath(client), { force: true });
    }
  });

  it("reports connected, not-connected, and unreadable clients correctly, and a refusal when the destination is occupied", () => {
    installIntoClient("claude-code", "/old/vault");
    // claude-desktop: no config at all → not connected.
    writeRawClientConfig(clientConfigPath("cursor"), "{ not valid json");

    const { container } = makeLockedVaultContainer();
    const destinationRoot = tempDir("preflight-dest");
    writeFileSync(join(destinationRoot, "vault.json"), "{}"); // occupied

    const handlers = createRelocationHandlers(
      () => container,
      vi.fn(),
      makePreferencesStore(),
      makeFilePicker({ h1: destinationRoot }),
    );

    const result = handlers["relocation:preflight"]({ handle: "h1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.refusalCode).toBe("RELOCATION_DESTINATION_OCCUPIED");

    const byClient = Object.fromEntries(result.value.clients.map((c) => [c.client, c]));
    expect(byClient["claude-code"]).toEqual({
      client: "claude-code",
      currentlyConnected: true,
      configUnreadable: false,
    });
    expect(byClient["claude-desktop"]).toEqual({
      client: "claude-desktop",
      currentlyConnected: false,
      configUnreadable: false,
    });
    expect(byClient.cursor).toEqual({
      client: "cursor",
      currentlyConnected: false,
      configUnreadable: true,
    });
  });

  it("reports no refusal for a clean, empty, writable destination", () => {
    const { container } = makeLockedVaultContainer();
    const destinationRoot = tempDir("preflight-clean-dest");

    const handlers = createRelocationHandlers(
      () => container,
      vi.fn(),
      makePreferencesStore(),
      makeFilePicker({ h1: destinationRoot }),
    );

    const result = handlers["relocation:preflight"]({ handle: "h1" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.refusalCode).toBeNull();
  });
});

describe("relocation-handlers — relocation:move orchestration", () => {
  beforeEach(() => {
    for (const client of ["claude-code", "claude-desktop", "cursor"] as const) {
      rmSync(clientConfigPath(client), { force: true });
    }
  });

  it("a successful move locks, relocates, remembers the new location, and re-points every currently-connected client individually", () => {
    installIntoClient("claude-code", "/old/vault");
    installIntoClient("claude-desktop", "/old/vault");
    writeRawClientConfig(clientConfigPath("cursor"), "{ not valid json");
    // claude-desktop's own move should succeed even though cursor's config is broken.

    const { container } = makeLockedVaultContainer();
    const destinationRoot = tempDir("move-dest");
    const preferencesStore = makePreferencesStore();
    const rebuildContainer = vi.fn();

    const handlers = createRelocationHandlers(
      () => container,
      rebuildContainer,
      preferencesStore,
      makeFilePicker({ h1: destinationRoot }),
    );

    const result = handlers["relocation:move"]({ handle: "h1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.root).toBe(destinationRoot);
    expect(existsSync(container.paths.header)).toBe(false);
    expect(existsSync(container.paths.db)).toBe(false);

    expect(preferencesStore.written).toHaveLength(1);
    expect(preferencesStore.written[0]?.vaultPath).toBe(destinationRoot);
    expect(rebuildContainer).toHaveBeenCalledWith(destinationRoot);

    const byClient = Object.fromEntries(result.value.clientResults.map((r) => [r.client, r]));
    expect(byClient["claude-code"]?.outcome).toBe("rewritten");
    expect(byClient["claude-desktop"]?.outcome).toBe("rewritten");
    expect(byClient.cursor?.outcome).toBe("configUnreadable");
    expect(byClient.cursor?.manualSnippet).toBeDefined();

    const rewritten = JSON.parse(readFileSync(clientConfigPath("claude-code"), "utf8"));
    expect(rewritten.mcpServers.valija.env).toEqual({ VALIJA_HOME: destinationRoot });
    // cursor's broken config was never touched by the move.
    expect(readFileSync(clientConfigPath("cursor"), "utf8")).toBe("{ not valid json");
  });

  it("a refusal before the move succeeds never writes preferences, never rebuilds the container, and never touches a client config", () => {
    installIntoClient("claude-code", "/old/vault");
    const beforeConfig = readFileSync(clientConfigPath("claude-code"), "utf8");

    const { container } = makeLockedVaultContainer();
    const destinationRoot = tempDir("refused-dest");
    writeFileSync(join(destinationRoot, "vault.db"), "already occupied");
    const preferencesStore = makePreferencesStore();
    const rebuildContainer = vi.fn();

    const handlers = createRelocationHandlers(
      () => container,
      rebuildContainer,
      preferencesStore,
      makeFilePicker({ h1: destinationRoot }),
    );

    const result = handlers["relocation:move"]({ handle: "h1" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("RELOCATION_DESTINATION_OCCUPIED");
    expect(preferencesStore.written).toHaveLength(0);
    expect(rebuildContainer).not.toHaveBeenCalled();
    expect(readFileSync(clientConfigPath("claude-code"), "utf8")).toBe(beforeConfig);
    // Nothing was moved: the source vault is still exactly where it was.
    expect(existsSync(container.paths.header)).toBe(true);
    expect(existsSync(container.paths.db)).toBe(true);
  });
});

describe("relocation-handlers — relocation:retryClient re-runs only the writer for one client", () => {
  beforeEach(() => {
    for (const client of ["claude-code", "claude-desktop", "cursor"] as const) {
      rmSync(clientConfigPath(client), { force: true });
    }
  });

  it("retries exactly the named client, against the current container's root", () => {
    installIntoClient("cursor", "/old/vault");
    const { container } = makeLockedVaultContainer();

    const handlers = createRelocationHandlers(
      () => container,
      vi.fn(),
      makePreferencesStore(),
      makeFilePicker({}),
    );

    const result = handlers["relocation:retryClient"]({ client: "cursor" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      client: "cursor",
      outcome: "rewritten",
      configPath: expect.any(String),
    });

    const written = JSON.parse(readFileSync(clientConfigPath("cursor"), "utf8"));
    expect(written.mcpServers.valija.env).toEqual({ VALIJA_HOME: container.paths.root });
  });

  it("rejects an unknown client name", () => {
    const { container } = makeLockedVaultContainer();
    const handlers = createRelocationHandlers(
      () => container,
      vi.fn(),
      makePreferencesStore(),
      makeFilePicker({}),
    );
    const result = handlers["relocation:retryClient"]({ client: "not-a-real-client" });
    expect(result.ok).toBe(false);
  });
});

describe("relocation-handlers — the mirror flow (point at an existing vault, nothing moves)", () => {
  beforeEach(() => {
    for (const client of ["claude-code", "claude-desktop", "cursor"] as const) {
      rmSync(clientConfigPath(client), { force: true });
    }
  });

  it("records the location and re-points clients without moving any file", () => {
    const { vault, container } = makeLockedVaultContainer();
    installIntoClient("claude-code", "/old/vault");

    const existingVaultRoot = tempDir("mirror-existing");
    writeFileSync(join(existingVaultRoot, "vault.json"), readFileSync(vault.paths.header, "utf8"));

    const preferencesStore = makePreferencesStore();
    const rebuildContainer = vi.fn();
    const handlers = createRelocationHandlers(
      () => container,
      rebuildContainer,
      preferencesStore,
      makeFilePicker({ h1: existingVaultRoot }),
    );

    const result = handlers["relocation:pointAtExisting"]({ handle: "h1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.root).toBe(existingVaultRoot);
    expect(preferencesStore.written[0]?.vaultPath).toBe(existingVaultRoot);
    expect(rebuildContainer).toHaveBeenCalledWith(existingVaultRoot);
    // The source vault this container still points at is completely untouched.
    expect(existsSync(vault.paths.header)).toBe(true);
    expect(existsSync(vault.paths.db)).toBe(true);

    const rewritten = JSON.parse(readFileSync(clientConfigPath("claude-code"), "utf8"));
    expect(rewritten.mcpServers.valija.env).toEqual({ VALIJA_HOME: existingVaultRoot });
  });

  it("refuses a folder with no readable vault.json", () => {
    const { container } = makeLockedVaultContainer();
    const emptyFolder = tempDir("mirror-empty");
    const handlers = createRelocationHandlers(
      () => container,
      vi.fn(),
      makePreferencesStore(),
      makeFilePicker({ h1: emptyFolder }),
    );

    const result = handlers["relocation:pointAtExisting"]({ handle: "h1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VAULT_NOT_FOUND");
  });
});
