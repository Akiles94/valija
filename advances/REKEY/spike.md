# REKEY — Slice 0 spike: is in-place `PRAGMA rekey` crash-safe under `DELETE`?

**Verdict: NO-GO for D-E 1 as written in the plan.** Two pass criteria fail:

- **S7 produced `neither` outcomes** (9 of 72 mid-rekey kills on S, M and L; 9 of the 12 that landed in the commit window). The cause
  is deterministic, not flaky. `PRAGMA rekey` writes a **new random cipher salt** into page 1, and
  the raw-key form takes its salt from the file's first 16 bytes. Once page 1 reaches disk while the
  rollback journal is still hot, the OLD key derives the wrong page keys, so it cannot read the
  journal it would need to roll back. The NEW key cannot either, because the journal pages are
  encrypted with the OLD key. Only the backup recovers the vault.
- **S9 does not roll back cleanly.** When the rekey fails with a write error (`SQLITE_FULL`,
  `SQLITE_IOERR_WRITE`) after the page cache has spilled, SQLite3MultipleCiphers rolls back
  **while the write cipher is still the NEW key**. The original pages go back to disk encrypted
  with the NEW key, and the pages not reached yet stay encrypted with the OLD key. The result is a
  `vault.db` that opens with neither key (`SQLITE_NOTADB` for OLD, `SQLITE_CORRUPT` for NEW). The
  same connection reads `SQLITE_CORRUPT` afterwards.

Every `neither` case was recovered by the D-E backup (S8): **no data was lost in any run.** But the
plan's invariant ("afterwards it opens with exactly one of the two keys") does not hold for
`vault.db` itself. Per P-1 (a), **Slice 1 must not start** until Oscar picks the way forward.

**The spike also found a variant that passes every criterion** ("D-E 1′", §Recipe):
- `PRAGMA rekey = "x'<64-hex NEW key><32-hex CURRENT salt>'"`: the raw-key-plus-salt form keeps the
  cipher salt, so the OLD key can always roll back a hot journal
- `PRAGMA cache_spill = OFF` before the rekey, so no page reaches `vault.db` before the journal is
  complete and synced, and a write failure rolls back with nothing to undo

D-E 1′ ran 0 `neither` and 0 integrity or checksum failures over 124 kills (S, M and
L), including 22 kills inside the commit window, where the plan's recipe failed 9
times out of 12. Its S9 runs rolled back cleanly every time (8 of 8). It costs about 1.3× the database size in RAM
during the rekey (§S6). The choice between D-E 1′ and the plan's D-E 2 fallback is a decision for
Oscar (§Decision).

---

## Environment

| | |
|---|---|
| Library | `better-sqlite3-multiple-ciphers` 12.11.1 |
| Cipher library | SQLite3 Multiple Ciphers 2.3.5 (`SQLITE3MC_VERSION_STRING`) |
| SQLite | 3.53.2 (`sqlite_version()`) |
| Node | v22.22.0 |
| OS | Linux 6.18 x86_64, 4 vCPU, 15 GB RAM, virtio disk (`/dev/vda`), ext4-class root fs |
| Runner | cloud container. Not the developer's laptop: absolute times are indicative only (A1) |

Scripts lived in the session scratchpad (`rekey-spike/`) and are not committed, as the plan says.
They are plain CJS. `openVaultDb` and `migrate` came from the real `src/shared/infra` code, bundled
with `tsup` (F20). The child runs the plan's Slice 3 recipe and prints a marker before each step.

## S1. Fixtures

Each vault was built through `openVaultDb` + `migrate` (schema v4), with a random 64-hex key. Rows
were inserted into the real tables (FTS triggers fire): 40 projects, 40 folder bindings, and items
of 300–900 random words from an 8 000-word vocabulary. Three marker terms were seeded for the FTS
counts.

| Fixture | Items | Pages | File size | Content checksum | FTS counts (`sqlcipher`, `handoff`, `zebrafish`) |
|---|---|---|---|---|---|
| **S** | 2 200 | 5 419 | 22.2 MB | `3036a614519316a7` | 149 / 164 / 163 |
| **M** | 21 600 | 51 608 | 211.4 MB | `087e66963444d97b` | 1563 / 1542 / 1579 |
| **L** | 133 400 | 315 125 | 1 290.8 MB | `2fe1756358ad50c6` | 9530 / 9595 / 9616 |

