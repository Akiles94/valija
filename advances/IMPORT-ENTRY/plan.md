Approved: Oscar 2026-09-04 — branch: `feat/desktop-GUI` (P-D1 overridden, see below; no new
branch this advance). P-D2..P-D5 approved at their recommended defaults.

# IMPORT-ENTRY — Import is reachable from a non-empty dashboard · Implementation Plan

**Spec:** `advances/IMPORT-ENTRY/refined.md` (Gate R **closed** — Oscar, 2026-09-04; all seven
decisions confirmed at their defaults, including **D-4 Option A**, the source-scan test, *not* the
jsdom alternative). Nothing in D-1…D-7 is reopened here.

**Type:** Hotfix. Renderer presentation layer only. No `src/`, no `desktop/src/main/**`, no
`desktop/src/shared/ipc/**`, no `package.json`, no i18n catalog change, no new dependency.

**Branch:** `feat/desktop-GUI` — **P-D1 overridden at Gate P.** The plan's recommendation
(`fix/dashboard-import-IMPORT-ENTRY`, a new branch per the house `{type}/{slug}-{ADVANCE}`
pattern) is not taken: this session's execution environment is scoped to develop and push only on
`feat/desktop-GUI`, and Oscar chose to respect that constraint rather than authorize an exception.
The hotfix lands as a commit on `feat/desktop-GUI` instead of its own branch.

**Compressed advance.** Oscar asked for minimum ceremony given the size of the fix. This plan is
therefore short, but complete: one slice, five steps, an explicit test-to-criteria map, and the
after-execution tree Gate P requires.

---

## 1. Summary

`DashboardScreen` calls `onImportHistory` from exactly one place — line 94, inside the
`projects.length === 0` branch — so the moment a vault has any content, the GUI has no route to
`ImportScreen` at all (`refined.md` §2.1). The fix moves the Import action **into the shared
`header` element** (`dashboard.tsx:58–65`), which all four return branches already interpolate, and
leaves the empty state's own pair untouched.

Four files change, and only four:

| File | Change | Kind |
|---|---|---|
| `desktop/src/renderer/screens/dashboard.tsx` | Header gains an Import button wired to the **existing** `onImportHistory` prop; both header buttons move inside a `.header-actions` wrapper | modified |
| `desktop/src/renderer/styles/screens.css` | One rule, `.dashboard-header .header-actions` (D-5) | modified |
| `desktop/src/renderer/screens/import-entry-points.test.ts` | Source-scan test proving the wiring, sliced to the `header` block so it fails against pre-fix code (D-4) | **new** |
| `docs/gui.md` | One clause in §"Importing your chat history" naming the entry point (D-7) | modified |

**No new prop, no new i18n key, no new component, no new module.** `onImportHistory` already exists
on the component's interface and is already wired at `app.tsx:323`; the label key
`dashboard.importHistory` already exists in both catalogs. If the implementer finds itself editing
the component's props, a catalog, `app.tsx`, or anything under `src/`, the fix has drifted from
D-1 Option 1 and it should stop.

**Estimated production lines: ~11** (≈7 in `dashboard.tsx`, 4 in `screens.css`), plus ~50 test lines
and one rewrapped documentation sentence. See §8.

---

## 2. Ordered steps — one slice

### Slice 1 — the header entry point (the whole advance)

