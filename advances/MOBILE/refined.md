# MOBILE — minimal real mobile app proof of concept · Refined Spec

Approved: Oscar 2026-07-31

**Status:** Gate R approved. All twelve `P-n` decisions in §7 are recorded (each carries a
**Decided:** line under its options). The one open operational point raised by P-3's outcome —
where `plan.md`/`review.md` live now that the PoC code has a separate home in `valija-mobile` — is
resolved: **Option A**, this advance's plan, review, and ship cycle stay in `valija`'s
`advances/MOBILE/`; `valija-mobile` holds only the code, via ordinary commits, no separate gate.
**Directory:** `MOBILE`, deliberately not a milestone number — per **P-4**, decided: the Out line
in `docs/SPEC.md` §2 gets corrected, but no milestone number is assigned.
**Inherits from:** `advances/M4/refined.md` (Gate R approved, Oscar 2026-07-26),
`advances/M4/spike.md`, `docs/vault-format.md`, `src/testing/__fixtures__/golden-vault/`.
**Companion repo:** [`akiles94/valija-mobile`](https://github.com/akiles94/valija-mobile), created
and seeded 2026-07-31 (P-3), holds the PoC's Kotlin/Compose Multiplatform code.
**Legend:** each decision in §7 lists the options on the table, a **Default:** line with its
reason, and now a **Decided:** line with the outcome and Oscar's own words.

---

## 1. Goal

**Build the smallest real mobile application that opens valija's golden-vault fixture and shows
something read out of it on screen, and prove it actually ran on Apple and Android hardware
targets — so that "a valija mobile app is viable" stops being an inference from C-harness
evidence and becomes an observed fact.**

That is the whole goal. This is an *evidence* advance, not a product advance. It ships no feature
to any user, changes no desktop behaviour, and is not the mobile app. Its output is a running
binary, a screenshot, a pass/fail conformance result, and a written record honest enough that a
sceptical reader can tell exactly what executed where.

Two framing facts a planner must not skip past:

1. **M4 closed the format question; it did not open the app question.** M4 proved the *file format*
   is readable by a mobile-buildable C library. It never compiled a line of Kotlin or Swift, never
   crossed an FFI boundary, never drew a pixel, and never executed anything on iOS at all.
2. **The M4 review's standard applies here in full.** `advances/M4/review.md` failed a first pass
   partly for publishing a macOS run as an iOS run (finding C3). This advance's entire value is the
   precision of its claims. "Ran on iOS" must mean iOS; "ran on arm64" must mean arm64. Every
   substitution must be disclosed at the point of the claim, not in a footnote.

---

## 2. What is already decided and is *not* re-opened here

These come from `advances/M4/refined.md`, recorded there explicitly for this follow-on. They are
input, not agenda.

| M4 ref | Decision carried forward |
|---|---|
| D-C | **Tier 1, read-only.** The PoC reads. It does not write, does not save context, does not mint a device identity. |
| D-E | **Kotlin Multiplatform** — shared Kotlin core, native UI per platform. Chosen over native-per-platform, React Native, and Flutter, with the "iOS-SQLCipher-under-KMP is the least-trodden path" trade-off accepted explicitly. *(Its **sequencing** clause is the one part genuinely in tension — see P-1.)* |
| D-F | **Reimplement the pure domain logic in Kotlin**, verified against the golden fixtures. No embedded JS runtime, no WASM. No artificial line-count cap. |
| D-G | **Vendor and build the literal `SQLite3MultipleCiphers` amalgamation** (Option 2), not the official SQLCipher package — M4 closed the official-package path as non-viable on two independent platforms, including with `legacy=4`. Argon2id: link the reference C `phc-winner-argon2`. |
| D-J | **Migration never runs on mobile — permanently.** A newer or unknown `schema_version` is refused, never migrated. |
| D-D | Tier 2 (mobile writes) remains deferred, not foreclosed. Not exercised here. |
| D-H | Real vault access is document-picker + sandbox snapshot, read-only. *(How the **PoC** gets a vault is P-9 — the picker is not automatically in scope.)* |
| D-I, D-K, D-L | Biometric session model, clipboard policy, and the separate `valija-mobile` repo are recorded for the app advance. *(P-3 decides whether this advance is where D-L's repo actually gets created.)* |

---

## 3. What this advance is actually answering

M4 left a precise set of gaps. This is the checklist the PoC exists to attack; §10's acceptance
criteria trace back to it.

| # | Open question after M4 | Status today |
|---|---|---|
| G1 | Has any valija-related binary ever executed on iOS (device or simulator)? | **No.** `spike.md` says so in as many words: the Apple evidence is macOS execution. The iOS device target link-checked clean and was never run. |
| G2 | Has the amalgamation executed on Android's real device architecture (arm64)? | **No.** Only x86_64 executed, in a real emulator. arm64 compiled clean; `qemu-user` could not run it — an emulation-harness limit, not a compatibility finding. |
| G3 | Can Kotlin call the amalgamation at all — Kotlin/Native cinterop on iOS, JNI/NDK on Android? | **Never attempted.** This is the single largest unproven thing in D-E, and the two platforms use *different* interop mechanisms, so proving one does not prove the other. |
| G4 | Does a second implementation of the pack/render algorithm produce byte-identical output? | **Never attempted.** `docs/vault-format.md` §13 still lists this as deferred; the M4 review corrected the stated reason to "no second implementation exists yet". |
| G5 | Is Argon2id at 64 MiB / t=3 / p=1 acceptable on mobile in an app process? | **Unmeasured.** M4 deferred it as "low value" because the *correctness* half is closed by B1 — but the *latency* half is a product question nobody has answered. |
| G6 | Does an actual app process — bundle, sandbox, lifecycle, UI thread — work, as opposed to a CLI binary? | **Never attempted.** M4 ran bare `main()` programs. |
| G7 | Is `docs/vault-format.md` sufficient to implement against without reading `src/`? | **Unproven, and the M4 review says probably not** — its W5 (section-label budgeting under-specified, charged three different ways in the implementation) and W6 ("latest handoff" is really "newest handoff not already pinned") are open, and both are exactly the kind of defect that only surfaces when someone actually implements against the document. |

A PoC that closes G1, G2, G3 and G6 answers "can we build this at all." One that also closes G4,
G5 and G7 answers "and do we know what it will cost." **P-1 and P-2 are the two decisions that set
which of those two answers this advance comes back with.**

---

## 4. User walkthrough

This feature has two users. The one on the phone barely exists — the app is one screen. The one who
actually consumes the output is Oscar, reading evidence to make a go/no-go call. Both are written
out, because acceptance criteria trace to both.

### 4.1 The phone user — the 20-second flow

Written for the recommended defaults (P-1 both platforms, P-2 rendered-pack conformance, P-9
bundled fixture). If Gate R changes P-2, this is the section that changes first.

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 0 | Prerequisite | None. The app ships the published golden-vault fixture inside its own bundle. No vault of their own, no cloud, no passphrase they had to invent | — |
| 1 | Launch | Taps the app icon (`valija PoC`) | A single screen, one button: **"Open the golden vault"** |
| 2 | Open | Taps it | The app copies the bundled fixture into its sandbox, derives the key from the *published* passphrase with Argon2id (P-7), and opens the copy with the raw key |
| 3 | Read | — | Two seconds later, the screen shows the rendered context pack for project `alpha` — the same markdown `valija export` produces, starting `# Context pack: alpha`, `> 9 items in vault · generated 2026-07-26T12:00:00.000Z`, then `## Pinned`, `## Latest handoff`, `## Decisions`… |
| 4 | Verify | — | Above the pack, a verdict line the reviewer actually cares about: **`CONFORMANCE: PASS — 4 320 bytes, byte-identical to expected-export.md`**, or on failure `FAIL — first difference at byte 812`, plus the Argon2id derivation time in milliseconds |
| 5 | Stop | Closes the app | Nothing persists. No key in a keychain, no plaintext file, no network request was ever made |

That is the entire app. There is no project list, no search box, no settings, no unlock screen, no
biometrics, no file picker, no copy button.

### 4.2 What the phone user explicitly does not get

- **No real vault.** The app cannot open the user's own vault — there is no picker (P-9) and no
  passphrase field. It opens one bundled, published test fixture and nothing else.
- **No writes, ever.** It opens a sandbox *copy*; the bundled resource is never touched, no
  `journal_mode` pragma runs, no migration runs, no lineage row is written (M4 D-J, `docs/vault-format.md` §11).
- **No unlock, no biometrics, no clipboard, no share sheet.** M4's D-I and D-K are recorded for the
  app advance and are not exercised here.
- **No distribution.** Nothing is submitted to the App Store or Play Store. The binary exists only
  inside a CI run.

### 4.3 The real user — Oscar, reading the evidence

This is the workflow that matters, and it is what the acceptance criteria mostly check.

```
# after the advance merges, in this repo
advances/MOBILE/poc.md                     # the runbook + results table, M4 spike.md's successor
advances/MOBILE/evidence/ios-sim.png       # the screenshot, straight off a booted simulator
advances/MOBILE/evidence/android-emu.png   # ditto, off a booted emulator
advances/MOBILE/evidence/ios-run.log       # the raw run log, exit code included
advances/MOBILE/evidence/android-run.log
```

`poc.md` opens with a table in the M4 idiom, one row per question in §3, each with **PASS / FAIL /
NOT ATTEMPTED** and — the load-bearing column — exactly what hardware and OS produced it:

| # | Question | Where it ran | Result |
|---|---|---|---|
| G1 | App executes on iOS | iOS 18 Simulator (arm64), Xcode _x_, GitHub Actions `macos-latest` | PASS — *simulator, not a physical device; see the disclosure note* |
| G3a | Kotlin/Native cinterop → amalgamation | same | PASS |
| G4 | Rendered pack byte-identical to `expected-export.md` | same | PASS |
| G5 | Argon2id 64 MiB / t=3 / p=1 | same | _n_ ms — **simulator timing, an unreliable proxy for a phone** |
| G2 | App executes on Android arm64 | (whatever P-6 decides) | … |

Oscar reads that table, opens the two screenshots, and makes one call: **does the mobile app get a
real milestone slot, and on what evidence.** That decision is *not* made in this advance.

### 4.4 How the output is used afterward — which surfaces change and which deliberately do not

| Surface | Effect of this advance |
|---|---|
| `advances/MOBILE/poc.md` + `evidence/` | **New.** The primary deliverable. Feeds the next advance's Gate R |
| `docs/vault-format.md` | **Corrected where the PoC proves it wrong** (P-12) — this is the first time a second implementation stress-tests it. Its §13 compatibility table gains real iOS/Android-arm64 rows |
| `docs/SPEC.md` §2 Out line ("mobile client → explicitly rejected / not scheduled") | **P-4 decides.** It is currently false in at least the word "rejected" |
| `src/**`, `package.json`, `tsup.config.ts`, `tsconfig*.json` | **Untouched.** No dependency, no build-config change, no behaviour change |
| The MCP surface (5 tools, 2 prompts, stdio) | **Untouched, byte-for-byte** |
| The published npm package | **Untouched.** `package.json`'s `files` is `["dist","README.md","LICENSE"]`, so nothing in `advances/` can reach it regardless |
| The vault format, crypto, `vault.json` schema, KDF parameters | **Untouched.** If the PoC finds an incompatibility, that is a *finding to escalate at the next Gate R*, never a format change made inside this advance |
| `.github/workflows/` | **P-11 decides** — temporary and deleted (M4's discipline) or a permanent, separately-triggered job |
| Any user's vault, anywhere | **Untouched.** The PoC only ever sees the published fixture |

---

## 5. Architecture expectations (clean architecture / DDD / hexagonal, in Kotlin)

This repo's conventions govern TypeScript in `src/`; they do not translate mechanically to Kotlin
(M4 D-E noted this). What *does* translate is the shape, and it matters here for one concrete,
non-aesthetic reason: **it determines how much of the PoC can be verified without a device.**

The expected shape, stated as a boundary requirement rather than a file layout:

- **Domain (commonMain, pure).** Token estimate, item cost, pack assembly, markdown rendering, and
  the FTS query string builder. Zero knowledge of SQLite, files, or platforms. Depends on nothing
  but data classes.
- **A port for vault reading.** One interface in commonMain — "give me the projects and the
  non-archived items for a project" — with the amalgamation strictly behind it as a per-platform
  adapter (`expect`/`actual`): Kotlin/Native cinterop on iOS, JNI/NDK on Android.
- **Application.** One use case: open a snapshot, read, assemble, render, compare. It knows the
  port, not the C.
- **UI.** A thin native shell per platform that calls the use case and renders a string.

The payoff is a testing pyramid the planner should exploit deliberately:

1. **Domain conformance runs on the JVM in seconds** — a commonTest that reads `seed.json` and
   byte-compares the rendered output against `expected-export.md`, with no SQLite, no device, no
   simulator. Almost all of G4 and G7 is closed here, cheaply and deterministically, before any CI
   runner boots.
2. **The device run then only has to prove the adapter, the interop, and the process** — G1, G2,
   G3, G6 — which is precisely the part that cannot be faked.

If the PoC is written as one 300-line screen with SQL inline, that pyramid does not exist, every
question needs a device to answer, and the artifact teaches the app advance nothing. This is the one
structural requirement worth holding the PoC to.

**Two concrete traps at the language boundary**, both of which will produce a byte-mismatch that
looks like a mystery:

- **`estimateTokens(text) = ceil(text.length / 4)` counts UTF-16 code units**, because that is what
  JavaScript's `String.length` is. Kotlin's `String.length` matches. **Swift's `String.count` does
  not** — it counts grapheme clusters. Any part of the estimate that goes through Swift is wrong.
  The fixture contains `café ☕` (`item-a03`) specifically so this bites.
- **The renderer's separator is `·` (U+00B7 MIDDLE DOT)**, and the per-item date is the first 10
  characters of the ISO string, not the full timestamp — while the preamble uses the *full* one.
  Both are documented in `docs/vault-format.md` §8–§9 and both are easy to get subtly wrong.

---

## 6. Scope

Stated for the recommended defaults. If Gate R moves P-1, P-2 or P-3, this section is the first
thing the planner re-reads.

### In

1. A **minimal KMP project**: shared Kotlin core (domain + port + use case), per-platform adapters
   binding the vendored `SQLite3MultipleCiphers` amalgamation, and one native screen per platform.
2. The **golden-vault fixture bundled as an app resource**, opened as a sandbox copy, read-only.
3. A **commonTest domain-conformance check** that byte-compares the rendered pack against
   `expected-export.md` on the JVM, independent of any device.
4. An **on-device conformance verdict** rendered on screen *and* returned as a process exit status,
   so the CI job fails if it stops being true.
5. **CI jobs** that build, install, launch and screenshot the app on a real iOS simulator and a real
   Android emulator, capturing logs and images as artifacts.
6. `advances/MOBILE/poc.md` — the runbook and results table, in `advances/M4/spike.md`'s idiom:
   exact commands, exact toolchain versions, exact hardware, and a claim-scoping paragraph naming
   what was *not* executed.
7. Committed screenshots and run logs under `advances/MOBILE/evidence/`.
8. **Corrections to `docs/vault-format.md`** for anything the Kotlin implementation proves wrong or
   under-specified (P-12).
9. Whatever `docs/SPEC.md` edit P-4 decides.

### Out — explicit non-goals

- **No shipping app.** No App Store or Play Store account, submission, provisioning profile,
  distribution certificate, icon set, or store listing.
- **No document picker, no security-scoped bookmarks, no cloud-provider integration** (M4 D-H's
  mechanism), and therefore **no answer to D-H's "detect an unsynced vault" requirement** — that
  needs a real provider on a real device and stays the app advance's problem.
- **No biometrics, no keychain, no keystore, no session model, no idle lock** (M4 D-I).
- **No clipboard, no share sheet, no app-switcher privacy overlay** (M4 D-K).
- **No writes.** No INSERT, no `save_context` equivalent, no `DeviceIdentity`, no lineage bump.
  M4 already answered the write round-trip on Linux; re-answering it is not this advance's job.
- **No project list, no search UI, no unlock screen, no navigation, no settings, no theming.**
- **No change to `src/`, `package.json`, the MCP surface, the crypto, the vault format, or
  `vault.json`.**
- **No network call from the app** — no analytics, no crash reporting, no remote config, no push.
  M4's D-K resolution (no telemetry, mobile or desktop, proxy signals only) stands.
- **No multi-vault support, no Tier 2, no Tier 3.**

---

## 7. Decisions to confirm

### P-1. Platform scope this pass — the named tension

`advances/M4/refined.md` D-E decided **"iOS first, Android later, as a separate advance."** Oscar's
answer to the scoping question that produced this idea was **"for all platforms" / "both
platforms."** Both are on the record; they disagree; `idea.md` flags this explicitly as
Gate-R material and neither should be resolved silently.

- **Option 1 — iOS only.** Honours D-E's sequencing literally. Smallest advance. *Trade-off:* it
  closes G1 and leaves **G2 (Android arm64) exactly as open as M4 left it** — so the question that
  prompted this PoC ("are we sure, for all platforms?") comes back unanswered for half the
  platforms. It also leaves JNI/NDK interop (a *different* mechanism from cinterop) untested, so
  the Android advance would still carry a first-contact integration risk.
- **Option 2 — both platforms, in one pass, treated as equal deliverables.** Matches what Oscar
  actually asked for. Closes G1 and G2 together. *Trade-off:* roughly doubles the toolchain surface
  (Xcode + Gradle + NDK + two CI runner families) in a single advance, and if the iOS side proves
  hard, the whole advance stalls rather than delivering half an answer.
- **Option 3 — both platforms, iOS as the gating slice, Android as a second slice that may be cut.**
  The shared core, the domain conformance, and the iOS app land first and are individually
  reviewable; Android is a distinct, later slice in the same plan. If iOS overruns, Android is
  dropped at Gate P or mid-implementation and the advance still ships a coherent, honest result
  (with G2 explicitly re-marked as open).
- **Option 4 — Android first, iOS second.** Android is the cheaper, better-trodden path (JNI/NDK to
  a C amalgamation is routine; Kotlin/Native cinterop is not) and would de-risk the shared core
  faster. *Trade-off:* directly inverts D-E, and iOS is the platform whose viability is genuinely
  in doubt — proving the easy one first tells you least.
- **Default: Option 3.** Reason: the question being answered is inherently two-platform — G1 is an
  iOS gap and G2 is an Android gap, so an iOS-only pass does not answer it. Option 3 delivers what
  Oscar asked for while preserving D-E's ordering as the *sequence inside the advance* rather than
  as a split across advances, and it keeps a clean cut line for the highest-variance work. If Oscar
  wants D-E honoured strictly, Option 1 is the coherent choice — but the advance should then say
  plainly in `poc.md` that G2 remains open, rather than implying the platform question is closed.
- **Decided: Option 2 — both platforms, in one pass, treated as equal deliverables**, overriding the
  recommended Option 3 gated sequence. Oscar: "For both," confirmed against this exact reading (no
  cut line, Android is not droppable if iOS overruns). §4, §6, and §9's "Android slice may be cut"
  contingency language no longer applies — the planner should read both platforms as equally
  mandatory, not one gating the other.

### P-2. What "shows a value" means — the depth of the on-screen result

`idea.md` leaves this open: "a project's rendered context pack, or just the row count, whichever
'minimal' is deemed to mean."

- **Option 1 — a row or table count.** `sqlite_master_count = 16`, the same thing M4's C harness
  printed. Proves decryption works through Kotlin. *Trade-off:* the screenshot is a picture of a
  number nobody can independently check, and it proves nothing about D-F (the Kotlin domain
  reimplementation), so G4 and G7 stay open.
- **Option 2 — the project list and per-project item counts.** Proves schema reading and typed
  row mapping. *Trade-off:* still no domain logic; G4 and G7 stay open.
- **Option 3 — the rendered context pack for project `alpha`, unbudgeted, byte-compared on device
  against the bundled `expected-export.md`, with a PASS/FAIL verdict on screen.** Proves decrypt +
  schema + row mapping + the full Kotlin domain reimplementation, and makes the screenshot
  *self-verifying* rather than merely illustrative. Closes G4 and forces G7 (the contract's real
  gaps surface as byte mismatches). *Trade-off:* the largest chunk of PoC work, and the M4 review's
  W5/W6 warn it will not pass first try — section-label budgeting and the handoff-selection rule are
  both known to be documented wrong or incompletely.
- **Option 4 — Option 3 plus the budgeted pack (`expected-pack.md`) and the eight search cases
  (`expected-search.json`).** Full conformance; also proves the FTS query builder and quote-escaping
  survive the interop boundary. *Trade-off:* clearly past "minimal," and the extra cases mostly
  re-test the same machinery.
- **Default: Option 3.** Reason: it is the cheapest choice where the evidence is checkable by
  someone who was not there, and it is the only one that turns "the format is compatible" into "a
  second implementation produces the same bytes" — which is what a viability question actually
  means. Options 1 and 2 produce a screenshot that a sceptic can reasonably shrug at. Note that
  under §5's pyramid, most of the Option 3 work is JVM-testable and does not consume device time.
  *If Gate R wants the smallest possible advance, Option 2 is the honest floor* — it still closes
  G1/G2/G3/G6, which are the execution gaps Oscar named.
- **Decided: Option 3**, matching the recommended default. Oscar: "Your recommendation then."

### P-3. Where the PoC code lives, and whether it survives the advance

M4's D-L already decided that app code eventually lives in a separate `valija-mobile` repo, and
M4's own acceptance criteria required its spike to leave **no** toolchain, dependency or CI job
behind. This advance produces real, if disposable, application code.

- **Option 1 — throwaway, evidence-only.** Build it, run it, screenshot it, record everything in
  `poc.md` with the load-bearing sources inlined (the cinterop `.def`, the JNI bridge, the compile
  flags, the `main.c`-equivalent), then delete the tree in the same commit. Exactly M4's discipline,
  and it directly answers the M4 review's W1 (which complained that `spike.md` promised source it
  had not kept). *Trade-off:* the app advance rebuilds the scaffolding, though from a recipe rather
  than from scratch.
- **Option 2 — keep it under `advances/MOBILE/poc/`.** Costs almost nothing: `package.json`'s
  `files` list means it can never reach the npm package, and `.claude/hooks/guard-implementation.sh`
  only gates `src/`, `package.json`, `tsup.config.ts` and `tsconfig*.json`, so `advances/**` already
  passes through. The code stays retrievable without git archaeology. *Trade-off:* repo size (the
  amalgamation is a single multi-megabyte C file — see P-10), a Kotlin/Gradle/Xcode tree sitting
  permanently in a Node repo, and PoC code that will read as authoritative to a future contributor
  when it is not.
- **Option 3 — create the `valija-mobile` repo now** (executing D-L) and seed it with the PoC.
  *Trade-off:* this repo's whole governance apparatus — `guard-implementation.sh`,
  `guard-review-writes.sh`, `guard-git-ops.sh`, the `git-ops` merge flow — lives here and does not
  exist there, so the advance would have to decide how the ritual applies to a second repo. That is
  a real decision, and it should not be made as a side effect of a PoC. It also pre-commits a repo
  structure before the app's actual shape (D-H picker, D-I biometrics, UI framework) is known.
- **Option 4 — a first-class `mobile/` tree in this repo.** M4's D-L already rejected this shape,
  and it would require extending `guard-implementation.sh`. Named only for completeness.
- **Default: Option 1**, with the explicit obligation that `poc.md` inlines every source and command
  needed to reproduce the run — the M4 review's W1 standard, met up front rather than as a fix.
  Reason: a PoC's product is a verified answer, and answers do not rot; PoC *code* does, and worse,
  it acquires unearned authority. Option 2 is a reasonable, cheap alternative **if** Oscar's
  priority is that the app advance start from running code rather than a recipe — in which case the
  plan must state that the tree is explicitly non-authoritative scaffolding.
- **Decided: Option 3**, overriding the recommended Option 1 (throwaway). Oscar: "Seed the real
  valija mobile repo" / "valija-mobile is ok, public, same account." The repo
  [`akiles94/valija-mobile`](https://github.com/akiles94/valija-mobile) was created 2026-07-31 and
  seeded the same day with this repo's `.claude/` directory (agent definitions + guard hooks,
  copied verbatim per Oscar: "We can copy the .claude directory with the agents definitions"),
  commit `f02c3ca`. **Operational point surfaced by this answer, resolved at Gate R sign-off:** with
  the PoC code living in a second repo, `plan.md`/`review.md` for this advance stay in
  `valija/advances/MOBILE/` (Option A) — spec, plan, evidence, and doc fixes here; `valija-mobile`
  holds only the code, via ordinary commits, no separate gate of its own.

### P-4. The roadmap: `docs/SPEC.md` §2 and the milestone number

`docs/SPEC.md:31` currently reads: *"A valija-hosted sync service, mobile client → explicitly
rejected / not scheduled."* §10b adds "Mobile is unscheduled; see `advances/M4/idea.md`". M4's D-A
said whichever advance actually starts building toward mobile **must** edit that line, under the
specs-are-contracts rule. This advance builds a running mobile application. Two separable questions:

**(a) Does the Out line change?**
- **Option 1 — correct the line, assign no number.** Split the two clauses that are currently
  fused: the hosted sync service stays *rejected*; the mobile client becomes *not scheduled — PoC
  validated, see `advances/MOBILE/`*. Also refresh §10b's `advances/M4/idea.md` pointer.
- **Option 2 — leave it untouched**, on the reading that a throwaway PoC is not "building toward"
  a product. *Trade-off:* the repo would then contain a screenshot of a working valija app on two
  platforms while the spec calls the mobile client "explicitly rejected" — precisely the drift the
  rule exists to catch.
- **Default: Option 1.** Reason: the word "rejected" is now demonstrably false, and it is false in a
  document this project treats as a contract. Correcting a false statement is not the same as
  scheduling work, and the fix is small and honest.
- **Decided: Option 1**, matching the recommended default. Executed as part of this advance's own
  deliverables (§6 In item 9), during implementation — not before Gate R.

**(b) Does mobile get a milestone number now?**
- **Option 1 — no number.** Stay `MOBILE`, same posture M4 held.
- **Option 2 — assign one** (mobile as M5, sliding Browser extension; or M6 after Scoped profiles).
- **Default: Option 1.** Reason: M4's D-A rejected numbering "an undefined artifact," and the
  artifact is still undefined — D-H's mechanism, D-I's implementation, the UI framework, the store
  accounts, and D-L's repo governance are all unbuilt. A PoC tells you the ceiling is reachable; it
  does not tell you how long the ladder is. Number it at the *next* Gate R, when there is a scoped
  app to number. *(If Gate R disagrees, note that assigning a number also forces a decision about
  §9's standing promise that per-tool scoping "arrives in M4" — the same collision M4's D-A mapped.)*
- **Decided: Option 1**, matching the recommended default, explicitly re-confirmed by Oscar in the
  final round: "The not yet recommendation its ok for me since I don't think it is fittable for a
  milestone number per se."

### P-5. What counts as proof — the evidence standard

The whole advance is an evidence artifact, so this is not a formality.

- **Option 1 — a screenshot.** Human-legible, immediately convincing. *Trade-off:* not machine-
  checkable, trivially stale, and proves only that a human once saw a screen.
- **Option 2 — an exit code.** The on-device conformance check fails the CI job when it fails.
  Machine-checkable and regression-proof. *Trade-off:* a green check is not visible proof that an
  *app* ran, which is exactly what Oscar asked to see.
- **Option 3 — both, plus a disclosure paragraph.** Screenshot *and* a non-zero exit on failure,
  plus a `poc.md` section in `spike.md`'s C3 idiom naming precisely what ran where and what did not:
  simulator vs. physical device, arm64 vs. x86_64, which runner image, which OS version.
- **Default: Option 3.** Reason: the M4 review's one FAIL-worthy finding was a claim scoped more
  broadly than its evidence. The screenshot is what Oscar asked for; the exit code is what keeps it
  true; the disclosure is what keeps the advance from repeating C3. All three are cheap.
- **Decided: Option 3**, matching the recommended default. Oscar: "Default is ok."

**Non-negotiable regardless of the option chosen:** the phrase "ran on iOS" may only describe an
iOS simulator or device, never macOS. The simulator's own limits are stated at the point of claim —
it executes arm64 code on Apple Silicon runners (so the ISA matches an iPhone) but it runs against
the macOS kernel and a simulator runtime, and it proves nothing about code signing, entitlements,
Secure Enclave, background suspension, thermal behaviour, or App Store review.

### P-6. Real-hardware coverage

Two independent sub-decisions with different mechanics and different costs.

**(a) Android arm64 (closing G2).**
- **Option 1 — x86_64 emulator only.** Cheapest; this is what M4 already did. *Trade-off:* **G2 is
  not closed** — the advance would ship having re-proved what is already proved.
- **Option 2 — an arm64-v8a emulator on an Apple-Silicon `macos-latest` runner.** GitHub's macOS
  runners are arm64 and can host arm64 system images under Hypervisor.framework, so the emulator
  runs native rather than under slow translation. **This is believed viable and is not established
  — the plan must verify it before depending on it**, including whether nested virtualisation is
  available on the runner image at all. *Trade-off:* if it does not work, the fallback is Option 1
  or 3, so it should be time-boxed.
- **Option 3 — a real physical arm64 device via a device farm** (Firebase Test Lab has a free tier;
  AWS Device Farm and BrowserStack are paid). The strongest possible answer to G2. *Trade-off:*
  needs a cloud account, and — important distinction — the farm is *CI infrastructure*, not product
  code: no Firebase SDK, no analytics library, nothing network-capable goes into the app binary.
  Adding one would breach §9's no-network rule.
- **Option 4 — Oscar's own Android phone, manually**, with the screenshot and log committed.
- **Default: Option 2, time-boxed, falling back to Option 3 (Firebase Test Lab free tier) and then
  to Option 1 with G2 explicitly declared still open.** Reason: G2 is one of the two gaps that
  prompted this advance; closing it with x86_64 again would be the same substitution M4 already
  disclosed. Naming a fallback ladder up front prevents the advance from quietly settling for the
  weakest rung.
- **Decided: Option 4**, overriding the recommended emulator-first fallback ladder. Oscar has a
  physical Android phone and will test on it directly: "I have an IOS and an android physical
  mobile so I can test it there." A real device is the strongest possible answer to G2 and makes the
  emulator fallback ladder moot for this advance.

**(b) A physical iOS device (beyond the simulator).**
- **Option 1 — simulator only.** No Apple Developer account, no provisioning profile, no signing
  (`CODE_SIGNING_ALLOWED=NO` is enough for a simulator build). *Trade-off:* code signing,
  entitlements, and real-device behaviour stay unproven.
- **Option 2 — a device farm.** Requires a signed `.ipa`, which requires a paid Apple Developer
  account — a real prerequisite the project does not currently have.
- **Option 3 — Oscar's own iPhone via Xcode**, which needs a Mac he does not have.
- **Default: Option 1, with the residual gap named precisely in `poc.md`.** Reason: the simulator
  closes G1 (iOS execution, arm64, real iOS frameworks, a real app process) and the remaining
  delta — signing, entitlements, Secure Enclave, thermals, store review — is not exercised by any
  part of this PoC anyway, since D-I and D-K are out of scope. Buying an Apple Developer account to
  test a screen that shows a fixture is not proportionate. **The gap must be stated, not implied.**
- **Decided: Option 3**, overriding the recommended simulator-only default. Oscar has a physical
  iPhone and access to a Mac to build for it: "I can borrow a friend's mac, so we can take it as I
  have a mac." This resolves the "needs a Mac he does not have" trade-off originally listed against
  this option — a real device via a borrowed Mac + Xcode, not simulator-only.

### P-7. Argon2id on device

- **Option 1 — skip it.** Hard-code `manifest.keyHex` and open the vault with the raw key. Smallest
  possible PoC; M4's B1 already proved the reference-C implementation reproduces the key exactly,
  platform-independently.
- **Option 2 — include it.** Vendor `phc-winner-argon2` through the same interop path, derive the
  key on device from the published passphrase, assert it equals `manifest.keyHex`, and report the
  elapsed milliseconds on screen.
- **Default: Option 2.** Reason: correctness is closed but **latency is not** (G5), and latency is a
  product decision, not a curiosity — if 64 MiB / t=3 / p=1 takes many seconds on mid-range mobile
  hardware, then M4's D-I biometric-cached-key design stops being a convenience and becomes
  load-bearing, and `docs/SPEC.md` D5's `[TBR: benchmark on modest hardware]` marker is still open
  in the spec today. The marginal cost is one more small C library through interop machinery the
  advance is already building. **Mandatory caveat:** simulator and emulator timings are not device
  timings and must be reported as indicative only, with the hardware named.
- **Decided: Option 2**, matching the recommended default. Since P-6 landed on real physical devices
  for both platforms, this timing will be a genuine on-device measurement, not the simulator/emulator
  proxy the caveat above anticipated.

### P-8. KMP shape

- **Option 1 — shared Kotlin core, native UI per platform** (SwiftUI on iOS; Compose or a plain
  Android view on Android). Exactly what D-E decided. Stresses the risky part directly: Kotlin/Native
  cinterop called from Swift on one side, JNI/NDK on the other.
- **Option 2 — Compose Multiplatform for the UI too.** One UI codebase; less work. *Trade-off:*
  hides the Kotlin↔Swift boundary behind a framework, so D-E's actual architecture (native UI over a
  shared core) goes untested, and it adds a large dependency to something billed as minimal.
- **Option 3 — no KMP; two separate native apps.** Would not test D-E's premise at all.
- **Default: Option 1.** Reason: the PoC's job is to test the decided architecture, not a
  convenient one. The UI is a single text view — the saving from Option 2 is small, and it comes at
  the cost of leaving the exact interop boundary D-E gambled on unexercised.
- **Decided: Option 2**, explicitly overriding the recommended Option 1. Oscar: "No, maybe there
  was a missunderstood, I want it with compose multiplatform instead of two separated swift, kotlin
  UI, so option 2." Compose Multiplatform is the shared UI layer on both platforms, not just the
  domain core. This does not remove the risky interop boundary — Kotlin/Native cinterop on iOS and
  JNI/NDK on Android are still exercised beneath the port (§5) — it only means the UI calling into
  that port is one Compose codebase instead of SwiftUI-plus-a-native-Android-view. The planner
  should adjust §5's "thin native shell per platform" language to "a thin Compose Multiplatform
  shell, shared across platforms" accordingly.

### P-9. How the PoC gets a vault

- **Option 1 — bundle the golden-vault fixture as an app resource; copy to the sandbox; open the
  copy.** No picker, no permissions, no cloud provider.
- **Option 2 — implement M4 D-H's document picker + security-scoped bookmark.**
- **Default: Option 1.** Reason: the picker answers none of §3's questions, and D-H's genuinely hard
  part — detecting that a picked vault is not being actively synced — cannot be tested in a
  simulator with no cloud provider installed. It is the app advance's problem, hands-on with the real
  platform APIs, exactly as M4's D-H says. **The snapshot-copy discipline is kept anyway** — opening
  a copy rather than the bundled resource costs nothing and makes the read-only guarantee structural
  from the first line of code (`docs/vault-format.md` §11).
- **Decided: Option 1**, matching the recommended default. Oscar first asked for the real picker
  ("Implement the real document picker"), then reversed on reflection: "since it is a poc I will go
  with a easier approach, what do you recommend?" — and agreed with Option 1. No document picker;
  bundled fixture only.

### P-10. Amalgamation sourcing, pinning, and licensing

- **Option 1 — copy `node_modules/better-sqlite3-multiple-ciphers/deps/sqlite3/sqlite3.c` into the
  PoC.** The byte-exact artifact M4 verified (SQLite3MultipleCiphers v2.3.5, per
  `deps/update-sqlite3mc.sh`). *Trade-off:* a multi-megabyte C file to carry, and it drifts silently
  when the npm dependency bumps.
- **Option 2 — fetch the matching upstream `SQLite3MultipleCiphers` release at build time.** No
  vendored blob; explicit version pin. *Trade-off:* a network fetch in the build, and it is
  *upstream's* amalgamation rather than the exact one M4 tested — a small but real re-opening of the
  compatibility question.
- **Option 3 — a git submodule of upstream.** Same trade-off as Option 2, with more ceremony.
- **Default: Option 1 for this PoC**, with three obligations: record the SQLite3MultipleCiphers and
  `better-sqlite3-multiple-ciphers` versions; record a SHA-256 of the exact `sqlite3.c` used, so the
  run is reproducible and drift is detectable; and record the **compile flags/defines**, which must
  match what `node-gyp` uses for the desktop addon (M4's harness did this deliberately — a define
  mismatch could produce a subtly different cipher build and silently re-open the whole question).
  Options 2 and 3 are the *sustaining* answer for the app advance, not for a PoC. Reason: the PoC
  must test the artifact M4 actually proved, or it is testing something else.
- **Licensing, flagged not decided:** this would be the first third-party source vendored into a
  valija artifact. SQLite itself is public domain; `SQLite3MultipleCiphers` carries its own licence
  (believed MIT — **the plan must verify, not assume**), and valija is Apache-2.0. Attribution
  obligations must be identified and satisfied in whatever tree the PoC lands in (P-3).
- **Decided: Option 1**, matching the recommended default, accepted via "go with your
  recommendations." The vendored `sqlite3.c`'s hash, compile flags, and verified licence terms are
  recorded in `valija-mobile` (P-3), attributed per whatever that licence requires.

### P-11. CI job lifecycle

- **Option 1 — temporary, path-scoped workflows, deleted in the same commit that records their
  results.** Exactly M4's discipline (`m4-tier-c-spike.yml`, `m4-option2-spike.yml`), and M4's
  acceptance criteria demanded it. *Trade-off:* re-running the proof later means re-creating the
  workflow from `poc.md`.
- **Option 2 — permanent workflows** in `.github/workflows/`, manually or path triggered.
  *Trade-off:* a Node repo permanently carrying Xcode/Gradle/NDK jobs for an app that does not
  exist; macOS runner minutes; and a new class of flake that can block unrelated PRs.
- **Option 3 — permanent but `workflow_dispatch`-only.** A middle ground: re-runnable on demand,
  never triggered by ordinary work.
- **Default: Option 1** if P-3 chooses throwaway (they should match), **Option 3** if P-3 keeps the
  tree. Reason: a CI job that builds code that no longer exists is dead weight; a kept tree with no
  way to re-verify it is worse. Under no option does the mobile job join the existing `ci.yml`
  matrix — `npm run lint/typecheck/test/build` on three OSes must stay untouched and unslowed.
- **Decided: superseded by P-3.** None of Options 1–3 apply as written, since they all assumed the
  PoC's code — and therefore its CI — lives inside `valija`. P-3 went a different way (a separate
  `valija-mobile` repo), so the recommendation actually adopted is: **`valija`'s `.github/workflows/`
  gets zero mobile-related jobs, temporary or permanent** — this repo's existing `ci.yml` matrix is
  the only thing that runs here, unchanged. CI for the PoC (iOS simulator + Android device/emulator
  builds) is entirely `valija-mobile`'s own concern, decided at that repo's own planning stage —
  which may reuse M4's temporary-workflow discipline, but that is an independent decision, not this
  advance's. Accepted by Oscar as part of "last questions I will go with your recommendations."

