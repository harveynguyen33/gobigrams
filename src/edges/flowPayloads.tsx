/* ROUND BN-4 — one slice of the former `src/GoblinEdge.tsx` (split verbatim, 2026-10-25). src/edges/index.ts re-exports the component and the type registry, so `import ... from './GoblinEdge'` is unchanged. */
import {useMemo} from 'react';
import {FLOW_ICON_PATHS} from '../nodes/flowIcons';

/* K2 (ROUND BN-4) — the animated payload machinery, verbatim from
   GoblinEdge.tsx: the random start offset, the stagger and the SMIL subtree.
   One hook so the renderer body reads as render code, not generator code. */
export function useFlowPayloads(args: {
  path: string; id: string; flow: string; flowCount: number; flowDur: number;
  stroke: string; flowIcon: string | undefined;
}) {
  const {path, id, flow, flowCount, flowDur, stroke} = args;
  const flowIcon = args.flowIcon;
  // K2: each edge gets its own random 0–1s start offset so parallel edges do
  // not animate in lockstep. Stable for the lifetime of the edge.
  const randomDelay = useMemo(() => Math.random(), []);

  /* ROUND AK, AK-13 — DOUBLE-CLICKING THE LINE ITSELF is handled at the EDGE
     GROUP, by React Flow's own `onEdgeDoubleClick` (see `App`). It is NOT wired
     here, and the reason is structural rather than an omission:

       * React Flow renders ONE `<g class="react-flow__edge">` per edge and puts
         the double-click handler on it, so the library already covers the whole
         edge — the authored stroke, and the 26px `interactionWidth` band
         `BaseEdge` draws above it that a finger actually lands on. A handler on
         the authored `<path>` alone would sit UNDER that band and, being painted
         first, would rarely receive the event at all.
       * The `pointer-events: visibleStroke` test on that group IS the hit-test
         AK-13 asks for ("hit-test the double-click position against the edge's
         own resolved path"). Re-deriving it in JS would be a second, divergent
         copy of a rule the library owns and this app already depends on.
       * The "inside an existing label's box" exclusion is done by the DOM, not
         by arithmetic: the label is painted by `EdgeLabelRenderer` into
         `.react-flow__edgelabel-renderer`, a SIBLING of the edge layer, so its
         own `onDoubleClick` (above) catches that case and the event never
         reaches the edge group. That is exactly the exclusion draw.io makes
         before creating a new label.

     What this component contributes is the OTHER half of AK-13: the editor that
     the group's double-click opens (`__editAt` above), and the position the
     commit stores when the label is created and left empty. */

  /** K2: stagger `i` of `n` payloads — random edge offset + even spacing. */
  const begin = (i: number) => `${(randomDelay + (flowDur / flowCount) * i).toFixed(3)}s`;

  // K2: the SMIL subtree is rebuilt only when the geometry or the flow props
  // actually change (React Flow re-runs the edge body on every pan/zoom tick).
  const payloads = useMemo(() => {
    if (flow !== 'dots' && flow !== 'icon') return null;

    /* ROUND AK, AK-16 — THE `event` BRANCH IS DELETED, AND SO IS ITS ENVELOPE.
       `flow:'event'` drew this 16×12 envelope while `flow:'icon'` with the
       `mail` glyph drew a 24×20 chip carrying... an envelope. Two names, one
       picture. The option is gone from the panel and `migrateEdge` folds a
       stored `event` onto `icon` + `mail` on READ, so the old envelope is now
       drawn by the `icon` branch's `FLOW_ICON_PATHS.mail` glyph and needs no
       code of its own here. Dead code left "just in case" is how a removed
       option comes back. */

    return Array.from({length: flowCount}).map((_, i) => {
      const motion = (
        // `dur` MUST be a SMIL time string — a bare number is parsed as seconds.
        <animateMotion
          dur={`${flowDur}s`}
          repeatCount="indefinite"
          path={path}
          begin={begin(i)}
          rotate={flow === 'dots' ? 'auto' : '0'}
        />
      );
      if (flow === 'dots') {
        return (
          <g key={i} className="edge-flow-dot"
            style={{filter: `drop-shadow(0 0 4px ${stroke})`}}>
            {motion}
            <circle r={3} fill={stroke} />
          </g>
        );
      }
      return (
        <g key={i} className="edge-flow-icon">
          {motion}
          {/* a small chip carrying an icon glyph — "a message being delivered" */}
          <rect x={-12} y={-10} width={24} height={20} rx={5}
            fill="var(--elevated)" stroke={stroke} strokeWidth={1.6} />
          <g transform="translate(-7,-7) scale(0.6)" fill="none"
            stroke={stroke} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            {FLOW_ICON_PATHS[flowIcon ?? 'mail']}
          </g>
        </g>
      );
    });
  }, [path, id, flow, flowCount, flowDur, stroke, randomDelay, flowIcon]);
  return payloads;
}
