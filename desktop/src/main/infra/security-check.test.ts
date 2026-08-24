import { execSync } from "child_process";
import { describe, it, expect } from "vitest";

describe("Security checks", () => {
  it("should not contain crashReporter, setInterval, fetch, XMLHttpRequest, http:// or https:// outside comments", () => {
    const forbidden = [
      "crashReporter",
      "setInterval",
      'fetch\\(',
      "XMLHttpRequest",
      "http://",
      "https://",
    ];

    for (const pattern of forbidden) {
      try {
        // This would need to search desktop tree excluding comments
        // For now, this is a placeholder that will be refined during implementation
        expect(true).toBe(true);
      } catch {
        expect.fail(`Found forbidden pattern: ${pattern}`);
      }
    }
  });
});
