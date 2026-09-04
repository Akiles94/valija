# IMPORT-FEEDBACK — Execution plan

> Implementation must **not** begin until Oscar has reviewed this file and added an
> `Approved: Oscar <date>` line at the very top. `.claude/hooks/guard-implementation.sh` blocks
> every edit under `src/**` and `desktop/**` until that line exists, and the branch is created
> only after it does. **This planner does not write that line.**

**Spec:** `advances/IMPORT-FEEDBACK/refined.md` — Gate R **resolved** (Oscar, 2026-09-04), every
default D-1…D-13 approved as written. Nothing in D-1…D-13 is reopened here.

**Type:** Presentation change. Renderer (screen + two pure units + CSS + copy) plus **two
defensive edits in one main-process IPC adapter** (D-9 Option B). No `src/**`, no
`desktop/src/shared/ipc/**`, no preload, no zod schema, no `package.json`, no new dependency.

---

## Gate P resolutions carried from the refined spec

These are settled inputs, restated so the implementer never has to re-derive them:

| Decision | Resolution the plan implements |
|---|---|
| **D-1** | Assume the main process is frozen; V1–V7 are in scope regardless. Oscar's observation is a **manual measurement step** in this plan (after Slice 4), recorded in `review.md`. |
| **D-2 = O1** | Paint before you block: the busy frame is presented **before** the synchronous IPC call. No new process, no new channel. |
| **D-3 = A + C** | New `import.importing` / `import.previewing` carrying `{itemCount}`/`{conversationCount}`; `import.busyRetrying` deleted from **both** catalogs once its last render disappears. |
| **D-4 = A** | **One** status region, `aria-live="polite"`, `aria-busy`, directly above the action buttons, holding busy / result / error. The top-of-screen `error` `<p>` (line 144) is **removed**. `scrollIntoView({ block: "nearest" })` on completion. |
| **D-5 = A** | Static treatment: pressed button's label becomes "Importando…", both disabled, **no spinner**. |
| **D-6 = A** | `.conversation-list` gets `max-height` + `overflow-y: auto`. |
| **D-7 = yes** | `resultOutcome` / `resultMode` / `error` cleared at the top of every run and when a new file is chosen. |
| **D-8 = yes** | The currently-dead `import.detectingFormat` drives the file-reading step, same paint-before-block treatment, chooser disabled while it runs. |
| **D-9 = A + B** | `try/catch/finally` around every awaited bridge call + a re-entrancy guard + `import:list`/`import:preview` made non-throwing in main. |
| **D-10 = A** | The busy state warns that the window may stop responding, always, while D-2 = O1. |
| **D-11 = A** | No post-import navigation. `ImportScreen` keeps its `{ bridge }`-only interface. |
| **D-12 = A** | `desktop/src/renderer/screens/__dom-tests__/import.dom.test.tsx` with a controllable fake bridge. |
| **D-13 = yes** | One paragraph in `docs/gui.md` §"Importing your chat history". |

---

## Branch

`feat/import-feedback` — **branched from `feat/desktop-GUI`, not `main`.**

Reasoning, the same way CONNECT's plan D1 reasoned about it: every file this advance touches
(`desktop/src/renderer/screens/import.tsx`, the i18n catalogs, `screens.css`, the main import
handler) lives in the `desktop/` tree the GUI advance introduced. CONNECT verified on 2026-08-29
that GUI was **not** merged to `main` (26 commits ahead), and `feat/desktop-GUI` has taken more
commits since (CARDS' three slices, IMPORT-ENTRY's hotfix, the CONNECT work in progress).
Branching from `main` would give an empty `desktop/` tree.

**One caveat the orchestrator must settle — see P-D1.** IMPORT-ENTRY's Gate P *overrode* its own
branch recommendation and committed straight onto `feat/desktop-GUI`, because that session's
execution environment was scoped to develop and push only on that branch. If that constraint still
holds, this advance lands as commits on `feat/desktop-GUI` instead of on its own branch. Either way
the diff is identical; only the branch differs.

---

## Plan summary

Six slices, each independently checkable and green on
`npm run typecheck && npm run lint && npm run test` (run in `desktop/` **and** in the repo root).
The two cheap, isolated pieces (copy, pure units) land first so the load-bearing screen rewrite has
nothing else moving underneath it.

- **Slice 1 — honest progress copy.** Add `import.importing`, `import.previewing`,
  `import.mayStopResponding` (plus the two short button labels, P-D3) to both catalogs, with an
  `import-copy.test.ts` in the `connect-copy.test.ts` idiom. `busyRetrying` is *not* deleted yet —
  its last render disappears in Slice 3, and deleting it earlier would break `typecheck`
  (`TranslationKey` is derived from `en`).
