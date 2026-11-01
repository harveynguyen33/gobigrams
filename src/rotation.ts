/* ROUND ROTATE — the rotation model + the pure geometry every painter shares.
 *
 * React Flow v12.11.6 has NO native rotation (verified: no `rotation` on
 * NodeBase in the installed @xyflow types), so this round follows the
 * library's own rotatable-node example — a rotate transform on the node —
 * with TWO project invariants the example does not have to care about:
 *
 *   1. CONNECTION POINTS ROTATE WITH THE SHAPE. The four mid-edge handles
 *      are DOM children of the rotated root, so their client rects rotate
 *      with it; React Flow's getHandleBounds then resolves edges at the
 *      rotated sites. `rotatedHandlePositions` is the same math as a PURE
 *      function, so any consumer (export, hit tests, tests) can compute a
 *      handle's rotated site without a DOM.
 *
 *   2. CANVAS AND EXPORT PAINT IDENTICAL GEOMETRY. The exporter emits the
 *      same `rotate(deg, cx, cy)` around the node's own centre as the
 *      canvas root applies (see exportScene/exportSvg), so the exported
 *      bytes carry the rotated frame, text rows and handle-anchored edges.
 *
 * WHERE THE TRANSFORM LIVES: on each node renderer's ROOT div (the inner
 * element React Flow positions), never on the wrapper — NodeWrapper writes
 * `style.transform` itself (translate of positionAbsolute) and would
 * overwrite it, and the CSS `rotate` property composes BEFORE the wrapper's
 * translate, which would orbit the canvas origin instead of the node. The
 * root is exactly `width × height`, so `rotate` about its centre is the
 * fixed-axis rotation the round wants; the wrapper's AABB stays exact and
 * React Flow's selection box / bounds math keeps working.
 *
 * K5 CONFLICT RESOLUTION (actor / note post-it tilt): the old decorative
 * ±1° tilts lived as CSS `transform: rotate(±1deg)` on `.note-node` /
 * `.node.shape-actor` — the SAME property the geometry rotation needs, so
 * the two would fight (last declaration wins). They are folded in: those
 * rules are gone from the sheet and the tilt is now `postitTilt(shape)`
 * added to the geometry angle in the one inline transform. Paint-only and
 * geometry rotation are therefore ONE number per node, not two transforms.
 *
 * This module is React-free and DOM-free on purpose (the checks/round-rotate
 * harness bundles and executes it directly).
 */

import type {Shape as NodeShape} from './nodes/shapes';

/** The node data field. Absent = 0 = unrotated; stored degrees are
 *  normalised to (-180, 180] so the inspector always shows the short way
 *  round and `rotation === undefined` boards render byte-identically. */
export type Rotatable = {rotation?: number};

/** ROUND ROTATE item 2 — the 15° snap step lives in layoutConstants.ts
 *  (the leaf module boardConstants cannot import from without closing the
 *  presets cycle); re-exported here so rotation consumers have ONE import
 *  site. Grepped by checks/round-rotate.mjs (e1). */
export {ROTATE_SNAP_DEG} from './layoutConstants';

/** Normalise any degree value into (-180, 180]. 0 stays 0; -180 -> 180. */
export function norm180(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d === 0 ? 0 : d; /* kill -0 */
}

/** The K5 post-it tilt, in degrees, now data-driven instead of a CSS rule.
 *  actor tilted -1°, note +1° — preserved verbatim so an unrotated board
 *  paints exactly as before the fold-in. */
export function postitTilt(shape: NodeShape | string | undefined): number {
  if (shape === 'actor') return -1;
  if (shape === 'note') return 1;
  return 0;
}

/** The angle a node's root div paints, geometry + post-it tilt combined. */
export function paintRotation(data: Rotatable & {shape?: string}): number {
  return norm180((data.rotation ?? 0) + postitTilt(data.shape));
}

