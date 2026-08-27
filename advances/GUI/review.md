Verdict: PASS

# GUI · Slice 13 — Packaging, release, and the final gates — Review (second pass)

Commits under review: `7380a4a` + the fix commit `30da55a` on `feat/desktop-GUI`, base `dfb0298`
(Slice 12, `Verdict: PASS`). Slice diff, excluding `review.md`: five files, **+224 −0**.

**This is the last slice in `plan.md`, so this verdict is also the 13-slice GUI advance's exit
gate. It passes.** Plainly: the code, the tests, the CI/release plumbing and the ritual trail are
all in order, and I found nothing left that a code change should fix. Merge it.

What a PASS here does and does not mean, stated once so nobody has to infer it:

- **It means the branch is merge-ready.** Every acceptance criterion that can be checked against
  source, tests or config in this repository is met; both suites are green at their claimed counts;
  no hard gate is breached.
- **It does not mean a release has happened.** Four things — cross-OS packaging, native modules
  loading inside a packaged app, the zero-network walkthrough against a real artifact, and the four
  SHA-256 values `docs/gui.md` still shows as `pending` — require a tagged CI run on real runners or
  a developer machine. They are recorded as open in `spike.md`, which is what `plan.md`'s own
  Slice-13 Done-when instructs for anything unanswerable in the implementation environment, and
  what R9 calls "an escalation to Oscar". §6 lists them as the outstanding human gates. They are
  release work, not merge work, and the workflow this slice adds is what performs them.

Both of the first pass's **Criticals are fixed and verified empirically**, not by reading the commit
message; all **six Warnings are fixed**. Details in §5.

---

## 1. Acceptance criteria (`refined.md` §9, the lines this slice owns)

| # | Criterion (`refined.md`) | Verdict | Evidence |
|---|---|---|---|
| 1 | Unsigned artifacts build for macOS, Windows, Linux, **each with a published SHA-256** (`:1852`) | **MET as far as this repo can carry it** | `desktop.yml:45-72` computes a digest per artifact on each matrix leg and uploads it; `:90-97` combines, sorts and **verifies** them; `:98-112` publishes them plus every artifact as a draft release. C1's portability defect is gone (`:56-60`) and I reproduced the whole pipeline end to end (§5.1). The *act* of building on three OSes is the open human gate of §6, not a code defect. |
| 2 | Native modules load in the packaged app on every target (`:1852-1853`) | **OPEN — sanctioned human gate** | Packaging is egress-blocked here; independently reproduced in the first pass. Recorded at `spike.md:340`. |
| 3 | MCP surface byte-for-byte unchanged (`:1592-1593`) | **MET** | `git diff origin/main...HEAD -- src/delivery/mcp/` → only `server.test.ts` (+12/−7), a fixture widened for `Container`'s Slice-4/8 shape. `server.ts`: 0 lines. `spike.md:337` states exactly this without overclaiming. |
| 4 | Published npm package unchanged (`:1601-1602`) | **MET** | `git diff origin/main...HEAD -- package.json` → empty. |
| 5 | CI matrix neither slowed nor gated by desktop packaging (`:1598-1600`) | **MET** | `git diff origin/main...HEAD -- .github/workflows/ci.yml` → empty. Every packaging/checksum/upload step carries `if: startsWith(github.ref, 'refs/tags/v')` (`desktop.yml:37,46,63`); `release` is a separate tag-gated job (`:77`). On a PR, `github.ref` is `refs/pull/N/merge`, so none of it runs. |
| 6 | Root `typecheck && lint && test && build` green, count up (`plan.md:1071-1072`) | **MET** | Ran by hand: `tsc --noEmit` clean, Biome 288 files clean, **57 files / 301 tests passed**, `tsup` build success. |
| 7 | Desktop suite green (`plan.md:1073`) | **MET on Linux; OPEN cross-OS** | Ran by hand: 45 files / **626 tests passed** (625 + the new `fatal` test), desktop `typecheck` clean, `electron-vite build` succeeds (72 modules). Windows/macOS legs are `desktop.yml`'s job. |
| 8 | `src/` changes confined to Slices 4/8's files (`plan.md:1066`) | **MET** | 31 `src/` paths, enumerated in `spike.md:336` and re-counted here. Slice 13 itself touches **no** `src/` production file — its only `desktop/src/` files are two `*.test.ts`. |
| 9 | No `publish`/auto-update configuration of any kind (`plan.md:1051-1052`, `:1058-1061`) | **MET** | `no-auto-update.test.ts:32,39` — both assertions are now shape-based. I ran the first pass's three mutants against the exact regexes: `mac:`-nested `publish:`, `"publish":` and `'publish':` are all **caught**; `update-electron-app`, `electron-differential-updater`, `electron-simple-updater` are all **caught** (§5.3). W3 closed. |
| 10 | Zero network verified against the **built artifact**, both languages (`:1832-1835`) | **OPEN — sanctioned human gate** | No artifact exists here. `spike.md:341`. |
| 11 | `grep -c "pending — filled by Slice 13" docs/gui.md` returns **0** (`plan.md:1083-1084`) | **OPEN — now recorded** | Still returns **4** (`docs/gui.md:22-25`). Strictly downstream of the packaging gate. W4's point is closed: `spike.md:342` carries it as its own table row and `spike.md:344-350` names it in the closing open-items paragraph, so it can no longer be lost. See §6. |
| 12 | Run-from-source path verified, not assumed (`:1854-1856`) | **OPEN — sanctioned human gate** | Same rebuild blocker. |
| 13 | macOS keychain-ACL answer with named OS version (`:1662-1664`, D-H) | **OPEN — sanctioned human gate** | `spike.md:161`, unchanged since Slice 1, where `plan.md:1225-1232` declares it a HUMAN GATE outright. |
| 14 | Client-`env`-honouring answer per client (`:1760-1762`, D-R(a) spike) | **OPEN — sanctioned human gate** | `spike.md:162`. |
| 15 | Bilingual screenshots from the golden fixture (`:1838-1839`) | **OPEN — sanctioned human gate** | `spike.md:260-266`, via item 96's own human-gate clause. |

