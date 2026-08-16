Verdict: FAIL

# MOBILE — review (second pass)

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
