import type { Clock } from "../../../shared/application/ports/clock.js";
import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { setArchived } from "../../domain/services/item-curation.js";
import { parseItemReference } from "../../domain/values/item-id.js";
import { type ItemCurationOutput, toItemCurationOutput } from "../dto/item-curation-output.js";
import type { VaultSessions } from "../ports/vault-session.js";
import { findItemByReference, saveIfChanged } from "../services/item-curation-steps.js";

/** Which item to archive or unarchive, addressed by id or unique prefix. */
export interface SetItemArchivedInput {
  /** A full item id or a unique prefix of at least 6 characters. */
  item: string;
  archived: boolean;
}

/** Archive is a soft, reversible removal: the item leaves packs, search and counts, never the vault. */
export class SetItemArchived implements UseCase<SetItemArchivedInput, ItemCurationOutput> {
  constructor(
    private readonly sessions: VaultSessions,
    private readonly clock: Clock,
  ) {}

  execute(input: SetItemArchivedInput): Result<ItemCurationOutput, DomainError> {
    const reference = parseItemReference(input.item);
    if (!reference.ok) return reference;

    return this.sessions.withSession((session) => {
      const found = findItemByReference(session, reference.value);
      if (!found.ok) return found;
      const outcome = setArchived(found.value.item, input.archived, this.clock.now());
      const saved = saveIfChanged(session, outcome.item, outcome.changed);
      if (!saved.ok) return saved;
      return ok(toItemCurationOutput(found.value, outcome.item, outcome.changed));
    });
  }
}
