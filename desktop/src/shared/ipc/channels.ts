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
} from "./messages.js";

/**
 * The enumerated, closed IPC surface (§8.6). No channel accepts a filesystem
 * path, a SQL string, a module name or a shell command — paths originate only
 * from a native dialog the main process opens and keeps. `register-handlers.ts`
 * asserts `ipcMain`'s registered set equals this tuple exactly: no extra
 * channel, no missing one, no `invoke("run", …)`-shaped escape hatch.
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
  "diagnostics:run",
  "diagnostics:copyReport",
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

/** Name of one IPC channel; the renderer can invoke nothing else. */
export type Channel = (typeof CHANNELS)[number];

/** One request/response pair per channel — the map every schema, handler and bridge method is checked against. */
export interface ChannelMap {
  /** Creates the vault from a passphrase and keeps the recovery kit pending for one read. */
  "vault:init": { request: VaultInitRequest; response: IpcResult<VaultInitResponse> };
  /** `null` once the kit has already been read once (§8.2) — not an IpcResult, there is no DomainError case, only "was there one pending or not." */
  "vault:readRecoveryKit": { request: undefined; response: RecoveryKitResponse | null };
  /** Unlocks with a passphrase or recovery key, optionally consenting to a schema upgrade. */
  "vault:unlock": { request: VaultUnlockRequest; response: IpcResult<VaultUnlockResponse> };
  /** Locks the vault and reports whether it is safely at rest. */
  "vault:lock": { request: undefined; response: IpcResult<VaultLockResponse> };
  /** Reads lock, auto-lock, lineage and folder state for the dashboard. */
  "vault:status": { request: undefined; response: IpcResult<VaultStatusResponse> };
  /** Says whether unlocking would upgrade the schema, so the app can ask first. */
  "vault:upgradeCheck": {
    request: VaultUpgradeCheckRequest;
    response: IpcResult<VaultUpgradeCheckResponse>;
  };
  /** Lists projects with item counts and last activity. */
  "content:projects": { request: undefined; response: IpcResult<ProjectListEntryMessage[]> };
  /** Lists a project's items, optionally of one type. */
  "content:show": { request: ContentShowRequest; response: IpcResult<ContextItemMessage[]> };
  /** Full-text search across saved context. */
  "content:search": { request: ContentSearchRequest; response: IpcResult<ContextItemMessage[]> };
  /** Renders a project's whole context pack as Markdown for display. */
  "content:pack": { request: ContentPackRequest; response: IpcResult<ContentPackResponse> };
  /** Saves a project as Markdown or JSON to a file the user picks in a native dialog. */
  "content:export": { request: ContentExportRequest; response: IpcResult<ContentExportResponse> };
  /** Copies text to the system clipboard. */
  "content:copy": { request: ContentCopyRequest; response: undefined };
  /**
   * Reads the sync-safety half of the vault folder state (conflicted copies, stale backups, cloud
   * hint).
   */
  "sync:status": { request: undefined; response: SyncStatusResponse };
  /** Runs the same diagnostics as the doctor command, only when the user asks. */
  "diagnostics:run": { request: undefined; response: DiagnosticsRunResponse };
  /**
   * Copies a diagnostics report built from rows the screen already has, without re-running checks.
   */
  "diagnostics:copyReport": { request: DiagnosticsCopyReportRequest; response: undefined };
  /**
   * Checks a chosen destination folder before a move and lists which AI tools would be re-pointed.
   */
  "relocation:preflight": {
    request: RelocationPreflightRequest;
    response: IpcResult<RelocationPreflightResponse>;
  };
  /** Moves the locked vault to the chosen folder and re-points connected AI tools. */
  "relocation:move": {
    request: RelocationMoveRequest;
    response: IpcResult<RelocationMoveResponse>;
  };
  /** Retries re-pointing one AI tool after a move. */
  "relocation:retryClient": {
    request: RelocationRetryClientRequest;
    response: IpcResult<RelocationClientResult>;
  };
  /** Switches the app to a vault that already exists in a chosen folder. */
  "relocation:pointAtExisting": {
    request: RelocationPointAtExistingRequest;
    response: IpcResult<RelocationPointAtExistingResponse>;
  };
  /** Lists the conversations in a chosen export file (format auto-detected or overridden). */
  "import:list": { request: ImportListRequest; response: IpcResult<ImportListResponse> };
  /** Dry-runs importing the selected conversations into a project. */
  "import:preview": { request: ImportPreviewRequest; response: IpcResult<ImportOutcomeResponse> };
  /** Imports the selected conversations into a project. */
  "import:run": { request: ImportRunRequest; response: IpcResult<ImportOutcomeResponse> };
  /** Says which supported AI tools have the MCP server configured, and for which vault. */
  "tools:status": { request: undefined; response: ToolsStatusEntry[] };
  /** Wires the MCP server into one AI tool's config, or returns a snippet to paste by hand. */
  "tools:connect": { request: ToolsConnectRequest; response: IpcResult<ToolsConnectResponse> };
  /** Says whether Node and npm can run here, which AI tools need to spawn the MCP server. */
  "tools:nodeStatus": { request: undefined; response: NodeStatusResponse };
  /** Reads the device-local UI preferences. */
  "preferences:read": { request: undefined; response: AppPreferencesMessage };
  /** Saves theme, language and tour-seen; never a vault path. */
  "preferences:write": { request: PreferencesWriteRequest; response: undefined };
  /** Opens a native dialog to choose an export file and returns an opaque handle, never a path. */
  "dialog:chooseImportFile": { request: undefined; response: DialogFileChoiceResponse | null };
  /** Opens a native dialog to choose a vault folder and returns an opaque handle, never a path. */
  "dialog:chooseVaultFolder": { request: undefined; response: DialogFileChoiceResponse | null };
}
