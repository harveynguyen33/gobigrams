/* selectionFrame.ts — SEL-CHROME-B (t_edb37ea1, 2026-11-18): the ONE geometry
 * of the multi-selection's frame.
 *
 * WHY THIS MODULE EXISTS. Two painters need the same rectangle: the dashed
 * selection box (SelectionBox, ViewportPortal, flow px) and the shared
 * selection handle (GroupRotateGrip, screen px, centred on the box's top edge).
 * Before this file each computed its own union — SelectionBox over PAINTED card
 * extents, the handle over the unrotated `measured` wrappers — so the handle's
 * "centre of the box" was ~30 flow px off the box it appeared to sit on (the
 * auto-fit overflow), and there was no single place to put the owner's gap.
 * One union definition, consumed by both, is the fix; `checks/round-selbox.mjs`
 * pins that the grip consumes THIS module instead of its own math.
 *
 * BOUNDARY_PAD — the owner's Part 2: "khi bao group có 1 gap nhẹ để tránh các
 * nodes sát đè mép của boundary". The dashed frame used to be drawn exactly on
 * the union of the member extents, so a card's own edge sat ON the line and the
 * line read as cutting the card. The frame is PADDED 12 flow units OUTSIDE the
 * union of PAINTED extents. It is a PAINT inset only: no node geometry, no
 * group container box, and no board field is touched (the round proves
 * boards/ byte-identical). Declared ONCE, here, and nowhere else.
 *
 * FLOW UNITS. Everything here is flow px (the caller divides by zoom through
 * usePaintedCardRects); the pad therefore scales with the canvas like node
 * geometry, never like chrome.
 */
import {rotatedExtent} from './rotation';

/** The gap between a member's painted edge and the dashed frame, in FLOW
 *  units (~12: reads as a gap, not a band, at 100% and at 50%). */
export const BOUNDARY_PAD = 12;

export type Frame = {x: number; y: number; w: number; h: number};
export type PaintRect = {ox: number; oy: number; w: number; h: number};
export type PaintMap = Record<string, PaintRect>;
export type Member = {
  n: {id: string; measured?: {width?: number; height?: number}; data?: unknown};
  ax: number;
  ay: number;
};

/** The GEOMETRY signature: id + absolute position + measured box + rotation.
 *  A live rotate drag changes it every frame, so the union tracks the true
 *  extent; a plain DRAG deliberately does not (positions are excluded from the
 *  painted-rect trigger — the perf contract in usePaintedCardRects). */
export const memberSig = (ms: Member[]): string => ms
  .map(({n, ax, ay}) =>
    `${n.id}:${ax},${ay},${n.measured?.width ?? 190},${n.measured?.height ?? 100},${((n.data as {rotation?: number})?.rotation) ?? 0}`)
  .join('|');

/** The PAINT trigger: what changes a card's painted box — its measured size
 *  and its rotation (a text edit that grows a card re-measures it). */
export const paintSig = (ms: Member[]): string => ms
  .map(({n}) =>
    `${n.id}:${n.measured?.width ?? 190},${n.measured?.height ?? 100},${((n.data as {rotation?: number})?.rotation) ?? 0}`)
  .join('|');

/** The DOM selector for a member set that is NOT necessarily selected (the
 *  quiet in-group boundary: its members are usually unselected). */
export const memberSelector = (sig: string): string => (sig
  ? sig.split('|').map(p => `.react-flow__node[data-id="${p.slice(0, p.indexOf(':'))}"]`).join(',')
  : '.react-flow__node.__none');

/** The union of the members' PAINTED extents (flow units), with the rotated
 *  wrapper box as the fallback for a card that is not in the DOM. */
export function unionFrame(sig: string, painted: PaintMap): Frame | null {
  if (!sig) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const part of sig.split('|')) {
    const at = part.indexOf(':');
    const [x, y, w, h, deg] = part.slice(at + 1).split(',').map(Number);
    const pr = painted[part.slice(0, at)];
    const e = pr ? {x: x + pr.ox, y: y + pr.oy, w: pr.w, h: pr.h} : rotatedExtent(x, y, w, h, deg);
    minX = Math.min(minX, e.x); minY = Math.min(minY, e.y);
    maxX = Math.max(maxX, e.x + e.w); maxY = Math.max(maxY, e.y + e.h);
  }
  return Number.isFinite(minX) ? {x: minX, y: minY, w: maxX - minX, h: maxY - minY} : null;
}

/** Grow a frame by the boundary gap on all four sides. PAINT only. */
export function padFrame(b: Frame | null, pad = BOUNDARY_PAD): Frame | null {
  if (!b) return null;
  return {x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2};
}

/** The padded frame in one call — what both painters draw against. */
export const frameOf = (sig: string, painted: PaintMap, pad = BOUNDARY_PAD): Frame | null =>
  padFrame(unionFrame(sig, painted), pad);
