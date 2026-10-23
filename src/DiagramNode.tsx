import {memo, useCallback, useEffect, useRef} from 'react';
import {Handle, NodeResizer, Position, type NodeProps} from '@xyflow/react';
import {lucideByName} from './lucideIcons';
import {asShape, ShapeFrame, type Shape as NodeShape} from './shapes';
import {resolveColor, type ColorKey} from './colors';
import {textStyleVars, alignForBody, vAlignForBody, type TextStyle} from './textStyle';
import {SHAPE_MIN_PX} from './customShape';

/** Shapes that are resizable — I5: every shape in SHAPES can be resized in
 *  both directions; the .node body fills the RF wrapper, so any width/height
 *  set by the resizer is honoured. L3a adds the ISO 5807 set. */
export const RESIZABLE = new Set<NodeShape>([
  'service', 'database', 'queue', 'external', 'actor', 'storage', 'gateway', 'group', 'note',
  'terminator', 'process', 'decision', 'io', 'document', 'subprocess', 'preparation', 'manual', 'delay', 'connector',
  /* ROUND AD — the six additions, so each can be resized like every other shape. */
  'offpage', 'manualinput', 'display', 'storeddata', 'looplimit', 'internalstorage',
]);

/** K5: only these shapes get the "post-it" surface (rotation, gradient,
 *  folded corner, icon watermark). A rotated gradient card on service /
 *  database / queue / gateway would fight the architecture-diagram language. */
const POSTIT = new Set<NodeShape>(['actor', 'note']);

/* ROUND S (2026-09-18) — THE RESIZER FLOORS ARE RAISED TO THE CONTENT FLOOR.

   THE DEFECT: this file's resizer said `minWidth={140} minHeight={80}` while
   `styles.css` gives `.node` a `min-width: 190px`. The two floors DISAGREED, so
   a node could be dragged to 140x80 while its own `.node` refused to shrink past
   190 wide — and `.node` and `.node-body` BOTH carry `overflow: visible`, so the
   text simply painted OUTSIDE the node's border.

   MEASURED on the running app (local px, zoom-independent — the wrapper size and
   the min-width floor stripped, layout settled, then read after a frame wait,
   because a synchronous read of a ResizeObserver-updated box is STALE):

     shape      natural content      spill at a smaller wrapper
     ---------  ------------------  ------------------------------------------
     external   168 x 114           wrapper 124 vs inner 139  -> +15px H
     queue      199 x 131           wrapper 102x96 vs 139x107 -> +37px H, +11px V
     service    183 x 114           wrapper 139x83 vs 139x83  -> none

   At a narrow width the text DOES wrap (no horizontal spill at 139), so the
   acute half of the defect is VERTICAL: `queue` needs ~131px and the old floor
   allowed 80.

   THE FIX (Harvey's option 1.a): raise the floors. `min-width: 190px` STAYS. No
   ellipsis, no clipping.

   THE INVARIANT THIS FILE NOW HOLDS TO — the resizer floor must NEVER be smaller
   than the CSS content floor. `NODE_MIN_W` is therefore DERIVED FROM
   `CSS_CONTENT_MIN_W`, which is the number `.node { min-width }` declares in
   `src/styles.css`, instead of a third number invented here; the harness reads
   BOTH sides and fails if they drift apart.

     HORIZONTAL — CSS_CONTENT_MIN_W (190) + the 10px slack below = 200.
     The slack is not decoration: the tallest natural CONTENT measured across the
     shapes that share this resizer is `queue` at 199px, i.e. 9px WIDER than the
     CSS floor, so the CSS floor ALONE would still clip it. 200 is the first value
     that clears both sources — 10px above the CSS floor, 1px above the worst
     measured content, and above the other two (168, 183).

     VERTICAL — there is no vertical CSS content floor to derive from (`.node`
     declares only `min-height: 100%`, a FILL rule, not a content floor), so the
     floor comes from the worst-case measured CONTENT: `queue` at 131px, which is
     the `.node.shape-queue .node-body` padding (30px top + 16px bottom) plus its
     kicker + title + sub. 131 + the same 10px slack = 141. Every other measured
     shape is shorter and so covered: 114, 114.

   WHY THE SPILL IS NOW UNREACHABLE, IN ONE SENTENCE: React Flow's resizer computes
   `getSizeClamp(newWidth, minWidth, …) = max(0, minWidth - newWidth, …)` and folds
   it into the drag delta, so the width it writes back can never be under 200 (and
   likewise 141 vertically) — at or above every shape's natural content size AND
   above `.node`'s own 190px CSS floor, which therefore can never bind.

   WHAT THIS FLOOR DOES NOT COVER — `note` and `group`, the other two shapes in
   RESIZABLE. The measurement above covers `external` / `queue` / `service`; the
   floor is the worst of those three and is applied to the whole shared resizer.
   A separate floor for `group` (its `.group-head` banner is 44px and the class
   itself declares NO min-height, so it can still be dragged to a 10px wrapper)
   and for `note` would need per-shape values that were not measured here — so it
   is left as the honest residue rather than a second invented number. `note`'s
   CSS `min-width: 120px` (styles.css) still floors its WIDTH; `addNodeByLabel`'s
   90px default height is only reachable at insert time and is not a drag. */
