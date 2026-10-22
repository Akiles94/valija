import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import SqliteDatabase from "better-sqlite3-multiple-ciphers";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUSY_MESSAGE } from "../../context/infra/vault-sessions.js";
import {
  makePassphraseVault,
  type PassphraseVault,
  TEST_PASSPHRASE,
} from "../../testing/passphrase-vault.js";
import { RecordingKeychain } from "../../testing/recording-keychain.js";
import { showCommand } from "../cli/content-commands.js";
import { buildContainer, type Container } from "../container.js";
import { openVault, type ValijaVault } from "./index.js";

vi.mock("../../vault/infra/keyring.js", async () => ({
  OsKeychain: (await import("../../testing/recording-keychain.js")).RecordingKeychain,
}));

const tmp = mkdtempSync(join(tmpdir(), "valija-sdk-concurrency-"));
const originalEnv = { ...process.env };
let n = 0;
const CLIENT = "acme-notes";

let vault: PassphraseVault;
let cli: Container;

beforeEach(async () => {
  RecordingKeychain.reset();
  n += 1;
  process.env.HOME = join(tmp, "home");
  process.env.VALIJA_STATE_HOME = join(tmp, `state-${n}`); // shared by every surface below
  delete process.env.VALIJA_AUTOLOCK_MINUTES;
  delete process.env.VALIJA_PROJECT;
  vault = await makePassphraseVault(join(tmp, `vault-${n}`));
  RecordingKeychain.store.set(vault.vaultId, vault.keyHex);
  cli = buildContainer({ vaultRoot: vault.paths.root });
});

afterEach(() => vi.restoreAllMocks());

afterAll(() => {
  process.env = originalEnv;
  rmSync(tmp, { recursive: true, force: true });
});

async function modeK(): Promise<ValijaVault> {
  const r = await openVault({ client: CLIENT, vaultRoot: vault.paths.root });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

async function modeP(): Promise<ValijaVault> {
  const r = await openVault({
    client: CLIENT,
    vaultRoot: vault.paths.root,
    passphrase: TEST_PASSPHRASE,
  });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Item count and lineage generation, read straight from the database. */
function vaultState(): { items: number; generation: string | undefined; journal: string } {
  const db = new SqliteDatabase(vault.paths.db, { readonly: true, fileMustExist: true });
  try {
    db.pragma("cipher='sqlcipher'");
    db.pragma(`key="x'${vault.keyHex}'"`);
    const { items } = db.prepare("SELECT count(*) AS items FROM context_items").get() as {
      items: number;
    };
    const row = db.prepare("SELECT value FROM meta WHERE key = 'lineage_generation'").get() as
      | { value: string }
      | undefined;
    const journal = db.pragma("journal_mode", { simple: true }) as string;
    return { items, generation: row?.value, journal };
  } finally {
    db.close();
  }
}

const expectAtRest = () => {
  expect(readdirSync(vault.paths.root).sort()).toEqual(["vault.db", "vault.json"]);
  expect(vaultState().journal).toBe("delete");
};

/**
 * Another surface's connection: a worker thread takes BEGIN IMMEDIATE on the vault and keeps it for
 * `ms`. Resolves once the lock is held, with a promise for the worker's exit.
 */
function holdWriteLock(ms: number): Promise<{ exited: Promise<void> }> {
  const source = `
    const { parentPort, workerData } = require("node:worker_threads");
    const Sqlite = require("node:module").createRequire(workerData.anchor)("better-sqlite3-multiple-ciphers");
    const db = new Sqlite(workerData.path);
    db.pragma("cipher='sqlcipher'");
    db.pragma('key="x\\'' + workerData.key + '\\'"');
    db.exec("BEGIN IMMEDIATE");
    parentPort.postMessage("held");
    setTimeout(() => {
      db.exec("ROLLBACK");
      db.close();
    }, workerData.ms);
  `;
  const worker = new Worker(source, {
    eval: true,
    workerData: { anchor: import.meta.filename, path: vault.paths.db, key: vault.keyHex, ms },
  });
  const exited = new Promise<void>((resolve, reject) => {
    worker.once("exit", () => resolve());
    worker.once("error", reject);
  });
  return new Promise((resolve, reject) => {
    worker.once("message", () => resolve({ exited }));
    worker.once("error", reject);
  });
}

describe("one device, several surfaces at once (§8)", () => {
  it("1. a write waits for another connection's write transaction, then succeeds", async () => {
    const sdk = await modeK();
    await sdk.save({ project: "acme", content: "seed" });
    const { exited } = await holdWriteLock(1_000);
    const started = Date.now();
    const saved = await sdk.save({ project: "acme", content: "after the wait" });
    expect(saved.ok).toBe(true);
    expect(Date.now() - started).toBeGreaterThanOrEqual(500);
    await exited;
    expect(vaultState().items).toBe(2);
    expectAtRest();
  });

  it("2. past the 5 s timeout the call fails cleanly with STORAGE_ERROR 'busy'; nothing changed", async () => {
    const sdk = await modeP();
    await sdk.save({ project: "acme", content: "seed" });
    const before = vaultState();
    const { exited } = await holdWriteLock(6_500);
    const started = Date.now();
    const saved = await sdk.save({ project: "acme", content: "never lands" });
    expect(Date.now() - started).toBeGreaterThanOrEqual(4_500); // it waited out the 5 s timeout
    expect(saved).toEqual({ ok: false, error: { code: "STORAGE_ERROR", message: BUSY_MESSAGE } });
    await exited;
    expect(vaultState()).toEqual(before);
    expect((await sdk.listProjects()).ok).toBe(true);
    expectAtRest();
  }, 20_000);

  it("3. 30 interleaved writes from Mode K, Mode P and the CLI never produce a false fork", async () => {
    const k = await modeK();
    const p = await modeP();
    for (let i = 0; i < 10; i++) {
      expect((await k.save({ project: "acme", content: `k ${i}` })).ok).toBe(true);
      expect((await p.save({ project: "acme", content: `p ${i}` })).ok).toBe(true);
      expect(cli.saveContext.execute({ project: "acme", content: `cli ${i}` }).ok).toBe(true);
    }
    expect(vaultState().items).toBe(30);

    cli.lockVault.execute();
    const unlocked = await cli.unlockVault.execute({
      passphrase: TEST_PASSPHRASE,
      upgradeConfirmed: true,
    });
    expect(unlocked.ok && unlocked.value.fork).toBeUndefined();
    const again = await modeP();
    expect(again.forkNotice).toBeUndefined();
    expectAtRest();
  });

  it("4. an SDK write is visible to valija show straight away", async () => {
    const sdk = await modeP();
    for (const content of ["first from the SDK", "second from the SDK"]) {
      await sdk.save({ project: "acme", content });
      const lines: string[] = [];
      vi.spyOn(console, "log").mockImplementation((line: string) => void lines.push(line));
      showCommand(cli, "acme", {});
      vi.restoreAllMocks();
      expect(lines.join("\n")).toContain(content);
    }
    expectAtRest();
  });
});
