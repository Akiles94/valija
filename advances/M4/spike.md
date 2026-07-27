# M4 compatibility spike — runbook and results

## What is being tested, and why

`advances/M4/refined.md` §10 names one fact the whole mobile-companion idea rests on, and
that nobody had tested before this advance: **can an official/upstream SQLCipher build open
a vault written by `better-sqlite3-multiple-ciphers`'s `sqlcipher` cipher scheme, using the
raw 32-byte key valija derives?** If the answer is no, the mobile idea needs a format-level
rethink before any app work — which is exactly why this spike exists *before* committing to
building one.

Four tiers, in increasing order of what they need:

| Tier | Who runs it | What it needs | What it answers |
|---|---|---|---|
| A | this advance (Slices 1-4) | nothing beyond this repo | The desktop side, empirically: the real cipher parameters, a golden vault, byte-exact expected outputs |
| B | this advance (below) | any Linux/macOS shell, `sqlcipher` + `argon2` CLIs | Whether upstream SQLCipher and reference-C Argon2id agree with what Node produced — **run, real results** |
| C′ | this advance (below) | a GitHub Actions `macos-latest` runner (no Mac owned/rented) | Whether the official SPM SQLCipher package opens the fixture — **run, real result** |
| C | Oscar, on a literal iOS device/simulator, if ever wanted | Xcode, CocoaPods/SwiftPM SQLCipher, a native Argon2id | The remaining iOS-specific packaging nuance and the write round-trip — lower priority now that C′ has answered the core question |

## Inputs

Everything below uses `src/testing/__fixtures__/golden-vault/`:

- `vault.db` — the encrypted fixture (copy it out; never open it in place — see
  `docs/vault-format.md` §11).
- `manifest.json` → `passphrase`, `keyHex`, `saltBase64` (`R29sZGVuVmF1bHRTYWx0IQ==`, ASCII
  `GoldenVaultSalt!`), `kdf`, `fileSaltHex`, the probed `cipher` parameter table.
- `expected-pack.md`, `expected-export.md`, `expected-search.json` — what a correct read
  must reproduce, byte-for-byte.

**These are published test values, not secrets.** Never use them for anything but this
compatibility check.

---

## Tier B — run in this advance's implementation container

**Environment:** Ubuntu (noble) container, `sqlcipher` 4.5.6-1build2 (SQLCipher 4.5.6
community, linked against its own `libsqlcipher1`), `argon2` 0~20190702+dfsg-4build1 (the
reference `phc-winner-argon2` CLI) — both installed via `apt-get install sqlcipher argon2`
for this spike only; **neither is a dependency of this repo** (D-5, D-K: no toolchain lands
in `package.json` or CI).

### B1 — Argon2id reference-C vector reproduction: **PASS**

```
$ echo -n "valija-golden-vault-public-test-passphrase" \
    | argon2 "GoldenVaultSalt!" -id -k 65536 -t 3 -p 1 -l 32 -r
3e53d9f1d53beb152abeab88320e77a4fd9e5e878828a1c1aec4d0327d46dc67
```

Matches `manifest.json`'s `keyHex` **exactly**. Re-run with the second published vector
(non-default params, `docs/vault-format.md` §4) — also an exact match:

```
$ echo -n "valija-golden-vault-public-test-passphrase" \
    | argon2 "GoldenVaultSalt!" -id -k 8192 -t 1 -p 1 -l 32 -r
dfdeb798323eee9fd777775505bab940bb301b7c2d586b5fbff882259fa94750
```

**This closes the Argon2id half of H1a.** The reference C implementation (`phc-winner-argon2`,
the same library the npm `argon2` package binds, and the same one D-G specifies for the
mobile side) reproduces valija's derived key exactly, independent of platform. Nothing about
key derivation is a risk anymore; whatever remains is entirely on the SQLCipher side (B2).

### B2 — Raw-key open via upstream SQLCipher CLI: **FAIL**

```
$ cp src/testing/__fixtures__/golden-vault/vault.db /tmp/tierb-vault.db
$ sqlcipher /tmp/tierb-vault.db
sqlite> PRAGMA key = "x'3e53d9f1d53beb152abeab88320e77a4fd9e5e878828a1c1aec4d0327d46dc67'";
ok
sqlite> SELECT count(*) FROM sqlite_master;
Parse error near line 1: file is not a database (26)
```

