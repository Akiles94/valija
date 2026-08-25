Verdict: FAIL

# GUI · Slice 12 — Documentation, `docs/SPEC.md` corrections, and the bilingual screenshots — Review (second pass)

**Branch:** `feat/desktop-GUI` · **Commits under review:** `522a952` (slice) + `9349ff4` (fix pass) ·
**Base:** `200f432` (Slice 11, `Verdict: PASS`) · **Plan:** third revision, `Approved: Oscar 2026-08-25`.
**Reviewed:** `git show 9349ff4` read hunk by hunk, then the *current* `docs/gui.md`,
`docs/SPEC.md` and `specs/desktop.md` re-read in full and re-derived against the code they describe
(`connect-tools.tsx`, `en.ts`/`es.ts`, `diagnostic-detail.ts`, `src/delivery/diagnostics.ts`,
`channels.ts`, `relocation-handlers.ts`, `electron-builder.yml`, `desktop/package.json`,
`.github/workflows/desktop.yml`) — not against the commit message. Both suites run by hand.

**The four first-pass blockers are closed. C1–C4 all verified fixed, individually, against code.**
The FAIL is new: the hunk that closed C1 introduced a false statement about the UI (the app shows
**no link** — deliberately, per §8.3 — where the docs now say it does), and the hunk that rewrote W1
replaced one inaccurate claim about raw error text with a different inaccurate one. This is a
documentation-only slice, so accuracy *is* the deliverable; a sentence that contradicts the code is
the same class of defect as the "27 channels" miscount this pass just closed. Two small edits flip
it — see §6.

---

## 1. First-pass blockers — verified individually

| # | First-pass blocker | Now | Evidence (read, not trusted) |
|---|---|---|---|
| **C1** | Connect section never stated the Node/npm prerequisite | **Fixed in substance, one false clause** | `docs/gui.md:156-160` now states it: tools reach the vault through Node.js, separately from the app's own Node; the config points at `npx -y valija mcp` (matches `installer.ts:8-16`'s `MCP_COMMAND`/`MCP_ARGS`); Connect still writes the config when Node is missing (matches `connect-tools.tsx` — `nodeWarningNeeded` renders a `<div className="warning">` and **never** disables the Connect button, as its own §9 item 71a comment says); the wording tracks `en.ts:138-140` `nodeMissingTitle`/`nodeMissingBody` closely. **But the last clause — "with a link explaining how to install Node.js" (`:160`) — is false.** See **C1 (new)** |
| **C2** | "(verified, not assumed)" over a recipe missing `electron-rebuild`, never run here | **Fixed** | `docs/gui.md:59` drops the false title; `:67` adds `npx electron-rebuild -f -w better-sqlite3-multiple-ciphers` — character-for-character the command `spike.md:60-61` records; `:71-81` states plainly that the sequence **could not be run end-to-end** here and why, in the same honest register as the screenshots section. Every load-bearing claim in that paragraph re-verified: `electron-builder.yml:14` sets `npmRebuild: true`; `desktop/package.json`'s `"package": "electron-builder"` therefore rebuilds, while `"dev": "electron-vite dev"` does not and there is **no** `postinstall` (scripts read directly: `dev`, `build`, `package`, `typecheck`, `test`, `test:watch`, `lint`); `@electron/rebuild ^4.2.0` is a devDependency and `node_modules/.bin/electron-rebuild` exists, so `npx electron-rebuild` resolves locally after `npm ci`. The `-w better-sqlite3-multiple-ciphers` scope is correct, not lucky: `argon2` (`node-addon-api` + `napi_versions`) and `@napi-rs/keyring` are N-API and need no rebuild, exactly as `spike.md:52-58` proved by running them under Electron; `better-sqlite3-multiple-ciphers` uses `bindings`/`prebuild-install`, which is why it is the one that breaks. `.github/workflows/desktop.yml` packages on tags (`npm run package`), so the "CI can run it" half holds too |
| **C3** | D11 missing the MCP-configuration clause | **Fixed** | `docs/SPEC.md:66` now ends *"Relocating a vault from the desktop app also records the new path in the MCP configuration of every AI tool already connected, so moving a vault is expected to edit those third-party config files too."* — the clause `refined.md:898-900` requires (*"relocation also records the vault's path in the MCP configuration of connected clients, so a reader of the contract is not surprised that moving a vault edits a third-party file"*), and true of the code: `relocation-handlers.ts:83-84` re-points via `repointClient`, which returns `notConnected` untouched for clients with no entry (`:70`) |
| **C4** | "27 channels" vs 29 | **Fixed** | `specs/desktop.md:12` now says **29**. Counted programmatically from `channels.ts`'s `CHANNELS` tuple: **29 entries across 9 areas** — `vault` 6, `content` 6, `sync` 1, `diagnostics` 2, `relocation` 4, `import` 3, `tools` 3, `preferences` 2, `dialog` 2. The area table (`:22-30`) lists exactly those nine groups with exactly those members, and sums to 29 |
| **W1** | "five strings that stay English" conflated, miscounted, item 5 contradicted the code | **Partly fixed; new inaccuracy** | `docs/gui.md:259-274` is now four items, and item 4 correctly describes the **whole** detail column (not "one row's") plus the Copy report, with a real example (`"native module loads"` — the literal at `src/delivery/diagnostics.ts:44`). The false item 5 is gone, and the `errorCode` rule is now stated the right way round, matching `diagnostic-detail.ts:11-15` (`check.errorCode !== undefined ? errorCopy(check.errorCode) : check.detail`). **But the replacement over-claims in the other direction** — see **W1 (new)** |