### P-12. Corrections to `docs/vault-format.md`

The Kotlin reimplementation is the first real test of whether that contract is implementable.
M4's review already flagged two places it is *wrong* rather than merely incomplete (W5:
section-label budgeting, charged three different ways in `context-pack.ts`; W6: "latest handoff"
is really the newest handoff *not already pinned*), plus W7 (the search limit constants are
published but pinned by no test).

- **Option 1 — fix the contract as part of this advance**, wherever the PoC proves it wrong or
  ambiguous, driven by real byte mismatches rather than by re-reading.
- **Option 2 — report the defects in `poc.md`** and leave `docs/vault-format.md` for a separate
  documentation advance.
- **Option 3 — do neither** (only viable if P-2 lands on Option 1 or 2, where no second
  implementation exists to expose anything).
- **Default: Option 1.** Reason: this is the single highest-value side effect of the whole advance —
  a contract corrected by an implementer who hit the bug is worth far more than one corrected by a
  reader. The changes are documentation-only and describe existing behaviour, so per
  `docs/vault-format.md` §14 **no fixture regeneration and no `src/` change is expected**; if a
  correction ever *would* require changing `src/` behaviour, that is a finding to escalate at the
  next Gate R, not a change to make inside this advance.
- **Decided: Option 1**, matching the recommended default, accepted via "go with your
  recommendations." `docs/vault-format.md` gets fixed in `valija` (this repo) in the same advance,
  driven by real byte mismatches surfaced while implementing in `valija-mobile`.

