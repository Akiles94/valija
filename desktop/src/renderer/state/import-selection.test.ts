import { describe, expect, it } from "vitest";
import type { ImportListingRow } from "../../shared/ipc/messages.js";
import {
  allChecked,
  buildPickSpec,
  countSelection,
  sortListingByDate,
} from "./import-selection.js";

function row(index: number, date: string, estimatedChunks = 1): ImportListingRow {
  return { index, title: `Row ${index}`, date, messageCount: 2, estimatedChunks };
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

describe("countSelection", () => {
  it("returns {0, 0} for an empty selection", () => {
    const listing = [row(1, "2024-01-01", 3), row(2, "2024-01-02", 5)];
    expect(countSelection(listing, new Set())).toEqual({ conversationCount: 0, itemCount: 0 });
  });

  it("sums only the checked rows' estimatedChunks", () => {
    const listing = [row(1, "2024-01-01", 3), row(2, "2024-01-02", 5), row(3, "2024-01-03", 2)];
    expect(countSelection(listing, new Set([1, 3]))).toEqual({
      conversationCount: 2,
      itemCount: 5,
    });
  });

  it("ignores a checked index absent from the listing, never NaN", () => {
    const listing = [row(1, "2024-01-01", 3)];
    expect(countSelection(listing, new Set([1, 99]))).toEqual({
      conversationCount: 1,
      itemCount: 3,
    });
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
