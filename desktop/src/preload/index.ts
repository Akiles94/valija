import { contextBridge, ipcRenderer } from "electron";
import type { SpikeResult } from "../main/spike/spike-handlers.js";

// Throwaway spike bridge — deleted alongside spike-handlers.ts and spike.tsx at the
// end of Slice 1. The real, enumerated preload API (one method per production IPC
// channel, hand-written, no loop over a tuple) is Slice 5's work.
contextBridge.exposeInMainWorld("spike", {
  loadSqlcipher: (): Promise<SpikeResult> => ipcRenderer.invoke("spike:load-sqlcipher"),
  keychainRoundTrip: (): Promise<SpikeResult> => ipcRenderer.invoke("spike:keychain-round-trip"),
  openGoldenVault: (): Promise<SpikeResult> => ipcRenderer.invoke("spike:open-golden-vault"),
});
