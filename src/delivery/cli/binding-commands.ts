import { resolve } from "node:path";
import type { ProjectBindingView } from "../../context/application/dto/project-binding-view.js";
import type { ProjectResolutionOutput } from "../../context/application/dto/project-resolution-output.js";
import type { BindingKind } from "../../context/domain/values/binding-target.js";
import type { Container } from "../container.js";
import { detectionLabel, displayTarget } from "../project-detection.js";
import { fail } from "./render.js";

// Nothing in this file prints item content: only project slugs, binding ids, kinds and targets.

/** The `--dir` and `--by` flags shared by `valija link` and `valija unlink`. */
export interface BindingOptions {
  dir?: string;
  by?: BindingKind;
}

/** `valija which`: prints which project this folder resolves to, and why. */
export function whichCommand(c: Container, options: { dir?: string }): void {
  const result = c.resolveProject.execute({
    directories: [workingDirectory(options.dir)],
    ...(c.envProject === undefined ? {} : { envProject: c.envProject }),
  });
  if (!result.ok) fail(result.error);
  for (const line of whichLines(result.value)) console.log(line);
}

/** `valija link <project>`: links this folder's repository, or only the folder, to an existing project. */
export function linkCommand(c: Container, project: string, options: BindingOptions): void {
  const result = c.linkWorkspace.execute({
    project,
    directory: workingDirectory(options.dir),
    ...(options.by === undefined ? {} : { by: options.by }),
  });
  if (!result.ok) fail(result.error);
  const { binding, changed } = result.value;
  const linked = `${describe(binding)} → project "${binding.project}".`;
  if (!changed) {
    console.log(`Already linked: ${linked} Nothing changed.`);
    return;
  }
  console.log(`Linked ${linked}`);
  if (binding.kind === "repository") {
    console.log(
      `(Any clone of this repository, on any device that syncs this vault, now resolves to "${binding.project}".)`,
    );
  }
}

/** `valija unlink [id]`: removes a link by id, or the one this folder resolves through. */
export function unlinkCommand(
  c: Container,
  bindingId: string | undefined,
  options: BindingOptions,
): void {
  if (bindingId !== undefined && (options.dir !== undefined || options.by !== undefined)) {
    console.error("error: give a binding id or --dir/--by, not both.");
    process.exit(1);
  }
  const result = c.unlinkWorkspace.execute(
    bindingId !== undefined
      ? { bindingId }
      : {
          directory: workingDirectory(options.dir),
          ...(options.by === undefined ? {} : { by: options.by }),
        },
  );
  if (!result.ok) fail(result.error);
  console.log(`Unlinked ${describe(result.value)} from project "${result.value.project}".`);
}

/** `valija links [project]`: lists folder and repository links with their ids. */
export function linksCommand(c: Container, project: string | undefined): void {
  const result = c.listProjectBindings.execute(project === undefined ? {} : { project });
  if (!result.ok) fail(result.error);
  if (result.value.length === 0) {
    console.log(
      project === undefined
        ? "No folders or repositories are linked yet. Link one with: valija link <project>"
        : `No folders or repositories are linked to "${project}" yet. Link one with: valija link ${project}`,
    );
    return;
  }
  const rows = result.value.map((b) => [b.id, b.project, b.kind, displayTarget(b)]);
  for (const line of table([["ID", "PROJECT", "KIND", "TARGET"], ...rows])) console.log(line);
}

function workingDirectory(dir: string | undefined): string {
  return resolve(dir ?? process.cwd());
}

/** "repository github.com/oscar/valija" / "folder ~/code/acme/services/billing". */
function describe(binding: ProjectBindingView): string {
  return `${binding.kind} ${displayTarget(binding)}`;
}

function whichLines(r: ProjectResolutionOutput): string[] {
  if (r.outcome === "detected") {
    const target = r.binding === undefined ? "" : ` ${displayTarget(r.binding)}`;
    return [`${r.project}  (${detectionLabel(r.detectedBy)}${target})`];
  }
  if (r.outcome === "ambiguous") {
    return [`This folder is linked to different projects: ${r.projects.join(", ")}.`];
  }
  if (r.hint === undefined) return ["No project detected here."];
  return [
    "No project detected here.",
    `Hint: a project named "${r.hint}" matches this repository's name. Link it with: valija link ${r.hint}`,
  ];
}

/** Columns padded to their widest cell plus two spaces; the last column is never padded. */
function table(rows: string[][]): string[] {
  const widths = rows[0]?.map((_, i) => Math.max(...rows.map((row) => row[i]?.length ?? 0))) ?? [];
  return rows.map((row) =>
    row
      .map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd((widths[i] ?? 0) + 2)))
      .join(""),
  );
}
