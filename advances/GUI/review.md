Verdict: FAIL

# GUI · Slice 13 — Packaging, release, and the final gates — Review (first pass)

Commit under review: `7380a4a` on `feat/desktop-GUI`, base `dfb0298` (Slice 12, `Verdict: PASS`).
Diff: three files, `+146 −0` — `.github/workflows/desktop.yml` (+55), `advances/GUI/spike.md` (+58),
`desktop/src/main/infra/no-auto-update.test.ts` (+33, new).

**This is the last slice in the plan, so this review is also the advance's exit gate.** It does not
pass. One defect in the workflow this slice exists to write will stop the release job from ever
running, and one obligation Slice 12's PASS explicitly assigned to Slice 13 was skipped in silence.
Both fixes are small and mechanical; §7 says exactly what flips this to PASS.

The three environment-blocked checks (native modules in the packaged app, cross-OS packaging, the
zero-network walkthrough against a real artifact) are **not** why this fails. They are correctly
recorded as open in `spike.md`, in the plan's own sanctioned human-gate pattern, and I independently
reproduced the blocker (§6).

---

## 1. Acceptance criteria (`refined.md` §9, the lines this slice owns)

| # | Criterion (`refined.md`) | Verdict | Evidence |
|---|---|---|---|
| 1 | Unsigned artifacts build for macOS, Windows, Linux, **each with a published SHA-256** (`:1852`) | **NOT MET** | `.github/workflows/desktop.yml:39-51` uses `sha256sum`, which does not exist on `macos-latest` (C1). The macOS leg fails → `release` (`:66 needs: build`) never runs → no SHA-256 is published for any OS. |
| 2 | Native modules load in the packaged app on every target (`:1852-1853`) | **OPEN — sanctioned** | Not verifiable here; packaging blocked by egress policy, reproduced independently (§6). Recorded honestly at `spike.md:317`. |
| 3 | MCP surface byte-for-byte unchanged (`:1592-1593`) | **MET** | `git diff origin/main...7380a4a -- src/delivery/mcp/server.ts` → **0 lines**. Only `server.test.ts` changed (+19/−…), a fixture widened for `Container`'s Slice-4/8 shape. `spike.md:312`'s wording is accurate and does not overclaim. |
| 4 | Published npm package unchanged (`:1601-1602`) | **MET** | `git diff origin/main...7380a4a -- package.json` → **0 lines**. |
| 5 | CI matrix neither slowed nor gated by desktop packaging (`:1598-1600`) | **MET** | `git diff origin/main...7380a4a -- .github/workflows/ci.yml` → **0 lines**. All new steps carry `if: startsWith(github.ref, 'refs/tags/v')`; `release` is a separate tag-gated job. |
| 6 | Root `typecheck && lint && test && build` green, count up (`plan.md:1071-1072`) | **MET** | Ran by hand: 57 files / **301 tests** passed, `tsup` build success. |
| 7 | Desktop suite green (`plan.md:1073`) | **MET on Linux; OPEN cross-OS** | Ran by hand: 45 files / **625 tests** passed (623 + the 2 new cases). Windows/macOS legs are `desktop.yml`'s job. `spike.md:316` says exactly this. |
| 8 | `src/` changes confined to Slices 4/8's files (`plan.md:1066`) | **MET** | 31 `src/` files, all in the Slice-4 (`container.ts`, `installer.ts`, `context-pack-export.ts`, `diagnostics.ts`, `migrations.ts`, `sqlite.ts`, `doctor.ts`, `content-commands.ts`, `vault-commands.ts`) and Slice-8 (vault relocation + upgrade gate) sets. See S6 for one nuance. |
| 9 | No `publish`/auto-update configuration of any kind (`plan.md:1051-1052`, `:1058-1061`) | **PARTIALLY MET** | `no-auto-update.test.ts` exists and passes; but it catches only an unquoted **top-level** `publish:` and only the literal name `electron-updater` (W3). |
| 10 | Zero network verified against the **built artifact**, both languages (`:1832-1835`, `plan.md:1074-1080`) | **OPEN — sanctioned** | No artifact exists here. `spike.md:318` records it. |
| 11 | `grep -c "pending — filled by Slice 13" docs/gui.md` returns **0** (`plan.md:1083-1084`) | **NOT MET — and not recorded as open** | Returns **4** (`docs/gui.md:22-25`). Downstream of the same packaging blocker, so not a fail on its own — but `spike.md:320-324`'s open-items list names three things and omits this one (W4). |
| 12 | Run-from-source path verified, not assumed (`:1854-1856`) | **OPEN — sanctioned** | Same rebuild blocker; §6. Slice 12's S1 asked for a named owner; still none. |
| 13 | macOS keychain-ACL answer with named OS version (`:1662-1664`, D-H) | **OPEN — sanctioned** | Human gate, unchanged from Slice 12. |
| 14 | Bilingual screenshots from the golden fixture (`:1838-1839`) | **OPEN — sanctioned** | Deferred through plan item 96's own human-gate clause; `spike.md:260-266`. |

