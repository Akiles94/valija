# M4 compatibility spike — runbook and results

## What is being tested, and why

`advances/M4/refined.md` §10 names one fact the whole mobile-companion idea rests on, and
that nobody had tested before this advance: **can an official/upstream SQLCipher build open
a vault written by `better-sqlite3-multiple-ciphers`'s `sqlcipher` cipher scheme, using the
raw 32-byte key valija derives?** If the answer is no, the mobile idea needs a format-level
rethink before any app work — which is exactly why this spike exists *before* committing to
building one.

Three tiers, in increasing order of what they need:

| Tier | Who runs it | What it needs | What it answers |
|---|---|---|---|
| A | this advance (Slices 1-4) | nothing beyond this repo | The desktop side, empirically: the real cipher parameters, a golden vault, byte-exact expected outputs |
| B | this advance (below) | any Linux/macOS shell, `sqlcipher` + `argon2` CLIs | Whether upstream SQLCipher and reference-C Argon2id agree with what Node produced — **run below, real results** |
| C | Oscar, on a Mac | Xcode, CocoaPods/SwiftPM SQLCipher, a native Argon2id | The iOS-specific packaging (CommonCrypto vs OpenSSL, the CocoaPods build's defaults) and the write round-trip |

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

## Tier C — iOS, needs a Mac with Xcode (Oscar)

**Deferred — no Mac available (plan.md Decision D-4's fallback).** This tier cannot be
executed by an agent in this container — no Xcode, no iOS toolchain, and none may be added
to this repo (refined §8: *"The spike leaves no mobile toolchain, dependency, or CI job in
this repo."*) — and Oscar does not currently have access to a Mac to run it manually either.

Per D-4, this advance ships now with Tiers A and B complete and Tier C explicitly open,
rather than blocking indefinitely on hardware access. The runbook below stays ready to run
whenever a Mac becomes available (borrowed, rented by the hour, or a colleague's) — nothing
about it expires. One option that doesn't require owning or renting a Mac: a GitHub Actions
`macos-latest` runner (free for public repos) can run Tier C's checks via a `workflow_dispatch`
job — the workflow file would need to be committed to trigger it, so `refined.md`'s "no CI job
in this repo" acceptance criterion would need Oscar's explicit sign-off to make a one-off,
delete-afterward exception, or to accept a small permanent job. Not started; a decision for
Oscar, not something to build unilaterally.

### Setup

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

### C2 — Raw-key open (the core question, now elevated by B2's result)

Open the bundled `vault.db` with `PRAGMA key = "x'<keyHex>'"` (and, if that fails, try the
combined key+salt form B2 also tried). Given B2's result, **do not be surprised if this also
fails** — if it does, that is not a spike failure, it is the spike doing its job. Record
whichever of Option 1 (official build, if it happens to work) or Option 2 (the
`SQLite3MultipleCiphers` amalgamation, built for iOS) actually succeeds.

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
| 3 | Argon2id on-device | C | DEFERRED | No Mac available (D-4 fallback) |
| 4 | Raw-key open on iOS | C | DEFERRED | No Mac available — see B2's note on lowered expectations |
| 5 | Pack byte-match on iOS | C | DEFERRED | Blocked on #4 |
| 6 | Search byte-match on iOS | C | DEFERRED | Blocked on #4 |
| 7 | Write round-trip on iOS | C | DEFERRED | Informational only (D-D deferred) |

## What must not happen (confirmed)

- No toolchain, dependency, script, or CI job from this spike landed in the repo —
  `sqlcipher`/`argon2` were installed system-wide in the implementation container for this
  spike only; `package.json` and `.github/workflows/ci.yml` are untouched.
- The fixture in the repo was never edited — every Tier B command operated on a `/tmp` copy.
- No real vault, passphrase, or key was used anywhere in this spike — only the published
  test values.
