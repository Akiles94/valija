# MOBILE — review

Verdict: FAIL

Reviewed: `docs/mobile-poc-MOBILE` @ `70fbcf8` against `main` (`git diff main...HEAD`), including
the closure commit that landed mid-review (the working-tree edits described to me were committed
as `70fbcf8`; content identical to what I reviewed). Working tree clean at time of writing.

**Line count:** 8 files changed, 483 insertions(+), 9 deletions(-). No `src/` line, no
`package.json`, no build config, no `.github/`.

This is close. Nothing here breaches a security gate, the closure decision itself is recorded
honestly, and four of the five new `docs/vault-format.md` rules verify exactly against `src/`.
It fails on four things: one factually wrong sentence in the newly-shipped contract, an evidence
set that is still missing artifacts the *CI* (not a phone) was supposed to produce, four stray
"PENDING"/"remains open" leftovers that contradict the closure, and an amendment in `refined.md`
whose own wording overclaims what the CI evidence covers.

---

## 1. Acceptance criteria (`refined.md` §9)

### Applies under every option

| # | Criterion | Status | Evidence |
|---|---|---|---|
| A1 | No `src/`, `package.json`, `tsup.config.ts`, `tsconfig*.json`, `ci.yml` in the diff | **MET** | `git diff main...HEAD --name-only` → `CHANGELOG.md`, `advances/MOBILE/{plan,poc,refined}.md`, `advances/MOBILE/evidence/{sqlite3c-sha256,toolchain-versions}.txt`, `docs/SPEC.md`, `docs/vault-format.md`. Filtered diff over `src/ package.json tsup.config.ts tsconfig*.json .github/` is empty. |
| A2 | No change to format, crypto, KDF params, key format, SQLCipher config, `vault.json` schema | **MET** | Only doc prose changed in `docs/vault-format.md`; §§4–6 crypto text untouched by the diff. |
| A3 | MCP surface byte-for-byte unchanged | **MET** | `git diff main...HEAD -- src/delivery/mcp/` → 0 lines. |
| A4 | No network/telemetry/analytics/cloud SDK in any app artifact | **UNCLEAR → not met** | Asserted in `poc.md:53` ("APK declares zero permissions … `aapt2 dump badging`") but the artifact the plan tied it to, `evidence/android-permissions.txt` (plan step 49, plan §4 mapping row), was never committed. Nothing at all is recorded for the iOS binary's `Info.plist`/entitlements, which §9 asks for ("both binaries"). Not verifiable from this repo. |
| A5 | `typecheck && lint && test` pass unchanged; CI matrix not slowed or gated | **MET** | Ran all three: `tsc --noEmit` clean; biome "Checked 146 files… No fixes applied" (1 pre-existing config-migration info); vitest **48 files / 241 tests passed**. No workflow file touched. |
| A6 | Every value from the golden fixture; no real vault/passphrase/key/content anywhere | **MET** | `poc.md:159`; both committed logs contain only fixture-derived output; no key material in any diffed line. |
| A7 | `poc.md` gives PASS / FAIL / NOT ATTEMPTED per §3 question, **with the hardware, OS version, and toolchain version that produced it** | **NOT MET** | Every G row exists (`poc.md:41–57`), but the CI rows carry no OS or toolchain version: no iOS version or simulator device model, no Android API level, no NDK version, no Xcode version — only "GitHub Actions `macos-latest`/`ubuntu-latest`". `evidence/toolchain-versions.txt` covers the Linux sandbox plus *declared* Gradle versions and contains neither NDK nor Xcode, though `plan.md` §9 specifies it as "Kotlin, AGP, Compose, **NDK, Xcode**, Gradle". Separately, the vocabulary is `NOT COLLECTED`, not §9's `NOT ATTEMPTED` (see S4). |
| A8 | `poc.md` has an explicit claim-scoping section; no claim broader than its evidence | **PARTIALLY MET → not met** | §3 (`poc.md:129–159`) is genuinely excellent and covers every item plan step 48 enumerated. But §3a's heading and lead (`poc.md:61`, `:77`) now contradict §2, and `refined.md`'s new amendment overclaims (C4). |
| A9 | No sentence describes a macOS/Linux/x86_64 run as iOS/arm64 | **MET in prose; breached in a committed artifact** | `poc.md` and `docs/vault-format.md` are scrupulous. But `evidence/linux-fullstack-interop.log` ships a test named "argon2id **on device-equivalent hardware** derives the published key" for a Linux x86_64 sandbox run — the exact loose framing §2 elsewhere refuses (W2). |

