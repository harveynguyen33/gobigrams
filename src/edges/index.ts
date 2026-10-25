/* ROUND BN-4 — one slice of the former `src/GoblinEdge.tsx` (split verbatim, 2026-10-25). src/edges/index.ts re-exports the component and the type registry, so `import ... from './GoblinEdge'` is unchanged. */
import GoblinEdge from './GoblinEdge';

/* The type registry, verbatim from the tail of the former GoblinEdge.tsx. The
   four conventional path ids all render the same editable component, so
   switching curvature never loses the styled label. */
export const edgeTypes = {
  goblinEdge: GoblinEdge,
  bezier: GoblinEdge,
  smoothstep: GoblinEdge,
  step: GoblinEdge,
  straight: GoblinEdge,
};

/** Every edge type this app registers. */
export const EDGE_TYPES = ['goblinEdge', 'bezier', 'smoothstep', 'step', 'straight'] as const;

export {GoblinEdge};
export * from './EdgeData';
