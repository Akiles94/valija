import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "tsup";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openVaultDb } from "../../shared/infra/sqlite.js";
import { makeUnlockedVault } from "../../testing/test-vault.js";
import { contentChecksumOf, seedVaultContent } from "../../testing/vault-content.js";
import { createDeviceId, type DeviceId } from "../domain/values/device-id.js";
import { SqliteLineageStore } from "./sqlite-lineage-store.js";
import { REKEY_BACKUP_SUFFIX, type RekeyStage } from "./sqlite-vault-rekeyer.js";

/**
 * Spec §5.2: "a crash or kill at any point leaves a vault the old or the new credential opens, or a
 * backup the old one opens — never neither", proven against the REAL adapter in a child process
 * (P-9 (a)). POSIX only: SIGKILL and `ulimit -f` (A10). Slice 0 covered the 20 MB–1.3 GB vaults;
 * this one is CI-sized (about 6 MB).
 */

const REPO = join(import.meta.dirname, "../../..");
const JOURNAL_MAGIC = Buffer.from("d9d505f920a163d7", "hex");
const BOUNDARIES: RekeyStage[] = [
  "locked",
  "bumped",
  "backed-up",
  "rekeying",
  "rekeyed",
  "released",
  "verified",
];
const COMMITTED: RekeyStage[] = ["rekeyed", "released", "verified"];
const MID_REKEY_DELAYS_MS = [0, 1, 2, 5, 10, 20];
const LATE_FRACTIONS = [0.5, 0.8, 0.9, 0.97, 1.0];

const NEW = randomBytes(32).toString("hex");

let OLD: string;
let work: string;
let template: string;
let childScript: string;
let writer: DeviceId;
let baseChecksum: string;
let dbSize: number;
let rekeyMs = 100;

interface ChildRun {
  stages: string[];
  done?: { ok: boolean; code?: string; message?: string };
}

interface Probe {
  opens: boolean;
  code?: string;
  integrity?: unknown;
  checksum?: string;
  generation?: string;
}

describe.skipIf(process.platform === "win32")(
  "SqliteVaultRekeyer — kill -9 and write failures",
  () => {
    beforeAll(async () => {
      work = mkdtempSync(join(tmpdir(), "valija-rekey-fault-"));
      childScript = await bundleChild(join(work, "child"));
      template = buildTemplate();
    }, 60_000);

    afterAll(() => rmSync(work, { recursive: true, force: true }));

    it("an uninterrupted run re-keys the vault, verifies it and deletes the backup", async () => {
      const root = freshCopy("baseline");
      const run = await runChild(root, {});
      expect(run.done?.ok).toBe(true);
      expect(run.stages).toEqual(BOUNDARIES);
      const outcome = classify(root);
      expect(outcome.vaultNew.opens && outcome.vaultNew.checksum).toBe(baseChecksum);
      expect(outcome.vaultOld.opens).toBe(false);
      expect(existsSync(join(root, `vault.db${REKEY_BACKUP_SUFFIX}`))).toBe(false);
      expect(readdirSync(root).sort()).toEqual(["vault.db", "vault.json"]);
    });

    it("a kill at every stage boundary leaves exactly one key working (old before the commit, new after)", async () => {
      for (const stage of BOUNDARIES) {
        const root = freshCopy(`boundary-${stage}`);
        const run = await runChild(root, { pauseAt: stage });
        expect(run.done, `child finished despite pausing at ${stage}`).toBeUndefined();
        const outcome = classify(root);
        assertRecoverable(outcome, `boundary ${stage}`);
        const committed = COMMITTED.includes(stage);
        expect(outcome.vaultOld.opens, `old opens after ${stage}`).toBe(!committed);
        expect(outcome.vaultNew.opens, `new opens after ${stage}`).toBe(committed);
        assertRestoreLeg(root, `boundary ${stage}`);
      }
    }, 60_000);

    it("a kill during the re-encryption never leaves a vault nothing opens", async () => {
      const delays = [
        ...MID_REKEY_DELAYS_MS,
        ...LATE_FRACTIONS.map((fraction) => Math.round(rekeyMs * fraction)),
      ];
      for (const delay of delays) {
        const root = freshCopy(`mid-${delay}`);
        await runChild(root, { killAfter: "rekeying", delayMs: delay });
        const outcome = classify(root);
        assertRecoverable(outcome, `mid-rekey +${delay} ms`);
        assertRestoreLeg(root, `mid-rekey +${delay} ms`);
      }
    }, 60_000);

    it("a write failure inside the re-encryption rolls back under the old key: nothing changed, no backup", async () => {
      // Room for the backup (exactly vault.db) but not for the journal (~1.002 × vault.db).
      const root = freshCopy("efbig-journal");
      const run = await runChild(root, { fileSizeLimitKiB: Math.ceil(dbSize / 1024) + 2 });
      expect(run.stages).toContain("rekeying");
      expect(run.stages).not.toContain("rekeyed");
      expect(run.done?.code).toBe("REKEY_FAILED");
      expect(run.done?.message).toMatch(/\(SQLITE_[A-Z_]+\)\. Nothing changed/);
      const outcome = classify(root);
      expect(outcome.vaultOld.opens && outcome.vaultOld.checksum).toBe(baseChecksum);
      expect(outcome.vaultNew.opens).toBe(false);
      expect(readdirSync(root).sort()).toEqual(["vault.db", "vault.json"]);
    });

    it("a write failure while copying the backup leaves the vault untouched and no partial backup", async () => {
      const root = freshCopy("efbig-backup");
      const run = await runChild(root, { fileSizeLimitKiB: Math.floor(dbSize / 2048) });
      expect(run.stages).not.toContain("backed-up");
      expect(run.done?.code).toBe("REKEY_FAILED");
      expect(run.done?.message).toContain("Nothing changed");
      const outcome = classify(root);
      expect(outcome.vaultOld.opens && outcome.vaultOld.checksum).toBe(baseChecksum);
      expect(readdirSync(root).sort()).toEqual(["vault.db", "vault.json"]);
    });
  },
);

