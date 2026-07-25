# Mobile companion for valija · Refined Spec

**Status:** Draft — awaiting Gate R. Nothing here is settled.
**Milestone:** *deliberately unassigned.* This spec lives in `advances/M4/` only because that
is where `idea.md` was captured. It is **not** a claim that this work is milestone 4:
`docs/SPEC.md` §2 currently assigns **M4 to "Scoped profiles, per-tool visibility"** and lists
the mobile client under **"explicitly rejected / not scheduled"**. Which slot (if any) this
takes is **D-A**, an open decision for Oscar.
**Legend:** each decision lists options and a recommended **Default** with a reason. Defaults
are proposals, not resolutions.

---

## 1. Goal

Let a user read their valija context **on a phone** — the same encrypted vault, the same
passphrase, no backend, no accounts, no network calls by valija — so that context saved from
a desktop AI tool can be pasted into Claude/ChatGPT mobile. This rides on M3's BYO-cloud
sync: the vault file already lives in a folder the user's own sync client replicates, and
already sits at rest as a single self-consistent `vault.db` after every desktop command, so a
second, non-Node implementation can open it.

The load-bearing constraint: **mobile must not buy reach by weakening the product's core
claim.** Local-first, end-to-end encrypted, no cloud service, no telemetry, no valija-hosted
anything. A mobile client that ships an OAuth cloud SDK, a hosted relay, or a plaintext cache
is not this feature — it is the shape M3 explicitly rejected, in a new costume.

Two framing facts a planner must not skip past:

1. **This is a second implementation of valija's encrypted format**, in a different language,
   on a different toolchain, released on a different cadence (app store review, not `npm
   publish`). That is a category difference from every previous advance, all of which changed
   one TypeScript package.
2. **The raw idea explicitly decides nothing** (`idea.md` §"Not decided / not scoped yet":
   *"Everything"*). This spec's job is therefore mostly to convert "everything is open" into a
   small number of answerable decisions with defaults — not to describe a build.

---

## 2. User walkthrough — the workflow from the user's perspective

Written for **Tier 1, the read-only companion** (the D-C default). If Oscar picks a different
tier or a different deliverable at Gate R, this section is what changes first.

### 2.1 The end-to-end flow

| # | Step | What the user does | What the user sees |
|---|---|---|---|
| 0 | Prerequisite (desktop) | Vault already lives in a synced folder per `docs/sync.md`; `valija lock` run on desktop | The existing "safe to switch devices" confirmation — unchanged |
| 1 | Install | Installs the valija companion app from the App Store / Play Store | An empty app with one action: "Open your vault" |
| 2 | Point at the vault | Taps "Open your vault", picks `vault.json` (or the vault folder) in the system file picker — iCloud Drive, Dropbox, OneDrive, Google Drive, whatever provider is installed | Standard OS file picker. No login to any cloud service *inside valija* — the provider is already signed in at the OS level (**D-H**) |
| 3 | Unlock (first time) | Types the same passphrase used on desktop (or pastes the 64-hex recovery key) | ~1s Argon2id derivation, then "Vault unlocked". Offers "Use Face ID next time?" |
| 4 | Unlock (every time after) | Face ID / Touch ID / Android biometric prompt | Vault open. No passphrase re-entry until the biometric binding is invalidated (**D-I**) |
| 5 | Browse | Sees the project list; taps one | Same projects as `valija projects` |
| 6 | Search | Types a query | Same FTS results as `valija search` — including `imported` items, which are searchable but never in a pack |
| 7 | Read the pack | Taps "Context pack" on a project | The **same markdown `valija export` produces**, rendered — same section order, same budget rule |
| 8 | Use it | Taps **Copy** | "Copied — this is plaintext on your clipboard" warning the first time (**D-K**). Pastes into Claude/ChatGPT mobile by hand |
| 9 | Walk away | Backgrounds the app / idles | App locks on background and after the idle TTL; next open needs biometrics again (**D-I**) |

### 2.2 What the user explicitly does *not* get in Tier 1

- **No save from the phone.** No `save_context` equivalent. The app never writes a byte to
  `vault.db` (**D-D**). This is why the phone cannot cause a sync fork.
- **No automatic hand-off into Claude/ChatGPT.** Step 8 is a manual copy-paste. Tier 3
  (MCP-over-loopback on the phone) is not built and is not designed toward (**D-C**).
- **No vault creation, no passphrase change, no import, no recovery-kit generation.** Those
  stay desktop rituals.
- **No cloud account inside valija.** Step 2 uses the OS file picker, not a Dropbox/Google
  login screen.

### 2.3 How the data is used afterward — which surfaces expose what

| Surface | Projects & items | Rendered context pack | Lineage / sync metadata (generation, writer, device id) | Passphrase / key |
|---|---|---|---|---|
| Mobile project list & search | yes | — | no | no |
| Mobile pack screen | yes | yes | **no — never in the pack body** | no |
| Mobile "Vault info" screen | counts only | — | yes, read-only display (generation, last writer, "written by another device") | no |
| Mobile clipboard (step 8) | — | yes, plaintext, deliberately | **no** | no |
| iOS Keychain / Android Keystore | — | — | — | derived 32-byte key only, biometry-gated (**D-I**) |
| Device backups / iCloud Keychain sync | — | — | — | **excluded — key is device-only, never backed up** |
| Desktop `valija status` / `doctor` | unchanged | unchanged | unchanged — the phone does not appear as a device | unchanged |
| MCP surface (5 tools, 2 prompts) | **unchanged — no new tool, no new argument, no new transport** | | | |

The rule inherited from M3 holds: lineage/sync metadata is plumbing for humans, never content.
The phone may *display* it; it never enters a pack, and no model ever sees it.

### 2.4 If Gate R picks the contract-and-conformance deliverable (D-B Option 2)