### The app itself

| # | Criterion | Status | Evidence |
|---|---|---|---|
| B1 | Single-screen app per platform, shared Kotlin core, amalgamation behind one port | **UNCLEAR** | Code lives in `akiles94/valija-mobile` per P-3 (legitimate), but nothing in this repo evidences the module boundary, and I could not reach the remote (`api.github.com/repos/akiles94/valija-mobile` → HTTP 403 from this environment). Unverifiable ≠ met. |
| B2 | Sandbox copy; bundled bytes unchanged; no `-wal`/`-shm`/`-journal` | **MET (for the Linux path)** | `poc.md:48` row PASS; `evidence/linux-fullstack-interop.log` shows the read-only run. Not verifiable for the emulator/simulator runs (no logs committed). |
| B3 | No journal pragma, migration, lineage write, device identity in the PoC source | **UNCLEAR** | Plan step 45 required the greps' empty output pasted into `poc.md`. Not present anywhere in `poc.md`. |
| B4 | Derived key never written to keychain/keystore/prefs/file/log | **UNCLEAR** | Same: asserted nowhere in `poc.md`, unverifiable from this repo. The two committed logs do print timings only, never key bytes — consistent, but that is not the whole surface. |
| B5 | Zero network requests, verified by source and declared capabilities of both binaries | **NOT MET** | See A4. Android side asserted without the artifact; iOS side not addressed at all. |

### Execution evidence (G1, G2, G3, G6)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| C1 | Screenshot from a **booted iOS simulator** showing the result screen, committed under `advances/MOBILE/evidence/`, model + iOS version recorded | **NOT MET** | `advances/MOBILE/evidence/` holds four files: `jvm-conformance.log`, `linux-fullstack-interop.log`, `sqlite3c-sha256.txt`, `toolchain-versions.txt`. `poc.md:316` still says `ci-ios-simulator.png` is **PENDING**. Not device-gated — the iOS CI job is green. |
| C2 | Screenshot from a **booted Android emulator or device**, API level + system-image ABI + host runner recorded | **NOT MET** | Same; `ci-android-emulator.png` absent, still marked PENDING. |
| C3 | Kotlin→C interop exercised per platform through its own mechanism, both recorded in `poc.md` | **MET (as recorded)** | `poc.md:51–52` — `:vault-interop:connectedAndroidTest` (JNI/NDK) and `:vault-interop:iosSimulatorArm64Test` (cinterop), each scoped to emulator/simulator. Backed only by CI links, not by committed logs. |
| C4 | Run logs, including exit codes, committed alongside the screenshots | **NOT MET** | No Android or iOS run log is committed; no exit code appears anywhere in `advances/MOBILE/evidence/`. |
| C5 | Android result states arm64 vs x86_64 plainly; x86_64 ⇒ G2 recorded still open | **MET** | `poc.md:49`, `:51`, `:143–144` say x86_64 emulator loudly, and `docs/vault-format.md:545` repeats "**not** the arm64 evidence". G2 is not claimed closed. |

*The Slice 9 closure legitimately removes the **physical-device** rows. It does not touch C1, C2 or
C4, which name a simulator/emulator screenshot and its logs — artifacts `plan.md` step 49 assigned
to **Slice 8**, and which the now-green CI can produce. `plan.md`'s own amendment says the closure
"does not reopen or invalidate P-1..P-12; it supersedes P-6's device-run outcome specifically", so
P-5's Decided Option 3 (screenshot **and** exit code **and** disclosure) remains binding — and the
screenshot half is currently unmet on every target, including the ones that ran.*

