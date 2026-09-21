/* ROUND AK, PASS 2 — the connection LABEL: its offset, its plate, and the
   three safety rails, as PURE functions.

   WHY THIS FILE EXISTS, and why it is React-free and DOM-free. Pass 1 deleted
   the 3-slot `label position` control, so the label had NO way to move at all —
   the owner's report ("the label still cannot be moved") was correct. This pass
   gives it a free 2-D drag; everything a drag WRITES, and everything that
   decides WHERE the label may sit, is in this module, so
   `checks/round-ak2-label.mjs` can run every rule in plain Node instead of
   describing it. No React, no `@xyflow/react`, no DOM type is imported: the one
   import is a TYPE from `./edgeBend`.

   ---------------------------------------------------------------------------
   WHAT IS STORED (and why `labelPinned` exists).

     data.labelOffset?: {x: number; y: number}   relative px, flow units
     data.labelPinned?: boolean                  Sirius Web's `movedByUser`

   While `labelPinned` is falsy the label auto-centres EXACTLY as it did before
   this pass (`labelAnchor` below reproduces the shipped expression operation
   for operation, so no board on disk moves by a pixel and no migration runs).
   Once true, `labelOffset` is added to that anchor. The reference
   implementation studied line by line is Eclipse Sirius Web (MIT),
   `DraggableEdgeLabels.tsx` — including its `{0,0}` click guard and its
   `movedByUser` flag. Its `react-draggable` dependency is deliberately NOT
   taken: the project already owns a pointer gesture (`GoblinEdge.onBendDown`),
   and `useEdgeGesture` in that file is that one gesture, now shared.

   ---------------------------------------------------------------------------
   THE THREE RAILS, and the tool each number comes from.

     AK-14.2  `LABEL_SNAP_PX = 10`      tldraw `labelCenterSnapDistance`, SCREEN
                                        px, applied as `dist <= 10 / zoom` —
                                        the same arithmetic as
                                        `Vec.DistMin(next, def, snap / zoom)`.
     AK-14.3  `LABEL_TO_ARROW_PADDING = 20`  tldraw's own constant
                                        (`default-shape-constants.ts:43-48`).
                                        OURS IS NOT STROKE-SCALED, and the
                                        reason is checkable rather than a
                                        shortcut: tldraw adds a per-stroke term
                                        because its arrowheads are drawn from the
                                        stroke width, while every marker this app
                                        renders is a fixed 14px (`markerFor`) or
                                        a fixed crow's foot (`crowfoot.tsx`), so
                                        there is nothing for such a term to
                                        track.
     AK-10    `lock: 0`                 Sirius Web's `{0,0}` click-vs-drag guard.

   ---------------------------------------------------------------------------
   HONEST LIMITS, recorded here rather than discovered later.

   * The clamp walks the RESOLVED PATH's polyline (`pathPoints`), so it is a
     real distance along the ink, not a distance along the straight chord. It
     measures a `Q` corner only by its endpoints, which is exact for the free
     routes (`freePath`/`straightPath`/`bezierPath` put the label at a vertex)
     and off by at most the corner radius (12px) elsewhere.
   * The clamp is a WRITE-time rail: it guards every point the gesture stores,
     so no new out-of-range state can be created. It deliberately does NOT
     rewrite an offset already sitting in a saved board on load — moving a
     user's stored value without a gesture would be a migration, and this pass
     runs none.
   * `reverseEdgePatch` mirrors the legacy `offset` FRACTION (o → 1−o, tldraw
     and draw.io both keep the label at the same place along the line while the
     ends swap). It does NOT rewrite `labelOffset`: it is relative to the
     resolved anchor, which for an opposite-side pair does not move under a
     swap. Where the generator's own label is asymmetric (`step`/`smoothstep`
     with a split that is not at the endpoints' midpoint) the label can shift by
     that split — the same "you may need to update any labels you had manually
     positioned" limit draw.io records for its own Reverse.
--------------------------------------------------------------------------- */

import type {Pt} from './edgeBend';

/* ===========================================================================
   AK-12 — the label plate: THREE STORED STATES.
   =========================================================================== */
/** D2: `None` is a genuine stored value, not the absence of one. */
export type LabelBg = 'none' | 'surface' | 'outline';
export const LABEL_BG_VALUES: readonly LabelBg[] = ['none', 'surface', 'outline'];
/** The DEFAULT, so a board that never touched the control renders as it did:
 *  `surface` is the plate `.edge-label` has always drawn (`var(--surface)`). */
export const LABEL_BG_DEFAULT: LabelBg = 'surface';

