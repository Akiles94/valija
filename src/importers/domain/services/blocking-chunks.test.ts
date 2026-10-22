import { describe, expect, it } from "vitest";
import { fragmentsOf, ONE_PER_TIER, PLANTED } from "../../../testing/fake-secrets.js";
import { type ChunkToScreen, findBlockingChunks } from "./blocking-chunks.js";

const header = (title: string, part: number) =>
  `> Imported from ChatGPT · "${title}" · 2024-03-15 · part ${part}/3`;

const chunk = (conversationIndex: number, title: string, part: number, body: string) =>
  ({
    conversationIndex,
    title,
    part,
    content: `${header(title, part)}\n\n${body}`,
  }) satisfies ChunkToScreen;

describe("findBlockingChunks", () => {
  it("returns nothing for clean chunks", () => {
    expect(findBlockingChunks([chunk(1, "Planning", 1, "**User:** hello")])).toEqual([]);
  });

  it("lists every flagged chunk with its index, part and findings, in order", () => {
    const result = findBlockingChunks([
      chunk(4, "Deploy debugging", 1, `**User:** key ${PLANTED.awsAccessKey}`),
      chunk(4, "Deploy debugging", 2, "**Assistant:** rotate it"),
      chunk(4, "Deploy debugging", 3, `**User:**\n${PLANTED.credentialAssignment.line}`),
    ]);
    expect(result).toEqual([
      {
        conversationIndex: 4,
        title: "Deploy debugging",
        part: 1,
        findings: [{ kind: "aws-access-key", firstLine: 3, lastLine: 3 }],
      },
      {
        conversationIndex: 4,
        title: "Deploy debugging",
        part: 3,
        findings: [{ kind: "credential-assignment", firstLine: 4, lastLine: 4 }],
      },
    ]);
  });

  it("hides the title when the provenance header itself is flagged (P-6)", () => {
    const titled = chunk(2, `token ${PLANTED.githubToken}`, 1, "**User:** hi");
    expect(findBlockingChunks([titled])[0]?.title).toBeNull();
  });

  it("keeps the title when the finding is in the body", () => {
    const body = ["**User:** one", "", "two", `${PLANTED.highEntropy}`].join("\n");
    const [blocking] = findBlockingChunks([chunk(3, "CI secrets", 1, body)]);
    expect(blocking).toMatchObject({ title: "CI secrets", findings: [{ firstLine: 6 }] });
  });

  it("never serializes a planted value", () => {
    const bodies = [
      `value ${PLANTED.awsAccessKey}`,
      PLANTED.credentialAssignment.line,
      `value ${PLANTED.highEntropy}`,
    ];
    const result = findBlockingChunks(bodies.map((body, i) => chunk(i + 1, `Title ${i}`, 1, body)));
    expect(result).toHaveLength(3);
    const serialized = JSON.stringify(result);
    for (const secret of ONE_PER_TIER) {
      for (const fragment of fragmentsOf(secret)) expect(serialized).not.toContain(fragment);
    }
  });
});
