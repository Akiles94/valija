import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import type { ContextItem } from "../../domain/entities/context-item.js";
import { contextErr } from "../../domain/errors.js";
import type { ItemReference } from "../../domain/values/item-id.js";
import type { ItemWithProject } from "../ports/repositories.js";
import type { VaultSession } from "../ports/vault-session.js";

const CANDIDATES_SHOWN = 5;

/** Exact id first, otherwise a unique prefix. Archived items are found — unarchive needs them. */
export function findItemByReference(
  session: VaultSession,
  reference: ItemReference,
): Result<ItemWithProject, DomainError> {
  const exact = session.items.findById(reference);
  if (exact !== null) return ok(exact);
  const matches = session.items.findByIdPrefix(reference, CANDIDATES_SHOWN + 1);
  const [only] = matches;
  if (only === undefined) return contextErr("ITEM_NOT_FOUND", `No item matches "${reference}".`);
  if (matches.length === 1) return ok(only);
  return contextErr("ITEM_ID_AMBIGUOUS", ambiguityMessage(reference, matches));
}

/** A no-op never opens a write, so it never bumps the vault's lineage (CURATION D-L). */
export function saveIfChanged(
  session: VaultSession,
  item: ContextItem,
  changed: boolean,
): Result<void, DomainError> {
  if (!changed) return ok(undefined);
  return session.write(() => {
    session.items.save(item);
    return ok(undefined);
  });
}

function ambiguityMessage(reference: ItemReference, matches: ItemWithProject[]): string {
  const ids = matches.slice(0, CANDIDATES_SHOWN).map((m) => m.item.id);
  const more = matches.length > CANDIDATES_SHOWN ? ", and more" : "";
  return `"${reference}" matches several items: ${ids.join(", ")}${more}. Use more characters.`;
}
