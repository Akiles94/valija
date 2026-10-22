import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * §9 / A10: importing `valija/sdk` runs nothing of Valija's own — no file system call, no
 * environment read, no timer, no output. Native dependency loaders are out of scope (A10); every
 * recorder below only counts calls whose stack passes through `src/` (this file excluded).
 */
const recorded = vi.hoisted(() => ({
  fs: [] as string[],
  env: [] as string[],
  timers: [] as string[],
  output: [] as string[],
}));
const SRC = `${resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")}/`;
const THIS_FILE = fileURLToPath(import.meta.url);

/** True when Valija's own source (not this test, not node_modules) is on the stack. */
function fromValijaSource(): boolean {
  const frames = (new Error().stack ?? "").split("\n").slice(2);
  return frames.some(
    (frame) => frame.includes(SRC) && !frame.includes(THIS_FILE) && !frame.includes("node_modules"),
  );
}

vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  const wrapped: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(real)) {
    wrapped[name] =
      typeof value === "function" && /^[a-z]/.test(name)
        ? function (this: unknown, ...args: unknown[]) {
            recorded.fs.push(name);
            return (value as (...a: unknown[]) => unknown).apply(this, args);
          }
        : value;
  }
  return { ...wrapped, default: wrapped };
});

const originalEnv = process.env;
const originalTimers = {
  setTimeout: globalThis.setTimeout,
  setInterval: globalThis.setInterval,
  setImmediate: globalThis.setImmediate,
};

afterAll(() => {
  process.env = originalEnv;
  Object.assign(globalThis, originalTimers);
  vi.restoreAllMocks();
});

describe("importing valija/sdk is inert (§9)", () => {
  it("no fs call, env read, timer or output from Valija's own code", async () => {
    process.env = new Proxy(originalEnv, {
      get(target, key, receiver) {
        if (typeof key === "string" && fromValijaSource()) recorded.env.push(key);
        return Reflect.get(target, key, receiver);
      },
    });
    for (const name of Object.keys(originalTimers) as (keyof typeof originalTimers)[]) {
      const real = originalTimers[name] as (...a: unknown[]) => unknown;
      (globalThis as Record<string, unknown>)[name] = (...args: unknown[]) => {
        if (fromValijaSource()) recorded.timers.push(name);
        return real(...args);
      };
    }
    for (const method of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation(() => void recorded.output.push(method));
    }
    const stdout = vi.spyOn(process.stdout, "write");
    const stderr = vi.spyOn(process.stderr, "write");
    const exit = vi.spyOn(process, "exit");

    const sdk = await import("./index.js");

    expect(Object.keys(sdk).sort()).toEqual(["createVault", "openVault"]);
    expect(recorded).toEqual({ fs: [], env: [], timers: [], output: [] });
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it("the recorders do catch Valija's own calls (the test can fail)", async () => {
    const { resolveVaultPaths } = await import("../../shared/infra/vault-paths.js");
    const { FileVaultFolder } = await import("../../vault/infra/file-vault-folder.js");
    recorded.env.length = 0;
    recorded.fs.length = 0;
    new FileVaultFolder(resolveVaultPaths()).inspect();
    expect(recorded.env).toContain("VALIJA_HOME");
    expect(recorded.fs.length).toBeGreaterThan(0);
  });
});
