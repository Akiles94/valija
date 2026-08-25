Verdict: FAIL

# GUI · Slice 12 — Documentation, `docs/SPEC.md` corrections, and the bilingual screenshots — Review

**Branch:** `feat/desktop-GUI` · **Commit:** `522a952` · **Base:** `200f432` (Slice 11, reviewed
`Verdict: PASS`) · **Plan:** third revision, `Approved: Oscar 2026-08-25`.
**Reviewed:** the diff `200f432..522a952` read in full, then every load-bearing claim in
`docs/gui.md` and `specs/desktop.md` re-derived against the actual `desktop/src` tree, the i18n
catalogs and `src/delivery/diagnostics.ts` — not against the commit message, which asserts several
things the files do not. Both suites run by hand.

This is a documentation-only slice, so **accuracy is the deliverable**. The verdict turns entirely
on that: four `refined.md` §9 criteria this slice owns are not met, and one new spec document
miscounts the closed surface it exists to pin. Nothing here is a security regression, nothing is
untested code, and the parts that are right — the Settings section, the clipboard inventory, the
Diagnostics/Connect vocabulary note, the four `SPEC.md` edits' placement — are right in a way that
survived line-by-line checking against the code.

---

## 1. Acceptance criteria (`refined.md` §9, the lines this slice owns)

