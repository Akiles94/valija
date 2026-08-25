Verdict: PASS

# GUI · Slice 12 — Documentation, `docs/SPEC.md` corrections, and the bilingual screenshots — Review (third pass)

**Branch:** `feat/desktop-GUI` · **Commits under review:** `522a952` (slice) + `9349ff4` (first fix)
+ `12e5fb6` (second fix) · **Base:** `200f432` (Slice 11, `Verdict: PASS`) ·
**Plan:** third revision, `Approved: Oscar 2026-08-25`.
**Reviewed:** `git show 12e5fb6` read hunk by hunk, then the *current* `docs/gui.md`, `docs/SPEC.md`
and `specs/desktop.md` re-read end to end and re-derived against the code they describe
(`connect-tools.tsx`, `en.ts`/`es.ts`, `diagnostic-detail.ts`, `diagnostic-rows.ts`,
`diagnostics.tsx`, `diagnostics-report.ts`, `src/delivery/diagnostics.ts`, `channels.ts`,
`dialog-handlers.ts`, `preferences-handlers.ts`, `preferences-write.ts`, `relocation-handlers.ts`,
`vault-location.ts`, `src/delivery/mcp/server.ts`, `electron-builder.yml`) — not against the commit
message. Both suites run by hand.

**Both second-pass defects are closed, verified against code rather than against the commit
message, and neither fix introduced a new one.** The remaining findings are the same carried
warnings and suggestions the first two passes already ruled non-gates (W2–W5, S1–S7), plus one new
quantifier imprecision in the paragraph that was rewritten (W1 below) which is *not* a false claim
about an affordance and defeats no acceptance criterion. Every criterion this slice owns is met;
three criteria remain open **at advance level**, honestly flagged in the docs themselves, and are
Slice 13's gate — see §7. No hard gate is breached.

---

## 1. The two second-pass blockers — verified individually

| # | Second-pass blocker | Now | Evidence (read, not trusted) |
|---|---|---|---|
| **C1** | `docs/gui.md:160` promised "a link explaining how to install Node.js"; the app renders that catalog string as plain text with no `href`, deliberately (§8.3) | **Fixed, and accurate** | `docs/gui.md:160-161` now reads *"…with a short pointer reading \"How to install Node.js\" — plain text, not a clickable link, since this app never opens a URL or makes a network request of any kind."* The quoted string is byte-exact against `desktop/src/shared/i18n/catalogs/en.ts:141` (`nodeMissingDocsLink: "How to install Node.js"`; `es.ts:143` is its Spanish twin). The render site is `connect-tools.tsx:62-64` — a comment (*"Plain text, not a link: the app never opens a URL or makes a network request of any kind (§8.3), so there is no href here"*) sitting above `<p className="docs-hint">{t("connect.nodeMissingDocsLink")}</p>`. Grepped `desktop/src` for `openExternal`, `href=` and `<a `: **zero hits**. The surrounding claims re-verified too: `nodeWarningNeeded` (`connect-tools.tsx:55-56`) never disables Connect, so "Connect still writes the config" holds; the doc's `npx -y valija mcp` matches `installer.ts`'s entry |
| **W1 (old)** | The docs claimed Copy report is *the only* place a raw internal error may appear; `diagnostics.ts`'s sqlcipher and keychain checks set no `errorCode`, so `checkRowDetail` renders their raw message on the screen row too | **Fixed in both places, and consistent between them** | **Diagnostics section**, `docs/gui.md:184-189`: Copy report *"is the one place a raw internal error is **guaranteed** to appear — a check that fails with a recognized error is localized on screen but kept verbatim in the report — and it's also possible… to see a raw native-library error message directly on screen for the encryption-engine or keychain checks specifically."* **Language section**, `:275-281`: same two facts, same direction. Both track the code: `checkRowDetail` (`diagnostic-detail.ts:11-15`) localizes **only** when `errorCode !== undefined`; `src/delivery/diagnostics.ts` sets `errorCode` at `:64, :81, :125, :145` (the four `!status.ok` branches) and **never** in `checkSqlcipher` (`:46`, `detail: (e as Error).message`) or `checkKeychain` (`:58`, same); `buildDiagnosticsReport` (`diagnostics-report.ts:37`) prints `check.detail` verbatim for every row. "Encryption-engine" is the same label `:179` already uses for the sqlcipher row, so the two sections use one vocabulary. **No contradiction between them:** screen = *possible*, for those two checks; report = *guaranteed*, for every raw detail |