/** `.node { min-width }` as declared in `src/styles.css`. Mirrored here for one
 *  reason: so the floor below can be EXPRESSED FROM it rather than invented
 *  beside it. `checks/round-r-label-resize.mjs` reads both and asserts they
 *  agree, which is what stops the two numbers drifting apart again. */
export const CSS_CONTENT_MIN_W = 190;
/** Worst-case natural content height measured across the shapes sharing this
 *  resizer — `queue` at 131px (see the header). */
const CONTENT_MIN_H = 131;
/** 10px of slack above the binding floor of each axis, for the reasons in the
 *  header: on W it is what lifts 190 clear of the 199px queue content. */
const FLOOR_SLACK_PX = 10;
/** The resizer floors. 200x141 — see the header for each number's derivation. */
export const NODE_MIN_W = CSS_CONTENT_MIN_W + FLOOR_SLACK_PX;
export const NODE_MIN_H = CONTENT_MIN_H + FLOOR_SLACK_PX;

/* ROUND BF (2026-10-23) — PER-SHAPE-CLASS FLOORS. The uniform 200x141 floor
   was applied to every class while the CSS exempts exactly one shape, so a
   152px connector took a 48px folded clamp on the FIRST drag event (the
   resize jerk). Two classes land in slice A:

   - text-card (every RESIZABLE shape except connector; `note` joins in
     slice C): the ROUND S AQ19c/e semantics, upgraded with the max() so the
     effective floor can never drop below the CSS content floor even when a
     measured natural is smaller.
   - connector: FLAT 64 = 2 × SHAPE_MIN_PX (the import path's own minimum
     box; the same derivation discipline as NODE_MIN_W from
     CSS_CONTENT_MIN_W). The label wraps and AQ15 auto-grow handle overflow —
     the floor is the silhouette, not the label.

   `resizeFloorsFor` is PURE (no React, no DOM): the harnesses bundle and
   EXECUTE it, and App-level callers can reuse it unchanged. */
/** Silhouette minimum for the exempted symbol class: 2 × SHAPE_MIN_PX. */
export const SYMBOL_FLOOR_PX = 2 * SHAPE_MIN_PX;

/** Effective resizer floors for one node. See the ROUND BF header above. */
export type Floors = {w: number; h: number};
export function resizeFloorsFor(shape: NodeShape, naturalW: number, naturalH: number): Floors {
  if (shape === 'connector') return {w: SYMBOL_FLOOR_PX, h: SYMBOL_FLOOR_PX};
  return {
    w: Math.max(CSS_CONTENT_MIN_W, Math.min(NODE_MIN_W, naturalW || NODE_MIN_W)),
    h: Math.min(NODE_MIN_H, naturalH || NODE_MIN_H),
  };
}

/** L3a: handle orientation. A flowchart reads top-to-bottom, and a diamond with
 *  only left/right ports physically cannot express "Yes ↓ / No →". */
export type HandleMode = 'lr' | 'tb';

