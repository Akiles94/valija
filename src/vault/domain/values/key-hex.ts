/**
 * The vault key rendered as hex — the vault's canonical key format:
 * exactly 64 hex characters (32 bytes). This is what lives in the OS
 * keychain and what a recovery kit prints.
 */
export const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export const isKeyHex = (value: string): boolean => /^[0-9a-f]{64}$/i.test(value);
