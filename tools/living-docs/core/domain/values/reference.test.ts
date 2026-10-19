import { describe, expect, it } from "vitest";
import { parseReference } from "./reference.js";

const KINDS = ["cli", "ipc", "err"];

describe("parseReference", () => {
  it("keeps everything after the first colon as the name", () => {
    expect(parseReference("ipc:vault:unlock", KINDS)).toEqual({
      ok: true,
      value: { kind: "ipc", qualifier: [], name: "vault:unlock", raw: "ipc:vault:unlock" },
    });
  });

  it("reads qualified and bare symbols", () => {
    const qualified = parseReference("vault/UnlockVault", KINDS);
    expect(qualified.ok && qualified.value).toMatchObject({
      kind: null,
      qualifier: ["vault"],
      name: "UnlockVault",
    });
    expect(parseReference(" SaveContext ", KINDS)).toMatchObject({ ok: true });
  });

  it("rejects unknown kinds, empty names and non-identifiers", () => {
    expect(parseReference("mcp:save_context", KINDS)).toMatchObject({ ok: false });
    expect(parseReference("cli:", KINDS)).toMatchObject({ ok: false });
    expect(parseReference("", KINDS)).toMatchObject({ ok: false });
    expect(parseReference("vault//X", KINDS)).toMatchObject({ ok: false });
    expect(parseReference("not a name", KINDS)).toMatchObject({ ok: false });
  });
});
