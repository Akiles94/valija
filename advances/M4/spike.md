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

**Updated recommendation for D-G:** Option 2 (build the `SQLite3MultipleCiphers` amalgamation
for mobile, so both sides run the literal same implementation) should now be treated as the
starting plan for a future app advance, not a fallback to reach for only if Option 1 fails —
Option 1 has now failed on two independent platforms with the same signature.

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

## What must not happen (confirmed)

- No toolchain, dependency, script, or CI job from this spike landed in the repo, in its
  final state — `sqlcipher`/`argon2` were installed system-wide in the implementation
  container for Tier B only, and the temporary `advances/M4/tier-c-spike/` SPM package plus
  `.github/workflows/m4-tier-c-spike.yml` (used for Tier C′) were both deleted once this
  result was recorded, in the same commit as this update. `package.json` and
  `.github/workflows/ci.yml` (the real CI) are untouched throughout.
- The fixture in the repo was never edited — every Tier B command operated on a `/tmp` copy.
- No real vault, passphrase, or key was used anywhere in this spike — only the published
  test values.