### Plan items (`plan.md:1035-1089`)

| Item | Verdict | Evidence |
|---|---|---|
| 95 — tag job computes and publishes each artifact's SHA-256 | **NOT MET** | Structure is right; the command is not portable to one of the three legs (C1). |
| 95 — guard test, no `publish` key / no `electron-updater`-shaped dep (P-D19) | **MET, weakly** | `no-auto-update.test.ts:22-33`. Path arithmetic verified correct (§6). Coverage gaps in W3. |
| 95 — Slice 1's `electron-builder.yml` not re-derived | **MET** | `electron-builder.yml` untouched by this commit — but see C2, which needs it touched for a different reason. |
| 98 — the six runnable gate checks | **MET** (see table rows 3–8) | All six run by hand, all reproduce `spike.md`'s claims. |
| Done-when — pending markers greppd away | **NOT MET** | Row 11. |
| Done-when — anything still unanswerable written down in `spike.md` | **MOSTLY MET** | Three of four open items written down; the fourth (row 11) is not (W4). |

---

## 2. Hard gates

| Gate | Result |
|---|---|
| Security surface weakened (secrets/keys logged, plaintext to disk, KDF/keychain altered, SQLCipher unkeyed, MCP over-exposed) | **No breach.** No `src/` or `desktop/src` production code touched. `cat checksums-*.txt` prints public digests only. `contents: write` is scoped to the `release` job (`desktop.yml:69-70`) and nowhere else. `draft: true` (`:87`) is present — an unsigned build cannot go out unattended, which is §8.1's spirit. |
| Tests missing for new behaviour / suite not passing | **No breach.** Both suites green at their claimed counts (301 / 625). The new behaviour that *can* be tested in-suite is tested; CI shell logic is not unit-testable and is not expected to be. |
| Advance ritual evidenced | **No breach.** `refined.md` → `plan.md` carrying `Approved: Oscar 2026-08-25 (third revision …)` at line 3 → this `review.md`. |
| Naming, clean-architecture placement, conventions | **No breach for this slice.** `no-auto-update.test.ts` sits at `desktop/src/main/infra/` root beside `no-network-surface.test.ts` and `dependency-parity.test.ts`, both landed and reviewed-PASS in earlier slices; it uses the identical `join(import.meta.dirname, "../../../package.json")` idiom as `dependency-parity.test.ts:20`. Consistent with the established pattern. See S1 for the standing tension with `CLAUDE.md`'s "no bare files at a layer's root". |

**No hard gate is breached.** The FAIL is on acceptance criterion 1 (and the criterion-11 disclosure
gap), not on a gate.

---

## 3. Line count