- **Slice 2 — the two pure units.** `renderer/state/next-paint.ts` (`waitForNextPaint`, D-2's whole
  mechanism) and `countSelection` added to the existing `renderer/state/import-selection.ts`
  (D-3 Option C's numbers). Both headless-tested; no screen change yet.
- **Slice 3 — `import.tsx` (the load-bearing slice).** DOM test written **first and verified red**,
  then: `working` gains a `"reading"` mode, a ref-backed re-entrancy guard, `beginWork`/`endWork`,
  the paint yield, `try/catch/finally` on every awaited bridge call, and the single always-mounted
  status region that replaces both the top-of-screen error and the two bare busy `<p>`s. Deletes
  `import.busyRetrying` from both catalogs in the same commit as its last usage.
- **Slice 4 — the screen's first CSS.** A `/* import.tsx */` section in `screens.css`: bounded,
  scrolling conversation list (D-6) and a bordered status region with visual weight (D-5).
- **Manual measurement (D-2's bet, between Slices 4 and 5).** Real large export, Windows,
  packaged build. Recorded in `review.md`. This is the only thing that decides whether the advance
  landed; no test can prove it.
- **Slice 5 — main-process symmetry (D-9 Option B).** `import:list` / `import:preview` stop
  throwing: every throw becomes `STORAGE_ERROR`, mirroring `import:run`. Two handler tests.
- **Slice 6 — docs.** One paragraph in `docs/gui.md`, shipped in the same commit as the code.

---

## Ground truth verified against HEAD (2026-09-04) — anchors, not guesses

Read before implementing. If any anchor differs, the file moved under this plan: stop and re-anchor
rather than editing by line number.

- `import.tsx` matches `refined.md` §2.1 exactly: `working` at 48, `setWorking(mode)` at 111,
  `setWorking(null)` at 122, the two busy `<p>`s at 222–223, `disabled={!canSubmit || working !== null}`
  at 227/234, the result block at 240–265, the top error `<p>` at 144. `useRef` appears nowhere in
  the file, and `aria-live` / `aria-busy` / `scrollIntoView` appear nowhere in `screens/**`.
- **`import.busyRetrying` has exactly one usage repo-wide** (`import.tsx:223`), and
  `import.detectingFormat` has **zero**. Confirmed by grep over `desktop/src`.
- **`catalogs.test.ts` walks both catalogs deep, in both directions, and compares placeholders per
  key.** Adding a key to only one catalog, or with mismatched `{…}` placeholders, fails the suite.
  Deleting `busyRetrying` from both is machine-checked as symmetric.
- **`translate.ts` derives `TranslationKey` from `typeof en`.** A key deleted from `en` while a
  `t("…")` call survives is a **typecheck** failure, not a runtime one — which is why the deletion
  is sequenced with the screen change.
- **`t()` picks plurals off a single `count` param.** The new progress copy has *two* numbers, so it
  is a flat string with `{itemCount}` / `{conversationCount}` — exactly like the existing
  `import.importSummary`. See P-D10 about number grouping.
- **`no-network-surface.test.ts` scans `.ts` / `.tsx` / `.css` under `desktop/src` and forbids
  `setInterval`, `fetch(`, `http://`, `https://`, `XMLHttpRequest`.** `requestAnimationFrame` and
  `setTimeout` are **not** forbidden — but `setInterval` is, so the paint gate must not use it, and
  the CSS must carry no `url()` to a remote asset (it carries none at all).
- **`import-no-reimplementation.test.ts` scans `.tsx` too** (it only excludes `*.test.ts`, not
  `*.test.tsx`), so the new DOM test must not import anything from `importers/infra/parsers/`,
  `file-export-reader`, or `context/infra/*`. It won't — it fakes `ValijaBridge`.
- **jsdom implements no `Element.scrollIntoView`.** The call must be optional
  (`ref.current?.scrollIntoView?.(…)`) or the DOM test throws the moment a result renders. This is
  a real trap, not a precaution.
- **jsdom's `requestAnimationFrame` exists under Vitest's default `pretendToBeVisual`**, but the
  paint gate still needs a `setTimeout` fallback so it is safe in the `node` environment used by
  every other renderer test.
- **`useErrorCopy()` accepts any `string`** and falls back to `errors.generic` ("Something went
  wrong ({code}).") for an unrecognized code — so a rejection can be reported without inventing a
  catalog key and without ever touching the caught error's message.
- **`ImportScreen` renders inside `.workspace`**, not directly under `.app-shell`, so
  `base.css`'s `max-width: 480px` centering rule does **not** apply to it. `.screen`'s 720px
  max-width does.
- **Nothing reads `import.tsx` as a source scan** (only `app.tsx` imports it), so restructuring its
  JSX breaks no existing test.
- **`handlers["import:list"]` and `["import:preview"]` are synchronous today** and their existing
  tests call them synchronously (`import-handlers.test.ts:116, 143, 160`). Slice 5 must keep them
  synchronous — a `try/catch` does; an `async` wrapper would break those three assertions.

### Two design consequences worth stating up front

1. **The live region must be mounted before it has content.** A region that appears at the same
   moment as its text is frequently not announced by screen readers. So the status region is
   rendered **once, unconditionally, at screen level** — not inside the `stage === "listed"` branch
   — with `.import-status:empty { display: none }` keeping it invisible until it has something to
   say. This also solves a trap in D-4: a `loadListing` error happens while `stage` is still
   `"choose"`, so a region living inside the listed branch would have nowhere to put it, and D-4
   removed the top-of-screen error.
2. **`disabled` alone cannot stop the second click; a React state read cannot either.** Two clicks
   delivered in the same task (exactly the OS-buffered case §2.3 describes) both run their handler
   against the *same* render closure, where `working` is still `null`. The guard must therefore read
   a `useRef` set **synchronously** in `beginWork`. The `working` state stays as the render-driving
   value; the ref is the gate. See P-D4.

---

## Slice 1 — honest progress copy

**Goal.** The catalogs carry truthful, parameterised progress copy for all three moments, in both
languages, with matching placeholders.

**Files touched**
- `desktop/src/shared/i18n/catalogs/en.ts` — inside the `import:` namespace, after `importSummary`:
  ```ts
  importing: "Importing {itemCount} items from {conversationCount} conversations…",
  previewing: "Preparing a preview of {itemCount} items from {conversationCount} conversations…",
  // Button labels only — the sentences above are too long for a button, and they
  // are already on screen one line higher, in the status region (D-5, P-D3).
  importingShort: "Importing…",
  previewingShort: "Preparing…",
  // D-10: shown while D-2 = O1 keeps the import on the main process. If the work ever
  // moves off the main thread (D-2 = O2), delete this key in the same change — a stale
  // "may stop responding" would be a new lie.
  mayStopResponding: "This can take a while. The window may stop responding until it finishes — don't close it.",
  ```
- `desktop/src/shared/i18n/catalogs/es.ts` — the same five keys, same placeholders:
  ```ts
  importing: "Importando {itemCount} elementos de {conversationCount} conversaciones…",
  previewing: "Preparando la vista previa de {itemCount} elementos de {conversationCount} conversaciones…",
  importingShort: "Importando…",
  previewingShort: "Preparando…",
  mayStopResponding: "Esto puede tardar. La ventana puede dejar de responder hasta que termine; no la cierres.",
  ```
- `import.busyRetrying` and `import.detectingFormat` are **left untouched** in this slice.

Exact wording is Oscar's per D-3 — see **P-D2**. The two `*Short` keys exist only if P-D3 is taken
at its recommendation.

**Tests**
- **New** `desktop/src/shared/i18n/catalogs/import-copy.test.ts` (idiom of the existing
  `connect-copy.test.ts`): both progress keys exist in both catalogs; each carries **both**
  `{itemCount}` and `{conversationCount}`; the short labels carry **no** placeholder; no `import.*`
  string mentions "retry"/"reintent" or "another save"/"otro guardado" (V1 stated as an assertion,
  not a hope); `mayStopResponding` exists in both.
- `catalogs.test.ts` passes untouched (key-set + placeholder parity).

**Est. production lines:** ~14 (10 entries + 4 comment lines). Tests ~40.

---

## Slice 2 — the two pure units

**Goal.** D-2's mechanism and D-3(C)'s numbers exist as small, headless-tested functions before any
JSX depends on them.

**Files touched**
- **New** `desktop/src/renderer/state/next-paint.ts`:
  ```ts
  /**
   * IMPORT-FEEDBACK D-2 = O1, "paint before you block": the whole import runs
   * synchronously on the Electron main process, so a busy state that is only
   * *set* before the IPC call is never *presented* — the user keeps looking at
   * the last frame painted before main froze. Awaiting this hands the browser
   * two frames to commit the busy state first.
   *
   * Two rAFs, then a task: the second callback cannot run until the first frame
   * was committed, and the `setTimeout` leaves that frame's paint behind us
   * rather than in the same callback. `setInterval` is forbidden repo-wide
   * (`no-network-surface.test.ts`) and is not needed. Falls back to a plain task
   * where `requestAnimationFrame` does not exist (the `node` test environment),
   * so this is safe to call from anywhere.
   */
  export function waitForNextPaint(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof requestAnimationFrame !== "function") {
        setTimeout(resolve, 0);
        return;
      }
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)));
    });
  }
  ```
- `desktop/src/renderer/state/import-selection.ts` — one added function, same file because it is the
  same *kind* of thing the file already holds (a pure fact about the current selection):
  ```ts
  export interface SelectionCounts {
    conversationCount: number;
    itemCount: number;
  }

  /**
   * What the progress copy promises: how many conversations are checked and how
   * many items they are estimated to produce (`estimatedChunks`, the same number
   * the listing row already shows). An estimate by construction — the final
   * count comes back from `ImportConversations` and may differ. Field names match
   * the catalog placeholders so the result can be spread straight into `t()`.
   */
  export function countSelection(
    listing: readonly ImportListingRow[],
    checked: ReadonlySet<number>,
  ): SelectionCounts {
    const selected = listing.filter((row) => checked.has(row.index));
    return {
      conversationCount: selected.length,
      itemCount: selected.reduce((total, row) => total + row.estimatedChunks, 0),
    };
  }
  ```

**Tests**
- **New** `desktop/src/renderer/state/next-paint.test.ts` — resolves in the `node` environment
  (fallback branch); asserts it resolves **after** at least one macrotask, i.e. it actually yields.
  A second `// @vitest-environment jsdom` file is *not* added just for this — see P-D5's note.
- `desktop/src/renderer/state/import-selection.test.ts` — extend: empty selection → `{0, 0}`;
  a subset sums only the checked rows' `estimatedChunks`; a checked index absent from the listing is
  ignored (never `NaN`).

**Est. production lines:** ~26 (next-paint ~14 incl. docblock, countSelection ~12). Tests ~45.

---

## Slice 3 — `import.tsx`: the status region, the guard, the paint yield (load-bearing)

**Goal.** Every acceptance bullet under §6 "Busy state" and "Result and error" is true of the
rendered screen.

### Step 3.1 — write the DOM test first, and run it red

**New** `desktop/src/renderer/screens/__dom-tests__/import.dom.test.tsx`, in the idiom of
`project.dom.test.tsx` (`// @vitest-environment jsdom` pragma, `@testing-library/react`, a
`fakeBridge` object cast to `ValijaBridge`, wrapped in `I18nProvider`). It needs a deferred helper:

```ts
function deferred<T>() {
  let settle!: (value: T) => void;
  let fail!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, settle, fail };
}
```

Cases (each maps to an acceptance bullet — see the table below):

1. **Busy state is visible between click and resolution.** Choose a file, wait for the listing,
   type a project name, click **Import** against a deferred `import.run`: the importing copy and the
   "may stop responding" line are on screen, both action buttons are `toBeDisabled()`, and the
   region has `aria-busy="true"`. Resolve → the summary appears and the buttons are enabled again.
2. **The busy copy never claims another save is in progress.** Assert the busy text does not match
   `/another save|otro guardado/i`, in both `en` and `es`.
3. **A stale summary is cleared when a new run starts** (V2/D-7). Run once to a summary, click
   Import again against a deferred promise: the previous summary is gone *while* the new run is in
   flight.
4. **A rejected call never strands the screen** (V5/D-9). `import.run` rejects: busy state clears,
   both buttons enabled, an error is shown inside `.import-status`, and no unhandled rejection is
   raised (the test fails loudly if the promise escapes).
5. **A second click while working never starts a second run.** Two `fireEvent.click`s in the same
   task while `run` is pending → `run` called exactly once.
6. **The reading step has feedback** (V4/D-8). `import.list` deferred: after choosing a file the
   reading copy is on screen and the chooser button is disabled; resolve → the listing renders.
7. **The region is a live region and is the only place status lives** (V3/V7/D-4). The region
   carries `aria-live="polite"`; on error, `container.querySelector(".screen.import > p.error")` is
   `null` (no top-of-screen error) while `.import-status .error` is non-null; the region's DOM
   position precedes the action buttons (`compareDocumentPosition`).
8. **The result block is unchanged in content**: per-conversation failures still render, and the
   `import.excludedFromPacksNotice` line still renders for an import (not for a preview).

**Timing rule for the whole file:** because of `waitForNextPaint`, nothing may be asserted
synchronously after `fireEvent.click`. Every busy assertion is `await screen.findByText(…)` or
inside `waitFor(…)`. Write this in the file's docblock so the next reader does not "simplify" it
into a flaky test.

**Run it red before writing Step 3.2.** Cases 1, 3, 4, 5, 6, 7 must fail against today's
`import.tsx`. Record which ones failed; that list is the D-12 acceptance evidence.

### Step 3.2 — the screen

`desktop/src/renderer/screens/import.tsx`. The edits, in order:

1. **State.**
   - `type Working = "reading" | "preview" | "import" | null;` (module-level, above the component).
   - `const [working, setWorking] = useState<Working>(null);`
   - `const workingRef = useRef<Working>(null);` — the synchronous gate (see P-D4).
   - `const statusRef = useRef<HTMLDivElement>(null);` — for `scrollIntoView`.
2. **Two tiny lifecycle helpers inside the component** (they are the only place these five
   `set*` calls ever appear together, which is what makes D-7 unmissable):
   ```ts
   /** Start a run: gate first (synchronously), then clear whatever the last run left on screen (D-7). */
   function beginWork(mode: Exclude<Working, null>) {
     workingRef.current = mode;
     setWorking(mode);
     setError(null);
     setResultOutcome(null);
     setResultMode(null);
   }

   /** Always reached — from success, from a failed `Result`, and from a rejection (D-9). */
   function endWork() {
     workingRef.current = null;
     setWorking(null);
   }
   ```
3. **`runSelection`** — guard, validate, begin, **yield a frame**, then block:
   ```ts
   async function runSelection(mode: "preview" | "import") {
     if (workingRef.current !== null) return; // D-9: immune to an OS-buffered second click
     const projectName = resolvedProjectName();
     const pick = buildPickSpec(checked);
     if (handle === null || projectName === null || pick === undefined) return;

     const request = { handle, projectName, pick, ...query, ...from };
     beginWork(mode);
     await waitForNextPaint(); // D-2 = O1: present the busy frame before main blocks
     try {
       const result =
         mode === "preview" ? await bridge.import.preview(request) : await bridge.import.run(request);
       if (!result.ok) {
         setError(errorCopy(result.error.code));
         return;
       }
       setResultOutcome(result.value);
       setResultMode(mode);
     } catch {
       setError(errorCopy(REJECTED_CALL_CODE));
     } finally {
       endWork();
     }
   }
   ```
   `request` is built **before** `beginWork` so the run uses exactly the selection that was on
   screen when the button was pressed.
4. **`loadListing`** — same shape with `beginWork("reading")`, the `UNSUPPORTED_SOURCE` →
   `setStage("formatOverride")` branch preserved verbatim inside the `try`, and `endWork()` in the
   `finally`.
5. **`handleChooseFile`** — guard, `try { … } catch { setError(errorCopy(REJECTED_CALL_CODE)); }`;
   a `null` from the dialog is still a silent cancel (the user pressed Cancel); the D-7 reset for a
   newly chosen file happens right after a **non-null** choice, before `loadListing`.
6. **The rejection code**, module-level with a comment:
   ```ts
   /** Not a `DomainError.code` from `src/` — the renderer's own label for "the IPC call itself
    *  rejected" (a schema-validation throw in `register-handlers.ts` never becomes a Result).
    *  Rendered through `errors.generic`; the caught error is never read, so no raw driver or zod
    *  string can reach the screen (§7). */
   const REJECTED_CALL_CODE = "UNEXPECTED";
   ```
7. **The busy message**, one readable function:
   ```ts
   function busyMessage(): string | null {
     if (working === null) return null;
     if (working === "reading") return t("import.detectingFormat");
     const counts = countSelection(listing ?? [], checked);
     return t(working === "preview" ? "import.previewing" : "import.importing", counts);
   }
   ```
8. **The scroll effect** (D-4's sub-decision):
   ```ts
   // biome-ignore lint/correctness/useExhaustiveDependencies: statusRef is a stable ref, not reactive state
   useEffect(() => {
     if (working !== null) return;
     if (resultOutcome === null && error === null) return;
     statusRef.current?.scrollIntoView?.({ block: "nearest" }); // optional call: jsdom has no scrollIntoView
   }, [working, resultOutcome, error]);
   ```
9. **JSX restructure** — the only structural change, matching §3's mockup:
   - Delete line 144's top-of-screen `<p className="error">`.
   - The chooser button gains `disabled={working !== null}`; so do the three `format-override`
     buttons and each conversation-row checkbox (P-D7).
   - `.import-listing` keeps: display name, count, filter, sort, list, project picker. The two
     busy `<p>`s (222–223), both action buttons and the result block **leave** it.
   - After the listing branch, unconditionally:
     ```tsx
     <div className="import-status" aria-live="polite" aria-busy={working !== null} ref={statusRef}>
       {busy !== null && (
         <>
           <p className="import-busy">{busy}</p>
           <p className="explainer">{t("import.mayStopResponding")}</p>
         </>
       )}
       {error !== null && <p className="error">{error}</p>}
       {resultOutcome !== null && resultMode !== null && (
         <div className="import-result">{/* unchanged: summary, failures, packs notice */}</div>
       )}
     </div>
     ```
   - Then, for the listed stage only, `<div className="actions">` holding the two buttons, keeping
     `disabled={!canSubmit || working !== null}` on both and giving the **pressed** one a busy
     label (D-5):
     ```tsx
     {working === "import" ? t("import.importingShort") : t("import.importButton")}
     ```
     (and the mirror for Preview). Those two short keys are what **P-D3 recommends**: D-3's
     sentence with counts is far too long for a button, and it is already on screen one line above,
     in the status region. If Oscar declines the extra keys, the buttons keep their static labels,
     only the status line changes, and one acceptance bullet — "the pressed button's label reflects
     the state" — is knowingly unmet.
10. **Delete `import.busyRetrying`** from `en.ts` and `es.ts` (its last render is now gone), and add
    to `import-copy.test.ts`: `expect(Object.hasOwn(en.import, "busyRetrying")).toBe(false)` for
    both catalogs. `catalogs.test.ts` parity keeps passing because both sides lose it.

**Stays green.** `TranslationKey` no longer offers `import.busyRetrying`, and no call site remains.

**Est. production lines:** ~85 net in `import.tsx` (~60 added, ~25 rewritten), −2 catalog lines.
Tests ~200 (the DOM file, ~40 of it fake-bridge scaffolding).

---

## Slice 4 — the import screen's first CSS

**Goal.** D-6's bounded list and D-5's visual weight, using existing tokens only, appended as a new
`/* import.tsx */` section. `screens.css` is ordered one section per screen (not alphabetically);
put this one after `/* connect-tools.tsx */` so the screen sections stay together.

**File touched:** `desktop/src/renderer/styles/screens.css`

```css
/* import.tsx — the screen's first rules (IMPORT-FEEDBACK). D-6: an unbounded
   conversation list pushed the project picker, the status region and both
   buttons thousands of pixels down on a 640-conversation export. Existing
   tokens only; no asset, no url() — no-network-surface.test.ts scans this file. */
.import .conversation-list {
  list-style: none;
  margin: 8px 0 16px;
  padding: 4px;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}
.import .conversation-row label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 4px 6px;
}
.import .conversation-title {
  flex: 1;
  overflow-wrap: anywhere;
}
.import .conversation-date,
.import .conversation-chunks {
  flex-shrink: 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
/* One region for busy, result and error (D-4), immediately above the actions —
   where the user's eyes and cursor already are. Hidden until it has something
   to say, so an always-mounted aria-live region costs no empty box. */
.import .import-status {
  margin: 16px 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  padding: 12px 16px;
}
.import .import-status:empty {
  display: none;
}
.import .import-status p {
  margin: 0;
}
.import .import-status p + p,
.import .import-status .import-result {
  margin-top: 8px;
}
.import .import-busy {
  font-weight: 600;
}
.import .import-failures {
  margin: 8px 0 0;
  padding-left: 20px;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
```

The two action buttons reuse `base.css`'s existing `.actions` row (flex, `gap: 8px`,
`margin-top: 16px`) — no new rule — and `button:disabled { opacity: .5 }` already gives D-5's
disabled treatment.

**Tests.** None automated (CSS). Covered by the manual bilingual check below and by the DOM test's
class-name assertions (`.import-status`, `.conversation-list`), which at least keep the selectors
and the markup from drifting apart.

**Est. production lines:** ~45 CSS.

---

## Manual measurement — D-2's bet (between Slice 4 and Slice 5)

`refined.md` §10 says this is the one thing that decides whether the advance landed, and §6's first
acceptance bullet requires it. Do it on Oscar's Windows machine, with a **packaged** build (or at
minimum `npm run dev`, noting which), and a **real large export**:

1. Note the export size, conversation count, and the wall-clock duration of each phase.
2. Choosing the file: does **"Leyendo el archivo…"** appear before the freeze? Does the title bar
   say *"(No responde)"*? Can the window be dragged?
3. Clicking **Importar**: does the status line and the disabled-button state appear **before** the
   freeze, or does the pre-click frame persist?
4. Click **Importar** a second time during the freeze; confirm that when the window unblocks only
   **one** import ran (one summary, one lineage bump — the project's item count is the check).
5. After it finishes: is the summary visible without scrolling?

Record the answers (this is also D-1's observation) in `advances/IMPORT-FEEDBACK/review.md`.
**If step 3 shows the pre-click frame persisting, O1 has not worked** and the advance must say so
rather than ship a fix that only works in theory — escalating to D-2 = O2 is a separate advance with
its own security review (§7's last bullet).

---

## Slice 5 — main-process symmetry (D-9 Option B)

**Goal.** `import:list` and `import:preview` can no longer throw across IPC; every throw becomes the
same `STORAGE_ERROR` code `import:run` already produces. Removes the asymmetry that made V5
reachable in the first place.

**File touched:** `desktop/src/main/ipc/handlers/import-handlers.ts`

One small helper beside the existing `runImportWithBusyRetry`, and both handlers wrapped:

```ts
/**
 * D-9 Option B: `import:run` has always converted a throw from the synchronous
 * import chain into a typed code; `import:list`/`import:preview` did not, so a
 * throw crossed IPC as a rejection and stranded the renderer. Same rule as
 * everywhere else here: a localized code, never a raw driver or parser string
 * (§9 item 75). The caught error is deliberately not read.
 */
function orStorageError<T>(run: () => Result<T, DomainError>): Result<T, DomainError> {
  try {
    return run();
  } catch {
    return err(new DomainError("STORAGE_ERROR", "The vault is busy right now. Try again in a moment."));
  }
}
```

Both handlers stay **synchronous** (their existing tests call them without `await`).

**Tests** — `desktop/src/main/ipc/handlers/import-handlers.test.ts`, two added cases in the idiom of
the existing throw tests (fake container whose `execute` throws):
- `import:list` returns `{ ok: false, error: { code: "STORAGE_ERROR" } }` instead of throwing, and
  the returned error object carries **only** `code` — no `message`.
- `import:preview` likewise.

**What this does *not* cover, and must be said in the review:** `register-handlers.ts` throws on
**schema validation** *before* the handler runs, so a malformed request still rejects. That path is
covered only by the renderer's `try/catch` (Slice 3) — which is why D-9 = A + B, not B alone.

**Est. production lines:** ~14. Tests ~35.

---

## Slice 6 — docs (same-commit rule)

**File touched:** `docs/gui.md`, §"Importing your chat history" (currently lines 173–181), one
paragraph appended after the existing one, in the page's established second-person voice:

> While it works, the screen says so. Choosing a file shows **Reading the file…**; pressing
> **Preview** or **Import** shows what it is doing and with how many conversations, disables both
> buttons until it finishes, and puts the result — the number of items imported, any conversations
> that failed, or the reason it couldn't — in that same spot, just above the buttons you pressed.
> One honest warning: a large export is read, parsed and written in one go, so while an import runs
> the window may stop responding and can't be moved. It hasn't crashed; let it finish.

The last sentence exists **because** D-2 = O1. If the import ever moves off the main thread, delete
it together with `import.mayStopResponding` (D-10).

**Est. production lines:** 0 TS, ~7 doc lines.

---

## Test plan by layer, tied to `refined.md` §6

| Acceptance criterion (§6) | Proven by | Layer |
|---|---|---|
| Busy state visible **before** main blocks, measured on Windows | **Manual measurement** above, recorded in `review.md` | manual (no test can do this) |
| Both buttons disabled for the whole run; pressed button reflects state | `import.dom.test.tsx` case 1 (`toBeDisabled` on both, plus the short label, before resolution) | renderer DOM |
| Choosing a file shows the reading state and disables the chooser | `import.dom.test.tsx` case 6 | renderer DOM |
| Progress copy never claims another save is in progress | `import.dom.test.tsx` case 2 + `import-copy.test.ts` (no "otro guardado"/"another save" in either catalog) | DOM + i18n data |
| `busyRetrying` removed from both catalogs; parity passes | `import-copy.test.ts` (`Object.hasOwn` false) + untouched `catalogs.test.ts` | i18n data |
| Result and error live in the same region as the buttons; region is `aria-live` | `import.dom.test.tsx` case 7 (no `.screen.import > p.error`; region precedes the actions; `aria-live="polite"`) | renderer DOM |
| Starting a new run clears the previous summary | `import.dom.test.tsx` case 3 | renderer DOM |
| A rejected `bridge.import.*` leaves the screen usable | `import.dom.test.tsx` case 4; plus `import-handlers.test.ts`'s two new cases for the main side | DOM + main handler |
| A second click never starts a second run | `import.dom.test.tsx` case 5 (`run` called once) | renderer DOM |
| Result block still shows failures + packs notice | `import.dom.test.tsx` case 8 | renderer DOM |
| Counts shown while importing are the selection's own numbers | `import-selection.test.ts` (`countSelection`) + DOM case 1's text | pure + DOM |
| Bounded list keeps picker/status/buttons reachable, both languages | **Manual bilingual check** (below) — CSS layout is not machine-checked | manual |
| A test that **fails against today's `import.tsx`** | Step 3.1's mandatory red-first run, cases 1/3/4/5/6/7 | renderer DOM |
| Typecheck / lint / test green in root **and** `desktop/` | Run at the end of every slice | gates |
| Diff touches no `src/**`, no `desktop/src/shared/ipc/**`, no preload, no `package.json` | `git diff --name-only` against the file list in "Repo structure after execution" | review |
| `docs/gui.md` describes the three moments | Slice 6 | docs |
| No import semantics changed | No `src/**` file in the diff; `import-handlers.test.ts`'s lineage / pack / no-temp-file tests pass untouched | existing suites |

**Manual bilingual check (required, not optional).** `cd desktop && npm run dev`, unlock, open
Import, choose an export with a few hundred conversations: confirm the list scrolls in place and the
picker, status region and both buttons sit together on one screen; switch to `es` in Settings (the
longer strings) and look again. Then force a failure (choose a non-export file) and confirm the
error appears in the status region, not off-screen at the top.

---

## Security-sensitive surfaces — the order that keeps them closed

Carried in intent from `refined.md` §7. Under D-2 = O1 this is a presentation change, and the point
of this list is that the implementer can confirm that *literally*:

1. **Before touching anything:** confirm no new bridge surface is needed. It is not — `ValijaBridge`
   is a closed enumerated interface and every call this screen makes (`import.list`,
   `import.preview`, `import.run`, `dialog.chooseImportFile`, `content.projects`) already exists.
   **If a step seems to need a new channel, a preload change, or a zod schema edit, stop:** the
   design drifted, and §7's last bullet (D-2 = O2) applies instead.
2. **No filesystem path may originate in, or be rendered by, the renderer.** The screen keeps
   showing `displayName` (the dialog's own file name) and passing the opaque `handle`; the busy copy
   carries **counts only** — never the handle, never a resolved path. Grep the diff for
   `resolveHandle`, `filePath`, `path` before committing: none may appear in `import.tsx`.
3. **The rejection path must never read the caught error.** `catch { setError(errorCopy(REJECTED_CALL_CODE)); }`
   — no `catch (e)`, no `String(e)`, no `e.message`. A zod validation message can contain the whole
   request payload and a driver error can contain a path. Same rule in Slice 5's `orStorageError`:
   `catch {` with no binding.
4. **No `console.*` anywhere in the diff.** The import screen logs nothing today; the way to keep it
   that way is to add no sink. (`no-network-surface.test.ts` does not catch `console`; the reviewer
   must.)
5. **Slice 5 keeps the code-only wire shape.** `toIpcResult` already strips `DomainError.message`;
   `orStorageError` returns a `DomainError` whose message is a fixed English constant that never
   crosses IPC. The new tests assert the returned error object has only `code`.
6. **No vault session, key material, or keychain access moves anywhere.** Nothing here opens a
   session, reads a key, or touches the OS keychain — the renderer still sees only counts and
   error codes.
7. **Imported items stay excluded from context packs.** The `import.excludedFromPacksNotice` line
   moves into the status region but is otherwise untouched (`SPEC.md` §10a).
8. **MCP surface unchanged** — 5 tools + 2 prompts, no new argument, no new transport. Nothing in
   the diff is under `src/delivery/mcp/`.
9. **No network, no telemetry, no URL, no remote asset.** D-5 = A means there is no spinner at all,
   so no animation asset can sneak in; the new CSS carries no `url()`. `no-network-surface.test.ts`
   scans the new `.ts`, `.tsx` and `.css` files automatically — and forbids `setInterval`, which the
   paint gate deliberately does not use.
10. **After the last slice:** run `git diff --name-only` and confirm the list matches the tree below
    exactly. Any hit under `src/`, `desktop/src/preload/`, `desktop/src/shared/ipc/`, or either
    `package.json` means scope crept and the change must be dropped, not justified.

---

## Architecture, naming and placement review

- **Layers.** Everything is renderer presentation plus one main-process **IPC adapter** edit. No
  domain, application, port, use case or value object is created or changed. Per `refined.md` §8, a
  new file under any `domain/`/`application/`/`infra/` folder would itself be the signal that scope
  crept — and there is none in this plan. CLAUDE.md's "no bare files at a layer's root" rule
  therefore does not bite: `desktop/src/renderer/` is a presentation tree already partitioned by
  kind (`screens/`, `components/`, `state/`, `content/`, `styles/`, `testing/`), and every new file
  lands in an existing folder of the right kind.
- **`renderer/state/next-paint.ts`.** Placed beside `focus-refresh.ts`, the existing precedent for a
  browser-interaction helper in `state/` (it wires `window` focus events; it is no more "state" than
  this is). Alternative placements are P-D5. Export named verb-first — `waitForNextPaint` — matching
  `wireFocusRefresh`, `buildPickSpec`, `sortListingByDate`, `classifyUnlockResult`.
- **`countSelection` in `import-selection.ts`.** Not a new file: the module is already "pure facts
  about the current import selection", and this is one more. Its return fields
  (`conversationCount`, `itemCount`) are named for the catalog placeholders they feed, so the call
  site is `t("import.importing", countSelection(listing, checked))` — one line that reads as a
  sentence.
- **No new component.** `renderer/components/` gains nothing: the status region has exactly one
  instance, so extracting it would add indirection without a second consumer (§8: "extract only what
  this screen needs"). If a future advance retrofits the other eight screens, *that* is when a
  `components/status-region.tsx` earns its place.
- **`ImportScreen` keeps its `{ bridge }`-only interface** (D-11 A). No new prop, no router import,
  no `app.tsx` change.
- **Class names.** `.import-status`, `.import-busy`, `.import-result`, `.import-failures`,
  `.conversation-list` — kebab-case, scoped under `.import`, and all but `.import-status` /
  `.import-busy` already exist in the JSX. `.actions` is reused from `base.css` rather than
  reinvented.
- **Ubiquitous language, unchanged:** *import*, *listing*, *conversation*, *selection*, *preview*,
  *run*, *outcome*, *handle*. The advance introduces **no new domain term**, correctly — it
  introduces no domain concept. `"reading"` joins `"preview"` / `"import"` as a UI mode name only.
- **Readability.** Each added line reads as one action: "gate a re-entrant run", "clear what the
  last run left", "hand the browser a frame", "announce what is happening". Two five-line helpers
  (`beginWork`/`endWork`), one three-line message selector, one effect. No new class, no file grows
  past ~340 lines.

---

## Assumptions — every one a place this plan could be wrong

- **A1 — the §2 line numbers match HEAD.** Verified 2026-09-04 for `import.tsx` (48, 111, 122,
  144, 222–223, 227/234, 240–265), `en.ts:170,188`, `es.ts:172,190`,
  `import-handlers.ts:85–101,103–118`, `register-handlers.ts:65–71`, `docs/gui.md:173–181`. If the
  implementer finds different content, re-anchor rather than editing by line number.
- **A2 — `feat/desktop-GUI` is still unmerged to `main`.** Taken from CONNECT's plan (verified
  2026-08-29) plus this branch's own subsequent commits. If GUI has since merged, branch from
  `main` instead — the file paths are unchanged either way.
- **A3 — Vitest's jsdom environment provides `requestAnimationFrame`.** If it does not, the paint
  gate's `setTimeout` fallback still resolves, so the DOM test passes either way. That is why the
  fallback exists rather than being defensive noise.
- **A4 — two rAFs plus a task is enough for Chromium to present the frame on Windows.** This is
  D-2's bet, and it is **not** provable by any test — only the manual measurement settles it
  (`refined.md` §10, and the measurement step above).
- **A5 — `t()` with a two-number string is acceptable without plural agreement.** "1 elementos" is
  possible in Spanish for a one-item selection. The existing `import.importSummary` has exactly the
  same property today, so this is consistent, not new — but see P-D10.
- **A6 — no screenshot, fixture or doc image depends on the import screen's markup.** Verified:
  `docs/images/` does not exist and no test reads `import.tsx`.
- **A7 — Biome formats the proposed snippets as written** (2-space indent, double quotes, 100
  columns; the same `biome.json` formats the CSS). If `biome check` reformats them, take Biome's
  output.
- **A8 — `.import-status:empty` reliably hides the region.** React renders `false`/`null` as no
  node at all, so the div genuinely has zero children (and zero text nodes) when idle. If a
  whitespace text node ever creeps in, the rule silently stops matching and an empty bordered box
  appears — visible immediately in the manual check.
- **A9 — disabling the row checkboxes while working (P-D7) is not scope creep.** It keeps the counts
  in the busy line honest, since the run uses the selection captured at click time.
- **A10 — `import.detectingFormat`'s existing wording ("Leyendo el archivo…" / "Reading the file…")
  is right for the listing step** and needs no rewrite, per D-8.
- **A11 — the DOM test can drive the screen to the "listed" stage** through the fake bridge
  (`dialog.chooseImportFile` → `import.list`) without any real file. Verified against the current
  control flow; if `handleChooseFile` ever needed a real dialog, the test would need a different
  entry point.

---

## Decisions to confirm at Gate P

`refined.md`'s D-1…D-13 are closed and are **not** re-litigated. Below is everything this plan had
to decide on its own. P-D1, P-D2, P-D3 and P-D4 are the ones that matter.

- **P-D1 — Branch.** *Recommended:* `feat/import-feedback`, cut from `feat/desktop-GUI`.
  *Trade-off:* it carries whatever unmerged GUI/CONNECT work is on that branch into this advance's
  diff, but it is the only base where the files exist. *Alternative (IMPORT-ENTRY's precedent):*
  commit directly onto `feat/desktop-GUI` if this session's environment is still scoped to push only
  that branch. **The orchestrator must state which, before Slice 1.**

- **P-D2 — Exact strings for the new keys.** D-3 explicitly left wording to Oscar. *Recommended:*
  the strings in Slice 1. *Trade-off:* the Spanish `previewing` string is long ("Preparando la vista
  previa de …") and will wrap on a narrow window; a shorter "Preparando la vista previa…" (no
  counts) fits better but drops D-3 Option C's numbers for the preview case. *Alternative:* counts
  on `importing` only, plain copy for `previewing`.

- **P-D3 — Two extra keys for the busy button labels.** D-5 says the pressed button's label switches
  to "Importando…", but D-3's `import.importing` is a full sentence with counts — far too long for a
  button. *Recommended:* **add `import.importingShort` / `import.previewingShort`** ("Importando…" /
  "Preparando…"), used *only* as button labels, keeping the sentence in the status line.
  *Trade-off:* two more parity-checked keys (cheap) versus a button whose label is a paragraph.
  *Alternative A:* leave the button labels static and let the status region carry everything —
  smaller diff, but one acceptance bullet goes knowingly unmet. *Alternative B:* reuse
  `common.loading` as the busy label — no new key, least specific copy.

- **P-D4 — Re-entrancy guard: `useRef` or the literal `if (working !== null) return;`.**
  *Recommended:* **a `useRef` set synchronously in `beginWork`, with `working` state kept for
  rendering.** D-9's literal wording is a state read, and a state read **cannot** stop two clicks
  delivered in the same task — exactly the OS-buffered case the spec is trying to defeat.
  *Trade-off:* two values expressing one fact; mitigated by their only ever being written together,
  inside `beginWork`/`endWork`. *Alternative:* state-only, matching D-9's words literally and
  failing acceptance case 5 under batched clicks.

- **P-D5 — Where `waitForNextPaint` lives, and its exact shape.** *Recommended:*
  `desktop/src/renderer/state/next-paint.ts`, double-rAF + `setTimeout(0)`. *Trade-off on
  placement:* it is not "state"; but `focus-refresh.ts` sets the precedent that `state/` holds the
  renderer's small browser-interaction helpers, and a new `renderer/timing/` folder for one 14-line
  file is heavier than the rule requires. *Alternative:* a new `renderer/timing/` folder.
  *Trade-off on shape:* two frames cost up to ~32 ms of added latency before the work starts; a
  single rAF + task is ~16 ms but commits the frame less reliably. If the manual measurement shows
  the frame still missing, the next thing to try is a third frame, not a different folder.

- **P-D6 — The code used for a rejected call.** *Recommended:* the renderer-local
  `REJECTED_CALL_CODE = "UNEXPECTED"`, rendered through `errors.generic` → "Algo salió mal
  (UNEXPECTED)." *Trade-off:* the user sees an English token in parentheses; but the sentence is
  localized and the alternative invents an error code in `src/`, which §4 forbids. *Alternatives:*
  reuse `STORAGE_ERROR` (nicer sentence, but a lie when the cause was schema validation), or add an
  `errors.UNEXPECTED` key pair to both catalogs (~2 lines, nicer copy — take this if Oscar dislikes
  the visible token).

- **P-D7 — Disable the conversation checkboxes while a run is in flight.** *Recommended:* **yes**,
  one `disabled={working !== null}` attribute. It keeps the counts in the busy line honest (the run
  uses the selection captured at click time). *Trade-off:* one more attribute in the row markup.
  *Alternative:* leave them editable and accept that the busy line's numbers can drift from what is
  actually being imported.

- **P-D8 — `max-height: 320px` for the conversation list.** *Recommended:* 320px (~8 rows), which
  keeps the picker, status region and buttons on one screen at the default window size.
  *Trade-off:* on a tall window it wastes space; `max-height: 40vh` adapts but makes the layout
  depend on window height. Confirm the number, or take `40vh`.

- **P-D9 — A `CHANGELOG.md` entry.** *Recommended:* **no**, matching IMPORT-ENTRY's P-D2: the GUI
  has never shipped a release, so this repairs unreleased behaviour. *Trade-off:* a changelog reader
  will not see the repair. *Alternative:* one line under `### Fixed`, making the diff one file wider.

- **P-D10 — Number grouping in the progress copy.** §3's mockup shows "3 214 elementos", but
  `interpolate` uses `String(value)`, so it renders "3214" — exactly as today's
  `import.importSummary` already does. *Recommended:* **accept 3214**, for consistency with the
  summary the user sees one second later. *Trade-off:* the mockup's typography is not matched.
  *Alternative:* pass `new Intl.NumberFormat(language).format(n)` into the params for both the
  progress *and* the summary copy (~4 lines, and it changes an existing rendered string).

---

## Repo structure after execution

Twelve source paths change (six production, six test), plus `docs/gui.md`. Everything else is shown
only as an unchanged anchor.

```
valija/
├── advances/IMPORT-FEEDBACK/
│   ├── refined.md                                   (unchanged — Gate R resolved 2026-09-04)
│   ├── plan.md                                      (this file; gains Oscar's `Approved:` line)
│   └── review.md                                    (written later by change-reviewer; MUST record
│                                                     the D-1/D-2 Windows measurement)
│
├── docs/
│   └── gui.md                                       CHANGED (Slice 6: §"Importing your chat
│                                                     history" gains one paragraph on the three
│                                                     moments + the freeze warning — D-13)
│
├── src/                                             UNCHANGED — not one file (§4: the write path
│                                                     is correct; only its visibility was broken)
│
├── desktop/
│   ├── package.json · vitest.config.ts ·
│   │   electron.vite.config.ts · tsconfig*.json     UNCHANGED (no dependency, script or config)
│   └── src/
│       ├── preload/** · shared/ipc/**               UNCHANGED (no channel, no schema, no preload)
│       ├── main/ipc/handlers/
│       │   ├── import-handlers.ts                   CHANGED (Slice 5: `orStorageError` wraps
│       │   │                                         import:list and import:preview — D-9 B; both
│       │   │                                         stay synchronous)
│       │   └── import-handlers.test.ts              CHANGED (Slice 5: two throw→STORAGE_ERROR cases)
│       ├── shared/i18n/catalogs/
│       │   ├── en.ts                                CHANGED (Slices 1+3: +importing, +previewing,
│       │   │                                         +importingShort, +previewingShort,
│       │   │                                         +mayStopResponding; −busyRetrying)
│       │   ├── es.ts                                CHANGED (the same five keys, −busyRetrying)
│       │   ├── import-copy.test.ts                  NEW (Slices 1+3: placeholder parity for the new
│       │   │                                         keys, no "another save"/"otro guardado"
│       │   │                                         anywhere, busyRetrying gone from both)
│       │   ├── catalogs.test.ts                     UNCHANGED (its parity walk must keep passing)
│       │   └── connect-copy.test.ts                 UNCHANGED
│       └── renderer/
│           ├── app.tsx                              UNCHANGED (ImportScreen keeps `{ bridge }` —
│           │                                         D-11 A: no navigation, no new prop)
│           ├── components/**                        UNCHANGED (no status component extracted —
│           │                                         one consumer does not earn one)
│           ├── screens/
│           │   ├── import.tsx                       CHANGED (Slice 3: "reading" mode, ref-backed
│           │   │                                     re-entrancy guard, beginWork/endWork,
│           │   │                                     waitForNextPaint before each blocking call,
│           │   │                                     try/catch/finally on every awaited bridge
│           │   │                                     call, single aria-live status region above a
│           │   │                                     new `.actions` row, top-of-screen error `<p>`
│           │   │                                     removed, result block moved into the region)
│           │   ├── __dom-tests__/
│           │   │   ├── import.dom.test.tsx          NEW (Slice 3, written red first: busy state,
│           │   │   │                                 disabled buttons, stale-result clearing,
│           │   │   │                                 rejection recovery, single-run guard, reading
│           │   │   │                                 state, aria-live placement, unchanged result
│           │   │   │                                 block)
│           │   │   └── {recovery-kit,relocate-vault,project}.dom.test.tsx   UNCHANGED
│           │   └── (all other screens + entry-point tests)                  UNCHANGED
│           ├── state/
│           │   ├── next-paint.ts                    NEW (Slice 2: waitForNextPaint — D-2 = O1's
│           │   │                                     entire mechanism, no setInterval)
│           │   ├── next-paint.test.ts               NEW (Slice 2: yields at least one task,
│           │   │                                     resolves with and without rAF)
│           │   ├── import-selection.ts              CHANGED (Slice 2: +countSelection,
│           │   │                                     +SelectionCounts — D-3 Option C's numbers)
│           │   └── import-selection.test.ts         CHANGED (Slice 2: countSelection cases)
│           └── styles/
│               ├── screens.css                      CHANGED (Slice 4: a new `/* import.tsx */`
│               │                                     section — bounded scrolling conversation list
│               │                                     [D-6], bordered status region [D-5], failures
│               │                                     list; existing tokens only)
│               └── base.css                         UNCHANGED (`.actions` and `button:disabled`
│                                                     reused as-is)
│
├── CHANGELOG.md                                     UNCHANGED by default (see P-D9)
└── package.json · biome.json · CLAUDE.md            UNCHANGED
```

**File-count check for the reviewer** — `git diff --name-only` must print exactly:

```
desktop/src/main/ipc/handlers/import-handlers.test.ts
desktop/src/main/ipc/handlers/import-handlers.ts
desktop/src/renderer/screens/__dom-tests__/import.dom.test.tsx
desktop/src/renderer/screens/import.tsx
desktop/src/renderer/state/import-selection.test.ts
desktop/src/renderer/state/import-selection.ts
desktop/src/renderer/state/next-paint.test.ts
desktop/src/renderer/state/next-paint.ts
desktop/src/renderer/styles/screens.css
desktop/src/shared/i18n/catalogs/en.ts
desktop/src/shared/i18n/catalogs/es.ts
desktop/src/shared/i18n/catalogs/import-copy.test.ts
docs/gui.md
```

---

## Estimated line count and risks

### Lines

| Slice | Production (TS/CSS) | Tests | Docs |
|---|---|---|---|
| 1 — copy | ~14 | ~40 | — |
| 2 — pure units | ~26 | ~45 | — |
| 3 — `import.tsx` + catalog deletion | ~85 net (−2 catalog) | ~200 | — |
| 4 — CSS | ~45 | — | — |
| 5 — main handlers | ~14 | ~35 | — |
| 6 — docs | — | — | ~7 |
| **Total** | **≈185 production lines** | **≈320** | **≈7** |

(~140 TS + ~45 CSS. `import.tsx` grows from 270 to roughly 340 lines.)

### Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **O1 does not work: the busy frame still never reaches the screen** (`refined.md` §10). No test can see this; the advance would be correct in source and blank in practice | **Highest** | The mandatory manual measurement between Slices 4 and 5, recorded in `review.md`. If it fails, say so and escalate to D-2 = O2 as its own advance — do **not** ship silently. Every other fix (V1–V7) is independently worth having |
| The `useRef` guard and the `working` state drift apart, letting a second run through or leaving the screen permanently gated | Medium | Both are written only inside `beginWork`/`endWork`; `endWork` is in a `finally`, so no path can leave the ref set. DOM cases 4 and 5 cover both directions |
| A `scrollIntoView` call throws in jsdom and turns every result assertion red | Medium | The optional call `?.scrollIntoView?.(…)`, named explicitly in the ground-truth notes. If a reviewer "tidies" the optional chain away, the DOM suite fails immediately — an acceptable tripwire |
| The DOM test asserts synchronously after a click and goes flaky because of the paint yield | Medium | Every busy assertion uses `findBy*`/`waitFor`; the rule is stated in the test file's docblock |
| Deleting `import.busyRetrying` out of sequence breaks `typecheck` (`TranslationKey` derives from `en`) | Low | The deletion is bound to Slice 3, the same commit that removes its last render |
| The new `.actions` wrapper changes the visual position of the buttons on a narrow window in Spanish | Low | The required bilingual manual check; the remedy is `flex-wrap: wrap` on `.import .actions`, to be reported rather than smuggled in |
| Scope creep into caching the parsed export, a progress bar, or a Cancel button | Low | `refined.md` §4's deferral table and the exact file list above; the reviewer counts files |
| Slice 5's `try/catch` accidentally makes a handler `async` and breaks three existing synchronous handler tests | Low | Named in the ground-truth notes; `import-handlers.test.ts:116,143,160` call them without `await` |

---

**Gate P.** Implementation must not begin until Oscar has reviewed this plan and recorded approval
as an `Approved: Oscar <date>` line at the top of this file. The branch (P-D1) is created only after
that line exists.
