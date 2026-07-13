import { existsSync, readFileSync } from "node:fs";
import { OsKeychain } from "../../infrastructure/keychain/keyring.js";
import type { Container } from "../container.js";
import { CLIENTS, clientConfigPath } from "./installer.js";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
  fatal?: boolean;
}

export async function doctorCommand(c: Container): Promise<void> {
  const checks: Check[] = [];

  const [major] = process.versions.node.split(".").map(Number);
  checks.push({
    name: "node",
    ok: (major ?? 0) >= 22,
    detail: `v${process.versions.node} (need >=22)`,
    fatal: true,
  });

  try {
    const { default: Db } = await import("better-sqlite3-multiple-ciphers");
    const db = new Db(":memory:");
    db.pragma("cipher='sqlcipher'");
    db.close();
    checks.push({ name: "sqlcipher", ok: true, detail: "native module loads" });
  } catch (e) {
    checks.push({ name: "sqlcipher", ok: false, detail: (e as Error).message, fatal: true });
  }

  try {
    const keychain = new OsKeychain();
    keychain.setKey("doctor-probe", "test");
    const roundtrip = keychain.getKey("doctor-probe") === "test";
    keychain.deleteKey("doctor-probe");
    checks.push({ name: "keychain", ok: roundtrip, detail: "OS keychain read/write" });
  } catch (e) {
    checks.push({ name: "keychain", ok: false, detail: (e as Error).message });
  }

  const status = c.vaultStatus.execute();
  if (status.ok) {
    checks.push({
      name: "vault",
      ok: status.value.initialized,
      detail: status.value.initialized
        ? `${status.value.unlocked ? "unlocked" : "locked"} at ${status.value.dbPath}`
        : 'not initialized — run "valija init"',
    });
  } else {
    checks.push({ name: "vault", ok: false, detail: status.error.message });
  }

  for (const client of CLIENTS) {
    const path = clientConfigPath(client);
    let detail = "config not found";
    let installed = false;
    if (existsSync(path)) {
      detail = "config found, valija not installed";
      try {
        const parsed = JSON.parse(readFileSync(path, "utf8")) as {
          mcpServers?: Record<string, unknown>;
        };
        installed = parsed.mcpServers?.valija !== undefined;
        if (installed) detail = "valija installed";
      } catch {
        detail = "config exists but is not valid JSON";
      }
    }
    checks.push({ name: client, ok: installed, detail });
  }

  let fatal = false;
  for (const check of checks) {
    console.log(`${check.ok ? "✓" : "✗"} ${check.name.padEnd(16)} ${check.detail}`);
    if (!check.ok && check.fatal) fatal = true;
  }
  if (fatal) process.exit(1);
}
