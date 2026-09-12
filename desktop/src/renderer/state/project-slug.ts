import { parseProjectName } from "../../../../src/context/domain/values/project-name.js";

// Unicode combining-diacritics block (U+0300-U+036F): NFD-normalizing splits an
// accented letter into a base letter plus one of these marks, so stripping the
// block is what turns "e-with-accent"/"n-with-tilde"/"u-with-umlaut" into "e"/"n"/"u".
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Best-effort producer, never a second authority: every non-empty result is verified
 * against `parseProjectName` before being returned, so this can never emit something
 * the domain would then reject (the shape of bug IMPORT-FEEDBACK's V8 already was).
 * Non-Latin scripts (e.g. Cyrillic, Japanese) fold away entirely rather than being
 * transliterated: no dependency is worth adding for that.
 */
export function slugifyProjectName(raw: string): string {
  const candidate = raw
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
    .replace(/-$/, "");
  const parsed = parseProjectName(candidate);
  return parsed.ok ? parsed.value : "";
}

export type ProjectSlugHint =
  | { kind: "hidden" }
  | { kind: "empty" }
  | { kind: "preview"; slug: string }
  | { kind: "existing"; slug: string };

/**
 * What the Import screen renders beneath the free-text field. The "existing project"
 * note wins over "hidden" even when the typed text already equals the slug verbatim:
 * landing in an existing project is new information regardless of whether anything changed.
 */
export function previewProjectSlug(
  raw: string,
  existingProjects: readonly string[],
): ProjectSlugHint {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { kind: "hidden" };
  const slug = slugifyProjectName(trimmed);
  if (slug === "") return { kind: "empty" };
  if (existingProjects.includes(slug)) return { kind: "existing", slug };
  if (slug === trimmed.toLowerCase()) return { kind: "hidden" };
  return { kind: "preview", slug };
}
