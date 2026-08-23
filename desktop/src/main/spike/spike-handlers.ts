import { readFileSync } from "node:fs";
import { join } from "node:path";
import SqliteDatabase from "better-sqlite3-multiple-ciphers";
import type { IpcMain } from "electron";
import { openVaultDb } from "../../../../src/shared/infra/sqlite.js";
import { OsKeychain } from "../../../../src/vault/infra/keyring.js";

export type SpikeResult = { ok: true; detail: string } | { ok: false; detail: string };

// NOTE: electron-vite bundles this module into a single out/main/index.js file,
// so import.meta.dirname at runtime is the *bundle's* directory (desktop/out/main),
// not this source file's directory (desktop/src/main/spike) — the relative path
// climbs three levels (out/main -> desktop -> valija root), not the four the
// source-tree layout would suggest. Verified against the packaged build in Slice 1;
// see spike.md.
const GOLDEN_VAULT_DIR = join(
  import.meta.dirname,
  "../../../src/testing/__fixtures__/golden-vault",
);

function loadSqlcipher(): SpikeResult {
  try {
    const db = new SqliteDatabase(":memory:");
    db.pragma("cipher='sqlcipher'");
    const rows = db.pragma("cipher_version") as { version: string }[];
    const version = rows[0]?.version ?? "unknown";
    db.close();
    return { ok: true, detail: `SQLCipher loaded, cipher_version=${version}` };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
}

function keychainRoundTrip(): SpikeResult {
  try {
    const keychain = new OsKeychain();
    keychain.setKey("doctor-probe", "spike-test-value");
    const readBack = keychain.getKey("doctor-probe");
    const deleted = keychain.deleteKey("doctor-probe");
    if (readBack !== "spike-test-value") {
      return { ok: false, detail: `round-trip mismatch: got ${JSON.stringify(readBack)}` };
    }
    if (!deleted) {
      return { ok: false, detail: "deleteKey reported false after a successful write" };
    }
    return { ok: true, detail: "keychain write → read → delete round-tripped" };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
}

function openGoldenVault(): SpikeResult {
  try {
    const manifest = JSON.parse(readFileSync(join(GOLDEN_VAULT_DIR, "manifest.json"), "utf8")) as {
      keyHex: string;
      vaultId: string;
    };
    const dbPath = join(GOLDEN_VAULT_DIR, "vault.db");
    const db = openVaultDb(dbPath, manifest.keyHex);
    const rows = db.prepare("SELECT count(*) as count FROM projects").all() as {
      count: number;
    }[];
    const count = rows[0]?.count ?? 0;
    db.close();
    return { ok: true, detail: `opened golden vault ${manifest.vaultId}, ${count} project(s)` };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
}

export function registerSpikeHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("spike:load-sqlcipher", () => loadSqlcipher());
  ipcMain.handle("spike:keychain-round-trip", () => keychainRoundTrip());
  ipcMain.handle("spike:open-golden-vault", () => openGoldenVault());
}
