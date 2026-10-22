interface VaultLocation {
  /**
   * Required (D-U): a short slug of `[a-z0-9-]` (1–64 characters), stamped as `source` on every
   * save. Self-declared — attribution, not authentication.
   */
  client: string;
  /** Default: `VALIJA_HOME`, then `~/.valija` — the same resolution as the CLI (D-C). */
  vaultRoot?: string;
}

/** Mode K — reuse the session the user unlocked with Valija. No secret in the product. Recommended (§11.9). */
export interface KeychainSessionOptions extends VaultLocation {
  /** Upgrade a vault whose schema is behind this SDK's. It locks out every older Valija until updated (D-H). */
  allowUpgrade?: boolean;
  passphrase?: never;
  recoveryKey?: never;
}

/** Mode P — the user typed their Valija passphrase into this product. The derived key stays in this process. */
export interface PassphraseOptions extends VaultLocation {
  passphrase: string;
  recoveryKey?: never;
  /** Upgrade a vault whose schema is behind this SDK's. It locks out every older Valija until updated (D-H). */
  allowUpgrade?: boolean;
}

/** Mode P — unlock with the 64-hex recovery key from the recovery kit. */
export interface RecoveryKeyOptions extends VaultLocation {
  recoveryKey: string;
  passphrase?: never;
  /** Upgrade a vault whose schema is behind this SDK's. It locks out every older Valija until updated (D-H). */
  allowUpgrade?: boolean;
}

/** How `openVault` gets in: the user's unlocked Valija session (Mode K), a passphrase, or a recovery key (Mode P). */
export type OpenVaultOptions = KeychainSessionOptions | PassphraseOptions | RecoveryKeyOptions;

/** Same passphrase rule as `valija init` (`WEAK_PASSPHRASE`). */
export interface CreateVaultOptions extends VaultLocation {
  passphrase: string;
}

/** The five types a product may save. `imported` is never accepted (§5). */
export type SaveableType = "decision" | "progress" | "preference" | "fact" | "handoff";

/** Equivalent to MCP `save_context`. `project` is required and created if missing (D-M, D9). */
export interface SaveRequest {
  project: string;
  content: string;
  /** Default `fact`. */
  type?: SaveableType;
  /** At most 10. */
  tags?: string[];
  /** The full id of ONE live item in the same project that this save replaces; it is archived. */
  supersedes?: string;
}

/** Equivalent to MCP `save_handoff`. */
export interface HandoffRequest {
  project: string;
  content: string;
}

/** Equivalent to MCP `get_context`. */
export interface ContextPackRequest {
  project: string;
  /** A positive integer. Default 4000. */
  budgetTokens?: number;
}

/** Equivalent to MCP `search_context`. */
export interface SearchRequest {
  query: string;
  /** Limit to one project (it must exist). */
  project?: string;
  /** A positive integer, clamped to 100. Default 20. */
  limit?: number;
}
