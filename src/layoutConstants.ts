/* ROUND LAYOUT — the auto-layout spacing constant, in its OWN leaf module.
   layout.ts needs it, and the preset slices import layoutDiagram from layout.ts,
   so a constant that lived in boardConstants.ts (which imports the presets
   barrel) would close the cycle boardConstants → presets/index → basic →
   layout → boardConstants at module EVALUATION time: PRESETS would still be
   undefined when boardConstants' seed nodes build (measured — the esbuild-
   bundled checks/package-templates.mjs crashed exactly there). This file
   imports NOTHING, so it can sit at the bottom of any import chain.

   WIDE-LAYER WRAP. A layer whose packed across-extent exceeds this wraps into
   rows inside its layer slot. Measured on the pre-round tree: a 12-way branch
   layer at default spacing packs one row spanning ~3050px, which smears three
   viewports off-canvas. 1600px fits a laptop viewport at 100% zoom with the
   default 190px node and 70px gaps (8 nodes a row); ERD tables are wider but
   fewer per layer. Applies in BOTH directions: the across-extent is the
   layer's packed width in TB (rows of nodes) and its packed height in LR
   (columns). */
/* ROUND LAYOUT's leaf constants module — imports NOTHING, so it can sit at
   the bottom of any import chain. ROUND ROTATE adds the rotation snap step
   here for the same cycle-avoidance reason MAX_LAYER_WIDTH documents. */
export const MAX_LAYER_WIDTH = 1600;

/* ROUND ROTATE — the 15° snap step for Shift-drag and the Alt+R chord
   (15° × 24 = the full circle; matches draw.io's default rotation step).
   Lives in THIS leaf (not boardConstants) because boardConstants imports
   the presets barrel and rotation.ts consumers must not close that cycle —
   the same measured crash layoutConstants.ts's header records. */
export const ROTATE_SNAP_DEG = 15;