export type NodeKind = {
  kicker: string;
  title: string;
  sub?: string;
  metric?: string;
  metricUnit?: string;
  /** kebab-case lucide icon name ("server") or a raw unicode glyph ("◆"). */
  icon?: string;
  /** Symbolic accent key — resolved per theme at render time (L1). */
  colorKey?: ColorKey;
  /** Literal user-typed hex (the "custom…" escape hatch). Keys win. */
  color?: string;
  /** Architectural shape — generic notation, not a use case. */
  shape?: string;
  /** L3a: 'tb' renders Top(target)/Bottom(source) ports instead of Left/Right. */
  handles?: HandleMode;
  /** L3a: 'label-only' renders one centered sentence, no kicker/sub/metric. */
  body?: 'card' | 'label-only';
  /** L3b: C4 element type — drives kicker/colour on the preset palette. */
  c4Type?: string;
  /** L3b: C4 relationship technology, rendered dim after the edge label. */
  techn?: string;
  /** PACKAGE-P §E.2 — the Text section's stored style. OPTIONAL and every field
   *  optional: a board that predates the section has none, and `textStyleVars`
   *  returns `{}` for it, so such a node renders byte-for-byte as it always
   *  did. Nothing here is a size in px — see `src/textStyle.ts` for why `size`
   *  is a SCALE. */
  textStyle?: TextStyle;
  /** HARVEY 2026-10-14 — drop the two inner arcs on a cylinder (database /
      storeddata), leaving a bare drum. OPTIONAL: absent keeps the arcs, so a
      board from before this field renders byte-identical. */
  plainCylinder?: boolean;
  /** AQ15 — auto-grow: called once fonts/measure settle if the body clips;
      App grows the node's height (the same write a manual resize performs). */
  __onGrow?: (id: string, height: number, width?: number) => void;
};

/* ITEM 2 (2026-09-17) — THE AUTO-SHOW NODE TOOLBAR IS GONE.

   Harvey: "và tool tip khi chọn các element hiển thị, tôi nghĩ k cần hiện tại. vì
   các cái đó đều có hot key làm được" — the strip that appears when you select an
   element is not needed, because those actions all have hot keys.

   WHAT USED TO BE HERE: `NodeToolbarActions` (onDuplicate / onDelete / onCopy /
   onNote / onFront), injected into every node's `data` as `__toolbar` by App's
   `rfNodes` memo and rendered as a floating `<NodeToolbar>` strip above a
   selected node by `<Toolbar>`. Removed across all three node kinds.

   NO CAPABILITY WAS LOST — every one of the six buttons already had a second
   route, verified against the real handlers:

     toolbar button          non-toolbar route
     ----------------------  ------------------------------------------------
     Duplicate  (Copy)       ⌘/Ctrl+D — App.tsx:2420 `duplicateSelection()`
                             ALSO the node context menu → "Duplicate"
     Copy (ClipboardCopy)    ⌘/Ctrl+C — App.tsx:2418 `copySelection()`
                             ALSO the node context menu → "Copy"
     Add note   (StickyNote) node context menu → "Add note here"
     Bring to front          node context menu → "Bring to front"
                             (and "Send to back", which the toolbar never had)
     Connection hint (Link2) DEAD BUTTON — it called `actions.onNote(id)`, i.e.
                             literally the same handler as the note button beside
                             it. Not a capability, so nothing to preserve; the
                             connection hint is what you get from the note.
     Delete     (Trash2)     Del / Backspace — App.tsx:3568 `deleteKeyCode`
                             ALSO the node context menu → "Delete" (danger)

   The context menu (`ContextMenu.tsx`, opened by right-click / long-press) is
   the documented home for the four that needed one, and it already listed all of
   them before this pass — nothing had to be added to it. */

/**
 * One generic node. `data.shape` selects the notation
 * (service / database / … / terminator / process / decision / …),
 * and every shape takes its outline, icon, metric and glow from the node's
 * accent — a symbolic key, resolved to `var(--c-*)` here so the theme cascades.
 */
export function IconGlyph({icon, size = 17}: {icon?: string; size?: number}) {
  const Ico = lucideByName(icon);
  if (Ico) return <Ico size={size} />;
  return <span className="glyph">{icon}</span>;
}

