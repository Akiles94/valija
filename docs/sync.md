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

> How it works: [Use one vault on several devices](guide/flows/multi-device-sync.md)

**On device A, when you're done:**

```
valija lock
```

`lock` does more than drop the session key — it verifies the vault is at rest as a single,
self-consistent file (no `-wal`/`-shm`/`-journal` sidecars) and prints a confirmation:

```
Vault locked. On-disk state: single file (vault.db), generation 42, last written by this device (01J8F2WX9A…).
Safe to let your sync client finish before opening valija elsewhere.
```

The short id after `this device` / `another device` is a prefix of the writing device's id — it's
what lets you tell a normal two-device handoff from a genuine three-way fork. If instead there are
stray sidecar files, `lock` says so plainly ("NOT safely at rest") rather than claiming a single
file — so the reassuring line only ever appears when it's actually true.

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

> **OneDrive users:** OneDrive doesn't append "conflicted copy" — it renames the losing file to
> `vault-<HOSTNAME>.db`. That's indistinguishable from an ordinary file, so `doctor` can't flag it
> automatically. If you're on OneDrive and `unlock` reports a fork, look for a `vault-<hostname>.db`
> sitting next to `vault.db` yourself. Dropbox, iCloud Drive, and Syncthing conflict names *are*
> detected.

## After a valija upgrade

The first command you run against a vault created by an older valija migrates its database in place.
Before touching your data it writes a one-time encrypted backup beside it — `vault.db.pre-003.bak` —
and deletes it automatically once the upgrade succeeds. If you ever see a `vault.db.pre-NNN.bak`
still sitting in the folder, the upgrade didn't finish cleanly: your current `vault.db` opened fine
(that's how you got here), so once you've confirmed your data is intact you can delete the `.bak`.
`valija doctor` points out a lingering one. If your vault is in a synced folder, delete it on one
device and let that deletion sync, like any other change.

## Changing your passphrase on a synced vault

> How it works: [Change the passphrase](guide/flows/change-passphrase.md)

`valija change-passphrase` (or **Settings → Vault & sync → Change passphrase…** in the desktop app)
re-encrypts the whole `vault.db` under a new key. `vault.json` does not change. The re-encryption is
itself a write, so it bumps the generation like any other. Do it as part of the ritual:

1. On every **other** device: `valija lock`, then wait for your sync client to show "up to date".
2. On this device: `valija change-passphrase`. In a synced folder it asks you to confirm step 1
   (`[y/N]`, or `--yes`); it always asks for your current passphrase (or `--recovery-key`) and the
   new one twice, then prints your **new** recovery kit once. This device stays unlocked.
3. Wait for the sync client to upload the new `vault.db`.
4. On each other device: `valija unlock` with the **new** passphrase. It fast-forwards to the new
   generation as usual.

**What another device sees.** If it was still unlocked, its next command or MCP call gets
`VAULT_LOCKED`: the old key no longer opens the file, so valija drops it from that device's keychain.
`valija unlock` with the old passphrase gives `error [WRONG_PASSPHRASE]` plus a hint that the
passphrase may have been changed on another device; the old recovery kit fails the same way. SDK
products that opened the vault with a passphrase (Mode P) also get `VAULT_LOCKED` on their next call.

**If you skipped step 1: a reverted change.** Say device B was not synced and wrote offline under the
old key while you changed the passphrase on A. Your sync client keeps one `vault.db` and makes a
conflicted copy of the other. If **B's** file wins, the change is silently undone for the folder: your
new passphrase gives `WRONG_PASSPHRASE` and the old one opens the vault again. Lineage tells you this
happened: unlocking on A with the old passphrase reports a fork (`VAULT_FORK_DETECTED`), because A
remembers the generation its re-encryption wrote and the file now holds a different write at that
generation. To fix it, resolve the fork as above (the conflicted copy is the one under the **new**
key), then change the passphrase again.

**Old copies keep the old secret.** A passphrase change protects the vault file from now on. It does
not touch copies made before: conflicted copies, OneDrive's `vault-<hostname>.db`, `*.pre-NNN.bak`
migration backups, your sync client's **version history**, OS backups (Time Machine and the like), and
any copy someone already took. All of those still open with the old passphrase and the old recovery
kit. If you believe the old passphrase leaked, also purge the vault's version history in your sync
client where the vendor allows it, and delete the leftover copies once you've resolved them — valija
never deletes them for you. Deleting a file is not secure erase: on SSDs and in cloud storage the old
bytes may survive, so treat the old secret as burned. In one sentence: **a passphrase change limits a
leaked secret to the copies that existed before the change; it does not undo past exposure.**

**The rekey backup.** Before re-encrypting, valija writes `vault.db.pre-rekey.bak` beside `vault.db` —
a ciphertext copy under the **previous** key — and deletes it once a fresh connection has verified the
new file. You should never see it. If you do, the change was interrupted (a crash or power loss):
`valija status`, `valija doctor`, and the desktop Sync panel and Diagnostics flag it as "encrypted with
your PREVIOUS passphrase/key", and while it sits there the folder counts as unsettled, so another
passphrase change or a move is refused.
- If `valija unlock` works with your **current** passphrase (old or new, whichever opens it), your
  vault is fine: delete the `.bak`. In a synced folder, delete it on one device and let that sync.
- If neither passphrase opens `vault.db`, restore the backup, which opens with the **old** passphrase:
  with valija closed everywhere, delete `vault.db-journal` if it exists, then rename
  `vault.db.pre-rekey.bak` to `vault.db` (replacing it), and `valija unlock` with the old passphrase.
  Delete the journal **first**: a journal left beside the restored file would be rolled into it.

## Idle auto-lock

> How it works: [Idle auto-lock](guide/flows/idle-auto-lock.md)

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