| File | Added |
|---|---|
| `.github/workflows/desktop.yml` | 55 (49 config + 6 comment) |
| `desktop/src/main/infra/no-auto-update.test.ts` | 33 (new) |
| `advances/GUI/spike.md` | 58 |
| **Total** | **146, zero deleted** |

Plan estimated "≈30 lines of CI/release config" (`plan.md:1661`); actual config is 49 lines plus
6 of comment. The overrun is the `release` job, which the plan describes but did not count. Fine.

Diff scope is exactly the three files, as claimed. Nothing else touched.

---

## 4. Issues

### Critical

**C1 — `sha256sum` does not exist on `macos-latest`; the macOS leg fails and the release job never
runs.** `.github/workflows/desktop.yml:50`:

```bash
sha256sum "${artifacts[@]}" > checksums-${{ matrix.os }}.txt
```

`sha256sum` is GNU coreutils. macOS ships a BSD userland: `shasum`, `openssl dgst`, `md5` — no
`sha256sum`. The GitHub `macos-latest` runner image does not install coreutils; its utilities list
documents GNU tools individually *and by alias* when present (`GNU Tar 1.35 — available by 'gtar'
alias`, `GNU Wget`, `GNU Fortran`) and coreutils appears nowhere. Even if it were brew-installed, the
binary would be `gsha256sum`, not `sha256sum`. Linux and Windows are fine (Git Bash bundles MSYS2
coreutils), so this is macOS-only — but the blast radius is total, because `release` is
`needs: build` (`:66`) with the implicit `success()` on all three matrix legs. One failing leg means
**no release, no published checksums, on any OS** — the entire deliverable of item 95.

This is not in the environment-blocked bucket: it is statically determinable from the runner image,
which is precisely the "mistake that only surfaces on a real run" this review was asked to catch.
`spike.md:298-301` says the workflow was "verified by reading the workflow's own logic and by the
local `sha256sum` step succeeding against a hand-built file in this container" — a Linux container,
which establishes nothing about the macOS leg. The reading missed it.

**Fix (portable, output-format-identical, no new dependency):**

```yaml
          if command -v sha256sum >/dev/null 2>&1; then
            sha256sum "${artifacts[@]}" > "checksums-${{ matrix.os }}.txt"
          else
            shasum -a 256 "${artifacts[@]}" > "checksums-${{ matrix.os }}.txt"
          fi
          cat "checksums-${{ matrix.os }}.txt"
```

`shasum -a 256` emits the same `<hash>  <filename>` two-space format, so the combined
`checksums.txt` stays verifiable with `sha256sum -c` / `shasum -a 256 -c`. `shasum` is present on
macOS (Perl core), on `ubuntu-latest`, and in Git Bash, so the fallback is safe on all three.
Alternative, if you'd rather not depend on either: a `node -e` one-liner over `crypto.createHash`,
since Node 22 is already set up on every leg by `:24-28`.

**C2 — `electron-builder.yml` still sets no `artifactName`, so two of the four rows in
`docs/gui.md`'s checksum table name files that will never be produced.** This is Slice 12's **W4**,
verbatim, which that review handed to this slice: *"Slice 13 fills the checksums; it should set
`artifactName` explicitly at the same time, or the table should quote the defaults"*
(`review.md@dfb0298:140-145`). Slice 13 touched neither `electron-builder.yml` nor `docs/gui.md`, and
says nothing about the obligation.

Re-verified this pass against `desktop/electron-builder.yml` (no `artifactName` at any level):
- nsis default → `Valija Setup <version>.exe`; `docs/gui.md:24` says `Valija-<version>-Setup.exe`.
- x64 dmg default omits the arch suffix → `Valija-<version>.dmg`; `docs/gui.md:23` says
  `Valija-<version>-x64.dmg`.
- arm64 dmg and the AppImage happen to match.

