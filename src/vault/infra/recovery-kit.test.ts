import { describe, expect, it } from "vitest";
import { renderRecoveryKit } from "./recovery-kit.js";

describe("Recovery kit", () => {
  it("contains the key, the vault id, and the warning", () => {
    const kit = renderRecoveryKit("01VAULT", "ab".repeat(32), "2026-07-11");
    expect(kit).toContain("ab".repeat(32));
    expect(kit).toContain("01VAULT");
    expect(kit).toContain("Forever");
  });
});
