import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ClaudeParser } from "./claude-parser.js";

const load = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), "utf8"));

const parser = new ClaudeParser();

describe("ClaudeParser", () => {
  it("detects a Claude export and rejects the others", () => {
    expect(parser.detect(load("claude"))).toBe(true);
    expect(parser.detect(load("chatgpt"))).toBe(false);
    expect(parser.detect(load("generic"))).toBe(false);
  });

  it("maps senders to roles and reads text from both shapes", () => {
    const r = parser.parse(load("claude"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.failures).toEqual([]);
    const convo = r.value.conversations[0];
    if (convo === undefined) throw new Error("expected a conversation");
    expect(convo.id).toBe("claude-conv-1");
    expect(convo.title).toBe("Rust ownership");
    expect(convo.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    // assistant message has empty `text` but a typed content block
    expect(convo.messages[1]?.content).toContain("ownership and lifetime");
    expect(convo.createdAt.toISOString()).toBe("2024-04-01T10:00:00.000Z");
  });

  it("collects a malformed conversation as a failure, never throwing", () => {
    const r = parser.parse([{ chat_messages: "nope" }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.conversations).toEqual([]);
    expect(r.value.failures).toHaveLength(1);
  });
});
