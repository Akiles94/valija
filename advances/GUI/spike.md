# Slice 1 Spike Results

## Platform Test Results

### macOS

- [ ] Spike window opens on arm64
- [ ] Spike window opens on x64
- [ ] SQLCipher loads successfully
- [ ] Keychain round-trip succeeds
- [ ] Golden vault opens
- [ ] All three native modules load

**macOS Version:**
**Electron Version:**
**Node ABI:**
**Rebuilt Modules:**

### Windows

- [ ] Spike window opens on x64
- [ ] SQLCipher loads successfully
- [ ] Keychain round-trip succeeds
- [ ] Golden vault opens
- [ ] All three native modules load

**Windows Version:**
**Electron Version:**
**Node ABI:**
**Rebuilt Modules:**

### Linux

- [ ] Spike window opens on x86_64
- [ ] SQLCipher loads successfully
- [ ] Keychain round-trip succeeds
- [ ] Golden vault opens
- [ ] All three native modules load

**Linux Version:**
**Electron Version:**
**Node ABI:**
**Rebuilt Modules:**

## macOS ACL Answer

### GUI Reading CLI-Created Entry

- Status: **Pending**
- Behavior: (will record: silent / prompts once / prompts every time / fails)
- macOS Version: (exact version required)

### GUI Creating doctor-probe Entry

- Status: **Pending**
- Behavior: (will record: silent / prompts once / prompts every time / fails)
- macOS Version: (exact version required)

## Artifact Checksums

### macOS

- **ARM64 DMG:** (SHA-256 pending)
- **X64 DMG:** (SHA-256 pending)
- **ZIP (universal):** (SHA-256 pending)

### Windows

- **X64 NSIS:** (SHA-256 pending)

### Linux

- **X86_64 AppImage:** (SHA-256 pending)

## Notes

- Root `npm ci` and `.github/workflows/ci.yml` are unaffected
- Spike renderer deleted at end of slice
- Platform proven before any product UI is written
