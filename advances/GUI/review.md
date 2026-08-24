# GUI · Slice 10 — Diagnostics (D-T's split) and the Copy report — Review

Verdict: PASS

**Branch:** `claude/slice-10-diagnostics-report-smwqew` · **Base:** `220acec` (Slice 9)
**Reviewed:** the working tree as of 2026-08-24, read independently of any summary.
**Third pass.** The two blocking defects of the second pass — a tool-Node row whose status word
was hardcoded to `t("diagnostics.ok")` regardless of the probe, and the total absence of a test
over the screen's row assembly — are both fixed, and fixed at the level that makes the class of
bug hard to repeat: the derivations left the component entirely and are now a pure, directly
tested module.

---

## 1. Acceptance criteria (`refined.md` §9, "Diagnostics and sync status", lines 1706–1727)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Diagnostics and the Sync & safety panel are **two screens split by audience** | **Met** | `desktop/src/renderer/screens/diagnostics.tsx` (new, verbatim rows + per-row explanation) is distinct from `screens/sync.tsx` (plain-language, Slice 7); `app.tsx:203` mounts exactly one diagnostics screen, reached from `sync.tsx:131-133` |
| 2 | The screen runs the checks `doctor.ts` already defines, **re-deriving none** | **Met** | `main/ipc/handlers/diagnostics-handlers.ts:24` calls `runDiagnostics` from `src/delivery/diagnostics.js`; nothing in `desktop/` recomputes a verdict. `diagnostics-handlers.test.ts:85-97` pins the full name list; `src/delivery/diagnostics.test.ts:83-90` pins names+order against `CLIENTS` |
| 3 | Fatal failures distinguished from warnings **the way the CLI's exit code does** | **Met** | `state/diagnostic-rows.ts:54-57` (`ok` → OK, `!ok && fatal` → Problem, else Warning) mirrors `doctor.ts:10`'s `!check.ok && check.fatal`; tested `diagnostic-rows.test.ts:50-65` |
| 4 | The screen **distinguishes the app's Node runtime from the system Node the AI tools use** | **Met** | `diagnostic-rows.ts:111-123` emits `appNodeRow` from the `node` check and a separate `tool-node` row from the `NodeProbe` result; `diagnostic-rows.test.ts:67-80` asserts order and that the two names differ. The C1 regression is directly guarded at `:16-43` — a failing probe's row must **not** carry the "ok" word |
| 5 | For each connected client, the screen shows **which vault folder that client's entry points at**, without changing any row `valija doctor` prints | **Met** | `diagnostic-rows.ts:67-78` renders the `tools:status` path as a row `extra`; `doctor`'s own rows are untouched (`src/delivery/diagnostics.ts:158-174` is a byte-for-byte lift). Tests: real path `:82-96`, default location `:98-110`, nothing for a disconnected client `:112-122`. See W3 for the wording |
| 6 | Keychain probe **disclosed before running**; diagnostics never runs automatically, silently, or on a timer | **Met** | `diagnostics.tsx:99-100` renders both probe notices above the Run button; `screens/diagnostics.no-auto-run.test.ts` asserts no `useEffect` exists in the file and that both probe-backed calls sit inside `handleRunChecks`. `diagnostics-handlers.ts:13-20` documents the same at the handler. (A DOM test is not available here — P-D5, `plan.md:1023`, confines jsdom to two named screens — and the source-scan form matches `no-network-surface.test.ts` / `import-no-reimplementation.test.ts` precedent) |
| 7 | The **Copy report** payload is **English in both UI languages** | **Met** | `main/application/services/diagnostics-report.ts:26-43` is built in main with no translator in scope — structurally unlocalizable; `diagnostics-report.test.ts:5-27` pins the English lines |
| 8 | The report is the **only place a raw `DomainError.message` may appear** | **Met** | `src/delivery/diagnostics.ts:12-26` adds `errorCode` on the four status-derived checks; `state/diagnostic-detail.ts:15` renders `errorCopy(code)` instead of `detail` whenever it is set (`diagnostic-detail.test.ts:12-27`, `diagnostic-rows.test.ts:135-151`), while `diagnostics-report.ts:40` keeps `detail` verbatim. `src/delivery/diagnostics.test.ts:139-154` proves all four checks carry `STORAGE_ERROR` on a corrupt header |
| 9 | Sync panel criteria (read-only, no write) still hold after this slice | **Met** | `sync.tsx`'s only change is a navigation button (`+5` lines); `sync-panel.no-write.test.ts` still green |

