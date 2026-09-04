# IMPORT-FEEDBACK — the Import screen tells you what it is doing, and whether it saved · Refined Spec

**Status:** **Gate R resolved (Oscar, 2026-09-04).** Oscar approved the spec with every
default as written (D-1 through D-13). D-1 (frozen-window confirmation) stays an open
observation for Oscar to make during/around implementation — the defaults already say to
treat V1–V7 as in scope regardless of its answer, and D-2 starts at O1 (escalate to O2 only
if D-1 later shows multi-minute freezes Oscar considers unacceptable).

**Amendment (Oscar, 2026-09-04, "sumalo"):** while using the app, Oscar hit a second bug on
the same screen — Preview claimed a project name would work, then Import rejected the exact
same name. He asked for it to be folded into this advance rather than opened separately. See
**§2.6 (V8)** and **Problem 2** in §1/§4 below. Folded in via chat approval, not a fresh Gate R
round, because the root cause was already fully diagnosed (single file, single guard) before he
asked — plan.md had not yet received its `Approved:` line, so scope was still open to amend.
**Directory:** `IMPORT-FEEDBACK`, deliberately not a milestone number — same posture as
`GUI` / `MOBILE` / `CONNECT` / `CARDS` / `IMPORT-ENTRY`.
**Origin:** Oscar, using the app: *"When I save an import there's no feedback about whether it's
saving or not. If I click Import again it tells me there's a save already in progress, but there's
no feedback, no loading indicator, the buttons don't get disabled, nothing. I also don't know if it
ended up saving or not."*
**Predecessor:** `advances/IMPORT-ENTRY/` made the Import screen reachable; it changed **not one
line** of `import.tsx`. This advance is the first one to touch the import flow's UX since the GUI
advance built it.
**Legend:** every decision carries a **Default:**. The main agent takes these to Oscar at Gate R.

Read §2 first. The screen **already has** a busy state, disabled buttons, a loading line and a
result summary — so "add a loading state" is the wrong fix. §2 establishes what is actually
broken, from the source, and §3 names the one thing only Oscar can confirm.

---

## 1. Goal

**Make the Import screen honest about three moments it is currently silent or misleading about:
while it is reading the file, while it is writing to the vault, and after it finishes.** A user
must, without guessing: (a) see that a long operation has started and that the app has not
crashed, (b) be unable to start a second one by accident, and (c) know afterwards, in a place they
are actually looking, whether the import succeeded (and with what numbers) or failed (and why).

This advance changes **no** import semantics: the same file, the same parser, the same selection,
the same single `ImportConversations` → `ImportItems` write, the same numbers.

**Problem 2 (added 2026-09-04).** Preview must not claim success for a project name that Import
will then reject. Concretely: **validate the project name at the same moment for both Preview and
Import**, so a doomed name is caught before the user commits to it, not after — and, ideally, tell
the user *why* a name is invalid, not just that it is.

---

## 2. Ground truth read from the repo (so the planner does not re-derive it)

### 2.1 The mechanism that exists today

`desktop/src/renderer/screens/import.tsx` (unchanged since `220acec`) already has:

| Line | What it does |
|---|---|
| 48 | `working: "preview" \| "import" \| null` |
| 111 | `setWorking(mode)` at the top of `runSelection` |
| 122 | `setWorking(null)` after the call resolves |
| 222–223 | renders `<p>{t("common.loading")}</p>` (preview) or `<p>{t("import.busyRetrying")}</p>` (import) |
| 227 / 234 | both action buttons carry `disabled={!canSubmit \|\| working !== null}` |
| 240–265 | a result block: `import.importSummary` / `import.previewSummary`, per-conversation failures, and the packs notice |
| 144 | on failure, `<p className="error">` — rendered **at the very top of the screen** |

So Oscar's report is not "the feature is missing". Something is preventing that mechanism from
reaching him. The rest of §2 is the list of source-verified reasons.

### 2.2 The build is (almost certainly) not stale — evidence

- `import.busyRetrying` is used in **exactly one place in the whole repo**: line 223, the
  in-progress paragraph. Nothing else renders it — a genuine `SQLITE_BUSY` failure surfaces
  `STORAGE_ERROR` ("Algo salió mal al leer o escribir los archivos de la bóveda"), never this
  string. **Therefore the "hay otro guardado en curso" message Oscar saw *is* the busy paragraph
  of an in-flight import**, which means his build contains the `working`-state mechanism.
- Build artefacts, ordered oldest → newest: `desktop/src/renderer/screens/*.tsx` <
  `desktop/out/main/index.js` < `desktop/out/renderer/assets/index-*.js` <
  `desktop/release/win-unpacked/resources/app.asar` < `desktop/release/Valija-0.1.0-Setup.exe`.
  The packaged installer in the repo is **newer** than the source, i.e. built from it.
