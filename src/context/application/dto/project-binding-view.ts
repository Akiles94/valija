import type { BoundProject } from "../../domain/services/project-resolution.js";
import type { BindingKind } from "../../domain/values/binding-target.js";

/**
 * How a binding leaves the application layer: primitives only, like
 * `ContextItemView`. `target` is a folder path or a normalized remote — user
 * metadata the CLI and desktop may show, and the MCP adapter never reads.
 */
export interface ProjectBindingView {
  id: string;
  project: string;
  kind: BindingKind;
  target: string;
  createdAt: string;
}

export const toProjectBindingView = ({
  binding,
  projectName,
}: BoundProject): ProjectBindingView => ({
  id: binding.id,
  project: projectName as string,
  kind: binding.kind,
  target: binding.target as string,
  createdAt: binding.createdAt.toISOString(),
});