---

## 8. Security surfaces that must not weaken

Even a throwaway PoC can erode the product's claims, and code written to be thrown away is exactly
where that happens.

1. **Only published test values.** No real vault, no real passphrase, no real key, no real user
   content — anywhere, including in screenshots and logs. The fixture's passphrase and key are
   public by design (`src/testing/__fixtures__/golden-vault/README.md`) and must be labelled as such
   wherever they appear in the PoC and in the evidence.
2. **No network call from the app binary.** No analytics, no crash reporting, no remote config, no
   push, no cloud SDK. M4's D-K resolution is explicit and covers mobile and desktop. A device farm
   (P-6) is CI infrastructure and must not put a network-capable SDK inside the app.
3. **Read-only, structurally.** Open a sandbox copy; never the bundled resource in place. No
   `journal_mode` or `wal_checkpoint` pragma, no migration, no lineage write, no device identity —
   `docs/vault-format.md` §11, permanent per M4 D-J.
4. **No key persistence.** The PoC derives a key in memory and discards it. Nothing goes to
   Keychain, Keystore, `UserDefaults`, `SharedPreferences`, a file, or a log line. Argon2id timing
   may be logged; the derived key may not.
5. **No crypto change.** Same Argon2id parameters read from the header, same 32-byte raw key, same
   `PRAGMA cipher='sqlcipher'` at `legacy=0`. No new KDF, no parameter reduction "for mobile", no
   re-encryption. If compatibility appears to require a format change, that is a finding to
   escalate, not a change to make.
