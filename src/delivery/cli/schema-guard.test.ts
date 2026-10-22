import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LATEST_SCHEMA_VERSION } from "../../shared/infra/migrations.js";
import {
  setStoredSchemaVersion,
  snapshotVaultFiles,
  type VaultFilesSnapshot,
} from "../../testing/schema-skew.js";
import { buildContainer, type Container } from "../container.js";
import { linkCommand, whichCommand } from "./binding-commands.js";
import { exportCommand, projectsCommand, searchCommand, showCommand } from "./content-commands.js";
import {
  archiveCommand,
  editCommand,
  pinCommand,
  unarchiveCommand,
  unpinCommand,
} from "./curation-commands.js";
import { doctorCommand } from "./doctor.js";
import { importCommand } from "./import-command.js";
import { lockCommand, statusCommand, unlockCommand } from "./vault-commands.js";

// One keychain shared by every OsKeychain the container (and doctor's probe) constructs — never the real OS one.
vi.mock("../../vault/infra/keyring.js", () => {
  const store = new Map<string, string>();
  return {
    OsKeychain: class {
      setKey(id: string, value: string) {
        store.set(id, value);
      }
      getKey(id: string) {
        return store.get(id) ?? null;
      }
      deleteKey(id: string) {
        return store.delete(id);
      }
    },
  };
});

const PASSPHRASE = "correct horse battery staple";
vi.mock("./prompt.js", () => ({ promptHidden: async () => PASSPHRASE }));

const tmp = mkdtempSync(join(tmpdir(), "valija-cli-schema-guard-"));
const originalEnv = { ...process.env };
let c: Container;
let vaultId: string;
let recoveryKey: string;
let itemId: string;
let exportFile: string;
let untouched: VaultFilesSnapshot;

beforeAll(async () => {
  process.env.HOME = join(tmp, "home");
  process.env.VALIJA_STATE_HOME = join(tmp, "state");
  delete process.env.VALIJA_PROJECT;
  c = buildContainer({ vaultRoot: join(tmp, "vault") });

  const created = await c.createVault.execute(PASSPHRASE);
  if (!created.ok) throw new Error(created.error.message);
  vaultId = created.value.vaultId;
  recoveryKey = created.value.keyHex;
  const saved = c.saveContext.execute({ project: "cli", content: "a decision", type: "decision" });
  if (!saved.ok) throw new Error(saved.error.message);
  itemId = saved.value.itemId;

  exportFile = join(tmp, "export.json");
  writeFileSync(
    exportFile,
    JSON.stringify({
      valija_import_version: 1,
      conversations: [
        {
          id: "conv-1",
          title: "Kickoff",
          createdAt: "2024-05-01T09:00:00Z",
          messages: [
            { role: "user", content: "Plan the sprint." },
            { role: "assistant", content: "Sure, here is a plan." },
          ],
        },
      ],
    }),
  );

  // A newer valija has upgraded this vault. The key from `init` is still in the keychain.
  setStoredSchemaVersion(c.paths.db, recoveryKey, LATEST_SCHEMA_VERSION + 1);
  untouched = snapshotVaultFiles(c.paths);
});

afterAll(() => {
  process.env = originalEnv;
  rmSync(tmp, { recursive: true, force: true });
});

class Exit extends Error {
  constructor(readonly code: number | undefined) {
    super(`exit ${code}`);
  }
}
let logs: string[];
let errors: string[];
beforeEach(() => {
  logs = [];
  errors = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => void logs.push(line));
  vi.spyOn(console, "error").mockImplementation((line: string) => void errors.push(line));
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Exit(code as number | undefined);
  });
});
afterEach(() => vi.restoreAllMocks());

const COMMANDS: [string, () => unknown][] = [
  ["unlock", () => unlockCommand(c, {})],
  ["unlock --recovery-key", () => unlockCommand(c, { recoveryKey })],
  ["show", () => showCommand(c, "cli", {})],
  ["search", () => searchCommand(c, "decision", {})],
  ["projects", () => projectsCommand(c)],
  ["export", () => exportCommand(c, "cli", {})],
  ["edit", () => editCommand(c, itemId, { tags: "x" })],
  ["archive", () => archiveCommand(c, itemId)],
  ["unarchive", () => unarchiveCommand(c, itemId)],
  ["pin", () => pinCommand(c, itemId)],
  ["unpin", () => unpinCommand(c, itemId)],
  ["import", () => importCommand(c, exportFile, { project: "cli", from: "generic", all: true })],
  ["link", () => linkCommand(c, "cli", { dir: tmp })],
  ["which", () => whichCommand(c, { dir: tmp })],
];

describe("every CLI command refuses a vault upgraded by a newer valija (D-E)", () => {
  it.each(
    COMMANDS,
  )("%s → error [VAULT_SCHEMA_TOO_NEW], exit 1, vault untouched", async (_, run) => {
    const exit = await Promise.resolve()
      .then(run)
      .then(
        () => undefined,
        (error: unknown) => error,
      );
    expect(exit).toBeInstanceOf(Exit);
    expect((exit as Exit).code).toBe(1);
    expect(errors.join("\n")).toMatch(/^error \[VAULT_SCHEMA_TOO_NEW\]: .*Update valija/);
    expect(errors.join("\n")).toContain(`schema ${LATEST_SCHEMA_VERSION + 1}`);
    expect(logs).toEqual([]);
    expect(snapshotVaultFiles(c.paths)).toEqual(untouched);
  });

  it("status prints the schema line, and reports the session as unlocked", () => {
    statusCommand(c);
    expect(logs).toContain("state:    UNLOCKED");
    expect(logs).toContain(
      `schema:   v${LATEST_SCHEMA_VERSION + 1} is newer than this valija (supports v${LATEST_SCHEMA_VERSION}) — update valija`,
    );
    expect(logs.some((line) => line.startsWith("lineage:"))).toBe(false);
    expect(snapshotVaultFiles(c.paths)).toEqual(untouched);
  });

  it("doctor shows the failing vault row and still exits 0 (reported, not fatal)", async () => {
    await doctorCommand(c);
    expect(logs).toContain(
      `✗ vault            schema v${LATEST_SCHEMA_VERSION + 1} is newer than this valija (supports v${LATEST_SCHEMA_VERSION}) — update valija`,
    );
    expect(logs).toContain(
      "✓ lineage          not read — the vault's schema is newer than this valija",
    );
    expect(process.exit).not.toHaveBeenCalled();
    expect(snapshotVaultFiles(c.paths)).toEqual(untouched);
  });

  it("lock still drops the key, with the files unchanged", async () => {
    const { OsKeychain } = await import("../../vault/infra/keyring.js");
    const keychain = new OsKeychain();
    expect(keychain.getKey(vaultId)).toBe(recoveryKey);

    lockCommand(c);

    expect(keychain.getKey(vaultId)).toBeNull();
    expect(logs[0]).toMatch(/^Vault locked\. .*generation unknown/);
    expect(snapshotVaultFiles(c.paths)).toEqual(untouched);
  });
});
