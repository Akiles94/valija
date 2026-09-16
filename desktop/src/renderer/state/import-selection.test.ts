import { describe, expect, it } from "vitest";
import type { ImportListingRow } from "../../shared/ipc/messages.js";
import {
  allChecked,
  buildPickSpec,
  countSelection,
  sortListingByDate,
  toggleVisibleSelection,
  visibleSelectionState,
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

describe("countSelection", () => {
  it("an empty selection counts as zero conversations and zero items", () => {
    const listing = [row(1, "2024-01-01", 3), row(2, "2024-01-02", 2)];
    expect(countSelection(listing, new Set())).toEqual({ conversationCount: 0, itemCount: 0 });
  });

  it("sums estimatedChunks only for the checked rows", () => {
    const listing = [row(1, "2024-01-01", 3), row(2, "2024-01-02", 2), row(3, "2024-01-03", 5)];
    expect(countSelection(listing, new Set([1, 3]))).toEqual({
      conversationCount: 2,
      itemCount: 8,
    });
  });

  it("a checked index absent from the listing is ignored, never NaN", () => {
    const listing = [row(1, "2024-01-01", 3)];
    expect(countSelection(listing, new Set([1, 99]))).toEqual({
      conversationCount: 1,
      itemCount: 3,
    });
  });
});

describe("visibleSelectionState", () => {
  const listing = [row(1, "2024-01-01"), row(2, "2024-01-02"), row(3, "2024-01-03")];

  it("every visible row checked: all", () => {
    expect(visibleSelectionState(new Set([1, 2, 3]), listing)).toBe("all");
  });

  it("no visible row checked: none", () => {
    expect(visibleSelectionState(new Set(), listing)).toBe("none");
  });

  it("some but not all visible rows checked: some", () => {
    expect(visibleSelectionState(new Set([1]), listing)).toBe("some");
  });

  it("an empty visible set is none, never all (an every over [] would lie)", () => {
    expect(visibleSelectionState(new Set([1, 2, 3]), [])).toBe("none");
  });

  it("only the visible rows' checked state counts — a hidden checked row doesn't turn a filtered-down view into 'some'", () => {
    // row 2 is checked but filtered out of `visible`; the two visible rows (1, 3) are both unchecked.
    const visible = [listing[0] as ImportListingRow, listing[2] as ImportListingRow];
    expect(visibleSelectionState(new Set([2]), visible)).toBe("none");
  });
});

describe("toggleVisibleSelection (D-12 Option 2: union/difference over visible rows only)", () => {
  const listing = [
    row(1, "2024-01-01"),
    row(2, "2024-01-02"),
    row(3, "2024-01-03"),
    row(4, "2024-01-04"),
  ];

  it("all visible checked: deselects exactly those", () => {
    const visible = [listing[0] as ImportListingRow, listing[1] as ImportListingRow];
    const checked = new Set([1, 2]);
    expect(toggleVisibleSelection(checked, visible)).toEqual(new Set());
  });

  it("none checked: selects exactly the visible ones", () => {
    const visible = [listing[0] as ImportListingRow, listing[1] as ImportListingRow];
    const checked = new Set<number>();
    expect(toggleVisibleSelection(checked, visible)).toEqual(new Set([1, 2]));
  });

  it("partial: selects the rest of the visible ones", () => {
    const visible = [
      listing[0] as ImportListingRow,
      listing[1] as ImportListingRow,
      listing[2] as ImportListingRow,
    ];
    const checked = new Set([1]);
    expect(toggleVisibleSelection(checked, visible)).toEqual(new Set([1, 2, 3]));
  });

  it("rows hidden by the filter keep their checked state — selecting all visible rows", () => {
    // row 4 is checked but hidden by the filter (not in `visible`); it must survive untouched.
    const visible = [listing[0] as ImportListingRow, listing[1] as ImportListingRow];
    const checked = new Set([4]);
    expect(toggleVisibleSelection(checked, visible)).toEqual(new Set([4, 1, 2]));
  });

  it("rows hidden by the filter keep their checked state — deselecting all visible rows", () => {
    const visible = [listing[0] as ImportListingRow, listing[1] as ImportListingRow];
    const checked = new Set([4, 1, 2]);
    expect(toggleVisibleSelection(checked, visible)).toEqual(new Set([4]));
  });

  it("an empty visible set: the toggle is a no-op", () => {
    const checked = new Set([1, 2]);
    expect(toggleVisibleSelection(checked, [])).toEqual(new Set([1, 2]));
  });

  it("after a toggle, buildPickSpec still emits sorted original 1-based indices", () => {
    const visible = [listing[2] as ImportListingRow, listing[0] as ImportListingRow];
    const next = toggleVisibleSelection(new Set(), visible);
    expect(buildPickSpec(next)).toBe("1,3");
  });
});