6. **`vault.json` stays frozen.** No mobile flag, no device hint, no schema field. Its parser
   silently strips unknown keys, so a well-meant addition would be invisible, not rejected.
7. **The MCP surface is untouched** — same 5 tools, same 2 prompts, stdio only. No new transport;
   Tier 3 remains permanently out of scope (M4 D-C).
8. **No plaintext egress.** No clipboard, no share sheet, no export file, no cache. The rendered
   pack exists on screen and in a committed screenshot of *published fixture data* only.
9. **Vendored third-party C is pinned and attributed** (P-10): recorded version, recorded hash,
   recorded compile flags, satisfied licence obligations.
10. **The desktop threat model is unchanged**, and nothing in this advance may imply otherwise.
    `docs/SPEC.md` §9's "does not protect against" list gains a phone entry only when an app
    actually ships — not for a PoC.

---

## 9. Acceptance criteria

A reviewer should be able to check every line without re-running the PoC, except where noted.

**Applies under every option**

- [ ] `git diff main...HEAD --name-only` shows **no** path under `src/`, and no change to
      `package.json`, `tsup.config.ts`, `tsconfig*.json`, or `.github/workflows/ci.yml`.
- [ ] No change to the vault format, the crypto, the Argon2id parameters, the key format, the
      SQLCipher configuration, or `vault.json`'s schema.