### Plan items (`plan.md:777-799`)

| Item | Verdict | Evidence |
|---|---|---|
| 78 — `src/delivery/diagnostics.ts` with the same shape/names/order; `doctorCommand` shrinks to a print loop, output **byte-identical** | **Met** | `git diff` on `doctor.ts` shows a mechanical lift (−149 lines, no logic edit); `doctor.ts:9` keeps `padEnd(16)` and the `✓`/`✗` glyphs; `src/delivery/cli/doctor.test.ts:27-33` pins the five rendered lines exactly, and `:40-73` pins exit-1-on-fatal-only |
| 79 — one row per check with a **plain-language explanation** keyed off `check.name`; no CLI jargon in row copy | **Met** | `diagnostic-rows.ts:21-40` maps names to `rowName.*` ("Encryption engine", "Database file", "Write history") and to `check*` explanation strings, both catalogs; unknown names get **no** explanation rather than a wrong one (`:42-47`, tested `:124-133`) |
| 80 — probe disclosure + a test that the handler is only reachable from an explicit action | **Met** | See criterion 6 |
| 81 — report built in **main**, English, carrying checks/versions/OS/vault path/schema/generation and **no vault content** | **Met** | `diagnostics-handlers.ts:28-41`; the named test exists: `diagnostics-handlers.golden-fixture.test.ts:74-118` runs the real `run` → `copyReport` sequence against an **unlocked, seeded** golden vault and asserts no project name (word-boundary regex, `:109`) and no item content appears |
| 82 — second entry points, not second implementations | **Met** (narrowed) | One screen, one mount (`app.tsx:203`). Settings' entry point is Slice 11. Dashboard entry — see W4 |
| 83 — `specs/delivery.md` gains the extracted module, same commit | **Met** | `specs/delivery.md` gains a `diagnostics.ts` section, the `doctor` row is amended, and both new test files are named in the Proof line |

---

## 2. Hard gates

| Gate | Result |
|---|---|
| Security surface | **Clean.** No secret or key is logged or written; `grep` finds no `console.*` in any new file. Key derivation, `OsKeychain` and SQLCipher keying are untouched — `checkKeychain` is a byte-identical lift of the existing probe. The report carries no key material (`diagnostics-report.test.ts:44-56` asserts no 64-hex-char run). Two new IPC channels, both in the closed `CHANNELS` tuple, both zod-validated (`schemas.ts:39-48`), both hand-exposed in the preload — no generic escape hatch. **No MCP change of any kind.** `diagnostics:copyReport` writes renderer-supplied text to the clipboard, which is not a widening: `content:copy` already does exactly that |
| Tests for new behaviour, suite green | **Met.** 767 new test lines against 573 new production lines. Root: `typecheck` + `lint` clean, **57 files / 301 tests passing**. `desktop/`: `typecheck` + `lint` clean, **38 files / 586 tests passing**. Both verified by running them, not by report. The previous pass's W1 is fixed: all three tests that reach `runDiagnostics` now `vi.mock` `vault/infra/keyring.js` with an in-memory fake, so `npm test` no longer writes a real `doctor-probe` entry into the developer's OS keychain |
| Advance ritual | **Met.** `refined.md` carries `Approved: Oscar 2026-08-20` and a closed Gate R; `plan.md:3` carries `Approved: Oscar 2026-08-20`; this `review.md` closes the trail. No `package.json` / build-config edit in the diff |
| Conventions, naming, placement | **Met.** `src/delivery/diagnostics.ts` sits beside the existing shared compositions (`context-pack-markdown.ts`, `context-pack-export.ts`) — `delivery/` is a module root with tech-named `cli/` and `mcp/` adapters, not a `domain/application/infra` layer root, so the bare-file rule does not bite. `desktop/src/main/application/services/` is a **new kind-named subfolder** for a new kind of object, exactly as `CLAUDE.md` requires, and exactly where `plan.md:1580` puts it. Handlers in `ipc/handlers/`, screen in `screens/`, pure view logic in `state/` alongside `import-selection.ts` / `unlock-outcome.ts`, whose singular-noun naming `diagnostic-rows.ts` / `diagnostic-detail.ts` follows |

