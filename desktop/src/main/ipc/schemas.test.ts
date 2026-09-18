import { describe, expect, it } from "vitest";
import { CHANNELS } from "../../shared/ipc/channels.js";
import { SCHEMAS } from "./schemas.js";

describe("SCHEMAS — one entry per channel", () => {
  it("has exactly one schema per channel, no more, no fewer", () => {
    expect(Object.keys(SCHEMAS).sort()).toEqual([...CHANNELS].sort());
  });
});

describe("schema rejection", () => {
  it("rejects a request missing a required field", () => {
    expect(SCHEMAS["vault:init"].safeParse({}).success).toBe(false);
    expect(SCHEMAS["content:show"].safeParse({}).success).toBe(false);
    expect(SCHEMAS["tools:connect"].safeParse({}).success).toBe(false);
  });

  it("rejects a request with the wrong type for a field", () => {
    expect(SCHEMAS["vault:init"].safeParse({ passphrase: 12345 }).success).toBe(false);
    expect(SCHEMAS["content:search"].safeParse({ query: "x", limit: "not a number" }).success).toBe(
      false,
    );
  });

  it("rejects an unrecognized enum value", () => {
    expect(SCHEMAS["content:export"].safeParse({ project: "alpha", format: "pdf" }).success).toBe(
      false,
    );
    expect(
      SCHEMAS["preferences:write"].safeParse({
        vaultPath: null,
        theme: "purple",
        language: "system",
        tourSeen: false,
      }).success,
    ).toBe(false);
  });

  it("void channels reject a non-undefined payload", () => {
    expect(SCHEMAS["vault:lock"].safeParse({ anything: true }).success).toBe(false);
    expect(SCHEMAS["vault:lock"].safeParse(undefined).success).toBe(true);
  });

  it("accepts a valid request for every channel's happy path", () => {
    expect(
      SCHEMAS["vault:init"].safeParse({ passphrase: "correct horse battery staple" }).success,
    ).toBe(true);
    expect(SCHEMAS["import:list"].safeParse({ handle: "fh-1" }).success).toBe(true);
    expect(
      SCHEMAS["preferences:write"].safeParse({
        theme: "dark",
        language: "es",
        tourSeen: true,
      }).success,
    ).toBe(true);
  });

  it("preferences:write strips a vaultPath even if a caller sends one (§8.6) — the parsed payload never carries a path", () => {
    const result = SCHEMAS["preferences:write"].safeParse({
      theme: "dark",
      language: "es",
      tourSeen: true,
      vaultPath: "/anything/an/attacker/wants",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("vaultPath");
    }
  });
});

describe("no channel accepts a free-form, path-shaped field (§8.6)", () => {
  const PATH_LIKE_NAMES = ["path", "filePath", "file", "folder", "folderPath", "directory", "dir"];

  it("no schema's shape declares a field named like a filesystem path", () => {
    for (const [channel, schema] of Object.entries(SCHEMAS)) {
      const shape = (schema as { shape?: Record<string, unknown> }).shape;
      if (shape === undefined) continue; // z.void() has no shape
      const offending = Object.keys(shape).filter((key) =>
        PATH_LIKE_NAMES.includes(key.toLowerCase()),
      );
      expect(offending, `${channel} has path-shaped field(s): ${offending.join(", ")}`).toEqual([]);
    }
  });
});