/** The pure point rotation. `(x, y)` is a point in the box's local space
 *  (top-left origin); the box is `w × h`; the result is the point rotated
 *  `deg` degrees CLOCKWISE about the box centre, in the same local space.
 *  (Screen y grows down, so a positive CSS/SVG angle — which is what both
 *  painters use — appears clockwise; the math below is that convention.)
 *
 *  Golden (checks/round-rotate.mjs b3): rotatePoint(100, 0, 100, 50, 90)
 *  -> (100, 50) — the top-right corner becomes the bottom-right corner. */
export function rotatePoint(x: number, y: number, w: number, h: number, deg: number): {x: number; y: number} {
  const a = (norm180(deg) * Math.PI) / 180;
  if (a === 0) return {x, y};
  const cx = w / 2, cy = h / 2;
  const cos = Math.cos(a), sin = Math.sin(a);
  const dx = x - cx, dy = y - cy;
  return {x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos};
}

/** ROUND SELBOX — a node's ROTATED axis-aligned extent: the union of its
 *  four corners rotated `deg` about the box centre, as an AABB in the same
 *  space as `(x, y)`. Exactly the box at 0°; at other angles it can EXCEED
 *  w×h on both axes (a 100×50 box at 45° paints a ~106.07×106.07 footprint).
 *
 *  ONE home, every consumer: the canvas selection box, the group grip's
 *  union and the export bounds (exportScene) all call this — the pre-SELBOX
 *  export path inlined the same |cos|/|sin| arithmetic, and the UI paths
 *  used the unrotated boxes, which is the lag this round kills.
 *
 *  Golden (checks/round-selbox.mjs a2): rotatedExtent(0, 0, 100, 50, 45)
 *  -> w = h = 150/√2 ≈ 106.0660 — NOT 100×50. */
export function rotatedExtent(x: number, y: number, w: number, h: number, deg: number): {
  x: number; y: number; w: number; h: number;
} {
  const a = (norm180(deg) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(a)), sin = Math.abs(Math.sin(a));
  /* the rotated box's half-extent about its own centre (exact: the AABB of a
   * rotated rectangle is (w|cos| + h|sin|) × (w|sin| + h|cos|)) */
  const ex = (w * cos + h * sin) / 2, ey = (w * sin + h * cos) / 2;
  const cx = x + w / 2, cy = y + h / 2;
  return {x: cx - ex, y: cy - ey, w: 2 * ex, h: 2 * ey};
}

/** The four mid-edge handle sites, rotated about the box centre. Keys are
 *  the handle ids DiagramNode / CustomShapeNode render (`left` / `right` /
 *  `top` / `bottom`); each value is the handle CENTRE in the box's local
 *  space. At 0° these are the unrotated midpoints React Flow itself
 *  resolves, so this function is the single definition of "where does this
 *  port sit now" for any consumer without a DOM. */
export function rotatedHandlePositions(w: number, h: number, deg: number): {
  left: {x: number; y: number};
  right: {x: number; y: number};
  top: {x: number; y: number};
  bottom: {x: number; y: number};
} {
  return {
    left: rotatePoint(0, h / 2, w, h, deg),
    right: rotatePoint(w, h / 2, w, h, deg),
    top: rotatePoint(w / 2, 0, w, h, deg),
    bottom: rotatePoint(w / 2, h, w, h, deg),
  };
}

/** The inline transform a rotated node root carries. `null` when there is
 *  nothing to paint (the caller then writes no transform at all). */
export function rotateTransform(deg: number): string | null {
  const d = norm180(deg);
  return d === 0 ? null : `rotate(${d}deg)`;
}

/** The SVG emitter's equivalent: `rotate(deg, cx, cy)` about the node's own
 *  centre in the node group's local coordinates. `null` at 0° so an
 *  unrotated node's export bytes are unchanged. */
export function rotateSvgTransform(deg: number, w: number, h: number): string | null {
  const d = norm180(deg);
  return d === 0 ? null : `rotate(${d} ${w / 2} ${h / 2})`;
}

/** Per-gesture latch for ONE-UNDO rotation (the resizeHistory pattern: the
 *  latch is the decision function's own state, mutated here, owned by the
 *  caller in a useRef). */
export type RotateGuard = {active: boolean};
export const newRotateGuard = (): RotateGuard => ({active: false});

