import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GenericParser } from "./generic-parser.js";

const load = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), "utf8"));

const parser = new GenericParser();

describe("GenericParser", () => {
  it("detects the versioned envelope and rejects the others", () => {
    expect(parser.detect(load("generic"))).toBe(true);
    expect(parser.detect(load("chatgpt"))).toBe(false);
    expect(parser.detect(load("claude"))).toBe(false);
  });

  it("maps the envelope conversations", () => {
    const r = parser.parse(load("generic"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.failures).toEqual([]);
    const convo = r.value.conversations[0];
    if (convo === undefined) throw new Error("expected a conversation");
    expect(convo.id).toBe("generic-conv-1");
    expect(convo.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(convo.createdAt.toISOString()).toBe("2024-05-01T09:00:00.000Z");
  });

  it("rejects an unknown envelope version", () => {
    const r = parser.parse({ valija_import_version: 2, conversations: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UNSUPPORTED_GENERIC_VERSION");
  });

  it("collects a conversation with a bad date as a failure", () => {
    const r = parser.parse({
      valija_import_version: 1,
      conversations: [
        { id: "x", createdAt: "not-a-date", messages: [{ role: "user", content: "hi" }] },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.conversations).toEqual([]);
    expect(r.value.failures).toHaveLength(1);
  });
});
