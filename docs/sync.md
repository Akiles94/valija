# Syncing your vault across devices (BYO-cloud)

valija has no backend and makes no network calls, ever. To use the same vault on a laptop
and a desktop, put it in a folder a sync client you already trust replicates — Dropbox,
iCloud Drive, OneDrive, Google Drive, Syncthing, whatever you use. valija only ever talks
to the local filesystem; the sync client is a black box to it.

## Setup (once per device)

Point `VALIJA_HOME` at a folder your sync client watches, then init (or move an existing
vault there):

```
export VALIJA_HOME="$HOME/Dropbox/valija"     # or ~/Library/Mobile Documents/... for iCloud
valija init
```

Do this **once per device**, using the **same** synced path. The passphrase, salt, and KDF
params live in the plaintext `vault.json` header, which syncs alongside `vault.db` — so the
same passphrase derives the same key on every device. Nothing about unlocking changes.

## The ritual: lock, wait, unlock

**On device A, when you're done:**

```
valija lock
```

`lock` does more than drop the session key — it verifies the vault is at rest as a single,
self-consistent file (no `-wal`/`-shm`/`-journal` sidecars) and prints a confirmation:

```
Vault locked. On-disk state: single file (vault.db), generation 42, last written by this device.
Safe to let your sync client finish before opening valija elsewhere.
```

Wait for your sync client to show "up to date" — valija isn't involved in this step and
doesn't watch for it.

**On device B:**

```
export VALIJA_HOME="$HOME/Dropbox/valija"     # same synced path
valija unlock
```

A clean handoff adopts silently — you just continue where device A left off. `valija status`
shows the current generation and who wrote it last, if you want to confirm.

**Why you don't have to remember this perfectly:** every valija command — not just
`lock` — leaves the vault as a single file at rest the moment it returns. The ritual above is
about *waiting for sync to finish*, not about making the file safe to copy; that part is
already true after everything you do.

## If you skip the ritual: fork detection

If you edit on two devices before either syncs, your sync client can only keep one copy — it
has no idea how to merge two SQLCipher databases, and neither does valija. What valija *can*
do is detect that this happened and refuse to pretend nothing did:

```
error [VAULT_FORK_DETECTED]: This vault was changed on another device from the same
starting point (generation 42). Your sync client may have kept only one copy; changes made
on the other device may be in a "conflicted copy" file in <folder>. valija has not deleted
anything. Run "valija doctor" to inspect.
```

The vault still unlocks — the warning doesn't strand you — but valija leaves everything on
disk untouched. To resolve it:

1. Look in the vault folder for a file your sync client dropped, usually named something
   like `vault (conflicted copy).db`, `vault.sync-conflict-2026-07-23.db`, or similar.
2. Both the current `vault.db` and the conflicted copy open with your **same passphrase** —
   they're just two divergent points in the same vault's history.
3. Decide which one has what you need. There's no automatic merge: pick a copy to keep as
   `vault.db`, and if you need something from the other, open it (point `VALIJA_HOME` at a
   temporary copy of it) and re-save that context by hand.
4. `valija doctor` flags a conflicted-copy file if one is still sitting in the vault folder,
   so you don't lose track of it.

## Idle auto-lock

By default, an unlocked vault automatically re-locks itself after **15 minutes** of
inactivity — the key is dropped from the OS keychain the next time any command runs after
the timer elapses (there's no background process, so it's the *next* command that notices,
not a live timer). This narrows how long a walked-away, unlocked laptop is exposed.

Configure or disable it with an environment variable:

```
export VALIJA_AUTOLOCK_MINUTES=30   # change the timeout
export VALIJA_AUTOLOCK_MINUTES=off  # disable it (0 also works)
```

`valija status` and `valija doctor` show the effective TTL and how long the vault has been
idle.

## What sync/lineage data is, and isn't

The generation counter, write stamp, device id, and activity timestamps are **plumbing for
humans and for safety** — they show up in `status`, `lock`, `unlock`, and `doctor` output
only. They never appear in a context pack (`get_context`, `export`), never reach an MCP tool
response, and no model ever sees them. Device identity and activity timestamps live in a
separate, **device-local** location (`VALIJA_STATE_HOME`, default `~/.valija-state`) that is
never inside your synced vault folder — so they never sync between devices, by design.

## What this does not do

- **No real-time collaboration.** The supported model is strictly sequential — used on A,
  then B, not both at once.
- **No automatic conflict merge.** Ever, by design (see above).
- **No mid-sync detection.** valija doesn't try to guess whether your sync client is still
  uploading; it relies on the client's own "up to date" indicator, and on fork detection as
  the safety net if you don't wait.
- **No valija-hosted sync service.** Nothing here talks to a valija server, because there
  isn't one.