### Conformance (G4, G7)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| D1 | JVM byte-compare of the Kotlin pack against `expected-export.md`, passing | **MET** | `evidence/jvm-conformance.log`, 10/10 PASSED, both byte comparisons. Sizes verified independently: `expected-export.md` = 1887 B, `expected-pack.md` = 967 B — exactly the numbers `poc.md:43` claims. |
| D2 | The same comparison runs on device, shown on screen and in the exit status | **PARTIALLY MET → not met** | Exit-status half: `poc.md:51–52` (emulator/simulator test tasks). "Displayed on screen": no screenshot exists on any target (C1/C2), so this is unevidenced. |
| D3 | Byte comparison, not snapshot/normalised; `·` and `café ☕` intact | **MET** | `evidence/linux-fullstack-interop.log` reports exact byte counts matching the fixtures. |
| D4 | `estimateTokens` counts UTF-16 code units, asserted by a test | **MET** | `evidence/jvm-conformance.log`: "estimateTokens counts UTF-16 code units, not grapheme clusters() PASSED"; documented at `docs/vault-format.md:309–317`. |

### Argon2id (G5)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| E1 | Key derived on device equals `manifest.keyHex`, asserted in code | **N/A by amendment (device) / MET off-device** | `evidence/linux-fullstack-interop.log` asserts it through the real interop path. |
| E2 | Derivation time reported in `poc.md`, labelled with hardware, marked as **not** a physical-device measurement where true | **MET** | `poc.md:46` "155–178 ms — *desktop-class silicon; not a phone measurement*"; `poc.md:57` NOT COLLECTED for phone hardware; `docs/vault-format.md:541`. This is the closure's best-handled row. |

### Contract and roadmap

| # | Criterion | Status | Evidence |
|---|---|---|---|
| F1 | Every `docs/vault-format.md` defect fixed or recorded with location + correct behaviour; W5 and W6 addressed | **NOT MET** | Five defects fixed (`poc.md:216–234`) and W7 recorded-not-fixed with a reason (`poc.md:236–238`) — but one of the *replacement* rules is itself wrong: `docs/vault-format.md:333–334` (C1 below). W5 and W6 are both addressed. |
| F2 | §13's table gains rows for what actually executed, with the same scoping precision | **NOT MET** | The new table (`docs/vault-format.md:536–547`) is precise and correct. Its lead-in paragraph is not: line 516 still reads "A literal iOS device/simulator run (Tier C) **remains open**", contradicted by the simulator PASS row eleven lines below. `plan.md` step 55 explicitly required updating this stale statement. |
| F3 | `docs/SPEC.md` §2 Out line and §10b pointer corrected or confirmed | **MET, but now overclaiming** | Both corrected (`docs/SPEC.md:31`, `:232–236`); the `advances/M4/idea.md` pointer is refreshed to `advances/MOBILE/poc.md`. Wording no longer fits the closure — see W3. `poc.md` never mentions `docs/SPEC.md`, so a `poc.md`-only reader cannot check this. |
| F4 | Kept tree: location stated, non-authoritative scaffolding declared | **MET** | `poc.md:9–11`, `:356–357`. |
| F5 | Amalgamation version, SHA-256, compile flags recorded; licence satisfied; no unauthorised CI or dependency | **MET** | `poc.md:242–258`; `evidence/sqlite3c-sha256.txt`; zero CI or dependency added here (A1, A5). |

**Score: 14 met, 11 not met/unclear.**

---

## 2. Plan compliance

Slices 1–8 and 10 are evidenced; Slice 9 is skipped by a recorded Oscar decision — legitimate, and
the right call to record rather than fake. Deviations that are **not** covered by that decision:

- **Step 49** — `evidence/` is missing `ci-ios-simulator.png`, `ci-android-emulator.png`, their
  `.log`s, and `android-permissions.txt`. All four are CI artifacts, unaffected by Slice 9.
- **Step 55** — "§13's stale row" was fixed; the stale *lead-in* ("a literal iOS run remains open")
  was not.
- **Step 57** — `CHANGELOG.md` `[Unreleased]` records only the vault-format corrections; the plan
  asked for "the corrected vault-format contract **and the mobile PoC evidence**". Verified as
  requested: it is accurate as far as it goes, and says nothing that the closure contradicts — but
  it also says nothing about the PoC or its disposition.
- **Step 58** — none of the three gate outputs were pasted into `poc.md`. I ran them myself and they
  all hold (see A1/A3/A5), so the underlying criteria pass; only the record is missing.
- **Steps 45 / §4 mapping** — the "no journal pragma / no keychain API / zero permissions" greps
  were to be pasted into `poc.md` with empty output. They are not there (B3, B4, A4).

---

## 3. Hard gates

