import {cloneElement, useCallback, useEffect, useMemo, useState, useRef, type ReactElement} from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState,
  MarkerType, useStore, reconnectEdge, PanOnScrollMode, ConnectionMode,
  type Connection, type Node, type Edge, type NodeChange, type EdgeChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import {
  Copy, ChevronDown, ChevronLeft, ChevronRight,
  LayoutGrid, Save,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalSpaceAround, AlignVerticalSpaceAround,
  BringToFront, SendToBack,
  X,
} from 'lucide-react';
import {fitPaddingFor} from '../canvas/checklistFit';
import '@xyflow/react/dist/style.css';
import {
  // ROUND T — the bend rules (`SIDE_OUT`, `OPPOSITE_SIDE`, `STEP_GAP_PX`, // `isSide4`) and the drag's own maths live in `edgeBend.ts`: the geometry a
  // handler needs, the axis rule the POINTER decides (`dragAxis`) and the // kind-aware wrapper (`bendAxisFor`), the writer (`applyDrag`) and the base
  // point (`drawnMid`). The renderer's route is our own path on a stored // waypoint and the generator otherwise (`needsCustom`).
  // ROUND U — `bendAxisFor`/`dragPoint` are the ONE decision point shared with // `GoblinEdge`: on `bezier`/`straight` the axis is `'free'`, both coordinates
  // are written, and no axis is projected.
  type Pt,
} from '../canvas/edgeBend';
/* ROUND AK, PASS 2 — the label's own rules. `reverseEdgePatch` is AK-15's
   mirror; `labelBgOf` is AK-12's tolerant reader (an unknown value resolves to
   the shipped `surface`, never to an unstyled plate); `LabelWrite` is the shape
   AK-10's drag writer carries. (`labelWrite` itself is applied by `GoblinEdge`,
   the only side holding the resolved path, the anchor and the measured label
   box — see `useEdgeGesture`'s sibling note.) */
import {LABEL_BG_VALUES, labelBgOf, reverseEdgePatch} from '../canvas/edgeLabel';
/* APP-SPLIT t_b2cad7a8 (S5): idFactory (idc counter + HMR-safe nextId) +
   paletteInsert (insert policy) moved verbatim — disjoint read sets, two modules. */
import {bumpIdc, idc, makeNextId, setIdc} from '../canvas/idFactory';
import {makeAddNodeByLabel, insertFromSearchImpl} from '../canvas/paletteInsert';
import {ZoomPill, sep} from '../panels/ZoomPill';
// APP-SPLIT t_502be2a0 (S2): the pure option tables now live in src/canvas/inspectorOptions.tsx, moved verbatim.
import {CROW_FOOT, FLOW_ICON_OPTS, FLOW_OPTS, FONT_OPTS, MARKER_ICON_OPTS_START, MARKER_OPTS, SECTION_TITLES, SIZE_OPTS, VALIGN_OPTS, WEIGHT_OPTS, WIDTH_OPTS} from '../canvas/inspectorOptions';
import {buildEdgeLabelTextBody, buildTsBody} from '../canvas/inspectorSections';

import DiagramNode, {type NodeKind} from '../nodes/DiagramNode';
import LabelNode, {type LabelKind} from '../nodes/LabelNode';
import {newResizeGuard, recordResizeGesture, tableGripChanges} from '../board/resizeHistory';
import {readImportedFile} from '../board/importLimits';
import {useRotation, norm180} from '../hooks/useRotation';
import {GroupRotateGrip} from '../components/GroupRotateGrip';
import {GroupGapDrag} from '../components/GroupGapDrag';
import {NodeChrome} from '../components/NodeChrome';
import {DescDotLayer} from '../components/DescDot';
import {SelectionBox} from '../components/SelectionBox';
/* GOBI-S1 — the share view: hook (route + decode + edit-copy) and chrome.
 * BoardsPopover is the GOBI-S1 extraction that PAID for this round's App
 * lines (the hard cap may never grow). */
import {useShareView, shareViewPayload} from '../hooks/useShareView';
import {ShareBanner} from '../components/ShareBanner';
import BoardsPopover from '../components/BoardsPopover';
import TableNode, {type ShowMode} from '../nodes/TableNode';
import {edgeTypes} from '../edges';
import type {EdgeData} from '../edges';
import IconPicker from '../ui/IconPicker';
import SearchPalette from '../ui/SearchPalette';
import Tooltip from '../ui/Tooltip';
import {COLOR_KEYS, COLOR_VAR, isColorKey, type ColorKey, resolveColor, resolveColorKey} from '../theme/colors';
import {SHAPES, asShape, type Shape} from '../nodes/shapes';
/* ROUND BJ (bundle split) — the EXPORT PIPELINE is now a lazy chunk. The
 * editing surface (canvas render) never needs the emitter at first paint: * exportSvg/exportScene/textOutline/textOutlineHb/exportPng/fontFiles/
 * printView are only reachable from user actions (Export modal build, * Copy PNG, print PDF). So App keeps only the TYPES statically (import
 * type — erased at build time) and pulls the values through ONE dynamic * import seam at the point of use. First export pays one chunk fetch
 * (~150-200 KB raw, ~40 KB gz) that used to sit in the boot bundle. * The whole cluster is closed over App.tsx (no other app module imports
 * these by value), so the seam here is the only door. */
/* ROUND BJ — same lazy seam as exportSvg above: the shaper stack and the
 * print route only run inside export handlers. One memoised promise per * module, so the first export pays the chunk once and every later export
 * reuses it. Types stay static (erased). */

import {
  getInspectorSections, hasBody, hasIcon, hasKicker, hasMetric, hasSub, type InspectorTarget, type SectionId,
} from '../canvas/inspector';
import {
  IconPickerRow, ShapesPicker, Stepper, ToggleRow, Section, RotationRow,
  /* ROUND AM, AM-4/AM-5 — the flow speed's slider and its live rail, plus the
     two pure helpers the harness executes rather than restates. */
  FlowSpeed,
  ArtArrow, ArtCardinality, ArtCurve, ArtDash, ArtFlow, ArtWidth,
  type PickerOption,
} from '../ui/InspectorPickers';
/* PACKAGE-P §E — the Text section's data half. ONE import covers both targets:
   the model is target-agnostic, and the two `*ForBody` helpers supply the only
   things that differ between them: a label-only node is centred by design on
   BOTH axes (a card is left and starts at its padding-top). ROUND Z FIX 2 added
   the vertical one — the defect it fixes was a single global `middle` that no
   card ever painted. */
import {
  TEXT_SIZE_OPTS, TEXT_WEIGHT_OPTS, TEXT_ALIGN_OPTS, TEXT_FONT_OPTS, TEXT_FONT_FAMILY,
  TEXT_VALIGN_OPTS,
  alignForBody, vAlignForBody, mergeTextStyle, readTextStyle,
  type TextStyle, type TextSize, type TextWeight, type TextAlign, type TextFont,
  type TextVAlign,
} from '../layout/textStyle';
import {
  getPreset, edgeColorPatch, C4, isC4Type, LIBRARY, DEFAULT_PRESET_ID,
  type PresetId, type DiagramPreset,
} from '../presets';
import {type PaletteItem} from '../theme/palette';
/* ROUND AD, ITEM 5(a) — the colour key's label and its persisted dismissal
   (Option B's condition: the key must be labelled where the user looks, and the
   label must be dismissible so it does not become permanent furniture). */
import {KEY_NOTE_TEXT, loadKeyNote, saveKeyNote} from '../theme/colorKeyNote';
import {applyTheme, loadMode, hasStoredMode, resolveMode, isDarkTheme, saveMode, DARK_MQ, type Mode, type ThemeName} from '../theme/theme';
import * as boards from '../board/boards';
import type {BoardDoc, BoardMeta} from '../board/boards';
import ContextMenu, {type CtxTarget, type CtxAction} from '../ui/ContextMenu';
import {useGroupLock, lockedIdSet, visibleSelected} from '../hooks/useGroupLock';
import {useGapDragGesture} from '../hooks/useGapDrag';
import {useLogicalGroup} from '../hooks/useLogicalGroup';
import {useCanvasPrefs} from '../hooks/useCanvasPrefs';
import {useClipboard} from '../hooks/useClipboard';
import {useLibraryPanel} from '../hooks/useLibraryPanel';
import {HelpSheet} from '../components/HelpSheet';
import {RotateInternalsBridge} from '../components/RotateInternalsBridge';
import {DescPanels} from '../components/DescPanels';
import {ModalMounts} from '../components/ModalMounts';
import {CanvasEmptyPanel} from '../components/CanvasEmptyPanel';
import BoardPanel from '../components/BoardPanel'; import {useTableWidth} from '../hooks/useTableWidth'; import {useRailReveal} from '../hooks/useRailReveal'; import {DefinitionSection, descData, descPaintData, type DescPaint} from '../components/DefinitionSection';
import {swatchRow} from '../components/swatchRow';
import {resolveTableStyle, resolveDensity} from '../../packages/gobi/src/model/tableStyle'; import {tableNaturalWidth} from '../../packages/gobi/src/model/tableWidth'; import {readNewBoardStyle, readNewBoardDensity} from '../hooks/useNewBoardDefaults';
import {Toolbar} from '../components/Toolbar';
import {CodePane, StaleBanner} from '../components/CodePane';
import {useCodeCommit} from '../hooks/useCodeCommit';
import {useSelectionBridge} from '../hooks/useSelectionBridge';
import Checklist, {type ChecklistTaskId, isChecklistComplete, readChecklistDone, readChecklistDismissed} from '../nodes/Checklist';
/* ONBOARD-P5 — the one-line tips: the four gates live in the pure module, the
 * render in src/components/TipToast.tsx. */
import {takeTip, markTipSeen, type TipId} from '../ui/tips';
import TipToast from '../components/TipToast';
/* ROUND BI, ITEM 3 — the feedback dialog mounts ONCE, at this level: the ?
   help sheet and Settings → About are two entry points into the same form
   (one open-state, one focus-restore target per opener). */
import {type HelperGuides} from '../canvas/helperLines';
import HelperLinesView from '../canvas/HelperLinesView';
/* ROUND AM, AM-3 — the flow glyphs' ONE home. Imported HERE and in
   `GoblinEdge.tsx` (AL-6: the chip row and the travelling chip read the same
   map). No React Flow, so the panel reads it without pulling the canvas in. */
import {FLOW_ICON_PATHS} from '../nodes/flowIcons';
import {CrowFootDefs, cardinalityLabel, isCrowFoot} from '../nodes/Crowfoot';
import {
  useHoverChoreography, useInteractionGuard, useLayoutTransition, useAnimationGating,
  useHoverHighlight, NO_ANIM, READ_ONLY, NO_PAN,
} from '../canvas/choreography';
import {useEditorInterface} from '../hooks/useEditorInterface';
import {
  useLongPress,
  COARSE_DRAG_THRESHOLD_PX,
  FINE_DRAG_THRESHOLD_PX,
  FINE_CONNECTION_DRAG_THRESHOLD_PX,
  FINE_NODE_CLICK_DISTANCE_PX,
  COARSE_NODE_CLICK_DISTANCE_PX,
} from '../canvas/touch';
import {usePanelCollapse} from '../canvas/panelCollapse';
import {useReviewReveal, panelHiddenFor} from '../canvas/reviewChrome';
import {useRailPanel} from '../canvas/railPanel';
/* ROUND AA, ITEM 2 — the marquee mode: its persisted value, its React Flow
   enum, and the hook that owns both. */
import {useMarqueeMode} from '../canvas/marqueeMode';
import {useZOrderMode} from '../board/zOrderMode';
import {useLayoutDir} from '../layout/layoutMode';
import {useInspectorSections} from '../canvas/inspectorState';
import {useInspectorSectionRegistry} from '../hooks/useInspectorSections';
import ShapeInspector from '../panels/ShapeInspector';
import TableInspector from '../panels/TableInspector';
import LibraryBody from '../panels/LibraryBody';
import {searchLibrary, groupByCategory} from '../theme/paletteSearch';
import {
  useCategoryCollapse, CATEGORY_ORDER, CATEGORY_LABEL, defaultOpenCategory,
} from '../board/categoryState';
/** PACKAGE-N pass 3 — the USER library client (§6 favourites / §7 store). NOT
 *  the shape `LIBRARY` above: that one is the 34-element constant, this one is
 *  the user's own starred document on disk. */
import * as library from '../board/library';
/** PACKAGE-N pass 4b — the custom-shape NODE KIND (§8.1–§8.3). The shape
 *  pipeline lives in `./customShape`; this is only the canvas node + the
 *  library plumbing. `Shape` stays at 19 — `customshape` is a node type. */
import CustomShapeNode from '../nodes/CustomShapeNode';
/* ROUND BN, ITEM 2 — the module-level helpers now live in focused modules;
   moved verbatim, imports only. Size budgets: checks/file-size-gate.mjs. */
import {
  PATH_TYPES, isGoblinEdge, RECONNECT_RADIUS,
  type PathType,
} from '../board/boardConstants';
import {migrateEdge, migrateDoc} from '../board/boardMigrations';
import {useUndoHistory, type Snap} from '../hooks/useUndoHistory';
import {usePersistence} from '../hooks/usePersistence';
import {useConnections} from '../hooks/useConnections';
import {useExportActions} from '../hooks/useExportActions';
import {useKeyboardShortcuts} from '../hooks/useKeyboardShortcuts';
import {useEdgeWriters} from '../hooks/useEdgeWriters';
import {useCanvasTools} from '../hooks/useCanvasTools';
import {useBoardsMenu} from '../hooks/useBoardsMenu';
import {useChecklist} from '../hooks/useChecklist';
import {
  edgeMarkerUrl, edgeStrokeKeyOf, hasCrow, isEditable, nodeW, nodeH,
  dashArray, markerFor,
  edgeStroke, edgeStrokeKey, bootTheme,
  absPos,
} from '../board/boardUtils';

const nodeTypes = {goblin: DiagramNode, label: LabelNode, table: TableNode, customshape: CustomShapeNode};