- [ ] The MCP surface is byte-for-byte unchanged: 5 tools, same arguments, 2 prompts, stdio only.
- [ ] No network call, telemetry, analytics, crash-reporting SDK, or cloud SDK exists in any app
      artifact produced by this advance.
- [ ] `npm run typecheck && npm run lint && npm run test` pass unchanged, and the existing CI
      matrix is neither slowed nor gated by any new job.
- [ ] Every value used by the PoC comes from `src/testing/__fixtures__/golden-vault/`; no real
      vault, passphrase, key, or user content appears anywhere, including screenshots and logs.
- [ ] `advances/MOBILE/poc.md` exists and contains, for every question in §3, one of **PASS / FAIL /
      NOT ATTEMPTED**, with the hardware, OS version, and toolchain version that produced it.
- [ ] `poc.md` contains an explicit claim-scoping section naming what was **not** executed
      (physical devices; whichever of iOS/Android was cut; anything else), in the same idiom as
      `advances/M4/spike.md`'s post-C3 disclosures. No claim is stated more broadly than its
      evidence.
- [ ] No sentence in `poc.md`, `docs/vault-format.md`, or a commit message describes a macOS,
      Linux, or x86_64 run as an iOS or arm64 run.

**The app itself**

- [ ] A single-screen application exists for each platform in scope (per P-1), built from a shared
      Kotlin core, with the vendored amalgamation reached only through a per-platform adapter behind
      one port — not called directly from UI code (§5).
