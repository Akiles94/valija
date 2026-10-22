import type { ContentCurationResponse, IpcResult } from "../../shared/ipc/messages.js";
import type { ValijaBridge } from "./bridge.js";

/** The one-click actions: each is a single bridge call. */
export type ItemAction = "pin" | "unpin" | "archive" | "unarchive";

/** What a card offers: the one-click actions plus `edit`, which opens the edit dialog instead. */
export type CardAction = ItemAction | "edit";

/** Which actions a card offers — mirrors the domain rules, so the UI never offers a call that would be refused. */
export function itemActionsFor(item: {
  type: string;
  pinned: boolean;
  archived?: boolean;
}): CardAction[] {
  if (item.archived) return ["unarchive"];
  if (item.type === "imported") return ["archive"];
  return [item.pinned ? "unpin" : "pin", "edit", "archive"];
}

/** One bridge call per action — the only place the renderer maps an action to a channel. */
export function performItemAction(
  bridge: ValijaBridge,
  id: string,
  action: ItemAction,
): Promise<IpcResult<ContentCurationResponse>> {
  switch (action) {
    case "pin":
      return bridge.content.setPinned({ id, pinned: true });
    case "unpin":
      return bridge.content.setPinned({ id, pinned: false });
    case "archive":
      return bridge.content.setArchived({ id, archived: true });
    case "unarchive":
      return bridge.content.setArchived({ id, archived: false });
  }
}