export default function App() {
  /* ITEM 2 — the canvas holds NOTHING while a board load is in flight: seeding
     it painted the sample nodes then replaced them mid-flight (the flash). The
     seed's only consumer is the genuine first run; until the load resolves the
     canvas is empty and `.canvas-empty` (gated on nodes.length === 0) shows.
     `boardLoaded` keeps that panel quiet DURING the load. */
  const [boardLoaded, setBoardLoaded] = useState(false);
  /* AS-5 — the save gate's LOADED-ID half: the id the loader actually applied
     (set by applyBoard ONLY, cleared on no-board). A save runs only when this
     EQUALS the in-memory doc's id, so a flush landing while the NEXT board is
     still loading can never write another board's file. */
  const [boardLoadedDocId, setBoardLoadedDocId] = useState<string | null>(null);
  const [nodes, setNodesRaw, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdgesRaw, onEdgesChange] = useEdgesState<Edge>([]);
  /* UNISURF-S9 — ONE lock seam: every board write passes these two wrappers, so
     no writer can forget the lock; `allowRef` is the ONE bypass. */
  const lockRef = useRef(false);
  const allowRef = useRef(false);
  const writeBlocked = useCallback(() => lockRef.current && !allowRef.current, []);
  const setNodes = useCallback((u: Node[] | ((ns: Node[]) => Node[])) => { if (!writeBlocked()) setNodesRaw(u); }, [setNodesRaw]);
  const setEdges = useCallback((u: Edge[] | ((es: Edge[]) => Edge[])) => { if (!writeBlocked()) setEdgesRaw(u); }, [setEdgesRaw]);
  const [sel, setSel] = useState<string | null>(null);
  const [selCount, setSelCount] = useState(0);
  const [selEdgeId, setSelEdgeId] = useState<string | null>(null);
  const [rf, setRf] = useState<ReactFlowInstance | null>(null); const [revealTick, setRevealTick] = useState(0); /* RAIL-COVER-2: the rail reveal's gesture counter */
  const wrap = useRef<HTMLDivElement>(null);

  // ---- M3/S1: interface class + M3/S2: docked-panel collapse ---- // `appRef` is the EMBED HOST, not the window: the hook measures this element
  // with a ResizeObserver so a narrow host (side pane, iframe, split column) // gets the compact layout even on a wide screen. Its results are published on
  // `.app` as data attributes for the later touch / tablet / phone steps.
  const appRef = useRef<HTMLDivElement>(null);
  const ui = useEditorInterface(appRef);
  // M3/S2c: `setPanelsVisible` is the shortcut's ONE atomic write; `togglePanel` // is the per-side chevron's. M3/S2d dropped `setPanelPinned` with the auto-hide
  // it served, and the reviewer's flag removed the two never-consumed methods // (`setPanelCollapsed`, `resetPanels`) — one flag per side is the whole state.
  const {state: panelState, togglePanel, setPanelsVisible} = usePanelCollapse();

  /* ---- PACKAGE-P PASS 3 §C: ONE fold state for the whole panel ----------
     Loaded once from `diagram-studio:inspector-sections`, saved on every change.
     The state is keyed by SECTION ID and is global to the panel — not per node:
     a fold is a statement about how the user reads the panel, and re-folding
     Cardinality on every edge click would make the persisted value meaningless.
     Selection changes therefore do NOT reset it; only a toggle does. */
  const {toggleSection, isCollapsed} = useInspectorSections();
  /** The goblin `body` switch (§C) — a SECOND-LEVEL disclosure inside the Style
   *  section, which §A.3 keeps OPEN. Session-scoped on purpose: §C names exactly *  ONE new persisted key, and this one control is a click away in a section
   *  the user already has open. */
  const [bodyModeOpen, setBodyModeOpen] = useState(false);

  /* ROUND AD, ITEM 5(a) — OPTION B'S CONDITION, IN STATE. `keyNoteShown` starts
     from the persisted value (absent → SHOW), and dismissing writes it through
     the ONE convention every other panel preference uses. Global to the panel,
     not per node — the note is a statement about the colour control, so it does
     not reappear on every selection change. */
  const [keyNoteShown, setKeyNoteShown] = useState(loadKeyNote);
  const dismissKeyNote = useCallback(() => {
    setKeyNoteShown(false);
    saveKeyNote(false);
  }, []);

  const nodesRef = useRef<Node[]>(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef<Edge[]>(edges);
  edgesRef.current = edges;

  const nextId = useMemo(() => makeNextId(nodesRef, edgesRef), [nodesRef, edgesRef]);

  // ---- Part B: read-only review mode ------------------------------------- // A view-only canvas: pan and zoom freely, touch nothing. Kept LOCAL to
  // App.tsx on purpose — it is one boolean, toggled from one toolbar button and // read by this same component's <ReactFlow> props and its one keydown
  // handler, so a hook in choreography.ts would add an indirection layer with a // single call site and no shared logic. Persistence follows the established
  // convention here (`diagram-studio:edge-path`, `diagram-studio:read-only`): // one namespaced key, read once in a lazy `useState` initialiser that never
  // throws when storage is unavailable, defaulting to OFF. //
  // K — HOISTED above the hover choreography deliberately: the gate there reads // this flag (`highlight && !readOnly`), so the declaration must precede that
  // call site. Every other reader sits further down and is blind to the // position.
  const READ_ONLY_KEY = 'diagram-studio:read-only';
  const [readOnly, setReadOnly] = useState(() => {
    try { return localStorage.getItem(READ_ONLY_KEY) === '1'; } catch { return false; }
  });
  // VIEW-MODE CHROME — transient review reveal (reviewChrome.ts), never persisted.
  const {reveal: reviewReveal, toggleSide: revealPanel, setBothVisible: revealPanels} = useReviewReveal(readOnly);
  /* RAIL-CONTEXT — no rail by default; `auto` opens only while a table is selected. */
  const [codeMode, setCodeMode] = useState<'auto' | 'open' | 'closed'>(() => {
    try { return localStorage.getItem('diagram-studio:code-rail') === '1' ? 'open' : 'auto'; } catch { return 'auto'; }
  });
  /* AUDIT-16 — the ref mirrors `readOnly` so a handler that STARTED before the
     toggle (an in-flight connection drag) can still see the mode change when
     its drop lands; the state alone is a stale closure in that window. */
  const readOnlyRef = useRef(false);
  readOnlyRef.current = readOnly; // kept in sync every render (cheap, always right)

  // ---- PACKAGE-K: hover choreography, interaction perf guard, layout //      transition, animation gating. All four work on React Flow's own DOM
  //      (classList on .react-flow__node[data-id] / .react-flow__edge[data-id]) //      and on the wrapper class, so none of them costs a React render.
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
  /* ROUND AA, ITEM 2 — THE MARQUEE SELECTION MODE. Hoisted beside the other
     persisted canvas prefs (`useAnimationGating`, `useHoverHighlight`), and it
     RETURNS the React Flow `selectionMode` enum as well as the stored value, so
     the live `<ReactFlow>` prop below follows the setting with no reload and
     there is no second place that could map the value differently. Default is
     `touch` (overlap); see `src/marqueeMode.ts`. */
  const {mode: marqueeMode, selectionMode, setMode: setMarqueeMode} = useMarqueeMode();
  /* CONFIG ROUND (2026-10-23) — the z-order display mode: 'wysiwyg' (manual,
     paint = stored z, the default) vs 'lift' (the library's select-raises
     behaviour). See src/zOrderMode.ts. */
  const {mode: zOrderMode, zIndexMode, setMode: setZOrderMode} = useZOrderMode();
  /* ROUND LAYOUT — THE AUTO-LAYOUT DIRECTION. Persisted Canvas preference
     (prefs.ts path, same family as grid-size): overrides the preset's own
     layout default so a flowchart board can also arrange left-right. The
     toolbar's auto-layout consumes it through useCanvasTools; Settings →
     Canvas owns the radio row. See `src/layoutMode.ts`. */
  const {layoutDir, setLayoutDir} = useLayoutDir();
  /* HL-GATE (owner override 2026-11-20) — ONE option, BOTH lights: hover and
     selection painting are gated together inside the choreography; read-only
     is the exception (`highlight || readOnly` below — a viewer still lights
     the neighbourhood). Selection STATE is never gated, only the paint. */
  const {onEdgeMouseEnter, onEdgeMouseLeave, onNodeMouseEnter, onNodeMouseLeave, applySelection} =
    useHoverChoreography(wrap, edgesRef, nodesRef, highlight || readOnly);
  const {startInteraction, endInteraction} = useInteractionGuard(wrap);
  const {animateLayout} = useLayoutTransition(wrap);

  // ---- snap to grid ----
  const [snap, setSnap] = useState(false);
  /* HEADROOM (t_a21adb78) — the persisted canvas/export/connection prefs moved
     VERBATIM into hooks/useCanvasPrefs.ts (same states, clamps, one-writer
     callbacks, keys). App keeps the call site only; the hard cap is why.
     Tuple order (documented in the hook): grid, onGrid, pngScale, onPngScale,
     pngPad, onPngPad, autosave, onAutosave, dblConnect, onDblConnect,
     dblRange, onDblRange, alignGuides, setAlignGuides, defaultPath,
     rememberEdgePath. */
  const [
    gridSize, onGridSize,
    pngScale, onPngScale, pngPad, onPngPad,
    autosave, onAutosave,
    dblConnect, onDblConnect, dblRange, onDblRange,
    alignGuides, setAlignGuides,
    defaultPath, rememberEdgePath,
  ] = useCanvasPrefs();
  const [expOpen, setExpOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  /* F9 — the import refusal message: lives in the modal's From-file note (not the toast); cleared on modal close. */
  const [importFileMsg, setImportFileMsg] = useState<string | null>(null);
  useEffect(() => { if (!expOpen) setImportFileMsg(null); }, [expOpen]);
  /* MODAL-DOORS: ONE writer sets BOTH booleans — two doors can never be open at once. */
  const openDoor = (d: 'export' | 'share') => { setExpOpen(d === 'export'); setShareOpen(d === 'share'); };
  // ---- D1: searchable insert palette (position = double-click point) ----
  const [searchPos, setSearchPos] = useState<{x: number; y: number} | null>(null);
  // ---- D2: cheat sheet popover ----
  const [help, setHelp] = useState(false);
  // ---- F2: context menu ----
  const [ctx, setCtx] = useState<CtxTarget | null>(null);
  /* INLINE-TITLE (t_cb9335df) — the F2 token: which node's title editor to
     open. Render-injected into rfNodes (the __rotate pattern), never written
     into nodes state, so it never reaches a saved board. */
  const [titleEdit, setTitleEdit] = useState<{id: string; at: number} | null>(null);
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
  const helperDrag = useRef(false);
  // ---- F7: connection rules ----
  const [noCycles, setNoCycles] = useState(false);
  const [oneIn, setOneIn] = useState(false);
  // ---- F6: pending drop-on-canvas connection ----
  const pendingDrop = useRef<Connection | null>(null);
  // ---- G: the handle the current connection drag STARTED from.
  // Deliberately a SECOND ref rather than a field on `pendingDrop`: onConnectEnd
  // reads `pendingDrop.current` to decide whether to insert a node on drop, and
  // onConnect consumes the origin first, so clearing the shared ref there would
  // silently kill the drop-to-create path. Written by onConnectStart, consumed
  // (and cleared) by onConnect.
  const connectOrigin = useRef<{nodeId: string; handleId: string | null | undefined} | null>(null);
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

  // ---- H1/H2: onboarding — capability list in the ? sheet + getting-started checklist ----
  /* ONBOARD-P2/3 (2026-10-31) — the step-by-step overlay is GONE and its code went
     with it. Evidence: docs/PHASE-0-WALKTHROUGH.md §4 (D1-D4) — the scrim swallowed
     every click including the four interactions it named, its one worthwhile step
     depended on an edge the first-run board does not have, and it could never be
     seen twice or measured. The four capabilities it was the ONLY surface for now
     live as plain rows in the ? sheet (HelpSheet.tsx): animated flow, cardinality,
     tables as nodes, autosave. */
  /* ROUND BI, ITEM 3 — ONE feedback dialog for the whole app: the ? help sheet
     and Settings → About both open THIS one. `feedbackReturn` is the element
     that opened it, so Esc/Cancel hands the caret back to that exact control
     (? button or the About entry) instead of the toolbar. */
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const feedbackReturn = useRef<HTMLElement | null>(null);
  const openFeedback = useCallback((from: HTMLElement | null) => {
    feedbackReturn.current = from;
    setFeedbackOpen(true);
  }, []);
  /** ONBOARD-P4 — the checklist's facts and their one write path live in
   *  `useChecklist`: the `?` sheet reads/clears the same fact the panel paints. */
  const [checklistDone, tickTask, checklistDismissed, dismissChecklist, restoreChecklist] = useChecklist();

  // ---- multi-document boards (disk-backed via dev-server API) ----
  const [curBoard, setCurBoard] = useState<BoardDoc | null>(null);
  /* BOARD-STYLE — PER-BOARD style + density; absent = the Settings → New boards default. */
  const tableStyle = resolveTableStyle(curBoard?.style ?? readNewBoardStyle());
  const tableDensity = resolveDensity(curBoard?.density ?? readNewBoardDensity());
  /* LAYOUT-FOLLOWS-WIDTH — table widths follow the CORE (style/density + content); no moves. */
  useTableWidth(nodes, setNodes, tableStyle, tableDensity);
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
  /* MODAL-DOORS: the two dialog triggers (focus returns to the opener). */
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const shareBtnRef = useRef<HTMLButtonElement>(null);

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
    try { mq = window.matchMedia(DARK_MQ); } catch { return; }
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

  const applyBoard = useCallback((doc0: BoardDoc) => {
    // Load nodes/edges, reset history/selection, fit view. Two effect runs fire
    // (nodes then edges) — K3 skips both; L1 migrates hex; L2 adopts the preset.
    const doc = migrateDoc(doc0);
    adoptBoardPreset(doc);
    /* PACKAGE-N pass 3 — advance `idc` (module-level, resets to 100 per load) past
       everything on this board: an insert that mints an id the board already has
       makes React Flow keep two nodes with one id, and the next edit, selection or
       delete silently acts on the wrong one — data loss. One scan per load; the
       mint itself is ALSO guarded live by nextId (DUP-ID t_0be8c968) — a counter
       rewind (HMR module re-eval) can no longer mint a live id even mid-session. */
    for (const n of doc.nodes) {
      const m = /^n(\d+)$/.exec(n.id);
      if (m) bumpIdc(Number(m[1]) + 1);
    }
    for (const e of doc.edges) {
      const m = /^e(\d+)$/.exec(e.id);
      if (m) bumpIdc(Number(m[1]) + 1);
    }
    animateLayout(() => {
      skipAutosave.current = 2;
      past.current = [];
      future.current = [];
      /* UNISURF-S9 — a LOAD, not an edit: `readOnly` is a persisted preference,
         so refusing here would refuse the boot restore of the mode itself. */
      allowRef.current = true;
      try {
        setNodes(doc.nodes.map(n => ({...n, selected: false})));
        setEdges(doc.edges.map(e => ({...e, selected: false})));
      } finally { allowRef.current = false; }
      bumpHist(v => v + 1);
      setSel(null);
      setSelEdgeId(null);
      setSelCount(0);
      setCurBoard(doc);
      /* AS-5 — ARM the save gate: the ONE place a loaded doc is applied, so the
         ONE place the loaded id is set; until then a flush writes nothing. */
      setBoardLoadedDocId(doc.id);
      boards.cacheLastBoard(doc.id);
      /* HARVEY 2026-10-13 — maxZoom 1; the load fit is panel-aware (checklistFit). */
      setTimeout(() => rf?.fitView({maxZoom: 1,
        padding: fitPaddingFor(!readChecklistDismissed() && !isChecklistComplete(readChecklistDone()))}), 30);
    });
  }, [setNodes, setEdges, rf, animateLayout, adoptBoardPreset]);

  /** FIRST-VISIT rework — the same panel-aware padding for the `fitView` PROP: on
   *  boot RF's first-content fit lands AFTER applyBoard's and used to revert it. */
  const fitOpts = useMemo(() => ({maxZoom: 1,
    padding: fitPaddingFor(!readChecklistDismissed() && !isChecklistComplete(readChecklistDone()))}), []);

  /* ROUND BN-2 — the save/load cluster lives in usePersistence.ts; applyBoard
     stays HERE (it drives the counter through idFactory.bumpIdc and owns the
     undo reset). */
  /* GOBI-S1 — a fragment-owned boot (`#b=`) is a SHARE VIEW: the persistence
   * bootstrap must not load (or seed) the visitor's boards while it is on. */
  const shareActive = useRef(shareViewPayload() !== null);
  const [saveState, modeLabel, storageEstimate, localMode, dirty,
    flushSave, refreshBoards, saveTimer, skipAutosave, flushPending] = usePersistence(
    nodes, edges, nodesRef, edgesRef, curBoard, presetId, mode, autosave,
    boardLoaded, setBoardLoaded, boardLoadedDocId, setBoardList, flash, applyBoard, shareActive, lockRef);

  /* ROUND BN-2 — the boards menu cluster now lives in useBoardsMenu.ts
     (moved verbatim). boardsOpen/boardList/curBoard/presetId stay here
     (shared with usePersistence and the popover JSX) and pass down. */
  const [boardDlg, setBoardDlg, tgOpen, setTgOpen, pendingBoardName,
    closeBoardDlg, newBoard, createFromTemplate, useTemplate, closeGallery,
    boardsMenuBtnRef, boardsPopPos, boardsPopClamp, switchPreset, setBoardStyle, openBoard,
    renameBoard, doRenameBoard, doDuplicateBoard, deleteBoard, doDeleteBoard, saveNow,
    onBoardDialog, boardsBtnRef, historyOpen, openHistory, closeHistory] = useBoardsMenu(
    nodesRef, edgesRef, boardList, setBoardList, boardsOpen, setBoardsOpen,
    curBoard, setCurBoard, presetId, setPresetId, setShowMode, setNoCycles,
    setOneIn, suggestTheme, flushSave, saveTimer, applyBoard, flash, tickTask, writeBlocked);

  /** ONBOARD-P3 — the ONE way into the templates gallery. The boards menu and the
   *  empty board's "Start from a template" both call THIS, so the gallery cannot
   *  grow a second opener that forgets to clear the pending board name. */
  const openTemplates = useCallback(() => { pendingBoardName.current = ''; setTgOpen(true); },
    [pendingBoardName, setTgOpen]);


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

  // ---- history (undo / redo) ----
  const [past, future, bumpHist, pushHistoryRaw, undo, redo, canUndo, canRedo] = useUndoHistory(
    nodesRef, edgesRef, setNodes, setEdges, setSel, setSelCount, setSelEdgeId);
  /* UNISURF-S9 — history is a board write: a refused edit must leave NO entry. */
  const pushHistory = useCallback(() => { if (!writeBlocked()) pushHistoryRaw(); }, [pushHistoryRaw]);

  /* UNISURF-S4 — the pane's commit lane: ONE undo entry per typing streak, a
   * stale report the canvas lock + banner read (`stale` extends review's gates). */
  const [codeStale, onCodeCommitRaw, onCodeTypingEnd] = useCodeCommit(pushHistory, setNodes, setEdges, flushPending);
  const canvasLock = readOnly || !!codeStale;
  /* UNISURF-S7/S9 — the ref the seam and useConnections' FK writer read. */
  lockRef.current = canvasLock;
  /* UNISURF-S9 — THE bypass: the pane's own commit is the repair, so it must
     land ON the stale board. Opened and closed inside one tick, `finally`-safe. */
  const onCodeCommit = useCallback((r: Parameters<typeof onCodeCommitRaw>[0]) => {
    allowRef.current = true;
    try { onCodeCommitRaw(r); } finally { allowRef.current = false; }
  }, [onCodeCommitRaw]);
  const [pendKey, hlKey, setPendKey, pickColumn, setHlKey] = useSelectionBridge(rf); /* UNISURF-S6 bridge */

  /* GOBI-S1 — the share view route (see useShareView). `shareActive` is
   * declared above usePersistence so the bootstrap gate can read it. */
  const {shareDoc, shareError, editCopy, dismissError} = useShareView(
    setNodes, setEdges, setCurBoard, setBoardList, setBoardLoadedDocId,
    adoptBoardPreset, setReadOnly, readOnlyRef, pushHistory,
    () => rf?.fitView({padding: 0.25, maxZoom: 1}), flash, shareActive);

  /* ROUND ROTATE — the rotation write cluster (grip gesture + selection
     chord; one undo entry per gesture — see src/useRotation.ts).
     ROUND ROTATE-FIX — the edge re-measure: updateNodeInternals reads the
     React Flow store from CONTEXT and would throw above <ReactFlow>, so the
     bridge (rendered inside it) fills this ref and useRotation owns WHEN. */
  const rotateInternals = useRef<((ids: string | string[]) => void) | null>(null);
  const [onRotateGesture, onGroupRotateGesture, rotateSelection] = useRotation(nodesRef, setNodes, pushHistory, rotateInternals);


  /* HEADROOM (t_a21adb78) — the clipboard slice moved VERBATIM into
     hooks/useClipboard.ts (refs + the native paste-cursor tracker + the
     five callbacks). App keeps the call site; the hard cap is why.
     Tuple order: [clipboard, pasteCursor, copySelection, pasteClipboard,
     duplicateSelection, nudge, deleteSelection]. */
  const [
    clipboard, pasteCursor, copySelection, pasteClipboard,
    duplicateSelection, nudge, deleteSelection,
  ] = useClipboard(nodesRef, edgesRef, wrap, rf, pushHistory, nextId, setNodes, setEdges, tickTask, flash, snap, gridSize);
  /* GROUP-OBJECT + LOCK v1 (t_c5023f3b) — the three gestures + the context menu's enabled/label state, behind ONE seam (App.tsx is at its cap). */
  const {groupSelection, ungroupSelection, toggleLockSelection, menuState} = useGroupLock({nodesRef, nodes, setNodes, pushHistory, flash, nextId, readOnly});
  const {onLogicalClick, onLogicalDblClick, escapeGroup, insideId} = useLogicalGroup({nodesRef, nodes, setNodes, setPendKey}); /* GROUP-LOGICAL t_eb8fab7e; GROUP-BOUNDARY-INSIDE reads insideId */
  /* GROUP-GAP-DRAG t_10563e73 — the selected block's gap-drag writer (container-only, ONE history entry). */
  const onGapDragGesture = useGapDragGesture({nodes, setNodes, pushHistory, startInteraction, endInteraction, flash, snap, gridSize});

  const ctxAction = useCallback((action: CtxAction, target: CtxTarget) => {
    if (action === 'addNode' && target.kind === 'pane') {
      if (rf && wrap.current) {
        /* AUDIT-7 — raw client coords: screenToFlowPosition already subtracts
           the .react-flow domNode rect internally; subtracting the wrap rect
           here too double-subtracted by (wrap - rf), zero only while the two
           rects coincide. */
        setSearchPos(rf.screenToFlowPosition({x: target.x, y: target.y}));
      } else setSearchPos({x: 200, y: 200});
      return;
    }
    if (action === 'paste') { pasteClipboard(40); return; }
    /* GROUP-OBJECT + LOCK v1 — these act on the whole SELECTION, never just the right-clicked node. */
    if (action === 'group') { groupSelection(); return; }
    if (action === 'ungroup') { ungroupSelection(); return; }
    if (action === 'lock') { toggleLockSelection(); return; }
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

  /* =====================================================================
     ONBOARD-P5 — ONE-LINE TIPS AT FIRST USE (src/tips.ts owns the gates).

     App only decides WHEN to ask and WHERE a tip may land. The four gates (one
     per session, once ever, claimed on show, the Settings switch) all live in
     the pure module, so the harness executes them instead of reading them.

     A TIP NEVER LANDS ON TOP OF A DIALOG — and one of its own triggers is fired
     from INSIDE the ExportModal, so a blocked fire is QUEUED rather than
     dropped, then shown once the last surface closes. */
  const [tip, setTip] = useState<{id: TipId; line: string} | null>(null);
  const pendingTip = useRef<TipId | null>(null);
  const fireTip = useCallback((id: TipId) => {
    if (settingsOpen || !!boardDlg || tgOpen || feedbackOpen || expOpen || shareOpen) { pendingTip.current = id; return; }
    const line = takeTip(id);
    if (line) setTip({id, line});
  }, [settingsOpen, boardDlg, tgOpen, feedbackOpen, expOpen, shareOpen]);
  useEffect(() => {
    const id = pendingTip.current;
    if (!id) return;
    pendingTip.current = null;
    fireTip(id);   // re-runs the same gate: shows now, or queues again
  }, [fireTip]);
  /** The × and the 12s auto-hide are the SAME act: both write the forever key. */
  const dismissTip = useCallback(() => {
    if (tip) markTipSeen(tip.id);
    setTip(null);
  }, [tip]);

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
  /* ROUND BN-2 — the connection cluster now lives in useConnections.ts
     (moved verbatim; the three edge id-mint sites call the nextId callback
     minted by src/canvas/idFactory.ts — and nextId skips live ids,
     DUP-ID t_0be8c968). pendingDrop, connectOrigin,
     readOnlyRef and shiftDown stay here and pass down positionally. */
  const [createsCycle, onReconnect, onConnectEnd, onConnect, onConnectRules, fkConnect] = useConnections(
    nodesRef, edgesRef, setEdges, setGuides, pushHistory, tickTask, flash, rf, wrap,
    readOnlyRef, pendingDrop, connectOrigin, shiftDown, absNodes, noCycles, oneIn,
    dblConnect, dblRange, preset, defaultPath, nextId, fireTip, setNodes, lockRef);


  /** History push on every node drag start (position moves are undoable). */
  const onNodeDragStartAll = useCallback((_e: MouseEvent | TouchEvent, _node: Node) => {
    pushHistory();
  }, [pushHistory]);


  /* ROUND BN-2 — the canvas tool cluster (auto-layout, z-order, align/distribute) now lives in useCanvasTools.ts, moved verbatim. */
  const [autoLayout, reorderSelection, align, distribute] = useCanvasTools(
    nodes, edges, nodesRef, setNodes, pushHistory, absNodes, animateLayout,
    rf, sel, zOrderMode, preset, layoutDir, tickTask);


  const selected = nodes.find(n => n.id === sel);
  /* RAIL-CONTEXT — the rail is contextual: a TABLE selection reveals it, anything else closes it; a manual toggle pins the mode for the rest of the session. */
  const codeOpen = codeMode === 'open' || (codeMode === 'auto' && selected?.type === 'table');
  const toggleCode = useCallback(() => {
    try { localStorage.setItem('diagram-studio:code-rail', codeOpen ? '0' : '1'); } catch { /* ignore */ }
    setCodeMode(codeOpen ? 'closed' : 'open');
  }, [codeOpen]);
  const railPanel = useRailPanel(codeMode === 'open'); /* CODE-RAIL-WIDTH: the TRANSIENT inspector layer — only when the USER opened the rail (not the contextual table auto-open, where the inspector is what edits that table) */
  const selectedEdge = edges.find(e => e.id === selEdgeId) ?? null; useRailReveal(rf, codeOpen, selected, revealTick); /* RAIL-COVER: the rail's width comes out of the canvas, so pan the selected node back inside it (pan only, on open + once per resize gesture end) */
  const edgeMode = !!selectedEdge && selCount === 0;

  const update = useCallback((patch: Partial<NodeKind> | Partial<LabelKind>) => {
    if (!sel) return;
    pushHistory(); if ('scale' in patch) setRevealTick(t => t + 1); /* RAIL-COVER-2 — an inspector scale write is a gesture end: same bounded pan */
    setNodes(ns => ns.map(n => n.id === sel ? {...n, data: {...n.data, ...patch}} : n));
  }, [sel, pushHistory, setNodes]);


  const bendDragging = useRef(false);

  /* APP-SPLIT S8 (t_62266c20) — the edge-write path moved VERBATIM to
     src/hooks/useEdgeWriters.ts: the 8 edge-writing callbacks plus their
     gesture latches and the gobi:node-grow receiver (the undo contract and
     the audit trail live in that module's header). bendDragging STAYS here —
     the inspector's bend slider reads it — and goes in via ctx.
     onNodeDragStartAll and setEdgeColor stay in App too (the gesture snapshot
     + the theme-key writer that routes through updateEdge below). */
  const {onNodeDrag, onNodeDragStop, updateEdge, setEdgeColorLiteral,
    onCommitLabel, onGrow, onBend, onLabelWrite} = useEdgeWriters({
    selEdgeId, setSelEdgeId, tickTask, pushHistory, setEdges, setNodes, flash,
    edgesRef, nodesRef, bendDragging, helperDrag, setGuides, alignGuides,
    absNodes});

  /** Set stroke colour everywhere it is baked in (path + both markers). */
  /** L1 — the edge colour is stored as a KEY, so the path stroke, both markers
   *  and the payload filters all recolour with the theme.
   *
   *  ROUND AO, AO-1c — IT ALSO CLEARS A LITERAL, WHICH IS THE "BACK TO A THEME
   *  COLOUR" PATH. `edgeColorPatch` does not mention `data.color`, so a literal
   *  chosen earlier would survive the spread and keep winning nothing — the key
   *  wins `resolveColor`'s precedence, so the stroke would look right — but the
   *  STALE literal would still be on the edge, and `edgeColorLiteralPatch` would
   *  later read it back into the custom cell as if it were current. Clearing it
   *  here is what makes the two writers exact inverses rather than two writers
   *  that happen to agree on the colour. */
  const setEdgeColor = useCallback((key: ColorKey) => {
    const e = edgesRef.current.find(x => x.id === selEdgeId);
    if (!e) return;
    const patch = edgeColorPatch(key, {markerEnd: e.markerEnd, markerStart: e.markerStart});
    patch.data = {...patch.data, color: undefined} as typeof patch.data;
    updateEdge(patch);
  }, [selEdgeId, updateEdge]);


  /** ROUND AK, AK-13 — the double-click-on-the-path SIGNAL, written exactly as
   *  the context menu's `editLabel` branch writes `__edit`: a fresh timestamp
   *  plus the flow point the click landed on, threaded through the edge's own
   *  `data`. Read-only is a no-op — the menu that also reaches it is already
   *  inert in review mode, and this is the same defence in depth. */
  const openLabelAt = useCallback((id: string, at: Pt) => {
    if (canvasLock) return;
    setEdges(es => es.map(e => (e.id === id
      ? {...e, data: {...((e.data ?? {}) as EdgeData), __editAt: {at, t: Date.now()}}}
      : e)));
  }, [canvasLock, setEdges]);

  /** ROUND AN, AN-1 — CONSUME THE CREATE SIGNAL: the deletion half of the
   *  one-shot, called by the renderer from BOTH exits of the label editor
   *  (`commit` and `cancel`).
   *
   *  WHY IT HAD TO EXIST. `openLabelAt` above writes `__editAt` and, before this
   *  round, nothing in the tree deleted it — grep proved one writer and zero
   *  deleters. A one-shot that outlives its moment is permanent, so after the
   *  first create the key stayed on the edge and EVERY later rename re-entered
   *  the renderer's create branch and rewrote the label to the centred state
   *  ("nếu tôi đổi text, enter thì nó tự nhiên về lại center").
   *
   *  WHY IT DOES NOT PUSH HISTORY. The signal was never a document edit the user
   *  can see — it is UI state that happens to ride in `data`. Giving its removal
   *  an undo step would put an entry on the stack whose undo restores a signal
   *  that must not exist. `onCommitLabel`'s own rule is the same: a step that
   *  changes nothing the user can perceive must not push.
   *
   *  WHY IT TOUCHES ONE EDGE. The editor is open on one edge; the delete is
   *  keyed by that edge's id, so a stale signal on some OTHER edge is never
   *  silently swept away here — `migrateEdge` folds those on load, and this
   *  handles the live one.
   *
   *  A NO-OP WHEN THE KEY IS ABSENT (the common case): a rename of a normal,
   *  existing label takes the editor's own double-click path, never stamps the
   *  signal, and this call deletes nothing. It returns the same array object for
   *  every edge it does not change, so an ordinary rename causes no state churn
   *  and no re-render of unrelated edges. */
  const consumeEditAt = useCallback((id: string) => {
    setEdges(es => {
      const i = es.findIndex(e => e.id === id);
      if (i < 0) return es;
      const d = (es[i].data ?? {}) as EdgeData;
      if (!('__editAt' in d)) return es;
      const {__editAt: _drop, ...rest} = d;
      const next = es.slice();
      next[i] = {...es[i], data: rest as EdgeData};
      return next;
    });
  }, [setEdges]);

  /* ROUND AK, AK-13 — DOUBLE-CLICK ON THE EDGE PATH CREATES A LABEL THERE.

     WHY REACT FLOW'S OWN `onEdgeDoubleClick` AND NOT A HANDLER ON THE PATH. The
     library already renders one `<g class="react-flow__edge">` per edge with the
     handler on it, and it already owns the hit-test AK-13 asks for: the group is
     `pointer-events: visibleStroke`, so an event on it IS on the line, and
     `BaseEdge`'s `interactionWidth` widens that to a 26px band a finger can
     actually land on. A handler on the authored `<path>` would sit under that
     band. And the "was it inside an existing label?" exclusion is done by the
     DOM: the label is portalled into `.react-flow__edgelabel-renderer`, a
     SIBLING of the edge layer, so its own double-click catches that case and the
     event never reaches this handler — exactly draw.io's exclusion
     (`Graph.insertTextForEvent` creates a label only when the double-click was
     not on one).

     WHAT IT WRITES IS ONLY THE SIGNAL. It does not touch the label text or the
     position: `openLabelAt` stamps `__editAt` with the click's flow point, the
     renderer opens its editor from it, and the position is stored by the COMMIT
     if the user leaves the text empty. So a double-click that is immediately
     cancelled writes nothing at all. */
  const onEdgeDoubleClick = useCallback((e: React.MouseEvent, edge: Edge) => {
    if (canvasLock || !rf || !wrap.current) return;
    // `screenToFlowPosition` is the authority this app uses for every
    // client→flow conversion, so no second conversion is compiled into the
    // renderer that could drift from these. (AUDIT-7 — raw client coords: the
    // function subtracts the domNode rect itself; the manual wrap-rect
    // subtraction here double-subtracted.)
    const at = rf.screenToFlowPosition({x: e.clientX, y: e.clientY});
    openLabelAt(edge.id, at);
  }, [canvasLock, rf, openLabelAt]);

  /** ROUND AK, AK-14.1 — `Reset label position`, ONE history step.
   *
   *  It clears ALL THREE KEYS rather than storing a centred offset, which is the
   *  same state a gesture that never moved lands on — so the button and the
   *  gesture end the label in one place. Lucidchart ("Reset line"), Lucidspark
   *  and Miro all ship a reset; Miro had to add a SEPARATE touch variant, which
   *  is the tell that a desktop-only idiom would not have done.
   *
   *  ROUND AM, AM-1 — `labelAnchor` IS DELETED HERE TOO. It is the frame the
   *  stored offset was measured in, so leaving it behind after the offset is gone
   *  would be a key with nothing to describe — and the next drag would try to
   *  rebase against it. Three situations, one stored state: reset, dragged back
   *  to the centre, and never moved. */
  const resetLabelPos = useCallback(() => {
    if (!selEdgeId) return;
    pushHistory();
    setEdges(es => es.map(e => {
      if (e.id !== selEdgeId) return e;
      const data = {...((e.data ?? {}) as EdgeData)};
      delete data.labelOffset;
      delete data.labelPinned;
      delete data.labelAnchor;
      return {...e, data};
    }));
  }, [selEdgeId, pushHistory, setEdges]);

  /** ROUND AK, AK-15 — `Reverse line direction`, draw.io's Arrange → Reverse:
   *  "your connector ends and their labels will be swapped, but the path of the
   *  connector will not be changed."
   *
   *  The patch comes from `edgeLabel.reverseEdgePatch` (pure, harnessed). It
   *  returns ONLY the keys it owns — `source`/`target`, the two handles, and the
   *  legacy `offset` fraction mirrored `o → 1−o` — and those are SPLIT here
   *  because the two halves live at different depths on an edge:
   *
   *    * the top-level keys go straight onto the edge object;
   *    * the `data` half is an explicit MERGE, never `replaceData`, so
   *      `strokeKey`, `bendX`/`bendY`, `labelOffset`, `flow` and every sibling
   *      survive by construction rather than by a copy that could drift.
   *
   *  IT DOES NOT GO THROUGH `updateEdge`, for the reason `onBend` gives: that is
   *  keyed on `selEdgeId` and this is keyed on the edge whose BUTTON was pressed,
   *  so a stale selection could reverse the wrong line. The handles travel with
   *  their nodes, which is why `sourceHandle`/`targetHandle` must swap too — an
   *  ERD edge's handles name a COLUMN, and swapping the ends without them would
   *  attach the line to the wrong face of each box. */
  const reverseEdgeDir = useCallback((id: string) => {
    const cur = edgesRef.current.find(e => e.id === id);
    if (!cur) return;
    const patch = reverseEdgePatch(cur as any);
    pushHistory();
    setEdges(es => es.map(e => {
      if (e.id !== id) return e;
      const {data, ...top} = patch;
      const out = {...e, ...top} as Edge;
      if (data !== undefined) out.data = {...((e.data ?? {}) as EdgeData), ...data};
      return out as Edge;
    }));
  }, [pushHistory, setEdges]);

  /* ROUND S (2026-09-18) — the Text node's in-place editor commits here.

     A DELIBERATE SIBLING OF `update()` (App.tsx:1682), not a second
     implementation of it. It keeps BOTH of that function's load-bearing
     properties, so the field never grows a second source of truth:

       * `pushHistory()` ONCE PER COMMIT. The draft lives in `LabelNode`'s own
         state, so a keystroke calls nothing; this runs once, on commit — the
         same discipline as `onCommitLabel` above and the edge editor.
       * the same `map(n => n.id === id ? {…, data:{…n.data, patch}} : n)` shape,
         so nothing else on the node's data is clobbered.

     THE ONE DIFFERENCE IS THE KEY, and it is the point: `update()` is keyed on
     `sel` because the inspector edits whatever is selected, while this is keyed
     on the `id` the double-clicked node handed back — so the editor writes to
     the node under the pointer even when the selection says otherwise.

     `setSel(id)` mirrors `onCommitLabel`'s `setSelEdgeId(id)`: the inspector
     then shows the node that was just edited.

     The no-op guard is `onCommitLabel`'s, for the same reason — a blur that
     changed nothing must not push a history entry the user never asked for. */
  const commitLabelText = useCallback((id: string, text: string) => {
    const cur = nodesRef.current.find(n => n.id === id);
    if (!cur || (((cur.data as any)?.text ?? '') as string) === text) return;
    tickTask('node');
    pushHistory();
    setNodes(ns => ns.map(n => (n.id === id ? {...n, data: {...n.data, text}} : n)));
    setSel(id);
  }, [tickTask, pushHistory, setNodes]);

  /** INLINE-TITLE — the in-place title commit (goblin + customshape): ONE
   *  history entry per commit, exactly the commitLabelText lane (an unchanged
   *  value pushes nothing, so a no-op blur costs no undo step). The EMPTY
   *  revert is enforced by the CALLER (the editor never calls this with a
   *  blank draft) — a card with no title is not a valid state. */
  const commitNodeTitle = useCallback((id: string, title: string) => {
    const cur = nodesRef.current.find(n => n.id === id);
    if (!cur || (((cur.data as any)?.title ?? '') as string) === title) return;
    tickTask('node');
    pushHistory();
    setNodes(ns => ns.map(n => (n.id === id ? {...n, data: {...n.data, title}} : n)));
    setSel(id);
  }, [tickTask, pushHistory, setNodes]);

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
          // ROUND S: the midpoint drag. Per-edge, like the two callbacks above
          // — the edge renderer owns the handle and reports a pointer position;
          // the handler lives here because it writes `edges` state.
          __onBend: onBend,
          /* AQ15 — auto-grow on create: the renderer reports a clipped body
             and the node's needed height; this grows node.style.height, the
             exact write a manual resize performs. */
          __onGrow: onGrow,
          /* ROUND AK — AK-10's label drag, threaded per-edge for the reason
             above. `onLabelWrite` receives the FINISHED write: the renderer
             applies `labelWrite`, because only it holds the resolved path, the
             anchor and the measured label box. (AK-13's double-click is wired at
             the EDGE GROUP, `onEdgeDoubleClick` below — React Flow owns that
             handler and the hit-test with it.) */
          __onLabelWrite: onLabelWrite,
          /* ROUND AN, AN-1 — the DELETE half of the `__editAt` one-shot. The
             renderer calls it from `commit` AND from `cancel`, so the create
             signal ends with the editor session that opened it and a later
             rename can no longer re-enter the centred-write branch. Same
             per-edge threading as the three keys around it — the renderer does
             not own `edges` state, so the deletion lives here. */
          __consumeEditAt: consumeEditAt,
          // FB-L: the edge renderer owns the label's inline editor, so the
          // review-mode flag has to reach it per-edge — same shape as the two
          // keys above. Read-only keeps the label readable; it never opens the
          // input. UNISURF-S4: `canvasLock` — stale locks edges like review.
          readOnly: canvasLock,
        },
      };
    }),
    [edges, onCommitLabel, canvasLock, onBend, onLabelWrite, consumeEditAt, onGrow],
  );

  /** L3c: the symbolic keys whose crow's-foot glyphs this board needs. Keyed by
   *  KEY (not hex) so one <defs> set serves every theme — the glyph paints from
   *  `var(--c-*)` and the theme cascades. */
  const crowKeys = useMemo(() => {
    const ks = new Set<ColorKey>();
    edges.forEach(e => { if (hasCrow(e, 'start') || hasCrow(e, 'end')) ks.add(edgeStrokeKeyOf(e)); });
    return [...ks];
  }, [edges]);

  /** L3c: table nodes get the show-mode, collapse + column-edit seams (S5). */
  const lockedSet = lockedIdSet(nodes); /* LOCK v1 — effective set incl. group inheritance */
  const lockedKey = [...lockedSet].sort().join(','); /* F1b — content signature: lockedIdSet mints a fresh Set per render, so the old identity dep re-ran this memo (rebuilding EVERY mapped node object) on every App render */
  const rfNodeCache = useRef(new WeakMap<object, {stamp: string; out: (typeof nodes)[number]}>());
  const rfNodes = useMemo(
    () => {
    /* F1b stamp — every non-`nodes` mapping input, fixed order (scalars by value, seams by identity); WeakMap keyed by SOURCE ref: unchanged nodes hit, a drag frame (one rebuilt node) misses only that node, adoptUserNodes keeps every other node's internals — only the dragged node's edges re-render. */
    const stamp = [canvasLock ? 1 : 0, readOnly ? 1 : 0,
      titleEdit ? titleEdit.id + '@' + titleEdit.at : '', showMode,
      codeStale ? codeStale.cols.join('|') : '', hlKey ?? '', lockedKey,
      commitNodeTitle, commitLabelText, pushHistory, setNodes, fkConnect,
    ].map(String).join('~');
    const cache = rfNodeCache.current;
    const mapNode = (n: (typeof nodes)[number]) => {
      /* K — DEFECT 2 (fold): re-apply RF's `noPanClassName` to the node wrapper
         while review mode is on — RF only writes that token itself while the
         node is draggable, so `nodesDraggable={false}` would drop it and a
         drag starting on a node would pan the canvas instead. Outside review
         mode `n.className` passes through byte-for-byte as before. */
      const nodeClassName = canvasLock ? [n.className, NO_PAN].filter(Boolean).join(' ') : n.className;
      /* ROUND S (fold): `label` nodes get their in-place editor from
         LabelNode; the commit callback + review flag ride `data`, like rfEdges. */
      /* CHROME-ABOVE (fold): grip writer tokens RETIRED — rotate grip + desc
         badge render in NodeChrome, one seam deeper, taking the rotation
         writer directly with its own sole-selection + !readOnly gate. */
      /* INLINE-TITLE (fold): token + writer + review flag ride the SAME
         render-time injection, selected nodes only (opens select first);
         never written into nodes state. */
      /* BADGE-ON-SELECT (fold): review mode allows sole selection (the desc
         badge reveals through it). Lock-seam philosophy: STALE keeps every
         affordance on screen and refuses the WRITE at the seam; REVIEW is a
         clean reading view that shows no editing chrome. So `readOnly` stays
         canvasLock (the legacy editor gate — blocked under both locks) and
         `__review` is the PURE review flag the node components gate their
         resizers on: a node selected before the stale lock keeps its handles
         (the drag is refused by the seam), while a review selection paints
         the ring and the ⓘ and nothing else. The title-editor writer/token
         keep their pre-change unconditional injection. */
      const editData = n.selected ? {
        onCommitTitle: commitNodeTitle,
        readOnly: canvasLock,
        __review: readOnly,
        ...(titleEdit?.id === n.id ? {__editTitle: titleEdit.at} : {}),
      } : {};
      if (n.type === 'label') {
        return {
          ...n,
          className: nodeClassName,
          data: {
            ...((n.data ?? {}) as any),
            onCommitText: commitLabelText,
            readOnly: canvasLock,
            ...(titleEdit?.id === n.id ? {__editTitle: titleEdit.at} : {}),
          },
        };
      }
      if (n.type === 'table') {
        /* UNISURF-S4 stale marks + S5 row seam + S7 FK writer + S8 collapse gate. */
        const staleCols = codeStale
          ? codeStale.cols.flatMap(k => (k.startsWith(n.id + ':') ? [k.slice(n.id.length + 1)] : []))
          : null;
        return {
          ...n, style: {...(n.style ?? {}), width: undefined}, /* BOARD-STYLE: wrapper shrink-wraps the measured card */
          className: nodeClassName,
          data: {
            ...((n.data ?? {}) as any),
            __showMode: showMode,
            __onToggle: (id: string, collapsed: boolean) => { pushHistory();
              setNodes(ns => ns.map(m => m.id === id ? {...m, data: {...(m.data as any), collapsed}} : m));
            },
            /* UNISURF-S5 — the full-column seam; S7 — the ONE FK writer. */
            __onColumns: (id: string, cols: import('../../packages/gobi/src/model/nodeData').TableColumn[], push?: boolean) => {
              if (push) pushHistory();
              setNodes(ns => ns.map(m => m.id === id ? {...m, data: {...(m.data as any), columns: cols}} : m));
            },
            __lock: canvasLock, __onPickColumn: pickColumn, __onFk: fkConnect, /* S6 bridge · S7 FK */
            ...(staleCols ? {__staleCols: staleCols} : {}),
            ...(hlKey && !codeStale && hlKey.startsWith(n.id + ':') ? {__hl: hlKey} : {}), /* S6 caret's row; never while stale */
          },
        };
      }
      /* memo safety: an UNSELECTED node's data object stays reference-equal
         (a new data object per recompute would defeat DiagramNode's memo). */
      return n.selected
        ? {...n, className: nodeClassName, data: {...((n.data ?? {}) as any), ...editData}}
        : {...n, className: nodeClassName};
    };
    return nodes.map(n => {
      const hit = cache.get(n);
      if (hit && hit.stamp === stamp) return hit.out;
      const mapped = mapNode(n);
      const out = lockedSet.has(n.id) ? { /* LOCK v1 — derived at render, never stored */
        ...mapped, draggable: false, deletable: false, connectable: false, data: {...((mapped.data ?? {}) as any), __locked: true}, className: [mapped.className, NO_PAN].filter(Boolean).join(' '), /* keep noPanClassName on locked nodes: RF only gives it to draggable ones, and panOnDrag=[1,2]'s right-button pan filter would otherwise swallow the node's contextmenu */
      } : mapped;
      cache.set(n, {stamp, out});
      return out;
    });
    },
    [nodes, showMode, pushHistory, setNodes, readOnly, codeStale, commitLabelText, commitNodeTitle, hlKey, fkConnect, canvasLock, titleEdit, lockedKey],
  );

  /* APP-SPLIT t_b2cad7a8 (S5): paletteInsert.ts owns the insert policy; App
     threads the 10-value ctx — the two bindings below keep the same names. */