- [ ] The app opens a **sandbox copy** of the bundled fixture; the bundled resource's bytes are
      unchanged after a full session, and no `-wal`, `-shm`, or `-journal` sidecar is produced.
- [ ] No `journal_mode`/`wal_checkpoint` pragma, no migration, no lineage write, and no device
      identity exists anywhere in the PoC source.
- [ ] The derived key is never written to Keychain, Keystore, preferences, a file, or a log.
- [ ] The app makes zero network requests, verified by inspecting the source and the declared
      capabilities/permissions of both binaries.

**Execution evidence (G1, G2, G3, G6)**

- [ ] A screenshot taken from a **booted iOS simulator** shows the app's result screen, committed
      under `advances/MOBILE/evidence/`, with the simulator device model and iOS version recorded.
- [ ] A screenshot taken from a **booted Android emulator or device** shows the same, with the API
      level, system-image ABI, and host runner recorded. *(In scope per P-1; if the Android slice is
      cut, this line is replaced by an explicit "G2 remains open" statement in `poc.md`.)*
- [ ] Kotlin→C interop is exercised on each platform in scope through its own mechanism
      (Kotlin/Native cinterop on iOS; JNI/NDK on Android), and `poc.md` records both.
- [ ] The run logs, including exit codes, are committed alongside the screenshots.
- [ ] Per P-6(a), the Android result states plainly whether it ran on **arm64** or x86_64; if
      x86_64, G2 is recorded as **still open**, not as closed.

