import { describe, expect, it } from "vitest";
import { linkChoicesFor } from "./binding-link.js";

describe("linkChoicesFor", () => {
  it.each([
    ["a repository with a remote", "github.com/oscar/valija", true, ["repository", "folder"]],
    ["a too-broad folder that is a repository", "github.com/oscar/dotfiles", false, ["repository"]],
    ["a plain folder", null, true, ["folder"]],
    ["a too-broad plain folder", null, false, []],
  ] as const)("offers the right options for %s", (_, remote, canLinkFolder, expected) => {
    expect(linkChoicesFor({ remote, canLinkFolder })).toEqual(expected);
  });
});
