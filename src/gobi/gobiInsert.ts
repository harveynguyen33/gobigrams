/* ROUND IMPORT-DUP (t_349010fd) — the .gobi door's INSERT, as pure functions.
 *
 * `toBoardDoc(doc)` (src/gobi/adapterCanvas.ts, CORE-STEP2) returns a WHOLE
 * board; the app door MERGES that board into the one the user is already
 * looking at, keyed by id:
 *
 *  - the compiler's ids are the author's own identifiers ("broker", "e1"),
 *    unique INSIDE the compiled board by construction. An id the canvas
 *    already owns is UPDATED IN PLACE with the document's own node/edge —
 *    exactly what a fresh insert would land (position/title/size verbatim),
 *    because that IS the import semantics — and an id the canvas has never
 *    seen is appended. Nothing is ever duplicated: re-importing the same
 *    document leaves the node and edge counts unchanged (the pre-fix tree
 *    suffixed collisions a1 -> a1-2 and grew the board on every re-import,
 *    measured 3n -> 6n -> 9n live). EDGE ids are the exception that keeps
 *    the suffix: the compiler MINTS them positionally per document (e1, e2
 *    …), so another document's `e1` is a different edge, not the same one —
 *    see `mergeEdges` for the id+endpoints identity.
 *  - `mergeById` is called from the React FUNCTIONAL updaters, so it sees
 *    the LIVE committed list, not the snapshot this handler closed over.
 *    That is what makes a repeated delivery of the same event (two active
 *    listeners, a double dispatch before the next render) a no-op instead
 *    of a second insert — the IMPORT-ONCE reservation set this module used
 *    to carry is retired: the merge subsumes it (a duplicate delivery
 *    cannot mint ids at all, so it cannot mint colliding ones).
 *  - the merge itself is ONE undo entry: the caller pushes history ONCE
 *    around it (src/useExportActions.ts). Nothing here touches history,
 *    storage or the DOM — this module is React-free and pure, which is what
 *    lets the harness reason about it without a browser.
 */
import type {Node, Edge} from '@xyflow/react';

export type GobiInsert = {nodes: Node[]; edges: Edge[]};

/** IMPORT-DUP — one entry per id, LAST wins: a document that repeats an id
 *  inserts it exactly once (the survivor is the document's own last word). */
function dedupeById<T extends {id: string}>(items: T[]): T[] {
  const byId = new Map<string, T>();
  for (const it of items) byId.set(it.id, it);
  return [...byId.values()];
}

/** IMPORT-DUP — the canvas-side merge for NODES, id-keyed. An incoming entry
 *  whose id the current list already owns REPLACES it in its slot (order
 *  preserved); unseen ids append. parentId references pass through verbatim
 *  — after this merge every source id exists exactly once, so no reference
 *  rewriting is needed (the pre-fix remap existed only to repair suffixed
 *  ids). Node ids are AUTHORED (the author chose them), so the id alone is
 *  the identity. */
export function mergeById<T extends {id: string}>(current: T[], incoming: T[]): T[] {
  const byId = new Map<string, T>();
  for (const it of current) byId.set(it.id, it);
  for (const it of incoming) byId.set(it.id, it);
  return [...byId.values()];
}

/** IMPORT-DUP — the canvas-side merge for EDGES, which needs more than the
 *  id: the compiler MINTS edge ids positionally per document (`e1`, `e2` …
 *  gobiCompiler.ts), so two different documents both carry an `e1` that is
 *  not the same edge. The identity is id AND endpoints: the same id joining
 *  the same pair is the same edge (a re-import updates it in place, never
 *  duplicates), while the same id on a DIFFERENT pair is a different edge
 *  and takes the first free `-N` suffix — the append behaviour a genuinely
 *  colliding id always had. */
export function mergeEdges<T extends {id: string; source: string; target: string}>(current: T[], incoming: T[]): T[] {
  const out = [...current];
  const taken = new Set(out.map((e) => e.id));
  for (const e of incoming) {
    const hit = out.findIndex((c) => c.id === e.id && c.source === e.source && c.target === e.target);
    if (hit >= 0) {
      out[hit] = e;
      continue;
    }
    let id = e.id;
    let n = 2;
    while (taken.has(id)) id = `${e.id}-${n++}`;
    taken.add(id);
    out.push({...e, id});
  }
  return out;
}

/** The insert's pure half: the compiled board with every id appearing
 *  exactly once and every id still the author's own. The canvas half of the
 *  merge (what replaces what) is `mergeById` in the caller's updaters. */
export function gobiInsert(
  board: {nodes?: Node[] | null; edges?: Edge[] | null},
): GobiInsert {
  return {
    nodes: dedupeById(board.nodes ?? []),
    edges: dedupeById(board.edges ?? []),
  };
}