**Conformance (G4, G7) — applies if P-2 lands on Option 3 or 4**

- [ ] A commonTest running on the JVM byte-compares the Kotlin-rendered pack for project `alpha`
      against `src/testing/__fixtures__/golden-vault/expected-export.md` and passes.
- [ ] The same comparison runs **on device** and its result is displayed on screen and reflected in
      the process exit status, so the CI job fails when it fails (per P-5).
- [ ] The comparison is a byte comparison against the committed file, not a snapshot, not a
      normalised or whitespace-insensitive match. The `·` (U+00B7) separators and the `café ☕`
      content survive intact.
- [ ] `estimateTokens` in the Kotlin implementation counts **UTF-16 code units**, matching
      JavaScript's `String.length`; this is asserted by a test, not by inspection.

**Argon2id (G5) — applies if P-7 lands on Option 2**

- [ ] The key derived on device from the published passphrase, the header salt, and the header
      parameters equals `manifest.keyHex` exactly, asserted in code.
- [ ] The derivation time is reported on screen and in `poc.md`, labelled with the hardware that
      produced it and explicitly marked as **not** a physical-device measurement where that is true.

**Contract and roadmap**

- [ ] Per P-12: every defect the implementation exposed in `docs/vault-format.md` is either fixed in
      the same commit or recorded in `poc.md` with a specific location and the correct behaviour.
      M4's W5 (section-label budgeting) and W6 (handoff selection) are addressed one way or the
      other, not silently left.
