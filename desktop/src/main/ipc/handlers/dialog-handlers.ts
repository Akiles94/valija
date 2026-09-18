import type { DialogFileChoiceResponse } from "../../../shared/ipc/messages.js";
import type { FilePicker } from "../../application/ports/file-picker.js";

export function createDialogHandlers(filePicker: FilePicker) {
  return {
    "dialog:chooseImportFile": (): DialogFileChoiceResponse | null => {
      const chosen = filePicker.chooseImportFile();
      return chosen === null ? null : { handle: chosen.handle, displayName: chosen.displayName };
    },
    "dialog:chooseVaultFolder": (): DialogFileChoiceResponse | null => {
      const chosen = filePicker.chooseVaultFolder();
      return chosen === null ? null : { handle: chosen.handle, displayName: chosen.displayName };
    },
  };
}