All five steps land in a single commit; the test and the doc sentence ship with the code, per
CLAUDE.md. Steps are ordered so the test is written **before** the source change is finished being
verified (step 3 runs red first — that is the point of D-4's header-slice assertion).

---

**Step 1 — `dashboard.tsx`: group the header's actions and add Import.**
Replace the `header` constant at lines 58–65 with the version below. This is the only JSX edit in
the advance. Import first, **Check my setup** stays rightmost (D-6).

```tsx
  // Rendered in every branch (§9's item 89a) — the empty first-run dashboard
  // is exactly when a user needs this most. Import lives here too, not only in
  // the empty branch, or a vault with any content has no route to it at all
  // (IMPORT-ENTRY, D-1).
  const header = (
    <div className="dashboard-header">
      <h1>{t("dashboard.title")}</h1>
      <div className="header-actions">
        <button type="button" onClick={onImportHistory}>
          {t("dashboard.importHistory")}
        </button>
        <button type="button" onClick={onCheckSetup}>
          {t("dashboard.checkMySetup")}
        </button>
      </div>
    </div>
  );
```

*Do not touch* lines 67–129. In particular the empty branch's `.actions` block (lines 90–97) stays
exactly as it is — D-2 Option A is additive-only, and the `{header}` interpolation count must stay
at **4** (`diagnostics-entry-points.test.ts:27–34`).
*Do not touch* the component's props, the `useEffect`, or the `bridge.content.projects()` call.

**Step 2 — `screens.css`: one grouping rule (D-5).**
Insert immediately after the existing `.dashboard-header h1 { margin: 0; }` rule (lines 10–12), so
the file's "one section per screen" order is preserved and the `/* dashboard.tsx */` section stays
contiguous. `.dashboard-header` itself (lines 4–9, `justify-content: space-between`) is **not**
edited — the wrapper is what keeps the two buttons together at the right instead of spread.

```css
.dashboard-header .header-actions {
  display: flex;
  gap: 8px;
}
```

**Step 3 — the new test, `desktop/src/renderer/screens/import-entry-points.test.ts`.**
Written in the idiom of `diagnostics-entry-points.test.ts` (same imports, same docblock-explains-why
shape, node environment — `desktop/vitest.config.ts:7–8` already includes `src/**/*.test.ts`, so no
pragma and no config change). The load-bearing detail: it slices the **`header` block** rather than
scanning the whole file, because a bare `toContain("onImportHistory")` over `dashboard.tsx` was
already satisfied by the pre-fix code and would prove nothing.

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DASHBOARD = readFileSync(join(import.meta.dirname, "dashboard.tsx"), "utf8");
const APP = readFileSync(join(import.meta.dirname, "..", "app.tsx"), "utf8");

/**
 * IMPORT-ENTRY (`advances/IMPORT-ENTRY/refined.md` §1): the Import action used to
 * live only in the dashboard's `projects.length === 0` branch, so a vault with any
 * content had no route to `ImportScreen` from the GUI at all. D-1 moved it into the
 * shared `header`, which all four return branches interpolate.
 *
 * This scans the *header block*, not the whole file: `dashboard.tsx` mentioned
 * `onImportHistory` before the fix too, so a bare `toContain` would have passed
 * against the bug. D-4 chose this source-scan form over a jsdom render to stay
 * inside GUI P-D5 (DOM tests confined to `recovery-kit.tsx` and
 * `relocate-vault.tsx`) and P-D11. Named trade-off: it proves the wiring, not the
 * rendering.
 */
function headerBlock(source: string): string {
  const start = source.indexOf("const header = (");
  const end = source.indexOf("\n  );", start);
  if (start < 0 || end < start) {
    throw new Error("dashboard.tsx no longer declares a `const header = (…)` block");
  }
  return source.slice(start, end);
}

const HEADER = headerBlock(DASHBOARD);

describe("Import is reachable from every dashboard branch", () => {
  it("puts the Import action in the shared header, not in the empty branch", () => {
    expect(HEADER).toContain("onImportHistory");
    expect(HEADER).toContain("dashboard.importHistory");
  });

  it("keeps Check my setup in the header, after Import (D-6)", () => {
    expect(HEADER).toContain("onCheckSetup");
    expect(HEADER.indexOf("onImportHistory")).toBeLessThan(HEADER.indexOf("onCheckSetup"));
  });

  it("still renders the header in all four return branches (item 89a)", () => {
    const headerUses = DASHBOARD.match(/\{header\}/g) ?? [];
    expect(headerUses).toHaveLength(4);
  });

  it("navigates through a caller-supplied callback, never by itself", () => {
    expect(DASHBOARD).not.toContain("setView");
    expect(DASHBOARD).not.toContain("workspace-nav");
  });

  it("app.tsx still mounts exactly one ImportScreen", () => {
    const mounts = APP.match(/<ImportScreen/g) ?? [];
    expect(mounts).toHaveLength(1);
    expect(APP).toContain("onImportHistory=");
  });
});
```

Two deliberate properties of `headerBlock`: it **throws with a readable message** rather than
silently slicing garbage if the declaration is ever renamed or reformatted (a `-1` from `indexOf`
would otherwise produce a passing-but-meaningless assertion), and it depends only on formatting
Biome itself produces (`\n  );` closes a two-space-indented parenthesised JSX constant).

**Verify it runs red first:** with step 1 reverted (or on a scratch copy of the pre-fix file), the
first two `it`s must fail. That is the check that this test would have caught the bug. Do not skip
it — it is the single thing that distinguishes D-4 Option A from a test that proves nothing.

**Step 4 — `docs/gui.md`, §"Importing your chat history" (lines 165–172).**
One clause added to the section's opening sentence, in the same voice §"Diagnostics" already uses at
line 178 ("Reachable from the dashboard's own **Check my setup** button, or from …"). Nothing else
on the page moves; the paragraph rewraps at the file's existing width.

> Reachable from the dashboard header, beside **Check my setup**, whether your vault is empty or
> already holds projects: **Import your chat history** reads an export file you've already
> downloaded from ChatGPT or Claude — the app explains up front that it never contacts either
> service itself. Pick the file, preview what would be imported (nothing is written yet), then
> import. […rest of the paragraph unchanged…]

**Step 5 — gates.**

```
cd desktop && npm run typecheck && npm run lint && npm run test
cd ..      && npm run typecheck && npm run lint && npm run test
git diff --name-only          # must list exactly the four files in §1
```

The root run is not ceremony: root `biome check .` covers `desktop/**` (biome.json includes `**`),
including the new CSS, and the root test/typecheck runs are what prove the advance left `src/`
alone.

**Done when:** the four files above are the entire diff; the new test passes and demonstrably fails
against pre-fix `dashboard.tsx`; `diagnostics-entry-points.test.ts` passes untouched; both gate
commands are green; and the manual bilingual check in §4 has been done in a running window.

---

## 3. Security-sensitive order of operations

This advance opens no window at all — there is no key, no session, no database handle, no file path
in play. The order that matters is therefore a *confinement* order, run in this sequence:

1. **Before editing:** confirm the change needs no new bridge surface. It does not —
   `onImportHistory` is a caller-supplied callback and `app.tsx:323` already supplies it. If a step
   seems to need `bridge.*`, `setView`, `workspace-nav`, or an IPC channel, stop: the design drifted.
2. **During step 1:** the new button carries **no path string, no URL, no `href`, no
   `shell.openExternal`, no telemetry**. The import file handle keeps coming from
   `bridge.dialog.chooseImportFile()`, which the *main* process owns (`refined.md` §7); a renderer
   that constructs a path is the failure mode to avoid, and this diff must not contain one.
3. **During step 1:** no `console.*` is added. The dashboard logs nothing today and must keep
   logging nothing — there is no secret here, and the way to keep it that way is to add no sink.
4. **After step 5's gates:** run `git diff --name-only` and confirm the list is exactly four paths.
   Any hit under `src/`, `desktop/src/main/`, `desktop/src/shared/ipc/`, `desktop/src/preload/`, or
   either `package.json` means scope crept and the extra change must be dropped, not justified.
5. **Reviewer's one-line confirmations** (all should be trivially true): MCP surface unchanged
   (5 tools + 2 prompts, untouched); no zod schema and no preload API touched; zero vault writes and
   zero lineage bumps added — import still runs once, through `ImportConversations` → `ImportItems`,
   from `ImportScreen`; imported items stay excluded from context packs (`SPEC.md` §10a) because
   nothing about packs is edited.

---

## 4. Test plan → acceptance criteria

**Layer:** one — `desktop/` vitest, node environment, source scan. No new DOM test (D-4 Option A;
GUI P-D5 confines jsdom to `recovery-kit.tsx` and `relocate-vault.tsx`, and P-D11 answered exactly
this question — "how do we prove a dashboard entry point's wiring" — with a source scan). The named
cost, carried from `refined.md` §9's highest-severity risk: **a source scan cannot see a rendering
regression.** It sees the wiring that was wrong.

| Criterion (`refined.md` §6) | Proven by |
|---|---|
| Import visible from a dashboard with ≥1 project card, and clicking it lands on `ImportScreen` | `import-entry-points.test.ts` — header-slice assertion (the header renders in the populated branch) + `app.tsx` mounts one `<ImportScreen` and passes `onImportHistory=` · plus the manual walkthrough below |
| Same entry point in the empty, loading and error branches | The `{header}` count of **4** + the action living inside the sliced `header` block, which is what all four branches interpolate |
| Empty state still offers Connect / Import (D-2 A) | Step 1 leaves lines 85–100 untouched; visible in the diff, and `diagnostics-entry-points.test.ts` still passes |
| `dashboard.tsx` still has exactly four `{header}` interpolations | `diagnostics-entry-points.test.ts:27–34`, unmodified, **and** re-asserted in the new file so the fix's own test owns the invariant it could break |
| `app.tsx` mounts exactly one `<ImportScreen`; dashboard navigates by callback | `import-entry-points.test.ts` — the mount count, the `onImportHistory=` prop pass, and `not.toContain("setView")` / `not.toContain("workspace-nav")`. The prop's *existence* is additionally enforced by `tsc`: `app.tsx` passes it, so removing it fails typecheck |
| No new i18n key (D-3 A) | The diff touches neither `en.ts` nor `es.ts`; `catalogs.test.ts` parity keeps passing unchanged |
| A test that **fails against pre-fix `dashboard.tsx`** | Step 3's explicit red-first verification. The header slice is what makes it so — the pre-fix file satisfies `toContain("onImportHistory")` at line 94 but its `header` block does not |
| `npm run typecheck && npm run lint && npm run test` green in root and `desktop/` | Step 5 |
| Diff touches nothing under `src/`, `desktop/src/main/**`, `desktop/src/shared/ipc/**`, no `package.json` | Step 5's `git diff --name-only` check; §3 item 4 |
| Two header buttons render as a group at the right, Check my setup unmoved | D-5's CSS rule + D-6's order assertion in the test, and **the manual check below** — CSS layout is not machine-checked here |
| Both languages render without wrapping or clipping at the default window size | **Manual, required:** `cd desktop && npm run dev`, unlock a vault with ≥1 project, look at the header in `en`, switch to `es` in Settings (the longer label, "Importar tu historial de chats" + "Revisar mi configuración"), look again. Then click Import and confirm `ImportScreen`'s "choose" stage appears, and that the nav bar's **Dashboard** returns |
| `docs/gui.md` states where the entry point lives (D-7 A) | Step 4, checked by reading the section |

---

## 5. Assumptions — each one a place this plan could be wrong

- **A1 — `refined.md` §3's line numbers match HEAD.** Verified on 2026-09-04: `header` at
  `dashboard.tsx:58–65`; branches at 67–74 / 76–83 / 85–100 / 102–129; `onImportHistory` used once,
  at line 94; `app.tsx:323` and `:328`; `diagnostics-entry-points.test.ts:27–34`; `screens.css:4–9`.
  If the implementer finds different content at these anchors, the file moved under the plan — stop
  and re-anchor rather than editing by line number.
- **A2 — §6's "never imports `bridge.js`" is read as §8's "must not *introduce* … `bridge.js`".**
  `dashboard.tsx:3` already has `import type { ValijaBridge } from "../state/bridge.js";` — a
  pre-existing, type-only import that the component needs for its `bridge` prop. Read literally,
  §6's clause is unsatisfiable without deleting a prop §8 forbids touching. The plan therefore
  asserts the property §6 actually means — *the dashboard does not navigate itself* — as
  `not.toContain("setView")` and `not.toContain("workspace-nav")`. **This is the one place the spec
  is loose, and this is the reading the plan takes.** If Oscar means it literally, the criterion
  needs rewording, not code.
- **A3 — no screenshot or fixture depends on the dashboard's markup.** Verified: `docs/images/`
  does not exist in the repo, and the only tests reading `dashboard.tsx` are the two named above.
- **A4 — the wrapper goes *inside* `header`, so the `{header}` count is untouched.** The count
  assertion breaks only if the branches are restructured, which no step here does.
- **A5 — the Spanish header fits at the app's default window width.** Nothing automated covers
  this; §4's manual bilingual check is the only evidence, and it is required, not optional. If it
  clips, the cheapest remedy consistent with D-3 is a `flex-wrap: wrap` on `.header-actions` — one
  line, no copy change — and that should be reported rather than silently added.
- **A6 — the new test needs no vitest config change.** `desktop/vitest.config.ts:7` includes
  `src/**/*.test.ts` and line 8 sets `environment: "node"`, which is what a `readFileSync` scan
  wants; the shared `vitest-setup.ts` is a harmless no-op for it.
- **A7 — Biome formats the proposed snippets as written** (2-space indent, double quotes,
  semicolons, 100-column width; CSS formatted by the same root `biome.json`). If `biome check`
  reformats them, take Biome's output — but note that step 3's slice depends on the closing `\n  );`
  staying two-space indented, which is Biome's own output for this construct.
- **A8 — no catalog change means `catalogs.test.ts` is out of the blast radius.** True as long as
  D-3 Option A holds.

---

## 6. Decisions to confirm (recommended default + trade-offs)

`refined.md`'s D-1…D-7 are **closed** and are not re-litigated here. Below is everything this plan
had to decide on its own. **P-D1 is the only one that materially matters**; P-D2…P-D5 are small and
each has a safe default, listed so nothing is decided silently.

- **P-D1 — Branch name.** *Recommend:* **`fix/dashboard-import-IMPORT-ENTRY`**. The house pattern is
  `{type}/{slug}-{ADVANCE}` (`feat/desktop-GUI`, `feat/sync-M3`, `feat/importers-M2`, and M4's
  planned `docs/vault-format-M4`, where the prefix names the dominant deliverable). The dominant
  deliverable here is a bug fix, and the slug names what is fixed — the dashboard's import entry
  point — rather than echoing the advance id. *Trade-off:* `fix/` is a prefix this repo has not used
  before; every merged branch so far is `feat/`. *Alternatives:* `fix/import-entry-IMPORT-ENTRY`
  (literal echo of the advance id — shorter, but says "import-entry" twice) or
  `feat/dashboard-import-IMPORT-ENTRY` (keeps the repo's only-so-far prefix, at the cost of calling
  a hotfix a feature).

- **P-D2 — A `CHANGELOG.md` entry?** *Recommend:* **no.** `refined.md` §5 names exactly four
  in-scope files, and the `[Unreleased]` section's Desktop entry already advertises "import chat
  history" as part of a feature that has never shipped a release — a fix to unreleased behaviour has
  nothing to tell a user of a released version. *Trade-off:* CLAUDE.md's "docs ship in the same
  commit as the code" is satisfied by `docs/gui.md`, but a reader scanning the changelog will not
  see this repair. *Alternative:* one line under a new `### Fixed` heading, making the diff five
  files; harmless, but it widens a scope the spec drew tightly and the reviewer counts files.

