/* DescPanels.tsx — DA-2 (SPEC-NODE-DESCRIPTION §v2 item 4, task t_5189e3a8,
 * 2026-11-12). The open state becomes an ORDERED SET of node ids (one id per
 * badge before): several description panels open at once, each PINNED to its
 * own shape. Everything below derives from that set.
 *
 * WHAT MOVED HERE from DescBadge.tsx (DESC-2/4/5): the PANEL side of the
 * door — the document-level portal, the APG dialog mechanics, the ONE
 * close() path with the never-body focus belt, and the outside/Escape
 * listeners. DescBadge keeps only the badge glyph and toggles this store.
 * Mounting: ONE <DescPanels /> as a <ReactFlow> child in App (a child reads
 * the flow store from context; App itself sits above the provider).
 *
 * THE ORDERED SET: `openIds` is insertion-ordered — the LAST id is the most
 * recently opened. That order is behaviour, not bookkeeping:
 *   - Escape closes the panel that CONTAINS FOCUS; if none does, the most
 *     recently opened one (the set's tail);
 *   - collision offsets are "leader" offsets: a panel only ever moves out of
 *     the way of panels OPENED BEFORE it, so the offsets are stable and the
 *     earlier panel owns the anchor spot.
 *
 * FOLLOWING (§v2 item 4): while any panel is open, a rAF-throttled pass
 * re-measures every open node's getBoundingClientRect and repositions its
 * panel — direct style writes, no transitions (the project's no-animated-
 * layout rule). That one loop covers pan, zoom and node drags alike: they
 * all end in "the node's screen rect changed", which is the only input.
 *
 * OUT-OF-VIEW RULE — the stated choice, asserted by M8: a panel whose node
 * has scrolled FULLY out of the viewport CLOSES (it does not linger over
 * content it no longer describes). Close, not hide: a hidden panel would
 * silently revive when the node scrolls back, which reads as a ghost.
 *
 * OUTSIDE CLICK — press-and-release within 5 px, not a bare pointerdown: a
 * canvas PAN and a node DRAG both begin with a pointerdown on empty canvas,
 * and DA-2's whole point is that the panels SURVIVE the pan and follow it.
 * A real click (no movement) on anything that is not a panel or a badge
 * still closes every open panel, exactly as DESC-2/E7 specified.
 *
 * PANEL-TOP-LAYER (task t_9209b298, 2026-11-12): each panel carries
 * popover="manual" and is shown with showPopover()/hidden with hidePopover()
 * — the browser's TOP LAYER paints it above EVERY shape, overlay and
 * z-index by specification. Measured pre-fix: the old z-index:2000 only won
 * because @xyflow/react v12's INLINE wrapperStyle {position:relative;
 * zIndex:0} clamps every node inside a z:0 stacking context — raise that one
 * ancestor number and a stored-5000 (+1000 selected) node paints over the
 * panel (the deliberately-broken-copy red, unisurf-desc-multi Z-block).
 * manual = OUR close paths only (no light dismiss); where showPopover is
 * missing the panel renders as before AND positionAll's fallback sets its
 * inline z-index one above the board's highest computed node z (a
 * comparison, never a constant — Z2). styles.css folds inset:auto;margin:0
 * into .desc-panel to cancel the UA popover inset:0/margin:auto centring.
 *
 * DELETE / BOARD SWITCH: ids whose node no longer exists are pruned from
 * the set (silently — there is no badge to return focus to; RF's own delete
 * flow seats focus). unisurf-desc-multi M7 is the proof. */
