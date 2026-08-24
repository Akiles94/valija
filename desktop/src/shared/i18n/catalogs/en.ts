// English catalog - source of truth
// Namespaced by screen for reviewable coverage

const en = {
  // Common/shared strings
  common: {
    ok: "OK",
    cancel: "Cancel",
    continue: "Continue",
    skip: "Skip",
    back: "Back",
    next: "Next",
    close: "Close",
    copy: "Copy",
    copied: "Copied",
    error: "Error",
    warning: "Warning",
    loading: "Loading...",
    settings: "Settings",
    help: "Help",
  },

  // First run: no vault
  noVault: {
    title: "No vault on this machine yet",
    createNew: "Create a vault",
    existingVault: "I already have one",
    existingExplain:
      "Point Valija to your vault folder on this or another machine",
  },

  // Create vault screen
  createVault: {
    title: "Create your encrypted vault",
    passphrase: "Enter a passphrase",
    passphraseConfirm: "Confirm passphrase",
    passphraseHint: "Minimum 8 characters",
    warning:
      "If you lose it AND the recovery kit, your data is gone. No reset exists.",
    mismatch: "Passphrases do not match",
    creating: "Creating your encrypted vault (about a second)…",
    derived: "Passphrase accepted. Displaying your recovery kit…",
  },

  // Recovery kit screen
  recoveryKit: {
    title: "Your recovery kit",
    explanation:
      "This recovery kit is written and stored in English so it reads identically everywhere.",
    stored: "I have stored this somewhere offline",
    cannotProceed: "You must confirm before proceeding",
  },

  // Locked/unlock screen
  locked: {
    title: "Vault is locked",
    passphrase: "Enter your passphrase",
    unlocking: "Unlocking…",
    recoveryKey: "I only have my recovery key",
  },

  // Migration/upgrade screen
  migrationConfirm: {
    title: "Your vault needs a security update",
    description:
      "We'll encrypt and back up your data during this update. This is a one-time operation.",
    backup: "A ciphertext backup will be created",
    cancel: "Cancel (vault remains locked)",
    continue: "Continue with update",
  },

  // Fork notice
  forkNotice: {
    title: "Vault fork detected",
    explain:
      "This machine has an older copy of your vault. Check the Sync panel for details.",
  },

  // Dashboard
  dashboard: {
    title: "Your context",
    noContext: "No context saved yet",
    connect: "Connect an AI tool",
    import: "Import your chat history",
    projectCount: { one: "1 item", other: "{count} items" },
  },

  // Project
  project: {
    title: "Project",
    noItems: "No items in this project",
    typeFilter: "Type",
    allTypes: "All types",
  },

  // Search
  search: {
    title: "Search",
    placeholder: "Search context",
    noResults: "No results found",
  },

  // Pack/export
  packPreview: {
    title: "Context pack",
    format: "Format",
    markdown: "Markdown",
    json: "JSON",
    exportAs: "Export as…",
  },

  // Sync panel
  sync: {
    title: "Vault & Sync",
    vaultFolder: "Vault folder",
    syncFolder: "Recognized sync folder",
    conflicts: "Conflicted copies",
    staleBackups: "Stale backups",
    atRest: "At rest",
    generation: "Generation",
    lastWrite: "Last written by this device",
    autoLock: "Auto-lock after",
    idleMinutes: "Idle",
    moveVault: "Move my vault…",
  },

  // Relocation wizard
  relocate: {
    title: "Move your vault",
    explain:
      "Valija does not talk to Dropbox, iCloud, OneDrive or anything else. Choose a folder to move your vault files into.",
    destination: "New vault folder",
    syncFolderHint: "This folder is recognized as a sync service",
    confirmation:
      "Valija will lock your vault before moving it. You'll enter your passphrase again afterwards.",
    moving: "Moving your vault…",
    success: "Vault moved successfully",
    showExport: "Show terminal command",
    exportHint:
      "Copy this line to set the environment variable for terminal access:",
    relocking: "Re-locking your vault…",
  },

  // Connect tools
  connectTools: {
    title: "Connect an AI tool",
    connected: "Connected",
    notConnected: "Not connected",
    connect: "Connect",
    connecting: "Connecting…",
    restart: "Restart {tool} to pick it up",
    configPath: "Config file: {path}",
    backupPath: "Backup created: {path}",
    manualInstructions: "Manual connection instructions",
  },

  // Import
  import: {
    title: "Import your chat history",
    explain:
      "This reads a file you downloaded. Valija never contacts ChatGPT, Claude, or anything else.",
    selectFile: "Choose file",
    format: "File format",
    autoDetect: "Auto-detect",
    conversations: "Conversations",
    target: "Import into",
    targetRequired: "Choose a project",
    newProject: "New project",
    preview: "Preview",
    importing: "Importing…",
    success: "Import complete",
    note: "Imported items are searchable but do not appear in context packs",
  },

  // Diagnostics
  diagnostics: {
    title: "Diagnostics",
    runDiagnostics: "Run diagnostics",
    running: "Running checks…",
    copyReport: "Copy report",
    reportCopied: "Report copied to clipboard",
    checks: {
      node: "Node.js",
      sqlcipher: "SQLCipher",
      keychain: "Keychain",
      vault: "Vault",
      journal: "Journal",
      sync: "Sync",
      lineage: "Lineage",
      autoLock: "Auto-lock",
    },
    keychain_probe:
      "The keychain check writes and immediately deletes a test entry. On macOS this may prompt.",
  },

  // Settings
  settings: {
    title: "Settings",
    appearance: "Appearance",
    theme: "Theme",
    systemTheme: "Follow system",
    lightTheme: "Light",
    darkTheme: "Dark",
    language: "Language",
    systemLanguage: "Follow system",
    vaultSync: "Vault & Sync",
    showDiagnostics: "Run diagnostics",
    moveVault: "Move my vault",
    help: "Help",
    showWelcomeAgain: "Show welcome tour again",
  },

  // Onboarding tour
  onboarding: {
    slideOne: "What is Valija?",
    slideOneText:
      "Valija is an encrypted context vault that lets you save your conversations and documents, then use them with multiple AI tools — Claude, ChatGPT, Cursor, and more. Everything stays on your machine.",
    slideTwo: "Save your context",
    slideTwoText:
      "You save context from inside an AI tool you connect — not from this app. Valija receives it encrypted and stores it locally.",
    slideThree: "Use your context everywhere",
    slideThreeText:
      "Browse your saved conversations, search them, take a pack of the most relevant items, and send it to the AI tool you're using. That's all you can do here.",
    slideFour: "Your privacy, your control",
    slideFourText:
      "Everything is encrypted at rest. Nothing leaves your machine. There is no password reset and the recovery kit is the only other way in.",
    getStarted: "Get started",
  },

  // Errors - will be populated from domain errors
  errors: {
    VAULT_NOT_FOUND: "Vault not found",
    VAULT_ALREADY_EXISTS: "A vault already exists at this location",
    VAULT_UPGRADE_REQUIRED: "Vault needs a security update",
    VAULT_MUST_BE_LOCKED: "Vault must be locked to relocate",
    INVALID_PASSPHRASE: "Invalid passphrase",
    VAULT_FORK_DETECTED: "Vault fork detected",
    RELOCATION_DESTINATION_OCCUPIED: "Destination already contains vault files",
    RELOCATION_DESTINATION_UNUSABLE: "Destination is not a writable directory",
    RELOCATION_DESTINATION_NESTED: "Destination cannot be inside current vault",
    RELOCATION_SOURCE_UNSETTLED:
      "Cannot move vault with unresolved conflicts or stale backups",
    RELOCATION_COPY_FAILED: "Failed to copy vault files",
    RELOCATION_VERIFY_FAILED: "Destination copy verification failed",
    RELOCATION_ROLLBACK_FAILED:
      "Cannot safely complete relocation — manual cleanup may be required",
  },
} as const;

export default en;
