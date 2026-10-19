import type { SystemOr } from "../../main/application/policies/system-or-override.js";
import type { Language } from "../i18n/languages.js";

/**
 * Every response backed by a `Result`-returning use case crosses the
 * boundary as this shape — `error` carries only a `code`, never
 * `DomainError.message` (D-V(d), §5.1). The renderer maps `code` to catalog
 * copy; it never renders a raw message.
 */
export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: { code: string } };

/** Passphrase for the new vault. */
export interface VaultInitRequest {
  passphrase: string;
}
/**
 * Deliberately no `keyHex` — the raw key is one of the two secrets §5.1
 * allows to cross the boundary, and only as the *rendered recovery-kit
 * text*, read exactly once through `vault:readRecoveryKit`, never as a
 * value the renderer could hold onto and re-derive the kit from.
 */
export interface VaultInitResponse {
  vaultId: string;
  createdAt: string;
}

/** `null` once the kit has already been read once this session — it cannot be re-requested (§8.2). */
export interface RecoveryKitResponse {
  text: string;
}

/** Passphrase or recovery key, plus consent to upgrade an outdated schema. */
export interface VaultUnlockRequest {
  passphrase?: string;
  recoveryKeyHex?: string;
  upgradeConfirmed?: boolean;
}
/** The unlocked vault's id and, on a multi-device fork, the fork's details. */
export interface VaultUnlockResponse {
  vaultId: string;
  fork?: {
    generation: number;
    writer: string;
    noticeCode: string;
  };
}

/** Whether the vault was unlocked, its lineage when locked, and any sidecar files left behind. */
export interface VaultLockResponse {
  wasUnlocked: boolean;
  generation?: number;
  writer?: string;
  writerIsThisDevice?: boolean;
  sidecars: string[];
}

/** Wire form of the vault status: lock and auto-lock state, lineage and folder signals. */
export interface VaultStatusResponse {
  initialized: boolean;
  unlocked: boolean;
  vaultId?: string;
  dbPath: string;
  journalMode: "DELETE";
  sidecars: string[];
  autoLock: { ttlMinutes: number | null; idleForMinutes?: number; expired?: boolean };
  generation?: number;
  lastWriter?: string;
  lastWriterIsThisDevice?: boolean;
}

/** Passphrase or recovery key, used only to read the schema version. */
export interface VaultUpgradeCheckRequest {
  passphrase?: string;
  recoveryKeyHex?: string;
}
/** Whether an upgrade is pending, between which versions, and whether it backs up first. */
export interface VaultUpgradeCheckResponse {
  required: boolean;
  from: number;
  to: number;
  backsUpCiphertext: boolean;
}

/** Wire form of one context item. */
export interface ContextItemMessage {
  id: string;
  project: string;
  type: string;
  content: string;
  tags: string[];
  pinned: boolean;
  source?: string;
  createdAt: string;
}

/** Wire form of one project in the project list. */
export interface ProjectListEntryMessage {
  name: string;
  description?: string;
  itemCount: number;
  lastActivityAt: string | null;
}

/** Which project to show, optionally filtered by item type. */
export interface ContentShowRequest {
  project: string;
  type?: string;
}

/** Full-text query, optionally within one project and up to a number of hits. */
export interface ContentSearchRequest {
  query: string;
  project?: string;
  limit?: number;
}

/** Which project's pack to render. */
export interface ContentPackRequest {
  project: string;
}
/** The project's whole context pack as Markdown. */
export interface ContentPackResponse {
  markdown: string;
}

/** Which project to export, and in which format. */
export interface ContentExportRequest {
  project: string;
  format: "markdown" | "json";
}
/** Where the export was saved, or that the user cancelled the dialog. */
export interface ContentExportResponse {
  cancelled: boolean;
  path?: string;
}

/** Text to put on the clipboard. */
export interface ContentCopyRequest {
  text: string;
}

/** One conversation in an export file, as listed before importing. */
export interface ImportListingRow {
  index: number;
  title: string;
  date: string;
  messageCount: number;
  estimatedChunks: number;
}

/**
 * A manual override for auto-detection — offered only after `import:list`
 * fails with `UNSUPPORTED_SOURCE` (§9 item 72). Duplicated here rather than
 * imported from `src/importers/domain/values/import-source.ts`: `shared/`
 * stays pure of the root `src/` tree, matching every other wire type in this
 * file.
 */
export type ImportFormatOverride = "chatgpt" | "claude" | "generic";

/** The chosen export file's handle, and an optional format override. */
export interface ImportListRequest {
  handle: string;
  from?: ImportFormatOverride;
}
/** The detected format and the conversations found in the file. */
export interface ImportListResponse {
  source: string;
  listing: ImportListingRow[];
}

/** Which conversations to import: all, by index, by title text, or by date. */
export interface ImportSelection {
  pick?: string;
  query?: string;
  since?: string;
  all?: boolean;
  from?: ImportFormatOverride;
}

/** A selection to dry-run against a target project. */
export interface ImportPreviewRequest extends ImportSelection {
  handle: string;
  projectName: string;
}
/** A selection to import into a target project. */
export interface ImportRunRequest extends ImportSelection {
  handle: string;
  projectName: string;
}
/** A conversation that could not be imported, and why. */
export interface ImportFailureMessage {
  conversation: string;
  reason: string;
}
/** Counts of imported, skipped and failed conversations, with the failures. */
export interface ImportOutcomeResponse {
  imported: number;
  conversations: number;
  skipped: number;
  failed: number;
  failures: ImportFailureMessage[];
}

/** One AI tool: whether the MCP server is configured in it, and for which vault. */
export interface ToolsStatusEntry {
  client: string;
  connected: boolean;
  vaultPath?: string;
}