The user-facing instruction is *"check it against the file you downloaded before running anything"*
(`docs/gui.md:15-17`). Half that table pointing at filenames that do not exist in the release is a
security-instruction defect, not a typo — a user who cannot match a row to a file either skips the
check or checks the wrong row. It also makes the slice's own Done-when unsatisfiable as written: you
cannot fill those rows with real digests without first changing the names.

**Fix — pin the names rather than chase the defaults**, which also makes the checksum globs and the
docs table deterministic across `electron-builder` upgrades:

```yaml
mac:
  artifactName: ${productName}-${version}-${arch}.dmg
win:
  artifactName: ${productName}-${version}-Setup.${ext}
linux:
  artifactName: ${productName}-${version}.${ext}
```

(or correct `docs/gui.md:22-25` to the defaults — either closes it, but pinning is the one that keeps
the docs true next year.)

### Warning

**W1 — no least-privilege `permissions` floor; the `build` job inherits the repository default.**
`desktop.yml` has no top-level `permissions:` block, so `build` — which runs `npm ci` and therefore
arbitrary package lifecycle scripts on three OSes — gets whatever the repo/org default is, which can
be read/write on all scopes. This slice introduces the repository's first `contents: write`
(`:69-70`), which is the moment to establish the floor. **Fix:** add above `jobs:`

```yaml
permissions:
  contents: read
```

The `release` job's own `permissions: contents: write` still overrides it correctly. Scoping of the
write itself is right; it's the absent default that's the gap. (`ci.yml` has the same omission, but
it never holds a write token — fix it there too if you like, out of scope here.)

**W2 — `softprops/action-gh-release@v2` is a third-party action pinned to a mutable tag while
holding `contents: write`.** `:80`. Every other action in this repo is first-party `actions/*`; this
is the first third-party one, and a tag can be repointed by whoever controls the upstream repo (the
`tj-actions/changed-files` compromise is the canonical example, and it was exactly this shape: a
mutable ref plus a write token). For a project whose whole premise is a local-first encrypted vault,
publishing the artifacts users are told to trust through an unpinned third-party action is the wrong
default. **Fix:** pin to the full commit SHA with the version in a trailing comment —
`uses: softprops/action-gh-release@<40-hex-sha> # v2.x.y`.

