import {memo, useEffect, useMemo, useRef, useState} from 'react';
import {
  BaseEdge, EdgeLabelRenderer,
  getBezierPath, getSmoothStepPath, getStraightPath,
  useStore,
  type EdgeProps,
} from '@xyflow/react';
import {COLOR_VAR, type ColorKey} from './colors';
import {
  // ROUND S — the midpoint drag. `bendSupport` is the SAME gate the inspector's
  // slider uses (moved into `edgeBend`, and now reached with the geometry this
  // component already holds), so the two controls agree by construction.
  bendGate, bendRender, drawnMid, needsCustom,
  type BendAxis, type BendGeo, type BendPhase, type Pt, type Side4,
} from './edgeBend';

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
  /** ROUND S — the pane this edge is drawn in: the drag converts pointer
   *  positions against its rect, and the element is found from the handle
   *  itself rather than from a prop, because an edge component is rendered by
   *  React Flow and is handed no viewport reference. */
  const paneRef = useRef<HTMLDivElement | null>(null);
  /** The live `[x, y, zoom]` — the same store value React Flow's own
   *  `screenToFlowPosition` reads, and the same one the label's counter-scale
   *  below needs. Subscribing here re-renders on pan/zoom only, exactly like
   *  every other edge on the canvas. */
  const t = useStore(s => s.transform);

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
    /** STEP 1 (2026-09-18): where the step's cross-bar sits along the split
     *  axis — the fraction `getSmoothStepPath` calls `stepPosition` (0..1).
     *  Only the step / smoothstep generators have this parameter at all.
     *  ABSENT (not 0.5) is the default on purpose: `stepPosition: undefined`
     *  resolves to React Flow's own 0.5 default inside the generator, so a
     *  board that has never carried a `bend` renders byte-identical. */
    bend?: number;
    /** ROUND S (2026-09-18): the ABSOLUTE point the midpoint was dragged to,
     *  one key per axis, and only ever the axis the drag owns — see
     *  `edgeBend.dragPatch`. Absent means "never dragged". */
    bendX?: number;
    bendY?: number;
    /** ROUND S: the drag callback, threaded per-edge exactly like
     *  `onCommitLabel` — the handler lives in `App` because it writes `edges`
     *  state; this component only reports where the pointer went. */
    __onBend?: (id: string, W: Pt, phase: BendPhase) => void;
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

  /* ROUND S — the geometry this edge was handed, in the shape `edgeBend` models.
     `sourcePosition`/`targetPosition` ARE the `Side4` values (React Flow hands
     the edge the `Position` of each end), so no lookup is needed. */
  const bGeo: BendGeo | null = kind === 'step' || kind === 'smoothstep'
    ? {
        s: {x: sourceX, y: sourceY}, t: {x: targetX, y: targetY},
        sp: sourcePosition as Side4, tp: targetPosition as Side4,
      }
    : null;
  /* The gate — the same predicate that enables the inspector's slider. `axis` is
     the coordinate the drag owns on this geometry. */
  const bendInfo = useMemo(
    () => (bGeo ? bendGate(bGeo) : {active: false, axis: null as BendAxis | null}),
    [kind, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition],
  );
  /** The drag is offered only on an edge whose bend reaches the path, and never
   *  in review mode — the handle is an editing affordance (FB-L).
   *
   *  AND ONLY ON THE SELECTED EDGE. This is draw.io's and Excalidraw's own
   *  entry rule ("click the line, handles appear"), and it is a deliberate
   *  ORCHESTRATOR correction of the first implementation, which offered a
   *  fully-opaque handle on every step/smoothstep edge at once. Measured
   *  consequence of that: a two-orange-dot board at rest, each dot sitting
   *  exactly ON its edge's label — the handle is painted at the path's
   *  `labelX`/`labelY`, which IS the label's anchor — so the resting canvas
   *  gained a dot over every label before the user had clicked anything.
   *
   *  `selected` is React Flow's own per-edge selection flag, so this adds no
   *  new state: the click that selects the edge is also the click that reveals
   *  the handle, in one gesture and with no second source of truth. */
  const bendDraggable = bendInfo.active && !ro && !!selected;
  /** The point the edge is DRAWN through right now: the stored coordinate on the
   *  axis the drag owns, the step-position fraction `bend` if the slider set one,
   *  and the generator's own 0.5 midpoint otherwise. */
  const W: Pt | null = bGeo ? drawnMid(bGeo, d.bendX, d.bendY, d.bend) : null;
  // ROUND S — where the drag handle is drawn: the generator's own midpoint for
  // this edge, which is what `bendRender` returns as `labelX`/`labelY` and what
  // the label above is positioned on. On an untouched edge that is the middle of
  // the line (the synthesised point draw.io starts the user from), so the handle
  // cannot appear anywhere the line does not go.

  // STEP 1: the bend position is passed THROUGH, never defaulted here.
  // `getSmoothStepPath`'s own signature defaults `stepPosition = 0.5`
  // (@xyflow/system index.js:1411), and it reads the value only inside the
  // opposite-handle branch (:1263). An edge with no stored `bend` therefore
  // hands over `undefined`, the generator substitutes 0.5, and every existing
  // board's path is unchanged — which is the whole reason this is passed as
  // `undefined` rather than an explicit 0.5.
  const stepPosition = d.bend;
  /* ROUND S — HOW THE TWO ROUTES ARE KEPT APART, because they must not disagree:

     A bend-capable edge with NO stored point takes the GENERATOR route below,
     with `stepPosition` exactly as before — so a board that has never been
     dragged renders byte-identical (harness (a)). A point exists only once the
     user has dragged, and from then on the path goes through `bendRender`, which
     passes the same generator an explicit centre AND takes its label from that
     same call — so the label and the handle sit ON the line the user dragged,
     instead of on the fraction the generator stopped reading. */
  try {
    if (kind === 'straight') {
      [path, labelX, labelY] = getStraightPath(pathOpts);
    } else if (kind === 'step') {
      if (bGeo && bendInfo.active) {
        const r = bendRender(bGeo, W!, 0, needsCustom(bGeo, d.bendX, d.bendY));
        [path, labelX, labelY] = [r.path, r.labelX, r.labelY];
      } else {
        [path, labelX, labelY] = getSmoothStepPath({...pathOpts, borderRadius: 0, stepPosition});
      }
    } else if (kind === 'smoothstep') {
      if (bGeo && bendInfo.active) {
        const r = bendRender(bGeo, W!, 12, needsCustom(bGeo, d.bendX, d.bendY));
        [path, labelX, labelY] = [r.path, r.labelX, r.labelY];
      } else {
        [path, labelX, labelY] = getSmoothStepPath({...pathOpts, borderRadius: 12, stepPosition});
      }
    } else {
      [path, labelX, labelY] = getBezierPath(pathOpts);
    }
  } catch {
    [path, labelX, labelY] = getStraightPath(pathOpts);
  }

  // The handle's own position: the path's midpoint, which is the label's own
  // anchor and the point on the line the user grabs.
  const handleAt = {x: labelX, y: labelY};

  /** ROUND S — pointerdown on the midpoint handle, draw.io's mechanic.
   *
   *  ONE history entry at the START of the gesture (`App.onBend`), never per
   *  move. `stopPropagation` keeps React Flow's own edge click handler out of
   *  the gesture; the pointer is captured so a fast drag survives leaving the
   *  14px disc, and the listeners live on `document` because this element is
   *  re-rendered by every write the drag itself triggers. */
  const onBendDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const cb = d.__onBend;
    if (!cb || !bGeo || !bendInfo.active) return;
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    cb(id, {x: 0, y: 0}, 'start');
    /** Client → flow coordinates. The DOM rect is the PANE's (see the note by
     *  the viewport `ref` in App), and RF's own `transform` is exactly the
     *  `[x, y, zoom]` that maps flow coords into it, so this is RF's own
     *  `screenToFlowPosition` arithmetic without needing the instance. */
    const toFlow = (ev: PointerEvent): Pt | null => {
      const b = paneRef.current?.getBoundingClientRect();
      if (!b) return null;
      return {x: (ev.clientX - b.left - t[0]) / t[2], y: (ev.clientY - b.top - t[1]) / t[2]};
    };
    const move = (ev: PointerEvent) => {
      const p = toFlow(ev);
      if (p) cb(id, p, 'move');
    };
    const up = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      el.releasePointerCapture?.(ev.pointerId);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  };

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

      {(shown || editing || d.techn || bendDraggable) && (
        <EdgeLabelRenderer>
          {/* ROUND S — the draggable midpoint, draw.io's mechanic: a SYNTHESISED
              point, so even an edge that has never stored a waypoint is
              immediately draggable, and a drag that moves along ONE axis (the
              other coordinate is inherited from the line) so the result stays
              square. Counter-scaled by `1/zoom` inside the transform like the
              label: the hit target stays the same size on screen at every zoom,
              and scaling about the element's own centre avoids the
              transform-origin footgun the node resize grips work around. The
              invisible `::after` ring in the stylesheet takes it to a ~32px tap
              target. */}
          {bendDraggable && (
            <div
              /* the pane is walked up to here rather than passed down: an edge
                 component receives no viewport ref */
              ref={el => {paneRef.current = el?.closest('.react-flow__pane') as HTMLDivElement | null;}}
              className="edge-bend-handle"
              data-edge-id={id}
              title="Drag to bend this line"
              style={{transform: `translate(-50%,-50%) translate(${handleAt.x}px, ${handleAt.y}px) scale(${1 / t[2]})`}}
              onPointerDown={onBendDown}
            />
          )}
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
