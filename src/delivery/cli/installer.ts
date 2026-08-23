import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const CLIENTS = ["claude-code", "claude-desktop", "cursor"] as const;
export type ClientId = (typeof CLIENTS)[number];

const MCP_COMMAND = "npx";
const MCP_ARGS = ["-y", "valija", "mcp"];
const MCP_ENTRY = { command: MCP_COMMAND, args: MCP_ARGS };

/** The entry written into a client's config: an `env` block naming the vault only when the caller supplies one — the CLI's own call site never does, so its output stays byte-identical (D-R(a)'s companion step). */
function mcpEntry(vaultPath?: string): Record<string, unknown> {
  return vaultPath === undefined
    ? { command: MCP_COMMAND, args: MCP_ARGS }
    : { command: MCP_COMMAND, args: MCP_ARGS, env: { VALIJA_HOME: vaultPath } };
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
): Record<string, unknown> {
  const servers =
    typeof existing.mcpServers === "object" && existing.mcpServers !== null
      ? (existing.mcpServers as Record<string, unknown>)
      : {};
  return { ...existing, mcpServers: { ...servers, valija: mcpEntry(vaultPath) } };
}

/**
 * `vaultPath`, when given, is written into the entry's `env` block (D-R(a)'s
 * companion step) — the desktop app always supplies it, from both the
 * ordinary connect flow and the relocation wizard's re-pointing step; the
 * CLI's `install` command never does, so its output is byte-identical.
 */
export function installIntoClient(client: ClientId, vaultPath?: string): InstallResult {
  const configPath = clientConfigPath(client);
  const existing = readExistingConfig(configPath);
  const backupPath = backupExisting(configPath);
  const merged = mergeValijaEntry(existing, vaultPath);
  writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return { configPath, backupPath };
}

export function manualInstructions(client: ClientId): string {
  return (
    `Add this to the "mcpServers" object of ${clientConfigPath(client)}:\n\n` +
    `  "valija": ${JSON.stringify(MCP_ENTRY, null, 2).replace(/\n/g, "\n  ")}\n`
  );
}
