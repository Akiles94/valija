#!/usr/bin/env node
import { Command } from "commander";
import { buildContainer } from "../container.js";
import { runMcpServer } from "../mcp/server.js";
import { VERSION } from "../version.js";
import { exportCommand, projectsCommand, searchCommand, showCommand } from "./content-commands.js";
import { doctorCommand } from "./doctor.js";
import { CLIENTS, type ClientId, installIntoClient, manualInstructions } from "./installer.js";
import { initCommand, lockCommand, statusCommand, unlockCommand } from "./vault-commands.js";

const program = new Command();
const container = buildContainer();

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
  .argument("<project>", "project slug")
  .option("--type <type>", "filter by type (decision|progress|preference|fact|handoff)")
  .action((project: string, options: { type?: string }) =>
    showCommand(container, project, options),
  );

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
  .argument("<project>", "project slug")
  .option("--json", "export as JSON instead of markdown")
  .option("-o, --output <file>", "write to a file instead of stdout")
  .action((project: string, options: { json?: boolean; output?: string }) =>
    exportCommand(container, project, options),
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

program.parseAsync().catch((error: unknown) => {
  console.error(`error: ${(error as Error).message}`);
  process.exit(1);
});
