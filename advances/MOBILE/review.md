Verdict: PASS

# MOBILE — review (fifth pass)

Reviewed `docs/mobile-poc-MOBILE` @ `2ebf1dc` against `main` (`git diff main...HEAD`, base
`543d2fe`), working tree clean. Re-reviewed from scratch, not as a diff of `2ebf1dc`. Passes 2–4
are retained verbatim below; pass 1 survives as pass 2's disposition table, as it has since
the second pass.

**Line count:** 8 files changed, 578 insertions(+), 14 deletions(-), excluding this `review.md`
(9 / 1515 / 14 including it). No `src/` line, no `package.json`, no build config, no `.github/`,
no `.gitignore`.

**What I could check.** `/workspace/valija-mobile` is attached at `feat/poc` @ `644e4e1` — the
commit `poc.md` §3a cites for run #11 — so I re-verified the PoC tree, its CI workflow and its
tests against the tree rather than against `poc.md`'s description of them. Run #11's
`conclusion: success` is still the one assertion I cannot independently confirm from this session.

**Bottom line.** Pass 4's two flip conditions are both met, and both questions I was asked to
re-check come back clean: the NOT-COMMITTED disclosure is consistent at every place either log is
mentioned, and the diff is still exactly the four allowed paths plus the two evidence `.txt` files
that were already tracked. **This passes.** Five acceptance criteria remain unmet, all five
superseded by Oscar's dated amendment in `refined.md` §7 P-6 or disclosed in the register the spec
demands — and, for the first time in this advance, none of them is *misdescribed*. What is left is
one under-claiming sentence, one misattributed reason, and a pile of carried nits, none of which
holds a merge.

---

## 0. Disposition of pass 4's two flip conditions

| Pass 4 | Now | Verdict |
|---|---|---|
| **C1-4** — `poc.md` §4's provenance caveat still said the `WRONG_PASSPHRASE` and no-sidecar checks rested "solely on unreproducible evidence", contradicting §2 and `docs/vault-format.md` | `poc.md:191–198` now reads "…and the `WRONG_PASSPHRASE` and no-sidecar checks via the same emulator/simulator CI runs asserting them directly (see §2's rows for the exact file and line). **Only the Argon2id timing has no independent source**". That agrees with `:54`, `:55` and `docs/vault-format.md:556–557`. I re-verified all four citations in the tree this pass: `AndroidVaultConformanceTest.kt:90–93` (`assertEquals(emptyList(), sidecars, …)`), `:96–103` (`refusesAWrongKeyAsAWrongPassphrase`), `IosVaultConformanceTest.kt:101–108` (same), and `ci.yml` really does run `:vault-interop:connectedAndroidTest` and `:vault-interop:iosSimulatorArm64Test` | **FIXED** |
| **C2-4** — the two evidence logs are `.gitignore`d, were never committed, and `poc.md` presented them as present-tense files | Fixed via the second of the two routes I named (disclose rather than commit). §8's two rows (`:350`, `:351`) lead with **NOT COMMITTED**, §4's pointer (`:214–218`) carries the disclosure inline, and the "committed Argon2id number" phrasing is gone from both publication sites (`poc.md:53`, `docs/vault-format.md:555`) | **FIXED (disclosure route)** |
| **W1-4** — "device-class (emulator) timing" drifted toward the register this advance exists to avoid | `poc.md:53` now reads "prints a timing on every green CI run — that measures the emulator's own runner CPU, not phone hardware either" | **FIXED** |
| **W3-4** — the shipped log would carry "device-equivalent hardware" | Moot under the disclosure route: the log ships nowhere | **MOOT** |

## 0a. The two things I was asked to re-check

**(1) Does the NOT-COMMITTED disclosure read consistently everywhere?** Yes. I grepped the whole
repo for both filenames, not just `poc.md`:

```
$ grep -rn "jvm-conformance\|linux-fullstack" --include="*.md" .   # excluding review.md
advances/MOBILE/poc.md:191   §4  "The log below (evidence/linux-fullstack-interop.log) is real output…"
advances/MOBILE/poc.md:214   §4  "Full log: … in this working tree — **not committed to valija**…"
advances/MOBILE/poc.md:350   §8  "**NOT COMMITTED to valija** — *.log is repo-gitignored…"
advances/MOBILE/poc.md:351   §8  "**NOT COMMITTED**, for the same gitignore/scope reason…"
advances/MOBILE/plan.md:291,516,1018            (the approved plan's own pre-execution text)
```

Nothing in `docs/vault-format.md`, `docs/SPEC.md` or `CHANGELOG.md` points at either file, so the
disclosure only ever had to hold inside `poc.md`, and it does. Of the four `poc.md` references,
`:214`, `:350` and `:351` state non-commitment explicitly; `:191` names the path but asserts only
that the run happened and cannot be re-run, and it sits 23 lines above `:214`'s disclosure in the
same section — a reader is never told the file is present. Three references would read better with
the same three-word tag (S1-5), but there is no inconsistency to fix. The `plan.md` hits are the
approved plan's own "Done when"/repo-tree text, i.e. what was planned, not what shipped; `poc.md`
§8 is the record of what shipped and it now contradicts them deliberately and visibly.

**(2) Is the diff still scoped?**

```
$ git diff main...HEAD --name-only
CHANGELOG.md
advances/MOBILE/evidence/sqlite3c-sha256.txt
advances/MOBILE/evidence/toolchain-versions.txt
advances/MOBILE/{plan,poc,refined,review}.md
docs/SPEC.md
docs/vault-format.md

$ git diff main...HEAD --stat -- src/ package.json tsup.config.ts 'tsconfig*.json' .github/ .gitignore
(empty)
```

Nine paths, all inside `advances/MOBILE/**`, `docs/vault-format.md`, `docs/SPEC.md`,
`CHANGELOG.md`. The two evidence `.txt` files were already tracked on this branch and only their
content moved. `.gitignore` is untouched, as declared.

---

## 1. Acceptance criteria (`refined.md` §9)

### Applies under every option

| # | Criterion | Status | Evidence |
|---|---|---|---|
| A1 | No `src/`, `package.json`, `tsup.config.ts`, `tsconfig*.json`, `.github/workflows/ci.yml` in the diff | **MET** | The two commands in §0a(2). |
| A2 | No change to format, crypto, KDF params, key format, SQLCipher config, `vault.json` | **MET** | `docs/vault-format.md`'s hunks touch §8, §9, §13 and the §14 closing note only; §§3–6 (header, KDF, cipher config, schema) are untouched. |
| A3 | MCP surface byte-for-byte unchanged | **MET** | `git diff main...HEAD -- src/delivery/mcp/` → 0 lines. |
| A4 | No network/telemetry/analytics/cloud SDK in any app artifact | **MET** | Re-read this pass: `libs.versions.toml` is Kotlin, AGP, Compose MP, serialization, activity-compose, test runner — nothing network-capable; `AndroidManifest.xml` declares only a `tools:node="remove"` of the self-scoped `androidx.core` permission; `Info.plist` has no ATS key; `valija_native.c` opens no socket. |
| A5 | `typecheck && lint && test` pass unchanged; CI matrix not slowed or gated | **MET** | Ran all three: `tsc --noEmit` clean; biome "Checked 146 files… No fixes applied" (one pre-existing config-migration *info*); vitest **48 files / 241 tests passed**. No workflow file touched. |
| A6 | Every value from the golden fixture; no real vault/passphrase/key/content anywhere | **MET** | Re-hashed all seven vendored fixture files against `src/testing/__fixtures__/golden-vault/` — zero drift. The only 64-hex string anywhere in `poc.md` is the `sqlite3.c` SHA-256, not `manifest.keyHex`. |
| A7 | PASS/FAIL/NOT ATTEMPTED per §3 question **with hardware, OS version and toolchain version** | **NOT MET — disclosed, carried** | Every G1–G7 question has a row and each names what the repo can prove; NDK, Xcode, the macOS image and the simulator runtime are still unrecorded and each row says so at the point of claim (`poc.md:56`, `:57`, `:59`). Unchanged since pass 3; never a flip-blocker. |
| A8 | Explicit claim-scoping section; no claim stated more broadly than its evidence | **MET** | §3 (`:148–180`) is intact, the ⚠ discipline is consistent across both documents, pass 4's two breaches are gone, and I re-read every mobile claim in `poc.md`, `docs/vault-format.md` §13, `docs/SPEC.md:31`/§10b and `CHANGELOG.md`. The one residual (W1-5) under-claims rather than over-claims, so it does not breach this criterion. |
| A9 | No sentence describes a macOS/Linux/x86_64 run as an iOS/arm64 run | **MET** | Every mobile claim carries "simulator"/"emulator"/"x86_64" inline; `docs/vault-format.md:520–532`'s new §13 lead-in splits Tier C into "simulator, closed" and "device, never" explicitly. |

### The app itself

| # | Criterion | Status | Evidence |
|---|---|---|---|
| B1 | Single-screen app per platform, shared Kotlin core, amalgamation only behind one port | **MET** | `:vault-core` has no `expect`/`actual`; `:vault-interop` is the only module naming C; `App.kt` calls `RunGoldenVaultConformance`, never the port. Compiler-enforced by the module graph. |
| B2 | Sandbox copy; bundled bytes unchanged; no `-wal`/`-shm`/`-journal` | **MET** | Snapshot-before-open in `RunGoldenVaultConformance`; sidecar refusal in `infra/files/FixtureSnapshot`; re-proved on the emulator at `AndroidVaultConformanceTest.kt:90–93`. |
| B3 | No journal pragma, migration, lineage write or device identity in the PoC source | **MET** | My grep over `vault-core`, `vault-interop`, `composeApp`, `iosApp` returns only comments naming their absence (`valija_native.c:6`, `Sqlite3mcDatabase.kt:15`) and the `SCHEMA_TOO_NEW` refusal paths. |
| B4 | Derived key never written to keychain/keystore/prefs/file/log | **MET** | Zero hits for `Keychain`/`Keystore`/`UserDefaults`/`SharedPreferences`/`SecItem` outside `vendor/`; the only three `println`s print the Argon2id parameter line and the verdict line. |
| B5 | Zero network requests, verified by source **and declared capabilities of both binaries** | **MET in substance, unevidenced in this repo** | I verified both declarations myself (A4); `advances/MOBILE/evidence/` still holds no `android-permissions.txt`, and `poc.md:356–357` says so. Carried, non-blocking. |

### Execution evidence (G1, G2, G3, G6)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| C1 | Screenshot from a **booted iOS simulator**, committed | **NOT MET — waived by the recorded closure** | `ci.yml` takes no screenshot and launches `:composeApp` nowhere; `poc.md:356` records permanent non-collection with the true reason (never implemented, not "pending"). |
| C2 | Screenshot from a **booted Android emulator or device** | **NOT MET — same disposition** | Same. |
| C3 | Interop exercised per platform through its own mechanism, both recorded | **MET** | Hand-written JNI bridge vs. cinterop `.def` with no hand-written C — visibly different paths; `poc.md:58–59` records both. |
| C4 | Run logs, **including exit codes**, committed | **NOT MET — disclosed, and now accurately** | The device logs are waived with Slice 9; the CI logs were never retrieved (`:357`); the two working-tree logs are declared NOT COMMITTED (`:350`, `:351`, `:214–218`). This is the disclosure route pass 4 named as sufficient. See W2-5 for the one thing wrong with *how* it is justified. |
| C5 | Android result states arm64 vs x86_64 plainly; x86_64 ⇒ G2 still open | **MET** | `poc.md:56`, `:58`, `:63`, `:161–164`; `docs/vault-format.md:558`; the CI job is literally named "Android build + x86_64 emulator (NOT arm64 evidence)". |

### Conformance (G4, G7)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| D1 | JVM byte-compare against `expected-export.md`, passing | **MET** | `GoldenVaultConformanceTest` has exactly 10 `@Test`s; `wc -c` on the two fixtures gives 1887 and 967 — the numbers `poc.md:50` publishes. |
| D2 | Same comparison on device, shown on screen and in the exit status | **NOT MET (screen half) — waived** | The screen half exists in `App.kt` and was never captured; the exit-status half runs in CI and is not committed here. |
| D3 | Byte comparison, not a snapshot, not normalised | **MET** | `PackConformance.compareRendered` is a `ByteArray` loop with a first-difference index. |
| D4 | `estimateTokens` counts UTF-16 code units, asserted by a test | **MET** | The `"𝄞"` assertion; documented at `docs/vault-format.md:309–317`. |

### Argon2id (G5)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| E1 | Derived key equals `manifest.keyHex`, asserted in code | **MET off-device; on-device N/A by amendment** | Asserted before opening in all three conformance tests. |
| E2 | Derivation time reported, labelled with the hardware, marked not-a-device measurement | **MET (documentation half); screen half waived** | `178 ms` matches `linux-fullstack-interop.log:27` and `poc.md:209`'s inline excerpt; labelled "desktop-class silicon; not a phone measurement" in both documents, with the harness caveat attached in both. |

### Contract and roadmap

| # | Criterion | Status | Evidence |
|---|---|---|---|
| F1 | Every `docs/vault-format.md` defect fixed or recorded; M4's W5 and W6 addressed | **MET** | I re-checked all five corrections against `src/` this pass, line by line: `addPinned` charges `estimateTokens("Pinned")` before the loop and always keeps the first item; `addLatestHandoff` tests item+label as one sum; `addTypeSections` charges `estimateTokens(type)` — the lowercase wire name — folded into the first candidate; `items.find(type === "handoff" && !included.has(id))` is exactly "newest handoff not already in Pinned"; `header + parts.join("\n")` matches the documented concatenation block. W7 recorded-not-fixed with its reason. |
| F2 | §13's table gains rows for what executed, with the same scoping precision as its existing rows | **MET** | The lead-in (`:521–530`) plus per-row ⚠ on exactly the four harness-derived rows and on no CI row. |
| F3 | `docs/SPEC.md` §2 Out line and §10b pointer corrected | **MET** | `:31` splits the fused clause and `§10b` separates what CI proved from what stays permanently unmeasured; both match `poc.md`. No milestone number assigned, per P-4b. |
| F4 | Kept tree: location stated, non-authoritative scaffolding declared | **MET** | `poc.md:9–11`, `:409–410`; `valija-mobile/README.md` agrees; the runbook clones `-b feat/poc` and says why. |
| F5 | Amalgamation version, SHA-256, compile flags recorded; licence satisfied; no unauthorised CI/dependency | **MET** | Re-hashed this pass: `node_modules/better-sqlite3-multiple-ciphers/deps/sqlite3/sqlite3.c` and `valija-mobile/vendor/sqlite3mc/sqlite3.c` are both `670d8d05…98b9`, the recorded value. `valija/.github/` untouched. |