| # | Criterion (§9 line) | Verdict | Evidence |
|---|---|---|---|
| 1 | `SPEC.md` §1's "one binary surface" sentence corrected (1603) | **Met** | `docs/SPEC.md:12-16` — names `desktop/`, links `docs/gui.md` and `advances/GUI/`, states it adds no MCP tool, no CLI command, no published-package change |
| 2 | `SPEC.md` §2's "GUI … → later" Out line split; **no milestone number** (1603, 1606) | **Met** | `docs/SPEC.md:32-33` — backup/restore keeps "later"; `~~GUI~~ — **shipped**` with both links and the explicit "No milestone number is assigned", matching the existing Mobile-client idiom two lines down |
| 3 | `SPEC.md` §10a's "import is CLI-only" corrected (1603) | **Met** | `docs/SPEC.md:186` — verbatim what plan item 93 specifies: *"No new MCP tool or argument — **import has no MCP surface**; it is available from the CLI and the desktop app."* No other sentence in that paragraph moved |
| 4 | **D11** gains the preferences sentence: UI preferences + location hint, not configuration, `VALIJA_HOME` always precedes — **and notes that relocation also records the vault path in connected clients' MCP configuration** (1603–1606) | **Not met** | `docs/SPEC.md:66` carries the first three clauses exactly. The fourth — relocation writing the vault path into connected clients' `mcpServers.valija` entries — is **absent**. Plan item 93 dropped that half of the criterion; the spec wins. See **C3** |
| 5 | GUI docs state `mcp` is the one deliberately absent CLI surface (1610–1611) | **Met** | `docs/gui.md:293-295` — *"the server your AI tools talk to is the same separate process `npx -y valija mcp` always was; this app never embeds one"* |
| 6 | Behind-schema behaviour documented (1635–1637) | **Met** | `docs/gui.md:118-121` — names the ciphertext backup, the confirmation, and that a fresh vault never sees it. Matches `migration-confirm.tsx` and the `vault:upgradeCheck` channel |
| 7 | GUI docs explain the CLI is **not** re-pointed and does not read the app's preferences (1763–1764) | **Met** | `docs/gui.md:202-211`, including the literal `export VALIJA_HOME="…"` line and the copy action, matching `relocate-vault.tsx:92` |
| 8 | GUI docs state Settings has no CLI counterpart, and why (1792) | **Met** | `docs/gui.md:229-234`. Checked against `settings.tsx` line by line: four sections and no fifth (`:41,62,83,109`), radios only, no destroy/re-key path |
| 9 | The docs record that `docs/` itself stays English (1821) | **Met** | `docs/gui.md:257-258` — states it for `docs/` **and** `specs/`, unhedged |
| 10 | Every clipboard affordance named individually (§8.7; §6 In 18) | **Met** | `docs/gui.md:275-280` names exactly five. Cross-checked against every call site in the tree: `recovery-kit.tsx:43`, `pack-preview.tsx:47`, `relocate-vault.tsx:92`, `connect-tools.tsx:47`, `diagnostics.tsx:87`. No sixth exists; none is missing |
| 11 | GUI docs state the **Node/npm prerequisite** for connected AI tools (D-W) and that this advance does not remove it (1702–1704, 1857–1858; §6 In 18) | **Not met** | `grep -i "node\|npm" docs/gui.md` returns five hits: two `npm` lines inside the build recipe (`:66-67`), the Diagnostics check list (`:162`), the Node-probe disclosure (`:166-167`), and the `npx -y valija mcp` aside (`:294`). The **Connecting your AI tools** section (`:136-144`) says nothing about Node at all — not that it is required, not that the app doesn't provide it, not that the Connect screen warns when it's missing (which `tools-handlers.ts:78` and `connect-tools.tsx` actually implement). See **C1** |
| 12 | First-launch friction documented per OS **in the OS's own words**, with the exact bypass (1854–1856) | **Met** | `docs/gui.md:31-57` — Gatekeeper's sentence verbatim, right-click → Open → Open, the `xattr -d com.apple.quarantine` equivalent; SmartScreen's *"Windows protected your PC"* → More info → Run anyway; `chmod +x` for the AppImage |
| 13 | …plus the run-from-source alternative, **verified, not assumed** (1854–1856) | **Not met** | `docs/gui.md:59` titles the section *"(verified, not assumed)"* and `:70-71` claims *"This runs the exact same code the packaged builds ship"*. `spike.md:35-66` records the opposite: `better-sqlite3-multiple-ciphers` **fails to load under Electron** (`NODE_MODULE_VERSION 127` vs `148`) and `electron-rebuild` is blocked by egress policy in this container. Neither `desktop/package.json` (no `postinstall`) nor `.github/workflows/desktop.yml` runs a rebuild, so the four documented commands produce an app that cannot open a vault. See **C2** |
| 14 | GUI docs state what the GUI deliberately does not do **and where those live** (1859–1861) | **Partially met** | `docs/gui.md:284-300` covers curation, fork resolution, destruction, running an MCP server, provider artifacts, environment-resolved config, third language — seven of the eight named items (re-pointing the CLI is covered at `:202-211` instead). But no bullet says *where* any of them lives (no future-advance reference anywhere), and the provider-artifact bullet describes the wrong thing entirely. See **W3** |
| 15 | The environment gap stated honestly — dock-launched app inherits no shell environment, including the `VALIJA_STATE_HOME` device-identity consequence (plan item 92, §5 A6) | **Met** | `docs/gui.md:302-309`, naming all three variables and the device-identity consequence, and pointing at the Sync panel — which does display `sync.stateHome` (`sync.tsx:117-120`, `sync-handlers.ts:19`) |
| 16 | macOS keychain-ACL answer appears in the GUI docs, with the exact version (1662–1664) | **Open at advance level, honestly flagged here** | `docs/gui.md:262-271` states plainly that it is **not yet verified on real hardware** and why CI cannot answer it. That is D-H's human gate (Slice 1), not a Slice 12 regression — but the criterion remains unclosed for the advance |
| 17 | Screenshots and docs use only the golden fixture, in both languages (1838–1839; plan item 96) | **Deferred, honestly** | `docs/gui.md:313-321` + `spike.md:248-266`. Not fabricated, not silently dropped, reason traced to a confirmed egress denial. Correctly a human gate to schedule, per plan §5 A13 — but the criterion is not met by this slice |
| 18 | Suites still green, no production code moved (Slice 12 "Done when", plan:1027-1031) | **Met** | `git show 522a952 --stat`: seven files, **all `.md`**. No `.ts`, `.tsx`, `.css`, `package.json`, lockfile or config. Root **57 files / 301 tests**, desktop **44 files / 623 tests**, both green, typecheck and lint clean in both trees — counts identical to Slice 11's second pass |

### Plan items (`plan.md:954-1031`)

