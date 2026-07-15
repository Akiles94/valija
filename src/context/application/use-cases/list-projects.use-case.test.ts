import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../../testing/test-vault.js";
import { ListProjects } from "./list-projects.use-case.js";
import { SaveContext } from "./save-context.use-case.js";

const vault = makeUnlockedVault();
const save = new SaveContext(vault.sessions, new FixedClock(), new SeqIds());
const listProjects = new ListProjects(vault.sessions);
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

describe("ListProjects", () => {
  it("returns an empty list for a fresh vault", () => {
    const r = listProjects.execute();
    expect(r.ok && r.value).toEqual([]);
  });

  it("lists projects with item counts and last activity", () => {
    save.execute({ project: "alpha", content: "one" });
    save.execute({ project: "alpha", content: "two" });
    save.execute({ project: "beta", content: "three" });

    const r = listProjects.execute();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const alpha = r.value.find((p) => p.name === "alpha");
    expect(alpha?.itemCount).toBe(2);
    expect(alpha?.lastActivityAt).not.toBeNull();
  });

  it("returns VAULT_LOCKED when the key is gone", () => {
    vault.keychain.deleteKey(vault.vaultId);
    const r = listProjects.execute();
    expect(!r.ok && r.error.code).toBe("VAULT_LOCKED");
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
  });
});
