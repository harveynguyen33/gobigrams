# Gobigrams for Obsidian

Render ` ```gobi ` code blocks as diagrams inside your vault — reading view and live preview,
coloured by the vault's own theme.

**This repository is a release channel, not a codebase.** It contains exactly the three files
Obsidian loads (`manifest.json`, `main.js`, `styles.css`) plus this README. The source lives in
the monorepo: **[harveynguyen33/gobigrams](https://github.com/harveynguyen33/gobigrams)** →
[`apps/obsidian-gobi`](https://github.com/harveynguyen33/gobigrams/tree/develop/apps/obsidian-gobi).
Every release here is built from a commit of that tree; `main.js` carries the core it bundled as
a `gobi-core:<version> <sha>` stamp.

## Install

### With BRAT (recommended, gets updates)

1. Install **[BRAT](https://github.com/TfTHacker/obsidian42-brat)** from Obsidian's community plugin
   store (*Settings → Community plugins → Browse → "BRAT"*), and enable it.
2. Open the command palette → **BRAT: Add a beta plugin for testing**.
3. Paste this repository's URL: `https://github.com/harveynguyen33/gobigrams-obsidian` and confirm.
4. *Settings → Community plugins* → enable **Gobigrams**.
5. Paste a ` ```gobi ` block into any note and switch to reading view.

### By hand

Download `main.js`, `manifest.json` and `styles.css` from the [latest release](../../releases/latest)
and put all three in `<your-vault>/.obsidian/plugins/gobi/`. Restart Obsidian, then enable
**Gobigrams** under *Settings → Community plugins*.

## What it does

- Renders a ` ```gobi ` block into an SVG diagram through the shared `.gobi` core — the same
  compiler, layout engine and renderer the Gobigrams web app uses, so a diagram written in a note
  and one exported from the canvas agree.
- Shows every compile error, styled and with line/column: a broken block never breaks the note.
- Follows your vault: colours are resolved from Obsidian's own CSS variables, and a block
  re-renders when you switch theme.

## What it does not do

- No canvas editing inside Obsidian (no dragging, connecting or resizing).
- No sync back from a diagram to the text — the block is the source of truth.
- No image export from the plugin; use the app or the core package for that.
- No settings: the theme follows the vault.

## Example

````markdown
```gobi
board "Checkout"
direction LR
cf  = external "Cloudflare"
api = service  "Checkout API"  color:red
q   = queue    "payments"
db  = database "orders"
cf -> api "HTTPS"
api -> q  "publish"
q   -> db "persist"
```
````

The language reference, the web app and the CLI are all in the
[monorepo](https://github.com/harveynguyen33/gobigrams). MIT licensed.