---

## 2. Acceptance criteria (`refined.md` §9, the lines this slice owns)

| # | Criterion (§9 line) | Verdict | Evidence |
|---|---|---|---|
| 1 | §1's "one binary surface" sentence corrected (1603) | **Met** | `docs/SPEC.md:12-16` |
| 2 | §2's "GUI … → later" Out line split; no milestone number (1603, 1606) | **Met** | `docs/SPEC.md:33` |
| 3 | §10a's "import is CLI-only" corrected (1603) | **Met** | `docs/SPEC.md:186` — *"import has no MCP surface; it is available from the CLI and the desktop app."* |
| 4 | **D11** gains the preferences sentence **and** the connected-clients MCP-config clause (1603–1606) | **Met** (was the first pass's C3) | `docs/SPEC.md:66`, all four clauses present |
| 5 | GUI docs state `mcp` is the one deliberately absent CLI surface (1610–1611) | **Met** | `docs/gui.md:312-314` |
| 6 | Behind-schema behaviour documented (1635–1637) | **Met** | `docs/gui.md:128-131` |
| 7 | GUI docs explain the CLI is **not** re-pointed (1763–1764) | **Met** | `docs/gui.md:219-228`, `export VALIJA_HOME="…"` verbatim |
| 8 | Settings has no CLI counterpart, and why (1792) | **Met** | `docs/gui.md:246-251` vs `settings.tsx` |
| 9 | `docs/` itself stays English (1821) | **Met** | `docs/gui.md:276-277` |
| 10 | Every clipboard affordance named individually (§8.7; §6 In 18) | **Met** | `docs/gui.md:294-299` — five, matching the five call sites |
| 11 | GUI docs state the **Node/npm prerequisite** and that this advance does not remove it (1702–1704, 1857–1858) | **Met in substance — one false clause attached** | `docs/gui.md:156-160`. The prerequisite, the non-removal and the warn-without-blocking behaviour are all stated correctly; the closing "with a link" is not true of the app (**C1 new**) |
| 12 | First-launch friction per OS, in the OS's own words (1854–1856) | **Met** | `docs/gui.md:31-57` |
| 13 | …plus the run-from-source alternative, **verified, not assumed** (1854–1856) | **Blocker closed; criterion honestly unverified, carried** | `docs/gui.md:59-81`. The recipe is now *correct* (C2 above verifies every step against config and spike), and the file no longer claims a verification it does not have. Same standing as criteria 16/17: an advance-level open item, not a Slice-12 defect. Needs an explicit owner — see **S1** |
| 14 | What the GUI deliberately does not do **and where those live** (1859–1861) | **Partially met** (unchanged) | `docs/gui.md:303-319` still names no future advance for any item, and the provider-artifact bullet still answers the wrong question. See **W2** |
| 15 | The environment gap stated honestly, incl. `VALIJA_STATE_HOME` device identity (plan 92) | **Met** | `docs/gui.md:321-328` |
| 16 | macOS keychain-ACL answer with the exact version (1662–1664) | **Open at advance level, honestly flagged** | `docs/gui.md:281-290` |
| 17 | Screenshots from the golden fixture, both languages (1838–1839; plan 96) | **Deferred, honestly** | `docs/gui.md:332-340` + `spike.md:248-266` |
| 18 | Suites green, no production code moved (Slice 12 "Done when", plan:1027-1031) | **Met** | `git show 9349ff4 --numstat`: `docs/SPEC.md` 1/1, `docs/gui.md` 32/13, `specs/desktop.md` 1/1 — three files, all `.md`. Root **57 files / 301 tests**, desktop **44 files / 623 tests**, both green; typecheck and lint clean in both trees. Counts identical to the first pass |

### Plan items (`plan.md:954-1031`)

| Item | Verdict | Evidence |
|---|---|---|
| 91 — `docs/gui.md` for a non-technical reader | **Met with residual gaps** | Node/npm prerequisite now present (with C1's false clause); run-from-source now correct and honestly framed; "where those live" still missing (W2) |
| 91 sub-bullet — the diagnostics `detail` **column** as a **fourth** verbatim-English surface | **Met as specified** | `docs/gui.md:268-274` is item **4** and describes the column, not "one row." Dropping the ordinal count from the intro (`:259-260`, "a few places") is a safe deviation — the list is still numbered and item 4 is still the fourth |
| 91 sub-bullet — Diagnostics vs Connect vocabulary | **Met, and accurate** | `docs/gui.md:187-192`, re-checked against `tools-handlers.ts` vs `diagnostics.ts:158-173` |
| 92 — the environment gap | **Met** | Criterion 15 |
| 93 — the four `SPEC.md` corrections | **Four of four met** | Criteria 1–4 |
| 94 — `specs/desktop.md` + a `specs/README.md` row | **Met** | Channel count now correct; every other testable claim re-checked in the first pass and unchanged. S2–S5 below remain |
| 96 — bilingual screenshots | **Deferred, honestly** | Criterion 17 |
| 97 — `CHANGELOG.md` `[Unreleased]` entry | **Met with one omission** | `CHANGELOG.md:9-28`; the `SPEC.md` contract corrections still aren't mentioned (**W3**) |

---

## 3. Hard gates

| Gate | Result |
|---|---|
| Security surface | **Clean.** Three `.md` files, 34 insertions / 15 deletions. No secret, key or passphrase anywhere in the diff; no plaintext written; key derivation, keychain use and SQLCipher keying untouched (no `src/` or `desktop/src/` file modified in either commit of this slice); no IPC channel, schema, preload method or MCP tool changed. One nuance worth naming rather than burying: C1's false "link" clause describes the app as offering something the code refuses to offer *for a security reason* (`connect-tools.tsx`'s comment: *"Plain text, not a link: the app never opens a URL or makes a network request of any kind (§8.3), so there is no href here"*). The docs overstate the app's reach; the app itself is unchanged and still has zero `<a href>`, zero `shell.openExternal`, zero URL anywhere in `desktop/src`. Not a gate breach — a documentation defect about a security property, which is why it is C1 and not a nitpick |
| Tests for new behaviour, suite green | **Met.** No behaviour added, none owed. Run by hand: root `typecheck` clean, `lint` clean (one pre-existing biome-migrate *info*), `test` 57 files / **301** passed; desktop `typecheck` clean, `lint` clean over 124 files, `test` 44 files / **623** passed |
| Advance ritual | **Met.** `refined.md:3` `Approved: Oscar 2026-08-20`; `plan.md:3` `Approved: Oscar 2026-08-25` (third revision); this `review.md` closes the trail. `9349ff4` touches no implementation file, so the implementation gate is not in play |
| Conventions, naming, placement | **Met.** No code file added or moved; no layer-root or kind-folder rule is at stake. `specs/desktop.md`'s description of the desktop tree still matches the tree (kind-named folders, tech-named `infra/` adapters). S5 (the spec blessing renderer imports from `main/application/policies/`) remains an opinion, not a breach |

**No hard gate is breached.** The FAIL is on documentation accuracy — the one thing this slice ships.

---

## 4. Line count

| | Lines |
|---|---|
| Fix pass `9349ff4` (`docs/gui.md` 32/13, `docs/SPEC.md` 1/1, `specs/desktop.md` 1/1) | **+34 / −15** |
| Slice total `200f432..HEAD`, excluding `review.md` | **+543 / −4** (`docs/gui.md` 340 new, `specs/desktop.md` 142 new, `CHANGELOG.md` +20, `spike.md` +29, `docs/SPEC.md` +9/−4, `specs/README.md` +3) |
| Production code | **0** — no `.ts`, `.tsx`, `.css`, config or lockfile line touched in either commit |

---

## 5. Issues

### Critical

**C1 (new, introduced by `9349ff4`) — `docs/gui.md:160` promises a link the app deliberately does not
have.** The added paragraph ends *"…with a link explaining how to install Node.js."* The code that
renders that warning is `connect-tools.tsx`:

```tsx
{/* Plain text, not a link: the app never opens a URL or makes a
    network request of any kind (§8.3), so there is no href here. */}
<p className="docs-hint">{t("connect.nodeMissingDocsLink")}</p>
```

There is no `<a>`, no `href`, no `shell.openExternal` and no URL anywhere in `desktop/src` (grepped:
zero hits), and `docs-hint` has no CSS rule at all, so it is not even styled like one. The string
behind it is `en.ts:141` `"How to install Node.js"` / `es.ts:143` `"Cómo instalar Node.js"` — a bare
label with no URL and no instructions. So the sentence is wrong twice over: it invents an affordance
(a reader will hunt for a clickable link and conclude the app is broken), and it misrepresents a
*deliberate* §8.3 decision as an ordinary help link. This is the same class of defect as the
"27 channels" miscount this very pass closed, in the paragraph written to close C1.
**Fix:** four words — *"…until then, and points you at how to install Node.js (as plain text: this
app never opens a link or touches the network)."* If a real pointer is wanted, that is a code change
for a later slice, not a doc edit — see **S6**.

