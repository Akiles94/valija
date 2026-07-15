import { describe, expect, it } from "vitest";
import { MAX_CONTENT_BYTES, parseContent } from "./content.js";
import { ITEM_TYPES, parseItemType } from "./item-type.js";
import { parseProjectName } from "./project-name.js";
import { MAX_TAGS, parseTag, parseTags } from "./tag.js";

describe("ProjectName", () => {
  it("accepts valid slugs", () => {
    for (const name of ["vault-app", "a", "my-project-2", "123"]) {
      expect(parseProjectName(name).ok, name).toBe(true);
    }
  });

  it("normalizes case and whitespace", () => {
    const r = parseProjectName("  Vault-App  ");
    expect(r.ok && r.value).toBe("vault-app");
  });

  it("rejects invalid names", () => {
    for (const name of ["", "-leading", "has space", "has_underscore", "ñandú", "a".repeat(65)]) {
      const r = parseProjectName(name);
      expect(r.ok, name).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("INVALID_PROJECT_NAME");
    }
  });

  it("accepts exactly 64 chars", () => {
    expect(parseProjectName("a".repeat(64)).ok).toBe(true);
  });
});

describe("ItemType", () => {
  it("accepts all five types", () => {
    for (const t of ITEM_TYPES) expect(parseItemType(t).ok).toBe(true);
  });

  it("rejects unknown types", () => {
    const r = parseItemType("note");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVALID_ITEM_TYPE");
  });
});

describe("Content", () => {
  it("trims and accepts normal content", () => {
    const r = parseContent("  we chose SQLCipher  ");
    expect(r.ok && r.value).toBe("we chose SQLCipher");
  });

  it("rejects empty content", () => {
    const r = parseContent("   ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONTENT_EMPTY");
  });

  it("rejects content over 32 KB (measured in bytes, not chars)", () => {
    const r = parseContent("ñ".repeat(MAX_CONTENT_BYTES / 2 + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONTENT_TOO_LARGE");
  });

  it("accepts content at exactly the limit", () => {
    expect(parseContent("a".repeat(MAX_CONTENT_BYTES)).ok).toBe(true);
  });
});

describe("Tag", () => {
  it("normalizes to lowercase", () => {
    const r = parseTag("SQLCipher");
    expect(r.ok && r.value).toBe("sqlcipher");
  });

  it("rejects invalid tags", () => {
    for (const t of ["", "-x", "with space", "a".repeat(33)]) {
      expect(parseTag(t).ok, t).toBe(false);
    }
  });

  it("deduplicates and caps at MAX_TAGS", () => {
    const r = parseTags(["db", "DB", "crypto"]);
    expect(r.ok && r.value).toEqual(["db", "crypto"]);
    const over = parseTags(Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${i}`));
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.code).toBe("TOO_MANY_TAGS");
  });
});
