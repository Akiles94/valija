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

describe("curation channel schemas", () => {
  it.each([
    ["content:setPinned", "pinned"],
    ["content:setArchived", "archived"],
  ] as const)("%s accepts {id, %s} and nothing looser", (channel, flag) => {
    const schema = SCHEMAS[channel];
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ id: "x", [flag]: "yes" }).success).toBe(false);
    expect(schema.safeParse({ id: "a".repeat(65), [flag]: true }).success).toBe(false);
    expect(schema.safeParse({ id: "01SEQ000001", [flag]: true }).success).toBe(true);
  });

  it("strips an unexpected patch field", () => {
    const parsed = SCHEMAS["content:setPinned"].safeParse({
      id: "01SEQ000001",
      pinned: true,
      patch: { content: "x" },
    });
    expect(parsed.success && parsed.data).toEqual({ id: "01SEQ000001", pinned: true });
  });

  it("content:show only takes a boolean includeArchived", () => {
    expect(
      SCHEMAS["content:show"].safeParse({ project: "p", includeArchived: "true" }).success,
    ).toBe(false);
    expect(SCHEMAS["content:show"].safeParse({ project: "p", includeArchived: true }).success).toBe(
      true,
    );
  });
});

describe("content:edit schema", () => {
  const schema = SCHEMAS["content:edit"];

  it("accepts an id with any subset of fields", () => {
    expect(schema.safeParse({ id: "01SEQ000001" }).success).toBe(true);
    expect(
      schema.safeParse({ id: "01SEQ000001", content: "x", tags: [], type: "fact" }).success,
    ).toBe(true);
  });

  it("rejects wrong types and oversized values", () => {
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ id: "01SEQ000001", tags: "a,b" }).success).toBe(false);
    expect(schema.safeParse({ id: "01SEQ000001", content: "x".repeat(1_000_001) }).success).toBe(
      false,
    );
    expect(schema.safeParse({ id: "01SEQ000001", tags: Array(101).fill("t") }).success).toBe(false);
    expect(schema.safeParse({ id: "a".repeat(65) }).success).toBe(false);
  });

  it("lets over-limit edits through to EditItem, so they come back as their real error code", () => {
    expect(schema.safeParse({ id: "01SEQ000001", tags: Array(11).fill("t") }).success).toBe(true);
    expect(schema.safeParse({ id: "01SEQ000001", tags: ["t".repeat(33)] }).success).toBe(true);
    expect(schema.safeParse({ id: "01SEQ000001", content: "x".repeat(40_000) }).success).toBe(true);
  });
});

describe("bindings channel schemas", () => {
  it("bindings:link takes a handle, a project name and a closed `by`", () => {
    const schema = SCHEMAS["bindings:link"];
    expect(schema.safeParse({ handle: "pf-1", projectName: "valija" }).success).toBe(false);
    expect(schema.safeParse({ handle: "pf-1", projectName: "valija", by: "marker" }).success).toBe(
      false,
    );
    expect(
      schema.safeParse({ handle: "p".repeat(65), projectName: "valija", by: "folder" }).success,
    ).toBe(false);
    expect(schema.safeParse({ handle: "pf-1", projectName: "valija", by: "folder" }).success).toBe(
      true,
    );
  });

  it("strips a path a caller slips into bindings:link or bindings:inspect", () => {
    const link = SCHEMAS["bindings:link"].safeParse({
      handle: "pf-1",
      projectName: "valija",
      by: "repository",
      path: "/anything/an/attacker/wants",
    });
    expect(link.success && link.data).toEqual({
      handle: "pf-1",
      projectName: "valija",
      by: "repository",
    });
    const inspect = SCHEMAS["bindings:inspect"].safeParse({ handle: "pf-1", directory: "/etc" });
    expect(inspect.success && inspect.data).toEqual({ handle: "pf-1" });
  });

  it("bindings:unlink needs an id; bindings:list takes an optional project", () => {
    expect(SCHEMAS["bindings:unlink"].safeParse({}).success).toBe(false);
    expect(SCHEMAS["bindings:unlink"].safeParse({ bindingId: "01SEQ000001" }).success).toBe(true);
    expect(SCHEMAS["bindings:list"].safeParse({}).success).toBe(true);
    expect(SCHEMAS["bindings:list"].safeParse({ projectName: "valija" }).success).toBe(true);
    expect(SCHEMAS["bindings:list"].safeParse({ projectName: 7 }).success).toBe(false);
  });

  it("dialog:chooseProjectFolder takes no payload", () => {
    expect(SCHEMAS["dialog:chooseProjectFolder"].safeParse(undefined).success).toBe(true);
    expect(SCHEMAS["dialog:chooseProjectFolder"].safeParse({ path: "/" }).success).toBe(false);
  });
});
