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
   ROUND AL, AL-2 — THE THREE RAILS ARE GONE, and this file is where they were.

   ROUND AK shipped three rails around the label: `snapToCentre` (tldraw's
   `labelCenterSnapDistance`, 10 screen px), `clampToRange` (tldraw's
   `LABEL_TO_ARROW_PADDING` clearances, walked along the resolved polyline) and
   `lock: 0` (Sirius Web's `{0,0}` click guard). The owner's device test rejected
   all three uses, in his own words:

     "cứ để nó kéo thoải mái đi đâu thì đi. ko cần ràng buộc với xung quanh line.
      Nếu kéo quá xa thì đó là user issue (ngoài ra đã có nút Reset Label Position
      rồi)"

   So the two RAILS are deleted outright — the functions, their constants and the
   inputs that existed only to feed them (`labelClearance`, `labelHalfAlong`,
   `LABEL_TO_ARROW_PADDING`, `LABEL_SNAP_PX`, `screenToFlowPx`, and on the
   renderer side the per-end glyph flags and the two clearances). A label dragged
   far from the line STAYS far; a label parked near the centre STAYS where it was
   put. `Reset label position` is now the ONLY way back, which is what he asked
   for, and — because a centred write is the UNPINNED state rather than a stored
   zero — "reset", "created" and "never moved" remain ONE stored value.

   The third cause of "click once and it jumps" is fixed by CHANGING the lock's
   VALUE, not by removing the guard: the label drag passes a 2.5 SCREEN-px lock
   (`LABEL_DRAG_LOCK_PX` below, divided by the zoom) instead of `0`, so a plain
   click — which always carries a pixel or so of jitter — writes nothing at all.
   `movedBy` keeps its `lock` parameter because the bend handle still passes this
   project's own 3px threshold through the SAME predicate: the two affordances
   must not be able to disagree about what a drag is.

   WHY THE RAILS WERE NOT MERELY DISABLED. A rail left in the file behind a flag
   is a rail the next pass re-enables by habit, and the owner's complaint was
   about the behaviour, not about a setting. The rails are gone, and the harness
   replays them RESTORED so "gone" is a measurement (`checks/round-al-edge-
   panel.mjs`).

   ---------------------------------------------------------------------------
   HONEST LIMITS, recorded here rather than discovered later.

   * `reverseEdgePatch` mirrors the legacy `offset` FRACTION (o → 1−o, tldraw
     and draw.io both keep the label at the same place along the line while the
     ends swap). It does NOT rewrite `labelOffset`: it is relative to the
     resolved anchor, which for an opposite-side pair does not move under a
     swap. Where the generator's own label is asymmetric (`step`/`smoothstep`
     with a split that is not at the endpoints' midpoint) the label can shift by
     that split — the same "you may need to update any labels you had manually
     positioned" limit draw.io records for its own Reverse.
   * With the clamp gone there is no write-time guard at all, so a drag can store
     any offset a pointer can reach, including one that puts the label under an
     arrowhead or off the ink entirely. That is the owner's explicit choice (a
     far-dragged label is "user issue"), and `Reset label position` is the way
     back. `nudgeAlongPath` below still moves the BEND HANDLE off the label, so
     the two affordances cannot overlap even now — that rail protects the HANDLE,
     not the label's position, and is therefore unaffected.
--------------------------------------------------------------------------- */

import type {Pt} from './edgeBend';

/* ===========================================================================
   AK-12 — the label plate: THREE STORED STATES. ROUND AL's AL-3 moved the
   DEFAULT, and that is the whole of the change here.
   =========================================================================== */
/** D2: `None` is a genuine stored value, not the absence of one. */
export type LabelBg = 'none' | 'surface' | 'outline';
export const LABEL_BG_VALUES: readonly LabelBg[] = ['none', 'surface', 'outline'];
/** ROUND AL, AL-3 — THE DEFAULT IS `none`, where ROUND AK had `surface`.
 *
 *  The owner's own words: "By default nên là none". `surface` was the plate
 *  `.edge-label` had always drawn, so a board that never touched the control
 *  renders a plate today; with `none` the same board renders the glyphs with a
 *  CANVAS-COLOURED HALO instead (see `.edge-label.lb-none` in `styles.css`),
 *  which is the look he asked for — "none background nên hoà với màu của nền
 *  canvas".
 *
 *  THE CONSEQUENCE, stated rather than discovered: this CHANGES what every
 *  existing board renders, and his own board stores no `labelBg` at all, so it
 *  is exactly the board that changes. That is the item — the default is the
 *  look the user gets without touching anything, and he rejected the old one.
 *  A board that DID store `surface` keeps its plate, because a stored value is
 *  read before this constant is ever consulted. */
export const LABEL_BG_DEFAULT: LabelBg = 'none';

/** Anything unrecognised resolves to the default — the tolerant-parse
 *  convention `inspectorState.ts` and `panelCollapse.ts` already use, so a
 *  hand-edited or future value can never render an unstyled plate. */
