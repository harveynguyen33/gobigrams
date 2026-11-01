/* RotateInternalsBridge.tsx — ROTATE-FIX: the handle re-measure BRIDGE.
 *
 * WHY A BRIDGE AT ALL. `updateNodeInternals` is the ONLY way React Flow
 * re-reads a node's handle bounds (a `data` change never does), and its hook
 * reads the store from REACT CONTEXT — so it throws "Seems like you have not
 * used ReactFlowProvider as an ancestor" anywhere above `<ReactFlow>`.
 * The rotation WRITER (`src/useRotation.ts`) is invoked in App, which is
 * exactly that place: App renders `<ReactFlow>` itself.
 *
 * So the hook is called HERE, inside the flow, and the updater is handed up
 * through `onReady`. App stores it in a ref and passes the ref INTO
 * useRotation, which keeps the one decision that matters — WHEN to re-measure
 * (after every rotation write, once per group member) — at the write site
 * rather than smeared across node renderers.
 *
 * AND IT WATCHES. useRotation is not the only writer of `data.rotation`:
 * undo/redo restore a whole node array, so a rotation undone from the toolbar
 * `d` never goes through that hook. Measured live on this round: after
 * Undo the node was back at 57.31° while the edge still started at the 115°
 * port — the exact symptom this round exists to kill, one code path over.
 * The effect below therefore re-measures every node whose rotation VALUE
 * changed, whatever wrote it. It runs AFTER the commit (React effects fire
 * post-paint), so the transform it measures is the one on screen.
 *
 * It renders a fragment: React Flow's children/DOM are unchanged.
 */
import {useEffect, useRef} from 'react';
import {useStore, useUpdateNodeInternals} from '@xyflow/react';

/** The updater's shape — one id or a list, measured in a rAF by the hook. */
export type UpdateInternals = (ids: string | string[]) => void;

/** The rotation of every node, as one comparable string. `useStore` compares
 *  the selector's result, so an unchanged board never re-renders this. */
const rotationKey = (n: {id: string; data: Record<string, unknown>}) =>
  `${n.id}@${(n.data as {rotation?: number}).rotation ?? 0}`;

export function RotateInternalsBridge({onReady}: {onReady: (update: UpdateInternals) => void}) {
  const update = useUpdateNodeInternals();
  const sig = useStore(s => s.nodes.map(rotationKey).join('|'));
  const seen = useRef(new Map<string, number>());
  useEffect(() => { onReady(update); }, [update, onReady]);
  useEffect(() => {
    const changed: string[] = [];
    for (const part of sig.split('|')) {
      if (!part) continue;
      const at = part.lastIndexOf('@');
      const id = part.slice(0, at), deg = Number(part.slice(at + 1));
      if (seen.current.get(id) !== deg) { seen.current.set(id, deg); changed.push(id); }
    }
    if (changed.length) update(changed);
  }, [sig, update]);
  return <></>;
}
