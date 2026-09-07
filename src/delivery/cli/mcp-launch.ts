import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface McpLaunchEntry {
  command: string;
  args: string[];
}

/**
 * `shell: true` is required on Windows — `npm` is installed there only as
 * `npm.cmd`, and `execFileSync` alone cannot resolve a `.cmd` shim without
 * going through the shell (same reasoning as
 * `desktop/src/main/infra/child-process-node-probe.ts`). It also covers a
 * GUI-launched Electron app on macOS/Linux inheriting launchd/init's minimal
 * `PATH`, where a shell profile (nvm/fnm/Volta/Homebrew) is what actually
 * puts `npm` on it. No untrusted input crosses this call — every argument
 * here is a literal.
 */
function globalNpmPrefix(): string | null {
  try {
    return execFileSync("npm", ["prefix", "-g"], { shell: true }).toString().trim();
  } catch {
    return null;
  }
}

/** Memoised per process — `resolveMcpLaunch()` is called up to three times per Connect (ensure, the written entry, the manual fallback); this keeps that to at most one real shell-out. `null` is cached too: a machine without npm on `PATH` does not get faster on the second try within the same run. */
let cachedPrefix: string | null | undefined;

function memoizedGlobalNpmPrefix(): string | null {
  if (cachedPrefix === undefined) cachedPrefix = globalNpmPrefix();
  return cachedPrefix;
}

/**
 * The entry that launches an already-installed `valija` through `node`,
 * pointing straight at the published package's JS entry inside the global
 * `node_modules` tree. This removes the per-launch `npx` network fetch (P1)
 * and sidesteps the Windows `.cmd`-shim spawn hazard some MCP hosts hit when
 * they spawn without a shell (D2).
 *
 * Returns `null` — never throws — when the global npm prefix can't be
 * resolved (npm not on `PATH`, or the shell-out otherwise fails), so a
 * caller can turn that into the same recoverable outcome every other
 * `installIntoClient` failure produces, instead of an exception escaping an
 * IPC handler or a CLI command.
 *
 * `resolvePrefix` is a parameter (default: the real, memoised shell-out) so
 * a test can inject a fake prefix, or a `null` failure, without spawning a
 * process.
 */
export function resolveMcpLaunch(
  platform: NodeJS.Platform = process.platform,
  resolvePrefix: () => string | null = memoizedGlobalNpmPrefix,
): McpLaunchEntry | null {
  const globalPrefix = resolvePrefix();
  if (globalPrefix === null) return null;
  const entryPath =
    platform === "win32"
      ? join(globalPrefix, "node_modules", "valija", "dist", "program.js")
      : join(globalPrefix, "lib", "node_modules", "valija", "dist", "program.js");
  return { command: "node", args: [entryPath, "mcp"] };
}

/**
 * Installs `valija` globally when the resolved entry isn't already present
 * on disk, so a first Connect/`install` on a machine that never had `valija`
 * doesn't leave a config pointing at nothing (D4). Bounded by `timeout` so a
 * stalled registry connection cannot freeze the caller (the desktop's main
 * process, for `tools:connect`) forever. After installing, re-checks the
 * entry actually exists — a different global-install layout (pnpm, Volta, a
 * per-user prefix) can make `npm i -g` "succeed" while still leaving nothing
 * at the path this function expects (refined.md §10's top risk), which must
 * become a visible, recoverable failure rather than a silently dead config.
 *
 * Every failure throws a plain `Error` — deliberately not a dedicated type,
 * matching `installIntoClient`'s own `readExistingConfig` — because every
 * caller already treats "could not prepare valija's launch entry" the same
 * way as "could not merge the client's config": fall back to the manual
 * snippet. `checkExists`/`runInstall`/`resolveLaunch` are parameters so a
 * test can exercise both branches (already installed; install then still
 * missing) without shelling out or touching the filesystem.
 */
export function ensureValijaInstalled(
  resolveLaunch: () => McpLaunchEntry | null = resolveMcpLaunch,
  runInstall: (command: string, args: string[]) => void = (command, args) => {
    execFileSync(command, args, { stdio: "ignore", shell: true, timeout: 120_000 });
  },
  checkExists: (path: string) => boolean = existsSync,
): void {
  const launch = resolveLaunch();
  if (launch === null) {
    throw new Error(
      "Could not resolve valija's global install location — is npm on this machine's PATH?",
    );
  }
  const [entryPath] = launch.args;
  if (entryPath !== undefined && checkExists(entryPath)) return;
  runInstall("npm", ["i", "-g", "valija"]);
  if (entryPath === undefined || !checkExists(entryPath)) {
    throw new Error(
      "valija installed, but its expected entry point was not found — this machine's global npm layout may differ from what Valija expects.",
    );
  }
}
