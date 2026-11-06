/* CORE-STEP4A-FIX (2026-11-05) — the package's OWN flow-node/edge vocabulary.
 *
 * WHY: the moved model modules (layout, the presets, adapterCanvas, the
 * compiler) typed their surfaces with `Node`/`Edge` from '@xyflow/react' —
 * type-only, but the emitted .d.ts dragged @xyflow/react into every consumer's
 * type-check. The core has no React Flow dependency at all; these structural
 * mirrors are its whole contract with the canvas.
 *
 * COMPATIBILITY (both directions, by construction): every field below is
 * either required-with-the-same-shape (id/position/data, id/source/target) or
 * an optional subset typed compatibly with React Flow's own declarations
 * (NodeBase/EdgeBase + the react-layer extras are ALL optional). The app
 * passes real RF nodes/edges in; the package hands RF-shaped documents back;
 * tsc structural checks pass on both sides without @xyflow/react present.
 * The one deliberate narrowing: FlowMarker.type is the marker string union
 * from ./markers (the only two marker words a board can store), so a
 * package-made markerEnd stays assignable to RF's EdgeMarkerType.
 */

/** Structural mirror of `Position`-typed point (no import needed). */
export type FlowPosition = {x: number; y: number};

/** The marker END an edge may carry: a marker word or a shaped marker. */
export type FlowMarker = {
  type: 'arrow' | 'arrowclosed';
  color?: string;
  width?: number;
  height?: number;
  orient?: string;
  markerUnits?: string;
};

/** RF's `EdgeMarkerType` (string | EdgeMarker), without the dependency. */
export type FlowEdgeMarker = string | FlowMarker;

/** Stroke style fields the model writes; a compatible subset of CSSProperties. */
export type FlowStrokeStyle = {
  stroke?: string;
  strokeWidth?: number | string;
  strokeDasharray?: number | string;
};

/** Node style: the model stamps initial size (width/height) and stroke fields;
 * a compatible subset of CSSProperties in both directions. */
export type FlowNodeStyle = FlowStrokeStyle & {
  width?: number | string;
  height?: number | string;
};

/**
 * Structural mirror of React Flow's `Node` (NodeBase + the react-layer
 * extras, all optional): the shape the model layer reads and writes.
 */
export type FlowNode<Data extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  position: FlowPosition;
  data: Data;
  type?: string;
  width?: number;
  height?: number;
  initialWidth?: number;
  initialHeight?: number;
  parentId?: string;
  hidden?: boolean;
  selected?: boolean;
  dragging?: boolean;
  draggable?: boolean;
  selectable?: boolean;
  connectable?: boolean;
  deletable?: boolean;
  dragHandle?: string;
  zIndex?: number;
  extent?: 'parent' | [[number, number], [number, number]] | null;
  expandParent?: boolean;
  origin?: [number, number];
  ariaLabel?: string;
  measured?: {width?: number; height?: number};
  style?: FlowNodeStyle;
  className?: string;
};

/**
 * Structural mirror of React Flow's `Edge` (EdgeBase + the react-layer
 * extras, all optional). Label fields are deliberately absent: the model
 * layer never reads them (edge labels live in `data` here), and omitting
 * them keeps RF→FlowEdge assignment sound for every label value.
 */
export type FlowEdge<Data extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  source: string;
  target: string;
  type?: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: Data;
  /* OPAQUE PASSTHROUGH: React Flow types a label as ReactNode; the package
   * must not import react types, and app edges flow INTO package functions
   * while package edges flow back into RF state — both directions assign
   * only through this mirror. Every label this codebase writes is a string;
   * the model only stringifies it (the label width estimator). */
  label?: any;
  markerStart?: FlowEdgeMarker;
  markerEnd?: FlowEdgeMarker;
  animated?: boolean;
  hidden?: boolean;
  selected?: boolean;
  selectable?: boolean;
  deletable?: boolean;
  zIndex?: number;
  ariaLabel?: string;
  style?: FlowStrokeStyle;
  className?: string;
};