| Item | Verdict | Evidence |
|---|---|---|
| 91 — `docs/gui.md`, non-technical reader, the full topic list | **Met with three gaps** | Everything in the list is present except the Node/npm prerequisite (C1); the run-from-source path is present but falsely labelled verified (C2); "where those live" is missing from the deliberately-does-not-do list (W3). The checksum table carries the literal `pending — filled by Slice 13's tagged build` four times, greppable exactly as Slice 13's Done-when expects (`docs/gui.md:22-25`) |
| 91 sub-bullet — one sentence closing Slice 10's W1: the diagnostics **`detail` column** stays English, a **fourth** verbatim-English surface | **Not met as specified** | The docs say **five** (`:242-255`), reaching five by splitting the Copy report from "one row's detail text" and adding a fifth item that contradicts the code. `diagnostic-detail.ts:15` localizes any `errorCode`-bearing detail **on screen**; `src/delivery/diagnostics.ts:18-25` says the same. And it is the whole `detail` column, not "one row's" — every doctor check's `detail` is an English literal (`diagnostics.ts:32,43,55,68,86,110,131,148,166`). See **W1** |
| 91 sub-bullet — one sentence closing Slice 10's W3's second half (Diagnostics vs Connect vocabulary) | **Met, and accurate** | `docs/gui.md:172-177`. Verified in both directions: `tools-handlers.ts:76-80` sets `connected` only when `mcpServers.valija.env.VALIJA_HOME` exists, while `diagnostics.ts:165-170` reports `ok` on the entry's mere presence, and `diagnostic-rows.ts:81-83` then renders *"Points at the default location (~/.valija)"* (`en.ts:193`). The docs' description of the mismatch is exactly right |
| 92 — the environment gap | **Met** | See criterion 15 |
| 93 — the four `SPEC.md` corrections | **Three of four met** | See criteria 1–4. The full `docs/SPEC.md` diff is 9 insertions / 4 deletions across four hunks; I read all four in context — no adjacent sentence's meaning shifted, and §2's Out list keeps its existing strikethrough-plus-resolution idiom |
| 94 — `specs/desktop.md` + a `specs/README.md` row | **Met with one factual error** | The row and the "not a `src/` module" note land at `specs/README.md:17,32`. The document itself is accurate on preferences (`app-preferences.ts:9-30`, `file-app-preferences-store.ts:19-53`, `preferences-handlers.ts:13-15`), `resolveVaultRoot` (`vault-location.ts:11-15`, quoted character-for-character), the tour policy (`onboarding-tour.ts:3-29`), `overlay-nav.ts`, `workspace-nav.ts`, and every test it names (`register-handlers.test.ts:61` asserts set equality; `schemas.test.ts:72-83` is the path-shaped-field scan; `no-network-surface.test.ts:10-25` includes `setInterval` and `.css`). But **"27 channels"** is wrong — `channels.ts:53-83` has **29**, and the document's own table lists 29. See **C4** |
| 96 — bilingual screenshots | **Deferred** | See criterion 17 |
| 97 — `CHANGELOG.md` `[Unreleased]` entry | **Met with one omission** | `CHANGELOG.md:9-28`. Every technical claim verified against the tree (`src/delivery/context-pack-export.ts`, `src/delivery/diagnostics.ts`, `check-vault-upgrade.use-case.ts`, `relocate-vault.use-case.ts` all exist and behave as described). The item's fourth requirement — "the corrected contract lines" — is not mentioned. See **W6** |

---

## 2. Hard gates

