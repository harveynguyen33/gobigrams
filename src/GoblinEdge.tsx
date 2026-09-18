import {memo, useEffect, useMemo, useRef, useState} from 'react';
import {
  BaseEdge, EdgeLabelRenderer,
  getBezierPath, getSmoothStepPath, getStraightPath,
  type EdgeProps,
} from '@xyflow/react';
import {COLOR_VAR, type ColorKey} from './colors';

/**
 * Inline SVG paths for the flow-icon animation. 24×24 viewBox, stroke geometry
 * drawn by hand (mail / package / file / zap / settings / database) so the
 * travelling chip needs no external dependency and inherits the edge colour.
 */
const FLOW_ICON_PATHS: Record<string, React.ReactNode> = {
  // envelope / letter
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  package: (
    <>
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="M3.3 7 12 12l8.7-5" />
      <path d="M12 22V12" />
    </>
  ),
  file: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </>
  ),
  zap: <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M2 12h3m14 0h3M4.9 19.1 7 17m10-10 2.1-2.1" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </>
  ),
};

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

  const d = (data ?? {}) as {
    shape?: string;
    offset?: 'center' | 'start' | 'end';
    flow?: 'none' | 'dots' | 'dash' | 'pulse' | 'icon' | 'event';
    flowIcon?: 'mail' | 'package' | 'file' | 'zap' | 'settings' | 'database';
    flowCount?: number;
    flowDuration?: number;
    /** L1: symbolic stroke key — resolved per theme. */
    strokeKey?: ColorKey;
    /** L1: literal user-typed hex fallback. */
    color?: string;
    /** L3b: C4 relationship technology, rendered dim after the label. */
    techn?: string;
    onCommitLabel?: (id: string, v: string) => void;
    /** F2: timestamp signal from the context menu to open the label editor */
    __edit?: number;
    /** FB-L: review mode, threaded through per-edge data exactly like `__type`.
     *  The label stays readable; its editor must stay shut. */
    readOnly?: boolean;
  };

  /** FB-L: one reader for the mode, used by both editor entry points. */
  const ro = !!d.readOnly;

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
  try {
    if (kind === 'straight') {
      [path, labelX, labelY] = getStraightPath(pathOpts);
    } else if (kind === 'step') {
      [path, labelX, labelY] = getSmoothStepPath({...pathOpts, borderRadius: 0});
    } else if (kind === 'smoothstep') {
      [path, labelX, labelY] = getSmoothStepPath({...pathOpts, borderRadius: 12});
    } else {
      [path, labelX, labelY] = getBezierPath(pathOpts);
    }
  } catch {
    [path, labelX, labelY] = getStraightPath(pathOpts);
  }

  const labelOffset = {center: 0.5, start: 0.25, end: 0.75}[d.offset ?? 'center'];
  const lx = sourceX + (targetX - sourceX) * labelOffset + (labelX - (sourceX + targetX) / 2);
  const ly = sourceY + (targetY - sourceY) * labelOffset + (labelY - (sourceY + targetY) / 2);

  useEffect(() => {
    if (editing) window.setTimeout(() => input.current?.select(), 10);
  }, [editing]);

  const commit = () => {
    const v = draft.trim();
    d.onCommitLabel?.(id, v);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(typeof label === 'string' ? label : '');
    setEditing(false);
  };

  const shown = typeof label === 'string' ? label : '';

  // --- flow animation -----------------------------------------------------
  // "message being sent": dots/pulses travel along the exact edge path.
  // Uses SVG <animateMotion> along `path` (React Flow's recommended technique),
  // so it works for every curvature and needs no extra library.
  // L1: the stroke is symbolic — a key resolved to var(--c-*) here, so a theme
  // change recolours the path, the payload filters and the envelope flap with
  // no data edit at all. A literal hex (the custom escape hatch) still wins.
  const stroke = (d.strokeKey ? COLOR_VAR[d.strokeKey] : (props.style as any)?.stroke) ?? COLOR_VAR.slate;
  const flow = d.flow ?? 'none';
  const flowCount = Math.max(1, Math.min(6, d.flowCount ?? 3));
  const flowDur = Math.max(0.6, Math.min(8, d.flowDuration ?? 2.4));

  // K2: each edge gets its own random 0–1s start offset so parallel edges do
  // not animate in lockstep. Stable for the lifetime of the edge.
  const randomDelay = useMemo(() => Math.random(), []);

  /** K2: stagger `i` of `n` payloads — random edge offset + even spacing. */
  const begin = (i: number) => `${(randomDelay + (flowDur / flowCount) * i).toFixed(3)}s`;

  // K2: the SMIL subtree is rebuilt only when the geometry or the flow props
  // actually change (React Flow re-runs the edge body on every pan/zoom tick).
  const payloads = useMemo(() => {
    if (flow !== 'dots' && flow !== 'icon' && flow !== 'event') return null;

    // 16×12 "message being delivered" envelope: rounded rect + flap.
    const envelope = (
      <>
        <rect x={-8} y={-6} width={16} height={12} rx={1.5}
          fill={stroke} stroke="none" />
        <path d="M-8,-6 L0,0.5 L8,-6" fill="none"
          stroke="var(--card, var(--bg))" strokeWidth={1.3}
          strokeLinecap="round" strokeLinejoin="round" />
      </>
    );

    return Array.from({length: flowCount}).map((_, i) => {
      const motion = (
        // `dur` MUST be a SMIL time string — a bare number is parsed as seconds.
        <animateMotion
          dur={`${flowDur}s`}
          repeatCount="indefinite"
          path={path}
          begin={begin(i)}
          rotate={flow === 'dots' || flow === 'event' ? 'auto' : '0'}
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
      if (flow === 'event') {
        return (
          <g key={i} className="edge-flow-event"
            style={{filter: `drop-shadow(0 1px 2px rgba(0,0,0,.6))`}}>
            {motion}
            {envelope}
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
            {FLOW_ICON_PATHS[d.flowIcon ?? 'mail']}
          </g>
        </g>
      );
    });
  }, [path, id, flow, flowCount, flowDur, stroke, randomDelay, d.flowIcon]);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerStart={props.markerStart}
        markerEnd={props.markerEnd}
        style={props.style}
        interactionWidth={26}
      />

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

      {(shown || editing || d.techn) && (
        <EdgeLabelRenderer>
          <div
            className={`edge-label${selected ? ' selected' : ''}${editing ? ' editing' : ''}`}
            data-edge-id={id}
            style={{transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`}}
            onDoubleClick={e => {
              e.stopPropagation();
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
        </EdgeLabelRenderer>
      )}
    </>
  );
});

GoblinEdge.displayName = 'GoblinEdge';

/** Registry injected into ReactFlow. The four conventional path ids all render the
 *  same editable component, so switching curvature never loses the styled label. */
export const edgeTypes = {
  goblinEdge: GoblinEdge,
  bezier: GoblinEdge,
  smoothstep: GoblinEdge,
  step: GoblinEdge,
  straight: GoblinEdge,
};

/** Every edge type this app registers. */
export const EDGE_TYPES = ['goblinEdge', 'bezier', 'smoothstep', 'step', 'straight'] as const;

export default GoblinEdge;