const addNodeByLabel = useMemo(() => makeAddNodeByLabel({LIBRARY, nextId, wrap, rf, pushHistory, tickTask, fireTip, setNodes, preset, asShape}), [LIBRARY, nextId, wrap, rf, pushHistory, tickTask, fireTip, setNodes, preset, asShape]);

  // ---- D1: insert via the searchable palette ----
  const insertFromSearch = useCallback((label: string) => insertFromSearchImpl({searchPos, addNodeByLabel, setSearchPos}, label), [searchPos]);

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
  /* APP-SPLIT S4 (t_7c67b8cd): the library/asset cluster (favourites/shapes state, its filters, its insert handlers) moved VERBATIM to ../hooks/useLibraryPanel — same state identities, same setters; its module header carries the census read set and the render rule. */
  const {favourites, shapes, toggleFavourite, removeFavourite, isStarred, addFavouriteFromSelection,
    insertFavourite, insertCustomShape, removeCustomShape, importInputRef, openShapeImport,
    onImportInputChange, shapeZoneProps, onDrop, removeGuard} = useLibraryPanel({
    rf, wrap, flash, pushHistory, tickTask, nextId, addNodeByLabel, gridSize, LIBRARY,
    nodesRef, edgesRef, setNodes, setEdges,
  });
  const noteRemove = useCallback(() => {
    if (removeGuard.current) return;
    removeGuard.current = true;
    window.setTimeout(() => { removeGuard.current = false; }, 0);
    pushHistory();
  }, [pushHistory]);

  /* ROUND 5 — A RESIZE IS ONE UNDOABLE STEP. Same shape as the drag, which
     pushes once from `onNodeDragStartAll` (below). React Flow's `NodeResizer`
     emits a `dimensions` change carrying `resizing: true` on every frame of the
     drag and a final `resizing: false` at the end; `recordResizeGesture` turns
     that stream into exactly one push and re-arms for the next gesture. The
     decision itself lives in `src/resizeHistory.ts` so `checks/` can execute it
     rather than restate it (change-level flag, not `onResizeStart`; position
     changes are NOT recorded here). `guard` is a plain object (not a boolean
     ref) because the helper needs to write back through it. */
  const resizeGuard = useRef(newResizeGuard());

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    /* S10: stale = read-only canvas; dropping it costs nothing (RF re-measures).
       BADGE-ON-SELECT (t_e1ad9237): SELECTION changes are the one exception —
       review mode now allows sole selection (the desc badge's door) and RF
       delivers it as {type:'select'} through this seam; a selection is NOT a
       document write (the save path strips `selected`, board/library.ts), so
       the lock's byte-identical guarantee is untouched. Everything else stays
       refused under the lock, exactly as before. */
    if (writeBlocked() && !changes.every(c => c.type === 'select')) return;
    if (changes.some(c => c.type === 'remove')) noteRemove();
    if (recordResizeGesture(resizeGuard.current, changes)) pushHistory(); if (changes.some(c => c.type === 'dimensions' && c.resizing === false)) setRevealTick(t => t + 1); /* RAIL-COVER-2: the gesture END (resizing:false, the undo step's frame) is the ONE moment the rail pans the resized node back inside — never per frame */
    /* TABLE-GRIP: a derived size — the grip's dimensions change becomes `scale`. */
    onNodesChange(tableGripChanges(changes, nodesRef.current, setNodes, tableStyle, tableDensity, tableNaturalWidth));
  }, [onNodesChange, noteRemove, pushHistory, writeBlocked, setNodes, tableStyle, tableDensity, setRevealTick]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (writeBlocked()) return; /* S10 — same channel, same gate */
    if (changes.some(c => c.type === 'remove')) noteRemove();
    onEdgesChange(changes);
  }, [onEdgesChange, noteRemove, writeBlocked]);


  // Part B — ONE source of truth for the read-only review toggle. The toolbar
  // button and the Shift+2 shortcut both call this, so the two triggers can
  // never drift apart. The body is the button's original inline onClick,
  // carried across verbatim; the deps list every value it reads (`readOnly`,
  // `rf`) and every setter it calls, so neither path can close over a stale
  // `readOnly` and flip the mode the wrong way.
  const toggleReadOnly = useCallback(() => {
    /* GOBI-SHARE-LOCK — a share view cannot be unlocked from inside: the
       toggle is disabled and Shift+2 lands here only via the keyboard path,
       which must be inert too ("Copy to my boards" is the ONE exit). The ref (not
       the state) decides so an in-flight keydown during the share decode is
       also covered. */
    if (shareActive.current) return;
    const next = !readOnly; if (next) void flushPending(); /* S11 — flush, then lock (the same door) */
    setReadOnly(next);
    readOnlyRef.current = next; /* AUDIT-16 — visible to in-flight gestures immediately */
    try { localStorage.setItem(READ_ONLY_KEY, next ? '1' : '0'); } catch { /* ignore */ }
    if (next) {
    // Entering the mode must not leave a stale ring or node
    // toolbar on screen: clearing the selection does that in one move
    // (BADGE-ON-SELECT t_e1ad9237: review mode now allows FUTURE sole
    // selections — the desc badge's door — but nothing editing may ride
    // one; the clear here still guarantees a clean reading view on entry).
      setCtx(null);
      setSearchPos(null);
      /* UNISURF-S10 — through the SEAM, not the instance setters: those diff
         the store's RENDER-augmented copies back into the node list
         (className/`data.__*` leaked that way and stuck to the document). */
      setNodes(nss => nss.map(n => n.selected ? {...n, selected: false} : n));
      setEdges(es => es.map(e2 => e2.selected ? {...e2, selected: false} : e2));
      setSel(null);
      setSelEdgeId(null);
      setSelCount(0);
      flash('Read-only review mode');
    } else {
      flash('Editing enabled');
    }
  }, [readOnly, setNodes, setEdges, flash, setCtx, setSearchPos, setSel, setSelEdgeId, setSelCount, shareActive, flushPending]);


  /* ROUND BN-2 — the export cluster now lives in useExportActions.ts
     (moved verbatim; the lazy thunks moved with it and stay DYNAMIC inside
     the hook). The Mermaid import mints ids through readNextId/setNextId,
     which read/write the idFactory counter (setIdc — an absolute set, made
     safe by the nextId live-id skip, DUP-ID t_0be8c968). */
  const [buildSvg, buildPng, boardPngForFeedback, printPdf, fileRef] = useExportActions(
    wrap, rf, theme, nodes, edges, pngScale, pngPad, curBoard,
    pushHistory, setNodes, setEdges, bumpHist, flash, tickTask,
    () => idc, setIdc);


  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    /* F9 — caps + the ONE validator live in board/importLimits; every refusal
       returns before a state write, message in the modal, not the toast. */
    const verdict = await readImportedFile(file);
    /* `ok === false` (not truthiness): non-strict tsc does not narrow via truthiness. */
    if (verdict.ok === false) { setImportFileMsg(verdict.msg); return; }
    setImportFileMsg(null);
    const parsed = verdict.doc as {nodes: Node[]; edges: Edge[]; [k: string]: unknown};
    // keep generated ids ahead of anything imported
    let maxId = idc;
    for (const n of parsed.nodes as Node[]) {
      const m = /^n(\d+)$/.exec(n.id);
      if (m) maxId = Math.max(maxId, Number(m[1]) + 1);
    }
    setIdc(maxId);
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
    tickTask('board');   // ONBOARD-P4 B2 — importing a board is an explicit act
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
    /* HARVEY 2026-10-13 — maxZoom 1, same as the board-load fit. */
    setTimeout(() => rf?.fitView({padding: 0.25, maxZoom: 1}), 30);
  };

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
  /* ROUND AK, AK-12 — the label plate's readout, TOLERANT of an unknown value
     (`labelBgOf` resolves anything unrecognised to `surface`, the shipped look),
     so a hand-edited board cannot render an unstyled plate. */
  const eLabelBg = labelBgOf((selectedEdge?.data as any)?.labelBg);
  /* AL-3 — the label's two NEW colour keys, read through the SAME resolver the
   *  edge stroke uses (`isColorKey` + `COLOR_VAR`), so both rows draw from the
   *  panel's existing 9-key vocabulary and neither invents a palette. `null`
   *  means \"not set\", which is what makes the swatch row show an unselected
   *  state rather than a false default. */
  const eLabelTextKey = resolveColorKey({strokeKey: (selectedEdge?.data as any)?.labelTextKey} as any);
  const eLabelBgKey = resolveColorKey({strokeKey: (selectedEdge?.data as any)?.labelBgKey} as any);
  /* AK-14.1 — `Reset label position` is only meaningful once the label has
     actually been moved, so the button is disabled on a centred label rather
     than offering a step that would push a history entry and change nothing. */
  const eLabelMoved = !!(selectedEdge?.data as any)?.labelPinned;
  /* ROUND AK, AK-3 — `eOffset` WAS HERE, and it is deleted with the field it
     fed. It was the `data.offset` readout for the `label position` row; with that
     row gone nothing reads it. The VALUE is untouched — `GoblinEdge.tsx:383`
     still reads `d.offset` — so a board carrying `start`/`end` still renders it. */

  /* HEADROOM t_a21adb78 — `markerOptions` IS DELETED. It was DEAD code (defined,
     never read — checked by grep; a PACKAGE-P note had reported it rather than
     fixing it in passing): this round's scope IS dead-code trim, so it goes.
     The live tables are `MARKER_OPTS` / `MARKER_OPTS_START` right below. */

  /* ---- PACKAGE-P §B: the option tables the pickers render ----------------
     Each table is the SAME value set the `<select>` it replaces carried, so the
     conversion changes the control and nothing about what is stored. `art` is
     the glyph; `label` is both the trigger text and the row text. */
  /** same table, mirrored — the head-START control is the head-END one flipped.
   *  HEADROOM t_a21adb78 — DERIVED instead of a hand-copied twin table (the
   *  rows share value + label; only the glyph mirrors). cloneElement keeps the
   *  same kind per row and adds flip, so the rendered table is identical. */
  const DASH_OPTS: PickerOption[] = (['solid', 'dashed', 'dotted'] as const).map(d => ({
    v: d, label: d, art: <ArtDash kind={d} />,
  }));
  const CURVE_OPTS: PickerOption[] = (['bezier', 'smoothstep', 'step', 'straight'] as const).map(c => ({
    v: c, label: c, art: <ArtCurve kind={c} />,
  }));
  /* ROUND AK, AK-3 — `OFFSET_OPTS` WAS HERE, AND IT IS DELETED, with the
   *  `ArtLabelPos` glyph it drew (that glyph had no other consumer). The table
   *  backed the `label position` row — a 3-button preset for a value the label
   *  drag already sets — so it went with the row. THE STORED FIELD IS UNTOUCHED:
   *  `data.offset` is still read by `GoblinEdge.tsx:383`, so a board that
   *  carries `start`/`end` renders exactly as it did. */
  /* ROUND AM, AM-5 — `SPEED_OPTS` IS DELETED, AND SO IS THE ROW IT FED.
     It held four ordinal words — `slow` / `normal` / `fast` / `very fast` — over
     `flowDuration`, a value the renderer accepts continuously (0.6…8s). Four
     hard steps were COARSER than the field they wrote, and the row cost a full
     50px of panel for them. The flow section now renders `FlowSpeed`: a range
     input on the field's own range, so the four old values (4 / 2.4 / 1.4 / 0.8)
     are all still reachable and everything between them is too.
     NOTHING IS STORED DIFFERENTLY: the write is still
     `updateEdge({data: {flowDuration: …}})`, so a board carrying any of the four
     renders exactly as it did. The table is not kept "just in case" — a removed
     option that keeps its table is how the option comes back. */
  /* ROUND AK, AK-12 — THE LABEL PLATE'S THREE STATES. `LABEL_BG_VALUES` is the
     canonical list (it is what the renderer's `labelBgClass` resolves against),
     and each entry's label is its own name capitalised, so the stored value and
     the button text cannot drift apart. Three options ≤ the cited flat-row
     threshold of 4 (AK-6 note), so this is a segmented row like the rest.
     `None` is a GENUINE STORED VALUE here, not the absence of one — which is why
     the table lists it rather than leaving the row with two entries and a
     "default" the user cannot return to. */
  const LABEL_BG_OPTS: PickerOption[] = LABEL_BG_VALUES.map(v => ({
    v, label: v === 'none' ? 'None' : v === 'surface' ? 'Surface' : 'Outline', art: null,
  }));

