import { en } from "./catalogs/en.js";
import { es } from "./catalogs/es.js";
import type { Language } from "./languages.js";
import { interpolate } from "./translate.js";

const CATALOGS: Record<Language, typeof en> = { en, es };

/** Every error code this catalog carries copy for — the codes `src/` defines today, plus the ones Slices 4 and 8 add. */
export type KnownErrorCode = Exclude<keyof typeof en.errors, "generic">;

/**
 * D-V(d) made mechanical: renders a `DomainError.code` from the catalog, never
 * `DomainError.message`. An unrecognized code still gets a plain-language
 * sentence — it names the code rather than surfacing nothing, but the code
 * itself is the only English-only fragment such a sentence can contain.
 */
export function copyForErrorCode(code: string, language: Language): string {
  const errorsEn = en.errors as Record<string, string>;
  const errorsActive = CATALOGS[language].errors as Record<string, string>;

  const template = Object.hasOwn(errorsEn, code)
    ? (errorsActive[code] ?? errorsEn[code])
    : undefined;

  if (template !== undefined) {
    return interpolate(template, { code });
  }
  return interpolate(errorsActive.generic ?? errorsEn.generic ?? "Something went wrong ({code}).", {
    code,
  });
}