/** Decide whether a rotation gesture frame should push history: TRUE on the
 *  FIRST frame of a gesture, false for every later frame of the same one,
 *  so a whole drag of the grip is exactly ONE undo entry. `end` re-arms. */
export function recordRotateGesture(guard: RotateGuard, frame: {start?: boolean; end?: boolean}): boolean {
  if (frame.start) {
    if (guard.active) return false;
    guard.active = true;
    return true;
  }
  if (frame.end) guard.active = false;
  return false;
}

/** ROTATE — the pure multi-rotate step for a SELECTION. Each member keeps
 *  its own rotation delta (its own `rotation` grows by `deg`) while its
 *  CENTRE is carried around the selection centroid by `deg`. Pure: takes
 *  the members' current boxes, returns the next positions + rotations, so
 *  App writes them in one setNodes (one undo entry for the gesture). */
export function rotateMembersAround(
  members: Array<{id: string; x: number; y: number; w: number; h: number; rotation?: number}>,
  deg: number,
): Array<{id: string; x: number; y: number; rotation: number}> {
  if (!members.length || deg === 0) {
    return members.map(m => ({id: m.id, x: m.x, y: m.y, rotation: norm180(m.rotation ?? 0)}));
  }
  /* the selection centroid: the mean of the member CENTRES (Figma's rule —
   *  stable under the rotation itself, unlike a bounds centre). */
  let cx = 0, cy = 0;
  for (const m of members) { cx += m.x + m.w / 2; cy += m.y + m.h / 2; }
  cx /= members.length; cy /= members.length;
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  return members.map(m => {
    /* rotate the member's CENTRE about the centroid, keep its own box axes
     *  (each member does not spin its box, only its paint rotation grows) */
    const px = m.x + m.w / 2 - cx, py = m.y + m.h / 2 - cy;
    const nx = cx + px * cos - py * sin - m.w / 2;
    const ny = cy + px * sin + py * cos - m.h / 2;
    return {id: m.id, x: nx, y: ny, rotation: norm180((m.rotation ?? 0) + deg)};
  });
}

/** Snap a live drag angle to the 15° step when Shift is held (free below). */
export function snapRotation(deg: number, snap: boolean, step: number): number {
  if (!snap) return deg;
  return norm180(Math.round(deg / step) * step);
}

/* ROTATE-FIX — THE GRIP GESTURE AS PURE MATH.
 *
 * The pre-fix grip computed its start bearing inside an object literal that was
 * evaluated BEFORE it was assigned:
 *     live.current = {startAngle: bearing(x, y), moved: false, ...c}
 * so `bearing()` read the PREVIOUS live.current — cx/cy = 0 on the first
 * gesture — and the grab angle was measured around the CANVAS ORIGIN while
 * every later frame was measured around the node centre. That one ordering bug
 * is both reported symptoms: a tiny drag jumped by a chunk and the content
 * flipped ~180-360°. Taking the centre as an ARGUMENT makes the ordering
 * impossible to get wrong, and makes the whole gesture a golden. */

/** Gesture anchor: the node CENTRE (flow space) + the pointer's bearing at grab. */
export type RotateBegin = {cx: number; cy: number; bearing: number};

/** The pointer's bearing around `(cx, cy)`, in degrees (atan2 convention:
 *  0° = east, 90° = south — screen y grows down, the CSS/SVG sense). */
export function bearingTo(cx: number, cy: number, px: number, py: number): number {
  return (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
}

/** Anchor a grip gesture: the CENTRE first (an argument, never a stored
 *  field), then the grab bearing. */
export function beginRotate(cx: number, cy: number, px: number, py: number): RotateBegin {
  return {cx, cy, bearing: bearingTo(cx, cy, px, py)};
}

/** The TOTAL angle from the grab point to `(px, py)`, wrapped the SHORT way —
 *  a move across the ±180° seam is a small delta, never ∓180. */
export function rotateDelta(b: RotateBegin, px: number, py: number): number {
  return norm180(bearingTo(b.cx, b.cy, px, py) - b.bearing);
}
