import {type XYPosition} from '@xyflow/react';

/**
 * F3 — Helper lines (alignment guides), OWN implementation.
 *
 * While a node is dragged we compare 3 horizontal anchors (left edge, horizontal
 * centre, right edge) and 3 vertical anchors (top, vertical middle, bottom) of
 * the dragged node against every other node's same anchors. When two anchors
 * are within SNAP_PX (in flow coordinates, so it works under any zoom+pan), the
 * node snaps onto the target and ONE guide per orientation is emitted.
 *
 * "SHOW WHEN CLOSE" — the proximity gate (harvey, 2026-09-17: the guides "cứ
 * văng lung tung ở top" — flew around at the top). A shared coordinate is NOT
 * enough. A pair must ALSO be close on the axis the guide SPANS:
 *
 *   - a VERTICAL guide spans y, so the two boxes' y-ranges must overlap or be
 *     within PROXIMITY_GAP_PX — i.e. the two nodes are in the same ROW;
 *   - a HORIZONTAL guide spans x, so the x-ranges must overlap or be within
 *     PROXIMITY_GAP_PX — i.e. the two nodes are in the same COLUMN.
 *
 * That is the draw.io/Miro rule: a guide appears between nodes that share a row
 * or a column, not between any two nodes that happen to share a coordinate.
 *
 * Why the gate is on the span axis only: an anchor match within SNAP_PX already
 * forces overlap (or near-overlap) on the ALIGNMENT axis — if `a.right` and
 * `b.left` are 5px apart the ranges touch, and if `a.left` and `b.left` are 5px
 * apart they overlap — so proximity there comes free. The span axis was the
 * missing half, and it is exactly the half that stretched a guide to the top of
 * the viewport. Measured before the change: dragging a node at y = 1000 with
 * another node's left edge coincident at y = -2000 produced a vertical guide
 * with `top = -2000` and a 3060px span, i.e. a rule whose only visible part sat
 * far above the node being dragged.
 *
 * The gate governs the SNAP as well as the guide, from one decision computed on
 * the dragged position — so "did it snap" and "was a guide drawn" can never
 * disagree.
 *
 * The gate is NOT the guide's length limit. The span is always the min/max of
 * the participating nodes, so a genuinely long row still draws one long rule
 * (measured: 662px on the demo board). The gate only decides whether a node
 * counts as a neighbour at all.
 */

export const SNAP_PX = 5;

/** Flow-px gap allowed on the SPAN axis before a node stops counting as a
 *  neighbour. Chosen from a measured distribution, not from taste.
 *
 *  The pairs a user actually drags against are this app's own auto-layout rows
 *  and columns: flowchart LR spaces columns 70/90px (`presets.ts` `spacing`),
 *  flowchart TB spaces rows 24/70px, architecture 24/70px. The WIDEST
 *  legitimate same-row gap measured on the demo board is **180px** (two nodes
 *  227px and 255px wide sharing a top edge in one row) — so a 120px budget
 *  silenced guides on harvey's own board, which is why the value is higher.
 *
 *  320 clears that 180 with ~1.8x headroom and sits ~2x a default node width,
 *  while the spans that caused the reported bug are 1-2 ORDERS of magnitude
 *  larger (2720px and 2940px measured). Re-measure the real board before
 *  changing this: the number is only as good as that distribution. */
export const PROXIMITY_GAP_PX = 320;

export type HelperGuides = {
  /** Vertical guide x (flow coords) with the two y extremes it should span. */
  vertical: {x: number; y1: number; y2: number} | null;
  /** Horizontal guide y (flow coords) with the two x extremes it should span. */
  horizontal: {y: number; x1: number; x2: number} | null;
};

export const NO_GUIDES: HelperGuides = {vertical: null, horizontal: null};

const anchorsX = (x: number, w: number) => [x, x + w / 2, x + w];
const anchorsY = (y: number, h: number) => [y, y + h / 2, y + h];

/** Distance between two 1-D ranges. 0 when they touch or overlap. */
function rangeGap(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.max(a1, b1) - Math.min(a2, b2));
}

/**
 * Compute snap + guides for the dragged node.
 * @param dragged   the node being dragged (current flow position + size)
 * @param others    all other nodes (absolute flow position + size)
 * @returns the snapped position for the dragged node plus the guides to draw
 */