| Gate | Result |
|---|---|
| Security surface | **Clean.** Seven `.md` files. No secret, key or passphrase appears anywhere in the diff; no plaintext is written to disk by anything this slice adds; key derivation, keychain use and SQLCipher keying are untouched (no `src/` or `desktop/src/` file modified at all); no IPC channel, schema, preload method or MCP tool changed. The one OS-level instruction added (`xattr -d com.apple.quarantine`, `docs/gui.md:42`) is exactly what `refined.md` §4.1 step 1 requires the docs to print, framed correctly as a Gatekeeper bypass for an unsigned build rather than as a routine step. The checksum table teaches verification before running (`:17-18`) |
| Tests for new behaviour, suite green | **Met.** No behaviour is added, so no test is owed. Run by hand in both trees: root `typecheck` clean, `lint` clean (one pre-existing biome-migrate info), `test` **57 files / 301 tests** green; desktop `typecheck` clean, `lint` clean over 124 files, `test` **44 files / 623 tests** green. Both counts identical to Slice 11's second pass, which is exactly what this slice's Done-when demands |
| Advance ritual | **Met.** `refined.md:3` `Approved: Oscar 2026-08-20` (Gate R closed, fifth revision); `plan.md:3` `Approved: Oscar 2026-08-25` (third revision, Gate P re-closed); this `review.md` closes the trail. One bookkeeping oddity, not a breach: `522a952` also carries the Slice 11 second-pass `review.md` (209/−253), i.e. the reviewer's file was swept into the implementer's next commit rather than committed with Slice 11's fix-up. Verdict, content and authorship are unaffected |
| Conventions, naming, placement | **Met.** No code file is added, so no layer-root or kind-folder rule is at stake. `docs/gui.md` sits beside `docs/sync.md` / `docs/vault-format.md`; `specs/desktop.md` sits beside the four module specs with its `specs/README.md` row and an explicit note explaining why it is the one spec without a `src/` module. `specs/desktop.md`'s own description of the desktop tree matches the tree: kind-named folders throughout (`application/policies`, `application/ports`, `application/services`, `infra`, `ipc/handlers`, `renderer/state`, `renderer/screens`, `shared/i18n/catalogs`), tech-named adapters (`FileAppPreferencesStore`, `ElectronClipboard`, `ChildProcessNodeProbe`, `OsKeychain`). One placement opinion the new spec now blesses is raised as **S8**, not as a breach |

**No gate is breached.** The FAIL is on §9 criteria 4, 11 and 13, plus the factual error in the new
spec (C4) — all in the one artifact this slice exists to produce.

---

## 3. Line count (`advances/GUI/review.md` excluded)

| | Lines |
|---|---|
| `docs/gui.md` (new) | 321 |
| `specs/desktop.md` (new) | 142 |
| `advances/GUI/spike.md` | +29 |
| `CHANGELOG.md` | +20 |
| `docs/SPEC.md` | +9 / −4 |
| `specs/README.md` | +3 |
| **Total (excluding `review.md`)** | **524 added / 4 removed** |
| Production code | **0** — no `.ts`, `.tsx`, `.css`, config or lockfile line touched |

Against `plan.md:1654-1660`'s estimate of ≈630 documentation lines for this slice: under budget, and
the shortfall is visible in the two thinnest sections (Import at 8 lines, Connect at 9) — which is
where C1 and S10 land.

---

## 4. Issues

### Critical

**C1 — `docs/gui.md` never states the Node/npm prerequisite (D-W).** Three separate places in the
spec require it: §9's Connect bullet (*"it warns without blocking, and the GUI docs state the
prerequisite"*, 1702–1704), §9's Packaging-and-docs bullet (*"The GUI docs state the Node/npm
prerequisite for connected AI tools (D-W) and that this advance does not remove it"*, 1857–1858),
and §6 In item 18, which lists it in bold inside the docs deliverable. The **Connecting your AI
tools** section (`docs/gui.md:136-144`) — the one place a reader deciding whether to click
**Connect** will look — does not mention Node once. The nearest thing in the file is the Diagnostics
row (`:166-167`) and an aside inside the does-not-do list (`:294`), and neither tells the reader that
the connection they just made will silently fail without a Node runtime the app does not provide.
This is the exact silent-failure mode `refined.md` §3 fact 6 and D-W exist to prevent, and the app
already implements the warning (`tools:nodeStatus`, `connect-tools.tsx`) — only the docs half is
missing. **Fix:** two sentences in the Connect section saying that connected tools launch valija
through `npx -y valija mcp`, that this needs Node and npm installed on the machine, that Valija does
not bundle them, and that the Connect screen warns (without blocking) when they aren't runnable.

