import { contextBridge, ipcRenderer } from "electron";
import type { SpikeResult } from "../main/spike/spike-handlers.js";
import type {
  AppPreferencesMessage,
  ContentCopyRequest,
  ContentExportRequest,
  ContentExportResponse,
  ContentPackRequest,
  ContentPackResponse,
  ContentSearchRequest,
  ContentShowRequest,
  ContextItemMessage,
  DialogFileChoiceResponse,
  ImportListRequest,
  ImportListResponse,
  ImportOutcomeResponse,
  ImportPreviewRequest,
  ImportRunRequest,
  IpcResult,
  PreferencesWriteRequest,
  ProjectListEntryMessage,
  ToolsConnectRequest,
  ToolsConnectResponse,
  ToolsStatusEntry,
  VaultInitRequest,
  VaultInitResponse,
  VaultLockResponse,
  VaultStatusResponse,
  VaultUnlockRequest,
  VaultUnlockResponse,
  VaultUpgradeCheckRequest,
  VaultUpgradeCheckResponse,
} from "../shared/ipc/messages.js";

// Throwaway spike bridge — stays alongside the real API below until D-H's
// macOS ACL answer and D-R(a)'s client-env spike are both recorded (they need
// a human on real hardware); deleted once both are answered.
contextBridge.exposeInMainWorld("spike", {
  loadSqlcipher: (): Promise<SpikeResult> => ipcRenderer.invoke("spike:load-sqlcipher"),
  keychainRoundTrip: (): Promise<SpikeResult> => ipcRenderer.invoke("spike:keychain-round-trip"),
  openGoldenVault: (): Promise<SpikeResult> => ipcRenderer.invoke("spike:open-golden-vault"),
});

// The real, enumerated API: one method per production IPC channel,
// hand-written — never a loop over the channel tuple, so no channel is
// exposed that a reviewer hasn't seen named here explicitly.
contextBridge.exposeInMainWorld("valija", {
  vault: {
    init: (req: VaultInitRequest): Promise<IpcResult<VaultInitResponse>> =>
      ipcRenderer.invoke("vault:init", req),
    unlock: (req: VaultUnlockRequest): Promise<IpcResult<VaultUnlockResponse>> =>
      ipcRenderer.invoke("vault:unlock", req),
    lock: (): Promise<IpcResult<VaultLockResponse>> => ipcRenderer.invoke("vault:lock"),
    status: (): Promise<IpcResult<VaultStatusResponse>> => ipcRenderer.invoke("vault:status"),
    upgradeCheck: (req: VaultUpgradeCheckRequest): Promise<IpcResult<VaultUpgradeCheckResponse>> =>
      ipcRenderer.invoke("vault:upgradeCheck", req),
  },
  content: {
    projects: (): Promise<IpcResult<ProjectListEntryMessage[]>> =>
      ipcRenderer.invoke("content:projects"),
    show: (req: ContentShowRequest): Promise<IpcResult<ContextItemMessage[]>> =>
      ipcRenderer.invoke("content:show", req),
    search: (req: ContentSearchRequest): Promise<IpcResult<ContextItemMessage[]>> =>
      ipcRenderer.invoke("content:search", req),
    pack: (req: ContentPackRequest): Promise<IpcResult<ContentPackResponse>> =>
      ipcRenderer.invoke("content:pack", req),
    export: (req: ContentExportRequest): Promise<IpcResult<ContentExportResponse>> =>
      ipcRenderer.invoke("content:export", req),
    copy: (req: ContentCopyRequest): Promise<void> => ipcRenderer.invoke("content:copy", req),
  },
  import: {
    list: (req: ImportListRequest): Promise<IpcResult<ImportListResponse>> =>
      ipcRenderer.invoke("import:list", req),
    preview: (req: ImportPreviewRequest): Promise<IpcResult<ImportOutcomeResponse>> =>
      ipcRenderer.invoke("import:preview", req),
    run: (req: ImportRunRequest): Promise<IpcResult<ImportOutcomeResponse>> =>
      ipcRenderer.invoke("import:run", req),
  },
  tools: {
    status: (): Promise<ToolsStatusEntry[]> => ipcRenderer.invoke("tools:status"),
    connect: (req: ToolsConnectRequest): Promise<IpcResult<ToolsConnectResponse>> =>
      ipcRenderer.invoke("tools:connect", req),
  },
  preferences: {
    read: (): Promise<AppPreferencesMessage> => ipcRenderer.invoke("preferences:read"),
    write: (req: PreferencesWriteRequest): Promise<void> =>
      ipcRenderer.invoke("preferences:write", req),
  },
  dialog: {
    chooseImportFile: (): Promise<DialogFileChoiceResponse | null> =>
      ipcRenderer.invoke("dialog:chooseImportFile"),
    chooseVaultFolder: (): Promise<DialogFileChoiceResponse | null> =>
      ipcRenderer.invoke("dialog:chooseVaultFolder"),
  },
});