export function computeHelperSnap(
  dragged: {x: number; y: number; w: number; h: number},
  others: {x: number; y: number; w: number; h: number}[],
): {position: XYPosition; guides: HelperGuides} {
  const dX = anchorsX(dragged.x, dragged.w);
  const dY = anchorsY(dragged.y, dragged.h);

  // The proximity gate, decided ONCE from the position the user actually dragged
  // to (not the post-snap one), so the snap and the guides can never disagree.
  // sameRow  -> may snap on x and draw a vertical guide
  // sameCol  -> may snap on y and draw a horizontal guide
  const sameRow: boolean[] = [];
  const sameCol: boolean[] = [];
  for (const o of others) {
    sameRow.push(rangeGap(dragged.y, dragged.y + dragged.h, o.y, o.y + o.h) <= PROXIMITY_GAP_PX);
    sameCol.push(rangeGap(dragged.x, dragged.x + dragged.w, o.x, o.x + o.w) <= PROXIMITY_GAP_PX);
  }

  // ---- snap: nearest anchor pair among the NEARBY nodes only ----
  let dx = 0, dy = 0;
  let bestV = SNAP_PX + 1;
  let bestH = SNAP_PX + 1;

  for (let i = 0; i < others.length; i++) {
    const o = others[i];
    if (sameRow[i]) {
      for (const oVal of anchorsX(o.x, o.w)) {
        for (const dVal of dX) {
          const diff = oVal - dVal;
          if (Math.abs(diff) < Math.abs(bestV)) { bestV = diff; dx = diff; }
        }
      }
    }
    if (sameCol[i]) {
      for (const oVal of anchorsY(o.y, o.h)) {
        for (const dVal of dY) {
          const diff = oVal - dVal;
          if (Math.abs(diff) < Math.abs(bestH)) { bestH = diff; dy = diff; }
        }
      }
    }
  }

  const applyV = Math.abs(bestV) <= SNAP_PX ? dx : 0;
  const applyH = Math.abs(bestH) <= SNAP_PX ? dy : 0;
  const applied = {x: dragged.x + applyV, y: dragged.y + applyH};

  // ---- guides: emitted whenever an anchor pair is within SNAP_PX, INCLUDING a
  // zero offset — an already-aligned neighbour is exactly the case where the user
  // needs to be told "you are aligned". The line sits on the OTHER node's anchor
  // value, and the span is min/max over the dragged node and every nearby node
  // that shares that line, so one rule covers a whole row.
  const vAligned = Math.abs(bestV) <= SNAP_PX;
  const hAligned = Math.abs(bestH) <= SNAP_PX;

  let vertical: HelperGuides['vertical'] = null;
  if (vAligned) {
    const dv = anchorsX(applied.x, dragged.w);
    let lineX = 0;
    let best = SNAP_PX + 1;
    for (let i = 0; i < others.length; i++) {
      if (!sameRow[i]) continue;
      for (const oVal of anchorsX(others[i].x, others[i].w)) {
        for (const d of dv) {
          const d0 = Math.abs(oVal - d);
          if (d0 < best) { best = d0; lineX = oVal; }
        }
      }
    }
    if (best <= SNAP_PX) {
      let y1 = applied.y, y2 = applied.y + dragged.h;
      for (let i = 0; i < others.length; i++) {
        if (!sameRow[i]) continue;
        if (!anchorsX(others[i].x, others[i].w).some(oVal => Math.abs(oVal - lineX) <= 0.5)) continue;
        y1 = Math.min(y1, others[i].y);
        y2 = Math.max(y2, others[i].y + others[i].h);
      }
      vertical = {x: lineX, y1, y2};
    }
  }

  let horizontal: HelperGuides['horizontal'] = null;
  if (hAligned) {
    const dv = anchorsY(applied.y, dragged.h);
    let lineY = 0;
    let best = SNAP_PX + 1;
    for (let i = 0; i < others.length; i++) {
      if (!sameCol[i]) continue;
      for (const oVal of anchorsY(others[i].y, others[i].h)) {
        for (const d of dv) {
          const d0 = Math.abs(oVal - d);
          if (d0 < best) { best = d0; lineY = oVal; }
        }
      }
    }
    if (best <= SNAP_PX) {
      let x1 = applied.x, x2 = applied.x + dragged.w;
      for (let i = 0; i < others.length; i++) {
        if (!sameCol[i]) continue;
        if (!anchorsY(others[i].y, others[i].h).some(oVal => Math.abs(oVal - lineY) <= 0.5)) continue;
        x1 = Math.min(x1, others[i].x);
        x2 = Math.max(x2, others[i].x + others[i].w);
      }
      horizontal = {y: lineY, x1, x2};
    }
  }

  return {position: applied, guides: {vertical, horizontal}};
}
