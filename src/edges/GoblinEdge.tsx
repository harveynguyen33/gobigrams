import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  BaseEdge, EdgeLabelRenderer,
  getBezierPath, getSmoothStepPath, getStraightPath,
  useStore,
  useStoreApi,
  MarkerType,
  type EdgeProps,
  type EdgeMarkerType,
} from '@xyflow/react';
import {COLOR_VAR, type ColorKey} from '../colors';
import {
  // ROUND T — the midpoint drag. A STORED waypoint routes through our own path
  // for the edge's own kind (they all read both coordinates); no waypoint routes
  // through the generator unchanged. That is `needsCustom` exactly, so the
  // renderer and `App`'s condition cannot disagree, and an untouched board
  // cannot move by a pixel. `bendDraggable4` is now only the HANDLE's gate, and
  // only for the orthogonal kinds.
  // ROUND U — `bezierPath`/`straightPath` are the free kinds' own routes, and
  // `isFreeBendKind`/`bendAxisFor` are the ONE axis decision shared with `App`:
  // `'free'` on those kinds (no lock, both keys written), draw.io's pointer rule
  // on `step`/`smoothstep` (unchanged).
  bendDraggable4, bendAxisFor, drawnMid, freePath, isFreeBendKind, needsCustom,
  bezierPath, straightPath,
  type BendAxis, type BendGeo, type BendPhase, type Pt, type Side4,
} from '../edgeBend';
/* ROUND AK, PASS 2 — the label's own rules, all pure, all executed by the
   harness: the anchor + its 2-D offset (AK-10), the three plate states (AK-12)
   and the reverse mirror (AK-15). ROUND AL's AL-2 deleted the rails that the
   import list used to carry (`labelClearance`, `labelHalfAlong`), and added
   `labelDragLockPx` in their place — the drag's own screen-px click lock. */
import {
  HANDLE_CLEAR_PX, LABEL_HALF_H_PX, anchorWrite, labelAnchor, labelBgClass,
  CENTRED, labelDragLockPx, movedBy, nudgeAlongPath, pathPoints,
  type LabelWrite,
} from '../edgeLabel';
/* ROUND AK, PASS 2 — ONE gesture for both affordances on this edge. See the
   file: it is the machinery `onBendDown` already owned (ROUND S/T/U), factored
   out so the bend handle and the label can never both start from one
   pointerdown. `GestureDown` is the shape a `claim`ed handler receives. */
import {beginGesture, useEdgeGesture, type GestureDown} from '../useEdgeGesture';
/* ROUND AM, AM-2 — the label's TEXT STYLE, through the ONE emitter. `TextStyle`
   is the stored shape (`data.labelStyle`) and `edgeTextStyleVars` is the
   edge-label subset of `textStyleVars` — the same module the node path uses, so
   the label's Text section cannot become a second text vocabulary. */
import {edgeTextStyleVars, type TextStyle} from '../textStyle';

/* ROUND AM, AM-3 — THE GLYPHS MOVED OUT, AND THIS FILE IS THE REASON. The six
   paths lived here, which meant the inspector could not show what the edge
   animates; AL-6's comment that the panel "reuses FLOW_ICON_PATHS' own
   vocabulary" was a promise this module boundary could not keep. They now live
   in `src/flowIcons.tsx` — React-Flow-free, so the panel can read it — and
   BOTH the renderer (here, below) and `App.tsx` read THAT file. The path data
   is untouched: only its address changed. */
import {FLOW_ICON_PATHS} from '../flowIcons';
import type {EdgeData} from './EdgeData';
import {useFlowPayloads} from './flowPayloads';

/**
 * ROUND T — how far the pointer must travel before the drag's axis is locked.
 * Small enough that the lock happens on the first real movement of a human
 * gesture, large enough that the jitter of a click does not choose an axis.
 */
const LOCK_PX = 3;

/* ===========================================================================
   ROUND AL, AL-1 — THE SELECTION COLOUR AND THE CORE'S WIDTH.

   `SEL_STROKE` is the TOKEN, not a value: `var(--sel)` is exactly what the
   deleted `!important` restroke painted, so the selected edge reads as it did
   before ROUND AK and a theme change repaints it for free. It is a constant
   rather than an inline literal because both the sheet's own note and this
   file's comment name the same token, and one spelling of it is one thing to
   keep in step.

   `SEL_CORE_PX` is the AUTHORED colour's line, drawn on top of the selection
   body. 1.1px is a HAIRLINE against every body the app can draw — the width
   ladder is 1 / 1.5 / 1.8 / 2 / 3 (`WIDTH_OPTS`), so the thinnest body is still
   ~1.4x the core and the core reads as a core rather than as a second line.
   Deliberately NOT a function of `strokeWidth`: a proportional core would
   vanish on the 1px body, and the point of it is that the colour is legible in
   every case. */
const SEL_STROKE = 'var(--sel)';
const SEL_CORE_PX = 1.1;

/**
 * Editable edge. Renders the built-in React Flow path generators, so switching
 * `type` between goblinEdge / smoothstep / step / straight never loses styling.
 * Double-clicking the label opens an inline input (Enter commits, Esc cancels).
 */
