/* useConnections.ts — ROUND BN-2: the connection cluster moved out of App()
 *  verbatim (createsCycle, the F4 undoable reconnect with its bend-key reset,
 *  Part C drop-on-node connect, the HARVEY 2026-10-13 double-click
 *  auto-connect with AQ4b side projection, D4 twin-bump onConnect, and the F7
 *  rules wrapper). Behaviour-neutral: bodies are byte-identical except the
 *  three id-mint sites, which call the `nextId` parameter instead of the
 *  App-module-level `idc` counter (App owns the counter and passes
 *  `() => idc++`); pendingDrop/connectOrigin/readOnlyRef/shiftDown refs and
 *  the edges/node state stay in App and pass down positionally — no context.  (feature-map home: src/src/useConnections.ts)
 */
import {useCallback, useEffect} from 'react';
import type * as React from 'react';
import {addEdge, reconnectEdge} from '@xyflow/react';
import type {Connection, Edge, Node, FinalConnectionState, ReactFlowInstance} from '@xyflow/react';
import {DOUBLE_CLICK_CONNECT_RANGE, DBL_STRAIGHT_GAP, GOBLIN_HANDLE_IDS} from './boardConstants';
import {wouldCycle} from './boardUtils';
import {makeEdge} from './presets';
import type {PresetId, PathId} from './presets';
import type {HelperGuides} from './helperLines';
import type {ChecklistTaskId} from './Checklist';
import type {EdgeData} from './App';