- **Conclusion: staleness is not the explanation** — but the *installed* copy on Oscar's machine
  is outside the repo and cannot be checked from here. See **D-1**.

### 2.3 The leading cause — the whole import runs synchronously on the Electron **main** process

- `src/importers/infra/file-export-reader.ts` — `readFileSync` + `unzipSync` (fflate, in memory,
  caps at 128 MB/entry, 256 MB total) + `JSON.parse`. All synchronous.
- `src/importers/application/use-cases/import-conversations.use-case.ts` — `execute()` returns a
  `Result` **synchronously**: parse, sort, `renderConversationChunks` for every conversation, then
  `importItems.execute`.
- `src/context/application/use-cases/import-items.use-case.ts` +
  `src/context/infra/vault-sessions.ts` — one session, one `db.transaction` with **N synchronous
  inserts** (one per chunk) plus a lineage bump.
- `desktop/src/main/ipc/handlers/import-handlers.ts` calls that synchronous chain directly on the
  main process for **all three** channels.
- **Each of `import:list`, `import:preview`, `import:run` re-reads and re-parses the export from
  scratch** — three full passes over the same (potentially hundreds of MB) file, no caching.

Consequence: while an import runs, the Electron **main** process's UI thread is blocked. On
Windows that means the window stops pumping messages — it cannot repaint, cannot be moved, and the
OS eventually paints a ghost window / appends *"(No responde)"* to the title. A user sees the
**last frame painted before the block**: buttons that still look enabled, no loading line. That is
a complete, mechanical explanation of *"no feedback, no loading, buttons not disabled, nothing."*
It also explains the "second click": a click delivered during the freeze is **queued by the OS**
and dispatched when main unblocks — by which time `working` is back to `null` and the buttons are
enabled again, so it starts a **second** import, whose progress line reads *"Hay otro guardado en
curso; reintentando…"*. Oscar read that, reasonably, as an error about a competing save.

**This hypothesis is not verifiable from source alone** — how much of it is "the frame never got
presented" vs. "the copy is wrong and easy to miss" depends on timing on Oscar's machine. **D-1**
turns it into a two-minute observation.

### 2.4 Defects that are certain from source, independent of §2.3

| # | Defect | Evidence |
|---|---|---|
| V1 | The in-progress copy **lies**. `import.busyRetrying` = *"Hay otro guardado en curso; reintentando…"* / *"Another save is in progress — retrying…"* is shown for the **entire** duration of a plain first import with zero contention. The real retry (`runImportWithBusyRetry`, 2 attempts × 200 ms) is invisible to the renderer and cannot be distinguished from a first attempt. | `import.tsx:223`; `import-handlers.ts:15-51`; catalogs `es.ts:190` / `en.ts:188` |
| V2 | **The previous result is never cleared.** `runSelection` sets `working` and clears `error`, but not `resultOutcome`/`resultMode`. Press Import a second time and the **stale** summary from the previous run stays on screen throughout — the screen looks identical before, during, and after. Directly produces *"I don't know if it ended up saving."* | `import.tsx:111-112` vs. `49-50, 240` |
| V3 | **The error renders at the top of the screen**, above the conversation list; the buttons are at the bottom. With a long list the user is scrolled to the buttons and a failed import's message is **off-screen**. Nothing scrolls or focuses it: there is no `scrollIntoView`, `useRef`, `aria-live` or `aria-busy` anywhere in `desktop/src/renderer/screens/**`. | `import.tsx:144` vs. `225-238`; repo-wide grep |
| V4 | **The listing step has no feedback at all.** `handleChooseFile` → `loadListing` runs the same synchronous read + parse + per-conversation chunk estimate with no busy state. The catalogs even carry an **unused** `import.detectingFormat` ("Leyendo el archivo…" / "Reading the file…") that was clearly meant for this slot. | `import.tsx:59-85`; `detectingFormat` has zero usages |
| V5 | **A rejected IPC call strands the screen forever.** `registerHandlers` *throws* on schema-validation failure, and `import:list` / `import:preview` have **no** try/catch (only `import:run` converts every throw into `STORAGE_ERROR`). A rejection propagates out of `runSelection`, which is invoked as `void runSelection(...)` → unhandled rejection: `setWorking(null)` never runs, both buttons stay disabled, the busy line stays up, no error is shown. | `register-handlers.ts:65-71`; `import-handlers.ts:85-101`; `import.tsx:120-129, 228, 235` |
| V6 | **The import screen has no CSS at all.** `.import-listing`, `.conversation-list`, `.conversation-row`, `.import-result` appear in **zero** rules in `styles/*.css`. The busy line is an unstyled `<p>` visually identical to its neighbours; the result summary likewise; the conversation `<ul>` is unbounded, so an export with hundreds of conversations pushes the project picker, the buttons and the result thousands of pixels down the page. | grep of `desktop/src/renderer/styles/**` |
| V7 | Nothing is announced to assistive tech — no `aria-live`, no `aria-busy`, no focus move. | as V3 |

