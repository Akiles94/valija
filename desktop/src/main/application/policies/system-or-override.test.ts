import { describe, expect, it } from "vitest";
import { resolveSystemOrOverride } from "./system-or-override.js";

describe("resolveSystemOrOverride", () => {
  it("returns the system value when the choice is 'system'", () => {
    expect(resolveSystemOrOverride("system", "dark")).toBe("dark");
    expect(resolveSystemOrOverride("system", "es")).toBe("es");
  });

  it("returns the override when the choice is not 'system'", () => {
    expect(resolveSystemOrOverride("light", "dark")).toBe("light");
    expect(resolveSystemOrOverride("en", "es")).toBe("en");
  });
});