/** Anything unrecognised resolves to the default — the tolerant-parse
 *  convention `inspectorState.ts` and `panelCollapse.ts` already use, so a
 *  hand-edited or future value can never render an unstyled plate. */
export function labelBgOf(v: unknown): LabelBg {
  return v === 'none' || v === 'outline' ? v : 'surface';
}

/** The CLASS the state renders as, NOT an inline SVG `fill`.
 *
 *  This is the trap AK-12 names: React Flow's own `labelBgStyle` is an SVG
 *  `<rect>` API (`BaseEdge` → `EdgeText` → `labelBgStyle`), and this app's
 *  label is a DOM `<div>` through `EdgeLabelRenderer`, so copying that prop
 *  verbatim would be wrong. The mechanism is therefore CSS `background`, and
 *  the class is what carries it. `labelBgOf` is called here too, so an unknown
 *  value can never produce a class the sheet does not declare. */
export function labelBgClass(v: unknown): string {
  return `lb-${labelBgOf(v)}`;
}

/* ===========================================================================
   AK-10 — the anchor, and the free 2-D offset applied to it.
   =========================================================================== */
export type LabelOffset = {x: number; y: number};
/** ROUND AK, AK-10 — WHAT A GESTURE STORES, as one named object.
 *
 *  It is a type rather than two loose returns because it is the PAYLOAD of the
 *  per-edge drag writer (`data.__onLabelDrag`): the renderer computes it (it is
 *  the only side that holds the resolved path, the anchor and the measured
 *  label box) and `App` stores it. One name keeps the two ends of that wire in
 *  step, and it keeps the geometry in ONE place — `App` never has to re-derive
 *  a path it cannot see. */
export type LabelWrite = {labelOffset: LabelOffset; labelPinned: boolean};
/** The legacy 3-slot fraction `data.offset` (its CONTROL was deleted by pass 1;
 *  the VALUE is still read, so a board that carries `start`/`end` renders
 *  exactly as it did). */
export type LabelPos = 'center' | 'start' | 'end';
export const OFFSET_FRACTION: Record<LabelPos, number> = {center: 0.5, start: 0.25, end: 0.75};

/** The label's anchor — and this function is the WHOLE of the parity claim.
 *
 *  The first two statements are the shipped `GoblinEdge.tsx:383-385` expression
 *  reproduced operation for operation (same order, same grouping, same
 *  subtraction of the endpoints' midpoint), so a board with no `labelPinned`
 *  key resolves to the identical number it resolved to before this pass — not
 *  merely a close one. The third statement is the ONLY new term, and it is
 *  reachable only once the user has actually dragged the label. */
export function labelAnchor(p: {
  sourceX: number; sourceY: number; targetX: number; targetY: number;
  labelX: number; labelY: number;
  offset?: LabelPos;
  labelOffset?: LabelOffset;
  labelPinned?: boolean;
}): Pt {
  const f = OFFSET_FRACTION[p.offset ?? 'center'] ?? 0.5;
  const ax = p.sourceX + (p.targetX - p.sourceX) * f + (p.labelX - (p.sourceX + p.targetX) / 2);
  const ay = p.sourceY + (p.targetY - p.sourceY) * f + (p.labelY - (p.sourceY + p.targetY) / 2);
  if (!p.labelPinned || !p.labelOffset) return {x: ax, y: ay};
  return {x: ax + p.labelOffset.x, y: ay + p.labelOffset.y};
}

/* ===========================================================================
   AK-14.2 — snap back to the centre. AK-10 — the click-vs-drag guard.
   =========================================================================== */
/** tldraw's `labelCenterSnapDistance`, in SCREEN px. Pull the label within this
 *  many screen pixels of its default centre and it snaps to exactly centre —
 *  which is the "put it back" gesture with no extra UI, and the reason AK-14.1's
 *  button is a convenience rather than the only way home. */
export const LABEL_SNAP_PX = 10;

/** A screen-pixel threshold expressed in FLOW pixels, which is what a stored
 *  coordinate is: at zoom 2 a 10px screen threshold is 5 flow px. */
export function screenToFlowPx(px: number, zoom: number): number {
  return zoom > 0 ? px / zoom : px;
}

/** AK-10's guard, verbatim from Sirius Web: a gesture whose TOTAL delta is
 *  `{0,0}` is not a drag. `lock` lets the bend handle keep this project's own
 *  3px jitter threshold (`GoblinEdge.LOCK_PX`) through the same predicate, so
 *  the two affordances cannot disagree about what "a drag" is — the label
 *  passes 0 (any non-zero delta), which is exactly Sirius Web's test. */