| Gate | Result |
|---|---|
| Security surface weakened (secrets/keys logged, plaintext to disk, KDF/keychain altered, SQLCipher unkeyed, MCP over-exposed) | **PASS** — zero `src/` change; MCP diff empty; `docs/vault-format.md` §§4–6 untouched; no key material in any diffed line or committed log; only published fixture values appear. |
| Tests present for new behaviour; suite passing | **PASS** — no behaviour changed; 48 files / 241 tests green, typecheck and lint clean. |
| Advance ritual evidenced | **PASS** — `refined.md:3` `Approved: Oscar 2026-07-31`; `plan.md:3` `Approved: Oscar 2026-08-01`; this `review.md`. Both amendments are dated and attributed. |
| Naming, placement, clean-architecture conventions | **PASS, N/A in substance** — docs-only advance; no layer-root file, no new module, no adapter. Evidence filenames obey plan D-10's honesty rule (`linux-fullstack-interop.log` names its host; no file name claims a device). |

**No hard gate is breached.** The FAIL is on acceptance criteria and document accuracy.

---

## 4. Issues

### Critical

**C1 — `docs/vault-format.md:333–334` ships a new, factually wrong contract rule.**
The advance's headline claim is that a second implementation corrected five defects in this
document. One of the corrections is itself a defect:

> - **Pinned:** `estimateTokens("Pinned")` is added **unconditionally, before any pinned item
>   is considered** — it is charged even if the section ends up empty.

`src/context/domain/services/context-pack.ts` does the opposite of the second clause:

```ts
function addPinned(draft: Draft, items: readonly ContextItem[]): void {
  const pinned = items.filter((item) => item.pinned);
  if (pinned.length === 0) return;              // <- label NOT charged, no section pushed
  draft.usedTokens += estimateTokens("Pinned");
  ...
  if (kept.length > 0 && draft.usedTokens + cost > draft.budget) break;   // first item always kept
```

Two things are wrong. The label is charged only when the project has **at least one** pinned item;
and the section can never "end up empty", because the first pinned item is always kept regardless of
budget. A second implementation following this sentence literally charges 2 tokens
(`ceil(len("Pinned")/4)`) on every pack for a project with **no pinned items** — a very common case,
and a reachable byte/budget divergence that the golden fixture (whose `alpha` project *has* pinned
items) cannot catch. That is precisely the silent-divergence failure mode the same section warns
about elsewhere.
*Fix:* "`estimateTokens("Pinned")` is charged once, before the item loop, whenever the project has
at least one pinned item — unlike the by-type sections, it is not conditional on the first item
fitting, because the newest pinned item is always included. If there are no pinned items at all,
nothing is charged and no Pinned section is emitted."
*(For the record: the other four rules — the concatenation rule at `:402–421`, latest-handoff =
newest handoff **not already placed in Pinned** at `:350–354`, the by-type lowercase wire name
folded into the first candidate's test at `:338–341`, UTF-16 `String.length`, and
`Date.toISOString()`'s fixed three fractional digits — I verified line by line against
`context-pack.ts` and `context-pack-markdown.ts`. All four are exactly right.)*

**C2 — The evidence set is missing the CI-level artifacts, which the Slice 9 closure does not
excuse.** `advances/MOBILE/evidence/` contains four files and no screenshot of the app on any
target. `refined.md` §9 requires a booted-**simulator** screenshot, a booted-**emulator or device**
screenshot, and the run logs with exit codes, committed here (C1/C2/C4 above). P-5's Decided
Option 3 is screenshot **and** exit code **and** disclosure; only the exit-code half exists, and it
exists only as links to an external repo I could not reach (HTTP 403) whose Actions logs GitHub
retains for 90 days by default and which `poc.md:356` declares unmaintained. An evidence-only
advance whose evidence expires is not closed.
*Fix (either is acceptable, the first is better):* pull `ci-ios-simulator.png`,
`ci-android-emulator.png`, the two job logs (with exit codes) and `android-permissions.txt` from
run #11 and commit them under `advances/MOBILE/evidence/`; **or**, if they genuinely cannot be
retrieved, say so explicitly in `poc.md` §8 and §10, mark P-5's screenshot half `NOT COLLECTED` on
every target with the reason, and stop describing them as "PENDING".

