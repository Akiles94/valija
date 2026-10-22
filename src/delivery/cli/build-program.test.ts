import { describe, expect, it } from "vitest";
import type { Container } from "../container.js";
import { buildProgram } from "./build-program.js";

/** A container that fails loudly if command construction ever reads it. */
const inertContainer = new Proxy(
  {},
  {
    get(_target, key) {
      throw new Error(`buildProgram touched the container (${String(key)})`);
    },
  },
) as Container;

// Captured from `node dist/program.js <cmd> --help` before buildProgram was extracted, so these
// are the pre-refactor truth, not whatever the new code prints. Commands and options added by later
// advances (CURATION: pin, unpin, archive, unarchive, edit, show --archived; PROJECT-DETECT: which,
// link, unlink, links, optional project on show/export; SECRET-WARN: edit and import --allow-secrets)
// are recorded the same way.
const ROOT_HELP = `Usage: valija [options] [command]

Encrypted context vault for developers who use several AI tools.

Options:
  -V, --version                  output the version number
  -h, --help                     display help for command

Commands:
  init                           Create the encrypted vault (passphrase +
                                 recovery kit).
  unlock [options]               Unlock the vault for this session (key goes to
                                 the OS keychain).
  lock                           Lock the vault (remove the key from the OS
                                 keychain).
  status                         Show vault location and lock state.
  projects                       List projects with item counts and last
                                 activity.
  show [options] [project]       Print the items of a project.
  pin <id>                       Pin an item: it always leads its project's
                                 context pack.
  unpin <id>                     Unpin an item.
  archive <id>                   Archive an item: hidden from packs and search,
                                 not deleted. Undo with unarchive.
  unarchive <id>                 Bring an archived item back (find its id with:
                                 valija show <project> --archived).
  edit [options] <id>            Edit an item in place. Content is read from a
                                 file or stdin, never an editor.
  search [options] <query>       Full-text search across saved context.
  export [options] [project]     Export a project's context pack (markdown by
                                 default).
  which [options]                Show which project this folder resolves to, and
                                 why.
  link [options] <project>       Link this folder's git repository (or only the
                                 folder, --by folder) to an existing project.
  unlink [options] [binding-id]  Remove a link, by id (see valija links) or by
                                 the folder it applies to.
  links [project]                List folder and repository links.
  import [options] <file>        Import chatbot history (ChatGPT/Claude/generic
                                 export) into the vault.
  install <client>               Wire the valija MCP server into an AI tool's
                                 config.
  mcp                            Run the MCP server on stdio (used by AI tools,
                                 not by humans).
  doctor                         Check environment, vault, keychain, and client
                                 configs.
  help [command]                 display help for command
`;

