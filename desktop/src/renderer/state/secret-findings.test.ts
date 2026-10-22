import { describe, expect, it } from "vitest";
import { SECRET_KINDS } from "../../../../src/context/domain/values/secret-finding.js";
import { en } from "../../shared/i18n/catalogs/en.js";
import { es } from "../../shared/i18n/catalogs/es.js";
import { createTranslator } from "../../shared/i18n/translate.js";
import { describeSecretFindings } from "./secret-findings.js";

const { t: tEn } = createTranslator("en");
const { t: tEs } = createTranslator("es");
const at = (kind: string, firstLine: number, lastLine = firstLine) => ({
  kind,
  firstLine,
  lastLine,
});

describe("describeSecretFindings", () => {
  it("every SecretKind has an en and an es label (D-O)", () => {
    for (const kind of SECRET_KINDS) {
      expect(en.secrets.kinds[kind], kind).toBeTruthy();
      expect(es.secrets.kinds[kind], kind).toBeTruthy();
    }
    expect(Object.keys(en.secrets.kinds).sort()).toEqual([...SECRET_KINDS].sort());
  });

  it("renders one line and a line range, sorted by line", () => {
    const findings = [at("private-key", 12, 40), at("stripe-secret-key", 3)];
    expect(describeSecretFindings(findings, tEn)).toBe(
      "Stripe secret key (line 3), Private key (lines 12–40)",
    );
    expect(describeSecretFindings(findings, tEs)).toBe(
      "Clave secreta de Stripe (línea 3), Clave privada (líneas 12–40)",
    );
  });

  it("caps at five entries, then says how many more", () => {
    const findings = Array.from({ length: 7 }, (_, i) => at("high-entropy-string", i + 1));
    expect(describeSecretFindings(findings, tEn)).toMatch(/\(line 5\), and 2 more$/);
    expect(describeSecretFindings(findings, tEs)).toMatch(/\(línea 5\), y 2 más$/);
  });

  it("skips an unknown kind instead of showing a raw id", () => {
    expect(describeSecretFindings([at("mystery-kind", 1), at("jwt", 2)], tEn)).toBe(
      "JSON Web Token (line 2)",
    );
  });
});
