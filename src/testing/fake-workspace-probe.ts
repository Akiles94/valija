import type { WorkspaceProbe } from "../context/application/ports/workspace-probe.js";
import { contextErr } from "../context/domain/errors.js";
import type { FolderTarget, WorkspaceLocation } from "../context/domain/values/binding-target.js";
import { type DomainError, ok, type Result } from "../shared/domain/result.js";

/**
 * A probe over a map the test fills, so no use-case test touches a real `.git`.
 * An unknown directory is a plain folder outside any repository. `asked` records
 * every directory it was asked about, so a test can prove the probe was never
 * called (the lock-first proofs).
 */
export class FakeWorkspaceProbe implements WorkspaceProbe {
  readonly asked: string[] = [];
  private readonly locations = new Map<string, WorkspaceLocation>();
  private readonly failing = new Set<string>();

  at(directory: string, location: Partial<WorkspaceLocation> = {}): this {
    this.locations.set(directory, { ...plainFolder(directory), ...location });
    return this;
  }

  failFor(directory: string): this {
    this.failing.add(directory);
    return this;
  }

  locate(directory: string): Result<WorkspaceLocation, DomainError> {
    this.asked.push(directory);
    if (this.failing.has(directory)) {
      return contextErr(
        "INVALID_WORKSPACE_PATH",
        "That folder does not exist, is not a folder, or cannot be read.",
      );
    }
    return ok(this.locations.get(directory) ?? plainFolder(directory));
  }
}

function plainFolder(directory: string): WorkspaceLocation {
  return {
    folder: directory as FolderTarget,
    repositoryRoot: null,
    repository: null,
    tooBroadToLink: false,
  };
}
