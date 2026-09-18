import {useCallback, useEffect, useMemo, useState, useRef} from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, Panel, addEdge, useNodesState, useEdgesState,
  MarkerType, useStore, reconnectEdge, PanOnScrollMode, ConnectionMode,
  type Connection, type Node, type Edge, type NodeChange, type EdgeChange,
  type ReactFlowInstance, type XYPosition,
} from '@xyflow/react';
import {toPng} from 'html-to-image';
import {
  Undo2, Redo2, Maximize, Magnet, Copy, Upload, Download,
  Image, FileJson, ChevronDown, ChevronLeft, ChevronRight, FileCode, Trash2,
  LayoutGrid, Plus, Pencil, Save, Waypoints, AlignCenter,
  PanelLeftClose, PanelRightClose, Eye,
  Settings as SettingsIcon,
} from 'lucide-react';
import '@xyflow/react/dist/style.css';

import DiagramNode, {type NodeKind} from './DiagramNode';
import LabelNode, {type LabelKind} from './LabelNode';
import TableNode, {relHandleId, type TableColumn, type ShowMode} from './TableNode';
import {edgeTypes} from './GoblinEdge';
import IconPicker from './IconPicker';
import SearchPalette from './SearchPalette';
import BoardDialog, {type BoardDialogResult} from './BoardDialog';
import Tooltip from './Tooltip';
import {COLORS, COLOR_KEYS, COLOR_VAR, isColorKey, type ColorKey, resolveColor, resolveColorKey, keyForHex} from './colors';
import {SHAPES, SHAPE_IDS, asShape, ShapePreview, type Shape} from './shapes';
import {
  PRESETS, getPreset, asPreset, isPresetId, makeEdge, edgeColorPatch,
  LAYOUTS, C4, isC4Type, LIBRARY, DEFAULT_PRESET_ID,
  type PresetId, type DiagramPreset, type PathId,
} from './presets';
import {type PaletteItem} from './palette';
import {applyTheme, loadMode, hasStoredMode, resolveMode, isDarkTheme, saveMode, readToken, EXPORT_TOKENS, type Mode, type ThemeName} from './theme';
import * as boards from './boards';
import type {BoardDoc, BoardMeta} from './boards';
import ContextMenu, {type CtxTarget, type CtxAction} from './ContextMenu';
import Tour from './Tour';
import Checklist, {type ChecklistTaskId} from './Checklist';
import Settings from './Settings';
import {computeHelperSnap, type HelperGuides} from './helperLines';
import HelperLinesView from './HelperLinesView';
import {layoutDiagram} from './layout';
import {CrowFootDefs, cardinalityLabel, isCrowFoot, markerIdFor, type CrowFoot} from './crowfoot';
import {
  useHoverChoreography, useInteractionGuard, useLayoutTransition, useAnimationGating,
  useHoverHighlight,
  NO_ANIM, READ_ONLY, NO_PAN,
} from './choreography';
import {useEditorInterface} from './useEditorInterface';
import {
  useLongPress,
  COARSE_DRAG_THRESHOLD_PX,
  FINE_DRAG_THRESHOLD_PX,
  FINE_CONNECTION_DRAG_THRESHOLD_PX,
  FINE_NODE_CLICK_DISTANCE_PX,
  COARSE_NODE_CLICK_DISTANCE_PX,
} from './touch';
import {usePanelCollapse, isPanelHidden} from './panelCollapse';
import {searchLibrary, groupByCategory} from './paletteSearch';
import {
  useCategoryCollapse, CATEGORY_ORDER, CATEGORY_LABEL, defaultOpenCategory,
} from './categoryState';
/** PACKAGE-N pass 3 — the USER library client (§6 favourites / §7 store). NOT
 *  the shape `LIBRARY` above: that one is the 34-element constant, this one is
 *  the user's own starred document on disk. */
import * as library from './library';
/** PACKAGE-N pass 4b — the custom-shape NODE KIND (§8.1–§8.3). The shape
 *  pipeline lives in `./customShape`; this is only the canvas node + the
 *  library plumbing. `Shape` stays at 19 — `customshape` is a node type. */
import CustomShapeNode from './CustomShapeNode';
import {parseCustomShapeEntry, newCustomShape, svgDataUri, SHAPE_MAX_INPUT_BYTES, type CustomShape, type SvgRejectReason} from './customShape';

const nodeTypes = {goblin: DiagramNode, label: LabelNode, table: TableNode, customshape: CustomShapeNode};

/* PACKAGE-N §8.1 — the import rejection table, verbatim from the spec.
   Every message names the FIX where one exists: `no-viewbox`, `no-size` and
   `bad-size` are all the same repair ("re-export it with a viewBox and a
   size"), so they carry it; the rest are already the whole story. A Record
   keyed by `SvgRejectReason` makes the mapping total at compile time — adding a
   reason without a message is a type error, not a silent blank toast. */
const SHAPE_REJECT_MESSAGE: Record<SvgRejectReason, string> = {
  'too-large': 'That SVG is too large (limit 512 KB).',
  'not-xml': "That file isn't valid SVG markup.",
  'no-root-svg': 'That file has no <svg> root element.',
  'no-viewbox': "That SVG has no viewBox, so it can't be scaled. Re-export it with a viewBox and a size.",
  'bad-viewbox': "That SVG's viewBox is invalid.",
  'no-size': 'That SVG declares no width and height. Re-export it with a viewBox and a size.',
  'bad-size': "That SVG's width or height is zero or invalid. Re-export it with a viewBox and a size.",
  'empty-markup': 'That SVG is empty after sanitising.',
};

const MAX_HISTORY = 50;

/** React Flow's non-custom edge types; anything else renders through goblinEdge. */
const PATH_TYPES = {bezier: 'goblinEdge', custom: 'goblinEdge', smoothstep: 'smoothstep', step: 'step', straight: 'straight'} as const;
type PathType = keyof typeof PATH_TYPES;

/** Edges whose label-commit callback must be injected (all registered types). */
const isGoblinEdge = (t?: string) =>
  t === 'goblinEdge' || t === 'bezier' || t === 'smoothstep' || t === 'step' || t === 'straight';

/* Q — THE RECONNECT GRAB RADIUS. React Flow's `<ReactFlow>` prop `reconnectRadius`
   defaults to 10 (`@xyflow/react/dist/esm/index.js` — `reconnectRadius = 10` in the
   ReactFlow signature). 10px RADIUS around a point is a ~20px-wide target to hit
   blind, which is why the reconnect gesture was undiscoverable: the anchors are
   invisible (RF paints `stroke="transparent" fill="transparent"`), so the pointer
   had to land on an unseen 20px disc. 14 is DELIBERATELY MODEST — it buys ~2x the
   area without swallowing the neighbouring interactions, and the arithmetic below
   is why it cannot go larger.

   THE GRABBER IS SHIFTED, NOT CENTRED. `EdgeAnchor` (`…/react-flow/dist/esm/index.js`)
   renders `cx: shiftX(centerX, radius, position)` and `shiftX` returns `x + shift`
   for Position.Right (x - shift for Left; same shape for shiftY on Top/Bottom). So
   the disc is pushed radius OUTWARD along the endpoint's own side: its near edge is
   TANGENT to the endpoint, and the whole disc lies OUTSIDE the handle that owns it.
   That is what makes the "does the grabber eat its own connect handle" question exact.
   Worked through for BOTH sides of ONE wire junction, all in flow units with the wire
   attachment point at J = 0 (1:1 at zoom 1; every quantity is a flow length, so the
   ratio is zoom-invariant). J is where the left node's RIGHT-side wire meets the right
   node's LEFT-side wire:
     handle dot     12px wide, and RF centres it ON its own node's border, so the dot's
                    OUTER edge is exactly the wire's attachment point — J is the outer
                    edge of BOTH owning dots (RF getHandlePosition: Right => x + width,
                    Left => x; the dot is centred on the border, so both give J)
     RIGHT-side dot  [J - 12, J];  its disc `shiftX(centerX, R, Right)` = J + R => [J, J + 2R]
     LEFT-side dot   [J, J + 12];  its disc `shiftX(centerX, R, Left)`  = J - R => [J - 2R, J]
   So each disc is TANGENT to J and therefore TANGENT to its own node's connect dot —
   adjacent, never overlapping: the grabber cannot cover the handle it belongs to. The two
   discs over one junction are MIRRORS of each other sharing only the point J, so they can
   never coincide however large R grows (both are pushed outward, away from each other).
   ONE COST of the enlargement, stated because it is real: a disc reaches 2R = 28 from J,
   while the neighbouring node's border is only 6 away at the tightest usable spacing. The
   node's opaque body paints ABOVE the edge layer (RF renders `<EdgeRenderer>` before
   `<NodeRenderer>`, and nodes carry the higher z-index), and `.react-flow__handle` is
   `pointer-events: none`, so where a disc runs under a close neighbour the NODE wins both
   the paint and the hit test — the dot is simply clipped there, never a stolen click, and
   never a blocked connect handle. At the app's normal spacing there is no clipping at all:
   the demo board's nodes sit 377 apart.
   A drop inside the grabber is NOT "elementFromPoint returns a non-handle": the circle is
   `fill: transparent` and is never hit-tested, so the drop still resolves through
   elementFromPoint / getClosestHandle exactly as it did at the 10px default. Enlarging
   the radius cannot change WHICH element a drop lands on — it only changes whether the
   user can find the band at all, which is the whole point of the paint below.
   NEAREST CONNECT HANDLE vs AN INCOMING WIRE — this is the arm that actually bounds
   the value. Every wire in the demo board meets node LEFT and RIGHT midpoints. On ONE
   node the TOP / BOTTOM / end midpoints all SHARE an x, so the nearest handle that is
   NOT the endpoint is exactly H/2 away, for ANY node width — this arm is bounded by the
   node HEIGHT alone. React Flow persists the measured box into the board file, so the
   real numbers are 190 wide and 114-131 tall. At the smaller one H/2 = 57, so 14 clears
   the nearest connect handle with a 4.07x margin; the neighbouring wire's own endpoint
   is 175 away (borders at 137 and 324, endpoints at 143 and 318), an order of magnitude
   clear. THE VISUAL GAP is what makes the enlargement safe rather than merely hittable:
   the disc ends 28 from the junction, while the next node's border is 153 beyond that —
   at the app's normal spacing the disc sits in open canvas and never reaches a
   neighbour. 20 would spend that margin for no discoverability gain. */
const RECONNECT_RADIUS = 14;

/** G — the four connection points of the goblin node (src/DiagramNode.tsx
 *  NodeHandles). The onConnect direction guard is scoped to these: an ERD
 *  column handle is NOT in the set, so a relationship drag is never re-aimed. */
const GOBLIN_HANDLE_IDS: ReadonlySet<string> = new Set(['left', 'right', 'top', 'bottom']);

/** H3a: the seeded sample reads as a tiny pipeline — External → Queue → Service —
 *  L2: built through the preset's palette + edge factory, so the seed is the
 *  same shape of data a user creates. */
const initialNodes: Node[] = [
  {id: 'n1', type: 'goblin', position: {x: 60, y: 180}, data: PRESETS.architecture.palette[3].make() as any},
  {id: 'n2', type: 'goblin', position: {x: 360, y: 170}, data: PRESETS.architecture.palette[2].make() as any},
  {id: 'n3', type: 'goblin', position: {x: 680, y: 180}, data: PRESETS.architecture.palette[0].make() as any},
];
const initialEdges: Edge[] = [
  {...makeEdge('n1', 'n2', PRESETS.architecture.edges, 'e1'), label: 'events'},
  makeEdge('n2', 'n3', PRESETS.architecture.edges, 'e2'),
];

let idc = 100;

type Snap = {nodes: Node[]; edges: Edge[]};

/** Per-edge extras that are not part of React Flow's Edge type. */
type EdgeData = {
  shape?: string;
  offset?: 'center' | 'start' | 'end';
};

/* ---------------------------------------------------------------------------
   L1 — legacy-hex migration.

   Boards saved before the symbolic-colour refactor carry literal hex in
   `data.color`, `style.stroke` and `markerEnd.color`. Map the six known
   accents back onto keys (leaving genuinely custom hexes alone) so a theme can
   recolour an existing board without touching its content.
--------------------------------------------------------------------------- */
const migrateNode = (n: Node): Node => {
  const d = (n.data ?? {}) as any;
  const key = d.colorKey ?? keyForHex(d.color);
  if (!key) return n;
  const {color, ...rest} = d;
  return {...n, data: {...rest, ...(key ? {colorKey: key} : null)}};
};

/** G — the 4-point scheme removed the four CORNER handle ids. A board that
 *  still stores one in `sourceHandle` / `targetHandle` would otherwise fall
 *  back to React Flow's `bounds[0]` and re-aim silently, so each corner maps
 *  onto the NEAREST surviving side: the left half to `left`, the right half to
 *  `right`. Only the four removed ids are keys here — the four survivors and
 *  the ERD ids (`right_rel_o_id` / `left_rel_i_order`) are not, so they come
 *  back unchanged and the ERD guard below still returns early. */
const EDGE_HANDLE_REMAP: Record<string, string> = {
  'top-left': 'left',
  'bottom-left': 'left',
  'top-right': 'right',
  'bottom-right': 'right',
};

const remapEdgeHandle = (id: string | null | undefined): string | null | undefined =>
  id == null ? id : (EDGE_HANDLE_REMAP[id] ?? id);

const migrateEdge = (e: Edge): Edge => {
  // G: the handle remap runs FIRST, and the colour migration below works on
  // its result, so an edge with no legacy hex (the `!key` early return) still
  // comes back with its corner ids re-aimed.
  const m: Edge = {
    ...e,
    sourceHandle: remapEdgeHandle(e.sourceHandle),
    targetHandle: remapEdgeHandle(e.targetHandle),
  };
  const d = (m.data ?? {}) as any;
  const key = isColorKey(d.strokeKey)
    ? (d.strokeKey as ColorKey)
    : keyForHex((m.style as any)?.stroke) ?? keyForHex((m.markerEnd as any)?.color);
  if (!key) return m;               // a genuine custom hex is left alone
  // The literal is DROPPED, not kept alongside: the key is now the source of
  // truth and the render path resolves it, so a theme change actually recolours
  // the line. (`data.color` on an edge is the custom-hex escape hatch.)
  const style = {...(m.style as any)};
  if (keyForHex(style.stroke)) delete style.stroke;
  const out: Edge = {...m, style, data: {...d, strokeKey: key}};
  // the arrowhead colour must become the token too, otherwise it keeps the
  // legacy hex and a theme switch leaves it stale.
  if ((m.markerEnd as any)?.type && keyForHex((m.markerEnd as any).color)) {
    out.markerEnd = {...(m.markerEnd as any), color: COLOR_VAR[key]};
  }
  if ((m.markerStart as any)?.type && keyForHex((m.markerStart as any).color)) {
    out.markerStart = {...(m.markerStart as any), color: COLOR_VAR[key]};
  }
  return out;
};

/* ---------------------------------------------------------------------------
   B1 — explicit edge endpoints.

   React Flow's getEdgePosition resolves an endpoint through getHandle(bounds,
   handleId), which returns bounds[0] — the FIRST handle in DOM order — whenever
   the stored id is missing. For the goblin node (src/DiagramNode.tsx
   NodeHandles) that first-of-type is the node's own orientation side, so an
   edge stored without ids "means" that side. Now that every handle carries an
   id we write that meaning down, so adding further handles later cannot
   silently re-aim an existing edge.

   The connected NODE's own `data.handles` is the authority (the same rule
   DiagramNode.tsx applies: `d.handles === 'tb' ? 'tb' : 'lr'`); a missing
   field renders `lr`, so it migrates to `lr`. The board preset is NOT consulted.

   B2 — the field is DATA, never UI: the inspector's orientation control is gone
   because all 8 points are exposed at once now, but `data.handles` and the
   HandleMode type stay because this migration is their last reader and stored
   boards still carry the key. Both id pairs it resolves to — right/left and
   bottom/top — are still spelled and positioned exactly as B1 left them, so an
   edge written under B1 lands on the same pixel under B2.
--------------------------------------------------------------------------- */
const handleSidesOf = (n: Node | undefined): {source: string; target: string} =>
  ((n?.data ?? {}) as any).handles === 'tb'
    ? {source: 'bottom', target: 'top'}
    : {source: 'right', target: 'left'};

/** Fill in an endpoint that was never stored. An endpoint that already carries
 *  an explicit handle id (an ERD relationship: `right_rel_o_id` /
 *  `left_rel_i_order`) is passed through byte-identical. */
const migrateEdgeEnds = (e: Edge, nodes: Node[]): Edge => {
  if (e.sourceHandle != null && e.targetHandle != null) return e;
  const ends = handleSidesOf(nodes.find(n => n.id === e.source));
  const tEnds = handleSidesOf(nodes.find(n => n.id === e.target));
  return {
    ...e,
    sourceHandle: e.sourceHandle ?? ends.source,
    targetHandle: e.targetHandle ?? tEnds.target,
  };
};

const migrateDoc = (doc: BoardDoc): BoardDoc => {
  const nodes = (doc.nodes ?? []).map(migrateNode);
  return {
    ...doc,
    preset: asPreset(doc.preset),
    nodes,
    edges: (doc.edges ?? []).map(migrateEdge).map(e => migrateEdgeEnds(e, nodes)),
  };
};

/** The live marker id for an edge's crow's-foot end. React Flow wraps a STRING
 *  marker in `url('#…')` itself and skips string markers when building its own
 *  `<defs>`, so we hand it a bare id and render the matching glyph ourselves
 *  (see crowfoot.tsx). Derived from the data, so a theme switch needs no rewrite. */
const edgeMarkerUrl = (e: Edge, which: 'start' | 'end'): string | undefined => {
  const m = (which === 'start' ? e.markerStart : e.markerEnd) as any;
  if (!isCrowFoot(m?.type)) return undefined;
  return markerIdFor(m.type, edgeStrokeKeyOf(e));
};

/** The symbolic colour key of an edge (used for its crow's-foot markers). */
const edgeStrokeKeyOf = (e: Edge): ColorKey => {
  const d = (e.data ?? {}) as any;
  if (isColorKey(d.strokeKey)) return d.strokeKey;
  return keyForHex((e.style as any)?.stroke) ?? 'slate';
};

/** True when the edge carries an ERD crow's-foot end. */
const hasCrow = (e: Edge, which: 'start' | 'end') =>
  isCrowFoot(((which === 'start' ? e.markerStart : e.markerEnd) as any)?.type);

/** True when the keyboard event originates from a text field — never hijack typing. */
function isEditable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

const nodeW = (n: Node) => (n.measured?.width ?? n.width ?? 190) as number;
const nodeH = (n: Node) => (n.measured?.height ?? n.height ?? 60) as number;

/** Tiny table glyph for the ERD palette row (26×18, same box as ShapePreview). */
function TableGlyph({color}: {color: string}) {
  return (
    <svg className="shape-preview table" viewBox="0 0 26 18" width="26" height="18">
      <rect x="1" y="2" width="24" height="14" rx="2" fill="none" stroke={color} strokeWidth="1.4" />
      <path d="M1 6.5 H25 M9 6.5 V16" fill="none" stroke={color} strokeWidth="1" opacity=".8" />
    </svg>
  );
}

const dashArray = (v: string | undefined) =>
  v === 'dashed' ? '6 4' : v === 'dotted' ? '1.5 3.5' : undefined;

/* ---------------------------------------------------------------------------
   PACKAGE-N pass 3 — favourites (§6).

   The star control and the favourite tiles are palette-shaped controls, not
   canvas ones, so they live here rather than inside `DiagramNode`.

   `favouritePreview` decides a tile's glyph from the STORED payload — it never
   trusts a stored `position`, only identity:
     - a labelled payload  → the palette item's own row (identical to §6.3);
     - an unlabelled one   → the node's `shape` directly (a selection copy);
     - neither (e.g. an ERD `table` copy, whose `data` has no `shape`) → the
       table glyph, which is the only node kind without a Shape.
   Colours come from the payload's symbolic `colorKey` via `COLOR_VAR`, so a
   tile recolours with the theme exactly like a board node does.
--------------------------------------------------------------------------- */
function favouritePreview(fav: library.Favourite) {
  const label = library.favouriteLabel(fav);
  const item = label ? LIBRARY.find(p => p.label === label) : undefined;
  if (item) {
    if (item.kind === 'label') return <span style={{color: COLOR_VAR[item.colorKey]}}>T</span>;
    if (item.label === 'Table') return <TableGlyph color={COLOR_VAR[item.colorKey]} />;
    return <ShapePreview shape={item.shape} color={COLOR_VAR[item.colorKey]} />;
  }
  const node = fav.nodes[0] ?? {};
  const raw = (node as any).data ?? node; // a selection copy keeps the node wrapper
  const key = isColorKey((raw as any)?.colorKey) ? ((raw as any).colorKey as ColorKey) : 'slate';
  const shape = (raw as any)?.shape;
  if (typeof shape === 'string' && (SHAPE_IDS as string[]).includes(shape)) {
    return <ShapePreview shape={shape as Shape} color={COLOR_VAR[key]} />;
  }
  if ((raw as any)?.shape === undefined && (raw as any)?.columns) return <TableGlyph color={COLOR_VAR[key]} />;
  return <span style={{color: COLOR_VAR[key]}}>T</span>;
}

const markerFor = (kind: string, color: string) =>
  kind === 'arrowclosed' || kind === 'arrow' ? {type: kind as MarkerType, color, width: 14, height: 14} : undefined;

const edgeStroke = (e: Edge) => resolveColor(e.data as any);
/** The live symbolic key of an edge (for the "on" swatch). */
const edgeStrokeKey = (e: Edge | null) => (e ? resolveColorKey(e.data as any) : null);

/** ITEM 1 — the boot theme. Resolved from exactly the same three inputs as the
 *  pre-paint script in `index.html`'s <head>, so the document can never paint a
 *  theme React is about to replace. Precedence:
 *
 *    1. a stored CONCRETE theme — the user's explicit choice (`loadMode`).
 *    2. otherwise, for a user who has NEVER chosen, the DEFAULT preset's
 *       suggested theme. App starts on `DEFAULT_PRESET_ID`, so that suggestion
 *       is already in force at mount; this is the one that used to arrive ~130ms
 *       late (with the board load) as `dark`, flipping a light first frame.
 *    3. otherwise `system`, resolved through matchMedia.
 *
 *  The `hasStoredTheme` param lets `App` hand over the value it already read
 *  for the lazy initialiser instead of touching localStorage a second time. */
export function bootTheme(hasStoredTheme: boolean): ThemeName {
  const stored = loadMode();
  if (stored !== 'system') return stored;
  if (!hasStoredTheme) {
    const suggested = getPreset(DEFAULT_PRESET_ID).theme.suggested;
    if (suggested) return suggested;
  }
  return resolveMode(stored);
}

