# MOBILE — ship report

## Verdict

`advances/MOBILE/review.md` (fifth pass): **Verdict: PASS**, confirmed before shipping.

## What this advance did

Built a Kotlin Multiplatform proof of concept, in the separate `akiles94/valija-mobile`
repository (branch `feat/poc` @ `644e4e1`), to test whether valija's vault format and pack
algorithm are portable to a second, non-Node implementation. The PoC:

- Vendored the same SQLite3MultipleCiphers amalgamation valija uses (SHA-256 verified
  byte-identical to `node_modules/better-sqlite3-multiple-ciphers`'s copy) and compiled/ran it
  through both JNI/NDK (Android) and Kotlin/Native cinterop (iOS).
- Opened the repo's golden-vault fixture read-only, derived the key with Argon2id, and rendered a
  pack that byte-compares identical to `expected-export.md` (10 passing `@Test`s in
  `GoldenVaultConformanceTest`).
- Ran conformance tests through CI on an Android emulator (x86_64, not arm64) and an iOS
  simulator.
- Along the way, found and fixed five real defects/under-specifications in
  `docs/vault-format.md` (markdown concatenation rule, three distinct section-label budgeting
  rules, latest-handoff selection, `estimateTokens`'s UTF-16 code-unit semantics, preamble ISO
  timestamp format) and corrected `docs/SPEC.md` §2/§10b accordingly.

**Diff shipped into `valija` (docs-only, 9 files, 578 insertions / 14 deletions):**
`CHANGELOG.md`, `advances/MOBILE/{refined,plan,poc,review}.md`,
`advances/MOBILE/evidence/{sqlite3c-sha256,toolchain-versions}.txt`, `docs/SPEC.md`,
`docs/vault-format.md`. No `src/`, `package.json`, build config, `.github/`, or `.gitignore`
touched.

## What is lacking (per review.md, all superseded or disclosed — none blocks the merge)

- **Physical-device runs never happened** (Slice 9 skipped). Oscar decided on 2026-08-16 not to
  pursue a distributable mobile app (Apple Developer Program cost/maintenance not justified for
  an unmonetized project), and dated/signed that decision as an amendment to `plan.md` and
  `refined.md` (superseding P-6's device-run outcome). Five acceptance criteria are unmet as a
  direct, disclosed consequence: no iOS-simulator or Android-emulator/device screenshot (C1, C2),
  no on-device screen half of the byte-comparison (D2), no committed device run logs (C4's device
  half), and toolchain versions for NDK/Xcode/simulator runtime are unrecorded and in the NDK's
  case unrecoverable in principle (A7).
- **Two evidence log files never made it into the repo** (`.gitignore`'s `*.log` rule silently
  swallowed them for four review passes) — disclosed as NOT COMMITTED at every point they're
  cited, not presented as shipped evidence.
- A pile of carried nits remain open (not blocking): one under-claiming word in `poc.md`'s
  provenance caveat, one mis-citation of which document actually scopes the diff, two stale
  comments/pointers in `valija-mobile` and `docs/vault-format.md`, some numbering/labelling
  inconsistencies (`§3a`, duplicate `G3a` labels, `NOT COLLECTED` vs. the spec's `NOT ATTEMPTED`
  vocabulary), and one file-placement nit in `valija-mobile`'s Kotlin source.

## Review summary

Five review passes were required before PASS. The first four found real problems (two
FAIL-worthy passes for a critical evidence gap and a closure diff issue), each fixed in the
branch's own commits. The final pass reverified from scratch — re-hashed the amalgamation and
fixture files, re-read the five contract corrections against `src/`, re-checked the diff scope,
re-confirmed the disclosure of both uncommitted logs is consistent everywhere it's mentioned, and
re-ran `typecheck`/`lint`/`test` (all green, 241 tests, no `src/` change). It found no criticals,
five warnings (documentation wording/citation nits) and ten suggestions, none of which the
reviewer judged sufficient to hold the merge, concluding: "the security surface is not merely
unchanged, it is unchanged in a diff that contains zero lines of code."

## Ship actions taken

1. Verified `review.md` first line is `Verdict: PASS`.
2. Confirmed working tree on `docs/mobile-poc-MOBILE` was already clean and pushed at `55251f9`
   (no new commit needed — all review-round fixes were already committed on the branch).
3. Dry-ran a three-way merge (`git merge-tree`) against `main` — clean, no conflicts.
4. `git checkout main && git pull origin main --ff-only` (already up to date at `bb1893b`).
5. `git merge --no-ff docs/mobile-poc-MOBILE` — merge commit `91419f5`, no conflicts, same 9
   files/578+/14- as the dry run.
6. `git push origin main` — `bb1893b..91419f5 main -> main`.
7. Verified `main` and `origin/main` both resolve to `91419f5` with a clean working tree.

## Result

- **Branch:** `docs/mobile-poc-MOBILE` (tip `55251f9`, unchanged — no new commits added to it)
- **Merge commit:** `91419f5` on `main`
- **Pushed:** yes, `origin/main` now at `91419f5`
