import {
  byCodeUnit,
  type Catalogue,
  type CatalogueRow,
  createCatalogue,
  createFinding,
  type Finding,
  itemAnchor,
} from "living-docs";

/** A hand-maintained parity statement; every one must say why (D-12). */
export type ParityDeclaration =
  | {
      readonly pair: { readonly cli: string; readonly ipc: readonly string[] };
      readonly reason: string;
    }
  | { readonly surfaceSpecific: readonly string[]; readonly reason: string }
  | { readonly knownGap: readonly string[]; readonly reason: string };

/** An entry point with the use cases it reaches (container keys). */
export interface ReachingEntry {
  readonly name: string;
  readonly reaches: readonly string[];
}

/**
 * CLI ↔ desktop parity (CLAUDE.md "Surface parity"): entry points pair automatically when they
 * reach a common use case; declarations cover the rest; anything left over is a finding.
 */
export function pairSurfaces(
  cli: readonly ReachingEntry[],
  ipc: readonly ReachingEntry[],
  declarations: readonly ParityDeclaration[],
  where: { file: string },
): { catalogue: Catalogue; findings: Finding[] } {
  const declared = new Map<string, ParityDeclaration>();
  for (const d of declarations) {
    // CLI names never contain ":" and channel names always do, so one map holds both.
    const names =
      "pair" in d
        ? [d.pair.cli, ...d.pair.ipc]
        : "surfaceSpecific" in d
          ? d.surfaceSpecific
          : d.knownGap;
    for (const name of names) declared.set(name, d);
  }

  const rows: CatalogueRow[] = [];
  const pairedIpc = new Set<string>();
  const findings: Finding[] = [];

  // Declarations win: a declared entry point never takes part in automatic pairing.
  const undeclaredIpc = ipc.filter((c) => !declared.has(c.name));
  for (const command of cli) {
    const declaration = declared.get(command.name);
    if (declaration && "pair" in declaration) {
      for (const c of declaration.pair.ipc) pairedIpc.add(c);
      rows.push(row(command.name, declaration.pair.ipc, label(declaration)));
      continue;
    }
    if (declaration) {
      rows.push(row(command.name, [], label(declaration)));
      continue;
    }
    const shared = undeclaredIpc.filter((c) => c.reaches.some((k) => command.reaches.includes(k)));
    if (shared.length > 0) {
      for (const c of shared) pairedIpc.add(c.name);
      const via = new Set(
        shared.flatMap((c) => c.reaches.filter((k) => command.reaches.includes(k))),
      );
      const why = `Same use case: ${[...via].sort(byCodeUnit).join(", ")}`;
      rows.push(
        row(
          command.name,
          shared.map((c) => c.name),
          why,
        ),
      );
      continue;
    }
    findings.push(orphan(`CLI command "${command.name}" has no desktop counterpart`, where));
  }

  for (const channel of ipc) {
    if (pairedIpc.has(channel.name)) continue;
    const declaration = declared.get(channel.name);
    if (declaration && !("pair" in declaration)) {
      rows.push(row(null, [channel.name], label(declaration)));
    } else {
      findings.push(orphan(`desktop channel "${channel.name}" has no CLI counterpart`, where));
    }
  }

  const catalogue = createCatalogue({
    id: "parity",
    page: "reference/parity.md",
    title: "CLI ↔ desktop parity",
    intro:
      "The CLI and the desktop app are symmetric (CLAUDE.md, Surface parity). Rows pair automatically when both entry points reach the same use case; the rest are declared in `tools/living-docs/valija/composition/valija-guide.ts` with a reason. The MCP surface is deliberately narrower and is not part of this table.",
    columns: ["CLI", "Desktop channels", "Why"],
    rows: rows.sort((a, b) => byCodeUnit(sortKey(a), sortKey(b))),
  });
  return { catalogue, findings };
}

function label(d: ParityDeclaration): string {
  if ("knownGap" in d) return `Known gap: ${d.reason}`;
  if ("surfaceSpecific" in d) return `Surface-specific: ${d.reason}`;
  return `Declared: ${d.reason}`;
}

function row(cli: string | null, channels: readonly string[], why: string): CatalogueRow {
  const link = (kind: "cli" | "ipc", name: string) => ({
    text: kind === "cli" ? `valija ${name}` : name,
    href: `reference/${kind}.md#${itemAnchor({ kind, name })}`,
  });
  return {
    cells: [
      cli === null ? { text: "—" } : { text: "", links: [link("cli", cli)] },
      channels.length === 0
        ? { text: "—" }
        : { text: "", links: [...channels].sort(byCodeUnit).map((c) => link("ipc", c)) },
      { text: why },
    ],
  };
}

function sortKey(row: CatalogueRow): string {
  const cli = row.cells[0]?.links?.[0]?.text;
  return cli ?? `~${row.cells[1]?.links?.[0]?.text ?? ""}`;
}

function orphan(message: string, where: { file: string }): Finding {
  return createFinding({
    rule: "unreferenced-item",
    file: where.file,
    subject: "parity",
    message: `${message}; pair it or declare it in VALIJA_PARITY with a reason`,
  });
}
