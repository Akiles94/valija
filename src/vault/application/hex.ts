export const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export const isKeyHex = (value: string): boolean => /^[0-9a-f]{64}$/i.test(value);