L crosses the 1 GiB lock-byte page (page 262 145 at 4 KiB pages). Disk was sufficient (30 GB free),
so **L was not scaled down**.

The checksum is the sha256 (first 16 hex digits are shown) over:
- every row of `projects`, `context_items` and `project_bindings`, in id order
- `meta` minus the `lineage_*` keys
- the three FTS `MATCH` counts

The lineage generation is checked separately: 0 before the rekey, and 1 once the bump has
committed. Both are accepted after a kill. "Content intact" in the tables below means that
`integrity_check` is `ok`, the checksum is equal, and the generation is 0 or 1.

## S2. Syntax and format

On S: open with `key="x'OLD'"`, run `PRAGMA rekey="x'NEW'"`, then close.

| Check | Result |
|---|---|
| Fresh connection with `key="x'NEW'"` | opens, `integrity_check` `ok`, checksum equal, FTS counts equal |
| Same file through `openVaultDb(path, NEW)` | opens, schema version 4 |
| `key="x'OLD'"` | `SQLITE_NOTADB` |
| `vault.db-journal` after a normal close | absent |
| First 16 bytes before → after | `41FF0848…6B46A75` → `D3A331CE…EB05AB4` |
| `PRAGMA cipher_salt` after | `D3A331CEB9B9265B791901FC4EB05AB4`, equal to the new first 16 bytes |

**The cipher-salt fact (for vault-format §5): a plain `PRAGMA rekey="x'<64 hex>'"` replaces the
file's cipher salt with a new random one.** This is in the source, too
(`GenerateKeySQLCipherCipher`: `if (rekey || cipherSalt == NULL) chacha20_rng(m_salt…)`). The
"first 16 bytes = `cipher_salt`" convention still holds afterwards, so the §11 recipe keeps
opening the file. But the salt is **not** a stable property of a vault across a passphrase change.
The salt-preserving form `x'<64 hex key><32 hex salt>'` keeps it byte for byte (see D-E 1′ below;
tested: salt before = salt after = `41FF084843887A3DB4EDEB8F66B46A75`, and the file then opens with
the plain 64-hex `x'NEW'`).

**vault-format §5 pragma table after the rekey.** It was read on a fresh connection, and again on
the same connection right after the rekey:

| Pragma | Before | After |
|---|---|---|
| `cipher` | `sqlcipher` | `sqlcipher` |
| `page_size` | 4096 | 4096 |
| `kdf_iter` | 256000 | 256000 |
| `fast_kdf_iter` | 2 | 2 |
| `hmac_use` | 1 | 1 |
| `hmac_pgno` | 1 | 1 |
| `hmac_salt_mask` | 58 | 58 |
| `kdf_algorithm` | 2 | 2 |
| `hmac_algorithm` | 2 | 2 |
| `plaintext_header_size` | 0 | 0 |
| `legacy` | 0 | 0 |
| `legacy_page_size` | 4096 | 4096 |
| `cipher_salt` | file-specific | **changes** with the plain form, **unchanged** with the salt-preserving form |

Every fixed row of the table is unchanged, and the `x'…'` recipe opens the rekeyed file. **This
criterion passes.**

**The F4 pitfall is confirmed:**

| Rekey call (on a copy) | Return | `key="x'NEW'"` opens it? | What does open it |
|---|---|---|---|
| `db.rekey(Buffer.from(NEW,"hex"))` | `0` | **no**, `SQLITE_NOTADB` | `hexkey='NEW'` or `db.key(Buffer)`: the 32 bytes act as a passphrase |
| `PRAGMA hexrekey='NEW'` | `[{ok:"ok"}]` | **no**, `SQLITE_NOTADB` | `hexkey` / `db.key(Buffer)` |
| `PRAGMA rekey='NEW'` (64 hex, no `x'…'`) | `[{ok:"ok"}]` | **no** | nothing except the same 64-char string used as a passphrase |
| `PRAGMA rekey="x'NEW'"` | `[{ok:"ok"}]` | **yes** | the vault-format recipe |

Every one of the wrong forms "succeeds" and leaves a vault that the vault-format recipe cannot open.
The source-scan test (only `rekey="x'…'"`) is required.

## S3. Return shape

- **Success:** `db.pragma(\`rekey="x'…'"\`)` returns `[{ ok: "ok" }]`. With `{ simple: true }` it
  returns `"ok"`.
