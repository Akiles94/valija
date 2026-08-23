export type Language = "en" | "es";
export const SYSTEM = "system";
export type SystemOr<T> = typeof SYSTEM | T;

/**
 * Primary-subtag match (D-V(g) Option 1): any `es*` locale — `es`, `es-EC`, `es-419`,
 * `es-ES` — maps to the one region-neutral Spanish catalog. Everything else falls
 * back to English. Deliberately not a full BCP-47 negotiation: a second, third or
 * regional catalog is out of scope (`refined.md` §6 Out).
 */
export function matchLanguage(osLocale: string): Language {
  const primarySubtag = osLocale.split(/[-_]/)[0]?.toLowerCase();
  return primarySubtag === "es" ? "es" : "en";
}