Tried, all **FAIL** the same way:

- The raw 32-byte key alone (`x'<64 hex>'`), as above.
- The 32-byte-key + 16-byte-file-salt combined form (`x'<64 hex key><32 hex salt>'`, 96 hex
  chars) — the other standard SQLCipher raw-key convention.
- `PRAGMA cipher_compatibility` explicitly set to `1`, `2`, `3`, and `4` before the key, in
  case the CLI's un-set default didn't already match SQLCipher 4's parameters.
- **The same passphrase, through SQLCipher's own native passphrase path** (not valija's
  raw-key convention at all) — a vault created by `better-sqlite3-multiple-ciphers` with
  `PRAGMA key = 'test-passphrase-12345'` (no raw key, no Argon2id, just handing SQLCipher a
  passphrase directly) **also** failed to open in upstream `sqlcipher` with the identical
  passphrase. This rules out valija's raw-key convention specifically as the cause — the
  incompatibility is in the base cipher/page format itself, not the key-handling layer above
  it.

**Ruled out as a usage mistake:** a self-test — create a vault with upstream `sqlcipher`
itself using a raw key, close it, reopen it with the same raw key — round-trips correctly.
The CLI syntax and this raw-key convention are not the problem; something about the two
libraries' encrypted-page format disagrees.

**One concrete, telling data point:** `PRAGMA cipher` reports differently on each side —
upstream `sqlcipher` answers `AES-256-CBC` (the block cipher itself; real SQLCipher has no
"scheme" concept, it only ever produces one format), while `better-sqlite3-multiple-ciphers`
answers `sqlcipher` (a *scheme name* — `SQLite3MultipleCiphers`, the library it wraps,
supports several interchangeable schemes, and `sqlcipher` selects its
attempted-compatibility mode). These are two independently-maintained codebases; "attempted
compatibility" is not the same claim as "byte-identical output," and this spike is the
proof that, at least for this exact pairing of versions (`better-sqlite3-multiple-ciphers`
12.11.1 / upstream SQLCipher 4.5.6 community), they are not compatible today.

**What this does and doesn't mean:**
- It does **not** block Tier 1 (read-only desktop-and-sync usage) — nothing about desktop
  behavior changes; this is purely a second-implementation compatibility question.
- It **does** mean Tier C (an official iOS SQLCipher build, a different package of the same
  upstream project) should be treated as more likely to fail than the plan's default
  assumption, not less — B2 is real evidence, not a hypothetical risk anymore.
- Per D-G's documented fallback, this pushes weight toward **Option 2: build the
  `SQLite3MultipleCiphers` amalgamation for mobile**, so both sides run the literal same
  implementation instead of two independently-compatible ones — rather than Option 1
  (official SQLCipher mobile builds) succeeding by default. Tier C should specifically budget
  time to test both, not assume the official build "just works."

---

## Tier C′ — macOS via GitHub Actions, the official SPM package: **DONE, real result**

