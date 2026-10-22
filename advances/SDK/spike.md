# SDK — Slice 0 spike findings

Run on 2026-10-21 in a throwaway copy of the working tree (`git ls-files` exported to a scratch
directory, `node_modules` symlinked). Nothing but this file is committed.

Toolchain: Node `v22.22.0`, `tsc` `Version 7.0.2`, tsup `8.5.1`.

## Step 1 — tsup `dts` (confirms F1)

Scratch `src/delivery/sdk/index.ts` (`export const probe = 1; export interface Probe { a: string }`),
`entry: { program, sdk }` and `dts: { entry: { sdk } }`, then `npm run build`.

- The ESM build succeeds (`dist/program.js`, `dist/sdk.js`, 95 B).
- The `dts` step then crashes the process:

```
TypeError: Cannot read properties of undefined (reading 'useCaseSensitiveFileNames')
    at node_modules/.pnpm/rollup-plugin-dts@6.1.1_rollup@4.53.2_typescript@5.7.3/node_modules/rollup-plugin-dts/dist/rollup-plugin-dts.cjs (/home/user/valija/node_modules/tsup/dist/rollup.js:4857:37)
```

The failing access is `ts.sys.useCaseSensitiveFileNames` inside tsup's bundled `rollup-plugin-dts`,
reached before `parseJsonConfigFileContent`. Same root cause as F1 (`require('typescript')` on TS 7
yields only `{ version, versionMajorMinor }`), slightly different first symptom. **Step 1 fails as
expected: P-5 (a) stands, no report needed before Slice 10.**

## Step 2 — the fallback, `tsc --emitDeclarationOnly`

Scratch `tsconfig.sdk.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "declaration": true, "emitDeclarationOnly": true, "rootDir": "src", "outDir": "dist/types" },
  "files": ["src/delivery/sdk/index.ts"],
  "include": []
}
```

The probe entry also imported a type from `../../shared/domain/result.js` to exercise a relative
specifier. `npx tsc -p tsconfig.sdk.json` exits 0 and emits:

- `dist/types/delivery/sdk/index.d.ts`
- `dist/types/shared/domain/result.d.ts` (followed through the import)

`index.d.ts` keeps the `.js` specifier verbatim (`import type { Result } from "../../shared/domain/result.js";`).
**A1 holds.**

## Step 3 — consumer resolution

Scratch consumer outside the repo: `"type": "module"`, `module`/`moduleResolution: nodenext`,
`strict`, `skipLibCheck: false`, `types: []`; `node_modules/valija` symlinked to the copy, whose
`package.json` gained:

```json
"exports": {
  "./sdk": { "types": "./dist/types/delivery/sdk/index.d.ts", "import": "./dist/sdk.js" },
  "./package.json": "./package.json"
}
```

`import { type Probe, probe, type R } from "valija/sdk"`:

- `<repo>/node_modules/.bin/tsc --noEmit -p .` → exit 0
- `node -e "import('valija/sdk')"` → `{"probe":1}`, exit 0

## Step 4 — read-only open with a hot journal (W1)

Recipe (plain Node against `better-sqlite3-multiple-ciphers`, same pragmas as `openVaultDb`):

1. Open `vault.db` read-write with `cipher='sqlcipher'`, the raw key and the verifying
   `SELECT count(*) FROM sqlite_master`, then `wal_checkpoint(TRUNCATE)`, `journal_mode = DELETE`,
   `foreign_keys = ON`. Create `meta` with `schema_version = '5'` and a table `t (x BLOB)`.
2. `PRAGMA cache_size = 1`, `BEGIN`, insert 300 × `randomblob(4096)`. `vault.db-journal` exists.
3. Copy `vault.db` and `vault.db-journal` to another folder while the transaction is open, then
   close the original.
4. Open the copy `{ readonly: true, fileMustExist: true }` with the cipher/key pragmas and run the
   verifying `SELECT`.

Results:

- The **verifying `SELECT` itself** throws `error.code === "SQLITE_READONLY_ROLLBACK"`
  ("attempt to write a readonly database"). **Code as expected; Slice 1 uses it.**
- The journal is still present after the failed read-only attempt (nothing was touched).
- A read-write open of the copy with **only** cipher + key + the verifying `SELECT` (no journal
  pragmas) rolls the hot journal back: `meta.schema_version` reads `5`, `count(*) FROM t` is `0`,
  `journal_mode` reports `delete`, and after `close()` the `-journal` file is gone.

So the W1 fallback works as P-6 describes: the read-write open's pre-pragma refusal still sees the
(newer) schema after SQLite's own rollback, and the rollback happens before any pragma Valija runs.
A real hot journal can be produced in a test (A9 holds), so Slice 1 does not need to inject the
error.

## Decision points

| Plan decision point | Outcome |
|---|---|
| Step 1 unexpectedly succeeds → report before Slice 10 | Did not succeed. P-5 (a) unchanged. |
| Step 4 gives a different code → Slice 1 uses it | Same code, `SQLITE_READONLY_ROLLBACK`. |
| No hot journal can be produced → inject the error (A9) | Produced. Slice 1 uses the real recipe. |

## Addendum (found while writing Slice 1) — read-only open of a legacy WAL-mode vault

A pre-0.3.0 vault still has `journal_mode = WAL` persisted in its header. Opening it
`{ readonly: true }` succeeds and reads the marker, but SQLite **creates `-wal` and `-shm` sidecars**
next to `vault.db` (the database file itself is untouched). The bytes of `vault.db` do not change, and
on the unlock path the read-write open that follows (`readLineage` → `openVaultDb`) folds and removes
them exactly as before (`upgrade-wal.test.ts` stays green). A current (`DELETE`-mode) vault — which
is what every newer valija writes — gets no sidecar. No design change; noted for the SDK's "the
probe writes nothing" wording, which is exact for any vault this or a newer build produced.

One visible consequence: on the desktop, a legacy WAL vault refused with `VAULT_UPGRADE_REQUIRED`
(user declines the upgrade) now keeps an empty `-wal`/`-shm` pair until the next accepted open;
before this advance the same probe ran `openVaultDb` and switched the file to `DELETE` instead.
Both are confined to pre-0.3.0 vaults.
