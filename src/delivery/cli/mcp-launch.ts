import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface McpLaunchEntry {
  command: string;
  args: string[];
}

/**
 * The entry that launches an already-installed `valija` through `node`,
 * pointing straight at the published package's JS entry inside the global
 * `node_modules` tree. This removes the per-launch `npx` network fetch (P1)
 * and sidesteps the Windows `.cmd`-shim spawn hazard some MCP hosts hit when
 * they spawn without a shell (D2).
 *
 * `globalPrefix` defaults to a real `npm prefix -g` shell-out but is a
 * parameter so a test can pass a fake prefix instead of asserting an
 * absolute, machine-specific path.
 */
export function resolveMcpLaunch(
  platform: NodeJS.Platform = process.platform,
  globalPrefix: string = execFileSync("npm", ["prefix", "-g"]).toString().trim(),
): McpLaunchEntry {
  const entryPath =
    platform === "win32"
      ? join(globalPrefix, "node_modules", "valija", "dist", "program.js")
      : join(globalPrefix, "lib", "node_modules", "valija", "dist", "program.js");
  return { command: "node", args: [entryPath, "mcp"] };
}

/** A typed failure `ensureValijaInstalled` throws instead of a raw `Error` — callers catch this specifically and fall back to the existing Node-missing / manual-snippet path (D4) rather than surfacing the underlying `npm` output. */
export class ValijaInstallError extends Error {}

/**
 * Installs `valija` globally when the resolved entry isn't already present
 * on disk, so a first Connect/`install` on a machine that never had `valija`
 * doesn't leave a config pointing at nothing (D4). Never blocks on a
 * permission failure being silent — the caller decides what to show.
 */
export function ensureValijaInstalled(): void {
  const [entryPath] = resolveMcpLaunch().args;
  if (entryPath !== undefined && existsSync(entryPath)) return;
  try {
    execFileSync("npm", ["i", "-g", "valija"], { stdio: "ignore" });
  } catch (e) {
    throw new ValijaInstallError((e as Error).message);
  }
}
