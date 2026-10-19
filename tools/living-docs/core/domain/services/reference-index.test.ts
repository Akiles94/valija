import { describe, expect, it } from "vitest";
import { createCatalogue } from "../values/catalogue.js";
import type { DocumentedSymbol } from "../values/documented-symbol.js";
import { parseReference, type Reference } from "../values/reference.js";
import { buildReferenceIndex, qualifierMatches, resolveReference } from "./reference-index.js";

const symbol = (name: string, file: string): DocumentedSymbol => ({
  name,
  declaration: "class",
  file,
  line: 3,
  doc: "Does a thing.",
  requiresDoc: true,
});

const ref = (raw: string): Reference => {
  const parsed = parseReference(raw, ["cli"]);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
};

const index = buildReferenceIndex(
  [
    symbol("UnlockVault", "src/vault/application/use-cases/unlock-vault.use-case.ts"),
    symbol("Status", "src/vault/domain/values/status.ts"),
    symbol("Status", "desktop/src/renderer/screens/status.tsx"),
  ],
  [
    createCatalogue({
      id: "cli",
      page: "reference/cli.md",
      title: "CLI",
      columns: ["Command"],
      rows: [{ key: { kind: "cli", name: "unlock", label: "valija unlock" }, cells: [] }],
    }),
  ],
);
const at = { file: "docs/flows/x.md", line: 7 };

describe("resolveReference", () => {
  it("resolves symbols and catalogue items", () => {
    expect(resolveReference(index, ref("UnlockVault"), at)).toMatchObject({ target: "symbol" });
    expect(resolveReference(index, ref("cli:unlock"), at)).toMatchObject({ target: "item" });
  });

  it("fails an ambiguous name and lists both files", () => {
    const outcome = resolveReference(index, ref("Status"), at);
    expect(outcome).toMatchObject({ rule: "ambiguous-reference", line: 7 });
    expect("message" in outcome && outcome.message).toContain(
      "desktop/src/renderer/screens/status.tsx",
    );
    expect("message" in outcome && outcome.message).toContain("src/vault/domain/values/status.ts");
  });

  it("lets an in-order qualifier disambiguate", () => {
    expect(resolveReference(index, ref("vault/Status"), at)).toMatchObject({ target: "symbol" });
    expect(resolveReference(index, ref("desktop/renderer/Status"), at)).toMatchObject({
      target: "symbol",
    });
  });

  it("reports a renamed symbol or missing item as broken, with file and line", () => {
    expect(resolveReference(index, ref("UnlockVaultX"), at)).toMatchObject({
      rule: "broken-reference",
      file: "docs/flows/x.md",
      line: 7,
    });
    expect(resolveReference(index, ref("cli:lockk"), at)).toMatchObject({
      rule: "broken-reference",
    });
  });
});

describe("qualifierMatches", () => {
  it("requires the segments in order", () => {
    expect(qualifierMatches(["src", "vault"], "src/vault/a.ts")).toBe(true);
    expect(qualifierMatches(["vault", "src"], "src/vault/a.ts")).toBe(false);
    expect(qualifierMatches(["a"], "src/vault/a.ts")).toBe(false);
  });
});
