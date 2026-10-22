/**
 * A pure reader for the one thing detection needs from a git config file: the
 * remotes' URLs. No I/O. `include`/`includeIf` and `url.<base>.insteadOf` are
 * deliberately not honoured (D-J): following them would let a repository decide
 * which files valija reads.
 */

const SECTION_HEADER = /^\[\s*([A-Za-z0-9.-]+)(?:\s+"((?:[^"\\]|\\.)*)")?\s*\]/;
const KEY_VALUE = /^([A-Za-z][A-Za-z0-9-]*)\s*(?:=\s*(.*))?$/;

/** `[remote "name"] url = …` pairs from a git config file's text; the first `url` of each remote wins. */
export function remoteUrls(configText: string): Map<string, string> {
  const remotes = new Map<string, string>();
  let remote: string | null = null;
  for (const rawLine of configText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#") || line.startsWith(";")) continue;
    if (line.startsWith("[")) {
      remote = remoteNameOf(line);
      continue;
    }
    if (remote === null || remotes.has(remote)) continue;
    const url = urlValueOf(line);
    if (url !== null) remotes.set(remote, url);
  }
  return remotes;
}

/** D-K: `origin`, else the only remote, else none. */
export function chooseRemote(remotes: Map<string, string>): string | null {
  const origin = remotes.get("origin");
  if (origin !== undefined) return origin;
  if (remotes.size !== 1) return null;
  return [...remotes.values()][0] ?? null;
}

/** Section names are case-insensitive and subsections case-sensitive, as git defines them. */
function remoteNameOf(headerLine: string): string | null {
  const match = SECTION_HEADER.exec(headerLine);
  if (match?.[1]?.toLowerCase() !== "remote" || match[2] === undefined) return null;
  return match[2].replace(/\\(.)/g, "$1");
}

/** Keys are case-insensitive; the value drops a trailing comment and surrounding quotes. */
function urlValueOf(line: string): string | null {
  const match = KEY_VALUE.exec(line);
  if (match?.[1]?.toLowerCase() !== "url" || match[2] === undefined) return null;
  const value = unquote(match[2].trim());
  return value === "" ? null : value;
}

function unquote(value: string): string {
  if (value.startsWith('"')) {
    const end = value.indexOf('"', 1);
    return end === -1 ? value.slice(1) : value.slice(1, end);
  }
  return value.replace(/\s*[#;].*$/, "").trim();
}
