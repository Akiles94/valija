import { describe, expect, it } from "vitest";
import { parseContent } from "../../../context/domain/values/content.js";
import type { Conversation, Message } from "../entities/conversation.js";
import { renderConversationChunks } from "./chunk-render.js";

const msg = (role: Message["role"], content: string): Message => ({ role, content });

const convo = (messages: Message[], over: Partial<Conversation> = {}): Conversation => ({
  id: "c1",
  title: "Test conversation",
  createdAt: new Date("2024-03-15T10:00:00Z"),
  messages,
  ...over,
});

describe("renderConversationChunks", () => {
  it("renders a short conversation as one chunk with provenance and part 1/1", () => {
    const chunks = renderConversationChunks(
      convo([msg("user", "hi"), msg("assistant", "hello")]),
      "chatgpt",
    );
    expect(chunks).toHaveLength(1);
    const only = chunks[0];
    if (only === undefined) throw new Error("expected one chunk");
    expect(only).toContain("Imported from ChatGPT");
    expect(only).toContain("Test conversation");
    expect(only).toContain("2024-03-15");
    expect(only).toContain("part 1/1");
    expect(only).toContain("**User:** hi");
    expect(only).toContain("**Assistant:** hello");
    expect(parseContent(only).ok).toBe(true);
  });

  it("splits a long conversation on message boundaries into valid parts", () => {
    const big = "word ".repeat(2000); // ~10 KB per message
    const messages = Array.from({ length: 6 }, (_, i) =>
      msg(i % 2 === 0 ? "user" : "assistant", `${big}${i}`),
    );
    const chunks = renderConversationChunks(convo(messages), "claude");
    expect(chunks.length).toBeGreaterThan(1);
    const total = chunks.length;
    chunks.forEach((chunk, index) => {
      expect(chunk).toContain(`part ${index + 1}/${total}`);
      expect(parseContent(chunk).ok).toBe(true);
    });
  });

  it("hard-splits a single oversize message without breaking UTF-8", () => {
    const huge = "😀".repeat(10000); // 40 KB of 4-byte codepoints, over the budget
    const chunks = renderConversationChunks(convo([msg("user", huge)]), "generic");
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(parseContent(chunk).ok).toBe(true);
      expect(chunk).not.toContain("�");
      expect(Buffer.from(chunk, "utf8").toString("utf8")).toBe(chunk);
    }
  });

  it("returns no chunks for a conversation with no messages", () => {
    expect(renderConversationChunks(convo([]), "chatgpt")).toEqual([]);
  });
});
