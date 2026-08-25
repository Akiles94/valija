# Valija Desktop

A companion window for [valija](../README.md) — the same encrypted vault, the CLI, and the MCP
server your AI tools already talk to, with a window for the parts a terminal doesn't reach: seeing
what's saved, connecting a tool with one click, and moving your vault into a synced folder safely.

This page is written for someone who has never used a terminal. If you're comfortable with the CLI,
[the main README](../README.md) still covers everything the command line does; this app adds to
that, it doesn't replace it.

---

## Installing

Unsigned builds for macOS, Windows and Linux are attached to each
[GitHub release](https://github.com/akiles94/valija/releases). Each one is published with a SHA-256
checksum below — check it against the file you downloaded before running anything, the same way
you'd check any download from the internet.

| Artifact | SHA-256 |
|---|---|
| `Valija-<version>-arm64.dmg` (macOS, Apple Silicon) | `pending — filled by Slice 13's tagged build` |
| `Valija-<version>-x64.dmg` (macOS, Intel) | `pending — filled by Slice 13's tagged build` |
| `Valija-<version>-Setup.exe` (Windows) | `pending — filled by Slice 13's tagged build` |
| `Valija-<version>.AppImage` (Linux) | `pending — filled by Slice 13's tagged build` |

None of these builds are code-signed — that costs money neither of us has for an unmonetized
project — so your OS will warn you before it lets you open one. Here is exactly what each warning
says and what to click.

### macOS

You'll see: *"Valija can't be opened because Apple cannot check it for malicious software."* This
is Gatekeeper reacting to an unsigned app, not a virus scanner finding something. To open it anyway:

1. Right-click (or Control-click) the app in Finder and choose **Open**.
2. A second, less scary dialog appears with an **Open** button. Click it.

You only do this once per download. If you'd rather use a terminal, the equivalent is:

```
xattr -d com.apple.quarantine /Applications/Valija.app
```

### Windows

You'll see a blue **"Windows protected your PC"** screen from SmartScreen. Click **More info**, then
**Run anyway**. Same reason as macOS: no code-signing certificate, not a detected threat.

### Linux

The `.AppImage` file needs execute permission before it will run:

```
chmod +x Valija-<version>.AppImage
./Valija-<version>.AppImage
```

### Running from source

If you'd rather build it yourself:

```
git clone https://github.com/akiles94/valija.git
cd valija/desktop
npm ci
npx electron-rebuild -f -w better-sqlite3-multiple-ciphers
npm run dev
```

`npm run dev` (`electron-vite dev`) runs the exact same code the packaged builds ship, against the
same `src/` the CLI uses. The `electron-rebuild` step matters and isn't optional: `npm ci` installs
`better-sqlite3-multiple-ciphers` built for your system's own Node.js, not the different Node
version Electron bundles, and the vault won't open without this step — the same rebuild
`npm run package`'s `electron-builder` step already does automatically when producing a packaged
artifact. **This exact sequence could not be run end-to-end while writing this page** — the
environment that wrote it has its network access to `electronjs.org` blocked by policy, which is
what `electron-rebuild` itself needs (`advances/GUI/spike.md` records the failure directly, not
guessed at). The commands are correct, they're just unverified from *this* environment; they match
what a normal developer machine or `desktop.yml`'s own CI environment can run without that
restriction.

---

## First run

The first time you open the app with no vault yet on the machine, it asks a single question:

- **Create a vault** — walks you through choosing a passphrase (twice, so a typo doesn't lock you
  out later) and shows the app's own warning, the same one the CLI shows: *if you lose your
  passphrase **and** your recovery kit, your data is gone — there is no reset.*
- **I already have one** — for a vault that already exists somewhere on this machine, or that you
  point the app at (the same relocation wizard covers "my vault lives in an unusual place," see
  below).

### The recovery kit

Right after creating a vault, the app shows your recovery kit **once** — a page containing your
raw encryption key, meant to be saved somewhere safe and offline (a password manager, a printed
copy in a drawer). You cannot ask the app to show it to you again; if you dismiss it before saving
it, the only way back in is your passphrase. A **Copy key** button puts it on your clipboard so you
can paste it into whatever you're storing it in — the button's own label warns you that other
applications on your machine can read the clipboard while it's there.

This page is intentionally styled differently from the rest of the app (permanently dark,
high-contrast) so it's visually distinct as "the important one," in either language — see
[Language](#language) for why its text stays in English regardless.

---

## The welcome tour

The first time you reach the dashboard (whichever of the two first-run paths you took), a short,
four-slide tour introduces what the vault is for, where saving actually happens (from inside an AI
tool you connect — never from this window), how to browse and search what you've saved, and the
one thing worth repeating: there is no password reset. You can skip it at any point; skipping marks
it as seen, so it won't reappear.

You can watch it again any time from **Settings → Help → Show the welcome tour again** — including
from the locked screen, since Settings doesn't require an unlocked vault.

---

## Unlocking, and vault upgrades

Unlocking works exactly like `valija unlock` — enter your passphrase, or, if you kept only your
recovery key, choose **I only have my recovery key** and enter that instead.

If the app detects your vault's schema is behind the version it expects, it stops and explains what
it's about to do — including that a populated vault gets a ciphertext backup before anything
changes — before you confirm. Nothing is migrated silently; a fresh vault never sees this screen.

---

## Browsing, searching, and taking a pack

Once unlocked, the **Dashboard** lists your projects the same way `valija projects` does. Opening
one shows its items, filterable by type — including items you've imported. **Search** works across
everything. Opening a project's **Context pack** shows exactly what `valija export <project>` would
write to a file — the pack is your saved content, so it is never translated, even in a Spanish
window. **Copy** puts it on your clipboard; **Export…** saves it to a file you choose, as Markdown
or JSON.

---

## Connecting your AI tools

**Connect an AI tool** shows a card per supported client (Claude Code, Claude Desktop, Cursor),
each showing whether it's already connected. **Connect** writes the same config change
`valija install <client>` does — backing up the previous file first — and tells you which client to
restart to pick it up. If a client isn't installed, or its config file isn't valid JSON, the app
explains that in plain language and offers the same manual instructions the CLI's
`manualInstructions()` would print, with a copy button — that block stays in English, since it's a
JSON snippet and file paths meant to be pasted somewhere, not prose meant to be read.

**Your AI tools reach the vault through Node.js**, separately from whether Node is installed for
this app itself — every client's config points at `npx -y valija mcp`, which needs a working
`node`/`npm` on your machine. If the app can't find them, Connect still writes the config (so it's
ready the moment Node is installed) but tells you plainly that the tool won't be able to reach your
vault until then, with a link explaining how to install Node.js.

---

## Importing your chat history

**Import your chat history** reads an export file you've already downloaded from ChatGPT or Claude
— the app explains up front that it never contacts either service itself. Pick the file, preview
what would be imported (nothing is written yet), then import. One thing worth knowing: imported
items are searchable and show up in their project, but they don't appear in context packs — that's
by design (imported history is bulk, unreviewed context; a pack stays made of things you've
actively decided to keep).

---

## Diagnostics — "Check my setup"

Reachable from the dashboard's own **Check my setup** button, or from **Settings → Vault & sync**,
this runs the same checks `valija doctor` does — Node.js, the encryption engine, your OS keychain,
the vault file, your sync folder, and one row per connected AI tool — each with a plain-language
explanation instead of the CLI's short names. Two things it discloses before running: the keychain
check writes and immediately deletes a harmless test entry (on macOS this may prompt you — see
[below](#the-macos-keychain-prompt)), and checking whether your AI tools' own Node.js works runs
`node --version`/`npm --version` on your machine. **Copy report** builds a support artifact for a
GitHub issue; it stays in English in either language, and it's the only place in the app a raw
internal error message may appear (see [Language](#language)).

One thing that can look like a contradiction and isn't: a client the CLI installed with `valija
install` (no explicit folder recorded) shows as **OK, points at the default location** here, while
the **Connect an AI tool** screen calls that same client **not connected** — Diagnostics is
reporting what `doctor` reports (an entry exists), Connect is reporting whether that entry names a
specific vault folder. Both are accurate; they're answering slightly different questions about the
same client.

---

## Sync & safety

The **Sync** panel shows, read-only, where your vault lives, whether the app recognizes that folder
as a synced one, any conflicted copies or leftover backup files a sync client left behind, whether
the vault is safely at rest as a single file, its write history, and your idle auto-lock setting.
There's no "resolve" button for a conflict on purpose — see [the main README's multi-device
section](../README.md#use-it-on-several-devices) for what to actually do about one; this screen
only shows you it's happened.

---

## Moving your vault

**Move my vault…**, reachable from the Sync panel or from Settings, walks you through relocating
your vault folder — typically into a folder a sync client (Dropbox, iCloud Drive, OneDrive,
Syncthing…) already keeps up to date. The wizard is explicit that valija itself never talks to any
of those services: moving your vault folder into one is what makes the *sync client* carry it, the
same as any other file. It locks your vault first, copies both files to the new location, verifies
the copy is byte-identical before touching the original, and only then removes the old copy — if
anything goes wrong partway, the original is left exactly as it was. It also updates the config of
every AI tool you've already connected, so they keep finding your vault at its new location without
you having to redo the Connect step for each one.

**The one consequence worth knowing if you also use the CLI:** this app remembers the new location
in its own preferences file, but a terminal has no way to read that file. After a move, the wizard
shows you a line to run in your shell —

```
export VALIJA_HOME="/the/new/path"
```

— with a copy button, so `valija status` and every other CLI command keep finding the same vault.
Add it to your shell profile if you want it to stick across terminal sessions.

---

## Settings

Reachable by clicking the gear — from the dashboard, any project view, or even the locked screen,
since Settings needs no unlocked vault at all. Four sections, and no fifth:

- **Appearance** — Follow system, Light, or Dark. Changes take effect immediately.
- **Language** — Follow system, English, or Español. Also immediate — no restart, no re-unlock.
- **Vault & sync** — shortcuts to the Diagnostics screen and the relocation wizard above (the same
  screens, not a second copy of them); see the Sync panel for the actual folder path and connection
  details. **These two shortcuts only work while your vault is unlocked** — if you're locked out and
  need to check what's wrong, unlock first, or use `valija doctor` in a terminal in the meantime.
  This is a known limitation, not an oversight, and it's one this app should close in a later pass.
- **Help** — replay the welcome tour, any time, as many times as you like.

**What Settings deliberately is not:** it has no CLI counterpart, and none is planned — everything
here is either a UI preference (appearance, language) or a shortcut to a screen that already exists
elsewhere. It cannot set `VALIJA_HOME`, `VALIJA_STATE_HOME` or `VALIJA_AUTOLOCK_MINUTES` — those stay
environment variables, shown read-only in the Sync panel, because they're configuration a terminal
session controls, and this app is explicit about not quietly overriding that. It offers no way to
destroy, re-key, or re-initialize a vault — this app creates and moves vaults, it never deletes one.

---

## Language

The app follows your OS language on first launch (matching Spanish generally, English otherwise)
and lets you override it from Settings or from the locked screen, live, with no restart. Coverage is
complete — every visible string exists in both catalogs, checked by the test suite — except for a
few places that stay in English on purpose, everywhere in the app:

1. **Your recovery kit's body** — so it reads identically on any machine, in any language, years
   from now. One localized sentence above it explains why.
2. **The manual "add this to your config" snippet** on the Connect screen — it's a JSON block and
   file paths meant to be pasted, not prose meant to be read.
3. **A context pack's contents** — it's your saved content, not app copy; translating it would mean
   rewriting what you actually wrote.
4. **Diagnostics' check details, and its Copy report.** Most check rows show their detail close to
   verbatim to what `valija doctor` already prints in a terminal (on purpose, so a support
   conversation about one matches the other) — a healthy check's detail is a short technical phrase
   like "native module loads," left untranslated. A row that failed with a real internal error *is*
   localized on screen, from its error code; the raw message behind it never shows there. **Copy
   report** is the one exception to that: it's a support artifact built for pasting into a GitHub
   issue, so it stays in English and is the one place a raw internal error message may appear.

**A known, deliberate gap:** these docs, and the rest of `docs/` and `specs/`, are English-only for
now. The in-app experience is fully bilingual; the written documentation isn't yet.

---

## The macOS keychain prompt

The app stores your session key in the same OS keychain the CLI uses, and the Diagnostics screen's
keychain check writes and deletes a harmless test entry the same way. **Exactly what macOS shows you
when it does this — nothing, a one-time prompt, a prompt every time, or a failure — has not yet been
verified on real macOS hardware** as of this writing (`advances/GUI/spike.md` tracks this as an open
item; a CI run on `macos-latest` can't distinguish "prompts" from "fails silently," so this needs a
person at a real Mac). This section will be filled in with the exact wording once that happens —
consider it accurate that *something* keychain-related may happen on macOS, not yet accurate about
precisely what.

---

## Every place this app touches your clipboard

Named individually, since a clipboard write is easy to miss and easy to worry about: the recovery
kit's **Copy key** button, a context pack's **Copy** button, the relocation wizard's `export
VALIJA_HOME=…` line, the Connect screen's manual install snippet, and Diagnostics' **Copy report**.
Every one of them only fires when you click its button — nothing is copied automatically, ever.

---

## What this app deliberately does not do

- **Curate your content** — no organize, pin, edit, tag, or delete anything from this window. Saving
  and shaping context happens from inside the AI tools you connect, through `save_context` and
  friends; this app is a window onto what's already there.
- **Resolve a sync fork** — if two devices wrote independently, the Sync panel tells you it happened
  and points at the guidance in [the main README](../README.md#use-it-on-several-devices); there is
  no merge or "keep this one" button anywhere.
- **Destroy or re-initialize a vault** — covered above, under Settings.
- **Run an MCP server** — the server your AI tools talk to is the same separate process
  `npx -y valija mcp` always was; this app never embeds one, and moving your vault re-points every
  already-connected client's config so that process keeps finding it.
- **Produce a provider-specific artifact** — nothing here talks to ChatGPT's or Claude's API, or any
  network endpoint at all. Import reads a file you already downloaded; nothing is fetched.
- **Configure anything environment-resolved** — `VALIJA_HOME`, `VALIJA_STATE_HOME`, and
  `VALIJA_AUTOLOCK_MINUTES` stay shell environment variables, shown read-only in the Sync panel.
- **Support a third language** — English and Spanish only, for now.

**One environment consequence worth stating plainly:** an app launched by double-clicking its icon
inherits none of your shell's environment variables. If you've set `VALIJA_HOME` in a shell profile,
this app never sees it — it uses the location the relocation wizard remembered instead (or
`~/.valija` if you've never moved anything). The same is true of `VALIJA_STATE_HOME` and
`VALIJA_AUTOLOCK_MINUTES`: if you've overridden either in a shell profile, this app uses their
defaults instead, which — for `VALIJA_STATE_HOME` specifically — means a different device identity
than your terminal sessions use. The Sync panel's device and state-folder display is where you'd
notice this.

---

## Screenshots

Not yet included in this revision. Every screenshot for this page has to come from the published
[golden vault fixture](../src/testing/__fixtures__/golden-vault/README.md) — never a real vault,
key, or recovery kit — and taking one needs a running, packaged build with its native SQLCipher
module rebuilt for Electron, which the environment that wrote this page could not do (its outbound
network access to `electronjs.org` is blocked by policy — see `advances/GUI/spike.md`). This is
recorded as an open item, not a silently dropped one: bilingual screenshots belong here once that
rebuild can run, either in `desktop.yml`'s CI or on a developer machine.
