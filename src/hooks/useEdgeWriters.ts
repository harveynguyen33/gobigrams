import {useCallback, useEffect, useRef} from 'react';
import type {Edge, Node} from '@xyflow/react';
import type {EdgeData} from '../edges';
import {asShape} from '../nodes/shapes';
import {computeHelperSnap, snapToParentRelative, type HelperGuides} from '../canvas/helperLines';
import {edgeGeo, edgeDrawnMid} from '../board/boardUtils';
import {
  applyDrag, bendAxisFor, dragPoint, plainMidpoint, BEND_SNAP_PX,
  type BendPhase, type Pt,
} from '../canvas/edgeBend';
import type {LabelWrite} from '../canvas/edgeLabel';
import {edgeColorLiteralPatch} from '../presets';

/* APP-SPLIT S8 (t_62266c20) — the edge-write path, moved VERBATIM from App
 * (20764bb-era L993-1459; at the S6 tree: L922-1032 + L1081-1113 + L1135-1388).
 * 398 lines out of App: the 8 edge-writing callbacks, their docstrings, the
 * three gesture latches and the gobi:node-grow receiver. bendDragging STAYS in
 * App (the inspector's bend slider reads/writes it) and arrives via ctx.
 *
 * EDGE-WRITE CONTRACT — same state identities, same setter timing, ONE undo
 * entry per action:
 *   updateEdge(patch, replaceData, coalesce)
 *       · 'label' in patch            → tickTask('label')
 *       · pushHistory UNLESS the write is coalesce AND bendDragging.current
 *         is already latched (ROUND AM, AM-5: a continuous range drag is ONE
 *         entry, recorded on the first move; the latch is cleared by the
 *         control's onPointerUp/onKeyUp/onBlur — see the docstring below).
 *   onBend / onLabelWrite             → history on the FIRST 'move', never on
 *       'start' (AUDIT-10: a stray click selects but pushes nothing; a drag
 *       pushes exactly one entry), keyed on the renderer's `id`, NOT on
 *       selEdgeId (the first move is also the move that selects the edge —
 *       routing through updateEdge would write the WRONG edge).
 *   onCommitLabel                     → no-op when the label is unchanged, else
 *       tickTask('label') + ONE pushHistory + setEdges + setSelEdgeId(id).
 *   setEdgeColorLiteral               → routes THROUGH updateEdge (one entry).
 *   onNodeDragStop                    → adoption/release/snap write is ONE write
 *       per drop; no second push (AUDIT-12: onNodeDragStartAll — which STAYS
 *       in App — already snapshotted the pre-gesture state at drag start).
 *   onGrow                            → NOT undoable by design (AQ15: it is the
 *       insert's own settling, received here via the gobi:node-grow event).
 *
 * CTX (14 names, all read from App state at render time — the hook owns no
 * state): selEdgeId, setSelEdgeId, tickTask, pushHistory, setEdges, setNodes,
 * flash, edgesRef, nodesRef, bendDragging, helperDrag, setGuides, alignGuides,
 * absNodes. App keeps onNodeDragStartAll (its pushHistory is the gesture
 * snapshot the AUDIT-12 collapse above leans on) and setEdgeColor. */
interface EdgeWritersCtx {
  selEdgeId: string | null;
  setSelEdgeId: (id: string | null) => void;
  tickTask: (task: string) => void;
  pushHistory: () => void;
  setEdges: (u: Edge[] | ((es: Edge[]) => Edge[])) => void;
  setNodes: (u: Node[] | ((ns: Node[]) => Node[])) => void;
  flash: (msg: string) => void;
  edgesRef: React.RefObject<Edge[]>;
  nodesRef: React.RefObject<Node[]>;
  bendDragging: React.MutableRefObject<boolean>;
  helperDrag: React.MutableRefObject<boolean>;
  setGuides: (g: HelperGuides) => void;
  alignGuides: boolean;
  absNodes: (ns: Node[]) => Map<string, {n: Node; x: number; y: number; w: number; h: number}>;
}

