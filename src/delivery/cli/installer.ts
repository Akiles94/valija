import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { formatAutoLockMinutes } from "../../vault/domain/values/auto-lock-ttl.js";
import { resolveMcpLaunch } from "./mcp-launch.js";

export const CLIENTS = ["claude-code", "claude-desktop", "cursor"] as const;
export type ClientId = (typeof CLIENTS)[number];

/**
 * The entry written into a client's config: an `env` block naming the vault
 * and/or the chosen auto-lock TTL only for the keys the caller actually
 * supplies — the CLI's own call site supplies neither, so its output stays
 * byte-identical (D-R(a)'s companion step; CONNECT D-D's TTL rider). Launch
 * shape per CONNECT D2/D-A: `resolveMcpLaunch()`, never the old per-launch
 * `npx -y valija` fetch.
 */
function mcpEntry(vaultPath?: string, autoLockMinutes?: number | null): Record<string, unknown> {
  const { command, args } = resolveMcpLaunch();
  const env: Record<string, string> = {};
  if (vaultPath !== undefined) env.VALIJA_HOME = vaultPath;
  if (autoLockMinutes !== undefined) {
    env.VALIJA_AUTOLOCK_MINUTES = formatAutoLockMinutes(autoLockMinutes);
  }
  return Object.keys(env).length === 0 ? { command, args } : { command, args, env };
}

export function clientConfigPath(client: ClientId, platform = process.platform): string {
  const home = homedir();
  switch (client) {
    case "claude-code":
      return join(home, ".claude.json");
    case "cursor":
      return join(home, ".cursor", "mcp.json");
    case "claude-desktop": {
      if (platform === "win32")
        return join(
          process.env.APPDATA ?? join(home, "AppData", "Roaming"),
          "Claude",
          "claude_desktop_config.json",
        );
      if (platform === "darwin")
        return join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
      return join(home, ".config", "Claude", "claude_desktop_config.json");
    }
  }
}

export interface InstallResult {
  configPath: string;
  backupPath: string | null;
}

/** Read the client config as an object; malformed or non-object content aborts — never overwrite it. */
function readExistingConfig(configPath: string): Record<string, unknown> {
  if (!existsSync(configPath)) return {};
  const parsed: unknown = JSON.parse(readFileSync(configPath, "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${configPath} does not contain a JSON object; not touching it.`);
  }
  return parsed as Record<string, unknown>;
}

/** Copy the current config aside before modifying it; ensure the directory for fresh installs. */
function backupExisting(configPath: string): string | null {
  if (!existsSync(configPath)) {
    mkdirSync(dirname(configPath), { recursive: true });
    return null;
  }
  const backupPath = `${configPath}.backup-${Date.now()}`;
  copyFileSync(configPath, backupPath);
  return backupPath;
}

/** Merge the valija server into mcpServers, preserving everything else in the config. */
function mergeValijaEntry(
  existing: Record<string, unknown>,
  vaultPath?: string,
  autoLockMinutes?: number | null,
): Record<string, unknown> {
  const servers =
    typeof existing.mcpServers === "object" && existing.mcpServers !== null
      ? (existing.mcpServers as Record<string, unknown>)
      : {};
  return {
    ...existing,
    mcpServers: { ...servers, valija: mcpEntry(vaultPath, autoLockMinutes) },
  };
}

/**
 * `vaultPath`, when given, is written into the entry's `env` block (D-R(a)'s
 * companion step) — the desktop app always supplies it, from both the
 * ordinary connect flow and the relocation wizard's re-pointing step.
 * `autoLockMinutes`, when given, is written alongside it as
 * `VALIJA_AUTOLOCK_MINUTES` (CONNECT D-D) — written only on the desktop's own
 * Connect press (D-F), never a silent background rewrite. The CLI's
 * `install` command supplies neither, so its output stays byte-identical.
 */
export function installIntoClient(
  client: ClientId,
  vaultPath?: string,
  autoLockMinutes?: number | null,
): InstallResult {
  const configPath = clientConfigPath(client);
  const existing = readExistingConfig(configPath);
  const backupPath = backupExisting(configPath);
  const merged = mergeValijaEntry(existing, vaultPath, autoLockMinutes);
  writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return { configPath, backupPath };
}

export function manualInstructions(client: ClientId): string {
  return (
    `Add this to the "mcpServers" object of ${clientConfigPath(client)}:\n\n` +
    `  "valija": ${JSON.stringify(resolveMcpLaunch(), null, 2).replace(/\n/g, "\n  ")}\n`
  );
}
