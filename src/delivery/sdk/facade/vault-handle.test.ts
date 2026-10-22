import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLANTED } from "../../../testing/fake-secrets.js";
import {
  makePassphraseVault,
  type PassphraseVault,
  TEST_PASSPHRASE,
} from "../../../testing/passphrase-vault.js";
import { RecordingKeychain } from "../../../testing/recording-keychain.js";
import { buildContainer, type Container } from "../../container.js";
import { renderContextPackMarkdown } from "../../context-pack-markdown.js";
import type { ValijaVault } from "../dto/results.js";
import { openVault } from "./vault-lifecycle.js";

vi.mock("../../../vault/infra/keyring.js", async () => ({
  OsKeychain: (await import("../../../testing/recording-keychain.js")).RecordingKeychain,
}));

const tmp = mkdtempSync(join(tmpdir(), "valija-sdk-handle-"));
const originalEnv = { ...process.env };
let n = 0;
const CLIENT = "acme-notes";

let vault: PassphraseVault;
let handle: ValijaVault;
/** A CLI-side view of the same vault, with the key in the (fake) OS keychain. */
let cli: Container;

beforeEach(async () => {
  RecordingKeychain.reset();
  process.env.HOME = join(tmp, "home");
  process.env.VALIJA_STATE_HOME = join(tmp, `state-${++n}`);
  delete process.env.VALIJA_AUTOLOCK_MINUTES;
  delete process.env.VALIJA_PROJECT;
  vault = await makePassphraseVault(join(tmp, `vault-${n}`));
  handle = await open();
  RecordingKeychain.store.set(vault.vaultId, vault.keyHex);
  cli = buildContainer({ vaultRoot: vault.paths.root });
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  process.env = originalEnv;
  rmSync(tmp, { recursive: true, force: true });
});

