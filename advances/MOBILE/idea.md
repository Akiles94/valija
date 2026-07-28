# MOBILE — minimal real mobile app proof of concept · Raw idea

**Status:** Idea capture only — not refined, not planned, not for Gate R yet.
**Directory named `MOBILE`, not a milestone number.** `docs/SPEC.md` §2 still lists the
mobile client as "explicitly rejected / not scheduled". `advances/M4/refined.md` D-A
deliberately left the milestone number open "until the spike's result is in" — it's in now
(positive), so assigning a real slot is one of the open questions below, not a decision
already made by naming this directory.

---

## Why now

`advances/M4/` (docs/vault-format.md, the golden-vault conformance fixture, and the
compatibility spike) closed the one risk that could have invalidated the whole mobile idea:
whether a mobile build can read/write valija's real vault format at all. It can — Option 2
(build the literal `SQLite3MultipleCiphers` amalgamation for mobile, not the official
SQLCipher package) is empirically confirmed with real data on Linux, Apple/Darwin (macOS
execution), and Android x86_64 (real emulator, `adb`).

Two things are **not** yet proven, and Oscar asked for them directly ("to be fully sure"):
- **No binary has ever actually run on a real iOS device or simulator.** The Apple/Darwin
  evidence is real (same toolchain, same architecture) but is explicitly *not* iOS execution
  — `spike.md` says so in as many words after the M4 review caught the earlier overclaim.
- **Android's real device architecture (arm64) only compiled, never executed** — the
  execution proof came from x86_64 under emulation; arm64 hit a qemu-user limitation
  specific to this sandboxed environment, not a real device or a real CI runner.

Beyond that, M4 never touched an actual app: no UI, no KMP interop layer calling the C
library from Swift/Kotlin, no biometric/keychain integration, no Argon2id timing on real
mobile hardware. Oscar's ask, in his own words: "can we create a proof of concept minimal
just to be sure" — and when offered a smaller option (just closing the two execution gaps
with the same throwaway C-harness approach as M4), he chose the largest of the three offered:
**a minimal real app with UI** — one screen, opens a vault, shows a value — on both platforms.

## What M4's refined.md already decided, that this idea inherits rather than re-litigates

`advances/M4/refined.md` recorded several decisions explicitly "for later, not acted on under
D-B Option 2" — i.e., made in advance for exactly this follow-on:

- **D-C: Tier 1 (read-only) first.** No mobile writes, no `DeviceIdentity` on the phone, no
  fork risk. The PoC should be a viewer, not an editor.
- **D-E: Kotlin Multiplatform, shared core, iOS first, Android later** — decided over native
  per-platform, React Native, and Flutter. Oscar explicitly accepted "iOS SQLCipher-under-KMP
  is the least-trodden path of the four" as a trade-off for one shared core.
- **D-F: reimplement the small pure domain logic per platform** (pack assembly, token
  estimate, FTS query builder, `classifyLineage`) rather than embedding a JS runtime or WASM —
  conformance proven against the same golden fixtures M4 already built, not a shared runtime.
- **D-G: native SQLCipher binding — now specifically Option 2's literal-amalgamation vendoring
  approach**, since M4's spike closed the official-package path as non-viable.
- **D-J: migration never runs on mobile, permanently** — a read is a read, even after any
  future Tier 2.

**Open tension worth flagging explicitly for Gate R:** D-E decided iOS first, Android as "a
separate later advance." Oscar's answer to the scoping question that produced this idea said
"for all platforms" and the largest PoC option ("both platforms"). Whether this PoC honours
the iOS-first sequencing (build/prove iOS, Android follows as its own next step) or
deliberately does both platforms in one pass is a real open decision, not something to assume
either way.

## A concrete way to close the execution gap without Oscar owning a Mac

M4's Tier C′ already proved the pattern: GitHub Actions `macos-latest` runners are real Macs
with real Xcode. The earlier spike ran a bare command-line binary, which can't execute a
literal iOS-simulator target (needs full CoreSimulator, not just a compiler flag) — but a
**real Xcode project**, built and run via `xcodebuild -destination 'platform=iOS
Simulator,...'` (the standard, well-trodden iOS CI pattern), does not have that limitation:
CI can boot a real simulator, install a real `.app`, launch it, and even capture a screenshot
(`xcrun simctl io booted screenshot`) as visual proof — all without anyone owning or renting a
Mac. The same pattern applies to Android (a real emulator, `adb shell screencap`), matching
what M4's `android-emulator` job already did successfully.

## Shape (very rough — task-refiner should sharpen this, not treat it as decided)

A minimal KMP project with:
- A shared Kotlin module vendoring/calling the literal `SQLite3MultipleCiphers` amalgamation
  (the same C source `node_modules/better-sqlite3-multiple-ciphers/deps/sqlite3/sqlite3.c`
  ships, or the upstream project directly) via Kotlin/Native cinterop (iOS) and JNI/NDK
  (Android).
- One screen per platform (SwiftUI wrapper around the shared core for iOS; a minimal Compose
  or plain view for Android — exact UI framework not decided) that: opens a copy of the M4
  golden-vault fixture (published test values, not a real vault) with the raw key, and
  displays one thing read from it — e.g. a project's rendered context pack, or just the row
  count, whichever "minimal" is deemed to mean.
- Run and screenshotted in CI on both a real iOS simulator and a real Android emulator, per
  the pattern above — real visual proof, not just a log line.

## Not decided / not scoped yet

Nearly everything below the toolchain-carryover from M4: exact minimal UI content (row count
vs. a rendered pack vs. something else), whether Android ships in the same pass as iOS or
follows per D-E's original sequencing, whether this becomes a real milestone number in
`docs/SPEC.md` §2 (and the resulting obligation to edit the Out line, per M4's D-A) or stays
an unscheduled advance like M4 did, whether a real device run is ever attempted (vs. simulator
+ emulator only), how the PoC's vendored amalgamation source is obtained and kept in sync
(vendored copy vs. build-time fetch), and whether any biometric/keychain work happens now or
stays deferred (M4's decisions suggest deferred — a raw-key PoC needs neither). This file
exists so the idea isn't lost — it is not a spec and should go through `task-refiner` (Gate R)
before any of this is treated as planned work.
