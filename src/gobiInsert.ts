/* ROUND GOBI-2 — the .gobi door's INSERT, as a pure function.
 *
 * `compileGobi(text)` returns a WHOLE board; the app door ADDS that board to
 * the one the user is already looking at, so the two id spaces have to be
 * reconciled before anything reaches React Flow:
 *
 *  - the compiler's ids are the author's own identifiers ("broker", "e1"),
 *    unique INSIDE the compiled board by construction — not against a canvas
 *    that may already carry a node called "broker" or an edge called "e1".
 *    A colliding id is suffixed (-2, -3, …) and EVERY reference to it is
 *    rewritten through the same map (parentId, edge source/target), so no
 *    append can dangle or silently re-point an existing diagram.
 *  - the append itself is ONE undo entry: the caller pushes history ONCE
 *    around it (src/useExportActions.ts). Nothing here touches history,
 *    storage or the DOM — this module is React-free and pure, which is what
 *    lets the harness reason about it without a browser.
 */
import type {Node, Edge} from '@xyflow/react';

export type GobiInsert = {nodes: Node[]; edges: Edge[]};

/** `id`, or the first `${id}-N` no one has taken. Records the winner. */
function freshId(id: string, taken: Set<string>): string {
  let out = id;
  let n = 2;
  while (taken.has(out)) out = `${id}-${n++}`;
  taken.add(out);
  return out;
}

export function gobiInsert(
  board: {nodes?: Node[] | null; edges?: Edge[] | null},
  canvas: {nodes: {id: string}[]; edges: {id: string}[]},
): GobiInsert {
  const nodeIds = new Set(canvas.nodes.map((n) => n.id));
  const edgeIds = new Set(canvas.edges.map((e) => e.id));

  const nodesIn = board.nodes ?? [];
  const remap = new Map<string, string>();
  for (const n of nodesIn) {
    const id = freshId(n.id, nodeIds);
    if (id !== n.id) remap.set(n.id, id);
  }
  const ref = (id: string): string => remap.get(id) ?? id;

  const nodes: Node[] = nodesIn.map((n) => {
    const parentId = (n as {parentId?: string | null}).parentId;
    const out: Node = {...n, id: ref(n.id)};
    if (parentId) (out as {parentId?: string}).parentId = ref(parentId);
    return out;
  });

  const edges: Edge[] = (board.edges ?? []).map((e) => ({
    ...e,
    id: freshId(e.id, edgeIds),
    source: ref(e.source),
    target: ref(e.target),
  }));

  return {nodes, edges};
}
