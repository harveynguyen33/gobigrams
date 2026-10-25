/* useCanvasTools.ts — ROUND BN-2: the canvas tool cluster moved out of App()
 *  verbatim (F8 auto-layout with its eased move, ROUND BD z-order
 *  reorderSelection with the BUGFIX-2 sel pivot, and AQ11 absolute-space
 *  align/distribute). Behaviour-neutral: bodies are byte-identical; only
 *  this wrapper, its parameter list and the return tuple are new. The
 *  nodes/edges state, absNodes, animateLayout and zOrderMode stay in App
 *  and pass down positionally — no context.  (feature-map home: src/src/useCanvasTools.ts)
 */
import {useCallback} from 'react';
import type * as React from 'react';
import type {Node, Edge, ReactFlowInstance} from '@xyflow/react';
import {LAYOUTS, type LayoutSpec} from './presets';

/* Positional parameters, not an opts object (AGENTS.md perf ratchet). */
export function useCanvasTools(
  nodes: Node[],
  edges: Edge[],
  nodesRef: React.MutableRefObject<Node[]>,
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  pushHistory: () => void,
  absNodes: (ns: Node[]) => Map<string, {n: Node; x: number; y: number; w: number; h: number}>,
  animateLayout: (fn: () => void) => void,
  rf: ReactFlowInstance | null,
  sel: string | null,
  zOrderMode: string,
  preset: {layout: LayoutSpec},
) {

  // ---- F8: auto-layout with an eased move ----
  // K3: the easing is owned by the CSS transition (`.ds-animating-layout
  // .react-flow__node { transition: transform .35s … }`), wrapped by
  // animateLayout() which adds the class first and strips it 400ms later — i.e.
  // after the transition, so it can never interfere with a user drag. Positions
  // are written once (React Flow owns `transform`), so undo restores the
  // pre-layout positions in a single step.
  const autoLayout = useCallback(() => {
    if (!nodes.length) return;
    // L2: the engine is a preset field. L3a: a flowchart runs top-to-bottom and
    // freezes its pool / lane bands; L3c: the ERD packer is a table grid.
    const fn = LAYOUTS[preset.layout.engine];
    const target = fn(nodes, edges, preset.layout);
    if (!target.size) return;
    pushHistory();
    animateLayout(() => {
      setNodes(ns => ns.map(n => {
        const to = target.get(n.id);
        if (!to) return n;   // children of a group / frozen bands follow their parent
        return {...n, position: {x: Math.round(to.x), y: Math.round(to.y)}};
      }));
      /* AQ11 — fit the result: the engine lays out from (0,0) and a rearranged
         board regularly lands partly off-viewport, which reads as "the button
         did nothing" (measured: y -340..756 on a 9-node board). */
      requestAnimationFrame(() => rf?.fitView({padding: 0.25, duration: 300}));
    });
  }, [nodes, edges, pushHistory, setNodes, animateLayout, rf, preset]);

/* ROUND BD, ITEM 1 — THE Z-ORDER PRIMITIVES. The app had NONE: a grep for
   zIndex / bringToFront / sendToBack across src/ found only React Flow's own
   internals, and draw order is simply the array order of `nodes`. So ordering
   is now written the only way the controlled `nodes` array offers — a `zIndex`
   field on each node, written through `setNodes` behind ONE `pushHistory()`,
   the same discipline as `align`/`distribute` above (undo restores the exact
   pre-click array; a second undo changes nothing).

   WHY MAX, NOT MAX+1. Nudging past the live maximum leaves every future
   re-order to keep climbing; normalising onto [max-N+1 .. max] keeps the
   numbers bounded forever. Equal values keep the relative array order, so a
   group brought forward stays internally ordered — Figma semantics.

   THE READBACK ALSO REORDERS THE ARRAY. A `zIndex` alone repaints correctly
   (React Flow sorts by zIndex internally), but `snapshot()` history and any
   future array-order reader would disagree with what is on screen. Sorting the
   written array by the new zIndex makes the array the truth, once.

   HONEST SCOPE NOTE (flagged, not hidden): only top-level siblings race here —
   a parent group always paints above a node outside it in React Flow, and
   these writes do not change that. Matches `align`/`distribute`, which also
   treat the selection as one plane. */
const reorderSelection = useCallback((to: 'front' | 'back') => {
  const selNodes = nodesRef.current.filter(n => n.selected);
  if (selNodes.length < 2) return;
  pushHistory();
  setNodes(ns => {
    /* BUGFIX 2 (2026-10-23) + CONFIG ROUND — pivots on `sel` (the last-clicked
       node): pivot lands ON the band extreme; the rest stacks contiguously.
       With zOrderMode 'wysiwyg' (the default) the paint order IS the stored z,
       so no selection-clearing is needed — the selection survives the Arrange,
       which is friendlier than Figma's drop-on-reorder. Under the opt-in
       'lift' mode (basic), RF paints selected nodes at rawZ + 1000, which
       would mask the band; there the selection IS cleared in the same write,
       exactly as the first cut did. */
    const zs = ns.map(n => n.zIndex ?? 0);
    const bound = to === 'front' ? Math.max(...zs) : Math.min(...zs);
    const pivot = sel ? selNodes.findIndex(n => n.id === sel) : -1;
    // pivot first (it takes the extreme), then the remaining selection in order
    const ordered = pivot >= 0
      ? [selNodes[pivot], ...selNodes.filter((_, i) => i !== pivot)]
      : selNodes;
    const band = new Map<string, number>();
    ordered.forEach((n, i) => band.set(n.id, to === 'front'
      ? bound - i                          // pivot lands ON the extreme (top)
      : bound + i));                        // pivot lands ON the extreme (bottom)
    const keepSelection = zOrderMode === 'lift';
    return ns
      .map(n => band.has(n.id) ? {...n, zIndex: band.get(n.id), selected: keepSelection} : n)
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  });
}, [pushHistory, setNodes, sel, zOrderMode]);

  // ---- align / distribute ----
  /* AQ11 — BOTH functions now work in ABSOLUTE coordinates. The old versions
     read `n.position` directly, which is PARENT-RELATIVE for a group child: one
     child in the selection poisoned the min/max with a tiny local offset and
     the whole alignment jumped to the group's frame (measured live: align-left
     on 8 top-levels + 1 child teleported the board ~250px left). Bounds are
     computed over absolute rects; the write converts the absolute target back
     to the node's own parent-relative position. */
  const align = useCallback((kind: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => {
    const selNodes = nodesRef.current.filter(n => n.selected);
    if (selNodes.length < 2) return;
    const abs = absNodes(nodesRef.current);
    const rects = selNodes.map(n => {
      const r = abs.get(n.id)!;
      return {id: n.id, x: r.x, y: r.y, w: r.w, h: r.h, node: n};
    });
    pushHistory();
    const minL = Math.min(...rects.map(r => r.x));
    const maxR = Math.max(...rects.map(r => r.x + r.w));
    const minT = Math.min(...rects.map(r => r.y));
    const maxB = Math.max(...rects.map(r => r.y + r.h));
    const cx = (minL + maxR) / 2;
    const cy = (minT + maxB) / 2;
    const targets = new Map<string, {x: number; y: number}>();
    for (const r of rects) {
      let ax = r.x, ay = r.y;
      if (kind === 'left') ax = minL;
      else if (kind === 'right') ax = maxR - r.w;
      else if (kind === 'hcenter') ax = cx - r.w / 2;
      else if (kind === 'top') ay = minT;
      else if (kind === 'bottom') ay = maxB - r.h;
      else if (kind === 'vcenter') ay = cy - r.h / 2;
      // absolute -> parent-relative: keep the frame offset the node already has
      targets.set(r.id, {x: Math.round(ax - (r.x - r.node.position.x)), y: Math.round(ay - (r.y - r.node.position.y))});
    }
    setNodes(ns => ns.map(n => targets.has(n.id) ? {...n, position: targets.get(n.id)!} : n));
  }, [absNodes, pushHistory, setNodes]);

  const distribute = useCallback((axis: 'h' | 'v') => {
    const selNodes = nodesRef.current.filter(n => n.selected);
    if (selNodes.length < 3) return;
    /* AQ11 — absolute-space distribution (see the align note above): mixed
       parent-relative frames poisoned the sort order and the span. */
    const abs = absNodes(nodesRef.current);
    const rects = selNodes.map(n => {
      const r = abs.get(n.id)!;
      return {id: n.id, x: r.x, y: r.y, w: r.w, h: r.h, node: n};
    });
    pushHistory();
    const sorted = [...rects].sort((a, b) => axis === 'h' ? a.x - b.x : a.y - b.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const start = axis === 'h' ? first.x : first.y;
    const end = axis === 'h' ? last.x + last.w : last.y + last.h;
    const total = sorted.reduce((s2, r) => s2 + (axis === 'h' ? r.w : r.h), 0);
    const gap = (end - start - total) / (sorted.length - 1);
    const targets = new Map<string, {x: number; y: number}>();
    let cursor = start;
    for (const r of sorted) {
      const v = Math.round(cursor);
      const absX = axis === 'h' ? v : r.x;
      const absY = axis === 'h' ? r.y : v;
      targets.set(r.id, {
        x: Math.round(absX - (r.x - r.node.position.x)),
        y: Math.round(absY - (r.y - r.node.position.y)),
      });
      cursor += (axis === 'h' ? r.w : r.h) + gap;
    }
    setNodes(ns => ns.map(n => targets.has(n.id) ? {...n, position: targets.get(n.id)!} : n));
  }, [absNodes, pushHistory, setNodes]);

  return [autoLayout, reorderSelection, align, distribute] as const;
}