**C2 — the run-from-source path is labelled "(verified, not assumed)" and is neither.**
`docs/gui.md:59-71` gives `git clone` → `cd valija/desktop` → `npm ci` → `npm run dev` and asserts
*"This runs the exact same code the packaged builds ship."* `spike.md:35-66` — this advance's own
record — says `better-sqlite3-multiple-ciphers` **fails to load under Electron** without
`@electron/rebuild` (`NODE_MODULE_VERSION 127` vs `148`, confirmed by running it, not predicted), and
that the rebuild could not be completed in this container. There is no `postinstall` in
`desktop/package.json` and no rebuild step in `.github/workflows/desktop.yml`, so nothing performs it
implicitly. A reader following these four commands gets a window that cannot open a vault. §9's
criterion is specifically *"the run-from-source path is verified, not assumed"* (1854–1856), and
`plan.md:1282` assigns it to this slice. This is also the one place the slice's otherwise-exemplary
honesty (see §5) inverts: the checksums and the screenshots are flagged as gaps in the same file
where this one is asserted as done. **Fix:** either add the `npx electron-rebuild -f -w
better-sqlite3-multiple-ciphers` step and drop the "verified" claim to what was actually verified, or
mark the section as unverified with the same wording the screenshots section uses and carry the
verification into Slice 13 alongside the packaged-artifact checks.

**C3 — the D11 correction is missing the second half of its criterion.** `docs/SPEC.md:66` reads
*"The desktop app additionally remembers a vault location in its own preferences file; `VALIJA_HOME`
always takes precedence over it, and that file holds **UI preferences and a location hint only — it
is not configuration.**"* §9's criterion (1603–1606) requires that sentence **and** that it "notes
that relocation also records the vault path in connected clients' MCP configuration (D-O)." That
clause is absent. It is the single most load-bearing consequence of D-R(a) — the reason a reader of
`SPEC.md` alone would otherwise still believe a moved vault is remembered in exactly one place.
Plan item 93 restated the criterion without this half; the spec wins. **Fix:** one trailing clause,
e.g. *"…; relocating the vault also rewrites the vault path into every connected client's
`mcpServers.valija` entry."*

**C4 — `specs/desktop.md:12` says "27 channels"; the surface has 29.** `channels.ts:53-83`
enumerates 29 entries, and `specs/desktop.md`'s own area table (`:22-30`) lists 29 when summed
(6+6+1+2+4+3+3+2+2). "Nine areas" is right; the count is not. This is a spec whose stated purpose is
to pin a *closed, enumerated* surface — a wrong count is the one error it cannot afford, because the
next reader will use it to check whether a channel was added. The commit message repeats the wrong
figure. **Fix:** 27 → 29.

### Warning

**W1 — the "five strings that stay English" list conflates two surfaces, miscounts, and item 5
contradicts the code.** `docs/gui.md:242-255`. `refined.md` D-V(d)/§3 fact 5 names **three**
`src/`-pinned strings; Slice 10's review added the diagnostics `detail` column as a genuine fourth;
`plan.md:984-988` (P-D17) says exactly that — *"a **fourth** verbatim-English surface"*. The doc
reaches five by (a) fusing the Copy report and "one row's detail text" into item 4 and (b) adding
item 5, *"Any internal error message that reaches the Diagnostics screen at all"* — which is false.
`diagnostic-detail.ts:15` returns `errorCopy(check.errorCode)` whenever `errorCode` is set, so a raw
`DomainError.message` **never** reaches the screen; `src/delivery/diagnostics.ts:18-25` documents the
same intent, and `refined.md` §9 (1726–1727) makes the Copy report *"the only place a raw
`DomainError.message` may appear."* `docs/gui.md:168` itself says so correctly, so the file
contradicts itself eight lines apart. Item 4's *"one row's detail text"* also understates: every
doctor-derived row's `detail` is an English literal (`diagnostics.ts:32,43,55,68,86,110,131,148,166`),
which is why the plan calls it a *column*. **Fix:** make it four — (1) recovery-kit body, (2) manual
install snippet, (3) context pack, (4) the Diagnostics screen's whole `detail` column plus the Copy
report payload — and replace item 5 with the accurate statement: everywhere in the app, including
Diagnostics rows, an error is rendered from its code; the Copy report payload is the one place the
raw message can still appear.

