import { basename } from "node:path";
import type { ProjectBindingView } from "../../../../../src/context/application/dto/project-binding-view.js";
import type { ProjectResolutionOutput } from "../../../../../src/context/application/dto/project-resolution-output.js";
import type { Container } from "../../../../../src/delivery/container.js";
import { displayTarget } from "../../../../../src/delivery/project-detection.js";
import type {
  BindingMessage,
  BindingsInspectRequest,
  BindingsInspectResponse,
  BindingsLinkRequest,
  BindingsLinkResponse,
  BindingsListRequest,
  BindingsUnlinkRequest,
  IpcResult,
} from "../../../shared/ipc/messages.js";
import type { FilePicker } from "../../application/ports/file-picker.js";
import { toIpcResult } from "../to-ipc-result.js";

/**
 * The same four use cases the CLI's `which`/`link`/`unlink`/`links` call.
 * A folder arrives only as a `pf-` handle the main process redeems; no
 * preferences store is passed in, so nothing here can write app preferences.
 */
export function createBindingsHandlers(getContainer: () => Container, filePicker: FilePicker) {
  return {
    "bindings:inspect": ({ handle }: BindingsInspectRequest) => {
      const directory = filePicker.resolveProjectFolder(handle);
      if (directory === undefined) return unknownFolder();
      // No envProject: the desktop never reads the project environment variable (D-D).
      const resolved = getContainer().resolveProject.execute({ directories: [directory] });
      return toIpcResult(resolved, (r) => toInspectResponse(r, basename(directory)));
    },

    "bindings:link": ({ handle, projectName, by }: BindingsLinkRequest) => {
      const directory = filePicker.resolveProjectFolder(handle);
      if (directory === undefined) return unknownFolder();
      const linked = getContainer().linkWorkspace.execute({ project: projectName, directory, by });
      return toIpcResult(linked, (v): BindingsLinkResponse => ({ changed: v.changed }));
    },

    "bindings:unlink": ({ bindingId }: BindingsUnlinkRequest) =>
      toIpcResult(getContainer().unlinkWorkspace.execute({ bindingId }), toBindingMessage),

    "bindings:list": ({ projectName }: BindingsListRequest) =>
      toIpcResult(
        getContainer().listProjectBindings.execute(
          projectName === undefined ? {} : { project: projectName },
        ),
        (views) => views.map(toBindingMessage),
      ),
  };
}

function unknownFolder(): IpcResult<never> {
  return { ok: false, error: { code: "INVALID_WORKSPACE_PATH" } };
}

function toInspectResponse(
  r: ProjectResolutionOutput,
  displayName: string,
): BindingsInspectResponse {
  const location = r.locations[0];
  return {
    displayName,
    // One directory cannot be ambiguous; were it ever, it reads as "not linked".
    resolvesTo:
      r.outcome === "detected" && r.detectedBy !== "env"
        ? { project: r.project, kind: r.detectedBy }
        : null,
    isRepository: location !== undefined && location.repositoryRoot !== null,
    remote: location?.repository ?? null,
    canLinkFolder: location !== undefined && !location.tooBroadToLink,
    ...(r.outcome === "none" && r.hint !== undefined ? { hint: r.hint } : {}),
  };
}

function toBindingMessage(view: ProjectBindingView): BindingMessage {
  return { ...view, target: displayTarget(view) };
}