export function movedBy(dx: number, dy: number, lock = 0): boolean {
  return Math.hypot(dx, dy) > lock;
}

/** The label at exactly its default centre, i.e. the state `labelPinned` false
 *  renders. Written as its own name because "snapped" and "reset" are the same
 *  state and must not be spelled twice. */
export const CENTRED: LabelOffset = {x: 0, y: 0};

/* ===========================================================================
   THE PATH, AS A POLYLINE. AK-14.3 clamps along the INK, not along the chord.
   =========================================================================== */
const NUM = '(-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)';

/** Every vertex of a path string, in order: the `M`/`L` points, and a `Q`
 *  quadratic's END point (its control point is a corner handle, not a place the
 *  ink visits). Consecutive duplicates are dropped, so a generator that emits
 *  `L130 0L130 0` counts once — the same normalisation `round-s-edge-bend.mjs`
 *  applies to the same strings. A non-finite number is skipped rather than
 *  propagated. */
export function pathPoints(d: string): Pt[] {
  const digits = new RegExp(NUM, 'g');
  const cmd = new RegExp(`([MLQ])\\s*((?:${NUM}[ ,]?)+)`, 'g');
  const out: Pt[] = [];
  let m: RegExpExecArray | null;
  while ((m = cmd.exec(d))) {
    const nums = m[2].match(digits) ?? [];
    // one pair per M/L; a Q carries two and its END point is the vertex
    const last = m[1] === 'Q' ? nums.length - 2 : 0;
    const x = Number(nums[last]);
    const y = Number(nums[last + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const prev = out[out.length - 1];
    if (prev && prev.x === x && prev.y === y) continue;
    out.push({x, y});
  }
  return out;
}

/** Total arc length of a polyline. */
export function pathLength(pts: Pt[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return L;
}

/** The point `s` px along the polyline, clamped to its ends. */
export function pointAtLen(pts: Pt[], s: number): Pt {
  if (!pts.length) return {x: 0, y: 0};
  if (pts.length === 1 || s <= 0) return {...pts[0]};
  let left = s;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (left <= seg || i === pts.length - 1) {
      const t = seg > 0 ? Math.max(0, Math.min(1, left / seg)) : 0;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
      };
    }
    left -= seg;
  }
  return {...pts[pts.length - 1]};
}

/** The nearest point ON the polyline to `W`, plus the arc length it sits at,
 *  the perpendicular vector from the line to `W`, and the local heading
 *  (unit vector along the segment it landed on).
 *
 *  The PERPENDICULAR is what survives a clamp unchanged — a label moved off the
 *  line STAYS off it, which is the whole point of a free 2-D drag. The HEADING
 *  is what a support-function projection needs (`labelHalfAlong` below). */
export function nearestOnPath(pts: Pt[], W: Pt): {pt: Pt; len: number; perp: Pt; dir: Pt} {
  if (pts.length < 2) return {pt: {...W}, len: 0, perp: {x: 0, y: 0}, dir: {x: 1, y: 0}};
  let best = {pt: {...pts[0]}, len: 0, perp: {x: 0, y: 0}, dir: {x: 1, y: 0}, dist: Infinity};
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const seg = Math.hypot(dx, dy);
    const t = seg > 0 ? Math.max(0, Math.min(1, ((W.x - a.x) * dx + (W.y - a.y) * dy) / (seg * seg))) : 0;
    const pt = {x: a.x + dx * t, y: a.y + dy * t};
    const dist = Math.hypot(W.x - pt.x, W.y - pt.y);
    if (dist < best.dist) {
      best = {
        pt, len: run + seg * t, perp: {x: W.x - pt.x, y: W.y - pt.y},
        dir: seg > 0 ? {x: dx / seg, y: dy / seg} : {x: 1, y: 0},
        dist,
      };
    }
    run += seg;
  }
  return {pt: best.pt, len: best.len, perp: best.perp, dir: best.dir};
}

/* ===========================================================================
   AK-14.3 — CLAMP. A pure function of the resolved path + marker presence.
   =========================================================================== */

/** tldraw's `LABEL_TO_ARROW_PADDING` (`default-shape-constants.ts:43-48`),
 *  in FLOW px. tldraw scales it per stroke width and canvas scale because its
 *  arrowheads are derived from the stroke width; every marker THIS app paints is
 *  a fixed size (`markerFor` → 14×14, or a crow's foot from `crowfoot.tsx`), so
 *  there is no stroke term for a scaled constant to track. NOT stroke-scaled,
 *  deliberately, and that is the whole of the difference. */