### 2.5 Prior art in this codebase — there is a pattern, and it is the weak one

Every async screen rolls its **own** local flag plus `disabled` plus a bare
`<p>{t("common.loading")}</p>`: `connecting` (connect-tools), `running` (diagnostics), `deriving`
(create-vault), `unlocking` (locked), `confirming` (migration-confirm), `checking` (no-vault),
`retrying` (relocate-vault), `entries === null` (connect-tools, sync, dashboard). **There is no
shared busy/result component** — `renderer/components/` holds only `nav-bar`, `item-card`,
`markdown-content`. So "reuse the existing pattern" is exactly what `import.tsx` already does; the
pattern itself is what fails when main blocks. See **D-5** and **D-12** for how far to generalise.

Other binding facts: no `worker_threads` / `utilityProcess` anywhere in the repo (the only
`child_process` use is `child-process-node-probe.ts`); `no-network-surface.test.ts` globs the
renderer tree, so any spinner must be pure CSS with no remote asset; jsdom DOM tests now exist for
**three** screens (`recovery-kit`, `relocate-vault`, and `project` since CARDS), so GUI plan
P-D5's "exactly two screens" limit has already moved.

### 2.6 V8 — Preview doesn't validate the project name; Import does (Problem 2, added 2026-09-04)

- `src/context/domain/values/project-name.ts:4` — `parseProjectName` requires
  `/^[a-z0-9][a-z0-9-]{0,63}$/` after trim + lowercase: letters, digits, hyphens only, no spaces,
  no leading hyphen. `"Openai 1"` normalizes to `"openai 1"`, which fails on the space.
