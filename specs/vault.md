# Spec: vault — the encrypted vault bounded context

Security subdomain. Ubiquitous language: **vault, passphrase, key, salt, recovery kit, lock/unlock, keychain**. Depends only on `shared`.

## domain/errors.ts

`VAULT_NOT_FOUND · VAULT_ALREADY_EXISTS · VAULT_LOCKED · WRONG_PASSPHRASE · WEAK_PASSPHRASE · KEYCHAIN_ERROR · STORAGE_ERROR`

## application/ports (this module owns its technical ports)

- `crypto.ts` — `VaultCrypto`: Argon2id derivation to a 32-byte key + salt generation. Default KDF: 64 MiB, t=3, p=1.
- `keychain.ts` — `KeychainPort`: set/get/delete the session key by vault id.
- `vault-store.ts` — `VaultStore` + `VaultHeaderData`: header read/write/exists, DB init, key verification, db path.

## application use cases

**CreateVault(passphrase)** — header exists → `VAULT_ALREADY_EXISTS`; under 8 chars → `WEAK_PASSPHRASE` (enforced by the `Passphrase` value object, never trimmed); else generate ULID vault id + 16-byte salt, derive key, write header, create+migrate the DB, and **store the key in the keychain (a new vault starts unlocked)**. Returns `{ vaultId, keyHex, createdAt }` — the caller renders the recovery kit; the key is never persisted outside the keychain.

**UnlockVault({ passphrase | recoveryKeyHex })** — recovery key must be 64 hex chars (lowercased); passphrase path derives with the header's stored salt + params. Key is verified by opening the DB; failure → `WRONG_PASSPHRASE`. Success stores the key.

**LockVault()** — deletes the key; returns `wasUnlocked`. Missing header → `VAULT_NOT_FOUND`.

**VaultStatus()** — no header → `{ initialized: false }`; otherwise `unlocked` is true only if a keychain key exists **and** actually opens the DB (a stale key reports locked).

## infra

- `argon2.ts` — `Argon2VaultCrypto` (reference C impl): deterministic for same passphrase+salt+params; 32-byte keys, 16-byte salts.
- `vault-header.ts` — `vault.json` (plaintext): vaultId, schemaVersion 1, KDF params, base64 salt, createdAt. zod-validated on read; malformed → `STORAGE_ERROR`, missing → `VAULT_NOT_FOUND`.
- `recovery-kit.ts` — one-page text (raw key hex + vault id + instructions), shown once at init, **never stored by valija**.
- `keyring.ts` — `OsKeychain` via `@napi-rs/keyring`, service `valija`, account = vault id. Missing reads null; deleting a missing entry returns false; no throws.
- `file-vault-store.ts` — `FileVaultStore` implements `VaultStore` over the shared SQLite engine.

Proof: `src/vault/domain/values/{key-hex,passphrase}.test.ts`, `src/vault/infra/{argon2,vault-header,recovery-kit}.test.ts` (real Argon2id), and one `*.use-case.test.ts` per use case under `src/vault/application/use-cases/`.