export function useEdgeWriters(ctx: EdgeWritersCtx): {
  onNodeDrag: (e: MouseEvent | TouchEvent, n: Node) => void;
  onNodeDragStop: (e: MouseEvent | TouchEvent, n: Node) => void;
  updateEdge: (patch: Partial<Edge> & {data?: EdgeData}, replaceData?: boolean, coalesce?: boolean) => void;
  setEdgeColorLiteral: (hex: string) => void;
  onCommitLabel: (id: string, label: string) => void;
  onGrow: (id: string, height: number, width?: number) => void;
  onBend: (id: string, W: Pt, phase: BendPhase, dx: number, dy: number) => void;
  onLabelWrite: (id: string, w: LabelWrite, phase: BendPhase) => void;
} {
  const {selEdgeId, setSelEdgeId, tickTask, pushHistory, setEdges, setNodes, flash,
    edgesRef, nodesRef, bendDragging, helperDrag, setGuides, alignGuides,
    absNodes} = ctx;


  const onNodeDrag = useCallback((_e: MouseEvent | TouchEvent, draggedNode: Node) => {
    const ns = nodesRef.current;
    const dragged = ns.find(n => n.id === draggedNode.id);
    if (!dragged) return;
    const absMap = absNodes(ns);
    const me = absMap.get(dragged.id);
    if (!me) return;

    // F3: helper lines — single-node drags (top-level AND group children).
    // IMPORTANT: while dragging we ONLY show the guides, we never write the
    // node position (writing it every frame fights React Flow's own drag and
    // makes the node feel stuck/snapped). The snap is applied once, on drop.
    if (alignGuides) {
      const others = [...absMap.values()].filter(v => v.n.id !== dragged.id);
      const {guides: g} = computeHelperSnap(
        {x: me.x, y: me.y, w: me.w, h: me.h},
        others.map(v => ({x: v.x, y: v.y, w: v.w, h: v.h})),
      );
      helperDrag.current = true;
      setGuides(g);
    }

  }, [absNodes, setNodes, alignGuides]);

  const onNodeDragStop = useCallback((_e: MouseEvent | TouchEvent, draggedNode: Node) => {
    tickTask('move');
    const ns = nodesRef.current;
    const dragged = ns.find(n => n.id === draggedNode.id);
    if (!dragged || dragged.type === 'label') return;
    const absMap = absNodes(ns);
    const me = absMap.get(dragged.id);
    if (!me) return;

    // F3: apply the final snap ONCE, on drop — the guides were display-only
    // while dragging. SHAPE-FIDELITY: membership (F1 below) is decided from
    // the SNAPPED position and there is ONE write per drop, so the reparent
    // can never race the snap back through a stale nodesRef.
    let snap: {x: number, y: number} | null = null;
    if (helperDrag.current) {
      helperDrag.current = false;
      setGuides({vertical: null, horizontal: null});
      const others = [...absMap.values()].filter(v => v.n.id !== dragged.id);
      if (others.length) {
        const {position} = computeHelperSnap(
          {x: me.x, y: me.y, w: me.w, h: me.h},
          others.map(v => ({x: v.x, y: v.y, w: v.w, h: v.h})),
        );
        if (Math.abs(position.x - me.x) > 0.5 || Math.abs(position.y - me.y) > 0.5) snap = position;
      }
    }
    const abs = snap ?? {x: me.x, y: me.y};

    // F1: reparent on drop — inside a group bounds → adopt; outside → release.
    const groups = ns.filter(n => asShape((n.data as any)?.shape) === 'group' && n.id !== dragged.id);
    // never adopt into one of my own (future) children
    const hit = groups.find(g => {
      const gp = absMap.get(g.id)!;
      return abs.x >= gp.x && abs.y >= gp.y && abs.x + me.w <= gp.x + gp.w && abs.y + me.h <= gp.y + gp.h;
    });

    /* GROUP-LOGICAL (t_eb8fab7e): release-on-drop is a FRAME rule only — a logical-group member leaves its block ONLY by Cmd+Shift+G (the container carries the block's drag; an inside-mode solo drag keeps membership). */
    const parentIsFrame = !!ns.some(n => n.id === dragged.parentId && asShape((n.data as any)?.shape) === 'group');
    if (hit && dragged.parentId !== hit.id) {
      const hp = absMap.get(hit.id)!;
      /* AUDIT-12 — no second push: onNodeDragStartAll already snapshotted the
         pre-gesture state, and the adoption is part of the SAME perceived
         gesture ("move it into the group"). Two pushes made the gesture cost
         two undos. The drag-start entry restores position AND membership. */
      const pos = snapToParentRelative(
        {x: abs.x - hp.x, y: abs.y - hp.y}, {x: 0, y: 0, w: hp.w, h: hp.h});
      setNodes(ns2 => {
        const cur = ns2.find(n => n.id === dragged.id);
        if (!cur) return ns2;
        const child: Node = {
          ...cur,
          parentId: hit.id,
          extent: 'parent' as const,
          position: pos,
        };
        // keep parent before children in the array
        const without = ns2.filter(n => n.id !== dragged.id);
        const parentIdx = without.findIndex(n => n.id === hit.id);
        const out = [...without];
        out.splice(parentIdx + 1, 0, child);
        return out;
      });
      flash(`Added to group “${(hit.data as any)?.title ?? hit.id}”`);
    } else if (parentIsFrame && !hit) {
      // dragged out of its group — keep the absolute position, drop the parent
      /* AUDIT-12 — same collapse: the drag-start entry covers this. */
      setNodes(ns2 => {
        const cur = ns2.find(n => n.id === dragged.id);
        if (!cur) return ns2;
        const out: Node = {...cur, parentId: undefined, extent: undefined, position: {x: Math.round(abs.x), y: Math.round(abs.y)}};
        const without = ns2.filter(n => n.id !== dragged.id);
        // place after the former parent so ordering stays valid for siblings
        const pIdx = without.findIndex(n => n.id === dragged.parentId);
        const at = pIdx < 0 ? without.length : pIdx + 1;
        const arr = [...without];
        arr.splice(at, 0, out);
        return arr;
      });
      flash('Removed from group');
    } else if (snap) {
      // SHAPE-FIDELITY: children store parent-relative positions, clamped
      // inside the parent so extent:'parent' cannot undo the snap.
      const parent0 = dragged.parentId ? absMap.get(dragged.parentId) : null;
      const pos = snapToParentRelative(abs, parent0 && {x: parent0.x, y: parent0.y, w: parent0.w, h: parent0.h});
      setNodes(ns2 => ns2.map(n => n.id === dragged.id ? {...n, position: pos} : n));
    }
  }, [tickTask, absNodes, pushHistory, setNodes, setEdges, flash]);

  /** Patch the selected edge only. Top-level keys plus style / markerEnd / markerStart.
   *
   *  `coalesce` — ROUND AM, AM-5 RESTORED THIS OPTION. ROUND T deleted it with
   *  the bend slider it existed for; the flow-speed slider introduces the same
   *  gesture shape and needs the same rule, so the machinery comes back
   *  IDENTICALLY rather than in a second form.
   *
   *  It marks a CONTINUOUS gesture — a range drag — as ONE undo step: history is
   *  recorded on the first move of the gesture only, so a 100-event drag costs
   *  ONE entry (holding the pre-drag value) rather than flooding the 50-entry
   *  stack and destroying the user's older undo steps. `src/resizeHistory.ts`
   *  records the same lesson for the resize grip ("pushing per frame would bury
   *  the user's real history under hundreds of steps — a worse bug than the one
   *  being fixed"). The gesture ENDS when the control that opened it clears the
   *  latch — see the slider's `onPointerUp` / `onKeyUp` / `onBlur`. */
  const updateEdge = useCallback((patch: Partial<Edge> & {data?: EdgeData}, replaceData = false, coalesce = false) => {
    if (!selEdgeId) return;
    if ('label' in patch) tickTask('label');
    if (!coalesce || !bendDragging.current) pushHistory();
    if (coalesce) bendDragging.current = true;
    setEdges(es => es.map(e => {
      if (e.id !== selEdgeId) return e;
      const {style, markerEnd, markerStart, data, ...rest} = patch;
      // markerEnd/markerStart: honour an explicit `none` (undefined) by REMOVING the key,
      // so the arrow head actually disappears — check for key presence, not value.
      const out = {...e, ...rest} as Edge;
      if (style !== undefined) out.style = {...(e.style ?? {}), ...style};
      if ('markerEnd' in patch) { if (markerEnd === undefined) delete out.markerEnd; else out.markerEnd = markerEnd; }
      if ('markerStart' in patch) { if (markerStart === undefined) delete out.markerStart; else out.markerStart = markerStart; }
      if (data !== undefined) out.data = replaceData ? data : {...((e.data ?? {}) as EdgeData), ...data};
      return out as Edge;
    }));
  }, [selEdgeId, tickTask, pushHistory, setEdges]);

  /** ROUND AO, AO-1c — the custom picker's edge writer: store the literal, drop
   *  the symbolic key, recolour the path and both markers with it. See
   *  `edgeColorLiteralPatch` for why each key is written or cleared. */
  const setEdgeColorLiteral = useCallback((hex: string) => {
    const e = edgesRef.current.find(x => x.id === selEdgeId);
    if (!e) return;
    updateEdge(edgeColorLiteralPatch(hex, {markerEnd: e.markerEnd, markerStart: e.markerStart}));
  }, [selEdgeId, updateEdge]);

  const onCommitLabel = useCallback((id: string, label: string) => {
    const cur = edgesRef.current.find(e => e.id === id);
    if (!cur || ((cur.label ?? '') as string) === label) return;
    tickTask('label');
    pushHistory();
    setEdges(es => es.map(e => (e.id === id ? {...e, label} : e)));
    setSelEdgeId(id);
  }, [tickTask, pushHistory, setEdges]);

  /* AUDIT-10 — the history entry for a bend/label gesture moves from 'start'
     to the FIRST 'move'. beginGesture fires 'start' on every pointerdown (even
     a plain click, which moves nothing), so a stray click pushed an undo entry
     that changed nothing and made the next Ctrl+Z feel dead. Now the entry is
     pushed by the first reported move: a click still selects, a drag pushes
     exactly one entry, same as before. The ref lives at component level (a hook
     inside a callback is illegal). */
  const bendGesturePushed = useRef(false);
  /* AUDIT-11 — the axis the gesture LOCKED (set on first real move, cleared on
     end). The 'end' report carries dx=dy=0, which bendAxisFor resolves to 'h'
     unconditionally — a vertical drag then stored a spurious bendX. */
  const bendGestureAxis = useRef<'h' | 'v' | 'free' | null>(null);
  /** ROUND S/T — the midpoint drag, draw.io's mechanic.
   *
   *  `'start'` records ONE history entry and selects the edge, exactly like
   *  `onNodeDragStart` / `onReconnect`: history belongs at the start of a
   *  gesture, never per pointermove, or a 200-event drag would bury the user's
   *  older undo steps.
   *
   *  `'move'` writes the waypoint the pointer is at. On `step`/`smoothstep` that
   *  is PROJECTED onto the ONE axis the gesture owns — draw.io's rule, decided
   *  from the POINTER DELTA (`dragAxis`), NOT from the geometry (that was the
   *  ROUND S bug: the generator's split decided the axis, so on any edge with
   *  more than 0.001px of stagger the axis was `h` and up/down did nothing).
   *
   *  ROUND U — the axis is decided by `bendAxisFor` and it has THREE values:
   *  `'h'`/`'v'` on the orthogonal kinds as before, and `'free'` on
   *  `bezier`/`straight`, where draw.io moves BOTH coordinates together and there
   *  is no axis to project onto. `dragPoint` is that projection in one place: the
   *  pointer on the owned axis + `edgeDrawnMid` on the other (`'h'`/`'v'`), or the
   *  raw pointer on BOTH (`'free'`). The base point matters on the orthogonal
   *  kinds because their route reads BOTH coordinates too — a horizontal drag
   *  must not drift vertically.
   *
   *  `'end'` is the auto-remove: a waypoint released within `BEND_SNAP_PX` of the
   *  generator's own default point deletes BOTH keys, so the edge goes back to
   *  the generator's clean route instead of storing a point that bends nothing.
   *  It is kind-agnostic on purpose — `plainMidpoint` is the endpoints' geometric
   *  midpoint on every kind.
   *
   *  It deliberately does NOT route through `updateEdge`: that is keyed on
   *  `selEdgeId`, so on the very first move (the one that selects the edge) it
   *  would write to the WRONG edge. */
      /* AQ15 — AUTO-GROW: a freshly created node whose text overflows the shape's
     safe band grows once to fit. `height` is the FULL node height needed (the
     renderer measured the clipped body against the wrapper). Only nodes WITHOUT
     an explicit user height are grown — the wrapper style check in the renderer
     guarantees that — so a manual resize is never overridden. Not undoable
     (it is the insert's own settling, not a user edit). */
  const onGrow = useCallback((id: string, height: number, width?: number) => {
    setNodes(ns => ns.map(n => {
      if (n.id !== id) return n;
      const style = {...(n.style ?? {})} as Record<string, string | number>;
      if (style.height && Number(style.height) >= height) return n;
      style.height = height;
      /* AQ16 — the width floors at the content's natural single-line width
         (capped 340) so long text widens the shape instead of over-wrapping.
         Only ever grows: an explicit user width is never shrunk. */
      if (width) {
        const floored = Math.max(190, width); /* .node min-width — never under */
        if (!style.width || Number(style.width) < floored) style.width = floored;
      }
      return {...n, style: style as any};
    }));
  }, [setNodes]);

  /* AQ15 — the global receiver for the renderer's auto-grow reports. */
  useEffect(() => {
    const h = (ev: Event) => {
      const {id, height, width} = (ev as CustomEvent<{id: string; height: number; width?: number}>).detail;
      onGrow(id, height, width);
    };
    window.addEventListener('gobi:node-grow', h);
    return () => window.removeEventListener('gobi:node-grow', h);
  }, [onGrow]);

const onBend = useCallback((id: string, W: Pt, phase: BendPhase, dx: number, dy: number) => {
    if (phase === 'start') {
      bendGesturePushed.current = false;
      bendGestureAxis.current = null;
      setSelEdgeId(id);
      return;
    }
    if (phase === 'move' && !bendGesturePushed.current) {
      bendGesturePushed.current = true;
      pushHistory();
    }
    setEdges(es => es.map(e => {
      if (e.id !== id) return e;
      const geo = edgeGeo(e, nodesRef.current);
      if (!geo) return e;
      const data = (e.data ?? {}) as EdgeData;
      const base = edgeDrawnMid(e, nodesRef.current);
      if (!base) return e;
      /* AUDIT-11 — the LOCKED axis. 'move' records it; 'end' carries dx=dy=0,
         which bendAxisFor would resolve to 'h' unconditionally — a vertical
         drag then stored a spurious bendX from the pointer's final-x tremor. */
      if (phase === 'move') bendGestureAxis.current = bendAxisFor(e.type, geo, dx, dy);
      const axis = phase === 'end' && bendGestureAxis.current
        ? bendGestureAxis.current
        : bendAxisFor(e.type, geo, dx, dy);
      const put: Pt = dragPoint(axis, W, base);
      if (phase === 'end') {
        bendGestureAxis.current = null;
        const pm = plainMidpoint(geo);
        if (Math.hypot(put.x - pm.x, put.y - pm.y) <= BEND_SNAP_PX) {
          const out = {...data};
          delete out.bendX;
          delete out.bendY;
          return {...e, data: out};
        }
      }
      return {...e, data: applyDrag(data, axis, put)};
    }));
  }, [pushHistory, setEdges]);

  /* ROUND AK, AK-10/AK-13 — THE LABEL DRAG AND THE CREATE-ON-DOUBLE-CLICK.

     A DELIBERATE SIBLING OF `onBend` (above), and it keeps that function's two
     load-bearing properties so the label never grows a second source of truth:

       * `pushHistory()` ONCE, on `'start'` — the convention every gesture in this
         file already documents. Never per move: a 200-event drag would bury the
         user's older undo steps.
       * it keys on the `id` the renderer hands back, NOT on `selEdgeId` — the
         first move of a drag is also the move that selects the edge, so routing
         through `updateEdge` would write to the WRONG edge (the same reason
         `onBend` does not use it).

     WHAT IT DOES NOT DO is re-derive geometry. `w` arrives finished — the
     renderer computed it, because it is the only side that holds the resolved
     path and the anchor, and since ROUND AM's AM-1 the gesture's write is
     `anchorWrite`: a displacement added to the gesture's base offset. This
     applies it.

     ROUND AM, AM-1 — THE REBASE, and why it is here rather than in the renderer.
     A write states the anchor it was measured against (`w.labelAnchor`) and
     carries the pointer's INCREMENT for this write. The stored offset is a
     running total, so the two are combined:

         corrected = stored + (storedAnchor − w.labelAnchor)     [the frame moved]
         offset    = corrected + w.labelOffset                   [this write's increment]

     The first line is what makes a label keep tracking the pointer while a NODE
     moves: the anchor moved by `Δ`, so the stored offset — expressed in the OLD
     anchor's frame — is `Δ` too large in the new one and is corrected by exactly
     that. "The line moved 30px right, so a label that was 20px right of it is now
     10px right of it": the label stays where the user's EYE put it and only the
     NUMBER changes. Without it the next write's increment would be added to an
     offset already measured from the wrong origin, and the label would drift by
     the node's movement each time. When the frames agree the correction is
     `{0,0}` and this reduces to the plain accumulation.

     `w.labelAnchor === null` is the ABSOLUTE case — the centred/reset write and
     the create commit — and it is NEVER rebased or accumulated: those offsets are
     not measured against the geometry at all, they ARE the stored value. It also
     CLEARS the stored anchor, because after it there is nothing left to measure
     against.

     THE MERGE IS MODE-DEPENDENT ON PURPOSE, and it is what keeps the stored
     document honest: a CENTRED write (`labelPinned: false`) DELETES all THREE
     keys instead of storing `{0,0}`/`true`, so "dragged back to the centre",
     "reset" and "never moved" are one stored state and a board cannot accumulate
     a key that means nothing. `labelAnchor` joins the other two on that list in
     this round — three situations, one stored state. A gesture that ENDS at the
     centre lands there through the same door: the total it writes is `{0,0}`,
     which is the pinned-but-empty case collapsed below. */
  /* AUDIT-10 twin — same deferral as onBend above: the label gesture's history
     entry lands on the first 'move', not on the pointerdown 'start'. */
  const labelGesturePushed = useRef(false);
  const onLabelWrite = useCallback((id: string, w: LabelWrite, phase: BendPhase) => {
    if (phase === 'start') {
      labelGesturePushed.current = false;
      setSelEdgeId(id);
      return;
    }
    if (phase === 'move' && !labelGesturePushed.current) {
      labelGesturePushed.current = true;
      pushHistory();
    }
    setEdges(es => es.map(e => {
      if (e.id !== id) return e;
      const data = {...((e.data ?? {}) as EdgeData)};
      if (!w.labelPinned) {
        delete data.labelOffset;
        delete data.labelPinned;
        delete data.labelAnchor;
        return {...e, data};
      }
      if (w.labelAnchor === null) {
        // ABSOLUTE (the centred/reset write, the create commit): stored as it
        // stands, and there is no frame to record.
        if (w.labelOffset.x === 0 && w.labelOffset.y === 0) {
          delete data.labelOffset;
          delete data.labelPinned;
          delete data.labelAnchor;
        } else {
          data.labelOffset = w.labelOffset;
          data.labelPinned = true;
          delete data.labelAnchor;
        }
        return {...e, data};
      }
      const stored = data.labelOffset;
      let storedAnchor = data.labelAnchor;
      /* AUDIT-9 — migration-on-first-touch. Boards pinned before ROUND AM-1
         carry labelOffset + labelPinned but NO labelAnchor. Without an anchor
         the rebase below was skipped, and the first drag teleported the label
         by whatever the geometry had drifted since the pin. One-time fix: if a
         pinned offset arrives with no stored anchor, treat the LIVE anchor as
         the one it was measured from (no rebase — the drift is absorbed), and
         this gesture plus every later one rebases correctly. */
      if (stored && !storedAnchor) {
        storedAnchor = {x: w.labelAnchor.x, y: w.labelAnchor.y};
        data.labelAnchor = {x: w.labelAnchor.x, y: w.labelAnchor.y};
      }
      const frameMoved = stored && storedAnchor
        && (storedAnchor.x !== w.labelAnchor.x || storedAnchor.y !== w.labelAnchor.y);
      const corrected = frameMoved
        ? {x: stored!.x + (storedAnchor!.x - w.labelAnchor.x), y: stored!.y + (storedAnchor!.y - w.labelAnchor.y)}
        : (stored ?? {x: 0, y: 0});
      const offset = {x: corrected.x + w.labelOffset.x, y: corrected.y + w.labelOffset.y};
      if (offset.x === 0 && offset.y === 0) {
        // the gesture's total is the centred state — the SAME stored value as
        // reset and never-moved, reached through the gesture's own door.
        delete data.labelOffset;
        delete data.labelPinned;
        delete data.labelAnchor;
      } else {
        data.labelOffset = offset;
        data.labelPinned = true;
        data.labelAnchor = w.labelAnchor;
      }
      return {...e, data};
    }));
  }, [pushHistory, setEdges]);
  return {onNodeDrag, onNodeDragStop, updateEdge, setEdgeColorLiteral,
    onCommitLabel, onGrow, onBend, onLabelWrite};
}
