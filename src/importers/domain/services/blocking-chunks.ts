import { detectSecrets } from "../../../context/domain/services/secret-detection/detect-secrets.js";
import type { SecretFinding } from "../../../context/domain/values/secret-finding.js";

/** One chunk about to be imported, labelled the way the user sees it in the listing. */
export interface ChunkToScreen {
  /** 1-based position in the full, date-sorted listing — the number `--pick` reads. */
  readonly conversationIndex: number;
  readonly title: string;
  /** 1-based chunk number within its conversation. */
  readonly part: number;
  readonly content: string;
}

/** A chunk that blocks the import. `title` is null when the title itself looks like a secret (P-6). */
export interface BlockingChunk {
  readonly conversationIndex: number;
  readonly title: string | null;
  readonly part: number;
  readonly findings: SecretFinding[];
}

/** Line 1 of every chunk is the provenance header, which carries the conversation title. */
const HEADER_LINE = 1;

/**
 * D-E: every chunk with a possible secret, in listing order. The same call
 * serves the dry-run and the real run, so their lists always agree.
 */
export function findBlockingChunks(chunks: readonly ChunkToScreen[]): BlockingChunk[] {
  return chunks.flatMap((chunk) => {
    const findings = detectSecrets(chunk.content);
    if (findings.length === 0) return [];
    return [
      {
        conversationIndex: chunk.conversationIndex,
        title: titleIsFlagged(chunk, findings) ? null : chunk.title,
        part: chunk.part,
        findings,
      },
    ];
  });
}

/** Hide the title when the header line is flagged, or the title alone looks like a secret. */
function titleIsFlagged(chunk: ChunkToScreen, findings: readonly SecretFinding[]): boolean {
  if (findings.some((finding) => finding.firstLine === HEADER_LINE)) return true;
  return detectSecrets(chunk.title).length > 0;
}
