import type { Result } from "../../../shared/domain/result.js";
import type {
  ContextPackRequest,
  HandoffRequest,
  SaveableType,
  SaveRequest,
  SearchRequest,
} from "./requests.js";
import type { ValijaError } from "./valija-error.js";

/** `keychain-session` = Mode K; `in-process` = Mode P (also every `createVault` handle). */
export type VaultMode = "keychain-session" | "in-process";

/** A fork found at a Mode P open. Non-fatal; nothing was deleted or merged. Same wording as `valija unlock`. */
export interface ForkNotice {
  readonly generation: number;
  readonly message: string;
}

export interface SavedItem {
  itemId: string;
  project: string;
  type: SaveableType;
  projectCreated: boolean;
  /** Present only when `supersedes` was used. */
  supersededItemId?: string;
}

/** `markdown` is byte-identical to MCP `get_context` for the same input (P-13). */
export interface RenderedPack {
  project: string;
  markdown: string;
}

/** One search match, at MCP `search_context` parity (P-12). */
export interface SearchHit {
  id: string;
  project: string;
  type: SaveableType | "imported";
  createdAt: string;
  content: string;
}

/** One project, at MCP `list_projects` parity, without the workspace marker (P-12). */
export interface ProjectSummary {
  name: string;
  itemCount: number;
  lastActivityAt: string | null;
  description?: string;
}

/** An open vault. Every content call opens and closes its own session; nothing is cached across calls. */
export interface ValijaVault {
  readonly vaultId: string;
  readonly mode: VaultMode;
  /** Mode P only: set when the open found a fork. Non-fatal; nothing was deleted or merged. */
  readonly forkNotice?: ForkNotice;
  save(request: SaveRequest): Promise<Result<SavedItem, ValijaError>>;
  saveHandoff(request: HandoffRequest): Promise<Result<SavedItem, ValijaError>>;
  getContextPack(request: ContextPackRequest): Promise<Result<RenderedPack, ValijaError>>;
  search(request: SearchRequest): Promise<Result<SearchHit[], ValijaError>>;
  listProjects(): Promise<Result<ProjectSummary[], ValijaError>>;
  /** Mode K: locks Valija on every surface, like `valija lock`. Mode P: forgets this handle's key only (⚑ D-A.1). */
  lock(): Promise<Result<void, ValijaError>>;
  /** Ends the handle. Mode P also forgets the key. Later calls give `VAULT_LOCKED` (P-14). */
  close(): Promise<Result<void, ValijaError>>;
}

/**
 * Show `recoveryKit` to the user ONCE, then discard it. Never store, log, sync or transmit it
 * (⚑ D-D.1, §11.4). It is the vault's permanent master secret — Valija has no re-key.
 */
export interface CreatedVault {
  vault: ValijaVault;
  vaultId: string;
  recoveryKit: string;
}