**W2 — the checksum table names artifacts that will not exist.** `docs/gui.md:22-25` lists
`Valija-<version>-arm64.dmg`, `Valija-<version>-x64.dmg`, `Valija-<version>-Setup.exe`,
`Valija-<version>.AppImage`. `refined.md` §4.1 step 0 names a third set
(`Valija-<version>-mac-arm64.dmg`, `-win-x64.exe`, `-linux-x86_64.AppImage`), and
`desktop/electron-builder.yml` sets **no `artifactName`**, so electron-builder's defaults apply —
`Valija Setup <version>.exe` for nsis, and no `-x64` suffix on the default-arch dmg. Three
descriptions of the same four files, none of which agree. The install page is the first thing the
target user reads. **Fix:** set `artifactName` explicitly in `electron-builder.yml` (Slice 13) and
make this table quote it, or write the defaults electron-builder actually emits.

**W3 — the "does not do" list never says where those things live, and one bullet describes the
wrong thing.** §9 (1859–1861) and plan item 91 both require "and where each of those lives."
`docs/gui.md:284-300` names no future advance for any of the seven items. Worse, *"Produce a
provider-specific artifact"* (`:296-297`) is explained as *"nothing here talks to ChatGPT's or
Claude's API, or any network endpoint at all"* — but provider artifacts (D-D, D-E) are **skills,
agents, rules files and generated `CLAUDE.md`**, and D-E already fixes their delivery shape (live
over MCP plus a copy button). The bullet answers a question nobody asked and leaves the real one
unanswered. **Fix:** name the artifacts, and add "→ a future advance" pointers to the curation,
provider-artifact and third-language bullets.

**W4 — the relocation section documents one of the wizard's two consequences.** §6 In item 18
requires "the relocation wizard **and both of its consequences** — the `VALIJA_HOME` line for
terminal users and the automatic re-pointing of connected tools." `docs/gui.md:192-211` covers the
first in detail and omits the second entirely; the re-pointing appears only inside a does-not-do
bullet 80 lines later (`:294`). For a reader following the wizard, "your connected AI tools are
re-pointed automatically, and any that couldn't be are named individually with a manual snippet" is
the more reassuring half and the one that changes what they need to do afterwards. **Fix:** one
paragraph in the wizard section, alongside the `VALIJA_HOME` line.

