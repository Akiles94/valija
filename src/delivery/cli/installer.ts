import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const CLIENTS = ["claude-code", "claude-desktop", "cursor"] as const;
export type ClientId = (typeof CLIENTS)[number];

const MCP_ENTRY = { command: "npx", args: ["-y", "valija", "mcp"] };

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
function mergeValijaEntry(existing: Record<string, unknown>): Record<string, unknown> {
  const servers =
    typeof existing.mcpServers === "object" && existing.mcpServers !== null
      ? (existing.mcpServers as Record<string, unknown>)
      : {};
  return { ...existing, mcpServers: { ...servers, valija: MCP_ENTRY } };
}

export function installIntoClient(client: ClientId): InstallResult {
  const configPath = clientConfigPath(client);
  const existing = readExistingConfig(configPath);
  const backupPath = backupExisting(configPath);
  const merged = mergeValijaEntry(existing);
  writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return { configPath, backupPath };
}

export function manualInstructions(client: ClientId): string {
  return (
    `Add this to the "mcpServers" object of ${clientConfigPath(client)}:\n\n` +
    `  "valija": ${JSON.stringify(MCP_ENTRY, null, 2).replace(/\n/g, "\n  ")}\n`
  );
}