- **P-D3 — Does the test pin button order (D-6)?** *Recommend:* **yes** — the two-line
  `indexOf(...) < indexOf(...)` assertion in step 3. It is the only mechanical guard on the
  acceptance criterion "**Check my setup** has not moved", and it costs nothing. *Trade-off:* it
  couples a test to JSX source order, so a future reordering fails a test rather than a review.
  *Alternative:* drop that `it` and let the diff review carry D-6, keeping the test purely about
  reachability.

- **P-D4 — Does the test pin the `.header-actions` wrapper class?** *Recommend:* **no.** D-4 says
  the test proves "the wiring, not the pixels", and a class-name assertion is the pixel side of that
  line; layout is covered by §4's manual bilingual check. *Trade-off:* if someone later removes the
  wrapper, the header silently spreads and no test complains. *Alternative:* add
  `expect(HEADER).toContain("header-actions")` — one line, and it does catch that specific
  regression.

- **P-D5 — Extend the `header` comment in `dashboard.tsx`?** *Recommend:* **yes**, the two extra
  comment lines shown in step 1, naming *why* Import lives in the header. The comment is the thing
  that stops a future reader from "tidying" the button back into the empty branch and recreating
  this exact bug. *Trade-off:* two lines of comment referencing an advance id. *Alternative:* leave
  the existing comment untouched and rely on the test's docblock.

