/** Write-only access to the system clipboard (the app never reads it). */
export interface ClipboardPort {
  writeText(text: string): void;
}
