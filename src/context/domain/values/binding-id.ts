import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { contextErr } from "../errors.js";

const PATTERN = /^[A-Za-z0-9-]{1,64}$/;

/** A binding's id, the handle `unlink <binding-id>` takes. */
export type BindingId = string & { readonly __brand: "BindingId" };

/** A malformed id cannot match a real row, so "not found" is the honest answer. */
export function parseBindingId(raw: string): Result<BindingId, DomainError> {
  const trimmed = raw.trim();
  if (!PATTERN.test(trimmed)) return contextErr("BINDING_NOT_FOUND", "No binding has that id.");
  return ok(trimmed as BindingId);
}
