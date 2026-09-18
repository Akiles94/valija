import { describe, expect, it } from "vitest";
import type { VaultFolderInspection } from "../../application/ports/vault-folder.js";
import type { VaultRootInspection } from "../../application/ports/vault-mover.js";
import { type RelocationRequest, refuseUnsafeRelocation } from "./vault-relocation.js";

const CLEAN_SOURCE: VaultFolderInspection = {
  sidecars: [],
  conflictedCopies: [],
  staleBackups: [],
  looksLikeCloud: false,
};

const EMPTY_WRITABLE_DESTINATION: VaultRootInspection = {
  exists: true,
  writable: true,
  hasHeader: false,
  hasDb: false,
};

function request(overrides: Partial<RelocationRequest> = {}): RelocationRequest {
  return {
    sourceRoot: "/home/oscar/.valija",
    destinationRoot: "/home/oscar/Dropbox/valija",
    destinationInspection: EMPTY_WRITABLE_DESTINATION,
    sourceInspection: CLEAN_SOURCE,
    ...overrides,
  };
}

describe("refuseUnsafeRelocation", () => {
  it("allows a clean move to an empty, writable, unrelated destination", () => {
    expect(refuseUnsafeRelocation(request())).toBeNull();
  });

  it("refuses a destination that already has a vault.json — never merge", () => {
    const result = refuseUnsafeRelocation(
      request({ destinationInspection: { ...EMPTY_WRITABLE_DESTINATION, hasHeader: true } }),
    );
    expect(result?.code).toBe("RELOCATION_DESTINATION_OCCUPIED");
  });

  it("refuses a destination that already has a vault.db — never merge", () => {
    const result = refuseUnsafeRelocation(
      request({ destinationInspection: { ...EMPTY_WRITABLE_DESTINATION, hasDb: true } }),
    );
    expect(result?.code).toBe("RELOCATION_DESTINATION_OCCUPIED");
  });

  it("the occupied check runs before the unusable check — an occupied-but-unwritable folder still reports occupied", () => {
    const result = refuseUnsafeRelocation(
      request({
        destinationInspection: { exists: true, writable: false, hasHeader: true, hasDb: false },
      }),
    );
    expect(result?.code).toBe("RELOCATION_DESTINATION_OCCUPIED");
  });

  it("refuses a destination that does not exist", () => {
    const result = refuseUnsafeRelocation(
      request({ destinationInspection: { ...EMPTY_WRITABLE_DESTINATION, exists: false } }),
    );
    expect(result?.code).toBe("RELOCATION_DESTINATION_UNUSABLE");
  });

  it("refuses a destination that is not writable", () => {
    const result = refuseUnsafeRelocation(
      request({ destinationInspection: { ...EMPTY_WRITABLE_DESTINATION, writable: false } }),
    );
    expect(result?.code).toBe("RELOCATION_DESTINATION_UNUSABLE");
  });

  it("refuses a destination that IS the current vault folder", () => {
    const result = refuseUnsafeRelocation(
      request({ sourceRoot: "/home/oscar/.valija", destinationRoot: "/home/oscar/.valija" }),
    );
    expect(result?.code).toBe("RELOCATION_DESTINATION_NESTED");
  });

  it("refuses a destination nested inside the current vault folder", () => {
    const result = refuseUnsafeRelocation(
      request({
        sourceRoot: "/home/oscar/.valija",
        destinationRoot: "/home/oscar/.valija/nested/deeper",
      }),
    );
    expect(result?.code).toBe("RELOCATION_DESTINATION_NESTED");
  });

  it("does not refuse a sibling folder that merely shares a name prefix with the source", () => {
    const result = refuseUnsafeRelocation(
      request({ sourceRoot: "/home/oscar/.valija", destinationRoot: "/home/oscar/.valija-backup" }),
    );
    expect(result).toBeNull();
  });

  it("nesting is checked case-insensitively on darwin", () => {
    const result = refuseUnsafeRelocation(
      request({
        sourceRoot: "/Users/Oscar/.valija",
        destinationRoot: "/users/oscar/.valija/inner",
      }),
      "darwin",
    );
    expect(result?.code).toBe("RELOCATION_DESTINATION_NESTED");
  });

  it("nesting is checked case-sensitively on linux — a differently-cased path is not treated as nested", () => {
    const result = refuseUnsafeRelocation(
      request({
        sourceRoot: "/home/Oscar/.valija",
        destinationRoot: "/home/oscar/.valija/inner",
      }),
      "linux",
    );
    expect(result).toBeNull();
  });

  it("refuses a source folder with an unresolved conflicted copy", () => {
    const result = refuseUnsafeRelocation(
      request({
        sourceInspection: {
          ...CLEAN_SOURCE,
          conflictedCopies: ["/home/oscar/.valija/vault (conflicted copy).db"],
        },
      }),
    );
    expect(result?.code).toBe("RELOCATION_SOURCE_UNSETTLED");
  });

  it("refuses a source folder with a leftover upgrade backup", () => {
    const result = refuseUnsafeRelocation(
      request({
        sourceInspection: {
          ...CLEAN_SOURCE,
          staleBackups: ["/home/oscar/.valija/vault.db.pre-003.bak"],
        },
      }),
    );
    expect(result?.code).toBe("RELOCATION_SOURCE_UNSETTLED");
  });

  it("refuses a source folder that is not at rest (a sidecar is present)", () => {
    const result = refuseUnsafeRelocation(
      request({
        sourceInspection: { ...CLEAN_SOURCE, sidecars: ["/home/oscar/.valija/vault.db-wal"] },
      }),
    );
    expect(result?.code).toBe("RELOCATION_SOURCE_UNSETTLED");
  });

  it("checks the destination before the source — an occupied destination is reported even if the source is also unsettled", () => {
    const result = refuseUnsafeRelocation(
      request({
        destinationInspection: { ...EMPTY_WRITABLE_DESTINATION, hasHeader: true },
        sourceInspection: { ...CLEAN_SOURCE, sidecars: ["/home/oscar/.valija/vault.db-wal"] },
      }),
    );
    expect(result?.code).toBe("RELOCATION_DESTINATION_OCCUPIED");
  });
});
