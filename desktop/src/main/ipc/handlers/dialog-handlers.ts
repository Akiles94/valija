import type { DialogFileChoiceResponse } from "../../../shared/ipc/messages.js";
import type { FilePicker } from "../../application/ports/file-picker.js";

/**
 * Handlers for the `dialog:*` channels: native file and folder pickers that return opaque handles.
 */
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
    "dialog:chooseProjectFolder": (): DialogFileChoiceResponse | null => {
      const chosen = filePicker.chooseProjectFolder();
      return chosen === null ? null : { handle: chosen.handle, displayName: chosen.displayName };
    },
  };
}
