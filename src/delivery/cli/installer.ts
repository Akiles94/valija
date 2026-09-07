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
 * `npx -y valija` fetch. `resolveMcpLaunch()` returns `null` rather than
 * throwing when npm can't be reached — this function turns that into a
 * plain thrown `Error` (matching `readExistingConfig`'s own style), which
 * every caller of `installIntoClient` already catches and treats the same
 * as an unmergeable config: fall back to the manual snippet.
 */
function mcpEntry(vaultPath?: string, autoLockMinutes?: number | null): Record<string, unknown> {
  const launch = resolveMcpLaunch();
  if (launch === null) {
    throw new Error("Could not resolve valija's launch entry — is npm on this machine's PATH?");
  }
  const { command, args } = launch;
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

/**
 * Never throws (C2) — this is the fallback shown after something else has
 * already failed, so it cannot itself depend on that same thing succeeding.
 * `resolveMcpLaunch()` already returns `null` instead of throwing; when it
 * does, this renders a template entry the user fills in by hand rather than
 * a resolved absolute path, and always leads with the one command
 * (`npm i -g valija`) that fixes the most common cause (W6).
 */
export function manualInstructions(client: ClientId): string {
  const launch = resolveMcpLaunch();
  const entry =
    launch ??
    ({
      command: "node",
      args: [
        "<the folder 'npm prefix -g' prints>/lib/node_modules/valija/dist/program.js (Windows: no 'lib' segment)",
        "mcp",
      ],
    } satisfies { command: string; args: string[] });
  return (
    `First, make sure valija is installed globally:\n\n  npm i -g valija\n\n` +
    `Then add this to the "mcpServers" object of ${clientConfigPath(client)}:\n\n` +
    `  "valija": ${JSON.stringify(entry, null, 2).replace(/\n/g, "\n  ")}\n`
  );
}
