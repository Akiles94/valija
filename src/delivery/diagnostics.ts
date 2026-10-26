import { existsSync, readFileSync } from "node:fs";
import type { DomainError, Result } from "../shared/domain/result.js";
import type { VaultFolderInspection } from "../vault/application/ports/vault-folder.js";
import type { VaultStatusOutput } from "../vault/application/use-cases/vault-status.use-case.js";
import { OsKeychain } from "../vault/infra/keyring.js";
import { CLIENTS, type ClientId, clientConfigPath } from "./cli/installer.js";
import { writerLabel } from "./cli/render.js";
import type { Container } from "./container.js";

type StatusResult = Result<VaultStatusOutput, DomainError>;

/** One health check result: what was checked, whether it passed, and whether a failure is fatal. */
export interface DiagnosticCheck {
  name: string;
  ok: boolean;
  detail: string;
  fatal?: boolean;
  /**
   * Set only when `detail` was derived from a `DomainError` (a `VaultStatus`
   * read failed) — `doctorCommand` never reads this, so the CLI's stdout is
   * unaffected. The desktop app carries it over the wire so the on-screen row
   * can localize from the code instead of rendering `detail`'s raw
   * `DomainError.message` (D-V(d)): the Copy report is the only place that
   * raw text may still appear, via `detail` itself.
   */
  errorCode?: string;
}

function checkNode(): DiagnosticCheck {
  const [major] = process.versions.node.split(".").map(Number);
  return {
    name: "node",
    ok: (major ?? 0) >= 22,
    detail: `v${process.versions.node} (need >=22)`,
    fatal: true,
  };
}

async function checkSqlcipher(): Promise<DiagnosticCheck> {
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

function checkKeychain(): DiagnosticCheck {
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

function checkVault(status: StatusResult): DiagnosticCheck {
  if (!status.ok) {
    return { name: "vault", ok: false, detail: status.error.message, errorCode: status.error.code };
  }
  const tooNew = status.value.schemaTooNew;
  if (tooNew !== undefined) {
    // Reported, not fatal (D-G): doctor still runs every other check.
    return {
      name: "vault",
      ok: false,
      detail: `schema v${tooNew.vaultVersion} is newer than this valija (supports v${tooNew.supportedVersion}) — update valija`,
      errorCode: "VAULT_SCHEMA_TOO_NEW",
    };
  }
  return {
    name: "vault",
    ok: status.value.initialized,
    detail: status.value.initialized
      ? `${status.value.unlocked ? "unlocked" : "locked"} at ${status.value.dbPath}`
      : 'not initialized — run "valija init"',
  };
}

function checkJournal(status: StatusResult): DiagnosticCheck {
  if (!status.ok) {
    return {
      name: "journal",
      ok: false,
      detail: status.error.message,
      errorCode: status.error.code,
    };
  }
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

/** §5.4: what to do with a leftover pre-rekey backup — delete it when the vault opens, else restore it. */
function rekeyBackupAdvice(status: StatusResult): string {
  if (status.ok && status.value.unlocked) {
    return "the vault opens with your current key — delete it";
  }
  return 'if "valija unlock" works with your current passphrase, delete it; if it does not, restore it (see docs/sync.md, "Changing your passphrase on a synced vault")';
}

function checkSyncFolder(inspection: VaultFolderInspection, status: StatusResult): DiagnosticCheck {
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
  if (inspection.rekeyBackups.length > 0) {
    problems.push(
      `pre-rekey backup(s) encrypted with your PREVIOUS passphrase/key: ${inspection.rekeyBackups.join(", ")} — ${rekeyBackupAdvice(status)}`,
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

function checkLineage(status: StatusResult): DiagnosticCheck {
  if (!status.ok) {
    return {
      name: "lineage",
      ok: false,
      detail: status.error.message,
      errorCode: status.error.code,
    };
  }
  const s = status.value;
  if (s.schemaTooNew !== undefined) {
    return {
      name: "lineage",
      ok: true,
      detail: "not read — the vault's schema is newer than this valija",
    };
  }
  return {
    name: "lineage",
    ok: true,
    detail:
      s.generation === undefined
        ? "unlock to see generation / last-writer"
        : `generation ${s.generation}, last written by ${writerLabel(s.lastWriter, s.lastWriterIsThisDevice)}`,
  };
}

function checkAutoLock(status: StatusResult): DiagnosticCheck {
  if (!status.ok) {
    return {
      name: "auto-lock",
      ok: false,
      detail: status.error.message,
      errorCode: status.error.code,
    };
  }
  const a = status.value.autoLock;
  if (a.ttlMinutes === null) return { name: "auto-lock", ok: true, detail: "disabled" };
  const idle = a.idleForMinutes !== undefined ? `, idle ${a.idleForMinutes.toFixed(1)}m` : "";
  return {
    name: "auto-lock",
    ok: true,
    detail: `${a.ttlMinutes}m TTL${idle}${a.expired ? " (expired)" : ""}`,
  };
}

function checkClient(client: ClientId): DiagnosticCheck {
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

/**
 * The check *computation* `doctor.ts` used to own, lifted out (GUI advance,
 * D-T) so the desktop app's Diagnostics screen reads the same verdicts the
 * CLI prints rather than re-deriving "is the vault healthy" a second time.
 * Same names, same order, same shape as before the extraction — `doctor.ts`'s
 * output stays byte-identical.
 */
export async function runDiagnostics(c: Container): Promise<DiagnosticCheck[]> {
  // Vault status is computed once and shared across the checks that need it —
  // each call opens the SQLCipher db (twice) and reads the keychain, so
  // recomputing it per check would multiply that needlessly.
  const status = c.vaultStatus.execute();
  const inspection = c.folder.inspect();
  return [
    checkNode(),
    await checkSqlcipher(),
    checkKeychain(),
    checkVault(status),
    checkJournal(status),
    checkSyncFolder(inspection, status),
    checkLineage(status),
    checkAutoLock(status),
    ...CLIENTS.map(checkClient),
  ];
}