Both fixes are also consistent with the acceptance criterion they answer to: `refined.md` §9's
*"the **Copy report** payload … is the only place a raw `DomainError.message` may appear"* is a claim
about `DomainError`, and it still holds in code — a native `Error.message` from a failed
`dlopen`/keyring probe is not a `DomainError`. The docs now describe both facts instead of
generalizing one into the other, which is exactly the gap the second pass named.

---

## 2. Acceptance criteria (`refined.md` §9, the lines this slice owns)

| # | Criterion (§9 line) | Verdict | Evidence |
|---|---|---|---|
| 1 | §1's "one binary surface" sentence corrected (1603) | **Met** | `docs/SPEC.md:12-16` |
| 2 | §2's "GUI … → later" Out line split; no milestone number (1603, 1606) | **Met** | `docs/SPEC.md:33` |
| 3 | §10a's "import is CLI-only" corrected (1603) | **Met** | `docs/SPEC.md:186` — *"import has no MCP surface; it is available from the CLI and the desktop app."* |
| 4 | **D11** gains the preferences sentence **and** the connected-clients MCP-config clause (1603–1606) | **Met** | `docs/SPEC.md:66`, all four clauses. Re-verified against code this pass: *"`VALIJA_HOME` always takes precedence over it"* is literally `vault-location.ts:14` (`env.VALIJA_HOME ?? preferences.vaultPath ?? undefined`), asserted at `vault-location.test.ts:6-13`; the re-pointing clause matches `relocation-handlers.ts:167` (`repointAllClients` after the move succeeds) |
| 5 | GUI docs state `mcp` is the one deliberately absent CLI surface (1610–1611) | **Met** | `docs/gui.md:319-321` |
| 6 | Behind-schema behaviour documented (1635–1637) | **Met** | `docs/gui.md:129-131` |
| 7 | GUI docs explain the CLI is **not** re-pointed (1763–1764) | **Met** | `docs/gui.md:223-232`, `export VALIJA_HOME="…"` verbatim |
| 8 | Settings has no CLI counterpart, and why (1792) | **Met** | `docs/gui.md:250-255` |
| 9 | `docs/` itself stays English (1821) | **Met** | `docs/gui.md:283-284` |
| 10 | Every clipboard affordance named individually (§8.7; §6 In 18) | **Met** | `docs/gui.md:303-306` — five, matching the five call sites |
| 11 | GUI docs state the **Node/npm prerequisite** and that this advance does not remove it (1702–1704, 1857–1858) | **Met** (was C1) | `docs/gui.md:156-161`; prerequisite, non-removal, warn-without-blocking and the plain-text pointer all now match `connect-tools.tsx` |
| 12 | First-launch friction per OS, in the OS's own words (1854–1856) | **Met** | `docs/gui.md:31-57` |
| 13 | …plus the run-from-source alternative, **verified, not assumed** (1854–1856) | **Recipe correct; verification open at advance level, honestly flagged** | `docs/gui.md:59-81`. `npx electron-rebuild -f -w better-sqlite3-multiple-ciphers` matches `spike.md:60-61`; `electron-builder.yml:14` `npmRebuild: true` backs the "packaging already does this" claim. The page no longer claims a verification it doesn't have. **Slice 13's gate — see §7** |
| 14 | What the GUI deliberately does not do **and where those live** (1859–1861) | **Met, with one weak bullet** | `docs/gui.md:310-326` covers all eight named topics (re-pointing the CLI is answered at `:223-232` instead of in the list, with the exact remedy). "Where those live" is answered for curation, forks, destruction, the MCP server, env config and the CLI; the provider-artifact bullet names the right topic but justifies it with an unrelated fact — see **W2** |
| 15 | The environment gap stated honestly, incl. `VALIJA_STATE_HOME` device identity (plan 92) | **Met** | `docs/gui.md:328-335` |
| 16 | macOS keychain-ACL answer with the exact version (1662–1664) | **Open at advance level, honestly flagged** | `docs/gui.md:288-297` + `spike.md`. **Slice 13's gate — see §7** |
| 17 | Screenshots from the golden fixture, both languages (1838–1839; plan 96) | **Deferred through the plan's own escape hatch** | `docs/gui.md:339-347` + `spike.md:248-266`; plan item 96 makes this "a human gate to schedule with Oscar… recorded honestly, never quietly skipped", which is what happened. **Slice 13's gate — see §7** |
| 18 | Suites green, no production code moved (Slice 12 "Done when", plan:1027-1031) | **Met** | `git show 12e5fb6 --numstat`: `docs/gui.md` 14/7 and `advances/GUI/review.md` only. Slice total `200f432..HEAD` excluding `review.md`: **6 files, all `.md`**. Root **57 files / 301 tests**, desktop **44 files / 623 tests**, both green; typecheck and lint clean in both trees. Counts identical to both prior passes |

