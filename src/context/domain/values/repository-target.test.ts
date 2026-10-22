import { describe, expect, it } from "vitest";
import {
  parseRepositoryTarget,
  type RepositoryTarget,
  repositoryName,
} from "./repository-target.js";

const REJECT = "reject";
const outcomeOf = (r: ReturnType<typeof parseRepositoryTarget>) => (r.ok ? r.value : REJECT);

describe("parseRepositoryTarget", () => {
  it.each([
    ["git@github.com:oscar/valija.git", "github.com/oscar/valija"],
    ["git@github.com:oscar/valija", "github.com/oscar/valija"],
    ["https://github.com/oscar/valija.git", "github.com/oscar/valija"],
    ["https://github.com/oscar/valija/", "github.com/oscar/valija"],
    ["https://github.com/oscar/valija.git/", "github.com/oscar/valija"],
    ["ssh://git@github.com:22/oscar/valija.git", "github.com/oscar/valija"],
    ["git+ssh://git@github.com/oscar/valija.git", "github.com/oscar/valija"],
    ["https://oscar:ghp_SECRET@github.com/oscar/valija.git", "github.com/oscar/valija"],
    ["http://github.com//oscar//valija", "github.com/oscar/valija"],
    ["git://GitHub.COM/Oscar/Valija", "github.com/Oscar/Valija"],
    ["git@gitlab.com:group/sub/repo.git", "gitlab.com/group/sub/repo"],
    ["git@example.org:~/repo.git", "example.org/repo"],
    ["  git@github.com:oscar/valija.git\n", "github.com/oscar/valija"],
    ["/srv/git/repo.git", REJECT],
    ["file:///srv/repo", REJECT],
    ["C:\\repos\\x", REJECT],
    ["", REJECT],
    ["https://github.com/", REJECT],
    ["https://github.com/../x", REJECT],
    ["https://github.com/oscar/./valija", REJECT],
    ["git@github.com:oscar/valija?token=abc", REJECT],
    ["ftp://github.com/oscar/valija", REJECT],
    ["https://exa_mple.com/oscar/valija", REJECT],
    [`https://github.com/${"a".repeat(2048)}`, REJECT],
  ])("%s → %s", (raw, expected) => {
    expect(outcomeOf(parseRepositoryTarget(raw))).toBe(expected);
  });

  it("strips a credential so it never appears anywhere in the result", () => {
    const serialized = JSON.stringify(
      parseRepositoryTarget("https://oscar:ghp_SECRET@github.com/oscar/valija.git"),
    );
    expect(serialized).not.toContain("ghp_SECRET");
    expect(serialized).not.toContain("oscar:");
  });

  it("rejects with NO_GIT_REMOTE and one fixed sentence that never echoes the input", () => {
    const rejected = ["/srv/git/repo.git", "https://tok3n_XYZ@github.com/", "C:\\repos\\x"];
    const messages = rejected.map((raw) => {
      const r = parseRepositoryTarget(raw);
      expect(!r.ok && r.error.code).toBe("NO_GIT_REMOTE");
      return r.ok ? "" : r.error.message;
    });
    expect(new Set(messages).size).toBe(1);
    expect(messages[0]).not.toContain("tok3n_XYZ");
  });
});

describe("repositoryName", () => {
  it("is the last path segment", () => {
    expect(repositoryName("gitlab.com/group/sub/repo" as RepositoryTarget)).toBe("repo");
  });
});
