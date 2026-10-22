import { describe, expect, it } from "vitest";
import { chooseRemote, remoteUrls } from "./git-config.js";

const config = (...lines: string[]) => lines.join("\n");

describe("remoteUrls", () => {
  it("reads every remote's url", () => {
    const text = config(
      "[core]",
      "\trepositoryformatversion = 0",
      '[remote "origin"]',
      "\turl = git@github.com:oscar/valija.git",
      "\tfetch = +refs/heads/*:refs/remotes/origin/*",
      '[remote "upstream"]',
      "\turl = https://github.com/upstream/valija.git",
    );
    expect([...remoteUrls(text)]).toEqual([
      ["origin", "git@github.com:oscar/valija.git"],
      ["upstream", "https://github.com/upstream/valija.git"],
    ]);
  });

  it("skips comments and blank lines, and strips quotes and trailing comments", () => {
    const text = config(
      "# a comment",
      "; another",
      "",
      '[remote "origin"]',
      '  url = "git@github.com:oscar/valija.git"',
      '[remote "mirror"]',
      "  url = https://example.com/oscar/mirror.git ; trailing",
    );
    const urls = remoteUrls(text);
    expect(urls.get("origin")).toBe("git@github.com:oscar/valija.git");
    expect(urls.get("mirror")).toBe("https://example.com/oscar/mirror.git");
  });

  it("treats the section name case-insensitively and the subsection case-sensitively", () => {
    const text = config('[Remote "Origin"]', "URL = git@github.com:oscar/valija.git");
    const urls = remoteUrls(text);
    expect(urls.get("Origin")).toBe("git@github.com:oscar/valija.git");
    expect(urls.has("origin")).toBe(false);
  });

  it("keeps the first url of a remote", () => {
    const text = config(
      '[remote "origin"]',
      "url = git@github.com:oscar/first.git",
      "url = git@github.com:oscar/second.git",
    );
    expect(remoteUrls(text).get("origin")).toBe("git@github.com:oscar/first.git");
  });

  it("ignores include sections and urls outside a remote section", () => {
    const text = config(
      "[include]",
      "  path = ../evil.config",
      '[includeIf "gitdir:~/work/"]',
      "  path = ~/work.config",
      '[url "git@github.com:"]',
      "  insteadOf = https://github.com/",
      '[branch "main"]',
      "  url = git@github.com:not/a-remote.git",
    );
    expect(remoteUrls(text).size).toBe(0);
  });

  it("closes a remote section at the next header", () => {
    const text = config('[remote "origin"]', "[core]", "url = git@github.com:oscar/valija.git");
    expect(remoteUrls(text).size).toBe(0);
  });

  it("accepts dotted subsection names", () => {
    const text = config('[remote "a.b"]', "url = git@github.com:oscar/ab.git");
    expect(remoteUrls(text).get("a.b")).toBe("git@github.com:oscar/ab.git");
  });
});

describe("chooseRemote", () => {
  it("prefers origin over any other remote", () => {
    const remotes = new Map([
      ["upstream", "u"],
      ["origin", "o"],
    ]);
    expect(chooseRemote(remotes)).toBe("o");
  });

  it("falls back to the only remote", () => {
    expect(chooseRemote(new Map([["upstream", "u"]]))).toBe("u");
  });

  it("chooses nothing among two non-origin remotes, or none", () => {
    const remotes = new Map([
      ["upstream", "u"],
      ["fork", "f"],
    ]);
    expect(chooseRemote(remotes)).toBeNull();
    expect(chooseRemote(new Map())).toBeNull();
  });
});
