import type {
  AppPreferencesMessage,
  BindingMessage,
  BindingsInspectRequest,
  BindingsInspectResponse,
  BindingsLinkRequest,
  BindingsLinkResponse,
  BindingsListRequest,
  BindingsUnlinkRequest,
  ContentCopyRequest,
  ContentCurationResponse,
  ContentEditRequest,
  ContentEditResponse,
  ContentExportRequest,
  ContentExportResponse,
  ContentPackRequest,
  ContentPackResponse,
  ContentSearchRequest,
  ContentSetArchivedRequest,
  ContentSetPinnedRequest,
  ContentShowRequest,
  ContextItemMessage,
  DiagnosticsCopyReportRequest,
  DiagnosticsRunResponse,
  DialogFileChoiceResponse,
  ImportListRequest,
  ImportListResponse,
  ImportOutcomeResponse,
  ImportPreviewRequest,
  ImportRunRequest,
  IpcResult,
  NodeStatusResponse,
  PreferencesWriteRequest,
  ProjectListEntryMessage,
  RecoveryKitResponse,
  RelocationClientResult,
  RelocationMoveRequest,
  RelocationMoveResponse,
  RelocationPointAtExistingRequest,
  RelocationPointAtExistingResponse,
  RelocationPreflightRequest,
  RelocationPreflightResponse,
  RelocationRetryClientRequest,
  SyncStatusResponse,
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
    readRecoveryKit(): Promise<RecoveryKitResponse | null>;
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
    setPinned(req: ContentSetPinnedRequest): Promise<IpcResult<ContentCurationResponse>>;
    setArchived(req: ContentSetArchivedRequest): Promise<IpcResult<ContentCurationResponse>>;
    edit(req: ContentEditRequest): Promise<IpcResult<ContentEditResponse>>;
  };
  sync: {
    status(): Promise<SyncStatusResponse>;
  };
  diagnostics: {
    run(): Promise<DiagnosticsRunResponse>;
    copyReport(req: DiagnosticsCopyReportRequest): Promise<void>;
  };
  relocation: {
    preflight(req: RelocationPreflightRequest): Promise<IpcResult<RelocationPreflightResponse>>;
    move(req: RelocationMoveRequest): Promise<IpcResult<RelocationMoveResponse>>;
    retryClient(req: RelocationRetryClientRequest): Promise<IpcResult<RelocationClientResult>>;
    pointAtExisting(
      req: RelocationPointAtExistingRequest,
    ): Promise<IpcResult<RelocationPointAtExistingResponse>>;
  };
  import: {
    list(req: ImportListRequest): Promise<IpcResult<ImportListResponse>>;
    preview(req: ImportPreviewRequest): Promise<IpcResult<ImportOutcomeResponse>>;
    run(req: ImportRunRequest): Promise<IpcResult<ImportOutcomeResponse>>;
  };
  tools: {
    status(): Promise<ToolsStatusEntry[]>;
    connect(req: ToolsConnectRequest): Promise<IpcResult<ToolsConnectResponse>>;
    nodeStatus(): Promise<NodeStatusResponse>;
  };
  preferences: {
    read(): Promise<AppPreferencesMessage>;
    write(req: PreferencesWriteRequest): Promise<void>;
  };
  dialog: {
    chooseImportFile(): Promise<DialogFileChoiceResponse | null>;
    chooseVaultFolder(): Promise<DialogFileChoiceResponse | null>;
    chooseProjectFolder(): Promise<DialogFileChoiceResponse | null>;
  };
  bindings: {
    inspect(req: BindingsInspectRequest): Promise<IpcResult<BindingsInspectResponse>>;
    link(req: BindingsLinkRequest): Promise<IpcResult<BindingsLinkResponse>>;
    unlink(req: BindingsUnlinkRequest): Promise<IpcResult<BindingMessage>>;
    list(req: BindingsListRequest): Promise<IpcResult<BindingMessage[]>>;
  };
}

declare global {
  interface Window {
    valija: ValijaBridge;
  }
}

/** The typed IPC bridge the preload script exposes as `window.valija`. */
export function getBridge(): ValijaBridge {
  return window.valija;
}
