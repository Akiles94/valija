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

/** Merge the valija MCP entry into the client config, backing up the original file first. */
export function installIntoClient(client: ClientId): InstallResult {
  const configPath = clientConfigPath(client);
  let existing: Record<string, unknown> = {};
  let backupPath: string | null = null;

  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, "utf8");
    const parsed: unknown = JSON.parse(raw); // malformed JSON -> throw, never overwrite
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${configPath} does not contain a JSON object; not touching it.`);
    }
    existing = parsed as Record<string, unknown>;
    backupPath = `${configPath}.backup-${Date.now()}`;
    copyFileSync(configPath, backupPath);
  } else {
    mkdirSync(dirname(configPath), { recursive: true });
  }

  const servers =
    typeof existing.mcpServers === "object" && existing.mcpServers !== null
      ? (existing.mcpServers as Record<string, unknown>)
      : {};
  const merged = { ...existing, mcpServers: { ...servers, valija: MCP_ENTRY } };
  writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return { configPath, backupPath };
}

export function manualInstructions(client: ClientId): string {
  return (
    `Add this to the "mcpServers" object of ${clientConfigPath(client)}:\n\n` +
    `  "valija": ${JSON.stringify(MCP_ENTRY, null, 2).replace(/\n/g, "\n  ")}\n`
  );
}