**W5 — Slice 11's standing obligations are half-paid, and the unpaid ones need re-carrying.**
Obligation 1 (record the locked-state Vault & sync narrowing in `docs/gui.md` **and** as a
`refined.md` amendment): the docs half landed and landed well — `docs/gui.md:222-226` matches
`settings.tsx:94-106`'s `unlocked` gate exactly, names the affected user, offers `valija doctor` as
the interim route, and calls it a known limitation rather than a feature. The `refined.md` amendment
did not land; `refined.md` is untouched in `522a952`. Obligations 2 (full-bleed the recovery kit
before screenshots) and 3 (three `DiagnosticRow.fatal` assertions) are code and correctly out of
scope for a documentation-only slice — but they are now unowned. **Fix:** amend `refined.md` §4.8
step 40 (or record the narrowing in this advance's decision log), and re-list obligations 2 and 3 in
Slice 13's plan text so they are not lost between two slices that each declined them.

**W6 — the `CHANGELOG.md` entry omits the corrected contract lines.** Plan item 97 asks for four
things in the `[Unreleased]` entry: the desktop app, the relocation capability, the schema-upgrade
consent gate, **and the corrected contract lines**. `CHANGELOG.md:9-28` covers the first three plus
the `src/delivery` extraction; the `SPEC.md` §1/§2/§10a/D11 corrections are not mentioned. Every
other claim in the entry was checked against the tree and is accurate. **Fix:** one sub-bullet.

### Suggestion

**S1 — `specs/desktop.md:26` states the relocation orchestration in the wrong order.** It says
`LockVault` → `RelocateVault` → per-client re-pointing → container rebuild. `relocation-handlers.ts`
does `lockVault` (`:149`) → `relocateVault` (`:154`) → preferences write (`:162`) → `rebuildContainer`
(`:163`) → `repointAllClients` (`:168`). The re-point is **after** the rebuild, and the preferences
write is a step the spec omits from the sequence even though it discusses it two sentences later.
Worth fixing because the ordering is the whole safety argument.

**S2 — `specs/desktop.md:15-16`'s "Every handler is four lines" is not true.**
`relocation-handlers.ts` is 202 lines, `import-handlers.ts` 134, `tools-handlers.ts` 87. The claim
reads as a structural guarantee and isn't one. Say what is actually guaranteed: every handler
validates at the boundary, calls existing use cases, maps `Result` to a wire shape, and holds no
session beyond the action.

**S3 — `specs/desktop.md:86-91` inverts `mergePreferencesWrite`'s guarantee.** It says the merge
means "a write can never carry a key the renderer didn't explicitly set"; `preferences-write.ts:11-16`
does the opposite — it deliberately carries all three current keys forward so a partial patch can't
blank the others. The real guarantee, which the same paragraph states correctly one sentence later,
is that `vaultPath` is structurally absent from the request type.

**S4 — `diagnostic-detail.ts` is missing from `specs/desktop.md`'s renderer-state list** (`:71-105`),
though `diagnostic-rows.ts` is there. It is the module that decides the English-vs-localized rule
both `docs/gui.md` and `refined.md` §9 care about, and W1 above is exactly the kind of error that
having it in the spec would have prevented.

**S5 — `docs/gui.md:92-93` says the clipboard warning is "the button's own label."** It is a sibling
paragraph: `recovery-kit.tsx:55-59` renders the button (`recoveryKit.copyKey` = "Copy key") and then
`<p className="warning">{t("recoveryKit.copyKeyWarning")}</p>`. Small, but this is §8.17 security
copy and the docs should describe it as it appears.

**S6 — `docs/gui.md:163` says Diagnostics shows "one row per connected AI tool."** It shows one row
per **supported** client, connected or not — `diagnostics.ts:198` maps all of `CLIENTS`, and a
missing config yields `ok: false, detail: "config not found"`. A user with no clients installed will
see three rows and wonder what they did wrong.

**S7 — `docs/gui.md` is not linked from `README.md`.** `docs/SPEC.md` links it twice; the README —
the actual front door — never mentions the desktop app. One line under the README's install section
would close it.

**S8 — `specs/desktop.md:64-66` blesses the renderer importing `main/application/policies/*`.** The
tour and `system-or-override.ts` are genuinely shared between the trusted process and the renderer,
and `desktop/src/shared/` already exists for exactly that (it holds `i18n/` and `ipc/`). Naming the
main tree as the home for renderer-imported policy is the sort of thing a spec makes permanent.
`desktop/src/shared/policies/` would match the tree's own convention. Pre-existing (P-D14), raised
here only because this is the commit that turns it into written contract.

**S9 — the `CHANGELOG.md` insertion leaves a blank line mid-list**, splitting `### Added` into two
paragraphs (`CHANGELOG.md:28-29`). Renders as a loose list; trivially fixed by dropping the blank
line.

**S10 — the Import section (`docs/gui.md:148-155`) omits the three things a non-technical reader
meets first**: that a target project is required before anything can be imported, that conversations
are chosen with checkboxes and a filter box, and that a format override appears only when detection
fails. The `imported`-items-excluded-from-packs sentence — the one that prevents a user concluding
the import failed — is there and is well written, which makes the omissions more noticeable.

---

## 5. What was verified by hand rather than taken on trust

- **The whole diff**, read in full, independently of the commit message — which claims "the
  27-channel IPC surface" (it is 29) and "the five strings that stay English" (there are four
  surfaces, one of them described backwards).