### Plan items (`plan.md:954-1031`)

| Item | Verdict | Evidence |
|---|---|---|
| 91 — `docs/gui.md` for a non-technical reader | **Met with residual imprecision** | Node/npm prerequisite now accurate; run-from-source correct and honestly framed; W1/W2 below are the residue |
| 91 sub-bullet — the diagnostics `detail` **column** as a **fourth** verbatim-English surface | **Met** | `docs/gui.md:272-281` is item **4** and describes the column plus the report, with the real literal `"native module loads"` (`src/delivery/diagnostics.ts:44`) |
| 91 sub-bullet — Diagnostics vs Connect vocabulary | **Met, and accurate** | `docs/gui.md:191-196`, re-checked against `tools-handlers.ts:25-27` (reads `mcpServers.valija.env.VALIJA_HOME`) vs `diagnostics.ts:158-167` (entry-exists only) |
| 92 — the environment gap | **Met** | Criterion 15 |
| 93 — the four `SPEC.md` corrections | **Four of four met** | Criteria 1–4 |
| 94 — `specs/desktop.md` + a `specs/README.md` row | **Met** | Row at `specs/README.md:17` + the note at `:32`. Channel count re-counted programmatically from `channels.ts` this pass: **29**, matching `specs/desktop.md:12` and its nine-area table. S2–S5 remain |
| 96 — bilingual screenshots | **Deferred per the plan's own human-gate clause** | Criterion 17 |
| 97 — `CHANGELOG.md` `[Unreleased]` entry | **Met with one omission** | `CHANGELOG.md:9-28`; the `SPEC.md` contract corrections are still unmentioned (**W3**) |

---

## 3. Hard gates

| Gate | Result |
|---|---|
| Security surface | **Clean.** The fix commit is two `.md` files (`docs/gui.md` +14/−7 and this `review.md`); the whole slice is six `.md` files, **zero** `.ts`/`.tsx`/`.css`/config/lockfile lines. No secret, key or passphrase in the diff; no plaintext written; key derivation, keychain use and SQLCipher keying untouched; no IPC channel, preload method, schema or MCP tool changed (`CHANNELS` still 29; MCP still `save_context · save_handoff · get_context · search_context · list_projects`). The one *documentation* claim about a security property that was wrong last pass — that the app offers a link — now matches the code's deliberate refusal to offer one |
| Tests for new behaviour, suite green | **Met.** No behaviour added, none owed. Run by hand this pass: root `typecheck` clean, `lint` clean, `test` 57 files / **301** passed; desktop `typecheck` clean, `lint` clean over 124 files, `test` 44 files / **623** passed. Both counts unchanged from the first pass, as a docs-only slice requires |
| Advance ritual | **Met.** `refined.md:3` `Approved: Oscar 2026-08-20`; `plan.md:3` `Approved: Oscar 2026-08-25` (third revision); this `review.md` closes the trail. `12e5fb6` touches no implementation file, so the implementation gate is not in play |
| Conventions, naming, placement | **Met.** No code file added, moved or renamed in this slice, so no layer-root or kind-folder rule is at stake. Re-checked anyway that `specs/desktop.md`'s description of the tree still matches it: `renderer/state/`, `renderer/screens/`, `main/application/{ports,policies,services}/`, `main/infra/` tech-named adapters, `main/ipc/handlers/` — every file sits in a kind-named folder |

**No hard gate is breached.**

---

## 4. Line count

| | Lines |
|---|---|
| Second fix pass `12e5fb6` (`docs/gui.md` only; `review.md` excluded) | **+14 / −7** |
| Slice total `200f432..HEAD`, excluding `review.md` | **+550 / −4** across 6 files — `docs/gui.md` 347 new, `specs/desktop.md` 142 new, `CHANGELOG.md` +20, `spike.md` +29, `docs/SPEC.md` +9/−4, `specs/README.md` +3 |
| Production code | **0** — no `.ts`, `.tsx`, `.css`, config or lockfile line touched in any of the three commits |

