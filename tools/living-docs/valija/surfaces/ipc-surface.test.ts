import { describe, expect, it } from "vitest";
import { indexCallables } from "../services/use-case-reach.js";
import { sourceFile } from "../testing/source-fixture.js";
import { CHANNELS_FILE, findUndocumentedChannels, readIpcChannels } from "./ipc-surface.js";
import { assertSameNames } from "./segments.js";

const channels = (map: string) =>
  sourceFile(
    CHANNELS_FILE,
    `export const CHANNELS = ["vault:lock", "vault:status"] as const;\nexport interface ChannelMap {\n${map}}\n`,
  );
const DOCUMENTED = [
  "  /** Locks the vault. */",
  '  "vault:lock": { request: undefined; response: LockResponse };',
  '  "vault:status": { request: undefined; response: StatusResponse };',
  "",
].join("\n");
const handlers = (path: string, body: string) =>
  sourceFile(
    `desktop/src/main/ipc/handlers/${path}`,
    `export function create() {\n  return {\n${body}  };\n}\n`,
  );
const LOCK = '    "vault:lock": () => helper(c),\n';
const STATUS = '    "vault:status": () => c.vaultStatus.execute(),\n';
const helper = "function helper(c) {\n  return c.lockVault.execute();\n}\n";

describe("readIpcChannels", () => {
  it("reads contract, doc and handler, following same-file helpers", () => {
    const vault = sourceFile(
      "desktop/src/main/ipc/handlers/vault-handlers.ts",
      `${helper}export function create(c) {\n  return {\n${LOCK}${STATUS}  };\n}\n`,
    );
    const files = [channels(DOCUMENTED), vault];
    const read = readIpcChannels(files, indexCallables(files));
    expect(read.map((c) => [c.name, c.doc, c.response, c.reaches])).toEqual([
      ["vault:lock", "Locks the vault.", "LockResponse", ["lockVault"]],
      ["vault:status", null, "StatusResponse", ["vaultStatus"]],
    ]);
    expect(findUndocumentedChannels(read)).toMatchObject([
      { rule: "undocumented-export", subject: "ChannelMap › vault:status", file: CHANNELS_FILE },
    ]);
  });

  it("fails closed on a channel with no handler, two handlers, or no ChannelMap entry", () => {
    const one = handlers("a-handlers.ts", LOCK + STATUS);
    const files = (...more: ReturnType<typeof sourceFile>[]) => [channels(DOCUMENTED), ...more];
    const read = (list: ReturnType<typeof sourceFile>[]) => () =>
      readIpcChannels(list, indexCallables(list));

    expect(read(files(handlers("a-handlers.ts", LOCK)))).toThrow(/vault:status.*0 handler files/);
    expect(read(files(one, handlers("b-handlers.ts", LOCK)))).toThrow(
      /vault:lock.*2 handler files/,
    );
    const noMap = [channels('  "vault:lock": { request: undefined; response: X };\n'), one];
    expect(read(noMap)).toThrow(/vault:status.*no ChannelMap entry/);
  });
});

describe("assertSameNames", () => {
  it("fails when the runtime registry and the static scan disagree", () => {
    expect(() =>
      assertSameNames("CLI commands", "f.ts", ["init", "lock"], ["init", "lock"]),
    ).not.toThrow();
    expect(() =>
      assertSameNames("CLI commands", "f.ts", ["init", "lock"], ["init", "unlock"]),
    ).toThrow("CLI commands at runtime and in f.ts disagree on: lock, unlock");
  });
});
