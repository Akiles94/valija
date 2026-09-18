# PROJECT-NAME-SLUG — Plan (fast-tracked)

**Ceremony:** fast-tracked per Oscar, 2026-09-12 ("fast-trackalo, ya la charlamos a fondo") —
no `task-planner`, no `change-reviewer`, no `git-ops`. Main agent writes this plan, implements,
self-reviews, and ships directly. The one gate that still applies mechanically
(`guard-implementation.sh`): no edit to `desktop/**` until this file carries the line below.

```
Approved: Oscar 2026-09-12
```

**Branch:** stay on the current branch, `feat/desktop-GUI` — matching how the immediate
predecessor, `IMPORT-FEEDBACK`, shipped its six slices directly on this branch rather than
opening a new one (no `feat/importers-M2`-style dedicated branch exists for it either). Same
screen, same lineage of Import-screen UX advances, not yet merged to `main`.

**Spec:** `advances/PROJECT-NAME-SLUG/refined.md` — read in full during Gate R with Oscar
(discussed at length: the "why no spaces" rationale, Option A vs. a rejected display-name
Option B, then all eleven decisions D-1…D-11, all left at their stated defaults). This plan
implements those defaults as-is, with two small refinements flagged in §0 below that weren't
pinned down to the letter in refined.md and are cheap enough not to warrant a fresh round —
called out here so Oscar sees them before approving, per usual practice even without a formal
Gate P.

---

## 0. Two refinements beyond refined.md's letter (flag before approving)

1. **D-1's "hide when unchanged" vs. D-5's "announce a collision"**: refined.md's acceptance
   criteria say both "the line is absent when the typed text is already a valid slug" (D-1) and
   "a slug equal to an existing project's name is announced as such before submitting" (D-5).
   Those conflict if someone types the existing project's slug verbatim (e.g. `mi-proyecto`
   already exists and she types `mi-proyecto` exactly). Resolution: **the collision note wins**
   — it shows even when the typed text already equals the slug, because "this will land in an
   existing project" is new information regardless of whether any character changed. The plain
   "will be saved as" line still hides when unchanged and there's no collision.
2. **Truncation + trailing hyphen interaction (D-2 step 5)**: truncating to 64 chars can leave a
   trailing `-` (e.g. char 64 was about to start a new word). Step 5 says "truncate, then strip a
   trailing hyphen again" — implemented as: truncate, strip trailing `-`, which can leave 63
   chars. This is truncation, not a bug; the unit test table (§3) pins the exact expected output
   so it's not a case of "whatever the code happens to do."

---

## 1. New module: `desktop/src/renderer/state/project-slug.ts`

Pure, no React, sibling `project-slug.test.ts` — same shape as `import-selection.ts` next to it.
Imports `parseProjectName` from `../../../../src/context/domain/values/project-name.js` (precedent:
`screens/project.tsx:2` already imports `ITEM_TYPES` from the same domain tree) so the slugifier can
never disagree with the one authority that actually enforces the rule (D-3).

```ts
import { parseProjectName } from "../../../../src/context/domain/values/project-name.js";

/** Best-effort producer, not an authority — parseProjectName is still the last word (D-3). */
const COMBINING_MARKS = /[̀-ͯ]/g; // Unicode combining-diacritics block: é→e, ñ→n after NFD

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
```

`previewProjectSlug` is what `import.tsx` renders from; `slugifyProjectName` is what gets sent
over IPC. `resolvedProjectName()` in `import.tsx` becomes: for `NEW_PROJECT`,
`slugifyProjectName(newProjectName)` (empty string → `null`, matching today's "empty → null"
shape); unchanged for an existing-project selection.

### Unit test table (`project-slug.test.ts`)

