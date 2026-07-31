# MOBILE — minimal real mobile app proof of concept · Implementation Plan

**Spec:** `advances/MOBILE/refined.md` (Gate R approved — Oscar, 2026-07-31). All twelve `P-n`
decisions carry a **Decided:** line and are treated here as settled input, not as options:
P-1 both platforms as equal, non-cuttable deliverables · P-2 rendered pack, byte-compared,
PASS/FAIL on screen · P-3 the code lives in the separate `akiles94/valija-mobile` repo, plan and
review stay here · P-4 correct `docs/SPEC.md` §2, assign no milestone number · P-5 screenshot +
exit status + disclosure · P-6 real physical iOS and Android devices · P-7 Argon2id vendored and
timed on device · P-8 Compose Multiplatform for the UI on both platforms · P-9 bundled fixture,
no picker · P-10 vendor the exact `sqlite3.c` from `node_modules`, hash + flags + licence
recorded · P-11 zero mobile CI in `valija` · P-12 fix `docs/vault-format.md` here, driven by real
byte mismatches.

**Branch in `valija` (this repo — implementer creates it after approval):** `docs/mobile-poc-MOBILE`

**Branch in `valija-mobile`:** see Decision D-2 (recommended: ordinary commits on `main`).

> Implementation must NOT begin until Oscar has reviewed this file and recorded an `Approved:`
> line at its top. **The implementation gate is live for this advance even though `valija/src/`
> is never touched:** `.claude/hooks/guard-implementation.sh` matches the glob `*/src/*`, and
> every Kotlin source in `valija-mobile` sits under `<module>/src/…`. Editing those files from a
> session rooted in `valija` will be blocked until the marker exists. That is correct behaviour —
> do not work around it.

---

## 1. Summary

This advance builds the smallest real mobile application that opens valija's golden-vault
fixture, renders project `alpha`'s context pack with a second (Kotlin) implementation of the pack
algorithm, byte-compares it against `expected-export.md` on the device, and shows the verdict on
screen — and proves it ran on a physical iPhone and a physical Android phone.

It spans two repositories, and **every slice below is tagged with the repo its files land in**:

| Tag | Repo | What lives there |
|---|---|---|
| **[V]** | `valija` (this repo) | `advances/MOBILE/poc.md`, `advances/MOBILE/evidence/`, corrections to `docs/vault-format.md`, the `docs/SPEC.md` §2 / §10b fix, one `CHANGELOG.md` line. **No `src/`, no `package.json`, no build config, no workflow.** |
| **[VM]** | `akiles94/valija-mobile` | The whole Kotlin Multiplatform + Compose Multiplatform PoC: Gradle build, shared domain, the two interop adapters, the vendored `sqlite3.c` and `phc-winner-argon2`, the Compose screen, the Xcode wrapper, and the repo's own GitHub Actions workflows. |
| **[Oscar]** | — | The two physical-device runs. No agent can execute these. |

