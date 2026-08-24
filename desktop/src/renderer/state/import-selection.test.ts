import { describe, expect, it } from "vitest";
import type { ImportListingRow } from "../../shared/ipc/messages.js";
import { allChecked, buildPickSpec, sortListingByDate } from "./import-selection.js";

function row(index: number, date: string): ImportListingRow {
  return { index, title: `Row ${index}`, date, messageCount: 2, estimatedChunks: 1 };
}

describe("buildPickSpec", () => {
  it("returns undefined for an empty selection — the caller must disable Preview/Import on this", () => {
    expect(buildPickSpec(new Set())).toBeUndefined();
  });

  it("joins checked indices in ascending order regardless of insertion order", () => {
    expect(buildPickSpec(new Set([5, 1, 3]))).toBe("1,3,5");
  });

  it("a single checked index has no trailing comma", () => {
    expect(buildPickSpec(new Set([7]))).toBe("7");
  });
});

describe("allChecked", () => {
  it("returns a set of every row's original index", () => {
    const listing = [row(1, "2024-01-01"), row(2, "2024-01-02"), row(3, "2024-01-03")];
    expect(allChecked(listing)).toEqual(new Set([1, 2, 3]));
  });

  it("is empty for an empty listing", () => {
    expect(allChecked([])).toEqual(new Set());
  });
});

describe("sortListingByDate", () => {
  const listing = [row(1, "2024-05-02"), row(2, "2024-05-01"), row(3, "2024-05-03")];

  it("ascending puts the earliest date first", () => {
    expect(sortListingByDate(listing, "asc").map((r) => r.index)).toEqual([2, 1, 3]);
  });

  it("descending puts the latest date first", () => {
    expect(sortListingByDate(listing, "desc").map((r) => r.index)).toEqual([3, 1, 2]);
  });

  it("never mutates the original listing array", () => {
    const copy = [...listing];
    sortListingByDate(listing, "desc");
    expect(listing).toEqual(copy);
  });
});
