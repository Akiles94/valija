import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { contextErr } from "../errors.js";

/** A normalized git remote: `host/owner/repo`. Never carries a scheme, port, userinfo, or `.git`. */
export type RepositoryTarget = string & { readonly __brand: "RepositoryTarget" };

const MAX_REMOTE_LENGTH = 2048;
const URL_SCHEMES = ["ssh:", "git+ssh:", "ssh+git:", "git:", "http:", "https:"];
/** `[user@]host:path` — the host is longer than one character, so `C:\repo` is never one. */
const SCP_FORM = /^(?:[^@/:]+@)?([^@/:\\]{2,}):(?!\/\/)(.+)$/;
const HOST = /^[a-z0-9.-]+$/;
/** Conservative on purpose: no `@`, `:`, `?` or `#`, so nothing credential-shaped survives in a path. */
const PATH_SEGMENT = /^[A-Za-z0-9._~%-]+$/;

interface RemoteParts {
  host: string;
  path: string;
}

/** Every rejection carries the same sentence: the raw input may hold a token and is never echoed. */
export function parseRepositoryTarget(rawRemoteUrl: string): Result<RepositoryTarget, DomainError> {
  const raw = rawRemoteUrl.trim();
  if (raw === "" || raw.length > MAX_REMOTE_LENGTH) return unusableRemote();
  const parts = splitUrlForm(raw) ?? splitScpForm(raw);
  if (parts === null) return unusableRemote();
  const host = parts.host.toLowerCase();
  if (!HOST.test(host)) return unusableRemote();
  const path = normalizePath(parts.path);
  if (path === null) return unusableRemote();
  return ok(`${host}/${path}` as RepositoryTarget);
}

/** The last path segment (`valija`): the name-match hint candidate (D-E). */
export function repositoryName(target: RepositoryTarget): string {
  return target.slice(target.lastIndexOf("/") + 1);
}

/** Only `hostname` is read from the URL, so userinfo and port are dropped by construction. */
function splitUrlForm(raw: string): RemoteParts | null {
  const scheme = raw.slice(0, raw.indexOf(":") + 1).toLowerCase();
  if (!URL_SCHEMES.includes(scheme) || !raw.startsWith("//", scheme.length)) return null;
  const host = hostnameOf(raw);
  if (host === null) return null;
  const authorityAndPath = raw.slice(scheme.length + 2);
  const slash = authorityAndPath.indexOf("/");
  return { host, path: slash === -1 ? "" : authorityAndPath.slice(slash) };
}

function hostnameOf(raw: string): string | null {
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

function splitScpForm(raw: string): RemoteParts | null {
  if (raw.includes("://")) return null;
  const match = SCP_FORM.exec(raw);
  if (!match?.[1] || !match[2]) return null;
  return { host: match[1], path: match[2] };
}

/** Raw path segments, not `URL.pathname`: a URL would quietly resolve `..` instead of rejecting it. */
function normalizePath(rawPath: string): string | null {
  const collapsed = rawPath.replace(/\/{2,}/g, "/");
  const unprefixed = collapsed.replace(/^(\/|~\/)/, "").replace(/\/$/, "");
  const path = unprefixed.replace(/\.git$/, "").replace(/\/$/, "");
  const segments = path.split("/");
  const usable = segments.every(
    (segment) => segment !== "." && segment !== ".." && PATH_SEGMENT.test(segment),
  );
  return usable ? path : null;
}

function unusableRemote(): Result<never, DomainError> {
  return contextErr(
    "NO_GIT_REMOTE",
    "That remote is not a host/owner/repo address valija can use.",
  );
}