- **Settings.** `docs/gui.md:220-227`'s four sub-bullets read against `settings.tsx:41-114`: four
  `<section>`s, Appearance and Language as three radios each, Vault & sync's two buttons rendered
  **only** when `unlocked` (`:94-106`) with `settings.vaultAndSyncLocked` in the else branch
  (`en.ts:293`, `es.ts:301`), Help always present. The docs' "only work while your vault is unlocked"
  matches the gate exactly, including that Help and the language switch keep working while locked
  (`app.tsx:131-146`, `locked.tsx`'s gear).
- **The tour.** `docs/gui.md:101-110` read against `en.ts:61-75`'s four slides: slide 1 is what the
  vault is, slide 2 is *"Saving happens from inside an AI tool you've connected — not from this
  window"*, slide 3 browse/search/carry, slide 4 *"There is no password reset."* The docs' summary is
  faithful, and the replay-from-locked-Settings claim holds (`app.tsx:131`, `canNavigateAwayFrom`).
- **The five English exceptions**, traced to `error-copy.ts:17-31` (always from the code),
  `diagnostic-detail.ts:15` (screen localizes an `errorCode` detail), `diagnostics.ts:18-25` (the
  Copy report is the only raw-message path) and every `detail` literal in `runDiagnostics`. This is
  where W1 came from.
- **Every clipboard call site** in `desktop/src/renderer`, grepped for `content.copy` /
  `copyReport`: five, and the docs name exactly those five.
- **The Diagnostics/Connect vocabulary claim**, traced through both code paths
  (`tools-handlers.ts:76-80` vs `diagnostics.ts:158-172` + `diagnostic-rows.ts:73-84`) before
  accepting the docs' account of it.
- **`specs/desktop.md`'s testable claims**: `register-handlers.test.ts:61` (set equality),
  `schemas.test.ts:58,72-83` (`vaultPath` stripped; no path-shaped field),
  `no-network-surface.test.ts:10-25` (`setInterval`, `fetch(`, `crashReporter`, `.css` in the glob),
  `sync-panel.no-write.test.ts`, the two `__dom-tests__` files, `preferences-handlers.ts:14`'s
  carry-forward, `file-app-preferences-store.ts:39-53`'s temp-file-plus-rename and four-key
  spelling-out, and `vault-location.ts:11-15` against the quoted one-liner. All accurate.
- **The two deferred items' honesty.** The checksum markers are one literal string repeated four
  times (`docs/gui.md:22-25`), greppable exactly as `plan.md:1083` expects Slice 13 to grep it. The
  screenshots section (`:313-321`) states that they are not included, why, that the blocker is an
  egress policy on `electronjs.org`, and where it can be resolved — cross-referenced to
  `spike.md:248-266`, which itself distinguishes what was confirmed by running from what was
  inferred. Neither could be mistaken for complete by a casual reader. This is the standard R9 and
  A13 ask for, and it is met — which is precisely why C2's "(verified, not assumed)" stands out.
- **Both suites**, both trees, all six commands, plus `git show --stat` to confirm no `.ts`/`.tsx`/
  `.css` line moved.

---

## 6. What would flip this to PASS

Five edits, all in documentation, none of them code:

1. **C1** — state the Node/npm prerequisite in `docs/gui.md`'s Connect section: connected tools run
   `npx -y valija mcp`, that needs Node and npm on the machine, this app does not provide them, and
   the Connect screen warns without blocking when they aren't runnable.
2. **C2** — either add the `npx electron-rebuild -f -w better-sqlite3-multiple-ciphers` step to the
   run-from-source recipe and re-title the section to claim only what was verified, or mark it
   unverified in the same honest register as the screenshots section and carry the verification into
   Slice 13.
3. **C3** — append the relocation/MCP-config clause to `docs/SPEC.md`'s D11 sentence.
4. **C4** — `specs/desktop.md:12`: 27 → 29.
5. **W1** — rewrite `docs/gui.md:242-255` as four exceptions, with item 4 covering the whole
   Diagnostics `detail` column plus the Copy report, and drop the claim that raw internal errors
   reach the Diagnostics screen.

W2–W6 and S1–S10 are not merge gates. W5's `refined.md` amendment and the re-carrying of Slice 11's
obligations 2 and 3 into Slice 13 should be done in the same pass, because there is no later slice
that will notice them.