| Input | `slugifyProjectName` | Note |
|---|---|---|
| `"Openai 1"` | `"openai-1"` | the reported bug |
| `"Café Ñandú ☕"` | `"cafe-nandu"` | accents folded, emoji dropped |
| `"  --Hola--  "` | `"hola"` | leading/trailing space and hyphens both stripped |
| `"☕☕"` | `""` | no Latin letters/digits — no slug |
| `"проект"` / `"プロジェクト"` | `""` | non-Latin scripts fail loudly, not silently mangled (D-2) |
| `"a".repeat(80)` | 64 chars, no trailing `-` | truncation |
| `"9lives"` | `"9lives"` | digit-leading is valid per the domain rule |
| `"-x"` | `"x"` | leading hyphen stripped (domain rule forbids a leading hyphen) |
| `"openai-1"` | `"openai-1"` | already-valid input is a no-op |
| every non-empty output | — | property check: `parseProjectName(slugifyProjectName(x)).ok === true` for every table row that isn't `""` |

Plus a `previewProjectSlug` table: empty input → `hidden`; already-valid text → `hidden`;
`"Openai 1"` → `preview("openai-1")`; a slug matching a name in `existingProjects` → `existing(...)`
**even when the raw text was already that exact slug** (§0.1); `"☕☕"` → `empty`.

---

## 2. `desktop/src/renderer/screens/import.tsx`

| Where | Change |
|---|---|
| L58 area | no new state — `previewProjectSlug`/`slugifyProjectName` are called from render + `resolvedProjectName`, not stored |
| `resolvedProjectName()` (L149-152) | `NEW_PROJECT` branch calls `slugifyProjectName(newProjectName)` instead of `.trim()`; `""` → `null` (same empty-is-null shape as today) |
| `canSubmit` (L194) | unchanged expression — it already calls `resolvedProjectName()`, which now returns `null` whenever no valid slug exists, so D-4 ("disable when no valid slug") falls out for free once `resolvedProjectName` is fixed. No separate change needed here — noted so the planner-less implementer doesn't add a redundant check. |
| new-project `<input>` (L284-289) | gains `id`, a `<label htmlFor>` wrapping it (text: `import.projectNameLabel`), `placeholder={t("import.projectNamePlaceholder")}`, and `aria-describedby` pointing at the hint paragraph's id (D-9). The input's `value`/`onChange` are untouched — it still shows exactly what the user types, cursor never moved (D-1 Option A). |
| beneath the input | a new `<p id="...">` rendered from `previewProjectSlug(newProjectName, existingProjects)`: `hidden` → render nothing; `empty` → `import.projectSlugEmpty`; `preview` → `t("import.projectSlugPreview", { slug })`; `existing` → `t("import.projectSlugExisting", { slug })` |
| `runSelection` (L154-166) | `projectName` in the request becomes `resolvedProjectName()`'s value directly (it's already what's sent — just now it's the slug because `resolvedProjectName` changed, not `runSelection` itself) |

No new prop, no new component, no router change — matches refined.md §8.

---

## 3. Catalogs — `desktop/src/shared/i18n/catalogs/{en,es}.ts`

New keys under the existing `import: { … }` block, beside `projectLabel`/`projectNewOption`:

```ts
// en.ts
projectNameLabel: "Project name",
projectNamePlaceholder: "e.g. openai-1",
projectSlugPreview: "Will be saved as: {slug}",
projectSlugExisting: "Will be saved as: {slug} (existing project — items will be added there)",
projectSlugEmpty: "Type at least one letter or number.",
```

```ts
// es.ts
projectNameLabel: "Nombre del proyecto",
projectNamePlaceholder: "ej. openai-1",
projectSlugPreview: "Se guardará como: {slug}",
projectSlugExisting: "Se guardará como: {slug} (proyecto existente — se añadirá ahí)",
projectSlugEmpty: "Escribe al menos una letra o un número.",
```

And the D-6/D-14 "copy note" rewrite, in the `errors: { … }` block (both files, same key,
`INVALID_PROJECT_NAME`, replacing the current generic line):

