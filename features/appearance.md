---
feature: appearance
entry_paths:
  - src/ThemePicker.tsx
  - src/colors.ts
  - src/styles.css
  - src/settings/Panes.tsx
  - src/components/ModalMounts.tsx
verified: never-driven (2026-10-12; homes re-pointed 2026-10-25, ROUND BN-4 Phase D)
---
# appearance

Five themes (dark, light, paper, midnight, contrast) plus OS-follow, picked from the
Appearance pane in Settings; every theme is token-driven (zero raw hex outside the token
layer, enforced by the hex ratchet in the round harnesses). Node fills, edge strokes and
label plates can also carry authored colours, including two theme-invariant neutrals
(black/white) and a custom picker.

## Sub-features

- theme cards with mini-sidebar previews; System card previews the live OS theme
- token-only CSS: --surface/--accent/... consumed everywhere; 36px colour cells in a 6-column grid
- authored colours on nodes, edge strokes, table accents; custom colour via native input under a styled trigger
- no-flash boot: the theme script applies the saved theme before first paint

## How to get to it (user POV)

- Open Settings → Appearance; click a theme card to apply it straight away.

## Driving it with harness

Preconditions: dev server running.

**Theme + colour checks.** `checks/round-ag-colors.mjs`, `checks/round-ao-colour-and-nub.mjs`
and `checks/theme-boot-sync.mjs` assert the token values per theme, the boot sync, and the
colour-grid geometry.

## Gotchas

- Zero new hex in component CSS is a hard rule — the harnesses ratchet the count (ceiling 160).
- Theme previews must NOT follow the current pick: the System card previews the OS theme
  via matchMedia, the fixed cards preview their own tokens.


*Module homes (after the BN decomposition)*

- `src/settings/` — the Settings panes: `Panes.tsx` (the five panes incl. Appearance),
  `Controls.tsx`, `shared.ts`, `version.ts`; `src/Settings.tsx` is the 424-line shell
- `src/components/ModalMounts.tsx` — Settings mounts there, fed by App's settingsProps object
