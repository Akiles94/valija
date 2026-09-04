import { describe, expect, it } from "vitest";
import { en } from "./en.js";
import { es } from "./es.js";

/**
 * P4 (advance CONNECT): the onboarding copy must not tell users to type a
 * "/save-context" slash command. The prompt is real, but Claude Code namespaces
 * MCP prompts, so a bare "/save-context" is never a command the user can type.
 * Step 3 must steer to natural language instead.
 */
describe("connect.step3Body steers to natural language, not a slash command", () => {
  for (const [lang, catalog] of [
    ["en", en],
    ["es", es],
  ] as const) {
    const body = catalog.connect.step3Body;

    it(`${lang}: does not advertise the /save-context slash command`, () => {
      expect(body).not.toContain("/save-context");
      expect(body).not.toContain("/mcp__valija");
    });

    it(`${lang}: keeps a concrete natural-language cue`, () => {
      expect(body).toContain("TypeScript");
    });
  }
});
