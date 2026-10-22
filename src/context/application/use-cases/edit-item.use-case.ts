import type { Clock } from "../../../shared/application/ports/clock.js";
import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { contextErr } from "../../domain/errors.js";
import { applyEdit, type ItemEdit } from "../../domain/services/item-curation.js";
import { parseContent } from "../../domain/values/content.js";
import { type ItemReference, parseItemReference } from "../../domain/values/item-id.js";
import { parseItemType } from "../../domain/values/item-type.js";
import { parseTags } from "../../domain/values/tag.js";
import { type EditItemOutput, toItemCurationOutput } from "../dto/item-curation-output.js";
import type { VaultSessions } from "../ports/vault-session.js";
import { findItemByReference, saveIfChanged } from "../services/item-curation-steps.js";

export interface EditItemInput {
  /** A full item id or a unique prefix of at least 6 characters. */
  item: string;
  content?: string;
  /** Replaces the whole tag list; `[]` clears it. */
  tags?: string[];
  type?: string;
}

interface ValidatedEdit {
  reference: ItemReference;
  edit: ItemEdit;
}

/** Edit in place: same id, createdAt kept, updatedAt stamped, FTS re-indexed by the storage trigger. */
export class EditItem implements UseCase<EditItemInput, EditItemOutput> {
  constructor(
    private readonly sessions: VaultSessions,
    private readonly clock: Clock,
  ) {}

  execute(input: EditItemInput): Result<EditItemOutput, DomainError> {
    const validated = this.parseInput(input);
    if (!validated.ok) return validated;

    return this.sessions.withSession((session) => {
      const found = findItemByReference(session, validated.value.reference);
      if (!found.ok) return found;
      const outcome = applyEdit(found.value.item, validated.value.edit, this.clock.now());
      if (!outcome.ok) return outcome;
      const { item, changedFields } = outcome.value;
      const saved = saveIfChanged(session, item, changedFields.length > 0);
      if (!saved.ok) return saved;
      return ok({
        ...toItemCurationOutput(found.value, item, changedFields.length > 0),
        changedFields,
      });
    });
  }

  /** Everything is parsed before a session is opened: bad input never touches the vault. */
  private parseInput(input: EditItemInput): Result<ValidatedEdit, DomainError> {
    const reference = parseItemReference(input.item);
    if (!reference.ok) return reference;
    if (input.content === undefined && input.tags === undefined && input.type === undefined) {
      return contextErr("NOTHING_TO_EDIT", "Nothing to edit: give new content, tags, or a type.");
    }
    const edit: { -readonly [K in keyof ItemEdit]: ItemEdit[K] } = {};
    if (input.content !== undefined) {
      const content = parseContent(input.content);
      if (!content.ok) return content;
      edit.content = content.value;
    }
    if (input.tags !== undefined) {
      const tags = parseTags(input.tags);
      if (!tags.ok) return tags;
      edit.tags = tags.value;
    }
    if (input.type !== undefined) {
      const type = parseItemType(input.type);
      if (!type.ok) return type;
      edit.type = type.value;
    }
    return ok({ reference: reference.value, edit });
  }
}