---

## 5. Issues

### Critical

**None.** Both second-pass criticals are closed; nothing new rises to that level.

### Warning

**W1 (new, minor, in the rewritten paragraph) — `docs/gui.md:275-276`'s "Most failures" is true only
under a narrow reading.** *"Most failures are localized on screen from a recognized error code
instead of showing their raw message"* holds if "failures" is scoped to failures whose detail **is**
a raw error message (four of six such paths carry `errorCode`). Read plainly, it is wrong: the
commonest failures on that screen carry no `errorCode` and render their English detail verbatim —
`checkClient`'s `"config not found"` / `"config found, valija not installed"` /
`"config exists but is not valid JSON"` (`src/delivery/diagnostics.ts:154-165`, one row per
*supported* client, so a user with one client installed sees two of these every run),
`checkVault`'s `not initialized — run "valija init"` (`:69`), `checkJournal`'s stray-sidecar string
(`:87`), `checkSyncFolder`'s conflict strings (`:95-102`), and `checkNode`'s `v20.x (need >=22)`
(`:32`). **Suggested rewrite, which also shortens the paragraph:** *"A failure the vault itself
reported is localized on screen from its error code, with the raw text kept only in the Copy report.
Every other failure — including the encryption-engine and keychain checks' raw native-library
messages — shows the same English detail `valija doctor` prints."* Not a gate: it defeats no
acceptance criterion (§9's guarantee is about `DomainError.message`, which the paragraph now states
correctly), and unlike the two defects just closed it invents no affordance and denies no real
behaviour. It is flagged because this is the third round on this one paragraph.

