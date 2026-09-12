# PROJECT-NAME-SLUG — you type "Openai 1", Valija saves `openai-1` · Refined Spec

**Status:** Gate R open. Every decision below carries a **Default:**; the main agent takes them to
Oscar before any planning.
**Directory:** `PROJECT-NAME-SLUG`, deliberately not a milestone number — same posture as
`IMPORT-FEEDBACK` / `GUI` / `CONNECT` / `CARDS`.
**Origin:** Oscar, using the app: he imported chats, typed **"Openai 1"** as the new project name,
and got *"Ese nombre de proyecto no es válido."* / *"That project name isn't valid."* — a message
that names no rule, offers no example, and arrives only after he has already committed to the run.
**Predecessor:** `advances/IMPORT-FEEDBACK/` (shipped). Its **D-14** made Preview and Import agree
about a bad name, and its §4 explicitly deferred exactly this follow-up: *"Loosening or changing
`parseProjectName`'s rule itself, or adding client-side input formatting / a live-validation hint on
the free-text field … a `pattern`/hint on the field is a reasonable follow-up but not required to
close the reported bug."* This advance is that follow-up.

**Scope posture already settled with Oscar (do not re-litigate):** there remains exactly **one**
name — the slug. Oscar was offered and **rejected** a separate `displayName` domain field (new
entity field, DB migration, "which one does `-p` address?", collision handling) and chose the
smaller fix: **the GUI's free-text field accepts what a human types and turns it into the slug
before anything is sent to the backend.** The pretty text the user typed is **not preserved
anywhere** — Oscar accepted that trade-off explicitly.

---

## 1. Goal

**Make the desktop Import screen's "new project" field accept human text — spaces, uppercase,
accents — and show the user, before they commit, the exact slug it will become; and make the
`INVALID_PROJECT_NAME` message state the rule instead of just asserting a verdict.**

No change to `parseProjectName`'s rule. No new domain field. No DB migration. No CLI or MCP change.
The slug the user ends up with is the same identifier it has always been.

---

## 2. Ground truth read from the repo (so the planner does not re-derive it)

### 2.1 The rule, and why it is what it is

`src/context/domain/values/project-name.ts`:

```ts
const PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;              // line 4
export function parseProjectName(raw: string): Result<ProjectName, DomainError> {
  const normalized = raw.trim().toLowerCase();            // line 10 — trim + lowercase already happen
  if (!PATTERN.test(normalized)) return contextErr("INVALID_PROJECT_NAME", `…Got: "${raw}"`);
  return ok(normalized as ProjectName);
}
```

So today **trim and lowercase are already forgiven**; spaces, accents and every other character are
not. `"Openai 1"` → `"openai 1"` → fails on the space. Max length is 64 (1 + 63).

`ProjectName` is the single addressable identifier, everywhere:

| Surface | Evidence |
|---|---|
| CLI | `src/delivery/cli/import-command.ts:31-38` — `-p <project>` is required to import |
| SQLite | `src/context/infra/project-repo.ts` — `findByName`, unique key |
| MCP tool arguments | project is passed by name |
| Context-pack markdown | the name is the pack's header |
| Spec | `docs/SPEC.md:73` "unique slug, 1-64 chars, `[a-z0-9-]`"; `specs/context.md:11` |
| Entity | `src/context/domain/entities/project.ts` has **only** `name: ProjectName` — there is no `displayName` concept anywhere in the domain |

### 2.2 The field as it exists today

`desktop/src/renderer/screens/import.tsx`:

| Line | What is there |
|---|---|
| 58 | `const [newProjectName, setNewProjectName] = useState("")` |
| 149-152 | `resolvedProjectName()` — `projectChoice === NEW_PROJECT ? newProjectName.trim() : projectChoice`, `null` when empty |
| 156-158 | `runSelection` sends `projectName` straight into the IPC request, raw |
| 194 | `canSubmit = resolvedProjectName() !== null && buildPickSpec(checked) !== undefined` |
| 272-282 | the project `<select>`: `import.projectNewOption` plus every existing project name (loaded at mount, line 68) |
| **284-289** | the free-text input: **no `label`, no `aria-label`, no `placeholder`, no `pattern`, no `maxLength`, no hint, no id** — a bare `<input type="text">` |
| 315 | the result summary echoes `resolvedProjectName()` back to the user |