The evidence chain, from cheapest to most expensive, is deliberate (`refined.md` §5's pyramid):

1. **JVM, no device, seconds** — the pure Kotlin domain renders both expected packs from
   `seed.json` and byte-compares them. Closes most of G4 and all of G7's document-quality
   question before a single runner boots.
2. **CI, valija-mobile** — Android APK builds with the NDK; the iOS framework builds and links
   against the real iPhoneOS SDK on `macos-latest`; an x86_64 emulator run and an iOS-simulator
   run give machine-checkable on-device-ish conformance.
3. **Physical devices, Oscar** — the two runs that actually close G1, G2, G3 and G6, plus G5's
   only honest timing.

Everything in step 1 and 2 can be developed without the borrowed Mac. **The borrowed Mac is
reserved for the physical-iPhone run** (Slice 9), keeping that scarce window to roughly one to two
hours.

---

## 2. Ordered steps

Run the repo-appropriate check after each slice:
**[V]** `npm run typecheck && npm run lint && npm run test`;
**[VM]** `./gradlew :vault-core:jvmTest` and, once they exist, the platform assemble tasks.

---

### Slice 1 — [VM] Repo skeleton, licences, and the vendored C

**Goal:** the repo builds an empty KMP project and carries every third-party artifact with a
recorded version, hash and licence, before a line of domain code is written.

1. **Check out `valija-mobile` as a sibling of `valija`** — recommended `/home/user/valija-mobile`
   (D-2). Never inside `valija`'s working tree; nothing from `valija-mobile` may ever appear in a
   `valija` commit.
2. **Add `.gitattributes`** (first, before any fixture is copied — line endings must never be
   negotiable):
   ```
   * text=auto eol=lf
   *.db binary
   *.png binary
   *.c binary
   *.h binary
   ```
   `*.c`/`*.h` as binary keeps the multi-megabyte amalgamation out of every diff and immune to
   normalisation; its SHA-256 is the thing that matters.
3. **Add `LICENSE`** — Apache-2.0, matching `valija` (`docs/SPEC.md` D2), same copyright holder.
4. **Vendor the amalgamation** into `vendor/sqlite3mc/`:
   - `sqlite3.c`, `sqlite3.h`, `sqlite3ext.h` copied **byte-for-byte** from
     `valija/node_modules/better-sqlite3-multiple-ciphers/deps/sqlite3/`.
   - `LICENSE` — fetched from `utelle/SQLite3MultipleCiphers` at tag **`v2.3.5`**. **Verified, not
     assumed** (P-10's obligation): the vendored file's own header block reads
     `Name: sqlite3mc.c · Author: Ulrich Telle · Copyright: (c) 2006-2025 Ulrich Telle ·
     License: MIT`. MIT requires the full licence text plus the copyright notice to travel with
     the source, which is why the upstream `LICENSE` is fetched rather than paraphrased. The
     embedded SQLite core is public domain and needs no notice, but say so.
   - `PROVENANCE.md` — SQLite3MultipleCiphers `v2.3.5`; SQLite `3.53.2` (from
     `deps/update-sqlite3mc.sh`'s `VERSION="3530200"`); source npm package
     `better-sqlite3-multiple-ciphers@12.11.1`; the **SHA-256 of each copied file**, computed and
     pasted; and the exact desktop compile flags, reproduced verbatim from
     `deps/defines.gypi` + `deps/sqlite3.gyp`:
     ```
     -std=c99 -w -O3 -DNDEBUG
     -DHAVE_INT16_T=1 -DHAVE_INT32_T=1 -DHAVE_INT8_T=1 -DHAVE_STDINT_H=1
     -DHAVE_UINT16_T=1 -DHAVE_UINT32_T=1 -DHAVE_UINT8_T=1 -DHAVE_USLEEP=1
     -DSQLITE_DEFAULT_CACHE_SIZE=-16000 -DSQLITE_DEFAULT_FOREIGN_KEYS=1
     -DSQLITE_DEFAULT_MEMSTATUS=0 -DSQLITE_DEFAULT_WAL_SYNCHRONOUS=1 -DSQLITE_DQS=0
     -DSQLITE_ENABLE_COLUMN_METADATA -DSQLITE_ENABLE_DBSTAT_VTAB -DSQLITE_ENABLE_DESERIALIZE
     -DSQLITE_ENABLE_FTS3 -DSQLITE_ENABLE_FTS3_PARENTHESIS -DSQLITE_ENABLE_FTS4
     -DSQLITE_ENABLE_FTS5 -DSQLITE_ENABLE_GEOPOLY -DSQLITE_ENABLE_JSON1
     -DSQLITE_ENABLE_MATH_FUNCTIONS -DSQLITE_ENABLE_PERCENTILE -DSQLITE_ENABLE_RTREE
     -DSQLITE_ENABLE_STAT4 -DSQLITE_ENABLE_UPDATE_DELETE_LIMIT
     -DSQLITE_LIKE_DOESNT_MATCH_BLOBS -DSQLITE_OMIT_DEPRECATED
     -DSQLITE_OMIT_PROGRESS_CALLBACK -DSQLITE_OMIT_SHARED_CACHE -DSQLITE_OMIT_TCL_VARIABLE
     -DSQLITE_SOUNDEX -DSQLITE_THREADSAFE=2 -DSQLITE_TRACE_SIZE_LIMIT=32
     -DSQLITE_USER_AUTHENTICATION=0 -DSQLITE_USE_URI=0
     ```
     This list is defined **once**, in `gradle/native-defines.txt`, and read by both the Android
     CMake build and the iOS `Exec` task — a define that differs between platforms is exactly the
     silent-divergence trap P-10 warns about.
     `SQLITE_THREADSAFE=2` is multi-thread mode: one connection may never be shared between
     threads. The PoC confines all database work to one dispatcher (Slice 6).
5. **Vendor `phc-winner-argon2`** into `vendor/argon2/` — `include/argon2.h`, `src/argon2.c`,
   `src/core.c`, `src/core.h`, `src/encoding.c`, `src/encoding.h`, `src/thread.c`, `src/thread.h`,
   `src/ref.c`, `src/blake2/*` — plus its `LICENSE` (dual CC0-1.0 / Apache-2.0) and its commit or
   release tag in `PROVENANCE.md` with per-file SHA-256s.
   - **`ref.c`, not `opt.c`.** `opt.c` is x86 SSE2-specific; on arm64 the reference implementation
     is upstream's only path, so this is not a slow-path choice — say so in `poc.md` so the G5
     timing is not read as pessimistic.
   - Compile with `-DARGON2_NO_THREADS` (the vault is `parallelism: 1`), which removes the pthread
     dependency from the iOS link entirely.
6. **Vendor the golden-vault fixture** into `vendor/golden-vault/` — `vault.db`, `vault.json`,
   `manifest.json`, `seed.json`, `expected-export.md`, `expected-pack.md`, and the fixture's own
   `README.md` — copied byte-for-byte from `valija/src/testing/__fixtures__/golden-vault/`, with
   a `SHA256SUMS` file so drift from `valija` is detectable. `README.md` travels with them because
   it is the file that says, loudly, that the passphrase and key are **published test values, not
   secrets** (`refined.md` §8.1).
7. **Gradle skeleton** — `settings.gradle.kts` (three modules), root `build.gradle.kts`,
   `gradle.properties`, `gradle/libs.versions.toml`, and the Gradle wrapper. Namespace and Android
   `applicationId`: `dev.valija.poc` (D-11).
   **The version catalogue is the whole dependency surface, and it is short by design:** Kotlin,
   AGP, Compose Multiplatform, `kotlinx-serialization-json`, `kotlin-test`, and (Android only)
   `androidx-activity-compose` + `androidx-test-runner`. **No networking library, no analytics, no
   crash reporter, no Firebase, no remote config, ever** (`refined.md` §8.2). Any addition to this
   file is a reviewable event.
8. **`README.md`** — what this repo is, that it is a **proof of concept and explicitly
   non-authoritative scaffolding** (P-3's obligation), that the shipping mobile app is a separate,
   much larger advance, and a pointer back to `valija/advances/MOBILE/poc.md` and
   `valija/docs/vault-format.md`. **`THIRD-PARTY-NOTICES.md`** — the two vendored licences in full.
9. **Do not create an `advances/` directory here, and do not run the `git-ops` subagent in this
   repo.** The seeded `.claude/` copy carries `guard-git-ops.sh`, which **fails closed** when no
   `advances/*/review.md` exists — it would block every push. Commit and push with ordinary Bash
   from the main session (P-3's "ordinary commits, no separate gate"). `guard-implementation.sh`
   is inert here for the same reason (no `advances/*/plan.md`), so nothing is lost.

**Done when:** `./gradlew tasks` succeeds, `LICENSE` / `THIRD-PARTY-NOTICES.md` /
`vendor/*/PROVENANCE.md` are complete with real hashes, and no source file has been written yet.

---

### Slice 2 — [VM] The pure Kotlin domain, and the JVM conformance gate

**Goal:** close G4 and G7 on the JVM, with no SQLite, no C, no device. This is the slice that
makes the rest cheap; do not shortcut it.

Module `:vault-core` — KMP targets `jvm()`, `androidTarget()`, `iosArm64()`,
`iosSimulatorArm64()`. **Zero `expect`/`actual`, zero platform API, zero Compose.** That is what
lets its tests run on the JVM.

10. **`domain/values/ItemType.kt`** — `enum class ItemType(val wireName: String)` over the six
    `CHECK`-listed values (`docs/vault-format.md` §6), plus `fun parseItemType(raw: String):
    ItemType?`. The `wireName` is what the renderer prints (`### decision · …`), never the enum
    name.
11. **`domain/entities/ContextItem.kt`, `domain/entities/Project.kt`** — data classes.
    **Timestamps are the raw stored ISO strings, not a date type** (D-7). The item date is
    `createdAt.take(10)`; the pack preamble uses the manifest's `generatedAt` string verbatim.
    This deletes an entire class of bug: `kotlinx.datetime.Instant.toString()` renders
    `2026-07-26T12:00:00Z`, while JavaScript's `Date.toISOString()` renders
    `2026-07-26T12:00:00.000Z` — a one-character mismatch that would fail every byte comparison
    for a reason that looks like nothing. Ordering is `ORDER BY created_at DESC` in SQL, so
    nothing in Kotlin ever compares two timestamps.
12. **`domain/services/ContextPack.kt`** — the algorithm, ported from
    `src/context/domain/services/context-pack.ts` against `docs/vault-format.md` §8:
    - `estimateTokens(text: String): Int = (text.length + 3) / 4` — integer arithmetic, no
      floating point. **Kotlin's `String.length` is UTF-16 code units, matching JavaScript's**;
      this is asserted by a test, not by a comment (`refined.md` §9).
    - `estimateItemTokens(item)` over exactly
      `"${type.wireName} ${createdAt.take(10)} ${tags.joinToString(" ")}\n\n${content}"`.
    - `assembleContextPack(projectName, items, generatedAt, budgetTokens: Int?)` returning
      `ContextPack(projectName, generatedAt, sections, includedCount, totalCount,
      estimatedTokens)`, with `budgetTokens = null` meaning unbudgeted.
    - Section order and the three label-charging rules **exactly** as the TypeScript charges them
      — this is M4 review W5, and getting it wrong here is the whole point of the exercise:
      * *Pinned:* `estimateTokens("Pinned")` is added **unconditionally, before the loop**, and
        the first pinned item is kept **even if it alone exceeds the budget**.
      * *Latest handoff:* item cost **plus** `estimateTokens("Latest handoff")` are tested
        against the budget **together**; the label is charged only if the pair fits.
      * *By type:* the label is `estimateTokens(type.wireName)` — the lowercase wire name
        (`"decision"`), **not** the rendered plural title (`"Decisions"`) — and it is folded into
        the **first candidate's** budget test, so it is charged only if that first item fits.
    - *Latest handoff selection* is M4 review W6: the newest `handoff` **not already placed in the
      Pinned section**. A pinned handoff that the budget pushed out of the Pinned section is still
      eligible. Write it that way and record the divergence from `docs/vault-format.md` §8.
13. **`delivery/ContextPackMarkdown.kt`** — `renderContextPackMarkdown(pack): String`, ported from
    `src/delivery/context-pack-markdown.ts`. The load-bearing detail the current contract does not
    state is the **concatenation rule**:
    `header + parts.joinToString("\n")`, where `parts` is, per section, the string
    `"\n## <Title>\n"` followed by one `"### <type> · <YYYY-MM-DD>[ · #tag …]\n\n<content>\n"` per
    item. That join is what produces the *two* blank lines before every `##` heading that follows
    an item, and the single blank line after it, in `expected-export.md`. Separator is `·`
    (U+00B7). Section titles: `Pinned`, `Latest handoff`, `Decisions`, `Preferences`, `Progress`,
    `Facts`.
14. **`domain/services/PackConformance.kt`** — `fun compareRendered(actual: ByteArray, expected:
    ByteArray): ConformanceVerdict`, where `ConformanceVerdict` is
    `Pass(byteCount)` | `Fail(byteCount, expectedByteCount, firstDifferenceIndex)`. **A byte
    comparison over UTF-8 bytes**, not a String comparison, not normalised, not
    whitespace-insensitive — and the failure carries the exact byte offset the screen shows
    (`FAIL — first difference at byte 812`).
15. **`domain/VaultError.kt`** — the module's single error type, the Kotlin analogue of
    `src/context/domain/errors.ts`: `class VaultError(val code: String, message: String)` plus
    small constructors (`vaultErr("SCHEMA_TOO_NEW", …)`). Codes used by the PoC:
    `WRONG_PASSPHRASE`, `SCHEMA_TOO_NEW`, `JOURNAL_SIDECAR_PRESENT`, `PROJECT_NOT_FOUND`,
    `KEY_MISMATCH`. This is a per-module well-known file, the standing exception CLAUDE.md allows.
16. **`domain/values/VaultHeader.kt` and `domain/values/GoldenVaultManifest.kt`** —
    `kotlinx.serialization` data classes plus `parseVaultHeader(json: String): VaultHeader` /
    `parseGoldenVaultManifest(json: String)`. `parseX` returning a `Result`-shaped type is this
    repo's convention for input crossing a boundary; the header is exactly that (it is read from a
    file, and a malformed one must be an error message, not a crash). Reject `schemaVersion != 1`.
    Base64-decode the salt with `kotlin.io.encoding.Base64` (opt-in, no dependency).
17. **`application/ports/VaultReader.kt`** — the one port `refined.md` §5 requires:
    ```kotlin
    interface VaultReader {
        fun readSchemaVersion(): String
        fun findProjectByName(name: String): Project?
        fun findActiveItems(projectId: String): List<ContextItem>
        fun close()
    }
    ```
    `findActiveItems` names the `archived = 0` filter in the port's own vocabulary, so no caller
    can forget it.
18. **`application/ports/KeyDeriver.kt`** — `interface KeyDeriver { fun deriveKeyHex(passphrase:
    String, salt: ByteArray, memoryKiB: Int, iterations: Int, parallelism: Int): String }`.
19. **`application/use-cases/ReadContextPack.kt`** — `class ReadContextPack(private val reader:
    VaultReader) : UseCase<ReadContextPackInput, RenderedPack>`, mirroring
    `GetContextPack implements UseCase<…>` in `src/context/application/use-cases/`. It refuses a
    `schema_version` that is not `"3"` (M4 D-J — never migrate, never partially display), looks
    the project up by name, reads the active items, assembles, renders. It knows the port; it has
    never heard of SQLite. `shared/UseCase.kt` carries the two-line
    `interface UseCase<In, Out> { fun execute(input: In): Result<Out, VaultError> }` contract,
    the per-repo exception analogous to `src/shared/application/use-case.ts`.
20. **`vault-core/src/jvmTest/kotlin/…/GoldenVaultConformanceTest.kt`** — reads
    `vendor/golden-vault/seed.json`, builds `ContextItem`s directly (no database), and asserts:
    - the **unbudgeted** pack for `alpha` is byte-identical to `expected-export.md`;
    - the pack at **`manifest.packBudgetTokens` (150)** is byte-identical to `expected-pack.md`
      — the only thing in this advance that exercises the budgeting rules at all, and therefore
      the only thing that can prove or disprove W5 (D-9);
    - `estimateTokens("abcde") == 2` and `estimateTokens("café ☕") == 2` — the second pins UTF-16
      code-unit counting, since `"café ☕"` is 6 UTF-16 units (`☕` is BMP, so this is the honest
      cheap check) and a grapheme-cluster count would give the same number here; **the sharper
      assertion is `estimateTokens("𝄞") == 1`**, where a surrogate pair makes UTF-16 (2 units) and
      grapheme (1) disagree. Assert both.
    - the pack body contains neither the archived item (`item-a09`) nor the imported item
      (`item-a10`), while the preamble still reads `> 9 items in vault`.
    - `DEFAULT_BUDGET_TOKENS == 4000`.

**Every byte mismatch found here is a finding.** Keep a running list with the exact
`docs/vault-format.md` section and the observed-versus-documented behaviour; Slice 3 lands them.
If a mismatch turns out to be a *desktop behaviour* defect rather than a documentation defect,
**do not change `valija/src/`** — record it as an escalation for the next Gate R (`refined.md`
§4.4, §8.5).

**Done when:** `./gradlew :vault-core:jvmTest` is green and its console output is saved for
`evidence/jvm-conformance.log`.

---

### Slice 3 — [V] First corrections to `docs/vault-format.md` (P-12)

**Goal:** land the contract fixes while the byte mismatches are fresh. Documentation only — no
`src/` change, no fixture regeneration (`docs/vault-format.md` §14).

21. **§8 — section-label budgeting (M4 review W5).** Replace the single sentence *"Section
    headings cost their own label's tokens too … added once per section, not per item"* with the
    three distinct rules, spelled out as in step 12, including the fact that a by-type section is
    charged for the **lowercase type name**, not the rendered plural title.
22. **§8 — latest-handoff selection (M4 review W6).** Replace *"'latest' means exactly one,
    always"* with "the newest `handoff` item that was not already placed in the Pinned section; a
    pinned handoff the budget excluded from the Pinned section is still eligible", keeping the
    "older handoffs never appear in a by-type section" fact, which is correct as written.
23. **§9 — the concatenation rule.** Add the exact `header + parts.join("\n")` construction and a
    short "what the blank lines look like" note, since the current §9 template does not let a
    reader predict `expected-export.md`'s double blank line before a heading.
24. **§9 — the timestamp formats.** State that the preamble timestamp is JavaScript
    `Date.toISOString()`, i.e. always exactly three fractional-second digits and a literal `Z`,
    and that a second implementation whose ISO formatter elides zero milliseconds will produce a
    byte mismatch. Name the per-item form as the first 10 characters of the stored string.
25. **§8 — `estimateTokens` counts UTF-16 code units** (what JavaScript's `String.length` is),
    with the explicit warning that Swift's `String.count` and any grapheme-cluster count are
    wrong. Kotlin matches; Swift does not.
26. **Anything else the port exposed.** Only real findings, each traceable to a byte mismatch or a
    genuine ambiguity hit while implementing. Do not tidy prose.
27. **Record, do not fix, M4 review W7** (the published search-limit constants are pinned by no
    test): pinning them needs a test under `valija/src/`, which `refined.md` §9's first criterion
    forbids in this advance. It goes into `poc.md`'s findings list with its location.

**Done when:** `npm run typecheck && npm run lint && npm run test` are green (they will be — this
is a docs-only slice) and every claim added to the document is one the Slice 2 test holds.

---

### Slice 4 — [VM] The Android interop path (G3a, JNI/NDK)

Android goes first (D-5): it is the better-trodden toolchain, it needs no Mac, and it validates
the shared adapter contract so that an iOS failure later can only be a cinterop problem, not a
design problem.

Module `:vault-interop` — KMP targets `androidTarget()`, `iosArm64()`, `iosSimulatorArm64()`.
Depends on `:vault-core`. **This module is the only place that knows C exists.**

28. **`commonMain/infra/sqlite/Sqlite3mcDatabase.kt`** — the single `expect` boundary, kept
    deliberately tiny:
    ```kotlin
    expect class Sqlite3mcDatabase(path: String, keyHex: String) {
        fun selectAll(sql: String, args: List<String> = emptyList()): List<List<String?>>
        fun close()
    }
    ```
    Materialising twelve rows as strings is free and it means the SQL and the row mapping are
    written **once**, in common code, so the two platforms cannot silently read differently.
29. **`commonMain/infra/sqlite/Sqlite3mcVaultReader.kt`** — `class Sqlite3mcVaultReader(private
    val db: Sqlite3mcDatabase) : VaultReader`. Holds the three statements from
    `docs/vault-format.md` §6–§7 verbatim, and the row → `ContextItem` mapping (`tags` is a JSON
    array in a text column; `pinned`/`archived` are `0`/`1` integers, not booleans). Shared by
    both platforms.
30. **`commonMain/infra/argon2/Argon2idKeyDeriver.kt`** — `expect class Argon2idKeyDeriver() :
    KeyDeriver`, one method.
31. **`androidMain/cpp/valija_native.c`** — the JNI bridge. Narrow and boring: `nativeOpen`
    (`sqlite3_open_v2` with `SQLITE_OPEN_READONLY`, then `PRAGMA cipher='sqlcipher'`, then
    `PRAGMA key="x'…'"`), `nativePrepare`, `nativeBindText`, `nativeStep`, `nativeColumnText`,
    `nativeColumnCount`, `nativeFinalize`, `nativeClose`, and `nativeArgon2idRaw` wrapping
    `argon2id_hash_raw`. It contains **no** `journal_mode`, **no** `wal_checkpoint`, **no** DDL,
    **no** `INSERT`, and no logging of any kind.
32. **`androidMain/cpp/CMakeLists.txt`** — builds one shared library `libvalija_native.so` from
    `vendor/sqlite3mc/sqlite3.c`, the argon2 sources, and `valija_native.c`, with the flag list
    from `gradle/native-defines.txt` plus `-DARGON2_NO_THREADS`. `abiFilters` =
    `arm64-v8a` (the device, G2) and `x86_64` (the CI emulator). `minSdk = 24`, matching M4's
    `aarch64-linux-android24-clang` target.
33. **`androidMain/infra/sqlite/Sqlite3mcDatabase.android.kt` and
    `androidMain/infra/argon2/Argon2idKeyDeriver.android.kt`** — the `actual`s, thin wrappers over
    `external fun` declarations and `System.loadLibrary("valija_native")`.
34. **`androidInstrumentedTest/.../AndroidVaultConformanceTest.kt`** — the on-device,
    machine-checkable half of P-5: pushes the fixture into the app sandbox, derives the key,
    asserts it equals `manifest.keyHex`, opens, reads, renders, asserts byte-identical to
    `expected-export.md`. `./gradlew :vault-interop:connectedAndroidTest` returns a real exit
    code, on the real device, on arm64.

**Done when:** `:composeApp:assembleDebug` produces an APK containing `arm64-v8a` and `x86_64`
`libvalija_native.so`, and `connectedAndroidTest` passes against an emulator (x86_64 — **not** G2
evidence; the arm64 device run is Slice 9).

---

### Slice 5 — [VM] The iOS interop path (G3b, Kotlin/Native cinterop)

Developed **on GitHub Actions `macos-latest`**, not on the borrowed Mac. Expect several
push-iterate cycles; this is the highest-variance slice in the advance (R1).

35. **`vault-interop/build.gradle.kts` — a native build task per Apple target.** One
    parameterised `Exec` task compiling `vendor/sqlite3mc/sqlite3.c` and the argon2 sources with
    `xcrun --sdk <iphoneos|iphonesimulator> clang -target <arm64-apple-ios15.0 |
    arm64-apple-ios15.0-simulator>` plus the shared flag list, then `libtool -static` into
    `build/native/<target>/libvalijanative.a`. Wire it as a `dependsOn` of the corresponding
    `cinterop…` task so a clean checkout builds in one command.
36. **`vault-interop/src/nativeInterop/cinterop/sqlite3mc.def` and `argon2.def`** — headers,
    `compilerOpts` pointing at `vendor/`, and `staticLibraries`/`libraryPaths` pointing at the
    archive from step 35. Two `.def` files over one archive keeps the two Kotlin packages honest
    about which C library they came from.
37. **`iosMain/infra/sqlite/Sqlite3mcDatabase.ios.kt` and
    `iosMain/infra/argon2/Argon2idKeyDeriver.ios.kt`** — the `actual`s, calling the cinterop
    bindings directly (no hand-written C on this side; that asymmetry *is* the point of G3).
    Same open sequence, same read-only posture, same absence of logging.
    `memScoped`/`usePinned` for the byte buffers; free every statement in a `finally`.
38. **`iosTest/.../IosVaultConformanceTest.kt`** — the same assertions as step 34, runnable via
    `./gradlew :vault-interop:iosSimulatorArm64Test` in CI and, on the borrowed Mac,
    `xcodebuild test -destination 'platform=iOS,id=<udid>'` on the physical phone.

**Known risk and its fallback (R1):** if the vendored static library's symbols do not survive into
the Compose framework link, the fallback is to add `sqlite3.c` and the argon2 sources to the
Xcode target's own Compile Sources and let Xcode link them into the app (a static Kotlin framework
tolerates unresolved externals until Xcode's final link). Choose one, and record which one in
`poc.md` with its exact flags — a define that differs between the Gradle path and the Xcode path
would re-open the whole compatibility question.

**Done when:** `:vault-interop:iosSimulatorArm64Test` passes on `macos-latest` and the `iosArm64`
(device) target compiles and links clean.

---

### Slice 6 — [VM] The Compose Multiplatform screen and the app shells

Module `:composeApp` — Compose Multiplatform, `androidTarget()` (with
`com.android.application`) and the two iOS targets exporting a `ComposeApp` framework. Depends on
`:vault-core` and `:vault-interop`.

39. **`commonMain/composeResources/files/golden-vault/`** — the five files the app needs at
    runtime (`vault.db`, `vault.json`, `manifest.json`, `expected-export.md`, and the fixture
    `README.md`), read with `Res.readBytes(...)`. `seed.json` and `expected-pack.md` stay out of
    the bundle; they are JVM-test inputs only.
40. **`commonMain/infra/FixtureSnapshot.kt`** — copies `vault.db` and `vault.json` out of the
    bundle into the app's cache directory and returns the copy's path. **The bundled resource is
    never opened in place** (`refined.md` §8.3, `docs/vault-format.md` §11). Before returning, it
    refuses if a `-wal`, `-shm` or `-journal` sidecar sits beside the copy — three lines that make
    the §11 refusal visible in the source a reviewer reads. `expect fun cacheDirectoryPath():
    String` is the only platform call it needs.
41. **`commonMain/application/use-cases/RunGoldenVaultConformance.kt`** — the one screen-level
    use case, and the file that fixes the order of operations (§3 below): snapshot → parse header
    → derive key (timed) → assert `keyHex` → open → `ReadContextPack` → byte-compare → wipe the
    key → close. Returns a `ConformanceReport(verdict, renderedPack, derivationMillis,
    deviceLabel)`.
42. **`commonMain/App.kt`** — the entire UI. One `Column`: a title, one button
    **"Open the golden vault"**, and, after it resolves, the verdict line
    `CONFORMANCE: PASS — 4 320 bytes, byte-identical to expected-export.md` (or
    `FAIL — first difference at byte N`), the Argon2id line `Argon2id 64 MiB / t=3 / p=1 — N ms`,
    and the rendered pack in a scrollable, selectable-off `Text`. Green/red on the verdict so the
    screenshot reads at a glance. No navigation, no settings, no search, no copy button, no
    theming beyond the default. The screen calls the use case — **never the port, never SQL**.
    All vault work runs on `Dispatchers.Default` (`SQLITE_THREADSAFE=2` means one connection, one
    thread) and the UI shows a spinner meanwhile.
43. **`androidMain/MainActivity.kt`** (~20 lines) and **`AndroidManifest.xml`** — **no
    `<uses-permission>` element at all**, so the APK cannot reach the network even accidentally.
    `android:allowBackup="false"`, `android:usesCleartextTraffic` absent.
44. **`iosMain/MainViewController.kt`** (~10 lines) and **`iosApp/`** — a minimal SwiftUI
    `App` hosting the Compose `UIViewController`, plus `Info.plist` with no `NSAppTransportSecurity`
    key and no capability that implies networking. This is the only Swift in the repo, and it does
    nothing but host — P-8's shared-UI decision holds; the interop boundary being tested lives
    beneath the port, not here.
45. **The app is read-only, structurally**: no `INSERT`, no `PRAGMA journal_mode`, no
    `wal_checkpoint`, no migration, no lineage write, no device identity anywhere in the tree.
    Grep for each of these before closing the slice and paste the (empty) results into `poc.md`.

**Done when:** the app runs on an emulator and a simulator, shows `CONFORMANCE: PASS`, and
`aapt2 dump badging` reports zero permissions.

---

### Slice 7 — [VM] CI in `valija-mobile` only (P-11)

46. **`.github/workflows/ci.yml`** in **`valija-mobile`** — three jobs:
    - `domain` (`ubuntu-latest`): `./gradlew :vault-core:jvmTest`. The byte-compare gate; fails the
      build the moment the second implementation stops agreeing.
    - `android` (`ubuntu-latest`): `./gradlew :composeApp:assembleDebug` (NDK), then
      `reactivecircus/android-emulator-runner` running `:vault-interop:connectedAndroidTest` on an
      **x86_64** image. Upload the APK and the logcat as artifacts. The job name and the log must
      say **x86_64 emulator** so nobody mistakes it for G2.
    - `ios` (`macos-latest`): `./gradlew :vault-interop:iosSimulatorArm64Test`, then
      `xcodebuild build -scheme iosApp -destination 'platform=iOS Simulator,name=iPhone 16'`
      with `CODE_SIGNING_ALLOWED=NO`, then boot, install, launch, and
      `xcrun simctl io booted screenshot`. Upload the screenshot and the console log.
47. **`valija` gets nothing.** No file under `valija/.github/` is created, edited or deleted.
    `valija/.github/workflows/ci.yml` stays byte-identical — this is an acceptance criterion, and
    it is the easiest one to breach by reflex.

---

### Slice 8 — [V] Draft `poc.md` with every non-device row filled

48. **New `advances/MOBILE/poc.md`**, in `advances/M4/spike.md`'s idiom, written now so the
    device runs only have to fill in blanks:
    - **What is being tested and why** — G1–G7 in a paragraph; what M4 did and did not prove.
    - **Where the code is** — `akiles94/valija-mobile`, the commit SHA, and a plain statement that
      it is **non-authoritative PoC scaffolding**, not the mobile app (P-3's obligation for a kept
      tree).
    - **Inputs** — the fixture files, and the standing sentence that the passphrase and key are
      **published test values, never secrets**.
    - **Provenance** — SQLite3MultipleCiphers `v2.3.5` / SQLite `3.53.2` /
      `better-sqlite3-multiple-ciphers@12.11.1`, the `sqlite3.c` SHA-256, the full compile-flag
      list, the argon2 revision and its `ref.c`/`-DARGON2_NO_THREADS` choices, and the two licences
      with how they are satisfied (P-10, §8.9).
    - **Runbook** — the exact commands for each of: the JVM conformance test, the Android build
      and device install, the iOS build and device install, and the two screenshots. Precise
      enough to re-run with no context from this plan.
    - **Results table** — one row per G1–G7, each **PASS / FAIL / NOT ATTEMPTED**, with the
      columns *Where it ran* (hardware, OS version, toolchain version) and *Result*. Device rows
      stay `PENDING` until Slice 9.
    - **Claim scoping** — the section that decides whether this advance repeats M4's C3. It must
      name, at least: that no App Store or Play Store submission, distribution certificate or
      store review happened; that iOS ran under a **development** provisioning profile, so store
      review and production entitlements are unexercised; that the Secure Enclave, biometrics, the
      keychain/keystore, background suspension and thermal behaviour were never touched; that
      there is no document picker and therefore **no answer at all to M4 D-H's unsynced-vault
      detection**; that no write of any kind was attempted; that the vault was a bundled published
      fixture, not a user's synced vault; that the CI Android run is **x86_64 emulator** and is
      not the arm64 evidence; that the CI iOS run is a **simulator** — arm64 ISA, but the macOS
      kernel and a simulator runtime; and that the JVM conformance test is **not** a device run.
    - **Findings** — the `docs/vault-format.md` defects fixed in Slice 3 and Slice 10, plus W7
      recorded-not-fixed, plus anything to escalate at the next Gate R.
49. **New `advances/MOBILE/evidence/`** with the non-device artifacts already available:
    `jvm-conformance.log`, `toolchain-versions.txt`, `sqlite3c-sha256.txt`,
    `android-permissions.txt`, and the CI simulator/emulator screenshots and logs (named
    `ci-ios-simulator.png`, `ci-android-emulator.png`, and matching `.log`s — **the file names
    themselves must not claim more than the artifact does**).

---

### Slice 9 — HUMAN GATE: the two physical-device runs [Oscar]

> **The implementing agent stops here.** Neither run is executable by an agent: one needs Oscar's
> iPhone plus the borrowed Mac, the other needs Oscar's Android phone over USB.

50. **Android, on Oscar's phone:** `./gradlew :composeApp:installDebug` then
    `./gradlew :vault-interop:connectedAndroidTest`; launch the app, tap the button, capture
    `adb shell screencap`, `adb logcat` (filtered to the app), the test exit code,
    `adb shell getprop ro.product.model / ro.build.version.release / ro.product.cpu.abi`, and the
    Argon2id timing. **The ABI must be recorded verbatim** — if it is not `arm64-v8a`, G2 is
    recorded as still open (`refined.md` §9).
51. **iOS, on Oscar's iPhone via the borrowed Mac:** open `iosApp/` in Xcode, select the physical
    device, build and run with a free-tier development team, capture the on-device screenshot, the
    Xcode console log, the device model and iOS version, the Xcode and Kotlin versions, and the
    Argon2id timing. If `xcodebuild test -destination 'platform=iOS,id=<udid>'` can be signed,
    capture its exit code too; if signing a test bundle proves impractical in the window, record
    that plainly and let the on-screen verdict plus the console log carry the claim — **disclosed
    at the point of the claim, not in a footnote**.
52. **A `FAIL` here does not invalidate the advance.** A byte mismatch on device that the JVM test
    did not predict is a genuine, valuable finding — record it, do not fix the format, do not
    touch `valija/src/`, and escalate it at the next Gate R (`refined.md` §4.4, §8.5).

---

### Slice 10 — [V] Land the evidence, finish `poc.md`, close the contract and the roadmap

53. **Commit the device artifacts** under `advances/MOBILE/evidence/`, with honest names (D-10 —
    `refined.md` §4.3's `ios-sim.png` / `android-emu.png` predate P-6's physical-device decision):
    `ios-device.png`, `ios-device-run.log`, `ios-device-info.txt`,
    `android-device.png`, `android-device-run.log`, `android-device-info.txt`.
54. **Fill `poc.md`'s results table** — every G row resolved, every claim carrying its hardware,
    OS version and toolchain version. Re-read the claim-scoping section against the actual runs
    and tighten anything the evidence does not support.
55. **`docs/vault-format.md` §13** — add rows for exactly what executed, with the same scoping
    precision the existing rows use. Expected shape (fill from reality):
    `| Rendered pack byte-match, second implementation (Kotlin), JVM | — | PASS |`,
    `| App execution + amalgamation read on physical iOS (arm64, iOS <v>) | C | PASS |`,
    `| App execution + amalgamation read on physical Android (arm64-v8a, API <n>) | C | PASS |`,
    `| Kotlin/Native cinterop → amalgamation | C | PASS |`,
    `| JNI/NDK → amalgamation | C | PASS |`,
    `| Argon2id on device (both platforms) | C | PASS — <n> ms / <n> ms |`.
    Also update §13's stale row that reads *"Rendered pack / search byte-match (literal iOS) —
    DEFERRED"*, and the §1 **Status** line, which still says a literal iOS run is open. **Search is
    out of scope** (P-2 Option 3), so its row stays DEFERRED with the reason corrected to "no
    second implementation of the search path exists yet".
56. **`docs/SPEC.md` §2, line 31 (P-4a).** Split the fused clause. Replacement:
    `- A valija-hosted sync service → explicitly rejected (see §10b — M3 ships the lower-risk
    BYO-cloud slice instead)` and a new line
    `- Mobile client → not scheduled; a two-platform proof of concept validated the format and the
    toolchain, see advances/MOBILE/`. **No milestone number** (P-4b). Refresh §10b's
    `advances/M4/idea.md` pointer to `advances/MOBILE/poc.md`.
57. **`CHANGELOG.md`** — one line under `## [Unreleased]`: the corrected vault-format contract and
    the mobile PoC evidence; **no version bump, no behaviour change**.
58. **Final gate checks, run and pasted into `poc.md`:**
    - `git diff main...HEAD --name-only` — must show **only** `advances/MOBILE/**`,
      `docs/vault-format.md`, `docs/SPEC.md`, `CHANGELOG.md`. No `src/`, no `package.json`, no
      `tsup.config.ts`, no `tsconfig*.json`, no `.github/`.
    - `npm run typecheck && npm run lint && npm run test` — green, and the test count unchanged
      from `main`.
    - `git diff main...HEAD -- src/delivery/mcp/` — empty (the MCP surface, byte-for-byte).

---

## 3. Security-sensitive order of operations

The order below is not advice; it is the sequence `RunGoldenVaultConformance` must execute, and a
reviewer should be able to read it off the file top to bottom.

1. **Snapshot before anything.** Copy `vault.db` + `vault.json` out of the bundle into the app
   cache. The bundled resource is opened **never** — not read-only, not once. This makes
   `docs/vault-format.md` §11's "never mutate" structural instead of promised, and it is what the
   "bundled bytes unchanged after a full session" criterion checks.
2. **Refuse before opening.** If a `-wal`, `-shm` or `-journal` sits beside the copy, stop with
   `JOURNAL_SIDECAR_PRESENT`. (It never will, from a bundle — the check exists so the code path
   is real and reviewable.)
3. **Parse the header before deriving.** Salt and KDF parameters come **from `vault.json`**, never
   from a compiled-in default (`docs/vault-format.md` §4). A header with `schemaVersion != 1` is
   refused here, before any crypto runs.
4. **Derive the key before the database is opened.** Argon2id over the published passphrase, the
   header salt and the header parameters → 32 raw bytes → 64 lowercase hex.
   Hex encoding must mask the sign bit (`(b.toInt() and 0xFF)`) or use Kotlin's
   `ByteArray.toHexString()`; a naïve `Byte.toString(16)` yields `-1f` for high bytes and would
   produce a key that is wrong in a way that looks like a corrupt vault.
5. **Assert the derived key equals `manifest.keyHex`** *before* opening, so a derivation bug
   reports `KEY_MISMATCH` rather than masquerading as `SQLITE_NOTADB`.
6. **Open, then key, then verify, in exactly this order:** `sqlite3_open_v2(…READONLY)` →
   `PRAGMA cipher='sqlcipher'` → `PRAGMA key="x'<64 hex>'"` → `SELECT count(*) FROM sqlite_master`.
   `SQLITE_NOTADB` on that first read means `WRONG_PASSPHRASE`, not corruption
   (`docs/vault-format.md` §5).
7. **Check `meta.schema_version == "3"` before reading anything else.** Anything else is refused
   with `SCHEMA_TOO_NEW` and an "update the app" message. **Never migrate — permanently**
   (M4 D-J). No migration code exists in the tree to be called by accident.
8. **Read, assemble, render, compare.** The comparison is over UTF-8 bytes.
9. **Wipe and close in a `finally`.** Zero the derived key's `ByteArray`, drop the hex string
   reference, finalise every statement, close the connection. **The key is never written to
   Keychain, Keystore, `UserDefaults`, `SharedPreferences`, a file, or a log line** (`refined.md`
   §8.4). Nothing persists between launches except the sandbox copy, which is in the cache
   directory the OS may evict at will.
10. **What may be logged:** the Argon2id elapsed milliseconds, the conformance verdict, the byte
    counts, the first-difference offset, the device model. **What may not:** the passphrase, the
    derived key in any encoding, item content, or the rendered pack. The values are published, but
    the habit is the product — write the code as if they were not.
11. **No network, by construction, not by policy.** No permission in the Android manifest, no
    networking key in `Info.plist`, and a version catalogue whose entire content is Kotlin,
    Compose, serialization and test runners. A device farm was never in play (P-6 chose real
    hardware), so no farm SDK exists to smuggle one in.
12. **Nothing in `valija` moves.** No `src/`, no crypto, no KDF parameter, no `vault.json` field,
    no MCP tool, prompt or transport, no dependency, no CI job. If the PoC appears to need a
    format change, that is a finding for the next Gate R, never a change made inside this advance.

---

## 4. Test plan → acceptance criteria

Layers, deliberately, from cheapest to most expensive:

| Layer | Where it runs | What it proves |
|---|---|---|
| **Domain conformance (JVM)** | `:vault-core:jvmTest`, `ubuntu-latest` + local | Pack assembly, budgeting, rendering, UTF-16 token counting, byte-identity against **both** expected packs. No SQLite, no C, no device. |
| **Interop conformance (device/emulator)** | `:vault-interop:connectedAndroidTest`, `:vault-interop:iosSimulatorArm64Test`, and the same test on the physical devices | The adapters, the vendored C, the two interop mechanisms, key derivation on real hardware, end-to-end byte identity. Real exit codes. |
| **Application evidence** | The app, launched by hand on both phones | An actual app process — bundle, sandbox, lifecycle, UI thread — plus the screenshot P-5 asks for. |
| **Repo-level gates** | `npm run typecheck && lint && test` in `valija`; `git diff main...HEAD --name-only` | That this advance changed nothing it promised not to. |

### `refined.md` §9 criteria, mapped

| Criterion (§9) | Proven by |
|---|---|
| No `src/`, `package.json`, `tsup.config.ts`, `tsconfig*.json`, `ci.yml` in the diff | Slice 10 step 58, pasted into `poc.md` |
| No change to format, crypto, KDF params, key format, SQLCipher config, `vault.json` | Same diff; §3.12; nothing in the plan edits those files |
| MCP surface byte-for-byte unchanged | `git diff main...HEAD -- src/delivery/mcp/` empty |
| No network / telemetry / analytics / cloud SDK in any app artifact | Slice 1.7 (catalogue), 6.43 (zero permissions), 6.44 (`Info.plist`), `aapt2 dump badging` in `evidence/android-permissions.txt` |
| `typecheck && lint && test` pass unchanged; CI matrix neither slowed nor gated | Slice 10 step 58; Slice 7 step 47 |
| Every value from the golden fixture; no real vault/passphrase/key/content anywhere | Slice 1.6 (only the fixture is vendored); §3.10; the fixture `README.md` travels with the data |
| `poc.md` gives PASS / FAIL / NOT ATTEMPTED per §3 question, with hardware, OS, toolchain | Slice 8.48 + Slice 10.54 |
| `poc.md` has an explicit claim-scoping section | Slice 8.48's *Claim scoping* bullet list |
| No sentence describes a macOS/Linux/x86_64 run as iOS/arm64 | Slice 7.46 (job and log naming), 8.49 + 10.53 (file naming), 10.54 (final re-read) |
| Single-screen app per platform, shared Kotlin core, amalgamation only behind one port | Slices 2, 4, 5, 6 — enforced at the **module** level: `:composeApp` cannot see C without going through `:vault-core`'s port |
| Sandbox copy; bundled bytes unchanged; no `-wal`/`-shm`/`-journal` produced | §3.1–3.2; assert the bundle resource's SHA-256 is unchanged after a session, and list the sandbox directory in the run log |
| No journal pragma, migration, lineage write or device identity anywhere in the source | Slice 6.45 — the greps, with empty output pasted into `poc.md` |
| The derived key never written to keychain/keystore/prefs/file/log | §3.9–3.10; source review; no keychain API is imported anywhere in the tree |
| Zero network requests, verified by source and declared capabilities | Slice 6.43/6.44 + `evidence/android-permissions.txt` |
| Screenshot from a booted iOS **device** (P-6b), model and version recorded | Slice 9.51 → `evidence/ios-device.png` + `ios-device-info.txt` |
| Screenshot from a booted Android **device** (P-6a), API level and ABI recorded | Slice 9.50 → `evidence/android-device.png` + `android-device-info.txt` |
| Interop exercised through its own mechanism per platform, both recorded | Slice 4 (JNI/NDK, hand-written C bridge) and Slice 5 (cinterop, no hand-written C) — visibly different code paths in the tree |
| Run logs including exit codes committed | Slice 9.50/9.51 → `*-run.log`; `connectedAndroidTest` / `xcodebuild test` exit codes captured |
| Android result states arm64 vs x86_64 plainly; x86_64 ⇒ G2 still open | Slice 9.50's `ro.product.cpu.abi` capture, quoted verbatim in the results table |
| commonTest on the JVM byte-compares the pack against `expected-export.md` | Slice 2.20 (see **D-4** — it is a `jvmTest` source set over `commonMain` code, and `poc.md` says so) |
| The same comparison runs **on device**, shown on screen and in the exit status | Slice 4.34 / 5.38 (exit status) + Slice 6.42 (screen) |
| Byte comparison, not a snapshot, not normalised; `·` and `café ☕` intact | Slice 2.14 — `ByteArray` comparison with a first-difference index; the fixture files are `eol=lf` in both repos |
| `estimateTokens` counts UTF-16 code units, asserted by a test | Slice 2.20's `estimateTokens("𝄞") == 1` — the assertion that actually separates UTF-16 from graphemes |
| Key derived on device equals `manifest.keyHex`, asserted in code | §3.5, asserted in `RunGoldenVaultConformance` and in both on-device tests |
| Derivation time on screen and in `poc.md`, labelled with the hardware | Slice 6.42 + Slice 10.54; genuine device timings, per P-7's note |
| Every `docs/vault-format.md` defect fixed or recorded with location and correct behaviour; W5 and W6 addressed | Slice 3 (W5 = step 21, W6 = step 22) + Slice 3.27 (W7 recorded) |
| §13's compatibility table gains rows for what actually executed | Slice 10.55 |
| `docs/SPEC.md` §2 and §10b corrected or explicitly confirmed | Slice 10.56 |
| Kept tree: location stated, non-authoritative scaffolding declared | Slice 1.8 (`valija-mobile/README.md`) + Slice 8.48 (`poc.md`) |
| Amalgamation version, SHA-256, compile flags recorded; licence satisfied; no unauthorised CI or dependency | Slice 1.4/1.5 + Slice 8.48; Slice 7.47 keeps `valija` CI untouched |

---

## 5. Assumptions — each one a place this plan could be wrong

- **A1 — `valija-mobile` is empty apart from the seeded `.claude/` directory** (commit `f02c3ca`).
  I could not read the remote from this environment. If it already carries a README, a LICENSE or
  a Gradle skeleton, Slice 1 adapts rather than overwrites.
- **A2 — `.claude/` in `valija-mobile` is a verbatim copy of this repo's**, so `guard-git-ops.sh`
  fails closed there (no `advances/*/review.md`) and `guard-implementation.sh` is inert there (no
  `advances/*/plan.md`). Slice 1.9 depends on this reading; if the copy was modified, re-check both
  hooks before the first push.
- **A3 — a session rooted in `valija` will have its edits to `../valija-mobile/**/src/**` gated by
  this repo's `guard-implementation.sh`**, because the glob is `*/src/*`. Approval on this file
  lifts it. If the implementer instead opens a session rooted in `valija-mobile`, the gate does not
  apply — which is why Gate P must be honoured by the orchestrator, not by the hook.
- **A4 — Compose Multiplatform runs on iOS well enough for a one-screen app** on the current
  stable release. It is stable for iOS as of the 1.8 line; the PoC uses no exotic component.
- **A5 — `Res.readBytes` reads a ~61 KB binary resource identically on both platforms.** If
  Compose resources prove awkward for the `.db`, the fallback is per-platform asset loading behind
  the same `FixtureSnapshot` seam (Android `assets/`, iOS bundle resource) — a ~20-line change
  that does not touch the port.
- **A6 — the vendored amalgamation compiles clean for `arm64-v8a` and `arm64-apple-ios`** with the
  desktop define set. M4 proved exactly this (both targets compiled; Android arm64 was never
  *executed*, which is G2). A new compile failure would be a genuine finding.
- **A7 — a free-tier Apple ID can sign a development build onto Oscar's iPhone from the borrowed
  Mac** (7-day provisioning, no paid account). This is the standard personal-team flow. If it
  fails, G1 falls back to the simulator run and `poc.md` says so in the results table, loudly —
  and P-6(b)'s decision is recorded as unmet, not quietly re-scoped.
- **A8 — `SQLITE_OPEN_READONLY` works against a keyed SQLite3MC database.** If it does not, open
  read-write **on the sandbox copy only** and record the substitution in `poc.md`; the read-only
  guarantee then rests on the copy plus the absence of any write statement, which is still
  structural, just less belt-and-braces.
- **A9 — the golden fixture's expected files are exactly reproducible from `seed.json` alone**
  for the domain test, i.e. `expected-export.md` depends on nothing in `vault.db` that `seed.json`
  does not carry. This holds by construction (`buildGoldenVault` builds the vault *from* the seed),
  but the device run is what proves it end to end.
- **A10 — GitHub Actions minutes on `macos-latest` are available** for the iterate-on-CI approach
  in Slice 5. If not, that slice moves into the borrowed-Mac window and the window grows from
  hours to a day — the single biggest schedule risk in the plan.
- **A11 — no `valija` behaviour defect surfaces.** If the Kotlin implementation proves the
  *TypeScript* wrong rather than the document, this plan has no slice for it, and correctly so:
  it becomes a Gate R item for the next advance.
- **A12 — `advances/MOBILE/plan.md` is the most recently modified `plan.md`**, so the guard hook
  resolves to it without `VALIJA_ADVANCE` being set. Setting `export VALIJA_ADVANCE=MOBILE` makes
  this deterministic and is recommended.

---

## 6. Decisions to confirm

Every item below is a genuine open choice this plan had to make. The `P-n` decisions in
`refined.md` §7 are **not** re-opened here.

- **D-1 — Branch name in `valija`.** *Recommend:* `docs/mobile-poc-MOBILE`, matching M4's
  `docs/vault-format-M4`: what lands in *this* repo is documentation and evidence.
  *Trade-off:* it under-sells an advance whose real output is an application — in another repo.
  *Alternatives:* `poc/mobile-MOBILE` (leads with the artifact) or `evidence/mobile-MOBILE`.

- **D-2 — Where `valija-mobile` is checked out, and how its commits are made.**
  *Recommend:* a sibling working tree at `/home/user/valija-mobile`, ordinary commits pushed
  straight to `main` with plain Bash (never the `git-ops` subagent, which is hook-gated on a
  `review.md` that will never exist there). *Trade-off:* no PR history, no per-slice review in
  that repo. *Alternative:* a `feat/poc` branch merged with `--no-ff` at the end, which reads
  better in the log and costs nothing — take it if Oscar wants the mobile history to look like
  `valija`'s.

- **D-3 — Gradle module layout.** *Recommend:* three modules — `:vault-core` (pure domain,
  renderer, port, use case; targets `jvm` + `android` + both iOS), `:vault-interop` (the
  `expect`/`actual` C bindings and the shared SQL adapter), `:composeApp` (the shared Compose UI
  and both app shells). The boundary `refined.md` §5 calls "the one structural requirement worth
  holding the PoC to" becomes compiler-enforced, and `:vault-core` gets a real JVM test target
  without needing a stub `actual`. *Trade-off:* three `build.gradle.kts` files instead of one,
  perhaps 80 extra lines of build script. *Alternative:* two modules (`:vault-core` + `:composeApp`
  with the adapters inside the app module) — less ceremony, but the "not called directly from UI
  code" criterion becomes a convention rather than a compile error.

- **D-4 — Where the JVM conformance test lives.** *Recommend:* `vault-core/src/jvmTest/`, testing
  100% `commonMain` code, with `poc.md` saying exactly that. Reading fixture files from a literal
  `commonTest` source set needs either an `expect`/`actual` resource reader (which would put
  platform code into the module that must not have any) or an extra multiplatform IO dependency.
  *Trade-off:* `refined.md` §9 says "a commonTest running on the JVM"; this satisfies the intent
  (no device, no SQLite, deterministic) but not the letter. *Alternative:* add `kotlinx-io` and
  keep it in `commonTest` — one more dependency in something billed as minimal.

- **D-5 — Platform order inside the advance.** *Recommend:* Android first, then iOS developed on
  GitHub Actions `macos-latest`, with the borrowed Mac reserved for the physical-iPhone run.
  Android needs no Mac and validates the shared adapter contract, so any later iOS failure is
  isolated to cinterop. *Trade-off:* it inverts D-E's "iOS first" instinct, and it front-loads
  effort on the platform whose viability was never in doubt. P-1 removed the cut line, so nothing
  is dropped either way — this is purely about which failure you find first.
  *Alternative:* iOS first, honouring D-E's sequencing, accepting that a cinterop dead-end would
  be discovered before the shared design is validated.

- **D-6 — How the vendored C reaches the iOS binary.** *Recommend:* a Gradle `Exec` task builds
  `libvalijanative.a` per Apple target and cinterop links it, so `./gradlew` alone reproduces the
  whole build and CI needs no Xcode knowledge. *Trade-off:* it is the fiddliest step in the plan
  and the most likely source of a lost afternoon (R1). *Alternative:* add `sqlite3.c` and the
  argon2 sources to the Xcode target's Compile Sources and let Xcode link them into the app,
  keeping the Kotlin framework static — simpler to get working, but the compile flags then live in
  two places and could drift between the Gradle and Xcode paths, which P-10 explicitly warns about.

- **D-7 — Timestamps as raw ISO strings in the Kotlin domain.** *Recommend:* yes — no date type
  anywhere. Ordering is SQL's; the per-item date is `take(10)`; the preamble uses the manifest's
  string verbatim. This removes the `kotlinx.datetime` millisecond-elision trap entirely.
  *Trade-off:* it diverges from `valija`'s `Date`-typed entity and would need revisiting the day
  the app does anything time-aware. *Alternative:* `kotlinx-datetime` with a hand-written
  JS-compatible formatter — more faithful to the desktop model, one more dependency, one more
  place to get three fractional digits wrong.

- **D-8 — On-device machine-checkable verdict.** *Recommend:* one instrumented test per platform
  (`connectedAndroidTest`, `xcodebuild test`) alongside the on-screen verdict, so P-5's "exit
  status" is a real process exit status on real hardware. *Trade-off:* about 120 lines of test
  code and, on iOS, a signed test bundle (A7). *Alternative:* screen + committed log only — the
  screenshot is still self-verifying because it prints the byte count, but nothing fails
  automatically when it stops being true.

- **D-9 — Also byte-compare `expected-pack.md` (the budgeted pack) on the JVM.** *Recommend:* yes.
  P-2 Option 3 governs what the **screen** shows and stays unbudgeted; but the unbudgeted path
  never exercises the budget, so without this the advance would "address W5" by editing prose
  nobody tested. It costs about ten lines and zero device time, exactly as `refined.md` §5's
  pyramid intends. *Trade-off:* strictly speaking it is scope beyond P-2 Option 3's letter, and
  it is the comparison most likely to fail first (M4's review predicted as much).
  *Alternative:* unbudgeted only, and W5's correction is then a documentation claim resting on a
  careful reading rather than on a byte comparison.

- **D-10 — Evidence file names.** *Recommend:* `ios-device.png` / `android-device.png` (plus
  `ci-ios-simulator.png` / `ci-android-emulator.png` for the CI artifacts), overriding
  `refined.md` §4.3's `ios-sim.png` / `android-emu.png`, which predate P-6's physical-device
  decision. A file named `ios-sim.png` holding a device screenshot — or the reverse — is exactly
  the C3 class of error, and file names get quoted more often than captions.
  *Trade-off:* the plan deviates from the spec's literal file list. *Alternative:* keep §4.3's
  names and disclose in prose — worse, for the reason just given.

- **D-11 — Kotlin package and Android `applicationId`.** *Recommend:* `dev.valija.poc` — coherent,
  clearly a PoC, and nothing is ever submitted to a store so no registration is implied.
  *Trade-off:* `valija.dev` is not a domain the project owns. *Alternatives:* `app.valija.poc`, or
  `io.github.akiles94.valija.poc` (accurate to the actual namespace, ugly in every stack trace).

- **D-12 — Search / the FTS query builder.** *Recommend:* leave it out entirely. P-2 landed on
  Option 3 (the rendered pack), and Option 4 (search cases) was explicitly declined as past
  minimal. `refined.md` §5 lists the query builder among the domain's contents, but §6's scope
  and §9's criteria never ask for it. *Trade-off:* the quote-escaping rule and the FTS path cross
  the interop boundary untested, so a future app advance meets them fresh.
  *Alternative:* port `toFtsQuery` (about 8 lines) with a JVM-only unit test and no on-device
  search — cheap, but it proves the string builder, not the FTS behaviour, which is the part that
  could actually differ.

- **D-13 — What happens if the borrowed Mac window closes before the iPhone run.**
  *Recommend:* hold the advance at Slice 9 rather than ship. G1 is half the advance's reason to
  exist, and P-6(b) deliberately overrode the simulator-only default. *Trade-off:* the branch waits
  on hardware availability. *Fallback, if waiting is unacceptable:* ship with the CI simulator run
  as the iOS evidence, G1 recorded as **closed for the simulator and open for a physical device**,
  and P-6(b)'s decision explicitly marked unmet in `poc.md` — honest, but it hands the next Gate R
  a weaker answer than Oscar asked for.

---

## 7. Naming, placement, and ubiquitous language

`CLAUDE.md`'s conventions govern TypeScript under `valija/src/`. They do not translate
mechanically to Kotlin, but the *shape* does, and the mapping is stated here so a reviewer can
check it rather than infer it.

| `valija` (TypeScript) | `valija-mobile` (Kotlin) | Why |
|---|---|---|
| `src/context/domain/services/context-pack.ts` | `vault-core/…/domain/services/ContextPack.kt` | Same layer, same kind-named subfolder |
| `src/delivery/context-pack-markdown.ts` | `vault-core/…/delivery/ContextPackMarkdown.kt` | Rendering is presentation in both repos; keeping the `delivery/` name keeps the ubiquitous language intact |
| `src/context/application/ports/repositories.ts` | `vault-core/…/application/ports/VaultReader.kt`, `KeyDeriver.kt` | Ports stay in `ports/` |
| `GetContextPack implements UseCase<…>` | `class ReadContextPack : UseCase<…>` | The code's own convention is a verb-phrase class implementing `UseCase` — CLAUDE.md's "`XUseCase` classes" wording is looser than the code; the code wins |
| `SqliteContextItemRepository` | `Sqlite3mcVaultReader` | Tech-named adapter, self-describing |
| `contextErr(code, message)` | `vaultErr(code, message)` in `domain/VaultError.kt` | One well-known per-module errors file, the standing exception |
| `src/shared/application/use-case.ts` | `vault-core/…/shared/UseCase.kt` | Per-repo contract, the other standing exception |
| `parseVaultHeader → Result` | `parseVaultHeader(json): Result<VaultHeader, VaultError>` | Parse-don't-validate at the file boundary |

**File placement, checked against the "no bare files at a layer's root" rule.** Every new Kotlin
file sits in a kind-named subfolder: `domain/entities/`, `domain/values/`, `domain/services/`,
`application/ports/`, `application/use-cases/`, `delivery/`, `infra/sqlite/`, `infra/argon2/`.
Two files sit at a layer root, both matching an established exception: `domain/VaultError.kt`
(the `errors.ts` analogue) and `shared/UseCase.kt` (the `use-case.ts` analogue).
`composeApp/…/App.kt` and `MainActivity.kt` are UI-shell files in a UI module, the Kotlin
equivalent of `src/delivery/cli/program.ts`, and are not inside a `domain/application/infra`
layer at all. `vendor/` and `gradle/` are not code layers.

**One new kind of thing appears, and it gets its own folder rather than a loose file:**
`Sqlite3mcDatabase` is neither a port nor a `UseCase` — it is a platform binding, the
`expect`/`actual` seam. It lives in `infra/sqlite/` next to the adapter it serves, with the
platform-specific `actual`s in the matching `infra/sqlite/` folder of each platform source set,
so `androidMain/infra/sqlite/` and `iosMain/infra/sqlite/` read identically to `commonMain`'s.

**Ubiquitous language.** No new term is coined. `vault`, `header`, `key`, `pack`, `section`,
`item`, `project`, `snapshot`, `conformance`, `golden vault` all carry their existing meanings.
The one new phrase is **conformance verdict** (the `PASS — N bytes` line), which is `refined.md`
§4.1's own wording.

**Naming risks worth a second look at review:** `:vault-interop` is named for what it *is* (the
interop layer G3 tests) rather than for a single technology, because it binds two C libraries —
`:vault-native` and `:vault-sqlite` were both rejected as either vague or inaccurate.
`Sqlite3mcVaultReader` uses the upstream abbreviation `sqlite3mc`, which appears in the vendored
source's own header, rather than the longer `SQLite3MultipleCiphers`.

---

## 8. Estimated line count and risks

**Authored production lines are counted separately from vendored and generated ones**, because the
vendored amalgamation alone is roughly a quarter of a million lines and would drown every other
number.

### `valija` (this repo)

| Artifact | Lines |
|---|---|
| `advances/MOBILE/poc.md` | ~350 (markdown) |
| `docs/vault-format.md` (edits) | ~60 changed / added |
| `docs/SPEC.md` (§2 + §10b) | ~4 changed |
| `CHANGELOG.md` | ~2 |
| `advances/MOBILE/evidence/*.log`, `*.txt` | ~180 (captured output) |
| `advances/MOBILE/evidence/*.png` | 4 binaries, ~200–600 KB total |
| **`src/**` production lines** | **0** |

### `valija-mobile`

| Artifact | Authored lines |
|---|---|
| Gradle build (`settings`, root, 3 modules, catalogue, properties, native-defines) | ~300 |
| `:vault-core` main (domain, renderer, conformance, ports, use case, errors, parsers) | ~400 |
| `:vault-core` `jvmTest` | ~150 |
| `:vault-interop` Kotlin (`expect` + two `actual` pairs + shared SQL adapter) | ~380 |
| `:vault-interop` C (`valija_native.c` JNI bridge, `CMakeLists.txt`, two `.def` files) | ~260 |
| `:vault-interop` device tests (Android instrumented + iOS) | ~120 |
| `:composeApp` (screen, snapshot, entry points, manifest, `Info.plist`, `App.swift`) | ~330 |
| `.github/workflows/ci.yml` | ~120 |
| `README.md`, `THIRD-PARTY-NOTICES.md`, `PROVENANCE.md` ×2, `LICENSE` | ~280 |
| **Authored total** | **≈ 2,340** |
| Vendored C (`sqlite3.c` + headers ≈ 270k lines, argon2 ≈ 3k lines) | not authored, hashed and attributed |
| Generated (Gradle wrapper, `iosApp.xcodeproj`) | not authored |
| Fixture copies (7 files incl. one 61,440-byte binary) | not authored, hashed |

**Grand total authored: ≈ 2,940 lines across both repos**, of which **0 are `valija` production
lines** — plus four screenshots, one vendored binary fixture, and one vendored multi-megabyte C
file.

### Risks

1. **R1 — The iOS static-library link is the plan's single most likely stall.** Getting a
   cinterop-bound, vendored static library to survive into a Compose Multiplatform framework and
   then into an Xcode app link is well-trodden but unforgiving, and every failure looks like a
   linker error rather than a design signal. *Mitigated by:* developing it on `macos-latest` CI
   (cheap iteration, no borrowed-Mac clock running), by D-6's named fallback, and by keeping the
   `expect` surface to two methods so switching link strategies touches almost nothing.
2. **R2 — Scope. P-1 removed the cut line the refiner recommended.** `refined.md` §11 names
   toolchain creep as the secondary risk and points at P-1 Option 3 as its mitigation; P-1 chose
   Option 2, so that mitigation no longer exists. Two toolchains, two interop mechanisms, two
   vendored C libraries, three Gradle modules and two physical devices is a lot of surface for an
   advance whose output is a screenshot. *Mitigated by:* the strict layering (most of the work is
   JVM-testable), by Android-first (D-5), and by reserving the Mac for the device run only. It is
   not eliminated — this is the risk most likely to make the advance long rather than to make it
   fail.
3. **R3 — Concluding more than was proved.** `refined.md` §11 calls this the honest failure mode,
   and this plan ends with the most persuasive artifact the project has produced. *Mitigated by:*
   the claim-scoping section being a first-class deliverable drafted in Slice 8 *before* the runs
   (so it cannot be written to fit a nice result), by file names that cannot overclaim (D-10), and
   by CI job names that say `x86_64 emulator` and `simulator` in the log itself.
4. **R4 — A byte mismatch whose cause is the desktop, not the document.** The plan has no slice
   for changing `valija/src/`, deliberately. If the Kotlin implementation proves the TypeScript
   wrong, the advance records it and stops. *Mitigated by:* saying so three times (Slice 2, Slice
   9.52, §3.12) so nobody "just fixes it".
5. **R5 — Fixture drift between the two repos.** The vendored fixture copy can silently diverge
   from `valija`'s. *Mitigated by:* `SHA256SUMS` in `vendor/golden-vault/` and by the JVM
   conformance test failing loudly the moment the expectations and the seed disagree.
6. **R6 — Line endings and encoding across a second repo.** `.gitattributes` lands in Slice 1
   step 2, **before** any fixture is copied, because a byte comparison against a CRLF-mangled
   `expected-export.md` fails for a reason that looks like a renderer bug for about an hour.
7. **R7 — "It's only a PoC" erosion.** A logged key, a convenience analytics dependency, a
   `journal_mode` pragma copied from desktop's `openVaultDb`. *Mitigated by:* §3 being an ordered
   checklist rather than prose, by the version catalogue being the entire dependency surface, and
   by Slice 6.45's greps landing in `poc.md` as evidence rather than as a promise.

---

## 9. Repo structure after execution

### `valija` (this repo)

```
docs/
├── SPEC.md                                   (CHANGED: §2 Out line split — sync service
│                                               "rejected", mobile client "not scheduled;
│                                               PoC validated, see advances/MOBILE/";
│                                               §10b pointer refreshed. No milestone number)
├── sync.md                                   (unchanged)
└── vault-format.md                           (CHANGED: §8 label budgeting (W5) + latest-handoff
                                                selection (W6) + UTF-16 token counting;
                                                §9 concatenation rule + ISO timestamp format;
                                                §13 new rows for the iOS/Android device runs and
                                                the second-implementation byte match;
                                                §1 Status line refreshed)

specs/                                        (all unchanged — no src/ behaviour change)

src/                                          (ENTIRELY UNCHANGED — 0 production lines)

advances/MOBILE/
├── idea.md                                   (unchanged)
├── refined.md                                (unchanged)
├── plan.md                                   (this file)
├── poc.md                                    (NEW: runbook, provenance, results table per
│                                               G1–G7, claim-scoping section, findings)
├── review.md                                 (NEW, written by change-reviewer)
└── evidence/                                 (NEW)
    ├── ios-device.png                        (NEW, binary: physical iPhone, result screen)
    ├── ios-device-run.log                    (NEW: Xcode console + exit codes)
    ├── ios-device-info.txt                   (NEW: model, iOS version, Xcode/Kotlin versions)
    ├── android-device.png                    (NEW, binary: physical Android phone)
    ├── android-device-run.log                (NEW: logcat + connectedAndroidTest exit code)
    ├── android-device-info.txt               (NEW: model, API level, ro.product.cpu.abi)
    ├── ci-ios-simulator.png                  (NEW, binary: GitHub Actions simulator run)
    ├── ci-android-emulator.png               (NEW, binary: x86_64 emulator run)
    ├── jvm-conformance.log                   (NEW: :vault-core:jvmTest output)
    ├── android-permissions.txt               (NEW: aapt2 dump badging — zero permissions)
    ├── sqlite3c-sha256.txt                   (NEW: the vendored amalgamation's hash)
    └── toolchain-versions.txt                (NEW: Kotlin, AGP, Compose, NDK, Xcode, Gradle)

CHANGELOG.md                                  (CHANGED: one [Unreleased] line)
package.json                                  (UNCHANGED — no dependency, no script)
tsup.config.ts / tsconfig*.json               (UNCHANGED)
.github/workflows/ci.yml                      (UNCHANGED — zero mobile CI here, per P-11)
```

### `akiles94/valija-mobile`

```
valija-mobile/
├── .claude/                                  (as seeded, untouched — no advances/ dir here,
│                                               and git-ops is never run in this repo)
├── .gitattributes                            (NEW: eol=lf; *.db/*.png/*.c/*.h binary)
├── .github/workflows/ci.yml                  (NEW: domain (ubuntu) · android+x86_64 emulator
│                                               (ubuntu) · ios simulator (macos-latest))
├── LICENSE                                   (NEW: Apache-2.0, matching valija)
├── README.md                                 (NEW: what this is; NON-AUTHORITATIVE PoC
│                                               scaffolding; pointers back to valija)
├── THIRD-PARTY-NOTICES.md                    (NEW: SQLite3MultipleCiphers MIT ·
│                                               phc-winner-argon2 CC0/Apache-2.0 ·
│                                               SQLite core public domain)
├── settings.gradle.kts                       (NEW: :vault-core, :vault-interop, :composeApp)
├── build.gradle.kts · gradle.properties      (NEW)
├── gradle/
│   ├── libs.versions.toml                    (NEW: Kotlin, AGP, Compose MP, serialization,
│   │                                           test runners — and nothing that can reach a
│   │                                           network)
│   ├── native-defines.txt                    (NEW: the single source of the C compile flags,
│   │                                           read by both CMake and the iOS Exec task)
│   └── wrapper/                              (NEW, generated)
├── vendor/
│   ├── sqlite3mc/                            (NEW: sqlite3.c · sqlite3.h · sqlite3ext.h ·
│   │                                           LICENSE (upstream v2.3.5) · PROVENANCE.md
│   │                                           with versions, SHA-256s and compile flags)
│   ├── argon2/                               (NEW: include/ · src/ incl. ref.c and blake2/ ·
│   │                                           LICENSE · PROVENANCE.md)
│   └── golden-vault/                         (NEW: vault.db · vault.json · manifest.json ·
│                                               seed.json · expected-export.md ·
│                                               expected-pack.md · README.md · SHA256SUMS —
│                                               published test data, copied from valija)
├── vault-core/                               (NEW — pure; jvm + android + iosArm64 + iosSimArm64)
│   ├── build.gradle.kts
│   └── src/
│       ├── commonMain/kotlin/dev/valija/poc/
│       │   ├── shared/UseCase.kt
│       │   ├── domain/
│       │   │   ├── VaultError.kt
│       │   │   ├── entities/ContextItem.kt · Project.kt
│       │   │   ├── values/ItemType.kt · VaultHeader.kt · GoldenVaultManifest.kt
│       │   │   └── services/ContextPack.kt · PackConformance.kt
│       │   ├── application/
│       │   │   ├── ports/VaultReader.kt · KeyDeriver.kt
│       │   │   └── use-cases/ReadContextPack.kt
│       │   └── delivery/ContextPackMarkdown.kt
│       └── jvmTest/kotlin/dev/valija/poc/
│           └── GoldenVaultConformanceTest.kt  (both expected packs, byte-compared)
├── vault-interop/                            (NEW — the only module that knows C exists)
│   ├── build.gradle.kts                      (CMake wiring + the iOS static-lib Exec tasks)
│   └── src/
│       ├── commonMain/kotlin/dev/valija/poc/infra/
│       │   ├── sqlite/Sqlite3mcDatabase.kt   (expect) · Sqlite3mcVaultReader.kt (shared SQL)
│       │   └── argon2/Argon2idKeyDeriver.kt  (expect)
│       ├── androidMain/kotlin/dev/valija/poc/infra/
│       │   ├── sqlite/Sqlite3mcDatabase.android.kt
│       │   └── argon2/Argon2idKeyDeriver.android.kt
│       ├── androidMain/cpp/                  (valija_native.c JNI bridge · CMakeLists.txt)
│       ├── androidInstrumentedTest/…/AndroidVaultConformanceTest.kt
│       ├── iosMain/kotlin/dev/valija/poc/infra/
│       │   ├── sqlite/Sqlite3mcDatabase.ios.kt
│       │   └── argon2/Argon2idKeyDeriver.ios.kt
│       ├── iosTest/…/IosVaultConformanceTest.kt
│       └── nativeInterop/cinterop/sqlite3mc.def · argon2.def
├── composeApp/                               (NEW — one Compose screen, both shells)
│   ├── build.gradle.kts
│   └── src/
│       ├── commonMain/kotlin/dev/valija/poc/
│       │   ├── App.kt                        (the entire UI: button, verdict, timing, pack)
│       │   ├── infra/FixtureSnapshot.kt      (bundle → sandbox copy + sidecar refusal)
│       │   └── application/use-cases/RunGoldenVaultConformance.kt
│       ├── commonMain/composeResources/files/golden-vault/
│       │                                     (vault.db · vault.json · manifest.json ·
│       │                                      expected-export.md · README.md)
│       ├── androidMain/kotlin/…/MainActivity.kt · AndroidManifest.xml (ZERO permissions)
│       └── iosMain/kotlin/…/MainViewController.kt
└── iosApp/                                   (NEW: minimal SwiftUI host + Info.plist,
                                                iosApp.xcodeproj — generated)
```

---

**Plan path:** `/home/user/valija/advances/MOBILE/plan.md`.

**Total estimated authored production lines: ≈ 2,940** — **0 of them under `valija/src/`**
(≈ 2,340 in `valija-mobile`, ≈ 600 of documentation and captured evidence in `valija`), plus one
vendored multi-megabyte `sqlite3.c`, the vendored argon2 sources, seven copied fixture files, and
four screenshots.

Implementation must not begin until Oscar has reviewed this plan and recorded an `Approved:` line
at its top; the orchestrator halts for that approval at Gate P. Note that the implementation gate
applies to `valija-mobile`'s Kotlin sources too, since they live under `*/src/*`. Note also that
this advance carries a **second, mid-implementation human gate** — Slice 9's two physical-device
runs, which no agent can execute.
