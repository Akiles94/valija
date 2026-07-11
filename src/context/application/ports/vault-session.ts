import type { DomainError, Result } from "../../../shared/domain/result.js";
import type { ContextItemRepository, ProjectRepository } from "./repositories.js";

/**
 * An open handle to the unlocked vault. Close it when the operation ends.
 *
 * This port is the BRIDGE between the two bounded contexts: the context
 * side asks for a session; the vault side may refuse with VAULT_LOCKED.
 * It is why the context module is downstream of the vault module.
 */
export interface VaultSession {
  readonly projects: ProjectRepository;
  readonly items: ContextItemRepository;
  close(): void;
}

export interface VaultSessionFactory {
  open(): Result<VaultSession, DomainError>;
}
