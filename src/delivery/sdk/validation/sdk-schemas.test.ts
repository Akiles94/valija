import { describe, expect, it } from "vitest";
import {
  contextPackSchema,
  createVaultSchema,
  handoffSchema,
  openVaultSchema,
  parseInput,
  saveSchema,
  searchSchema,
} from "./sdk-schemas.js";

const SENTINEL = "zz-sentinel-value-zz";

const codeOf = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "ok" : r.error?.code);
const messageOf = (r: { ok: true } | { ok: false; error: { message: string } }) =>
  r.ok ? "" : r.error.message;

describe("client label (D-U)", () => {
  it.each(["acme-notes", "a", "x1", "0-9", "a".repeat(64)])("accepts %s", (client) => {
    expect(parseInput(openVaultSchema, { client }).ok).toBe(true);
  });

  it.each([
    "",
    "Acme",
    "-acme",
    "acme notes",
    "acme_notes",
    "a".repeat(65),
    "acmé",
  ])("rejects %j with INVALID_INPUT", (client) => {
    expect(codeOf(parseInput(openVaultSchema, { client }))).toBe("INVALID_INPUT");
  });

  it("is required by both openVault and createVault", () => {
    expect(codeOf(parseInput(openVaultSchema, {}))).toBe("INVALID_INPUT");
    expect(codeOf(parseInput(createVaultSchema, { passphrase: "x" }))).toBe("INVALID_INPUT");
  });
});

describe("openVault options", () => {
  it("a passphrase and a recovery key together → INVALID_INPUT", () => {
    const r = parseInput(openVaultSchema, {
      client: "acme",
      passphrase: SENTINEL,
      recoveryKey: SENTINEL,
    });
    expect(codeOf(r)).toBe("INVALID_INPUT");
    expect(messageOf(r)).toMatch(/not both/);
    expect(messageOf(r)).not.toContain(SENTINEL);
  });

  it("an empty vaultRoot or a non-boolean allowUpgrade → INVALID_INPUT", () => {
    expect(codeOf(parseInput(openVaultSchema, { client: "acme", vaultRoot: "" }))).toBe(
      "INVALID_INPUT",
    );
    expect(codeOf(parseInput(openVaultSchema, { client: "acme", allowUpgrade: "yes" }))).toBe(
      "INVALID_INPUT",
    );
  });

  it("a non-object → INVALID_INPUT", () => {
    expect(codeOf(parseInput(openVaultSchema, undefined))).toBe("INVALID_INPUT");
    expect(codeOf(parseInput(openVaultSchema, "acme"))).toBe("INVALID_INPUT");
  });
});

describe("save", () => {
  it("accepts each of the five saveable types", () => {
    for (const type of ["decision", "progress", "preference", "fact", "handoff"]) {
      expect(parseInput(saveSchema, { project: "p", content: "c", type }).ok).toBe(true);
    }
  });

  it("rejects imported", () => {
    expect(codeOf(parseInput(saveSchema, { project: "p", content: "c", type: "imported" }))).toBe(
      "INVALID_INPUT",
    );
  });

  it("strips a stray pinned (D-K, F14) and any other unknown key", () => {
    const r = parseInput(saveSchema, {
      project: "p",
      content: "c",
      pinned: true,
      allowSecrets: true,
    });
    expect(r.ok && Object.keys(r.value).sort()).toEqual(["content", "project"]);
  });

  it("caps tags at 10 and supersedes at 64 characters, as MCP does", () => {
    const tags = Array.from({ length: 11 }, (_, i) => `t${i}`);
    expect(codeOf(parseInput(saveSchema, { project: "p", content: "c", tags }))).toBe(
      "INVALID_INPUT",
    );
    expect(
      codeOf(parseInput(saveSchema, { project: "p", content: "c", supersedes: "x".repeat(65) })),
    ).toBe("INVALID_INPUT");
  });

  it("requires project and content as strings", () => {
    expect(codeOf(parseInput(saveSchema, { content: "c" }))).toBe("INVALID_INPUT");
    expect(codeOf(parseInput(handoffSchema, { project: "p", content: 42 }))).toBe("INVALID_INPUT");
  });
});

describe("getContextPack budget and search limit (F15)", () => {
  it.each([
    Number.POSITIVE_INFINITY,
    0,
    -1,
    2.5,
    Number.NaN,
  ])("rejects budget %s", (budgetTokens) => {
    expect(codeOf(parseInput(contextPackSchema, { project: "p", budgetTokens }))).toBe(
      "INVALID_INPUT",
    );
  });

  it("accepts a positive integer budget", () => {
    expect(parseInput(contextPackSchema, { project: "p", budgetTokens: 4000 }).ok).toBe(true);
  });

  it.each([2.5, 0, -3])("rejects limit %s", (limit) => {
    expect(codeOf(parseInput(searchSchema, { query: "q", limit }))).toBe("INVALID_INPUT");
  });

  it("leaves a large limit to SearchContext's clamp", () => {
    expect(parseInput(searchSchema, { query: "q", limit: 1000 }).ok).toBe(true);
  });
});

describe("messages name fields, never values", () => {
  it.each([
    () => parseInput(openVaultSchema, { client: SENTINEL.toUpperCase() }),
    () => parseInput(saveSchema, { project: "p", content: "c", type: SENTINEL }),
    () => parseInput(saveSchema, { project: "p", content: "c", tags: SENTINEL }),
    () => parseInput(searchSchema, { query: "q", project: 7, limit: SENTINEL }),
  ])("case %#", (parse) => {
    const r = parse();
    expect(codeOf(r)).toBe("INVALID_INPUT");
    expect(messageOf(r).toLowerCase()).not.toContain(SENTINEL);
  });

  it("names the offending field", () => {
    expect(messageOf(parseInput(contextPackSchema, { project: "p", budgetTokens: 0 }))).toContain(
      "budgetTokens",
    );
  });
});