// HEADROOM t_a21adb78 — hoisted: the drop hint was spelled twice (aria-label + title).

  /* ==========================================================================
     ROUND AL, AL-6 — THE ONE CHIP ROW. This is the panel's ONLY row control.

     WHY ONE HELPER, AND WHY A REAL `<button>`. The owner measured three
     unrelated button families on one panel (`"lúc to, lúc dài, lúc nhỏ"`); a
     single helper is what makes that impossible to reintroduce — there is no
     second place to add a button. The element is a native
     `<button type="button">`, so Enter and Space work with NO key handler
     (the same rule this project set for the section trigger), and the class
     `chip` carries the figure: a PILL by default, `chip ic` for a glyph row
     (the square), `chip act` for an action.

     SIZE IS THE CONTENT'S. The row wraps (`styles.css` `.chips`) and no chip
     carries `flex: 1 1 0`, so "None" is short and "Reset label position" is
     long and each is the width it needs — the exact inverse of the equal-share
     grid the owner measured as uneven. */
  const chipRow = (opts: PickerOption[], value: string, onPick: (v: string) => void, title: string, glyph = false) => (
    <div className="chips">
      {opts.map(o => (
        <button
          key={o.v}
          type="button"
          className={`chip${glyph ? ' ic' : ''}${String(o.v) === value ? ' on' : ''}`}
          title={o.label ? `${title}: ${o.label}` : title}
          onClick={() => onPick(String(o.v))}
        >
          {glyph ? (o.art ?? o.label) : o.label}
        </button>
      ))}
    </div>
  );
  /** AL-6 — the GLYPH variants of the four tables converted this round. They are
   *  the SAME tables (same values, same writes) — only the row's figure changes,
   *  so a value can never differ between the pill form and the glyph form. */
  const DASH_ICON_OPTS = DASH_OPTS;
  const CURVE_ICON_OPTS = CURVE_OPTS;
  const MARKER_ICON_OPTS = MARKER_OPTS;
  /** AL-6 — `flow` becomes a GLYPH row. `flow glyph` reuses `FLOW_ICON_PATHS`'s
   *  own vocabulary rather than inventing a second one. */
  /** ROUND AM, AM-3 — `flow glyph` becomes a row of SIX ICON CHIPS carrying the
   *  glyph each option will actually travel along the line, drawn in miniature,
   *  exactly as the approved mockup draws them. Two things had to change for
   *  that to be honest rather than a second vocabulary:
   *
   *  1. `art` is no longer `null`. It was the whole reason the row rendered as
   *     word-chips: `chipRow`'s glyph form falls back to `o.label`, so six
   *     `art: null` options painted six words. Each now carries its own glyph.
   *  2. The glyphs come from `FLOW_ICON_PATHS` — moved to `src/nodes/flowIcons.tsx`
   *     (AM-3) so BOTH readers can reach it. AL-6's comment claimed this reuse;
   *     the module boundary made it a promise. This file and `GoblinEdge.tsx`
   *     now read the SAME map, so a chip cannot drift from the picture the edge
   *     travels.
   /* ROUND AN, AN-3 — THE GLYPH ROW DRAWS IN THE FLOW ROW'S OWN FRAME.
      This row used to carry its own `<svg viewBox="0 0 24 24" width={15}
      height={15}>`: a figure of ~12.5px of ink inside a 15px box, rendered at the
      same 30×30 chip. Every figure in the `flow` row directly above it instead
      goes through the shared `G` wrapper — a 26×18 viewBox with a `2` stroke, so
      its ink spans roughly 22×10 OF THAT BOX. Two frames, two weights, same chip
      size: that is the owner's report ("làm cái icon nó to như mấy cái nút như
      trong flow cho đồng bộ kích thước"). The frame, the stroke and the classes
      are now IDENTICAL to `ArtFlow`'s, so the two rows are one family by
      construction rather than by two lookalike implementations.

      THE GLYPH PATHS DID NOT CHANGE, and they are not copied either. The six
      figures arrive from `FLOW_ICON_PATHS` — the map AM-3 moved into
      `src/nodes/flowIcons.tsx` so this row and the travelling chip could not drift — and
      are SCALED INSIDE the shared frame instead of being re-drawn for it. The
      scale is read off the two geometries rather than guessed, and the rendered
      pixel arithmetic is stated so the number can be checked:

        · `ArtFlow`'s figures run from x=2 to x=24 — 22 UNITS of the 26-unit frame,
          which is the span the flow row's ink occupies.
        · These glyphs are drawn on a 24×24 grid whose own ink spans 2..22 — 20
          UNITS (checked across all six: `mail`'s rect is 2..22, `settings`' spokes
          reach 2..22, the rest sit inside that).
        · So the factor is frame-span ÷ glyph-span = 22/20, NOT 22/24: dividing by
          the glyph's GRID instead of its INK would shrink each figure to 18.3
          frame units — smaller than the row above it, i.e. the defect in reverse.
        · `stroke-width` is divided by that same factor, so what the browser paints
          is the same TWO FRAME UNITS `ArtFlow` paints. Scaling a stroke without
          this division is how a glyph ends up thinner at the same nominal width.

      THE RENDERED RESULT, from source: `.chip svg` (`styles.css`) sizes BOTH rows'
      `<svg>` to 15×15, so a frame unit is 15/26 = 0.577px in each. Both rows'
      figures therefore land on 22 × 0.577 = 12.7px with a 2 × 0.577 = 1.15px
      stroke. Before this item the glyph row was a 24-unit grid in the same 15px
      box (0.625px per unit), i.e. a 12.5px figure with a 1.25px stroke: the two
      rows were NEAR-EQUAL BY COINCIDENCE of two different frames and two
      different strokes. They are now equal by construction — one frame, one
      painted stroke — which is the parity the owner asked for and the reason the
      fix is a frame change rather than a size tweak.

      THE CHIP BOX STAYS 30×30 (`.chip.ic`): the complaint is the FIGURE's weight,
      not the button's size, so no rule was enlarged. The row still wraps on its
      own — `.chips` is `flex-wrap: wrap` and this row is that class — so six chips
      that no longer fit drop to a second line without a new rule. */
  /* PACKAGE-P §E.1 — the Text section's three option tables. They carry NO art:
     §E.1 specifies a 4-step segmented size control, a 2-button weight toggle and
     a 3-button align row, and `ToggleRow` renders `o.art ?? o.label` — so the
     labels ARE the control, which is also why no glyph had to be invented for
     them. The tables themselves live in `src/textStyle.ts` (one source, shared
     with the harness) and are wrapped here only to satisfy `PickerOption`. */
  const ALIGN_OPTS: PickerOption[] = TEXT_ALIGN_OPTS.map(o => ({v: o.v, label: o.label, art: null}));
  /* ROUND X, ITEM 3 — THE FONT TABLE, AS FOUR SELF-PREVIEWING BUTTONS. It is no
     longer an `IconPickerRow` (trigger + popover): Harvey asked for "4 nút bấm
     chọn cùng 1 hàng nếu đc luôn", so it is now the SAME segmented idiom Size
     and Align use, one row, one control vocabulary in the panel. The app still
     renders zero native `<select>` — `checks/package-p-inspector.mjs` asserts
     that — and each button still previews its own family, which is the whole
     reason a font control is worth having and the thing a `<select>` cannot do.

     `family` here is the CSS stack for the BUTTON'S PREVIEW only. The value that
     reaches the node is the KEY, and the key is resolved to a stack by
     `TEXT_FONT_FAMILY` in `src/textStyle.ts` — one place, not two. */
  /* ROUND Z, ITEM 2 — the three vertical positions. Plain data, same idiom as
     the three tables above: no art, so the label IS the control. */
  /** Crow's-foot vocabulary (§B #9/#10) — IE / IDEF1X notation, drawn. */
  const CROW_END_OPTS: PickerOption[] = CROW_FOOT.map(o => ({
    ...o, art: <ArtCardinality kind={o.v} />,
  }));
  const CROW_START_OPTS: PickerOption[] = CROW_FOOT.map(o => ({
    ...o, art: <ArtCardinality kind={o.v} flip />,
  }));

  /* ---- PACKAGE-P §A.1: THE decision ------------------------------------
     ONE target, built here from the state that already exists, handed to the
     pure function in `src/inspector.ts`. Every branch below then renders from
     the returned ordered list, so the panel's shape is decided in exactly one
     place instead of by three nested ternaries in the render. */
  const inspTarget: InspectorTarget =
    edgeMode || selCount >= 2
      /* ROUND AK, AK-8 — THE CARDINALITY GATE IS READ FROM THE EDGE, NOT THE
         BOARD. `hasCrowFootEnds` asks whether the SELECTED edge carries a
         crow's-foot marker on either end (`isCrowFoot`), so the section appears
         on an edge that HAS cardinality to express and nowhere else — instead of
         appearing on every edge of an ERD board and no edge of any other. The
         multi-select branch carries no single edge, so it is false there; its
         Cardinality rows are meaningless for N edges anyway. */
      ? {kind: 'edge',
         hasCrowFootEnds: edgeMode
           ? (isCrowFoot((selectedEdge?.markerStart as any)?.type)
              || isCrowFoot((selectedEdge?.markerEnd as any)?.type))
           : false}
      : selected?.type === 'table' ? {kind: 'table'}
      : selected?.type === 'label' ? {kind: 'label'}
      : selected
        ? {kind: 'goblin', shape: asShape((selected.data as any).shape),
           body: (((selected.data as any).body ?? 'card') as 'card' | 'label-only')}
        : {kind: 'label'};
  const inspSections = getInspectorSections(inspTarget);
  const {secBody, hasSection, renderSections} = useInspectorSectionRegistry({inspSections, selectedEdge, eFlow, eFlowCount, isCollapsed, toggleSection});
  /** §B #11's preview colour is the node's LIVE outline colour, so the shape
   *  silhouettes recolour with the node exactly as the palette row does. */
  const nodeColor = selected ? resolveColor(selected.data as any) : COLOR_VAR.accent;



  /** PACKAGE-P §E.2 — THE TEXT SECTION'S READER AND WRITER, and the reason they
   *  are a READER and a WRITER rather than one object.
   *
   *  READ (`tsShown`) is what the panel SHOWS: a node with no `textStyle`, or a
   *  field it never set, reads as the inherited value — M, Regular, no swatch,
   *  and the align the TARGET already renders with (`alignForBody`: since
   *  HARVEY 2026-10-22 every text target centres by default, on both axes).
   *  That is why the panel can say "default" in words without a second copy of
   *  the sheet's rules living in JSX.
   *
   *  WRITE (`writeTextStyle`) is what it STORES, and it is the lazy write
   *  (§E.2): choosing the inherited value again stores ABSENCE, so a field
   *  switched back to Default leaves nothing behind and a node the user never
   *  touched keeps `textStyle === undefined`. Same discipline as the colour
   *  swatches below, which write `colorKey` and derive `color` rather than
   *  storing both. `mergeTextStyle` does the decision; this only maps it onto
   *  the node — through `update()` for the selected node, so the write rides the
   *  existing pushHistory-once-per-commit path. The label kind goes through the
   *  SAME `update()`: it is the selected node, exactly as the goblin is. */
  const tsAlignDefault = alignForBody(inspTarget.kind === 'goblin' ? inspTarget.body : undefined);
  /* ROUND Z FIX 2 — the vertical default is read off the SAME target, by the
     same shape of helper. `alignForBody` and `vAlignForBody` are one answer each
     for panel, merge and emitter, so no two of them can describe the box
     differently. */
  const tsVAlignDefault = vAlignForBody(inspTarget.kind === 'goblin' ? inspTarget.body : undefined);
  const tsStored = (selected?.data as any)?.textStyle as TextStyle | undefined;
  const tsShown = readTextStyle(tsStored, tsAlignDefault, tsVAlignDefault);
  const writeTextStyle = (patch: Partial<TextStyle>) => {
    // undefined result means "nothing left to store" — the key is dropped
    // rather than left as an empty object, so `textStyle: undefined` never
    // reaches a board file.
    update({textStyle: mergeTextStyle(tsStored, patch, tsAlignDefault, tsVAlignDefault)} as any);
  };

  /* ROUND AM, AM-2 — THE EDGE TARGET'S READER AND WRITER, and why they are a
     second PAIR of two lines rather than a second implementation.

     The STORED FIELD differs (`data.labelStyle` on an edge, `data.textStyle` on
     a node) and so does the thing the write is applied to (`updateEdge` patches
     the selected EDGE; `update` patches the selected NODE). Everything that
     decides what a choice MEANS is shared: the same `readTextStyle` reads it,
     the same `mergeTextStyle` does the lazy write, and the same
     `TEXT_SIZE_OPTS` / `TEXT_WEIGHT_OPTS` / `TEXT_FONT_OPTS` tables drive the
     rows. A single generic helper would have to take the stored value, the
     setter and the target defaults as parameters and would be LONGER than these
     two expressions while hiding the one fact a reader needs — that a line and a
     node store the same `TextStyle` under two different keys.

     THE ONE HISTORY RULE IS INHERITED, NOT RE-STATED: `updateEdge` pushes once
     per commit exactly as `update` does, so a click on Bold is one undo step.
     That is also why the slider on the flow row needs the `coalesce` option
     while these chips do not — see the note at the speed row in the flow
     section. */
  const edgeLabelStored = (selectedEdge?.data as any)?.labelStyle as TextStyle | undefined;
  const edgeLabelShown = readTextStyle(edgeLabelStored, tsAlignDefault, tsVAlignDefault);
  const writeEdgeLabelStyle = (patch: Partial<TextStyle>) => {
    updateEdge({data: {labelStyle: mergeTextStyle(edgeLabelStored, patch, tsAlignDefault, tsVAlignDefault)}} as any);
  };

  /** PACKAGE-P §E.1 — THE TEXT SECTION'S BODY, written ONCE and registered by
   *  both targets that list the section (`goblin` §A.3 + `label` §E.3). Writing
   *  it twice would be two copies of four controls that must agree; the four
   *  reads all come from `tsShown` and the four writes all go through
   *  `writeTextStyle`, so the only per-target difference is the DEFAULT the read
   *  falls back to — which is already inside `tsShown`.
   *
   *  The colour control is §E.1's own instruction: "reuses the existing colour
   *  swatch row", i.e. the same `swatchRow` the Style section uses, so it
   *  stores a KEY and paints `var(--c-*)`. It is a DIFFERENT field from the
   *  Style section's colour — that one drives the outline, icon, metric and
   *  glow (`--nc`), this one drives the text.
   *
   *  Font family and opacity/fill are deliberately ABSENT (§E.1): one node
   *  already mixes `--mono` and `--sans`, so a single family control would be a
   *  lie, and neither has a DOM analogue. */
  const tsBody = buildTsBody({tsShown, writeTextStyle, ALIGN_OPTS});

  /** ROUND AM, AM-2 — THE EDGE LABEL'S TEXT SECTION: the same three controls,
   *  the same tables, and deliberately not the same FOURTH and FIFTH rows.
   *
   *  WHY IT IS A SEPARATE CONST RATHER THAN A FLAG ON `tsBody`. The two bodies
   *  differ by a RULE, not by a rendering detail: `tsBody`'s colour and align
   *  rows are only meaningful for a target with a padded box and its own ink
   *  control. Threading a `forEdge` boolean through `tsBody` would put "an edge
   *  label is not a box" in the middle of five rows that DO apply, and would
   *  leave the two rows it must skip one `&&` away from coming back — the shape
   *  this project has already paid for. Written out, the omission is the
   *  structure: what is here is what an edge label has.
   *
   *  THE READER AND THE WRITER ARE THE NODE'S, DELIBERATELY. `read` reads the
   *  SAME `data.labelStyle` through the SAME `readTextStyle` (so a stored
   *  multiplier that matches no step lights no step here either, and a legacy
   *  ROUND-W font key reads as the family it already paints), and `write` goes
   *  through the SAME `mergeTextStyle` lazy write (so switching back to the
   *  inherited value stores ABSENCE and a label nobody touched keeps
   *  `labelStyle === undefined`). Those two functions take the two align
   *  defaults as arguments because those defaults are per-target; the pair
   *  passed here is never read, because no align row renders — passing them is
   *  what keeps one merge implementation rather than an edge-shaped copy.
   *
   *  THE THREE ROWS ARE THE SHARED TABLES, NOT COPIES: `SIZE_OPTS`,
   *  `WEIGHT_OPTS` and `FONT_OPTS` are built from `TEXT_SIZE_OPTS` /
   *  `TEXT_WEIGHT_OPTS` / `TEXT_FONT_OPTS`, i.e. the same `src/textStyle.ts`
   *  tables the goblin body renders. So the ladder, the weights and the six
   *  families cannot differ between a node and a line — one vocabulary.
   *
   *  NO COLOUR ROW, and that is a decision with a reason rather than an
   *  omission: the label's colour is `labelTextKey`, rendered as its own `text
   *  color` swatch row in the LABEL section, right above this one. A second
   *  swatch row here would be two controls for one stored fact. */
  const edgeLabelTextBody = buildEdgeLabelTextBody({edgeLabelShown, writeEdgeLabelStyle});

  // ---- M3/S2d: the inspector is DOCKED, like the palette — C4's selection auto-hide is GONE with the
  // `pinned` override it needed: a panel is hidden only when the user collapsed it by hand, so a
  // selection change cannot move either panel and the inspector no longer vanishes (or half-draws) just
  // because the canvas has none. VIEW-MODE CHROME — in review a panel is hidden unless the viewer
  // transiently revealed it (never persisted); in edit mode it is the persisted collapse, and everything
  // below (hiddenRef, the `.app` classes, the chevrons) reads this, so the chrome describes what the eye
  // sees. CODE-RAIL-WIDTH adds ONE more TRANSIENT layer to the inspector only (an open rail borrows its space — railPanel.ts, never persisted), so closing the rail restores the chosen layout.
  const leftHidden = panelHiddenFor(readOnly, reviewReveal, panelState, 'left');
  const rightHidden = railPanel.rightHidden(readOnly, reviewReveal, panelState);

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
  // Read by the global keydown handler (registered in useKeyboardShortcuts, below), which must not
  // re-register on every drawer open/close — same reason `hiddenRef` exists.
  const overlayRef = useRef<'left' | 'right' | null>(null);
  overlayRef.current = overlay;
  // A rotation or a tier change closes whatever was open: a drawer cannot stay
  // open across a layout that no longer has drawers.
  useEffect(() => { setOverlay(null); }, [overlayMode, pngScale, pngPad]);
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
    overlayMode !== null ? overlayRef.current === side : !(side === 'left' ? leftHidden : rightHidden);
  // ---- keyboard shortcuts ---- (moved VERBATIM to src/hooks/useKeyboardShortcuts.ts —
  // APP-SPLIT S6; the binding table in that module's header is the acceptance contract.
  // The call sits BELOW hiddenRef/isPanelVisible: the ctx reads them at render time, and a const read above its declaration is a TDZ throw the old closure never hit.
  useKeyboardShortcuts({
    undo, redo, copySelection, pasteClipboard, duplicateSelection, nudge, setNodes,
    setEdges, setSettingsOpen, setSearchPos, setHelp, setBoardsOpen, settingsOpen,
    searchPos, help, boardsOpen, boardDlg, tgOpen, historyOpen, escapeGroup, canvasLock,
    groupSelection, ungroupSelection, toggleLockSelection, setPanelsVisible, togglePanel,
    readOnly, codeStale, toggleReadOnly, sel, selCount, nodesRef, setTitleEdit, toggleCode,
    railPanel, hiddenRef, isPanelVisible, revealPanel, revealPanels, rotateSelection, rf, searchRef,
  });

  const panelToggle = (side: 'left' | 'right') => {
    const hidden = side === 'left' ? leftHidden : rightHidden;
    const label = side === 'left' ? 'left panel' : 'inspector';
    // PACKAGE-Q. Two different spellings of the same physical key, deliberately:
    //   * the DISPLAY chord is what the user reads on the chips below;
    //   * `aria-keyshortcuts` takes the ARIA token spelling of the key the
    //     handler matches on (`BracketLeft`/`BracketRight`), never a glyph and
    //     never the shifted character.
    // The chord itself mirrors the handler: Cmd+Ctrl+Shift on macOS, and the
    // shipped Ctrl+Shift form elsewhere (no Cmd key exists there).
    const macPlatform = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
    const sideKey = side === 'left' ? 'BracketLeft' : 'BracketRight';
    const sideGlyph = side === 'left' ? '[' : ']';
    const ariaChord = `${macPlatform ? 'Meta+Control' : 'Control'}+Shift+${sideKey}`;
    // M3/S4+S5: in a drawer/sheet layout this same control is the overlay
    // OPENER, not the collapse flag. The chevron keeps pointing the way it
    // always did and the Step 2 collapse flag is left completely alone, so a
    // tablet never rewrites the desktop layout the user configured.
    const isOverlay = overlayMode !== null;
    const ovOpen = overlay === side;
    // The tooltip's ACTION text, which is also the accessible name. `aria-label`
    // is NOT replaced by the tooltip: assistive tech gets the name here, and the
    // chord through `aria-keyshortcuts`, whether or not a popover is visible.
    const action = isOverlay
      ? overlayTitle(side, ovOpen, overlayMode ?? 'drawer')
      : `${hidden ? 'Expand' : 'Collapse'} ${label}`;
    // left: collapse points left (outward), expand points right (inward).
    // right: mirrored.
    const Icon = side === 'left'
      ? (hidden ? ChevronRight : ChevronLeft)
      : (hidden ? ChevronLeft : ChevronRight);
    const button = (
      <button
        type="button"
        className={`panel-toggle${hidden && !isOverlay ? ' hidden' : ''}`}
        data-panel-toggle={side}
        data-overlay-toggle={isOverlay ? overlayMode : undefined}
        aria-label={action}
        aria-expanded={isOverlay ? ovOpen : !hidden}
        // No chord while this control opens an overlay: no keyboard shortcut
        // opens a drawer or a bottom sheet, and advertising one here would be a
        // promise the handler does not keep.
        aria-keyshortcuts={isOverlay ? undefined : ariaChord}
        onClick={() => {
          if (isOverlay) { openOverlay(side); return; }
          // VIEW-MODE CHROME — review: transient reveal; edit: persisted writer.
          // CODE-RAIL-WIDTH — with the rail open the inspector's visibility is ITS transient layer (never a `diagram-studio:panels` write), so the persisted layout survives the rail closing.
          if (readOnly) revealPanel(side); else if (side === 'right' && railPanel.active) railPanel.toggle(); else togglePanel(side);
        }}
      >
        <Icon size={14} />
      </button>
    );
    // Keys render as `kbd` chips, gestures as plain text — the app's rule. The
    // overlay tier keeps its plain-text tooltip and carries NO chord.
    if (isOverlay) return button;
    return (
      <Tooltip
        label={
          <>
            {action} <span className="tt-keys">
              <kbd>{macPlatform ? '⌘' : 'Ctrl'}</kbd>
              {macPlatform && <kbd>⌃</kbd>}
              <kbd>⇧</kbd><kbd>{sideGlyph}</kbd>
            </span>
          </>
        }
      >
        {button}
      </Tooltip>
    );
  };

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
            <img className="brand-mark" src="/brand/icon-g.svg" alt="" width={16} height={16} aria-hidden="true" />Gobigrams
          </div>
          <div ref={boardsBtnRef} style={{position: 'relative', marginTop: 10}}>
            {/* CONFIG-FIX (2026-10-22) — HARVEY: the hover tooltip covered the
                freshly-portal'd popover (it opens right beside this button), so
                the Tooltip wrapper is GONE; the button keeps its aria-label. */}
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
            {/* ITEM B (2026-10-22) — the popover is PORTAL'D TO BODY and
                position:fixed (Tooltip.tsx:205 precedent): `.panel` clips at
                232px (overflow:hidden), so the redesigned 360px popup could
                never render inside the head. The inline style carries the
                anchor computed in `boardsPopClamp` (left = button right + 6,
                top = button top, max-width = viewport − anchor − 8). */}
            {/* GOBI-S1 — the popover JSX lives in src/components/BoardsPopover.tsx. */}
            <BoardsPopover
              open={boardsOpen}
              pos={boardsPopPos}
              modeLabel={modeLabel}
              localMode={localMode}
              storageEstimate={storageEstimate}
              boardList={boardList}
              curBoard={curBoard}
              onOpenBoard={id => void openBoard(id)}
              onClose={() => setBoardsOpen(false)}
              onNewBoard={() => { setBoardsOpen(false); newBoard(); }}
              onTemplates={() => { setBoardsOpen(false); openTemplates(); }}
              onRename={() => { setBoardsOpen(false); renameBoard(); }}
              onHistory={openHistory}
              onDuplicate={() => { setBoardsOpen(false); void doDuplicateBoard(); }}
              onDelete={() => { setBoardsOpen(false); deleteBoard(); }}
              onSaveNow={() => { setBoardsOpen(false); saveNow(); }}
            />
          </div>
          <div className={`save-ind${saveState === 'saving' ? ' busy' : ''}${saveState === 'error' ? ' err' : ''}`} aria-live="polite">
            {saveState === 'saving' ? 'saving…' : saveState === 'saved' ? 'saved' : saveState === 'error' ? 'save failed' : (dirty && !autosave ? 'unsaved' : '')}
          </div>
        </div>
        <LibraryBody
          favourites={favourites}
          shapes={shapes}
          toggleFavourite={toggleFavourite}
          removeFavourite={removeFavourite}
          isStarred={isStarred}
          addFavouriteFromSelection={addFavouriteFromSelection}
          insertFavourite={insertFavourite}
          insertCustomShape={insertCustomShape}
          removeCustomShape={removeCustomShape}
          importInputRef={importInputRef}
          openShapeImport={openShapeImport}
          onImportInputChange={onImportInputChange}
          shapeZoneDragOver={shapeZoneProps.onDragOver}
          shapeZoneDrop={shapeZoneProps.onDrop}
          query={query}
          setQuery={setQuery}
          presetId={presetId}
          selCount={selCount}
          searching={searching}
          searchRef={searchRef}
          isCategoryOpen={isCategoryOpen}
          toggleCategory={toggleCategory}
          defaultOpen={defaultOpen}
          librarySections={librarySections}
          searchGroups={searchGroups}
          addNodeByLabel={addNodeByLabel}
        />
      </aside>

      {/* CENTER — canvas */}
      <main
          className="canvas-wrap" data-style={tableStyle} data-density={tableDensity} data-locked={canvasLock || undefined}
          ref={wrap}
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}>
        {/* GOBI-S1 — the share view's banner (or its error card) sits above
            the toolbar: a fragment-owned board announces itself read-only and
            offers the ONE exit. Nothing renders when no fragment is present. */}
        {(shareDoc || shareError) && (
          <ShareBanner
            mode={shareError ? 'error' : 'viewing'}
            boardName={shareDoc?.name ?? ''}
            reason={shareError ?? undefined}
            onEditCopy={editCopy}
            onOpenApp={dismissError}
          />
        )}
        {/* ROUND BN-3 PHASE B: toolbar + selection bar live in Toolbar.tsx; App threads every prop. */}
        <Toolbar
          canUndo={canUndo}
          canRedo={canRedo}
          lock={canvasLock}
          onUndo={() => { if (canvasLock) return; undo(); }}
          onRedo={() => { if (canvasLock) return; redo(); }}
          onFitView={() => rf?.fitView({padding: 0.25})}
          readOnly={readOnly}
          onToggleReadOnly={toggleReadOnly}
          shareLock={!!shareDoc}
          alignGuides={alignGuides}
          onSetAlignGuides={setAlignGuides}
          onSetGuides={setGuides}
          snap={snap}
          onSetSnap={setSnap}
          onPushHistory={pushHistory}
          onSetNodes={setNodes}
          gridSize={gridSize}
          onDuplicate={() => duplicateSelection()}
          onAutoLayout={autoLayout}
          onOpenExport={() => openDoor('export')}
          onOpenShare={() => openDoor('share')}
          exportBtnRef={exportBtnRef}
          shareBtnRef={shareBtnRef}
          settingsOpen={settingsOpen}
          onOpenSettings={setSettingsOpen}
          codeOpen={codeOpen}
          onToggleCode={toggleCode}
          settingsBtnRef={settingsBtnRef}
          selCount={selCount}
          onAlign={align}
          onDistribute={distribute}
          onDelete={deleteSelection}
          sep={sep}
        />

        {notice && <div className="toast">{notice}</div>}

        {/* H2: getting-started checklist; its state and auto-hide live in Checklist.tsx. */}
        <Checklist done={checklistDone} dismissed={checklistDismissed} onDismiss={dismissChecklist} />

        {/* ONBOARD-P5 — the one-line tip; a tip shows once EVER and at most one
            per session (the gates live in src/ui/tips.ts), so `tip` is usually
            null and nothing renders. */}
        {tip && <TipToast line={tip.line} onDismiss={dismissTip} />}

        {/* F2: context menu (node / edge / pane right-click) */}
        {ctx && (
          <ContextMenu
            target={ctx}
            onAction={a => ctxAction(a, ctx)}
            onClose={() => setCtx(null)}
            menu={ctx?.kind === 'node' ? menuState : undefined}
          />
        )}

        {/* C5: zoom pill — inside ReactFlow so useStore resolves; absolute vs the .react-flow container. */}
        {/* D2: keyboard cheat sheet — lives in src/components/HelpSheet.tsx; App threads the open state, refs and the feedback opener. */}
        <HelpSheet
          btnRef={helpBtnRef}
          popRef={helpRef}
          open={help}
          onToggle={() => setHelp(h => !h)}
          onSendFeedback={() => { setHelp(false); feedbackReturn.current = helpBtnRef.current; setFeedbackOpen(true); }}
          canRestoreChecklist={checklistDismissed && !isChecklistComplete(checklistDone)}
          onRestoreChecklist={() => { setHelp(false); restoreChecklist(); }}
        />

        {/* D1: searchable insert palette */}
        {searchPos && (
          <SearchPalette
            items={LIBRARY}
            onInsert={insertFromSearch}
            onClose={() => setSearchPos(null)}
          />
        )}

        {/* ROUND BN-3 PHASE B: the modal mounts (BoardDialog, gallery, Settings, FeedbackDialog, ExportModal, ShareDialog + JSON input) live in ModalMounts.tsx; App computes every prop. */}
        <ModalMounts
          boardDlg={boardDlg}
          curBoardName={curBoard?.name ?? ''}
          onCancelBoardDlg={closeBoardDlg}
          onSubmitBoardDlg={onBoardDialog}
          returnFocusTo={boardsMenuBtnRef}
          nextUntitledName={boards.nextUntitledName(boardList.map(b => b.name))}
          onBrowseTemplates={(name) => { pendingBoardName.current = name; setBoardDlg(null); setTgOpen(true); }}
          tgOpen={tgOpen}
          onCloseGallery={closeGallery}
          onUseTemplate={useTemplate}
          historyOpen={historyOpen}
          onCloseHistory={closeHistory}
          historyBoard={curBoard}
          onRestored={applyBoard}
          settingsOpen={settingsOpen}
          onCloseSettings={() => setSettingsOpen(false)}
          settingsProps={{
            mode,
            onMode: chooseMode,
            resolved: theme,
            noCycles,
            onNoCycles: setNoCycles,
            oneIn,
            onOneIn: setOneIn,
            dblConnect,
            onDblConnect,
            dblRange,
            onDblRange,
            gridSize,
            onGridSize,
            alignGuides,
            onAlignGuides: setAlignGuides,
            animate,
            onAnimate: toggleAnimate,
            highlight,
            onHighlight: toggleHighlight,
            marquee: marqueeMode,
            onMarquee: setMarqueeMode,
            zOrder: zOrderMode,
            onZOrder: setZOrderMode,
            layoutDir,
            onLayoutDir: setLayoutDir,
            tableStyle, tableDensity, onTableStyle: setBoardStyle, hasBoard: !!curBoard,
            pngScale,
            onPngScale,
            pngPad,
            onPngPad,
            autosave,
            onAutosave,
            returnFocusTo: settingsBtnRef,
            boardPng: nodes.length ? boardPngForFeedback : null,
            onOpenFeedback: openFeedback,
          }}
          feedbackOpen={feedbackOpen}
          onCloseFeedback={() => setFeedbackOpen(false)}
          feedbackReturn={feedbackReturn}
          boardPng={nodes.length ? boardPngForFeedback : null}
          expOpen={expOpen}
          onCloseExport={() => setExpOpen(false)}
          exportReturn={exportBtnRef}
          shareOpen={shareOpen}
          onCloseShare={() => setShareOpen(false)}
          shareReturn={shareBtnRef}
          onExported={() => { tickTask('export'); fireTip('export'); }}
          nodes={nodes}
          edges={edges}
          liveTheme={theme}
          boardName={curBoard?.name}
          selCount={selCount}
          buildSvg={buildSvg}
          buildPng={buildPng}
          printPdf={printPdf}
          fileRef={fileRef}
          onImportFile={onImportFile}
          importFileMsg={importFileMsg}
        />

        {/* J: Excalidraw-style canvas navigation — plain LEFT-drag box-selects
            (see `selectionOnDrag`), Shift+drag box-selects from a node too,
            middle/right drag + Space+drag pan, plain scroll pans, Ctrl/Cmd+scroll
            zooms. ROUND AA, ITEM 2 — the marquee's mode is `selectionMode` below,
            from Settings → Canvas → Marquee selection. */}
        {/* K1: ds-flow-wrap scopes the hover-choreography + perf-guard classes to
            THIS instance. K3: ds-animating-layout / ds-no-anim gate animations. */}
        <ReactFlow
          nodes={rfNodes} edges={rfEdges} /* badge hidden 2026-10-25; credit -> About */ proOptions={{hideAttribution: true}}
          onNodesChange={handleNodesChange} onEdgesChange={handleEdgesChange}
          onConnect={onConnectRules}
          onConnectStart={(_e, params) => { if (params.nodeId) { pendingDrop.current = {source: params.nodeId!, target: '', sourceHandle: params.handleId, targetHandle: null} as any as Connection; connectOrigin.current = {nodeId: params.nodeId!, handleId: params.handleId}; } }}
          onConnectEnd={onConnectEnd}
          onReconnect={onReconnect}
          // Q: gated exactly like the three element-touching props below, so
          // review mode has ONE source of truth for "nothing on the canvas can
          // be changed": the update anchors render whenever this prop is truthy
          // and are NOT read-only aware, so without the gate a locked user
          // could still rip a wire off a node. Prop false = RF renders no
          // `EdgeUpdateAnchors` at all — the gesture is absent, not inert.
          edgesReconnectable={!canvasLock}
          reconnectRadius={RECONNECT_RADIUS}
          // B2: every connection point is usable in BOTH directions — Loose
          // lets a drag run source→source or target→target on one point;
          // Strict would make each corner work only one way round.
          connectionMode={ConnectionMode.Loose}
          nodeTypes={nodeTypes} onNodeClick={onLogicalClick} onNodeDoubleClick={readOnly ? undefined : onLogicalDblClick} /* GROUP-LOGICAL grammar (t_eb8fab7e); UNISURF-S6 pendKey rides onLogicalClick; GROUP-BOUNDARY-INSIDE: view mode cannot enter */
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
            // K — DEFECT 3: the ONE hook the mode-specific CSS hangs off —
            // the flow wrapper, not `.app`. Same shape as NO_ANIM above.
            canvasLock ? READ_ONLY : '',
          ].filter(Boolean).join(' ')}
          // K — DEFECT 2 / 3: bind React Flow's node-wrapper class to the SAME
          // token the CSS and this file already use. In review mode that token
          // is what RF reads back (`event.target.closest('.nopan')` in its
          // pan-zoom filter) to refuse a pan whose gesture began on a node.
          // Outside review mode `undefined` hands the decision back to RF's own
          // default, so edit mode is what it was and drags are untouched.
          noPanClassName={canvasLock ? NO_PAN : undefined}
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          deleteKeyCode={canvasLock ? null : ['Delete', 'Backspace']}
          /* Part B: every element-touching gesture off through RF's OWN props
             (review mode AND UNISURF-S4 stale, via canvasLock). Pan stays on.
             BADGE-ON-SELECT (t_e1ad9237): `elementsSelectable` now keyed on
             codeStale ALONE — review mode allows SOLE selection so the desc
             badge can reveal (Harvey reads descriptions in review too).
             UNISURF-S4's own contract is kept by construction: the marquee
             stays off (selectionOnDrag false below), the ctx menu returns on
             readOnly, the per-node resizers are gated off the injected
             `readOnly`/`__review` tokens (CHROME-ABOVE: the grip/badge live
             in NodeChrome now, gated there), and onSelectionChange below
             keeps the inspector/palette chrome blind to a review selection. */
          nodesDraggable={!canvasLock}
          nodesConnectable={!canvasLock}
          elementsSelectable={!codeStale}
          /* CONFIG ROUND (2026-10-23) — the LIVE prop follows the Setting
             (Canvas → Layer display). 'manual' = paint order is the stored
             zIndex, WYSIWYG; 'basic' = the library's select-raises default. */
          zIndexMode={zIndexMode}
          snapToGrid={snap}
          snapGrid={[gridSize, gridSize]}
          onNodeDragStart={(e, node, nodesAll) => { startInteraction(); onNodeDragStartAll(e, node); void nodesAll; }}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={(e, node, nodesAll) => { endInteraction(); onNodeDragStop(e, node); void nodesAll; }}
          onNodeContextMenu={(e, node) => {
            e.preventDefault();
            if (readOnly) return;
            /* GROUP-OBJECT+LOCK v1 — right-click SELECTS its node (Miro/Figma convention): menu rows act on what was clicked. */
            if (!node.selected) setNodes(ns => ns.map(n => ({...n, selected: n.id === node.id})));
            setCtx({kind: 'node', id: node.id, x: e.clientX, y: e.clientY});
          }}
          onEdgeContextMenu={(e, edge) => {
            e.preventDefault();
            if (readOnly) return;
            setCtx({kind: 'edge', id: edge.id, x: e.clientX, y: e.clientY});
          }}
          /* ROUND AK, AK-13 — a double-click on the connector creates a label at
             that point (or, when it landed on the existing label, the label's own
             handler has already caught it — see `onEdgeDoubleClick`). */
          onEdgeDoubleClick={onEdgeDoubleClick}
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
            /* AQ18 — raw client coords (see the palette onDrop note): the extra
               wrap subtraction landed the search palette up-left of the click. */
            setSearchPos(rf.screenToFlowPosition({x: e.clientX, y: e.clientY}));
          }}
          onSelectionChange={({nodes: s, edges: se}) => {
            /* BADGE-ON-SELECT (t_e1ad9237): under the canvas lock a selection
               still happens (review's desc door) but drives NO App chrome —
               inspector target, favourites, multi-select panels and code rail
               all read sel/selCount, so this ONE seam keeps them blind.
               IGNORE, never CLEAR: a pre-lock selection keeps its inspector
               open (UNISURF-COMMIT C5f — stale keeps it, writes refused);
               entering review clears it itself (S10). The badge reads RF's own
               `selected` prop. COUNT = the VISIBLE selection (LOCK-COUNT
               t_b3079954): `s` carries the null-rendering logical-group binder,
               never counted — see nodeLock.visibleSelected. */
            if (!canvasLock) { const v = visibleSelected(s); setSel(v[0]?.id ?? null); setSelCount(v.length); }
            setSelEdgeId(se.length === 1 ? se[0].id : null);
            /* HL-GATE (owner override 2026-11-20) — the option gates the
               selection PAINT too (read-only keeps its free lighting); the
               canvasLock guard above only blinds App chrome, not the painter. */
            applySelection(s);
          }}
          fitView fitViewOptions={fitOpts}
          minZoom={0.2} maxZoom={2.5}
          // M3/S3.7 — KEEP false. React Flow's own warning: double-click zoom
          // bypasses the gesture filter entirely (no `isWrappedWithClass` guard
          // on `dblclick.zoom`, unlike `wheel`/`pointerdown`), so leaving it on
          // would fire `dblclick.zoom` on the current selection. Double-tap is
          // also our insert palette via the `onDoubleClick` handler below.
          zoomOnDoubleClick={false}
          // M3/S3.2 — KNOWN REACT FLOW TRAP, do not "simplify" this back to a
          // bare button array. `panOnDrag`'s array form constrains the MOUSE
          // only. Pane's own `onPointerDownCapture` (dist/esm/index.js:1481)
          // early-returns for `event.pointerType === 'touch'` whenever
          // `panOnDrag !== false` and no selection key is held — so a finger
          // can never reach the `selectionOnDrag` branch. DECISION: on a coarse
          // pointer one finger on the empty pane PANS (what a mobile user
          // expects); two fingers pan + pinch-zoom via `zoomOnPinch`. Box-select
          // therefore stays a mouse-only gesture (left-drag) or an explicit
          // Shift-drag on a hybrid device.
          //
          // ROUND AA, ITEM 2 — THE GESTURE ARRANGEMENT, RESTATED, and it is
          // UNCHANGED: `panOnDrag` is still `[1, 2]` in edit mode, so a plain
          // LEFT-drag (button 0) is NOT a pan; `selectionOnDrag={!readOnly}`
          // is what claims button 0 on the empty pane and draws the marquee.
          // Panning stays on middle/right drag plus `panOnScroll` (free, both
          // axes) and Space-drag. Left-drag PAN was never the behaviour and is
          // still not: making it so would trade Harvey's box-select for a pan
          // he did not ask for.
          //
          // `panOnDrag` is `!== false` in BOTH branches, which is what keeps
          // the touch path alive: on a finger, `onPointerDownCapture` takes the
          // early return at :1481 BEFORE the `isSelectionActive` test at :1491,
          // so the gesture falls through to the pan-zoom filter and one finger
          // pans. `readOnly ? true : [1, 2]` never changes that — `true` and a
          // two-element array are both `!== false`.
          //
          // READ-ONLY BRANCH — do NOT collapse this ternary back to a literal
          // array. In review mode `selectionOnDrag` is `false` AND the array
          // form here would exclude button 0, so a plain LEFT-drag on the pane
          // would match no branch at all and be a DEAD gesture (measured defect:
          // the viewport does not move). Harvey's ask was literally a
          // back-and-forth left-drag that touches no element, so in review mode
          // ANY button pans: `true`. Outside review mode the value is still
          // `[1, 2]`. A left-drag here can never select: selection needs
          // `elementsSelectable` to be true (see `elementsSelectable={!readOnly}`
          // above), so no box-select / node toolbar / resize handle can appear.
          panOnDrag={canvasLock ? true : [1, 2]}
          selectionOnDrag={!canvasLock}
          // ROUND AA, ITEM 2(a)/(b) — THE MARQUEE MODE. React Flow's own default
          // is `SelectionMode.Full` (`@xyflow/system`: `enum SelectionMode {
          // Partial = 'partial', Full = 'full' }`), and `Pane` passes
          // `selectionMode === SelectionMode.Partial` as `getNodesInside`'s
          // `partially` flag — so with no prop the marquee had to CONTAIN a node
          // to select it. That was the measured defect: a box missing 60px on a
          // node's right edge, or covering only its left half, selected nothing.
          // The prop now READS THE SETTING (`useMarqueeMode` above), whose
          // no-write default is `touch` -> `SelectionMode.Partial` (overlap),
          // matching Figma / Excalidraw / draw.io / tldraw. Changing the setting
          // re-renders this prop live; no reload.
          selectionMode={selectionMode}
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
              load in flight from claiming an empty board over a canvas whose
              content is merely still on its way.
              ROUND BN-3 PHASE B: the panel body lives in
              src/components/CanvasEmptyPanel.tsx; the GATE stays here
              (boot-no-flash pins it to App.tsx). */}
          <CanvasEmptyPanel
            show={boardLoaded && nodes.length === 0}
            onBrowseTemplates={openTemplates}
          />
          {/* ROTATE-FIX: hands the store's updateNodeInternals up (the hook
              needs a provider ancestor; App is above <ReactFlow>). */}
          <RotateInternalsBridge onReady={u => { rotateInternals.current = u; }} />
          {/* DA-2: every open description panel (an ordered id set — a
              <ReactFlow> child so it can read the store). PANEL-SOLID: the
              theme prop re-derives the opaque paint/ink on a theme switch
              (the memo'd coordinator's store does not hear theme changes). */}
          <DescPanels theme={effectiveTheme} />
          {/* CHROME-ABOVE (t_31a9bec9, 2026-11-13): the selected node's ⓘ
              badge in ONE popover host in the browser's TOP LAYER — a stored
              z-index can be any number, so paint order must not be arithmetic.
              SEL-CHROME-UNIFY (t_e479c12d): the grip and lock moved to the
              selection pill below. A <ReactFlow> child: reads the store. */}
          <NodeChrome />
          {/* READONLY-DOT (t_c1564804): the read-only rest cue — a 5px inert dot at a desc card's top-right, ONLY in read-only (Shift+2 and
              the #b= share view ride this same `readOnly` state; `codeStale` keeps every affordance on screen
              and refuses the write, it is not a viewer mode). A <ReactFlow> child: it reads the store's nodes/zoom;
              never in edit mode (the badge is enough there). */}
          <DescDotLayer on={readOnly} />
          {/* SEL-CHROME-UNIFY (t_e479c12d, 2026-11-19): the ONE pill of every selection — 1 node and N,
              [rotate][group|ungroup][lock] since PILL-ORDER (t_1270c161), centred on the frame's top edge, flipping inside near the top (SEL-CHROME-B
              geometry). The group verb is the MENU-STATES swap (menuState — the same derivation the context menu reads);
              a solo selection rotates through the per-node writer. Read-only gets no pill. */}
          {!readOnly && selCount >= 1 && (
            <GroupRotateGrip onGesture={onGroupRotateGesture} onSoloGesture={onRotateGesture}
              onLockToggle={toggleLockSelection} onGroup={groupSelection} onUngroup={ungroupSelection} menu={menuState} />
          )}
          {/* SELBOX: the app's rotation-aware multi-selection box — RF's own rect unions UNROTATED internals (no override prop)
              and lags a rotated group; ours unions rotatedExtent in RF's selection vocabulary; RF's rect is paint-hidden (styles.css), paint-only. */}
          {/* GROUP-BOUNDARY-INSIDE (t_42fb2888): the quiet INSIDE boundary rides SelectionBox — already an RF store holder, so the instance closed set does not grow. */}
          {(selCount >= 2 || (!!insideId && !readOnly)) && <SelectionBox ctxGroupId={insideId ?? undefined} />}
          {/* GROUP-GAP-DRAG t_10563e73: the D1 amendment — while a logical block is selected, its painted frame is the object's own drag surface (below every member, above the pane). */}
          {!readOnly && <GroupGapDrag threshold={ui.isTouchScreen ? COARSE_DRAG_THRESHOLD_PX : FINE_DRAG_THRESHOLD_PX} onGesture={onGapDragGesture} />}
          {/* F3: helper lines. `HelperLinesView` portals itself into React Flow's viewport (`ViewportPortal`), so it must stay a direct
              child of <ReactFlow> — it does its own flow-coord placement there. */}
          {(guides.vertical || guides.horizontal) && <HelperLinesView guides={guides} />}
          <Controls showInteractive={false} />
          <ZoomPill rf={rf} />
          <MiniMap
            pannable zoomable
            style={{background: 'var(--surface)', border: '1px solid var(--border)'}}
            maskColor="var(--minimap-mask)"
            nodeColor={n => resolveColor(n.data as any)}
          />
        </ReactFlow>
        {/* UNISURF-S3 — the code pane shell: rail by default, the mirror
            generated inside CodePane (lazy). S4: commit-on-input + stale. */}
        <CodePane open={codeOpen} onToggle={toggleCode} name={curBoard?.name ?? 'board'} nodes={nodes} edges={edges}
          stale={codeStale} onCommit={onCodeCommit} onTypingEnd={onCodeTypingEnd} pending={pendKey} onCaret={k => { setHlKey(k); setPendKey(null); }} />
        {/* UNISURF-S4 — the canvas's own stale banner (spec §4.3). */}
        <StaleBanner stale={codeStale} />
      </main>

      {/* RIGHT — inspector */}
      <aside className="panel right">
        <div className="panel-head">
          <div className="sec-label" style={{margin: 0}}>Inspector</div>
        </div>
        <div className="panel-body">
          {edgeMode ? (
            <>
              {/* ROUND Y, ITEM 3 — THE `edge` BADGE IS GONE. It stated the KIND
                  of the selection, and the sections underneath now state it
                  better: Label / Line / Markers (+ Cardinality on an ERD, then
                  Flow) is a vocabulary NO node target renders (a goblin gets
                  Content / Text / Style, a table Table / Columns / Show mode).
                  A badge that repeats what the body below it already proves is
                  a row of the panel spent on nothing, so the badge AND its
                  trailing 12px spacer are both deleted — the spacer's only
                  tenant was the badge. */}
              {(() => { secBody('label', <>
                <div className="field">
                  <label>label</label>
                  <input
                    value={(selectedEdge!.label ?? '') as string}
                    placeholder="arrow name"
                    onChange={e => updateEdge({label: e.target.value})}
                  />
                </div>
                {/* ROUND AK, AK-8 — THE `intent label` BLOCK IS DELETED, WITH ITS
                    REASON. It was gated on `preset.edges.labelPresets?.length`,
                    i.e. on the BOARD's preset, so the row appeared on a C4 or
                    flowchart board and vanished elsewhere — regardless of which
                    edge was selected. Harvey asked exactly this ("tại sao sidebar
                    của line lại khác nhau ở mỗi type?"); the gate is gone AND the
                    field is gone, so there is no board-level fact left to key it
                    on. The `technology` input below STAYS: `technField` is a
                    different field with a live consumer (`GoblinEdge` renders
                    `d.techn` as a dim second line), and it is not a label list. */}
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
                {/* ROUND AK, AK-3 — THE `label position` FIELD IS DELETED, WITH
                    ITS REASON. It offered a 3-button preset (center / start /
                    end) for a value the panel was ALREADY able to set by drag,
                    which is the confusion to avoid: draw.io ships a 9-way
                    `Position` dropdown that its own renderer IGNORES for edges
                    (its manual concedes it anchors to the diamond, not the
                    connector). Centre is reachable by dragging near the middle,
                    so the preset list carried no capability the drag did not.

                    THE STORED FIELD IS UNTOUCHED. `data.offset` is still read by
                    `GoblinEdge.tsx:383`, so a board that already carries
                    `start`/`end` renders exactly as it did — this deletes the
                    CONTROL, not the value. (`pass 2 / AK-10 replaces the preset
                    with the free 2-D drag the field was duplicating.) */}

                {/* ROUND AK, AK-12 — THE LABEL PLATE, TWO ROWS: the control and
                    the reset.

                    THE CONTROL IS A FLAT 3-OPTION ROW, not a popover: three
                    options ≤ the cited threshold of 4 (the AK-6 note above), and
                    the kit's `ToggleRow` is the existing control — no new
                    component was invented. `None` is a real stored value here
                    (decision D2), which is why the table lists it rather than
                    expressing "no plate" as the absence of the key.

                    WHY A CLASS AND NOT A COLOUR. The renderer writes
                    `labelBgClass(...)` onto `.edge-label`, so the three states
                    are three rules in the sheet — no hex enters either file, and
                    a theme change repaints all three for free. React Flow's own
                    `labelBgStyle` would have been the wrong mechanism: it is
                    `EdgeText`'s SVG-`<rect>` API, and this label is a DOM `<div>`
                    through `EdgeLabelRenderer`. */}
                <div className="field">
                  <label>text color</label>
                  {swatchRow(eLabelTextKey, k => updateEdge({data: {labelTextKey: k}}))}
                </div>
                <div className="field">
                  <label>background</label>
                  {chipRow(LABEL_BG_OPTS, eLabelBg,
                    v => updateEdge({data: {labelBg: v as any}}), 'Label background')}
                </div>
                {/* AL-3 — the plate's COLOUR, shown only when there IS a plate.
                    At `none` there is nothing to colour, so the row is absent
                    rather than present-and-inert — the same rule the panel
                    applies to `count`/`speed` (AL-7). */}
                {eLabelBg !== 'none' && (
                  <div className="field">
                    <label>background color</label>
                    {swatchRow(eLabelBgKey, k => updateEdge({data: {labelBgKey: k}}))}
                  </div>
                )}
                {/* ROUND AK, AK-14.1 — `Reset label position`, ONE history step,
                    and a BUTTON rather than a right-click or a double-tap. Those
                    are desktop idioms: the double-tap already means "edit label"
                    after AK-13, and Miro had to add a separate touch variant of
                    its own reset, which is the tell that the desktop form does
                    not travel. Disabled while the label is already centred —
                    there is nothing to reset, and a step that changes nothing
                    must not push a history entry (`onCommitLabel`'s rule). */}
                <div className="field">
                  <button
                    type="button"
                    className="chip act"
                    disabled={!eLabelMoved}
                    title={eLabelMoved
                      ? 'Put the label back on the line’s centre (one undo step)'
                      : 'The label is already centred'}
                    onClick={resetLabelPos}
                  >
                    Reset label position
                  </button>
                </div>
              </>); return null; })()}
              {(() => { secBody('line', <>
                <div className="field">
                  <label>stroke color</label>
                  {swatchRow(
                    eStrokeKey,
                    setEdgeColor,
                    /* ROUND AO, AO-1c — the edge literal, stored on `data.color`
                       with `strokeKey` cleared and BOTH markers recoloured to the
                       literal (see `edgeColorLiteralPatch`). `resolveColorKey`
                       returns `null` for an arbitrary hex, so no hue lights and the
                       custom cell takes the ring. A literal cannot follow a theme —
                       that is stated in the code, not worked around. */
                    {value: (selectedEdge?.data as any)?.color, onPick: setEdgeColorLiteral},
                  )}
                </div>
                {/* ROUND AK, AK-6 — ONE FULL-WIDTH FLAT ROW PER CONTROL.

                    WAS: `stroke width` and `line style` inside a shared
                    `.field-row` (a 2-column grid, so each control got half the
                    panel), and `curvature` a lone `IconPickerRow` trigger +
                    popover. NOW: each owns its own `.field`, and each is a flat
                    `ToggleRow` — the existing control kit, not a new control.

                    WHY A ROW AND NOT A POPOVER — THE THRESHOLD, CITED.
                    tldraw states it in source: `items.length > 4 ? Grid : Row`
                    (`StylePanelButtonPicker.tsx#L152`), and Excalidraw behaves
                    identically (flat rows for 3-4, a popover for its 9-marker
                    set). MEASURED option counts here, not assumed:
                    `line style` 3, `curvature` 4 — both flat rows, as the rule
                    says. `stroke width` is 5 (`[1, 1.5, 1.8, 2, 3]`), so it is
                    the ONE set above the cited threshold; it is kept as a row
                    because the row still measures clean — 5 cells over the 253px
                    field with 5px gaps is a `(253 - 4*5) / 5 = 46.6px` cell and a
                    `46.6 - 16 - 2 = 28.6px` content box, which fits the 26px
                    `ArtWidth` glyph with 2.6px of slack — and because the brief
                    asks for it explicitly. THE COUNT DISCREPANCY IS REPORTED
                    RATHER THAN SILENTLY ABSORBED: the same brief states the width
                    set is 3 options; it is measured at 5.

                    WHY FLAT ROWS AT ALL, HONESTLY. "mature tools use button rows"
                    is TRUE for markers and FALSE for line style — draw.io uses a
                    `<select>` there. The defensible reason here is first-time-user
                    DISCOVERABILITY for a tool that will be shared: every option is
                    visible without opening anything. That is the claim; no false
                    precedent is cited.

                    EQUAL WIDTHS come from the existing `.insp-seg .insp-seg-btn
                    { flex: 1 1 0; min-width: 0 }` rule (the ROUND AA fix), so no
                    per-count arithmetic and no hard-coded pixel width is added
                    here. `checks/round-aa-align-marquee-palette.mjs` is the guard
                    that enumerates these call sites from the source. */}
                <div className="field">
                  <label>stroke width</label>
                  {chipRow(WIDTH_OPTS, eWidth,
                    v => updateEdge({style: {strokeWidth: Number(v)}}), 'Stroke width')}
                </div>
                <div className="field">
                  <label>line style</label>
                  {chipRow(DASH_ICON_OPTS, eDash,
                    v => updateEdge({style: {strokeDasharray: dashArray(v)}}), 'Line style', true)}
                </div>
                <div className="field">
                  <label>curvature</label>
                  {chipRow(CURVE_ICON_OPTS, ePathType, v => {
                    const id = v as PathType;
                    /* G: the chosen curvature becomes the default for the NEXT
                       edges drawn. The preference is persisted, never written
                       back onto other edges, and the control still shows
                       `ePathType` — the SELECTED edge — so an older bezier edge
                       keeps reading `bezier` while the default is `smoothstep`.
                       NOTHING HERE TOUCHES `bendX`/`bendY`: the picker sets
                       `edge.type` and calls `rememberEdgePath`, exactly as the
                       select it replaces did. */
                    updateEdge({type: PATH_TYPES[id]});
                    if (id !== 'custom') rememberEdgePath(id);
                  }, 'Curvature', true)}
                </div>
                {/* ROUND AK, AK-15 — `Reverse line direction` CLOSES THE `line`
                    SECTION, which is where draw.io ships it (Arrange → Reverse)
                    and where the path's own controls live: it re-points the path,
                    it does not move the label. Its labels swap WITH the ends —
                    the legacy fraction is mirrored `o → 1−o` so a label sitting
                    a quarter of the way along stays a quarter of the way along —
                    and the two handles travel with their nodes. All of that is
                    `edgeLabel.reverseEdgePatch`, exercised by the harness, so the
                    rule is not restated here. */}
                <div className="field">
                  <button
                    type="button"
                    className="chip act"
                    title="Swap the two ends: the labels swap with them, the path does not change"
                    onClick={() => reverseEdgeDir(selectedEdge!.id)}
                  >
                    Reverse line direction
                  </button>
                </div>
              </>); return null; })()}
              {/* ROUND AM, AM-2 — THE EDGE LABEL'S TEXT SECTION, registered in
                  the position `src/inspector.ts` gives it (`label → text →
                  line`), between the label's own naming/colour controls and the
                  line's. The ORDER is not decided here: `renderSections()` walks
                  `inspSections`, so moving this block would change nothing and
                  the one place to change the order stays the pure module.

                  THE BODY IS A CONST, NOT AN INLINE LITERAL, and it is
                  `edgeLabelTextBody` rather than `tsBody` because this target
                  offers SIZE / WEIGHT / FONT and NOT the colour or align rows —
                  the reasons are on that const. Registering `tsBody` here would
                  put a `text color` swatch row directly under the LABEL
                  section's own `text color` swatch row, i.e. two controls for one
                  stored fact, and an align row that would paint nothing because
                  `.edge-label` is an inline chip with no box to align inside. */}
              {(() => { secBody('text', edgeLabelTextBody); return null; })()}
              {(() => { secBody('markers', <>
              {/* ROUND AK, AK-5/AK-7 — THE TWO END CONTROLS.
                  RENAMED: `arrow head` → `start`, `head start` → `end`. The
                  labels were the defect, not the wiring: today's "arrow head" is
                  `markerEnd` and today's "head start" is `markerStart`, so the row
                  labels now match the values they write. Decision D3 chose
                  Start/End over "head start/head end" because no surveyed tool
                  uses "head" (tldraw uses `Start`/`End`), and the "Markers"
                  section title already supplies the context.
                  STORAGE KEYS ARE UNCHANGED: `markerStart` / `markerEnd` and
                  `markerFor()` are untouched — this is a string change only.

                  EACH IS NOW A FLAT 3-OPTION ROW (was an `IconPickerRow` trigger
                  + popover). 3 options ≤ the cited threshold of 4 (AK-6 note),
                  and `MARKER_OPTS` / `MARKER_OPTS_START` were already
                  `PickerOption[]` tables, so they are reused verbatim as row
                  options — `ArtArrow`'s `flip` variant supplies the mirrored
                  glyphs, so the start row still reads as the mirror of the end
                  row. This is the half where "mature tools use button rows" IS
                  true (draw.io puts its arrowheads in a row), and it is cited as
                  such. */}
              <div className="field">
                <label>start</label>
                {chipRow(MARKER_ICON_OPTS_START, eMarkerStart,
                  v => updateEdge({markerStart: markerFor(v, eStroke)}), 'Start marker', true)}
              </div>
              <div className="field">
                <label>end</label>
                {chipRow(MARKER_ICON_OPTS, eMarkerEnd,
                  v => updateEdge({markerEnd: markerFor(v, eStroke)}), 'End marker', true)}
              </div>
              </>); return null; })()}
              {(() => { secBody('flow', <>
                {/* ROUND AK, AK-16/AK-17 — ONE AXIS, FIVE NON-OVERLAPPING NAMES.
                    `Envelope` was REMOVED: it drew the same thing as `Icon` with
                    the `mail` glyph (both are an envelope travelling the line —
                    `FLOW_ICON_PATHS.mail` in src/GoblinEdge.tsx IS an envelope),
                    which is the duplication the owner reported. An edge that
                    already stored `flow:'event'` still animates: `migrateEdge`
                    folds it onto `icon` + `mail` on READ, so no board is
                    rewritten and the look does not change.

                    HONEST LIMIT, recorded in the code and not only in a report:
                    NO mature tool surveyed for this round ships a connector-wide
                    marching-ants animation — Miro, Lucidchart, Whimsical and
                    FigJam all have ZERO; tldraw's only related control is a
                    GLOBAL reduce-motion user preference; Excalidraw has no
                    element-level animation at all. So the research could prove
                    WHICH OPTIONS DUPLICATED and could NOT justify what to keep:
                    the five names below are the owner's product call, not a
                    precedent. The REMOVAL is the evidence-backed part. */}
                <div className="field">
                  <label>flow</label>
                  {chipRow(FLOW_OPTS, eFlow,
                    v => updateEdge({data: {flow: v === 'none' ? undefined : (v as any)}}),
                    'Flow animation', true)}
              </div>
              {/* ROUND AM, AM-5 — COUNT AND SPEED ON ONE ROW, and the speed is a
                  SLIDER. Two rows of ~50px collapse into one of ~44px:

                  * `count` keeps the `Stepper` (a 6-value ordinal has no
                    continuous form) but takes the new `compact` modifier, so it
                    stops stretching a 253px field to show one digit.
                  * `speed` was four word-chips — `slow / normal / fast / very
                    fast` — over a value the renderer already accepts
                    continuously (0.6…8s). It becomes a range input on exactly
                    that range; the four old chip values 4 / 2.4 / 1.4 / 0.8 all
                    live inside it, so no stored value is unreachable.

                  BOTH STAY GATED ON A PAYLOAD FLOW (AL-7): `dots` and `icon` are
                  the two flows that animate a bead, so they are the two that
                  have a count and a speed at all. `none` / `dash` / `pulse` are
                  line-level animations with no bead to count, and the gate is
                  untouched by this round.

                  ONE HISTORY ENTRY PER DRAG: `onGestureStart` pushes once (the
                  latch in `updateEdge`'s `coalesce` option — the same rule
                  `src/resizeHistory.ts` records for the resize grip), and every
                  `input` after it coalesces into that entry.

                  ROUND AO, AO-2 — AND IT PAYS THE 13px NOW. Collapsing two rows
                  into one is what created the defect this round: the pair is the
                  only row in the panel that is NOT a `.field`, so it never got
                  `.field`'s `margin-bottom: 13px` and the `flow glyph` row below it
                  started at the pair's own bottom edge — measured, a 0px box gap.
                  `.pair` carries the 13px itself now (see the rule in
                  `src/styles.css`); the pair's own children still lose theirs, which
                  is correct, the pair supplies that layout. */}
              {(eFlow === 'dots' || eFlow === 'icon') && (
                <div className="pair">
                  <div className="field">
                    <label>count</label>
                    <Stepper
                      value={eFlowCount}
                      onChange={n => updateEdge({data: {flowCount: n}})}
                      min={1} max={6}
                      title="Flow count"
                      compact
                    />
                  </div>
                  <div className="field grow">
                    <label>speed</label>
                    <FlowSpeed
                      value={eFlowSpeed}
                      onInput={secs => updateEdge({data: {flowDuration: secs}}, false, true)}
                      onGestureBoundary={() => { bendDragging.current = false; }}
                      title="Flow speed"
                    />
                  </div>
                </div>
              )}
              {/* ROUND AN, AN-4 — THE RAIL WAS DELETED HERE: it rendered
                  `<FlowRail seconds={eFlowSpeed} label={\`${eFlowCount} × …s per
                  loop\`}/>` whenever the flow was `dots` or `icon`. The owner
                  removed it ("tôi k cần cái Flow rail, xoá đi"), so no preview
                  is rendered and NONE SHOULD BE RE-ADDED: the speed's read-out
                  is the `.speedval` number inside `FlowSpeed` above, printed
                  from the same stored duration. */}
              {eFlow === 'icon' && (
                <div className="field">
                  <label>flow glyph</label>
                  {chipRow(FLOW_ICON_OPTS, eFlowIcon,
                    v => updateEdge({data: {flowIcon: v as any, flow: 'icon' as any}}), 'Flow glyph', true)}
                </div>
              )}
              {/* The ERD gate that used to sit here (`preset.id === 'erd' ? … :
                  null`) now lives in the DECISION (`src/inspector.ts` §A.3 writes
                  the Cardinality condition as `kind === 'edge' && preset.id ===
                  'erd'`), so a non-ERD edge never reaches this line: the section
                  is absent from `inspSections` and `secBody` is never called for
                  it. Keeping the gate here as well would be the second, divergent
                  copy of the same rule. §C additionally folds this section by
                  default; pass 1 renders it open. */}
              {hasSection('cardinality') && (() => { secBody('cardinality', <>
                  {/* ROUND AK, AK-5 — `source end` / `target end` RENAMED to the
                      SAME two words the Markers section now uses (`start` /
                      `end`), so the panel stops using three vocabularies for two
                      ends. Storage keys (`markerStart` / `markerEnd`) are
                      unchanged — a string change only.
                      These stay `IconPickerRow` (a popover): the crow's-foot set
                      is SIX options, above the cited flat-row threshold of 4
                      (AK-6 note), and 6 glyphs do not fit a 253px row legibly. */}
                  <div className="field-row">
                    <div className="field">
                      <label>start</label>
                      <IconPickerRow
                        id="insp-card-start"
                        value={(((selectedEdge!.markerStart as any)?.type ?? 'none') as string)}
                        onChange={v => {
                          updateEdge({markerStart: isCrowFoot(v)
                            ? ({type: v, color: eStroke, width: 18, height: 12} as any)
                            : (v === 'none' ? undefined : ({type: v as MarkerType, color: eStroke, width: 14, height: 14} as any))});
                        }}
                        options={CROW_START_OPTS}
                        title="Cardinality: start"
                      />
                    </div>
                    <div className="field">
                      <label>end</label>
                      <IconPickerRow
                        id="insp-card-end"
                        value={(((selectedEdge!.markerEnd as any)?.type ?? 'none') as string)}
                        onChange={v => {
                          updateEdge({markerEnd: isCrowFoot(v)
                            ? ({type: v, color: eStroke, width: 18, height: 12} as any)
                            : (v === 'none' ? undefined : ({type: v as MarkerType, color: eStroke, width: 14, height: 14} as any))});
                        }}
                        options={CROW_END_OPTS}
                        title="Cardinality: end"
                      />
                    </div>
                  </div>
                  <div className="hint" style={{paddingTop: 2}}>
                    Derived: <b>{cardinalityLabel((selectedEdge!.markerStart as any)?.type, (selectedEdge!.markerEnd as any)?.type) || '—'}</b>
                  </div>
              </>); return null; })()}
              {/* ROUND AK, AK-4 — THE ORPHAN `animated (dash on the line)` FIELD
                  IS DELETED. It sat OUTSIDE every section (no `secBody`, so it
                  rendered as a loose row under Flow Animation) and drew the SAME
                  marching-dash effect as the Flow Animation picker's `Dash`
                  option — two controls, one effect. `flow: 'dash'` is the one
                  that survives. An edge that had persisted `animated: true` keeps
                  its look: `migrateEdge` (App.tsx, AK-4 note) maps it to
                  `flow: 'dash'` on read. See that note for the measurement that
                  nothing in `boards/` ever set it true. */}
              </>); return null; })()}
              {/* K3: the payload-animation control moved to Settings → Canvas
                  ("Reduce motion"), where the preference belongs; the state and
                  its persisted override stay in useAnimationGating. */}
              {/* ROUND AK, AK-2 — THE SIDEBAR HINT IS DELETED.
                  It read "Double-click the label on the canvas to rename it
                  (Enter commit · Esc cancel). Every change is undoable with
                  ⌘/Ctrl Z." — four sentences of instructions standing where a
                  control belongs. draw.io's live edge Format panel contains ZERO
                  sentence-length strings; the controls themselves carry the
                  affordance (`.edge-label`'s own `title` already says
                  "Double-click to rename this connection"), and the keyboard
                  contract is on the shortcuts sheet (`?`). */}
              {renderSections()}
            </>
          ) : selCount >= 2 ? (
            <>
              {/* C2: multi-select summary — never a single node's fields.
                  ROUND BD redesigned this block (the decisions are pinned
                  by checks/round-bd-multi-panel.mjs); comment pruned
                  2026-10-26 for the ROUND ROTATE App budget. */}
              <div className="multi-head">{selCount} nodes selected</div>
              <div className="sec-label">Align</div>
              <div className="multi-actions multi-grid3">
                <button className="mbtn" title="Align left edges" aria-label="Align left" onClick={() => align('left')}><AlignStartVertical size={15} /></button>
                <button className="mbtn" title="Align horizontal centers" aria-label="Align horizontal centers" onClick={() => align('hcenter')}><AlignCenterVertical size={15} /></button>
                <button className="mbtn" title="Align right edges" aria-label="Align right" onClick={() => align('right')}><AlignEndVertical size={15} /></button>
                <button className="mbtn" title="Align top edges" aria-label="Align top" onClick={() => align('top')}><AlignStartHorizontal size={15} /></button>
                <button className="mbtn" title="Align vertical middles" aria-label="Align vertical middles" onClick={() => align('vcenter')}><AlignCenterHorizontal size={15} /></button>
                <button className="mbtn" title="Align bottom edges" aria-label="Align bottom" onClick={() => align('bottom')}><AlignEndHorizontal size={15} /></button>
              </div>
              <div className="sec-label">Distribute</div>
              <div className="multi-actions multi-grid2">
                <button className="mbtn" title="Distribute horizontally" aria-label="Distribute horizontally" onClick={() => distribute('h')}><AlignHorizontalSpaceAround size={15} /></button>
                <button className="mbtn" title="Distribute vertically" aria-label="Distribute vertically" onClick={() => distribute('v')}><AlignVerticalSpaceAround size={15} /></button>
              </div>
              <div className="sec-label">Arrange</div>
              <div className="multi-actions multi-grid2">
                <button className="mbtn" title="Bring to front" aria-label="Bring to front" onClick={() => reorderSelection('front')}><BringToFront size={15} /></button>
                <button className="mbtn" title="Send to back" aria-label="Send to back" onClick={() => reorderSelection('back')}><SendToBack size={15} /></button>
              </div>
              <div className="sec-label">Color</div>
              <div className="field">
                {(() => {
                  /* the batch's SHARED key, or null when the batch disagrees —
                     see the ROUND BD note in swatchRow.tsx (hoisted DA-3) */
                  const keys = nodes.filter(n => n.selected).map(n => resolveColorKey(n.data as any));
                  const shared = keys.length && keys.every(k => k === keys[0]) ? keys[0] : null;
                  return swatchRow(shared, k => {
                    pushHistory();
                    const ids = new Set(nodes.filter(n => n.selected).map(n => n.id));
                    setNodes(ns => ns.map(n => ids.has(n.id)
                      ? {...n, data: {...(n.data as any), colorKey: k, color: undefined}}
                      : n));
                  });
                })()}
              </div>
              <div className="sec-label">Actions</div>
              <div className="multi-actions">
                <button className="mbtn" onClick={() => duplicateSelection()}>Duplicate</button>
                <button className="mbtn multi-danger" title="Delete selected nodes" onClick={deleteSelection}>Delete</button>
              </div>
            </>
          ) : selected?.type === 'table' ? (
            <TableInspector
              selected={selected}
              showMode={showMode}
              setShowMode={setShowMode}
              setBoardStyle={setBoardStyle}
              tableStyle={tableStyle}
              tableDensity={tableDensity}
              curBoard={curBoard}
              readOnly={readOnly}
              update={update}
              selectedEdge={selectedEdge}
              isCollapsed={isCollapsed}
              toggleSection={toggleSection}
            />
          ) : !selected ? (
            <BoardPanel empty onStyle={s => setBoardStyle(s, tableDensity)} onDensity={d => setBoardStyle(tableStyle, d)} disabled={readOnly} />
          ) : selected.type === 'label' ? (
            <>
              {/* ROUND Y, ITEM 3 — the `label` badge is gone (it restated the
                  `Text` header directly below it); badge + spacer deleted. */}
              {/* PACKAGE-P §E.3(a) — THE PANEL'S SECOND TEXT WRITER IS GONE.
                  This branch used to register a 4-row <textarea> as its `text`
                  section, i.e. a SECOND writer for the same `text` the in-place
                  editor on the canvas writes (`src/nodes/LabelNode.tsx`). §E.3 removes
                  it in the same pass that lands its replacement, so the two can
                  never be out of step. `text` now registers the SAME Text
                  section a goblin gets (one body, one writer, two targets), and
                  this kind has exactly ONE text editor: the in-place one that a
                  double-click opens on the node itself. The section is not an
                  empty shell — it carries size / weight / colour / align, which
                  is what that editor's text is painted with, and its controls
                  are usable WHILE the editor is open (§E.3(b) holds the
                  blur-commit while the pointer is inside this panel). */}
              {(() => { secBody('text', tsBody); return null; })()}
              {renderSections()}
            </>
          ) : (
            <ShapeInspector
              selected={selected}
              sel={sel}
              bodyModeOpen={bodyModeOpen}
              setBodyModeOpen={setBodyModeOpen}
              keyNoteShown={keyNoteShown}
              dismissKeyNote={dismissKeyNote}
              preset={preset}
              update={update}
              selectedEdge={selectedEdge}
              isCollapsed={isCollapsed}
              toggleSection={toggleSection}
              setNodes={setNodes}
              pushHistory={pushHistory}
            />
          )}
        </div>
      </aside>
    </div>
    </div>
  );
}