- `src/importers/application/use-cases/import-conversations.use-case.ts:111-119` — the `dry-run`
  branch (Preview) builds its summary **from `input.projectName` directly**, echoed verbatim into
  `project:` (line 219's `summary()`), and never calls `importItems.execute`. The `list` branch
  (line 94-99) doesn't even receive a project name. **Neither reachable-from-Preview code path ever
  calls `parseProjectName`.**
- `src/context/application/use-cases/import-items.use-case.ts:53` — `parseProjectName` is called
  **only** here, which only the real `import` branch reaches
  (`import-conversations.use-case.ts:121`).
- Result: Preview renders *"Se importarían 111 elementos de 100 conversaciones en 'Openai 1'…"* —
  a specific, confident number — for a name that cannot be saved. The user commits, then Import
  fails with `INVALID_PROJECT_NAME` → the catalog string `"Ese nombre de proyecto no es válido."`
  (`es.ts:336`, `en.ts` equivalent), which names no rule and gives no example. Reproduced live by
  Oscar: `newProjectName = "Openai 1"` (typed into `import.tsx`'s free-text input, which has no
  `pattern`, `maxLength`, or hint — §2.1's table, unchanged).
- **Not a security or write-path concern** — `parseProjectName`'s rule itself is correct and
  unchanged by this advance (it is the same guard `ImportItems`/`SaveContext`/the CLI all share).
  This is purely "the two code paths that report a project name disagree about whether it's valid."

---

## 3. User walkthrough (observable behaviour)

Ana has a 180 MB ChatGPT `conversations.zip` with 640 conversations. Steps 1–7 are the flow this
advance is judged against; the "today" column is what she gets now.

| # | She does | Today | After this advance |
|---|---|---|---|
| 1 | Dashboard → **Importar tu historial de chats** | Import screen, "Elegir un archivo…" | unchanged |
| 2 | Picks `conversations.zip` | Nothing. The window is frozen for ~20 s (read + unzip + parse + chunk estimate for 640 conversations), then the list appears | The screen says **"Leyendo el archivo…"** (`import.detectingFormat`, today unused) *before* the work starts, and the app warns that this can take a while (D-10) |
| 3 | Filters, sorts, unchecks a few, picks a project | List, picker, buttons — but the list is unbounded, so the controls are ~4 000 px down the page | The list is height-bounded and scrolls in place, so the picker, the buttons and the status line stay together on one screen (D-6) |
| 4 | Clicks **Importar** | The button *looks* enabled and nothing changes; the window becomes "(No responde)" | Before the work starts, the app paints: the button reads **"Importando…"** and is disabled, its sibling is disabled, and a status line above the actions reads **"Importando 3 214 elementos de 612 conversaciones…"** — no lie about "otro guardado en curso" (D-2, D-3, D-5) |
| 5 | Clicks again, impatiently | The click is queued by the OS and fires a **second** real import when the freeze ends, whose progress line reads *"Hay otro guardado en curso; reintentando…"* | The re-entrancy guard makes the second click a no-op even if it is delivered after a freeze (D-9) |
| 6 | Waits | Nothing until it is over | Same wall-clock time (unless D-2 = O2), but the screen shows a truthful, static "in progress" state the whole way |
| 7 | It finishes | A summary appears — possibly below the fold; on a *second* run the **stale** summary from the first run was on screen the whole time and may not visibly change | The status region (same place she just clicked) shows **"Se importaron 3 214 elementos de 612 conversaciones en 'chatgpt'."**, or the failure reason **in that same place**, announced via `aria-live`, with the stale previous result cleared when the run started (D-4, D-7) |
| 8 | Something fails | If the IPC call rejects: buttons disabled forever, busy line stuck, no message | Every path resets the busy state and shows a localized reason — a stuck screen is impossible (D-9) |

```
Import screen, after this advance (order on screen, bottom of the page):
  [ conversation list — bounded height, scrolls in place ]
  Importar en: [ chatgpt ▾ ]
  ── status region (aria-live) ─────────────────────────────
  Importando 3 214 elementos de 612 conversaciones…
  → on success: Se importaron 3 214 elementos de 612 conversaciones en 'chatgpt'.
  → on failure: <localized reason>
  [ Vista previa ]  [ Importando… ]      ← both disabled while working
```

### How the data is used afterwards — unchanged, stated so it is not re-litigated

| Surface | Imported items |
|---|---|
| Project item list (type filter `imported`) | shown — unchanged |
| Search | searchable — unchanged |
| **Context pack** (GUI, `valija export`, MCP pack responses) | **still excluded** — `docs/SPEC.md` §10a; the `import.excludedFromPacksNotice` line stays in the result block |
| MCP tool surface | **unchanged** — 5 tools + 2 prompts, no new tool, no new argument |
| Lineage | one bump per import batch, exactly as `ImportItems` does today |
| `valija` CLI | untouched |
| Re-importing the same selection | still upserts (deterministic ids), never duplicates — unchanged |

This advance changes **no** row of that table. It changes what the user *sees while and after* the
write, not what is written.

---

## 4. Scope

### In scope
- `desktop/src/renderer/screens/import.tsx` — busy/result/error presentation, re-entrancy guard,
  rejection hardening, reset-on-new-run.
- Both i18n catalogs (`en.ts`, `es.ts`) — honest progress copy; retire `busyRetrying` from the
  progress slot; put `detectingFormat` to work.
- `desktop/src/renderer/styles/screens.css` — the first rules this screen has ever had, scoped to
  the status region, the result block, and the list's bounded height.
- `desktop/src/main/ipc/handlers/import-handlers.ts` — **only** if D-2 ≠ O1 or D-9's main-side
  symmetry is taken (make `import:list`/`import:preview` non-throwing like `import:run`).
- One renderer test that fails against today's `import.tsx` (D-12); one paragraph in `docs/gui.md`.
- **Problem 2 (V8):** `src/importers/application/use-cases/import-conversations.use-case.ts` —
  validate `input.projectName` (via `parseProjectName`, same rule `ImportItems` already enforces)
  in the `dry-run` branch too, not just `import`, so Preview and Import agree. See **D-14**.

### Explicitly deferred
| Deferred | Why |
|---|---|
| Caching the parsed export between `list` / `preview` / `run` (today: three full re-parses) | A real performance bug and the biggest single win on wall-clock time, but it changes handler lifecycle and state ownership — its own advance |
| A real progress **percentage** or per-conversation progress events | Needs a progress channel and a chunked write loop; only meaningful if D-2 = O2 |
| A **Cancel** button / interruptible import | Same |
| Background/queued imports, or importing while navigating away | Same |
| Changing the busy-retry policy itself (attempts, backoff) or surfacing a *real* retry to the UI | Only the misleading *reuse* of the retry string is in scope |
| A general redesign of the import screen, or a shared busy component for all nine screens | See D-12; this advance may extract at most what it needs |
| Post-import navigation to the project | See D-11 |
| Loosening or changing `parseProjectName`'s rule itself, or adding client-side input formatting/a live-validation hint on the free-text field | The rule is correct and unchanged (V8); this advance makes Preview honor it, not redesign the input. A `pattern`/hint on the field is a reasonable follow-up but not required to close the reported bug |
| Anything else in `src/**` (import parsing, chunking, the vault write path) | Only the one missing validation call is in scope; everything else about the write path is correct |

---

## 5. Open decisions (defaults chosen; Gate R confirms or overrides)

### D-1 — Confirm the diagnosis (only Oscar can answer)
Before or as part of this advance, Oscar runs one import and reports:
(a) is he running the packaged app (`desktop/release/…`, or an installed copy) or `npm run dev`?
(b) during the import, does the title bar say **"(No responde)"**, and can he drag/resize the
window? (c) roughly how big is the export, how many conversations, how long does it take?
- **(b) = frozen** ⇒ §2.3 is confirmed; D-2 becomes the load-bearing decision.
- **(b) = responsive** ⇒ the cause is V1/V2/V3/V6 alone (misleading copy, stale result, off-screen
  error, no visual weight) and D-2 can collapse to O1 with no further work.
- **Default:** assume **frozen**, and treat V1–V7 as in scope regardless — every one of them is
  independently verified from source and worth fixing either way.

### D-2 — How far to go on the main-process freeze
- **O1 — paint before you block.** The renderer guarantees the busy frame is presented (e.g. two
  animation frames / a yielded tick) *before* dispatching the IPC, so the frozen window shows the
  busy state rather than the pre-click state. Tiny, renderer-only, no new process, no new channel.
  Cost: the window is still frozen during the work — nothing animates, the window can't be moved.
- **O2 — move the import off the main thread** (Electron `utilityProcess` or `worker_threads`).
  The window stays responsive; a real spinner and later a progress bar become possible. Cost:
  large — native modules (`better-sqlite3-multiple-ciphers`, `@napi-rs/keyring`) must load there,
  the **vault key would be read in a second process**, a new IPC protocol and error mapping,
  `dependency-parity.test.ts`/packaging implications, and no precedent in this repo.
- **O3 — yield between batches in main.** Split read/parse/chunk (and possibly the inserts) with
  `setImmediate` so main breathes. Cost: a SQLite transaction cannot span an `await`, so either
  only the pre-write phases yield (partial relief) or the write is split into several transactions
  — losing single-transaction atomicity and the one-bump-per-import lineage guarantee. **Rejected
  for the write.**
- **Default: O1**, plus honest copy that the window may stop responding (D-10). It is proportionate
  to a UX bug report, ships this week, and is a strict prerequisite for O2 anyway. **Escalate to O2
  if D-1(c) shows multi-minute freezes** that Oscar considers unacceptable — that is a performance
  advance with a security review of its own, not a copy fix.
- **Acceptance risk to name now:** O1 must be *measured* on Windows with a real large export. If
  the busy frame still never reaches the screen, O1 has not fixed anything and the advance must
  fall back to O2 rather than ship a fix that only works in theory.

### D-3 — The progress copy
- **Option A** — new keys `import.importing` / `import.previewing` (e.g. *"Importando… no cierres
  la ventana"* / *"Preparando la vista previa…"*), and `import.busyRetrying` is **removed from the
  progress slot**. Keep the key only if a real retry is ever surfaced; otherwise delete it and its
  catalog entries.
- **Option B** — keep `busyRetrying` but reword it to a neutral "Guardando…". Fewer keys, but the
  key name then lies to the next reader.
- **Option C** — parameterised copy: *"Importando {itemCount} elementos de {conversationCount}
  conversaciones…"*, using the counts the listing already computed (`estimatedChunks` per row).
  Most informative; the number is an estimate and may differ from the final count.
- **Default: A + C** — a dedicated key with the counts, and `busyRetrying` deleted from both
  catalogs (`catalogs.test.ts` enforces en/es parity, so this is machine-checked). Exact strings
  are Oscar's call at implementation.

### D-4 — Where status, result and error live
- **Option A (default)** — **one status region immediately above the action buttons** carrying all
  three states (busy / result / error), `aria-live="polite"`, `aria-busy` while working. The error
  `<p>` at the top of the screen stays only for the *file-choosing* stage errors, or is removed in
  favour of the single region.
- **Option B** — keep the error at the top and add scroll-into-view on failure. Preserves today's
  layout but relies on a scroll the user did not ask for.
- **Option C** — a toast/snackbar. New component kind, new dismissal semantics, no precedent.
- **Default: A**, because the user's eyes and cursor are already on the buttons — that is where the
  answer to "did it save?" belongs. Sub-decision: **auto-scroll the region into view on
  completion** — default **yes**, one `scrollIntoView({ block: "nearest" })`, which is a no-op when
  it is already visible.

### D-5 — Visual treatment while busy
- **Option A (default)** — **static** treatment: the pressed button's label switches to
  "Importando…", both buttons disabled (existing `button:disabled { opacity: .5 }`), and the status
  region gets weight (background/border via existing tokens).
- **Option B** — an animated CSS spinner. **Trade-off worth stating: under D-2 = O1 an animated
  spinner is itself a lie** — it will freeze mid-rotation and *look broken*, arguably worse than no
  spinner. A spinner only becomes honest under D-2 = O2.
- **Default: A.** No spinner while the main process still blocks. Revisit with O2.

### D-6 — Bound the conversation list's height
- The `<ul className="conversation-list">` is unstyled and unbounded (V6): with 640 conversations
  everything below it — picker, status, buttons — is thousands of pixels down.
- **Option A (default)** — `max-height` + `overflow-y: auto` on the list so the controls and the
  status region are always on one screen together.
- **Option B** — leave the layout alone; treat it as a separate styling advance.
- **Default: A.** It is 3 CSS lines and it is the difference between the feedback being visible and
  the feedback existing. Flagged as the one layout change in an otherwise behavioural advance.

### D-7 — Reset stale state on a new run
- **Default: yes** — clear `resultOutcome`/`resultMode` (and `error`) at the top of `runSelection`,
  and also when a new file is chosen. Alternative (keep a history of runs) is out of scope.

### D-8 — Feedback for the file-choosing / listing step
- **Default: yes** — reuse the already-translated, currently-dead `import.detectingFormat`, with
  the same D-2 = O1 paint-before-block treatment, and disable the "Elegir un archivo…" button while
  it runs. Alternative: leave step 2 silent and fix only the write — rejected, it is the same class
  of bug and the copy already exists.

### D-9 — Never strand the screen (V5)
- **Option A (default)** — renderer-side `try/finally` around every awaited bridge call in
  `runSelection`/`loadListing`/`handleChooseFile`, so `working` is always reset and a generic
  localized error is shown on a rejection; **plus** a re-entrancy guard `if (working !== null)
  return;` at the top of `runSelection` (immune to OS-buffered clicks and double-click races in a
  way `disabled` alone is not).
- **Option B** — additionally make `import:list` / `import:preview` non-throwing in main, mirroring
  `import:run`'s catch-all → `STORAGE_ERROR`. Symmetric and cheap; touches the main process.
- **Default: A + B.** A alone is sufficient for the user-visible bug; B removes the underlying
  asymmetry and is two small edits. If Oscar wants a renderer-only diff, drop B.

### D-10 — Warn that a big import takes a while
- **Option A (default)** — the busy copy itself carries it (*"…esto puede tardar; la ventana puede
  dejar de responder"*), shown always while D-2 = O1.
- **Option B** — show it only above a threshold (e.g. > 200 conversations or > 2 000 estimated
  chunks). Less noisy, one more magic number.
- **Option C** — no warning; a frozen window with no explanation.
- **Default: A** while the freeze is real. If D-2 = O2 ever lands, this copy must be deleted in the
  same change — a stale "may stop responding" would be a new lie.

### D-11 — A next step after a successful import
- **Option A (default)** — no navigation. The result summary is the confirmation; the nav bar is
  the way out. `ImportScreen` takes only `{ bridge }` and has no `onBack` (a gap IMPORT-ENTRY
  deliberately deferred); adding navigation means a new prop and a router change.
- **Option B** — a "Ver el proyecto" button that navigates to `{ screen: "project", project }`.
  Answers "did it save?" definitively by showing the items. Costs a prop + `app.tsx` wiring.
- **Default: A**, to keep the advance behavioural rather than navigational. **Option B is the one
  worth overriding to** if Oscar feels the summary alone still doesn't prove the save landed.

### D-12 — How the fix is proven by test
- **Option A (default)** — a **jsdom DOM test** (`screens/__dom-tests__/import.dom.test.tsx`) with
  a fake `ValijaBridge` whose `import.run` returns a promise the test controls: assert that between
  click and resolution the busy text is present and both buttons are `disabled`; that a stale
  result is cleared on a new run; that a **rejected** call still clears the busy state and shows an
  error; and that a second click while working does not call `run` twice. This is the only form
  that can see the bug.
- **Option B** — a source-scan test in the `import-entry-points.test.ts` idiom. Cannot observe a
  rendered state; would have passed against today's code.
- **Default: A.** Precedent has already moved to three DOM-tested screens (recovery-kit,
  relocate-vault, project); this advance is *about* rendered feedback, so a source scan is the
  wrong instrument. Note explicitly: **no test can prove the frame was presented on Windows** —
  that is D-2's manual measurement, and it must appear in the review notes.

### D-13 — Docs
- **Default:** one paragraph in `docs/gui.md` §"Importing your chat history" stating what the
  screen shows while reading, while importing, and afterwards — and, while D-2 = O1, that a large
  import may make the window stop responding. CLAUDE.md: docs ship in the same commit.

### D-14 — Where Preview's project-name validation lives (Problem 2 / V8)
- **Option A (default)** — `import-conversations.use-case.ts` imports `parseProjectName` directly
  from `context/domain/values/project-name.js` and calls it at the top of the `dry-run` branch
  (and, harmlessly, `import` — `ImportItems` already re-checks it, defense in depth, not deleted).
  **Precedent already exists**: this same file already imports types from
  `context/application/use-cases/import-items.use-case.js`, and
  `importers/domain/services/chunk-render.test.ts` already imports
  `context/domain/values/content.js` directly — `importers` and `context` are not isolated from
  each other the way `vault`/`context` are from unrelated modules. No new port, no new file.
- **Option B** — introduce a small `ProjectNameValidator` port into `importers/application/ports/`,
  implemented in `container.ts` by wrapping `parseProjectName`. Cleaner hexagonal boundary, but a
  new port + adapter for one regex check is the "premature abstraction" CLAUDE.md warns against,
  given Option A's precedent already exists in this exact file.
- **Option C** — route `dry-run` through `ImportItems.execute` itself with a new `dryRun` flag that
  skips the write. **Rejected**: blurs the hard-won invariant that dry-run never touches the vault
  (mirrors the CLI's own `--dry-run`), and risks a real write on a wiring mistake.
- **Default: A.** One import, one early-return `Result` check, reusing the exact error
  (`INVALID_PROJECT_NAME`) and the same `errorCopy(result.error.code)` path the renderer already
  has for Import — so Preview and Import show the *identical* localized message for the same bad
  name, just at the earlier, safer moment.
- **Copy note:** V8's other half — `"Ese nombre de proyecto no es válido."` names no rule — is
  **not** fixed by D-14 alone. Whether to also improve `INVALID_PROJECT_NAME`'s catalog copy to
  state the rule (e.g. *"...solo minúsculas, números y guiones, sin espacios."*) is folded into
  **D-3**'s catalog pass at implementation; both catalogs' `catalogs.test.ts` parity must still pass.

---

## 6. Acceptance criteria (reviewer checklist)

Each traces to a step in §3.

**Busy state (steps 2, 4, 6)**
- [ ] Clicking **Importar** produces a visible in-progress state *before* the main process begins
      the synchronous work, verified **manually on Windows with a real large export** (D-2's
      measurement, recorded in `review.md`), not only in jsdom.
- [ ] Both action buttons are disabled for the whole run, and the pressed button's label reflects
      the state (D-5 Option A).
- [ ] Choosing a file shows the reading state (`import.detectingFormat`) and disables the chooser
      while it runs (D-8).
- [ ] The in-progress copy never claims another save is in progress. `import.busyRetrying` is no
      longer rendered as generic progress text (and, per D-3, is removed from both catalogs);
      `catalogs.test.ts` parity passes.

**Result and error (steps 7, 8)**
- [ ] Result and error appear in the **same region as the action buttons**, not at the top of a
      page the user has scrolled away from (D-4), and the region is `aria-live`.
- [ ] Starting a new run clears the previous run's summary before the new one begins (D-7) — a
      reviewer running import twice must see the summary disappear and come back.
- [ ] A rejected `bridge.import.*` call leaves the screen usable: busy state cleared, buttons
      re-enabled, a localized error shown (D-9). A reviewer can force this with a fake bridge.
- [ ] A second click while a run is in flight never starts a second run, even when the click is
      delivered after a freeze (re-entrancy guard, D-9).
- [ ] The result block still shows per-conversation failures and the
      `import.excludedFromPacksNotice` line, unchanged.

**Layout (step 3)**
- [ ] With a listing of several hundred conversations, the project picker, the status region and
      both buttons are reachable without an extreme scroll (D-6), in a window at its default size,
      in **both** languages.

**Project-name honesty (V8 / Problem 2)**
- [ ] Previewing with an invalid project name (e.g. containing a space, or uppercase, or a leading
      hyphen) fails **at Preview**, with the same localized `INVALID_PROJECT_NAME` message Import
      would show — never a confident "would import N items" summary for a name that cannot be
      saved (D-14).
- [ ] Previewing and then Importing the **same** valid or invalid name always agree: both succeed
      or both fail, never one then the other.
- [ ] `list` mode (no project name involved) is unaffected.
- [ ] A test exists that fails against today's `import-conversations.use-case.ts` (dry-run accepts
      an invalid name) and passes after.

**Cross-cutting**
- [ ] A test exists that **fails against today's `import.tsx`** and passes after (D-12).
- [ ] `npm run typecheck && npm run lint && npm run test` green in the repo root **and** in
      `desktop/`.
- [ ] The diff touches no file under `src/**` **except**
      `import-conversations.use-case.ts`/`.test.ts` (D-14, Problem 2), no
      `desktop/src/shared/ipc/**`, no preload, no `package.json` — unless D-2 = O2 is chosen, in
      which case §7 applies in full.
- [ ] `docs/gui.md` describes the three moments (D-13).
- [ ] No import semantics changed: same parser resolution, same selection, same single write, same
      counts, same deterministic ids.

---

## 7. Security-sensitive surfaces — what must not weaken

Under the default (D-2 = O1) this is a presentation change, and the review should confirm that
literally:
- **No new IPC channel, no preload API change, no zod schema change.** `ValijaBridge` is a closed,
  enumerated list; nothing is added to it.
- **No filesystem path originates in the renderer.** The import file is still addressed by the
  opaque `handle` minted by the main-process dialog (`dialog:chooseImportFile`); a busy state must
  never carry, log, or display a resolved path.
- **No vault session, key material, or keychain access** moves into the renderer. The renderer sees
  only counts and error **codes** (`errorCopy(result.error.code)`) — never a raw SQLite/driver
  message. The existing rule that busy/storage failures surface a localized code, not a raw string
  (`import-handlers.ts`'s docblock), must hold.
- **No vault content in progress copy or logs.** Counts and the project name only. (Per-conversation
  failure titles in the result block are pre-existing behaviour and unchanged.)
- **Imported items stay excluded from context packs** (`SPEC.md` §10a) — the notice stays.
- **MCP surface unchanged**: 5 tools + 2 prompts, no new argument, no new transport.
- **No network, no telemetry, no URL** — `no-network-surface.test.ts` globs the renderer tree, so
  any spinner/asset must be pure CSS.
- **If D-2 = O2 is chosen, this section changes character** and needs its own review: the vault key
  would be read (from the OS keychain, keyed by `vaultId`) inside a second process, a new
  parent↔child protocol appears, handle→path resolution must stay in main, and the child must be
  spawned with no remote code path. Do not fold that into a UX advance without saying so.

---

## 8. Architecture notes (clean architecture / DDD / hexagonal)

- The default fix lives almost entirely in the **renderer presentation layer**, plus optionally two
  defensive edits in a main-process **IPC adapter** (D-9 Option B), plus **one application-layer
  edit** for Problem 2/V8 (D-14): `import-conversations.use-case.ts` gains an early
  `parseProjectName` check in its `dry-run` branch, reusing the existing domain value from
  `context/domain/values/project-name.ts` — no new port, no new use case, no new value object. A
  new file under any `domain/`/`application/` folder beyond that single call site is a signal that
  scope has crept.
- If any logic is worth extracting from `import.tsx` (e.g. "which status does this state produce?"
  as a pure function), it belongs beside the existing `renderer/state/import-selection.ts` — a pure,
  unit-tested module — not in a new bare file at a layer root. **No bare files** (CLAUDE.md).
- If a reusable status/busy element is extracted, it goes in `renderer/components/` next to
  `item-card.tsx` / `markdown-content.tsx`. Extract **only** what this screen needs; retrofitting
  the other eight screens is out of scope (§4).
- `ImportScreen` keeps its `{ bridge }`-only interface unless D-11 Option B is chosen; navigation
  stays a caller-supplied callback, never a router import inside a screen.

---

## 9. Affected areas (for the planner, not a plan)

`desktop/src/renderer/screens/import.tsx` · `desktop/src/shared/i18n/catalogs/{en,es}.ts`
(`import.importing`/`previewing`, `detectingFormat` now used, `busyRetrying` retired) ·
`desktop/src/renderer/styles/screens.css` (first rules for `.import-listing`, `.conversation-list`,
`.import-status`, `.import-result`) · `desktop/src/main/ipc/handlers/import-handlers.ts` (D-9
Option B only) · a new `desktop/src/renderer/screens/__dom-tests__/import.dom.test.tsx` ·
`docs/gui.md` · **`src/importers/application/use-cases/import-conversations.use-case.ts` and its
`.test.ts`** (D-14, Problem 2/V8 — the one `src/**` file this advance touches).

---

## 10. Biggest risk

**The fix could be aimed at the wrong cause.** If the Electron main process really is frozen for
the duration of the import (§2.3), then *no* amount of React state, CSS or copy is guaranteed to
reach the screen — the winning frame has to be presented in the handful of milliseconds between
the click and main blocking. D-2 = O1 is a bet that it can be, and that bet is **only settled by
measuring on Oscar's Windows machine with a real export** (D-1). Shipping the copy/layout/result
fixes without that measurement would leave Oscar with a screen that is *correct in source and
still blank in practice* — exactly the discrepancy this advance exists to close. Every other item
here (V1–V7) is certain from source and worth fixing regardless; this one is the one that decides
whether the advance actually lands.
