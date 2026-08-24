import { beforeEach, describe, expect, it, vi } from "vitest";
import { CHANNELS } from "../../shared/ipc/channels.js";
import type { AppPreferences, AppPreferencesStore } from "../application/ports/app-preferences.js";
import type { ClipboardPort } from "../application/ports/clipboard.js";
import type { FilePicker } from "../application/ports/file-picker.js";
import type { NodeProbe } from "../application/ports/node-probe.js";

const registeredHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
      registeredHandlers.set(channel, listener);
    },
  },
}));

const { registerHandlers } = await import("./register-handlers.js");

function fakeDeps() {
  const preferences: AppPreferences = {
    vaultPath: null,
    theme: "system",
    language: "system",
    tourSeen: false,
  };
  const preferencesStore: AppPreferencesStore = {
    read: () => preferences,
    write: () => {},
  };
  const filePicker: FilePicker = {
    chooseImportFile: () => null,
    chooseExportTarget: () => null,
    chooseVaultFolder: () => null,
    resolveHandle: () => undefined,
  };
  const clipboard: ClipboardPort = { writeText: () => {} };
  const nodeProbe: NodeProbe = { check: async () => ({ nodeRunnable: true, npmRunnable: true }) };
  return {
    getContainer: () => {
      throw new Error("not needed for these tests");
    },
    rebuildContainer: () => {
      throw new Error("not needed for these tests");
    },
    preferencesStore,
    filePicker,
    clipboard,
    nodeProbe,
  };
}

describe("registerHandlers — the channel-set equality test", () => {
  beforeEach(() => {
    registeredHandlers.clear();
    // biome-ignore lint/suspicious/noExplicitAny: exercising the real registration path against a fake ipcMain
    registerHandlers(fakeDeps() as any);
  });

  it("registers exactly the channels channels.ts enumerates — no extra, no missing", () => {
    expect([...registeredHandlers.keys()].sort()).toEqual([...CHANNELS].sort());
  });

  it("registers no invoke('run', …)-shaped generic escape hatch", () => {
    expect(registeredHandlers.has("run")).toBe(false);
    expect(registeredHandlers.has("*")).toBe(false);
  });
});
