import { en } from "./catalogs/en.js";
import { es } from "./catalogs/es.js";
import type { Language } from "./languages.js";
import type { PluralForm } from "./plural.js";

const CATALOGS: Record<Language, typeof en> = { en, es };

type Leaf = string | PluralForm;

/** Every dotted key a catalog namespace actually has, computed from `en`'s own shape. */
type DottedKeys<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends PluralForm
    ? `${Prefix}${K}`
    : T[K] extends string
      ? `${Prefix}${K}`
      : T[K] extends Record<string, unknown>
        ? DottedKeys<T[K], `${Prefix}${K}.`>
        : never;
}[keyof T & string];

export type TranslationKey = DottedKeys<typeof en>;

type Params = Record<string, string | number>;

const isTestEnv = (): boolean => {
  try {
    return (
      typeof process !== "undefined" &&
      (process.env?.VITEST === "true" || process.env?.NODE_ENV === "test")
    );
  } catch {
    return false;
  }
};

/** Replaces every `{name}` in `template` with `params[name]`, left as-is if unset. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

function resolvePath(root: unknown, key: string): Leaf | undefined {
  let node: unknown = root;
  for (const segment of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node as Leaf | undefined;
}

function isPluralForm(value: Leaf): value is PluralForm {
  return typeof value === "object" && value !== null && "one" in value && "other" in value;
}

export interface Translator {
  t(key: TranslationKey, params?: Params & { count?: number }): string;
}

/**
 * Resolution order: the active language's catalog, then the English catalog as
 * fallback (D-V(b)). A key missing from *both* throws in tests — so a typo is
 * caught by the suite, not discovered by a user staring at a blank label — and
 * returns the key itself in production, never a silent blank.
 */
export function createTranslator(language: Language): Translator {
  const pluralRules = new Intl.PluralRules(language);
  const numberFormat = new Intl.NumberFormat(language);

  function t(key: TranslationKey, params?: Params & { count?: number }): string {
    const value = resolvePath(CATALOGS[language], key) ?? resolvePath(en, key);

    if (value === undefined) {
      if (isTestEnv()) throw new Error(`Missing translation key: ${key}`);
      return key;
    }

    if (isPluralForm(value)) {
      const count = params?.count ?? 0;
      // The category is selected from the raw count (Intl.PluralRules needs
      // the number itself); the `{count}` placeholder is rendered through
      // Intl.NumberFormat so a large count gets locale-correct grouping.
      const category = pluralRules.select(count);
      const template = category === "one" ? value.one : value.other;
      return interpolate(template, { ...params, count: numberFormat.format(count) });
    }

    return interpolate(value, params);
  }

  return { t };
}
