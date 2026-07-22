import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ChatgptParser } from "./chatgpt-parser.js";

const load = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), "utf8"));

const parser = new ChatgptParser();

describe("ChatgptParser", () => {
  it("detects a ChatGPT export and rejects the others", () => {
    expect(parser.detect(load("chatgpt"))).toBe(true);
    expect(parser.detect(load("claude"))).toBe(false);
    expect(parser.detect(load("generic"))).toBe(false);
  });

  it("linearizes the mapping tree into ordered messages", () => {
    const r = parser.parse(load("chatgpt"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.failures).toEqual([]);
    expect(r.value.conversations).toHaveLength(1);
    const convo = r.value.conversations[0];
    if (convo === undefined) throw new Error("expected a conversation");
    expect(convo.id).toBe("chatgpt-conv-1");
    expect(convo.title).toBe("Postgres indexing");
    expect(convo.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(convo.messages[0]?.content).toContain("jsonb");
    expect(convo.createdAt.toISOString()).toBe(new Date(1710500000 * 1000).toISOString());
  });

  it("collects a malformed conversation as a failure, never throwing", () => {
    const r = parser.parse([{ mapping: "not-an-object" }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.conversations).toEqual([]);
    expect(r.value.failures).toHaveLength(1);
  });
});