**Nothing else is open.** There is no ambiguity left about which file changes, what the JSX is, what
the CSS rule is, what the test asserts, or what the doc sentence says — all four are written out
verbatim in §2.

---

## 7. Naming, placement, and ubiquitous language

- **`import-entry-points.test.ts`** — named for what it guards, exactly mirroring the existing
  `diagnostics-entry-points.test.ts`, and placed beside the screens it reads
  (`desktop/src/renderer/screens/`). "Entry point" is already this repo's word for this idea, in
  both that filename and `docs/gui.md` §"Diagnostics". *Rejected alternatives:*
  `dashboard-import.test.ts` (names a file, not a guarantee) and extending
  `diagnostics-entry-points.test.ts` (D-4 Option B — misfiled, the file's name and docblock are
  about Diagnostics).
- **CLAUDE.md's "no bare files at a layer's root" check.** It does not bite here, and the plan
  introduces no new *kind* of object that would need a new subfolder. The rule governs a module's
  `domain/application/infra`; `desktop/src/renderer/` is a presentation tree already partitioned by
  kind (`screens/`, `components/`, `state/`, `styles/`, `testing/`), and the new file is a test for
  a screen, sitting with the screens — the established local convention (three such tests already
  live there). **No file is created under any `domain/`, `application/`, or `infra/` folder** — per
  `refined.md` §8, that would itself be the signal that scope crept.