export const LABEL_TO_ARROW_PADDING = 20;

/** The label box's own half-extent ALONG the line, for the clamp's clearances.
 *
 *  A label is a BOX, so what has to clear an arrowhead is the box's EDGE, not
 *  its centre. `halfW`/`halfH` are the box's half-width and half-height in flow
 *  px (measured from the DOM at gesture start, then divided by the zoom, because
 *  the label is counter-scaled and its FLOW size therefore depends on the zoom).
 *  The heading is taken at the nearest point on the path, and the half-extent is
 *  the box's support function along it — `|cos|·hw + |sin|·hh`, the same
 *  projection an AABB uses. A degenerate path falls back to the larger half. */
export function labelHalfAlong(pts: Pt[], W: Pt, halfW: number, halfH: number): number {
  if (pts.length < 2) return Math.max(halfW, halfH);
  const {dir} = nearestOnPath(pts, W);
  return Math.abs(dir.x) * halfW + Math.abs(dir.y) * halfH;
}

/** How far an END claims against the label, in FLOW px: tldraw's
 *  `LABEL_TO_ARROW_PADDING` on an end that carries a glyph, 0 on an end that
 *  carries none — tldraw's own rule
 *  (`hasStartArrowhead || hasStartBinding ? range.start : 0`). */
export function labelClearance(hasGlyph: boolean): number {
  return hasGlyph ? LABEL_TO_ARROW_PADDING : 0;
}

/** Slide `W` back inside the usable range: it may never sit under an arrowhead
 *  and may never run off an end.
 *
 *  `start`/`end` are distances in px from each end of the polyline, and they
 *  already include the label's own half-extent along the line (the caller adds
 *  it), so the LABEL BOX is what clears the glyph rather than the label's
 *  centre. A path shorter than the two clearances put together collapses to its
 *  own midpoint instead of inverting the range. The perpendicular component of
 *  `W` is preserved exactly, so the clamp can only ever move the label ALONG
 *  the line. */
export function clampToRange(W: Pt, pts: Pt[], start: number, end: number): Pt {
  const L = pathLength(pts);
  if (pts.length < 2 || !(L > 0)) return {...W};
  const {len, perp} = nearestOnPath(pts, W);
  const s = start + end >= L ? L / 2 : Math.max(start, Math.min(L - end, len));
  const p = pointAtLen(pts, s);
  return {x: p.x + perp.x, y: p.y + perp.y};
}

/** AK-14.2 as a function: within `LABEL_SNAP_PX` SCREEN px of the centre →
 *  exactly the centre. Screen px are compared by scaling the FLOW distance by
 *  the zoom, which is tldraw's own `DistMin(next, def, snap / zoom)`. */
export function snapToCentre(W: Pt, centre: Pt, zoom: number): Pt {
  const z = zoom > 0 ? zoom : 1;
  return Math.hypot(W.x - centre.x, W.y - centre.y) * z <= LABEL_SNAP_PX ? {...centre} : {...W};
}

/* ===========================================================================
   AK-10/AK-14 — THE ONE FUNCTION A DRAG WRITES THROUGH.
   =========================================================================== */
/** Turn the point a drag is at into the pair `App` stores.
 *
 *  Snap FIRST, clamp second: a point pulled to the centre is already inside the
 *  usable range (the centre is the range's interior for any non-degenerate
 *  path), so the two rails cannot fight, and a snapped gesture stores the
 *  UNPINNED state — which is bit-identical to a board that never carried the
 *  keys at all. That is what makes "snap back to centre" and "reset label
 *  position" the same state rather than two code paths. */
export function labelWrite(p: {
  W: Pt; anchor: Pt; pts: Pt[]; zoom: number;
  /** clearance at each end, label half-extent already included */
  start: number; end: number;
}): LabelWrite {
  const snapped = snapToCentre(p.W, p.anchor, p.zoom);
  if (snapped.x === p.anchor.x && snapped.y === p.anchor.y) {
    return {labelOffset: {...CENTRED}, labelPinned: false};
  }
  const W = clampToRange(snapped, p.pts, p.start, p.end);
  return {labelOffset: {x: W.x - p.anchor.x, y: W.y - p.anchor.y}, labelPinned: true};
}

/* ===========================================================================
   AK-11 — the bend handle may not occupy the label's anchor.
   =========================================================================== */
/** How far, in FLOW px, the handle is moved along the line when a label is
 *  painted at the anchor. 18 = the handle's own half-extent plus its invisible
 *  ring (7 + 9 = 16) plus 2px of daylight: the two affordances cannot share a
 *  point, and the tap rings cannot overlap either.
 *
 *  The caller adds the label's own half-width, because the label's box is
 *  measured from the DOM at runtime and is not a constant. */