**Score: 25 met, 5 not met** — A7, C1, C2, C4 and D2's screen half. C1, C2, D2 and C4's device half
are superseded by Oscar's amendment recorded in `refined.md:470–488` and `plan.md:5–11`; A7's
residual and C4's CI/working-tree half are disclosed at the point of claim in the idiom §9's
claim-scoping criterion demands. **A8 flipped to met this pass**, which is the criterion that
actually governs an evidence advance: no claim in the shipped prose is now stated more broadly
than its evidence.

---

## 2. Plan compliance

Slices 1–8 and 10 are evidenced; Slice 9 is skipped by Oscar's recorded amendment. Deviations, all
disclosed:

- **Slice 7 step 46** — the planned iOS boot/install/launch/screenshot steps were never
  implemented; `ci.yml`'s `ios` job stops at `linkDebugFrameworkIosArm64`. Named as the cause of
  the missing screenshots (`:356`) and of G6 (`:64`, `:373–380`, `:401–407`).
- **Slice 8 step 49** — `evidence/` never received `android-permissions.txt`, any CI log, or the
  two `.log` files the plan lists in its §9 tree. Now disclosed in `poc.md` §8 rather than left to
  a reader to discover from `git ls-files`. `plan.md`'s own §9 tree still lists
  `jvm-conformance.log` as a shipped artifact; the plan is the pre-execution document and `poc.md`
  §8 is the record, so I do not treat that as a live claim — but see S2-5.
- **Slice 6 step 45 / Slice 10 step 58** — the read-only greps and the three final gate outputs are
  still not pasted into `poc.md`. I ran all of them myself this pass and they hold, so no criterion
  turns on it.
- **D-2** — `valija-mobile`'s `feat/poc` is still unmerged into its `main`; the runbook clones the
  branch explicitly and says why.

---

## 3. Hard gates

| Gate | Result |
|---|---|
| Security surface weakened (secrets/keys logged, plaintext to disk, KDF/keychain use altered, SQLCipher unkeyed, MCP over-exposed) | **PASS** — re-checked against the trees, not the prose. Zero `src/` change; MCP diff empty; the format contract's crypto sections untouched; no keychain/keystore/prefs API anywhere in the PoC; the only `println`s carry Argon2id parameters and the verdict; `sqlite3_open_v2(…READONLY)` → `PRAGMA cipher='sqlcipher'` → `PRAGMA key` → `SELECT count(*)`; no `journal_mode`, no `wal_checkpoint`, no DDL/INSERT, no migration; zero effective Android permissions, no ATS key on iOS; only published fixture values in every committed file (no `manifest.keyHex` anywhere in `poc.md`). |
| Tests present for new behaviour; suite passing | **PASS** — no `valija` behaviour changed; 48 files / 241 tests green; typecheck and lint clean. Each new contract rule is backed by an assertion in `GoldenVaultConformanceTest` (10 `@Test`s) and by the pre-existing `vault-format-conformance.test.ts`. |
| Advance ritual evidenced | **PASS** — `refined.md:3` `Approved: Oscar 2026-07-31`; `plan.md:3` `Approved: Oscar 2026-08-01`; both 2026-08-16 amendments dated, attributed to Oscar and additive; this `review.md`, now five passes deep (2–5 verbatim). |
| Naming, placement, clean-architecture conventions | **PASS** — `valija`'s diff is documentation and evidence only. In `valija-mobile` the CLAUDE.md mapping holds: kind-named subfolders throughout (`domain/{entities,values,services}`, `application/{ports,use-cases}`, `delivery/`, `infra/{sqlite,argon2,files}`), only `domain/VaultError.kt`, `shared/UseCase.kt` and `shared/Result.kt` at a layer root (the standing exceptions), tech-named adapters (`Sqlite3mcVaultReader`, `Argon2idKeyDeriver`), `parseX → Result` at every file boundary. One carried placement nit at S8-5. |

**No hard gate is breached, and no acceptance criterion is breached that the recorded closure or
an explicit disclosure does not cover. Verdict: PASS.**

---

## 4. Issues

### Critical

None.

### Warning

**W1-5 — the one sentence in this fix that lost the word it needed.** `poc.md:196–198`:

```
**Only the Argon2id timing has no independent source** — 178 ms is the sole committed number
in this advance, and it rests solely on this unreproducible harness.
```

`poc.md:53` and `docs/vault-format.md:555` both say "the only **Argon2id** number recorded in this
advance", which is exactly right. §4 dropped the qualifier, so as written it says 1887 and 967 —
published in §2, in §4's own excerpt and in the contract document's §13 table — are not committed
numbers. This under-claims rather than over-claims, so it is not an A8 breach and it does not hold
the merge; but §4 is the section every ⚠ in two documents points a reader to, and it is the third
consecutive pass in which a single §4 sentence disagreed with the rest of the advance. *Fix (one
word):* "…is the sole committed **Argon2id** number in this advance".

