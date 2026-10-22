import { posix, win32 } from "node:path";

/** win32 and darwin both have case-insensitive filesystems by default, so path comparisons fold case there. */
export function isCaseInsensitivePlatform(platform: NodeJS.Platform): boolean {
  return platform === "win32" || platform === "darwin";
}

/**
 * The `platform` argument, not the host OS, decides path semantics — `node:path`'s
 * default export is host-bound and would silently apply win32's own case-insensitive
 * `relative()` even when simulating "linux" on a Windows host (or vice versa).
 */
export function pathModuleFor(platform: NodeJS.Platform): typeof posix {
  return platform === "win32" ? win32 : posix;
}

/** True if `candidate`, after `resolve()`, is `root` itself or nested inside it (case-folded on win32/darwin). */
export function isSameOrInside(
  root: string,
  candidate: string,
  platform: NodeJS.Platform,
): boolean {
  const { resolve, relative, isAbsolute } = pathModuleFor(platform);
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  const [normalizedRoot, normalizedCandidate] = isCaseInsensitivePlatform(platform)
    ? [resolvedRoot.toLowerCase(), resolvedCandidate.toLowerCase()]
    : [resolvedRoot, resolvedCandidate];

  if (normalizedRoot === normalizedCandidate) return true;

  const rel = relative(normalizedRoot, normalizedCandidate);
  return rel.length > 0 && !rel.startsWith("..") && !isAbsolute(rel);
}
