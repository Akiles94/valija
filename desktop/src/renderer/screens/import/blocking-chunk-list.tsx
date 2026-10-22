import type { BlockingChunkMessage } from "../../../shared/ipc/messages.js";
import { useT } from "../../state/i18n-context.js";
import { describeSecretFindings } from "../../state/secret-findings.js";

/**
 * The chunks that block an import (SECRET-WARN D-E): which conversation (`#n`
 * is the listing's own number), which part, what kind and which lines — never
 * the secret, and no title when the title itself is flagged.
 */
export function BlockingChunkList({ chunks }: { chunks: readonly BlockingChunkMessage[] }) {
  const t = useT();
  return (
    <ul className="blocking-chunks">
      {chunks.map((chunk) => (
        <li key={`${chunk.conversationIndex}-${chunk.part}`}>
          {t("import.blockingChunk", {
            index: chunk.conversationIndex,
            title: chunk.title ?? t("import.titleHidden"),
            part: chunk.part,
            findings: describeSecretFindings(chunk.findings, t),
          })}
        </li>
      ))}
    </ul>
  );
}
