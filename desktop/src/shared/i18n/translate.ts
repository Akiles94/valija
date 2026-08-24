import type { Language } from "./languages.js";
import en from "./catalogs/en.js";
import es from "./catalogs/es.js";

type Catalog = typeof en;

const catalogs: Record<Language, Catalog> = {
  en,
  es,
};

type DeepRecord<T = any> = { [key: string]: T | DeepRecord<T> };

function resolvePath(obj: DeepRecord, path: string): any {
  return path.split(".").reduce((current, part) => current?.[part], obj);
}

function hasPlurals(value: any): value is { one: string; other: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "one" in value &&
    "other" in value
  );
}

interface TranslateOptions {
  count?: number;
  [key: string]: any;
}

export interface Translator {
  (key: string, options?: TranslateOptions): string;
}

export function createTranslator(language: Language): Translator {
  return (key: string, options?: TranslateOptions): string => {
    const catalog = catalogs[language];
    let value = resolvePath(catalog, key);

    // Try fallback to English if not found
    if (value === undefined) {
      value = resolvePath(catalogs.en, key);
    }

    // Handle plural forms
    if (hasPlurals(value)) {
      if (options?.count === undefined) {
        throw new Error(
          `Key "${key}" requires a count option for plural resolution`
        );
      }

      const pluralRules = new Intl.PluralRules(language);
      const form = pluralRules.select(options.count);
      value = value[form] ?? value.other;
    }

    // Return key in production if still not found, throw in tests
    if (typeof value !== "string") {
      if (process.env.NODE_ENV === "test") {
        throw new Error(`Translation key not found: ${key}`);
      }
      return key;
    }

    // Replace placeholders
    if (options) {
      for (const [key, val] of Object.entries(options)) {
        if (key !== "count") {
          value = value.replace(new RegExp(`\\{${key}\\}`, "g"), String(val));
        }
      }
    }

    return value;
  };
}
