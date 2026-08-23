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
} from "../../shared/ipc/messages.js";

/**
 * The bridge every screen depends on — never `window.valija` directly, so a
 * component is testable against a fake implementing this same interface
 * (P-D5's DOM-level tests for `recovery-kit.tsx`/`relocate-vault.tsx` in
 * Slices 6 and 8 both fake this).
 */
export interface ValijaBridge {
  vault: {
    init(req: VaultInitRequest): Promise<IpcResult<VaultInitResponse>>;
    unlock(req: VaultUnlockRequest): Promise<IpcResult<VaultUnlockResponse>>;
    lock(): Promise<IpcResult<VaultLockResponse>>;
    status(): Promise<IpcResult<VaultStatusResponse>>;
    upgradeCheck(req: VaultUpgradeCheckRequest): Promise<IpcResult<VaultUpgradeCheckResponse>>;
  };
  content: {
    projects(): Promise<IpcResult<ProjectListEntryMessage[]>>;
    show(req: ContentShowRequest): Promise<IpcResult<ContextItemMessage[]>>;
    search(req: ContentSearchRequest): Promise<IpcResult<ContextItemMessage[]>>;
    pack(req: ContentPackRequest): Promise<IpcResult<ContentPackResponse>>;
    export(req: ContentExportRequest): Promise<IpcResult<ContentExportResponse>>;
    copy(req: ContentCopyRequest): Promise<void>;
  };
  import: {
    list(req: ImportListRequest): Promise<IpcResult<ImportListResponse>>;
    preview(req: ImportPreviewRequest): Promise<IpcResult<ImportOutcomeResponse>>;
    run(req: ImportRunRequest): Promise<IpcResult<ImportOutcomeResponse>>;
  };
  tools: {
    status(): Promise<ToolsStatusEntry[]>;
    connect(req: ToolsConnectRequest): Promise<IpcResult<ToolsConnectResponse>>;
  };
  preferences: {
    read(): Promise<AppPreferencesMessage>;
    write(req: PreferencesWriteRequest): Promise<void>;
  };
  dialog: {
    chooseImportFile(): Promise<DialogFileChoiceResponse | null>;
    chooseVaultFolder(): Promise<DialogFileChoiceResponse | null>;
  };
}

declare global {
  interface Window {
    valija: ValijaBridge;
  }
}

export function getBridge(): ValijaBridge {
  return window.valija;
}