Then no app ships in this advance and the walkthrough above is the *target*, not the output.
The observable deliverable becomes a documented format contract plus a conformance fixture,
and the "user" is the person writing the second implementation:

```
# in this repo
docs/vault-format.md            # the contract: crypto params, schema, pack + search algorithms
test/fixtures/conformance/      # a golden vault + expected pack markdown + expected search hits
npm run test                    # a conformance test that regenerates and byte-compares them
```

They read one document, open the golden vault with an official SQLCipher mobile build and a
native Argon2id, and compare their rendered pack byte-for-byte against the fixture. Green means
their implementation is compatible; red tells them exactly which parameter drifted.

---

## 3. Context snapshot (load-bearing facts from the current codebase)

A planner must not contradict these. These are the things a second implementation has to match.

**Crypto & file format**
- `openVaultDb` (`src/shared/infra/sqlite.ts`) opens with `PRAGMA cipher='sqlcipher'` then
  `PRAGMA key="x'<64 hex>'"` — a **raw 32-byte key, never a passphrase**. Key verification is a
  `SELECT count(*) FROM sqlite_master`; a wrong key throws `SQLITE_NOTADB`.
- **`openVaultDb` writes on open.** After key verification it runs `wal_checkpoint(TRUNCATE)`,
  `journal_mode = DELETE`, `foreign_keys = ON`. A read-only mobile client must **not** reproduce
  this (see D-J) — the journal switch is a mutation of a file the user's sync client is watching.
- Argon2id derivation (`src/vault/infra/argon2.ts`) uses the npm `argon2` package, which binds
  the **reference C implementation**: `type=argon2id, raw=true, hashLength=32`, with
  `memoryCost/timeCost/parallelism` read from the header. `docs/SPEC.md` D5 defaults: 64 MiB,
  t=3, p=1. Salt is 16 random bytes.
- `vault.json` (plaintext header, `src/vault/infra/vault-header.ts`) is zod-validated:
  `vaultId`, `schemaVersion` **literal `1`**, `kdf{algorithm:"argon2id", memoryKiB, iterations,
  parallelism}`, `saltBase64`, `createdAt`. **Unknown keys are stripped on read.** M3 froze this
  file deliberately — no lineage, device, or session field may ever be added.
- Schema v3 inside the encrypted db: `projects`, `context_items` (type CHECK including
  `imported`), `context_items_fts` (FTS5 external-content, kept in sync by triggers), `meta`
  (`schema_version`, plus M3's `lineage_generation` / `lineage_stamp` / `lineage_writer` /
  `lineage_written_at`).

**Algorithms a companion must reproduce to show "the same" content**
- Pack assembly (`src/context/domain/services/context-pack.ts`) is pure and ~130 lines: pinned
  newest-first (the newest pinned item is included *even over budget*), then the latest handoff,
  then `decision → preference → progress → fact`, newest-first, until the budget is spent.
  `estimateTokens = ceil(chars/4)`; an item costs
  `` `${type} ${YYYY-MM-DD} ${tags.join(" ")}\n\n${content}` ``; there is a preamble cost too.
  Default budget 4000 tokens; export is unbudgeted.
- Markdown rendering (`src/delivery/context-pack-markdown.ts`) is presentation, not domain:
  `# Context pack: <name>`, a `> <n> items in vault · generated <ISO>` line, `## <Section>`
  headings, `### <type> · <YYYY-MM-DD>[ · #tag …]` per item.
- Search (`src/context/infra/item-repo.ts`): terms split on whitespace, each wrapped in double
  quotes with internal `"` doubled, ANDed, `MATCH` against `context_items_fts`, `archived = 0`,
  `ORDER BY rank LIMIT n`.
- `imported` items (M2) are **searchable but excluded from context packs** and never creatable
  from MCP. A companion that shows imported items in a pack is wrong.

**M3 groundwork this depends on**
- Single-file-at-rest journaling means a reader can copy/open `vault.db` alone at any time.
- Lineage lives in the encrypted `meta`; device identity and idle state live under
  `VALIJA_STATE_HOME` (default `~/.valija-state`), **outside** the synced folder, by design.
- `classifyLineage` (`src/vault/domain/services/vault-lineage.ts`) is pure: `in-sync` /
  `fast-forward` / `fork`. A pure reader that never writes can never produce a fork.
- Same passphrase + same salt + same params ⇒ same key on any device. Nothing about
  multi-device key handling needs to change for a phone to open the vault.

**Product & process constraints**
- `docs/SPEC.md` §2 "Out" currently lists **"A valija-hosted sync service, mobile client →
  explicitly rejected / not scheduled"** and **"Remote/HTTP MCP transport — local stdio only"**.
  Scheduling any mobile work requires editing that line (D-A); Tier 3 would additionally require
  reversing the stdio-only non-goal.
- §9 security model: "**any MCP client you connect receives plaintext**… per-tool scoping arrives
  in M4." That promise is currently attached to the Scoped-profiles milestone this idea would
  displace (D-A).
- Repo conventions: module-first `domain/application/infra`, no bare files at a layer root,
  `parseX`/`createX`/`xxxErr`, specs in `specs/*.md` updated in the same commit as behaviour.
  These govern **TypeScript in `src/`** — they do not automatically translate to Swift/Kotlin,
  which is part of D-E/D-L.
- `.claude/hooks/guard-implementation.sh` gates `src/**`, `package.json`, and build config on an
  approved `plan.md`. A `mobile/` folder or a second repo would sit **outside** that guard —
  a governance gap the planner must address (D-L).
- CI (`.github/workflows/ci.yml`) is Node-only. Xcode/Gradle jobs are a new class of CI.

---

## 4. The central hazards (must not be hand-waved)