/**
 * G — the 4-point connection scheme. Every node exposes the four EDGE
 * MIDPOINTS only, and every one of them is a SOURCE handle.
 *
 * Why source-only. React Flow resolves the drag ORIGIN with
 * getHandleType(undefined, handleBelow), which reads the source / target CLASS
 * of the handle under the pointer, then builds the connection as
 *   source: isTarget ? handleNodeId : fromNodeId
 *   target: isTarget ? fromNodeId : handleNodeId
 * so landing on a target-classed handle makes the node the user dragged FROM
 * the edge's TARGET and the arrowhead stays behind on it. With a source handle
 * at every site the origin is always a source, so the edge is always built in
 * the direction the user drew it. App.tsx's onConnect carries a second guard.
 *
 * Four points, not eight. The four corner sites (and the four duplicated
 * mirror handles) are gone: a corner was reachable only through CSS offsets,
 * it doubled the dot count, and the four midpoints are what Harvey asked for.
 * A board that still stores a corner id in sourceHandle / targetHandle is
 * re-aimed onto the nearest surviving side by migrateEdge in App.tsx, not by a
 * handle that still exists here.
 *
 * B1 compatibility. The ids, positions and DOM order are exactly what B1 and
 * B2 already wrote into stored boards — left / right / top / bottom — so an
 * existing edge resolves to the pixel it always did. Under ConnectionMode.Loose
 * (App.tsx) a source handle serves BOTH ends of an edge, so a stored
 * `targetHandle: 'left'` still resolves: React Flow looks the target endpoint
 * up against the target bounds concatenated with the source bounds.
 *
 * All four are the SAME 12px dot; size, reveal and z-index are unchanged.
 */
/* HARVEY 2026-10-13 — dblclick a handle -> auto-connect to the NEAREST shape
   (within range, nearest sides). The handle has no access to the app's node
   store, so it dispatches a plain CustomEvent; App.tsx owns the search, the
   cycle check and the edge creation. */
function handleDblClick(nodeId: string) {
  return (handleId: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('gobi:handle-connect', {detail: {nodeId, handleId}}));
  };
}

function NodeHandles({nodeId}: {nodeId: string}) {
  const on = handleDblClick(nodeId);
  return (
    <>
      {/* The four edge midpoints — every one a SOURCE handle (see above). */}
      <Handle type="source" id="left" position={Position.Left} onDoubleClick={on('left')} />
      <Handle type="source" id="right" position={Position.Right} onDoubleClick={on('right')} />
      <Handle type="source" id="top" position={Position.Top} onDoubleClick={on('top')} />
      <Handle type="source" id="bottom" position={Position.Bottom} onDoubleClick={on('bottom')} />
    </>
  );
}

