import { describe, expect, it } from "vitest";
import { fragmentsOf, PLANTED } from "../../../../testing/fake-secrets.js";
import {
  importRefusedMessage,
  refuseFlaggedImport,
  refusePossibleSecrets,
} from "./secret-refusal.js";

const flagged = `Deploy notes\nexport AWS_ACCESS_KEY_ID=${PLANTED.awsAccessKey}`;

describe("refusePossibleSecrets", () => {
  it("lets clean content through", () => {
    expect(refusePossibleSecrets("We chose SQLCipher.").ok).toBe(true);
  });

  it("refuses with POSSIBLE_SECRET, naming kind and line but never the value", () => {
    const result = refusePossibleSecrets(flagged);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("POSSIBLE_SECRET");
    expect(result.error.message).toBe(
      "The content looks like it contains a secret — AWS access key (line 2). Nothing was saved.",
    );
    for (const fragment of fragmentsOf(PLANTED.awsAccessKey)) {
      expect(result.error.message).not.toContain(fragment);
    }
  });
});

describe("refuseFlaggedImport", () => {
  it("lets a clean batch through", () => {
    expect(refuseFlaggedImport(["clean", "also clean"]).ok).toBe(true);
  });

  it("refuses the whole batch and counts the flagged chunks", () => {
    const result = refuseFlaggedImport(["clean", flagged, flagged]);
    expect(!result.ok && result.error.code).toBe("POSSIBLE_SECRET");
    expect(!result.ok && result.error.message).toBe(importRefusedMessage(2));
    expect(importRefusedMessage(2)).toContain("2 chunk(s)");
  });
});
