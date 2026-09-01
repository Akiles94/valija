/**
 * The only origin of a filesystem path in the whole app (§8.6). The main
 * process opens the dialog and keeps the absolute path; callers across the
 * IPC boundary receive only a display name and an opaque handle.
 */
export interface FilePicker {
  chooseImportFile(): { handle: string; displayName: string; path: string } | null;
  chooseExportTarget(suggestedName: string): string | null;
  chooseVaultFolder(): { handle: string; displayName: string; path: string } | null;
  /** Resolves a handle minted by chooseImportFile/chooseVaultFolder back to its real path. */
  resolveHandle(handle: string): string | undefined;
}