**H1 — Second-implementation drift.** Two independent implementations of one encrypted format
diverge silently. Three sub-surfaces, in decreasing order of blast radius:
*(a) Cipher parameters.* Desktop uses `better-sqlite3-multiple-ciphers` with `cipher='sqlcipher'`.
An official SQLCipher mobile build is a *different codebase* implementing the *same* format.
Page size, KDF algorithm and iterations for HMAC-key derivation, HMAC algorithm, plaintext-header
size, and the raw-key salt convention must all line up. If they do not, the phone reports "wrong
passphrase" against a perfectly good vault — an unfalsifiable-looking bug.
*(b) Schema.* Mobile becomes a second reader of `schema_version`; desktop migrations bump it
automatically on the next open, including one an MCP server launched in the background. An
app-store release cycle cannot keep up with that.
*(c) Presentation.* If the phone's pack differs from `valija export` — different budget rule,
different section order, imported items leaking in — users will trust neither.

**H2 — The trust boundary widens to a phone.** Today the plaintext key exists on machines the
user administers, in an OS keychain, and plaintext context exists only in terminals and MCP
clients. A companion adds: a key cached in a mobile keychain, plaintext rendered on a lock-
screen-adjacent surface, app-switcher snapshots, OS/cloud device backups, and — by design —
**a plaintext context pack on the system clipboard** (walkthrough step 8), which on iOS is
readable by other apps and, with Universal Clipboard, by other devices. None of this is a reason
not to build it; all of it must be a deliberate, documented choice (D-I, D-K, §6).

**H3 — A phone has no filesystem in the sense valija assumes.** There is no `VALIJA_HOME`. Vault
access goes through a document picker + security-scoped bookmark, or a vendor SDK. The vendor-SDK
path would put **OAuth and network code inside valija for the first time** — directly against the
"no network calls, ever" claim, and structurally close to the hosted-sync shape M3 rejected. Even
on the picker path, File Provider files may be **dataless placeholders** (the residual risk M3
already documented for iCloud/OneDrive), and opening a SQLite database *in place* on a provider
URL is not something SQLite's locking model can rely on.

**H4 — (write tiers only) The phone as a fork participant.** The moment mobile writes, it needs a
`DeviceIdentity`, it bumps the lineage stamp, and it inherits the lock-before-switch discipline —
on a platform that can kill the process mid-write at the OS's discretion and where the sync client
is a File Provider extension with its own upload timing. This is a materially worse environment
for M3's advisory ritual than two desktops (D-D).

---

## 5. Scope

Scope is **conditional on D-B and D-C**. Stated below for the recommended defaults (D-B Option 2
+ D-C Tier 1); if Oscar chooses otherwise, §5 is the first thing the planner re-reads.

### In (under the recommended defaults)
1. A written **vault format & algorithm contract** (`docs/vault-format.md`): everything a
   non-Node implementation needs — exact cipher parameters, Argon2id parameters and the raw-key
   convention, the header schema, the schema-v3 tables, the pack-assembly algorithm, the markdown
   rendering, the FTS query construction, and the `imported`-excluded-from-packs rule.
2. **Read-only discipline, written down and enforceable**: the exact set of operations a reader
   may perform (no journal-mode switch, no migration, no lineage bump, no device identity) and
   what it must do when it meets a `-wal` sidecar or an unknown `schema_version` (D-J).
3. A **conformance fixture and test in this repo**: a golden vault (fixed key, fixed content,
   committed) plus the expected rendered pack and expected search results, with a test that
   proves the *desktop* implementation still matches them — so drift is caught on the TypeScript
   side too, not only by the future mobile author.
4. A **compatibility spike report**: does an official SQLCipher mobile build actually open the
   golden vault with a raw key, and does a native/WASM Argon2id reproduce the same 32 bytes?
   Pass/fail with the exact parameter set that worked (H1a).
5. **Roadmap and security-model updates** in `docs/SPEC.md` reflecting whatever D-A decides,
   including the §2 "Out" line that currently calls the mobile client rejected/not scheduled.
6. `specs/*.md` touched for any behaviour this advance changes in `src/` (expected: little to
   none — the contract documents existing behaviour rather than altering it).

### Out (explicit non-goals — name them so the planner does not drift)
- **No shipped mobile application, no app-store submission, no UI work** under the recommended
  default. (In scope only if Gate R picks D-B Option 1.)
- **No mobile write path** in this advance under any option (D-D) — no `save_context` from the
  phone, no `DeviceIdentity` for a phone, no lineage bump from mobile.
- **No MCP server on the phone, no HTTP/loopback transport, no custom-connector work** (Tier 3).
  Blocked on third-party platform behaviour valija does not control, and it contradicts the
  standing stdio-only non-goal. Not designed toward.
- **No cloud vendor SDK, no OAuth, no network call** anywhere in valija — desktop or mobile.
- **No valija-hosted anything.** Unchanged from M3 and permanent.
- **No change to the MCP surface**: no new tool, no new argument, no new prompt, no new transport.
- **No change to the crypto**: no new KDF, no key-format change, no header field. If mobile
  compatibility appears to require a format change, that is a *finding to report at Gate R of a
  future advance*, not a change to make inside this one.
- **No plaintext cache, no exported plaintext file, no analytics/crash-reporting SDK** in any
  mobile artifact.
- **No multi-vault support** (still `docs/SPEC.md` §12 open question 4).

---

## 6. Decisions to confirm (options + recommended defaults)

### D-A. Roadmap slot and milestone numbering *(must be answered first — it gates everything)*

`docs/SPEC.md` §2 assigns **M4 = "Scoped profiles, per-tool visibility"**, §9 promises per-tool
scoping "arrives in M4", and §2's Out list calls the mobile client "explicitly rejected / not
scheduled". §10b says mobile is unscheduled and points at `advances/M4/idea.md`. The advance
*directory* is named `M4` purely because that is where the note landed.

- **Option 1 — Scoped profiles keeps M4; the mobile companion becomes M5** (Browser extension
  slides to M6). Honours a commitment already made in the published security model; mobile gets a
  real slot. *Trade-off:* mobile waits behind a milestone of unknown size.
