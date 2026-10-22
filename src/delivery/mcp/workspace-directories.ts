import { statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { isSameOrInside, pathModuleFor } from "../../shared/domain/services/path-containment.js";

/** How long a client gets to answer `roots/list` before the server falls back to its cwd (spike.md §1). */
const ROOTS_TIMEOUT_MS = 2_000;

/** The two calls of the SDK server this adapter needs, so tests can stub them. */
export type RootsSource = Pick<Server, "getClientCapabilities" | "listRoots">;

/** Where the server process runs. Injected so tests never depend on the real home or platform. */
export interface WorkspaceEnvironment {
  cwd(): string;
  home: string;
  platform: NodeJS.Platform;
  /** The folder of the node binary the client launched this server with. */
  execDir: string;
  /** Environment variables, read for the Windows install folders only. */
  variables: Readonly<Record<string, string | undefined>>;
}

/** The real process environment (cwd, home, platform, install folder) the MCP server detects from. */
export const processWorkspaceEnvironment = (): WorkspaceEnvironment => ({
  cwd: () => process.cwd(),
  home: homedir(),
  platform: process.platform,
  execDir: dirname(process.execPath),
  variables: process.env,
});

/**
 * D-C: the folders the client declared as roots; otherwise the server's cwd,
 * unless it is clearly not a workspace (P-2: empty, failing or slow roots fall
 * back to the cwd too). Roots and cwd come from the client process, never from
 * the model. Nothing is cached (D-S).
 */
export async function workspaceDirectories(
  server: RootsSource,
  env: WorkspaceEnvironment,
): Promise<string[]> {
  const roots = await declaredRoots(server);
  if (roots.length > 0) return roots;
  const cwd = env.cwd();
  return isNonWorkspaceDirectory(cwd, env) ? [] : [cwd];
}

/** The filesystem root, the home folder or one of its ancestors, or where node / the client is installed (P-3). */
export function isNonWorkspaceDirectory(dir: string, env: WorkspaceEnvironment): boolean {
  const inside = (root: string) => root !== "" && isSameOrInside(root, dir, env.platform);
  const path = pathModuleFor(env.platform);
  if (isFilesystemRoot(dir, env.platform)) return true;
  if (env.home !== "" && isSameOrInside(dir, env.home, env.platform)) return true;
  if (inside(env.execDir)) return true;
  if (env.home !== "" && inside(path.join(env.home, ".npm"))) return true;
  return installFolders(env).some(inside);
}

async function declaredRoots(server: RootsSource): Promise<string[]> {
  if (server.getClientCapabilities()?.roots === undefined) return [];
  try {
    const { roots } = await server.listRoots({}, { timeout: ROOTS_TIMEOUT_MS });
    return roots.flatMap((root) => existingFolderOf(root.uri));
  } catch {
    return [];
  }
}

/** A `file:` URI that names an existing directory, as a path; anything else is dropped. */
function existingFolderOf(uri: string): string[] {
  if (!uri.startsWith("file:")) return [];
  try {
    const folder = fileURLToPath(uri);
    return statSync(folder).isDirectory() ? [folder] : [];
  } catch {
    return [];
  }
}

function isFilesystemRoot(dir: string, platform: NodeJS.Platform): boolean {
  const { parse, resolve } = pathModuleFor(platform);
  const resolved = resolve(dir);
  return parse(resolved).root === resolved;
}

function installFolders(env: WorkspaceEnvironment): string[] {
  if (env.platform === "darwin") return ["/Applications", "/System", "/Library"];
  if (env.platform !== "win32") return [];
  const { ProgramFiles, LOCALAPPDATA } = env.variables;
  const programFilesX86 = env.variables["ProgramFiles(x86)"];
  const localPrograms = LOCALAPPDATA === undefined ? undefined : `${LOCALAPPDATA}\\Programs`;
  return [ProgramFiles, programFilesX86, localPrograms].filter(
    (folder): folder is string => folder !== undefined && folder !== "",
  );
}
