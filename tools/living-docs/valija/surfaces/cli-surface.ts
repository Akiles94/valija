import { buildProgram } from "../../../../src/delivery/cli/build-program.js";
import type { SourceFile } from "../../core/infra/typescript-exports-extractor.js";
import { type CallableIndex, reachContainerKeys } from "../services/use-case-reach.js";
import { createInertContainer } from "./inert-container.js";
import { segmentByMarker } from "./segments.js";

/** Where `buildProgram` lives; the static half of CLI discovery reads it. */
export const BUILD_PROGRAM_FILE = "src/delivery/cli/build-program.ts";

/** One `valija` command as registered with commander, plus the container keys it reaches. */
export interface CliCommand {
  readonly name: string;
  readonly description: string;
  readonly usage: string;
  readonly options: readonly { flags: string; description: string }[];
  readonly reaches: readonly string[];
}

/**
 * Reads commands at runtime from commander (names, descriptions, arguments, options) and links
 * each to the use cases its action reaches by scanning `buildProgram` statically.
 */
export function readCliCommands(files: readonly SourceFile[], index: CallableIndex): CliCommand[] {
  const program = buildProgram(createInertContainer());
  const source = files.find((f) => f.path === BUILD_PROGRAM_FILE);
  const build = source?.scanned.declarations.find((d) => d.name === "buildProgram");
  if (!build) throw new Error(`cannot find buildProgram in ${BUILD_PROGRAM_FILE}`);
  const segments = segmentByMarker(build.span, /\.command\(\s*"([\w-]+)"/g);

  const runtime = program.commands.map((c) => c.name());
  const mismatch = symmetricDifference(runtime, [...segments.keys()]);
  if (mismatch.length > 0) {
    throw new Error(`commander and ${BUILD_PROGRAM_FILE} disagree on: ${mismatch.join(", ")}`);
  }

  return program.commands.map((command) => ({
    name: command.name(),
    description: command.description(),
    usage: [command.name(), command.usage()].join(" ").trim(),
    options: command.options.map((o) => ({ flags: o.flags, description: o.description })),
    reaches: reachContainerKeys(segments.get(command.name()) ?? "", BUILD_PROGRAM_FILE, index),
  }));
}

/** Names present in one list but not the other, sorted. */
export function symmetricDifference(a: readonly string[], b: readonly string[]): string[] {
  const left = new Set(a);
  const right = new Set(b);
  return [...a.filter((x) => !right.has(x)), ...b.filter((x) => !left.has(x))].sort();
}
