import { describe, expect, it } from "vitest";
import { type ParityDeclaration, pairSurfaces } from "./surface-parity.js";

const where = { file: "valija-guide.ts" };
const cells = (r: { cells: readonly { text: string; links?: readonly { text: string }[] }[] }) =>
  r.cells.map((c) => c.links?.map((l) => l.text).join(",") ?? c.text);

describe("pairSurfaces", () => {
  it("pairs entry points that reach a common use case", () => {
    const { catalogue, findings } = pairSurfaces(
      [{ name: "lock", reaches: ["lockVault"] }],
      [{ name: "vault:lock", reaches: ["lockVault"] }],
      [],
      where,
    );
    expect(findings).toEqual([]);
    expect(catalogue.rows.map(cells)).toEqual([
      ["valija lock", "vault:lock", "Same use case: lockVault"],
    ]);
  });

  it("lets a declaration override automatic pairing", () => {
    const declarations: ParityDeclaration[] = [
      { knownGap: ["relocation:move"], reason: "owed to a future advance" },
    ];
    const { catalogue, findings } = pairSurfaces(
      [{ name: "lock", reaches: ["lockVault"] }],
      [
        { name: "vault:lock", reaches: ["lockVault"] },
        { name: "relocation:move", reaches: ["lockVault", "relocateVault"] },
      ],
      declarations,
      where,
    );
    expect(findings).toEqual([]);
    expect(catalogue.rows.map(cells)).toEqual([
      ["valija lock", "vault:lock", "Same use case: lockVault"],
      ["—", "relocation:move", "Known gap: owed to a future advance"],
    ]);
  });

  it("reports undeclared orphans on both sides", () => {
    const { findings } = pairSurfaces(
      [{ name: "doctor", reaches: [] }],
      [{ name: "preferences:read", reaches: [] }],
      [],
      where,
    );
    expect(findings.map((f) => f.message)).toEqual([
      'CLI command "doctor" has no desktop counterpart; pair it or declare it in VALIJA_PARITY with a reason',
      'desktop channel "preferences:read" has no CLI counterpart; pair it or declare it in VALIJA_PARITY with a reason',
    ]);
  });

  it("pairs a channel declared in two pairs on both rows, with no orphan (REKEY)", () => {
    const declarations: ParityDeclaration[] = [
      { pair: { cli: "init", ipc: ["vault:init", "vault:readRecoveryKit"] }, reason: "kit once" },
      {
        pair: {
          cli: "change-passphrase",
          ipc: ["vault:changePassphrase", "vault:readRecoveryKit"],
        },
        reason: "new kit once",
      },
    ];
    const { catalogue, findings } = pairSurfaces(
      [
        { name: "init", reaches: ["createVault"] },
        { name: "change-passphrase", reaches: ["changePassphrase"] },
      ],
      [
        { name: "vault:init", reaches: ["createVault"] },
        { name: "vault:readRecoveryKit", reaches: [] },
        { name: "vault:changePassphrase", reaches: ["changePassphrase"] },
      ],
      declarations,
      where,
    );
    expect(findings).toEqual([]);
    expect(catalogue.rows.map(cells)).toEqual([
      [
        "valija change-passphrase",
        "vault:changePassphrase,vault:readRecoveryKit",
        "Declared: new kit once",
      ],
      ["valija init", "vault:init,vault:readRecoveryKit", "Declared: kit once"],
    ]);
  });

  it("requires a reason on every declaration", () => {
    // @ts-expect-error — `reason` is mandatory (D-12)
    const missing: ParityDeclaration = { surfaceSpecific: ["mcp"] };
    expect(missing).toBeDefined();
  });
});