**C3 — Four stray leftovers contradict the closure.** In a document whose value is claim precision,
each of these is a reader hitting a live contradiction:
- `poc.md:39` — "Rows a device must produce say `PENDING`." The word `PENDING` no longer appears in
  that table. The legend instructs the reader to look for a token that is not there.
  → "Rows only a device could have produced say `NOT COLLECTED` — see §10."
- `poc.md:316` — `evidence/ci-android-emulator.png, ci-ios-simulator.png` | **PENDING** — CI
  artifacts. See C2; either commit them or state their disposition.
- `docs/vault-format.md:516` — "A literal iOS device/simulator run (Tier C) **remains open**, but is
  now lower priority". False since the CI simulator run, and contradicted by the PASS row at
  `:545`. `plan.md` step 55 required this exact update.
  → "A literal iOS **simulator** run has since happened (second table below); a physical-device run
  never did and, per `advances/MOBILE/poc.md` §10, is not planned."
- `poc.md:61` + `:77` — the heading "CI status — **red, and honestly so**" and "**G3a and G3b are
  open**, and the rows in §2 say so". §2 now records both PASS. The "Update — now green" paragraph
  at `:84` resolves the chronology, but a reader meeting `:61`/`:77` first reads a flat
  contradiction of §2. → retitle "§3a. CI status — first run red, then green", and put the first
  half in past tense under a "First run (superseded)" sub-heading.

**C4 — The `refined.md` amendment overclaims, and disagrees with `poc.md` about the same three
gaps.** `refined.md:470–471` states: "G1/G2/G6 rest on the CI-level simulator/emulator evidence in
`poc.md` §2 and §3a." But `poc.md:54–56` marks G1, G2 and G6 `NOT COLLECTED`, and `poc.md:143–144`
states outright that the Android CI job "is *not* the arm64 evidence for G2". Both statements ship
in the same commit. On the substance:
- **G2** genuinely cannot rest on CI: the emulator is x86_64, and G2 asks about arm64. Saying it
  "rests on" the CI evidence is the exact substitution M4's C3 finding was about.
- **G6** rests on nothing today: no app screenshot exists on any target (C2).
- **G1**, conversely, is *under*claimed. `poc.md:26–27` defines G1 as "Has any valija-related binary
  ever executed on iOS?" — answered **yes** by the iOS-simulator row at `:52`. §2 then silently
  redefines G1 as "App executes on a physical iPhone" and marks it NOT COLLECTED, so the document
  answers G1 as stated and records it uncollected on the same page. (G5 is handled correctly, and
  G3/G4/G7 are correctly *not* dragged down by the closure — `poc.md:344–350` gets that right.)
*Fix:* in `refined.md`'s amendment, replace "G1/G2/G6 rest on the CI-level evidence" with a
per-gap statement: G1's "did anything ever run on iOS" half is answered by the simulator, its
physical-device half is not; **G2 remains unanswered — the emulator is x86_64**; G6's app-process
half is unanswered on every target; G5 stays a desktop/CI-class measurement. Then split §2's rows
to match (e.g. "G1 (physical-device half)"), so no row's label contradicts §1's definition.

### Warning

**W1 — Hardware/OS/toolchain missing for every CI row** (A7). Add the iOS version and simulator
device model, the Android API level and system image, the NDK version and the Xcode version to
`evidence/toolchain-versions.txt` (its own §"Declared for the CI and device builds" is *declared*,
not observed) and to §2's "Where it ran" column. All of it is in the run #11 logs.

**W2 — A committed artifact calls the Linux sandbox "device-equivalent hardware".**
`evidence/linux-fullstack-interop.log`: `argon2id on device-equivalent hardware derives the
published key()`. That contradicts `poc.md:46`'s careful "desktop-class silicon; not a phone
measurement" and lands in exactly the register A9 forbids. The test name lives in the unmaintained
external repo, so the practical fix is a one-line note in `poc.md` §8 disowning the phrase.

