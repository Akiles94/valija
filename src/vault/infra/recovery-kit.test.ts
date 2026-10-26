import { describe, expect, it } from "vitest";
import { renderRecoveryKit } from "./recovery-kit.js";

describe("Recovery kit", () => {
  it("contains the key, the vault id, and the warning", () => {
    const kit = renderRecoveryKit("01VAULT", "ab".repeat(32), "2026-07-11");
    expect(kit).toContain("ab".repeat(32));
    expect(kit).toContain("01VAULT");
    expect(kit).toContain("Forever");
  });

  it("shows the key as issued at creation when no issue date is given (init, desktop create, SDK)", () => {
    const kit = renderRecoveryKit("01VAULT", "ab".repeat(32), "2026-07-11T00:00:00Z");
    expect(kit).toContain("Created:     2026-07-11T00:00:00Z");
    expect(kit).toContain("Key issued:  2026-07-11T00:00:00Z");
    expect(kit).toContain("This replaces any earlier recovery kit for this vault.");
  });

  it("shows the given issue date after a passphrase change, keeping the creation date", () => {
    const kit = renderRecoveryKit(
      "01VAULT",
      "cd".repeat(32),
      "2026-07-11T00:00:00Z",
      "2026-10-26T09:30:00Z",
    );
    expect(kit).toContain("Created:     2026-07-11T00:00:00Z");
    expect(kit).toContain("Key issued:  2026-10-26T09:30:00Z");
    expect(kit.indexOf("Key issued:")).toBeGreaterThan(kit.indexOf("Created:"));
    expect(kit.indexOf("This replaces any earlier")).toBeLessThan(kit.indexOf("Anyone holding"));
  });
});