- **Option 2 — Mobile takes M4; Scoped profiles slides to M5.** Fastest path to reach; but §9's
  security-model promise moves, and mobile is the larger, riskier, cross-toolchain milestone —
  putting it first front-loads the project's highest-variance work.
- **Option 3 — Mobile stays unscheduled; only the format contract lands now** (as a
  non-milestone, numbered advance in the current stream). Keeps the roadmap honest: the contract
  is genuinely useful even if no app is ever built, and it does not promise a ship date for an
  app whose framework, platform, and tier are all undecided.
- **Option 4 — Defer entirely; close this idea until Scoped profiles ships.** Zero cost, zero
  progress; loses the cheap chance to catch a format-compatibility blocker early.
- **Default: Option 3, with Option 1 as the follow-on shape.** Reason: every decision below that
  would justify a milestone number (framework, tier, platform, distribution) is *itself* still
  open, so assigning a number now would be scheduling an undefined artifact. The contract-first
  slice is small, lands in this repo's existing idiom, de-risks the biggest unknown (H1a), and
  leaves the numbering decision to be made once when there is something concrete to number. If
  Oscar wants a committed slot regardless, Option 1 is the safer of the two numbered choices.
- **Whatever is chosen, `docs/SPEC.md` §2's Out line must be edited** — leaving "mobile client →
  explicitly rejected / not scheduled" while an advance builds toward one is the kind of drift
  the specs-are-contracts rule exists to prevent.

### D-B. What this advance actually delivers

- **Option 1 — a shipping Tier 1 app.** Highest user value, but it is a multi-week, multi-
  toolchain effort (native UI, app-store account, provisioning, review) that does not fit the
  advance ritual's reviewable-slice cadence, and it commits to D-E/D-H/D-I answers before any of
  them have been tested.
- **Option 2 — a format contract + conformance fixture + compatibility spike** (no app). Small,
  lands entirely in this repo's existing toolchain, reviewable by the normal `change-reviewer`
  path, and it answers the one question that can *invalidate the whole idea*: whether an official
  SQLCipher mobile build can open a `better-sqlite3-multiple-ciphers` vault with a raw key at all.
  *Trade-off:* zero user-visible value on its own; the walkthrough in §2.1 remains hypothetical.
- **Option 3 — documentation only** (`docs/vault-format.md`, no fixture, no spike). Cheapest;
  but an undtested contract written from reading the source is exactly the artifact most likely
  to be subtly wrong, and its errors would surface only in a language nobody here is testing.
- **Option 4 — a throwaway spike only**, no committed contract, findings in `advances/`. Fast
  learning, but the knowledge decays and the desktop side gains no drift protection.
- **Default: Option 2.** It converts the idea's biggest unknown into a yes/no answer for a fraction
  of the cost of an app, it produces an artifact (`docs/vault-format.md` + conformance test) that
  is valuable even if mobile is never built — it also protects the *desktop* from silently changing
  the pack algorithm — and it defers every decision that depends on facts nobody has yet.

### D-C. Which tier ships first

`idea.md` proposes Tier 1 (read-only companion), Tier 2 (mobile can save), Tier 3 (MCP tool-calling
on the phone), flagging Tier 1 as "the sane start" without deciding.

- **Option 1 — Tier 1 (read-only).** No fork risk (a reader cannot diverge lineage), no
  `DeviceIdentity` on the phone, no write atomicity problem, no background-execution problem.
  Delivers the actual daily use case (read context on the phone, paste it into a chat app).
  *Trade-off:* the last step is a manual copy-paste; the phone can consume context but not
  produce it, so mobile-originated insights still have to be re-entered on desktop.
- **Option 2 — start at Tier 2 (read + write).** Full parity, but it drags in H4 in the very
  first release, on the platform least able to honour M3's advisory ritual.
- **Option 3 — Tier 3 (MCP on the phone).** Blocked on two things outside this codebase
  (whether Claude/ChatGPT mobile accept a loopback connector URL; whether the OS keeps the
  server alive when backgrounded) and it contradicts the stdio-only non-goal. `idea.md` itself
  says "do not design around it now."
- **Default: Option 1 (Tier 1), and Tier 3 is treated as out of scope permanently until the
  platforms demonstrably change** — not as a roadmap item. Reason: Tier 1 is the only tier whose
  risk is entirely inside this project's control.

### D-D. Does Tier 2 (mobile writes) ship at all?

- **Option 1 — never; the companion is read-only by design.** Becomes a stated product property:
  the phone is a *reader*, so it can never fork the vault, never needs a device identity, and
  never participates in the lock-before-switch ritual. Strongest safety story, simplest mental
  model, and it means the app can open a *snapshot copy* rather than the live synced file (D-H).
  *Trade-off:* "I had an idea on the train" has no path into the vault except re-typing later.
- **Option 2 — revisit after Tier 1 has real usage.** Keeps the door open without paying for it;
  requires that Tier 1's architecture not paint writes into a corner (mainly: keep the file-access
  layer behind a port so "snapshot copy" can become "coordinated in-place write").
- **Option 3 — commit to Tier 2 now** and design the read path around an eventual write path.
- **Default: Option 2 — out of scope now, explicitly not foreclosed.** Reason: "never" is a strong
  claim to make before a single user has held the read-only app, but building for writes now pays
  H4's full cost for a benefit nobody has asked for yet. The concrete obligation this default
  creates is small: keep vault access behind one port with a documented read-only contract.
- **If Tier 2 is ever taken up**, these become mandatory sub-decisions: how a phone mints and
  persists a `DeviceId` that survives reinstall (or deliberately does not); whether it writes
  in-place through the File Provider or writes to a sandbox copy and pushes it back (the latter is
  a guaranteed fork generator); and how the lock-before-switch ritual is expressed in a UI with no
  terminal.

