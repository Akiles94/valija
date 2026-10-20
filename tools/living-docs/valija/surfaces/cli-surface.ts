import { buildProgram } from "../../../../src/delivery/cli/build-program.js";
import type { SourceFile } from "../../core/infra/typescript-exports-extractor.js";
import { type CallableIndex, reachContainerKeys } from "../services/use-case-reach.js";
import { createInertContainer } from "./inert-container.js";
import { assertSameNames, segmentByMarker } from "./segments.js";

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

  assertSameNames(
    "CLI commands",
    BUILD_PROGRAM_FILE,
    program.commands.map((c) => c.name()),
    [...segments.keys()],
  );

  return program.commands.map((command) => ({
    name: command.name(),
    description: command.description(),
    usage: [command.name(), command.usage()].join(" ").trim(),
    options: command.options.map((o) => ({ flags: o.flags, description: o.description })),
    reaches: reachContainerKeys(segments.get(command.name()) ?? "", BUILD_PROGRAM_FILE, index),
  }));
}
