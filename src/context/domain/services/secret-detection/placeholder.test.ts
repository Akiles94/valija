import { describe, expect, it } from "vitest";
import { isPlaceholder } from "./placeholder.js";

/** `${name}` without tripping the template-in-string lint. */
const shellTemplate = (name: string) => ["$", "{", name, "}"].join("");

describe("isPlaceholder", () => {
  it.each([
    "<API_KEY>",
    "<your-password>",
    shellTemplate("X"),
    shellTemplate("DB_PASSWORD"),
    "{{x}}",
    "%X%",
    "$X",
    "xxxxxxxx",
    "********",
    "........",
    "example",
    "an-Example-value",
    "YOUR_KEY",
    "your-key",
    "redacted",
    "REDACTED_VALUE",
    "dummy",
    "sample",
    "changeme",
    "placeholder",
    ["AKIA", "IOSFODNN7", "EXAMPLE"].join(""),
  ])("%s is a placeholder", (value) => {
    expect(isPlaceholder(value)).toBe(true);
  });

  it.each([
    "S3cr3t!Passw0rd",
    "Pa$sword9",
    "Hunter2Hunter2",
    "q9WvT3kZ8LmN",
    "aab",
  ])("%s is not a placeholder", (value) => {
    expect(isPlaceholder(value)).toBe(false);
  });
});