export default function App() {
  /* ITEM 2 — the canvas holds NOTHING while a board load is in flight.
     A board is the source of truth and it arrives asynchronously (~500ms after
     mount). Seeding the canvas with `initialNodes` painted the three sample
     nodes and then replaced them mid-flight — the placeholder flash. The seed's
     ONLY remaining consumer is the genuine first run, where the bootstrap below
     saves it verbatim as "My first board"; until the load resolves (or fails)
     the canvas is deliberately empty and shows the `.canvas-empty` panel, which
     is already gated on `nodes.length === 0`. `boardLoaded` is what keeps that
     panel from claiming "This board is empty" during the load. */
  const [boardLoaded, setBoardLoaded] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [selCount, setSelCount] = useState(0);
  const [selEdgeId, setSelEdgeId] = useState<string | null>(null);
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  // ---- M3/S1: interface class + M3/S2: docked-panel collapse ----
  // `appRef` is the EMBED HOST, not the window: the hook measures this element
  // with a ResizeObserver so a narrow host (side pane, iframe, split column)
  // gets the compact layout even on a wide screen. Its results are published on
  // `.app` as data attributes for the later touch / tablet / phone steps.
  const appRef = useRef<HTMLDivElement>(null);
  const ui = useEditorInterface(appRef);
  // M3/S2c: `setPanelsVisible` is the shortcut's ONE atomic write; `togglePanel`
  // is the per-side chevron's. M3/S2d dropped `setPanelPinned` with the auto-hide
  // it served, and the reviewer's flag removed the two never-consumed methods
  // (`setPanelCollapsed`, `resetPanels`) — one flag per side is the whole state.
  const {state: panelState, togglePanel, setPanelsVisible} = usePanelCollapse();

  const nodesRef = useRef<Node[]>(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef<Edge[]>(edges);
  edgesRef.current = edges;

  // ---- Part B: read-only review mode -------------------------------------
  // A view-only canvas: pan and zoom freely, touch nothing. Kept LOCAL to
  // App.tsx on purpose — it is one boolean, toggled from one toolbar button and
  // read by this same component's <ReactFlow> props and its one keydown
  // handler, so a hook in choreography.ts would add an indirection layer with a
  // single call site and no shared logic. Persistence follows the established
  // convention here (`diagram-studio:edge-path`, `diagram-studio:tour-seen`):
  // one namespaced key, read once in a lazy `useState` initialiser that never
  // throws when storage is unavailable, defaulting to OFF.
  //
  // K — HOISTED above the hover choreography deliberately: the gate there reads
  // this flag (`highlight && !readOnly`), so the declaration must precede that
  // call site. Every other reader sits further down and is blind to the
  // position.
  const READ_ONLY_KEY = 'diagram-studio:read-only';
  const [readOnly, setReadOnly] = useState(() => {
    try { return localStorage.getItem(READ_ONLY_KEY) === '1'; } catch { return false; }
  });

  // ---- PACKAGE-K: hover choreography, interaction perf guard, layout
  //      transition, animation gating. All four work on React Flow's own DOM
  //      (classList on .react-flow__node[data-id] / .react-flow__edge[data-id])
  //      and on the wrapper class, so none of them costs a React render.
  const {
    animate, toggle: toggleAnimate,
  } = useAnimationGating(nodes.length);
  /** F — the hover edge-highlight is an OPTION now, default OFF; the value is
   *  the user's persisted choice. K — the gate handed to the choreography is
   *  the option AND the absence of review mode: view-only means a hover lights
   *  nothing. `readOnly` joins the gate at the CALL SITE rather than inside the
   *  hook, which is left exactly as fix-F wrote it — including the `clear()`
   *  its disabled branch runs, and that is the point: an edge that was ALREADY
   *  electric at the instant the mode turns on must be un-painted, and `clear()`
   *  on disable is what un-paints it. A parallel guard added outside `enabled`
   *  would strand exactly that edge. */
  const {highlight, toggle: toggleHighlight} = useHoverHighlight();
  const {onEdgeMouseEnter, onEdgeMouseLeave, onNodeMouseEnter, onNodeMouseLeave} =
    useHoverChoreography(wrap, edgesRef, highlight && !readOnly);
  const {startInteraction, endInteraction} = useInteractionGuard(wrap);
  const {animateLayout} = useLayoutTransition(wrap);

  // ---- snap to grid ----
  const [snap, setSnap] = useState(false);
  /** M4: the grid pitch in px — the ONE source of truth for the snap grid, the
   *  visible dot spacing, the "round onto the grid" math and the toolbar
   *  tooltip. Owned here (session-scoped like `snap`); the toolbar keeps the
   *  on/off toggle and Settings → Canvas owns the number, so neither is a
   *  duplicate control. Never written to a board. */
  const [gridSize, setGridSize] = useState(16);
  /** The only way the pitch is set: non-finite input (cleared / partial field)
   *  is ignored — the last valid value stands — and anything finite is clamped
   *  to [4, 64] and rounded to the nearest 4px step, so `snapGrid`,
   *  `Background`'s gap and the rounding math can never disagree or go NaN. */
  const onGridSize = useCallback((n: number) => {
    if (!Number.isFinite(n)) return;
    setGridSize(Math.min(64, Math.max(4, Math.round(n / 4) * 4)));
  }, []);
  // ---- export dropdown open? ----
  const [pop, setPop] = useState(false);
  // ---- D1: searchable insert palette (position = double-click point) ----
  const [searchPos, setSearchPos] = useState<{x: number; y: number} | null>(null);
  // ---- D2: cheat sheet popover ----
  const [help, setHelp] = useState(false);
  // ---- F2: context menu ----
  const [ctx, setCtx] = useState<CtxTarget | null>(null);
  // ---- M3/S3: coarse-pointer handling ----
  // `isTouchScreen` is live: a hybrid laptop switching pointer flips it and the
  // drag thresholds below follow. `touchPrev` lets us notice the transition at
  // all (React has no "the media query changed" hook), so a stale context menu
  // can be dismissed the moment a coarse pointer is detected.
  const isTouchScreen = ui.isTouchScreen;
  const touchPrev = useRef(isTouchScreen);
  useEffect(() => {
    if (touchPrev.current !== isTouchScreen && isTouchScreen) setCtx(null);
    touchPrev.current = isTouchScreen;
  }, [isTouchScreen]);
  // M3/S3.1 — 500 ms long press opens the SAME context menu right-click opens.
  // The hook emits a `CtxTarget`-shaped object, so there is exactly one
  // context-menu state (`ctx`) and one renderer (`<ContextMenu>` below).
  useLongPress({
    enabled: isTouchScreen,
    container: appRef,
    onLongPress: setCtx,
  });
  // ---- F3: helper lines ----
  const [guides, setGuides] = useState<HelperGuides>({vertical: null, horizontal: null});
  /** Alignment guides + snap on drop. ON by default (auto-align); toggled from the toolbar. */
  const [alignGuides, setAlignGuides] = useState(true);
  const helperDrag = useRef(false);
  // ---- F7: connection rules ----
  const [noCycles, setNoCycles] = useState(false);
  const [oneIn, setOneIn] = useState(false);
  // ---- F9: proximity connect ----
  const [proximity, setProximity] = useState(false);
  const [proxEdge, setProxEdge] = useState<{from: string; to: string; fromPos: XYPosition; toPos: XYPosition} | null>(null);
  // ---- F6: pending drop-on-canvas connection ----
  const pendingDrop = useRef<Connection | null>(null);
  // ---- G: the handle the current connection drag STARTED from.
  // Deliberately a SECOND ref rather than a field on `pendingDrop`: onConnectEnd
  // reads `pendingDrop.current` to decide whether to insert a node on drop, and
  // onConnect consumes the origin first, so clearing the shared ref there would
  // silently kill the drop-to-create path. Written by onConnectStart, consumed
  // (and cleared) by onConnect.
  const connectOrigin = useRef<{nodeId: string; handleId: string | null | undefined} | null>(null);
  // ---- G: the default edge path. `smoothstep` until the user changes an edge's
  // curvature in the inspector, at which point that choice becomes the default
  // for every edge drawn afterwards. Same convention as
  // `diagram-studio:tour-seen` / `diagram-studio:theme`: one namespaced key, read
  // once through a lazy `useState` initialiser that never throws when storage is
  // unavailable. An absent or unparseable value reads as `smoothstep`.
  const EDGE_PATH_KEY = 'diagram-studio:edge-path';
  const readEdgePath = (): PathId => {
    try {
      const v = localStorage.getItem(EDGE_PATH_KEY);
      return v === 'bezier' || v === 'smoothstep' || v === 'step' || v === 'straight'
        ? (v as PathId)
        : 'smoothstep';
    } catch { return 'smoothstep'; }
  };
  const [defaultPath, setDefaultPath] = useState<PathId>(readEdgePath);
  const rememberEdgePath = useCallback((p: PathId) => {
    setDefaultPath(p);
    try { localStorage.setItem(EDGE_PATH_KEY, p); } catch { /* ignore */ }
  }, []);
  /** Live modifier-key state (F7 bypass) — updated by keydown/keyup listeners. */
  const shiftDown = useRef(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftDown.current = true; };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftDown.current = false; };
    const blur = () => { shiftDown.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // ---- transient status message (import / export feedback) ----
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef<number | undefined>(undefined);
  const flash = useCallback((msg: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(msg);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2500);
  }, []);

  // ---- H1/H2: onboarding — guided tour + getting-started checklist ----
  const TOUR_SEEN_KEY = 'diagram-studio:tour-seen';
  const [tourOpen, setTourOpen] = useState(false);
  /** Discrete "user did it" signals for the checklist (idempotent per task). */
  const [doneSignal, setDoneSignal] = useState<ChecklistTaskId | null>(null);
  const tickTask = useCallback((id: ChecklistTaskId) => { setDoneSignal(id); }, []);
  const tourFinished = useCallback(() => {
    setTourOpen(false);
    try { localStorage.setItem(TOUR_SEEN_KEY, '1'); } catch { /* ignore */ }
  }, []);
  // First visit: auto-start the tour once (persisted). Runs only after the
  // initial mount so StrictMode's double-effect doesn't restart it.
  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(TOUR_SEEN_KEY) === '1'; } catch { /* ignore */ }
    if (!seen) {
      try { localStorage.setItem(TOUR_SEEN_KEY, '1'); } catch { /* ignore */ }
      setTourOpen(true);
    }
  }, []);

  // ---- multi-document boards (disk-backed via dev-server API) ----
  const [curBoard, setCurBoard] = useState<BoardDoc | null>(null);
  const [boardList, setBoardList] = useState<BoardMeta[]>([]);
  const [boardsOpen, setBoardsOpen] = useState(false);

  // ---- L2: the board's diagram type (board metadata, defaults to architecture) ----
  const [presetId, setPresetId] = useState<PresetId>(DEFAULT_PRESET_ID);
  const preset = useMemo(() => getPreset(presetId), [presetId]);
  /** ERD show-mode lives on the preset but is user-overridable per session. */
  const [showMode, setShowMode] = useState<ShowMode>('ALL_FIELDS');

  /* =====================================================================
     PACKAGE-N pass 2c — the left panel shows the WHOLE library, always.

     REVISION 3 DELETED THE TYPE FILTER. Of the 34 elements, 33 belong to
     exactly ONE type, so an ARCH/FLOW/C4/ERD badge on a row merely restated
     that row's own category and the 6-chip row cost 77px of permanently
     wrapped chrome to filter the library down to almost what the category
     already held. The chips and the badges are GONE; `types[]` SURVIVES in the
     data (it is the model's membership field, read by `libraryFor` and the
     Mixed set) — only its RENDERING was removed.

     What replaces them is a SEARCH FIELD. The panel is now exactly two
     controls: a query and a fold map.

       `query`        the panel omnibox (this session only, never persisted).
                      Non-empty → the accordion is replaced by a flat list
                      grouped by category and a hit in a COLLAPSED category
                      renders dimmed rather than disappearing.
       `categories`   the durable per-section fold map (categoryState.ts).
     ===================================================================== */
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const {toggleCategory, isCategoryOpen} = useCategoryCollapse();

  // With no stored decision the board's OWN type names the one open section
  // (`defaultOpenCategory`), so a C4 board opens on C4 and an ERD board on
  // Entities without either board writing a default into localStorage just by
  // being opened. The view no longer has its own filter: the board's preset IS
  // the view, which is why this now reads `presetId` directly.
  const defaultOpen = useMemo(() => defaultOpenCategory(presetId), [presetId]);

  /** The WHOLE library in the 8 canonical sections, always — every category
   *  renders with its full count. Nothing filters this any more, so there is no
   *  "category with zero items is omitted" rule to apply (AC #8). */
  const librarySections = useMemo(
    () => groupByCategory(LIBRARY, CATEGORY_ORDER, CATEGORY_LABEL),
    [],
  );

  /** The SEARCH RESULT — the same rows, filtered by the query, still grouped and
   *  still in canonical order (empty categories dropped: an "Annotations (0)"
   *  header while searching is noise, not information). */
  const searchGroups = useMemo(
    () => groupByCategory(searchLibrary(LIBRARY, query), CATEGORY_ORDER, CATEGORY_LABEL),
    [query],
  );
  const searching = query.trim().length > 0;

  // ---- L1: the theme. A board-level theme SUGGESTS; the user's choice wins. ----
  //
  // PACKAGE-M follow-up — two things that must never be conflated:
  //   `mode`           the user's GLOBAL, persisted preference. Only an explicit
  //                    Settings pick changes it; it owns the localStorage key
  //                    `diagram-studio:theme`.
  //   `suggestedTheme` a transient, render-only proposal from the board (or a
  //                    preset). Never persisted, never in the board doc, and it
  //                    only lands for a user who has never chosen (hasStoredMode).
  // A board may recolour the screen; it may never rewrite the user's preference.
  const [mode, setMode] = useState<Mode>(() => loadMode());
  /** ITEM 1 — the DEFAULT preset's suggestion is already in force at mount
   *  (App starts on `DEFAULT_PRESET_ID`), so it belongs in the INITIAL state,
   *  not in a state pass that lands with the board load. It used to be `null`
   *  here and only became 'dark' when `adoptBoardPreset` ran ~130ms later: the
   *  first commit therefore painted the resolved OS preference (light) and the
   *  effect below flipped the document to dark on top of it. Same three inputs,
   *  same order, as the pre-paint script in index.html (see `bootTheme`). */
  const [suggestedTheme, setSuggestedTheme] = useState<ThemeName | null>(
    () => hasStoredMode() ? null : (getPreset(DEFAULT_PRESET_ID).theme.suggested ?? null),
  );
  /** The FIRST committed theme — resolved from the same inputs as the pre-paint
   *  script, so the document is already correct when React takes over. */
  const [theme, setTheme] = useState<ThemeName>(() => bootTheme(hasStoredMode()));
  const themeIsDark = isDarkTheme(theme);

  /** What is actually PAINTED: a live suggestion wins over `system` (the only
   *  mode a suggestion may override), otherwise the resolved user preference. */
  const effectiveTheme = useMemo(
    () => (mode === 'system' && suggestedTheme) ? suggestedTheme : resolveMode(mode),
    [mode, suggestedTheme],
  );

  // ---- M1: the Settings dialog (the theme is one of its settings). ----
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  /** The paint path. `theme` state and `applyTheme` both track `effectiveTheme`
   *  so there is exactly one place that decides what the document looks like. */
  useEffect(() => {
    setTheme(effectiveTheme);
    applyTheme(effectiveTheme);
  }, [effectiveTheme]);

  /** The Settings `onMode` handler — an EXPLICIT user choice: it persists the
   *  preference and clears any transient suggestion so the pick wins for good.
   *
   *  Persistence lives HERE and only here. It used to run in an effect on mount,
   *  which meant a plain page load fabricated a stored preference out of the
   *  'system' default — that both defeated the hasStoredMode guard below and
   *  silently converted "never chose" into "chose System". */
  const chooseMode = useCallback((m: Mode) => {
    setSuggestedTheme(null);
    setMode(m);
    saveMode(m);
  }, []);

  /** Propose (or clear, when called with no theme) a RENDER-only theme. The
   *  guard is the whole contract: suggestions stop landing for good once the
   *  user has made an explicit choice, and `mode` / localStorage stay untouched. */
  const suggestTheme = useCallback((t?: ThemeName) => {
    if (hasStoredMode()) return;
    setSuggestedTheme(t ?? null);
  }, []);

  // `system` must follow the OS preference while it is selected — but a live
  // suggestion overrides `system`, so only repaint while none is pending.
  useEffect(() => {
    if (mode !== 'system') return;
    let mq: MediaQueryList;
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch { return; }
    const onChange = () => {
      if (suggestedTheme) return;
      const t = resolveMode('system');
      setTheme(t);
      applyTheme(t);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode, suggestedTheme]);

  /** A board carries a theme suggestion; adopting it never overrides an explicit
   *  user choice. The board may change what is RENDERED only — never `mode`,
   *  never the persisted key. `suggestTheme` enforces the hasStoredMode guard. */
  const adoptBoardPreset = useCallback((doc: BoardDoc) => {
    const p = getPreset(doc.preset);
    setPresetId(p.id);
    setShowMode(p.showMode ?? 'ALL_FIELDS');
    // The on-canvas legend UI was removed (harvey, 2026-09-17) — there is no
    // state to seed. The board doc's `legend` key is still PARSED and still
    // written back unchanged on save (see `flushSave`), so a board that carries
    // it round-trips. `preset.legend` remains as DATA in `presets.ts`.
    // Never `setMode`: a suggestion is cosmetic and must not outlive the load.
    // PACKAGE-M fix — a board no longer carries a theme: only the PRESET
    // suggests one. `doc.theme` used to be read first and shadowed this
    // suggestion with a stale copy of the global preference. `suggestTheme`
    // still refuses to override a stored user preference (hasStoredMode guard).
    suggestTheme(p.theme.suggested);
  }, [suggestTheme]);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  /** Mirror of curBoard for save paths (I6): flushSave reads through this ref
   *  so it does not need curBoard in its dependency array. */
  const curBoardRef = useRef<BoardDoc | null>(curBoard);
  curBoardRef.current = curBoard;
  const saveTimer = useRef<number | undefined>(undefined);
  const saveSeq = useRef(0);
  /** Set by applyBoard; the next autosave effect run(s) are skipped so
   *  loading a board doesn't immediately write it back to disk. */
  const skipAutosave = useRef(0);

  const applyBoard = useCallback((doc0: BoardDoc) => {
    // Load a board's nodes/edges, reset history/selection, fit view.
    // Two effect runs will fire (nodes then edges state updates) — skip both.
    // K3: the wrapper carries the layout-transition class while the board's
    // nodes are swapped in, so loading never snaps.
    // L1: legacy hex colours are migrated to symbolic keys on the way in.
    // L2: the board's preset is adopted (it is board metadata; old boards have
    //     none and default to 'architecture' — zero migration).
    const doc = migrateDoc(doc0);
    adoptBoardPreset(doc);
    /* PACKAGE-N pass 3 — advance the id counter past everything on this board.
       `idc` is a module-level counter that resets to 100 on every page load,
       while a board can already contain `n100`, `n101`… (the demo board does).
       Every insert path (`addNodeByLabel`, paste, duplicate, and now a
       favourite) then mints an id that ALREADY EXISTS: React Flow keeps two
       nodes with the same id, and the next edit, selection or delete silently
       acts on the wrong one — data loss, not a cosmetic glitch.
       Bumping once per load makes a fresh id unique against the live board
       under every insert path, at a cost of one scan. (It does not cover a
       paste of many nodes in one tick, which can run ahead of the counter —
       pre-existing, out of scope, and reported rather than silently changed.) */
    for (const n of doc.nodes) {
      const m = /^n(\d+)$/.exec(n.id);
      if (m) idc = Math.max(idc, Number(m[1]) + 1);
    }
    for (const e of doc.edges) {
      const m = /^e(\d+)$/.exec(e.id);
      if (m) idc = Math.max(idc, Number(m[1]) + 1);
    }
    animateLayout(() => {
      skipAutosave.current = 2;
      past.current = [];
      future.current = [];
      setNodes(doc.nodes.map(n => ({...n, selected: false})));
      setEdges(doc.edges.map(e => ({...e, selected: false})));
      bumpHist(v => v + 1);
      setSel(null);
      setSelEdgeId(null);
      setSelCount(0);
      setCurBoard(doc);
      boards.cacheLastBoard(doc.id);
      setTimeout(() => rf?.fitView({padding: 0.25}), 30);
    });
  }, [setNodes, setEdges, rf, animateLayout, adoptBoardPreset]);

  const flushSave = useCallback(async () => {
    const board = curBoardRef.current;
    if (!board) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    const seq = ++saveSeq.current;
    setSaveState('saving');
    try {
      const saved = await boards.saveBoard({
        id: board.id, name: board.name,
        nodes: nodesRef.current.map(n => ({...n, selected: false})),
        edges: edgesRef.current.map(e => ({...e, selected: false})),
        preset: presetId,
        // The `legend` key is PERSISTED data (`BoardDoc.legend`) even though the
        // on-canvas renderer is gone: it is written back from the loaded doc so a
        // board that carries the key still round-trips instead of losing it.
        legend: board.legend,
      });
      if (seq !== saveSeq.current) return; // a newer save superseded this one
      // I6: do NOT setCurBoard here from the autosave path — writing updatedAt
      // back into state re-created flushSave and re-ran the autosave effect,
      // causing a ~30-PUTs-in-25s loop. Keep the local copy in sync via the
      // ref instead (no re-render, no effect re-run).
      curBoardRef.current = {...board, name: saved.name, updatedAt: saved.updatedAt};
      setSaveState('saved');
      setBoardList(l => l.map(b => b.id === saved.id
        ? {...b, updatedAt: saved.updatedAt, nodeCount: saved.nodes.length, edgeCount: saved.edges.length}
        : b));
      window.setTimeout(() => setSaveState(s => (s === 'saved' ? 'idle' : s)), 2000);
    } catch (err: any) {
      setSaveState('error');
      flash(`Save failed: ${err?.message ?? 'unknown error'}`);
    }
  }, [flash, presetId, mode]);

  // Debounced autosave whenever nodes/edges change (and a board is loaded).
  // I6: depend only on the board id (via ref) + nodes/edges so the effect does
  // not re-run when the board doc object changes; and only show "saving" when
  // the debounced save actually fires, not on every keystroke/drag tick.
  const boardId = curBoard?.id;
  useEffect(() => {
    if (!boardId) return;
    if (skipAutosave.current > 0) {
      skipAutosave.current -= 1;
      return;
    }
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void flushSave(); }, 800);
    return () => window.clearTimeout(saveTimer.current);
  }, [nodes, edges, boardId, flushSave]);

  const refreshBoards = useCallback(async () => {
    try {
      setBoardList(await boards.listBoards());
    } catch (err: any) {
      flash(`Boards API error: ${err?.message ?? 'unknown'}`);
    }
  }, [flash]);

  // First load: open the last board, or the newest, or seed one from the
  // current in-memory starter diagram. Guarded against StrictMode's
  // double-mounted effect so we never seed two boards.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      try {
        let list = await boards.listBoards();
        let target: BoardDoc | null = null;
        const lastId = boards.lastBoardId();
        if (list.length === 0) {
          const doc = await boards.createBoard('My first board');
          target = {...doc, nodes: initialNodes, edges: initialEdges};
          try {
            const saved = await boards.saveBoard({id: doc.id, name: doc.name, nodes: initialNodes, edges: initialEdges});
            target = {...target, updatedAt: saved.updatedAt};
          } catch { /* keep in-memory copy */ }
          list = await boards.listBoards();
        } else {
          const want = list.find(b => b.id === lastId) ?? list[0];
          target = await boards.getBoard(want.id).catch(async (e: any) => {
            // stale/missing last-open board — fall back to the newest board
            if (list.length > 1) return boards.getBoard(list[0].id);
            throw e;
          });
        }
        if (!target) return;
        setBoardList(list);
        applyBoard(target);
      } catch (err: any) {
        // The load failed (no boards API, bad payload). There is no board to
        // render, so release the canvas: `boardLoaded` lets the empty-state panel
        // back in, which is the honest thing to show for a canvas with no board.
        flash(`Boards API error: ${err?.message ?? 'unknown'}`);
      } finally {
        // ITEM 2 — the FIRST time the canvas is handed to the user, by every
        // exit path (loaded / failed / no target). Before this, the canvas is
        // deliberately empty and silent rather than showing a seed that is about
        // to be replaced.
        setBoardLoaded(true);
      }
    })();
  }, []);

  /** ITEM 6b — the board dialog. `null` = closed. The MODE is the state: a
   *  `create` / `rename` / `delete` request each just sets it, and all the async
   *  work happens in `onBoardDialog`, so the dialog itself never touches the
   *  boards API. */
  const [boardDlg, setBoardDlg] = useState<BoardDialogResult['kind'] | null>(null);

  /** L2 — New board. Opens the designed dialog (item 6b); the work moved to
   *  `onBoardDialog`, where the name and the template choice arrive as data
   *  instead of through a blocking native browser prompt + confirm chain. */
  const newBoard = useCallback(() => { setBoardDlg('create'); }, []);
  /** ITEM 6b — the dialog's focus-restore target. The Boards menu button is the
   *  one trigger that still exists when the dialog closes: the menu row that was
   *  actually pressed lives inside the popup, which unmounts the moment the row
   *  is chosen. Focusing a null ref is a no-op, so a menu row ref would silently
   *  drop focus on `<body>` and the next Tab would start from the top of the page. */
  const boardsMenuBtnRef = useRef<HTMLButtonElement>(null);

  /** L2 — applies a preset to the CURRENT board. NO UI CALLS THIS any more:
   *  the user-facing picker was removed on 2026-09-17, so this is now the
   *  unreachable-but-authoritative helper for a preset swap (kept on purpose).
   *  A swap never rewrites existing nodes; it changes the show-mode, the edge
   *  defaults, the auto-layout, the declared caps and the suggested theme. */
  const switchPreset = useCallback((id: PresetId) => {
    if (id === presetId) return;
    const p = getPreset(id);
    setPresetId(id);
    setShowMode(p.showMode ?? 'ALL_FIELDS');
    // L2 switch point 8 — a preset's caps apply to the EXISTING toggles (there is
    // no second toolbar). `architecture` declares today's defaults, so this is a
    // no-op for the default preset.
    if (p.caps) {
      if (p.caps.cyclePrevention !== undefined) setNoCycles(p.caps.cyclePrevention);
      if (p.caps.oneInput !== undefined) setOneIn(p.caps.oneInput);
      if (p.caps.proximityConnect !== undefined) setProximity(p.caps.proximityConnect);
    }
    // A preset's suggested theme is a SUGGESTION, not an explicit user choice:
    // it must never overwrite a stored 'system' preference. Render-only, and
    // skipped entirely once the user has chosen (`suggestTheme` guards that).
    suggestTheme(p.theme.suggested);
    setCurBoard(c => c ? {...c, preset: id} : c);
    flushSave();
    flash(`${p.label} preset — palette, edge defaults and layout changed. Existing elements kept.`);
  }, [presetId, flushSave, flash, suggestTheme]);

  const openBoard = useCallback(async (id: string) => {
    if (id === curBoard?.id) { setBoardsOpen(false); return; }
    try {
      await flushSave();
      const doc = await boards.getBoard(id);
      setBoardsOpen(false);
      applyBoard(doc);
      flash(`Opened “${doc.name}”`);
    } catch (err: any) {
      flash(`Open board failed: ${err?.message ?? 'unknown'}`);
    }
  }, [curBoard, flushSave, applyBoard, flash]);

  /** ITEM 6b — opens the designed rename dialog. The name arrives from
   *  `onBoardDialog`; this callback keeps the save body verbatim. */
  const renameBoard = useCallback(() => { setBoardDlg('rename'); }, []);

  const doRenameBoard = useCallback(async (name: string) => {
    if (!curBoard || !name || name === curBoard.name) return;
    try {
      await flushSave();
      const saved = await boards.saveBoard({
        id: curBoard.id, name,
        nodes: nodesRef.current.map(n => ({...n, selected: false})),
        edges: edgesRef.current.map(e => ({...e, selected: false})),
        preset: presetId, legend: curBoard.legend,
      });
      setCurBoard(c => c ? {...c, name: saved.name, updatedAt: saved.updatedAt} : c);
      setBoardList(l => l.map(b => b.id === curBoard.id ? {...b, name: saved.name, updatedAt: saved.updatedAt} : b));
      flash(`Renamed to “${name}”`);
    } catch (err: any) {
      flash(`Rename failed: ${err?.message ?? 'unknown'}`);
    }
  }, [curBoard, flushSave, flash, presetId]);

  const doDuplicateBoard = useCallback(async () => {
    if (!curBoard) return;
    const name = `${curBoard.name} (copy)`;
    try {
      await flushSave();
      const doc = await boards.createBoard(name);
      const saved = await boards.saveBoard({
        id: doc.id, name,
        nodes: nodesRef.current.map(n => ({...n, selected: false})),
        edges: edgesRef.current.map(e => ({...e, selected: false})),
        preset: presetId, legend: curBoard.legend,
      });
      setBoardList(await boards.listBoards());
      applyBoard(saved);
      flash(`Duplicated to “${name}”`);
    } catch (err: any) {
      flash(`Duplicate failed: ${err?.message ?? 'unknown'}`);
    }
  }, [curBoard, flushSave, applyBoard, flash]);

  /** ITEM 6b — opens the designed destructive confirm. */
  const deleteBoard = useCallback(() => { setBoardDlg('delete'); }, []);

  const doDeleteBoard = useCallback(async (confirmed?: boolean) => {
    if (!curBoard || !confirmed) return;
    try {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
      await boards.deleteBoard(curBoard.id);
      const list = await boards.listBoards();
      setBoardList(list);
      if (list.length) {
        const doc = await boards.getBoard(list[0].id);
        applyBoard(doc);
      } else {
        const doc = await boards.createBoard('Untitled');
        setBoardList(await boards.listBoards());
        applyBoard({...doc, nodes: [], edges: []});
      }
      flash('Board deleted');
    } catch (err: any) {
      flash(`Delete failed: ${err?.message ?? 'unknown'}`);
    }
  }, [curBoard, applyBoard, flash]);

  /** ITEM 6b — the dialog's ONE submit path for all THREE modes. Each branch is
   *  the body of the native prompt / confirm it replaces, verbatim apart from
   *  where its inputs now come from. Declared here (below the three workers)
   *  because it calls two of them — a `useCallback` cannot reference a `const`
   *  that has not been initialised yet, not even inside its dep array. */
  const onBoardDialog = useCallback((r: BoardDialogResult) => {
    setBoardDlg(null);
    if (r.kind === 'rename') { void doRenameBoard(r.name); return; }
    if (r.kind === 'delete') { void doDeleteBoard(true); return; }

    /* CREATE. 2026-09-17 — the type PICKER is gone; the neutral `Mixed` preset is
       the default. The stored `preset` string is still DATA: it drives edge
       defaults, auto-layout, the ERD table node and the C4 legend, so boards
       written before this change keep behaving exactly as they did.

       ITEM 6b — a chosen TEMPLATE decides the preset. The dialog returns a
       (preset, templateId) PAIR because a template BELONGS to a preset: seeding
       a C4 template into the `custom` board would give it C4 nodes under Mixed's
       edge defaults. "Start empty" keeps `custom`. (The old code hard-coded
       `custom` and then asked about `custom.templates[0]` — which does not
       exist, so the template question was unreachable and always answered "no".) */
    const pid: PresetId = r.seed ? r.seed.preset : 'custom';
    const t = r.seed ? getPreset(pid).templates?.find(x => x.id === r.seed!.templateId) : undefined;
    const name = r.name;
    void (async () => {
      try {
        await flushSave();
        const doc = await boards.createBoard(name);
        const nodes = t ? t.nodes.map(n => ({...n})) : [];
        const edges = t ? t.edges.map(e => ({...e})) : [];
        if (t) await boards.saveBoard({id: doc.id, name, nodes, edges, preset: pid});
        setBoardList(await boards.listBoards());
        applyBoard({...doc, nodes, edges, preset: pid});
        tickTask('board');
        flash(`Created ${getPreset(pid).label} board “${name}”`);
      } catch (err: any) {
        flash(`New board failed: ${err?.message ?? 'unknown'}`);
      }
    })();
  }, [flushSave, applyBoard, flash, tickTask, doRenameBoard, doDeleteBoard]);

  // Close the boards popover on outside click / Escape.
  const boardsBtnRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!boardsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (boardsBtnRef.current && !boardsBtnRef.current.contains(e.target as any)) setBoardsOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [boardsOpen]);

  // Item 3b: the `?` helper closes on an outside click too — the same pattern as
  // the boards menu above. The `?` button is EXCLUDED from the outside test so a
  // second click on it still TOGGLES (otherwise the global mousedown would close
  // the sheet first and the button's onClick would immediately reopen it).
  const helpBtnRef = useRef<HTMLButtonElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!help) return;
    const onDown = (e: MouseEvent) => {
      // `globalThis.Node` is deliberate: `Node` is shadowed in this file by the
      // React Flow `type Node` import, so a bare `as Node` resolves to the graph
      // node type and fails `tsc`. Same DOM intent, explicit name.
      const t = e.target as unknown as globalThis.Node;
      if (helpRef.current?.contains(t) || helpBtnRef.current?.contains(t)) return;
      setHelp(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [help]);

  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
  };

  // ---- history (undo / redo) ----
  const past = useRef<Snap[]>([]);
  const future = useRef<Snap[]>([]);
  const [, bumpHist] = useState(0);

  const snapshot = useCallback((): Snap => ({
    nodes: nodesRef.current.map(n => ({
      ...n, position: {...n.position}, data: {...(n.data as any)}, selected: false,
    })),
    edges: edgesRef.current.map(e => ({...e, selected: false})),
  }), []);

  /** Record the current state before a mutation. Capped at MAX_HISTORY entries. */
  const pushHistory = useCallback(() => {
    past.current.push(snapshot());
    while (past.current.length > MAX_HISTORY) past.current.shift();
    future.current = [];
    bumpHist(v => v + 1);
  }, [snapshot]);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(snapshot());
    setNodes(prev.nodes);
    setEdges(prev.edges);
    bumpHist(v => v + 1);
  }, [snapshot, setNodes, setEdges]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(snapshot());
    while (past.current.length > MAX_HISTORY) past.current.shift();
    setNodes(next.nodes);
    setEdges(next.edges);
    bumpHist(v => v + 1);
  }, [snapshot, setNodes, setEdges]);

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;

  // ---- clipboard (copy / paste / duplicate) ----
  const clipboard = useRef<Snap | null>(null);

  const copySelection = useCallback(() => {
    const selNodes = nodesRef.current.filter(n => n.selected);
    if (!selNodes.length) return;
    const ids = new Set(selNodes.map(n => n.id));
    clipboard.current = {
      nodes: selNodes.map(n => ({...n, position: {...n.position}, data: {...(n.data as any)}, selected: false})),
      edges: edgesRef.current.filter(e => ids.has(e.source) && ids.has(e.target)).map(e => ({...e})),
    };
  }, []);

  const pasteClipboard = useCallback((offset = 40) => {
    const cb = clipboard.current;
    if (!cb || !cb.nodes.length) return;
    pushHistory();
    const idMap = new Map<string, string>();
    const newNodes: Node[] = cb.nodes.map(n => {
      const id = `n${idc++}`;
      idMap.set(n.id, id);
      return {
        ...n, id, selected: true,
        position: {x: n.position.x + offset, y: n.position.y + offset},
        data: {...(n.data as any)},
      };
    });
    const newEdges: Edge[] = cb.edges.map(e => ({
      ...e, id: `e${idc++}`, source: idMap.get(e.source)!, target: idMap.get(e.target)!, selected: false,
    }));
    setNodes(ns => [...ns.map(n => (n.selected ? {...n, selected: false} : n)), ...newNodes]);
    setEdges(es => [...es, ...newEdges]);
    tickTask('node');
  }, [tickTask, pushHistory, setNodes, setEdges]);

  const duplicateSelection = useCallback(() => {
    copySelection();
    pasteClipboard(40);
  }, [copySelection, pasteClipboard]);

  /** Nudge every selected node by (dx, dy). Used by the arrow keys. */
  const nudge = useCallback((dx: number, dy: number) => {
    const ids = new Set(nodesRef.current.filter(n => n.selected).map(n => n.id));
    if (!ids.size) return;
    setNodes(ns => ns.map(n => ids.has(n.id)
      ? {...n, position: {x: n.position.x + dx, y: n.position.y + dy}}
      : n));
  }, [setNodes]);

  /** Delete every selected node (and its attached edges). */
  const deleteSelection = useCallback(() => {
    const ids = new Set(nodesRef.current.filter(n => n.selected).map(n => n.id));
    if (!ids.size) return;
    pushHistory();
    setNodes(ns => ns.filter(n => !ids.has(n.id)));
    setEdges(es => es.filter(e => !ids.has(e.source) && !ids.has(e.target)));
  }, [pushHistory, setNodes, setEdges]);

  // ---- F7 helpers: cycle detection on the current edge set ----
  /** Would adding source→target create a directed cycle? */
  const createsCycle = useCallback((source: string, target: string): boolean => {
    if (source === target) return true;
    // cycle iff `target` can already reach `source`
    const adj = new Map<string, string[]>();
    edgesRef.current.forEach(e => {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
    });
    const seen = new Set<string>([target]);
    const stack = [target];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === source) return true;
      for (const nxt of adj.get(cur) ?? []) if (!seen.has(nxt)) { seen.add(nxt); stack.push(nxt); }
    }
    return false;
  }, []);

  // ---- F2: context menu actions ----
  /** Absolute flow position of a node (parent-relative resolved up the tree). */
  const absPos = useCallback((n: Node, all: Node[]): XYPosition => {
    let x = n.position.x, y = n.position.y;
    let pid = n.parentId;
    const guard = new Set<string>();
    while (pid && !guard.has(pid)) {
      guard.add(pid);
      const p = all.find(m => m.id === pid);
      if (!p) break;
      x += p.position.x; y += p.position.y;
      pid = p.parentId;
    }
    return {x, y};
  }, []);

  const ctxAction = useCallback((action: CtxAction, target: CtxTarget) => {
    if (action === 'addNode' && target.kind === 'pane') {
      if (rf && wrap.current) {
        const b = wrap.current.getBoundingClientRect();
        setSearchPos(rf.screenToFlowPosition({x: target.x - b.left, y: target.y - b.top}));
      } else setSearchPos({x: 200, y: 200});
      return;
    }
    if (action === 'paste') { pasteClipboard(40); return; }
    if (action === 'selectAll') {
      setNodes(ns => ns.map(n => ({...n, selected: true})));
      setEdges(es => es.map(e => ({...e, selected: true})));
      return;
    }
    if (action === 'fitView') { rf?.fitView({padding: 0.25}); return; }

    if (target.kind === 'node') {
      const id = target.id;
      const node = nodesRef.current.find(n => n.id === id);
      if (!node) return;
      if (action === 'duplicate') {
        copySelection(); // no-op if not selected; fall through to explicit copy
        clipboard.current = {nodes: [{...node, selected: true}], edges: []};
        pasteClipboard(30);
        return;
      }
      if (action === 'copy') {
        clipboard.current = {nodes: [{...node, position: {...node.position}, data: {...(node.data as any)}, selected: false}], edges: []};
        flash('Node copied');
        return;
      }
      if (action === 'delete') {
        pushHistory();
        setNodes(ns => ns.filter(n => n.id !== id));
        setEdges(es => es.filter(e => e.source !== id && e.target !== id));
        return;
      }
      if (action === 'front' || action === 'back') {
        pushHistory();
        setNodes(ns => {
          const cur = ns.find(n => n.id === id);
          if (!cur) return ns;
          const rest = ns.filter(n => n.id !== id);
          // children of a parent must stay after the parent in the array
          if (action === 'front') {
            const withP = rest.filter(n => n.parentId === cur.parentId);
            const withoutP = rest.filter(n => n.parentId !== cur.parentId);
            return [...withoutP, ...withP, cur];
          }
          // back: just before the first sibling (or at the very front)
          const firstSibling = rest.findIndex(n => n.parentId === cur.parentId);
          const at = firstSibling < 0 ? 0 : firstSibling;
          const out = [...rest];
          out.splice(at, 0, cur);
          return out;
        });
        return;
      }
      if (action === 'note') {
        // insert a Note node just below-right of this node
        pushHistory();
        const p = absPos(node, nodesRef.current);
        const nid = `n${idc++}`;
        setNodes(ns => {
          const note: Node = {
            id: nid, type: 'goblin',
            position: {x: p.x + nodeW(node) + 48, y: p.y + 12},
            data: {shape: 'note', kicker: 'note', title: 'New note', sub: '', icon: 'sticky-note', colorKey: 'slate'},
          };
          return [...ns, note];
        });
        return;
      }
    }

    if (target.kind === 'edge') {
      const id = target.id;
      const edge = edgesRef.current.find(e => e.id === id);
      if (!edge) return;
      if (action === 'editLabel') {
        setSelEdgeId(id);
        // signal the edge component to open its inline label editor
        setEdges(es => es.map(e => (e.id === id ? {...e, data: {...((e.data ?? {}) as EdgeData), __edit: Date.now()}} : e)));
        return;
      }
      if (action === 'reverse') {
        pushHistory();
        setEdges(es => es.map(e => {
          if (e.id !== id) return e;
          return {...e, source: e.target, target: e.source, sourceHandle: e.targetHandle, targetHandle: e.sourceHandle};
        }));
        return;
      }
      if (action === 'delete') {
        pushHistory();
        setEdges(es => es.filter(e => e.id !== id));
        return;
      }
    }
  }, [rf, pasteClipboard, pushHistory, setNodes, setEdges, flash, copySelection, absPos]);

  // ---- F5 node-toolbar actions: REMOVED (ITEM 2b, 2026-09-18) -------------
  // `toolbarActions` used to be injected into every node's `data` as
  // `__toolbar` and read by the three node kinds' floating action strip. Item 2
  // removed the strip, and this thread's LAST reader was `CustomShapeNode` /
  // `LabelNode` — both gone now, so the memo, the injection and the two node
  // kinds' `__toolbar` slot were removed together. Every one of the five
  // handlers here still exists under its own name and is reached from the hot
  // key or the context menu it always had (see the mapping in DiagramNode.tsx);
  // `ctxAction` in particular is still the context menu's dispatcher.

  // ---- F3 + F9 + F1: drag lifecycle ----
  const absNodes = useCallback((ns: Node[]) => {
    // cache absolute positions for helper lines / proximity / reparenting
    const map = new Map<string, {n: Node; x: number; y: number; w: number; h: number}>();
    ns.forEach(n => {
      const p = absPos(n, ns);
      map.set(n.id, {n, x: p.x, y: p.y, w: nodeW(n), h: nodeH(n)});
    });
    return map;
  }, [absPos]);

  const onNodeDrag = useCallback((_e: MouseEvent | TouchEvent, draggedNode: Node) => {
    const ns = nodesRef.current;
    const dragged = ns.find(n => n.id === draggedNode.id);
    if (!dragged) return;
    const absMap = absNodes(ns);
    const me = absMap.get(dragged.id);
    if (!me) return;

    // F3: helper lines — top-level single-node drags only (child nodes are
    // constrained by extent:'parent' and follow their group).
    // IMPORTANT: while dragging we ONLY show the guides, we never write the
    // node position (writing it every frame fights React Flow's own drag and
    // makes the node feel stuck/snapped). The snap is applied once, on drop.
    if (!dragged.parentId && alignGuides) {
      const others = [...absMap.values()].filter(v => v.n.id !== dragged.id && !v.n.parentId);
      const {guides: g} = computeHelperSnap(
        {x: me.x, y: me.y, w: me.w, h: me.h},
        others.map(v => ({x: v.x, y: v.y, w: v.w, h: v.h})),
      );
      helperDrag.current = true;
      setGuides(g);
    }

    // F9: proximity connect candidate (subtle, dashed) — top-level only
    if (proximity && !dragged.parentId) {
      const cx = me.x + me.w / 2, cy = me.y + me.h / 2;
      let best: {id: string; d: number; x: number; y: number} | null = null;
      [...absMap.values()].forEach(v => {
        if (v.n.id === dragged.id || v.n.parentId) return;
        const ox = v.x + v.w / 2, oy = v.y + v.h / 2;
        const dist = Math.hypot(cx - ox, cy - oy);
        if (dist > 260) return;
        const hx = cx < ox ? v.x : v.x + v.w;
        if (!best || dist < best.d) best = {id: v.n.id, d: dist, x: hx, y: oy};
      });
      if (best) {
        const b = best as {id: string; d: number; x: number; y: number};
        setProxEdge({from: dragged.id, to: b.id, fromPos: {x: me.x + me.w, y: cy}, toPos: {x: b.x, y: b.y}});
      } else setProxEdge(null);
    }
  }, [absNodes, proximity, setNodes, alignGuides]);

  const onNodeDragStop = useCallback((_e: MouseEvent | TouchEvent, draggedNode: Node) => {
    tickTask('move');
    // F3: apply the final snap (the release itself can move the node a hair)
    // then clear the helper lines.
    if (helperDrag.current) {
      helperDrag.current = false;
      const ns0 = nodesRef.current;
      const dragged0 = ns0.find(n => n.id === draggedNode.id);
      if (dragged0 && !dragged0.parentId) {
        const absMap0 = absNodes(ns0);
        const me0 = absMap0.get(dragged0.id);
        const others0 = [...absMap0.values()].filter(v => v.n.id !== dragged0.id && !v.n.parentId);
        if (me0 && others0.length) {
          const {position} = computeHelperSnap(
            {x: me0.x, y: me0.y, w: me0.w, h: me0.h},
            others0.map(v => ({x: v.x, y: v.y, w: v.w, h: v.h})),
          );
          setNodes(ns => ns.map(n => n.id === dragged0.id
            ? {...n, position: {x: Math.round(position.x), y: Math.round(position.y)}}
            : n));
        }
      }
      setGuides({vertical: null, horizontal: null});
    }

    // F9: proximity connect — drop near another node connects them
    if (proximity && proxEdge && proxEdge.from === draggedNode.id) {
      const pe = proxEdge;
      setProxEdge(null);
      const exists = edgesRef.current.some(e =>
        (e.source === pe.from && e.target === pe.to) || (e.source === pe.to && e.target === pe.from));
      if (!exists) {
        pushHistory();
        const ne = makeEdge(pe.from, pe.to, {...preset.edges, path: defaultPath, dash: 'dashed'}, `e${idc++}`);
        setEdges(es => addEdge(ne, es));
        flash('Proximity connection created');
        return;
      }
    }
    setProxEdge(null);

    // F1: reparent on drop — inside a group bounds → adopt; outside → release.
    const ns = nodesRef.current;
    const dragged = ns.find(n => n.id === draggedNode.id);
    if (!dragged || dragged.type === 'label') return;
    const absMap = absNodes(ns);
    const me = absMap.get(dragged.id);
    if (!me) return;

    const groups = ns.filter(n => asShape((n.data as any)?.shape) === 'group' && n.id !== dragged.id);
    // never adopt into one of my own (future) children
    const hit = groups.find(g => {
      const gp = absMap.get(g.id)!;
      return me.x >= gp.x && me.y >= gp.y && me.x + me.w <= gp.x + gp.w && me.y + me.h <= gp.y + gp.h;
    });

    if (hit && dragged.parentId !== hit.id) {
      const hp = absMap.get(hit.id)!;
      pushHistory();
      setNodes(ns2 => {
        const cur = ns2.find(n => n.id === dragged.id);
        if (!cur) return ns2;
        const child: Node = {
          ...cur,
          parentId: hit.id,
          extent: 'parent' as const,
          position: {x: Math.round(me.x - hp.x), y: Math.round(me.y - hp.y)},
        };
        // keep parent before children in the array
        const without = ns2.filter(n => n.id !== dragged.id);
        const parentIdx = without.findIndex(n => n.id === hit.id);
        const out = [...without];
        out.splice(parentIdx + 1, 0, child);
        return out;
      });
      flash(`Added to group “${(hit.data as any)?.title ?? hit.id}”`);
    } else if (!hit && dragged.parentId) {
      // dragged out of its group — keep the absolute position, drop the parent
      pushHistory();
      setNodes(ns2 => {
        const cur = ns2.find(n => n.id === dragged.id);
        if (!cur) return ns2;
        const out: Node = {...cur, parentId: undefined, extent: undefined, position: {x: Math.round(me.x), y: Math.round(me.y)}};
        const without = ns2.filter(n => n.id !== dragged.id);
        // place after the former parent so ordering stays valid for siblings
        const pIdx = without.findIndex(n => n.id === dragged.parentId);
        const at = pIdx < 0 ? without.length : pIdx + 1;
        const arr = [...without];
        arr.splice(at, 0, out);
        return arr;
      });
      flash('Removed from group');
    }
  }, [tickTask, proximity, proxEdge, absNodes, pushHistory, setNodes, setEdges, flash]);

  /** History push on every node drag start (position moves are undoable). */
  const onNodeDragStartAll = useCallback((_e: MouseEvent | TouchEvent, _node: Node) => {
    pushHistory();
  }, [pushHistory]);

  // ---- F4: edge reconnect (undoable, keeps type + data + styling) ----
  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    pushHistory();
    setEdges(es => reconnectEdge(oldEdge, newConnection, es));
  }, [pushHistory, setEdges]);

  // ---- Part C: connect on drop over a NODE ------------------------------
  // Dropping a connection drag on EMPTY canvas used to insert a fresh node at
  // the drop point and wire it up. That is gone on purpose: a missed drop
  // silently added a shape nobody asked for. Only a drop that lands ON an
  // existing node still connects.
  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, connectionState: any) => {
    const c = pendingDrop.current;
    pendingDrop.current = null;
    setGuides({vertical: null, horizontal: null});
    const clientX = 'clientX' in event ? event.clientX : (event as TouchEvent).changedTouches?.[0]?.clientX ?? 0;
    const clientY = 'clientY' in event ? event.clientY : (event as TouchEvent).changedTouches?.[0]?.clientY ?? 0;
    // Only when the drop was NOT on a valid handle and we know the source.
    if (!c || !rf || !wrap.current) return;
    if (connectionState?.isValid) return;
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    if (el?.closest('.react-flow__handle')) return;
    const b = wrap.current.getBoundingClientRect();
    const p = rf.screenToFlowPosition({x: clientX - b.left, y: clientY - b.top});
    // pick target: a node under the drop point — there is no longer a fallback
    // branch, so no node is ever created from a drop.
    const ns = nodesRef.current;
    const absMap = absNodes(ns);
    let targetId: string | null = null;
    for (const v of absMap.values()) {
      if (v.n.id === c.source) continue;
      if (p.x >= v.x && p.x <= v.x + v.w && p.y >= v.y && p.y <= v.y + v.h) { targetId = v.n.id; break; }
    }
    // Nothing under the drop point: this is a no-op. No node is inserted, no
    // edge is created, and pushHistory() is deliberately NOT called — a
    // cancelled gesture must not leave a phantom step on the undo stack. The
    // user sees nothing (silence, not a flash): a message would be noise for a
    // gesture that was simply released in the wrong place.
    if (!targetId) return;
    const src = c.source;
    const newId = `e${idc++}`;
    // The target node already exists in state, so the edge can be added
    // directly — the old `setTimeout` deferral only existed to wait for the
    // node this path used to insert.
    pushHistory();
    setEdges(es => addEdge(makeEdge(src, targetId!, {...preset.edges, path: defaultPath}, newId), es));
  }, [rf, absNodes, pushHistory, setEdges, preset, defaultPath]);

  // ---- connect ---- (new edges use the editable goblinEdge type)
  // D4: a second connection between the same ordered pair of nodes is not a
  // duplicate edge — it bumps a "×N" count on the existing one instead.
  const onConnect = useCallback((c: Connection) => {
    // G — direction guard. The 4-point scheme makes every handle a SOURCE, so
    // React Flow already builds the connection the way the user drew it; this
    // normalises it anyway, because the one thing that must never come back is
    // the arrowhead landing on the node the drag STARTED from. The origin is
    // `connectOrigin`, written by onConnectStart (the same params.nodeId
    // pendingDrop records) and cleared here — pendingDrop itself is left to
    // onConnectEnd, which needs it to decide whether to insert a node on drop.
    //
    // SCOPED to the four goblin handles on purpose. Dragging from an ERD column
    // handle ALSO records an origin (TableNode renders that node's own handles,
    // and its `left_rel_*` ends are genuine TARGETS), and there the reversal is
    // the CORRECT relationship direction — the node you land on is the
    // referencing one. Swapping those would invert the FK silently, so the
    // guard only fires when the drag began on one of the ids this pass owns.
    const origin = connectOrigin.current;
    connectOrigin.current = null;
    if (origin && GOBLIN_HANDLE_IDS.has(origin.handleId ?? '') && c.target === origin.nodeId) {
      c = {
        ...c,
        source: origin.nodeId,
        target: c.source,
        sourceHandle: c.targetHandle,
        targetHandle: c.sourceHandle,
      };
    }
    tickTask('edge');
    setEdges(es => {
      const twin = es.find(e =>
        e.source === c.source && e.target === c.target &&
        !(e.sourceHandle || e.targetHandle));
      if (twin) {
        const cur = ((twin.data as any)?.parallel ?? 1) as number;
        const next = cur + 1;
        return es.map(e => e.id === twin.id
          ? {...e, data: {...((e.data ?? {}) as EdgeData), parallel: next}, label: `×${next}`}
          : e);
      }
      pushHistory();
      // L3c: on an ERD board a connection between two columns is a relationship
      // between those columns — carry the handles through.
      return addEdge(makeEdge(c.source, c.target, {...preset.edges, path: defaultPath}, `e${idc++}`, {
        sourceHandle: c.sourceHandle, targetHandle: c.targetHandle,
      }), es);
    });
  }, [tickTask, pushHistory, setEdges, preset, defaultPath]);

  // ---- F7: connection rules applied to every new connection ----
  const onConnectRules = useCallback((c: Connection) => {
    if (c.source === c.target) return;
    if (noCycles && createsCycle(c.source, c.target)) {
      flash('Blocked: this connection would create a cycle (A→B→A)');
      return;
    }
    if (oneIn && !shiftDown.current) {
      const has = edgesRef.current.some(e => e.target === c.target);
      if (has) {
        flash('Blocked: target already has an incoming connection — hold Shift to allow more');
        return;
      }
    }
    onConnect(c);
  }, [noCycles, oneIn, createsCycle, onConnect, flash]);

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
    });
  }, [nodes, edges, pushHistory, setNodes, animateLayout, preset]);

  const selected = nodes.find(n => n.id === sel);
  const selectedEdge = edges.find(e => e.id === selEdgeId) ?? null;
  const edgeMode = !!selectedEdge && selCount === 0;

  const update = (patch: Partial<NodeKind> | Partial<LabelKind>) => {
    if (!sel) return;
    pushHistory();
    setNodes(ns => ns.map(n => n.id === sel ? {...n, data: {...n.data, ...patch}} : n));
  };

  /** Patch the selected edge only. Top-level keys plus style / markerEnd / markerStart. */
  const updateEdge = useCallback((patch: Partial<Edge> & {data?: EdgeData}, replaceData = false) => {
    if (!selEdgeId) return;
    if ('label' in patch) tickTask('label');
    pushHistory();
    setEdges(es => es.map(e => {
      if (e.id !== selEdgeId) return e;
      const {style, markerEnd, markerStart, data, ...rest} = patch;
      // markerEnd/markerStart: honour an explicit `none` (undefined) by REMOVING the key,
      // so the arrow head actually disappears — check for key presence, not value.
      const out: any = {...e, ...rest};
      if (style !== undefined) out.style = {...(e.style ?? {}), ...style};
      if ('markerEnd' in patch) { if (markerEnd === undefined) delete out.markerEnd; else out.markerEnd = markerEnd; }
      if ('markerStart' in patch) { if (markerStart === undefined) delete out.markerStart; else out.markerStart = markerStart; }
      if (data !== undefined) out.data = replaceData ? data : {...((e.data ?? {}) as EdgeData), ...data};
      return out as Edge;
    }));
  }, [selEdgeId, tickTask, pushHistory, setEdges]);

  /** Set stroke colour everywhere it is baked in (path + both markers). */
  /** L1 — the edge colour is stored as a KEY, so the path stroke, both markers
   *  and the payload filters all recolour with the theme. */
  const setEdgeColor = useCallback((key: ColorKey) => {
    const e = edgesRef.current.find(x => x.id === selEdgeId);
    if (!e) return;
    updateEdge(edgeColorPatch(key, {markerEnd: e.markerEnd, markerStart: e.markerStart}), true);
  }, [selEdgeId, updateEdge]);

  const onCommitLabel = useCallback((id: string, label: string) => {
    const cur = edgesRef.current.find(e => e.id === id);
    if (!cur || ((cur.label ?? '') as string) === label) return;
    tickTask('label');
    pushHistory();
    setEdges(es => es.map(e => (e.id === id ? {...e, label} : e)));
    setSelEdgeId(id);
  }, [tickTask, pushHistory, setEdges]);

  /** Edges get the label-commit callback + their path kind through data (custom
   *  edges only). L3c: crow's-foot markers are hand-authored SVG, so their
   *  `markerStart`/`markerEnd` become `url(#id)` here — derived from the data,
   *  so a theme switch needs no edge rewrite. */
  const rfEdges = useMemo(
    () => edges.map(e => {
      if (!isGoblinEdge(e.type)) return e;
      const crowStart = edgeMarkerUrl(e, 'start');
      const crowEnd = edgeMarkerUrl(e, 'end');
      const stroke = resolveColor(e.data as any);
      return {
        ...e,
        // L1: the rendered stroke is resolved from the symbolic key, so the
        // path, the payload filter, the envelope flap and the arrowhead all
        // recolour with the theme.
        style: {...e.style, stroke},
        ...(crowStart ? {markerStart: crowStart} : null),
        ...(crowEnd ? {markerEnd: crowEnd} : null),
        data: {
          ...((e.data ?? {}) as EdgeData),
          __type: e.type,
          onCommitLabel,
          // FB-L: the edge renderer owns the label's inline editor, so the
          // review-mode flag has to reach it per-edge — same shape as the two
          // keys above. Read-only keeps the label readable; it never opens the
          // input.
          readOnly,
        },
      };
    }),
    [edges, onCommitLabel, readOnly],
  );

  /** L3c: the symbolic keys whose crow's-foot glyphs this board needs. Keyed by
   *  KEY (not hex) so one <defs> set serves every theme — the glyph paints from
   *  `var(--c-*)` and the theme cascades. */
  const crowKeys = useMemo(() => {
    const ks = new Set<ColorKey>();
    edges.forEach(e => { if (hasCrow(e, 'start') || hasCrow(e, 'end')) ks.add(edgeStrokeKeyOf(e)); });
    return [...ks];
  }, [edges]);

  /** L3c: table nodes receive the board's show-mode and their own collapse
   *  handler. ITEM 2b removed the `__toolbar` injection — the action strip it
   *  fed no longer exists in any node kind, so there is nothing to inject. */
  const rfNodes = useMemo(
    () => nodes.map(n => {
      /* K — DEFECT 2: re-apply React Flow's `noPanClassName` token to the node
         WRAPPER while review mode is on. RF only writes that class itself while
         the node is draggable (`[noPanClassName]: isDraggable` in
         @xyflow/react's NodeWrapper), so `nodesDraggable={false}` REMOVES it and
         a drag starting on a node falls through to the pane and pans the canvas
         — the node then travels with the viewport and reads as "dragging the
         element". Outside review mode `n.className` is passed straight through,
         byte-for-byte as before: there RF sets the token itself. */
      const nodeClassName = readOnly ? [n.className, NO_PAN].filter(Boolean).join(' ') : n.className;
      if (n.type === 'table') {
        return {
          ...n,
          className: nodeClassName,
          data: {
            ...((n.data ?? {}) as any),
            __showMode: showMode,
            __onToggle: (id: string, collapsed: boolean) => {
              pushHistory();
              setNodes(ns => ns.map(m => m.id === id ? {...m, data: {...(m.data as any), collapsed}} : m));
            },
          },
        };
      }
      return {...n, className: nodeClassName};
    }),
    [nodes, showMode, pushHistory, setNodes, readOnly],
  );

  /* ---------------------------------------------------------------------
     PACKAGE-N 2b — insertion is keyed on IDENTITY, never on a rendered index.

     Both insert paths used to carry an index into the active preset's palette
     array: the drag payload was the index the panel rendered, and
     `SearchPalette` passed its own list index.
     That only worked while every caller rendered the SAME array it resolved
     against. The panel now renders a FILTERED subset of the one library, so a
     rendered index and a library index are different numbers and the mismatch is
     silent — the user drags one shape and gets another. `label` is unique across
     `LIBRARY` (verified: zero duplicates), which makes it the stable identity to
     travel with. Everything below the lookup is the previous body verbatim.
     --------------------------------------------------------------------- */
  const addNodeByLabel = (label: string, pos?: {x: number; y: number}) => {
    const item = LIBRARY.find(p => p.label === label);
    if (!item) return;
    const id = `n${idc++}`;
    const p = pos ?? (rf ? rf.screenToFlowPosition({x: 480, y: 300}) : {x: 480, y: 300});
    pushHistory();
    tickTask('node');

    // L3c: the ERD `table` node is its own node type (a column list is not a
    // Shape — its height varies with the number of columns).
    if (item.label === 'Table' && preset.id === 'erd') {
      setNodes(ns => [...ns, {
        id, type: 'table', position: p, selected: false,
        style: {width: 250, height: 170},
        data: {
          name: 'new_table',
          columns: [
            {id: `c${idc++}`, name: 'id', type: 'uuid', pk: true, notNull: true},
            {id: `c${idc++}`, name: 'created_at', type: 'timestamptz', notNull: true},
          ],
          colorKey: 'cyan',
        } as any,
      }]);
      return;
    }

    const data = item.make() as any;
    const shape = asShape(data?.shape);
    // C3: containers get sensible default dimensions so NodeResizer has a
    // baseline and the resize persists through node.style.
    const size = item.size ?? (shape === 'group'
      ? {width: 320, height: 200}
      : shape === 'note'
        ? {width: 200, height: 90}
        : null);
    // L3a: a flowchart node defaults to vertical handles and a label-only body.
    if (preset.id === 'flowchart' && shape !== 'group' && shape !== 'note') {
      data.handles = 'tb';
      data.body = 'label-only';
    }
    setNodes(ns => [...ns, {
      id, type: item.kind, position: p, data, selected: false,
      ...(size ? {style: {width: size.width, height: size.height}} : null),
    }]);
  };

  // ---- D1: insert via the searchable palette ----
  const insertFromSearch = useCallback((label: string) => {
    if (!searchPos) return;
    addNodeByLabel(label, searchPos);
    setSearchPos(null);
  }, [searchPos]);

  /* =====================================================================
     PACKAGE-N §6 — FAVOURITES (pass 3).

     The user's starred shapes, mirrored in component state and persisted to
     `/api/library` (§7, `src/library.ts`). Three rules shape the code below:

     1. THE PANEL NEVER WAITS ON THE NETWORK. `favourites` starts `[]` and the
        mount GET only ever REPLACES it when it succeeds. A failed GET is
        caught and ignored — an unreachable library must leave a working panel,
        not an error state or an unhandled rejection.
     2. STATE IS OPTIMISTIC. A star click updates `favourites` immediately and
        persists in the background; if the PUT fails we KEEP the local change
        (the user's work is not thrown away) and say so (§7.2 #4 — the library
        has no server copy, so "export it to a file" is the honest advice).
     3. A TOGGLE READS `prev`, NEVER A CLOSURE COPY. Two star clicks landing in
        one tick would both compute from the list as it was before the first,
        and the second silently drops the first. Worse, under StrictMode an
        updater runs TWICE, so the persist cannot live inside it either — the
        write is deferred past the commit and reads the committed list from a
        ref. That is why every mutation goes through `mutateFavourites`.
     ===================================================================== */
  const [favourites, setFavourites] = useState<library.Favourite[]>([]);
  /** Mirror of `favourites` for the persist step (same pattern as `nodesRef`):
   *  the write reads the list React has actually COMMITTED, never a closure
   *  copy that a same-tick second edit could have made stale. */
  const favouritesRef = useRef<library.Favourite[]>(favourites);
  favouritesRef.current = favourites;

  /* ---------------------------------------------------------------------
     PACKAGE-N §8.1–§8.2 pass 4b — the USER'S IMPORTED SHAPES, state only.

     Same three rules as the favourites block above, for the same reasons:

     1. THE PANEL NEVER WAITS ON THE NETWORK. `shapes` starts `[]` and the
        mount GET only ever REPLACES it on success; a failed GET leaves an
        empty list, never an error state.
     2. STATE IS OPTIMISTIC. Importing a shape updates `shapes` immediately and
        persists in the background; a failed PUT keeps the local change.
     3. THE WRITE READS THE COMMITTED LIST FROM A REF (`shapesRef`), so a
        persist deferred past the commit can never serialise a stale array.

     ONE EXTRA RULE HERE — §8.2 rule 8, THE STORED FILE IS UNTRUSTED. Whatever
     `/api/library` hands back goes through `parseCustomShapeEntry` before it
     reaches this state: a hand-edited, foreign or older-build entry is dropped
     (and so never reaches the canvas). This is the cheap structural gate; the
     component renders through `svgDataUri` into an `<img>`, which is the
     second, independent guard.
     --------------------------------------------------------------------- */
  const [shapes, setShapes] = useState<CustomShape[]>([]);
  /** Mirror of `shapes` for the persist step — see `favouritesRef`. */
  const shapesRef = useRef<CustomShape[]>(shapes);
  shapesRef.current = shapes;

  useEffect(() => {
    let alive = true;
    library.getLibrary()
      .then(doc => {
        if (!alive) return;
        setFavourites(Array.isArray(doc?.favourites) ? doc.favourites : []);
        // §8.2 rule 8 — gate EVERY stored entry, keep only what parses.
        const stored = Array.isArray((doc as any)?.shapes) ? (doc as any).shapes : [];
        const parsed: CustomShape[] = [];
        for (const entry of stored) {
          const res = parseCustomShapeEntry(entry, gridSize);
          if (res.ok) parsed.push(res.shape);
        }
        setShapes(parsed);
      })
      .catch(() => { /* offline / not yet stored — an empty panel is correct */ });
    return () => { alive = false; };
    /* DELIBERATELY mount-only (the block's deps are unchanged from the
       favourites-only version). `gridSize` is read here only to CLAMP the size
       of a shape off disk, and any pitch yields a legal clamped size; adding it
       to the deps would re-fetch on every pitch change and clobber optimistic
       local state with the server copy — a worse failure than a stale clamp
       that the next load corrects anyway. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Persist the library. Always called with the lists the caller has ALREADY
   *  decided to commit — never with a ref read at write time.
   *
   *  WHY THE LISTS ARE ARGUMENTS (measured bug, 2026-09-17): the write used to
   *  read `shapesRef.current` after a `setTimeout(0)`. That is only correct when
   *  the mutation happens in a SYNCHRONOUS event handler, because then React
   *  commits before the timer fires. The IMPORT path is different: it awaits
   *  `file.text()`, so it resumes as a microtask — the timer (a macrotask) fires
   *  FIRST, reading the ref before React has committed. Measured: the PUT left at
   *  **+2 ms carrying the PRE-import list**, while the DOM committed the new count
   *  at **+27 ms**. The visible effect was a server library permanently one
   *  import behind the panel (panel 4 / server 3), and a reload silently lost the
   *  newest shape. Passing the lists explicitly removes the dependency on WHEN
   *  the caller resumed.
   *
   *  It sends the CURRENT favourites too: the PUT replaces the whole document,
   *  so a shapes-only write would blank the user's favourites. */
  const persistLibrary = useCallback(async (
    favourites: library.Favourite[],
    shapes: CustomShape[],
  ) => {
    try {
      await library.saveLibrary(library.libraryDoc(favourites, shapes));
    } catch {
      // §7.2 #4 — never fail silently. Excalidraw's wording: the store is not
      // the user's only copy, and a file export is the escape hatch.
      flash("Couldn't save the library. Export it to a file so you don't lose changes.");
    }
  }, [flash]);

  /** The ONE way favourites change: a PURE updater, then a persist.
   *
   *  The updater must be pure because `setFavourites` updaters run TWICE under
   *  StrictMode. It must also read `prev` rather than a closure copy: two star
   *  clicks landing in one tick would otherwise both compute from the list as
   *  it was before the first one, and the second would silently drop the first
   *  (verified live — Queue vanished when Queue and Service were toggled in the
   *  same tick). The write therefore CANNOT live inside the updater; it is
   *  deferred past the commit and carries the list computed HERE.
   *
   *  `favouritesRef` is advanced SYNCHRONOUSLY, before `setState`, so a second
   *  mutation in the same tick computes from the first one's result instead of
   *  from stale state. React re-assigns the ref on the next render anyway, so
   *  the early write is invisible and only closes the window. */
  const mutateFavourites = useCallback(
    (updater: (prev: library.Favourite[]) => library.Favourite[]) => {
      const next = updater(favouritesRef.current);
      favouritesRef.current = next;
      setFavourites(next);
      window.setTimeout(() => { void persistLibrary(next, shapesRef.current); }, 0);
    },
    [persistLibrary],
  );

  /** §6.3 — the star control. Add when absent, remove when present. */
  const toggleFavourite = useCallback((item: PaletteItem) => {
    mutateFavourites(prev => library.toggleFavouriteItem(prev, item));
  }, [mutateFavourites]);

  const isStarred = useCallback(
    (label: string) => library.isFavouriteItem(favourites, label),
    [favourites],
  );

  /** §6.4 — the pending `+` tile: "add from selection". The stored payload
   *  carries each node's offset from the selection's corner (`__rel`), so the
   *  group keeps its internal layout while the insert re-derives the absolute
   *  geometry onto the drop point (§6.5). Prepend — the newest is on top. */
  const addFavouriteFromSelection = useCallback(() => {
    const selNodes = nodesRef.current.filter(n => n.selected);
    if (!selNodes.length) return;
    const ids = new Set(selNodes.map(n => n.id));
    // Built OUTSIDE the updater (it reads refs, not state) — the updater below
    // only has to be pure, not to re-derive the payload.
    const fav = library.favouriteFromSelection(selNodes, edgesRef.current.filter(
      e => ids.has(e.source) && ids.has(e.target),
    ));
    mutateFavourites(prev => [fav, ...prev]);
    flash(`Saved ${selNodes.length} node${selNodes.length === 1 ? '' : 's'} to Favourites`);
  }, [mutateFavourites, flash]);

  /** §6.5 — insert a favourite. NEVER trust stored geometry: re-generate ids,
   *  re-centre on the drop point, snap to `gridSize`, then select what landed.
   *
   *  A single-node favourite that still carries its palette label goes through
   *  the ONE canonical palette payload (`LIBRARY.find`), so the `Table`/erd
   *  special case and the container sizing in `addNodeByLabel` apply verbatim.
   *  Anything else is re-derived from the stored payload: shape, colourKey and
   *  the node `type` all come from data, and the geometry from the drop point. */
  const insertFavourite = useCallback((fav: library.Favourite, pos?: {x: number; y: number}) => {
    const label = library.favouriteLabel(fav);
    /* §6.5 step 2 — SNAP TO THE GRID. Unconditional, and deliberately NOT tied
       to the `snap` toolbar toggle: `addNodeByLabel` inserts at the raw drop
       point, but a favourite's geometry is stored as offsets only, so the drop
       point is the ONE thing that decides where the group lands. AC #17 tests
       this, so the favourite path always quantises to `gridSize`. */
    const snapTo = (v: number) => Math.round(v / gridSize) * gridSize;
    const drop = pos ?? (rf
      ? rf.screenToFlowPosition({
        x: (wrap.current?.clientWidth ?? 900) / 2,
        y: (wrap.current?.clientHeight ?? 600) / 2,
      })
      : {x: 480, y: 300});

    if (label && fav.nodes.length === 1) {
      // Identity path: the palette item rebuilds the payload, so no stored
      // field is trusted, and `Table` / group sizing / flowchart handles all
      // keep working because this IS the add path.
      const item = LIBRARY.find(p => p.label === label);
      if (item) {
        const before = new Set(nodesRef.current.map(n => n.id));
        addNodeByLabel(label, {x: snapTo(drop.x), y: snapTo(drop.y)});
        // §6.5 step 4 — select what landed. The insert commits to state a tick
        // later than this call, so the selection follows on the next tick.
        window.setTimeout(() => {
          const added = nodesRef.current.filter(n => !before.has(n.id)).map(n => n.id);
          if (!added.length) return;
          const ids = new Set(added);
          setNodes(ns => ns.map(n => ids.has(n.id) ? {...n, selected: true} : {...n, selected: false}));
        }, 0);
        return;
      }
      // A stored label that no longer exists in the library falls through to
      // the generic path rather than silently inserting nothing.
    }

    pushHistory();
    tickTask('node');
    const idMap = new Map<string, string>();
    const stored = fav.nodes as any[];
    /* §6.5 step 1 — RE-CENTRE. `__rel` is a node's offset from the favourite's
       own top-left, so the group's BOUNDING BOX CENTRE is what lands on the
       drop point: the offsets are kept exact (the internal layout is the one
       thing worth preserving) and only the anchor is quantised to the grid. */
    const offs = stored.map(n => {
      const rel = (n as any)[library.REL_KEY];
      return rel && typeof rel.x === 'number' && typeof rel.y === 'number'
        ? {x: rel.x, y: rel.y}
        : null;
    });
    const known = offs.filter(Boolean) as {x: number, y: number}[];
    const centre = known.length
      ? {
        x: (Math.min(...known.map(o => o.x)) + Math.max(...known.map(o => o.x))) / 2,
        y: (Math.min(...known.map(o => o.y)) + Math.max(...known.map(o => o.y))) / 2,
      }
      : {x: 0, y: 0};
    const anchor = {x: snapTo(drop.x) - centre.x, y: snapTo(drop.y) - centre.y};

    const newNodes: Node[] = stored.map((storedNode, i) => {
      /* Two stored payload shapes are legal (see `library.ts`): a plain palette
         payload, or a stripped node wrapper. `payload` is whichever object
         actually holds the node `data`; the marker keys are dropped from it. */
      const payload = (storedNode?.data ?? storedNode) as any;
      const {[library.LABEL_KEY]: _l, [library.REL_KEY]: _r, __src: _s, ...payloadData} = payload;
      void _l; void _r; void _s;
      const rel = offs[i] ?? {x: 0, y: 0};
      // §6.5 step 3 — RE-GENERATE IDS. Never reuse a stored one: it may collide
      // with an id already on this board.
      const id = `n${idc++}`;
      // A selection copy stores no board id at all, so `__src` is its only
      // reference; `storedNode.id` covers a hand-written library file that did
      // keep one.
      idMap.set(storedNode.__src ?? storedNode.id ?? String(i), id);
      return {
        id,
        type: (storedNode.type ?? 'goblin') as string,
        position: {x: anchor.x + rel.x, y: anchor.y + rel.y},
        data: payloadData,
        // A selection copy keeps its own `style` (a container's size); a
        // palette payload never had one, so nothing is invented here.
        ...(storedNode.style ? {style: storedNode.style} : null),
        selected: true,
      } as Node;
    });

    const newEdges: Edge[] = (fav.edges ?? []).map((se: any) => {
      const {selected: _sel, ...rest} = se;
      void _sel;
      const src = idMap.get(se.source) ?? idMap.get(String(se.source));
      const tgt = idMap.get(se.target) ?? idMap.get(String(se.target));
      return src && tgt ? ({...rest, id: `e${idc++}`, source: src, target: tgt, selected: false} as Edge) : null;
    }).filter(Boolean) as Edge[];

    setNodes(ns => [...ns.map(n => (n.selected ? {...n, selected: false} : n)), ...newNodes]);
    if (newEdges.length) setEdges(es => [...es, ...newEdges]);
  }, [addNodeByLabel, gridSize, pushHistory, setNodes, setEdges, rf, tickTask]);

  /* =====================================================================
     PACKAGE-N §8.1–§8.3 pass 4b — CUSTOM-SHAPE library mutations.

     `insertCustomShape` is the CANVAS half (the import UI is pass 4c): it is
     the only place a custom shape becomes a node. Two §6.5 rules carry over
     from the favourite path verbatim — the id is re-derived from the module
     counter and the position is re-quantised to the grid, because a stored
     coordinate is not a thing to trust.
     ===================================================================== */

  /** Insert an imported shape at `pos` (or the viewport centre), grid-quantised. */
  const insertCustomShape = useCallback((shape: CustomShape, pos?: {x: number; y: number}) => {
    pushHistory();
    tickTask('node');
    // §6.5 step 2 — SNAP TO THE GRID, unconditionally: the drop point is the
    // only thing that decides where this lands, so it is the thing quantised.
    const raw = pos ?? (rf
      ? rf.screenToFlowPosition({
        x: (wrap.current?.clientWidth ?? 900) / 2,
        y: (wrap.current?.clientHeight ?? 600) / 2,
      })
      : {x: 480, y: 300});
    const p = {x: Math.round(raw.x / gridSize) * gridSize, y: Math.round(raw.y / gridSize) * gridSize};
    // §6.5 step 3 — RE-GENERATE THE ID. Never a stored one.
    const id = `n${idc++}`;
    setNodes(ns => [...ns, {
      id,
      type: 'customshape',
      position: p,
      selected: false,
      // §8.3 — the size came from `clampShapeSize` at import, so it is already
      // quantised and inside 32–512; the resizer holds the same window live.
      style: {width: shape.w, height: shape.h},
      data: {svg: shape.data, viewBox: shape.viewBox, title: shape.title, colorKey: shape.colorKey},
    } as Node]);
  }, [gridSize, pushHistory, setNodes, rf, tickTask]);

  /** The ONE way `shapes` changes: a PURE updater, then a persist — the same
   *  contract as `mutateFavourites`, for the same StrictMode reason. The write
   *  is deferred past the commit and reads the committed list from `shapesRef`;
   *  it sends the CURRENT favourites with it, so the two halves of the library
   *  document are never written apart. */
  const mutateShapes = useCallback(
    (updater: (prev: CustomShape[]) => CustomShape[]) => {
      /* The ref is advanced SYNCHRONOUSLY, before `setState` — see the
         measured race documented on `persistLibrary`. The import path resumes
         from `await file.text()`, so reading the ref at write time would read
         the PRE-import list. Computing `next` here and passing it makes the
         write independent of when React commits. */
      const next = updater(shapesRef.current);
      shapesRef.current = next;
      setShapes(next);
      window.setTimeout(() => { void persistLibrary(favouritesRef.current, next); }, 0);
    },
    [persistLibrary],
  );

  /** §8.1 — drop an imported shape from the library, then persist.
   *
   *  IDENTITY NOTE: a `CustomShape` has NO id field (the spec's §8.1 store is
   *  `{title, tags, data, w, h, aspect, colorKey, viewBox, sanitizer,
   *  sanitizedAt, created}`). `created` is the epoch-ms stamp taken once at
   *  import, which makes it the entry's stable, unique identity; the `title`
   *  is also accepted so a caller holding only a label can still remove it. */
  const removeCustomShape = useCallback((id: string) => {
    const matches = (s: CustomShape) => String(s.created) === id || s.title === id;
    if (!shapesRef.current.some(matches)) return;   // nothing to remove, nothing to persist
    mutateShapes(prev => prev.filter(s => !matches(s)));
  }, [mutateShapes]);

  /* =====================================================================
     PACKAGE-N §8.1–§8.3 pass 4c — the IMPORT UI.

     One file → one stored shape, and ONE path does it (`importShapeFile`): the
     hidden picker, the drop zone in the panel and a file dropped on the canvas
     all funnel through it, so all three gate, parse and report identically.
     ===================================================================== */

  /** The hidden `<input type=file>`; `display:none` inputs can only be opened
   *  programmatically, so every "import" affordance clicks this one node. */
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const openShapeImport = useCallback(() => { importInputRef.current?.click(); }, []);

  /** §8.1 — the one place a `File` becomes a stored shape.
   *
   *  ORDER MATTERS: the type gate comes first. A PNG is not an oversized SVG,
   *  it is the wrong kind of file, and answering it with the size limit would
   *  send the user off editing dimensions that were never the problem. The
   *  size gate is then measured on the `File` itself, so a 40 MB file is
   *  rejected without ever being read into memory. */
  const importShapeFile = useCallback(async (file: File) => {
    const name = file.name || '';
    if (!/\.svg$/i.test(name) && file.type !== 'image/svg+xml') {
      flash('Only .svg files can be imported.');
      return;
    }
    if (file.size > SHAPE_MAX_INPUT_BYTES) {
      flash(SHAPE_REJECT_MESSAGE['too-large']);
      return;
    }
    let raw: string;
    try {
      raw = await file.text();
    } catch {
      flash("Couldn't read that file.");
      return;
    }
    // §8.1 — naming is OPTIONAL (settled): the file's own name is the title,
    // minus the extension, with a neutral fallback. No prompt, ever.
    const title = name.replace(/\.svg$/i, '').trim() || 'Imported shape';
    const res = newCustomShape({raw, title, colorKey: 'cyan', gridSize});
    // The `'reason' in` discriminant is the idiom `customShape.ts` itself uses
    // (see `newCustomShape`); a rejection is ALWAYS reported, because the toast
    // is the only feedback there is — silence would look like a dead button.
    if ('reason' in res) {
      flash(SHAPE_REJECT_MESSAGE[res.reason]);
      return;
    }
    const shape = res.shape;
    // Prepend: the newest import is the one the user is about to place.
    mutateShapes(prev => [shape, ...prev]);
    flash(`Imported “${shape.title}”.`);
  }, [flash, gridSize, mutateShapes]);

  const onImportInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared BEFORE the read: choosing the same file twice must fire `change`
    // twice, and a retained value silently swallows the second pick.
    e.target.value = '';
    if (file) void importShapeFile(file);
  }, [importShapeFile]);

  /** Resolve a dragged custom-shape payload — the sanitised markup itself —
   *  back to its stored entry, then insert it at `pos`.
   *
   *  IDENTITY: the payload carries no id (a `CustomShape` has none), and the
   *  markup is exactly what the library holds, so matching on `data` is exact.
   *  Read through the ref so this stays a stable callback. */
  const dropCustomShape = useCallback((payload: string, pos?: {x: number; y: number}) => {
    const found = shapesRef.current.find(s => s.data === payload);
    if (found) insertCustomShape(found, pos);
  }, [insertCustomShape]);

  /** The `DataTransfer` type list, normalised — `types` is a `DOMStringList`
   *  in older DOM libs and a readonly array in newer ones, so it is copied
   *  into a plain array and both shapes work. */
  const dragTypes = (e: React.DragEvent): string[] => {
    const t = e.dataTransfer?.types;
    return t ? Array.from(t as ArrayLike<string>) : [];
  };

  /** The panel drop zone's own drop path. It cannot be omitted: the zone lives
   *  in the left panel, and `main` (which owns the canvas drop) is a SIBLING,
   *  so a file dropped there bubbles to no handler at all. It is wired through
   *  `shapeZoneProps` below rather than a second JSX drop attribute, keeping
   *  the canvas `onDrop` the single drop path in this file. */
  const onShapeZoneDragOver = useCallback((e: React.DragEvent) => {
    // Claim the event ONLY when it carries OS files — an ordinary node drag
    // passing over the panel must not be treated as an import.
    if (dragTypes(e).includes('Files')) e.preventDefault();
  }, []);

  const onShapeZoneDrop = useCallback((e: React.DragEvent) => {
    if (!dragTypes(e).includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) void importShapeFile(file);
  }, [importShapeFile]);

  const shapeZoneProps = {onDragOver: onShapeZoneDragOver, onDrop: onShapeZoneDrop};

  // ---- drag & drop from palette ----
  const onDrop = useCallback((e: React.DragEvent) => {
    // A file dropped anywhere on the canvas is an IMPORT (§8.1), not a node
    // placement — same path as the picker.
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (!e.dataTransfer.types || dragTypes(e).includes('Files'))) {
      e.preventDefault();
      void importShapeFile(droppedFile);
      return;
    }
    e.preventDefault();
    if (!rf || !wrap.current) return;
    const favId = e.dataTransfer.getData('favourite');
    const label = e.dataTransfer.getData('palette');
    const cust = e.dataTransfer.getData('customshape');
    if (!favId && !label && !cust) return;
    const b = wrap.current.getBoundingClientRect();
    const p = rf.screenToFlowPosition({x: e.clientX - b.left, y: e.clientY - b.top});
    // §6.5 — a favourite drop re-derives the geometry at the drop point; the
    // payload carried only the favourite's ID, never a stored coordinate.
    if (cust) {
      // The custom-shape payload IS the sanitised markup: it carries no id,
      // and the store holds exactly this string, so it resolves back exactly.
      dropCustomShape(cust, p);
      return;
    }
    if (favId) {
      const fav = favourites.find(f => f.id === favId);
      if (fav) insertFavourite(fav, p);
      return;
    }
    addNodeByLabel(label, p);
  }, [rf, favourites, insertFavourite, dropCustomShape, importShapeFile]);

  // ---- record history on destructive changes only ----
  // Node and edge removals arrive as separate callbacks for one Del press,
  // so a short guard merges them into a single history entry.
  const removeGuard = useRef(false);
  const noteRemove = useCallback(() => {
    if (removeGuard.current) return;
    removeGuard.current = true;
    window.setTimeout(() => { removeGuard.current = false; }, 0);
    pushHistory();
  }, [pushHistory]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    if (changes.some(c => c.type === 'remove')) noteRemove();
    onNodesChange(changes);
  }, [onNodesChange, noteRemove]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (changes.some(c => c.type === 'remove')) noteRemove();
    onEdgesChange(changes);
  }, [onEdgesChange, noteRemove]);

  // ---- align / distribute ----
  const align = useCallback((kind: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => {
    const selNodes = nodesRef.current.filter(n => n.selected);
    if (selNodes.length < 2) return;
    pushHistory();
    const lefts = selNodes.map(n => n.position.x);
    const rights = selNodes.map(n => n.position.x + nodeW(n));
    const tops = selNodes.map(n => n.position.y);
    const bottoms = selNodes.map(n => n.position.y + nodeH(n));
    const minL = Math.min(...lefts);
    const maxR = Math.max(...rights);
    const minT = Math.min(...tops);
    const maxB = Math.max(...bottoms);
    const cx = (minL + maxR) / 2;
    const cy = (minT + maxB) / 2;
    const ids = new Set(selNodes.map(n => n.id));
    setNodes(ns => ns.map(n => {
      if (!ids.has(n.id)) return n;
      const w = nodeW(n);
      const h = nodeH(n);
      let x = n.position.x;
      let y = n.position.y;
      if (kind === 'left') x = minL;
      else if (kind === 'right') x = maxR - w;
      else if (kind === 'hcenter') x = cx - w / 2;
      else if (kind === 'top') y = minT;
      else if (kind === 'bottom') y = maxB - h;
      else if (kind === 'vcenter') y = cy - h / 2;
      return {...n, position: {x: Math.round(x), y: Math.round(y)}};
    }));
  }, [pushHistory, setNodes]);

  const distribute = useCallback((axis: 'h' | 'v') => {
    const selNodes = nodesRef.current.filter(n => n.selected);
    if (selNodes.length < 3) return;
    pushHistory();
    const sorted = [...selNodes].sort((a, b) =>
      axis === 'h' ? a.position.x - b.position.x : a.position.y - b.position.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const start = axis === 'h' ? first.position.x : first.position.y;
    const end = axis === 'h'
      ? last.position.x + nodeW(last)
      : last.position.y + nodeH(last);
    const total = sorted.reduce((s, n) => s + (axis === 'h' ? nodeW(n) : nodeH(n)), 0);
    const gap = (end - start - total) / (sorted.length - 1);
    const posMap = new Map<string, number>();
    let cursor = start;
    for (const n of sorted) {
      posMap.set(n.id, Math.round(cursor));
      cursor += (axis === 'h' ? nodeW(n) : nodeH(n)) + gap;
    }
    setNodes(ns => ns.map(n => {
      if (!posMap.has(n.id)) return n;
      const v = posMap.get(n.id)!;
      return {...n, position: axis === 'h' ? {x: v, y: n.position.y} : {x: n.position.x, y: v}};
    }));
  }, [pushHistory, setNodes]);

  // Part B — ONE source of truth for the read-only review toggle. The toolbar
  // button and the Shift+2 shortcut both call this, so the two triggers can
  // never drift apart. The body is the button's original inline onClick,
  // carried across verbatim; the deps list every value it reads (`readOnly`,
  // `rf`) and every setter it calls, so neither path can close over a stale
  // `readOnly` and flip the mode the wrong way.
  const toggleReadOnly = useCallback(() => {
    const next = !readOnly;
    setReadOnly(next);
    try { localStorage.setItem(READ_ONLY_KEY, next ? '1' : '0'); } catch { /* ignore */ }
    if (next) {
      // Entering the mode must not leave a stale ring or node
      // toolbar on screen: `elementsSelectable={false}` only stops
      // FUTURE selections, it does not clear an existing one — and
      // the node toolbar / resize handles render off `selected`.
      setCtx(null);
      setSearchPos(null);
      if (rf) {
        rf.setNodes(nss => nss.map(n => n.selected ? {...n, selected: false} : n));
        rf.setEdges(es => es.map(e2 => e2.selected ? {...e2, selected: false} : e2));
      }
      setSel(null);
      setSelEdgeId(null);
      setSelCount(0);
      flash('Read-only review mode');
    } else {
      flash('Editing enabled');
    }
  }, [readOnly, rf, flash, setCtx, setSearchPos, setSel, setSelEdgeId, setSelCount]);

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      // M / §3.3: while the Settings dialog is open the app's shortcuts are
      // inert — no bare d/z/? and no arrow-nudge while the user tabs the nav.
      // (The dialog's own capture listener owns Escape; see the branch below.)
      if (settingsOpen) return;
      // ITEM 6b: the board dialog owns the keyboard too, and this return is
      // DELIBERATELY HERE — above the Escape branch below, not in the overlay
      // guard after it. The board MENU is handled down there because Escape is
      // the way out of a menu and the branch below is what closes it. The dialog
      // is different: its own capture listener owns Escape (cancel) and Tab
      // (the trap), so if this returned further down, Escape would ALSO reach the
      // branch below and deselect every node on the canvas behind the dialog —
      // the dialog would close and the user's selection would silently vanish.
      // `isEditable(e.target)` above covers the name field, so typing is never
      // swallowed; this line only stops the app's shortcuts landing behind it.
      if (boardDlg) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      // D3: Escape clears node + edge selection and closes any open popovers.
      // It is handled FIRST, before the overlay guard below, on purpose: Escape
      // is the way OUT of every surface that guard protects. Move it after and
      // Escape stops closing search → help → boards.
      if (e.key === 'Escape') {
        // M: Settings closes first — before search → help → boards → clear.
        if (settingsOpen) { setSettingsOpen(false); return; }
        if (searchPos) { setSearchPos(null); return; }
        if (help) { setHelp(false); return; }
        if (boardsOpen) { setBoardsOpen(false); return; }
        if (rf) {
          rf.setNodes(ns => ns.map(n => n.selected ? {...n, selected: false} : n));
          rf.setEdges(es => es.map(e2 => e2.selected ? {...e2, selected: false} : e2));
        }
        return;
      }
      // H1: any other overlay on screen owns the keyboard. While the onboarding
      // tour, the help popover, a board menu or the insert palette is open, an
      // app shortcut must not fire behind it — a stray ⌘Z during the tour would
      // undo the newcomer's own work, and `?` would stack the cheat sheet on top
      // of a surface that is already being read. The tour handles its own
      // Arrow/Enter/Escape in a CAPTURE listener that stops propagation
      // (Tour.tsx), so those keys never arrive here and keep working.
      if (tourOpen || help || boardsOpen || searchPos) return;
      // Shift+1 (physical Digit1) — "fit view", the Figma/Excalidraw/Miro
      // convention. It carries a modifier, so it is legal under this app's
      // no-bare-key rule. Matched on `e.code`, NOT `e.key`: on most layouts
      // Shift+1 delivers `!` as the key, so a key-based match would break.
      // The overlay guard above and the `isEditable(e.target)` early-return at
      // the top of this handler keep typing (and open overlays) safe.
      if (e.shiftKey && e.code === 'Digit1' && !mod) {
        e.preventDefault();
        rf?.fitView({padding: 0.25});
        return;
      }
      // Shift+2 (physical Digit2) — toggle the read-only review mode. Same
      // convention as Shift+1: it carries a modifier, so it is legal under this
      // app's no-bare-key rule, and it is matched on `e.code`, NOT `e.key` —
      // Shift+2 delivers `@` as the key on most layouts, so a key-based match
      // would break.
      // PLACEMENT IS LOAD-BEARING: this branch sits ABOVE the `if (readOnly)`
      // early-return a few lines below. The mode must be enterable AND
      // leavable by the same key, so the shortcut has to be reached before the
      // handler starts swallowing everything. Move it below that return and the
      // shortcut becomes one-way: it can switch the mode ON and then never OFF.
      // It also deliberately sits after the overlay guard above, so a stray
      // Shift+2 cannot flip the mode behind the tour, help, a board menu or the
      // insert palette.
      if (e.shiftKey && e.code === 'Digit2' && !mod) {
        e.preventDefault();
        toggleReadOnly();
        return;
      }
      // ---- Part B: read-only review mode owns no mutation --------------------
      // Placed HERE on purpose — after `isEditable`, after the Settings guard,
      // after Escape (the way out of every overlay) and after Shift+1, so those
      // three keep working: they change the VIEWPORT or close a surface, never
      // the board. Everything below this point mutates, so in review mode the
      // handler returns before reaching it: undo, redo, copy, paste, duplicate,
      // the panel-visibility chord, arrow-nudge and the `/` panel-search focus
      // are all inert. `?` (the cheat sheet) is a pure read surface and is
      // explicitly kept available.
      if (readOnly) {
        if (k === '?') { setHelp(h => !h); return; }
        return;
      }
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (mod && k === 'c') { copySelection(); return; }
      if (mod && k === 'v') { e.preventDefault(); pasteClipboard(40); return; }
      if (mod && k === 'd') { e.preventDefault(); duplicateSelection(); return; }
      // ---- M3/S2c: panel chrome — the shortcut is ATOMIC and VISIBLE-driven --
      // Shift+Mod+\ : hide BOTH docked panels if either one is on screen, else
      //               show BOTH (Figma ships the same group toggle; a single
      //               panel is reachable from its own edge chevron). A bare
      //               Mod+\ is intentionally NOT a binding: it falls through to
      //               the handlers below.
      //
      // Root cause of the desync this replaces (that history also included a
      // third, now-deleted visible state — the C4 auto-hide, retired in M3/S2d):
      // after a chevron press the visible state and the raw `collapsed` flags
      // disagreed. The old code derived `next` from `collapsed.left &&
      // collapsed.right`, i.e. from the STATE, while the user was watching the
      // SCREEN: a left-only collapse read as "not both collapsed" → next=true →
      // it wrote right:true for a right panel that was already hidden, so the
      // press changed nothing the eye could see. Reading the VISIBLE state and
      // writing both sides in ONE setState (see `setPanelsVisible`) makes that
      // failure unreachable — and with only ONE flag per side left, there is no
      // residue (the retired `pinned`) that could hold a panel open either.
      if (mod && e.shiftKey && k === '\\') {
        e.preventDefault();
        const {left, right} = hiddenRef.current;
        // any panel visible → hide both; none visible → show both
        setPanelsVisible(left && right);
        return;
      }
      // arrow keys nudge the selection: 1px, Shift+arrow 10px
      if (k === 'arrowleft' || k === 'arrowright' || k === 'arrowup' || k === 'arrowdown') {
        const step = e.shiftKey ? 10 : 1;
        const selAny = nodesRef.current.some(n => n.selected);
        if (!selAny) return;
        e.preventDefault();
        if (k === 'arrowleft') nudge(-step, 0);
        else if (k === 'arrowright') nudge(step, 0);
        else if (k === 'arrowup') nudge(0, -step);
        else nudge(0, step);
        return;
      }
      // D3: Escape clears node + edge selection and closes any open popovers
      // (handled above, before the overlay guard — Escape must stay the way out).
      if (k === '?') { setHelp(h => !h); return; }
      // ---- PACKAGE-N 2c: `/` focuses the panel's shape search --------------
      // draw.io's convention. Three guards, all required:
      //   * `mod` — a bare `/` only. Mod+/ is left for a future binding and is
      //     not stolen from the browser (Cmd+/ is a real shortcut elsewhere).
      //   * the overlay guard ABOVE already returned while the tour, help, the
      //     board menu or the insert modal is up, so `/` cannot focus a field
      //     behind a dialog.
      //   * `isEditable(e.target)` at the top of this handler means `/` typed
      //     INTO a field (including this one) can never re-trigger — which is
      //     what keeps the shortcut from fighting the handler. No `preventDefault`
      //     is needed to swallow the character: we focus the field, so the `/`
      //     never reaches anything that would render it.
      if (k === '/' && !mod && !isEditable(e.target) && isPanelVisible('left')) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, copySelection, pasteClipboard, duplicateSelection, nudge, rf, searchPos, help, boardsOpen, settingsOpen,
      setPanelsVisible, tourOpen, readOnly, toggleReadOnly, boardDlg]);

  // ---- C5: live zoom level for the zoom pill ----
  const ZoomPill = () => {
    const z = useStore(s => s.transform[2]);
    return (
      <Tooltip label="Reset zoom to 100%">
        <button
          type="button"
          className="zoom-pill"
          aria-label="Reset zoom to 100%"
          onClick={() => rf?.zoomTo(1)}
        >
          {Math.round(z * 100)}%
        </button>
      </Tooltip>
    );
  };

  // ---- I4: reliable cross-browser download (Safari on LAN blocks downloads
  // from a detached anchor with a giant data:/blob: URL). Use a Blob + object
  // URL, attach the anchor to the DOM, click it, then clean up on a timeout.
  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 4000); // give Safari time to start the download before revoking
  };

  // ---- export SVG (serialize the live flow viewport) ----
  const exportSvg = () => {
    const el = wrap.current?.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!el || !rf) return;
    const b = (rf as any).getNodesBounds(nodes);
    const pad = 48;
    const w = Math.ceil((b.width ?? 800) + pad * 2);
    const h = Math.ceil((b.height ?? 400) + pad * 2);
    const clone = el.cloneNode(true) as HTMLElement;
    clone.setAttribute('transform', `translate(${pad - (b.x ?? 0)},${pad - (b.y ?? 0)})`);
    // L1: exports read the LIVE theme — a light board exports on a light
    // background, and the resolved token values are inlined so `var(--…)`
    // inside the serialised DOM (node accents, shape strokes) still resolves.
    const tokenCss = EXPORT_TOKENS.map(t => `    ${t}:${readToken(t, '#888')};`).join('\n');
    const bg = readToken('--bg', '#0b0b0d');
    const dim = readToken('--dim', '#8a8a92');
    const fg = readToken('--fg', '#e8e8ea');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" data-theme="${theme}">