No gate is breached.

---

## 3. Line count

| | Lines |
|---|---|
| New production (`src/delivery/diagnostics.ts` 200 · `diagnostic-rows.ts` 139 · `diagnostics.tsx` 132 · `diagnostics-handlers.ts` 43 · `diagnostics-report.ts` 43 · `diagnostic-detail.ts` 16) | 573 |
| Of which mechanically lifted from `doctor.ts` | ≈150 |
| New tests (8 files) | 767 |
| Tracked diff (wiring, catalogs, specs, `doctor.ts` shrink) | +147 / −169 |
| **Net new production, after the `doctor.ts` deletion** | **≈ 514** |

Proportionate for the slice. `diagnostics.tsx` is 132 lines and reads as one render of a list —
the right size after the extraction.

---

## 4. Issues

### Critical

None.

### Warning (does not hold the merge)

**W1 — verbatim `detail` rows stay English in a Spanish UI, beyond D-V(d)'s three named
exceptions.** `diagnostic-rows.ts:132` passes `check.detail` through untranslated ("native module
loads", "delete — single file at rest", "config not found"). D-V(d) enumerates exactly three
byte-pinned English strings and this is a fourth. It is **not a defect** — D-T Option 3
(`refined.md:1177`, "check rows close to verbatim") is the more specific approved decision and it
governs — but the app currently never *says* why those lines are English, the way it does for the
recovery kit and the manual snippet. One sentence in `docs/gui.md` (Slice 12, plan item 91) closes
it. Carried forward from the first review, unchanged.

**W2 — two rows can put a raw native exception string on screen.**
`src/delivery/diagnostics.ts:46` and `:58` render `(e as Error).message` from
`better-sqlite3-multiple-ciphers` / the keychain binding with **no** `errorCode`, so
`checkRowDetail` passes them through. The letter of D-V(d) and §5.1 holds — these are not
`DomainError.message` — and the behaviour is a byte-identical lift of what `doctor` already
prints, so this slice regressed nothing. Flagging it so it is a deliberate call rather than an
oversight: a native SQLite ABI error is the least plain-language, least translatable text that can
land on a screen built for D-N's audience. If it is ever worth fixing, the cheapest shape is the
one this slice already established — give those two catch blocks an `errorCode`
(`SQLCIPHER_LOAD_FAILED`, `KEYCHAIN_ERROR`) and let `checkRowDetail` localize, leaving the raw
message in the Copy report where it belongs.

**W3 — "Points at the default location (~/.valija)" asserts a location the app has not verified,
and disagrees with the Connect screen about the same client.** `diagnostic-rows.ts:75-77` shows
that line whenever a client's `doctor` row is `ok` (an `mcpServers.valija` entry exists) but
`tools:status` reports no `vaultPath`. That is precisely the state a client connected by
`valija install` is in — the CLI's call site writes no `env` block. Two consequences:

1. The spawned MCP process actually resolves `process.env.VALIJA_HOME ?? ~/.valija` from whatever
   environment the AI client hands it. `refined.md:208-211` argues that is `~/.valija` in
   practice, so the copy is right for the dominant case, but it is stated as verified fact when
   the app has verified nothing. `"No folder recorded — falls back to ~/.valija unless that tool's
   own environment sets one"` says the same thing without over-claiming.
2. The Connect screen (Slice 9) calls that same client **not connected**
   (`tools-handlers.ts:74-79` requires `env.VALIJA_HOME` for `connected: true`), while Diagnostics
   shows it as OK / "valija installed" / points at the default location. A CLI user who opens the
   app sees the two screens contradict each other. The mismatch originates in Slice 9's definition
   of `connected`, **not** in this slice — Slice 10 is correct to show `doctor`'s row unchanged
   (criterion 5 forbids otherwise) — but this is where it becomes visible, and Slice 12's docs or
   a follow-up should reconcile the vocabulary.

**W4 — no dashboard entry point.** `refined.md:311` reaches Diagnostics "from the dashboard, or
from Settings → Vault & sync"; the shipped entry is the Sync panel only. `plan.md:797-798` (item
82) names the Sync panel and Settings and was approved at Gate P, so this is a sanctioned
narrowing, not a deviation this reviewer can charge to the slice. It still needs to land in Slice
11 or become a `refined.md` amendment; it should not quietly disappear. Carried forward.