/** Bundles `src/testing/rekey-child.ts` (and the real adapter) to one CJS file (F20). */
async function bundleChild(outDir: string): Promise<string> {
  await build({
    entry: { "rekey-child": join(REPO, "src/testing/rekey-child.ts") },
    outDir,
    format: ["cjs"],
    platform: "node",
    target: "node22",
    external: ["better-sqlite3-multiple-ciphers"],
    config: false,
    silent: true,
  });
  const script = readdirSync(outDir).find((name) => /^rekey-child\.c?js$/.test(name));
  if (script === undefined) throw new Error("tsup did not emit the rekey child");
  return join(outDir, script);
}

/** A ~6 MB vault keyed with OLD, written once (generation 0), plus its content checksum. */
function buildTemplate(): string {
  const vault = makeUnlockedVault();
  const root = join(work, "template");
  OLD = vault.keyHex;
  seedVaultContent(vault.paths.db, OLD, { projects: 12, items: 800, wordsPerItem: 600 });
  const seeded = openVaultDb(vault.paths.db, OLD);
  writer = createDeviceId(vault.idGen);
  seeded.transaction(() => new SqliteLineageStore(seeded, vault.idGen, vault.clock).bump(writer))();
  baseChecksum = contentChecksumOf(seeded);
  seeded.close();
  renameSync(vault.paths.root, root);
  dbSize = statSync(join(root, "vault.db")).size;
  return root;
}

function freshCopy(name: string): string {
  const root = join(work, name);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  copyFileSync(join(template, "vault.db"), join(root, "vault.db"));
  copyFileSync(join(template, "vault.json"), join(root, "vault.json"));
  return root;
}

interface ChildOptions {
  pauseAt?: RekeyStage;
  killAfter?: RekeyStage;
  delayMs?: number;
  fileSizeLimitKiB?: number;
}

function runChild(root: string, options: ChildOptions): Promise<ChildRun> {
  const args = [childScript, root, OLD, NEW, writer, options.pauseAt ?? ""];
  const env = { ...process.env, NODE_PATH: join(REPO, "node_modules") };
  const child: ChildProcess =
    options.fileSizeLimitKiB === undefined
      ? spawn(process.execPath, args, { env, stdio: ["ignore", "pipe", "pipe"] })
      : spawn(
          "bash",
          [
            "-c",
            `trap '' XFSZ; ulimit -f ${options.fileSizeLimitKiB}; exec "$0" "$@"`,
            process.execPath,
            ...args,
          ],
          { env, stdio: ["ignore", "pipe", "pipe"] },
        );
  const run: ChildRun = { stages: [] };
  let buffered = "";
  let rekeyingAt = 0;
  child.stdout?.on("data", (chunk: Buffer) => {
    buffered += chunk.toString();
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) onLine(line);
  });
  const kill = () => child.kill("SIGKILL");
  function onLine(line: string): void {
    if (line.startsWith("DONE ")) {
      run.done = JSON.parse(line.slice(5));
      return;
    }
    run.stages.push(line);
    if (line === "rekeying") rekeyingAt = performance.now();
    if (line === "rekeyed" && options.pauseAt === undefined && options.killAfter === undefined) {
      rekeyMs = Math.max(1, performance.now() - rekeyingAt);
    }
    if (line === options.pauseAt) kill();
    if (line === options.killAfter) {
      if (options.delayMs === 0) kill();
      else setTimeout(kill, options.delayMs);
    }
  }
  return new Promise((resolve) => child.once("exit", () => resolve(run)));
}

