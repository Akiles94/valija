import type { DomainError, Result } from "../../../shared/domain/result.js";
import type { ContextItemRepository, ProjectRepository } from "./repositories.js";

/**
 * An open handle to the unlocked vault, scoped to a single operation.
 * Callers never manage its lifecycle directly — {@link VaultSessions.withSession}
 * opens and closes it around them.
 */
export interface VaultSession {
  readonly projects: ProjectRepository;
  readonly items: ContextItemRepository;
  close(): void;
}

/**
 * Runs a unit of work inside an unlocked vault session, owning the
 * open → work → always-close lifecycle so use cases stay a narrative of
 * domain steps.
 *
 * This port is the BRIDGE between the two bounded contexts: the context
 * side asks to run within a session; the vault side may refuse with
 * VAULT_LOCKED. It is why the context module is downstream of the vault module.
 */
export interface VaultSessions {
  /** Open a session, run the action, and always close the session — even on throw. */
  withSession<T>(action: (session: VaultSession) => Result<T, DomainError>): Result<T, DomainError>;
}
