import { existsSync, readFileSync } from "node:fs";
import type { DomainError, Result } from "../../shared/domain/result.js";
import type { VaultFolderInspection } from "../../vault/application/ports/vault-folder.js";
import type { VaultStatusOutput } from "../../vault/application/use-cases/vault-status.use-case.js";
import { OsKeychain } from "../../vault/infra/keyring.js";
import type { Container } from "../container.js";
import { CLIENTS, type ClientId, clientConfigPath } from "./installer.js";
import { writerLabel } from "./render.js";

type StatusResult = Result<VaultStatusOutput, DomainError>;

interface Check {
  name: string;
  ok: boolean;
  detail: string;
  fatal?: boolean;
}

function checkNode(): Check {
  const [major] = process.versions.node.split(".").map(Number);
  return {
    name: "node",
    ok: (major ?? 0) >= 22,
    detail: `v${process.versions.node} (need >=22)`,
    fatal: true,
  };
}

async function checkSqlcipher(): Promise<Check> {
  try {
    const { default: Db } = await import("better-sqlite3-multiple-ciphers");
    const db = new Db(":memory:");
    db.pragma("cipher='sqlcipher'");
    db.close();
    return { name: "sqlcipher", ok: true, detail: "native module loads" };
  } catch (e) {
    return { name: "sqlcipher", ok: false, detail: (e as Error).message, fatal: true };
  }
}

function checkKeychain(): Check {
  try {
    const keychain = new OsKeychain();
    keychain.setKey("doctor-probe", "test");
    const roundtrip = keychain.getKey("doctor-probe") === "test";
    keychain.deleteKey("doctor-probe");
    return { name: "keychain", ok: roundtrip, detail: "OS keychain read/write" };
  } catch (e) {
    return { name: "keychain", ok: false, detail: (e as Error).message };
  }
}

function checkVault(status: StatusResult): Check {
  if (!status.ok) return { name: "vault", ok: false, detail: status.error.message };
  return {
    name: "vault",
    ok: status.value.initialized,
    detail: status.value.initialized
      ? `${status.value.unlocked ? "unlocked" : "locked"} at ${status.value.dbPath}`
      : 'not initialized — run "valija init"',
  };
}

function checkJournal(status: StatusResult): Check {
  if (!status.ok) return { name: "journal", ok: false, detail: status.error.message };
  const s = status.value;
  return {
    name: "journal",
    ok: s.sidecars.length === 0,
    detail:
      s.sidecars.length === 0
        ? `${s.journalMode} — single file at rest`
        : `stray sidecar files present (crash or unexpected mode): ${s.sidecars.join(", ")}`,
  };
}

function checkSyncFolder(inspection: VaultFolderInspection): Check {
  const problems: string[] = [];
  if (inspection.conflictedCopies.length > 0) {
    problems.push(
      `conflicted-copy file(s) — a fork may have occurred: ${inspection.conflictedCopies.join(", ")} (unlock to see the fork warning)`,
    );
  }
  if (inspection.staleBackups.length > 0) {
    problems.push(
      `leftover upgrade backup(s): ${inspection.staleBackups.join(", ")} — a prior upgrade did not finish cleanly; delete once you've confirmed the vault opens`,
    );
  }
  if (problems.length > 0) return { name: "sync", ok: false, detail: problems.join("; ") };
  if (inspection.looksLikeCloud) {
    return {
      name: "sync",
      ok: true,
      detail:
        "vault folder looks like a cloud-sync folder — lock, let it sync, then unlock elsewhere",
    };
  }
  return { name: "sync", ok: true, detail: "no cloud-sync folder detected" };
}

function checkLineage(status: StatusResult): Check {
  if (!status.ok) return { name: "lineage", ok: false, detail: status.error.message };
  const s = status.value;
  return {
    name: "lineage",
    ok: true,
    detail:
      s.generation === undefined
        ? "unlock to see generation / last-writer"
        : `generation ${s.generation}, last written by ${writerLabel(s.lastWriter, s.lastWriterIsThisDevice)}`,
  };
}

function checkAutoLock(status: StatusResult): Check {
  if (!status.ok) return { name: "auto-lock", ok: false, detail: status.error.message };
  const a = status.value.autoLock;
  if (a.ttlMinutes === null) return { name: "auto-lock", ok: true, detail: "disabled" };
  const idle = a.idleForMinutes !== undefined ? `, idle ${a.idleForMinutes.toFixed(1)}m` : "";
  return {
    name: "auto-lock",
    ok: true,
    detail: `${a.ttlMinutes}m TTL${idle}${a.expired ? " (expired)" : ""}`,
  };
}

function checkClient(client: ClientId): Check {
  const path = clientConfigPath(client);
  if (!existsSync(path)) return { name: client, ok: false, detail: "config not found" };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as {
      mcpServers?: Record<string, unknown>;
    };
    const installed = parsed.mcpServers?.valija !== undefined;
    return {
      name: client,
      ok: installed,
      detail: installed ? "valija installed" : "config found, valija not installed",
    };
  } catch {
    return { name: client, ok: false, detail: "config exists but is not valid JSON" };
  }
}

export async function doctorCommand(c: Container): Promise<void> {
  // Compute the vault status once — each call opens the SQLCipher db (twice) and
  // reads the keychain, so recomputing it per check would multiply that needlessly.
  const status = c.vaultStatus.execute();
  const inspection = c.folder.inspect();
  const checks: Check[] = [
    checkNode(),
    await checkSqlcipher(),
    checkKeychain(),
    checkVault(status),
    checkJournal(status),
    checkSyncFolder(inspection),
    checkLineage(status),
    checkAutoLock(status),
    ...CLIENTS.map(checkClient),
  ];

  let fatal = false;
  for (const check of checks) {
    console.log(`${check.ok ? "✓" : "✗"} ${check.name.padEnd(16)} ${check.detail}`);
    if (!check.ok && check.fatal) fatal = true;
  }
  if (fatal) process.exit(1);
}
