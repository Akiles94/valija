import { describe, expect, it } from "vitest";
import type { VaultFolderInspection } from "../../application/ports/vault-folder.js";
import { refuseUnsettledFolder, unsettledFiles } from "./folder-settlement.js";

const ROOT = "/home/oscar/.valija";

const SETTLED: VaultFolderInspection = {
  sidecars: [],
  conflictedCopies: [],
  staleBackups: [],
  rekeyBackups: [],
  looksLikeCloud: true,
};

const ONE_OF_EACH: Record<keyof Omit<VaultFolderInspection, "looksLikeCloud">, string> = {
  sidecars: `${ROOT}/vault.db-journal`,
  conflictedCopies: `${ROOT}/vault (Oscar's conflicted copy 2026-10-01).db`,
  staleBackups: `${ROOT}/vault.db.pre-003.bak`,
  rekeyBackups: `${ROOT}/vault.db.pre-rekey.bak`,
};

describe("refuseUnsettledFolder", () => {
  it("returns null for a settled folder (a cloud folder alone is not unsettled)", () => {
    expect(refuseUnsettledFolder(SETTLED)).toBeNull();
    expect(unsettledFiles(SETTLED)).toEqual([]);
  });

  for (const [field, path] of Object.entries(ONE_OF_EACH)) {
    it(`refuses when ${field} is not empty, naming the file`, () => {
      const error = refuseUnsettledFolder({ ...SETTLED, [field]: [path] });
      expect(error?.code).toBe("VAULT_FOLDER_UNSETTLED");
      expect(error?.message).toContain(path);
      expect(error?.message).toContain("Nothing was changed");
    });
  }

  it("lists every file when all four lists are populated", () => {
    const inspection: VaultFolderInspection = {
      sidecars: [ONE_OF_EACH.sidecars],
      conflictedCopies: [ONE_OF_EACH.conflictedCopies],
      staleBackups: [ONE_OF_EACH.staleBackups],
      rekeyBackups: [ONE_OF_EACH.rekeyBackups],
      looksLikeCloud: false,
    };
    expect(unsettledFiles(inspection)).toEqual(Object.values(ONE_OF_EACH));
    const error = refuseUnsettledFolder(inspection);
    for (const path of Object.values(ONE_OF_EACH)) expect(error?.message).toContain(path);
  });

  it("never carries a 64-hex run in its message", () => {
    const error = refuseUnsettledFolder({ ...SETTLED, rekeyBackups: [ONE_OF_EACH.rekeyBackups] });
    expect(error?.message).not.toMatch(/[0-9a-f]{64}/i);
  });
});
