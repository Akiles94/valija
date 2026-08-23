import { clipboard } from "electron";
import type { ClipboardPort } from "../application/ports/clipboard.js";

export class ElectronClipboard implements ClipboardPort {
  writeText(text: string): void {
    clipboard.writeText(text);
  }
}
