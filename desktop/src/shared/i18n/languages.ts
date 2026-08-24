export type Language = "en" | "es";

export const SYSTEM = "system" as const;
export type SystemOrLanguage = typeof SYSTEM | Language;

export function matchLanguage(osLocale: string): Language {
  // Primary-subtag match: es, es-EC, es-419, es-ES → es; en-* → en; anything else → en
  const primary = osLocale.split("-")[0];

  if (primary === "es") {
    return "es";
  }
  if (primary === "en") {
    return "en";
  }

  // Default to English for unrecognized locales
  return "en";
}
