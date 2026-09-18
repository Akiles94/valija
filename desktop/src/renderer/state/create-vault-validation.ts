export const MIN_PASSPHRASE_LENGTH = 8;

export type PassphraseValidation = "tooShort" | "mismatch" | null;

/**
 * Pulled out of `CreateVaultScreen` so the rule "a mismatch never reaches
 * IPC" is headlessly testable without a DOM (Gate P scopes DOM-level tests
 * to `recovery-kit.tsx` and, later, `relocate-vault.tsx` only). This is a
 * UI-only guard, not a re-implementation of `parsePassphrase` — the length
 * rule that actually matters is still enforced by `CreateVault` (§9).
 */
export function validateNewPassphrase(
  passphrase: string,
  confirmation: string,
): PassphraseValidation {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) return "tooShort";
  if (passphrase !== confirmation) return "mismatch";
  return null;
}
