import type { PluralForm } from "../plural.js";

/**
 * The source-of-truth catalog (D-V(b) Option 1). Namespaced by screen so coverage
 * is reviewable one screen at a time. No value is ever built by concatenating
 * fragments — word order differs between English and Spanish, so every sentence
 * that needs a name or a count is written whole, with placeholders.
 *
 * Four surfaces here are security copy, not chrome, and are reviewed as such
 * (§8.17): the passphrase warning (createVault), the clipboard warning
 * (recoveryKit), the relocation refusals (relocate), and the migration
 * confirmation (migration).
 */
export const en = {
  common: {
    appName: "Valija",
    cancel: "Cancel",
    continueAction: "Continue",
    back: "Back",
    next: "Next",
    skip: "Skip",
    copy: "Copy",
    copied: "Copied",
    tryAgain: "Try again",
    close: "Close",
    settings: "Settings",
    loading: "Loading…",
    connected: "Connected",
    notConnected: "Not connected",
  },

  noVault: {
    title: "No vault on this machine yet.",
    createVault: "Create a vault",
    haveOne: "I already have one",
    haveOneExplainer:
      "Valija looks for a vault at ~/.valija by default. If yours lives somewhere else — for example, inside a synced folder — point the app at it and nothing will move.",
  },

  createVault: {
    title: "Create your vault",
    passphraseLabel: "Passphrase",
    passphraseConfirmLabel: "Confirm passphrase",
    minLengthWarning: "Passphrases must be at least 8 characters.",
    lossWarning: "If you lose it AND the recovery kit, your data is gone. No reset exists.",
    mismatchError: "Those passphrases don't match.",
    deriving: "Creating your encrypted vault (about a second)…",
    submit: "Create vault",
  },

  recoveryKit: {
    title: "Your recovery kit",
    englishNotice:
      "This is written and stored in English on purpose, so it reads identically on any machine, in any language, years from now.",
    copyKey: "Copy key",
    copyKeyWarning: "Other apps on this machine can read the clipboard while it's there.",
    acknowledge: "I have stored this somewhere offline",
    confirm: "Continue",
  },

  onboarding: {
    slide1Title: "This is Valija",
    slide1Body:
      "A local, encrypted vault for the context you use with AI tools — Claude, ChatGPT, Cursor, and anything else that speaks MCP.",
    slide2Title: "Save once, use everywhere",
    slide2Body:
      "Saving happens from inside an AI tool you've connected — not from this window. Connect a tool or import your chat history to get started.",
    slide3Title: "Browse, search, and take it anywhere",
    slide3Body: "Find what you've saved and carry a context pack into any conversation.",
    slide4Title: "Local-first and encrypted",
    slide4Body:
      "Nothing leaves this machine unless you copy it out yourself. There is no password reset — the recovery kit is the only other way in.",
    getStarted: "Get started",
    replayHelp: "Show the welcome tour again",
  },

  locked: {
    title: "Unlock your vault",
    passphraseLabel: "Passphrase",
    unlock: "Unlock",
    useRecoveryKey: "I only have my recovery key",
    recoveryKeyLabel: "Recovery key",
    forkTitle: "This vault was changed somewhere else",
    forkBody:
      "The vault at {vaultPath} was written to by another device without this one's changes. Nothing has been merged or deleted — see the Sync panel for what to do next.",
    goToSync: "Open Sync & safety",
  },

  dashboard: {
    title: "Dashboard",
    emptyTitle: "No context saved yet.",
    connectATool: "Connect an AI tool",
    importHistory: "Import your chat history",
    itemCount: {
      one: "{count} item",
      other: "{count} items",
    } satisfies PluralForm,
    lastActivity: "Last activity {date}",
  },

  project: {
    typeFilterAll: "All types",
    typeFilterImported: "Imported",
    pinned: "Pinned",
    noItems: "No items in this project yet.",
  },

  search: {
    title: "Search",
    placeholder: "Search your vault",
    scopeAllProjects: "All projects",
    resultCount: {
      one: "{count} result",
      other: "{count} results",
    } satisfies PluralForm,
    noResults: "No results.",
  },

  pack: {
    title: "Context pack",
    copy: "Copy",
    export: "Export…",
    exportFormatMarkdown: "Markdown",
    exportFormatJson: "JSON",
    exportedTo: "Saved to {path}",
    notTranslatedNotice:
      "This is your saved content, shown exactly as it will be exported — never translated.",
  },

  connect: {
    title: "Connect your AI tools",
    pointsAt: "Points at {vaultPath}",
    connectButton: "Connect",
    connectedDetail:
      "valija added to {configPath}. A backup of your previous config is at {backupPath}. Restart {client} to pick it up.",
    connectedDetailNoBackup: "valija added to {configPath}. Restart {client} to pick it up.",
    nodeMissingTitle: "Node.js isn't installed on this machine",
    nodeMissingBody:
      "Your AI tools run valija through Node.js, which isn't installed on this machine. Connecting now will write the setting, but the tool won't be able to reach your vault until you install it.",
    nodeMissingDocsLink: "How to install Node.js",
    manualInstructionsIntro: "You can also add this yourself:",
    manualInstructionsCopied: "Copied the manual instructions",
    failureNotInstalled: "{client} doesn't seem to be installed on this machine.",
    failureInvalidConfig: "{client}'s config file isn't valid JSON — it was left untouched.",
  },

  import: {
    title: "Import your chat history",
    explainer:
      "This reads an export file you downloaded from ChatGPT or Claude. Valija never contacts either service.",
    chooseFile: "Choose a file…",
    detectingFormat: "Reading the file…",
    formatOverridePrompt: "We couldn't tell which export this is. Pick the format:",
    conversationCount: {
      one: "{count} conversation found",
      other: "{count} conversations found",
    } satisfies PluralForm,
    filterPlaceholder: "Filter conversations",
    projectLabel: "Import into",
    projectNewOption: "New project…",
    preview: "Preview",
    previewSummary:
      "Would import {itemCount} items from {conversationCount} conversations into '{project}' (skipped {skipped}, failed {failed}).",
    importButton: "Import",
    importSummary:
      "Imported {itemCount} items from {conversationCount} conversations into '{project}'.",
    perConversationFailure: "{title}: {reason}",
    excludedFromPacksNotice:
      "Imported items are searchable and visible in the project, but they don't appear in context packs.",
    busyRetrying: "Another save is in progress — retrying…",
  },

  diagnostics: {
    title: "Check my setup",
    run: "Run checks",
    keychainProbeNotice:
      "The keychain check writes and immediately deletes a test entry in your OS keychain. On macOS this may prompt you.",
    copyReport: "Copy report",
    copyReportNotice:
      "The report stays in English and may include one of Valija's own error messages, for support purposes.",
    appNodeRow: "Node.js (this app)",
    toolNodeRow: "Node.js (your AI tools)",
    fatal: "Problem",
    warning: "Warning",
    ok: "OK",
  },

  sync: {
    title: "Sync & safety",
    vaultFolder: "Vault folder",
    stateHome: "Device state folder",
    looksLikeCloud: "This folder looks like it's synced by another app.",
    notRecognizedAsCloud: "Valija can't tell whether this folder is synced.",
    conflictedCopiesFound: {
      one: "1 conflicted copy found",
      other: "{count} conflicted copies found",
    } satisfies PluralForm,
    staleBackupsFound: {
      one: "1 leftover upgrade backup found",
      other: "{count} leftover upgrade backups found",
    } satisfies PluralForm,
    atRest: "At rest — no pending writes",
    notAtRest: "Not at rest — a write is in progress or was interrupted",
    generation: "Generation {generation}",
    lastWriterThisDevice: "This device wrote it last",
    lastWriterOtherDevice: "Another device wrote it last",
    autoLock: "Auto-locks after {minutes} minutes idle",
    autoLockDisabled: "Auto-lock disabled",
    conflictGuidance:
      "Valija hasn't deleted anything. Both files open with the same passphrase. There is no automatic merge — open each one and decide which to keep.",
    moveVault: "Move my vault…",
  },

  relocate: {
    title: "Move your vault",
    explainer:
      "Valija does not talk to Dropbox, iCloud, OneDrive or anything else. Syncing works by your vault folder living inside a folder your own sync app already keeps up to date. This moves it there, remembers where it went, and updates the AI tools you've connected so they keep finding it.",
    chooseFolder: "Choose a folder…",
    folderRecognizedAsCloud: "This folder looks like it's synced by another app.",
    folderNotRecognized: "Valija can't confirm this folder syncs — you can still use it.",
    clientsToRepoint: "These connected tools will be updated to point at the new folder:",
    clientConfigUnreadable:
      "{client}'s config couldn't be read — you'll get manual instructions for it afterwards.",
    refusalOccupied: "There's already a vault at that location. Choose an empty folder.",
    refusalUnusable: "That folder doesn't exist or isn't writable.",
    refusalNested: "That folder is inside your current vault folder — choose a different one.",
    refusalSourceUnsettled:
      "Resolve the conflicted copy or leftover backup in your current vault folder first.",
    refusalNotAtRest: "Your vault isn't at rest yet — close any other connection and try again.",
    lockNotice:
      "Valija will lock your vault before moving it. You'll enter your passphrase again afterwards.",
    confirmMove: "Move vault",
    moving: "Moving your vault…",
    moveFailed: "The move failed. Your vault is unchanged at its original location.",
    repointSuccess: "{clients} now point at the new folder. Restart them to pick it up.",
    repointFailure: "{client} could not be updated automatically.",
    envLineIntro: "The command line doesn't read this app's settings. Run this in your terminal:",
    envLineCopied: "Copied the command",
    unlockAgain: "Unlock again",
  },

  migration: {
    title: "This vault needs an upgrade",
    body: "Valija needs to upgrade this vault's format before it can open it. A ciphertext backup is made first, so nothing is lost if anything goes wrong.",
    backupNotice: "A backup of the encrypted database will be kept at {backupPath}.",
    cancel: "Not now",
    confirm: "Upgrade and continue",
  },

  settings: {
    title: "Settings",
    appearance: "Appearance",
    appearanceSystem: "Follow system",
    appearanceLight: "Light",
    appearanceDark: "Dark",
    language: "Language",
    languageSystem: "Follow system",
    languageEnglish: "English",
    languageSpanish: "Español",
    vaultAndSync: "Vault & sync",
    openDiagnostics: "Check my setup",
    openRelocate: "Move my vault…",
    help: "Help",
    replayTour: "Show the welcome tour again",
  },

  errors: {
    VAULT_NOT_FOUND: "No vault was found there.",
    VAULT_ALREADY_EXISTS: "A vault already exists there.",
    VAULT_LOCKED: "Your vault is locked. Unlock it and try again.",
    WRONG_PASSPHRASE: "That passphrase doesn't match this vault.",
    WEAK_PASSPHRASE: "Passphrases must be at least 8 characters.",
    KEYCHAIN_ERROR: "Valija couldn't reach your OS keychain.",
    STORAGE_ERROR: "Something went wrong reading or writing the vault files.",
    INVALID_DEVICE_ID: "This device's identity looks corrupted.",
    INVALID_GENERATION: "The vault's write history looks corrupted.",
    INVALID_WRITE_STAMP: "The vault's write history looks corrupted.",
    VAULT_FORK_DETECTED: "This vault was changed on another device without this one's changes.",
    INVALID_PROJECT_NAME: "That project name isn't valid.",
    INVALID_ITEM_TYPE: "That item type isn't valid.",
    INVALID_TAG: "That tag isn't valid.",
    CONTENT_TOO_LARGE: "That content is too large to save.",
    CONTENT_EMPTY: "That content is empty.",
    TOO_MANY_TAGS: "Too many tags on that item.",
    PROJECT_NOT_FOUND: "That project doesn't exist.",
    ITEM_NOT_FOUND: "That item doesn't exist.",
    UNSUPPORTED_SOURCE: "Valija doesn't recognize that export format. Pick the format manually.",
    MALFORMED_EXPORT: "That export file looks corrupted.",
    EMPTY_EXPORT: "That export file has nothing to import.",
    UNREADABLE_FILE: "That file couldn't be read.",
    CORRUPT_ARCHIVE: "That archive looks corrupted.",
    INVALID_SELECTION: "That selection isn't valid.",
    NO_CONVERSATIONS_SELECTED: "Select at least one conversation to import.",
    UNSUPPORTED_GENERIC_VERSION: "That export version isn't supported.",
    // Pre-provisioned for Slice 4 (D-J(b)'s schema-upgrade gate):
    VAULT_UPGRADE_REQUIRED: "This vault needs an upgrade before it can be opened.",
    // Pre-provisioned for Slice 8 (D-R(a)/D-R(b) relocation):
    RELOCATION_DESTINATION_OCCUPIED:
      "There's already a vault at that location. Choose an empty folder.",
    RELOCATION_DESTINATION_UNUSABLE: "That folder doesn't exist or isn't writable.",
    RELOCATION_DESTINATION_NESTED:
      "That folder is inside your current vault folder — choose a different one.",
    RELOCATION_SOURCE_UNSETTLED:
      "Resolve the conflicted copy or leftover backup in your current vault folder first.",
    RELOCATION_COPY_FAILED: "The move failed. Your vault is unchanged at its original location.",
    RELOCATION_VERIFY_FAILED: "The move failed. Your vault is unchanged at its original location.",
    RELOCATION_ROLLBACK_FAILED:
      "Valija couldn't finish undoing a failed move. Both {sourcePath} and {destinationPath} may hold a copy — keep only one.",
    VAULT_MUST_BE_LOCKED: "Lock your vault before moving it.",
    generic: "Something went wrong ({code}).",
  },
};

// Deliberately not `as const`: `typeof en` must describe the catalog's *shape*
// (string / PluralForm leaves) so `es.ts`'s `const es: typeof en = {...}` can
// hold different text at every key while still being checked for the same key
// set. `as const` would freeze every leaf to its literal English value and
// make a real translation a type error.
export type Catalog = typeof en;