**W2-5 — the reason given for not committing the logs is wrong on the facts, and it is now written
into the permanent record.** `poc.md:214–218` (and the commit message) justify the omission as
scope: the diff is "deliberately scoped to exclude anything outside `advances/MOBILE/**`,
`docs/vault-format.md`, `docs/SPEC.md`, and `CHANGELOG.md` (**§9's acceptance criteria**)". §9's
first criterion (`refined.md:664–665`) is a *denylist*, not an allowlist: it forbids `src/`,
`package.json`, `tsup.config.ts`, `tsconfig*.json` and `.github/workflows/ci.yml`, and says nothing
about `.gitignore`. The allowlist being cited lives in `plan.md:577–579` (Slice 10 step 58), a
self-imposed final gate check. So `git add -f` on the two logs, plus a `!advances/**/evidence/*.log`
negation, would have breached no acceptance criterion — it would have deviated from the plan's own
closing check, which is a smaller thing and is the kind of deviation §2 above already records
several of. This does not change the verdict: pass 4 offered disclosure as an equally acceptable
route, Oscar chose "close with disclosed caveats", and the disclosure that landed is accurate. But
the citation is wrong and it will be quoted by whoever revisits this. *Fix:* attribute the scope
limit to `plan.md` step 58, or drop the parenthetical. *And, for the next advance that captures
evidence:* the `*.log` rule in `.gitignore:4` silently swallowed two artifacts for four review
passes. A one-line negation is the durable fix and it belongs to whichever advance next touches
repo config.

**W3-5 (carried W4-4) — `valija-mobile` still points readers at an artifact that does not exist.**
`composeApp/src/androidMain/AndroidManifest.xml:8` says the `aapt2` output "is committed as
evidence (`advances/MOBILE/evidence/android-permissions.txt` in valija)". It is not, and `poc.md`
§8 now says so. Out of this diff, so non-blocking — but it is a two-line comment fix in a repo the
ship step touches anyway, and it is the same defect class C2-4 was.

**W4-5 (carried W5-4) — a copy-paste artifact in the contract document.**
`docs/vault-format.md:556`'s `WRONG_PASSPHRASE` row still reads "⚠ number from the unreproducible
harness, but independently corroborated". That row publishes no number; the phrasing came from
`poc.md:54`, where "the *number* above" refers to the G5 row directly above it. *Fix:* "result
from the unreproducible harness".

**W5-5 (carried A7) — the CI toolchain versions are unrecorded and, for the NDK, unrecoverable in
principle.** `valija-mobile` pins no `ndkVersion`, so AGP took whatever the runner image carried;
the macOS image, Xcode version and simulator runtime were never pulled down either. Disclosed at
the point of every affected claim, which is why this is a warning and not a criterion breach — but
it is the reason A7 cannot be marked met, and one line in §8 saying the NDK version is
unrecoverable *even in principle* is cheaper than rediscovering it.

### Suggestion

- **S1-5** — `poc.md:191`'s bare "The log below (`evidence/linux-fullstack-interop.log`)" is the
  one reference of four that does not carry the three-word tag. It asserts nothing false, and the
  disclosure follows 23 lines later in the same section; adding "(not committed — see §8)" makes
  the section self-contained.
- **S2-5** — `plan.md:291`, `:516` and `:1018` still list `jvm-conformance.log` as a shipped
  evidence file. The plan is the pre-execution document and amending an approved plan is its own
  sensitivity, so I would not touch it — but the amendment block at `plan.md:5–11` is the natural
  place for one clause noting that Slice 8 step 49's `.log` artifacts never entered git.
- **S3-5 (carried S1-4)** — `poc.md:39` "The four bolded rows below say `NOT COLLECTED`": five rows
  are bolded, and `**G1**` at `:60` says PASS. `:44`'s sentence disambiguates it in prose; the
  visual cue still disagrees.
- **S4-5 (carried S3-4)** — §3a is numbered between §2 and §3. Renumber or drop the "a".
- **S5-5 (carried S4-4)** — `refined.md` §9 fixes the vocabulary as PASS/FAIL/**NOT ATTEMPTED**;
  `poc.md` uses `NOT COLLECTED`, `NOT RETRIEVED` and `NO`. One mapping line under §2's table makes
  A7 literally checkable instead of interpretively checkable.
- **S6-5 (carried S5-4)** — two rows are both labelled `G3a` (`:52` Linux JNI, `:58` Android
  emulator) at very different strengths; label the first "G3a (partial — same bridge, not the NDK)".
- **S7-5 (carried S6-4)** — `evidence/toolchain-versions.txt` still carries only the sandbox and
  `libs.versions.toml` values, while `plan.md` §9 designates it as where toolchain facts live; the
  repo-derivable CI facts (API 34, `x86_64`, `google_apis`) exist only in `poc.md` §2. Three lines.
- **S8-5 (carried S7-4)** — `poc.md:59` cites "Compose Multiplatform 1.7.3" as the toolchain behind
  `:vault-interop:iosSimulatorArm64Test`, which does not depend on Compose at all.
- **S9-5 (carried S8-4)** — placement nit in `valija-mobile`:
  `composeApp/src/commonMain/kotlin/dev/valija/poc/GoldenVaultBundleLoader.kt` is bundle-resource IO
  sitting at the module package root beside `App.kt`, while its sibling `FixtureSnapshot` correctly
  lives in `infra/files/`. `infra/bundle/GoldenVaultBundleLoader.kt` matches CLAUDE.md's
  kind-named-subfolder rule; `RunGoldenVaultConformance.GoldenVaultBundle` would read better as
  `application/dto/GoldenVaultBundle.kt`.
- **S10-5 (carried S9-4)** — `docs/vault-format.md:7–8` still points a second implementer at "the
  read-only mobile companion described in `advances/M4/refined.md`", now that no such companion is
  planned. `docs/SPEC.md` §2 and §10b were updated; this pointer was not.

---

## 5. Why this is a PASS, stated plainly

Five acceptance criteria are unmet and this still passes, so the reasoning should be on the record
rather than inferred:

1. **C1, C2, D2's screen half and C4's device half** are not gaps in the work — they are gaps the
   spec itself now declares, in `refined.md:470–488`, an amendment Oscar wrote, dated and signed
   after Gate R. The spec wins, and the amended spec says those runs will not happen.
2. **A7's residual and C4's remaining half** are unmet in letter and disclosed in substance. The
   criterion that exists to police exactly this — A8, "no claim is stated more broadly than its
   evidence" — is met for the first time in five passes, and I checked it by reading every mobile
   claim in all four shipped documents and re-verifying the four `valija-mobile` citations, the two
   byte counts, the amalgamation hash and the seven fixture hashes against the trees.
3. **No hard gate is near breach.** The security surface is not merely unchanged, it is unchanged
   in a diff that contains zero lines of code.

What genuinely improved this pass: §4 no longer contradicts §2 or the contract document, and the
advance stopped describing two files as evidence it does not have. That second fix is the one worth
naming — for four passes this advance's most-cited non-CI result was read off a working tree nobody
else will ever have, and the document now says so at every point it matters. The remaining
warnings are one missing word, one wrong citation, and two stale comments; none of them changes
what a reader would conclude, and none of them is worth another round. Ship it.

---

# MOBILE — review (fourth pass, retained for history)

(Verdict at the time: FAIL. Reviewed `docs/mobile-poc-MOBILE` @ `848da54`.)

Reviewed `docs/mobile-poc-MOBILE` @ `848da54` against `main` (`git diff main...HEAD`, base
`543d2fe`), working tree clean. Re-reviewed from scratch, not as a diff of `848da54`. The third and
second passes are retained verbatim below.

**Line count:** 8 files changed, 572 insertions(+), 14 deletions(-), excluding this `review.md`
(9/1201/14 including it). No `src/` line, no `package.json`, no build config, no `.github/`.

**What I could check.** `/workspace/valija-mobile` is attached at `feat/poc` @ `644e4e1` — the exact
commit `poc.md` §3a cites for run #11 — so every claim about the PoC code, its CI workflow and its
tests is checkable, and I checked them against the tree rather than against `poc.md`'s description
of them. Run #11's `conclusion: success` remains the one assertion I cannot independently confirm.

**Bottom line.** Two of pass 3's three criticals are fully fixed and the third is fixed in two of
its three places. What holds the merge is (a) the one sentence the third-pass fix missed, which now
makes `poc.md` contradict itself about the same three facts, and (b) something no earlier pass
caught: **the two evidence logs this advance points at are `.gitignore`d and have never been
committed to this repository, on any branch, in any commit.** After merge, `advances/MOBILE/evidence/`
contains two `.txt` files and nothing else, while `poc.md` §4 and §8 describe two `.log` files that
a reader will not find. Both fixes are small and neither requires recovering anything.

---

## 0. Disposition of pass 3's findings

| Pass 3 | Now | Verdict |
|---|---|---|
| **C1-3** — `docs/vault-format.md`'s four harness-derived rows published bare `PASS` with no provenance caveat and no pointer to `poc.md` §4 | The §13 lead-in (`docs/vault-format.md:545–548`) now states the harness "was never committed to `valija-mobile` and cannot be re-run from either repository as it stands — see `poc.md` §4", and all four rows (`:554–557`) carry ⚠. I verified the marker is on exactly the four rows sourced from the harness and on none of the CI rows | **FIXED** |
| **C2-3** — the `WRONG_PASSPHRASE` and no-sidecar rows falsely claimed to be uncorroborated; "the only Argon2id timing" wrong | `poc.md:54–55` and `docs/vault-format.md:556–557` are corrected, and every citation checks out against the tree: `AndroidVaultConformanceTest.kt:90–93` (sidecars), `:97–103` (`WRONG_PASSPHRASE`), `IosVaultConformanceTest.kt:102–108` (`WRONG_PASSPHRASE`), `:62` (the emulator Argon2id print). `:53` now says "the only *committed*" number. **But §4's own caveat (`poc.md:192–196`) was not touched** and still names those two checks as resting solely on unreproducible evidence | **NOT SATISFIED** (C1-4) |
| **C3-3** — `155–178 ms` sourced nowhere | `grep -rn "155"` over `poc.md`, `docs/vault-format.md`, `docs/SPEC.md`, `CHANGELOG.md` and `evidence/` returns nothing. Both publication sites now read `178 ms`, which is the number in `linux-fullstack-interop.log:27` and in `poc.md:207`'s quoted excerpt | **FIXED** |
| **W1-3** — §10 lumped G6 in with the device-gated gaps (you asked me to confirm this one) | `poc.md:395–401` now reads "**G1 (physical), G2 and G5** … closed as **not collected**, by this closure decision. **G6** is also **not collected**, but for a different reason: the CI screenshot step that would have closed it (`plan.md` step 46) was never implemented, independent of this decision". That matches §2 (`:42–44`) and §9 (`:366–374`). All four places now agree | **CONFIRMED FIXED** (one wording nit, S1-4) |
| **W2-3** — the `toolchain-versions.txt` row blamed blocked network access, contradicting §3a (you asked me to confirm this one) | `poc.md:347` now reads "The run's overall conclusion was reachable via the GitHub Actions API (§3a) and confirmed `success`; the finer-grained log detail that would carry these versions was not pulled down and committed, as part of the same closure decision as the row below". No contradiction with `:98–101` or `:351` remains; the reason given is the decision, not an inability | **CONFIRMED FIXED** |

---

## 1. Acceptance criteria (`refined.md` §9)

### Applies under every option

| # | Criterion | Status | Evidence |
|---|---|---|---|
| A1 | No `src/`, `package.json`, `tsup.config.ts`, `tsconfig*.json`, `.github/` in the diff | **MET** | `git diff main...HEAD --stat -- src/ package.json tsup.config.ts tsconfig*.json .github/` → empty. Changed: `CHANGELOG.md`, `advances/MOBILE/{plan,poc,refined,review}.md`, two `evidence/*.txt`, `docs/SPEC.md`, `docs/vault-format.md`. |
| A2 | No change to format, crypto, KDF params, key format, SQLCipher config, `vault.json` | **MET** | `docs/vault-format.md` §§3–6 untouched; only §8/§9/§13 prose. |
| A3 | MCP surface byte-for-byte unchanged | **MET** | `git diff main...HEAD -- src/delivery/mcp/` → 0 lines. |
| A4 | No network/telemetry/analytics/cloud SDK in any app artifact | **MET** | Re-verified in the tree this pass: `libs.versions.toml` holds Kotlin, AGP, Compose MP, serialization, activity-compose, test runner and nothing network-capable; `AndroidManifest.xml:22–24` declares only a `tools:node="remove"` of the transitive self-scoped `androidx.core` permission; `Info.plist` has no ATS key; `valija_native.c` opens no socket. |
| A5 | `typecheck && lint && test` pass unchanged; CI matrix not slowed or gated | **MET** | Ran all three this pass: `tsc --noEmit` clean; biome "Checked 146 files… No fixes applied" (1 pre-existing config-migration *info*); vitest **48 files / 241 tests passed**. No workflow file touched. |
| A6 | Every value from the golden fixture; no real vault/passphrase/key/content anywhere | **MET** | Re-hashed all 7 vendored fixture files against `src/testing/__fixtures__/golden-vault/` — identical, zero drift. Both logs contain only fixture-derived output. |
| A7 | PASS/FAIL/NOT ATTEMPTED per §3 question **with the hardware, OS version, and toolchain version** | **NOT MET — waived by the recorded closure** | Every G1–G7 question has a row; the CI rows carry what the repo can prove and name what is missing at the point of claim (`poc.md:56`, `:57`, `:59`). NDK/Xcode/macOS-image/simulator-runtime remain unrecorded. Unchanged from pass 3; not a flip-blocker. |
| A8 | Explicit claim-scoping section; no claim stated more broadly than its evidence | **NOT MET** | §3 (`:148–180`) and the new ⚠ discipline are good. But `poc.md:192–196` contradicts `:54–55` and `docs/vault-format.md:556–557` about the same three facts (C1-4), and §4 `:212` plus §8 `:344–345` assert the existence of two evidence files that this branch does not contain (C2-4). One under-claim, one over-claim; both fail this criterion. |
| A9 | No sentence describes a macOS/Linux/x86_64 run as an iOS/arm64 run | **MET in the shipped prose** | Re-read `poc.md`, `docs/vault-format.md` §13, `docs/SPEC.md:31`/§10b and the `CHANGELOG.md` entry: every mobile claim carries "simulator"/"emulator"/"x86_64" at the point of claim. `poc.md:53`'s new "device-class (emulator)" is imprecise in the wrong direction but names the emulator inline — W1-4, not an A9 breach. |

### The app itself

| # | Criterion | Status | Evidence |
|---|---|---|---|
| B1 | Single-screen app per platform, shared Kotlin core, amalgamation only behind one port | **MET** | `:vault-core` has no `expect`/`actual` and no platform API; `:vault-interop` is the only module that names C; `composeApp/App.kt` calls `RunGoldenVaultConformance`, never the port. Enforced by the module graph. |
| B2 | Sandbox copy; bundled bytes unchanged; no `-wal`/`-shm`/`-journal` | **MET** | `RunGoldenVaultConformance.execute()` snapshots before opening; `infra/files/FixtureSnapshot` refuses on a sidecar; `AndroidVaultConformanceTest.kt:39–45,90–93` re-proves both halves on the emulator — and `poc.md:55` now says so correctly. |
| B3 | No journal pragma, migration, lineage write or device identity in the PoC source | **MET** | My grep over the whole tree returns only comments *naming their absence* (`valija_native.c:6`, `Sqlite3mcDatabase.kt:15`) and the `SCHEMA_TOO_NEW` refusal paths. |
| B4 | Derived key never written to keychain/keystore/prefs/file/log | **MET** | Zero hits for `Keychain`/`Keystore`/`UserDefaults`/`SharedPreferences`/`SecItem` outside `vendor/`; both `Argon2idKeyDeriver` actuals zero the raw key and passphrase bytes; `valija_native.c` `memset`s the `PRAGMA key` buffer on every path; the only three `println`s print the Argon2id milliseconds and the verdict line. |
| B5 | Zero network requests, verified by source **and declared capabilities of both binaries** | **MET in substance, unevidenced in this repo** | I verified both declarations myself (A4). `advances/MOBILE/` records neither: no `android-permissions.txt`, no mention of `Info.plist`. W4-4 (carried, non-blocking). |

### Execution evidence (G1, G2, G3, G6)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| C1 | Screenshot from a **booted iOS simulator**, committed | **NOT MET — disposed of honestly** | Re-verified against `ci.yml`: no job takes a screenshot and no job launches `:composeApp`. `poc.md:350` records permanent non-collection with the true reason. Waived by the closure. |
| C2 | Screenshot from a **booted Android emulator or device** | **NOT MET — same disposition** | Same. |
| C3 | Interop exercised per platform through its own mechanism, both recorded | **MET** | Visibly different code paths: hand-written JNI bridge (`androidMain/cpp/valija_native.c`) vs. cinterop `.def` with no hand-written C. `poc.md:58–59` records both. |
| C4 | Run logs, **including exit codes**, committed | **NOT MET, and the disposition is now inaccurate** | The CI-log gap is disclosed at `poc.md:351` and that row is honest. But the two logs the advance *claims to have* — `evidence/jvm-conformance.log`, `evidence/linux-fullstack-interop.log` — are matched by `.gitignore:4` (`*.log`), are absent from `git ls-files`, and have never been added in any commit on any branch (`git log --all --diff-filter=A -- '*.log'` → empty). `git ls-tree -r HEAD advances/MOBILE/` lists only the two `.txt` files. C2-4. |
| C5 | Android result states arm64 vs x86_64 plainly; x86_64 ⇒ G2 still open | **MET** | `poc.md:56`, `:58`, `:63`, `:161–164`; `docs/vault-format.md:558`; the CI job is literally named "Android build + x86_64 emulator (NOT arm64 evidence)". |

### Conformance (G4, G7)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| D1 | JVM byte-compare against `expected-export.md`, passing | **MET** | `GoldenVaultConformanceTest` has exactly 10 `@Test`s; `expected-export.md` = 1887 B and `expected-pack.md` = 967 B on disk, the numbers `poc.md:50` claims. (The log that corroborates the run is subject to C2-4.) |
| D2 | Same comparison on device, shown on screen and in the exit status | **NOT MET (screen half)** | The screen half exists in `App.kt` and was never captured on any target; the exit-status half exists in CI and is not verifiable from this repo. |
| D3 | Byte comparison, not a snapshot, not normalised | **MET** | `PackConformance.compareRendered` is a `ByteArray` loop with a first-difference index. |
| D4 | `estimateTokens` counts UTF-16 code units, asserted by a test | **MET** | Asserts `"𝄞".length == 2`; documented at `docs/vault-format.md:309–317`. |

### Argon2id (G5)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| E1 | Derived key equals `manifest.keyHex`, asserted in code | **MET off-device; N/A on-device by amendment** | Asserted before opening in all three conformance tests (JVM, Android instrumented, iOS). |
| E2 | Derivation time reported, labelled with the hardware, marked not-a-device measurement | **MET (documentation half); screen half waived** | Pass 3's fabricated range is gone. `178 ms` is the number in `poc.md:207`'s quoted excerpt, labelled "desktop-class silicon; not a phone measurement" in both documents. Two residual wording defects, neither fatal to this criterion: "the only *committed* Argon2id number" is undercut by C2-4, and "device-class (emulator)" is wrong (W1-4). |

### Contract and roadmap

| # | Criterion | Status | Evidence |
|---|---|---|---|
| F1 | Every `docs/vault-format.md` defect fixed or recorded; M4's W5 and W6 addressed | **MET** | All five corrections still check out against `src/context/domain/services/context-pack.ts` and `src/delivery/context-pack-markdown.ts`; W7 recorded-not-fixed with a reason. |
| F2 | §13's table gains rows for what executed, with the same scoping precision as its existing rows | **MET** | `:545–548` lead-in plus per-row ⚠ at `:554–557`. This is pass 3's C1-3, done. (That the document it points at contradicts two of those rows is charged to A8.) |
| F3 | `docs/SPEC.md` §2 Out line and §10b pointer corrected | **MET** | `:31` and §10b separate what is proven (interop path, CI level) from what is permanently unmeasured (on-device Argon2id latency, Android arm64). Accurate against `poc.md`. |
| F4 | Kept tree: location stated, non-authoritative scaffolding declared | **MET** | `poc.md:9–11`, `:403–404`; `valija-mobile/README.md` agrees; the runbook clones `-b feat/poc`. |
| F5 | Amalgamation version, SHA-256, compile flags recorded; licence satisfied; no unauthorised CI/dependency | **MET** | Re-hashed this pass: `sha256(valija-mobile/vendor/sqlite3mc/sqlite3.c)` == `sha256(node_modules/better-sqlite3-multiple-ciphers/deps/sqlite3/sqlite3.c)` == the recorded `670d8d05…98b9`. `THIRD-PARTY-NOTICES.md` carries both licences; `valija/.github/` untouched. |

**Score: 24 met, 6 not met** — A7, C1, C2 and D2's screen half are waived-and-disclosed by Oscar's
closure; **A8 and C4 are genuinely open**, and both trace to the two issues below. E2 and F2 flipped
to met this pass.

---

## 2. Plan compliance

Slices 1–8 and 10 are evidenced; Slice 9 is skipped by Oscar's recorded amendment (`plan.md:5–11`,
`refined.md:470–488`). Deviations not covered by that amendment, all carried and all now disclosed
except the last:

- **Slice 7 step 46** — the planned iOS "boot, install, launch, `xcrun simctl io booted screenshot`"
  steps were never implemented; `ci.yml`'s `ios` job stops at `linkDebugFrameworkIosArm64`. Now
  correctly and consistently named as the cause of the missing screenshots (`:350`) and of G6
  (`:64`, `:366–374`, `:395–401`) — pass 3's W1-3 is closed.
- **Step 49** — `evidence/` still lacks `android-permissions.txt` and any CI log; disclosed at `:351`.
- **Steps 45 and 58** — the read-only/no-keychain greps and the three final gate outputs are still
  not pasted into `poc.md`. I ran all of them myself and they hold, so no criterion turns on it.
- **Step 49, the part nobody noticed** — the plan says `evidence/` gets `jvm-conformance.log` and
  (by §9's tree) the run logs. They were written to the working tree but never entered git, because
  `.gitignore:4` silently swallows `*.log`. The slice reads as done and is not. C2-4.
- **D-2** — `valija-mobile`'s `feat/poc` is still unmerged into its `main`; scheduled for ship, and
  the runbook works around it.

---

## 3. Hard gates

| Gate | Result |
|---|---|
| Security surface weakened (secrets/keys logged, plaintext to disk, KDF/keychain use altered, SQLCipher unkeyed, MCP over-exposed) | **PASS** — re-checked against the app tree, not the prose. Zero `src/` change; MCP diff empty; §§4–6 of the format contract untouched; raw key and passphrase bytes zeroed in both `Argon2idKeyDeriver` actuals; the `PRAGMA key` buffer `memset` in C; no keychain/keystore/prefs API anywhere; `sqlite3_open_v2(…READONLY)` → `PRAGMA cipher='sqlcipher'` → `PRAGMA key` → `SELECT count(*) FROM sqlite_master` in the documented order; no `journal_mode`, no `wal_checkpoint`, no DDL/INSERT, no migration; zero effective Android permissions; only published fixture values anywhere, including both logs. |
| Tests present for new behaviour; suite passing | **PASS** — no `valija` behaviour changed; 48 files / 241 tests green; typecheck and lint clean. Each new contract rule is backed by a Kotlin assertion in `GoldenVaultConformanceTest` and by the pre-existing `vault-format-conformance.test.ts`. |
| Advance ritual evidenced | **PASS** — `refined.md:3` `Approved: Oscar 2026-07-31`; `plan.md:3` `Approved: Oscar 2026-08-01`; both 2026-08-16 amendments dated, attributed and additive; this `review.md`. |
| Naming, placement, clean-architecture conventions | **PASS** — `valija`'s diff is docs-only. In `valija-mobile` the CLAUDE.md mapping holds: kind-named subfolders throughout (`domain/{entities,values,services}`, `application/{ports,use-cases}`, `infra/{sqlite,argon2,files}`), only `domain/VaultError.kt`, `shared/UseCase.kt`, `shared/Result.kt` at a layer root (the standing exceptions), tech-named adapters, `parseX → Result` at boundaries. One placement nit carried at S8-4. |

**No hard gate is breached.** The FAIL is on acceptance criteria A8 and C4 — the accuracy of the
disclosure and the existence of the evidence it points at.

---

## 4. Issues

### Critical

**C1-4 — §4's provenance caveat still says the opposite of what §2 and the contract document now
say, about the same three facts.** The fix commit corrected `poc.md:54`, `:55` and
`docs/vault-format.md:556–557`, but left `poc.md:192–196` untouched:

```
§2 marks every row that depends on it. Where a row is
also independently established elsewhere in this document (G3a, via the Android CI emulator run
at a stronger tier — real NDK, not this harness's plain JNI), that independent evidence stands on
its own; where it is not (the Argon2id timing, the `WRONG_PASSPHRASE` check, the no-sidecar
check), the claim rests solely on unreproducible evidence and should be weighted accordingly.
```

`:54` now says the `WRONG_PASSPHRASE` check *is* "independently corroborated at a stronger tier",
`:55` says the same of the no-sidecar check, and `docs/vault-format.md:556–557` repeat it — and I
verified all four citations in the tree, so §2 is the correct half. §4 is the section every ⚠ in
both documents points a reader to; it is the one place where being wrong propagates everywhere.
Pass 3's flip condition named `:195–196` explicitly and it was the one edit of the three that did
not land. *Fix (one clause):* "…where it is not (the Argon2id timing), the claim rests solely on
unreproducible evidence; the `WRONG_PASSPHRASE` and no-sidecar checks are independently asserted at
a stronger tier by `AndroidVaultConformanceTest.kt:90–93,97–103` and `IosVaultConformanceTest.kt:102–108`
in run #11."

**C2-4 (new; no earlier pass caught it) — the two evidence logs are `.gitignore`d and have never
been committed, while `poc.md` presents them as files in `advances/MOBILE/evidence/`.**

```
$ git check-ignore -v advances/MOBILE/evidence/*.log
.gitignore:4:*.log	advances/MOBILE/evidence/jvm-conformance.log
.gitignore:4:*.log	advances/MOBILE/evidence/linux-fullstack-interop.log

$ git ls-tree -r HEAD --name-only advances/MOBILE/evidence/
advances/MOBILE/evidence/sqlite3c-sha256.txt
advances/MOBILE/evidence/toolchain-versions.txt

$ git log --all --diff-filter=A --name-only -- '*.log'      # empty: never added, ever
```

They exist only in this working tree. Against that, `poc.md:212` says "Full log:
`evidence/linux-fullstack-interop.log`", and §8's evidence table (`:344–345`) describes both files
in the present tense, in a table whose other rows say `NOT COLLECTED` or `NOT RETRIEVED` when
something is absent — so the contrast actively tells a reader these two are present. They will not
be. This is the same defect class as pass 3's W5-3 (documents pointing at artifacts that do not
exist), except here it is this repo's own primary deliverable, in an advance whose entire output is
`poc.md` + `evidence/`, and it silently voids `plan.md` Slice 8 step 49.

It also undercuts the C3-3 fix: `poc.md:53` and `docs/vault-format.md:555` both now describe
`178 ms` as "the only **committed** Argon2id number", when the file it is read from is precisely
what is not committed. The number does survive — `poc.md:207` quotes the three relevant lines
inline — but the word is wrong and the log's `BUILD SUCCESSFUL` / per-test PASSED lines, which are
the only exit-status-shaped evidence in the whole advance, ship nowhere.

*Fix (one command, no recovery needed):*
`git add -f advances/MOBILE/evidence/jvm-conformance.log advances/MOBILE/evidence/linux-fullstack-interop.log`,
and — because this will happen again to the next advance that captures a log — add
`!advances/**/evidence/*.log` to `.gitignore` so evidence is never silently dropped. If instead the
decision is that they do not ship, then say that in §8 in the same register as the CI-log row, drop
`:212`'s "Full log:" pointer, and remove "committed" from `poc.md:53` and
`docs/vault-format.md:555`. The first option is obviously better: it costs 2.6 KB and turns the
advance's most-cited non-CI result into something a stranger can read.

### Warning

**W1-4 — "device-class (emulator) timing" is wrong in the overclaiming direction.** `poc.md:53` says
`AndroidVaultConformanceTest.kt` "prints a device-class (emulator) timing on every green CI run".
The Android CI job is an x86_64 emulator on `ubuntu-latest`; an Argon2id run inside it is bounded by
the runner's own desktop-class CPU and memory, not by phone hardware. It is the *same class of
measurement* as the 178 ms number, not a step toward the phone measurement §2 marks `NOT COLLECTED`.
In the one document written to keep exactly this distinction, "device-class" is the wrong word.
*Fix:* "also prints an emulator timing (the CI host's x86_64 CPU, not phone hardware)".

**W2-4 (carried W3-3) — §9's "Established" paragraph, the one a skimmer reads, still credits the
unreproducible run with no marker.** `poc.md:358–361`: "demonstrated on Linux/x86_64 with the same
sources the mobile builds use". The sentence survives on its CI half alone, so it is not an
overclaim — but the ⚠ discipline now applied in two documents exists so the Linux half is never
cited bare. One parenthetical.

**W3-4 (carried W4-3, and more pressing under C2-4) — the log calls the Linux sandbox
"device-equivalent hardware".** `evidence/linux-fullstack-interop.log:26,29`. Not editing a
transcript is right. But if C2-4 is fixed by committing it, that phrase becomes a shipped sentence
in exactly the register A9 forbids, uncontradicted anywhere. One clause in §8's row closes it:
"the test name in that log calls the Linux sandbox 'device-equivalent hardware'; it is not — see
§2's G5 row".

**W4-4 (carried W5-3) — `valija-mobile` still points readers at two artifacts that do not exist.**
`composeApp/src/androidMain/AndroidManifest.xml:8` cites
"`advances/MOBILE/evidence/android-permissions.txt` in valija"; `PackConformance.kt` cites "the
committed screenshots". Out of this diff, so non-blocking — but it is a two-line comment fix in a
repo the ship step touches anyway, and C2-4 shows how this class of claim ages.

**W5-4 — a copy-paste artifact in the contract document.** `docs/vault-format.md:556`'s
`WRONG_PASSPHRASE` row reads "⚠ number from the unreproducible harness, but independently
corroborated". That row has no number; the phrasing came from `poc.md:54`, where "the *number*
above" refers to the G5 row directly above it. In `docs/vault-format.md` the row above is the
Argon2id one, so the sentence reads as if this row published a figure. *Fix:* "⚠ result from the
unreproducible harness, but independently corroborated…".

### Suggestion

- **S1-4** — `poc.md:397` calls it "the CI screenshot step that would have closed it"; a screenshot
  does not close G6, launching the app process does. `plan.md` step 46's boot/install/launch is the
  thing that was never built, and §2 (`:42–43`) says it correctly. Match §2's wording.
- **S2-4 (carried S1-3)** — `poc.md:39` "The four bolded rows below say `NOT COLLECTED`" — five rows
  are bolded; `**G1**` at `:60` is bold and says PASS. `:44`'s sentence disambiguates it in prose,
  but the visual cue and the sentence still disagree.
- **S3-4 (carried S2-3)** — §3a is numbered between §2 and §3. Renumber or drop the "a".
- **S4-4 (carried S3-3)** — `refined.md` §9 fixes the vocabulary as PASS/FAIL/**NOT ATTEMPTED**;
  `poc.md` uses `NOT COLLECTED` and `NO`. One mapping line under §2's table makes A7 literally
  checkable.
- **S5-4 (carried S4-3)** — two rows are both labelled `G3a` (`:52` Linux JNI, `:58` Android
  emulator) at very different strengths; label the first "G3a (partial — same bridge, not the NDK)".
- **S6-4 (carried S5-3)** — `evidence/toolchain-versions.txt` still carries only the sandbox and
  `libs.versions.toml` values while `plan.md` §9 designates it as where toolchain facts go; the
  repo-derivable CI facts (API 34, `x86_64`, `google_apis`) live only in `poc.md` §2. Three lines.
- **S7-4 (carried S6-3)** — `poc.md:59` cites "Compose Multiplatform 1.7.3" as the toolchain behind
  `:vault-interop:iosSimulatorArm64Test`, which does not depend on Compose at all.
- **S8-4 (carried S9-3)** — placement nit in `valija-mobile`:
  `composeApp/src/commonMain/kotlin/dev/valija/poc/GoldenVaultBundleLoader.kt` is bundle-resource IO
  at the module package root beside `App.kt`, while its sibling `FixtureSnapshot` correctly lives in
  `infra/files/`. `infra/bundle/GoldenVaultBundleLoader.kt` matches CLAUDE.md's
  kind-named-subfolder rule; `RunGoldenVaultConformance.GoldenVaultBundle` would read better as
  `application/dto/GoldenVaultBundle.kt`.
- **S9-4 (carried S8-3)** — `docs/vault-format.md:7–8` still points a second implementer at "the
  read-only mobile companion described in `advances/M4/refined.md`", now that no such companion is
  planned.
- **S10-4 (carried S7-3)** — worth one line in §8: the NDK version is unrecoverable *even in
  principle* from the kept tree, because `valija-mobile` pins no `ndkVersion` and AGP took whatever
  the runner image had. That is the reproducibility defect behind A7, cheaper to record than to
  rediscover.

---

## 5. What would flip this to PASS

1. **C1-4** — one clause in `poc.md:192–196`, so §4 stops contradicting `:54–55` and
   `docs/vault-format.md:556–557` about the `WRONG_PASSPHRASE` and no-sidecar checks.
2. **C2-4** — make `evidence/jvm-conformance.log` and `evidence/linux-fullstack-interop.log`
   actually exist in the commit (`git add -f`, plus a `!advances/**/evidence/*.log` negation in
   `.gitignore` so this cannot recur), **or** disclose in §8 that they are not committed, drop
   `:212`'s "Full log:" pointer, and stop calling `178 ms` "committed" in `poc.md:53` and
   `docs/vault-format.md:555`.

Nothing else holds the merge. W1-4 is strongly recommended in the same edit — "device-class
(emulator)" is the one phrase in the new text that drifts toward the register this advance was
written to avoid — and W3-4 becomes necessary if and only if C2-4 is fixed by committing the log.
W2-4, W4-4, W5-4 and every S-item are optional.

**Credit where it is due.** Two of three criticals are fully closed and I verified them rather than
accepting them: the ⚠ markers in `docs/vault-format.md` sit on exactly the four harness-derived rows
and on no CI row, the lead-in names the caveat and points at `poc.md` §4, and `155` is gone from
every file in the repo. The corroboration rewrite is not just a retraction — every one of the four
line citations it added (`AndroidVaultConformanceTest.kt:62`, `:90–93`, `:97–103`,
`IosVaultConformanceTest.kt:102–108`) is accurate against the attached tree, and the G5 row's new
"an emulator timing exists but was never extracted" sentence is a disclosure nobody asked for and
the advance is better for. Both warnings you asked me to confirm are genuinely fixed: §10 now splits
G6 out as a CI omission in the same terms as §2 and §9, and the `toolchain-versions.txt` row now
gives the true reason instead of the network one. What is left is one sentence that was missed and
one file-tracking accident — and the second is the more interesting of the two, because for four
review passes an entire class of this advance's evidence has been read off a working tree that no
one else will ever have.

---
---

# MOBILE — review (third pass, retained for history)

(Verdict at the time: FAIL. Reviewed `docs/mobile-poc-MOBILE` @ `b270262`.)

Reviewed `docs/mobile-poc-MOBILE` @ `b270262` against `main` (`git diff main...HEAD`), working tree
clean. Re-reviewed from scratch, not as a diff of `b270262`. The second pass is retained verbatim
at the bottom of this file.

**Line count:** 8 files changed, 567 insertions(+), 14 deletions(-), excluding this `review.md`
(9/901/14 including it). No `src/` line, no `package.json`, no build config, no `.github/`.

**What I could check.** `/workspace/valija-mobile` is attached at `feat/poc` @ `644e4e1` — the exact
commit `poc.md` §3a cites for run #11 — so every claim about the PoC code, its CI workflow and its
tests is checkable, and I checked them rather than reading `poc.md`'s description of them.
`api.github.com` is still unreachable from this session, so run #11's `conclusion: success` remains
the one assertion in this advance I cannot independently confirm.

**The question I was asked.** Does disclosure-instead-of-recovery satisfy the pass-2 fallbacks for
C1–C4? **C2, C3 and C4: yes.** **C1: no — the disclosure landed in `poc.md` and stopped at the
door of the contract document, and where it did land it states two things that are false.** That,
plus an unsourced number, is the whole of this FAIL. Everything else is a warning or a nit.

---

## 0. Pass-2 criticals under the disclosure route

| Pass 2 | Fallback I stated | Now | Verdict |
|---|---|---|---|
| **C1** — §4's harness cannot be reproduced | "say so plainly at the top of §4 and in §8 … and re-scope the four rows that cite it. **This one is not optional: an evidence advance may not publish a number into a contract document from a run nobody can re-execute.**" | §4's caveat (`poc.md:186–196`) and §8's row (`:345`) are exactly right and factually verified. The re-scoping of §2 is **half wrong**, and `docs/vault-format.md:551–554` — the contract document, the reason the critical was "not optional" — was **not touched at all** | **NOT SATISFIED** (C1-3, C2-3) |
| **C2** — no CI log, no exit code, no disposition | "commit the job logs … **or** add a §8 row stating plainly that they were not retrieved, what that costs a future reader, and when the links expire" | `poc.md:351` states all three: not retrieved / not committed, what a future reader is left with ("one hyperlink and an API-confirmed conclusion"), and the 90-day window dated 2026-08-16 | **SATISFIED** (one wording defect, W2-3) |
| **C3** — four stale statements | "clear the four remaining stale statements" | All four cleared and re-verified by a fresh scan: `poc.md:69–71` (restructured, past tense), `:92–95`, `:170–173`, `docs/vault-format.md:520–527` / `:626–630`. My own re-grep for future/present-tense device language finds no new offender | **SATISFIED** |
| **C4** — no OS/toolchain version on the CI rows | "put the OS and toolchain versions in §2's CI rows and in `evidence/toolchain-versions.txt`" | Everything derivable from the repo is now in §2 and I verified each value against source: API `34` / `x86_64` / `google_apis` (`ci.yml` `android` job), Kotlin `2.1.20`, AGP `8.7.3`, Compose MP `1.7.3`, compileSdk/targetSdk `35`, minSdk `24` (`gradle/libs.versions.toml`). The rest (NDK, Xcode, macOS image, simulator runtime) is disclosed as unrecorded at the point of each claim. I confirmed it is genuinely unrecoverable without the logs: `valija-mobile` pins no `ndkVersion` anywhere, and `ubuntu-latest`/`macos-latest` are floating labels | **SATISFIED by disclosure.** Refusing this while accepting C2's disclosure fallback would be incoherent — the missing values live inside exactly the logs C2 permitted you not to fetch |

---

## 1. Acceptance criteria (`refined.md` §9)

### Applies under every option

| # | Criterion | Status | Evidence |
|---|---|---|---|
| A1 | No `src/`, `package.json`, `tsup.config.ts`, `tsconfig*.json`, `.github/` in the diff | **MET** | `git diff main...HEAD -- src/ package.json tsup.config.ts tsconfig*.json .github/` → empty. Changed: `CHANGELOG.md`, `advances/MOBILE/{plan,poc,refined,review}.md`, two `evidence/*.txt`, `docs/SPEC.md`, `docs/vault-format.md`. |
| A2 | No change to format, crypto, KDF params, key format, SQLCipher config, `vault.json` | **MET** | `docs/vault-format.md` §§3–6 untouched; only §8/§9/§13 prose. |
| A3 | MCP surface byte-for-byte unchanged | **MET** | `git diff main...HEAD -- src/delivery/mcp/` → 0 lines. |
| A4 | No network/telemetry/analytics/cloud SDK in any app artifact | **MET** | Re-verified in the tree: `libs.versions.toml` holds Kotlin, AGP, Compose MP, serialization, activity-compose, test runner — nothing network-capable; `AndroidManifest.xml` declares no permission and `tools:node="remove"`s the transitive `androidx.core` one; `Info.plist` has no ATS key; `valija_native.c` opens no socket. |
| A5 | `typecheck && lint && test` pass unchanged; CI matrix not slowed or gated | **MET** | Ran all three this pass: `tsc --noEmit` clean; biome "Checked 146 files… No fixes applied" (1 pre-existing config-migration *info*); vitest **48 files / 241 tests passed**. No workflow file touched. |
| A6 | Every value from the golden fixture; no real vault/passphrase/key/content anywhere | **MET** | All 7 vendored fixture files are SHA-256-identical to `src/testing/__fixtures__/golden-vault/` (re-hashed file by file; `expected-search.json` is deliberately not vendored — search is out of scope per P-2 and recorded DEFERRED at `docs/vault-format.md:558`). Both committed logs contain only fixture-derived output. |
| A7 | PASS/FAIL/NOT ATTEMPTED per §3 question **with the hardware, OS version, and toolchain version** | **NOT MET — disposed of by disclosure** | Every G1–G7 question has a row. The CI rows now carry what the repo can prove and name what is missing at the point of the claim (`poc.md:56`, `:57`, `:59`). NDK/Xcode/macOS-image/simulator-runtime are still absent and now permanently unrecoverable if the logs expire. Vocabulary deviates (`NOT COLLECTED`, `NO`) with no mapping line — S3-3. I treat this as waived by the recorded closure, **not** as satisfied, and it is not a flip-blocker. |
| A8 | Explicit claim-scoping section; no claim stated more broadly than its evidence | **NOT MET** | §3 (`:148–180`) is still the document's best section and is now correctly past-tensed. But §2's row for the Argon2id timing, the wrong-key check and the read-only check state their scope *incorrectly* (C2-3), the contract document restates all four unqualified (C1-3), and `155` is sourced nowhere (C3-3). Two of those are narrower-than-evidence and one is broader; both directions fail the same criterion. |
| A9 | No sentence describes a macOS/Linux/x86_64 run as an iOS/arm64 run | **MET in the shipped prose** | Re-read `poc.md`, `docs/vault-format.md` §13, `docs/SPEC.md:31`/§10b and the `CHANGELOG.md` entry: every mobile claim carries "simulator"/"emulator"/"x86_64" at the point of claim. The one offender remains inside a committed transcript, not prose — W4-3. |

### The app itself

| # | Criterion | Status | Evidence |
|---|---|---|---|
| B1 | Single-screen app per platform, shared Kotlin core, amalgamation only behind one port | **MET** | `:vault-core` has no `expect`/`actual` and no platform API; `:vault-interop` is the only module that names C; `composeApp/App.kt` calls `RunGoldenVaultConformance` and never the port. The boundary is enforced by the module graph. |
| B2 | Sandbox copy; bundled bytes unchanged; no `-wal`/`-shm`/`-journal` | **MET** | `RunGoldenVaultConformance.execute()` snapshots before opening; `infra/files/FixtureSnapshot` refuses on a sidecar; **and** `AndroidVaultConformanceTest.kt:39–45,90–93` re-proves both halves on the emulator — which is precisely the corroboration `poc.md:55` denies exists (C2-3). |
| B3 | No journal pragma, migration, lineage write or device identity in the PoC source | **MET** | My grep over the whole tree returns only comments *naming their absence* (`valija_native.c:6`, `Sqlite3mcDatabase.kt:15`) and the `SCHEMA_TOO_NEW` refusal paths. |
| B4 | Derived key never written to keychain/keystore/prefs/file/log | **MET** | Both `Argon2idKeyDeriver` actuals zero the raw key and passphrase bytes; `valija_native.c` `memset`s the `PRAGMA key` buffer on every path; no Keychain/Keystore/`UserDefaults`/`SharedPreferences` symbol anywhere; the only three `println`s in the tree print the Argon2id milliseconds and the verdict line. |
| B5 | Zero network requests, verified by source **and declared capabilities of both binaries** | **MET in substance, unevidenced in this repo** | I verified both declarations myself (A4). `advances/MOBILE/` still records neither: no `android-permissions.txt`, no mention of `Info.plist`. W5-3 (carried, non-blocking). |

### Execution evidence (G1, G2, G3, G6)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| C1 | Screenshot from a **booted iOS simulator**, committed | **NOT MET — disposed of honestly** | Re-verified against `ci.yml`: no job takes a screenshot and no job launches `:composeApp`. `poc.md:350` records permanent non-collection with the true reason. Waived by the closure, not satisfied. |
| C2 | Screenshot from a **booted Android emulator or device** | **NOT MET — same disposition** | Same. |
| C3 | Interop exercised per platform through its own mechanism, both recorded | **MET** | Visibly different code paths: hand-written JNI bridge (`androidMain/cpp/valija_native.c`) vs. cinterop `.def` with no hand-written C. `poc.md:58–59` records both. |
| C4 | Run logs, **including exit codes**, committed | **NOT MET — disposed of by disclosure** | `poc.md:351` now says plainly they were never retrieved, what that costs, and when they expire. Accepted per pass 2's own fallback, with W2-3 on the stated reason. |
| C5 | Android result states arm64 vs x86_64 plainly; x86_64 ⇒ G2 still open | **MET** | `poc.md:56`, `:58`, `:63`, `:161–164`; `docs/vault-format.md:556`; the CI job is literally named "Android build + x86_64 emulator (NOT arm64 evidence)" (`ci.yml`, verified). |

### Conformance (G4, G7)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| D1 | JVM byte-compare against `expected-export.md`, passing | **MET** | `GoldenVaultConformanceTest` has exactly 10 `@Test`s, matching `evidence/jvm-conformance.log` name for name; `expected-export.md` = 1887 B and `expected-pack.md` = 967 B on disk, the numbers `poc.md:50` claims. §8's label is now honest (pass-2 W3 closed). |
| D2 | Same comparison on device, shown on screen and in the exit status | **NOT MET (screen half)** | The screen half exists in `App.kt` and was never captured on any target; the exit-status half exists in CI and is not verifiable from this repo. |
| D3 | Byte comparison, not a snapshot, not normalised | **MET** | `PackConformance.compareRendered` is a `ByteArray` loop with a first-difference index. |
| D4 | `estimateTokens` counts UTF-16 code units, asserted by a test | **MET** | Asserts `"𝄞".length == 2`; documented at `docs/vault-format.md:309–317`. |

### Argon2id (G5)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| E1 | Derived key equals `manifest.keyHex`, asserted in code | **MET off-device; N/A on-device by amendment** | Asserted before opening in all three conformance tests (JVM, Android instrumented, iOS). |
| E2 | Derivation time reported, labelled with the hardware, marked not-a-device measurement | **NOT MET** | The caveat wording is right, the number is not: `155` appears in no committed artifact, in either repository (C3-3), and the row's own scoping sentence is wrong (C2-3). |

### Contract and roadmap

| # | Criterion | Status | Evidence |
|---|---|---|---|
| F1 | Every `docs/vault-format.md` defect fixed or recorded; M4's W5 and W6 addressed | **MET** | Re-derived all five corrections from `src/context/domain/services/context-pack.ts` and `src/delivery/context-pack-markdown.ts` again this pass — still exactly right, including the Pinned rule. W7 recorded-not-fixed with a reason. The wrong cross-reference (pass-2 W6) is fixed. |
| F2 | §13's table gains rows for what executed, with the same scoping precision as its existing rows | **NOT MET** | The rows exist and the lead-in and tail are now correct. But four of them (`:551–554`) are sourced *entirely* from the unreproducible harness and carry no scoping at all — strictly less precision than the existing rows they sit beside, and less than `poc.md` gives the same four facts. C1-3. |
| F3 | `docs/SPEC.md` §2 Out line and §10b pointer corrected | **MET** | `:31` and §10b separate what is proven (interop path, CI level) from what is permanently unmeasured (on-device Argon2id latency, Android arm64). Accurate against `poc.md`. |
| F4 | Kept tree: location stated, non-authoritative scaffolding declared | **MET** | `poc.md:9–11`, `:401–402`; `valija-mobile/README.md` agrees. The runbook now clones `-b feat/poc` (pass-2 W2 closed) — I verified `main` still carries no Gradle project. |
| F5 | Amalgamation version, SHA-256, compile flags recorded; licence satisfied; no unauthorised CI/dependency | **MET** | Re-hashed: `sha256(valija-mobile/vendor/sqlite3mc/sqlite3.c)` == `sha256(node_modules/better-sqlite3-multiple-ciphers/deps/sqlite3/sqlite3.c)` == the recorded `670d8d05…98b9`. `THIRD-PARTY-NOTICES.md` carries both licences; `valija/.github/` untouched. |

**Score: 19 met, 7 not met** — A7, A8, C1, C2, C4, D2, E2, F2 counted as: three waived-and-disclosed
(A7, C1/C2 screenshots, C4, D2's screen half), three genuinely open (A8, E2, F2).

---

## 2. Plan compliance

Slices 1–8 and 10 are evidenced; Slice 9 is skipped by Oscar's recorded amendment (`plan.md:5–11`,
`refined.md:470–488`). Deviations still not covered by that amendment, all carried from pass 2 and
all now at least partly disclosed:

- **Slice 7 step 46** — the planned iOS "boot, install, launch, `xcrun simctl io booted screenshot`"
  steps were never implemented; `ci.yml`'s `ios` job stops at `linkDebugFrameworkIosArm64`
  (verified). This is now correctly named as the cause of the missing screenshots (`poc.md:350`) and
  of G6 (`:64`, `:366–374`) — except in §10, which still says otherwise (W1-3).
- **Step 49** — `evidence/` still lacks `android-permissions.txt` and any CI log; now disclosed
  (`poc.md:351`) rather than silent.
- **Steps 45 and 58** — the read-only/no-keychain greps and the three final gate outputs are still
  not pasted into `poc.md`. I ran all of them myself and they hold, so no criterion turns on it.
- **`plan.md` §9's promise that `evidence/toolchain-versions.txt` carries NDK and Xcode** — unmet
  and now disclosed. The file was not touched by `b270262`; the repo-derivable API level, ABI and
  emulator target went into `poc.md` §2 only (S5-3).
- **D-2** — `valija-mobile`'s `feat/poc` is still unmerged into its `main`; scheduled for ship, and
  the runbook now works around it.

---

## 3. Hard gates

| Gate | Result |
|---|---|
| Security surface weakened (secrets/keys logged, plaintext to disk, KDF/keychain use altered, SQLCipher unkeyed, MCP over-exposed) | **PASS** — re-checked against the app tree, not the prose. Zero `src/` change; MCP diff empty; §§4–6 of the format contract untouched; raw key and passphrase bytes zeroed in both `Argon2idKeyDeriver` actuals; the `PRAGMA key` buffer `memset` in C; no keychain/keystore/prefs API anywhere; `sqlite3_open_v2(…READONLY)` → `PRAGMA cipher='sqlcipher'` → `PRAGMA key` → `SELECT count(*) FROM sqlite_master` in the documented order; no `journal_mode`, no `wal_checkpoint`, no DDL/INSERT, no migration; zero declared Android permissions; only published fixture values anywhere, including both committed logs. |
| Tests present for new behaviour; suite passing | **PASS** — no `valija` behaviour changed; 48 files / 241 tests green; typecheck and lint clean. Each new contract rule is backed by a Kotlin assertion in `GoldenVaultConformanceTest` and by the pre-existing `vault-format-conformance.test.ts`. |
| Advance ritual evidenced | **PASS** — `refined.md:3` `Approved: Oscar 2026-07-31`; `plan.md:3` `Approved: Oscar 2026-08-01`; both 2026-08-16 amendments dated, attributed and additive, now pointed at from `refined.md`'s Status block (pass-2 W7 closed); this `review.md`. |
| Naming, placement, clean-architecture conventions | **PASS** — `valija`'s diff is docs-only. In `valija-mobile` the CLAUDE.md mapping holds: kind-named subfolders throughout (`domain/{entities,values,services}`, `application/{ports,use-cases}`, `infra/{sqlite,argon2,files}`), only `domain/VaultError.kt`, `shared/UseCase.kt`, `shared/Result.kt` at a layer root (the standing exceptions), tech-named adapters, `parseX → Result` at boundaries. One placement nit carried at S6-3. |

**No hard gate is breached.** The FAIL is entirely on acceptance criteria A8/E2/F2 — the accuracy of
the disclosure itself.

---

## 4. Issues

### Critical

**C1-3 — the disclosure stopped at `poc.md`; `docs/vault-format.md` still publishes all four
harness-derived results as unqualified fact, including the number pass 2 named specifically.**
`docs/vault-format.md:551–554`:

```
| Vendored SQLite3MultipleCiphers amalgamation opens a real vault via Kotlin↔C interop | Linux x86_64, JDK 21, … | **PASS** |
| Argon2id derives the published key through that same interop path | Same | **PASS** — 155–178 ms on desktop-class silicon, *not a phone measurement* |
| Wrong key surfaces as `WRONG_PASSPHRASE`, not corruption | Same | **PASS** |
| Read-only: fixture unmutated, no `-wal`/`-shm`/`-journal` produced | Same | **PASS** |
```

No ⚠, no provenance note, no pointer to `poc.md` §4. Pass 2's C1 said in as many words why this is
the load-bearing half: *"an evidence advance may not publish a number into a contract document from
a run nobody can re-execute."* This document is the one written so a second implementer "should not
have to read `src/`" (`:7–11`), it is governed by §14 change control, and it is what the next Gate R
will read. As it stands the repo asserts both "not independently re-checkable" (`poc.md:53`) and a
bare `**PASS**` (`:552`) about the same run, in two documents that cite each other.
*Fix (small):* one line under `:544`'s lead-in — "the four Linux rows below come from a scratch
harness that was not kept and cannot be re-run; see `advances/MOBILE/poc.md` §4" — or the same ⚠
marker `poc.md` §2 uses, per row.

**C2-3 — two of the four re-scoped rows now state something that is false, and the falsehood is in
the direction of under-claiming.** `poc.md:54–55` both say "not independently corroborated
elsewhere", and §4's caveat (`:195–196`) repeats it. Both are corroborated, at the *stronger* tier,
by tests that ran in the green run #11 the document itself cites:

- **Wrong key → `WRONG_PASSPHRASE`**: `AndroidVaultConformanceTest.kt:97–103` (real NDK, emulator)
  and `IosVaultConformanceTest.kt:102–108` (real cinterop, simulator) both assert exactly
  `error.code == "WRONG_PASSPHRASE"`.
- **Read-only / no sidecar**: `AndroidVaultConformanceTest.kt:90–93` asserts the absence of
  `-wal`/`-shm`/`-journal` after a full read, on a sandbox copy taken at `:39–45` — i.e. both halves
  of that row, on the emulator.
- Related, same direction: `poc.md:53` calls its number "the only Argon2id timing in this advance".
  `AndroidVaultConformanceTest.kt:62` prints an emulator-class timing with `Build.MODEL` and the ABI
  on every Android CI run. It is the only *recorded* timing; another one exists and is sitting in
  the logs §8 says were never retrieved — which is a concrete cost worth naming in that row rather
  than a claim to make in this one.

A document whose entire value is claim precision should not assert a negative it can disprove by
opening the repo it links to. *Fix:* re-scope those two rows the way G3a's row was correctly
re-scoped — "⚠ this Linux run is unreproducible; independently corroborated at a stronger tier by
`AndroidVaultConformanceTest` / `IosVaultConformanceTest` in the green run #11" — and narrow the
G5 claim to "the only *recorded* timing". This makes the advance stronger, not weaker.

**C3-3 — `155` has no source anywhere, in either repository.** The only Argon2id number in any
committed artifact is `178 ms` (`evidence/linux-fullstack-interop.log:27`, a single run of a single
test). `grep -rn 155` returns nothing in `/workspace/valija-mobile` and nothing in
`advances/MOBILE/evidence/`. The range is published twice — `poc.md:53` and
`docs/vault-format.md:552` — and under the disclosure route it is the worst-provenance number in the
advance: unreproducible *and* unsourced, where the rest are merely unreproducible. *Fix:* publish
`178 ms` and cite the log line, **or** state "two runs of the scratch harness, 155 ms and 178 ms;
only the second run's log was kept".

### Warning

**W1-3 — §10 still attributes G6 to the physical-device gap, contradicting the §2 and §9 rewrites.**
`poc.md:395`: "**G1 (physical) / G2 / G5 / G6** — anything that only a physical device can answer
…". The W1 fix landed in the §2 legend (`:41–44`), G6's Result cell (`:64`) and §9 (`:366–374`); §10
is the fourth place that says it and was not updated, so the document now carries both attributions.
One clause fixes it.

**W2-3 — the reason given for not retrieving the CI logs contradicts §3a and misattributes a
decision to a network constraint.** `poc.md:347` says "this session's network access cannot reach
`api.github.com` to fetch them", while `:98–101` says run #11 was "independently re-verified …
against the GitHub Actions API directly" and `:351` repeats "confirmed against the GitHub Actions
API at review time". Same API, same auth, opposite claims. The true reason is the one the rest of
the document is scrupulous about naming: they were not fetched because the advance was closed with
gaps disclosed rather than recovered. Say that.

**W3-3 — §9's "Established" paragraph, the one a skimmer reads, credits the unreproducible run with
no marker.** `:357–361`: "demonstrated on Linux/x86_64 with the same sources the mobile builds use".
The overall sentence survives on the CI half alone, so this is not an overclaim — but the ⚠ exists
precisely so the Linux half is never cited bare. One parenthetical.

**W4-3 (carried, and not closed by the disclosure) — the committed transcript still calls the Linux
sandbox "device-equivalent hardware".** `evidence/linux-fullstack-interop.log:26,29`. Not editing a
transcript is the right instinct and I accept it. But the §4/§8 text disowns the *reproducibility*
of that log, never the *phrase*, so the one sentence in this advance that lands in the register A9
forbids is still uncontradicted. One clause in §8's row ("the test name in that log calls the Linux
sandbox 'device-equivalent hardware'; it is not — see §2's G5 row") closes it.

**W5-3 (carried) — `valija-mobile` still points readers at two artifacts that do not exist.**
`composeApp/src/androidMain/AndroidManifest.xml:8` cites
"`advances/MOBILE/evidence/android-permissions.txt` in valija"; `PackConformance.kt:38` cites "the
committed screenshots". The C2 disclosure covers `valija`'s side of the ledger; the code repo the
advance declares the record of truth still asserts both files exist. Out of this diff, so
non-blocking — but it is a two-line comment fix in a repo the ship step touches anyway.

### Suggestion

- **S1-3** — `poc.md:39` "The four bolded rows below say `NOT COLLECTED`" — five rows are bolded;
  `**G1**` at `:60` is bold and says PASS. The following sentence disambiguates it in prose, but the
  visual cue and the sentence disagree. Bold the four uncollected `#` cells only.
- **S2-3 (carried)** — §3a is numbered between §2 and §3. Renumber or drop the "a".
- **S3-3 (carried)** — `refined.md` §9 fixes the vocabulary as PASS/FAIL/**NOT ATTEMPTED**; `poc.md`
  uses `NOT COLLECTED` and `NO`. One mapping line under §2's table makes A7 literally checkable.
- **S4-3 (carried)** — two rows are both labelled `G3a` (`:52` Linux JNI, `:58` Android emulator) at
  very different strengths; label the first "G3a (partial — same bridge, not the NDK)". This matters
  more now that `:52` is the one carrying a ⚠.
- **S5-3** — `evidence/toolchain-versions.txt` was not touched by the fix commit, so the
  repo-derivable CI facts (API 34, `x86_64`, `google_apis`) live only in `poc.md` §2 while `plan.md`
  §9 designates that file as where toolchain facts go. Three lines.
- **S6-3** — `poc.md:59` cites "Compose Multiplatform 1.7.3" as the toolchain behind
  `:vault-interop:iosSimulatorArm64Test`, which does not depend on Compose at all. In a column whose
  whole purpose is "what produced this", an unrelated version is noise.
- **S7-3** — worth one line in §8 as a genuine lesson: the NDK version is unrecoverable *even in
  principle* from the kept tree because `valija-mobile` pins no `ndkVersion` — AGP picked whatever
  the runner image had. That is the reproducibility defect behind C4, and it is cheaper to record
  than to rediscover.
- **S8-3 (carried)** — `docs/vault-format.md:7–8` still points a second implementer at "the
  read-only mobile companion described in `advances/M4/refined.md`", now that no such companion is
  planned.
- **S9-3 (carried)** — placement nit in `valija-mobile`:
  `composeApp/src/commonMain/kotlin/dev/valija/poc/GoldenVaultBundleLoader.kt` is bundle-resource IO
  at the module package root beside `App.kt`, while its sibling `FixtureSnapshot` correctly lives in
  `infra/files/`. `infra/bundle/GoldenVaultBundleLoader.kt` matches CLAUDE.md's kind-named-subfolder
  rule; `RunGoldenVaultConformance.GoldenVaultBundle` would read better as
  `application/dto/GoldenVaultBundle.kt`.

---

## 5. What would flip this to PASS

1. **C1-3** — put the provenance caveat on `docs/vault-format.md:551–554` (one lead-in line under
   `:544`, or a per-row ⚠ pointing at `poc.md` §4). This is the half of pass-2's C1 that was never
   done, and it is the half the critical was actually about.
2. **C2-3** — correct `poc.md:54`, `:55` and §4's `:195–196`: the wrong-key and no-sidecar rows *are*
   independently corroborated, by `AndroidVaultConformanceTest.kt:90–93,97–103` and
   `IosVaultConformanceTest.kt:102–108` in run #11. Narrow `:53`'s "the only Argon2id timing" to
   "the only *recorded* timing".
3. **C3-3** — source `155` or drop it, in both `poc.md:53` and `docs/vault-format.md:552`.

Nothing else holds the merge. **Explicitly confirming what you asked:** W3 (closed — §8's
`jvm-conformance.log` label is now accurate and I verified the ten test names match one-for-one),
W4, W5, and S1/S3/S4/S6 from pass 2 are **optional**; none of them appears above as a flip
condition. W1-3 and W2-3 are strongly recommended in the same edit — W1-3 because §10 is now the
last place that miscredits an omission to a decision, W2-3 because a disclosure that gives the wrong
reason for a gap is the failure mode this whole advance is written against.

**Credit where it is due.** The C1 provenance caveat is exact, and I verified every factual claim in
it independently: no `jvm()` target on `:vault-interop`, no `FullStackVerification` in any worktree
or any commit on any branch of either repo. The C2 row is the honest version of a bad situation and
names all three things I asked for. C3's rewrite of §3a into "First run (superseded) / Fixed, now
green" is better than the minimum I described. C4 recovered everything the repo could prove — I
re-derived API 34, `x86_64`, `google_apis`, Kotlin, AGP, Compose MP and the SDK levels from
`ci.yml` and `libs.versions.toml` and they all check out — and disclosed the rest at the point of
claim rather than in a footnote. The choice to close with caveats was legitimate and the execution is
mostly faithful. What it missed is one document and one direction: the contract file never got the
caveat, and where the caveat did land it under-claims evidence that the linked repo plainly contains.

---
---

# MOBILE — review (second pass, retained for history)

(Verdict at the time: FAIL. Reviewed `docs/mobile-poc-MOBILE` @ `5e649d5`.)

Reviewed `docs/mobile-poc-MOBILE` @ `5e649d5` against `main` (`git diff main...HEAD`), working tree
clean. Re-reviewed from scratch, not as a diff of the fix commit.

**Line count:** 8 files changed, 534 insertions(+), 11 deletions(-), excluding this `review.md`
(9/829/11 including it). No `src/` line, no `package.json`, no build config, no `.github/`.

**What I could verify this pass that I could not last pass.** `akiles94/valija-mobile` is attached
at `/workspace/valija-mobile`, so the code claims are now checkable and I checked them: module
boundaries, the two interop mechanisms, key handling, permissions, the dependency catalogue, the
vendored hashes, the fixture copies, and `.github/workflows/ci.yml`. Most of pass 1's `UNCLEAR`
rows resolve to **MET**, and the code is genuinely good.

**What I still could not verify.** `api.github.com` is blocked by this session's egress policy
(`curl … /actions/runs/30723496087` → **HTTP 403**; I have no GitHub MCP tools in this run). So I
independently confirmed the *workflow* (job names, steps, the absence of any screenshot step, the
`uses-permission` guard) but **not** run #11's `conclusion: success`. Every CI-level claim in this
advance — G3a-on-Android, G3b, the new general-G1 row — therefore still rests, for a reader of this
repo, on one hyperlink into an unmaintained repo whose Actions logs GitHub deletes after 90 days.
That is C2 below, and it is why "commit the log" is not a formality.

---

## 0. Disposition of pass 1's four criticals

| Pass 1 | Now | Evidence |
|---|---|---|
| **C1** — wrong "Pinned" contract rule | **FIXED, verified** | `docs/vault-format.md:333–339` now matches `src/context/domain/services/context-pack.ts:86–100` on all three points: `pinned.length === 0 → return` (no label, no section), label added before any item's budget test, first pinned item kept unconditionally. Re-verified the other four corrections against `context-pack.ts` and `context-pack-markdown.ts:32–41` — still exactly right. One blemish: the parenthetical says "(§9's next bullet)" but that rule is §8's (`:348–352`); §9 is Markdown rendering. |
| **C2** — missing CI evidence | **HALF FIXED** | Screenshots: honest and verified — `/workspace/valija-mobile/.github/workflows/ci.yml` has no screenshot step in any of the three jobs, and neither job launches `:composeApp`'s UI, so `ci-*.png` genuinely never existed. `poc.md:328` now says so. **But the other half of the pass-1 fix menu was not done**: no CI job log, no exit code, and no `android-permissions.txt` is committed, and §8 records no disposition for them. Those artifacts *do* exist (`upload-artifact` in both jobs, within retention). |
| **C3** — stray leftovers | **PARTIALLY FIXED** | `poc.md:39` legend and `:82–84` reworded; `docs/vault-format.md:520–527` lead-in corrected. **Still live:** `poc.md:66` heading, `poc.md:86–88`, `poc.md:163`, and `docs/vault-format.md:613`. See C3. |
| **C4** — G1/G2/G6 conflation | **FIXED, and correctly** | Judged on the merits below. The split is right, and it is what `refined.md`'s own text already required. |

### On C4, since you asked me to judge it rather than accept it

**The split resolves the ambiguity; it does not relocate it.** `refined.md:70` defines G1 as "Has
any valija-related binary ever executed on iOS **(device or simulator)**?" — the parenthetical is
the spec's, not the fix's. `refined.md:458–462` (P-6(b)'s default) says in as many words that "the
simulator closes G1". P-5's non-negotiable at `refined.md:413–417` permits "ran on iOS" for a
simulator and forbids it only for macOS; M4's C3 finding was about a **macOS** run published as
iOS. So crediting the simulator to general-G1 is the spec's own standard applied, not a new claim.

**"The same event as G3b" is honest.** The iOS job runs `:vault-interop:iosSimulatorArm64Test`;
`vault-interop/build.gradle.kts:26` records that Kotlin runs that binary "through `simctl`", i.e. a
simulator-hosted execution of an `arm64-apple-ios15.0-simulator` binary, not a host macOS process.
One execution answers both questions.

**Where the fix is still slightly generous:** `poc.md:39–40` calls all four bolded rows the ones
"only a physical device could produce", and `:343` calls their absence "by decision, not by
omission". That is true of G1 (physical), G2 and G5. It is **not** true of **G6** — `plan.md` step
46 required the iOS job to "boot, install, launch, and `xcrun simctl io booted screenshot`", and
Slice 6's done-when was "the app runs on an emulator and a simulator". The shipped `ci.yml` does
none of that. G6 is uncollected because a planned CI step was never implemented, which is an
omission; the row's own text at `:61` says this correctly, and then the Result cell blames "advance
closed before Slice 9". Two framings of one gap, in one row. (§8's `ci-*.png` row gets this right:
"aspirational at planning time and was never implemented". Say the same thing about G6.)

---

## 1. Acceptance criteria (`refined.md` §9)

### Applies under every option

| # | Criterion | Status | Evidence |
|---|---|---|---|
| A1 | No `src/`, `package.json`, `tsup.config.ts`, `tsconfig*.json`, `.github/` in the diff | **MET** | `git diff main...HEAD --stat -- src/ package.json tsup.config.ts tsconfig*.json .github/` → 0 lines. Changed: `CHANGELOG.md`, `advances/MOBILE/{plan,poc,refined,review}.md`, `advances/MOBILE/evidence/{sqlite3c-sha256,toolchain-versions}.txt`, `docs/SPEC.md`, `docs/vault-format.md`. |
| A2 | No change to format, crypto, KDF params, key format, SQLCipher config, `vault.json` | **MET** | `docs/vault-format.md` §§3–6 untouched by the diff; only §8/§9/§13 prose changed. |
| A3 | MCP surface byte-for-byte unchanged | **MET** | `git diff main...HEAD -- src/delivery/mcp/` → 0 lines. |
| A4 | No network/telemetry/analytics/cloud SDK in any app artifact | **MET** | Verified in the tree: `gradle/libs.versions.toml` holds Kotlin, AGP, Compose MP, serialization, activity-compose, test runner — nothing network-capable; `composeApp/src/androidMain/AndroidManifest.xml` declares no permission and `tools:node="remove"`s the transitive self-scoped `androidx.core` one; `iosApp/iosApp/Info.plist` has no ATS key and no networking capability; `valija_native.c` opens no socket. |
| A5 | `typecheck && lint && test` pass unchanged; CI matrix not slowed or gated | **MET** | Ran all three: `tsc --noEmit` clean; biome "Checked 146 files… No fixes applied" (1 pre-existing config-migration info); vitest **48 files / 241 tests passed**. No workflow file touched. |
| A6 | Every value from the golden fixture; no real vault/passphrase/key/content anywhere | **MET** | All 7 fixture files in `valija-mobile/vendor/golden-vault/` are SHA-256-identical to `src/testing/__fixtures__/golden-vault/` (checked file by file — zero drift, R5 held). Both committed logs contain only fixture-derived output; no key material in any diffed line. |
| A7 | `poc.md` gives PASS/FAIL/NOT ATTEMPTED per §3 question **with the hardware, OS version, and toolchain version that produced it** | **NOT MET** | Unchanged since pass 1. CI rows (`poc.md:53–57`) carry only runner labels — no macOS image or Xcode version, no simulator device/iOS runtime, no Android API level (it is `34`/`google_apis`/`x86_64` in `ci.yml`, unquoted in `poc.md`), no NDK version. `evidence/toolchain-versions.txt` is untouched by the fix commit and still contains neither NDK nor Xcode, though `plan.md` §9 specifies it as "Kotlin, AGP, Compose, **NDK, Xcode**, Gradle". |
| A8 | Explicit claim-scoping section; no claim stated more broadly than its evidence | **NOT MET** | §3 (`:141–171`) remains the document's best section. But §4 presents a run that no committed source can reproduce (C1), `:66`/`:86–88`/`:163` still contradict the closure (C3), and §2's legend + §9 attribute G6's absence to a decision rather than to the unimplemented Slice 7 step. |
| A9 | No sentence describes a macOS/Linux/x86_64 run as an iOS/arm64 run | **MET in the shipped prose** | Re-read `poc.md`, `docs/vault-format.md` §13, `docs/SPEC.md` §2/§10b and the new `CHANGELOG.md` line: every mobile claim carries "simulator"/"emulator"/"x86_64" at the point of the claim. The one blemish is a committed artifact, not prose — see W4. |

### The app itself

| # | Criterion | Status | Evidence |
|---|---|---|---|
| B1 | Single-screen app per platform, shared Kotlin core, amalgamation only behind one port | **MET** | Now verifiable: `:vault-core` has zero `expect`/`actual` and no platform API; `:vault-interop` is the only module that names C (`Sqlite3mcDatabase` `expect` + two `actual`s, `Sqlite3mcVaultReader` shared); `composeApp/App.kt` calls `RunGoldenVaultConformance`, never the port and never SQL. The boundary is compiler-enforced by the module graph, as D-3 promised. |
| B2 | Sandbox copy; bundled bytes unchanged; no `-wal`/`-shm`/`-journal` | **MET** | `RunGoldenVaultConformance.execute()` snapshots before opening; `infra/files/FixtureSnapshot` refuses on a sidecar; `poc.md:52` row PASS. Evidenced only for the Linux path (see C1/C2). |
| B3 | No journal pragma, migration, lineage write or device identity in the PoC source | **MET** | My grep over the whole tree returns only comments *naming their absence* (`valija_native.c:6–7`, `Sqlite3mcDatabase.kt:15`) plus the `SCHEMA_TOO_NEW` refusal paths. Plan step 45 required these greps pasted into `poc.md`; they are not there (W5). |
| B4 | Derived key never written to keychain/keystore/prefs/file/log | **MET** | Both `Argon2idKeyDeriver` actuals zero the raw bytes and the passphrase bytes before returning; `valija_native.c:100–103` `memset`s the `PRAGMA key` buffer on every path; no Keychain/Keystore/`UserDefaults`/`SharedPreferences` API is imported anywhere; the only `println`s print the Argon2id milliseconds and the verdict line. |
| B5 | Zero network requests, verified by source **and declared capabilities of both binaries** | **MET in substance, unevidenced in this repo** | I verified both binaries' declarations myself (A4). Nothing in `advances/MOBILE/` records either: `android-permissions.txt` was never committed and `Info.plist` is never mentioned. See W5. |

### Execution evidence (G1, G2, G3, G6)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| C1 | Screenshot from a **booted iOS simulator**, committed, model + iOS version recorded | **NOT MET — disposed of honestly** | Verified against `ci.yml`: no job takes a screenshot and no job launches the app, so the artifact never existed. `poc.md:328` now records permanent non-collection with that reason. I treat this as waived by Oscar's recorded closure amendment, **not** as satisfied. |
| C2 | Screenshot from a **booted Android emulator or device** | **NOT MET — same disposition** | Same. |
| C3 | Interop exercised per platform through its own mechanism, both recorded | **MET** | Verified as visibly different code paths: hand-written JNI C bridge (`androidMain/cpp/valija_native.c`) vs. cinterop `.def`s and no hand-written C (`iosMain/…/Sqlite3mcDatabase.ios.kt`). `poc.md:55–56` records both. |
| C4 | Run logs, **including exit codes**, committed | **NOT MET, and now undisposed** | `advances/MOBILE/evidence/` holds four files; neither CI job's log nor any exit code is among them, and §8 has no row for them. Unlike the screenshots, these artifacts exist. |
| C5 | Android result states arm64 vs x86_64 plainly; x86_64 ⇒ G2 still open | **MET** | `poc.md:55`, `:60`, `:154–156`; `docs/vault-format.md:555`; the CI job is literally named "Android build + x86_64 emulator (NOT arm64 evidence)". |

### Conformance (G4, G7)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| D1 | JVM byte-compare against `expected-export.md`, passing | **MET** | `GoldenVaultConformanceTest` has 10 `@Test`s whose names match `evidence/jvm-conformance.log` one-for-one; `expected-export.md` = 1887 B and `expected-pack.md` = 967 B on disk, exactly the numbers `poc.md:47` claims. (The log's provenance is W3.) |
| D2 | Same comparison on device, **shown on screen** and in the exit status | **NOT MET (screen half)** | The screen half exists in code (`App.kt:102–110` renders `verdict.describe(...)` and the Argon2id line) but was never captured on any target. The exit-status half exists in CI but is not verifiable from this repo (C2/C4). |
| D3 | Byte comparison, not a snapshot, not normalised | **MET** | `PackConformance.compareRendered` is a `ByteArray` loop with a first-difference index; no `String` comparison, no normalisation. |
| D4 | `estimateTokens` counts UTF-16 code units, asserted by a test | **MET** | The test asserts `"𝄞".length == 2` and `estimateTokens("𝄞".repeat(4)) == 2` — the assertion that actually separates UTF-16 from graphemes. Documented at `docs/vault-format.md:309–317`. |

### Argon2id (G5)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| E1 | Derived key equals `manifest.keyHex`, asserted in code | **MET off-device; N/A on-device by amendment** | `RunGoldenVaultConformance.execute()` throws `KEY_MISMATCH` before opening; both platform conformance tests assert the same. |
| E2 | Derivation time reported, labelled with the hardware, marked not-a-device measurement | **MET** | `poc.md:50` "155–178 ms — *desktop-class silicon; not a phone measurement*"; `:62` NOT COLLECTED for phone hardware; `docs/vault-format.md:552` repeats the caveat. (Provenance of the number: C1.) |

### Contract and roadmap

| # | Criterion | Status | Evidence |
|---|---|---|---|
| F1 | Every `docs/vault-format.md` defect fixed or recorded; W5 and W6 addressed | **MET** | All five corrections verified line-by-line against `src/` this pass, including the newly-fixed Pinned rule. W7 recorded-not-fixed with a reason (`poc.md:248–250`). |
| F2 | §13's table gains rows for what executed, with the same scoping precision | **NOT MET** | The rows (`:547–558`) and the corrected lead-in (`:520–527`) are both right. `docs/vault-format.md:613`, in the same section, still reads "**A literal iOS device/simulator execution remains the one genuinely open item**" — false since the simulator run, and directly contradicted by the PASS row at `:556`. Same defect class as the lead-in that *was* fixed. |
| F3 | `docs/SPEC.md` §2 Out line and §10b pointer corrected | **MET** | `:31` and `:232–240` now separate what is proven (interop path, CI level) from what is permanently unmeasured (on-device Argon2id latency, Android arm64), with the scoping inline rather than behind the pointer. Accurate against `poc.md`. |
| F4 | Kept tree: location stated, non-authoritative scaffolding declared | **MET** | `poc.md:9–11`, `:375–376`; `valija-mobile/README.md` says the same. |
| F5 | Amalgamation version, SHA-256, compile flags recorded; licence satisfied; no unauthorised CI/dependency | **MET** | Independently verified: `sha256(valija-mobile/vendor/sqlite3mc/sqlite3.c)` == `sha256(node_modules/better-sqlite3-multiple-ciphers/deps/sqlite3/sqlite3.c)` == the recorded `670d8d05…98b9`. `THIRD-PARTY-NOTICES.md` carries both licences; `valija/.github/` untouched. |

**Score: 20 met, 6 not met** (A7, A8, C1, C2, C4, D2 — of which C1/C2/D2's screenshot half is waived-and-disclosed).

---

## 2. Plan compliance

Slices 1–8 and 10 are evidenced; Slice 9 is skipped by Oscar's recorded amendment, which is the
right call to record rather than fake. Deviations **not** covered by that amendment:

- **Slice 7 step 46** — the planned iOS job steps "boot, install, launch, and `xcrun simctl io
  booted screenshot`" were never implemented; `ci.yml`'s `ios` job stops at
  `linkDebugFrameworkIosArm64`. This is the actual cause of the missing screenshots *and* of G6, and
  no document says so except obliquely at `poc.md:328`.
- **Slice 6 done-when** — "the app runs on an emulator and a simulator, shows `CONFORMANCE: PASS`,
  and `aapt2 dump badging` reports zero permissions": the third clause is enforced in CI; the first
  two were never demonstrated anywhere.
- **Step 49** — `evidence/` is still missing `android-permissions.txt` and any CI log.
- **Step 58** — none of the three final gate outputs is pasted into `poc.md`. I ran all three myself
  and they hold (A1/A3/A5), so the criteria pass; only the record is missing.
- **Step 45** — the read-only/no-keychain greps were to be pasted into `poc.md` with empty output.
  They are not there. I ran them; they are empty.
- **D-2** — `valija-mobile`'s `feat/poc` is 15 commits ahead of `main` and unmerged. Scheduled for
  ship, so not a review blocker, but it currently breaks `poc.md` §7's first runbook command (W2).

---

## 3. Hard gates

| Gate | Result |
|---|---|
| Security surface weakened (secrets/keys logged, plaintext to disk, KDF/keychain use altered, SQLCipher unkeyed, MCP over-exposed) | **PASS** — and this pass I could check the app tree, not just the prose. Zero `src/` change; MCP diff empty; §§4–6 of the format contract untouched; raw key and passphrase bytes zeroed on every path in both `Argon2idKeyDeriver` actuals; the `PRAGMA key` buffer `memset` in C; no keychain/keystore/prefs API anywhere; `sqlite3_open_v2(…READONLY)` → `PRAGMA cipher='sqlcipher'` → `PRAGMA key` → `SELECT count(*) FROM sqlite_master` in exactly the documented order; no `journal_mode`, no `wal_checkpoint`, no DDL/INSERT, no migration; zero declared Android permissions and a clean `Info.plist`; only published fixture values anywhere. |
| Tests present for new behaviour; suite passing | **PASS** — no `valija` behaviour changed; 48 files / 241 tests green; typecheck and lint clean. The new contract rules are each backed by a Kotlin assertion in `GoldenVaultConformanceTest` and by the pre-existing `vault-format-conformance.test.ts`. |
| Advance ritual evidenced | **PASS** — `refined.md:3` `Approved: Oscar 2026-07-31`; `plan.md:3` `Approved: Oscar 2026-08-01`; both 2026-08-16 amendments dated, attributed, additive, and now cross-referenced from P-6(a) as well as (b); this `review.md`. |
| Naming, placement, clean-architecture conventions | **PASS** — `valija`'s diff is docs-only. In `valija-mobile`, the CLAUDE.md mapping in `plan.md` §7 holds in practice: kind-named subfolders throughout (`domain/{entities,values,services}`, `application/{ports,use-cases}`, `infra/{sqlite,argon2,files}`), only `domain/VaultError.kt`, `shared/UseCase.kt` and `shared/Result.kt` at a layer root (the standing exceptions), tech-named adapters (`Sqlite3mcVaultReader`), `parseX → Result` at boundaries. One placement nit in S6. |

**No hard gate is breached.** The FAIL is on acceptance criteria and on evidence provenance.

---

## 4. Issues

### Critical

**C1 (new) — `poc.md` §4's Linux full-stack run, the advance's most-cited non-CI result, cannot be
reproduced from any source that was kept, and nothing says so.**
`evidence/linux-fullstack-interop.log` records a Gradle test class `FullStackVerification` with
three tests. That class exists **nowhere**:

- not in `/workspace/valija-mobile`'s worktree (`grep -r FullStackVerification` → nothing);
- not in any commit on any branch (`git log --all --diff-filter=D --name-only` is empty — no file
  was ever deleted, so it was never committed either);
- not in `valija` (the only hit in this repo is the log itself);
- and it *cannot* be run from the kept tree: `:vault-interop` declares only `androidTarget()`,
  `iosArm64()`, `iosSimulatorArm64()` — there is no `jvm()` target and no `jvmMain` `actual` for
  `Sqlite3mcDatabase`, yet the log's task names (`:compileKotlinJvm`, `:jvmTest`, `:jvmJar`) are a
  JVM KMP run at a root project.

So §4's "**What ran:** … driven through the real `Sqlite3mcDatabase` / `Sqlite3mcVaultReader` /
`ReadContextPack` Kotlin sources" is describing a throwaway harness with its own JVM `actual`, and
§7's runbook has no command that produces it. Four `poc.md` §2 rows depend on it — G3a (Linux), the
**only** Argon2id timing in the advance, `WRONG_PASSPHRASE`, and read-only/no-sidecars — and that
timing has been published into a contract document (`docs/vault-format.md:552`, "PASS — 155–178 ms
on desktop-class silicon"). This is precisely the M4 review's **W1** ("`spike.md` promised source
it had not kept"), which `refined.md` P-3's Default says this advance must meet "up front rather
than as a fix", and P-3 Option 3 was chosen specifically so the code would be retrievable.
*Fix (either):* commit the harness to `valija-mobile` — a `jvm()` target on `:vault-interop` plus
the JVM `actual` and `FullStackVerification` under `jvmTest` would also give the `domain` CI job a
Linux full-stack gate for ~40 lines — and put its exact command in §7; **or**, if the harness is
gone, say so plainly at the top of §4 and in §8 ("produced by a scratch harness that was not kept;
not reproducible from either repo as it stands") and re-scope the four rows that cite it.

**C2 (carried, narrowed) — no CI run log and no exit code is committed, and §8 records no
disposition for them.** The screenshot half of pass-1's C2 is now closed honestly and I verified
the reason against `ci.yml`. The rest is not: both jobs upload artifacts
(`vault-core/build/reports/tests/jvmTest/`, `vault-interop/build/reports/androidTests/`,
`android-permissions.txt`, the APK, `vault-interop/build/reports/tests/`), run #11 is inside the
90-day retention window, and the author demonstrably had GitHub access this session. Meanwhile
`refined.md` §9 requires the run logs with exit codes to be committed, and `api.github.com` is
blocked from *my* environment, so the advance's entire iOS/Android execution story is, from inside
this repo, one URL and an assertion. `poc.md:375` itself declares the target repo unmaintained.
*Fix:* commit `evidence/ci-ios-simulator.log` and `evidence/ci-android-emulator.log` (the job logs
or at minimum their step conclusions and final `BUILD SUCCESSFUL` / exit status) plus
`android-permissions.txt`; **or** add a §8 row stating plainly that they were not retrieved, what
that costs a future reader, and when the links expire.

**C3 (carried, partially fixed) — four stale statements still contradict the closure, one of them
in the shipped contract.** You asked me to re-grep rather than trust the list; these are what a
full scan finds:
- `poc.md:66` — the heading still reads "## 3a. CI status — **red, and honestly so**". Pass 1 named
  this line explicitly. §2 records three PASS rows sourced from that same CI.
- `poc.md:86–88` — "A run that is red … Both jobs **need fixing and re-running** before anything
  here is claimed." Present tense, immediately above the "Update — now green" paragraph.
  → put `:66`–`:88` under a "First run (superseded)" sub-heading in past tense.
- `poc.md:163` — "**When the iOS device run happens** it will use a *development* provisioning
  profile…" Future tense about a run §10 says will never occur.
- `docs/vault-format.md:613` — "A literal iOS device/simulator execution **remains the one
  genuinely open item**." False, and contradicted by `:556` in the same section. This is the
  identical defect to the §13 lead-in that *was* fixed at `:520`; `plan.md` step 55's obligation
  covers §13 as a whole, not just its opening paragraph.

**C4 (carried, unaddressed) — A7: the CI rows still carry no OS version and no toolchain version.**
`refined.md` §9 asks for "the hardware, OS version, and toolchain version that produced it", and
this was item 5 of pass 1's flip-to-PASS list. `poc.md:53–57` still says only "GitHub Actions
`ubuntu-latest`" / "`macos-latest`". Some of what is missing is in the repo right now — API level
34, `google_apis`, `x86_64`, `minSdk 24`, Kotlin 2.1.20, AGP 8.7.3, Compose MP 1.7.3, the
`arm64-apple-ios15.0[-simulator]` triples — and the rest (Xcode version, macOS image, NDK version,
simulator runtime) is in run #11's logs, which C2 asks you to fetch anyway.
*Fix:* fill §2's "Where it ran" column and extend `evidence/toolchain-versions.txt` with the NDK and
Xcode versions `plan.md` §9 promised it would carry.

### Warning

**W1 — G6's non-collection is attributed to the closure decision instead of to the unimplemented
Slice 7 step.** `poc.md:39–40` ("the four rows only a physical device could produce"), `:61`'s
Result cell ("advance closed before Slice 9") and `:343` ("by decision, not by omission") together
imply G6 was device-gated. `plan.md` step 46 and Slice 6's done-when show it was in CI's reach and
simply never built. The row's own Question cell already says the true reason — make the Result cell
and the legend agree with it, as §8's `ci-*.png` row does.

**W2 — `poc.md` §7's first runbook command does not work.** `git clone
https://github.com/akiles94/valija-mobile && cd valija-mobile && ./gradlew :vault-core:jvmTest`
lands on `main`, which is 15 commits behind and contains only the `.claude/` seed — no Gradle
project at all. Either merge `feat/poc` at ship (plan D-2 requires the `--no-ff` merge anyway) or
write `git clone -b feat/poc`.

**W3 — `evidence/jvm-conformance.log` is labelled as something it is not.** §8 calls it
"`:vault-core:jvmTest`" output, but its task lines are `:compileKotlin`, `:compileTestKotlin`,
`:test`, `:jar` — plain `kotlin("jvm")` tasks at a root project, not this repo's KMP
`:vault-core:compileKotlinJvm` / `:vault-core:jvmTest`. The ten test names match the committed
`GoldenVaultConformanceTest` exactly, so the *content* is faithful; the label is not. One line
("the same test sources run as a standalone Kotlin/JVM project in the sandbox, which has no Android
SDK; CI's `:vault-core:jvmTest` is the canonical run") fixes it — or commit CI's own report.

**W4 (carried) — a committed artifact calls the Linux sandbox "device-equivalent hardware".**
`evidence/linux-fullstack-interop.log`: `argon2id on device-equivalent hardware derives the
published key()`. It contradicts `poc.md:50`'s careful "desktop-class silicon; not a phone
measurement" and lands in exactly the register A9 forbids. If C1 is fixed by committing the
harness, rename the test; otherwise disown the phrase in §8.

**W5 — two evidence artifacts are promised in `valija-mobile` and absent in `valija`.**
`composeApp/src/androidMain/AndroidManifest.xml` tells the reader its check "output is committed as
evidence (`advances/MOBILE/evidence/android-permissions.txt` in valija)" — that file does not
exist. `PackConformance.describe`'s KDoc says the verdict string is "the exact text that appears in
the committed screenshots" — there are none. The code repo is cited as the record of truth; these
two lines make it point at things that were never produced. Also: nothing anywhere in
`advances/MOBILE/` records the iOS side of §9's "declared capabilities/permissions of **both**
binaries" (I checked `Info.plist` myself; the advance does not).

**W6 — `docs/vault-format.md:338` cites the wrong section.** "(§9's next bullet)" points at
Markdown rendering; the "newest pinned item is always included" rule is §8's own next bullet
(`:348–352`). Trivial to fix, but it is inside the very correction this advance ships as its
headline contract fix.

**W7 (carried, partially fixed) — `refined.md`'s device-run language outside P-6 still has no
supersession marker.** The P-6(a) pointer was added, which was the substance of pass-1's W4. Still
unmarked: the header Status block (`:5–17`), §1's Goal ("prove it actually ran on Apple and Android
hardware targets … becomes an observed fact"), §9's execution-evidence block, and §10's
deliverables. A one-line pointer under the Status block would cover all four.

### Suggestion

- **S1 (carried)** — `poc.md` §3a is numbered between §2 and §3; renumber or drop the "a".
- **S2 (carried)** — `poc.md:143–144` "It is written **before** the device runs, so it cannot be
  shaped to fit a nice result" — there are no device runs; past-conditional it.
- **S3 (carried)** — two different rows are both labelled `G3a` (`:49` Linux JNI, `:55` Android
  emulator) at very different strengths; label the first "G3a (partial — same bridge, not the NDK)".
- **S4 (carried)** — `refined.md` §9 fixes the vocabulary as PASS/FAIL/**NOT ATTEMPTED**; `poc.md`
  uses `NOT COLLECTED` (and `NO` for G7). One mapping line under §2's table makes the criterion
  literally checkable.
- **S5** — §7's runbook headings still read "closes G1, G6" / "closes G2, G6"; after the G1 split
  the iOS one closes **G1 (physical)**. Same for the `docs/vault-format.md:7–8` audience line, which
  still points a second implementer at "the read-only mobile companion described in
  `advances/M4/refined.md`" now that no app is planned.
- **S6** — placement nit in `valija-mobile`:
  `composeApp/src/commonMain/kotlin/dev/valija/poc/GoldenVaultBundleLoader.kt` is bundle-resource IO
  sitting at the module package root beside `App.kt`, while its sibling `FixtureSnapshot` correctly
  lives in `infra/files/`. `infra/bundle/GoldenVaultBundleLoader.kt` (or `infra/files/`) would match
  CLAUDE.md's kind-named-subfolder rule and `plan.md` §7's own claim that "every new Kotlin file
  sits in a kind-named subfolder". Likewise `RunGoldenVaultConformance.GoldenVaultBundle` is a
  transport shape that would read better as `application/dto/GoldenVaultBundle.kt` than as a nested
  class inside the use case.

---

## 5. What would flip this to PASS

1. **C1** — commit the `FullStackVerification` harness (plus its command in §7), or state at the top
   of §4 and in §8 that it was a scratch harness that was not kept, and re-scope the four rows that
   cite it. This one is not optional: an evidence advance may not publish a number into a contract
   document from a run nobody can re-execute.
2. **C2** — commit the two CI job logs with their conclusions and `android-permissions.txt`, or give
   them an explicit §8 row saying they were not retrieved and that the links expire.
3. **C3** — clear the four remaining stale statements (`poc.md:66`, `:86–88`, `:163`,
   `docs/vault-format.md:613`).
4. **C4** — put the OS and toolchain versions in §2's CI rows and in
   `evidence/toolchain-versions.txt` (NDK, Xcode, simulator runtime, API level).

W1 and W2 are strongly recommended in the same pass — W1 because it is the last place the document
credits a decision for a gap that was an omission, W2 because the runbook is what a future reader
executes first. W3–W7 and every S-item would not, alone, hold the merge.

**Credit where it is due.** The Pinned rule is now exactly right, and I re-derived all five contract
corrections from `src/` rather than taking your word for them. The G1 split is not a relabelling
dodge: `refined.md`'s own G1 definition says "(device or simulator)" and P-6(b) says the simulator
closes G1, so the fix applies the spec's standard instead of stretching it — and it does so without
letting G2, G5 or G6 ride along, which was the actual failure mode. The `ci-*.png` disposition is
the honest answer rather than the convenient one. And the code I could finally read is better than
the documents claim: the module graph makes the port boundary a compile error, the key is zeroed on
every path in three languages, the APK declares nothing, and the vendored `sqlite3.c` is
byte-identical to the artifact M4 proved. What still fails is the same thing that failed last time
in a different place — the evidence chain stops one link short of what a stranger could re-run.