- [ ] `docs/vault-format.md` §13's compatibility table gains rows for whatever this advance actually
      executed, with the same scoping precision as its existing rows.
- [ ] Per P-4: `docs/SPEC.md` §2's Out line and §10b's pointer are either corrected or explicitly
      confirmed as still accurate in `poc.md` — not left unexamined.
- [ ] Per P-3: if the PoC tree is deleted, `poc.md` inlines every source file and command needed to
      reproduce the run (the M4 review's W1 standard). If it is kept, the plan states its location
      and that it is non-authoritative scaffolding.
- [ ] Per P-10 and P-11: the amalgamation's version, SHA-256, and compile flags are recorded; the
      third-party licence obligation is identified and satisfied; no CI job or dependency lands
      outside what P-11 authorised.

---

## 10. Deliverables summary (for the planner, not a plan)

Under the recommended defaults: a minimal Kotlin Multiplatform application — shared domain core,
one port, per-platform amalgamation adapters, one native screen each — that opens a sandbox copy of
the committed golden-vault fixture, derives the key with vendored reference-C Argon2id, renders
project `alpha`'s unbudgeted context pack, and byte-compares it against `expected-export.md` on
screen and in the exit status. Built, launched and screenshotted on a real iOS simulator and a real
Android emulator (arm64 if P-6(a) Option 2 or 3 holds) in temporary CI workflows. The lasting
artifacts in this repo are `advances/MOBILE/poc.md` (runbook, results table, disclosure section,
inlined sources), `advances/MOBILE/evidence/` (screenshots and logs), corrections to
`docs/vault-format.md`, and a corrected `docs/SPEC.md` §2 Out line — with no milestone number
assigned, no `src/` change, no dependency, and no permanent CI job.

The shipping mobile app remains a separate, much larger advance. M4's D-H, D-I, D-K and D-L are
recorded for it and none of them bind this one.

---

## 11. Biggest risk

**The PoC's honest failure mode is not "it doesn't work" — it is "it works, and we conclude more
than we proved."** M4's spike already produced exactly this failure once (a macOS run published as
iOS evidence, caught only at review), and this advance is structurally more susceptible: it ends
with a screenshot of a working valija app, which is the most persuasive artifact this project has
ever produced and also one of the least precise. A simulator is not a phone; an emulator is not a
device; a bundled fixture is not a user's synced vault; a screen showing rendered markdown is not an
app that unlocks, locks, picks a file, and holds a key in a Secure Enclave. If `poc.md` does not
name each of those gaps as loudly as it names its passes, the next Gate R will size the real app
against evidence that does not support it — and the decisions most likely to be under-costed are
precisely the ones this PoC deliberately skips (M4's D-H document picker and unsynced-vault
detection, and D-I's biometric key handling), which are also the two that touch the security
surface hardest.

The secondary risk is **toolchain scope creep**: Xcode, Gradle, the NDK, cinterop, JNI, two CI
runner families, and a vendored C amalgamation is a lot of new surface for an advance whose output
is a screenshot. P-1's Option 3 (iOS gating, Android cuttable) and P-11's temporary-workflow
discipline exist to keep that bounded; without a hard cut line, this is the advance that becomes an
unreviewable, unfinished branch.

The third risk is **quiet erosion under "it's only a PoC"** — a convenience analytics SDK, a
logged key, a real vault used for a quick test, a `journal_mode` pragma copied from desktop's
`openVaultDb`. Each is individually defensible in throwaway code and each contradicts a claim this
product makes in public. §8 exists to make them reviewable rather than plausible.