The only client-side rule today is "not empty after trim". Everything else is discovered by failing.

### 2.3 What happens on failure now

`bridge.import.preview` / `.run` → `ImportConversations` → `parseProjectName` (both branches since
IMPORT-FEEDBACK D-14) → `Result` with code `INVALID_PROJECT_NAME` → `errorCopy(code)`
(`i18n-context.tsx:48-51`, which renders the **code**, never `DomainError.message`) →

- `desktop/src/shared/i18n/catalogs/en.ts:338` — `INVALID_PROJECT_NAME: "That project name isn't valid."`
- `desktop/src/shared/i18n/catalogs/es.ts:342` — `INVALID_PROJECT_NAME: "Ese nombre de proyecto no es válido."`

Note the structural constraint: **`errorCopy` is keyed by code alone** — the copy cannot vary per
call site, and the domain's own explanatory message (`"…1-64 chars of [a-z0-9-]…"`) deliberately
never reaches the screen (a GUI rule, D-V(d): render codes, not messages). So the catalog string is
the *only* place the rule can be told to the user through the error path. Every other
`INVALID_PROJECT_NAME` call site in the app (search, pack, show) shows the same string.

### 2.4 Precedent that matters for where the slug function lives

- **The renderer already imports domain code from `src/`:** `desktop/src/renderer/screens/project.tsx:2`
  — `import { ITEM_TYPES } from "../../../../src/context/domain/values/item-type.js"`. So this would
  not be a first.
- `parseProjectName`'s transitive imports are **pure TypeScript, no Node builtins**:
  `src/shared/domain/result.ts` (types + `ok`/`err` + a `DomainError extends Error`) and
  `src/context/domain/errors.ts` (a string union + one constructor). Bundle-safe in the renderer;
  `no-network-surface.test.ts` is unaffected (no URLs, no assets).
- Pure renderer logic lives in `desktop/src/renderer/state/*.ts` with a sibling `*.test.ts`
  (`import-selection.ts`, `create-vault-validation.ts`, `next-paint.ts`, `unlock-outcome.ts`, …).
  CLAUDE.md's "no bare files" rule means a new slug function gets its **own module in `state/`**,
  not an inline helper in `import.tsx`.
- A jsdom DOM test for this screen already exists:
  `desktop/src/renderer/screens/__dom-tests__/import.dom.test.tsx`, with a fake `ValijaBridge` and a
  documented timing rule (never assert synchronously after a click, because of `waitForNextPaint`).
- `catalogs.test.ts` enforces **deep key-set parity both directions** and **placeholder parity**
  between `en` and `es`. Any new key must be added to both; any `{placeholder}` must match.

### 2.5 Collisions today

`existingProjects` is already loaded into the screen (line 56-71). Two different typed names can
slugify to the same slug (`"Mi Proyecto"`, `"mi--proyecto"`, `"MI PROYECTO"` → `mi-proyecto`), and a
typed name can collide with a project already in the dropdown. Backend behaviour in that case is
already defined and safe: the project is found by name and reused, and re-importing the same
selection upserts on deterministic ids — **never a duplicate project, never a duplicate item**
(IMPORT-FEEDBACK refined.md §3). The only risk is *surprise*, not data loss. See **D-5**.

---

## 3. User walkthrough (observable behaviour)

Ana is on the Import screen with 640 conversations listed. She wants them in a project she thinks of
as *"Openai 1"*.