### D-E. Platform and framework

- **Option 1 — native per platform (Swift first, Kotlin later).** Every load-bearing dependency
  here is a native capability: SQLCipher's official mobile builds, libargon2, Keychain access
  control / Android Keystore with `setUserAuthenticationRequired`, the document picker and
  security-scoped bookmarks, app-switcher privacy. Going native removes an entire layer of
  third-party bridge risk on exactly the surfaces §6 says must not weaken. The UI is roughly four
  screens (projects, search, pack, vault info), so the duplication cost is small and mostly not in
  the risky code. *Trade-off:* two codebases eventually; neither is TypeScript, so the repo's
  conventions (`parseX`, `Result`, module layout) do not transfer mechanically.
- **Option 2 — React Native / Expo.** Closest to the team's existing language, one UI codebase,
  and the pieces exist (`op-sqlite` with SQLCipher, an Argon2 bridge, a biometric-capable keychain
  wrapper, a document picker). *Trade-off:* each of those is a community bridge whose crypto
  correctness and maintenance you do not control, sitting exactly on the key-handling path; and a
  JS-visible key means the key crosses the JS bridge in plaintext.
- **Option 3 — Flutter.** One codebase, strong UI story, mature `sqlcipher_flutter_libs`.
  *Trade-off:* Dart is a third language for this project, and the same bridge-trust concern applies
  to crypto plugins.
- **Option 4 — Kotlin Multiplatform: shared core, native UI.** Best structural fit for
  clean-architecture sharing (domain/application in common Kotlin, infra per platform).
  *Trade-off:* the iOS SQLCipher story under KMP is the least-trodden path of the four.
- **Option 5 — one platform only, indefinitely (iOS or Android).** Halves the work; iOS has the
  cleanest iCloud Drive integration and is where much Claude/ChatGPT mobile use sits, Android has
  the friendlier filesystem and the only plausible Tier 3 story.
- **Default: Option 1 (native), iOS first, Android as a separate later advance** — *contingent on
  D-B Option 1 being chosen; under the recommended D-B Option 2 this decision is recorded but not
  acted on.* Reason: the crypto and key-storage surfaces are the ones that must not weaken, and
  native is the only option where they are first-party APIs rather than community bridges. The UI
  savings the cross-platform options offer are real but small relative to that risk.

### D-F. Reuse the TypeScript domain logic, or reimplement?

- **Option 1 — reimplement the pure parts per platform, and make the shared artifact a written
  contract + golden fixtures.** Only a small amount of logic is genuinely shareable: pack
  assembly, the token estimate, the FTS query builder, `classifyLineage`. It is pure, small, and
  fully specified. Conformance is proven by comparing output against committed fixtures, not by
  sharing a runtime. *Trade-off:* the algorithm exists twice; a desktop change can silently
  desynchronise — which is precisely what the conformance fixture is there to catch.
- **Option 2 — embed a JS runtime** (Hermes/JavaScriptCore) and run the compiled TS domain on
  device. True single source of truth for the algorithm. *Trade-off:* ships a JS engine and a
  build pipeline into a security-sensitive app for ~200 lines of pure logic; the infra layer
  (SQLCipher, Argon2id, keychain, files) still has to be native anyway, so the sharing stops
  exactly where the difficulty starts.
- **Option 3 — compile the domain to WASM** and call it from Swift/Kotlin. Same single-source
  benefit, lighter than a JS engine. *Trade-off:* a WASM toolchain and FFI marshalling for logic
  that is trivial to rewrite; TypeScript does not compile to WASM directly, so this implies
  rewriting the domain in a WASM-target language anyway.
- **Option 4 — publish the domain as a package** for reuse. Only helps another JS consumer; a
  native app cannot use it.
- **Default: Option 1.** Reason: the real coupling risk is the **format and the algorithm
  contract**, not the code. Sharing 200 lines of pure functions does not justify a JS engine or a
  WASM toolchain inside an encrypted-vault app, and golden fixtures give the same drift protection
  with no runtime coupling — while also protecting the desktop from accidental changes.

### D-G. On-device crypto binding (SQLCipher + Argon2id)

Two independent bindings, two different risk profiles.

**SQLCipher.** Desktop uses `better-sqlite3-multiple-ciphers` with `cipher='sqlcipher'` and a raw
32-byte hex key. The parameters that must line up between that and any mobile build — and which the
spike (D-B) must confirm rather than assume — are: the cipher scheme's compatibility version, page
size, the KDF algorithm and iteration count used to derive the HMAC key, the HMAC algorithm, the
plaintext-header size, and the raw-key salt convention (a 32-byte raw key supplies no salt, so the
salt is expected to be read from the database file's leading bytes; a mismatch here reads as a wrong
key). Options:
- **Option 1 — official SQLCipher mobile builds (CocoaPods / Maven), parameters pinned explicitly
  on both sides and proven by the golden-vault fixture.** Best-maintained mobile artifact; the
  parameters become a documented part of the contract instead of an implicit default.
- **Option 2 — build the SQLite3MultipleCiphers amalgamation for mobile** so both sides run the
  *same* implementation. Removes the entire mismatch class by construction. *Trade-off:* you own a
  C build for two mobile toolchains, with no vendor-supported binary.
- **Option 3 — change the desktop to a more portable cipher configuration.** Rejected: it touches
  the crypto and the on-disk format of existing user vaults for the convenience of an unbuilt app.
- **Default: Option 1, with Option 2 as the documented fallback if the conformance vector fails.**
  Reason: prefer the maintained mobile artifact, but keep a guaranteed-compatible escape hatch —
  and decide between them on evidence from the spike, not on expectation.

**Argon2id.** No Node runtime on mobile, so the npm `argon2` package is unavailable.
- **Option 1 — link the reference C library (`phc-winner-argon2`) natively.** This is the *same
  implementation* the desktop binds through npm, so identical output is by construction rather than
  by hope. Available on both platforms.