const COMMAND_HELP: Record<string, string> = {
  init: `Usage: valija init [options]

Create the encrypted vault (passphrase + recovery kit).

Options:
  -h, --help  display help for command
`,
  unlock: `Usage: valija unlock [options]

Unlock the vault for this session (key goes to the OS keychain).

Options:
  --recovery-key <hex>  unlock with the raw key from your recovery kit
  -h, --help            display help for command
`,
  lock: `Usage: valija lock [options]

Lock the vault (remove the key from the OS keychain).

Options:
  -h, --help  display help for command
`,
  status: `Usage: valija status [options]

Show vault location and lock state.

Options:
  -h, --help  display help for command
`,
  projects: `Usage: valija projects [options]

List projects with item counts and last activity.

Options:
  -h, --help  display help for command
`,
  show: `Usage: valija show [options] [project]

Print the items of a project.

Arguments:
  project        project slug (detected from this folder when omitted)

Options:
  --type <type>  filter by type
                 (decision|progress|preference|fact|handoff|imported)
  --archived     include archived items, marked [archived]
  -h, --help     display help for command
`,
  pin: `Usage: valija pin [options] <id>

Pin an item: it always leads its project's context pack.

Arguments:
  id          item id, or a unique prefix of at least 6 characters (see valija
              show)

Options:
  -h, --help  display help for command
`,
  unpin: `Usage: valija unpin [options] <id>

Unpin an item.

Arguments:
  id          item id, or a unique prefix of at least 6 characters (see valija
              show)

Options:
  -h, --help  display help for command
`,
  archive: `Usage: valija archive [options] <id>

Archive an item: hidden from packs and search, not deleted. Undo with unarchive.

Arguments:
  id          item id, or a unique prefix of at least 6 characters (see valija
              show)

Options:
  -h, --help  display help for command
`,
  unarchive: `Usage: valija unarchive [options] <id>

Bring an archived item back (find its id with: valija show <project>
--archived).

Arguments:
  id          item id, or a unique prefix of at least 6 characters (see valija
              show)

Options:
  -h, --help  display help for command
`,
  edit: `Usage: valija edit [options] <id>

Edit an item in place. Content is read from a file or stdin, never an editor.

Arguments:
  id                     item id, or a unique prefix of at least 6 characters
                         (see valija show)

Options:
  --content-file <path>  new content from a file, or - for stdin
  --tags <tags>          comma-separated tags, replacing the current ones (""
                         clears them)
  --type <type>          new type (decision|progress|preference|fact|handoff)
  --allow-secrets        save even if the content looks like it contains a
                         secret
  -h, --help             display help for command
`,
  search: `Usage: valija search [options] <query>

Full-text search across saved context.

Arguments:
  query                    search terms

Options:
  -p, --project <project>  limit to one project
  -h, --help               display help for command
`,
  export: `Usage: valija export [options] [project]

Export a project's context pack (markdown by default).

Arguments:
  project              project slug (detected from this folder when omitted)

Options:
  --json               export as JSON instead of markdown
  -o, --output <file>  write to a file instead of stdout
  -h, --help           display help for command
`,
  which: `Usage: valija which [options]

Show which project this folder resolves to, and why.

Options:
  --dir <path>  the folder to use instead of the current one
  -h, --help    display help for command
`,
  link: `Usage: valija link [options] <project>

Link this folder's git repository (or only the folder, --by folder) to an
existing project.

Arguments:
  project       an existing project slug

Options:
  --dir <path>  the folder to use instead of the current one
  --by <kind>   repository or folder (default: the repository when it has a
                remote) (choices: "folder", "repository")
  -h, --help    display help for command
`,
  unlink: `Usage: valija unlink [options] [binding-id]

Remove a link, by id (see valija links) or by the folder it applies to.

Arguments:
  binding-id    a binding id from valija links

Options:
  --dir <path>  the folder to use instead of the current one
  --by <kind>   repository or folder (default: the repository when it has a
                remote) (choices: "folder", "repository")
  -h, --help    display help for command
`,
  links: `Usage: valija links [options] [project]

List folder and repository links.

Arguments:
  project     only this project's links

Options:
  -h, --help  display help for command
`,
  import: `Usage: valija import [options] <file>

Import chatbot history (ChatGPT/Claude/generic export) into the vault.

Arguments:
  file                     path to an export file (.json or .zip)

Options:
  -p, --project <project>  target project (required to import; created if new)
  --from <source>          chatgpt | claude | generic (auto-detected if omitted)
  --list                   list conversations and exit (the default when no
                           selection is given)
  --pick <spec>            1-based indices/ranges into the list, e.g. 1,3-5
  --query <text>           select conversations whose title contains this text
  --since <date>           select conversations on or after YYYY-MM-DD
  --all                    import every conversation
  --dry-run                report what would be imported; write nothing
  --allow-secrets          import even if some chunks look like they contain
                           secrets
  -h, --help               display help for command
`,
  install: `Usage: valija install [options] <client>

Wire the valija MCP server into an AI tool's config.

Arguments:
  client      one of: claude-code, claude-desktop, cursor

Options:
  -h, --help  display help for command
`,
  mcp: `Usage: valija mcp [options]

Run the MCP server on stdio (used by AI tools, not by humans).

Options:
  -h, --help  display help for command
`,
  doctor: `Usage: valija doctor [options]

Check environment, vault, keychain, and client configs.

Options:
  -h, --help  display help for command
`,
};

describe("buildProgram", () => {
  const program = buildProgram(inertContainer);

  it("builds the command tree without touching the container or parsing argv", () => {
    expect(program.commands.map((c) => c.name())).toEqual(Object.keys(COMMAND_HELP));
  });

  it("prints exactly the pre-refactor help", () => {
    expect(program.helpInformation()).toBe(ROOT_HELP);
    for (const command of program.commands) {
      expect(command.helpInformation()).toBe(COMMAND_HELP[command.name()]);
    }
  });
});
