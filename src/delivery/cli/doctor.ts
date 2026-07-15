import { existsSync, readFileSync } from "node:fs";
import { OsKeychain } from "../../vault/infra/keyring.js";
import type { Container } from "../container.js";
import { CLIENTS, type ClientId, clientConfigPath } from "./installer.js";

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

function checkVault(c: Container): Check {
  const status = c.vaultStatus.execute();
  if (!status.ok) return { name: "vault", ok: false, detail: status.error.message };
  return {
    name: "vault",
    ok: status.value.initialized,
    detail: status.value.initialized
      ? `${status.value.unlocked ? "unlocked" : "locked"} at ${status.value.dbPath}`
      : 'not initialized — run "valija init"',
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
  const checks: Check[] = [
    checkNode(),
    await checkSqlcipher(),
    checkKeychain(),
    checkVault(c),
    ...CLIENTS.map(checkClient),
  ];

  let fatal = false;
  for (const check of checks) {
    console.log(`${check.ok ? "✓" : "✗"} ${check.name.padEnd(16)} ${check.detail}`);
    if (!check.ok && check.fatal) fatal = true;
  }
  if (fatal) process.exit(1);
}
