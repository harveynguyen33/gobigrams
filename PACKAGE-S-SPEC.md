# PACKAGE-S-SPEC — Settings: export defaults, autosave control, PNG scale

Base: `5daf3b5` (ROUND AP). Roadmap item "Settings: the remaining panes" (Now, committed).
ERD templates deliberately SKIPPED this round (Harvey, 2026-10-12: "tạm thời skip. tôi làm sau").

## What exists today (recon, measured)

- Canvas pane: Grid size (Segmented), Alignment guides, Reduce motion, Marquee selection — REAL controls.
- Connections pane: 3 real toggles. Appearance: real. About: readout. Shortcuts: readout (correct).
- Autosave: hard-coded ON, debounce 800ms (App.tsx ~1169). No user-facing control.
- PNG export: hard-coded `pixelRatio: 2`, pad 48 (App.tsx ~3686). Menu item title says "(2x)".
- `gridSize` is `useState(16)` — NOT persisted; resets to 16 every reload even though the
  Settings pane offers a choice. (Found during recon; in scope because it makes the
  existing control a lie.)

## S-1 — persist the settings that already exist

New module `src/prefs.ts` — one `loadPref(key, fallback)` / `savePref(key, value)` pair
over localStorage under the `diagram-studio:pref:` prefix, same try/catch-and-ignore shape
as `theme.ts`. Persist on change, lazy-init on mount:

- `gridSize` (16/24/32 — the existing Segmented options)
- `alignGuides`, `animate`, `highlight`, `marqueeMode`

House rule honoured: first visit writes NOTHING until an explicit choice is made
(lazy-init reads, never writes — same as `theme.ts`).

## S-2 — Export defaults (new pane section, Canvas → "Export")

- **PNG scale**: Segmented `1x / 2x / 3x`, default `2x` (today's behaviour unchanged for
  anyone who never opens Settings). Persisted. `exportPng()` reads it; the popover item
  title drops the hard-coded "(2x)" and becomes `Export diagram as PNG` (the scale is a
  setting, not a menu fact).
- **Export padding**: Segmented `24 / 48 / 96`, default `48` (today's value). Persisted.

## S-3 — Autosave (new row, Canvas → "Editing")

- **Autosave**: Toggle, default ON (today's behaviour). Persisted.
- OFF: the debounced effect does not schedule; a "Save" toolbar action becomes the path
  (the existing `flushSave` is already exposed to the board-dialog save flow — reuse it;
  no second save implementation).
- While OFF and dirty, the top-bar board name shows a `·` dirty marker (CSS only, one
  span) so unsaved work is never silent.

## Out of scope (stated)

- "Input device" from the roadmap line: the marquee Touch/Enclose control IS that setting;
  it ships already. Nothing to add.
- Per-board export options, scheduled export, PDF: not on the roadmap.

## Gates

`npx tsc --noEmit` + `npx vite build` = 0 · `goblin-verify` 22/0/5 · hex ratchet 144 ·
new harness `checks/package-s-settings.mjs`: (a) prefs round-trip through the real
localStorage shape, (b) every persisted key lazily reads and never writes on first load,
(c) exportPng consumes the stored scale/pad (source probes), (d) RED-replay on `5daf3b5`,
(e) autosave-off suppresses the debounce scheduling (source probe) and the dirty marker
renders. Demo board byte-identical.