/* Positional parameters, not an opts object (AGENTS.md perf ratchet). */
export function useConnections(
  nodesRef: React.MutableRefObject<Node[]>,
  edgesRef: React.MutableRefObject<Edge[]>,
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
  setGuides: React.Dispatch<React.SetStateAction<HelperGuides>>,
  pushHistory: () => void,
  tickTask: (id: ChecklistTaskId) => void,
  flash: (msg: string) => void,
  rf: ReactFlowInstance | null,
  wrap: React.RefObject<HTMLDivElement | null>,
  readOnlyRef: React.MutableRefObject<boolean>,
  pendingDrop: React.MutableRefObject<Connection | null>,
  connectOrigin: React.MutableRefObject<{nodeId: string; handleId: string | null | undefined} | null>,
  shiftDown: React.MutableRefObject<boolean>,
  absNodes: (ns: Node[]) => Map<string, {n: Node; x: number; y: number; w: number; h: number}>,
  noCycles: boolean,
  oneIn: boolean,
  dblConnect: boolean,
  dblRange: number,
  preset: {edges: Parameters<typeof makeEdge>[2]},
  defaultPath: PathId,
  nextId: () => number,
) {

  // ---- F7 helpers: cycle detection on the current edge set ----
  /** Would adding source→target create a directed cycle? */
  const createsCycle = useCallback((source: string, target: string): boolean =>
    wouldCycle(source, target, edgesRef.current), [edgesRef]);

  // ---- F4: edge reconnect (undoable, keeps type + data + styling) ----
  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    /* AUDIT-follow-up — a rewire can create a cycle too: drop the end on a node
       upstream and A→B→A is live. Checked against the edge set MINUS this edge
       (the old end is being replaced, not added). */
    if (noCycles && wouldCycle(newConnection.source, newConnection.target,
        edgesRef.current.filter(e => e.id !== oldEdge.id))) {
      flash('Blocked: this rewiring would create a cycle (A→B→A)');
      return;
    }
    pushHistory();
    // ROUND S: a waypoint measured against the OLD endpoints is nonsense the
    // moment an end moves, so all three bend keys go with it. Nothing else on
    // the edge's data is touched — type, styling, label and flow survive.
    setEdges(es => reconnectEdge(oldEdge, newConnection, es).map(e => {
      if (e.id !== oldEdge.id) return e;
      const data = {...((e.data ?? {}) as EdgeData)};
      delete data.bend; delete data.bendX; delete data.bendY;
      return {...e, data};
    }));
  }, [noCycles, pushHistory, setEdges]);

  // ---- Part C: connect on drop over a NODE ------------------------------
  // Dropping a connection drag on EMPTY canvas used to insert a fresh node at
  // the drop point and wire it up. That is gone on purpose: a missed drop
  // silently added a shape nobody asked for. Only a drop that lands ON an
  // existing node still connects.
  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
    /* AUDIT-16 — a connection drag in flight when readOnly is toggled must not
       complete: the drop still fires, so bail before any target search. */
    if (readOnlyRef.current) { pendingDrop.current = null; return; }
    const c = pendingDrop.current;
    pendingDrop.current = null;
    setGuides({vertical: null, horizontal: null});
    /* AUDIT-13 — no coordinates, no hit-test: a TouchEvent with an empty
       changedTouches list used to fall back to (0,0), hit-testing the viewport
       corner and possibly mis-connecting to a node parked there. Bail instead —
       the gesture just ends without a target, which is what a dropped touch is. */
    const hasPoint = 'clientX' in event
      || (event as TouchEvent).changedTouches?.length
    if (!hasPoint) return;
    const clientX = 'clientX' in event ? event.clientX : (event as TouchEvent).changedTouches[0].clientX;
    const clientY = 'clientY' in event ? event.clientY : (event as TouchEvent).changedTouches[0].clientY;
    // Only when the drop was NOT on a valid handle and we know the source.
    if (!c || !rf || !wrap.current) return;
    if (connectionState?.isValid) return;
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    if (el?.closest('.react-flow__handle')) return;
    /* AUDIT-7 — raw client coords (see the ctx addNode note above). */
    const p = rf.screenToFlowPosition({x: clientX, y: clientY});
    // pick target: a node under the drop point — there is no longer a fallback
    // branch, so no node is ever created from a drop.
    const ns = nodesRef.current;
    const absMap = absNodes(ns);
    let targetId: string | null = null;
    for (const v of absMap.values()) {
      if (v.n.id === c.source) continue;
      if (p.x >= v.x && p.x <= v.x + v.w && p.y >= v.y && p.y <= v.y + v.h) { targetId = v.n.id; break; }
    }
    // Nothing under the drop point: this is a no-op. No node is inserted, no
    // edge is created, and pushHistory() is deliberately NOT called — a
    // cancelled gesture must not leave a phantom step on the undo stack. The
    // user sees nothing (silence, not a flash): a message would be noise for a
    // gesture that was simply released in the wrong place.
    if (!targetId) return;
    const src = c.source;
    /* AUDIT-follow-up — the Prevent-cycles setting now reaches THIS path too
       (it previously only gated the inspector's onConnect, so a connection drag
       dropped straight on a node could create a cycle A→B→A). */
    if (noCycles && wouldCycle(src, targetId, edgesRef.current)) {
      flash('Blocked: this connection would create a cycle (A→B→A)');
      return;
    }
    const newId = `e${nextId()}`;
    // The target node already exists in state, so the edge can be added
    // directly — the old `setTimeout` deferral only existed to wait for the
    // node this path used to insert.
    pushHistory();
    setEdges(es => addEdge(makeEdge(src, targetId!, {...preset.edges, path: defaultPath}, newId), es));
  }, [rf, absNodes, noCycles, pushHistory, setEdges, preset, defaultPath]);

  /* HARVEY 2026-10-13 — DOUBLE-CLICK A HANDLE -> connect to the nearest shape.
     DiagramNode dispatches `gobi:handle-connect` {nodeId, handleId}; this effect
     owns the search: nearest node within DOUBLE_CLICK_CONNECT_RANGE (flow px,
     centre-to-centre), cycle-checked like every other creation path. The CLICKED
     handle stays the source; the target side is whichever side of that shape is
     closest to the handle's midpoint. Too far = ignored (Harvey: "xa quá bỏ qua"). */
  useEffect(() => {
    if (!dblConnect) return;
    const onHandleConnect = (ev: Event) => {
      /* SELF-REVIEW (item 13) — read-only boards must not auto-connect, exactly
         like a manual connection drag (AUDIT-16's guard). */
      if (readOnlyRef.current) { flash('Read-only: connect disabled'); return; }
      const {nodeId, handleId} = (ev as CustomEvent<{nodeId: string; handleId: string}>).detail;
      const ns = nodesRef.current;
      const me = absNodes(ns).get(nodeId);
      if (!me) return;
      const cx = me.x + me.w / 2, cy = me.y + me.h / 2;
      /* HARVEY — if the nearest shape is ALREADY connected to this node, keep
         walking: pick the nearest shape that is NOT connected yet. Only when
         every candidate inside the range is exhausted does it report back. */
      const connectedTo = (other: string) => edgesRef.current.some(e =>
        (e.source === nodeId && e.target === other) || (e.source === other && e.target === nodeId));
      let best: {id: string; d: number} | null = null;
      let alreadyN = 0;
      absNodes(ns).forEach((v, k) => {
        if (k === nodeId || v.n.parentId) return;
        const d = Math.hypot(cx - (v.x + v.w / 2), cy - (v.y + v.h / 2));
        if (d > dblRange) return;
        if (connectedTo(k)) { alreadyN++; return; }
        if (!best || d < best.d) best = {id: k, d};
      });
      if (!best) {
        flash(alreadyN > 0
          ? `All ${alreadyN} nearby shape${alreadyN > 1 ? 's' : ''} already connected`
          : `No shape within ${dblRange}px — nothing connected`);
        return;
      }
      const targetId = (best as {id: string; d: number}).id;
      if (noCycles && wouldCycle(nodeId, targetId, edgesRef.current)) {
        flash('Blocked: this connection would create a cycle (A→B→A)');
        return;
      }
      /* SELF-REVIEW — One input per node gates the auto-connect too: a target
         that already has an incoming edge stays single-input. */
      if (oneIn && edgesRef.current.some(e => e.target === targetId)) {
        flash('Blocked: that shape already has an input (One input per node)');
        return;
      }
      /* HARVEY's clarification — the CLICKED handle is the SOURCE, verbatim. Only
         the TARGET side is computed: whichever side of the nearest shape is
         closest to the clicked handle's midpoint. */
      const other = absNodes(ns).get(targetId)!;
      const px = handleId === 'left' ? me.x : handleId === 'right' ? me.x + me.w : me.x + me.w / 2;
      const py = handleId === 'top' ? me.y : handleId === 'bottom' ? me.y + me.h : me.y + me.h / 2;
      /* AQ4b — measure from the HANDLE POINT to the CLOSEST POINT ON EACH SIDE
         SEGMENT (projection clamped into the segment), not to the side's line.
         The line metric let a diagonal placement pick the BOTTOM side: B's bottom
         line ran "62px" from the handle even though the handle faces B's left.
         Harvey's screenshot: right-handle dblconnect landed on B's bottom. */
      const seg = (hx: number, hy: number, x1: number, y1: number, x2: number, y2: number) => {
        const t = Math.max(0, Math.min(1, ((hx - x1) * (x2 - x1) + (hy - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2)));
        return Math.hypot(hx - (x1 + t * (x2 - x1)), hy - (y1 + t * (y2 - y1)));
      };
      const sides: [number, string][] = [
        [seg(px, py, other.x, other.y, other.x, other.y + other.h), 'left'],
        [seg(px, py, other.x + other.w, other.y, other.x + other.w, other.y + other.h), 'right'],
        [seg(px, py, other.x, other.y, other.x + other.w, other.y), 'top'],
        [seg(px, py, other.x, other.y + other.h, other.x + other.w, other.y + other.h), 'bottom'],
      ];
      sides.sort((p, q) => p[0] - q[0]);
      pushHistory();
      /* HARVEY (batch #3) — NO KINK AT SMALL DISTANCE: when the facing gap is
         tiny, a smoothstep elbow renders as an ugly zig-zag. Below
         DBL_STRAIGHT_GAP px of facing gap the edge is a plain STRAIGHT line —
         the arrowhead keeps its normal small size (it is the marker, not the
         path). */
      const facing = sides[0][0];
      const ne = makeEdge(nodeId, targetId, {...preset.edges, path: facing < DBL_STRAIGHT_GAP ? 'straight' : defaultPath}, `e${nextId()}`, {
        sourceHandle: handleId, targetHandle: sides[0][1],
      });
      setEdges(es => addEdge(ne, es));
      flash(facing < DBL_STRAIGHT_GAP ? 'Connected (straight — shapes are close)' : 'Connected to the nearest shape');
    };
    window.addEventListener('gobi:handle-connect', onHandleConnect);
    return () => window.removeEventListener('gobi:handle-connect', onHandleConnect);
  }, [dblConnect, dblRange, oneIn, absNodes, noCycles, pushHistory, setEdges, flash, preset, defaultPath]);

  // ---- connect ---- (new edges use the editable goblinEdge type)
  // D4: a second connection between the same ordered pair of nodes is not a
  // duplicate edge — it bumps a "×N" count on the existing one instead.
  const onConnect = useCallback((c: Connection) => {
    /* AUDIT-16 — readOnly may have flipped after this gesture began. */
    if (readOnlyRef.current) { flash('Read-only: connection dropped'); return; }
    // G — direction guard. The 4-point scheme makes every handle a SOURCE, so
    // React Flow already builds the connection the way the user drew it; this
    // normalises it anyway, because the one thing that must never come back is
    // the arrowhead landing on the node the drag STARTED from. The origin is
    // `connectOrigin`, written by onConnectStart (the same params.nodeId
    // pendingDrop records) and cleared here — pendingDrop itself is left to
    // onConnectEnd, which needs it to decide whether to insert a node on drop.
    //
    // SCOPED to the four goblin handles on purpose. Dragging from an ERD column
    // handle ALSO records an origin (TableNode renders that node's own handles,
    // and its `left_rel_*` ends are genuine TARGETS), and there the reversal is
    // the CORRECT relationship direction — the node you land on is the
    // referencing one. Swapping those would invert the FK silently, so the
    // guard only fires when the drag began on one of the ids this pass owns.
    const origin = connectOrigin.current;
    connectOrigin.current = null;
    if (origin && GOBLIN_HANDLE_IDS.has(origin.handleId ?? '') && c.target === origin.nodeId) {
      c = {
        ...c,
        source: origin.nodeId,
        target: c.source,
        sourceHandle: c.targetHandle,
        targetHandle: c.sourceHandle,
      };
    }
    tickTask('edge');
    /* AUDIT-2 + AUDIT-3 — the twin check, pushHistory and the id mint all moved
       OUT of the setEdges updater. Two reasons, both measured:
       (a) AUDIT-2: the twin-bump branch never pushed history, so Ctrl+Z after a
           ×N bump skipped the whole gesture;
       (b) AUDIT-3: an updater must be pure — React StrictMode double-invokes it
           in dev, and pushHistory + idc++ inside it produced TWO history entries
           and two burnt ids per connection. All three now run once, here, from
           edgesRef (the live pre-mutation state), like every other writer. */
    const twin = edgesRef.current.find(e =>
      e.source === c.source && e.target === c.target &&
      !(e.sourceHandle || e.targetHandle));
    pushHistory();
    if (twin) {
      const cur = ((twin.data as any)?.parallel ?? 1) as number;
      const next = cur + 1;
      setEdges(es => es.map(e => e.id === twin.id
        ? {...e, data: {...((e.data ?? {}) as EdgeData), parallel: next}, label: `×${next}`}
        : e));
      return;
    }
    // L3c: on an ERD board a connection between two columns is a relationship
    // between those columns — carry the handles through.
    const newId = `e${nextId()}`;
    setEdges(es => addEdge(makeEdge(c.source, c.target, {...preset.edges, path: defaultPath}, newId, {
      sourceHandle: c.sourceHandle, targetHandle: c.targetHandle,
    }), es));
  }, [tickTask, pushHistory, setEdges, preset, defaultPath]);

  // ---- F7: connection rules applied to every new connection ----
  const onConnectRules = useCallback((c: Connection) => {
    if (c.source === c.target) return;
    if (noCycles && createsCycle(c.source, c.target)) {
      flash('Blocked: this connection would create a cycle (A→B→A)');
      return;
    }
    if (oneIn && !shiftDown.current) {
      const has = edgesRef.current.some(e => e.target === c.target);
      if (has) {
        flash('Blocked: target already has an incoming connection — hold Shift to allow more');
        return;
      }
    }
    onConnect(c);
  }, [noCycles, oneIn, createsCycle, onConnect, flash]);

  return [createsCycle, onReconnect, onConnectEnd, onConnect, onConnectRules] as const;
}