<rect width="${w}" height="${h}" fill="${bg}"/>
<style>
  :root, svg {${'\n'}${tokenCss}
  }
  .node{font-family:ui-monospace,Menlo,Consolas,monospace}
  .node-body{padding:13px 15px 12px}
  .node-kicker{font-size:9.5px;letter-spacing:.11em;text-transform:uppercase;fill:${dim}}
  .node-title{font-size:14.5px;font-weight:650;fill:${fg}}
  .node-sub{font-size:11.5px;fill:${dim}}
  .node-metric{font-size:20px;font-weight:700}
  text{font-family:ui-monospace,Menlo,Consolas,monospace}
</style>
<foreignObject width="100%" height="100%">
  <div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px">
    ${clone.outerHTML}
  </div>
</foreignObject>
</svg>`;
    const blob = new Blob([svg], {type: 'image/svg+xml'});
    download(blob, 'diagram.svg');
    tickTask('export');
  };

  const exportJson = () => {
    tickTask('export');
    if (curBoard) {
      // download the current board, including its name so it can be re-imported
      const data = JSON.stringify({name: curBoard.name, nodes, edges}, null, 2);
      download(new Blob([data], {type: 'application/json'}), `${curBoard.name.replace(/[^\w.-]+/g, '_') || 'board'}.json`);
      flash('Downloaded this board as JSON');
    } else {
      const data = JSON.stringify({nodes, edges}, null, 2);
      download(new Blob([data], {type: 'application/json'}), 'diagram.json');
    }
  };

  // ---- export PNG (2x) ----
  const exportPng = async () => {
    const el = wrap.current?.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!el || !rf || !nodes.length) return;
    tickTask('export');
    const b = (rf as any).getNodesBounds(nodes) as {x: number; y: number; width: number; height: number};
    const pad = 48;
    const imageWidth = Math.ceil((b.width ?? 800) + pad * 2);
    const imageHeight = Math.ceil((b.height ?? 400) + pad * 2);
    const transform = `translate(${pad - (b.x ?? 0)}px, ${pad - (b.y ?? 0)}px) scale(1)`;
    const prev = el.style.transform;
    el.style.transform = transform;
    try {
      // I4: html-to-image can hang (especially over the network while fetching
      // fonts/stylesheets) — race it with a timeout so the user gets feedback.
      const dataUrl = await Promise.race([
        toPng(el, {
          // L1: the PNG background follows the live theme.
          backgroundColor: readToken('--bg', '#0b0b0d'),
          width: imageWidth,
          height: imageHeight,
          pixelRatio: 2,
          skipFonts: true, // avoid cross-origin stylesheet fetches (I4)
          style: {width: `${imageWidth}px`, height: `${imageHeight}px`, transform},
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('PNG export timed out')), 20000)),
      ]);
      // data-URL → Blob so Safari accepts the download from a remote origin.
      const bin = atob(dataUrl.split(',')[1] ?? '');
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      download(new Blob([bytes], {type: 'image/png'}), 'diagram.png');
      flash('Exported diagram.png');
    } catch {
      flash('PNG export failed');
    } finally {
      el.style.transform = prev;
    }
  };

  // ---- import JSON ----
  const fileRef = useRef<HTMLInputElement>(null);

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const okNodes = Array.isArray(parsed?.nodes) && parsed.nodes.every((n: any) =>
        n && typeof n.id === 'string' && n.position &&
        typeof n.position.x === 'number' && typeof n.position.y === 'number');
      const okEdges = Array.isArray(parsed?.edges) && parsed.edges.every((ed: any) =>
        ed && typeof ed.id === 'string' && typeof ed.source === 'string' && typeof ed.target === 'string');
      if (!okNodes || !okEdges) {
        flash('Import failed: invalid diagram JSON');
        return;
      }
      // keep generated ids ahead of anything imported
      let maxId = idc;
      for (const n of parsed.nodes as Node[]) {
        const m = /^n(\d+)$/.exec(n.id);
        if (m) maxId = Math.max(maxId, Number(m[1]) + 1);
      }
      idc = maxId;
      // importing resets the history to the imported state.
      // Legacy files carry no edge type — normalise so old edges stay editable.
      const importedEdges: Edge[] = (parsed.edges as Edge[]).map(ed => ({
        ...ed,
        type: isGoblinEdge(ed.type) ? ed.type : 'goblinEdge',
        data: {...((ed.data ?? {}) as EdgeData)},
      }));
      past.current = [];
      future.current = [];
      setNodes(parsed.nodes);
      setEdges(importedEdges);
      bumpHist(v => v + 1);
      // Import replaces the CURRENT board's content (or seeds a new board when
      // none is open) — it does not create a separate board.
      if (curBoard) {
        setCurBoard(c => c ? {...c, nodes: parsed.nodes, edges: importedEdges} : c);
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => { void flushSave(); }, 30);
        setNotice(`Imported ${parsed.nodes.length} nodes · ${parsed.edges.length} edges into “${curBoard.name}”`);
      } else {
        setNotice(`Imported ${parsed.nodes.length} nodes · ${parsed.edges.length} edges`);
      }
      setTimeout(() => setNotice(''), 2500);
      setTimeout(() => rf?.fitView({padding: 0.25}), 30);
    } catch {
      flash('Import failed: could not parse JSON');
    }
  };

  const sep = () => <span style={{width: 1, height: 18, background: 'var(--border)', flex: 'none'}} />;

  // ---- selected-edge derived values (toolbar + inspector) ----
  const eStroke = selectedEdge ? edgeStroke(selectedEdge) : COLOR_VAR.accent;
  const eStrokeKey = edgeStrokeKey(selectedEdge);
  const eDash = (selectedEdge?.style as any)?.strokeDasharray
    ? (String((selectedEdge!.style as any).strokeDasharray).startsWith('1') ? 'dotted' : 'dashed')
    : 'solid';
  const eWidth = String((selectedEdge?.style as any)?.strokeWidth ?? 1.8);
  const eMarkerEnd = ((selectedEdge?.markerEnd as any)?.type as string) ?? 'none';
  const eMarkerStart = ((selectedEdge?.markerStart as any)?.type as string) ?? 'none';
  const eFlow = (((selectedEdge?.data as any)?.flow ?? 'none') as string);
  const eFlowCount = (((selectedEdge?.data as any)?.flowCount ?? 3) as number);
  const eFlowSpeed = (((selectedEdge?.data as any)?.flowDuration ?? 2.4) as number);
  const eFlowIcon = (((selectedEdge?.data as any)?.flowIcon ?? 'mail') as string);
  const ePathType = (Object.keys(PATH_TYPES) as PathType[]).find(k => PATH_TYPES[k] === selectedEdge?.type && k !== 'custom') ?? 'bezier';
  const eOffset = (((selectedEdge?.data ?? {}) as EdgeData).offset ?? 'center');

  const markerOptions = [
    {v: 'none', label: 'None'},
    {v: MarkerType.ArrowClosed, label: 'Arrow (closed)'},
    {v: MarkerType.Arrow, label: 'Open arrow'},
  ];

  /** L1 — the inspector swatches are COLOUR KEYS, painted with the live
   *  `var(--c-*)` token, so the swatch itself recolours with the theme. Picking
   *  one stores the key (not a hex), which is what makes light mode work. */
  const swatchRow = (current: ColorKey | null, onPick: (k: ColorKey) => void, custom?: string) => (
    <div className="swatches">
      {COLOR_KEYS.map((k, i) => (
        <div
          key={k}
          className={`swatch${current === k ? ' on' : ''}`}
          style={{background: COLOR_VAR[k]}}
          data-color-key={k}
          title={k}
          onClick={() => onPick(k)}
        >
          {!current && !custom && i === 0 ? null : null}
        </div>
      ))}
    </div>
  );

  // ---- M3/S2d: the inspector is DOCKED, exactly like the palette ----
  // C4's selection-driven auto-hide is GONE, along with the `pinned` override it
  // needed: a panel is hidden when — and only when — the user collapsed it by
  // hand. Both sides therefore use the identical one-line rule, so selecting or
  // deselecting a node cannot move either panel, and the inspector no longer
  // vanishes (or half-draws) just because the canvas has no selection.
  const leftHidden = isPanelHidden(panelState, 'left');
  const rightHidden = isPanelHidden(panelState, 'right');

  // ---- M3/S2c: the shortcut reads THIS, not the raw `collapsed` flags -----
  // The keydown effect is registered once; if it closed over `leftHidden` /
  // `rightHidden` directly it would need them in its dep array, so it would tear
  // down and re-register on every collapse. A ref keeps the one listener and
  // still reads the live VISIBLE state: `hiddenRef.current` is what the user can
  // actually see at the instant the key is pressed.
  const hiddenRef = useRef({left: false, right: false});
  hiddenRef.current = {left: leftHidden, right: rightHidden};

  // ---- M3/S4 + M3/S5: the transient overlay ------------------------------
  // A tablet-portrait drawer and a phone bottom sheet are the SAME momentary
  // idea, so they share ONE piece of LOCAL state and ONE scrim. Deliberately
  // NOT part of PanelState: a drawer the user dismissed is not a "collapsed
  // panel", and persisting it under `diagram-studio:panels` would make it
  // reappear on desktop as a durable choice the user never made. The one
  // durable flag per side (`collapsed`) keeps its exact Step 2 meaning.
  const overlayMode: 'drawer' | 'sheet' | null =
    ui.formFactor === 'tablet' && !ui.isLandscape ? 'drawer'
      : ui.formFactor === 'phone' ? 'sheet'
        : null;
  const [overlay, setOverlay] = useState<'left' | 'right' | null>(null);
  // Read by the global keydown handler (registered above), which must not
  // re-register on every drawer open/close — same reason `hiddenRef` exists.
  const overlayRef = useRef<'left' | 'right' | null>(null);
  overlayRef.current = overlay;
  // A rotation or a tier change closes whatever was open: a drawer cannot stay
  // open across a layout that no longer has drawers.
  useEffect(() => { setOverlay(null); }, [overlayMode]);
  // Escape closes the overlay FIRST and stops there, so it does not also fall
  // through to the app's own "deselect" Escape (capture phase + stopPropagation).
  useEffect(() => {
    if (!overlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOverlay(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [overlay]);
  const closeOverlay = () => setOverlay(null);
  const openOverlay = (side: 'left' | 'right') => setOverlay(cur => (cur === side ? null : side));
  const overlayTitle = (side: 'left' | 'right', ov: boolean, mode: 'drawer' | 'sheet') =>
    `${ov ? 'Close' : 'Open'} ${side === 'left' ? 'left panel' : 'inspector'} — ${mode === 'drawer' ? 'drawer' : 'bottom sheet'}`;

  // ---- M3/S5: the phone bottom bar's real height -------------------------
  // Everything that must sit ABOVE the bar (both sheet openers, the toast, the
  // shortcut popover, the selection bar) derives its offset from this ONE
  // number. It has to be measured, not guessed: the bar wraps to two rows at
  // 360px and one at 932px, so any constant is wrong at one of them. Published
  // as `--toolbar-h` on `.app-host` (inline, so it wins over the stylesheet
  // fallback) and re-measured whenever the bar rewraps.
  const [toolbarH, setToolbarH] = useState(0);
  useEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>('.toolbar');
    if (!el) return;
    const read = () => setToolbarH(Math.ceil(el.getBoundingClientRect().height));
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ui.formFactor, ui.isLandscape]);

  /** One toggle per panel edge — a PLAIN toggle on both sides. M3/S2d removed
   *  the selection-derived hide, so there is only one question left ("is it
   *  collapsed?") and only one answer to a click: expand if hidden, collapse if
   *  visible. No "pin open" action and no `.auto` tint, because there is no
   *  derived state left to escape from. This stays the per-side control; the
   *  global shortcut is `setPanelsVisible`.
   *
   *  No tooltip here on purpose: the button is 20x44 on a panel edge that is
   *  already labelled by the panel itself, and the popover only got in the way
   *  of repeated clicking. The accessible name (`aria-label`) carries the same
   *  information for assistive tech.
   */
  /** The panel VISIBLE-state predicate, shared by the shortcut and the render.
   *  A docked panel is visible unless collapsed; in a drawer/sheet tier the
   *  docked column is always laid out, so "visible" there means the OVERLAY is
   *  the one showing it. One predicate keeps a shortcut from focusing a field
   *  that is not on screen. */
  const isPanelVisible = (side: 'left' | 'right') =>
    overlayMode !== null ? overlayRef.current === side : !isPanelHidden(panelState, side);

  const panelToggle = (side: 'left' | 'right') => {
    const hidden = side === 'left' ? leftHidden : rightHidden;
    const label = side === 'left' ? 'left panel' : 'inspector';
    const mod = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';
    const title = hidden ? `Expand ${label} — ${mod}⇧\\` : `Collapse ${label} — ${mod}⇧\\`;
    // M3/S4+S5: in a drawer/sheet layout this same control is the overlay
    // OPENER, not the collapse flag. The chevron keeps pointing the way it
    // always did and the Step 2 collapse flag is left completely alone, so a
    // tablet never rewrites the desktop layout the user configured.
    const isOverlay = overlayMode !== null;
    const ovOpen = overlay === side;
    const shown = isOverlay ? overlayTitle(side, ovOpen, overlayMode ?? 'drawer') : title;
    // left: collapse points left (outward), expand points right (inward).
    // right: mirrored.
    const Icon = side === 'left'
      ? (hidden ? ChevronRight : ChevronLeft)
      : (hidden ? ChevronLeft : ChevronRight);
    return (
      <button
        type="button"
        className={`panel-toggle${hidden && !isOverlay ? ' hidden' : ''}`}
        data-panel-toggle={side}
        data-overlay-toggle={isOverlay ? overlayMode : undefined}
        aria-label={shown}
        aria-expanded={isOverlay ? ovOpen : !hidden}
        onClick={() => {
          if (isOverlay) { openOverlay(side); return; }
          togglePanel(side);
        }}
      >
        <Icon size={14} />
      </button>
    );
  };

  /** =====================================================================
   *  PACKAGE-N pass 2c — ONE palette row, rendered from the data alone.
   *
   *  Deliberately a local function, not a component: it closes over
   *  `addNodeByLabel`, `isStarred` and `toggleFavourite`, so extracting it to a
   *  module would mean threading three callbacks through props for no gain.
   *
   *  `dimmed` is §9's "collapsed category still contributes hits". While
   *  searching, a row whose category is folded renders at reduced opacity
   *  instead of vanishing — the hit is never HIDDEN, only de-emphasised, which
   *  is the difference between "your shape is not here" and "your shape is
   *  here, in a section you folded".
   *
   *  THE ROW IS glyph + label + hint + star. Revision 3 removed the `types[]`
   *  BADGE this used to render; `types[]` is still on the item (the model's
   *  membership field) but nothing paints it, so a single-type element no
   *  longer repeats its own category back at the user.
   *  ===================================================================== */
  const renderPaletteRow = (p: PaletteItem, key: string, dimmed = false) => (
    <div
      key={key}
      className={`pal-item${dimmed ? ' pal-dimmed' : ''}`}
      draggable
      data-label={p.label}
      data-dimmed={dimmed ? 'true' : undefined}
      // pass 2b — the payload is the item's unique LABEL, never an index: the
      // panel no longer renders the same array it resolves against, so a
      // rendered index and a library index are different numbers.
      onDragStart={e => e.dataTransfer.setData('palette', p.label)}
      onDoubleClick={() => addNodeByLabel(p.label)}
      title="Drag onto the canvas or double-click to add"
    >
      <div className="pal-swatch">
        {p.kind === 'label'
          ? <span style={{color: COLOR_VAR[p.colorKey]}}>T</span>
          : p.label === 'Table'
            ? <TableGlyph color={COLOR_VAR[p.colorKey]} />
            : <ShapePreview shape={p.shape} color={COLOR_VAR[p.colorKey]} />}
      </div>
      <div className="pal-meta">
        <span>{p.label}</span>
        <small>{p.hint}</small>
      </div>
      {/* §6.3 — star / pin. `onPointerDown` stops the drag-from-row gesture so a
          star click can never start dragging the shape underneath it. */}
      <button
        type="button"
        className={`pal-star${isStarred(p.label) ? ' on' : ''}`}
        data-star={p.label}
        aria-pressed={isStarred(p.label)}
        aria-label={isStarred(p.label)
          ? `Remove ${p.label} from Favourites`
          : `Add ${p.label} to Favourites`}
        title={isStarred(p.label) ? 'Remove from Favourites' : 'Add to Favourites'}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); toggleFavourite(p); }}
      >{isStarred(p.label) ? '★' : '☆'}</button>
    </div>
  );

  return (
    <div
      className="app-host"
      ref={appRef}
      data-form-factor={ui.formFactor}
      data-touch={ui.isTouchScreen}
      style={{'--toolbar-h': toolbarH ? `${toolbarH}px` : undefined} as React.CSSProperties}
    >
    <div
      className={[
        'app',
        rightHidden ? 'right-hidden' : '',
        leftHidden ? 'left-hidden' : '',
        animate ? '' : NO_ANIM,
      ].filter(Boolean).join(' ')}
      data-form-factor={ui.formFactor}
      data-can-fit-sidebar={ui.canFitSidebar}
      data-touch={ui.isTouchScreen}
      data-orientation={ui.isLandscape ? 'landscape' : 'portrait'}
      data-overlay={overlay ?? ''}
    >
      {/* M3/S4+S5 — the ONE backdrop shared by the tablet drawer and the phone
          bottom sheet. A <button>, not a div: it is a real dismiss target, so
          it must be reachable and it must not swallow the canvas's own
          pointer events while closed (it only exists while the overlay is). */}
      {overlay && (
        <button
          type="button"
          className="scrim"
          data-scrim={overlayMode}
          aria-label={`Close ${overlay === 'left' ? 'left panel' : 'inspector'}`}
          tabIndex={-1}
          onClick={closeOverlay}
        />
      )}
      {panelToggle('left')}
      {panelToggle('right')}
      {/* LEFT — palette */}
      <aside className="panel">
        <div className="panel-head">
          <div className="brand">
            <span className="dot" />Diagram Studio<span className="path">diagrams</span>
          </div>
          <div ref={boardsBtnRef} style={{position: 'relative', marginTop: 10}}>
            <Tooltip label="Boards — open, create, rename, duplicate or delete drawings">
              <button
                type="button"
                ref={boardsMenuBtnRef}
                className={`tbtn-dd boards-btn${boardsOpen ? ' on' : ''}`}
                aria-label="Boards menu"
                aria-expanded={boardsOpen}
                onClick={() => { setBoardsOpen(o => !o); void refreshBoards(); }}
              >
                <LayoutGrid size={13} style={{verticalAlign: -2}} />
                <span className="boards-name">{curBoard ? curBoard.name : 'Boards'}</span>
                <ChevronDown size={12} style={{verticalAlign: -2}} />
              </button>
            </Tooltip>
            {boardsOpen && (
              <div className="pop boards-pop">
                <div className="boards-list">
                  {boardList.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      className={`pop-item boards-item${b.id === curBoard?.id ? ' current' : ''}`}
                      onClick={() => void openBoard(b.id)}
                    >
                      <span className="boards-item-name">
                        {b.name}
                        <span className="boards-item-preset">{getPreset(b.preset).label}</span>
                      </span>
                      <span className="boards-item-meta">
                        {b.nodeCount}n · {b.edgeCount}e · {fmtDate(b.updatedAt)}
                      </span>
                    </button>
                  ))}
                  {!boardList.length && <div className="boards-empty">No boards yet</div>}
                </div>
                <div className="boards-actions">
                  {/* ITEM 6b — every row closes the menu and opens the designed
                      dialog. Focus returns to the BOARDS BUTTON on close, not to
                      the row: choosing a row unmounts the menu, so a row ref is
                      already null by the time the dialog finishes. The trigger
                      that still exists is the one focus goes back to. */}
                  <button type="button" className="pop-item" onClick={() => { setBoardsOpen(false); newBoard(); }}>
                    <Plus size={14} /> New board
                  </button>
                  <button type="button" className="pop-item" disabled={!curBoard} onClick={() => { setBoardsOpen(false); renameBoard(); }}>
                    <Pencil size={14} /> Rename
                  </button>
                  <button type="button" className="pop-item" disabled={!curBoard} onClick={() => { setBoardsOpen(false); void doDuplicateBoard(); }}>
                    <Copy size={14} /> Duplicate
                  </button>
                  <button type="button" className="pop-item" disabled={!curBoard} onClick={() => { setBoardsOpen(false); deleteBoard(); }}>
                    <Trash2 size={14} /> Delete
                  </button>
                  <button type="button" className="pop-item primary" disabled={!curBoard} onClick={() => { setBoardsOpen(false); void flushSave(); }}>
                    <Save size={14} /> Save now
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className={`save-ind${saveState === 'saving' ? ' busy' : ''}${saveState === 'error' ? ' err' : ''}`} aria-live="polite">
            {saveState === 'saving' ? 'saving…' : saveState === 'saved' ? 'saved' : saveState === 'error' ? 'save failed' : ''}
          </div>
        </div>
        <div className="panel-body">
          {/* PACKAGE-N §4.1 (Revision 3) — THREE sections in ONE scroll
              container, in this order: search → favourites → categories.
              The omnibox is now IN this pass; the type-filter row that used to
              sit between favourites and categories is GONE (see the state block
              above for the measurement that removed it). */}

          {/* ---- SEARCH (§4.1 #1, §9) -------------------------------------
              Pinned at the top so it stays the panel's first control, and
              BEFORE Favourites: the field searches the shape LIBRARY, and a
              query is a stronger statement of intent than a favourite tile.
              It searches the WHOLE library, never the current view — a hit for
              a shape is always reachable, whatever is folded. ---- */}
          <div className="lib-search">
            <input
              ref={searchRef}
              type="search"
              className="lib-search-input"
              data-lib-search="true"
              placeholder="Search shapes…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search shapes by name, shape or synonym"
              onKeyDown={e => {
                // Escape clears first and stops there, so it never also falls
                // through to the app's own "deselect" Escape behind it.
                if (e.key === 'Escape' && query) {
                  e.stopPropagation();
                  setQuery('');
                }
              }}
            />
          </div>

          {/* ---- FAVOURITES (§6) ------------------------------------------
              Rendered only when there is something to show: a favourite, or a
              live selection (which makes the pending `+` tile meaningful). An
              empty section would be a permanent, useless header. ---- */}
          {(favourites.length > 0 || selCount > 0) && (
            <div className="fav-sec" data-fav-count={favourites.length} data-sel-count={selCount}>
              <div className="sec-label">Favourites</div>
              <div className="fav-grid">
                {/* §6.4 — the pending `+`: "add from selection", one click, no
                    menus. Only while a selection exists on the canvas. */}
                {selCount > 0 && (
                  <button
                    type="button"
                    className="fav-tile fav-pending"
                    data-fav-pending="true"
                    aria-label={`Save the ${selCount} selected node${selCount === 1 ? '' : 's'} to Favourites`}
                    title={`Add ${selCount} selected node${selCount === 1 ? '' : 's'} to Favourites`}
                    onClick={addFavouriteFromSelection}
                  >
                    <span className="fav-glyph" aria-hidden="true">+</span>
                    <span className="fav-name">Add selection</span>
                  </button>
                )}
                {favourites.map(f => (
                  <button
                    type="button"
                    key={f.id}
                    className="fav-tile"
                    data-fav-id={f.id}
                    data-fav-label={library.favouriteLabel(f) ?? ''}
                    draggable
                    // §6.5 — a drop re-derives the geometry; only the IDENTITY
                    // travels in the payload, never a stored coordinate.
                    onDragStart={e => e.dataTransfer.setData('favourite', f.id)}
                    onDoubleClick={() => insertFavourite(f)}
                    title={`Add “${library.favouriteName(f)}” to the canvas — click, double-click or drag`}
                    onClick={() => insertFavourite(f)}
                  >
                    <span className="fav-glyph" aria-hidden="true">{favouritePreview(f)}</span>
                    <span className="fav-name">{library.favouriteName(f)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ---- CUSTOM SHAPES (§4.1 item 3, §8.1–§8.3) --------------------
              ALWAYS rendered, unlike Favourites above it: this section owns
              the IMPORT control, and that control is the only way a first
              shape can ever exist. An empty section here is not a useless
              header — it is the door.

              The artwork is drawn from `svgDataUri` through an `<img>`, never
              as markup: the data: URI context disables scripts and external
              fetches, which is the second guard behind the sanitiser. ---- */}
          <div className="cust-shapes" data-cust-count={shapes.length}>
            <div className="cust-head">
              <span className="sec-label">Custom shapes</span>
              <button
                type="button"
                className="cust-import"
                data-custom-import-btn="true"
                aria-label="Import an SVG file as a custom shape"
                title="Import an SVG file as a custom shape"
                onClick={openShapeImport}
              >
                Import
              </button>
            </div>
            {/* Visually hidden, but the ONE picker every affordance clicks. */}
            <input
              ref={importInputRef}
              type="file"
              accept=".svg,image/svg+xml"
              className="cust-file"
              data-custom-import-input="true"
              aria-label="Choose an SVG file to import"
              onChange={onImportInputChange}
            />
            <div className="cust-grid">
              {shapes.map(s => (
                <button
                  type="button"
                  key={String(s.created)}
                  className="fav-tile cust-tile"
                  data-custom-shape={String(s.created)}
                  data-custom-title={s.title}
                  draggable
                  // §8.1 — the payload is the sanitised MARKUP, not an id: the
                  // stored entry has no id field, and the canvas resolves this
                  // exact string back to the entry it already holds.
                  onDragStart={e => e.dataTransfer.setData('customshape', s.data)}
                  onDoubleClick={() => insertCustomShape(s)}
                  title={`Add “${s.title}” to the canvas — click, double-click or drag`}
                  onClick={() => insertCustomShape(s)}
                >
                  <span className="fav-glyph" aria-hidden="true">
                    <img src={svgDataUri(s.data)} alt="" className="cust-art" />
                  </span>
                  <span className="fav-name">{s.title}</span>
                  {/* `created` is the stable identity — the store has no id. */}
                  <span
                    className="cust-remove"
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${s.title}`}
                    title={`Remove ${s.title}`}
                    onClick={e => {
                      e.stopPropagation();
                      removeCustomShape(String(s.created));
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        removeCustomShape(String(s.created));
                      }
                    }}
                  >×</span>
                </button>
              ))}
              {/* The drop zone is ALWAYS a tile, and always LAST: it is the
                  whole grid while the library is empty, and the "add the next
                  one" cell once shapes exist. Without it the second import
                  would only be reachable through the button. */}
              <button
                type="button"
                className={`cust-drop${shapes.length ? ' cust-drop-compact' : ''}`}
                data-custom-dropzone="true"
                aria-label="Drop an SVG here, or click to choose a file"
                title="Drop an SVG here, or click to choose a file"
                onClick={openShapeImport}
                {...shapeZoneProps}
              >
                <span className="cust-drop-glyph" aria-hidden="true">+</span>
                <span className="cust-drop-text">Drop an SVG here, or Import</span>
              </button>
            </div>
          </div>

          {/* ---- THE LIBRARY -------------------------------------------------
              TWO states, ONE list of 8 categories (§2, canonical order):

                query EMPTY     the normal accordion. All 8 sections always
                                render with their full counts — nothing filters
                                them any more, so a category can never be absent.
                query NON-EMPTY a flat result list grouped by category. A hit
                                whose category is COLLAPSED renders DIMMED, not
                                hidden (§9): collapsing a section must never
                                hide a search hit, or the user concludes the app
                                does not have the shape at all. Empty categories
                                are dropped here (a "(0)" header is noise);
                                clearing the field restores the accordion with
                                its persisted fold state untouched. ---- */}
          <div className="sec-label">Shapes</div>

          {searching ? (
            <div className="lib-cats" data-searching="true">
              {searchGroups.map(({cat, label, items}) => (
                <div className="lib-cat" key={cat} data-cat={cat} data-search-group={cat}>
                  <div className="lib-search-head">
                    <span className="lib-cat-name">{label}</span>
                    <span className="lib-cat-n" data-group-count={items.length}>{items.length}</span>
                  </div>
                  <div className="palette">
                    {items.map(p => {
                      // Dimmed IFF the user folded this section. The fold is
                      // read from the same persisted map the accordion uses, so
                      // the two states can never disagree.
                      const folded = !isCategoryOpen(presetId, cat);
                      return renderPaletteRow(p, `${cat}-${p.label}`, folded);
                    })}
                  </div>
                </div>
              ))}
              {/* A quiet line, not an error: an unmatched query is a normal
                  state (the library is 34 fixed elements). */}
              {searchGroups.length === 0 && (
                <div className="lib-no-match" data-no-match="true">No shape matches</div>
              )}
            </div>
          ) : (
            <div className="lib-cats">
              {librarySections.map(({cat, label, items}) => {
                const open = isCategoryOpen(presetId, cat);
                return (
                  <div className="lib-cat" key={cat} data-cat={cat}>
                    <button
                      type="button"
                      className="lib-cat-head"
                      aria-expanded={open}
                      data-cat-head={cat}
                      data-open={open ? 'true' : 'false'}
                      data-default-open={cat === defaultOpen ? 'true' : undefined}
                      onClick={() => toggleCategory(presetId, cat)}
                    >
                      <ChevronDown size={13} className={`lib-chev${open ? ' open' : ''}`} />
                      <span className="lib-cat-name">{label}</span>
                      <span className="lib-cat-n" data-cat-count={cat}>{items.length}</span>
                    </button>
                    {open && (
                      <div className="palette">
                        {items.map(p => renderPaletteRow(p, `${cat}-${p.label}`))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* The old sidebar guideline block lived here. Harvey: it ate panel
              space for information that belongs in the help surface ("choáng
              chỗ bỏ qua"). Every row it carried is now in the `?` sheet,
              Settings → Shortcuts AND the README table — verified one-for-one —
              so removing it loses nothing. Do not re-add a permanent hint block
              to the panel; put new guidance in those three surfaces instead. */}
        </div>
      </aside>

      {/* CENTER — canvas */}
      <main className="canvas-wrap" ref={wrap} onDrop={onDrop} onDragOver={e => e.preventDefault()}>
        <div className="toolbar">
          <Tooltip label="Undo — Cmd/Ctrl+Z">
            <button className="tbtn-icon" aria-label="Undo" disabled={!canUndo} onClick={undo}><Undo2 size={15} /></button>
          </Tooltip>
          <Tooltip label="Redo — Cmd/Ctrl+Shift+Z">
            <button className="tbtn-icon" aria-label="Redo" disabled={!canRedo} onClick={redo}><Redo2 size={15} /></button>
          </Tooltip>
          {sep()}
          <Tooltip label="Fit view to diagram — Shift+1">
            <button className="tbtn-icon" aria-label="Fit view" onClick={() => rf?.fitView({padding: 0.25})}><Maximize size={15} /></button>
          </Tooltip>
          {/* Part B — read-only review mode. Sits with the other VIEW toggles
              (fit view / alignment guides / snap), not in the export group: it
              is a way of looking at the board, not an output. */}
          <Tooltip label={readOnly ? 'Read-only review: ON — drag and scroll to pan, nothing can be selected or moved — Shift+2' : 'Read-only review: OFF — Shift+2'}>
            <button
              className={`tbtn-icon${readOnly ? ' on' : ''}`}
              aria-label="Read-only review"
              aria-pressed={readOnly}
              onClick={toggleReadOnly}
            ><Eye size={15} /></button>
          </Tooltip>
          <Tooltip label={alignGuides ? 'Alignment guides: ON — a NEARBY node that lines up gets a dashed guide and the node snaps to it' : 'Alignment guides: OFF — drag freely, no auto-align'}>
            <button
              className={`tbtn-icon${alignGuides ? ' on' : ''}`}
              aria-label="Alignment guides"
              aria-pressed={alignGuides}
              onClick={() => {
                const next = !alignGuides;
                setAlignGuides(next);
                if (!next) setGuides({vertical: null, horizontal: null});
              }}
            ><AlignCenter size={15} /></button>
          </Tooltip>
          <Tooltip label={snap ? `Snap to grid: ON — nodes align to ${gridSize}px` : 'Snap to grid: OFF — free drag'}>
            <button
              className={`tbtn-icon${snap ? ' on' : ''}`}
              aria-label="Snap to grid"
              aria-pressed={snap}
              onClick={() => {
                const next = !snap;
                setSnap(next);
                // when turning snap ON, round existing nodes onto the grid so the
                // whole diagram aligns; turning it OFF returns to free dragging.
                if (next) {
                  pushHistory();
                  setNodes(ns => ns.map(n => ({
                    ...n,
                    position: {
                      x: Math.round(n.position.x / gridSize) * gridSize,
                      y: Math.round(n.position.y / gridSize) * gridSize,
                    },
                  })));
                }
              }}
            ><Magnet size={15} /></button>
          </Tooltip>
          <Tooltip label="Duplicate selection — Cmd/Ctrl+D">
            <button className="tbtn-icon" aria-label="Duplicate selection" onClick={() => duplicateSelection()}><Copy size={15} /></button>
          </Tooltip>
          {sep()}
          <Tooltip label="Auto-arrange the diagram into clean layers (animated, undoable)">
            <button className="tbtn-icon" aria-label="Auto-layout diagram" onClick={autoLayout}><LayoutGrid size={15} /></button>
          </Tooltip>
          {sep()}

          <div style={{position: 'relative'}}>
            <Tooltip label="Export PNG (2×), SVG or JSON · import JSON">
              <button className="tbtn-dd" aria-label="Import and export menu" onClick={() => setPop(o => !o)}>
                Export <ChevronDown size={13} />
              </button>
            </Tooltip>
            {pop && (
              <div className="pop">
                <button className="pop-item" title="Import diagram JSON into the current board" onClick={() => { setPop(false); fileRef.current?.click(); }}>
                  <Upload size={14} /> Import JSON
                </button>
                <button className="pop-item" title="Download this board as JSON" onClick={() => { setPop(false); exportJson(); }}>
                  <FileJson size={14} /> Export JSON
                </button>
                <button className="pop-item primary" title="Export diagram as PNG (2x)" onClick={() => { setPop(false); exportPng(); }}>
                  <Image size={14} /> Export PNG
                </button>
                <button className="pop-item" title="Export diagram as SVG" onClick={() => { setPop(false); exportSvg(); }}>
                  <FileCode size={14} /> Export SVG
                </button>
              </div>
            )}
          </div>

          {sep()}
          <button
            type="button"
            ref={settingsBtnRef}
            className="tbtn-dd settings-btn"
            data-settings-btn
            aria-label="Settings"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            onClick={() => { setPop(false); setSettingsOpen(true); }}
          ><SettingsIcon size={14} /> Settings</button>

          {selCount >= 2 && (
            <>
              {sep()}
              <span className="tbtn-label">align</span>
              <Tooltip label="Align left edges"><button className="tbtn-icon" aria-label="Align left" onClick={() => align('left')}>⇤</button></Tooltip>
              <Tooltip label="Align horizontal centers"><button className="tbtn-icon" aria-label="Align horizontal centers" onClick={() => align('hcenter')}>↔</button></Tooltip>
              <Tooltip label="Align right edges"><button className="tbtn-icon" aria-label="Align right" onClick={() => align('right')}>⇥</button></Tooltip>
              <Tooltip label="Align top edges"><button className="tbtn-icon" aria-label="Align top" onClick={() => align('top')}>⇡</button></Tooltip>
              <Tooltip label="Align vertical middles"><button className="tbtn-icon" aria-label="Align vertical middles" onClick={() => align('vcenter')}>↕</button></Tooltip>
              <Tooltip label="Align bottom edges"><button className="tbtn-icon" aria-label="Align bottom" onClick={() => align('bottom')}>⇣</button></Tooltip>
              {sep()}
              <Tooltip label="Distribute spacing evenly (horizontal)"><button className="tbtn" aria-label="Distribute horizontally" onClick={() => distribute('h')}>⇹ H</button></Tooltip>
              <Tooltip label="Distribute spacing evenly (vertical)"><button className="tbtn" aria-label="Distribute vertically" onClick={() => distribute('v')}>⇹ V</button></Tooltip>
            </>
          )}
        </div>

        {/* floating action bar for a 2+ node selection */}
        {selCount >= 2 && (
          <div className="sel-bar">
            <span className="tbtn-label">{selCount} selected</span>
            {sep()}
            <Tooltip label="Duplicate selection — Cmd/Ctrl+D">
              <button className="tbtn" aria-label="Duplicate selection" onClick={() => duplicateSelection()}><Copy size={13} style={{verticalAlign: -2}} /> Duplicate</button>
            </Tooltip>
            <Tooltip label="Delete selection — Del">
              <button className="tbtn" aria-label="Delete selection" onClick={deleteSelection}><Trash2 size={13} style={{verticalAlign: -2}} /> Delete</button>
            </Tooltip>
            {sep()}
            <Tooltip label="Align horizontal centers"><button className="tbtn" aria-label="Align horizontal centers" onClick={() => align('hcenter')}>Align</button></Tooltip>
            <Tooltip label="Distribute spacing evenly (horizontal)"><button className="tbtn" aria-label="Distribute horizontally" onClick={() => distribute('h')}>Distribute</button></Tooltip>
          </div>
        )}

        {notice && <div className="toast">{notice}</div>}

        {/* H2: getting-started checklist — ticks as the user performs actions.
            ITEM 3: no `onAllDone`. Completing all 6 auto-hides the panel (its own
            `done.size >= TASKS.length` return below); the toast it used to raise
            fired on EVERY load for anyone who had already finished, because the
            once-per-mount guard was a ref that reset with the page. */}
        <Checklist
          doneSignal={doneSignal}
          hasSecondBoard={boardList.length >= 2}
        />

        {/* H1: guided tour overlay */}
        {tourOpen && (
          <Tour
            onDone={tourFinished}
            onSkip={tourFinished}
          />
        )}

        {/* F2: context menu (node / edge / pane right-click) */}
        {ctx && (
          <ContextMenu
            target={ctx}
            onAction={a => ctxAction(a, ctx)}
            onClose={() => setCtx(null)}
          />
        )}

        {/* C5: zoom pill — rendered inside ReactFlow so useStore resolves.
            Positioned absolute relative to the .react-flow container. */}
        {/* D2: keyboard cheat sheet */}
        <Tooltip label="Keyboard shortcuts (?)">
          <button
            type="button"
            ref={helpBtnRef}
            className={`help-btn${help ? ' on' : ''}`}
            aria-label="Keyboard shortcuts"
            onClick={() => setHelp(h => !h)}
          >?</button>
        </Tooltip>
        {help && (
          <div className="help-pop" ref={helpRef}>
            <h4>Shortcuts</h4>
            {/* Item 3a: the tour entry point is the FIRST element in the sheet —
                directly under the title and above the Keyboard group — so it is
                the most discoverable thing in the popover. Its spacing moved
                from its top to its bottom (see `.help-tour-btn` in styles.css). */}
            <button type="button" className="help-tour-btn" onClick={() => { setHelp(false); setTourOpen(true); }}>
              <Waypoints size={13} /> Take a tour
            </button>
            {/* Item 4: this sheet and Settings → Shortcuts must present the
                SAME information — same two groups, same entries, same order,
                same wording. Keys render as `kbd` chips; gestures render as
                plain `.gesture` tokens (never chips), exactly as Settings does. */}
            <div className="help-group">Keyboard</div>
            <div className="help-row"><span>Undo</span><span className="help-keys"><kbd>⌘/Ctrl</kbd><kbd>Z</kbd></span></div>
            <div className="help-row"><span>Redo</span><span className="help-keys"><kbd>⌘/Ctrl</kbd><kbd>⇧</kbd><kbd>Z</kbd></span></div>
            <div className="help-row"><span>Delete selection</span><span className="help-keys"><kbd>Del</kbd></span></div>
            <div className="help-row"><span>Copy / paste / duplicate</span><span className="help-keys"><kbd>⌘/Ctrl</kbd><kbd>C</kbd><kbd>V</kbd><kbd>D</kbd></span></div>
            <div className="help-row"><span>Deselect</span><span className="help-keys"><kbd>Esc</kbd></span></div>
            <div className="help-row"><span>Fit view to diagram</span><span className="help-keys"><kbd>⇧</kbd><kbd>1</kbd></span></div>
            <div className="help-row"><span>Toggle read-only review mode</span><span className="help-keys"><kbd>⇧</kbd><kbd>2</kbd></span></div>
            {/* the same hint Settings → Shortcuts shows on this row, so the two
                surfaces carry the same information (item 4), not just the same
                labels */}
            <div className="help-row"><span>Nudge selection<span className="help-hint">1px per keypress, 10px with ⇧</span></span><span className="help-keys"><kbd>←↑↓→</kbd></span></div>
            <div className="help-row"><span>Collapse / expand panels</span><span className="help-keys"><kbd>⌘/Ctrl</kbd><kbd>⇧</kbd><kbd>{'\\'}</kbd></span></div>
            <div className="help-group">Mouse &amp; trackpad</div>
            <div className="help-row"><span>Insert node</span><span className="gesture"><span className="gesture-token">double-click canvas</span></span></div>
            <div className="help-row"><span>Connect nodes</span><span className="gesture"><span className="gesture-token">drag from a node edge</span></span></div>
            <div className="help-row"><span>Edit a connection</span><span className="gesture"><span className="gesture-token">click the edge</span></span></div>
            <div className="help-row"><span>Select multiple</span><span className="gesture"><span className="gesture-token">⌘/Ctrl + click</span></span></div>
            <div className="help-row"><span>Rename connection</span><span className="gesture"><span className="gesture-token">double-click the label</span></span></div>
          </div>
        )}

        {/* D1: searchable insert palette */}
        {searchPos && (
          <SearchPalette
            items={LIBRARY}
            onInsert={insertFromSearch}
            onClose={() => setSearchPos(null)}
          />
        )}

        {/* ITEM 6b: the designed board dialog — create / rename / delete. Inside
            `.canvas-wrap` beside the search palette and Settings, so its scrim
            covers the canvas column and the two docked panels stay legible. */}
        {boardDlg && (
          <BoardDialog
            mode={boardDlg}
            boardName={curBoard?.name ?? ''}
            onCancel={() => setBoardDlg(null)}
            onSubmit={onBoardDialog}
            returnFocusTo={boardsMenuBtnRef}
          />
        )}

        {/* M2: the Settings dialog — inside .canvas-wrap, so the scrim covers
            the canvas column only (the palette and inspector stay live). */}
        <Settings
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          mode={mode}
          onMode={chooseMode}
          resolved={theme}
          noCycles={noCycles}
          onNoCycles={setNoCycles}
          oneIn={oneIn}
          onOneIn={setOneIn}
          proximity={proximity}
          onProximity={setProximity}
          gridSize={gridSize}
          onGridSize={onGridSize}
          alignGuides={alignGuides}
          onAlignGuides={setAlignGuides}
          animate={animate}
          onAnimate={toggleAnimate}
          highlight={highlight}
          onHighlight={toggleHighlight}
          returnFocusTo={settingsBtnRef}
        />

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{display: 'none'}}
          onChange={onImportFile}
        />

        {/* J: Excalidraw-style canvas navigation — left-drag pans, Shift+drag
            box-selects, plain scroll pans (free, both axes), Ctrl/Cmd+scroll
            (trackpad pinch) zooms, Space+drag pans. */}
        {/* K1: ds-flow-wrap scopes the hover-choreography + perf-guard classes
            to THIS React Flow instance. K3: ds-animating-layout (added/removed
            around programmatic layouts) and ds-no-anim (animation gating). */}
        <ReactFlow
          nodes={rfNodes} edges={rfEdges}
          onNodesChange={handleNodesChange} onEdgesChange={handleEdgesChange}
          onConnect={onConnectRules}
          onConnectStart={(_e, params) => { if (params.nodeId) { pendingDrop.current = {source: params.nodeId!, target: '', sourceHandle: params.handleId, targetHandle: null} as any as Connection; connectOrigin.current = {nodeId: params.nodeId!, handleId: params.handleId}; } }}
          onConnectEnd={onConnectEnd}
          onReconnect={onReconnect}
          // Q: gated exactly like the three element-touching props below, so
          // review mode has ONE source of truth for "nothing on the canvas can
          // be changed". `edgesReconnectable` was the lone omission — the
          // anchors are rendered whenever the prop is truthy and they are NOT
          // read-only aware, so in review mode the user could still rip a wire
          // off a node (and `onReconnect` would then push an undo entry for a
          // change the mode promises is impossible). The grabber is invisible,
          // so this is also the only arm of the gesture that could be started by
          // accident. With the prop false RF renders no `EdgeUpdateAnchors` at
          // all (`isReconnectable && …` in EdgeWrapper), i.e. the whole gesture
          // is absent, not merely inert. That is the ONLY entry point — grep for
          // `reconnect` in src/ returns this line, `onReconnect` above, and its
          // `reconnectEdge` call, so no second path exists. `reconnectRadius` is
          // a top-level `<ReactFlow>` prop and carries no behaviour of its own.
          edgesReconnectable={!readOnly}
          reconnectRadius={RECONNECT_RADIUS}
          // B2: every connection point is usable in BOTH directions. Each node
          // carries a source AND a target handle at each of its 8 points (see
          // NodeHandles in DiagramNode.tsx), and Loose is what lets a drag also
          // run source→source or target→target on one point. Under the default
          // Strict mode a drag must leave a source and land on a target, so a
          // corner could only ever work one way round.
          connectionMode={ConnectionMode.Loose}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={setRf}
          // L1: React Flow's colorMode themes its own ~24 --xy-* vars. It writes
          // nothing to document, so we resolve 'system' ourselves and pass only
          // the concrete mode; `.ds-flow-wrap` re-points the --xy-* vars we use
          // at our own tokens so paper / midnight / contrast follow too.
          colorMode={themeIsDark ? 'dark' : 'light'}
          className={[
            'ds-flow-wrap',
            snap ? 'snap-on' : '',
            animate ? '' : NO_ANIM,
            // K — DEFECT 3: the ONE hook the mode-specific CSS hangs off. It
            // goes on the flow wrapper (the element the canvas actually lives
            // in), NOT on `.app`, so a review-mode rule re-scopes against
            // exactly the subtree it means. Same shape as NO_ANIM above.
            readOnly ? READ_ONLY : '',
          ].filter(Boolean).join(' ')}
          // K — DEFECT 2 / 3: bind React Flow's node-wrapper class to the SAME
          // token the CSS and this file already use. In review mode that token
          // is what RF reads back (`event.target.closest('.nopan')` in its
          // pan-zoom filter) to refuse a pan whose gesture began on a node.
          // Outside review mode `undefined` hands the decision back to RF's own
          // default ('nopan', which RF applies itself to every draggable node),
          // so edit mode is byte-for-byte what it was and node drags are
          // untouched. `panOnDrag` below is deliberately NOT part of this.
          noPanClassName={readOnly ? NO_PAN : undefined}
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
          // ---- Part B: read-only review mode ---------------------------------
          // Every element-touching gesture is switched off through React Flow's
          // OWN props, so nothing is re-implemented. `panOnDrag` (below) is left
          // alone — panning is the whole point of the mode.
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          snapToGrid={snap}
          snapGrid={[gridSize, gridSize]}
          onNodeDragStart={(e, node, nodesAll) => { startInteraction(); onNodeDragStartAll(e, node); void nodesAll; }}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={(e, node, nodesAll) => { endInteraction(); onNodeDragStop(e, node); void nodesAll; }}
          onNodeContextMenu={(e, node) => {
            e.preventDefault();
            if (readOnly) return;
            setCtx({kind: 'node', id: node.id, x: e.clientX, y: e.clientY});
          }}
          onEdgeContextMenu={(e, edge) => {
            e.preventDefault();
            if (readOnly) return;
            setCtx({kind: 'edge', id: edge.id, x: e.clientX, y: e.clientY});
          }}
          onPaneContextMenu={(e) => {
            e.preventDefault();
            // Part B: the pane menu is inert in review mode too. It is not a
            // harmless menu — paste, add-node and auto-layout all mutate the
            // board, so leaving it live would break the "nothing can be
            // touched" promise from the one surface that looks safest. The
            // right-click is swallowed (default prevented) and nothing opens;
            // the browser's own menu is NOT surfaced, because that would be a
            // new, unrelated UI in a mode meant to have none.
            if (readOnly) return;
            setCtx({kind: 'pane', x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY});
          }}
          onMoveStart={() => { setCtx(null); startInteraction(); }}
          onMoveEnd={endInteraction}
          onDoubleClick={(e) => {
            // Part B: review mode takes no canvas gesture at all — the insert
            // palette must not open from a double-click while read-only.
            if (readOnly) return;
            // D1: only open the insert palette on EMPTY canvas —
            // double-clicking a node or edge never triggers it.
            const t = e.target as HTMLElement;
            if (t.closest('.react-flow__node') || t.closest('.react-flow__edge')) return;
            if (!rf || !wrap.current) return;
            const b = wrap.current.getBoundingClientRect();
            setSearchPos(rf.screenToFlowPosition({x: e.clientX - b.left, y: e.clientY - b.top}));
          }}
          onSelectionChange={({nodes: s, edges: se}) => {
            setSel(s[0]?.id ?? null);
            setSelCount(s.length);
            setSelEdgeId(se.length === 1 ? se[0].id : null);
          }}
          fitView proOptions={{hideAttribution: true}}
          minZoom={0.2} maxZoom={2.5}
          // M3/S3.7 — KEEP false. React Flow's own warning: double-click zoom
          // bypasses the gesture filter entirely (no `isWrappedWithClass` guard
          // on `dblclick.zoom`, unlike `wheel`/`pointerdown`), so leaving it on
          // would fire `dblclick.zoom` on the current selection. Double-tap is
          // also our insert palette via the `onDoubleClick` handler below.
          zoomOnDoubleClick={false}
          // M3/S3.2 — KNOWN REACT FLOW TRAP, do not "simplify" this back to a
          // bare button array. `panOnDrag`'s array form constrains the MOUSE
          // only. Pane's own `onPointerDownCapture` (dist/esm/index.js ~1481)
          // early-returns for `event.pointerType === 'touch'` whenever
          // `panOnDrag !== false` and no selection key is held — so a finger
          // can never reach the `selectionOnDrag` branch. DECISION: on a coarse
          // pointer one finger on the empty pane PANS (what a mobile user
          // expects); two fingers pan + pinch-zoom via `zoomOnPinch`. Box-select
          // therefore stays a mouse-only gesture (left-drag) or an explicit
          // Shift-drag on a hybrid device — see the report.
          //
          // READ-ONLY BRANCH — do NOT collapse this ternary back to a literal
          // array. In review mode `selectionOnDrag` is `false` AND the array
          // form here excludes button 0, so a plain LEFT-drag on the pane would
          // match no branch at all and be a DEAD gesture (measured defect: the
          // viewport does not move). Harvey's ask was literally a back-and-forth
          // left-drag that touches no element, so in review mode ANY button
          // pans: `true`. Outside review mode the value is still `[1, 2]`,
          // byte-for-byte unchanged behaviour. `true` is `!== false`, so the
          // touch early-return above still fires and one-finger touch panning
          // is preserved. A left-drag here can never select: selection needs
          // `elementsSelectable` to be true (see `elementsSelectable={!readOnly}`
          // above), so no box-select / node toolbar / resize handle can appear.
          panOnDrag={readOnly ? true : [1, 2]}
          selectionOnDrag={!readOnly}
          selectionKeyCode={['Shift']}
          panOnScroll
          panOnScrollMode={PanOnScrollMode.Free}
          zoomOnScroll={false}
          zoomOnPinch
          zoomActivationKeyCode={['Meta', 'Control']}
          // M3/S3.3 — a raised drag threshold is what keeps a PRESS a press.
          // 6px on coarse pointers (a fingertip rolls 5–10px on a tap); 4px on
          // a fine pointer, because React Flow's 1px default converts an
          // ordinary hand-tremor click into a drag and swallows the click.
          // Connection drags keep 1px — see FINE_CONNECTION_DRAG_THRESHOLD_PX.
          //
          // `nodeClickDistance` MUST travel with `nodeDragThreshold` — it is
          // the SECOND gate on the same press, and a mismatch between the two
          // opens a DEAD BAND in `(clickDistance, dragThreshold]` where the
          // click is suppressed AND the drag never starts (measured: 2/3/4px
          // of travel did nothing at all). The reasoning, the exact d3-drag /
          // @xyflow source lines and the both-directions failure modes are
          // documented on the constants in `src/touch.ts`; the invariant is
          // machine-checked by `checks/node-click-distance.harness.mjs`.
          nodeDragThreshold={ui.isTouchScreen ? COARSE_DRAG_THRESHOLD_PX : FINE_DRAG_THRESHOLD_PX}
          nodeClickDistance={ui.isTouchScreen ? COARSE_NODE_CLICK_DISTANCE_PX : FINE_NODE_CLICK_DISTANCE_PX}
          connectionDragThreshold={ui.isTouchScreen ? COARSE_DRAG_THRESHOLD_PX : FINE_CONNECTION_DRAG_THRESHOLD_PX}
        >
          {/* L3c: hand-authored crow's-foot markers (React Flow has no custom
              marker primitives) — rendered here so `url(#…)` resolves. */}
          {crowKeys.length > 0 && <CrowFootDefs keys={crowKeys} />}
          <Background color="var(--dots)" gap={gridSize} size={1} />
          {/* Empty state — ITEM 2: shown only once the board load has RESOLVED
              and the board really has no nodes. `boardLoaded` is what stops a
              load in flight from claiming "This board is empty" over a canvas
              whose content is merely still on its way. */}
          {boardLoaded && nodes.length === 0 && (
            <Panel
              position="top-center"
              className="canvas-empty"
              style={{marginTop: '12vh'}}
            >
              <div className="ce-title">This board is empty</div>
              <div className="ce-sub">
                Drag a shape from the left panel onto the canvas, or
                <br />
                <b>double-click anywhere</b> to search and insert one.
              </div>
              <div className="ce-hint">
                Then drag from a node's edge handle to connect · press <kbd>?</kbd> for shortcuts
              </div>
            </Panel>
          )}
          {/* F3: helper lines. `HelperLinesView` portals itself into React
              Flow's viewport (`ViewportPortal`), so it must stay a direct child
              of <ReactFlow> — it does its own flow-coord placement there. */}
          {(guides.vertical || guides.horizontal) && <HelperLinesView guides={guides} />}
          {/* F9: proximity connect candidate */}
          {proxEdge && (
            <svg className="prox-edge">
              <line
                x1={proxEdge.fromPos.x} y1={proxEdge.fromPos.y}
                x2={proxEdge.toPos.x} y2={proxEdge.toPos.y}
                stroke="var(--sel)" strokeWidth={1.5} strokeDasharray="5 5" opacity={0.7}
              />
              <circle cx={proxEdge.toPos.x} cy={proxEdge.toPos.y} r={4} fill="var(--sel)" opacity={0.8} />
            </svg>
          )}
          <Controls showInteractive={false} />
          <ZoomPill />
          <MiniMap
            pannable zoomable
            style={{background: 'var(--surface)', border: '1px solid var(--border)'}}
            maskColor="var(--minimap-mask)"
            nodeColor={n => resolveColor(n.data as any)}
          />
        </ReactFlow>
      </main>

      {/* RIGHT — inspector */}
      <aside className="panel right">
        <div className="panel-head">
          <div className="sec-label" style={{margin: 0}}>Inspector</div>
        </div>
        <div className="panel-body">
          {edgeMode ? (
            <>
              <span className="badge">edge</span>
              <div style={{height: 12}} />
              <div className="sec-label" style={{marginTop: 0}}>Label</div>
              <div className="field">
                <label>label</label>
                <input
                  value={(selectedEdge!.label ?? '') as string}
                  placeholder="arrow name"
                  onChange={e => updateEdge({label: e.target.value})}
                />
              </div>
              {preset.edges.labelPresets?.length ? (
                <div className="field">
                  <label>intent label{preset.edges.technField ? ' (label · technology)' : ''}</label>
                  <div className="swatches" style={{gap: 6}}>
                    {preset.edges.labelPresets.map(l => (
                      <button
                        key={l}
                        type="button"
                        className="mbtn"
                        title={`Use “${l}”`}
                        onClick={() => {
                          const [label, techn] = l.split(' · ');
                          updateEdge({label, data: preset.edges.technField ? {techn: techn ?? undefined} : undefined});
                        }}
                      >{l}</button>
                    ))}
                  </div>
                </div>
              ) : null}
              {preset.edges.technField ? (
                <div className="field">
                  <label>technology</label>
                  <input
                    value={(((selectedEdge!.data as any)?.techn ?? '') as string)}
                    placeholder="e.g. HTTPS/JSON, SMTP, Kafka"
                    onChange={e => updateEdge({data: {techn: e.target.value || undefined}})}
                  />
                </div>
              ) : null}
              <div className="field">
                <label>label position</label>
                <select
                  value={eOffset}
                  onChange={e => updateEdge({data: {offset: e.target.value as 'center' | 'start' | 'end'}}, true)}
                >
                  <option value="center">center</option>
                  <option value="start">start</option>
                  <option value="end">end</option>
                </select>
              </div>
              <div className="sec-label">Line</div>
              <div className="field">
                <label>stroke color</label>
                {swatchRow(eStrokeKey, setEdgeColor)}
              </div>
              <div className="field-row">
                <div className="field">
                  <label>stroke width</label>
                  <select
                    value={eWidth}
                    onChange={e => updateEdge({style: {strokeWidth: Number(e.target.value)}})}
                  >
                    <option value="1">1</option>
                    <option value="1.5">1.5</option>
                    <option value="1.8">1.8</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </div>
                <div className="field">
                  <label>line style</label>
                  <select
                    value={eDash}
                    onChange={e => updateEdge({style: {strokeDasharray: dashArray(e.target.value)}})}
                  >
                    <option value="solid">solid</option>
                    <option value="dashed">dashed</option>
                    <option value="dotted">dotted</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>curvature</label>
                <select
                  value={ePathType}
                  onChange={e => {
                    const id = e.target.value as PathType;
                    updateEdge({type: PATH_TYPES[id]});
                    // G: the chosen curvature becomes the default for the NEXT
                    // edges drawn. The preference is persisted, never written
                    // back onto other edges, and the select still shows
                    // `ePathType` — the SELECTED edge — so an older bezier edge
                    // keeps reading `bezier` while the default is `smoothstep`.
                    if (id !== 'custom') rememberEdgePath(id);
                  }}
                >
                  <option value="bezier">bezier</option>
                  <option value="smoothstep">smoothstep</option>
                  <option value="step">step</option>
                  <option value="straight">straight</option>
                </select>
              </div>
              <div className="sec-label">Markers</div>
              <div className="field-row">
                <div className="field">
                  <label>arrow head</label>
                  <select
                    value={eMarkerEnd}
                    onChange={e => updateEdge({markerEnd: markerFor(e.target.value, eStroke)})}
                  >
                    {markerOptions.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>head start</label>
                  <select
                    value={eMarkerStart}
                    onChange={e => updateEdge({markerStart: markerFor(e.target.value, eStroke)})}
                  >
                    {markerOptions.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>flow animation</label>
                <div className="swatches" style={{gap: 6}}>
                  {([
                    ['none', 'None'],
                    ['dots', 'Dots'],
                    ['dash', 'Dash'],
                    ['pulse', 'Pulse'],
                    ['icon', 'Icon'],
                    ['event', 'Envelope'],
                  ] as const).map(([v, lbl]) => (
                    <button
                      key={v}
                      className={`mbtn${(eFlow === v) ? ' on' : ''}`}
                      style={(eFlow === v) ? {borderColor: 'var(--sel)', color: 'var(--sel)'} : undefined}
                      onClick={() => updateEdge({data: {flow: v === 'none' ? undefined : (v as any)}})}
                      title={
                        v === 'dots' ? 'Dots travel along the line (message being sent)'
                        : v === 'dash' ? 'Dashes march along the line'
                        : v === 'pulse' ? 'A bright segment sweeps the line'
                        : v === 'icon' ? 'An icon chip travels the line (letter / package / …)'
                        : v === 'event' ? 'An envelope travels the line — "a message being delivered"'
                        : 'No flow animation'
                      }
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              {(eFlow === 'dots' || eFlow === 'icon' || eFlow === 'event') && (
                <div className="field-row">
                  <div className="field">
                    <label>count</label>
                    <select
                      value={String(eFlowCount)}
                      onChange={e => updateEdge({data: {flowCount: Number(e.target.value)}})}
                    >
                      {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>speed</label>
                    <select
                      value={String(eFlowSpeed)}
                      onChange={e => updateEdge({data: {flowDuration: Number(e.target.value)}})}
                    >
                      <option value="4">slow</option>
                      <option value="2.4">normal</option>
                      <option value="1.4">fast</option>
                      <option value="0.8">very fast</option>
                    </select>
                  </div>
                </div>
              )}
              {eFlow === 'icon' && (
                <div className="field">
                  <label>flow icon</label>
                  <div className="swatches" style={{gap: 6}}>
                    {([
                      ['mail', 'Letter'],
                      ['package', 'Package'],
                      ['file', 'File'],
                      ['zap', 'Zap'],
                      ['settings', 'Gear'],
                      ['database', 'DB'],
                    ] as const).map(([v, lbl]) => (
                      <button
                        key={v}
                        className={`mbtn${eFlowIcon === v ? ' on' : ''}`}
                        style={(eFlowIcon === v) ? {borderColor: 'var(--sel)', color: 'var(--sel)'} : undefined}
                        onClick={() => updateEdge({data: {flowIcon: v as any, flow: 'icon' as any}})}
                        title={`Travelling "${lbl}" icon`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {preset.id === 'erd' ? (
                <>
                  <div className="sec-label">Cardinality (crow's foot)</div>
                  <div className="field-row">
                    <div className="field">
                      <label>source end</label>
                      <select
                        value={(((selectedEdge!.markerStart as any)?.type ?? 'none') as string)}
                        onChange={e => {
                          const v = e.target.value;
                          updateEdge({markerStart: isCrowFoot(v)
                            ? ({type: v, color: eStroke, width: 18, height: 12} as any)
                            : (v === 'none' ? undefined : ({type: v as MarkerType, color: eStroke, width: 14, height: 14} as any))});
                        }}
                      >
                        <option value="none">none</option>
                        <option value="one">one (bar)</option>
                        <option value="zeroOrOne">zero or one (ring + bar)</option>
                        <option value="many">many (crow's foot)</option>
                        <option value="zeroOrMany">zero or many (ring + foot)</option>
                        <option value={MarkerType.ArrowClosed}>arrow</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>target end</label>
                      <select
                        value={(((selectedEdge!.markerEnd as any)?.type ?? 'none') as string)}
                        onChange={e => {
                          const v = e.target.value;
                          updateEdge({markerEnd: isCrowFoot(v)
                            ? ({type: v, color: eStroke, width: 18, height: 12} as any)
                            : (v === 'none' ? undefined : ({type: v as MarkerType, color: eStroke, width: 14, height: 14} as any))});
                        }}
                      >
                        <option value="none">none</option>
                        <option value="one">one (bar)</option>
                        <option value="zeroOrOne">zero or one (ring + bar)</option>
                        <option value="many">many (crow's foot)</option>
                        <option value="zeroOrMany">zero or many (ring + foot)</option>
                        <option value={MarkerType.ArrowClosed}>arrow</option>
                      </select>
                    </div>
                  </div>
                  <div className="hint" style={{paddingTop: 2}}>
                    Derived: <b>{cardinalityLabel((selectedEdge!.markerStart as any)?.type, (selectedEdge!.markerEnd as any)?.type) || '—'}</b>
                  </div>
                </>
              ) : null}
              <div className="field">
                <label>animated (dash on the line)</label>
                <button
                  className={`toggle${selectedEdge!.animated ? ' on' : ''}`}
                  onClick={() => updateEdge({animated: !selectedEdge!.animated})}
                >
                  {selectedEdge!.animated ? 'on' : 'off'}
                </button>
              </div>
              {/* K3: the payload-animation control moved to Settings → Canvas
                  ("Reduce motion"), where the preference belongs; the state and
                  its persisted override stay in useAnimationGating. */}
              <div className="hint">
                Double-click the label on the canvas to rename it (<kbd>Enter</kbd> commit ·
                <kbd>Esc</kbd> cancel). Every change is undoable with <kbd>⌘/Ctrl Z</kbd>.
              </div>
            </>
          ) : selCount >= 2 ? (
            <>
              {/* C2: multi-select summary — never a single node's fields */}
              <div className="multi-head">{selCount} nodes selected</div>
              <div className="multi-actions">
                <button className="mbtn" onClick={() => duplicateSelection()}>duplicate</button>
                <button className="mbtn danger" onClick={deleteSelection}>delete</button>
              </div>
              <div className="hint" style={{paddingTop: 2}}>
                Move with arrow keys — 1px, <kbd>Shift</kbd>+arrow 10px.
              </div>
              <div className="sec-label">Align</div>
              <div className="multi-actions">
                <button className="mbtn" title="Align left" onClick={() => align('left')}>left</button>
                <button className="mbtn" title="Align horizontal centers" onClick={() => align('hcenter')}>center</button>
                <button className="mbtn" title="Align right" onClick={() => align('right')}>right</button>
                <button className="mbtn" title="Align top" onClick={() => align('top')}>top</button>
                <button className="mbtn" title="Align vertical middles" onClick={() => align('vcenter')}>middle</button>
                <button className="mbtn" title="Align bottom" onClick={() => align('bottom')}>bottom</button>
              </div>
              <div className="sec-label">Distribute</div>
              <div className="multi-actions">
                <button className="mbtn" title="Distribute horizontally" onClick={() => distribute('h')}>horizontal</button>
                <button className="mbtn" title="Distribute vertically" onClick={() => distribute('v')}>vertical</button>
              </div>
              <div className="sec-label">Color · Delete</div>
              <div className="field">
                {swatchRow(null, k => {
                  pushHistory();
                  const ids = new Set(nodes.filter(n => n.selected).map(n => n.id));
                  setNodes(ns => ns.map(n => ids.has(n.id)
                    ? {...n, data: {...(n.data as any), colorKey: k, color: undefined}}
                    : n));
                })}
              </div>
              <button
                className="mbtn danger"
                title="Delete selected nodes"
                onClick={deleteSelection}
              >
                delete selected
              </button>
              <div className="hint">Bulk actions apply to all {selCount} selected nodes. Move with arrow keys — 1px, Shift+arrow 10px.</div>
            </>
          ) : selected?.type === 'table' ? (
            <>
              <span className="badge">table</span>
              <div style={{height: 12}} />
              <div className="sec-label" style={{marginTop: 0}}>Table</div>
              <div className="field">
                <label>name</label>
                <input
                  value={(((selected.data as any).name ?? '') as string)}
                  onChange={e => update({name: e.target.value} as any)}
                />
              </div>
              <div className="field">
                <label>schema (optional)</label>
                <input
                  value={(((selected.data as any).schema ?? '') as string)}
                  placeholder="public"
                  onChange={e => update({schema: e.target.value} as any)}
                />
              </div>
              <div className="field">
                <label>color (symbolic key)</label>
                {swatchRow(resolveColorKey(selected.data as any), k => update({colorKey: k, color: undefined} as any))}
              </div>
              <div className="sec-label">Columns</div>
              {((((selected.data as any).columns ?? []) as TableColumn[])).map((c, i) => (
                <div className="tcol-edit" key={c.id}>
                  <input
                    className="tcol-name"
                    value={c.name}
                    aria-label={`column ${i + 1} name`}
                    onChange={e => update({
                      columns: ((selected.data as any).columns as TableColumn[]).map(x =>
                        x.id === c.id ? {...x, name: e.target.value} : x),
                    } as any)}
                  />
                  <input
                    className="tcol-type"
                    value={c.type}
                    aria-label={`column ${i + 1} type`}
                    onChange={e => update({
                      columns: ((selected.data as any).columns as TableColumn[]).map(x =>
                        x.id === c.id ? {...x, type: e.target.value} : x),
                    } as any)}
                  />
                  <div className="tcol-flags">
                    {([['pk', 'PK'], ['fk', 'FK'], ['notNull', 'NN'], ['unique', 'U']] as const).map(([f, lbl]) => (
                      <button
                        key={f}
                        type="button"
                        className={`mbtn${(c as any)[f] ? ' on' : ''}`}
                        style={(c as any)[f] ? {borderColor: 'var(--sel)', color: 'var(--sel)'} : undefined}
                        title={lbl}
                        onClick={() => update({
                          columns: ((selected.data as any).columns as TableColumn[]).map(x =>
                            x.id === c.id ? {...x, [f]: !(x as any)[f]} : x),
                        } as any)}
                      >{lbl}</button>
                    ))}
                    <button
                      type="button"
                      className="mbtn danger"
                      title="Remove this column"
                      onClick={() => update({
                        columns: ((selected.data as any).columns as TableColumn[]).filter(x => x.id !== c.id),
                      } as any)}
                    >×</button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="mbtn"
                onClick={() => update({
                  columns: [...(((selected.data as any).columns ?? []) as TableColumn[]),
                    {id: `c${idc++}`, name: 'new_column', type: 'text'}],
                } as any)}
              >+ add column</button>
              <div className="sec-label">Show mode</div>
              <div className="field">
                <div className="swatches" style={{gap: 6}}>
                  {([['ALL_FIELDS', 'All'], ['KEY_ONLY', 'Keys'], ['TABLE_NAME', 'Names']] as const).map(([v, lbl]) => (
                    <button
                      key={v}
                      className={`mbtn${showMode === v ? ' on' : ''}`}
                      style={showMode === v ? {borderColor: 'var(--sel)', color: 'var(--sel)'} : undefined}
                      onClick={() => setShowMode(v)}
                    >{lbl}</button>
                  ))}
                </div>
              </div>
              <div className="hint">
                FK edges attach column-to-column — drag from a column's left dot to the
                referenced column. Crow's feet show the cardinality.
              </div>
            </>
          ) : !selected ? (
            <div className="empty">
              No selection.<br />Click a node to edit its fields, or click an edge (the arrow)
              to edit its label, stroke and arrow heads.
            </div>
          ) : selected.type === 'label' ? (
            <>
              <span className="badge">label</span>
              <div style={{height: 12}} />
              <div className="field">
                <label>text</label>
                <textarea
                  rows={4}
                  value={(((selected.data as any).text ?? '') as string)}
                  onChange={e => update({text: e.target.value} as any)}
                />
              </div>
              <div className="hint">Free text annotation — no handles, no border.</div>
            </>
          ) : (
            <>
              <span className="badge">{asShape((selected.data as any).shape)}</span>
              {preset.id === 'c4' && isC4Type((selected.data as any).c4Type) && (
                <span className="badge preset" style={{marginLeft: 6}}>
                  {C4[(selected.data as any).c4Type as keyof typeof C4].kicker}
                </span>
              )}
              <div style={{height: 12}} />
              {preset.note && <div className="preset-warn" style={{padding: '0 0 10px'}}>{preset.note}</div>}
              <div className="sec-label" style={{marginTop: 0}}>Content</div>
              {(['kicker', 'title', 'sub'] as const).map(f => (
                <div className="field" key={f}>
                  <label>{f}</label>
                  <input
                    value={((selected.data as any)[f] ?? '') as string}
                    onChange={e => update({[f]: e.target.value} as any)}
                  />
                </div>
              ))}
              <div className="sec-label">Metrics</div>
              <div className="field-row">
                <div className="field">
                  <label>metric</label>
                  <input
                    value={((selected.data as any).metric ?? '') as string}
                    onChange={e => update({metric: e.target.value} as any)}
                  />
                </div>
                <div className="field">
                  <label>unit</label>
                  <input
                    value={((selected.data as any).metricUnit ?? '') as string}
                    onChange={e => update({metricUnit: e.target.value} as any)}
                  />
                </div>
              </div>
              <div className="sec-label">Style</div>
              <div className="field">
                <label>shape</label>
                <select
                  value={asShape((selected.data as any).shape)}
                  onChange={e => update({shape: e.target.value as Shape} as any)}
                >
                  {SHAPES.map(s => <option key={s.id} value={s.id}>{s.label} — {s.hint}</option>)}
                </select>
              </div>
              <div className="field">
                <label>body</label>
                <select
                  value={(((selected.data as any).body ?? 'card') as string)}
                  onChange={e => update({body: e.target.value as 'card' | 'label-only'} as any)}
                >
                  <option value="card">card</option>
                  <option value="label-only">label only</option>
                </select>
              </div>
              <div className="field">
                <label>icon</label>
                <IconPicker
                  value={((selected.data as any).icon ?? '') as string}
                  onPick={name => update({icon: name ?? ''} as any)}
                />
              </div>
              <div className="field">
                <label>color</label>
                {swatchRow(resolveColorKey(selected.data as any), k => update({colorKey: k, color: undefined} as any))}
              </div>
              <div className="hint">
                Color drives the shape outline, icon, metric and glow.
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
    </div>
  );
}