const GoblinEdge = memo((props: EdgeProps) => {
  const {
    id, sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition, label, selected, data,
  } = props;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);
  /** ROUND S — the pane this edge is drawn in: the drag converts pointer
   *  positions against its rect, and the element is found from the handle
   *  itself rather than from a prop, because an edge component is rendered by
   *  React Flow and is handed no viewport reference. ROUND AK: its rect is what
   *  `useEdgeGesture.beginGesture` converts against, for BOTH affordances. */
  const paneRef = useRef<HTMLDivElement | null>(null);
  /** ROUND AK, AK-11 — the LABEL element itself. Its measured box is what the
   *  clamp clears an arrowhead with (the box's edge must clear, not its centre)
   *  and what the bend handle is moved away from, so the two affordances cannot
   *  share a point. Measured, never estimated: `getBoundingClientRect` in a
   *  layout effect, divided by the zoom. */
  const labelBox = useRef<HTMLDivElement | null>(null);
  /** The measured HALF-WIDTH of the label, in SCREEN px — the handle-nudge's
   *  input, and (since ROUND AL's AL-2 deleted the clamp) its ONLY consumer.
   *  Measured from the element rather than from the string, because the width is
   *  whatever the user typed.
   *
   *  THE HALF-HEIGHT IS GONE WITH THE CLAMP. ROUND AK measured both, because the
   *  clamp needed the box's extent along the path's HEADING (`|cos|·hw +
   *  |sin|·hh`) and a label can be tall. The nudge moves the handle ALONG the
   *  line, so only the extent along the line matters and only the width is read;
   *  a state variable nothing reads would cost a re-render for nothing.
   *  `LABEL_HALF_H_PX` — the first frame's stand-in — is no longer imported for
   *  the same reason. */
  const [labelHalfW, setLabelHalfW] = useState(0);
  /** The live `[x, y, zoom]` — the same store value React Flow's own
   *  `screenToFlowPosition` reads, and the same one the label's counter-scale
   *  below needs. Subscribing here re-renders on pan/zoom only, exactly like
   *  every other edge on the canvas. */
  const t = useStore(s => s.transform);
  /* AUDIT-6 — the LIVE transform for in-flight gestures: `t` above is the value
     at render time; a zoom that lands mid-gesture updates the store and this
     getter reads it fresh on every move (see beginGesture's transform getter). */
  const storeApi = useStoreApi();
  /** ROUND AK, AK-10 — THE one gesture this edge can run. Both affordances claim
   *  it, so one pointerdown can never start the bend and the label drag at once
   *  (AK-11's first requirement). It is the machinery `onBendDown` already owned,
   *  moved to `src/useEdgeGesture.ts` unchanged in behaviour. */
  const gestures = useEdgeGesture();
  /** The label's own cursor. `grabbing` once the gesture has passed its
   *  threshold, exactly as the bend handle does — and NO hover state is
   *  involved: this is set by the gesture, so it works on touch. */
  const [labelCursor, setLabelCursor] = useState<'grab' | 'grabbing'>('grab');
  /** ROUND AM, AM-1 — THE LIVE ANCHOR: the AUTO-CENTRE anchor (the label's
   *  position with NO offset applied) that this component resolved on the last
   *  COMMITTED render.
   *
   *  WHY IT IS A REF AND NOT THE CLOSURE'S VALUE. `onLabelDown` closes over the
   *  render that CREATED it, and React Flow's controlled flow means `.edge-label`
   *  does not re-render between a pointermove and the write that pointermove
   *  triggers — so a value captured in the closure is one render behind for
   *  everything except the very first write of a gesture. A ref is read at the
   *  moment of the write, so it carries the anchor of the last committed render
   *  instead, which is the frame the write has to be stated in.
   *
   *  IT IS THE ANCHOR, NOT THE PAINTED POSITION (`L` when the label is pinned).
   *  The two differ by the stored offset, and the write's arithmetic is stated in
   *  the offset's own frame — using the painted point would fold the offset into
   *  the base and count it twice (AM1-b in the round's harness measures exactly
   *  that mistake). The painted `L` keeps its single job: the transform below.
   *
   *  DECLARED BY AN EFFECT, not during render: the value has to belong to the
   *  render that COMMITTED — the same one a handler closure would come from —
   *  or the ref would describe a render the user never saw. No dependency array:
   *  the anchor follows the geometry, the zoom and the stored offset. */
  const anchorRef = useRef<Pt | null>(null);

  const d = (data ?? {}) as EdgeData;

  /** FB-L: one reader for the mode, used by both editor entry points. */
  const ro = !!d.readOnly;
  /** The label's TEXT as rendered — the ONE reader every branch below uses, so
   *  "is there a label?" is asked in exactly one place. Declared up here (rather
   *  than beside the JSX) because the measured box and the handle's own position
   *  both depend on it. */
  const shown = typeof label === 'string' ? label : '';
  /** Is a label PAINTED on this edge? The same three-way test the render gate at
   *  the bottom uses — text, an open editor, or the C4 `technology` second line —
   *  spelled once so the handle's clearance and the gate cannot disagree. */
  const hasLabel = !!(shown || editing || d.techn);

  // F2: "Edit label" in the edge context menu pokes __edit — open the editor.
  const editSignal = d.__edit;
  useEffect(() => {
    // FB-L: defence in depth. The context menu that pokes this signal is
    // already inert in review mode, but the editor must be unreachable from
    // EVERY entry point. `ro` is deliberately NOT a dependency of this effect:
    // the signal is a persistent timestamp, so a mode change re-running the
    // effect would pop the editor open the moment review mode is left.
    if (!editSignal || ro) return;
    setDraft(typeof label === 'string' ? label : '');
    setEditing(true);
  }, [editSignal]); // eslint-disable-line react-hooks/exhaustive-deps
  const pathOpts = {sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition};

  // The registered type id selects the path generator, so all four conventional
  // edge types render through this one editable component.
  const kind = (data as any)?.__type ?? d.shape;
  let path = '';
  let labelX = (sourceX + targetX) / 2;
  let labelY = (sourceY + targetY) / 2;

  /* ROUND S — the geometry this edge was handed, in the shape `edgeBend` models.
     `sourcePosition`/`targetPosition` ARE the `Side4` values (React Flow hands
     the edge the `Position` of each end), so no lookup is needed.

     ROUND U — BUILT FOR EVERY KIND, not just the orthogonal two: a bezier or a
     straight edge has the same two anchors and the same two handle sides, so the
     geometry is exactly as meaningful there, and `bendActive` below needs it to
     offer a handle. It is no longer the `step`-only key that made `bGeo` null. */
  const bGeo: BendGeo = {
    s: {x: sourceX, y: sourceY}, t: {x: targetX, y: targetY},
    sp: sourcePosition as Side4, tp: targetPosition as Side4,
  };
  /* The gate — is a midpoint handle offered on this geometry at all? ROUND T:
     every OPPOSITE-side pair, and nothing else. There is no per-geometry axis
     any more: the drag is 2-D everywhere and the axis is decided per gesture
     from the POINTER (see `onBendDown`/`edgeBend.bendAxisFor`).

     ROUND U — EVERY KIND THIS COMPONENT RENDERS OFFERS ONE. `bendDraggable4` is
     about the orthogonal split (it rejects a same-side pair, where a waypoint
     would read as a second elbow); `bezier`/`straight` have no split at all, so
     consulting it there would be meaningless — they are always draggable. The
     `selected && !ro` gate below still applies to all four kinds. */
  const bendActive = useMemo(
    () => (isFreeBendKind(kind) ? true : bendDraggable4(bGeo)),
    [kind, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition],
  );
  /** ROUND T — the cursor the handle shows, which is draw.io's own feedback for
   *  a locked axis and the detail that makes the lock readable rather than
   *  mysterious: `col-resize` while dragging horizontally, `row-resize`
   *  vertically, `grab` at rest, `grabbing` for the first pixels before the axis
   *  is decided.
   *
   *  ROUND U — on the FREE kinds (`bezier`/`straight`) there is NO axis to
   *  advertise, so the cursor stays `grabbing` for the whole gesture there (see
   *  the lock below). Showing `col-resize`/`row-resize` would be a lie: both
   *  coordinates move, always. */
  const [dragCursor, setDragCursor] = useState<'grab' | 'grabbing' | 'col-resize' | 'row-resize'>('grab');
  /** The axis of the gesture in flight: decided ONCE, on the first move whose
   *  delta passes the lock threshold, and held to the end — a per-move decision
   *  would flicker and make the line judder. A ref, not state: it is read inside
   *  the pointermove closure and must not re-render on every move.
   *
   *  ROUND U — this is ONLY a "has the gesture started moving" latch now, and it
   *  holds `'free'` on the free kinds. No projection is decided here: the AXIS
   *  ITSELF is re-derived per move by `bendAxisFor` at the one place that needs
   *  it (the writer in `App`), so what is written is decided once, there. */
  const lockAxis = useRef<BendAxis | null>(null);
  /** The drag is offered only on an edge whose bend reaches the path, and never
   *  in review mode — the handle is an editing affordance (FB-L).
   *
   *  AND ONLY ON THE SELECTED EDGE. This is draw.io's and Excalidraw's own
   *  entry rule ("click the line, handles appear"), and it is a deliberate
   *  ORCHESTRATOR correction of the first implementation, which offered a
   *  fully-opaque handle on every step/smoothstep edge at once. Measured
   *  consequence of that: a two-orange-dot board at rest, each dot sitting
   *  exactly ON its edge's label — the handle is painted at the path's
   *  `labelX`/`labelY`, which IS the label's anchor — so the resting canvas
   *  gained a dot over every label before the user had clicked anything.
   *
   *  `selected` is React Flow's own per-edge selection flag, so this adds no
   *  new state: the click that selects the edge is also the click that reveals
   *  the handle, in one gesture and with no second source of truth. */
  const bendDraggable = bendActive && !ro && !!selected;
  /** The point the edge is DRAWN through right now: the stored coordinate per
   *  axis, the legacy step-position fraction an old board may still carry, and
   *  the generator's own 0.5 midpoint otherwise. */
  const W: Pt = drawnMid(bGeo, d.bendX, d.bendY, d.bend);
  /** ROUND T — does this edge route through OUR path or the generator's? The
   *  SAME condition `App` uses, and the one the drag is gated on: a stored bend
   *  key means our own route, nothing stored means the generator untouched.
   *  ROUND U: unchanged, and it is what gives the new kinds their parity for
   *  free — it looks at the KEYS only, so an untouched bezier/straight edge
   *  never leaves the generator. */
  const custom = needsCustom(bGeo, d.bendX, d.bendY);

  // STEP 1: the legacy step fraction is passed THROUGH, never defaulted here.
  // `getSmoothStepPath`'s own signature defaults `stepPosition = 0.5`
  // (@xyflow/system index.js:1411), and it reads the value only inside the
  // opposite-handle branch (:1263). An edge with no stored `bend` therefore
  // hands over `undefined`, the generator substitutes 0.5, and every existing
  // board's path is unchanged — which is the whole reason this is passed as
  // `undefined` rather than an explicit 0.5.
  const stepPosition = d.bend;
  /* ROUND T — HOW THE TWO ROUTES ARE KEPT APART, because they must not disagree:

     NO stored bend key → the GENERATOR, with `stepPosition` exactly as before,
     so a board that has never been dragged renders byte-identical (harness (a)).
     A key exists only once the user has dragged, and from then on the path goes
     through `freePath` — which uses BOTH coordinates, and returns the waypoint
     itself as the label, so the handle painted on that label is ON the line by
     construction.

     The gate is `custom`, NOT the handle's gate (`bendActive`): a board from an
     older pass may carry a stored key on a geometry that would not offer a
     handle today (the gate used to be narrower), and such a key must still be
     drawn by the same route the drag writes.

     ROUND U — ONE ROUTE PER KIND, all four, chosen by `custom` alone. A kind
     SWITCH with a point stored therefore keeps honouring the point (each kind's
     own route reads `W`), and an untouched edge of any kind still calls its
     generator verbatim — that is the whole of the parity claim. */
  try {
    if (kind === 'straight') {
      if (custom) {
        [path, labelX, labelY] = straightPath(bGeo, W);
      } else {
        [path, labelX, labelY] = getStraightPath(pathOpts);
      }
    } else if (kind === 'step') {
      if (custom) {
        [path, labelX, labelY] = freePath(bGeo, W, 0);
      } else {
        [path, labelX, labelY] = getSmoothStepPath({...pathOpts, borderRadius: 0, stepPosition});
      }
    } else if (kind === 'smoothstep') {
      if (custom) {
        [path, labelX, labelY] = freePath(bGeo, W, 12);
      } else {
        [path, labelX, labelY] = getSmoothStepPath({...pathOpts, borderRadius: 12, stepPosition});
      }
    } else {
      // bezier / goblinEdge / custom — the free curved kind.
      if (custom) {
        [path, labelX, labelY] = bezierPath(bGeo, W);
      } else {
        [path, labelX, labelY] = getBezierPath(pathOpts);
      }
    }
  } catch {
    [path, labelX, labelY] = getStraightPath(pathOpts);
  }

  // The handle's own position: computed below, once the label's own geometry
  // (its painted state, the resolved path and the measured box) is available.

  /** ROUND AM, AM-1 — THE AUTO-CENTRE ANCHOR of this render, and the ref that
   *  publishes it to the gesture. This is the point a stored `labelOffset` is
   *  measured AGAINST — `labelAnchor` with no offset applied, i.e. the label's
   *  own centre — and it is deliberately NOT `L` below: `L` is the PAINTED
   *  position and differs from this by the stored offset.
   *
   *  WHAT IT IS FOR. It is the anchor the write REPORTS (`anchorWrite`'s
   *  `labelAnchor`), so `App` can rebase a stored offset when the geometry moves
   *  — a node dragged between two gestures, or the edge re-routed — and keep the
   *  label where the user's eye put it. The write's own arithmetic does not need
   *  it (the anchor cancels out of a pointer delta, which is why a stale one
   *  cannot corrupt the drag); it is the REPORT that matters.
   *
   *  PUBLISHED BY AN EFFECT, not during render, so the value belongs to the
   *  render that COMMITTED — the same one a handler closure comes from. No
   *  dependency array: the anchor follows the geometry and the zoom, and it is
   *  one object write per render, which this file already pays on every
   *  pan/zoom tick. */
  const anchor = labelAnchor({sourceX, sourceY, targetX, targetY, labelX, labelY, offset: d.offset});
  useEffect(() => {
    anchorRef.current = anchor;
  });

  /** ROUND S/T — pointerdown on the midpoint handle, draw.io's mechanic.
   *
   *  ONE history entry at the START of the gesture (`App.onBend`), never per
   *  move. The pointer is captured so a fast drag survives leaving the 14px
   *  disc, and the listeners live on `document` because this element is
   *  re-rendered by every write the drag itself triggers — both are now in
   *  `useEdgeGesture`, which the LABEL also uses.
   *
   *  ROUND T — THE AXIS IS DECIDED FROM THE POINTER, ONCE. `dx`/`dy` accumulate
   *  from the gesture's own origin; the first move whose delta passes 3px starts
   *  the gesture and holds `lockAxis` for the rest of it, so the line cannot
   *  judder between axes mid-drag. The cursor follows the lock, which is the
   *  feedback that makes the lock readable.
   *
   *  ROUND U — the lock is decided by the KIND (`bendAxisFor`, the same call
   *  `App` makes): `'h'`/`'v'` on `step`/`smoothstep` as before, `'free'` on
   *  `bezier`/`straight`, where there is no axis — both coordinates are written on
   *  every move and the cursor stays `grabbing` (no `col-resize`/`row-resize`,
   *  because there is no axis to advertise).
   *
   *  ROUND AK — the body below is `useEdgeGesture.beginGesture`; this handler is
   *  now only the DECISIONS (which callback, which cursor, which lock). Claiming
   *  happens through `gestures.claim`, which is what makes the label and the
   *  handle mutually exclusive for one pointerdown. */
  const onBendDown = gestures.claim((e: GestureDown) => {
    const cb = d.__onBend;
    if (!cb || !bendActive) return;
    e.stopPropagation();
    e.preventDefault();
    lockAxis.current = null;
    setDragCursor('grabbing');
    beginGesture({
      el: e.currentTarget,
      pane: paneRef.current,
      /* AUDIT-6 — a getter, not the captured tuple: the store may update (ctrl-wheel zoom) while the
         pointer capture holds the gesture, and the stale zoom made every subsequent toFlow jump by the ratio. */
      transform: () => storeApi.getState().transform,
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      // this project's pre-existing jitter threshold, unchanged (ROUND T's
      // LOCK_PX) — expressed through the SAME predicate the label uses, so the
      // two affordances cannot disagree about what a drag is.
      lock: LOCK_PX,
      onStart: () => cb(id, {x: 0, y: 0}, 'start', 0, 0),
      onMove: (p, dx, dy) => {
        if (!lockAxis.current) {
          // BELOW THE THRESHOLD NOTHING IS WRITTEN — `beginGesture` has already
          // refused to report a sub-threshold move, so reaching here means the
          // axis really is being chosen now.
          gestures.noteDrag(); /* AUDIT-5: a real drag happened — dblclick must not open the editor right after */
          lockAxis.current = bendAxisFor(kind, bGeo, dx, dy);
          // the cursor only follows a REAL axis: on the free kinds the value is
          // `'free'` and the handle keeps showing `grabbing`.
          if (lockAxis.current !== 'free') {
            setDragCursor(lockAxis.current === 'h' ? 'col-resize' : 'row-resize');
          }
        }
        cb(id, p, 'move', dx, dy);
      },
      onEnd: (p) => {
        const dragged = lockAxis.current !== null;
        // the axis is per-gesture: clear it so the next drag decides again, and
        // put the handle back to its resting cursor.
        lockAxis.current = null;
        setDragCursor('grab');
        // A REAL drag gets an END report, so `App` can drop the stored waypoint
        // when it was released back on the generator's own midpoint — the only
        // way for the user to put an edge back to a clean routed look. A click
        // on the handle (no axis ever locked) reports nothing, and `beginGesture`
        // calls this only after a real move.
        if (dragged) cb(id, p, 'end', 0, 0);
      },
    });
  });

  /* ROUND AK, AK-10 — POINTERDOWN ON THE LABEL ITSELF. This is the whole fix
     for the owner's #1 complaint, and it is structural rather than stylistic:
     the drag target and the text are ONE object, so no second affordance can
     collide with the label's anchor — the collision the owner measured
     (`handleAt` WAS the label's anchor by construction). The reference
     implementation is Eclipse Sirius Web (MIT), `DraggableEdgeLabels.tsx`; its
     `react-draggable` dependency is NOT taken, because the gesture below is this
     project's own, shared with the bend handle.

     `lock: 0` is Sirius Web's own click-vs-drag guard: a gesture whose total
     delta is `{0,0}` is not a drag, so a plain click still selects the edge
     (React Flow's own handler runs, because the label is inside the edge group)
     and a double-click still opens the editor (AK-13). */
  const onLabelDown = gestures.claim((e: GestureDown) => {
    const cb = d.__onLabelWrite;
    // review mode, no writer, or an OPEN EDITOR: the gesture is not offered. The
    // editor owns its own pointer handling (text selection), so a drag must not
    // hijack it.
    if (!cb || ro || editing) return;
    e.stopPropagation();
    e.preventDefault();
    setLabelCursor('grabbing');
    /** The gesture's origin, in FLOW coordinates — read from the START event and
     *  carried through the closure, which is what makes `W` the dragged point
     *  rather than a delta. `beginGesture` converts the same way for its own
     *  threshold, from the same pane rect and the same `transform`, so the two
     *  agree by construction. A pane that cannot be measured yet yields null and
     *  the gesture simply reports nothing rather than writing a bogus point. */
    const toFlow = (ev: {clientX: number; clientY: number}): Pt | null => {
      const b = paneRef.current?.getBoundingClientRect();
      if (!b) return null;
      return {x: (ev.clientX - b.left - t[0]) / t[2], y: (ev.clientY - b.top - t[1]) / t[2]};
    };
    const origin = toFlow(e);
    /** A pointer that never touched the pane reports nothing — and it must also
     *  not open the gesture's history entry, so the claim is released by simply
     *  returning before `beginGesture` runs. */
    if (!origin) return;
    /* ROUND AM, AM-1 — THE GESTURE'S REFERENCE POINT, and the one line that
       turns the pointer's POSITION into a DISPLACEMENT.

       THE TARGET. At every write the stored offset must place the label under
       the finger: `offset = W − A_live`, where `A_live` is the auto-centre anchor
       the geometry has at that moment (see `App`'s merge for the algebra, and the
       harness for it measured). So what this gesture contributes is
       `W − reference`, where `reference` is whatever point the accumulated stored
       offset currently describes.

       THE REFERENCE, and why it changes once. `App` corrects the stored offset
       from ITS recorded frame into the write's frame before adding the write, so
       the reference this gesture must subtract is the label's painted point
       EXPRESSED IN THAT INCOMING FRAME — the stored numbers read literally:
       `(data.labelAnchor ?? A_live) + (data.labelOffset ?? 0)`. That holds for
       the first write of every gesture, whether the label is pinned (the stored
       frame and offset) or not (the live anchor, offset zero). For the SECOND
       write onwards it has to be the previous reported point instead, because by
       then `App` has already recorded this gesture's frame and added this
       gesture's first write — and the algebra shows the two are the same number
       once one write has landed, which is why `prev` starts `null` and is only
       ever set to a point the gesture actually reported.

       `A_live` is read PER WRITE from the ref, so a node dragged under the finger
       publishes a new anchor and this reference — recomputed on the gesture's
       FIRST write — tracks it. That is what keeps the label under the pointer
       when a node moves, rather than carrying it along with the node. */
    let prev: Pt | null = null;
    /** ROUND AM, AM-1 — THE WRITE. `labelWrite` is GONE from this path: it is
     *  the ABSOLUTE form, and a gesture is a displacement. `base` is
     *  `A − reference`, so `anchorWrite` returns `W − reference` — and the
     *  reported `labelAnchor` is the live anchor, the frame `App` corrects from. */
    const P_ = (p: Pt, phase: BendPhase) => {
      const A = anchorRef.current ?? anchor;
      const frame = d.labelAnchor ?? A;
      const reference = prev ?? {
        x: frame.x + (d.labelOffset?.x ?? 0),
        y: frame.y + (d.labelOffset?.y ?? 0),
      };
      cb(id, anchorWrite({anchor: A, base: {x: A.x - reference.x, y: A.y - reference.y}, W: p}), phase);
      prev = p;
    };
    beginGesture({
      el: e.currentTarget,
      pane: paneRef.current,
      /* AUDIT-6 — a getter, not the captured tuple: the store may update (ctrl-wheel zoom) while the
         pointer capture holds the gesture, and the stale zoom made every subsequent toFlow jump by the ratio. */
      transform: () => storeApi.getState().transform,
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      /* ROUND AL, AL-2 — 2.5 SCREEN px, scaled by the zoom, in place of ROUND
         AK's `lock: 0`. Sirius Web's `{0,0}` guard counted ANY sub-pixel jitter
         as a drag, so a plain click on the label ran `onEnd` and STORED a
         position — the third cause of the owner's "click once and it jumps".
         The guard itself stays (it is `movedBy`, shared with the bend handle);
         only the value changes. */
      lock: labelDragLockPx(t[2]),
      /* ONE history entry, at the START — the same convention `onBend`
         documents. The write is the UNPINNED state: a gesture that has not
         moved yet has moved nothing, and `labelPinned: false` is bit-identical
         to a board that never carried the keys. */
      onStart: () => cb(id, {labelAnchor: null, labelOffset: {x: 0, y: 0}, labelPinned: false}, 'start'),
      onMove: p => { gestures.noteDrag(); /* AUDIT-5: real move — see the bend twin */ P_(p, 'move'); },
      onEnd: p => {
        setLabelCursor('grab');
        /* THE END REPORT CARRIES THE FINAL WRITE, so what is STORED is the
           released point, with no rail between it and the board. ROUND AM, AM-1
           — the centred branch is STILL not a second code path here, it just
           lives one call further along: `anchorWrite` reports the pointer's
           displacement, and `App`'s merge collapses a running total of `{0,0}`
           to the UNPINNED state. So "let go exactly on the centre" and
           `Reset label position` still land on one state rather than two that
           merely look alike. */
        P_(p, 'end');
      },
    });
  });

  /** ROUND AK, AK-10 — the label's anchor with the free 2-D offset applied.
   *  `labelAnchor` is the ONE implementation; it reproduces the shipped
   *  `:383-385` expression operation for operation and adds the stored offset
   *  only once `labelPinned` is set, so an untouched board resolves to the
   *  identical number and no board on disk migrates. */
  const L = labelAnchor({
    sourceX, sourceY, targetX, targetY, labelX, labelY,
    offset: d.offset, labelOffset: d.labelOffset, labelPinned: d.labelPinned,
  });
  const lx = L.x;
  const ly = L.y;
  /** The path as a polyline — the clamp's and the handle-nudge's input. Read
   *  from the path ACTUALLY drawn, so a stored bend, a legacy `bend` fraction
   *  and a generator default are all handled by construction. */
  const pathPts = useMemo(() => pathPoints(path), [path]);
  /** ROUND AL, AL-2 — THE PER-END GLYPH FLAGS AND THE TWO CLEARANCES ARE GONE.
   *
   *  ROUND AK, AK-14.3 computed them here: `hasEndGlyph`/`hasHeadGlyph` read the
   *  marker props (with a documented trap — the UI's `start`/`end` are stored as
   *  `markerEnd`/`markerStart`) and the two fed `labelClearance` +
   *  `labelHalfAlong` to produce `clearStart`/`clearEnd`, the clamp's inputs. The
   *  clamp is deleted, so the flags and the clearances had no consumer left and
   *  are deleted with it. Kept as a note rather than silently dropped: the
   *  `markerEnd`↔`start` inversion above is a real trap, and AL-2 removes the
   *  code that documented it.
   *
   *  `halfW`/`halfH` are still MEASURED (below) but now have ONE consumer, the
   *  bend handle's own nudge. */
  /** The label's live box, in FLOW px. Measured from the element (never
   *  estimated from the string length) and divided by the zoom, because the
   *  label is counter-scaled by `1/t[2]` and its flow-space size therefore
   *  depends on the zoom. Both are MEASUREMENTS: the width is whatever the user
   *  typed, so no constant could stand for it, and 0 is the honest reading of
   *  "not measured yet". `LABEL_HALF_H_PX` is no longer needed as a first-frame
   *  fallback — the only consumer left is the handle nudge, which runs after the
   *  label has mounted. */
  const halfW = labelHalfW / (t[2] || 1);

  /** ROUND AL, AL-4 — THE CREATE SIGNAL, and why the CLICK POINT is no longer
   *  kept. The double-click still converts its point (`__editAt.at`) and the
   *  editor opens there, so the input box appears under the pointer — but AL-4
   *  stores the CENTRED state on commit rather than an offset from that point, so
   *  the point is no longer retained anywhere. ROUND AK kept it in
   *  `pendingCreate` state purely to feed the commit's write; the write no longer
   *  needs it, so the state went with it — one fewer way for the create path and
   *  the drag path to disagree.
   *
   *  `undefined` outside a create signal, and it is read ONLY by the commit —
   *  the normal editor open (the element's own double-click, or the context
   *  menu's "Edit label") leaves it undefined and therefore never writes a
   *  position.
   *
   *  ROUND AN, AN-1 — AND IT IS CONSUMED, WHICH IS WHAT MAKES THE CLAIM ABOVE
   *  TRUE. This paragraph asserted exactly the same thing before this round —
   *  "a commit at an EXISTING label leaves `__editAt` undefined" — and that claim
   *  was FALSE for every edge that had ever been created through a path
   *  double-click: the key was written by `openLabelAt` and deleted NOWHERE, so
   *  it survived the commit and every later rename re-entered the create branch
   *  in `commit` below and wrote the centred state. The owner's report is the
   *  visible half of it: "nếu tôi đổi text, enter thì nó tự nhiên về lại center".
   *
   *  A ONE-SHOT THAT IS NEVER CLEARED IS NOT A ONE-SHOT, IT IS PERMANENT. The
   *  signal now ENDS with the moment it opened: `commit` and `cancel` both call
   *  `d.__consumeEditAt?.(id)`, which deletes the key from the edge's data. So
   *  after the FIRST editor session on an edge the key is gone and a later
   *  rename cannot re-trigger the centred write. It is ALSO folded away by the
   *  READ path (`App.tsx migrateEdge`) for a board that already persisted one —
   *  the user's own boards carry 4 / 2 / 1 occurrences (measured), so without
   *  that a reload would put every label back in the create state. */
  const createAt = d.__editAt;

  // F2/AK-13: the two editor entry points. `__edit` is the context menu's "Edit
  // label" on an EXISTING label; `__editAt` is a double-click on the PATH, which
  // carries the point the click landed on. `ro` is deliberately NOT a dependency
  // of the second effect, for exactly the reason the first one gives: the signal
  // is a persistent timestamp, so a mode change re-running the effect would pop
  // the editor open the moment review mode is left.
  useEffect(() => {
    if (!createAt || ro) return;
    setDraft(shown);
    setEditing(true);
  }, [createAt?.t]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The painted label's own box, measured from the DOM at the zoom that is
   *  live, and re-measured when the zoom changes (the label is counter-scaled by
   *  `1/zoom`, so its FLOW size follows the zoom — the measurement has to as
   *  well). Read from `getBoundingClientRect`, never estimated from the string:
   *  the width is whatever the user typed. */
  /** The label's own box, measured from the DOM at the zoom that is live, and
   *  re-measured when the zoom changes (the label is counter-scaled by `1/zoom`,
   *  so its FLOW size follows the zoom — the measurement has to as well). Read
   *  from `getBoundingClientRect`, never estimated from the string: the width is
   *  whatever the user typed. ONLY the half-WIDTH is kept — see the declaration
   *  above for why the height went with the clamp. */
  useEffect(() => {
    const el = labelBox.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const z = t[2] || 1;
    setLabelHalfW(r.width / 2 / z);
  }, [shown, t, editing]);

  /** The handle's own position. The path's midpoint — the label's own anchor and
   *  the point on the line the user grabs — EXCEPT when a label is painted there,
   *  where the two affordances would overlap.
   *
   *  ROUND AK, AK-11 — WHY IT IS NUDGED, AND WHY THAT IS THE SECOND LINE OF
   *  DEFENCE RATHER THAN THE FIRST. The first is STRUCTURAL: both affordances run
   *  through `useEdgeGesture`, whose `claim` closes the window on the first
   *  pointerdown, so a shared point could never start two gestures anyway. The
   *  nudge is the documented fallback — it keeps the two TAP RINGS from
   *  overlapping, so the user never has to guess which one a tap will land on.
   *
   *  IT APPLIES ONLY WHEN A LABEL IS PAINTED. With no label there is nothing to
   *  avoid, so the handle stays on the generator's own midpoint: that is the
   *  pixel-parity rule this file obeys everywhere, and the reason selecting an
   *  unlabelled edge renders exactly as it did before this pass. */
  const handleAt = hasLabel
    ? nudgeAlongPath({x: labelX, y: labelY}, pathPts, HANDLE_CLEAR_PX + halfW)
    : {x: labelX, y: labelY};

  useEffect(() => {
    if (editing) window.setTimeout(() => input.current?.select(), 10);
  }, [editing]);

  const commit = () => {
    const v = draft.trim();
    d.onCommitLabel?.(id, v);
    /* ROUND AL, AL-4 — A FIRST-CREATED LABEL CENTRES, AND THE CLICK POINT IS NOT
       STORED. ROUND AK (AK-13) kept the double-click's own point and stored an
       offset from it, which is what the owner saw as "hiện nó đang văng tùm lum"
       — the label landed wherever on the path he happened to double-click. The
       double-click still OPENS the editor (at the click point, so the box appears
       under the pointer); only the STORED value changes, and it is now the
       UNPINNED centred state — the very state `Reset label position` writes and
       the state a board that never carried either key renders as. Three
       situations, one stored value.

       EDITING IS UNTOUCHED: this whole branch is reachable only from the CREATE
       signal (`__editAt`); a commit at an EXISTING label — the element's own
       double-click, or the context menu's "Edit label" — leaves `__editAt`
       undefined, so no position is written and the text can be corrected without
       the label moving.

       ROUND AN, AN-1 — THE BRANCH IS NOW EXACTLY ONCE, BECAUSE THE SIGNAL IS
       CONSUMED. Before this round the paragraph above was TRUE ONLY OF AN EDGE
       THAT HAD NEVER BEEN CREATED THROUGH A PATH DOUBLE-CLICK: the key was never
       cleared, so after one create it stayed on the edge and every later RENAME
       took this branch and re-centred the label — the owner's "đổi text, enter
       thì nó tự nhiên về lại center". `__consumeEditAt` below ends the signal with
       the commit that read it, so the FIRST-created label still centres (the
       intent AL-4 states, and the case its probe measures) and no later rename
       can reach the centred write at all.

       THE CONSUME IS UNCONDITIONAL AND OUTSIDE THE `if (createAt)` BRANCH, on
       purpose: this is the "the moment is over" write, not a side effect of the
       centred one. An edge whose signal was set but whose text was committed
       unchanged still ends its create moment here — otherwise the stale key
       survives to poison the next rename, which is the whole defect. */
    if (createAt) {
      d.__onLabelWrite?.(id, {labelAnchor: null, labelOffset: {...CENTRED}, labelPinned: false}, 'end');
    }
    d.__consumeEditAt?.(id);
    setEditing(false);
  };

  const cancel = () => {
    /* ROUND AN, AN-1 — THE SECOND EXIT CONSUMES IT TOO. A double-click on the
       path whose editor is dismissed with Escape (or blurred away) leaves the
       document untouched — nothing is written — but the SIGNAL must still end,
       or the next rename on this edge would re-enter the create branch and
       re-centre the label. That asymmetry is exactly why the consume is its own
       named callback rather than a branch inside the write. */
    d.__consumeEditAt?.(id);
    setDraft(typeof label === 'string' ? label : '');
    setEditing(false);
  };

  // --- flow animation -----------------------------------------------------
  // "message being sent": dots/pulses travel along the exact edge path.
  // Uses SVG <animateMotion> along `path` (React Flow's recommended technique),
  // so it works for every curvature and needs no extra library.
  // L1: the stroke is symbolic — a key resolved to var(--c-*) here, so a theme
  // change recolours the path, the payload filters and the envelope flap with
  // no data edit at all. A literal hex (the custom escape hatch) still wins.
  const stroke = (d.strokeKey ? COLOR_VAR[d.strokeKey] : (props.style as any)?.stroke) ?? COLOR_VAR.slate;
  /* ROUND AL, AL-3 — THE LABEL'S OWN TWO COLOURS, read through the SAME
     symbolic-key vocabulary the stroke uses. `labelTextKey`/`labelBgKey` are
     `ColorKey`s, so both resolve through `COLOR_VAR` and a theme change repaints
     them for free — no hex enters the board or either file, which is the rule
     PACKAGE-L set for colour storage.
   *
     THE FALLBACKS ARE THE OLD RENDER, deliberately: an unset text key falls back
     to `var(--fg)` (the colour `.edge-label` has always used) and an unset
     background key to `undefined`, so the CLASS decides — which is the pre-existing
     three-state plate, untouched. So a board that never carried either key
     renders exactly the colours it rendered before, and only a user who picks a
     swatch sees a change. */
  const labelText = (d.labelTextKey ? COLOR_VAR[d.labelTextKey] : undefined);
  const labelBgColor = (d.labelBgKey ? COLOR_VAR[d.labelBgKey] : undefined);
  const flow = d.flow ?? 'none';
  const flowCount = Math.max(1, Math.min(6, d.flowCount ?? 3));
  const flowDur = Math.max(0.6, Math.min(8, d.flowDuration ?? 2.4));

  /* ROUND BN-4 — the K2 payload machinery now lives in ./flowPayloads.tsx
     (useFlowPayloads); the call below is the same memo the renderer body
     always ran, verbatim arguments. */
  const payloads = useFlowPayloads({path, id, flow, flowCount, flowDur, stroke, flowIcon: d.flowIcon});


  /* PACKAGE-SEQ — derive the message-kind overrides once per render. The head
     type values mirror what makeEdge builds for plain markers: sync gets the
     CLOSED (filled) head; async / return / self get the OPEN head, and the
     dashed stroke comes as a style override. Colour follows the edge's own. */
  const seqColor = (props.style as React.CSSProperties | undefined)?.stroke as string | undefined;
  const seqMarker = d.seqMsg
    ? ({type: d.seqMsg === 'async' || d.seqMsg === 'return' || d.seqMsg === 'self'
      ? MarkerType.Arrow : MarkerType.ArrowClosed, color: seqColor, width: 18, height: 12} as EdgeMarkerType)
    : null;
  const seqStyle = d.seqMsg === 'return' || d.seqMsg === 'self'
    ? {strokeDasharray: '6 4'}
    : undefined;

  return (
    <>
      {/* ROUND AL, AL-1 — SELECTION IS OPTION C: THE OLD LOOK, MADE TRUTHFUL.

          WHAT WAS HERE AND WHY IT WENT. ROUND AK replaced the restroke with a
          second `<path>` at `strokeWidth + 5` carrying `strokeDasharray="6 4"`
          (`.edge-sel-overlay`). The owner's device test rejected it in his own
          words — "nhìn nó xấu sao ấy … đặc biệt khi chỉnh line animation, nhìn
          nó rất kì": a +5px dashed halo reads as a FAT DASHED OUTLINE and, with
          the flow payload running, it fights the moving dots. Both the width and
          the dash are gone with the rule.

          WHAT IT IS NOW — the inverse of what AK shipped, and the look he
          actually liked (the pre-AK behaviour, where the body turned `--sel`):

            · SELECTED — the body takes `var(--sel)` (the old look), exactly as
              the deleted `!important` rule painted it, and the AUTHORED colour
              is preserved as a thin 1.1px core ON TOP of it. So the panel can
              never lie about the colour (which was AK-1's whole point) and the
              eye sees the old, quieter signal. The core is a separate element
              with its OWN class, deliberately NOT `react-flow__edge-path`, so
              React Flow's own `.selected` rule and this sheet's `.ds-electric`
              hover marks cannot reach it.
            · UNSELECTED — ONE path, the authored one, byte-identical to today.
              `style` is passed through UNCHANGED (`props.style` itself, not a
              spread of it) when the edge is not selected, which is the pixel-
              parity rule this file obeys everywhere.

          TOKENS ONLY: the selection colour is `var(--sel)` (the token the
          deleted rule used) and the core takes the resolved authored colour the
          renderer was already handed. No hex is added to either file.

          TOUCH: driven by React Flow's own `selected` flag — never by `:hover` —
          so a tap on a touch device selects exactly as a click does. */}
      <BaseEdge
        id={id}
        path={path}
        markerStart={props.markerStart}
        markerEnd={(seqMarker ?? props.markerEnd) as string | undefined}
        style={seqStyle ? {...(selected ? {...props.style, stroke: SEL_STROKE} : props.style), ...seqStyle}
                        : (selected ? {...props.style, stroke: SEL_STROKE} : props.style)}
        interactionWidth={26}
      />

      {selected && (
        <path
          className="edge-sel-core"
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={SEL_CORE_PX}
          pointerEvents="none"
        />
      )}

      {flow === 'dash' && (
        <path
          className="edge-flow-dash"
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={((props.style as any)?.strokeWidth ?? 1.8) + 0.6}
          style={{animationDuration: `${flowDur * 2}s`}}
        />
      )}

      {flow === 'pulse' && (
        <path
          className="edge-flow-pulse"
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={((props.style as any)?.strokeWidth ?? 1.8) + 0.4}
          style={{animationDuration: `${flowDur}s`}}
        />
      )}

      {/* K1 perf-guard + K3 gating target the same wrapper class. */}
      {payloads && <g className="ds-animated-payload" pointerEvents="none">{payloads}</g>}

      {(shown || editing || d.techn || bendDraggable) && (
        <EdgeLabelRenderer>
          {/* ROUND S/T — the draggable midpoint, draw.io's mechanic: a SYNTHESISED
              point, so even an edge that has never stored a waypoint is
              immediately draggable. ROUND T: the drag is FREE IN 2-D — the axis
              is locked per gesture from the POINTER and the route reads BOTH
              coordinates — so this handle moves up/down AND left/right.
              ROUND U: the same affordance on ALL FOUR kinds; on `bezier`/
              `straight` there is no axis lock at all and BOTH coordinates are
              written on every move (the cursor stays `grabbing` there).
              Counter-scaled by `1/zoom`
              inside the transform like the label: the hit target stays the same
              size on screen at every zoom, and scaling about the element's own
              centre avoids the transform-origin footgun the node resize grips
              work around. The invisible `::after` ring in the stylesheet takes it
              to a ~32px tap target. */}
          {bendDraggable && (
            <div
              /* the pane is walked up to here rather than passed down: an edge
                 component receives no viewport ref */
              ref={el => {paneRef.current = el?.closest('.react-flow__pane') as HTMLDivElement | null;}}
              className="edge-bend-handle"
              data-edge-id={id}
              title="Drag to bend this line"
              style={{
                transform: `translate(-50%,-50%) translate(${handleAt.x}px, ${handleAt.y}px) scale(${1 / t[2]})`,
                // draw.io's own axis feedback: col-resize while the drag is locked
                // horizontal, row-resize while vertical, grab at rest, grabbing
                // for the first pixels before the lock is decided.
                cursor: dragCursor,
              }}
              onPointerDown={onBendDown}
            />
          )}
          {/* ROUND AO, AO-3 — THE EMPTY LABEL BOX IS GONE, AND THE BLOCK GATE IS
              LEFT ALONE.

              WHAT HARVEY SAW ("1 điểm nhô ra 2 bên thay vì vòng tròn only"): a
              1px `--sel` border of a 17-25px wide box sticking out ~5px each side
              of the 14px bend circle, at the exact midpoint of a selected `step`
              edge with no label. It is NOT a marker and NOT a corner artifact.

              THE CAUSE, MEASURED. The block below opens on
              `shown || editing || d.techn || bendDraggable`, and selecting an edge
              turns on `bendDraggable` so the HANDLE can appear. The label `<div>`
              was then rendered UNCONDITIONALLY inside that block, so an unlabelled
              selected edge got an empty-but-bordered label: with no text it
              collapses to ~5px tall but keeps a 17px width floor (`padding: 1px 6px`
              plus its border), and it still carried `.selected`, so it PAINTED the
              border. Unselected, the same empty box is invisible (no border) —
              which is exactly why the artifact only appeared on selection, matching
              the report.

              THE FIX IS THE GUARD, NOT THE GATE. `hasLabel` — `!!(shown || editing
              || d.techn)`, declared once near the top of this component — is the
              precise "has something to show" test, and `handleAt` already keys off
              it. Wrapping the label in `{hasLabel && (…)}` removes the empty box
              while the block STAYS open for `bendDraggable`: the handle is the
              affordance that must survive, and it renders from its own
              `{bendDraggable && (…)}` above, independently of this element.

              `handleAt` NEEDS NO CHANGE, and this was verified rather than
              "fixed": it already reads `hasLabel ? nudgeAlongPath(…, HANDLE_CLEAR_PX
              + halfW) : {x: labelX, y: labelY}`, and `hasLabel` already EXCLUDES
              `bendDraggable`. So an unlabelled selected edge already takes the
              un-nudged branch and the handle already sits exactly on the path
              midpoint with nothing to avoid — the definition was correct all along
              and only the render gate let the empty label into the DOM.

              PARITY. An unlabelled UNSELECTED edge is byte-identical before and
              after: `bendDraggable` is false, so the block gate was already
              `hasLabel` (false) and nothing rendered. Asserted. */}
          {hasLabel && (
          <div
            className={`edge-label ${labelBgClass(d.labelBg)}${selected ? ' selected' : ''}${editing ? ' editing' : ''}`}
            data-edge-id={id}
            data-label-text={d.labelTextKey ?? ''}
            data-label-bg={d.labelBgKey ?? ''}
            ref={labelBox}
            style={{
              transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`,
              /* ROUND AL, AL-3 — the label's two colours, written as inline
                 CUSTOM PROPERTIES rather than as `color`/`background`, and that
                 choice is load-bearing twice over:
                   · ROUND AN, AN-6a RETIRED THE FIRST REASON, AND THIS IS WHY THE
                     MECHANISM SURVIVES IT. While `.edge-label.selected` still
                     declared `color: var(--sel)` the argument was a cascade one:
                     an inline `color` would have beaten it and a selected label
                     would have stopped showing the selection colour. The selected
                     rule now owns only the ring, so `color` is uncontested in
                     every state. A custom property is still the right mechanism,
                     because it is what gives the sheet ONE writer per property
                     and leaves this element's `style` object IDENTICAL when no
                     key is stored;
                   · `.edge-label.lb-*` owns `background`, and the plate is a
                     three-state CLASS (AK-12's rule) that an inline background
                     would flatten to one. ROUND AN, AN-6b then gave
                     `.lb-surface` the `--label-plate` CONSUMER (with the token as
                     its FALLBACK), so the stored colour reaches the paint through
                     the class while an untouched board still paints
                     `var(--surface)` — the property is emitted here and applied
                     there, which is the whole point of the split.
                 A custom property has no specificity of its own, so the sheet
                 keeps every one of those decisions and simply reads this colour
                 where it already knows how. Both are `undefined` when unset,
                 which React omits — so a board that never carried a key emits
                 the identical `style` object it did before this item.

                 ROUND AM, AM-2 — THE TEXT STYLE JOINS THEM, THROUGH THE SAME
                 EMITTER THE NODE USES. `textStyleVars` (`src/textStyle.ts`) is
                 the ONE place a `TextStyle` becomes custom properties, and it is
                 already what `DiagramNode` / `LabelNode` / the label node spread
                 onto their roots. Calling it here is what makes the edge label's
                 Text section the same text vocabulary as a node's rather than a
                 second one that can drift (`--ts-scale` / `--ts-weight` /
                 `--ts-font`, read by `.edge-label` in the sheet with today's
                 literals as the fallbacks).

                 THE SECTION'S OWN EMITTER, NOT A FILTER AT THE CALL SITE.
                 `edgeTextStyleVars` (`src/textStyle.ts`) is `textStyleVars`'s
                 edge-label subset — one call, one place where "which fields this
                 target can express" is decided, so a harness can EXECUTE that
                 decision instead of re-deriving it. The third and fourth
                 arguments inside it are the two per-target align defaults; an
                 edge label renders neither axis, which is exactly why the
                 function drops both pairs rather than spreading an inert
                 property onto the element. NO COLOUR ARRIVES FROM HERE either:
                 the label's ink is `labelTextKey` (the `--label-fg` line above,
                 owned by the LABEL section), and the Text section renders no
                 colour row for an edge, so `--ts-color` stays a node-only
                 property. An untouched board emits `{}` here, so the sheet's
                 fallbacks paint the previous bytes exactly. */
              ...(labelText ? {'--label-fg': labelText} : {}),
              ...(labelBgColor ? {'--label-plate': labelBgColor} : {}),
              ...edgeTextStyleVars(d.labelStyle),
            } as React.CSSProperties}
            onPointerDown={onLabelDown}
            onDoubleClick={e => {
              e.stopPropagation();
              // AK-13 GUARD: the editor opens on the DOUBLE-CLICK, not on the
              // first of its two pointerdowns. A drag that happens to end where
              // it began is a gesture, not an edit. (AUDIT-5: the old check
              // read `gestures.isClaimed()`, but the claim latch self-releases
              // on the next macrotask — long before the second pointerup — so
              // the guard never fired. The gesture hook now stamps when a drag
              // really moved; an editor opening within 400ms of that drag is
              // the return-to-origin case this guard exists for.)
              if (gestures.msSinceDrag() < 400) return;
              // FB-L: in review mode the label is readable, not editable — the
              // editor simply never opens. The label element itself is left in
              // place (and keeps its hover feedback).
              if (ro) return;
              setDraft(shown);
              setEditing(true);
            }}
            title={editing || ro ? undefined : 'Double-click to rename this connection'}
          >
            {editing ? (
              <input
                ref={input}
                className="edge-label-input"
                value={draft}
                size={Math.max(6, draft.length + 1)}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commit(); }
                  else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
                }}
              />
            ) : (
              <>
                {shown}
                {d.techn && <small className="edge-techn">{d.techn}</small>}
              </>
            )}
          </div>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
});

GoblinEdge.displayName = 'GoblinEdge';

export default GoblinEdge;
