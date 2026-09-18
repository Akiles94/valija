import { describe, expect, it } from "vitest";
import { parseProjectName } from "../../../../src/context/domain/values/project-name.js";
import { previewProjectSlug, slugifyProjectName } from "./project-slug.js";

describe("slugifyProjectName", () => {
  it.each([
    ["Openai 1", "openai-1"],
    ["Café Ñandú ☕", "cafe-nandu"],
    ["  --Hola--  ", "hola"],
    ["☕☕", ""],
    ["проект", ""],
    ["プロジェクト", ""],
    ["a".repeat(80), "a".repeat(64)],
    ["9lives", "9lives"],
    ["-x", "x"],
    ["openai-1", "openai-1"],
  ])("%j -> %j", (raw, expected) => {
    expect(slugifyProjectName(raw)).toBe(expected);
  });

  it("never emits a slug longer than 64 characters", () => {
    expect(slugifyProjectName("a".repeat(80)).length).toBe(64);
  });

  it("never emits a slug with a trailing hyphen after truncation", () => {
    const raw = `${"a".repeat(63)} b`; // char 64 would be the hyphen that replaces the space
    expect(slugifyProjectName(raw).endsWith("-")).toBe(false);
  });

  it.each([
    "Openai 1",
    "Café Ñandú ☕",
    "  --Hola--  ",
    "a".repeat(80),
    "9lives",
    "-x",
    "openai-1",
  ])("every non-empty slug it emits satisfies parseProjectName: %j", (raw) => {
    const slug = slugifyProjectName(raw);
    expect(slug).not.toBe("");
    expect(parseProjectName(slug).ok).toBe(true);
  });
});

describe("previewProjectSlug", () => {
  const existingProjects = ["mi-proyecto"];

  it("is hidden for empty input", () => {
    expect(previewProjectSlug("", existingProjects)).toEqual({ kind: "hidden" });
  });

  it("is hidden when the typed text is already a valid slug", () => {
    expect(previewProjectSlug("openai-1", existingProjects)).toEqual({ kind: "hidden" });
  });

  it("previews the slug a human-typed name will become", () => {
    expect(previewProjectSlug("Openai 1", existingProjects)).toEqual({
      kind: "preview",
      slug: "openai-1",
    });
  });

  it("is empty when no valid slug can be produced", () => {
    expect(previewProjectSlug("☕☕", existingProjects)).toEqual({ kind: "empty" });
  });

  it("flags a collision with an existing project", () => {
    expect(previewProjectSlug("Mi Proyecto", existingProjects)).toEqual({
      kind: "existing",
      slug: "mi-proyecto",
    });
  });

  it("flags the collision even when the typed text is already that exact slug", () => {
    expect(previewProjectSlug("mi-proyecto", existingProjects)).toEqual({
      kind: "existing",
      slug: "mi-proyecto",
    });
  });
});
