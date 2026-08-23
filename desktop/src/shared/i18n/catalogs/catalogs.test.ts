import { describe, expect, it } from "vitest";
import { en } from "./en.js";
import { es } from "./es.js";

function isPluralForm(value: unknown): value is { one: string; other: string } {
  return typeof value === "object" && value !== null && "one" in value && "other" in value;
}

/** Every dotted path down to a string or PluralForm leaf — never stopping partway. */
function leafPaths(node: unknown, prefix = ""): string[] {
  if (typeof node === "string") return [prefix];
  if (isPluralForm(node)) return [prefix];
  if (typeof node === "object" && node !== null) {
    return Object.entries(node).flatMap(([key, value]) =>
      leafPaths(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

function placeholdersIn(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .filter((name): name is string => name !== undefined)
    .sort();
}

describe("catalog key-set parity (deep walk, both directions)", () => {
  const enPaths = leafPaths(en).sort();
  const esPaths = leafPaths(es).sort();

  it("es has every key en has", () => {
    const missing = enPaths.filter((p) => !esPaths.includes(p));
    expect(missing).toEqual([]);
  });

  it("es has no key en does not have", () => {
    const extra = esPaths.filter((p) => !enPaths.includes(p));
    expect(extra).toEqual([]);
  });
});

describe("placeholder parity between en and es", () => {
  for (const path of leafPaths(en).sort()) {
    it(`${path}: es placeholders match en placeholders`, () => {
      const enValue = path
        .split(".")
        .reduce<unknown>((n, k) => (n as Record<string, unknown>)[k], en);
      const esValue = path
        .split(".")
        .reduce<unknown>((n, k) => (n as Record<string, unknown>)[k], es);

      if (isPluralForm(enValue) && isPluralForm(esValue)) {
        expect(placeholdersIn(esValue.one)).toEqual(placeholdersIn(enValue.one));
        expect(placeholdersIn(esValue.other)).toEqual(placeholdersIn(enValue.other));
      } else if (typeof enValue === "string" && typeof esValue === "string") {
        expect(placeholdersIn(esValue)).toEqual(placeholdersIn(enValue));
      } else {
        throw new Error(`${path}: shape mismatch between en and es`);
      }
    });
  }
});

describe("plural forms resolve in both languages", () => {
  it("English selects one/other by Intl.PluralRules('en')", () => {
    const rules = new Intl.PluralRules("en");
    expect(rules.select(1)).toBe("one");
    expect(rules.select(2)).toBe("other");
    expect(rules.select(0)).toBe("other");
  });

  it("Spanish selects one/other by Intl.PluralRules('es')", () => {
    const rules = new Intl.PluralRules("es");
    expect(rules.select(1)).toBe("one");
    expect(rules.select(2)).toBe("other");
    expect(rules.select(0)).toBe("other");
  });
});