| # | She does | Today | After this advance |
|---|---|---|---|
| 1 | Opens the **Importar en** dropdown, picks **Nuevo proyecto…** | a bare, unlabelled text box appears | the box appears **with a label** and a placeholder showing a valid example (D-7) |
| 2 | Types `Openai 1` | nothing; the box looks fine; Preview and Import are enabled | the box still shows exactly `Openai 1` (her cursor is never moved), and a line beneath it reads **"Se guardará como: `openai-1`"** / **"Will be saved as: `openai-1`"** (D-1) |
| 3 | Clicks **Vista previa** | Preview fails: *"Ese nombre de proyecto no es válido."* (since IMPORT-FEEDBACK; before it, Preview lied and Import failed) | Preview runs against `openai-1` and summarises **"Se importarían 111 elementos … en 'openai-1'"** — the same name the preview line promised |
| 4 | Clicks **Importar** | — | imports into `openai-1`; the summary says `openai-1` |
| 5 | Types `Café Ñandú ☕` instead | rejected with no explanation | preview line reads **"Se guardará como: `cafe-nandu`"** (accents folded, emoji dropped) |
| 6 | Types only `☕☕` | rejected with no explanation | no valid slug exists: the line reads **"Escribe al menos una letra o un número."**, and **Preview/Import are disabled** — she cannot start a doomed run (D-4) |
| 7 | Types `Mi Proyecto` while a project `mi-proyecto` already exists | silently imports into the existing project | the line reads **"Se guardará como: `mi-proyecto` (proyecto existente — se añadirá ahí)"** (D-5) |
| 8 | Somehow reaches `INVALID_PROJECT_NAME` anyway (e.g. a pack/search screen, or a future path) | *"Ese nombre de proyecto no es válido."* | *"Los nombres de proyecto solo pueden llevar minúsculas, números y guiones, sin espacios. Por ejemplo: `openai-1`."* (D-6) |

```
Import screen, project picker after this advance:

  Importar en: [ Nuevo proyecto… ▾ ]
  Nombre del proyecto  [ Openai 1                    ]
  Se guardará como: openai-1                       ← live, never rewrites the box
  ── status region (aria-live) ───────────────────
  [ Vista previa ]  [ Importar ]
```

### How the resulting name is used afterwards

| Surface | What it shows / accepts | Changed? |
|---|---|---|
| Import result summary, project list, project screen | `openai-1` — the slug, never "Openai 1" | no (the slug is all there ever was) |
| The **Importar en** dropdown on the next import | `openai-1` | no |
| CLI `valija import -p <project>` | still requires a valid slug; typing `-p "Openai 1"` still fails with `INVALID_PROJECT_NAME` | **no — deliberate**, see D-8 |
| MCP tool arguments, context-pack markdown headers | `openai-1` | no |
| SQLite `projects.name` unique key, item ids, lineage | `openai-1`; identical to typing `openai-1` by hand | no |
| Imported items in context packs | still excluded (`docs/SPEC.md` §10a) | no |

The user-visible consequence Oscar already accepted: **"Openai 1" is gone the moment she leaves the
field.** Everywhere afterwards she sees `openai-1`. That is what the preview line in step 2 exists
to make honest, and it is why the line must appear *before* she clicks, not after.

---

## 4. Scope

### In scope
- `desktop/src/renderer/screens/import.tsx` — the new-project input gains a label, a live "will be
  saved as" line, and submits the **slug** rather than the raw text; `canSubmit` keyed off the slug.
- One new pure renderer module (slugify) + its unit test, under `desktop/src/renderer/state/`.
- `desktop/src/shared/i18n/catalogs/{en,es}.ts` — new `import.*` keys for the label/placeholder/
  preview/empty/existing lines, **and** the `INVALID_PROJECT_NAME` rewrite (D-6).
- `desktop/src/renderer/styles/screens.css` — minimal rules for the new hint line, in the existing
  `.import …` block (400-443).
- `desktop/src/renderer/screens/__dom-tests__/import.dom.test.tsx` — new cases.
- `docs/gui.md` §"Importing your chat history" (line 173) — one paragraph.

### Explicitly deferred
| Deferred | Why |
|---|---|
| A separate `displayName` on `Project` (pretty name + slug) | Oscar rejected it: new domain field, DB migration, "which one does `-p` address?", collision rules. If he ever changes his mind it is its own advance and this one does not block it |
| Changing `parseProjectName`'s regex, or adding a slugifier to the **domain** shared with CLI/MCP | The rule is correct; making the CLI silently rewrite an argument changes addressing semantics (D-8) |
| Renaming an existing project, or migrating existing project names | Nothing existing changes; this only affects names created from this field |
| Applying the same treatment to any other project-name entry point (none exists in the GUI today) | Only the Import screen has a free-text project field |
| Uniqueness/suffixing (`openai-1-2` when `openai-1` exists) | Collision = reuse, which is the correct, already-safe behaviour (§2.5); auto-suffixing would create surprise projects |
| Any change under `src/**`, `desktop/src/shared/ipc/**`, the preload, or `package.json` | This advance is renderer + catalogs + docs only |