### Warning

**W1 (new, replacing the old W1) — the docs now claim raw internal error text can never reach the
Diagnostics screen; two code paths say otherwise.** `docs/gui.md:271-274` says *"A row that failed
with a real internal error is localized on screen, from its error code; the raw message behind it
never shows there"* and *"[Copy report] is the one place a raw internal error message may appear"*;
`:184-185` repeats the second claim. That is true for `DomainError`-derived details — which is what
`refined.md:1726-1727` actually guarantees (*"the only place a raw **`DomainError.message`** may
appear"*) and what `diagnostic-detail.ts:15` enforces, since every `DomainError` path in
`src/delivery/diagnostics.ts` sets `errorCode` (`:64, :81, :125, :145`). It is **not** true of the two
probe paths that catch a thrown `Error` and put its message straight into `detail` with **no**
`errorCode`:

- `diagnostics.ts:46` — `{ name: "sqlcipher", ok: false, detail: (e as Error).message, fatal: true }`
- `diagnostics.ts:58` — `{ name: "keychain", ok: false, detail: (e as Error).message }`

`checkRowDetail` only localizes when `errorCode !== undefined`, so those render verbatim on screen —
e.g. the `NODE_MODULE_VERSION 127 … requires 148` string, with an absolute path in it, or a
secret-service failure. Both are realistic: `spike.md:24-31` hit the D-Bus-less keychain case and the
ABI mismatch *in this environment*. The doc's own §Language section is the place a support engineer
will check. **Fix:** qualify both sentences — *"a row whose check failed because the **vault** reported
an error is localized on screen from its error code; the two low-level probes (SQLCipher, OS keychain)
still show the system's own error text, and the Copy report may contain it too."*

**W2 (carried, unchanged) — the "does not do" list never says where those things live, and the
provider-artifact bullet describes the wrong thing.** `docs/gui.md:303-319`; §9 (1859–1861) and plan
item 91 both require "and where each of those lives." No future-advance pointer appears anywhere, and
*"Produce a provider-specific artifact"* is still explained as "nothing here talks to … any network
endpoint," while provider artifacts (D-D, D-E) are skills, agents, rules files and generated
`CLAUDE.md`. Not a merge gate; still owed.

**W3 (carried) — `CHANGELOG.md` omits the corrected contract lines.** Plan item 97 asks for four
things; `CHANGELOG.md:9-28` covers three plus the `src/delivery` extraction. The `SPEC.md`
§1/§2/§10a/D11 corrections are still unmentioned. One sub-bullet.

**W4 (carried) — the checksum table names artifacts electron-builder will not emit.**
`docs/gui.md:22-25` vs `electron-builder.yml`, which sets **no `artifactName`**: nsis defaults to
`Valija Setup <version>.exe`, not `Valija-<version>-Setup.exe`, and the mac dmg names differ from the
table. Slice 13 fills these checksums in; it should set `artifactName` explicitly at the same time,
or the table should quote the defaults.

**W5 (carried) — Slice 11's `refined.md` amendment still hasn't landed**, and Slice 11's obligations 2
(full-bleed recovery kit before screenshots) and 3 (three `DiagnosticRow.fatal` assertions) are still
unowned by any slice. `refined.md` is untouched by both `522a952` and `9349ff4`.

### Suggestion

**S1 — the run-from-source verification now has no owner.** `docs/gui.md:76-81` is honest but, unlike
the screenshots section (`:332-340`), it never says the verification is *recorded as an open item* or
where it will happen. One clause pointing at Slice 13 (which already packages on tag, and therefore
already exercises `npmRebuild`) would keep it from evaporating.

**S2 — `specs/desktop.md:26` still states the relocation orchestration in the wrong order.** The
handler does `lockVault` → `relocateVault` → preferences write → `rebuildContainer` →
`repointAllClients`; the spec puts re-pointing before the rebuild and omits the preferences write.
`:123-124` repeats the same ordering. The ordering is the safety argument, so it should be exact.

**S3 — `specs/desktop.md:15` "Every handler is four lines" is not true** (`relocation-handlers.ts` is
202 lines). State the guarantee that holds instead: validate at the boundary, call an existing use
case, map `Result` to a wire shape, hold no session beyond the action.

**S4 — `specs/desktop.md:86-88` still inverts `mergePreferencesWrite`'s guarantee**; the real one is
that `vaultPath` is structurally absent from the request type, which the next sentence already says.

**S5 — `diagnostic-detail.ts` is still missing from `specs/desktop.md`'s renderer-state list**
(`:71-105`). It owns the English-vs-localized rule that both W1s came from; having it in the spec is
the cheapest way to stop a third round of this.

**S6 (code, a later slice) — `connect.nodeMissingDocsLink` is a dangling label.** It reads "How to
install Node.js" and then explains nothing, because §8.3 rightly forbids opening a URL. Better: make
the string carry the instruction itself (e.g. *"Install Node.js 22 or newer from nodejs.org, then
reopen this screen"*), so the label pays off without a link. Out of scope here; noted because C1's
wording should not be "fixed" by adding a link to the app.

**S7 — carried, unchanged:** `docs/gui.md:103` says the clipboard warning is "the button's own
label" (it is a sibling `<p className="warning">`); `:179` says Diagnostics shows "one row per
connected AI tool" (it is one row per **supported** client, connected or not — `diagnostics.ts:198`);
the relocation paragraph (`:215-217`) now covers the automatic re-point but not that a client that
*couldn't* be re-pointed is named individually with a retry and a manual snippet
(`relocate-vault.tsx:229-240`, `relocation:retryClient`); `docs/gui.md` is still not linked from
`README.md`; `CHANGELOG.md:27-28` still has a blank line splitting `### Added`.

---

## 6. What would flip this to PASS

Two edits, both in `docs/gui.md`, neither of them code:

1. **C1** — `docs/gui.md:160`: drop "with a link explaining how to install Node.js" and say what the
   app actually shows — plain text, no link, because the app never opens a URL (§8.3).
2. **W1** — `docs/gui.md:271-274` and `:184-185`: qualify the raw-error claim. The localization rule
   holds for errors the **vault** reported (`errorCode`-bearing); the SQLCipher and keychain probes
   still surface the system's own error text on screen (`src/delivery/diagnostics.ts:46,58`), and the
   Copy report may carry it too.

W1 is listed as a flip condition rather than a plain warning only because it is the second attempt at
the same sentence and the fix is one clause; if the reviewer's judgement is contested, C1 alone is
sufficient grounds for the FAIL.

W2–W5 and S1–S7 are not merge gates. W5's `refined.md` amendment and Slice 11's obligations 2 and 3
should still be carried into Slice 13 explicitly — three slices have now declined them.