**W2 (carried, unchanged) — the provider-artifact bullet answers the wrong question.**
`docs/gui.md:322-323`: *"**Produce a provider-specific artifact** — nothing here talks to ChatGPT's
or Claude's API, or any network endpoint at all."* Every sentence in it is true, but provider
artifacts (D-D, D-E) are skills, agents, rules files and a generated `CLAUDE.md` — not network
access — and no future-advance pointer appears for it, which is the half of criterion 14 ("where
those live") it misses. **Fix:** *"**Generate files for your AI tools** — skills, agents, rules
files, a `CLAUDE.md`. Planned for a later release; this app writes none of them today."*

**W3 (carried) — `CHANGELOG.md` omits the corrected contract lines.** Plan item 97 asks for four
things; `CHANGELOG.md:9-28` covers three plus the `src/delivery` extraction. The `SPEC.md`
§1/§2/§10a/D11 corrections are still unmentioned. One sub-bullet.

**W4 (carried) — the checksum table names artifacts `electron-builder` will not emit.**
`docs/gui.md:22-25` vs `electron-builder.yml`, re-read this pass: it sets **no `artifactName`**, so
nsis defaults to `Valija Setup <version>.exe` (not `Valija-<version>-Setup.exe`) and the x64 dmg
defaults to `Valija-<version>.dmg` (not `Valija-<version>-x64.dmg`). Two of the four rows are wrong
names attached to `pending` checksums. Slice 13 fills the checksums; it should set `artifactName`
explicitly at the same time, or the table should quote the defaults.

**W5 (carried, now three slices old) — Slice 11's `refined.md` amendment and its obligations 2 and 3
are still unowned.** `refined.md` is untouched by `522a952`, `9349ff4` and `12e5fb6`. Obligation 3
re-verified today and still open: `diagnostic-rows.test.ts:50-65` asserts the three **status labels**
(`diagnostics.ok` / `warning` / `fatal`) but never asserts `row.fatal`, the boolean the stylesheet
and `specs/desktop.md:98-101` both lean on. Slice 13 must either land these or Oscar must drop them
explicitly; a fourth silent deferral is how they disappear.

### Suggestion

**S1 — the run-from-source verification still has no named owner.** `docs/gui.md:76-81` is honest
but, unlike the screenshots section (`:339-347`), never says the verification is recorded as an open
item or where it will happen. One clause pointing at Slice 13 (which packages on tag and therefore
exercises `npmRebuild`) keeps it from evaporating.

**S2 — `specs/desktop.md:26` and `:123-124` state the relocation ordering wrong.** The handler does
`lockVault` → `relocateVault` → **preferences write** → `rebuildContainer` → `repointAllClients`
(`relocation-handlers.ts:147-167`); the spec puts re-pointing before the rebuild and omits the
preferences write from `:26`. The real order is the *more* conservative one, and the ordering is the
safety argument, so it should be exact.

**S3 — `specs/desktop.md:15` "Every handler is four lines" is false.** `relocation-handlers.ts` is
202 lines and its `relocation:move` handler alone is ~30. State the guarantee that actually holds:
validate at the boundary, call an existing use case, map `Result` to a wire shape, hold no session
beyond the action.

**S4 — `specs/desktop.md:86-88` still inverts `mergePreferencesWrite`'s guarantee.**
`preferences-write.ts:11-15` fills **all three** keys from `current` and then spreads the patch, so a
write always carries every key; the real guarantee is that `vaultPath` is structurally absent from
`PreferencesWriteRequest` — which the next sentence already says correctly.

**S5 — `diagnostic-detail.ts` is still missing from `specs/desktop.md`'s renderer-state list**
(`:71-105`). It owns the localized-vs-verbatim rule that has now produced two review findings;
naming it in the spec is the cheapest way to stop a fourth round.

**S6 (code, a later slice) — `connect.nodeMissingDocsLink` is a dangling label.** It reads "How to
install Node.js" and then explains nothing, because §8.3 rightly forbids opening a URL. Better: make
the string carry the instruction (*"Install Node.js 22 or newer from nodejs.org, then reopen this
screen"*), so the label pays off without a link. Out of scope here; noted so W1's predecessor is
never "fixed" by adding a link to the app.

**S7 (carried, re-verified) —** `docs/gui.md:102` says the clipboard warning is "the button's own
label"; it is a sibling `<p className="warning">` (`recovery-kit.tsx:57-59`). `:180` says Diagnostics
shows "one row per connected AI tool"; it is one row per **supported** client, connected or not
(`src/delivery/diagnostics.ts:198`, `CLIENTS.map(checkClient)`). `:312-314` says curation-style
"shaping context happens from inside the AI tools you connect" — `save_context` accepts `type` and
`tags` at save time only (`src/delivery/mcp/server.ts:44-71`); nothing anywhere in the product pins,
edits or deletes, so "shaping" over-promises the MCP surface. The relocation paragraph (`:219-221`)
still doesn't mention that a client which *couldn't* be re-pointed is named individually with a
manual snippet and a **Try again** action (`relocate-vault.tsx:81, 234`). `docs/gui.md` is still not
linked from `README.md`. `CHANGELOG.md:27-28` still has a blank line splitting `### Added`.

---

## 6. Why this is PASS

The two defects the second pass gated on are fixed, precisely, against the code and not against the
commit message: the Connect section now describes a plain-text pointer that exists (byte-exact
against `en.ts:141`, with zero `href`/`openExternal`/`<a>` in `desktop/src`), and both places that
over-claimed about raw error text now name the sqlcipher and keychain checks as on-screen exceptions
while keeping the Copy report as the guaranteed carrier — agreeing with each other and with
`checkRowDetail`. Every acceptance criterion this slice owns is met, both suites are green at their
expected counts, the diff is six markdown files with zero production lines, and the ritual trail is
complete. W1–W5 and S1–S7 are real but none is a merge gate, and W2–W5/S1–S7 were already ruled
non-gates by the two prior passes; escalating them now would be moving the goalposts, not reviewing.

## 7. What this PASS does **not** close

Slice 12 ships. **The advance does not close here**, and Slice 13's review should gate on all three
of these, because each is an acceptance criterion in `refined.md` §9 that this slice could only flag,
not satisfy:

1. **Criterion 13** — the run-from-source path is *"verified, not assumed"* (§9 1854–1856). Currently
   correct-but-unverified (`docs/gui.md:76-81`).
2. **Criterion 16** — the macOS keychain-ACL answer *with the named macOS version* (§9 1662–1664,
   D-H's mandatory spike). Currently an honest placeholder (`docs/gui.md:288-297`).
3. **Criterion 17** — bilingual screenshots from the golden fixture (§9 1838–1839). Deferred through
   plan item 96's own human-gate clause; it needs scheduling with Oscar, not a fourth mention.

Plus the carried bookkeeping: **W5**'s `refined.md` amendment and Slice 11's obligations 2 and 3,
**W3**'s `CHANGELOG` sub-bullet, and **W4**'s `artifactName` (which Slice 13 must set anyway to fill
the checksum table with real names). **W1** and **W2** are two-sentence edits to `docs/gui.md` worth
folding into whatever commit Slice 13 makes to that file.
