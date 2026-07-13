import { homedir } from "node:os";
import { join } from "node:path";

export interface VaultPaths {
  root: string;
  header: string;
  db: string;
}

export function resolveVaultPaths(rootOverride?: string): VaultPaths {
  const root = rootOverride ?? process.env.VALIJA_HOME ?? join(homedir(), ".valija");
  return {
    root,
    header: join(root, "vault.json"),
    db: join(root, "vault.db"),
  };
}
