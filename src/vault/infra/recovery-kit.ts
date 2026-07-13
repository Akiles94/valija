export function renderRecoveryKit(vaultId: string, keyHex: string, createdAt: string): string {
  return `================================================================
                    VALIJA RECOVERY KIT
================================================================

Created:   ${createdAt}
Vault id:  ${vaultId}

RAW ENCRYPTION KEY (hex):

  ${keyHex}

----------------------------------------------------------------
WHAT THIS IS

This key decrypts your valija vault (~/.valija/vault.db) WITHOUT
the passphrase. It is the only way back in if you forget your
passphrase. There is no server, no account, no reset email.

  passphrase lost + this kit lost  =  your data is gone. Forever.

WHAT TO DO WITH IT

  1. Print this file or copy it by hand.
  2. Store it OFFLINE: a drawer, a safe, a password manager you
     trust — anywhere that is not this computer.
  3. Delete this file from disk once stored.

HOW TO RECOVER

  valija unlock --recovery-key <the hex above>

Anyone holding this key can read your vault. Guard it like a key.
================================================================
`;
}