interface Outcome {
  hotJournal: boolean;
  newFirstCode?: string;
  vaultOld: Probe;
  vaultNew: Probe;
  backupOld?: Probe;
}

/** After a kill: NEW first on a hot journal (S7c), then OLD, then NEW, then the backup with OLD. */
function classify(root: string): Outcome {
  const db = join(root, "vault.db");
  const journal = `${db}-journal`;
  const hotJournal = isHotJournal(journal);
  let newFirstCode: string | undefined;
  if (hotJournal) {
    const size = statSync(journal).size;
    newFirstCode = probe(db, NEW).code;
    expect(statSync(journal).size, "a NEW-key open never writes the hot journal").toBe(size);
  }
  const vaultOld = probe(db, OLD);
  const vaultNew = probe(db, NEW);
  const backup = `${db}${REKEY_BACKUP_SUFFIX}`;
  return {
    hotJournal,
    ...(newFirstCode === undefined ? {} : { newFirstCode }),
    vaultOld,
    vaultNew,
    ...(existsSync(backup) ? { backupOld: probe(backup, OLD) } : {}),
  };
}

function assertRecoverable(outcome: Outcome, label: string): void {
  const opened = [outcome.vaultOld, outcome.vaultNew, outcome.backupOld].filter(
    (p): p is Probe => p?.opens === true,
  );
  expect(opened.length, `${label}: something opens`).toBeGreaterThan(0);
  expect(outcome.vaultOld.opens && outcome.vaultNew.opens, `${label}: never both keys`).toBe(false);
  for (const p of opened) {
    expect(p.integrity, `${label}: integrity`).toBe("ok");
    expect(p.checksum, `${label}: content`).toBe(baseChecksum);
    expect(["0", "1"], `${label}: generation`).toContain(p.generation);
  }
  if (outcome.hotJournal) expect(outcome.newFirstCode, `${label}: S7c`).toBe("SQLITE_NOTADB");
}

/** Spike S8: delete any journal, rename the backup over vault.db, and OLD opens the old content. */
function assertRestoreLeg(root: string, label: string): void {
  const db = join(root, "vault.db");
  if (
    existsSync(`${db}-journal`) === false &&
    existsSync(`${db}${REKEY_BACKUP_SUFFIX}`) === false
  ) {
    return;
  }
  rmSync(`${db}-journal`, { force: true });
  if (!existsSync(`${db}${REKEY_BACKUP_SUFFIX}`)) return;
  renameSync(`${db}${REKEY_BACKUP_SUFFIX}`, db);
  const restored = probe(db, OLD);
  expect(restored.opens && restored.checksum, `${label}: restore leg`).toBe(baseChecksum);
}

function probe(dbPath: string, keyHex: string): Probe {
  try {
    const db = openVaultDb(dbPath, keyHex);
    try {
      const row = db.prepare("SELECT value FROM meta WHERE key = 'lineage_generation'").get() as
        | { value: string }
        | undefined;
      return {
        opens: true,
        integrity: db.pragma("integrity_check", { simple: true }),
        checksum: contentChecksumOf(db),
        ...(row === undefined ? {} : { generation: row.value }),
      };
    } finally {
      db.close();
    }
  } catch (error) {
    return { opens: false, code: (error as { code?: string }).code ?? "error" };
  }
}

function isHotJournal(path: string): boolean {
  if (!existsSync(path) || statSync(path).size < JOURNAL_MAGIC.length) return false;
  const header = Buffer.alloc(JOURNAL_MAGIC.length);
  const fd = openSync(path, "r");
  try {
    readSync(fd, header, 0, header.length, 0);
  } finally {
    closeSync(fd);
  }
  return header.equals(JOURNAL_MAGIC);
}
