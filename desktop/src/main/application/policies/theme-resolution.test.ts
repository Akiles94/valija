import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "../ports/app-preferences.js";
import { resolveTheme } from "./theme-resolution.js";

describe("resolveTheme", () => {
  it("follows the system preference when the choice is 'system'", () => {
    expect(resolveTheme({ ...DEFAULT_PREFERENCES, theme: "system" }, true)).toBe("dark");
    expect(resolveTheme({ ...DEFAULT_PREFERENCES, theme: "system" }, false)).toBe("light");
  });

  it("a manual override wins over the system preference", () => {
    expect(resolveTheme({ ...DEFAULT_PREFERENCES, theme: "light" }, true)).toBe("light");
    expect(resolveTheme({ ...DEFAULT_PREFERENCES, theme: "dark" }, false)).toBe("dark");
  });
});