export function labelBgOf(v: unknown): LabelBg {
  return v === 'surface' || v === 'outline' ? v : 'none';
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
   ROUND AL, AL-2 — THE LABEL DRAG'S CLICK LOCK. AK-10's `{0,0}` guard.
   =========================================================================== */
/** How far a pointer must travel before the label drag counts as a drag, in
 *  SCREEN px. 2.5 because that is a real click's own jitter: a press and release
 *  without intent moves the pointer by a pixel or two at most, and ROUND AK's
 *  `lock: 0` (Sirius Web's `{0,0}` test) treated EVERY one of those as a drag —
 *  the gesture then ran `onEnd`, which writes. That was the third cause of the
 *  owner's "click once and it jumps": a plain click on the label stored a
 *  position instead of leaving it alone. 2.5 is under the 3px threshold the bend
 *  handle already uses (`GoblinEdge.LOCK_PX`), so a drag that registers on one
 *  affordance registers on the other.
 *
 *  SCREEN px, not flow px, and that is the point: this is a HAND tremor, and a
 *  hand does not zoom. At 50% a flow-pixel threshold would be four times too
 *  generous and a slow drag would never start. */
export const LABEL_DRAG_LOCK_PX = 2.5;

/** `LABEL_DRAG_LOCK_PX` in FLOW px, which is what a stored coordinate and a
 *  gesture delta are both measured in: at zoom 2 a 2.5px screen threshold is
 *  1.25 flow px. A zoom of 0 (an unmeasured transform) falls back to the
 *  un-scaled value rather than returning Infinity, which would disable the
 *  guard at exactly the moment the geometry is least trustworthy. */
export function labelDragLockPx(zoom: number): number {
  return zoom > 0 ? LABEL_DRAG_LOCK_PX / zoom : LABEL_DRAG_LOCK_PX;
}

/** AK-10's guard, verbatim from Sirius Web: a gesture whose TOTAL delta is
 *  `{0,0}` is not a drag. `lock` lets the bend handle keep this project's own
 *  3px jitter threshold (`GoblinEdge.LOCK_PX`) through the same predicate, so
 *  the two affordances cannot disagree about what "a drag" is.
 *
 *  ROUND AL, AL-2: the label now passes `labelDragLockPx(zoom)` instead of `0`.
 *  The parameter STAYS — a predicate with two callers and one threshold each is
 *  still ONE predicate, which is the invariant ROUND AK put here; AL changes the
 *  value the label supplies, never the test. */
export function movedBy(dx: number, dy: number, lock = 0): boolean {
  return Math.hypot(dx, dy) > lock;
}

/** The label at exactly its default centre, i.e. the state `labelPinned` false
 *  renders. Written as its own name because "snapped" and "reset" are the same
 *  state and must not be spelled twice. */
export const CENTRED: LabelOffset = {x: 0, y: 0};

/* ===========================================================================
   THE PATH, AS A POLYLINE. Now ONE consumer: the handle nudge (AK-11).

   ROUND AK, AK-14.3 also used these to clamp the LABEL along the ink. ROUND AL's
   AL-2 deleted the clamp, so what is left is `nudgeAlongPath` below — the rail
   that keeps the BEND HANDLE off a painted label. The helpers are unchanged; only
   the list of callers is shorter.
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
   ROUND AL, AL-2 — THE CLAMP BLOCK IS DELETED.

   ROUND AK, AK-14.3 lived here: `LABEL_TO_ARROW_PADDING`, `labelHalfAlong`,
   `labelClearance` and `clampToRange`, i.e. the rail that slid a dragged label
   back inside the usable range of the ink. The owner removed the requirement —
   "ko cần ràng buộc với xung quanh line. Nếu kéo quá xa thì đó là user issue" —
   so the four of them are gone TOGETHER: the constant, the two clearance
   functions and the clamp. Removing the clamp alone would have left a measured
   pair of clearances with no consumer, which is how a rail comes back.

   WHAT REPLACED IT: nothing. `labelWrite` below stores the offset it is handed.
   `Reset label position` is the way back, and the `nudgeAlongPath` rail below —
   which positions the BEND HANDLE rather than the label — is untouched, because
   it protects the handle's hit area from the label's, not the label from the
   line.
   =========================================================================== */

/* ===========================================================================
   ROUND AL, AL-2 — THE ONE FUNCTION A DRAG WRITES THROUGH.
   =========================================================================== */
/** Turn the point a drag is at into the pair `App` stores.
 *
 *  WHAT THIS USED TO BE. ROUND AK's version took `{W, anchor, pts, zoom, start,
 *  end}` — the resolved path, the zoom and the two end clearances — and ran
 *  `snapToCentre` first, `clampToRange` second. Both rails are gone (see the
 *  header), so the function is now the plain difference between the dragged point
 *  and the anchor. THAT IS THE WHOLE ITEM: the owner asked for no constraints,
 *  and this is what "no constraints" looks like as a stored value.
 *
 *  THE TWO SHAPES IT CAN RETURN, and why there are still two. A write whose
 *  offset is `{0,0}` is the CENTRED state, and it is returned UNPINNED — the
 *  same value `Reset label position` writes and the same value a board that
 *  never carried either key renders as. Keeping that branch means "reset",
 *  "dragged exactly back to the anchor" and "never moved" are ONE stored value
 *  rather than three that merely look alike, which is a property the round
 *  before this one established and this round must not lose. Every other point
 *  is PINNED with the offset it was handed.
 *
 *  NOTE ON WHAT IS NOT HERE: the zoom. The drag's own threshold is handled by
 *  `labelDragLockPx` at the gesture (it is a screen-space question, not a
 *  storage one); by the time a point reaches this function it has already been
 *  accepted as a real move, so there is nothing left to scale. */
export function labelWrite(p: {W: Pt; anchor: Pt}): LabelWrite {
  const labelOffset = {x: p.W.x - p.anchor.x, y: p.W.y - p.anchor.y};
  if (labelOffset.x === 0 && labelOffset.y === 0) {
    return {labelOffset: {...CENTRED}, labelPinned: false};
  }
  return {labelOffset, labelPinned: true};
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
