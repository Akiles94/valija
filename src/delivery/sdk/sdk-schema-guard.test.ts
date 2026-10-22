import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LATEST_SCHEMA_VERSION } from "../../shared/infra/migrations.js";
import {
  makePassphraseVault,
  type PassphraseVault,
  TEST_PASSPHRASE,
} from "../../testing/passphrase-vault.js";
import { RecordingKeychain } from "../../testing/recording-keychain.js";
import {
  setStoredSchemaVersion,
  snapshotVaultFiles,
  type VaultFilesSnapshot,
} from "../../testing/schema-skew.js";
import { InMemoryKeychain } from "../../vault/infra/in-memory-keychain.js";
import { buildContainer } from "../container.js";
import { openVault, type ValijaVault } from "./index.js";

vi.mock("../../vault/infra/keyring.js", async () => ({
  OsKeychain: (await import("../../testing/recording-keychain.js")).RecordingKeychain,
}));

const tmp = mkdtempSync(join(tmpdir(), "valija-sdk-schema-guard-"));
const originalEnv = { ...process.env };
const CLIENT = "acme-notes";

let vault: PassphraseVault;
let untouched: VaultFilesSnapshot;
let k: ValijaVault;
/** state.json as it was before any refused call: no activity, no last-seen may be recorded. */
let stateBefore: string;
const readState = () => readFileSync(join(tmp, "state", "state.json"), "utf8");

beforeAll(async () => {
  RecordingKeychain.reset();
  process.env.HOME = join(tmp, "home");
  process.env.VALIJA_STATE_HOME = join(tmp, "state");
  delete process.env.VALIJA_AUTOLOCK_MINUTES;
  delete process.env.VALIJA_PROJECT;
  vault = await makePassphraseVault(join(tmp, "vault"));
  RecordingKeychain.store.set(vault.vaultId, vault.keyHex);
  const seeded = buildContainer({ vaultRoot: vault.paths.root }).saveContext.execute({
    project: "acme",
    content: "a decision",
  });
  if (!seeded.ok) throw new Error(seeded.error.message);
  // A newer valija upgraded this vault. The user's session key is still in the OS keychain.
  setStoredSchemaVersion(vault.paths.db, vault.keyHex, LATEST_SCHEMA_VERSION + 1);
  untouched = snapshotVaultFiles(vault.paths);
  stateBefore = readState();
  const opened = await openVault({ client: CLIENT, vaultRoot: vault.paths.root });
  if (!opened.ok) throw new Error(opened.error.message);
  k = opened.value;
});

beforeEach(() => RecordingKeychain.clearRecord());

afterAll(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
  rmSync(tmp, { recursive: true, force: true });
});

const OPERATIONS: [
  string,
  () => Promise<{ ok: boolean; error?: { code: string; message: string } }>,
][] = [
  ["save", () => k.save({ project: "acme", content: "another decision" })],
  ["saveHandoff", () => k.saveHandoff({ project: "acme", content: "next step" })],
  ["getContextPack", () => k.getContextPack({ project: "acme" })],
  ["search", () => k.search({ query: "decision" })],
  ["listProjects", () => k.listProjects()],
];

describe("Mode K on a vault newer than this SDK (§6)", () => {
  it.each(
    OPERATIONS,
  )("%s → VAULT_SCHEMA_TOO_NEW; vault untouched, the OS key kept", async (_name, call) => {
    const r = await call();
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe("VAULT_SCHEMA_TOO_NEW");
    expect(r.error?.message).toMatch(/Update valija/);
    expect(Object.keys(r.error ?? {}).sort()).toEqual(["code", "message"]);
    expect(snapshotVaultFiles(vault.paths)).toEqual(untouched);
    expect(RecordingKeychain.store.get(vault.vaultId)).toBe(vault.keyHex);
    expect(RecordingKeychain.calls.map((c) => c.method)).toEqual(["getKey"]);
    expect(readState()).toBe(stateBefore);
  });

  it("the open itself succeeds: Mode K reads only the header (A7)", async () => {
    const again = await openVault({ client: CLIENT, vaultRoot: vault.paths.root });
    expect(again.ok).toBe(true);
    expect(snapshotVaultFiles(vault.paths)).toEqual(untouched);
  });

  it("allowUpgrade does not bypass it", async () => {
    const opened = await openVault({
      client: CLIENT,
      vaultRoot: vault.paths.root,
      allowUpgrade: true,
    });
    if (!opened.ok) throw new Error(opened.error.message);
    expect((await opened.value.listProjects()).ok).toBe(false);
    expect(snapshotVaultFiles(vault.paths)).toEqual(untouched);
  });
});

describe("Mode P open on a vault newer than this SDK (§6)", () => {
  it.each([
    ["passphrase", () => ({ passphrase: TEST_PASSPHRASE })],
    ["recovery key", () => ({ recoveryKey: vault.keyHex })],
    ["passphrase + allowUpgrade", () => ({ passphrase: TEST_PASSPHRASE, allowUpgrade: true })],
  ])("by %s → VAULT_SCHEMA_TOO_NEW; nothing set, written or recorded", async (_label, credential) => {
    const setKey = vi.spyOn(InMemoryKeychain.prototype, "setKey");
    const r = await openVault({ client: CLIENT, vaultRoot: vault.paths.root, ...credential() });
    expect(!r.ok && r.error.code).toBe("VAULT_SCHEMA_TOO_NEW");
    expect(setKey).not.toHaveBeenCalled();
    expect(snapshotVaultFiles(vault.paths)).toEqual(untouched);
    expect(RecordingKeychain.calls).toEqual([]);
    expect(RecordingKeychain.store.get(vault.vaultId)).toBe(vault.keyHex);
    expect(readState()).toBe(stateBefore);
    setKey.mockRestore();
  });
});