async function open(): Promise<ValijaVault> {
  const r = await openVault({
    client: CLIENT,
    vaultRoot: vault.paths.root,
    passphrase: TEST_PASSPHRASE,
  });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const codeOf = (r: { ok: true } | { ok: false; error: { code: string } }) =>
  r.ok ? "ok" : r.error.code;

const shown = (project: string) => {
  const r = cli.showProject.execute({ project, includeArchived: true });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe("save", () => {
  it.each([
    "decision",
    "progress",
    "preference",
    "fact",
    "handoff",
  ] as const)("saves a %s with source = client", async (type) => {
    const r = await handle.save({ project: "acme", content: `a ${type}`, type, tags: ["x"] });
    expect(r.ok && r.value).toMatchObject({ project: "acme", type, projectCreated: true });
    expect(shown("acme")).toMatchObject([{ type, source: CLIENT, tags: ["x"], pinned: false }]);
  });

  it("defaults to fact", async () => {
    const r = await handle.save({ project: "acme", content: "c" });
    expect(r.ok && r.value.type).toBe("fact");
  });

  it("rejects imported with INVALID_INPUT and writes nothing", async () => {
    const r = await handle.save({ project: "acme", content: "c", type: "imported" } as never);
    expect(codeOf(r)).toBe("INVALID_INPUT");
    expect(cli.listProjects.execute()).toEqual({ ok: true, value: [] });
  });

  it("drops a stray pinned (D-K)", async () => {
    await handle.save({ project: "acme", content: "c", pinned: true } as never);
    expect(shown("acme").map((i) => i.pinned)).toEqual([false]);
  });

  it("refuses a possible secret with POSSIBLE_SECRET, writes nothing and never echoes it (D-L)", async () => {
    const content = `notes\nkey: ${PLANTED.awsAccessKey}`;
    for (const r of [
      await handle.save({ project: "acme", content }),
      await handle.save({ project: "acme", content, allowSecrets: true } as never),
      await handle.saveHandoff({ project: "acme", content }),
    ]) {
      expect(codeOf(r)).toBe("POSSIBLE_SECRET");
      expect(JSON.stringify(r)).not.toContain(PLANTED.awsAccessKey);
    }
    expect(cli.listProjects.execute()).toEqual({ ok: true, value: [] });
  });

  it("supersedes archives the replaced item, as on MCP", async () => {
    const first = await handle.save({ project: "acme", content: "old decision", type: "decision" });
    if (!first.ok) throw new Error(first.error.message);
    const second = await handle.save({
      project: "acme",
      content: "new decision",
      type: "decision",
      supersedes: first.value.itemId,
    });
    expect(second.ok && second.value.supersededItemId).toBe(first.value.itemId);
    expect(shown("acme").find((i) => i.id === first.value.itemId)?.archived).toBe(true);
  });

  it("an unknown supersedes id fails the whole save", async () => {
    await handle.save({ project: "acme", content: "keep" });
    const r = await handle.save({
      project: "acme",
      content: "c",
      supersedes: "01UNKNOWNITEM0000000000000",
    });
    expect(codeOf(r)).toBe("ITEM_NOT_FOUND");
    expect(shown("acme")).toHaveLength(1);
  });
});

describe("saveHandoff", () => {
  it("saves a handoff", async () => {
    const r = await handle.saveHandoff({ project: "acme", content: "next: ship" });
    expect(r.ok && r.value.type).toBe("handoff");
    expect(shown("acme")).toMatchObject([{ type: "handoff", source: CLIENT }]);
  });
});

describe("getContextPack", () => {
  it("is renderContextPackMarkdown of the same pack, byte for byte", async () => {
    await handle.save({ project: "acme", content: "We ship offline first.", type: "decision" });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
    const r = await handle.getContextPack({ project: "acme", budgetTokens: 2000 });
    const expected = cli.getContextPack.execute({ project: "acme", budgetTokens: 2000 });
    if (!expected.ok) throw new Error(expected.error.message);
    expect(r.ok && r.value).toEqual({
      project: "acme",
      markdown: renderContextPackMarkdown(expected.value),
    });
  });

  it("validates the budget and reports a missing project", async () => {
    expect(codeOf(await handle.getContextPack({ project: "acme", budgetTokens: 0 }))).toBe(
      "INVALID_INPUT",
    );
    expect(codeOf(await handle.getContextPack({ project: "nope" }))).toBe("PROJECT_NOT_FOUND");
  });
});

describe("search and listProjects", () => {
  it("search returns MCP-parity hits with ids", async () => {
    const saved = await handle.save({
      project: "acme",
      content: "auth uses passkeys",
      type: "decision",
    });
    const r = await handle.search({ query: "passkeys" });
    if (!r.ok || !saved.ok) throw new Error("failed");
    expect(r.value).toHaveLength(1);
    expect(Object.keys(r.value[0] ?? {}).sort()).toEqual([
      "content",
      "createdAt",
      "id",
      "project",
      "type",
    ]);
    expect(r.value[0]).toMatchObject({ id: saved.value.itemId, project: "acme", type: "decision" });
    expect(codeOf(await handle.search({ query: "x", project: "nope" }))).toBe("PROJECT_NOT_FOUND");
    expect(codeOf(await handle.search({ query: "x", limit: 2.5 }))).toBe("INVALID_INPUT");
  });

  it("listProjects matches the use case, with no marker", async () => {
    process.env.VALIJA_PROJECT = "acme";
    await handle.save({ project: "acme", content: "c" });
    const r = await handle.listProjects();
    const expected = cli.listProjects.execute();
    expect(r).toEqual(expected);
    expect(r.ok && Object.keys(r.value[0] ?? {}).sort()).toEqual([
      "itemCount",
      "lastActivityAt",
      "name",
    ]);
  });
});

describe("lock, close and expiry (Mode P)", () => {
  it("lock() forgets this handle's key only — the OS session stays (⚑ D-A.1)", async () => {
    expect((await handle.lock()).ok).toBe(true);
    expect(codeOf(await handle.listProjects())).toBe("VAULT_LOCKED");
    expect(RecordingKeychain.store.get(vault.vaultId)).toBe(vault.keyHex);
    expect(cli.listProjects.execute().ok).toBe(true);
  });

  it("close() is idempotent; later calls give VAULT_LOCKED (P-14)", async () => {
    expect((await handle.close()).ok).toBe(true);
    expect((await handle.close()).ok).toBe(true);
    expect(codeOf(await handle.save({ project: "acme", content: "c" }))).toBe("VAULT_LOCKED");
    expect(codeOf(await handle.lock())).toBe("ok");
  });

  it("lazy expiry: past the TTL the next call drops the key and gives VAULT_LOCKED", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date());
    const fresh = await open();
    vi.setSystemTime(new Date(Date.now() + 16 * 60_000));
    expect(codeOf(await fresh.listProjects())).toBe("VAULT_LOCKED");
    vi.setSystemTime(new Date(Date.now() - 16 * 60_000));
    expect(codeOf(await fresh.listProjects())).toBe("VAULT_LOCKED");
  });

  it("proactive expiry: the unref'd timer drops the key at the TTL with no call (⚑ D-A.2)", async () => {
    process.env.VALIJA_AUTOLOCK_MINUTES = "1";
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const fresh = await open();
    vi.advanceTimersByTime(60_000);
    vi.useRealTimers();
    expect(codeOf(await fresh.listProjects())).toBe("VAULT_LOCKED");
  });

  it("0/off disables both checks", async () => {
    process.env.VALIJA_AUTOLOCK_MINUTES = "off";
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const fresh = await open();
    vi.advanceTimersByTime(24 * 60 * 60_000);
    expect(codeOf(await fresh.listProjects())).toBe("ok");
  });

  it("Mode P activity never reaches the shared lastActivityAt (⚑ D-A.3)", async () => {
    await handle.save({ project: "acme", content: "c" });
    await handle.listProjects();
    expect(buildContainer().deviceIdentity.lastActivityAt(vault.vaultId)).toBeNull();
  });
});

describe("what crosses the boundary", () => {
  it("no result or error holds the key hex, the passphrase or refused content", async () => {
    const outputs = [
      handle,
      await handle.save({ project: "acme", content: "c" }),
      await handle.save({ project: "acme", content: `x ${PLANTED.githubToken}` }),
      await handle.saveHandoff({ project: "acme", content: "h" }),
      await handle.getContextPack({ project: "acme" }),
      await handle.search({ query: "c" }),
      await handle.listProjects(),
      await handle.getContextPack({ project: "acme", budgetTokens: -1 }),
      await openVault({
        client: CLIENT,
        vaultRoot: vault.paths.root,
        passphrase: "wrong passphrase",
      }),
      await openVault({ client: CLIENT, vaultRoot: vault.paths.root, recoveryKey: "zz" }),
      await handle.lock(),
      await handle.listProjects(),
    ];
    const serialized = JSON.stringify(outputs);
    for (const secret of [vault.keyHex, TEST_PASSPHRASE, PLANTED.githubToken, "wrong passphrase"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("the handle exposes exactly the listed members — no pin, edit, archive, list items, export or status", () => {
    const TEN = [
      "vaultId",
      "mode",
      "forkNotice",
      "save",
      "saveHandoff",
      "getContextPack",
      "search",
      "listProjects",
      "lock",
      "close",
    ];
    const keys = Object.keys(handle);
    expect(keys.every((k) => TEN.includes(k))).toBe(true);
    expect(keys.sort()).toEqual(TEN.filter((k) => k !== "forkNotice").sort());
  });
});
