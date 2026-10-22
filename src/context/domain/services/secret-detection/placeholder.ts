/** Template markers: `<…>`, `${…}`, `{{…}}`, `%VAR%` anywhere in the value. */
const TEMPLATE_MARKERS = [
  /<[^<>]{1,256}>/,
  /\$\{[^{}]{1,256}\}/,
  /\{\{[^{}]{1,256}\}\}/,
  /%[A-Za-z_][A-Za-z0-9_]{0,63}%/,
];

/** `$VAR` as the whole value (inside a value, `$` is a legitimate password character). */
const SHELL_VARIABLE = /^\$[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** A run of one repeated character: `xxxxxxxx`, `********`, `........`. */
const SINGLE_CHARACTER_RUN = /^(.)\1+$/s;

/** Documentation filler; also covers AWS's documented `…EXAMPLE` keys. */
const FILLER_WORDS = /example|placeholder|redacted|changeme|dummy|sample|your_|your-/i;

/** True when a value is obviously not a real secret: a template, a mask, or documentation filler. */
export function isPlaceholder(value: string): boolean {
  if (TEMPLATE_MARKERS.some((marker) => marker.test(value))) return true;
  if (SHELL_VARIABLE.test(value)) return true;
  if (SINGLE_CHARACTER_RUN.test(value)) return true;
  return FILLER_WORDS.test(value);
}
