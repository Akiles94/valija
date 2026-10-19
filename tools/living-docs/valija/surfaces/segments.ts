/**
 * Splits a declaration at each marker (e.g. `.command("init")`), returning the masked code of
 * every segment keyed by the marker's captured name. Markers are found in `source` (string
 * contents are blanked in `code`); offsets are shared, so the segment text comes from `code`.
 */
export function segmentByMarker(
  span: { readonly source: string; readonly code: string },
  marker: RegExp,
): Map<string, string> {
  const hits = [...span.source.matchAll(marker)].filter(
    (m) => span.code.slice(m.index, m.index + 2).trim() !== "",
  );
  const segments = new Map<string, string>();
  hits.forEach((hit, i) => {
    const end = hits[i + 1]?.index ?? span.code.length;
    segments.set(hit[1] as string, span.code.slice(hit.index, end));
  });
  return segments;
}