- **`.header-actions`** — kebab-case like every class in these stylesheets
  (`.dashboard-header`, `.project-cards`, `.empty-title`, `.kit-text`), scoped under
  `.dashboard-header` so it cannot leak, and named for the family it belongs to (`.actions` in
  `base.css` is the "next steps" row; this is the header's row). It is also the exact selector D-5
  settled, so it is not a fresh choice.
- **Ubiquitous language, unchanged:** *dashboard*, *header*, *entry point*, *drill-down*,
  *import your chat history*. The advance introduces **no new domain term** — correctly, since it
  introduces no domain concept: `DashboardScreen` stays a view that receives navigation as callbacks
  and decides nothing.
- **Readability:** every added line reads as one action — "render a button that calls
  `onImportHistory`", "lay the header's actions out in a row", "assert the header block mentions the
  import callback". No new class, no new function beyond the six-line `headerBlock` helper in the
  test, no file grows past its current size by more than ~10 lines.

---

## 8. Estimated line count and risks

### Lines

| File | Production | Test | Docs |
|---|---|---|---|
| `desktop/src/renderer/screens/dashboard.tsx` | +7 net (wrapper `<div>` open/close, the 3-line button, 2 comment lines; the Check-my-setup button is re-indented, not rewritten) | — | — |
| `desktop/src/renderer/styles/screens.css` | +4 | — | — |
| `desktop/src/renderer/screens/import-entry-points.test.ts` | — | ~50 (≈20 of them docblock and helper) | — |
| `docs/gui.md` | — | — | ~2 rewrapped lines, one new clause |
| **Total** | **≈11 production lines** | **≈50** | **≈2** |

### Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **The source-scan test cannot see a rendering regression** — the same class of bug could recur and pass CI (`refined.md` §9's top risk, accepted at Gate R) | **Highest** | Header-slice assertion (fails against pre-fix code) + the `{header}` count of 4 + step 3's mandatory red-first verification. The residual gap is real and named: only §4's manual walkthrough looks at a rendered populated dashboard |
| The header slice silently matches nothing after a future reformat, and the test passes vacuously | Medium | `headerBlock` **throws** on `start < 0 || end < start` with a message naming the cause, instead of slicing from `-1` |
| Spanish labels clip or wrap the header at the default window width | Medium | D-5's grouping rule; §4's required bilingual manual check; A5 names the one-line remedy and says to report it rather than smuggle it in |
| Scope creep — a nav-bar entry, an `onBack` for `ImportScreen`, an empty-state cleanup | Medium | `refined.md` §5's deferral table; §3 item 4's `git diff --name-only` gate; the four-file count is itself an acceptance criterion |
| An over-eager refactor breaks the existing `{header}` count of 4 | Low | Asserted twice now — in the untouched diagnostics test and in the new one |
| Duplicate Import label on the empty dashboard (D-2 A) | Low | Cosmetic, empty state only, reversible by deleting lines 94–96 |

---

## 9. Repo structure after execution

Exactly four paths change. Everything else in the tree is shown only as an unchanged anchor.

```
valija/
├── advances/IMPORT-ENTRY/
│   ├── refined.md                                (unchanged — Gate R closed 2026-09-04)
│   ├── plan.md                                   (this file; gains Oscar's `Approved:` line at Gate P)
│   └── review.md                                 (written later by change-reviewer)
│
├── docs/
│   ├── gui.md                                    (CHANGED, step 4: §"Importing your chat history"
│   │                                              opening sentence gains one clause naming the
│   │                                              dashboard-header entry point — D-7 Option A)
│   ├── SPEC.md · sync.md · vault-format.md       (unchanged)
│   └── (no docs/images/ — no screenshot to restage)
│
├── src/                                          (UNCHANGED — not one file; no use case, port,
│                                                  policy, schema, IPC channel or CLI command)
│
├── desktop/
│   ├── package.json · vitest.config.ts ·
│   │   electron.vite.config.ts · tsconfig*.json  (UNCHANGED — no dependency, no script, no config)
│   └── src/
│       ├── main/** · preload/** · shared/ipc/**  (UNCHANGED — no trust-boundary change)
│       └── renderer/
│           ├── app.tsx                           (UNCHANGED — line 323 already passes
│           │                                       onImportHistory; line 328 already mounts the
│           │                                       single <ImportScreen>. Read by the new test)
│           ├── components/nav-bar.tsx            (UNCHANGED — import stays a drill-down, not a
│           │                                       fifth destination)
│           ├── screens/
│           │   ├── dashboard.tsx                 (CHANGED, step 1: the shared `header` (58–65)
│           │   │                                   wraps its buttons in `.header-actions` and gains
│           │   │                                   an Import button wired to the existing
│           │   │                                   onImportHistory prop, before Check my setup
│           │   │                                   (D-1, D-6); comment extended (P-D5). The four
│           │   │                                   return branches, the props and the empty state's
│           │   │                                   own Connect/Import pair are untouched (D-2))
│           │   ├── import.tsx                    (UNCHANGED — not one line of the import flow)
│           │   ├── import-entry-points.test.ts   (NEW, step 3: source scan — the Import action is
│           │   │                                   inside the sliced `header` block, Check my setup
│           │   │                                   follows it, `{header}` still appears 4×, the
│           │   │                                   dashboard never self-navigates, and app.tsx
│           │   │                                   mounts exactly one <ImportScreen)
│           │   ├── diagnostics-entry-points.test.ts   (UNCHANGED — its 4×`{header}` assertion must
│           │   │                                       keep passing untouched)
│           │   ├── onboarding-settings.no-session.test.ts ·
│           │   │   diagnostics.no-auto-run.test.ts     (unchanged)
│           │   └── (all other screens)           (unchanged)
│           ├── state/** · i18n catalogs (en.ts, es.ts)  (UNCHANGED — no new key, D-3 Option A)
│           └── styles/
│               ├── screens.css                   (CHANGED, step 2: `.dashboard-header
│               │                                   .header-actions { display:flex; gap:8px; }` added
│               │                                   to the `/* dashboard.tsx */` section;
│               │                                   `.dashboard-header` itself untouched — D-5)
│               └── base.css                      (UNCHANGED — `.actions` stays the "next steps" row)
│
├── CHANGELOG.md                                  (UNCHANGED by default — see P-D2)
└── package.json · biome.json · CLAUDE.md         (UNCHANGED)
```

**File count check for the reviewer:** `git diff --name-only` must print exactly

```
desktop/src/renderer/screens/dashboard.tsx
desktop/src/renderer/screens/import-entry-points.test.ts
desktop/src/renderer/styles/screens.css
docs/gui.md
```

---

**Gate P.** Implementation must not begin until Oscar has reviewed this plan and recorded approval
as an `Approved: Oscar <date>` line at the top of this file. `.claude/hooks/guard-implementation.sh`
blocks every edit under `desktop/**` and `src/**` until that line exists, and the branch
(**P-D1**) is created only after it does.