const Node = memo(({id, data, selected}: NodeProps) => {
  const d = data as unknown as NodeKind;
  const shape = asShape(d.shape);
  const nc = resolveColor(d);
  /* PACKAGE-P §E.2 — the Text section's custom properties, on the node ROOT.
     ONE object spread covers kicker, title, sub and metric (they all read
     `var(--ts-*)`), and an untouched node contributes no key at all, so the
     sheet's own fallbacks apply and nothing is repainted. Same object literal
     that already carries `--nc`, so no second style attribute is introduced.

     The SECOND argument is the target's own align default: a `label-only`
     node renders `text-align: center` by design, so `center` — not `left` — is
     the value that renders anyway there. `alignForBody` is the single answer
     both this renderer and the panel use, so `mergeTextStyle` can never store a
     choice this function then refuses to paint.
     ROUND Z FIX 2 — the THIRD argument is the same idea on the vertical axis,
     and it is why this is a function of `d.body` rather than a constant: a card
     renders from its `padding-top` (so `top` is its no-write value) while this
     same expression on a `label-only` node carries `.lo-body`, whose box
     centres by design (so `middle` is). An untouched node therefore still emits
     nothing AND still paints exactly what it painted before this round. */
  const tsVars = textStyleVars(d.textStyle, alignForBody(d.body), vAlignForBody(d.body));

  /* AQ15 — AUTO-GROW ON CREATE. A fresh node has no explicit height, so a card
     whose text is taller than the shape's safe band clips its sub/metric
     (overflow: hidden from the text-fits pass). Once mounted AND once fonts
     settle, if the body is clipped and the WRAPPER carries no user-set height,
     grow the node to fit — exactly what a manual resize would have done. Runs
     at most a few times and stops the moment the user resizes (the wrapper
     then HAS an explicit height). */
  const innerRef = useRef<HTMLDivElement | null>(null);
  /* AQ19c — the node's NATURAL content height (its height with no explicit
     style). Measured whenever the grow-check finds the content fits; used as
     the resizer's vertical floor so "shrink back to minimum" lands on the SAME
     size a fresh drop produces, instead of the static worst-case NODE_MIN_H. */
  const naturalHRef = useRef<number>(0);
  /* AQ19e — same idea for WIDTH: the fresh-drop natural width (190 via the CSS
     floor) is BELOW the static NODE_MIN_W (200), so a stretch→shrink could
     never return to the dropped width. Measured alongside the height. */
  const naturalWRef = useRef<number>(0);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  /* ROUND BF §2.4 — MEASURE THE NATURAL FLOOR AT DRAG START. The AQ15 effect
     above bails the moment the wrapper carries an explicit size (`if
     (wrapper.style.height) return;`), so on a reloaded board — or after the
     first resize — `naturalWRef.current === 0` and the floor snaps back to
     the static class floor (the reload jerk: a 196px node GROWS to 200 on
     its first shrink event). This helper re-measures INTRINSICALLY for a
     sized wrapper, exactly like the AQ16 width probe: max-content width +
     insets, restored immediately; height from the stacked children's rects +
     vertical insets. It NEVER mutates the wrapper's own inline style (React
     Flow owns wrapper.style.width/height; clearing it mid-drag fights the
     model) — only the BODY is probed, and restored before returning. Called
     from the AQ15 effect's fit path AND from onResizeStart below, so the
     first drag event already clamps against the correct floor. */
  const measureNatural = useCallback(() => {
    const inner = innerRef.current, body = bodyRef.current;
    if (!inner || !body) return;
    const wrapper = inner.closest('.react-flow__node') as HTMLElement | null;
    if (!wrapper) return;
    const cb = getComputedStyle(body);
    /* WIDTH ONLY (spec deviation, recorded in the slice B commit message):
       §2.4 also prescribes an intrinsic height re-measure, but a one-line
       label measures ~22px of stacked content (measured this session), which
       would make the text-card height floor min(141, 22) = 22 and AC8's
       "deliberate shrink stops at 141" unreachable — the ROUND S worst-case
       floor (queue at 131+10) would stop binding the moment a node carries an
       explicit size. The reload jerk §2.1 names is the WIDTH snap
       (naturalWRef.current === 0 → floor 200); the height axis keeps the
       AQ19c semantics (measured only while the wrapper has no explicit
       height, so a reloaded node floors at the class 141). */
    const kids = [...body.children].filter(c => (c as HTMLElement).offsetParent !== null);
    void kids;
    /* width: the content's natural single-line width + horizontal insets,
       exactly the AQ16 probe — set, read, restore, never leave it behind. */
    const prevW = body.style.width;
    body.style.width = 'max-content';
    const naturalW = body.scrollWidth;
    body.style.width = prevW;
    const sideIns = (parseFloat(cb.left) || 0) + (parseFloat(cb.right) || 0);
    if (naturalW > 0) naturalWRef.current = Math.ceil(naturalW + sideIns);
  }, []);
  useEffect(() => {
    const inner = innerRef.current, body = bodyRef.current;
    if (!inner || !body) return;
    let raf = 0;
    const check = () => {
      const wrapper = inner.closest('.react-flow__node') as HTMLElement | null;
      if (!wrapper) return;
      // the user resized: RF wrote an explicit height — hands off
      if (wrapper.style.height) {
        /* ROUND BF §2.4 — the bail-out no longer discards the floors: the
           wrapper is sized, so measure the content INTRINSICALLY instead. */
        measureNatural();
        return;
      }
      /* The metric is the LAST CONTENT ELEMENT's bottom vs the body's bottom —
         scrollHeight misses glyph descenders (p/y paint below their line box
         with overflow:hidden, invisible to scroll metrics): Harvey's screenshot
         had "primary" sliced by exactly that. */
      const kids = [...body.children].filter(c => (c as HTMLElement).offsetParent !== null);
      const last = kids[kids.length - 1];
      const clipped = last ? Math.ceil(last.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom + 2) : 0;
      if (clipped <= 0) {
        /* content fits: the current wrapper size IS this node's natural size —
           remembered as the resizer's floors (AQ19c/AQ19e). */
        naturalHRef.current = wrapper.offsetHeight;
        naturalWRef.current = wrapper.offsetWidth;
        return;
      }
      /* PERCENT INSETS: the band is a fixed FRACTION of the node, so the node
         must grow by MORE than the clip — dividing by the band's height share
         (1 - topInset - bottomInset, read from the computed insets) converts
         the clip into the real node growth. Cylinders: clip / 0.45 ≈ 2.2x.
         AQ16 — WIDTH too: measure the text's natural single-line width
         (max-content probe) so a long title/sub widens the node instead of
         over-wrapping into a taller one. Capped at 340px (the cheatsheet cap)
         to keep boards tidy. */
      const cb = getComputedStyle(body);
      const topIns = parseFloat(cb.top) || 0;
      const botIns = parseFloat(cb.bottom) || 0;
      const nodeH = wrapper.offsetHeight;
      const bandRatio = nodeH > 0 ? Math.max(0.2, (nodeH - topIns - botIns) / nodeH) : 0.55;
      const grow = Math.ceil((clipped + 2) / bandRatio);
      const target = Math.ceil(nodeH + grow);
      // natural single-line width of the content
      body.style.width = 'max-content';
      const naturalW = body.scrollWidth;
      body.style.width = '';
      const sideIns = (parseFloat(cb.left) || 0) + (parseFloat(cb.right) || 0);
      const targetW = Math.min(340, Math.max(0, Math.ceil(naturalW + sideIns + 8)));
      naturalHRef.current = target;
      if (targetW) naturalWRef.current = targetW;
      if (d.__onGrow) d.__onGrow(id, target, targetW);
      else window.dispatchEvent(new CustomEvent('gobi:node-grow', {detail: {id, height: target, width: targetW}}));
    };
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(check); });
    ro.observe(body);
    check();
    /* AQ15b — webfonts land AFTER first paint: the first check measured with
       fallback metrics and could clear a clip that the real font then recreates
       (Harvey's screenshot: sub half-sliced at 150px). The body box does not
       resize on a font swap, so the observer alone misses it — re-check when
       fonts settle and on a short settle ladder. */
    document.fonts?.ready.then(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(check); });
    /* fonts.loadingdone fires per webfont batch — a slow font landing at 2s+
       still triggers a re-check (Harvey's first-create clip). */
    document.fonts?.addEventListener?.('loadingdone', onFontDone);
    const timers = [60, 150, 400, 900, 2000].map(ms => window.setTimeout(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(check); }, ms));
    function onFontDone() { cancelAnimationFrame(raf); raf = requestAnimationFrame(check); }
    return () => {
      ro.disconnect(); cancelAnimationFrame(raf); timers.forEach(t => clearTimeout(t));
      document.fonts?.removeEventListener?.('loadingdone', onFontDone);
    };
  }, [id, d]);
  /* AQ16 — text edits (title/sub/metric) change the content WITHOUT resizing
     the body box, so the RO stays silent; re-run the grow check when data
     changes, and listen for the check's report at App level. */
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const inner = innerRef.current, body = bodyRef.current;
      if (!inner || !body) return;
      const wrapper = inner.closest('.react-flow__node') as HTMLElement | null;
      if (!wrapper) return;
      const kids = [...body.children].filter(c => (c as HTMLElement).offsetParent !== null);
      const last = kids[kids.length - 1];
      if (!last) return;
      const over = Math.ceil(last.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom + 2);
      if (over > 0) window.dispatchEvent(new CustomEvent('gobi:node-grow', {
        /* growth-only: App's onGrow never shrinks, so a user-set height is
           only ever RAISED by a text change — never lowered. */
        detail: {id, height: wrapper.offsetHeight + Math.ceil(over / 0.45) + 4},
      }));
    });
    return () => cancelAnimationFrame(raf);
  }, [id, d?.title, d?.sub, d?.metric, d?.textStyle]);

  // Container shapes get React Flow's resize affordance when selected (C3).
  // React Flow writes width/height back into node.style, so the size persists.
  /* AQ19c — the floor is this node's MEASURED natural height when known
     (fresh-drop fit), falling back to the static worst-case NODE_MIN_H.
     Harvey: stretch → shrink-to-min must land on the fresh-drop size.
     ROUND BF — the derivation moved into `resizeFloorsFor` (per-class floors);
     this call site passes the same refs. */
  const floors = resizeFloorsFor(shape, naturalWRef.current, naturalHRef.current);
  const resizer = selected && RESIZABLE.has(shape) ? (
    <NodeResizer
      minWidth={floors.w}
      minHeight={floors.h}
      lineClassName="resize-line"
      handleClassName="resize-handle"
      /* ROUND BF §2.4 — re-measure the natural floors at DRAG START. Fires
         BEFORE any clamping, so the very first drag event clamps against the
         re-measured floor instead of the static class floor. Verified in the
         installed @xyflow/react: XYResizer.update() swaps the SHARED outer
         `params` object, and the active d3 gesture reads `params.boundaries`
         at every drag event, so a re-render between onResizeStart and the
         first drag event re-clamps mid-gesture. measureNatural only writes
         refs (no re-render by itself); the re-render comes from React Flow's
         own selection/dimension state updates at gesture start, and even on
         the same render the NEXT render (the first drag frame writes
         node.style) picks the refs up — by frame two the clamp is corrected,
         and for the text-card W axis the intrinsic measure at selection time
         (the §2.4 effect above) has already set the refs before the grip is
         even grabbed. */
      onResizeStart={() => measureNatural()}
    />
  ) : null;

  // K5 — post-it chrome, applied ONLY to actor / note.
  const postit = POSTIT.has(shape) ? (
    <>
      <span className="ds-postit-fold" aria-hidden="true" />
      {d.icon && (
        <span className="ds-postit-mark" aria-hidden="true">
          <IconGlyph icon={d.icon} size={30} />
        </span>
      )}
    </>
  ) : null;

  if (shape === 'note') {
    return (
      <div
        className={`note-node${selected ? ' selected' : ''}`}
        style={{'--nc': nc, ...tsVars} as React.CSSProperties}
      >
        {resizer}
        <NodeHandles nodeId={id} />
        {postit}
        {/* ROUND V — the text lives in its own box so the root's border can stay
            unclipped: the four connect dots and, when selected, the four resize
            grips are centred ON that border. */}
        <div className="note-body">
          {d.kicker && <div className="node-kicker">{d.kicker}</div>}
          {d.title && <div className="note-title">{d.title}</div>}
          {d.sub && <div className="node-sub">{d.sub}</div>}
        </div>
      </div>
    );
  }

  if (shape === 'group') {
    // K5: 44px header banner + a 32px circular icon badge overlapping above it.
    return (
      <div className={`group-node${selected ? ' selected' : ''}${d.icon ? ' has-badge' : ''}`} style={{'--nc': nc, ...tsVars} as React.CSSProperties}>
        {resizer}
        <NodeHandles nodeId={id} />
        <div className="group-head" aria-hidden="true" />
        {d.icon && (
          <span className="group-badge" aria-hidden="true"><IconGlyph icon={d.icon} size={16} /></span>
        )}
        <div className="group-label">
          <span>{d.title}</span>
          {d.sub && <small>{d.sub}</small>}
        </div>
      </div>
    );
  }

  // L3a: label-only body — one centered sentence, no kicker / sub / metric.
  if (d.body === 'label-only') {
    return (
      <div
        /* body-inset covers the label-only branch too — Harvey's screenshot was
           a label-only Decision with the text parked top-left, outside the
           diamond once the node grew. The .lo-body below must obey the band. */
        className={`node body-inset shape-${shape} label-only${selected ? ' selected' : ''}`}
        ref={innerRef}
        style={{'--nc': nc, ...tsVars} as React.CSSProperties}
      >
        {resizer}
        <NodeHandles nodeId={id} />
        <ShapeFrame shape={shape} plain={d.plainCylinder !== false} />
        {postit}
        <div className="node-body lo-body" ref={bodyRef}>
          <div className="lo-title">
            {d.icon && <span className="node-ico"><IconGlyph icon={d.icon} /></span>}
            <span>{d.title}</span>
          </div>
          {d.sub && <div className="lo-sub">{d.sub}</div>}
        </div>
      </div>
    );
  }

  /* HARVEY 2026-10-14 — body-inset: every goblin shape's text lives inside a
     percent-inset band matched to that shape's silhouette (styles.css audit
     block). Tables/labels/notes keep their own layout. */
  return (
    <div ref={innerRef} className={`node body-inset shape-${shape}${selected ? ' selected' : ''}`} style={{'--nc': nc, ...tsVars} as React.CSSProperties}>
      {resizer}
      <NodeHandles nodeId={id} />
      <ShapeFrame shape={shape} plain={d.plainCylinder !== false} />
      {postit}
      <div className="node-body" ref={bodyRef}>
        {d.kicker && <div className="node-kicker">{d.kicker}</div>}
        <div className="node-title">
          {d.icon && <span className="node-ico"><IconGlyph icon={d.icon} /></span>}
          <span>{d.title}</span>
        </div>
        {d.sub && <div className="node-sub">{d.sub}</div>}
        {d.metric && (
          <div className="node-metric">
            {d.metric}
            {d.metricUnit && <small>{d.metricUnit}</small>}
          </div>
        )}
      </div>
    </div>
  );
});

export default Node;
