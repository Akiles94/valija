import { err, ok, type Result } from "../result.js";

/**
 * A `{{…}}` citation in a flow: `{{kind:name}}` for catalogue items (CLI commands, channels…),
 * `{{qualifier/…/Name}}` or `{{Name}}` for exported code symbols.
 */
export interface Reference {
  readonly kind: string | null;
  readonly qualifier: readonly string[];
  readonly name: string;
  readonly raw: string;
}

/** Parses the inside of `{{…}}`; only a prefix listed in `knownKinds` counts as a kind. */
export function parseReference(
  raw: string,
  knownKinds: readonly string[],
): Result<Reference, string> {
  const text = raw.trim();
  if (text === "") return err("empty reference");

  const colon = text.indexOf(":");
  if (colon > 0) {
    const kind = text.slice(0, colon);
    const name = text.slice(colon + 1).trim();
    if (!knownKinds.includes(kind)) {
      return err(`unknown reference kind "${kind}" (known: ${knownKinds.join(", ")})`);
    }
    if (name === "") return err(`reference "${text}" has no name after "${kind}:"`);
    return ok({ kind, qualifier: [], name, raw: text });
  }

  const segments = text.split("/").map((s) => s.trim());
  if (segments.some((s) => s === "")) return err(`reference "${text}" has an empty path segment`);
  const name = segments.at(-1) as string;
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) return err(`"${name}" is not a symbol name`);
  return ok({ kind: null, qualifier: segments.slice(0, -1), name, raw: text });
}

/** Human label for a reference: the name, with its kind for catalogue items. */
export function referenceLabel(ref: Reference): string {
  return ref.kind === null ? ref.name : `${ref.kind}:${ref.name}`;
}
