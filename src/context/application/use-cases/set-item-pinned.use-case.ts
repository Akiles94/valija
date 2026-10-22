import type { Clock } from "../../../shared/application/ports/clock.js";
import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { setPinned } from "../../domain/services/item-curation.js";
import { parseItemReference } from "../../domain/values/item-id.js";
import { type ItemCurationOutput, toItemCurationOutput } from "../dto/item-curation-output.js";
import type { VaultSessions } from "../ports/vault-session.js";
import { findItemByReference, saveIfChanged } from "../services/item-curation-steps.js";

export interface SetItemPinnedInput {
  /** A full item id or a unique prefix of at least 6 characters. */
  item: string;
  pinned: boolean;
}

export class SetItemPinned implements UseCase<SetItemPinnedInput, ItemCurationOutput> {
  constructor(
    private readonly sessions: VaultSessions,
    private readonly clock: Clock,
  ) {}

  execute(input: SetItemPinnedInput): Result<ItemCurationOutput, DomainError> {
    const reference = parseItemReference(input.item);
    if (!reference.ok) return reference;

    return this.sessions.withSession((session) => {
      const found = findItemByReference(session, reference.value);
      if (!found.ok) return found;
      const outcome = setPinned(found.value.item, input.pinned, this.clock.now());
      if (!outcome.ok) return outcome;
      const saved = saveIfChanged(session, outcome.value.item, outcome.value.changed);
      if (!saved.ok) return saved;
      return ok(toItemCurationOutput(found.value, outcome.value.item, outcome.value.changed));
    });
  }
}
