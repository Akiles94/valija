import { homedir } from "node:os";
import { join } from "node:path";

/** File locations of one vault: its folder, the plaintext header and the encrypted database. */
export interface VaultPaths {
  root: string;
  header: string;
  db: string;
}

/** Resolves the vault folder from an explicit root, then `VALIJA_HOME`, then `~/.valija`. */
export function resolveVaultPaths(rootOverride?: string): VaultPaths {
  const root = rootOverride ?? process.env.VALIJA_HOME ?? join(homedir(), ".valija");
  return {
    root,
    header: join(root, "vault.json"),
    db: join(root, "vault.db"),
  };
}
