/* APP-SPLIT t_b2cad7a8 (S5) — the idc counter, moved verbatim from App.tsx
   (module-level there, module-level here). Its read set (the counter + the
   two state refs) is DISJOINT from paletteInsert's 10-value insert ctx, so
   two modules, not one. FOUR doors and nothing else:
   - makeNextId — mint n<k>, skipping any id still live on the canvas
   - bumpIdc   — board-load advance (Math.max, never below the board)
   - setIdc    — absolute set (import/Mermaid may legally rewind; the
                 nextId guard makes any rewind safe)
   - mintColId — intra-node column ids, raw by design (DUP-ID note below) */
import type {Node, Edge} from '@xyflow/react';

/* DUP-ID (t_0be8c968, 2026-11-12) — `idc` below is MODULE-LEVEL: a Vite HMR
   re-eval of this module rewinds it to 100 while React state keeps the
   loaded board, and the next blind n-prefixed mint re-mints an id the board
   already carries — measured live on "ERP Test" (n100/n101/n102 table+goblin,
   React Flow silently rendered 11 of 14 nodes). NEVER mint blind: skip any k
   whose n-/e-prefixed id is still live in the CURRENT state, so no counter
   rewind (HMR today, any setter tomorrow) can write a duplicate. Column ids
   (`c${idc++}`) are intra-node data with no render loss and stay raw. */
export let idc = 100;

/* the mint guard — the body App had, behind a factory so the two state refs
   stay owned by the render that created them; same name, same scope depth */
export const makeNextId = (nodesRef: {current: Node[]}, edgesRef: {current: Edge[]}) => () => {
  for (;;) {
    const k = idc++;
    /* node and edge ids live in SEPARATE React Flow namespaces — each mint
       only has to avoid ids of its own kind */
    if (!nodesRef.current.some(n => n.id === `n${k}`)
      && !edgesRef.current.some(e => e.id === `e${k}`)) return k;
  }
};

/* applyBoard's two board-scan loops bump through here */
export const bumpIdc = (v: number) => { idc = Math.max(idc, v); };

/* onImportFile's max-computed local set + useExportActions' post-Mermaid set */
export const setIdc = (v: number) => { idc = v; };

/* intra-node column ids — raw by design (DUP-ID note above) */
export const mintColId = () => `c${idc++}`;
