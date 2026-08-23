import type { SystemOr } from "../../main/application/policies/system-or-override.js";
import type { Language } from "../i18n/languages.js";

/**
 * Every response backed by a `Result`-returning use case crosses the
 * boundary as this shape — `error` carries only a `code`, never
 * `DomainError.message` (D-V(d), §5.1). The renderer maps `code` to catalog
 * copy; it never renders a raw message.
 */
export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: { code: string } };

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

export interface VaultUnlockRequest {
  passphrase?: string;
  recoveryKeyHex?: string;
  upgradeConfirmed?: boolean;
}
export interface VaultUnlockResponse {
  vaultId: string;
  fork?: {
    generation: number;
    writer: string;
    noticeCode: string;
  };
}

export interface VaultLockResponse {
  wasUnlocked: boolean;
  generation?: number;
  writer?: string;
  writerIsThisDevice?: boolean;
  sidecars: string[];
}

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

export interface VaultUpgradeCheckRequest {
  passphrase?: string;
  recoveryKeyHex?: string;
}
export interface VaultUpgradeCheckResponse {
  required: boolean;
  from: number;
  to: number;
  backsUpCiphertext: boolean;
}

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

export interface ProjectListEntryMessage {
  name: string;
  description?: string;
  itemCount: number;
  lastActivityAt: string | null;
}

export interface ContentShowRequest {
  project: string;
  type?: string;
}

export interface ContentSearchRequest {
  query: string;
  project?: string;
  limit?: number;
}

export interface ContentPackRequest {
  project: string;
}
export interface ContentPackResponse {
  markdown: string;
}

export interface ContentExportRequest {
  project: string;
  format: "markdown" | "json";
}
export interface ContentExportResponse {
  cancelled: boolean;
  path?: string;
}

export interface ContentCopyRequest {
  text: string;
}

export interface ImportListingRow {
  index: number;
  title: string;
  date: string;
  messageCount: number;
  estimatedChunks: number;
}

export interface ImportListRequest {
  handle: string;
}
export interface ImportListResponse {
  source: string;
  listing: ImportListingRow[];
}

export interface ImportSelection {
  pick?: string;
  query?: string;
  since?: string;
  all?: boolean;
}

export interface ImportPreviewRequest extends ImportSelection {
  handle: string;
  projectName: string;
}
export interface ImportRunRequest extends ImportSelection {
  handle: string;
  projectName: string;
}
export interface ImportFailureMessage {
  conversation: string;
  reason: string;
}
export interface ImportOutcomeResponse {
  imported: number;
  conversations: number;
  skipped: number;
  failed: number;
  failures: ImportFailureMessage[];
}

export interface ToolsStatusEntry {
  client: string;
  connected: boolean;
  vaultPath?: string;
}

export interface ToolsConnectRequest {
  client: string;
}
export interface ToolsConnectResponse {
  configPath: string;
  backupPath: string | null;
}

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

export interface DialogFileChoiceResponse {
  handle: string;
  displayName: string;
}