**W3 — `docs/SPEC.md` now overclaims after the closure.** §10b (`:232–233`): "Mobile is unscheduled
but its **feasibility is no longer open**". Feasibility on real phones is now permanently
uncollected, and on-phone Argon2id cost (G5, 64 MiB) is a genuine open feasibility question for a
phone app. §2 (`:31`): "a two-platform proof of concept validated the vault format and the
toolchain", with the scoping only behind a pointer — this project's own standard is disclosure at
the point of the claim, not in a footnote.
*Fix:* §2 → "… validated the vault format and both mobile toolchains at simulator/emulator level;
nothing ever ran on a physical phone (see `advances/MOBILE/poc.md`)". §10b → "the format and both
toolchains are answered at CI level; physical-device behaviour and on-phone Argon2id cost were
never measured (`advances/MOBILE/poc.md` §10)".

**W4 — The amendment is placed where a P-6(a) reader will miss it.** `refined.md`'s amendment sits
after sub-decision **(b)**'s Decided line, but supersedes both. Anyone scanning P-6(a) reads
"**Decided: Option 4** — Oscar's own Android phone" with no marker. Move it directly under the
`### P-6. Real-hardware coverage` heading, or add a one-line "superseded — see the amendment at the
end of P-6" under (a). Also: `plan.md` got a top-of-file amendment; `refined.md`'s header Status
block (`:5–17`, "All twelve `P-n` decisions … are recorded") did not, and `refined.md` §1's Goal
("prove it actually ran on Apple and Android hardware targets … becomes an observed fact"), §9's
execution-evidence block and §10's deliverables all still describe device runs with no marker.
Otherwise the amendments *are* procedurally sound: dated, attributed to Oscar, additive, and they
override the Decided lines without deleting them — which is the right idiom for this file.

**W5 — `CHANGELOG.md` omits the PoC.** Plan step 57 asked for both halves. What is there is
accurate and consistent with the closure (verified as requested); it just never mentions
`advances/MOBILE/` at all, so the disposition is invisible to a changelog reader.

### Suggestion

- **S1** — `poc.md` §3a is numbered between §2 and §3. Renumber (claim scoping → §3, CI status →
  §4) or drop the "a"; §-references elsewhere in the file already have to work around it.
- **S2** — `poc.md:132`: "It is written **before** the device runs, so it cannot be shaped to fit a
  nice result." There are no device runs now; the sentence's guarantee is moot. → "written while the
  device runs were still expected, so it could not be shaped to fit a result."
- **S3** — `poc.md:45` and `:51` both label rows "G3a" at very different strengths (Linux JNI vs.
  Android emulator). Label the first "G3a (partial — same bridge, not the NDK)" so a quoted row
  cannot be mistaken for the emulator result.
- **S4** — `refined.md` §9 fixes the vocabulary as **PASS / FAIL / NOT ATTEMPTED**; `poc.md` uses
  `NOT COLLECTED` (and `NO` for G7). `NOT COLLECTED` reads better here, but add one line under §2's
  table mapping it to §9's `NOT ATTEMPTED` so the criterion is checkable literally.
- **S5** — §7's runbook headings still read as live instructions ("closes G2, G6"). §10 says the
  runbook is valid and unexecuted, but §7 is the part that gets copy-pasted; a one-line banner at
  the top of §7 would travel with it.

---

## 5. What would flip this to PASS

1. Fix `docs/vault-format.md:333–334` per **C1**.
2. Commit the CI screenshots, the two job logs with exit codes, and `android-permissions.txt` under
   `advances/MOBILE/evidence/` — or record their non-collection explicitly and stop calling them
   PENDING (**C2**).
3. Clear the four leftovers in **C3** (`poc.md:39`, `poc.md:316`, `docs/vault-format.md:516`,
   `poc.md:61`/`:77`).
4. Make `refined.md`'s amendment and `poc.md` §2 agree per-gap, with G2 stated as unanswered and
   G1's simulator half credited (**C4**).
5. Add the CI rows' OS/toolchain versions (**W1**) and soften `docs/SPEC.md` §2/§10b to match the
   evidence (**W3**).

W2, W4, W5 and all S-items are strongly recommended but would not, alone, hold the merge.

**Credit where it is due:** the closure is recorded, not hidden; §10 is the right document to have
written; G3/G4/G7 are correctly held as established rather than collateral damage of the device
decision; and four of the five contract corrections are exactly right against `src/`, including the
genuinely subtle "newest handoff not already placed in Pinned" and the `join("\n")` construction
rule. The gap is that the closure edits stopped at the device rows, and the CI-level half of the
evidence was never finished.