---

## 5. Open decisions (defaults chosen; Gate R confirms or overrides)

### D-1 — Where the transform is visible: preview line vs. rewriting the field
- **Option A (default)** — **the input keeps the user's raw text; a separate line beneath it shows
  the slug live** (*"Se guardará como: `openai-1`"*). The slug is computed on every render and used
  at submit time. No cursor math, no fighting the IME, no surprise while typing; the user sees both
  what they wrote and what will be stored. Cost: the raw text is discarded at submit, so the field
  briefly shows something that will not exist — mitigated by the line saying exactly that.
- **Option B** — rewrite the input's own value on every keystroke. One truth on screen, but the
  caret jumps whenever a character collapses (typing a space mid-word moves the caret), and dead
  keys / IME composition for accented input are actively hostile to it. Known-janky pattern.
- **Option C** — rewrite the input on **blur**. No caret fight while typing; but the value silently
  changes the moment focus leaves, which reads as the app "correcting" you, and a user who never
  blurs before clicking Import (clicking a button *does* blur, but the order is subtle) gets a
  surprise. Also harder to test deterministically.
- **Option D** — transform only at submit, with **no** preview. Smallest diff; but the user learns
  the name changed only from the result summary, i.e. after the write. Fails step 2 of §3.
- **Default: A.** Oscar reacted positively to a live *"se guardará como: X"* line. It is the only
  option where the user knows the outcome **before** committing, and it is trivially testable in
  jsdom.
- **Sub-decision:** show the line always, or only when the slug differs from the typed text?
  **Default: only when it differs** (or when the field is invalid/empty-slug) — for someone who
  already types `openai-1` the line is noise.

### D-2 — The slugify algorithm
Proposed, in order:
1. Unicode-normalize (NFD) and drop combining marks — `é→e`, `ñ→n`, `ü→u`.
2. Lowercase.
3. Replace every run of characters outside `[a-z0-9]` (spaces, `_`, `.`, `/`, punctuation, emoji,
   any non-Latin script) with a single `-`.
4. Collapse repeated `-`, strip leading/trailing `-`.
5. Truncate to 64 characters, then strip a trailing `-` again.
6. If the result is empty → **no slug**; the field is invalid (D-4).

- **Trade-off to state plainly:** step 1 + step 3 mean **non-Latin scripts vanish entirely** —
  `"проект"`, `"プロジェクト"` → empty → D-4's "type at least one letter or number". Transliterating
  them properly needs a library (new dependency, bundle weight, and a local-first app that ships no
  network surface should not grow one for this). **Accepted:** Latin-ish input is folded, everything
  else fails loudly with a clear message rather than silently producing garbage.
- **Alternative for step 5** — do not truncate; let a >64-char name be invalid with its own message.
  Rejected as default: truncation is predictable and the preview line shows the truncated result, so
  it is not a hidden transform.
- **Alternative for step 1** — a hand-written accent map instead of NFD. Rejected: `String.prototype
  .normalize("NFD")` is standard, in Node 22 and every Electron renderer, and needs no table.
- **Default: the six steps above.** Every one of them must be covered by a table-driven unit test
  (`"Openai 1"→openai-1`, `"Café Ñandú ☕"→cafe-nandu`, `"  --Hola--  "→hola`, `"☕"→""`,
  `"a".repeat(80)→64 chars`, `"9lives"→9lives`, `"-x"→x`).

### D-3 — Where the slug function lives, and how it can never drift from `parseProjectName`
- **Option A** — a new pure module `desktop/src/renderer/state/project-slug.ts` + sibling test,
  **importing `parseProjectName`** from `src/context/domain/values/project-name.js` to *verify* its
  own output: slugify, then `parseProjectName(slug)`; if that fails, treat as "no valid slug". The
  domain rule stays the single source of truth; the slugifier is only a *best-effort producer*,
  never a second authority. Precedent exists (`project.tsx:2` imports `ITEM_TYPES` from
  `src/context/domain/values/item-type.js`), and the import chain is pure TS (§2.4).
- **Option B** — the same module, but with its own private copy of the regex and no import from
  `src/`. Keeps the renderer hermetic; but two copies of one rule, and they *will* drift — the exact
  class of bug IMPORT-FEEDBACK's V8 was.
