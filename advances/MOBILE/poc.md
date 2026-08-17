# MOBILE — proof-of-concept runbook and results

**Status: closed without physical-device evidence (Oscar, 2026-08-16).** Oscar decided not to
pursue a distributable mobile app — Apple's Developer Program (99 USD/year) and ongoing store
maintenance aren't justified for a project with no monetization. Slice 9 (the two physical-device
runs) was skipped; see §10 for the full disposition. Every row below that only a device run could
produce is marked `NOT COLLECTED`, not `PASS` — nothing in this document is a device claim.

**Code:** [`akiles94/valija-mobile`](https://github.com/akiles94/valija-mobile), branch
`feat/poc`. That repository is **non-authoritative proof-of-concept scaffolding**, not the
mobile app — see its `README.md`.

---

## 1. What this is testing, and why

`advances/M4/` proved valija's *file format* can be read by a mobile-buildable C library. It
never compiled a line of Kotlin or Swift, never crossed an FFI boundary, never drew a pixel, and
never executed anything on iOS at all. This advance builds the smallest real application that
opens the golden-vault fixture and shows something read out of it, to turn "a valija mobile app
is viable" from an inference into an observed fact.

The precise gaps M4 left, from `refined.md` §3:

| # | Question |
|---|---|
| G1 | Has any valija-related binary ever executed on iOS? |
| G2 | Has the amalgamation executed on Android's real device architecture (arm64)? |
| G3 | Can Kotlin call the amalgamation at all — cinterop on iOS, JNI/NDK on Android? |
| G4 | Does a second implementation of the pack algorithm produce byte-identical output? |
| G5 | Is Argon2id at 64 MiB / t=3 / p=1 acceptable on real mobile hardware? |
| G6 | Does an actual app process — bundle, sandbox, lifecycle, UI thread — work? |
| G7 | Is `docs/vault-format.md` sufficient to implement against without reading `src/`? |

---

## 2. Results

Every row names the hardware that produced it. The four bolded rows below say `NOT COLLECTED`,
permanently; see §10. Three of them — **G1 (physical)**, **G2**, **G5** — could only ever have
been produced by a physical device, so their absence is squarely the closure decision. **G6** is
different: `plan.md` Slice 6/7 planned for CI itself to launch the app and screenshot it, and that
step was never implemented (§3a, §8) — its absence is an omission in what CI does, not something
only a physical device could have closed. **G1 is not one of the four**: its general form (§1's
original question) is closed by the iOS simulator run, the same event as G3b — only the narrower
"on a *physical* iPhone" claim, listed separately below as **G1 (physical)**, stays uncollected.

| # | Question | Where it ran | Result |
|---|---|---|---|
| G4 | Rendered pack byte-identical to `expected-export.md` and `expected-pack.md` | Linux x86_64, JDK 21, `:vault-core:jvmTest` — **no SQLite, no C, no device** | **PASS** — 1887 and 967 bytes, byte-identical |
| G7 | Is the contract implementable without reading `src/`? | Same | **NO** — see §5. Five real defects found and fixed |
| G3a | Kotlin → JNI → amalgamation, end to end | Linux x86_64, JDK 21 — same JNI bridge and vendored C the Android build compiles, **not an Android run** | **PASS** — see §4 ⚠ from a harness that cannot be re-run (§4); independently corroborated at a stronger tier by the real-NDK Android CI row below |
| G5 | Argon2id 64 MiB / t=3 / p=1 | Same (GitHub-hosted Linux runner class CPU) | **178 ms** — *desktop-class silicon; not a phone measurement.* ⚠ the only *committed* Argon2id number in this advance, and it rests solely on the unreproducible harness in §4 — not independently re-checkable. `AndroidVaultConformanceTest.kt` also prints a device-class (emulator) timing on every green CI run, but that number was never extracted or committed — same gap as §8's CI-log row |
| — | Wrong key surfaces as `WRONG_PASSPHRASE`, not corruption | Same | **PASS** ⚠ the *number* above is from the unreproducible harness, but this specific check is independently corroborated at a stronger tier: `AndroidVaultConformanceTest.kt:97–103` and `IosVaultConformanceTest.kt:102–108` both assert it on their respective CI emulator/simulator runs |
| — | Read-only: fixture unmutated, no `-wal`/`-shm`/`-journal` produced | Same | **PASS** ⚠ also independently corroborated: `AndroidVaultConformanceTest.kt:90–93` asserts zero sidecar files on the Android emulator run in CI |
| — | Vendored C compiles through the **real Android NDK** for `arm64-v8a` **and** `x86_64` | GitHub Actions `ubuntu-latest`, Kotlin 2.1.20, AGP 8.7.3 + NDK via CMake, compileSdk/targetSdk 35, minSdk 24. **NDK version not recorded** — see §8's CI-log row | **PASS** — `:composeApp:assembleDebug` green |
| — | Vendored C compiles and archives through **real Xcode clang** for `arm64-apple-ios` **and** `arm64-apple-ios-simulator` | GitHub Actions `macos-latest`, Kotlin 2.1.20. **macOS image and Xcode version not recorded** — see §8's CI-log row | **PASS** — `build-apple-native.sh` green for both targets |
| G3a | JNI/NDK → amalgamation executing on Android | Android emulator, GitHub Actions `ubuntu-latest`, API 34, `google_apis`, **x86_64** (not arm64 — G2) | **PASS** — `:vault-interop:connectedAndroidTest` green (§3a) |
| G3b | Kotlin/Native cinterop → amalgamation executing | iOS simulator, GitHub Actions `macos-latest`, Compose Multiplatform 1.7.3. **Simulator device/runtime version not recorded** — see §8's CI-log row | **PASS** — `:vault-interop:iosSimulatorArm64Test` green (§3a) |
| **G1** | **Has any valija-related binary ever executed on iOS?** (§1's original, general question — device *or* simulator) | iOS **simulator**, same run as G3b | **PASS** — a real binary executed on iOS for the first time. G3b *is* the answer to G1; they are the same event, viewed from M4's gap list vs. this advance's interop question |
| — | APK declares zero permissions | GitHub Actions | **PASS** — `aapt2 dump badging` shows no `uses-permission` line |
| **G1 (physical)** | **App executes specifically on a physical iPhone** — the narrower claim P-6(b) introduced, distinct from the general G1 row above | — | **NOT COLLECTED** — advance closed before Slice 9, §10 |
| **G2** | **App executes on physical Android arm64** — never closed at *any* tier: the CI emulator is explicitly x86_64, not arm64 evidence (§3, §3a) | — | **NOT COLLECTED** — advance closed before Slice 9, §10 |
| **G6** | **A real app process — bundle, sandbox, lifecycle, UI thread** — rests on nothing CI produced either: both CI jobs run isolated `:vault-interop` conformance tests, never launch `:composeApp`'s UI, so no tier ever demonstrated a real app process | — | **NOT COLLECTED** — primarily because the planned CI launch/screenshot step (`plan.md` step 46) was never implemented, not because the closure decided against it; the physical-device run that would also have closed it is additionally out of scope under §10 |
| **G5** | **Argon2id on real phone hardware** | — | **NOT COLLECTED** — advance closed before Slice 9, §10 |

---

## 3a. CI status — green (first run was red; kept below for the record)

### First run (superseded)

First real CI run: [`valija-mobile` run #2](https://github.com/akiles94/valija-mobile/actions/runs/30712157216)
(commit `e508cf7`). **1 of 3 jobs green at the time.**

| Job | Result |
|---|---|
| Domain conformance (JVM) | **green** — both byte comparisons pass on a clean checkout, which also proves the four-target KMP build configures correctly |
| Android build + x86_64 emulator | **red** — the NDK build of the vendored C for both ABIs **succeeded**; the job then failed at my `aapt2 dump badging` permissions step, so the emulator step never ran |
| iOS simulator | **red** — `build-apple-native.sh` **succeeded** for both Apple targets on a real Mac; the job then failed at the cinterop conformance step |

**What this does and does not mean.** Both real mobile toolchains — Android's NDK and Xcode's
clang — compiled and archived the vendored SQLite3MultipleCiphers amalgamation and Argon2id for
their **device** architectures without modification. That was the largest unknown in the build
story and it is now answered. What is *not* answered is whether that C then executes correctly
through each language boundary on those platforms: both failures land in the glue after the
native build, and neither has been diagnosed yet. **At this point in the run, G3a and G3b were
still open** — the rows in §2 said so rather than borrowing confidence from the compile step
that did pass. Both are now closed; see the update immediately below and §2's current PASS rows.

A run that was red because a permissions-check invocation was wrong was not evidence that the app
worked. It was also not evidence that it did not. Both jobs needed fixing and re-running before
anything from that run could be claimed — and nothing from it was.

### Fixed, now green

[`valija-mobile` run #11](https://github.com/akiles94/valija-mobile/actions/runs/30723496087)
(commit `644e4e1`). **3 of 3 jobs green.** Independently re-verified 2026-08-16 against the GitHub
Actions API directly (not just the linked page): all three jobs — `Domain conformance (JVM)`,
`Android build + x86_64 emulator (NOT arm64 evidence)`, `iOS simulator (NOT a physical device)` —
report `status: completed`, `conclusion: success`. `valija-mobile`'s `.github/workflows/ci.yml`
was read directly, not inferred: none of the three jobs runs a screenshot step (see §8's evidence
table); the Android job's zero-permissions claim is enforced by the workflow itself (`grep -q
"uses-permission" ... && exit 1`), and its passing is what proves the claim, not a separate
assertion. Getting to green took several real, evidence-driven fix rounds rather than one; each
is recorded because two of them disprove an earlier theory rather than confirm it:

- **YAML**: an unquoted step name with a colon was parsed as a mapping key, producing a 0-job
  workflow before any job could even start.
- **Domain/iOS source-set configuration**: `KotlinSourceSet with name 'iosTest' not found`, then a
  raw Gradle NPE from the same eager-lookup pattern once `androidTarget()` was in the mix.
  `compilations.getByName("test").defaultSourceSet` (a proven, already-used API rather than a name
  lookup) fixed it.
- **Android permissions**: the merged manifest declared
  `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. First theory — `androidx.profileinstaller` — was
  wrong; the next CI run showed the identical permission, unchanged, with the exclusion in place.
  The real, confirmed cause was `androidx.core` itself; fixed with an explicit
  `tools:remove` in `AndroidManifest.xml`.
- **iOS cinterop compile**: `sqlite3`/`sqlite3_stmt` unresolved. SQLite's opaque, forward-declared
  structs land in the shared `cnames.structs.*` namespace, not the `.def` file's own package.
  While fixing this, a real correctness bug surfaced too: the original bound-parameter destructor
  was effectively `SQLITE_STATIC`, a latent use-after-free — replaced with a manually reconstructed
  `SQLITE_TRANSIENT` (cinterop cannot extract the C macro, which is a cast expression, not a
  constant).
- **iOS source-set duplication**: fixing the source-set lookup above (by explicitly re-adding
  `src/iosTest/kotlin`) made `IosVaultConformanceTest.kt` a member of two source sets at once. The
  shared `iosTest` source set turned out to already exist and be wired by Kotlin's own naming
  convention; the explicit re-add was removed.
- **iOS generated-constant visibility**: fixing source-set duplication then exposed
  `Unresolved reference 'FIXTURES_PATH'` — the generated fixtures-path constant was wired onto each
  leaf target's own `test` compilation, invisible to the shared parent `iosTest` source set the
  test class actually lives in. Fixed by wiring it onto `iosTest` itself via a Gradle
  live-collection filter (`sourceSets.matching { }.configureEach { }`), since eager name lookups on
  that source set are what failed earlier in this same file.
- **Android instrumented-test dependency, twice**: `Unresolved reference 'Test'` /
  `assertEquals` / `assertTrue`. First attempt added `kotlin-test` to the plain AGP
  `androidTestImplementation` configuration — the next CI run showed the identical errors,
  unchanged, proving that fix did nothing. `kotlin-test` is a genuinely multiplatform artifact
  with a distinct `androidJvm` Gradle Module Metadata variant; the plain AGP configuration carries
  no Kotlin platform-type attribute to select it. The working fix routes it through
  `kotlin { sourceSets { androidInstrumentedTest.dependencies { } } }` instead, the Kotlin-aware
  path.

G3a, G3b, and the zero-permissions claim are now established — see §2. Slice 9's physical-device
rows (G1, G2, G6, and G5 on real hardware) are unaffected by any of this: no CI run, however
green, is a substitute for them.

## 3. Claim scoping — what was **not** executed

This section decides whether this advance repeats M4's C3 finding (a macOS run published as an
iOS run). It was written **before** any device run — and, per §10, no device run ever
happened — so it was never shaped to fit one.

- **Nothing ever ran on a physical iPhone or a physical Android phone.** Both G1 and G2 are
  closed as **not collected**, permanently, for this advance — see §10. The screenshots that would
  have closed them do not exist and will not be produced under this advance.
- **The Linux full-stack run (§4) is not an Android run and not an iOS run.** It compiles the
  *same* `valija_native.c`, the *same* vendored `sqlite3.c`, and the *same* Kotlin sources the
  Android build uses, on Linux/x86_64 against the JDK's JNI rather than the NDK's. It proves the
  bridge logic, the SQL, the row mapping, the key derivation and the renderer agree end to end.
  It proves nothing about the NDK toolchain, the Android runtime, ABI packaging, or arm64.
- **The CI Android job is an x86_64 emulator.** It is *not* the arm64 evidence for G2. The job is
  named "Android build + x86_64 emulator (NOT arm64 evidence)" so the distinction survives being
  quoted out of context.
- **The CI iOS job is a simulator.** arm64 ISA and real iOS frameworks, but the macOS kernel and
  a simulator runtime. It proves nothing about code signing, entitlements, provisioning, the
  Secure Enclave, background suspension, thermal behaviour, or App Store review.
- **The JVM conformance test is not a device run**, and the largest single result in this
  document (G4) comes from it.
- **No App Store or Play Store submission, distribution certificate, or store review happened,
  and none ever will under this advance** (§10). Had the iOS device run happened, it would have
  used a *development* provisioning profile from a free Apple ID; production entitlements and
  store review were never exercised and now never will be.
- **No biometrics, keychain, keystore, session model or idle lock** exists in this PoC (M4 D-I).
- **No document picker.** Therefore **no answer at all** to M4 D-H's unsynced-vault detection —
  the genuinely hard part of real-vault access remains completely untested, and the app advance
  must not be sized as though this PoC touched it.
- **No write of any kind was attempted.** M4 already answered the write round-trip on Linux.
- **The vault was a bundled published fixture, not a user's synced vault.** Its passphrase and
  key are public test data by design.

---

## 4. The Linux full-stack interop run

**Provenance caveat, added at closure review (2026-08-16).** This section's harness — a JVM
target and a test class (`FullStackVerification`) driving the same JNI bridge and Kotlin sources
the Android build uses — was a scratch tool, never committed to `valija-mobile`: no `jvm()`
target exists on `:vault-interop`, and no file or commit named `FullStackVerification` exists on
any branch. **It cannot be reproduced from the kept tree, in either repository, as this stands.**
The log below (`evidence/linux-fullstack-interop.log`) is real output from a run that happened;
nobody can re-run it today to check it. §2 marks every row that depends on it. Where a row is
also independently established elsewhere in this document (G3a, via the Android CI emulator run
at a stronger tier — real NDK, not this harness's plain JNI), that independent evidence stands on
its own; where it is not (the Argon2id timing, the `WRONG_PASSPHRASE` check, the no-sidecar
check), the claim rests solely on unreproducible evidence and should be weighted accordingly.

The most substantial pre-device result, and the one that most de-risks the hardware session.

**What ran:** `vendor/sqlite3mc/sqlite3.c` and `vendor/argon2/**` compiled with the exact flags
in `gradle/native-defines.txt` and `gradle/argon2-defines.txt`, linked with
`vault-interop/src/androidMain/cpp/valija_native.c` into `libvalija_native.so`, loaded by the
JVM, driven through the real `Sqlite3mcDatabase` / `Sqlite3mcVaultReader` / `ReadContextPack`
Kotlin sources, against the real encrypted `vendor/golden-vault/vault.db`.

```
ARGON2ID: 64 MiB / t=3 / p=1 -> 178 ms
CONFORMANCE: PASS — 1887 bytes, byte-identical to expected-export.md
CONFORMANCE: PASS — 967 bytes, byte-identical to expected-pack.md
```

Full log: `evidence/linux-fullstack-interop.log`.

### The finding that would have cost a day on borrowed hardware

**SQLite3MultipleCiphers embeds its own copy of Argon2** (it offers Argon2 KDF options), so
linking a second copy of `phc-winner-argon2` into the same binary fails:

```
multiple definition of `FLAG_clear_internal_memory';
core.o: first defined here
```

Almost all of SQLite3MC's embedded copy is `static`; that one global `int` is not, and
SQLite3MC does **not** export `argon2id_hash_raw`, so its copy cannot simply be reused. The fix
is a compile-time rename of our copy's symbol, recorded in `gradle/argon2-defines.txt`:

```
-DFLAG_clear_internal_memory=valija_argon2_clear_internal_memory
```

This is the portable fix: it needs no linker flags (`--allow-multiple-definition` is GNU-ld-only
and wrong for Apple's linker) and no edit to vendored sources, so the identical flag works for
gcc, the NDK's clang, and Xcode's clang. **A first-contact link failure like this on a borrowed
Mac, with the clock running, is exactly the scenario plan.md R1 warned about.**

---

## 5. Findings against `docs/vault-format.md` (G7)

**The answer to G7 is no — the document was not sufficient to implement against.** This is worth
stating precisely, because the byte comparisons passed on the first run and could be misread as
"the contract was fine". They passed because the Kotlin port was written by reading
`src/context/domain/services/context-pack.ts` and `src/delivery/context-pack-markdown.ts`
directly. Working only from §8 and §9 would have produced *visibly* correct Markdown that failed
a byte comparison.

Five defects, all fixed in this advance (P-12 Option 1):

1. **§9 had no concatenation rule** — the single largest gap. The template shows the shape of a
   pack but cannot tell you why some gaps are one blank line and some are two. That falls out of
   `header + parts.join("\n")` with newlines contributed from three separate places. Any
   reasonable "append line by line" implementation gets this wrong and looks right in a preview.
2. **§8 section-label budgeting** (M4 review W5) — "added once per section, not per item" glossed
   over three genuinely different rules: `Pinned` charges its label unconditionally before the
   loop; `Latest handoff` tests item+label as a single sum; a by-type section folds the label
   into the *first candidate's* test and charges the **lowercase wire name**, not the plural
   heading.
3. **§8 latest-handoff selection** (M4 review W6) — the rule is the newest handoff *not already
   placed in Pinned*, not simply the newest handoff. Invisible in the fixture, real in general.
4. **§8 `estimateTokens`** — never said `text.length` means UTF-16 code units. Swift's
   `String.count` counts grapheme clusters and would disagree on any astral character. The
   fixture's `café ☕` does **not** catch this (all BMP: 6 units *and* 6 graphemes); the Kotlin
   test now pins it with `"𝄞"` instead.
5. **§8 preamble timestamp** — never said it is JavaScript `toISOString()`, i.e. always exactly
   three fractional-second digits. Most languages' default ISO formatters elide zero
   milliseconds, changing both the token estimate and the rendered header.

**Recorded, not fixed:** M4 review W7 — the published search-limit constants (1–100, default 20)
are pinned by no test. Fixing that needs a test under `valija/src/`, which `refined.md` §9's
first acceptance criterion forbids in this advance. It belongs to the next advance.

---

## 6. Provenance of the vendored C (P-10)

| Item | Value |
|---|---|
| SQLite3MultipleCiphers | `v2.3.5` |
| SQLite core | `3.53.2` |
| Source npm package | `better-sqlite3-multiple-ciphers@12.11.1` |
| `sqlite3.c` SHA-256 | `670d8d053176b53a68073b168f8e68fb72db67bdf964a0eb130338e9391198b9` |
| Licence | **MIT — verified**, fetched from upstream at tag `v2.3.5`, matched against the source file's own header block |
| Argon2 | `phc-winner-argon2` reference sources as vendored by `argon2@0.44.0`, algorithm version 1.3 |
| Argon2 backend | `ref.c`, **not** `opt.c` — `opt.c` is x86 SSE2-only, so on arm64 the reference path is upstream's only path. The G5 timing is not artificially pessimistic. |
| Argon2 licence | Dual CC0-1.0 / Apache-2.0; **Apache-2.0 elected** to match valija |

Per-file hashes: `valija-mobile/vendor/*/PROVENANCE.md`. Licence texts in full:
`valija-mobile/THIRD-PARTY-NOTICES.md`. Compile flags: `gradle/native-defines.txt` (sqlite3mc)
and `gradle/argon2-defines.txt` (argon2), each read by **both** the Android CMake build and the
iOS build script, so the two platforms cannot drift.

---

## 7. Runbook

### Domain conformance — no device, seconds

```bash
# `main` is not this PoC; the code lives on `feat/poc` and was never merged (§10, D-2 unmet)
git clone -b feat/poc https://github.com/akiles94/valija-mobile && cd valija-mobile
./gradlew :vault-core:jvmTest
```

### Android, on a physical phone (closes G2; contributes G6, G3a, G5)

```bash
# USB debugging on, device authorised
adb devices
./gradlew :composeApp:installDebug
./gradlew :vault-interop:connectedAndroidTest     # real exit code, real hardware
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
adb shell getprop ro.product.cpu.abi              # MUST read arm64-v8a for G2
adb logcat -d -s ARGON2ID:* TestRunner:* > android-device-run.log
adb shell screencap -p /sdcard/valija.png && adb pull /sdcard/valija.png android-device.png
```

**If `ro.product.cpu.abi` is not `arm64-v8a`, G2 is recorded as still open**, not as closed.

### iOS, on a physical iPhone (closes G1 (physical); contributes G6, G3b, G5)

One-time Xcode project setup is in `valija-mobile/iosApp/README.md` (the `.xcodeproj` is
deliberately not committed). Then:

```bash
./gradlew :vault-interop:buildAppleNativeIosArm64
# Xcode: select the physical device, a personal (free) team, Run.
# Capture: on-device screenshot, Xcode console log, device model, iOS version,
#          Xcode version, and the Argon2id line the app prints.
```

If a test bundle can be signed, also capture `xcodebuild test -destination 'platform=iOS,id=<udid>'`
and its exit code. If signing one proves impractical in the borrowed-Mac window, **record that
plainly** and let the on-screen verdict plus the console log carry the claim — disclosed at the
point of the claim, not in a footnote.

---

## 8. Evidence

| File | What it is |
|---|---|
| `evidence/jvm-conformance.log` | The same ten test names as the committed `GoldenVaultConformanceTest`, run as a standalone Kotlin/JVM project in this sandbox (no Android SDK here); CI's own `:vault-core:jvmTest` is the canonical run of that same test class |
| `evidence/linux-fullstack-interop.log` | The §4 run — **produced by a scratch harness that was not kept; not reproducible from either repo as it stands.** Real output from a real run, but nobody can re-run it today. See §4's provenance caveat before citing any number from it |
| `evidence/sqlite3c-sha256.txt` | Hashes of the vendored amalgamation |
| `evidence/toolchain-versions.txt` | Compilers and versions behind every row above, for what ran in this sandbox and what CI's config declares; CI's actual runner image (macOS image/Xcode version, NDK version, iOS simulator runtime) is **not recorded here**. The run's overall conclusion was reachable via the GitHub Actions API (§3a) and confirmed `success`; the finer-grained log detail that would carry these versions was not pulled down and committed, as part of the same closure decision as the row below |
| `evidence/android-device.png` + `.log` + `-info.txt` | **NOT COLLECTED** — Slice 9 skipped, §10 |
| `evidence/ios-device.png` + `.log` + `-info.txt` | **NOT COLLECTED** — Slice 9 skipped, §10 |
| `evidence/ci-android-emulator.png`, `ci-ios-simulator.png` | **NOT COLLECTED, permanently** — checked against `valija-mobile`'s `.github/workflows/ci.yml` directly: neither CI job ever runs a screenshot step. Both upload test reports, `android-permissions.txt`, and the debug APK — not an image. This row was aspirational at planning time and was never implemented; it is not "pending" in the sense of still arriving. |
| CI job logs and exit codes (both jobs, run #11) | **NOT RETRIEVED, not committed to `advances/MOBILE/evidence/`.** Run #11's `conclusion: success` for all three jobs was confirmed against the GitHub Actions API at review time (§3a), but the underlying logs and the uploaded `android-permissions.txt`/test-report artifacts were never pulled into this repo. They sit inside GitHub's default 90-day retention window as of this writing (2026-08-16) and will eventually disappear; a future reader has, from this repo alone, one hyperlink and an API-confirmed conclusion — not a committed, permanent record |

---

## 9. What a reader should conclude

**Established:** a second, independent implementation of valija's pack algorithm produces
byte-identical output, and the vendored SQLite3MultipleCiphers amalgamation plus vendored
Argon2id open and read a real encrypted valija vault through a real Kotlin/C interop boundary —
demonstrated on Linux/x86_64 with the same sources the mobile builds use, and through CI on both
platforms' real toolchains (NDK clang for Android, Xcode clang for iOS) against an x86_64 Android
emulator and a real iOS **simulator** respectively. That simulator run closes G1 in its original,
general form (§1: "has any valija-related binary ever executed on iOS?") — a real binary really
did, on Apple's own simulator runtime.

**Never established:** that any of it runs on a *physical* phone. §2's four bolded rows are
closed as `NOT COLLECTED`, but for two different reasons — **G1 (physical)**, **G2** (arm64
specifically; the CI emulator is x86_64 and was never claimed otherwise), and **G5** (on-device
timing) are closed **by decision**, since only a physical device could ever have produced them.
**G6** (a real app process was never launched by any CI job, only isolated interop tests) is
closed **by omission**: `plan.md` planned for CI to launch and screenshot the app, and that step
was never built — see
§10. Do not size a future mobile-app advance against this document as though the hard parts are
fully proven; size it against exactly what §2 and §3a say ran, and where.

## 10. Disposition — advance closed, no distributable app

Oscar decided not to pursue a distributable mobile app (2026-08-16). Apple's Developer Program
costs 99 USD/year, is required for any iOS installation beyond a 7-day self-signed build on the
developer's own device, and — together with the ongoing burden of maintaining two store listings —
is not proportionate for a project with no monetization plan. That decision, not a technical
failure, is why Slice 9 (the two physical-device runs) was skipped and Slice 10 closes this
advance on CI-level evidence alone.

This does not discard the advance's findings. Independent of any phone:

- **G3/G4** are closed: Kotlin can call the vendored C through both interop paths (JNI/NDK,
  Kotlin/Native cinterop), and a second, independent implementation of the pack algorithm is
  byte-identical to the Node one.
- **G7** is closed, and answered *no*: `docs/vault-format.md` had five real defects, all found by
  this second implementation and fixed (§5). That correction stands regardless of what runs on a
  phone.
- **G1**, in its original general form, is also closed: the iOS simulator run is a real binary
  really executing on iOS (§2, §9).
- **G1 (physical), G2 and G5** — anything only a physical device can answer, plus G2's
  arm64-specific claim, which no CI tier ever attempted — are closed as **not collected**, by this
  closure decision. **G6** is also **not collected**, but for a different reason: the CI screenshot
  step that would have closed it (`plan.md` step 46) was never implemented, independent of this
  decision — see §2, §9. If a mobile app is ever reconsidered, all four are what the next advance
  would need to re-open, starting from `plan.md` Slice 9's runbook (§7 above), which remains valid
  and unexecuted.

**`akiles94/valija-mobile` is left as-is**: real, CI-green, non-authoritative proof-of-concept
scaffolding — not a maintained product. No further work is planned there under this advance.