- **Option 2 — a WASM Argon2id build.** Portable across a cross-platform shell. *Trade-off:* slower
  at 64 MiB, and a second implementation to trust on the key path.
- **Option 3 — a platform-native alternative KDF.** Not an option: it would change the derived key
  and break every existing vault.
- **Default: Option 1 (reference C, native).** Also verify that a 64 MiB / t=3 / p=1 derivation is
  acceptable on a low-end phone in the app's main process (it should be; memory-constrained app
  extensions are a different matter and are out of scope), and that a vault created with
  non-default params from `vault.json` is honoured rather than assumed.

### D-H. How the phone reaches the vault file

There is no `VALIJA_HOME` on iOS/Android. This is the decision most likely to be under-estimated.

- **Option 1 — system document picker + security-scoped bookmark, no vendor SDK.** The user picks
  the vault through the Files app / Storage Access Framework; whichever provider they use
  (iCloud Drive, Dropbox, OneDrive, Google Drive, Syncthing folder) is already integrated at the OS
  level. valija makes **no network call and holds no cloud credential** — structurally identical to
  the desktop story where the sync client is a black box. *Trade-off:* provider files can be
  dataless placeholders needing materialisation (M3's documented residual risk), and access is
  subject to bookmark staleness after reinstall.
- **Option 2 — per-vendor mobile SDKs (Dropbox/OneDrive/Google Drive).** Better control over
  download and conflict semantics. *Trade-off:* OAuth, network code, and a cloud credential inside
  valija for the first time — against the product's central claim, and a per-vendor maintenance
  burden. Strongly discouraged.
- **Option 3 — manual one-time import into the app sandbox.** Simplest and most robust; the user
  re-imports to refresh. *Trade-off:* it is not "sync" — a stale vault with no signal that it is
  stale is a worse lie than an occasional materialisation error.
- **Default: Option 1.** *Sub-decision, and the one that matters most for correctness:* under Tier 1,
  **copy the vault to the app sandbox and open the copy read-only**, rather than opening the
  provider file in place. Reason: SQLite's locking and atomicity assumptions do not hold on a File
  Provider URL, partial materialisation mid-read is real, and a read-only snapshot makes it
  *impossible* for the app to mutate a file the user's sync client is watching. The cost is an
  explicit "Refresh from cloud" action and a visible "as of <time>" marker, which is honest UX
  rather than a workaround. If D-D ever turns to writes, this sub-decision must be revisited — a
  snapshot-and-push-back write path is a guaranteed fork generator.

### D-I. Biometric unlock and the on-device session model

Desktop's model: `valija unlock` derives the key and stores it in the OS keychain (not biometry-
gated); `valija lock` or the idle TTL (`VALIJA_AUTOLOCK_MINUTES`, default 15) removes it.

- **Option 1 — no cached key; passphrase on every launch.** Strongest. *Trade-off:* a ~1s Argon2id
  derivation plus passphrase entry every time makes the "quick, paste it into Claude" use case
  unpleasant enough that people stop using it.
- **Option 2 — cache the derived 32-byte key in Keychain/Keystore behind biometric access
  control.** Passphrase entered once at setup; thereafter Face ID/Touch ID/Android biometric
  releases the key. This mirrors desktop's keychain model and is *strictly tighter* than it, since
  desktop's entry is not biometry-gated. Requires: an access-control flag that **invalidates the
  item when the enrolled biometric set changes**, device-only accessibility (never synced to
  iCloud Keychain, never included in device backups), and hardware-backed storage (Secure
  Enclave / StrongBox) where available.
- **Option 3 — cache the passphrase instead of the key.** Worse on both counts: the passphrase is
  the higher-value secret (it also opens the desktop vault), and every unlock pays the full
  Argon2id cost anyway.
- **Default: Option 2**, with these session rules: **lock on backgrounding** (drop the in-memory
  key when the app leaves the foreground), an **idle TTL mirroring desktop's 15-minute default**,
  biometric-set-change invalidation, a **passphrase fallback** if biometrics fail or are
  unenrolled, and **no fallback to a device passcode** silently substituting for biometrics.
  Reason: it matches the desktop mental model, is stronger than it, and keeps the fast path fast.
- **Sub-decisions to confirm:** does the recovery key (64 hex) work as an unlock method on mobile?
  *(Default: yes — it is the documented alternative on desktop; it must never be persisted on the
  device.)* Does the phone get its own configurable TTL, or inherit a fixed 15 minutes?
  *(Default: a simple in-app setting with 15 minutes as the default — there is no env-var
  mechanism on mobile, and the desktop `VALIJA_STATE_HOME` state is deliberately not synced.)*

### D-J. Format/version compatibility and read-only discipline

Mobile becomes a second reader of a schema desktop migrates automatically.

- **Version drift.** Options: *(1)* open only an exactly-known `schema_version`; *(2)* open any
  version **≤** the app's known version read-only, and refuse a newer one with "update the app";
  *(3)* let mobile migrate. **Default: Option 2**, and **never migrate** — migrating from an
  app-store-cadence client, against a file a sync client is replicating, on a device the OS can
  kill mid-write, is the worst place in the system to run a schema change. Refusing a newer vault
  is a clear, honest failure; corrupting one is not.