- **Option C** — put the slugifier in the domain (`src/context/domain/values/`) next to
  `parseProjectName`, shared by the renderer, the CLI and MCP. Cleanest DDD story; but it pulls the
  CLI/MCP into the decision (D-8) and turns a GUI ergonomics fix into a domain change. Worth
  revisiting only if a second caller ever appears.
- **Default: A.** Best-effort producer in the renderer's `state/` layer, validated by the real
  domain parser, so the two cannot disagree. The unit test asserts **every** non-empty slug the
  function emits satisfies `parseProjectName`.

### D-4 — What happens when no valid slug can be produced
- **Option A (default)** — the hint line becomes an explanatory message (*"Escribe al menos una
  letra o un número."*) and **Preview/Import are disabled**, exactly as they already are for an empty
  field (`canSubmit`, line 194). The user cannot start a run that is guaranteed to fail.
- **Option B** — leave the buttons enabled and let the backend return `INVALID_PROJECT_NAME`. One
  fewer state, but it spends a round trip (and, for Import, a user's nerve) to say what the renderer
  already knows.
- **Default: A.** Note this makes `canSubmit` depend on the **slug**, not the raw text — the planner
  must change that line, not just add a line of copy.

### D-5 — A slug that collides with an existing project
- **Option A (default)** — no special handling of the *write* (the backend already reuses the
  project and upserts items — §2.5), but the hint line **says so**: *"Se guardará como: `mi-proyecto`
  (proyecto existente — se añadirá ahí)"*. `existingProjects` is already in state, so this is one
  comparison and one extra copy key.
- **Option B** — no hint at all. Smallest diff; but "New project…" quietly adding to an existing
  project is precisely the kind of surprise this advance exists to remove.
- **Option C** — auto-suffix to keep it unique (`mi-proyecto-2`). Rejected: creates projects the user
  never asked for and breaks "import twice, land in the same place".
- **Default: A.**

### D-6 — The `INVALID_PROJECT_NAME` copy (IMPORT-FEEDBACK D-14's unresolved "Copy note")
Constraint from §2.3: one string serves **every** call site, and it cannot interpolate the offending
name (the renderer only has the code).
- **Option A** — state the rule only: *"Los nombres de proyecto solo pueden llevar minúsculas,
  números y guiones, sin espacios."*
- **Option B (default)** — rule **plus a concrete example**:
  - `en`: `"Project names can only use lowercase letters, numbers and hyphens — no spaces. For example: openai-1."`
  - `es`: `"Los nombres de proyecto solo pueden llevar minúsculas, números y guiones, sin espacios. Por ejemplo: openai-1."`
- **Option C** — leave the copy generic and rely on the renderer's new hint. Rejected: the code is
  still reachable from other screens and from any future path, and D-14 flagged this string by name.
- **Default: B.** No `{placeholders}`, so `catalogs.test.ts` placeholder parity is trivially
  satisfied; exact wording is Oscar's to tune at implementation. (Max length 64 is deliberately left
  out of the string — it is not the reported failure and adding it makes the sentence unreadable.)

### D-7 — Naming and placement of the new copy keys
- **Default:** new keys under the existing `import.*` namespace, beside `projectLabel` /
  `projectNewOption` (`en.ts:176-177`, `es.ts:179-180`): a field label, a placeholder, the
  "will be saved as" line, the "no valid slug" line, and the "existing project" variant. Alternative
  (a shared `common.*`/`projectName.*` namespace) is deferred until a second screen needs them.
- **Sub-decision:** is the "existing project" note a separate key or a suffix appended to the
  preview line? **Default: separate key**, so each language can phrase the whole sentence naturally
  rather than gluing fragments.

### D-8 — Should the CLI (and MCP) slugify too?
- **Option A (default)** — **no.** `-p` and MCP arguments stay strict. A CLI flag is an *address*:
  silently rewriting it means a script that writes `-p "My Proj"` lands in `my-proj` without saying
  so, and two different scripts can collide invisibly. The GUI is the place where a human types
  prose; the CLI is the place where a machine names a thing.
- **Option B** — slugify there too, for consistency. Consistent, but it is a behaviour change to a
  scriptable interface and it forces D-3 Option C.
- **Default: A**, and the asymmetry is stated in `docs/gui.md` so it is intentional, not an
  oversight.

### D-9 — Accessibility / labelling of the field
- **Default: yes, in scope.** The input today has no label, no `aria-label`, no placeholder and no
  id (§2.2) — it is unreachable by name for assistive tech *and* for `getByLabelText` in the DOM
  test. Give it a label, an id, and `aria-describedby` pointing at the hint line so the slug preview
  and the "no valid slug" message are announced with the field. Alternative (leave it bare) makes
  the new behaviour literally untestable through the accessible tree.

### D-10 — How it is proven by test
- **Default:** (a) a table-driven unit test for the slug module (D-2's table, plus the
  "every emitted slug passes `parseProjectName`" property); (b) DOM cases added to the existing
  `import.dom.test.tsx` — typing `Openai 1` shows the preview line and, on Import, calls
  `bridge.import.run` with `projectName: "openai-1"` (assert the **argument**, which is the only
  proof the transform reaches the backend); typing `☕☕` disables both buttons; the existing-project
  note appears for a colliding slug. Both must fail against today's code.

### D-11 — Docs
- **Default:** one paragraph in `docs/gui.md` §"Importing your chat history" (line 173) explaining
  that project names are stored as slugs, that the field converts what you type, that the converted
  name is what you will see afterwards everywhere, and that the CLI is strict (D-8).

---

## 6. Acceptance criteria (reviewer checklist)

Each traces to a step in §3.

**The field (steps 1, 2, 5)**
- [ ] With **Nuevo proyecto…** selected, the input has a visible label and an accessible name, and a
      placeholder showing a valid example (D-9, D-7).
- [ ] Typing `Openai 1` leaves the input's own value as `Openai 1` (the caret is never moved) and
      shows a line reading that it will be saved as `openai-1` (D-1 Option A).
- [ ] The line is absent when the typed text is already a valid slug (D-1 sub-decision).
- [ ] `Café Ñandú ☕` previews as `cafe-nandu`; `"  --Hola--  "` as `hola`; an 80-character name is
      truncated to 64 with no trailing hyphen (D-2).

**Submitting (steps 3, 4)**
- [ ] Clicking **Vista previa** or **Importar** sends the **slug** as `projectName` over IPC — proven
      by asserting the argument passed to a fake bridge, not by reading the summary (D-10).
- [ ] Preview and Import agree, as IMPORT-FEEDBACK guaranteed: the same typed text either works for
      both or fails for both.
- [ ] The result summary shows the slug, and it matches what the preview line promised.

**Invalid and colliding (steps 6, 7)**
- [ ] Text with no Latin letters or digits (e.g. `☕☕`) produces no slug: an explanatory message is
      shown and **both action buttons are disabled** (D-4).
- [ ] A slug equal to an existing project's name is announced as such before submitting (D-5), and
      the import still lands in that existing project with no duplicate project and no duplicate
      items.

**Copy (step 8)**
- [ ] `INVALID_PROJECT_NAME` in **both** catalogs names the rule and gives an example (D-6).
- [ ] `catalogs.test.ts` passes: key-set parity both directions, placeholder parity, no orphan keys.
- [ ] Every new string exists in `en` and `es`; nothing user-visible is hard-coded in `import.tsx`.

**Cross-cutting**
- [ ] A unit test exists for the slug module covering D-2's table and asserting every non-empty
      output satisfies `parseProjectName` (D-3, D-10).
- [ ] New DOM cases fail against today's `import.tsx` and pass after (D-10).
- [ ] The diff touches **no** file under `src/**`, none under `desktop/src/shared/ipc/**`, no
      preload, no `package.json`, no migration.
- [ ] `parseProjectName` and its regex are byte-for-byte unchanged.
- [ ] `docs/gui.md` explains the conversion and the CLI's deliberate strictness (D-11).
- [ ] `npm run typecheck && npm run lint && npm run test` green in the repo root **and** in
      `desktop/`.

---

## 7. Security-sensitive surfaces — what must not weaken

This is a presentation change; the review should confirm that literally.

- **The domain guard is unchanged and still the last word.** `parseProjectName` remains the only
  authority; the renderer's slugifier is a convenience in front of it, never a replacement. Nothing
  may bypass `ImportItems`' own re-check.
- **No loosening of what reaches SQLite.** The slug is still `[a-z0-9-]{1,64}` when it arrives at
  the repository — the property test in D-10 is what proves it. No quoting/escaping assumption
  anywhere downstream (project names appear in markdown pack headers and in MCP arguments) may be
  weakened; the character set that reaches those surfaces must not grow.
- **No new IPC channel, no zod schema change, no preload API change.** `projectName` stays
  `z.string()` on an existing channel (`schemas.ts:61,70`); the renderer simply sends a better
  string.
- **No vault session, key material, or keychain access** enters the renderer. The screen still shows
  only counts, project names and error **codes** (`errorCopy`), never `DomainError.message` and never
  a raw driver string.
- **No new dependency.** D-2 is deliberately library-free; adding a transliteration package would
  grow the renderer bundle and the supply-chain surface of a local-first app for cosmetics.
  `no-network-surface.test.ts` globs the renderer tree — nothing added may reference a URL or a
  remote asset.
- **No filesystem path in the renderer**, unchanged: the import file is still addressed by the opaque
  main-process `handle`.
- **MCP surface unchanged**: 5 tools + 2 prompts, no new tool, no new argument.
- **Imported items stay excluded from context packs** (`docs/SPEC.md` §10a).

---

## 8. Architecture notes (clean architecture / DDD / hexagonal)

- The change lives in the **renderer presentation layer** plus one **pure renderer module**. The
  domain is read from, never modified: the slugifier *depends on* `parseProjectName`, not the other
  way round — dependencies still point inward.
- The slugifier is a **producer**, the domain parser is the **validator**. Keeping those roles apart
  is what stops a second, drifting copy of the rule appearing (D-3 Option B's failure mode).
- **No bare files** (CLAUDE.md): the new module is `desktop/src/renderer/state/<name>.ts` with a
  sibling `<name>.test.ts`, beside `import-selection.ts` / `create-vault-validation.ts`. No helper
  is inlined into `import.tsx`, and nothing is dropped loose at a layer root.
- `ImportScreen` keeps its `{ bridge }`-only interface. No new prop, no router change, no new
  component — the hint is markup in the existing screen. If it ever needs to be reused by a second
  screen, *then* it becomes a `renderer/components/` element.
- If D-3 Option C is ever taken instead, the slugifier becomes a domain service in
  `src/context/domain/services/` (a `services/` folder already exists in that module's layout) and
  D-8 must be re-answered in the same breath.

---

## 9. Affected areas (for the planner, not a plan)

`desktop/src/renderer/screens/import.tsx` (lines 58, 149-152, 194, 284-289) ·
a new `desktop/src/renderer/state/<slug-module>.ts` + `<slug-module>.test.ts` ·
`desktop/src/shared/i18n/catalogs/en.ts` (`import.*` around 176-177; `errors.INVALID_PROJECT_NAME`
line 338) and `es.ts` (179-180; line 342) ·
`desktop/src/renderer/styles/screens.css` (inside the existing `.import …` block, 400-443) ·
`desktop/src/renderer/screens/__dom-tests__/import.dom.test.tsx` · `docs/gui.md` §"Importing your
chat history" (line 173). **No `src/**` file is touched** — `project-name.ts` is imported, not
modified.

---

## 10. Biggest risk

**A silent, irreversible rename.** The moment Ana clicks Import, the name she typed ceases to exist
— `"Openai 1"` becomes `openai-1` in the database, in every later dropdown, in the CLI, in MCP
arguments and in her context-pack headers, with no record of what she meant and no way to rename it
(renaming is deferred, §4). If the preview line is missed, mistimed, or too quiet, the app will have
*silently decided what her project is called*, which is a worse failure than today's honest
rejection. That is why D-1's default is a visible, pre-commit line rather than a submit-time
transform, why D-4 refuses to submit when no slug exists, and why D-5 warns before merging into an
existing project. The secondary risk is **rule drift**: if the slugifier ever emits something
`parseProjectName` rejects, the user gets a preview line promising a name the backend then refuses —
the exact shape of the bug IMPORT-FEEDBACK just closed. D-3's "validate your own output with the
real parser" default and D-10's property test are the only things standing between this advance and
that regression.
