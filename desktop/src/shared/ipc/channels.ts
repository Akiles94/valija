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
} from "./messages.js";

/**
 * The enumerated, closed IPC surface (§8.6). No channel accepts a filesystem
 * path, a SQL string, a module name or a shell command — paths originate only
 * from a native dialog the main process opens and keeps. `register-handlers.ts`
 * asserts `ipcMain`'s registered set equals this tuple exactly: no extra
 * channel, no missing one, no `invoke("run", …)`-shaped escape hatch.
 *
 * Not yet included: the diagnostics channels — they land in Slice 10, once
 * the extracted `runDiagnostics` exists to back them. Declaring a channel
 * before its capability exists would make this tuple a promise the app
 * can't keep yet.
 */
export const CHANNELS = [
  "vault:init",
  "vault:readRecoveryKit",
  "vault:unlock",
  "vault:lock",
  "vault:status",
  "vault:upgradeCheck",
  "content:projects",
  "content:show",
  "content:search",
  "content:pack",
  "content:export",
  "content:copy",
  "sync:status",
  "relocation:preflight",
  "relocation:move",
  "relocation:retryClient",
  "relocation:pointAtExisting",
  "import:list",
  "import:preview",
  "import:run",
  "tools:status",
  "tools:connect",
  "tools:nodeStatus",
  "preferences:read",
  "preferences:write",
  "dialog:chooseImportFile",
  "dialog:chooseVaultFolder",
] as const;

export type Channel = (typeof CHANNELS)[number];

/** One request/response pair per channel — the map every schema, handler and bridge method is checked against. */
export interface ChannelMap {
  "vault:init": { request: VaultInitRequest; response: IpcResult<VaultInitResponse> };
  /** `null` once the kit has already been read once (§8.2) — not an IpcResult, there is no DomainError case, only "was there one pending or not." */
  "vault:readRecoveryKit": { request: undefined; response: RecoveryKitResponse | null };
  "vault:unlock": { request: VaultUnlockRequest; response: IpcResult<VaultUnlockResponse> };
  "vault:lock": { request: undefined; response: IpcResult<VaultLockResponse> };
  "vault:status": { request: undefined; response: IpcResult<VaultStatusResponse> };
  "vault:upgradeCheck": {
    request: VaultUpgradeCheckRequest;
    response: IpcResult<VaultUpgradeCheckResponse>;
  };
  "content:projects": { request: undefined; response: IpcResult<ProjectListEntryMessage[]> };
  "content:show": { request: ContentShowRequest; response: IpcResult<ContextItemMessage[]> };
  "content:search": { request: ContentSearchRequest; response: IpcResult<ContextItemMessage[]> };
  "content:pack": { request: ContentPackRequest; response: IpcResult<ContentPackResponse> };
  "content:export": { request: ContentExportRequest; response: IpcResult<ContentExportResponse> };
  "content:copy": { request: ContentCopyRequest; response: undefined };
  "sync:status": { request: undefined; response: SyncStatusResponse };
  "relocation:preflight": {
    request: RelocationPreflightRequest;
    response: IpcResult<RelocationPreflightResponse>;
  };
  "relocation:move": {
    request: RelocationMoveRequest;
    response: IpcResult<RelocationMoveResponse>;
  };
  "relocation:retryClient": {
    request: RelocationRetryClientRequest;
    response: IpcResult<RelocationClientResult>;
  };
  "relocation:pointAtExisting": {
    request: RelocationPointAtExistingRequest;
    response: IpcResult<RelocationPointAtExistingResponse>;
  };
  "import:list": { request: ImportListRequest; response: IpcResult<ImportListResponse> };
  "import:preview": { request: ImportPreviewRequest; response: IpcResult<ImportOutcomeResponse> };
  "import:run": { request: ImportRunRequest; response: IpcResult<ImportOutcomeResponse> };
  "tools:status": { request: undefined; response: ToolsStatusEntry[] };
  "tools:connect": { request: ToolsConnectRequest; response: IpcResult<ToolsConnectResponse> };
  "tools:nodeStatus": { request: undefined; response: NodeStatusResponse };
  "preferences:read": { request: undefined; response: AppPreferencesMessage };
  "preferences:write": { request: PreferencesWriteRequest; response: undefined };
  "dialog:chooseImportFile": { request: undefined; response: DialogFileChoiceResponse | null };
  "dialog:chooseVaultFolder": { request: undefined; response: DialogFileChoiceResponse | null };
}
