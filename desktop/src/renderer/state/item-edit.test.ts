import { describe, expect, it } from "vitest";
import { draftFor, editRequestFor, parseTagsInput } from "./item-edit.js";

const original = { content: "we chose sqlcipher", tags: ["db", "crypto"], type: "decision" };

describe("parseTagsInput", () => {
  it("splits on commas, trims and drops empties", () => {
    expect(parseTagsInput(" db ,, crypto ,")).toEqual(["db", "crypto"]);
  });

  it("turns an empty field into no tags", () => {
    expect(parseTagsInput("  ")).toEqual([]);
  });
});

describe("editRequestFor", () => {
  it("returns null when nothing changed", () => {
    expect(editRequestFor("01A", original, draftFor(original))).toBeNull();
  });

  it("sends only the fields that differ", () => {
    const draft = { ...draftFor(original), content: "we chose libsodium" };
    expect(editRequestFor("01A", original, draft)).toEqual({
      id: "01A",
      content: "we chose libsodium",
    });
  });

  it("sends an empty tag list to clear the tags", () => {
    const draft = { ...draftFor(original), tags: "" };
    expect(editRequestFor("01A", original, draft)).toEqual({ id: "01A", tags: [] });
  });

  it("treats a reordered tag list as a change", () => {
    const draft = { ...draftFor(original), tags: "crypto, db" };
    expect(editRequestFor("01A", original, draft)).toEqual({ id: "01A", tags: ["crypto", "db"] });
  });

  it("sends a new type", () => {
    const draft = { ...draftFor(original), type: "fact" };
    expect(editRequestFor("01A", original, draft)).toEqual({ id: "01A", type: "fact" });
  });
});
