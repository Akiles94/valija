# M4(?) — Mobile companion for valija · Raw idea

**Status:** Idea capture only — not refined, not planned, not for Gate R yet.
**Milestone number is tentative.** `docs/SPEC.md` §2 currently assigns M4 to
"Scoped profiles, per-tool visibility" and M6 to "Multi-device sync, mobile."
M3's refined spec (D-H) proposes reshuffling the roadmap once M3 ships. This
idea should be renumbered to whatever slot the post-M3 roadmap actually has
open for it — do not assume it is literally M4 until that reshuffle happens.

---

## Why

Desktop-only caps how much of "your context follows you everywhere" actually
lands, since most Claude/ChatGPT usage also happens on mobile. But valija's
core value (local-first, end-to-end encrypted, no cloud) is worth protecting
even on mobile, not trading away for reach.

## Depends on

M3's BYO-cloud sync groundwork specifically enables this:
- **D-A (single-file-at-rest journaling)** — any reader, including a mobile
  app, can safely open the vault straight out of a synced folder without
  understanding SQLite WAL/`-shm` coordination.
- **Deterministic key derivation unchanged** — same passphrase still derives
  the same key on any device.
- **D-B/D-C lineage + device-identity model, exposed as a port (D-F)** — a
  mobile client can plug in as a new `DeviceIdentity` adapter (its own device
  id, its own local last-seen state) instead of fighting a desktop-only
  assumption, *if* it ever writes.

M3 explicitly does **not** build any of this (§5 Out: "no GUI, no mobile
client"). This idea is the follow-on.

## Shape — three tiers, increasing risk/dependency on things outside this codebase

**Tier 1 — Read-only companion (the realistic MVP).** Native iOS/Android app
opens the same synced SQLCipher vault, decrypts locally, no MCP server, no
write path.
- Needs: SQLCipher native mobile build (exists officially), Argon2id
  native/WASM on-device implementation (no Node.js runtime on mobile), key
  cached behind biometrics via iOS Keychain / Android Keystore (same pattern
  as password-manager apps), vault location via iCloud Drive (native) or
  Dropbox/OneDrive/Google Drive (their own mobile SDKs, not a raw
  `VALIJA_HOME`-style path).
- User flow: install → point at the same synced folder/account → unlock with
  Face ID/Touch ID → browse/search projects → tap a project → see the
  rendered context pack (same content as `valija export`) → Copy → paste into
  Claude/ChatGPT mobile.
- No fork risk: read-only, no lineage writes.

**Tier 2 — Mobile can save too.** Adds `save_context`-equivalent from the
phone. This is where the phone becomes a real "device" in M3's fork-detection
scheme and needs its own `DeviceIdentity` adapter, inheriting the same
lock-before-switch / fork-warning discipline as two desktops would.

**Tier 3 — Automatic tool-calling (stretch, largely outside our control).** A
local MCP-over-loopback-HTTP server on the phone, added as a custom connector
in Claude/ChatGPT mobile — the "exactly like desktop" dream. Blocked on two
things this codebase does not control: whether those mobile apps' connector
UI accepts a loopback URL at all, and whether the OS lets the server survive
backgrounding (Android's foreground-service model is plausible; iOS
background-execution limits are the hard case). Revisit only if those
platforms open up — do not design around it now.

## Not decided / not scoped yet

Everything: which tier to build first beyond "Tier 1 is the sane start," what
framework (native Swift/Kotlin vs. a cross-platform shell), whether to reuse
any of valija's TypeScript domain logic or reimplement per-platform, how
Argon2id/SQLCipher get bound on-device, exact biometric-unlock session model,
whether Tier 2 ships at all. This file exists so the idea isn't lost — it is
not a spec and should go through `task-refiner` (Gate R) before any of this
is treated as planned work.
