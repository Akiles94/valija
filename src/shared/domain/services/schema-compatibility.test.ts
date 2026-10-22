import { describe, expect, it } from "vitest";
import { compareSchema } from "./schema-compatibility.js";

describe("compareSchema", () => {
  it("a vault below the supported schema is behind", () => {
    expect(compareSchema(3, 4)).toBe("behind");
  });

  it("a vault at the supported schema is current", () => {
    expect(compareSchema(4, 4)).toBe("current");
  });

  it("a vault above the supported schema is newer", () => {
    expect(compareSchema(5, 4)).toBe("newer");
  });
});