```
en: "Project names can only use lowercase letters, numbers and hyphens — no spaces. For example: openai-1."
es: "Los nombres de proyecto solo pueden llevar minúsculas, números y guiones, sin espacios. Por ejemplo: openai-1."
```

No `{placeholders}` in the error string (parity is trivial); `{slug}` in the three new keys must
match verbatim between `en.ts` and `es.ts` for `catalogs.test.ts`'s placeholder-parity check.

---

## 4. CSS — `desktop/src/renderer/styles/screens.css`

One small rule appended to the existing `.import …` block (after L449 area, beside
`.import-busy`/`.import-failures`), styling the new hint paragraph as a quiet, small-text line —
existing tokens only (`var(--color-text-muted)`), no asset, no `url()`:

```css
.import .project-slug-hint {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
```

---

## 5. Tests — `desktop/src/renderer/screens/__dom-tests__/import.dom.test.tsx`

New cases, each written to fail against today's code first:

1. Selecting **New project…** and typing `Openai 1` renders a hint text containing `openai-1`,
   and the input's own value stays `Openai 1`.
2. Clicking **Import** after typing `Openai 1` calls the fake `bridge.import.run` with
   `projectName: "openai-1"` — asserting the **argument**, not the summary text (the only proof
   the transform actually reaches the backend).
3. Typing `☕☕` disables both the Preview and Import buttons.
4. Typing a name that slugifies to an entry already in the fake bridge's `content.projects()`
   result shows the "existing project" copy.
5. Typing already-valid text (`openai-1`) shows no hint line at all.

---

## 6. Docs — `docs/gui.md`, §"Importing your chat history"

One paragraph: project names are stored as slugs; the field shows what you type but tells you,
before you submit, the slug it will actually save as; that saved slug is what you'll see
afterwards everywhere (project list, CLI, MCP, context-pack headers); the CLI stays strict on
purpose (`-p "My Proj"` still fails) because a CLI flag is an address a script relies on, not
prose a human is composing.

---

## 7. Repo structure after execution

```
desktop/src/renderer/state/
  project-slug.ts          (new)
  project-slug.test.ts     (new)
desktop/src/renderer/screens/
  import.tsx                              (edited: label, hint line, resolvedProjectName)
  __dom-tests__/import.dom.test.tsx        (edited: 5 new cases)
desktop/src/shared/i18n/catalogs/
  en.ts                                    (edited: 5 new import.* keys, 1 error copy rewrite)
  es.ts                                    (edited: same 5 keys, same rewrite)
desktop/src/renderer/styles/
  screens.css                              (edited: 1 new rule)
docs/gui.md                                (edited: 1 paragraph)
```

No file under `src/**`, `desktop/src/shared/ipc/**`, preload, or `package.json` is touched.
`src/context/domain/values/project-name.ts` is imported, never modified.

---

## 8. Slices (commit order, mirroring IMPORT-FEEDBACK's style)

1. `project-slug.ts` + its test — pure unit, provable in isolation before any UI wiring.
2. Wire `import.tsx`: label/id/aria, hint paragraph, `resolvedProjectName` using the slug.
3. Catalog keys (both languages) + the `INVALID_PROJECT_NAME` rewrite + the CSS rule.
4. DOM test cases.
5. `docs/gui.md` paragraph.

Each slice: `npm run typecheck && npm run lint && npm run test` in the repo root, then in
`desktop/`, before moving to the next.

---

## 9. Ship (fast-track — no `git-ops`)

Main agent commits each slice, then, once all slices are green: shows the exact `git push` /
merge commands for eyeballing, pushes the branch, and merges to `main` with `--no-ff` — same
rule as always ("every advance gets its own merge commit, even if it would fast-forward"), just
run by the main agent instead of delegating to `git-ops`, per the fast-track note in `CLAUDE.md`.
No `review.md` is produced; the acceptance criteria in `refined.md` §6 are checked inline by the
main agent before shipping instead of by `change-reviewer`.
