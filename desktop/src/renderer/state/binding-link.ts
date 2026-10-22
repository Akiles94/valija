import type { BindingsInspectResponse } from "../../shared/ipc/messages.js";

export type LinkChoice = "repository" | "folder";

/**
 * The link options the inspect panel offers, default first: the repository
 * when it has a remote (D-K), else the folder; a home folder or disk root is
 * too broad to link as a folder (P-4). Mirrors `chooseLinkTarget`, so the
 * panel never offers a link the use case would refuse.
 */
export function linkChoicesFor(
  inspection: Pick<BindingsInspectResponse, "remote" | "canLinkFolder">,
): LinkChoice[] {
  const choices: LinkChoice[] = [];
  if (inspection.remote !== null) choices.push("repository");
  if (inspection.canLinkFolder) choices.push("folder");
  return choices;
}
