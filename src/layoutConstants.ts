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

/* ROUND GOBI-LAYOUT — the ONE default node size, sourced from the renderer's
   own documented floors (task: the engine's private `?? 190` / `?? 240` /
   `?? 60` / `?? 160` fallbacks disagreed with what nodes actually render at,
   so the engine reserved the wrong room and labels landed on boxes).

   WIDTH — 200, NOT the 190 CSS floor. Two sources agree, both documented:
   `.node { min-width: 190px }` (styles.css, the CSS CONTENT floor) is the
   lower bound, and DiagramNode.tsx derives its resizer floor as
   CSS_CONTENT_MIN_W (190) + 10px slack = 200 because the worst measured
   natural content (`queue` at 199px) is WIDER than the CSS floor. A
   default-sized node therefore renders at 200, and the engine reserving 190
   was a measured 10px under-reservation per cut.

   HEIGHT — 131, DiagramNode's own CONTENT_MIN_H: the worst-case natural
   content height measured across the shapes sharing the resizer (`queue`,
   kicker+title+sub at 131px — see the DiagramNode header). There is no
   vertical CSS floor to derive from (`.node` declares only `min-height:100%`,
   a FILL rule), so the measured worst case IS the honest number. The old
   private `?? 60` was half the real card.

   These are used by BOTH engines in layout.ts (layoutDiagram AND gridLayout)
   as the fallback when a node carries no measured/authored size. */
export const DEFAULT_NODE_W = 200;
export const DEFAULT_NODE_H = 131;

/* ROUND GOBI-LAYOUT — how much clear air a label needs on each side of the
   widest one crossing a cut: half the plate's 12px horizontal padding, plus
   2px of judgement so the plate never kisses a border at the exact-fit
   boundary. Applied per cut as `labelW + 2 * LABEL_PAD`. */
export const EDGE_LABEL_ROOM_PAD = 8;
