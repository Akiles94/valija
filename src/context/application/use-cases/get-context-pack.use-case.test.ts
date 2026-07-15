import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../../testing/test-vault.js";
import { GetContextPack } from "./get-context-pack.use-case.js";
import { SaveContext } from "./save-context.use-case.js";

const vault = makeUnlockedVault();
const clock = new FixedClock();
const save = new SaveContext(vault.sessions, clock, new SeqIds());
const getPack = new GetContextPack(vault.sessions, clock);
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

// The assembly algorithm is proven in context/domain/services/context-pack.test.ts.
// This covers the use case: resolve the project, load its items, stamp the clock.
describe("GetContextPack", () => {
  it("errors on an unknown project", () => {
    const r = getPack.execute({ project: "ghost" });
    expect(!r.ok && r.error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("packs the project's items and stamps the clock", () => {
    save.execute({ project: "packed", content: "solo item", type: "fact" });
    const r = getPack.execute({ project: "packed" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.projectName).toBe("packed");
    expect(r.value.generatedAt).toEqual(clock.now());
    expect(r.value.totalCount).toBe(1);
    expect(r.value.includedCount).toBe(1);
  });

  it("applies the default budget, and an explicit one when given", () => {
    for (let i = 0; i < 30; i++) {
      save.execute({
        project: "budgeted",
        content: `decision number ${i} ${"x".repeat(380)}`,
        type: "decision",
      });
      clock.advanceMinutes(1);
    }
    const tight = getPack.execute({ project: "budgeted", budgetTokens: 500 });
    expect(tight.ok && tight.value.includedCount).toBeLessThan(30);

    const unbounded = getPack.execute({
      project: "budgeted",
      budgetTokens: Number.POSITIVE_INFINITY,
    });
    expect(unbounded.ok && unbounded.value.includedCount).toBe(30);
  });

  it("returns VAULT_LOCKED when the key is gone", () => {
    vault.keychain.deleteKey(vault.vaultId);
    const r = getPack.execute({ project: "packed" });
    expect(!r.ok && r.error.code).toBe("VAULT_LOCKED");
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
  });
});
