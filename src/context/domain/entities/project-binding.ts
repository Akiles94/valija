import type { BindingKind, FolderTarget } from "../values/binding-target.js";
import type { RepositoryTarget } from "../values/repository-target.js";

/** A user-made link from a folder or a repository to one project: the trust anchor of detection. */
export interface ProjectBinding {
  readonly id: string;
  readonly projectId: string;
  readonly kind: BindingKind;
  readonly target: FolderTarget | RepositoryTarget;
  readonly createdAt: Date;
}

export interface NewProjectBinding {
  readonly id: string;
  readonly projectId: string;
  readonly kind: BindingKind;
  readonly target: FolderTarget | RepositoryTarget;
  readonly now: Date;
}

/** Total, not a Result: every field arrives already parsed, like `createContextItem`. */
export function createProjectBinding(input: NewProjectBinding): ProjectBinding {
  return {
    id: input.id,
    projectId: input.projectId,
    kind: input.kind,
    target: input.target,
    createdAt: input.now,
  };
}