export const HANDLE_CLEAR_PX = 18;

/** HOW TALL THE LABEL'S BOX IS, in the units the clamp measures in, as a
 *  FALLBACK for the one render that has not measured yet.
 *
 *  The clamp needs the label box's half-extent on BOTH axes — it is a box's EDGE
 *  that has to clear an arrowhead, not its centre — and `GoblinEdge` measures
 *  both from the DOM at runtime (`getBoundingClientRect` in a layout effect),
 *  because the label's size is whatever the user typed. This constant is only
 *  what `halfH` falls back to on the first render, before that measurement has
 *  run, and it is declared HERE rather than in the component so the box's two
 *  halves are declared in ONE place, beside the label's other measurements.
 *
 *  THE NUMBER, measured rather than guessed. The label renders 11px in the
 *  app's mono stack at `line-height: normal`, with `1px` of padding and a 1px
 *  border top and bottom (`styles.css` `.edge-label`). Measured for the stack's
 *  first concrete family, DejaVu Sans Mono (the shipped Linux fallback,
 *  `/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf`): `unitsPerEm 2048`,
 *  `hhea` ascender 1901 / descender −483 / lineGap 0 → a normal line box of
 *  `1.1641em` = 12.805px at 11px. Plus 2px of border and 2px of padding =
 *  **16.805px**, so the half-height is 8.402px. That is the value written here.
 *
 *  The app does NOT depend on this being exact: `halfH` is replaced by a real
 *  measurement as soon as the label element mounts, and this only bounds the
 *  first frame. It is stated to the third decimal rather than rounded up so the
 *  arithmetic is auditable against the font tables it came from. */
export const LABEL_HALF_H_PX = 16.805 / 2;

/** The point `by` px further along the polyline from `W`, walking toward
 *  whichever END has room for it (the target first, because the path is stored
 *  source → target). A path with no room in either direction returns `W`
 *  unchanged — the handle then sits on the anchor and the label's own hit
 *  region, painted above it, keeps the priority. */
export function nudgeAlongPath(W: Pt, pts: Pt[], by: number): Pt {
  const L = pathLength(pts);
  if (!(by > 0) || pts.length < 2 || !(L > 0)) return {...W};
  const {len} = nearestOnPath(pts, W);
  if (L - len >= by) return pointAtLen(pts, len + by);
  if (len >= by) return pointAtLen(pts, len - by);
  return {...W};
}

/* ===========================================================================
   AK-15 — reverse the line: ends and labels swap, the stored path does not.
   =========================================================================== */
/** `o → 1 - o` on the 3-slot fraction: `start` ↔ `end`, `center` stays. Written
 *  as a MIRROR of the value rather than arithmetic on the fraction, because the
 *  stored value is the word — `OFFSET_FRACTION` is the only place the two
 *  representations meet. An absent value stays absent, so reversing an edge that
 *  never carried one does not add a key to the document. */
export function mirrorOffset(v?: LabelPos): LabelPos | undefined {
  if (v === 'start') return 'end';
  if (v === 'end') return 'start';
  return v === 'center' ? 'center' : undefined;
}

/** The patch that reverses an edge, as draw.io's Arrange → Reverse does it:
 *  "your connector ends and their labels will be swapped, but the path of the
 *  connector will not be changed."
 *
 *  It returns ONLY the keys it owns — `App` merges a patch into the edge's data
 *  (never `replaceData`), so `strokeKey`, `bendX`/`bendY`, `flow` and every
 *  sibling survive by construction rather than by a copy that could drift.
 *
 *  The handles travel with their nodes: `sourceHandle` describes the source
 *  NODE's side, so swapping the ends without swapping the handles would attach
 *  the line to the wrong face of each box. */
export type ReversePatch = {
  source: string; target: string;
  sourceHandle?: string | null; targetHandle?: string | null;
  data?: {offset?: LabelPos};
};

export function reverseEdgePatch(e: {
  source: string; target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: unknown;
}): ReversePatch {
  const d = (e.data ?? {}) as {offset?: LabelPos};
  const out: ReversePatch = {source: e.target, target: e.source};
  if (e.sourceHandle !== undefined || e.targetHandle !== undefined) {
    out.sourceHandle = e.targetHandle ?? null;
    out.targetHandle = e.sourceHandle ?? null;
  }
  const m = mirrorOffset(d.offset);
  if (m) out.data = {offset: m};
  return out;
}
