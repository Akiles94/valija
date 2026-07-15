import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../../testing/test-vault.js";
import { SaveContext } from "./save-context.use-case.js";
import { ShowProject } from "./show-project.use-case.js";

const vault = makeUnlockedVault();
const save = new SaveContext(vault.sessions, new FixedClock(), new SeqIds());
const show = new ShowProject(vault.sessions);
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

describe("SaveContext", () => {
  it("auto-creates the project on first save (D9)", () => {
    const r = save.execute({
      project: "Vault-App",
      content: "we chose sqlcipher",
      type: "decision",
    });
    expect(r.ok && r.value).toMatchObject({ project: "vault-app", projectCreated: true });
    const again = save.execute({
      project: "vault-app",
      content: "restore flow is next",
      type: "progress",
    });
    expect(again.ok && again.value.projectCreated).toBe(false);
  });

  it("defaults type to fact", () => {
    const r = save.execute({ project: "vault-app", content: "argon2id, 64 MiB" });
    expect(r.ok && r.value.type).toBe("fact");
  });

  it("persists pinned, tags, and source", () => {
    save.execute({
      project: "vault-app",
      content: "always use conventional commits",
      type: "preference",
      tags: ["Git", "git"],
      pinned: true,
      source: "test-client",
    });
    const shown = show.execute({ project: "vault-app", type: "preference" });
    expect(shown.ok).toBe(true);
    if (!shown.ok) return;
    expect(shown.value[0]).toMatchObject({ pinned: true, tags: ["git"] });
  });

  it("rejects invalid inputs at the boundary", () => {
    expect(!save.execute({ project: "bad name!", content: "x" }).ok).toBe(true);
    expect(!save.execute({ project: "vault-app", content: "  " }).ok).toBe(true);
    expect(!save.execute({ project: "vault-app", content: "x", type: "wrong" }).ok).toBe(true);
  });

  it("returns VAULT_LOCKED when the key is gone", () => {
    vault.keychain.deleteKey(vault.vaultId);
    const r = save.execute({ project: "vault-app", content: "anything" });
    expect(!r.ok && r.error.code).toBe("VAULT_LOCKED");
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
  });
});