- **Read-only means read-only.** The reader must not run `journal_mode`/`wal_checkpoint` pragmas
  (desktop's `openVaultDb` does — mobile must not copy that code path), must not run migrations,
  must not bump the lineage stamp, and must not mint a device identity. Under D-H's snapshot
  default this is enforced structurally, not just by discipline.
- **The pre-0.3.0 `-wal` case.** A vault last touched by a 0.2.x desktop can still have a `-wal`
  sidecar holding committed data. A read-only snapshot of `vault.db` alone would then be **silently
  stale**. **Default:** detect a sidecar next to the vault (or a non-`DELETE` journal mode) and
  refuse with a specific message — "open this vault once on your computer with valija 0.3+ first" —
  rather than showing incomplete data. This is a first-class acceptance criterion.
- **Fork/lineage.** A pure reader cannot fork. **Default:** mobile keeps no last-seen record,
  never calls anything equivalent to `recordSeen`, and does not participate in fork detection; it
  may *display* generation/last-writer read-only on a vault-info screen.

### D-K. The clipboard and export surface

Walkthrough step 8 puts a plaintext context pack on the system clipboard. On iOS the pasteboard is
readable by other apps and, with Universal Clipboard, by other signed-in devices.

- **Option 1 — plain copy.** Matches user expectations; maximum exposure.
- **Option 2 — copy with an expiry and local-only scope**, plus a one-time explanatory warning.
  Bounded exposure, no cross-device leak, still one tap.
- **Option 3 — share sheet instead of clipboard.** More explicit destination choice.
  *Trade-off:* more taps, and the receiving app may retain it anyway.
- **Option 4 — no copy at all** (read on screen only). Defeats the entire use case.
- **Default: Option 2**, plus: an app-switcher privacy overlay so the pack does not appear in
  snapshots, no plaintext written to any file or cache, and **no analytics or crash-reporting SDK**
  in the app at all. Reason: the copy is a *deliberate* plaintext export and must be treated as
  one — bounded and explained, not silently maximal.

### D-L. Where the mobile code lives, and how it is governed

- **Option 1 — this repo, top-level `mobile/`.** One place, shared docs and issues.
  *Trade-off:* Node-only CI grows Xcode/Gradle jobs; the npm package's file list and repo size are
  affected; and `guard-implementation.sh` guards `src/**` + `package.json` + build config, so a
  `mobile/` tree would sit **outside** the advance ritual's implementation gate unless the hook is
  extended.
- **Option 2 — a separate `valija-mobile` repo**, with this repo owning `docs/vault-format.md` and
  the conformance fixtures as the contract between them. Clean toolchain and release-cadence
  separation. *Trade-off:* two repos to keep in step; the advance ritual and its hooks live here,
  so the mobile repo needs its own governance decision.
- **Option 3 — a monorepo restructure** (`packages/core`, `packages/cli`, `apps/mobile`). Most
  future-proof. *Trade-off:* a large refactor of a working, published package to serve an app that
  does not exist.
- **Default: Option 2 for any app code; the contract, fixtures, and conformance test stay in this
  repo.** Reason: app-store cadence and Xcode/Gradle CI have nothing to do with the npm package, and
  splitting them keeps this repo's shipping artifact and its guards untouched. **Under the
  recommended D-B default, no app code exists yet, so nothing needs to move now** — this decision
  is recorded so the planner does not improvise it later.
- **If Option 1 is chosen instead**, extending `guard-implementation.sh` to cover the mobile tree is
  a required part of that plan, not an afterthought.

---

## 7. Security surfaces (must not weaken)

1. **Crypto is not negotiable.** Same Argon2id parameters from the same header, same 32-byte raw
   key, same SQLCipher whole-database encryption. No new KDF, no key-format change, no
   re-encryption, no "mobile-friendly" parameter reduction. If mobile compatibility appears to
   require a format change, that is a finding to escalate, not a change to make here.
2. **The plaintext header stays frozen.** `vault.json` gains nothing — not a mobile flag, not a
   device list, not a schema hint. M3 froze it deliberately; a second client is not a reason to
   thaw it. Note that its zod schema *strips* unknown keys, so a well-meant new field would be
   silently ignored by desktop rather than loudly rejected.
3. **No network call, ever, from any valija artifact.** This rules out vendor cloud SDKs, OAuth,
   remote config, analytics, crash reporting, and push. The OS file provider does the syncing;
   valija never talks to it over a network.
4. **The key never leaves secure storage boundaries.** Derived key only (never the passphrase,
   never the recovery key) in Keychain/Keystore, hardware-backed where available, device-only
   accessibility, **excluded from device backups and from iCloud Keychain sync**, invalidated when
   the enrolled biometric set changes, and dropped from memory on backgrounding.
5. **The recovery key is never persisted on a phone.** It may be typed to unlock; it is used and
   discarded.
6. **A read-only client must be provably read-only.** No journal-mode pragma, no migration, no
   lineage bump, no device identity — enforced by opening a sandbox snapshot rather than the live
   file (D-H), so the strongest guarantee is structural rather than a code-review promise.
7. **No silent staleness.** A snapshot must be visibly dated, and a vault with a pre-0.3.0 `-wal`
   sidecar must be refused with a specific message rather than partially displayed. Showing
   incomplete context to a user who is about to paste it into an AI tool is a correctness *and*
   trust failure.
8. **The MCP surface is untouched.** No new tool, no new argument, no new prompt, and **no new
   transport** — the stdio-only non-goal stands, which is why Tier 3 is out.
9. **Plaintext egress is deliberate and bounded.** The clipboard copy is the one intentional
   plaintext export: expiring, local-only, explained once, never written to a file or cache, and
   never captured in an app-switcher snapshot.
10. **The desktop threat model is unchanged and must stay documented as such.** `docs/SPEC.md` §9's
    "does not protect against" list gains an honest entry about a phone being a second device
    holding the key, if and when an app ships.

---

## 8. Acceptance criteria (reviewer checklist)

**Applies under every option**
- [ ] `refined.md` and every document it touches assign **no milestone number** to mobile work
      until D-A is answered; the final `docs/SPEC.md` edit matches D-A's chosen option, including
      the §2 "Out" line that currently reads "mobile client → explicitly rejected / not scheduled".
- [ ] No change to `vault.json`'s schema, to the Argon2id parameters, to the key format, or to the
      SQLCipher configuration used by the desktop client.
- [ ] The MCP surface is byte-for-byte unchanged: same 5 tools, same arguments, same 2 prompts,
      stdio only.
- [ ] No network call, no telemetry, no analytics, and no cloud SDK is added to any artifact.
- [ ] `npm run typecheck && npm run lint && npm run test` pass; any behaviour change in `src/` is
      reflected in the matching `specs/*.md` in the same commit.

**Under the recommended default (D-B Option 2 — contract + conformance + spike)**
- [ ] `docs/vault-format.md` exists and specifies, precisely enough to implement against without
      reading `src/`: the exact SQLCipher parameter set and the raw-key convention; the Argon2id
      parameters and where they come from; the `vault.json` schema including the unknown-key
      stripping behaviour; the schema-v3 tables including the FTS5 external-content triggers and
      the `meta` lineage rows; the pack-assembly algorithm including the token estimate, the
      over-budget pinned rule, and the section order; the markdown rendering; the FTS query
      construction including quote-escaping; and the rule that `imported` items are searchable but
      never in a pack.
- [ ] `docs/vault-format.md` states the **read-only contract** explicitly: no journal-mode pragma,
      no migration, no lineage bump, no device identity — and the required behaviour on an unknown
      `schema_version` and on a pre-0.3.0 `-wal` sidecar.
- [ ] A committed golden vault fixture plus expected rendered pack and expected search results
      exist, and a test proves the current desktop implementation reproduces them byte-for-byte —
      i.e. a future change to the pack algorithm or the markdown renderer fails the build.
- [ ] The fixture's key/passphrase is a published test value, clearly marked as such, and the
      fixture contains no real user content.
- [ ] The compatibility spike is reported with a **pass/fail** answer to: can an official SQLCipher
      mobile build open the golden vault with a raw 32-byte key, and does a native/WASM Argon2id
      reproduce the same 32 bytes from the same passphrase, salt, and parameters? On pass, the exact
      parameter set is recorded in `docs/vault-format.md`; on fail, the divergent parameter is named
      and D-G's fallback is triggered.
- [ ] The spike leaves no mobile toolchain, dependency, or CI job in this repo.

**Additional criteria if a Tier 1 app is in scope (D-B Option 1)**
- [ ] The app renders a context pack **byte-identical** to `valija export` for the same vault and
      project, including section order, the over-budget pinned rule, and imported-items exclusion.
- [ ] Search results match `valija search` for the same query, including quote-escaping behaviour.
- [ ] The app never writes to the user's vault file: verified by opening a read-only snapshot and
      by comparing the source file's bytes and mtime before and after a full session.
- [ ] A vault with a `-wal` sidecar or a newer `schema_version` is **refused with a specific,
      actionable message**, never partially displayed.
- [ ] The derived key is stored biometry-gated, device-only, excluded from backups and keychain
      sync, invalidated on biometric enrollment change, and dropped from memory on backgrounding;
      the passphrase and recovery key are never persisted.
- [ ] Idle TTL locks the app; the passphrase fallback works when biometrics are unavailable.
- [ ] The clipboard copy is local-only with an expiry, warned once; the app-switcher snapshot shows
      no context content; no plaintext is written to any file or cache.
- [ ] The app makes zero network requests (verified with the network disabled and by inspecting the
      binary's declared capabilities); the vault is reached only through the system document picker.
- [ ] The phone does not appear as a device on the desktop: after a full mobile session,
      `valija status` / `doctor` show an unchanged generation and last writer.
- [ ] `docs/SPEC.md` §9 gains an honest entry describing the phone as a second device holding the
      key.

---

## 9. Deliverables summary (for the planner, not a plan)

Under the recommended defaults (D-A Option 3, D-B Option 2, D-C Tier 1, D-D deferred): a new
`docs/vault-format.md` capturing the crypto parameters, header schema, schema-v3 tables, pack
algorithm, markdown rendering, FTS query construction, and the read-only contract for a second
implementation; a committed golden-vault fixture with expected pack markdown and expected search
results, plus a conformance test that holds the *desktop* to them; a compatibility spike report
answering whether an official SQLCipher mobile build and a native Argon2id can open that fixture,
with the working parameter set recorded or the divergence named; and the `docs/SPEC.md` roadmap and
"Out"-list edits that D-A selects. No `src/` behaviour change is expected; no mobile toolchain,
dependency, or CI job lands in this repo.

If Gate R instead selects a shipping Tier 1 app (D-B Option 1), the deliverable set changes
completely and D-E, D-H, D-I, D-K, and D-L all become binding immediately — that is a different,
much larger advance, and the planner should be re-briefed rather than asked to stretch this one.

---

## 10. Biggest risk

**This idea's viability rests on a binary compatibility fact nobody has tested: whether an official
SQLCipher mobile build can open a vault written by `better-sqlite3-multiple-ciphers`' `sqlcipher`
cipher scheme using a raw 32-byte key.** If the cipher parameters diverge in any respect — page
size, HMAC algorithm, the KDF iterations used for the HMAC key, the plaintext-header size, or the
raw-key salt convention — the phone reports "wrong passphrase" against a perfectly valid vault, and
the only remedies are to own a C build for two mobile toolchains or to change the on-disk format of
every existing user's vault. Every other decision here (framework, tiers, biometrics, file access,
distribution) is a design trade-off that can be revisited; this one can invalidate the feature. That
is the direct argument for the recommended D-B default: answer this with a fixture and a spike
before committing to an app.

The secondary risk is **scope shape rather than technology**: mobile is a second implementation on a
second toolchain with a third-party release gate, and it does not fit the advance ritual that has
carried M0–M3. Treating it as "one more advance" is how it becomes an unreviewable, unfinished
branch. The third risk is **quiet erosion of the product's central claim** — a vendor cloud SDK for
convenience, an analytics SDK "just for crashes", a plaintext cache for speed — each individually
defensible, collectively turning a local-first encrypted vault into an ordinary cloud app.
