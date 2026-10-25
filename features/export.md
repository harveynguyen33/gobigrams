---
feature: export
entry_paths:
  - src/useExportActions.ts
  - src/exportSvg.ts
  - src/exportScene.ts
  - src/exportPng.ts
  - src/printView.ts
  - src/textOutline.ts
  - src/fontFiles.ts
verified: never-driven (created 2026-10-25, ROUND BN-4 Phase D)
---
# export

Real vector export: SVG with selectable `<text>`, PNG raster, PDF via the print route,
JSON round-trip, and Mermaid flowchart import. The pipeline is a LAZY chunk — none of it
loads until the user opens Export / copies a PNG / prints / pastes Mermaid.

## Sub-features

The feature's module homes and their roles:

- `src/useExportActions.ts` — App's call sites: buildSvg/buildPng/printPdf + the Mermaid
  import effect. The dynamic import() thunks LIVE HERE and must stay dynamic
  (round-bn2-hooks asserts zero static export-cluster imports)
- `src/exportSvg.ts` — the SVG emitter (+ the `__ds_export` probe seam)
- `src/exportScene.ts` — scene assembly
- `src/exportPng.ts` / `src/printView.ts` — raster + print routes
- `src/textOutline.ts` / `src/textOutlineHb.ts` — glyph outlining (harfbuzz)
- `src/fontFiles.ts` — font embedding CSS

## How to get to it (user POV)

Reach the feature from the app surface (Export menu, ? sheet → Send feedback, Boards menu / reload).

- The export cluster ships as separate async chunks; the main bundle must not grow when
  this code changes shape.
- Canvas and export must paint the SAME geometry (font parity is measured).

## Driving it with harness

round-ay (png capture/diff, font annex), round-az, round-ar2-export-fidelity, and the
bn2 hooks harness (lazy assertion) cover the family end-to-end through the dev server.

## Gotchas

- See the file links above; every invariant is pinned by the named harnesses.