### Suggestion

**S1 — `IPC_FAILURE` is an invented code that exists in no catalog and in no `src/` error
constructor.** `diagnostics.tsx:73,87` call `errorCopy("IPC_FAILURE")`, which falls through to
`errors.generic` and renders *"Something went wrong (IPC_FAILURE)."* / *"Algo salió mal
(IPC_FAILURE)."* — a machine token shown to a non-technical user. Every other `errorCopy` call
site in the renderer passes a real `DomainError.code`. Either add `IPC_FAILURE` to `errors` in
both catalogs, or use a screen-scoped string (`diagnostics.runFailed`). Note this is also the only
screen that guards against a rejected IPC promise at all — the defensiveness itself is an
improvement over `dashboard.tsx` / `sync.tsx`, which use a bare `.then`.

**S2 — the tool-Node row is the only row with no explanation.** `diagnostic-rows.ts:86` sets
`explanation: ""` while every fixed check gets a one-liner. Its `detail` is plain language, so
nothing is unreadable, but the visual rhythm breaks on exactly the row §3 fact 6 says users
misread most. A `diagnostics.checkToolNode` string ("Whether the Node.js your AI tools launch
Valija with is runnable on this machine") would restore it.

**S3 — fatal and warning are distinguished only by the status word.** `diagnostics.tsx:27`
collapses both to `className="problem"`, and `DiagnosticRow` does not carry `fatal`, so a
stylesheet cannot ever tell them apart without reopening the pure module. Carrying `fatal` on the
row and emitting `ok | warning | fatal` as the class would cost two lines now and save the
edit later. (No stylesheet exists anywhere in `desktop/` yet, so nothing is broken today.)

**S4 — `diagnostic-detail.ts` is a 16-line file holding one 5-line function with exactly one
caller,** `diagnostic-rows.ts:132`. Folding `checkRowDetail` into `diagnostic-rows.ts` removes a
file and a test file without losing coverage — `diagnostic-rows.test.ts:135-151` already asserts
the same behaviour end-to-end. Keep it split only if a second consumer is imminent.

**S5 — `toolsStatus ?? []` at `diagnostics.tsx:94` is unreachable.** All three state setters fire
from the same `Promise.all`, so `checks !== null` implies `toolsStatus !== null`; when `checks` is
null the row list is `[]` anyway. Dead defensiveness reads as if the invariant were uncertain.

**S6 — a failed re-run leaves stale rows on screen next to the error.** `handleRunChecks` clears
`runError` but not `checks`, so a second run that throws shows the previous verdicts under a fresh
error message with nothing marking them as old.

**S7 — "App schema version (latest known)" is honest but is still not the vault's own on-disk
version** (`diagnostics-report.ts:36`). Reading the real one needs the vault unlocked with its
key; the label and its comment already say so, and plan item 81 asks only for "the schema version".
Carried forward, unchanged, for whoever revisits the report's fields.

---

## 5. What was verified by hand rather than taken on trust

- `git diff 220acec -- src/delivery/cli/doctor.ts` read in full: the extraction is mechanical, the
  only semantic addition is `errorCode`, and `doctorCommand` never reads it — CLI stdout is
  byte-identical.
- `npm run typecheck && npm run lint && npm run test` run at the repo root **and** inside
  `desktop/`; all six green, counts as claimed (301 / 586).
- No diff to `package.json`, `package-lock.json`, `desktop/package.json` or
  `desktop/package-lock.json`.
- The C1 regression test genuinely asserts the failing case
  (`diagnostic-rows.test.ts:40`, `expect(missingRow?.status).not.toBe(t("diagnostics.ok"))`), not
  just the happy path.
- The golden-fixture leak test drives the **real** handler pair against an **unlocked** seeded
  vault, so the assertion is over the actual payload, not a hand-built one; the word-boundary
  regex fixes the previously vacuous `.toContain("beta")` check.
- Spanish catalog completeness is enforced by `export const es: Catalog` (`catalogs/es.ts:12`)
  against `Catalog = typeof en`, so every new key added here fails `tsc` if it is missing in
  Spanish. All 20 new keys are present in both.