**W3 — the no-auto-update guard is narrower than the rule it stands for.**
`no-auto-update.test.ts:23-27` filters to lines matching `/^[a-zA-Z]/` and then checks
`startsWith("publish:")`. I ran the mutants: a **top-level** `publish:` is caught; a nested
`mac:\n  publish:\n    - provider: github` is **not** (it's indented, so the filter drops it); a
quoted `"publish":` is **not**. Platform-scoped `publish` is legal `electron-builder` configuration
and turns on exactly the auto-update behaviour item 95 forbids. Likewise `:31` checks the literal
string `electron-updater` only, while the plan asks for no *"`electron-updater`-shaped
dependency"* (`plan.md:1058-1059`) — `update-electron-app`, `electron-differential-updater` and
friends pass today. **Fix, still ~15 lines:**

```ts
expect(BUILDER_CONFIG).not.toMatch(/^\s*["']?publish["']?\s*:/m);
expect(Object.keys(allDeps).filter((n) => /updat(e|er)/i.test(n))).toEqual([]);
```

The first catches `publish` at any indentation and quoted; the second catches the shape, not one
name. Keep the existing two `it` blocks and their titles — the titles are good.

**W4 — `spike.md`'s open-items list omits an explicit Done-when it does not satisfy.**
`spike.md:320-324` names three open items (native modules, cross-OS packaging, zero-network
walkthrough). `docs/gui.md` still carries **4** `pending — filled by Slice 13's tagged build` markers
(`:22-25`), and `plan.md:1083-1084` makes `grep -c … == 0` a first-class Done-when condition, tracked
since the third revision as P-D16. It is obviously downstream of the same blocker, which is why this
is a Warning and not a Critical — but `spike.md`'s stated standard is *"anything still unanswerable
in the implementation environment is written down as still open … rather than reported as done"*
(`plan.md:1087-1089`), and this one is written down nowhere. Silence here is how P-D16's whole
straddle mechanism gets forgotten. **Fix:** a fourth bullet, and a fourth table row — *"`docs/gui.md`
checksum table: 4 `pending` markers remain; they can only be filled from the tagged build (P-D16),
together with the `artifactName` correction C2 requires."*

**W5 — Slice 12's W5 is now a fourth silent deferral, in the slice that was named as its deadline.**
`review.md@dfb0298:147-152`: *"Slice 13 must either land these or Oscar must drop them explicitly; a
fourth silent deferral is how they disappear."* Re-verified: `refined.md` is untouched by `7380a4a`,
and `diagnostic-rows.test.ts` still asserts the three status labels without ever asserting
`row.fatal` — the boolean `specs/desktop.md:98-101` and the stylesheet both lean on. This is a real
(small) test-coverage hole in shipped renderer state, and this is the last slice. It does not by
itself flip the verdict — it is not a Slice-13 acceptance criterion — but since the FAIL already
requires another commit, land it or get it dropped on the record in that commit rather than letting
the advance close over it.

**W6 — the combined `checksums.txt` is sorted by digest, not by filename.** `:78`,
`cat … | sort`. `sha256sum` output is `<hash>  <name>`, so a plain `sort` orders by hash — i.e.
pseudo-randomly, and differently on every release. The file users read to find their artifact should
be stable and scannable. **Fix:** `sort -k2` (sorts on the filename field, keeps the format intact).

### Suggestion

**S1 — three guard tests now sit bare at `desktop/src/main/infra/`.** `no-network-surface.test.ts`,
`dependency-parity.test.ts` and now `no-auto-update.test.ts` are not tech-named infra adapters; they
are repo-invariant guards that happen to live in `infra/`. `CLAUDE.md`'s Conventions say a new *kind*
of thing gets its own named subfolder. A `desktop/src/main/infra/guards/` folder holding all three
would make opening `infra/` tell you what's in it. **Not held against this slice** — the pattern was
set two slices ago and passed review twice; moving the other two is a separate, mechanical change.
Noted so the third one doesn't silently become the precedent for a fourth.

**S2 — the `release` job publishes checksums it never verifies.** A single step before
`Publish GitHub release` would prove the downloaded artifacts still match the digests computed on the
build runners, and would have caught C1's format divergence too:

```yaml
      - name: Verify checksums
        working-directory: release-artifacts
        run: sha256sum -c checksums.txt
```

Cheap, runs on `ubuntu-latest` where `sha256sum` exists, and turns "we computed a hash somewhere"
into "the bytes we are attaching hash to this".

**S3 — the `Checksum artifacts` step's error message duplicates its own directory.**
`:47` echoes `"::error::no packaged artifact found in desktop/release"` from a step whose
`working-directory` is already `desktop/release`. Harmless, but `${{ matrix.os }}` in the message
would be worth more than the path, since the message's whole job is telling you *which leg* produced
nothing.

**S4 — `checksums-${{ matrix.os }}.txt` is unquoted at `:50`.** No current matrix value contains a
space or a glob character, so it is safe today; quoting it costs nothing and makes it safe if the
matrix ever grows a value like `macos-latest-large` (fine) or anything odder (not). Folded into C1's
fix above.

**S5 — the `release` job has no explicit `timeout-minutes` and no `concurrency` group.** Two tags
pushed in quick succession would race two release jobs against the same tag. `concurrency:
group: release-${{ github.ref }}` is one line. Low likelihood, trivial guard.

**S6 — `spike.md:311` gestures where item 98 asks it to enumerate.** *"every changed `src/` path is
one `context-pack-export.ts`/`diagnostics.ts`/the vault-relocation-and-upgrade-gate set names"* is
true — I checked all 31 paths — but `src/vault/application/services/resolve-unlock-key.ts` is a new
file that appears nowhere in `plan.md` by name (it's the shared key-resolution extraction that
`check-vault-upgrade.use-case.ts` needed, landed and reviewed in Slice 4). Since item 98's output is
*"pasted into the PR description"*, the row should carry the actual `--name-only` list rather than a
summary, so the reader can check it instead of trusting it. Substance is correct; presentation isn't
what the item asked for.

---

## 5. What I verified by hand

- `git show 7380a4a --stat` — exactly three files, `+146 −0`. No fourth file, no `src/` touched.
- **Root suite:** `npm run typecheck && npm run lint && npm test && npm run build` → clean, 57 files /
  **301 tests** passed, `tsup` build success. Matches `spike.md:315`.
- **Desktop suite:** `npm run typecheck && npm run lint && npm test` → clean, 45 files /
  **625 tests** passed. 623 + 2 = 625, exactly as claimed at `spike.md:304`.
- **YAML parse:** `python3 -c "import yaml; yaml.safe_load(...)"` on `desktop.yml` — parses; two jobs,
  `build` and `release`; step and job structure sound.
- **Workflow semantics, read for real-run mistakes:** step-level `working-directory: desktop/release`
  (`:42`) is workspace-relative and correctly *replaces* the job default `desktop` — not appended, so
  no `desktop/desktop/release`. `upload-artifact`'s `path` globs (`:57-61`) are workspace-relative
  and correctly written as `desktop/release/*` rather than inheriting `defaults.run`, which only
  applies to `run` steps — the classic mistake, avoided. `needs: build` (`:66`) gates on **all
  three** matrix legs: a plain non-status `if:` does not displace the implicit `success()`, so a
  partial release is impossible. `if: startsWith(github.ref, 'refs/tags/v')` on the `release` job
  (`:67`) is necessary, not redundant — without it, every push to `main` would reach
  `download-artifact` with nothing to download. Artifact names are unique per leg (v4 requires it).
  `merge-multiple: true` is safe: the three legs' file sets are disjoint and the per-OS checksum
  files carry the OS in their names. `checksums.txt` does not match `checksums-*.txt`, so the
  combine step cannot eat its own output. `shopt -s nullglob` + the empty-array check (`:44-49`) is
  correct under GitHub's `bash -eo pipefail`, and `sha256sum "${artifacts[@]}"` is properly quoted
  for the space in `Valija Setup <version>.exe`. `draft: true` present. **The one thing wrong is
  C1.**
- **`no-auto-update.test.ts` path arithmetic:** resolved `join(import.meta.dirname, "../../../…")`
  from `desktop/src/main/infra/` in Node and printed the results —
  `/home/user/valija/desktop/electron-builder.yml` and `/home/user/valija/desktop/package.json`.
  Exactly right, three levels (`infra`→`main`→`src`→`desktop`), not off by one; identical to the
  already-proven idiom in `dependency-parity.test.ts:20`. Not a repeat of the earlier path bug.
- **Guard-test strength:** ran the assertion logic against three mutants of the real
  `electron-builder.yml` — top-level `publish:` **caught**; `mac:`-nested `publish:` **missed**;
  quoted `"publish":` **missed**. Basis for W3.
- **`spike.md:312`'s MCP claim, not taken on its word:**
  `git diff origin/main...7380a4a -- src/delivery/mcp/server.ts` → **0 lines**;
  `-- src/delivery/mcp/server.test.ts` → **56 lines**; `--name-only -- src/delivery/mcp/` → the test
  file only. The claim is exactly true as stated.
- **`spike.md`'s other gate rows:** `-- package.json` → 0 lines. `-- .github/workflows/ci.yml` →
  0 lines. All 31 changed `src/` paths inspected against Slice 4's item list (`plan.md:1035-1078`)
  and Slice 8's relocation set.
- **No scope creep:** `desktop/package.json` read in full — scripts are `dev`, `build`, `package`,
  `typecheck`, `test`, `test:watch`, `lint`. **No `postinstall`.** The `spike.md:281-288` claim that
  `electron-builder`'s suggested `"postinstall": "electron-builder install-app-deps"` was
  *deliberately not added* is true; nothing was quietly added while claiming otherwise. The file is
  not in the diff at all.
- **The egress blocker, reproduced independently:** ran `npm run package -- --linux` in
  `desktop/`. It fails exactly as `spike.md:272-279` describes — `electron-builder 26.15.3` →
  `executing @electron/rebuild electronVersion=43.4.1` → `preparing moduleName=argon2` →
  `RequestAbortedError: Proxy response (403) !== 200 when HTTP Tunneling` →
  `node-gyp failed to rebuild '…/node_modules/argon2'`, exit 1. The run also printed verbatim the
  `postinstall` suggestion `spike.md:282-284` quotes. **The claim is accurate at the level it
  claims** — the packaging command itself, not merely a diagnostic around it. Working tree left
  clean (`git status --porcelain` empty; `desktop/release/` is gitignored).
- `grep -c "pending — filled by Slice 13" docs/gui.md` → **4** (`:22-25`). Basis for criterion 11 and
  W4.
- `docs/gui.md:22-25` compared against `desktop/electron-builder.yml`'s (absent) `artifactName`.
  Basis for C2.
- **Ritual:** `plan.md:3` carries `Approved: Oscar 2026-08-25 (third revision — Gate P re-closed on
  the 12→13 split; second revision approved 2026-08-20)`. `refined.md` present. Trail complete.

---

## 6. On the three environment-blocked checks

I reproduced the blocker myself rather than accepting it (above). Native modules loading in the
packaged app, cross-OS packaging, and the zero-network walkthrough against a real artifact in both
languages are **structurally unverifiable in this container** and are correctly recorded as open at
`spike.md:317-324` rather than reported as done. That is the plan's sanctioned human-gate pattern
(`plan.md:1087-1089`), the same one D-H's macOS ACL answer uses, and **none of it is why this slice
fails.** The disclosure writing is honest on those three: it does not claim a tagged CI run happened,
it does not claim macOS or Windows suites ran, and `:298-301` explicitly qualifies what "verified"
means for the workflow. Its one gap is the omission in W4 — and, in hindsight, "verified working in
this environment" (`:290`) is a stronger section heading than a workflow that cannot execute here
deserves; C1 is what that overstatement cost.

---

## 7. What would flip this to PASS

Small and mechanical. In one commit:

1. **C1** — make the checksum command portable to `macos-latest` (`command -v sha256sum` with a
   `shasum -a 256` fallback, or a Node `crypto` one-liner). This is the blocker: without it the
   release job can never run, and item 95 ships zero published checksums.
2. **C2** — set `artifactName` in `desktop/electron-builder.yml` for the three targets (or correct
   `docs/gui.md:22-25` to `electron-builder`'s defaults), closing Slice 12's W4 so the checksum table
   names files that will actually exist.
3. **W4** — add the fourth open item to `spike.md`: the 4 remaining `pending` markers and P-D16's
   straddle, stated as open rather than left unmentioned.

W1, W2, W3 and W6 are one- or two-line changes I'd want in the same commit — W2 and W3 in particular,
since an unpinned third-party action holding `contents: write` and a guard that misses nested
`publish:` are both weaker than the security posture this repo argues for everywhere else — but none
of them is what I'm gating on. W5 is a call for Oscar, not for me: land it or drop it on the record.

Once C1, C2 and W4 land, every criterion in §1 is either met or a sanctioned, written-down human
gate, and I'd expect to pass this on the next read.

**The advance does not close here.** Slice 13 is the last slice in `plan.md`, so its PASS is the
advance's PASS — and this is not it yet.
