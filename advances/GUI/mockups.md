# GUI — visual mockups

Companion to `refined.md`, produced after Gate R's decisions were recorded, to validate the
shape of the advance visually before planning. Not itself a spec — where this document and
`refined.md` disagree, `refined.md` governs.

**Canvas:** https://claude.ai/code/artifact/8714ac95-4420-484b-8da0-08b284c5138f (15 screens, one
pan/zoom canvas). The mockups' copy is **English only** — that is a mockup convention, not the
shipped app's behaviour: `refined.md` D-V (2026-08-20) reverses D-N's English-only rider and puts
an English + Spanish UI in scope.

## Structure

Two structural directions were sketched before settling: a three-pane browser (sidebar → item
list → reading pane, like Mail) and a card dashboard (a home screen of project cards, no
persistent sidebar). Oscar picked the **card dashboard** — clicking a project card drills into
that project's item list. This is what `Main.dc.html` and `ProjectView.dc.html` show.

## Screens, in flow order

1. `NoVault.dc.html` — first launch, no vault found (§4.2 step 3)
2. `CreateVault.dc.html` — passphrase entry (§4.2 step 4)
3. `RecoveryKit.dc.html` — shown once (§4.2 step 6). Deliberately its own permanently-dark,
   high-contrast treatment regardless of the app's theme — see D-Q's exception.
4. `Locked.dc.html` — the unlock screen every later launch starts from (§4.3 step 9)
5. `Main.dc.html` — the card-dashboard home (§4.3 step 10)
6. `ProjectView.dc.html` — one project's items (§4.3 step 11)
7. `Search.dc.html` — full-text results (§4.3 step 12)
8. `PackPreview.dc.html` — the rendered context pack, copy/export (§4.3 steps 13-14)
9. `ConnectTools.dc.html` — the `install` guided step (D-P)
10. `MigrationConfirm.dc.html` — the schema-behind confirmation (D-J-b)

Added after Oscar asked for full CLI parity plus sync (see the corresponding `D-n` in
`refined.md` for the decision — the refiner names the exact letter):

11. `Import.dc.html` — the `import` flow: pick an export file, preview and select which
    conversations to bring in, choose a destination project. Modeled on `import-command.ts`'s
    actual options (`--pick`/`--query`/`--since`/`--all`, list-before-import).
12. `Doctor.dc.html` — a friendly translation of `doctorCommand`'s real checks
    (`src/delivery/cli/doctor.ts`): vault/keychain/sqlcipher health, single-file-at-rest, the
    sync-folder detection this same screen's "Sync" section surfaces, and per-client connection
    status. No jargon from the CLI's own check names (`sqlcipher`, `journal`, `lineage`) reaches
    the user-facing copy.
13. `SyncSetup.dc.html` — the new relocation wizard: move the vault into a folder the user's own
    sync client already watches, and remember that new location. This is genuinely new
    capability — nothing in `src/` today lets anything relocate a vault and persist where it
    moved to across relaunches; see `refined.md`'s new decision for what that implies for the
    plan.

Added after Oscar reviewed the mockups a second time — the first two screens in this advance that
answer to **no CLI command at all** (`refined.md` **D-U**, **D-V**):

14. `Onboarding.dc.html` — the skippable four-slide welcome carousel: what valija is · save once,
    use everywhere · browse, search and take a pack · local-first and encrypted. Position dots,
    **Back** / **Next**, **Get started** on the last slide, **Skip** on every slide. Shown once
    automatically (§4.2 step 7'), replayable forever from Settings (§4.8 step 41). **D-U** — and
    note **D-U(c)**: the mockup's slide copy is a sketch, not approved wording. Slide 2 in
    particular must not imply that context is saved *from this app*, and no slide may imply
    curation (pin, edit, organize, delete), which D-A excluded.
15. `Settings.dc.html` — four sections: **Appearance** (theme override, D-Q), **Language**
    (English / Español, D-V), **Vault & sync** (shortcuts to the Diagnostics screen and the
    relocation wizard — second entry points, not second implementations), and **Help** ("Show the
    welcome tour again"). Reachable while the vault is locked. The first screen with no CLI
    command behind it, deliberately so (§4.8, **D-U(d)**).

## Theme (D-Q)

Every screen except `RecoveryKit.dc.html` carries a manual light/dark toggle (a `dark` prop,
defaulting to following the OS setting) so both themes could be reviewed side by side. See D-Q
for the decision and its exception.

## Language (D-V)

The screens are drawn in English. The shipped app is bilingual (English + Spanish), following the
OS language with a manual override in `Settings.dc.html` — the **same** "system by default,
override in Settings" pattern the theme toggle uses, which is why D-V points at D-Q as its
precedent rather than re-deriving the interaction. Nothing in these layouts should assume English
string lengths: Spanish strings are typically longer than their English equivalents, and the
planner should treat them as the sizing case rather than the exception.

## What this is not

Not pixel specs, not a component library, not approved copy, and not a commitment to
Electron-specific implementation details (fonts are Google Fonts for the mockup's convenience; the
real app may embed faces instead per §8.4's no-network-fetch requirement — a rule that now covers
translation catalogs too, §8.5). The planner should treat this as validated direction —
card-dashboard structure, this color/type language, dark mode, the onboarding and settings screens
in scope — not as literal markup to port.
