import type { DomainError, Result } from "../../../shared/domain/result.js";
import type { WorkspaceLocation } from "../../domain/values/binding-target.js";

/** Reads where work is happening. Read-only: never writes, never spawns a process, never touches the network. */
export interface WorkspaceProbe {
  /** The canonical folder, its enclosing git repository and that repository's remote; `INVALID_WORKSPACE_PATH` when the folder cannot be read. */
  locate(directory: string): Result<WorkspaceLocation, DomainError>;
}