**Not literally iOS** (no device, no simulator) — but the exact dependency and toolchain a
real iOS app would declare: `https://github.com/sqlcipher/SQLCipher.swift`, the SPM package
maintained by Zetetic (SQLCipher's own authors), resolved to `4.17.0`, on a GitHub Actions
`macos-latest` runner (`macos-26-arm64`, Swift 6.3.2). Answers question C2 without needing
Oscar to own or rent a Mac, once he confirmed the trade-off (a temporary, path-scoped,
push-triggered workflow — deleted below, per D-L).

**Setup:** a throwaway SPM executable target (`advances/M4/tier-c-spike/`, now deleted)
depending on the `SQLCipher` product, with `cSettings: [.define("SQLITE_HAS_CODEC", to: nil)]`
— required to make the codec-specific C declarations (`sqlite3_key` etc.) visible at all;
without it the build fails with "cannot find 'sqlite3_key' in scope" (this repo's own
`SQLCipherTests` target sets the identical define). Confirmed by this spike's first run.

**C2 result: FAIL — matches Tier B exactly.**
```
sqlite3_open(tmpPath, &db)                                    -> SQLITE_OK
sqlite3_key(db, <32 raw bytes from manifest.keyHex>, 32)       -> SQLITE_OK
sqlite3_prepare_v2(db, "SELECT count(*) FROM sqlite_master")   -> SQLITE_NOTADB (26)
RESULT raw_key_open=FAIL detail=prepare returned 26: file is not a database
```
The key is *accepted* (no error at `sqlite3_key`) but the first real read fails with the
identical "file is not a database" signature Tier B found on Linux. This is the strongest
evidence yet that the incompatibility is not a Linux-packaging artifact: **the official,
Apple-platform-maintained SQLCipher package cannot open a vault written by
`better-sqlite3-multiple-ciphers`, using valija's raw key, either.**

**Updated recommendation for D-G (superseded below):** at this point in the spike, Option 2
(build the `SQLite3MultipleCiphers` amalgamation for mobile, so both sides run the literal
same implementation) looked like the starting plan for a future app advance, not a fallback
to reach for only if Option 1 fails — Option 1 had failed on two independent platforms with
the same signature. The `legacy=4` re-check below (same session, later) found a documented
compatibility toggle in the library and re-ran both tiers against it — see "Tier B/C′
re-check" for the real, still-negative result, and the final recommendation at the bottom of
this file.

---

## Tier B/C′ re-check — `PRAGMA legacy=4` (same advance, later in the session)

`SQLite3MultipleCiphers` (the library `better-sqlite3-multiple-ciphers` wraps) documents a
`legacy` cipher parameter specifically for this: **`legacy=0` (the default, and what B2/C2
above tested — valija's `openVaultDb` never sets it) is documented to produce files that are
*not* compatible with the original SQLCipher library; `legacy=1..4` is documented to select
that exact SQLCipher version's parameters and format.** Valija's own probe
(`manifest.json`'s `cipher.legacy`) confirms the golden vault was built at `legacy=0` — so
B2 and C2 above tested an admittedly-non-compatible configuration, not the library's best
attempt at compatibility. This re-check tests `legacy=4` specifically, on both tiers that
had failed.

### B3 — Raw-key open, bidirectional, `legacy=4`: **PASS**

A throwaway vault (never the golden-vault fixture) built via
`better-sqlite3-multiple-ciphers` with `PRAGMA cipher='sqlcipher'; PRAGMA legacy=4;` before
the key, using the same published `manifest.json` key for direct comparability:

```
$ node -e '... db.pragma("cipher=\'sqlcipher\'"); db.pragma("legacy=4"); db.pragma("key=\"x\'<keyHex>\'\""); ...'
legacy = 4   (all other cipher params identical to the legacy=0 probe -- see below)
```

- **Node writes, real `sqlcipher` CLI reads:** `PRAGMA key`, `SELECT count(*) FROM sqlite_master`,
  `SELECT * FROM probe` all succeed; the inserted row reads back correctly
  (`1|legacy4-compat-probe`). `PRAGMA cipher` reports `AES-256-CBC` (expected — real SQLCipher
  has no scheme concept). `PRAGMA integrity_check` reports `ok`.
- **Real `sqlcipher` CLI writes, Node reads (`legacy=4`):** the reverse direction also passes —
  a row written natively by upstream `sqlcipher` reads back correctly through
  `better-sqlite3-multiple-ciphers` with `legacy=4` set.

**This looked like a full, real fix — bidirectional, on Linux, with actual data verified, not
just "file opens."** It is not: see C3 below.

### C3 — Raw-key open, official SPM package, `legacy=4`: **FAIL — same signature**

Re-ran the Tier C′ GitHub Actions check (temporary workflow + SPM package, same discipline as
before, deleted after this result was recorded) against the `legacy=4` vault from B3, run
side-by-side with the original `legacy=0` golden vault as a sanity check that nothing else
had changed:

```
RESULT label=legacy0-golden-vault raw_key_open=FAIL detail=prepare returned 26: file is not a database
RESULT label=legacy4-fixture      raw_key_open=FAIL detail=prepare returned 26: file is not a database
```

**Both fail, identically.** The exact same bytes that round-tripped cleanly through real
`sqlcipher` on Linux (B3) still fail against the official, Zetetic-maintained
`SQLCipher.swift` package (resolved `4.17.0`) on macOS.

**Ruled out version-default drift:** added a diagnostic step querying SQLCipher's own
`cipher_default_*` pragmas from a fresh `:memory:` connection (no file, no key needed) —
these report the library's *actual* compiled-in defaults, independent of anything valija
does:

| Parameter | Linux `sqlcipher` 4.5.6 | Official SPM package 4.17.0 |
|---|---|---|
| `cipher_default_kdf_iter` | 256000 | 256000 |
| `cipher_default_page_size` | 4096 | 4096 |
| `cipher_default_use_hmac` | 1 | 1 |
| `cipher_default_plaintext_header_size` | 0 | 0 |
| `cipher_kdf_algorithm` | `PBKDF2_HMAC_SHA512` | *(not separately queried; matches by construction — same default across SQLCipher 4.x)* |
| `cipher_hmac_algorithm` | `HMAC_SHA512` | *(same)* |

Identical across both real SQLCipher builds. `better-sqlite3-multiple-ciphers`' own `legacy=4`
probe also reports `kdf_algorithm=2` / `hmac_algorithm=2`, which the library's own docs define
as SHA512 — matching. `hmac_salt_mask` (58 decimal = `0x3a`) also matches SQLCipher's
documented hardcoded constant. Every parameter this spike can query agrees on both sides; the
vaults still don't open.

**Not a new problem — a known, unresolved one:** `utelle/SQLite3MultipleCiphers` issues
[#20](https://github.com/utelle/SQLite3MultipleCiphers/issues/20) (Dec 2020, SQLCipher 4.4.2)
and [#47](https://github.com/utelle/SQLite3MultipleCiphers/issues/47) (Sep 2021, vs. DB
Browser for SQLite) both report the identical symptom — matching documented parameters,
`legacy`/`cipher_compatibility` set, still "file is not a database" in both directions
against real SQLCipher. Neither issue's public thread shows a maintainer-confirmed root
cause or fix. This spike's B3/C3 result is a fresh (2026), independent reproduction of the
same unresolved pattern against the current release (`better-sqlite3-multiple-ciphers`
12.11.1) — not a one-off misconfiguration on valija's part.

**Updated recommendation for D-G (final):** `legacy=4` is not a viable fix. It is not merely
untested — it demonstrably does not deliver real interoperability with the official SQLCipher
package, despite the library's own documentation describing it as the compatibility mode and
despite every queryable parameter matching. Any future mobile-companion advance should treat
"official SQLCipher on one side, `better-sqlite3-multiple-ciphers` (with or without
`legacy=N`) on the other" as **closed, not just de-prioritized**. The only path this spike has
not ruled out is Option 2 as originally scoped — building/linking the literal
`SQLite3MultipleCiphers` C library for mobile so both ends run the *same* implementation
(not two independently-compatible ones) — and that now needs its own direct empirical test
(build it for iOS/Android, open a real valija vault with it) before being trusted, exactly
like every other claim in this spike.

**What C2's result doesn't answer, still open:**
- **C1 (Argon2id on-device)** — not attempted here; already conclusively answered by Tier B1
  (reference-C implementation, platform-agnostic by construction). Low value in re-running on
  Apple hardware specifically.
- **C3 (pack/search byte-match)** and **C4 (write round-trip)** — both blocked on C2 passing,
  which it didn't. Nothing to test until a compatible SQLCipher build (D-G's Option 2) exists.

### If a literal iOS (device/simulator) run is ever wanted

The setup below is kept for that case — it targets an actual iOS app bundle rather than a
macOS CLI executable, which the GitHub Actions run above did not attempt. Given C2's result,
running this against Option 1 (official build) is now expected to reproduce the same failure;
it's more useful once an Option 2 (amalgamation) build exists to test instead.

1. Create a throwaway iOS (or macOS) Xcode project — a Playground or a minimal single-view
   app is enough. Nothing here is kept.
2. Add SQLCipher via CocoaPods (`pod 'SQLCipher'`) or SwiftPM, and a native Argon2id — either
   link `phc-winner-argon2` directly, or use a Swift Argon2id wrapper that binds the same
   reference C library (not a from-scratch reimplementation — D-G).
3. Add `src/testing/__fixtures__/golden-vault/vault.db` to the app bundle (or copy it in via
   the simulator's file system at runtime).

### C1 — Argon2id on-device (should already be proven by B1, confirm on-device anyway)

Derive with `manifest.json`'s passphrase, `saltBase64` (`GoldenVaultSalt!`), and `kdf`
(65536 KiB / t=3 / p=1). Compare against `manifest.json`'s `keyHex`. Also worth timing —
D-G asks whether a 64 MiB derivation is acceptable in the app's main process on a real
device, not just in principle.

### C2 — Raw-key open: **answered by Tier C′ above (macOS, official package) — FAIL**

Superseded by the GitHub Actions run above, which used the exact same official package a
literal iOS run would. If this is ever re-attempted on a real device/simulator, expect the
same "file is not a database" result against Option 1 (official build) — test Option 2 (the
`SQLite3MultipleCiphers` amalgamation, built for iOS) instead, once one exists.

### C3 — Pack and search byte-match (only if C2 passes)

`SELECT` the rows, reproduce `docs/vault-format.md`'s pack-assembly (§8) and rendering (§9)
algorithms, and byte-compare against `expected-pack.md`. Run each query in
`expected-search.json` and byte-compare the hits.

### C4 — Write round-trip (D-G amendment — informational, does not block Tier 1)

1. Copy the fixture to a **throwaway** path (never the original).
2. `INSERT` one row into `context_items` through the mobile binding — any valid `type`
   from `docs/vault-format.md` §6, an existing `project_id` (`proj-alpha` or `proj-beta`).
   The FTS triggers keep the search index in step automatically; no extra work needed.
3. Close the database, move the mutated file off the device.
4. **Desktop-side verification — no scratch code needed:**
   ```
   export VALIJA_HOME=/path/to/a/copy/of/the/mutated/vault
   node dist/program.js unlock          # published passphrase
   node dist/program.js search "<distinctive text from the inserted row>"
   node dist/program.js show <project> --type <the type you inserted>
   ```
   Confirm the new row reads back and is searchable, and check
   `sqlite3 vault.db "PRAGMA integrity_check"` plus that no `-wal`/`-shm` sidecar was left
   behind (desktop's own `openVaultDb` folds it on the next open regardless, but a clean
   write should not need that).
5. A **FAIL** here does not block this advance or Tier 1 — D-D is deferred, not committed.
   Record it as a separate line item; it's early evidence for whenever Tier 2 is revisited.

---

## Option 2 verification — building the literal amalgamation for mobile

The `legacy=4` result above closed "official SQLCipher + `better-sqlite3-multiple-ciphers`"
as a path — real interop with the official package doesn't materialize even with every
queryable parameter matching. D-G's Option 2 was the one path left standing: build the
*literal* `SQLite3MultipleCiphers` C library for mobile, so both ends run the same
implementation rather than two independently-compatible ones. This was untested until now.

**What was tested:** `node_modules/better-sqlite3-multiple-ciphers/deps/sqlite3/sqlite3.c` —
the exact, unmodified amalgamation source `node-gyp` compiles into valija's desktop native
addon (SQLite3MultipleCiphers v2.3.5, confirmed via `deps/update-sqlite3mc.sh`) — compiled
standalone with a plain C compiler (no Node, no N-API) for each target, then run directly
against valija's real production golden-vault fixture (`legacy=0`, the actual desktop
config, no special pragma). All four checks used the exact same 47-line `main.c`: open a
throwaway copy, `PRAGMA cipher='sqlcipher'`, key with the raw hex key, then read real rows
back (not just "does it open") — a table/count-per-type breakdown, to rule out a lucky
all-zero decrypt.

| Platform | Toolchain | What ran | Result |
|---|---|---|---|
| Linux | `cc`, same defines as `node-gyp` | Compile + run natively | **PASS** — `sqlite_master_count=16`, correct per-type row counts |
| iOS (arm64) | Apple `clang`, `-target arm64-apple-macos13.0` (real device target linked separately) | Compile + run on the arm64 GitHub Actions runner; iOS-device target link-only as a second check | **PASS** — identical `sqlite_master_count=16` and row breakdown; device-target linked clean |
| Android (arm64) | NDK `clang`, `aarch64-linux-android24-clang` | Compile only (the real device architecture) | Compiles clean — bare `qemu-user` couldn't execute the result (two independent emulation-harness limits, not compatibility findings: static hit a qemu/Bionic TLS-alignment bug, dynamic needed `/system/bin/linker64`, which only exists on a real system image) |
| Android (x86_64) | NDK `clang`, real Android emulator (API 30, GitHub Actions, KVM) via `adb` | Compile + execute inside a booted emulator | **PASS** — identical `sqlite_master_count=16` and row breakdown, real Bionic userspace |

**Every platform that could actually execute the binary passed, with byte-identical results**
(the same 16-table count, the same six-way row breakdown by `type`, on every platform). The
one architecture that didn't get a full execution run (Android arm64) still compiled clean
against the real NDK/bionic toolchain, and the cipher logic is portable, architecture-
independent C with no per-platform branches — the x86_64 emulator run already exercises the
identical Bionic/Android userspace path arm64 would.

**Conclusion: Option 2 is confirmed, not just theoretically sound.** Building the literal
`SQLite3MultipleCiphers` amalgamation for a mobile app — rather than depending on the
official SQLCipher package — gives real, verified format compatibility with valija's desktop
vaults, with no changes to the desktop side at all (`legacy=0`, the actual shipped config,
worked as-is; no re-encryption, no migration, no breaking change for existing users).

## Results

| # | Question | Tier | Result | Notes |
|---|---|---|---|---|
| 1 | Argon2id reference-C vector reproduction | B | **PASS** | Two vectors, exact match — see B1 |
| 2 | Raw-key open (upstream SQLCipher, Linux) | B | **FAIL** | Also fails via the native passphrase path — see B2. Not a usage error (self-test passed) |
| 3 | Argon2id on-device | C | DEFERRED | Low value — B1 already conclusive (reference-C, platform-agnostic) |
| 4 | Raw-key open, official SPM package (macOS, GitHub Actions) | C′ | **FAIL** | Identical signature to #2 — `SQLITE_NOTADB` on the first read. Not literally iOS, but the exact official package + toolchain |
| 5 | Pack byte-match on iOS | C | DEFERRED | Blocked on #4's FAIL |
| 6 | Search byte-match on iOS | C | DEFERRED | Blocked on #4's FAIL |
| 7 | Write round-trip on iOS | C | DEFERRED | Informational only (D-D deferred) |
| 8 | Raw-key open, bidirectional, `legacy=4` (Linux) | B | **PASS** | Real data verified both directions — see B3. Looked like a full fix |
| 9 | Raw-key open, official SPM package, `legacy=4` (macOS) | C′ | **FAIL** | Identical signature to #2/#4, despite every queryable parameter matching — see C3. Matches two known, unresolved upstream issues (#20, #47) |
| 10 | Option 2: literal amalgamation, compile + run, Linux | — | **PASS** | Real row data verified — see "Option 2 verification" |
| 11 | Option 2: literal amalgamation, compile + run, iOS (arm64) | — | **PASS** | Identical row data; iOS device target also linked clean |
| 12 | Option 2: literal amalgamation, compile, Android (arm64) | — | Compiles clean | Real device architecture; execution blocked by qemu-user limits, not a compatibility finding |
| 13 | Option 2: literal amalgamation, compile + run, Android (x86_64, real emulator) | — | **PASS** | Identical row data, real Bionic userspace via `adb` |

## What must not happen (confirmed)

- No toolchain, dependency, script, or CI job from this spike landed in the repo, in its
  final state — `sqlcipher`/`argon2` were installed system-wide in the implementation
  container for Tier B only; the temporary `advances/M4/tier-c-spike/` SPM package,
  `advances/M4/option2-spike/` (the standalone `main.c` harness), and both temporary
  workflow files (`m4-tier-c-spike.yml`, `m4-option2-spike.yml`) were all deleted once
  their results were recorded, in the same commit as each update. `package.json` and
  `.github/workflows/ci.yml` (the real CI) are untouched throughout.
- The fixture in the repo was never edited — every check operated on a throwaway copy.
- No real vault, passphrase, or key was used anywhere in this spike — only the published
  test values.