- **Failure throws `SqliteError`.** It never returns an error row. Codes seen:
  - `SQLITE_ERROR` "Rekeying is not supported in WAL journal mode."
  - `SQLITE_READONLY` (read-only connection)
  - `SQLITE_FULL` (ENOSPC)
  - `SQLITE_IOERR_WRITE` (EFBIG)
- **A malformed value is not rejected.** `rekey="x'zz'"` returned `[{ok:"ok"}]` and re-keyed the
  file under the literal passphrase `x'zz'`, so OLD no longer opens it. **The adapter must run
  `assertKeyHex` on the new key before the pragma.** The `{ok:"ok"}` check is defensive only.

## S4. Rekey inside an explicit transaction (F5, P-3)

The test ran `BEGIN IMMEDIATE`, then `UPDATE meta …`, then an `INSERT` marker row, then
`PRAGMA rekey="x'NEW'"`:
- the pragma returned `[{ok:"ok"}]`, and `db.inTransaction` was still `true`
- `COMMIT` returned ok
- on reopen, OLD gave `SQLITE_NOTADB`, NEW gave `integrity_check` `ok`, and the marker row was
  present

So the engine does **not** refuse this, and the outer writes landed. That is contrary to F5's
reading. The behaviour is undocumented, though, and was not kill-tested. Nothing here argues for
leaving **P-3 (a)**, the bump in its own `IMMEDIATE` transaction before the backup. Every kill run
below used P-3 (a).

## S5. Locking (P-2) and the leftover `vault.db-journal` (F6)

The recipe opened through `openVaultDb`, then ran `locking_mode = EXCLUSIVE`,
`BEGIN EXCLUSIVE; COMMIT`, the bump, the copy plus fsync, and the rekey. A worker-thread connection
(5 s busy timeout) tried to read the whole time:

| Moment | Worker (OLD key) | S | M |
|---|---|---|---|
| During the backup copy (lock held) | `SQLITE_BUSY` after 5.01 s | yes | yes |
| During the rekey | `SQLITE_BUSY` after 5.01 s (M). On S the rekey (0.8 s) ended first, then the worker got `SQLITE_NOTADB` | NOTADB at 0.83 s | BUSY |
| After close | `SQLITE_NOTADB` (NEW key: ok) | yes | yes |

The held lock works: nothing can commit between the backup and the rekey.

**The `vault.db-journal` lifecycle under `locking_mode = EXCLUSIVE`:**

| After | Journal |
|---|---|
| `BEGIN EXCLUSIVE; COMMIT` | absent |
| the bump commits | **present**, 8 720 B, header zeroed (cold) |
| the rekey commits (lock still held) | **present**, ≈ db size (S 22.2 MB, M 211.8 MB), header zeroed (cold) |
| `locking_mode = NORMAL` + one read, before close | **absent** |
| a plain `close()`, with no remedy | absent |
| one more normal open | absent |

F6 is confirmed. In EXCLUSIVE mode SQLite keeps the journal file and zeroes its header instead of
deleting it, until the lock is released.

**The chosen remedy, as in the plan:** `db.pragma("locking_mode = NORMAL")`, then
`db.prepare("SELECT count(*) FROM sqlite_master").get()`, then `db.close()`. It deletes the journal
while the adapter is still in control. A plain close also deletes it on Linux. The read-based remedy
is kept because it is deterministic and does not rely on close-time behaviour.

**A crash inside the lock window leaves a cold journal behind.** A kill between the bump and the
release leaves a **cold** (zero-header) `vault.db-journal`:
- 8 720 B at `BUMPED`, `BACKED_UP` or `REKEYING`
- ≈ db size at `REKEYED`

It is harmless to correctness: it is not hot, both the S8 restore and a later open ignore it, and it
was never rolled back by mistake in any run. But it is **sticky**. Measured after a kill at
`REKEYED`:
- it survives a read-only open, `openVaultDb`, an `openVaultDb` plus a read, and a no-op `UPDATE`
- it disappears on the **first real committed write**
- it also disappears on `journal_mode = PERSIST` followed by `journal_mode = DELETE`

