/* ROUND BN-4 — one slice of the former `src/GoblinEdge.tsx` (split verbatim, 2026-10-25). src/edges/index.ts re-exports the component and the type registry, so `import ... from './GoblinEdge'` is unchanged. */
import type {Edge} from '@xyflow/react';
import type {TextStyle} from '../textStyle';
import type {ColorKey} from '../colors';
import type {CrowFoot} from '../nodes/Crowfoot';
import type {Pt, BendPhase} from '../edgeBend';
import type {LabelWrite} from '../edgeLabel';

/* The edge's stored `data` shape — the members ROUND AK..BN wrote, verbatim
   from the renderer's own cast (moved so the panel and the renderer read ONE
   declaration; the cast below in GoblinEdge.tsx now uses this type). */
export type EdgeData = {
    shape?: string;
    /* PACKAGE-SEQ — the UML message kind. Overrides the arrowhead + dash so a
       sequence edge ALWAYS renders with the notation's semantics, whatever the
       board defaults were: sync = solid + closed head, async = solid + open,
       return/self = dashed + open. Colour follows the edge's own stroke. */
    seqMsg?: 'sync' | 'async' | 'return' | 'self';
    offset?: 'center' | 'start' | 'end';
    flow?: 'none' | 'dots' | 'dash' | 'pulse' | 'icon';
    flowIcon?: 'mail' | 'package' | 'file' | 'zap' | 'settings' | 'database';
    flowCount?: number;
    flowDuration?: number;
    /** L1: symbolic stroke key — resolved per theme. */
    strokeKey?: ColorKey;
    /** L1: literal user-typed hex fallback. */
    color?: string;
    /** L3b: C4 relationship technology, rendered dim after the label. */
    techn?: string;
    /** ROUND AM, AM-2 — the label's TEXT STYLE (size / weight / font), the same
     *  `TextStyle` a node stores on `data.textStyle`. ABSENT is the normal state
     *  and the one every existing board is in: `edgeTextStyleVars` returns `{}`,
     *  no custom property is emitted, and the sheet's own fallbacks paint the
     *  11px / 600 / `var(--mono)` the label has always used. The edge's text
     *  COLOUR is deliberately not part of it — that is `labelTextKey` below. */
    labelStyle?: TextStyle;
    onCommitLabel?: (id: string, v: string) => void;
    /** F2: timestamp signal from the context menu to open the label editor */
    __edit?: number;
    /** FB-L: review mode, threaded through per-edge data exactly like `__type`.
     *  The label stays readable; its editor must stay shut. */
    readOnly?: boolean;
    /** STEP 1 (2026-09-18): the step's cross-bar position, the fraction
     *  `getSmoothStepPath` calls `stepPosition` (0..1). READ-ONLY LEGACY as of
     *  ROUND T — the slider that wrote it was removed, and nothing writes it any
     *  more; it is read only so an old board's fraction still renders exactly as
     *  it did. ABSENT (not 0.5) is the default on purpose: `stepPosition:
     *  undefined` resolves to React Flow's own 0.5 inside the generator, so a
     *  board that never carried a `bend` renders byte-identical. */
    bend?: number;
    /** ROUND S/T (2026-09-18): the ABSOLUTE 2-D point the midpoint was dragged
     *  to, one key per axis. Both are meaningful: `freePath` reads `W.x` and
     *  `W.y`, and a drag on one axis preserves the other key
     *  (`edgeBend.applyDrag`). Absent means "never dragged". */
    bendX?: number;
    bendY?: number;
    /** ROUND S/T: the drag callback, threaded per-edge exactly like
     *  `onCommitLabel` — the handler lives in `App` because it writes `edges`
     *  state; this component only reports where the pointer went AND which way it
     *  is travelling (`dx`/`dy` in flow units), because the axis decision is
     *  draw.io's pointer rule and the handler owns the writer. */
    __onBend?: (id: string, W: Pt, phase: BendPhase, dx: number, dy: number) => void;
    /** ROUND AK, AK-10 — the FREE 2-D label position, in RELATIVE flow px,
     *  applied ADDITIVELY to the anchor `labelAnchor` derives. ABSENT (not
     *  `{0,0}`) is the default on purpose: a board that never moved its label
     *  carries no key and renders exactly as it did.
     *
     *  RELATIVE, not absolute. Sirius Web and Aleph both store the ABSOLUTE
     *  point and re-derive the fraction; ours is relative because the anchor is
     *  already derived here (from the path generator's own label), so a relative
     *  offset is the only shape that survives a node move, a re-route or a
     *  resize without a rewrite. That is a design judgement, recorded as such in
     *  the round's research (§7). */
    labelOffset?: {x: number; y: number};
    /** ROUND AK, AK-10 — Sirius Web's `movedByUser`. While FALSY the label
     *  auto-centres exactly as it always did; once true, `labelOffset` wins.
     *  Written by the drag, cleared by `Reset label position` (AK-14.1) and by
     *  the snap-to-centre rail (AK-14.2) — which is why the snap and the reset
     *  land on the SAME state instead of two that merely look alike. */
    labelPinned?: boolean;
    /** ROUND AM, AM-1 — THE POINT the stored `labelOffset` was measured
     *  against, in flow coordinates: `App` writes it from the write's own
     *  `labelAnchor` and it exists so the offset can be REBASED when that point
     *  moves (a node dragged mid-gesture, or any geometry change that shifts the
     *  anchor). ABSENT is the normal state for a board written before this round
     *  and for a centred label — and an absent anchor simply means "nothing to
     *  rebase against", which is why NO board migrates: the renderer never reads
     *  this key, it only stores it. */
    labelAnchor?: {x: number; y: number};
    /** ROUND AK, AK-12 — the label plate, THREE STORED STATES (`None` is a real
     *  value, not the absence of one). Rendered as a CLASS on `.edge-label`,
     *  never as an inline SVG fill: React Flow's own `labelBgStyle` is an
     *  SVG-`<rect>` API and this label is a DOM `<div>` through
     *  `EdgeLabelRenderer`, so copying that prop verbatim would be wrong. */
    labelBg?: 'none' | 'surface' | 'outline';
    /** ROUND AL, AL-3 — the label's TEXT colour, as a symbolic key. Resolved
     *  through `COLOR_VAR` like `strokeKey`, so a theme change repaints it for
     *  free. ABSENT is the default and falls back to the sheet's `var(--fg)`,
     *  which is the colour `.edge-label` has always used — so a board that never
     *  carried the key renders exactly as it did. */
    labelTextKey?: ColorKey;
    /** ROUND AL, AL-3 — the label PLATE's colour, as a symbolic key. Only
     *  MEANINGFUL while `labelBg` is not `none`: at `none` there is no plate for
     *  it to paint, which is why the PANEL hides the row in that state. ABSENT
     *  leaves the plate to the class (the three-state `.lb-*` rules), so nothing
     *  changes for a board that never carried it. */
    labelBgKey?: ColorKey;
    /** ROUND AK, AK-10 — the label drag's writer, threaded per-edge exactly like
     *  `__onBend`, and its shape follows `__onBend`'s own lesson: the writer
     *  takes the RESULT, not the pointer.
     *
     *  `__onBend` is handed the pointer's flow position and `App` re-derives the
     *  rest, because the bend lives in the STORED keys and `App` owns them. The
     *  label cannot work that way: what the label stores is `labelOffset` —
     *  relative to the ANCHOR — and the anchor comes from the path generator's
     *  own label, which only this component has. So the WRITE is computed here,
     *  because this is the only side that holds the resolved anchor; `App`
     *  receives the finished pair and merges it. That keeps ONE derivation of the
     *  geometry instead of a second, divergent copy in `App`.
     *
     *  ROUND AM, AM-1 — THE FORM IT IS COMPUTED IN. The gesture's write is
     *  `anchorWrite` (a DELTA: the pointer's displacement from the reference
     *  point, plus the `labelAnchor` frame it was measured in). `labelWrite`
     *  survives as the ABSOLUTE form and is reached from only two places, both of
     *  which mean the centred state — this component's `onStart` and its
     *  create-on-double-click commit. See `src/edgeLabel.ts` for which caller
     *  uses which and why. */
    __onLabelWrite?: (id: string, w: LabelWrite, phase: BendPhase) => void;
    /** ROUND AK, AK-13 — the double-click-on-the-PATH signal, threaded per-edge
     *  like `__edit` above but carrying a POSITION: a fresh timestamp AND the
     *  flow point the click landed on. A double-click on a line with no label
     *  has nothing to edit yet, so the editor has to be opened here (the element
     *  does not exist yet) and the committed text has to know WHERE it was
     *  created. `__edit` keeps its own meaning — the context menu's "Edit
     *  label" on an EXISTING label — and is not overloaded.
     *
     *  ROUND AN, AN-1 — IT IS A ONE-SHOT, AND EVERY EXIT CONSUMES IT. See the
     *  long note on `commit`/`cancel` below: the key was written by exactly one
     *  place and deleted by none, so it stayed on the edge forever and every
     *  later RENAME re-entered the create branch and re-centred the label. */
    __editAt?: {at: Pt; t: number};
    /** ROUND AN, AN-1 — CONSUME THE CREATE SIGNAL, one per-edge callback for
     *  BOTH exits of the editor (commit and cancel).
     *
     *  WHY A CALLBACK RATHER THAN CLEARING IT HERE. The signal lives in the
     *  edge's own `data`, and this component does not own `edges` state — the
     *  same reason `__onLabelWrite` and `onCommitLabel` are threaded in from
     *  `App`. It is deliberately NOT a second writer of `__editAt` either: the
     *  renderer never writes the key, it only tells `App` the moment is over,
     *  so `openLabelAt` stays the signal's only writer and the deletion has one
     *  home.
     *
     *  IT IS SEPARATE FROM `__onLabelWrite` ON PURPOSE. Cancel writes NOTHING —
     *  a double-click whose editor is dismissed with Escape must leave the
     *  document untouched — so it cannot reach the consume through the write
     *  path. One named operation, two exits, no sentinel write form. */
    __consumeEditAt?: (id: string) => void;
};

/* The edges this app stores. Re-declared here (was inline in GoblinEdge.tsx)
   so both homes import it. */
export type EdgeLike = Edge & {data?: EdgeData};