### Plan items (`plan.md:1035-1089`)

| Item | Verdict | Evidence |
|---|---|---|
| 95 — tag job computes and publishes each artifact's SHA-256 | **MET** | `desktop.yml:45-72`, `:90-112`. Portable across all three runners (§5.1). |
| 95 — guard test: no `publish` key, no updater-shaped dep (P-D19) | **MET** | `no-auto-update.test.ts`, both assertions shape-based; mutants verified (§5.3). |
| 95 — Slice 1's `electron-builder.yml` not re-derived | **MET** | The six added lines are three `artifactName` keys plus a comment; `asarUnpack`, `npmRebuild`, `identity: null` and the three targets are untouched (`git diff dfb0298..HEAD -- desktop/electron-builder.yml`). |
| 95 — artifact names match the shipped docs (first pass's C2) | **MET** | Worked out by hand against the installed `app-builder-lib` (§5.2): all four filenames match `docs/gui.md:22-25` exactly. |
| 98 — the runnable gate checks | **MET** | All six re-run by hand; each reproduces `spike.md`'s claim. |
| 98 — pasted into the PR description | **DEFERRED to ship** | No PR exists yet; `spike.md:333-342` is the record git-ops copies from. Not a code defect. |
| Done-when — pending markers grepped away | **OPEN — recorded, not silent** | §6. |
| Done-when — anything unanswerable written down in `spike.md` | **MET** | All four open items now named, including the checksum markers (W4). |

---

## 2. Hard gates

| Gate | Result |
|---|---|
| Security surface weakened (secrets/keys logged, plaintext to disk, KDF/keychain altered, SQLCipher unkeyed, MCP over-exposed) | **No breach — and this slice narrows the surface.** No `src/` or `desktop/src` production file is touched anywhere in Slice 13. The workflow prints only public SHA-256 digests of public artifacts. `permissions: contents: read` at `desktop.yml:12-13` is a new floor; `contents: write` exists only inside `release` (`:82-83`), where GitHub's job-level `permissions` **replaces** the workflow floor rather than merging, so `build` — the job that runs `npm ci` lifecycle scripts on three OSes — now holds read only. The one third-party action is pinned to an immutable commit (`:102`), verified below. `draft: true` (`:109`) keeps an unsigned build from going out unattended. |
| Tests missing for new behaviour, or the suite not passing | **No breach.** Root 301 / desktop 626, both green, both run by hand. The new behaviour that is testable in-suite is tested and the tests are now *strong* rather than nominal (W3, W5). CI shell logic is not unit-testable; I verified it by execution instead (§5.1). |
| Advance ritual evidenced | **No breach.** `advances/GUI/refined.md:3` `Approved: Oscar 2026-08-20` → `advances/GUI/plan.md:3` `Approved: Oscar 2026-08-25 (third revision …)` → this `review.md`. `.claude/hooks/guard-implementation.sh:36` carries Slice 1's `*/desktop/*|desktop/*` globs, so the gate was live over every file this slice touched. |
| Naming, clean-architecture placement, conventions | **No breach for this slice.** `desktop/electron-builder.yml` and `.github/workflows/desktop.yml` are repo-root build config, outside the layer rules. `no-auto-update.test.ts` sits beside the two guard tests Slice 1 and Slice 5 established at `desktop/src/main/infra/` and uses `dependency-parity.test.ts`'s exact `join(import.meta.dirname, "../../../…")` idiom. `diagnostic-rows.test.ts` is a new case in an existing Slice-10 file. See S1 for the standing convention tension, unchanged and not worsened here. |

---

## 3. Line count

| File | Added | Deleted |
|---|---|---|
| `.github/workflows/desktop.yml` | 77 | 0 |
| `advances/GUI/spike.md` | 84 | 0 |
| `desktop/electron-builder.yml` | 6 | 0 |
| `desktop/src/main/infra/no-auto-update.test.ts` | 37 (new) | 0 |
| `desktop/src/renderer/state/diagnostic-rows.test.ts` | 20 | 0 |
| **Total (excl. `review.md`)** | **224** | **0** |

The fix commit `30da55a` alone is +111 −33 across those same five files. `git show 30da55a --stat`
lists exactly the six files its message claims (the five above plus `review.md`) and **no `src/`
production file** — its only two `desktop/src/` entries are `*.test.ts`.

Plan estimated "≈30 lines of CI/release config" (`plan.md:1661`); actual is 63 config + 14 comment.
The overrun is the `release` job plus the portability branch and the verify step, all of which the
plan describes without counting. Fine.

---

## 4. Issues

### Critical

**None.** C1 and C2 from the first pass are both closed; see §5.1 and §5.2 for how I checked, which
was by running and computing, not by reading the commit message.

### Warning

**None.** W1–W6 are all closed; see §5.

### Suggestion

**S1 — three guard tests sit bare at a layer root** (`desktop/src/main/infra/`).
`no-auto-update.test.ts`, `no-network-surface.test.ts` and `dependency-parity.test.ts` are not
adapters, so `CLAUDE.md`'s tech-named-`infra/`-adapter exception does not cover them, and
"no bare files at a layer's root" does. **Not introduced here** — the pattern was set in Slice 1 and
has passed twelve reviews — and the new file correctly follows its neighbours rather than inventing
a third convention, which is why this is not a Warning. *Alternative:* move all three to
`desktop/src/main/infra/guards/` in one commit, so the folder's name says "these are build-shape
assertions, not adapters", leaving `child-process-node-probe.ts`, `electron-clipboard.ts`,
`electron-file-picker.ts` and `file-app-preferences-store.ts` as the tech-named adapters `infra/`
is for. Not worth reopening the advance for; worth doing the next time that folder is touched.

**S2 — the `publish:` guard has two remaining blind spots.** `no-auto-update.test.ts:32`'s
`/^\s*["']?publish["']?\s*:/m` catches every realistic block-style form (verified, §5.3) but not
flow style (`mac: { publish: { provider: github } }`), and the test does not look at the two other
places auto-update can enter: a `build` key in `desktop/package.json` (electron-builder reads config
from there too) and a `--publish always` flag added to the `package` script. *Alternative:* two more
lines in the same file — `expect(PACKAGE_JSON.build).toBeUndefined()` and
`expect(PACKAGE_JSON.scripts.package).not.toMatch(/--publish|(^|\s)-p(\s|$)/)`. Cheap, and it closes
the remaining ways the rule can be broken without touching the YAML.

**S3 — the new `mac:` comment misstates electron-builder's rule it is defending against.**
`desktop/electron-builder.yml:20-22` says the default "omits the arch suffix for a single-arch build
and would collide between arm64/x64 otherwise". Verified in the installed
`app-builder-lib/out/platformPackager.js:547-557`: the default drops `${arch}` for the **default
arch (x64)** regardless of how many arches are built, and `arm64` keeps its suffix either way — so
there would have been no collision, only a `Valija-<version>.dmg` that `docs/gui.md`'s
`Valija-<version>-x64.dmg` row does not name. The **fix is exactly right** and for the right reason
(`isUserForced` on line 553 is what preserves the suffix); only the comment's explanation is off.
*Alternative:* "electron-builder drops `${arch}` for the default arch (x64) unless a user-supplied
`artifactName` forces it — which would have produced `Valija-<version>.dmg`, a name `docs/gui.md`
does not list."

**S4 — the shipped filenames differ from `refined.md` §4.1 step 0's illustrative names.** The spec's
walkthrough shows `Valija-<version>-mac-arm64.dmg`, `Valija-<version>-win-x64.exe`,
`Valija-<version>-linux-x86_64.AppImage`; what will actually build is `Valija-<version>-arm64.dmg`,
`Valija-<version>-x64.dmg`, `Valija-<version>-Setup.exe`, `Valija-<version>.AppImage`. §9 imposes no
filename requirement, §4.1's cell is an illustration of "what the user sees" rather than a criterion,
and `docs/gui.md` and `electron-builder.yml` now agree byte-for-byte — which is the property that
actually matters and the one C2 was about. Flagged only so that a later reader who spots the
mismatch does not "fix" one side alone and re-break the pairing.

**S5 — `build` has no `timeout-minutes` while `release` has one.** `desktop.yml:81` caps the release
job at 10 minutes; the matrix job that now runs `npm run package` on a tag has no cap and would
inherit the 360-minute default if a rebuild hangs. One line, e.g. `timeout-minutes: 45` under
`runs-on` at `:21`.

**S6 — the `permissions:` floor stops at this workflow.** `ci.yml` still declares none and inherits
the repository/org default. Out of scope here by construction (item 98 requires `ci.yml` to be
unchanged), so this is a note for the next advance that may touch it, not a finding against this one.

---

## 5. What I verified by hand

### 5.1 C1 — the checksum step's portability, executed rather than read

`desktop.yml:56-60` now probes `command -v sha256sum` and falls back to `shasum -a 256`. I did not
take the "identical output format" claim on trust; I built a four-artifact fixture and ran the
**whole** pipeline: a `shasum -a 256` leg (standing in for `macos-latest`) and two `sha256sum` legs,
then the release job's `cat checksums-*.txt | sort -k2 > checksums.txt` and `sha256sum -c`:

```
Valija-0.1.0-Setup.exe: OK
Valija-0.1.0-arm64.dmg: OK
Valija-0.1.0-x64.dmg: OK
Valija-0.1.0.AppImage: OK
```

GNU `sha256sum -c` accepts the `shasum` lines unchanged — the two-space `<hash>␣␣<name>` text-mode
format is identical, and because both run with `working-directory` set to the folder holding the
artifacts, every recorded name is a bare basename that resolves in the release job's flat
`release-artifacts/` directory and matches the asset names `action-gh-release` will upload. **C1 is
genuinely fixed**, and the added `sha256sum -c` (first pass's S2) makes a corrupted or missing
artifact fail the release rather than publish silently.

`shopt -s nullglob` + the `${#artifacts[@]} -eq 0` guard still behave correctly: each OS matches
exactly its own extension, `.blockmap` siblings do not match `*.dmg`/`*.exe`/`*.AppImage`, and
`win-unpacked/Valija.exe` is not reached by a non-recursive glob.

### 5.2 C2 — the four filenames, computed against the installed electron-builder

Not estimated — read out of `desktop/node_modules`:

- `app-builder-lib/out/platformPackager.js:551-557` — `artifactPatternConfig` folds
  `platformSpecificBuildOptions.artifactName` (the `mac:`/`win:`/`linux:` block) into
  `userSpecifiedPattern`, so setting it there sets `isUserForced`, and line 549's
  `!isUserForced && skipDefaultArch && …` no longer nulls the arch. This is precisely what makes the
  x64 dmg keep its suffix.
- `builder-util/out/arch.js:58-68` — `getArtifactArchName(x64, "dmg")` → `"x64"` (only AppImage/rpm/
  flatpak get `x86_64`, only deb/snap get `amd64`).
- `dmg-builder/out/dmg.js:25`, `nsis/NsisTarget.js:137`, `appimage/AppImageTarget.js:40` — the three
  call sites and their `ext` values (`dmg` / `exe` / `AppImage`).

Resolved against `version: 0.1.0` and `productName: Valija`:

| Config | Produces | `docs/gui.md` |
|---|---|---|
| `${productName}-${version}-${arch}.dmg` | `Valija-0.1.0-arm64.dmg`, `Valija-0.1.0-x64.dmg` | `:22`, `:23` ✓ |
| `${productName}-${version}-Setup.${ext}` | `Valija-0.1.0-Setup.exe` | `:24` ✓ |
| `${productName}-${version}.${ext}` | `Valija-0.1.0.AppImage` | `:25` ✓ |

All four match. **C2 is genuinely fixed**, and pinning the names also removes the drift risk across
electron-builder bumps, which is more than the finding asked for.

### 5.3 W3 — the guard's mutants, re-run

Applied the file's own two regexes to mutated inputs:

| Mutant | Result |
|---|---|
| `mac:` → nested `publish:` (first pass's miss) | **caught** |
| `"publish":` (quoted, first pass's miss) | **caught** |
| `'publish':`, `publish :` | **caught** |
| top-level `publish:` | **caught** |
| the real `electron-builder.yml`, and a commented-out `# publish:` | **not** matched (no false positive) |
| `update-electron-app` (first pass's miss), `electron-differential-updater`, `electron-simple-updater`, `electron-updater` | **all caught** |
| `react`, `vitest`, and the 21 real deps | **not** matched (no false positive) |

Both first-pass gaps are closed; the two residual ones are S2, not Warnings.

### 5.4 W1, W2, W6 — the workflow's own semantics

- **W1.** `permissions: contents: read` at `:12-13`, above `jobs:`. `release`'s `contents: write`
  at `:82-83` is a job-level **replacement**, not a merge, so it is neither redundant nor
  conflicting: `build` gets read, `release` gets write and nothing else. `actions/download-artifact@v4`
  needs no `actions: read` for same-run artifacts (it uses the runtime token), so the narrow grant
  is sufficient as well as minimal.
- **W2.** `git ls-remote --tags https://github.com/softprops/action-gh-release.git` returns
  `3bb12739c298aeb8a4eeaf626c5b8d85266b0e65  refs/tags/v2.6.2` — the pin at `:102` is a real 40-char
  commit SHA, and the `# v2.6.2` comment is accurate (that SHA is also what `v2` points at today,
  which is exactly the mutability the pin defends against).
- **W6.** `sort -k2` sorts on field 2 to end of line, i.e. the filename; demonstrated in §5.1's
  output (`-Setup.exe`, `-arm64.dmg`, `-x64.dmg`, `.AppImage`). The `checksums-*.txt` glob cannot
  match the `checksums.txt` being written, so the `rm` that follows is safe.

### 5.5 W4, W5 — the record and the missing test

- **W4.** `spike.md:342` adds a fourth table row naming the `grep -c` result (**4**, "not closeable
  here"), and `:344-350`'s closing paragraph lists the pending markers alongside the other three open
  items. The claim that `artifactName` now "guarantees the table's four rows name files that build
  will actually produce" is true, per §5.2.
- **W5.** `diagnostic-rows.test.ts:67-85` asserts `fatal` for an ok check (`sqlcipher` → `false`), a
  non-fatal failure (`keychain` → `false`), a fatal failure (`node` → `true`) **and** the tool-Node
  row (`false` regardless of `ok`, which is D-W's rule and the one case a future refactor is most
  likely to get wrong). It matches `diagnostic-rows.ts:61-63`'s `!check.ok && check.fatal === true`
  and `:95`'s hardcoded `fatal: false`. Green. Slice 10's carried finding is closed on the last slice
  rather than a fourth time deferred.

### 5.6 Re-checks of what the first pass had already cleared

`python3 -c "import yaml; yaml.safe_load(...)"` parses both YAML files after the edits.
`working-directory: desktop/release` is workspace-relative and therefore correct despite
`defaults.run.working-directory: desktop` (a step-level value replaces the default, it does not
compose). `needs: build` gates all three matrix legs — a job with `needs` and an `if` that uses no
status function still carries the implicit `success()`, so one failing leg skips `release` entirely,
which is what the `:75` comment claims. Upload/download globs, `merge-multiple: true`, flat filenames
with no cross-OS collision, `if-no-files-found: error`, tag-only gating, and the untouched `ci.yml`
all still hold. Nothing broke while the two Criticals were fixed.

Also re-run at the exit gate: root `typecheck` / `lint` (288 files) / `test` (301) / `build`;
desktop `typecheck` / `test` (626) / `build` (electron-vite, 72 modules); Biome over
`desktop/src` (120 files, clean).

---

## 6. The human gates that remain — read this before tagging a release

None of these blocks the merge. All of them block *announcing a release*, and none can be closed by
an agent in this environment. `plan.md`'s Slice-13 Done-when instructs precisely this: write down
what is unanswerable here rather than report it as done. `spike.md:333-350` does.

| Gate | Who/what closes it |
|---|---|
| Cross-OS packaging; native modules load in the **packaged** app (`refined.md:1852-1853`) | Push a `v*` tag → `desktop.yml`'s three legs, or a developer machine with unrestricted egress. A leg whose rebuild fails **does not ship**, and swapping the library is forbidden (§8.1) — that is an escalation. |
| The four `pending — filled by Slice 13's tagged build` markers in `docs/gui.md:22-25` | Copy the digests from that run's `checksums.txt` into the table **before publishing the draft release**. The draft-release design makes this sequencing natural: build → draft → fill the table → publish. |
| Zero-network walkthrough against the packaged artifact, **in both languages** (`refined.md:1832-1835`) | One walkthrough per language on real hardware, recorded in `spike.md`. |
| macOS keychain-ACL answer with the exact OS version, for both the CLI entry and the `doctor-probe` (D-H, `refined.md:1662-1664`) | Oscar, on a real macOS desktop session. Declared a HUMAN GATE by `plan.md:1225-1232` since Slice 1. |
| Per-client `env`-honouring answer for `claude-code` / `claude-desktop` / `cursor` (D-R(a), `refined.md:1760-1762`) | The three real client apps. |
| Bilingual golden-fixture screenshots (`refined.md:1838-1839`) | Same rebuild blocker; item 96's own human-gate clause. |
| Run-from-source path verified rather than assumed (`refined.md:1854-1856`) | A machine that can complete the native rebuild. |

Two of those (`docs/gui.md`'s markers, the run-from-source verification) are the ones most likely to
be forgotten, because they look like documentation rather than gates. They are gates.

---

## 7. Why this is a PASS and not a hedge

The first pass failed this slice on two mechanical defects: a checksum command that would have made
the macOS leg fail and, through `needs: build`, prevented any release from ever publishing on any OS;
and unset `artifactName`s that would have produced two files `docs/gui.md`'s table does not name.
Both were real, both were code, and both are now fixed — verified by executing the pipeline and by
reading electron-builder's own resolution logic, not by trusting the commit message. The six
warnings are fixed too, including the two that had been carried across slices (W4's honesty gap and
W5's untested `fatal` field), and the suites are green at 301 and 626.

What is left is not code. It is a tagged build on three real operating systems and a person in front
of a macOS login prompt — the human gates this plan named at Gate P and has carried openly since
Slice 1, now written down in one place. Merging this branch is the correct next action; publishing a
release is a separate, later one that §6 spells out.

**The 13-slice GUI advance is complete and merge-ready.**