import {memo, useEffect, useLayoutEffect, useRef, useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {useReactFlow, useStore, type Node} from '@xyflow/react';
import {descPaintVar, panelInk, panelPaint} from './DefinitionSection';

/* ---- the store: an ordered set of node ids + its subscribers ---------- */
let openIds: string[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/* CHROME-ABOVE (t_31a9bec9): the badge lives in the chrome layer's frame
   (data-chrome-node), not in the node subtree — resolved globally through
   its unique aria-controls instead of a node-scoped query. */
const badgeOf = (doc: Document, id: string) =>
  doc.querySelector(`[data-desc-badge][aria-controls="desc-panel-${id}"]`) as HTMLElement | null;

/** DESC-5's ONE close path; BADGE-PTR adds the seat. `seat: 'badge'`
 *  (default — every KEYBOARD close: Escape, Enter on the ×) returns focus
 *  to the badge BEFORE the state flip (the still-mounted button takes
 *  focus, and the badge survives the re-render because it holds focus).
 *  `seat: 'pane'` (every POINTER close: the outside click, the mouse ×)
 *  must NOT manufacture badge focus — measured two-click bug: the outside
 *  close runs in a pointerup CAPTURE listener BEFORE React Flow's pane
 *  click deselects the node, so the seat set btnFocus and the badge stayed
 *  mounted after the deselection until a SECOND click blurred it. The
 *  settle belt one macrotask later still guarantees never-body for BOTH
 *  seats: the badge when seated and still living, else the node's
 *  focusable wrapper — never body.
 * PANEL-TOP-LAYER: the popover is hidden BEFORE the flip unmounts it —
 * guarded, because hidePopover() on an already-hidden popover THROWS
 * InvalidStateError (Z4 asserts zero console errors over all four paths). */
export const closeDesc = (id: string, seat: 'badge' | 'pane' = 'badge') => {
  const doc = document;
  if (seat === 'badge') badgeOf(doc, id)?.focus();
  const panel = doc.getElementById(`desc-panel-${id}`);
  if (panel?.matches(':popover-open')) { try { panel.hidePopover(); } catch { /* already hidden */ } }
  if (openIds.includes(id)) { openIds = openIds.filter((x) => x !== id); emit(); }
  setTimeout(() => {
    if (doc.activeElement && doc.activeElement !== doc.body) return;
    const wrap = doc.querySelector(`.react-flow__node[data-id="${id}"]`);
    /* BADGE-PTR: a pointer close never seats the badge even when one is
       still mounted (a selected node's) — seating it would set btnFocus
       and revive the same lingering badge on the NEXT deselect. */
    ((seat === 'badge' ? badgeOf(doc, id) : null) ?? (wrap as HTMLElement | null))?.focus();
  }, 0);
};

/** silent removal — the node is GONE (deleted, board switched): no badge
 *  exists to take the return focus, so none of the focus games run. */
const removeDesc = (id: string) => {
  if (openIds.includes(id)) { openIds = openIds.filter((x) => x !== id); emit(); }
};

/** click on empty canvas / anywhere outside: every panel closes (§v2). The
 *  focus belt of the LAST close is the one that sticks, which matches the
 *  single-panel behaviour DESC-5 shipped (E7's known-good). The seat passes
 *  straight through to closeDesc. */
export const closeAllDesc = (seat: 'badge' | 'pane' = 'badge') => { for (const id of [...openIds]) closeDesc(id, seat); };

export const openDesc = (id: string) => {
  if (!openIds.includes(id)) { openIds = [...openIds, id]; emit(); }
};
export const toggleDesc = (id: string) => { if (openIds.includes(id)) closeDesc(id); else openDesc(id); };

/** the badge's half of the set: "is MY panel open?" (aria-expanded). */
export const useDescOpen = (id: string) =>
  useSyncExternalStore(subscribe, () => openIds.includes(id));

/** the WHOLE ordered set, for the chrome layer (CHROME-ABOVE t_31a9bec9):
 *  a frame stays mounted for a node whose panel is open even after the
 *  selection moves away — an open panel is never orphaned (DA-2's rule). */
export const useDescOpenList = () => useSyncExternalStore(subscribe, () => openIds);

/* ---- the one positioning pass (open order = leader order) ------------- */
const positionAll = () => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const placed: {x: number; y: number; w: number; h: number}[] = [];
  /* PANEL-TOP-LAYER FALLBACK — computed lazily, only when some panel is NOT
     in the top layer (no popover API, or showPopover threw): the highest
     computed node z-index on the board. Such a panel wins by COMPARISON,
     not by a constant: its inline z-index is set one above that maximum
     (Z2 asserts the comparison against every node, never a fixed number). */
  let nodeMaxZ = -1;
  for (const id of openIds) {
    const panel = document.getElementById(`desc-panel-${id}`);
    const node = document.querySelector(`.react-flow__node[data-id="${id}"]`);
    if (!panel || !node) continue;
    if (!panel.matches(':popover-open')) {
      if (nodeMaxZ < 0) {
        for (const nd of document.querySelectorAll('.react-flow__node')) {
          const nz = parseFloat(getComputedStyle(nd).zIndex);
          if (Number.isFinite(nz) && nz > nodeMaxZ) nodeMaxZ = nz;
        }
      }
      const z = String(nodeMaxZ + 1);
      if (panel.style.zIndex !== z) panel.style.zIndex = z;
    }
    const r = node.getBoundingClientRect();
    /* the OUT-OF-VIEW choice, stated above: fully outside → CLOSED. */
    if (r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) { closeDesc(id); continue; }
    const pw = panel.offsetWidth, ph = panel.offsetHeight;
    /* the DESC-2 anchor rules, applied PER PANEL: centred on the node's
       x, above when there is room, below otherwise, clamped to the
       viewport on both axes. EDIT-BALANCE (t_864a8e0c): the badge floats
       ABOVE the card top, so the above-gap is measured from the BADGE's
       top when mounted — else the panel covers the badge's toggle (B5/E8).
       CHROME-ABOVE (t_31a9bec9): the badge is a chrome-layer child now, so
       the lookup is global by its unique aria-controls. */
    const bg = document.querySelector(`[data-desc-badge][aria-controls="desc-panel-${id}"]`);
    const gap = bg ? r.top - bg.getBoundingClientRect().top + 4 : 8;
    let left = r.left + r.width / 2 - pw / 2;
    left = Math.min(Math.max(8, left), Math.max(8, vw - pw - 8));
    let top = r.top - ph - gap;
    if (top < 8) top = Math.min(r.bottom + 8, Math.max(8, vh - ph - 8));
    /* §v2: panels never overlap — the LATER panel (this one) takes the
       offset: DOWN past the earlier panel, or UP under it when down does
       not fit the viewport; x stays on its own node (a leader offset, not
       a free-floating stack). Bounded passes: a shift can only create an
       overlap with an EARLIER panel, so ≤4 sweeps settle any stack. */
    for (let sweep = 0; sweep < 4; sweep++) {
      let hit = false;
      for (const q of placed) {
        const xo = Math.min(left + pw, q.x + q.w) - Math.max(left, q.x);
        const yo = Math.min(top + ph, q.y + q.h) - Math.max(top, q.y);
        if (xo > 0 && yo > 0) {
          const down = q.y + q.h + 8;
          top = down + ph <= vh - 8 ? down : Math.max(8, q.y - 8 - ph);
          hit = true;
        }
      }
      if (!hit) break;
    }
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    placed.push({x: left, y: top, w: pw, h: ph});
  }
};

/* ---- the coordinator: renders EVERY open panel, portals to body -------- */
export const DescPanels = memo(function DescPanels({theme}: {theme: string}) {
  const ids = useSyncExternalStore(subscribe, () => openIds);
  const rf = useReactFlow();
  /* ONE comparable string per concern (the RotateInternalsBridge pattern):
     title/desc of every node — the panel TEXT re-renders when a description
     is edited while its panel is open, and the prune effect re-runs when
     the board's node set changes (delete, board switch). DA-3 adds the
     paint fields: a swatch click while the panel is open repaints it. */
  const sig = useStore((s: {nodes: Node[]}) => s.nodes
    .map((n) => `${n.id}:${(n.data as {title?: string; desc?: string}).title ?? ''}:${(n.data as {desc?: string}).desc ?? ''}:${(n.data as {descPaint?: {bg?: string; fg?: string}}).descPaint?.bg ?? ''}:${(n.data as {descPaint?: {bg?: string; fg?: string}}).descPaint?.fg ?? ''}`)
    .join('|'));
  const heads = useRef(new Map<string, HTMLHeadingElement | null>());
  const prev = useRef<string[]>([]);

  /* prune ids whose node no longer exists — deleting a node closes ITS
     panel; switching board closes ALL of them (§v2 closing rules). */
  useEffect(() => {
    const liveIds = new Set(rf.getNodes().map((n) => n.id));
    for (const id of openIds) if (!liveIds.has(id)) removeDesc(id);
  }, [ids, sig, rf]);

  /* on open: promote the NEWLY opened panel into the browser's TOP LAYER
     (popover=manual — OUR Escape/outside/toggle paths stay the only close
     paths, the browser takes no light-dismiss), THEN focus its heading
     (APG's rule for long content — DESC-2 shipped this). Order matters: a
     closed popover is display:none, so showPopover must precede both the
     heading focus and positionAll's measurements. Where the API is missing
     the call is skipped and the panel renders exactly as before — the
     FALLBACK z-clamp in positionAll then keeps it above every node. */
  useLayoutEffect(() => {
    for (const id of ids) if (!prev.current.includes(id)) {
      const el = document.getElementById(`desc-panel-${id}`);
      if (el && typeof el.showPopover === 'function' && !el.matches(':popover-open')) {
        try { el.showPopover(); } catch { /* closed mid-flight — fallback rendering */ }
      }
      heads.current.get(id)?.focus();
    }
    prev.current = ids;
  }, [ids]);

  /* position pre-paint on every open-set change (no 0,0 flash — DESC-2). */
  useLayoutEffect(() => { positionAll(); }, [ids]);

  /* FOLLOW: while any panel is open, re-measure + reposition once per
     animation frame. Covers pan, zoom and node drags in one mechanism;
     style writes only, never animation. */
  useEffect(() => {
    if (!ids.length) return undefined;
    let alive = true;
    let raf = 0;
    const tick = () => { if (!alive) return; positionAll(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [ids.length > 0]);

  /* Escape + the outside CLICK (press+release ≤5 px — see header): one
     listener set for the whole set, mounted only while something is open. */
  useEffect(() => {
    if (!ids.length) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); e.stopPropagation();
      const doc = document;
      const focused = openIds.find((id) => doc.getElementById(`desc-panel-${id}`)?.contains(doc.activeElement));
      closeDesc(focused ?? openIds[openIds.length - 1]);
    };
    let down: {x: number; y: number} | null = null;
    const onDown = (e: PointerEvent) => { down = {x: e.clientX, y: e.clientY}; };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 5) return; /* a pan or a node drag, not a click */
      const t = e.target as Element | null;
      if (t?.closest?.('.desc-panel') || t?.closest?.('[data-desc-badge]')) return;
      closeAllDesc('pane'); /* pointer close: never seat the badge (BADGE-PTR) */
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointerup', onUp, true);
    };
  }, [ids.length > 0]);

  if (!ids.length) return null;
  const byId = new Map(rf.getNodes().map((n) => [n.id, n]));
  return createPortal(<>
    {ids.filter((id) => byId.has(id)).map((id) => {
      const d = (byId.get(id)!.data ?? {}) as {title?: string; desc?: string; descPaint?: {bg?: string; fg?: string}};
      /* DA-3 — the panel's OWN colours, resolved through the ONE vocabulary
         and handed to CSS as custom properties: the sheet's own rules fall
         back to the pre-card tokens when a key is absent (P6's "exactly the
         pre-card panel"), and the close button DERIVES from --pfg so it can
         never go illegible against a user-chosen background.
         PANEL-SOLID (t_7d98cf2a): the bg goes through panelPaint — a key
         stays its opaque theme token, an opaque literal passes through, a
         TRANSLUCENT literal is composited over the theme's canvas surface
         colour so NOTHING bleeds through; the sheet's fallback changed from
         the (never-declared, hence transparent) --panel to the OPAQUE
         --surface. A bg-ONLY paint derives --pfg through panelInk (theme
         --fg when it still reads ≥4.5:1, else the theme-invariant ink) —
         the SAME --pfg derivation the × hover uses. `theme` (the prop) is
         what makes the derivation re-run on a theme switch: this component
         is memo'd and its store does not hear theme changes. */
      const pbg = panelPaint(d.descPaint?.bg, theme);
      const pfg = descPaintVar(d.descPaint?.fg) ?? panelInk(pbg, theme);
      const paintStyle = (pbg || pfg
        ? {...(pbg ? {'--pbg': pbg} : {}), ...(pfg ? {'--pfg': pfg} : {})}
        : undefined) as React.CSSProperties;
      return (
        /* PANEL-TOP-LAYER: popover=manual puts the panel in the browser's
           TOP LAYER when shown — it paints above EVERY shape, overlay and
           z-index in the document by specification, no arithmetic to lose
           (the pre-fix z-index:2000 only won while the canvas wrapper's
           own z:0 stacking context stayed below it). The stylesheet folds
           `inset:auto;margin:0` into .desc-panel to cancel the UA popover
           defaults (inset:0 + margin:auto would re-centre the box); the
           screen-space anchor and geometry are unchanged. */
        <div key={id} id={`desc-panel-${id}`} className="desc-panel" role="dialog" aria-modal="false" popover="manual"
          aria-labelledby={`desc-panel-h-${id}`} style={paintStyle}>
          <h3 ref={(el) => { heads.current.set(id, el); }} id={`desc-panel-h-${id}`} className="desc-panel-h" tabIndex={-1}>
            {d.title}
          </h3>
          {/* DESC-4 — the ONE visible exit, FIRST focusable after the
              heading; Escape and the × both walk closeDesc (seat differs). */}
          {/* BADGE-PTR: the × sits on the pointer path, so a MOUSE close must
              not seat the badge; a KEYBOARD activation (click detail 0 —
              Enter/Space on the focused button) still walks the badge seat,
              which is exactly the keyboard contract E3/Z4-1 pin. */}
          <button type="button" className="desc-close" aria-label="Close additional description"
            onClick={(e) => closeDesc(id, e.detail === 0 ? 'badge' : 'pane')}>×</button>
          {/* plain text, newlines preserved (white-space: pre-line) —
              markdown is OUT of scope by the spec's own declaration */}
          <div className="desc-panel-body">{d.desc}</div>
        </div>);
    })}
  </>, document.body);
});
