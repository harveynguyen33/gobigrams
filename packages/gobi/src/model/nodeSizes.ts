/* GOBI-SIZE (2026-10-31) — the ONE card size, and the FINITE list of kinds whose
   geometry is genuinely different. Imports NOTHING, so it can sit at the bottom
   of any import chain (the same cycle-avoidance reasoning as layoutConstants.ts).

   Harvey, verbatim: "by default khi vẽ thì các shapes nên có shape tương đồng.
   hiện cái to cái nhỏ". A board mixing architecture and flowchart cards showed
   two card sizes side by side, because the architecture palette items carried NO
   `size` at all: a size-less item renders at the `.node { min-width: 190px }`
   CSS floor with auto height (~95) while every flowchart card beside it was
   290x145. "No size" was never a design decision — it was the absence of one.

   WHY 290x145, AND WHY IT MUST NOT BE "TIDIED UP":
     · every silhouette is drawn ONCE in a normalised frame (`viewBox="0 0 200 100"`
       + `preserveAspectRatio="none"`, src/nodes/shapes.tsx), so 290/145 = 2.000 is
       the only ratio at which each shape paints exactly as drawn;
     · 145 clears this app's own resizer floor (NODE_MIN_H = 141) and 290 clears
       NODE_MIN_W = 200. A size BELOW a floor is WORSE than no size: React Flow
       folds `max(0, min - size)` into the perpendicular delta, so a horizontal grip
       drag on a sub-floor node eats its height a few px per drag, all the way to
       zero (measured — checks/round-af-flowchart-sizes.mjs);
     · it is the box the three flowchart templates already seed (48 nodes), so
       making it the ONE card size moves the ARCHITECTURE cards UP to the
       documented geometry instead of shrinking the flowchart ones.
   ROUND AF derived the number; this file is its one home. */
export const CARD_SIZE = {width: 290, height: 145} as const;

/* THE EXCEPTION LIST — one entry per size CLASS whose geometry is genuinely
   different from a card, never a taste. A palette kind that resolves to neither
   CARD_SIZE nor one of these is a FAILURE (checks/round-gobi-size.mjs), not a
   default: an un-sized kind is exactly what produced "cái to cái nhỏ".
   The REASONS live here as comments rather than as object fields — these values
   ship in the app bundle and the byte ratchet has ~200 B of headroom (AGENTS.md),
   so a prose field per row would be paid for by every visitor. */
export const SIZE_EXCEPTIONS = {
  group: {size: {width: 420, height: 200}}, // a CONTAINER: it encloses member cards (290 + 2x40 pad, rounded up)
  note: {size: {width: 180, height: 64}}, // an ANNOTATION, not a card — the same box a free Text caption gets
  label: {size: {width: 180, height: 64}}, // a free-text CAPTION (palette kind 'label'): ROUND R's default box
  table: {size: {width: 250, height: 170}}, // an ERD COLUMN GRID: fits "col_name  type" on one row
  connector: {size: {width: 152, height: 152}}, // an ON-PAGE LINK: a circle needs a SQUARE box (ROUND BE)
  lifeline: {size: {width: 190, height: 380}}, // a UML participant: head + a long column stem
  activation: {size: {width: 30, height: 220}}, // a UML processing BAR: thin, tall, never a card
  fragment: {size: {width: 480, height: 180}}, // a UML FRAME: wide enough to hold messages
};
