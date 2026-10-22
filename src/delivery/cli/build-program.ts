import { Command, Option } from "commander";
import { BINDING_KINDS } from "../../context/domain/values/binding-target.js";
import type { Container } from "../container.js";
import { runMcpServer } from "../mcp/server.js";
import { VERSION } from "../version.js";
import {
  type BindingOptions,
  linkCommand,
  linksCommand,
  unlinkCommand,
  whichCommand,
} from "./binding-commands.js";
import { exportCommand, projectsCommand, searchCommand, showCommand } from "./content-commands.js";
import {
  archiveCommand,
  type EditOptions,
  editCommand,
  pinCommand,
  unarchiveCommand,
  unpinCommand,
} from "./curation-commands.js";
import { doctorCommand } from "./doctor.js";
import { importCommand } from "./import-command.js";
import { CLIENTS, type ClientId, installIntoClient, manualInstructions } from "./installer.js";
import { initCommand, lockCommand, statusCommand, unlockCommand } from "./vault-commands.js";

/**
 * Builds the whole `valija` command tree without parsing argv or touching the container: the
 * container is only read inside each command's action. Shared by the CLI entry (`program.ts`)
 * and by tools that read the registered commands (the living-docs generator).
 */
export function buildProgram(container: Container): Command {
  const program = new Command();

  program
    .name("valija")
    .description("Encrypted context vault for developers who use several AI tools.")
    .version(VERSION);

  program
    .command("init")
    .description("Create the encrypted vault (passphrase + recovery kit).")
    .action(() => initCommand(container));

  program
    .command("unlock")
    .description("Unlock the vault for this session (key goes to the OS keychain).")
    .option("--recovery-key <hex>", "unlock with the raw key from your recovery kit")
    .action((options: { recoveryKey?: string }) => unlockCommand(container, options));

  program
    .command("lock")
    .description("Lock the vault (remove the key from the OS keychain).")
    .action(() => lockCommand(container));

  program
    .command("status")
    .description("Show vault location and lock state.")
    .action(() => statusCommand(container));

  program
    .command("projects")
    .description("List projects with item counts and last activity.")
    .action(() => projectsCommand(container));

  program
    .command("show")
    .description("Print the items of a project.")
    .argument("[project]", "project slug (detected from this folder when omitted)")
    .option("--type <type>", "filter by type (decision|progress|preference|fact|handoff|imported)")
    .option("--archived", "include archived items, marked [archived]")
    .action((project: string | undefined, options: { type?: string; archived?: boolean }) =>
      showCommand(container, project, options),
    );

  const ITEM_ARG = "item id, or a unique prefix of at least 6 characters (see valija show)";

  program
    .command("pin")
    .description("Pin an item: it always leads its project's context pack.")
    .argument("<id>", ITEM_ARG)
    .action((id: string) => pinCommand(container, id));

  program
    .command("unpin")
    .description("Unpin an item.")
    .argument("<id>", ITEM_ARG)
    .action((id: string) => unpinCommand(container, id));

  program
    .command("archive")
    .description("Archive an item: hidden from packs and search, not deleted. Undo with unarchive.")
    .argument("<id>", ITEM_ARG)
    .action((id: string) => archiveCommand(container, id));

  program
    .command("unarchive")
    .description(
      "Bring an archived item back (find its id with: valija show <project> --archived).",
    )
    .argument("<id>", ITEM_ARG)
    .action((id: string) => unarchiveCommand(container, id));

  program
    .command("edit")
    .description("Edit an item in place. Content is read from a file or stdin, never an editor.")
    .argument("<id>", ITEM_ARG)
    .option("--content-file <path>", "new content from a file, or - for stdin")
    .option("--tags <tags>", 'comma-separated tags, replacing the current ones ("" clears them)')
    .option("--type <type>", "new type (decision|progress|preference|fact|handoff)")
    .action((id: string, options: EditOptions) => editCommand(container, id, options));

  program
    .command("search")
    .description("Full-text search across saved context.")
    .argument("<query>", "search terms")
    .option("-p, --project <project>", "limit to one project")
    .action((query: string, options: { project?: string }) =>
      searchCommand(container, query, options),
    );

  program
    .command("export")
    .description("Export a project's context pack (markdown by default).")
    .argument("[project]", "project slug (detected from this folder when omitted)")
    .option("--json", "export as JSON instead of markdown")
    .option("-o, --output <file>", "write to a file instead of stdout")
    .action((project: string | undefined, options: { json?: boolean; output?: string }) =>
      exportCommand(container, project, options),
    );

  const DIR_OPTION = ["--dir <path>", "the folder to use instead of the current one"] as const;
  const byOption = () =>
    new Option(
      "--by <kind>",
      "repository or folder (default: the repository when it has a remote)",
    ).choices(BINDING_KINDS);

  program
    .command("which")
    .description("Show which project this folder resolves to, and why.")
    .option(...DIR_OPTION)
    .action((options: { dir?: string }) => whichCommand(container, options));

  program
    .command("link")
    .description(
      "Link this folder's git repository (or only the folder, --by folder) to an existing project.",
    )
    .argument("<project>", "an existing project slug")
    .option(...DIR_OPTION)
    .addOption(byOption())
    .action((project: string, options: BindingOptions) => linkCommand(container, project, options));

  program
    .command("unlink")
    .description("Remove a link, by id (see valija links) or by the folder it applies to.")
    .argument("[binding-id]", "a binding id from valija links")
    .option(...DIR_OPTION)
    .addOption(byOption())
    .action((bindingId: string | undefined, options: BindingOptions) =>
      unlinkCommand(container, bindingId, options),
    );

  program
    .command("links")
    .description("List folder and repository links.")
    .argument("[project]", "only this project's links")
    .action((project: string | undefined) => linksCommand(container, project));

  program
    .command("import")
    .description("Import chatbot history (ChatGPT/Claude/generic export) into the vault.")
    .argument("<file>", "path to an export file (.json or .zip)")
    .option("-p, --project <project>", "target project (required to import; created if new)")
    .option("--from <source>", "chatgpt | claude | generic (auto-detected if omitted)")
    .option("--list", "list conversations and exit (the default when no selection is given)")
    .option("--pick <spec>", "1-based indices/ranges into the list, e.g. 1,3-5")
    .option("--query <text>", "select conversations whose title contains this text")
    .option("--since <date>", "select conversations on or after YYYY-MM-DD")
    .option("--all", "import every conversation")
    .option("--dry-run", "report what would be imported; write nothing")
    .action((file: string, options: Parameters<typeof importCommand>[2]) =>
      importCommand(container, file, options),
    );

  program
    .command("install")
    .description("Wire the valija MCP server into an AI tool's config.")
    .argument("<client>", `one of: ${CLIENTS.join(", ")}`)
    .action((client: string) => {
      if (!(CLIENTS as readonly string[]).includes(client)) {
        console.error(`error: unknown client "${client}". Use one of: ${CLIENTS.join(", ")}`);
        process.exit(1);
      }
      try {
        const result = installIntoClient(client as ClientId);
        console.log(`valija MCP server added to ${result.configPath}`);
        if (result.backupPath) console.log(`Backup of the previous config: ${result.backupPath}`);
        console.log(`Restart ${client} to pick it up.`);
      } catch (e) {
        console.error(`Could not update the config automatically: ${(e as Error).message}\n`);
        console.error(manualInstructions(client as ClientId));
        process.exit(1);
      }
    });

  program
    .command("mcp")
    .description("Run the MCP server on stdio (used by AI tools, not by humans).")
    .action(async () => {
      await runMcpServer(container);
    });

  program
    .command("doctor")
    .description("Check environment, vault, keychain, and client configs.")
    .action(() => doctorCommand(container));

  return program;
}