Until then, `FileVaultFolder` reports it as a stray `-journal` sidecar (`SIDECAR_SUFFIXES`).
`doctor` and `status` warn, and the folder-settled rule (D-I) would refuse a retry. **Slice 3
remedy for crash leftovers:**
- after `openVaultDb`'s first read (which has already rolled back any hot journal), a remaining
  `-journal` is necessarily cold
- `settleJournal` (or the rekeyer's `openExclusively`) can delete it with the
  `PERSIST` → `DELETE` toggle

This takes one line plus a test, and needs no new P-decision. It is not required for safety.

## S6. Cost (D-P, P-8, P-21)

Each run was a full recipe with no kill. The parent polled every 10 ms.

| Fixture | db | backup copy + fsync | rekey | release | verify (open + `integrity_check`) | total | peak `-journal` | peak folder (db + backup + journal) |
|---|---|---|---|---|---|---|---|---|
| S | 22.2 MB | 0.05 s | 0.44 s | 0.03 s | 0.33 s | 0.9 s | 22.2 MB (1.002×) | 66.6 MB (3.002×) |
| M | 211.4 MB | 2.1 s | 5.9 s | 0.16 s | 3.9 s | 12.3 s | 211.8 MB (1.002×) | 634.6 MB (3.002×) |
| L | 1 290.8 MB | 11.4 s | 37.5 s | 1.1 s | 23.6 s | 74.8 s | 1 293.3 MB (1.002×) | 3 874.8 MB (3.002×) |

- **Space.** The journal is 1.002× the db, and `vault.db` itself does not grow. The **extra free
  space needed is therefore ≈ 2.0× the db size** (backup + journal). P-8 (a)'s
  `REKEY_SPACE_FACTOR = 3` (× db size, compared with free space) leaves ≈ 1× slack. **Keep 3.**
- **Verify (P-21).** `integrity_check` costs about 60% of the rekey time (24 s on 1.3 GB).
  Acceptable. Keep P-21 (a).
- **D-E 1′ cost.** `cache_spill = OFF` keeps every dirty page in memory until the commit:
  - peak RSS on M was **269 MB**, against 69 MB for the plain form (≈ 1.3× db). On L that
    extrapolates to ≈ 1.7 GB.
  - the rekey time on M was 6.7 s against 5.0–5.9 s, so roughly unchanged
  - the salt-preserving form alone does not change the cost (69 MB, 4.6 s)

## S7. Kill matrix (the go/no-go)

The child ran the recipe and printed a marker before each step:
`LOCKED → BUMPED → BACKED_UP → REKEYING → REKEYED → RELEASED → VERIFIED → DONE`.

`RELEASED` (the S5 remedy, then close) is a seventh boundary, added to the plan's six. There are
two kinds of kill:
- **S7a (stage boundaries).** The child pauses at the marker and is `SIGKILL`ed there.
- **S7b (mid-rekey).** `SIGKILL` lands a uniformly random delay after `REKEYING`, over the measured
  rekey duration. That makes some kills land after `REKEYED`, which is useful coverage.

After every kill, the parent classified the folder:
1. if a `-journal` exists, the **first** open uses the **NEW** key (S7c)
2. then an open with OLD, then an open with NEW. Each open runs `integrity_check` and the checksum.
3. then the backup, if present, is opened with OLD

The `S7b-oldfirst` rows skip step 1 and open with OLD first (the F3 path).

### The plan's recipe (D-E 1 as written: `rekey="x'NEW'"`)

| Fixture | Set | Runs | Killed mid-rekey | Hot journal at kill | …of which in the commit window¹ | old-only | new-only | **neither** | integrity / checksum failures |
|---|---|---|---|---|---|---|---|---|---|
| S | S7a (7 boundaries × 3) | 21 | – | 0 | – | 12 | 9 | 0 | 0 |
| M | S7a (7 boundaries × 3) | 21 | – | 0 | – | 12 | 9 | 0 | 0 |
| S | S7b, NEW first | 30 | 29 | 16 | 7 | 25 | 1 | **4** | 0 |
| S | S7b, OLD first | 10 | 10 | 9 | 3 | 7 | 0 | **3** | 0 |
| M | S7b, NEW first | 30 | 25 | 23 | 1 | 24 | 5 | **1** | 0 |
| M | S7b, OLD first | 10 | 7 | 7 | 0 | 7 | 3 | 0 | 0 |
| L | S7b, late² | 4 | 1 | 1 | 1 | 0 | 3 | **1** | 0 |

¹ The journal is at full size with a valid magic number. It has been synced, and SQLite is writing
pages to `vault.db`.
² The kills landed late in the rekey: in the last 20% of the measured time for L, and the last 35% for M.

**Every `neither` case was a kill inside the commit window.** One was diagnosed in detail (S,
417 ms):
- the journal was hot (`d9d505f920a163d7`, nRec 3 483) and the db's first 16 bytes ≠ the backup's
  salt
- OLD gave `SQLITE_NOTADB`, NEW gave `SQLITE_NOTADB`, and NEW with the journal moved aside gave
  `SQLITE_CORRUPT`
- **writing the backup's 16 salt bytes back over `vault.db`'s first 16 bytes**, with the journal in
  place, made OLD open: the hot journal rolled back, `integrity_check` was `ok`, the checksum was
  equal, and the generation was 1

That proves the mechanism. It is the salt change, not a torn journal. Outside the commit window, the
F3 path worked every time: with OLD opening first, the hot journal rolled back to intact content
(7 of 7 on M, 7 of 10 on S, the other 3 being commit-window kills).

### S7c: opening with the NEW key while a journal is hot

Over all 59 kills (plan recipe + D-E 1′) that left a hot journal and opened with NEW first, the NEW
open gave **`SQLITE_NOTADB`**. It never opened a half-written file, never raised a different error,
and **never wrote anything**: the journal size was unchanged afterwards.

Where the salt was still the old one, the OLD open that followed rolled back and passed
`integrity_check` with an equal checksum. **S7c never corrupted.** On its own, this criterion
passes.

For the UX: a user who types the new passphrase after such a crash gets "wrong passphrase". Typing
the old passphrase then works (with D-E 1′, always).

### D-E 1′ (salt-preserving `rekey="x'<NEW><SALT>'"` + `cache_spill = OFF`)

| Fixture | Set | Runs | Killed mid-rekey | Hot journal | …in the commit window | old-only | new-only | neither | failures |
|---|---|---|---|---|---|---|---|---|---|
| S | S7a (7 × 3) | 21 | – | 0 | – | 12 | 9 | 0 | 0 |
| M | S7a (7 × 1) | 7 | – | 0 | – | 4 | 3 | 0 | 0 |
| S | S7b (alternating NEW/OLD first) | 30 | 29 | 6 | 6 | 29 | 1 | **0** | 0 |
| M | S7b (alternating) | 30 | 23 | 3 | 3 | 23 | 7 | **0** | 0 |
| M | S7b, late² (alternating) | 26 | 10 | 10 | 10 | 10 | 16 | **0** | 0 |
| L | S7b (alternating) | 10 | 10 | 3 | 3 | 10 | 0 | **0** | 0 |
| S | salt-preserving only (spill on) | 40 | 33 | 16 | 6 | 33 | 7 | **0** | 0 |

With `cache_spill = OFF`, a hot journal exists **only** in the commit window, as expected. Every
earlier kill leaves `vault.db` untouched.

## S8. Restore path (D-E)

On S, the restore renamed `vault.db.pre-rekey.bak` over `vault.db` after a kill:

| Kill | Journal at kill | Restore | OLD after the restore |
|---|---|---|---|
| at `REKEYED` | 22.2 MB, cold | `rm -journal` + rename | intact, generation 1 |
| at `REKEYED` | 22.2 MB, cold | rename only (journal left) | intact, generation 1. The cold journal stays until the next write. |
| at `VERIFIED` | none | rename only | intact, generation 1 |
| mid-rekey (300 ms) | 13.8 MB, cold | `rm -journal` + rename | intact, generation 1 |
| mid-rekey (300 ms) | 18.6 MB, **hot** | rename only (**hot journal left**) | intact, generation 1. The journal was rolled back onto the restored file and deleted. |

Every S7 `neither` case (plan recipe) also had a backup that OLD opened intact, with generation 1.
**S8 passes.** The last row only works because the backup was taken under the held lock, so the
journal's pre-images equal the backup's pages. **The restore must still delete `vault.db-journal`
before the rename** and not rely on that coincidence: a hot journal from a *different* state rolled
onto the backup would corrupt it. Slice 3's `restoreBackup` gains that one step.

The restored vault carries the bump (generation 1, P-3 (a)), as the plan expects (A6).

## S9. Write failure

The child ran the plan's recipe until the rekey threw. It then reported the error, read through the
same connection, and closed. The parent then opened with OLD and NEW.

**(i) File-size limit.** The child ran under `sh -c "trap '' XFSZ; ulimit -f N; exec node …"`.
`SIGXFSZ` is ignored, so `write()` returns `EFBIG`. The backup was pre-made by the parent, because
the cap applies to every file and the backup is as big as the db.

| Journal cap (× db) | Recipe | Code | OLD after | NEW after |
|---|---|---|---|---|
| 0.1, 0.3, 0.6 | plan | `SQLITE_IOERR_WRITE` | intact | `SQLITE_NOTADB` |
| **0.9, 0.999** | **plan** | `SQLITE_IOERR_WRITE` | **`SQLITE_NOTADB`** | **`SQLITE_CORRUPT`**: **neither** |
| 0.1 … 0.999 (all 5) | D-E 1′ | `SQLITE_IOERR_WRITE` | **intact** | `SQLITE_NOTADB` |
| 0.9 | plan, same connection after the error | – | the read gives `SQLITE_CORRUPT` | – |
| 0.9 | D-E 1′, same connection after the error | – | the read gives 2 200 rows (OK) | – |

The salt-preserving form **alone** (spill still on) fails identically at 0.9 and 0.999: the
salt does not cause this one. The cause is in the source: in `sqlite3_rekey_v2`,
`sqlite3BtreeRollback` runs **before** `leave_rekey` restores the read cipher as the write cipher.
The rollback therefore rewrites the spilled pages with the NEW key, and the pages after the failure
point stay OLD.

**(i′) Real ENOSPC.** The test used a 60 MB tmpfs (db 22 + backup 22 + journal 22 > 60), plus
optional filler files to move the failure point:

| Filler | Recipe | Code | OLD after | NEW after |
|---|---|---|---|---|
| 0 MB (fails with the journal at 18.5 MB) | plan | `SQLITE_FULL` | **`SQLITE_NOTADB`** | **`SQLITE_CORRUPT`**: **neither** |
| 8 MB, 14 MB (fails earlier, before a spill) | plan | `SQLITE_FULL` | intact | `SQLITE_NOTADB` |
| 0, 8, 14 MB | D-E 1′ | `SQLITE_FULL` | **intact** | `SQLITE_NOTADB` |

(A cap of 0.9 × db on the same S file also made the **backup copy** fail with `EFBIG` when the child
made it. In that case the bump had committed, there was no backup, OLD was intact with generation 1,
and nothing else changed. This is the "copy fails" path. The adapter maps it to `REKEY_FAILED`.)

**(ii) A directory named `vault.db-journal`, pre-created.** The first write in the lock step failed
with `SQLITE_CANTOPEN` "unable to open database file", before the bump. Nothing changed: OLD was
intact with generation 0, and there was no backup. **This injection cannot reach the rekey itself**,
because in EXCLUSIVE mode the journal *file* already exists from the bump (S5) and is reused. So the
committed adapter test can use it only for the "fails before anything is written" path. For a
failure **during** the rekey, the fault-injection test should use the POSIX-only `ulimit -f` child
(i), together with the `SIGKILL` matrix (A10 already makes that file POSIX-only).

**S9 verdict:** the plan's recipe **fails** "rolls back cleanly" whenever the failure comes after a
cache spill. That is a realistic case: ENOSPC while the journal grows, when another process fills
the disk after `ensureRoom`. D-E 1′ passes every case. In the plan's `recoverFrom`, the "OLD
opens?" check would send these cases to `restoreBackup`, which works (S8). So the plan's code would
*recover*, but it would report "restored from its backup", never "nothing changed". And a crash
between the failure and the rename would leave a `vault.db` that no passphrase opens.

## S10. WAL refusal (F1)

On a WAL copy of S, with one read so that the WAL was really open, the rekey threw `SQLITE_ERROR`
"Rekeying is not supported in WAL journal mode." OLD still opened, intact, and NEW gave
`SQLITE_NOTADB`. (With no read after `journal_mode = WAL`, the WAL is not open yet and the rekey
goes through.) `openVaultDb` always settles to `DELETE`, so this holds as F1 says.

## S11. Windows (A8)

**Not run.** No Windows machine was available.

---

## Pass criteria: scorecard

| Criterion | Plan recipe (D-E 1) | D-E 1′ |
|---|---|---|
| Zero `neither`, zero integrity or checksum failures across S7a/b/c | **FAIL**: 9 `neither`, 0 integrity or checksum failures | pass (0 / 0) |
| S7c never corrupts | pass | pass |
| S8 restores | pass (add "delete `-journal` first") | pass |
| S9 rolls back cleanly | **FAIL** (spill + write error → `neither`) | pass |
| §5 pragma table unchanged, the `x'…'` recipe opens the file | pass (`cipher_salt` changes) | pass (`cipher_salt` unchanged too) |

## Recipe (D-E 1′, if Oscar picks it)

These are the plan's Slice 3 steps with three changes (marked ★):

1. `ensureRoom()`: free space ≥ 3 × the db size (P-8 (a); measured need ≈ 2.0×)
2. `openVaultDb(OLD)`, then `locking_mode = EXCLUSIVE`, then `BEGIN EXCLUSIVE; COMMIT` (P-2 (a))
3. the bump in its own `IMMEDIATE` transaction (P-3 (a))
4. `copyFileSync` → backup, then `fsync`
5. ★ `assertKeyHex(newKey)`. Then read `salt = PRAGMA cipher_salt` (32 hex) and run
   `PRAGMA cache_spill = OFF`.
6. ★ `PRAGMA rekey = "x'<64-hex NEW><32-hex salt>'"`. Expect `[{ok:"ok"}]`. A failure throws.
7. release: `locking_mode = NORMAL`, then one read, then `close()` (no journal left)
8. verify on a fresh `openVaultDb(NEW)` (the plain 64-hex `x'NEW'` opens it): `integrity_check`,
   plus the lineage stamp equals the bump
9. delete the backup. On any failure: if OLD opens and `integrity_check` is `ok`, say "nothing
   changed". Otherwise ★ **delete `vault.db-journal`, then** rename the backup over `vault.db`.

Additional rules:
- the source-scan test also allows the 96-hex form, and still forbids `hexrekey` and `db.rekey(`
- vault-format §5's "Changing the key" note says: a passphrase change keeps the cipher salt
  (D-E 1′). Or, under the plan's form or D-E 2, it says the salt changes.

## Decision (relayed to Oscar; P-1 (a): stop until he decides)

The plan's D-E 1 fails. There are two ways forward:

1. **D-E 1′.** In-place, with the salt-preserving raw key and `cache_spill = OFF`. It passed every
   criterion here.
   - Cost: ≈ 1.3× the db size in RAM during the rekey (≈ 270 MB for a 200 MB vault, ≈ 1.7 GB for
     1.3 GB)
   - About +6 production lines over the plan
   - The commit window still exists, but a crash in it now always rolls back with the OLD key
   - Residual risk: a real I/O error (`EIO`) **during the commit's db writes**. ENOSPC cannot happen
     there, because `vault.db` does not grow. That would hit the same rollback-with-NEW bug, and the
     backup (S8) covers it. It was not injectable here.
2. **D-E 2 (the plan's fallback).** Copy, rekey the copy, verify, poison, atomically rename. The
   original is never written, so neither engine flaw can touch it. It costs the plan's +60 lines and
   the R4′/R4″ risks (orphan writes on POSIX, rename refusals on Windows). It needs its own short
   kill matrix in Slice 3, which this spike did not run.

What changes for slices 1+, whichever is chosen:
- the restore deletes `vault.db-journal` before the rename
- the adapter runs `assertKeyHex` on the new key (S3: a malformed `x'…'` silently becomes a
  passphrase)
- `REKEY_SPACE_FACTOR = 3` stays (P-8 (a))
- the S5 remedy is `locking_mode = NORMAL` + one read + `close()`
- a crash-left **cold** `-journal` (EXCLUSIVE mode) is cleared by a `PERSIST` → `DELETE` toggle
  after the first read in `openVaultDb`/`openExclusively`. Otherwise it blocks the folder-settled
  check until the next write.
- the in-rekey write-failure test uses `ulimit -f` (POSIX). The `-journal` directory injection
  only reaches the pre-write path.
- S4: a rekey inside `BEGIN` is accepted by the engine, but P-3 (a) stays
- the success return shape is `[{ ok: "ok" }]`, and failures throw `SqliteError`
- vault-format §5 gets the cipher-salt fact above
