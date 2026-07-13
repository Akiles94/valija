import type { DomainError, Result } from "../errors.js";
import type { ContextItemRepository, ProjectRepository } from "./repositories.js";

/** An open handle to the unlocked vault. Close it when the operation ends. */
export interface VaultSession {
  readonly projects: ProjectRepository;
  readonly items: ContextItemRepository;
  close(): void;
}

export interface VaultSessionFactory {
  open(): Result<VaultSession, DomainError>;
}