/** Which AI tool to wire the MCP server into. */
export interface ToolsConnectRequest {
  client: string;
}

/**
 * `configUnreadable`, not an `IpcResult` failure — a client whose config file
 * isn't valid JSON is expected, recoverable content the screen renders
 * (mirroring `RelocationClientResult`, §9 item 71): `manualSnippet` (built
 * from `installer.ts`'s own `manualInstructions`, never a caught error's
 * `.message`) is what the fallback block shows. An unknown client id is
 * still a real `IpcResult` failure — that is a caller mistake, not a client
 * config problem.
 */
export interface ToolsConnectResponse {
  outcome: "connected" | "configUnreadable";
  configPath?: string;
  backupPath?: string;
  manualSnippet?: string;
}

/** Whether Node and npm can run on this machine. */
export interface NodeStatusResponse {
  nodeRunnable: boolean;
  npmRunnable: boolean;
}

/** Wire form of the device-local UI preferences. */
export interface AppPreferencesMessage {
  vaultPath: string | null;
  theme: SystemOr<"light" | "dark">;
  language: SystemOr<Language>;
  tourSeen: boolean;
}

/**
 * `preferences:write`'s request — deliberately narrower than
 * `AppPreferencesMessage`: no `vaultPath` field (§8.6). The renderer never
 * supplies a path directly; `vaultPath` is only ever set from a path the
 * main process already resolved itself (a chosen folder's handle, in the
 * relocation wizard — Slice 8). Until that lands, this app never changes
 * `vaultPath` after first launch.
 */
export interface PreferencesWriteRequest {
  theme: SystemOr<"light" | "dark">;
  language: SystemOr<Language>;
  tourSeen: boolean;
}

/**
 * What a native dialog returns: an opaque handle the main process can resolve, and a name to show.
 */
export interface DialogFileChoiceResponse {
  handle: string;
  displayName: string;
}

/**
 * The half of the Sync panel `vault:status` doesn't already carry —
 * `VaultFolderInspection`'s other three fields, plus the resolved
 * `VALIJA_STATE_HOME` path (A6's honest gap: an app launched from a dock
 * icon inherits no shell environment, so a shell-profile override is
 * invisible unless shown). Read-only, never editable (D-U(d)).
 */
export interface RelocationClientEntry {
  client: string;
  /** Has an `mcpServers.valija` entry today — this is who the move will re-point (§4.7 step 30). */
  currentlyConnected: boolean;
  /** The config exists but isn't readable/valid JSON — named before the move starts, not discovered after (§9 item 69). */
  configUnreadable: boolean;
}

/** Handle of the folder chosen as the move destination. */
export interface RelocationPreflightRequest {
  handle: string;
}

/**
 * `refusalCode`, not an `IpcResult` failure — a refusal here is advisory
 * content the wizard renders (D-R(a)), not an unexpected error; `clients`
 * and `looksLikeCloud` are still meaningful even when a refusal is present.
 */
export interface RelocationPreflightResponse {
  destinationDisplayName: string;
  looksLikeCloud: boolean;
  refusalCode: string | null;
  clients: RelocationClientEntry[];
}

/** What happened to one AI tool's config after a move: re-pointed, not connected, or unreadable. */
export interface RelocationClientResult {
  client: string;
  outcome: "rewritten" | "notConnected" | "configUnreadable";
  configPath?: string;
  manualSnippet?: string;
}

/** Handle of the folder to move the vault into. */
export interface RelocationMoveRequest {
  handle: string;
}

/** Where the vault now lives and what happened to each AI tool's config. */
export interface RelocationMoveResponse {
  root: string;
  clientResults: RelocationClientResult[];
}

/** Which AI tool to re-point again. */
export interface RelocationRetryClientRequest {
  client: string;
}

/** Handle of a folder that already holds a vault. */
export interface RelocationPointAtExistingRequest {
  handle: string;
}

/** The vault folder now in use and what happened to each AI tool's config. */
export interface RelocationPointAtExistingResponse {
  root: string;
  clientResults: RelocationClientResult[];
}

/** Sync-safety signals for the vault folder, plus where this device keeps its own state. */
export interface SyncStatusResponse {
  conflictedCopies: string[];
  staleBackups: string[];
  looksLikeCloud: boolean;
  resolvedStateHome: string;
}

/**
 * Mirrors `src/delivery/diagnostics.ts`'s `DiagnosticCheck` — duplicated here
 * rather than imported, matching every other wire type in this file (`shared/`
 * stays pure of the root `src/` tree). `detail` is shown close to verbatim on
 * the Diagnostics screen (D-T Option 3): it is the one row-level text in this
 * app that is not run through the translation catalog, because it already is
 * the same technical detail `valija doctor` prints today — **except** when
 * `errorCode` is set: that means `detail` is a raw `DomainError.message`
 * (a `VaultStatus` read failed), and the screen must localize from
 * `errorCode` instead (D-V(d)) — the Copy report is the only place `detail`'s
 * raw text may still surface.
 */
export interface DiagnosticCheckMessage {
  name: string;
  ok: boolean;
  detail: string;
  fatal?: boolean;
  errorCode?: string;
}

/** The diagnostic check rows, in order. */
export interface DiagnosticsRunResponse {
  checks: DiagnosticCheckMessage[];
}

/**
 * The renderer sends back the check rows it already fetched from
 * `diagnostics:run` rather than main recomputing them — recomputing would
 * silently re-run the disclosed keychain probe a second time on every
 * Copy-report click (§4.6 step 26'/26'').
 */
export interface DiagnosticsCopyReportRequest {
  checks: DiagnosticCheckMessage[];
}
