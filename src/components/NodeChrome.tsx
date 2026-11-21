/* NodeChrome.tsx — CHROME-ABOVE (t_31a9bec9, 2026-11-13): the selected
 * node's ⓘ badge, painted in a layer above EVERY shape. SEL-CHROME-UNIFY
 * (t_e479c12d, 2026-11-19): the rotate grip and the lock chip LEFT this host
 * for the shared selection pill (GroupRotateGrip mounts for selCount >= 1 now)
 * — the host remains because the badge is CARD-scoped and must beat a stored
 * 5000 neighbour the way a z constant never can.
 *
 * THE DEFECT this host was built for: both controls were children of the node
 * wrapper (.ds-rotate-grip z:3, .desc-badge z:6 INSIDE the node), so a node is
 * one stacking context — any neighbour with a higher painted z-index (the board
 * stores per-node `zIndex`, Arrange can stack one at 5000) covered the
 * SELECTED node's chrome even under 'lift' (the +1000 selection bump is
 * zIndex + (selected ? 1000 : 0), @xyflow/system calculateZ — a stored-0
 * node lifts to 1000 and still loses). Measured red (unisurf-chrome-layer
 * C1 on fde2fc9): elementFromPoint at both centres → the 5000 neighbour's
 * .node-body, and a drag at the covered grip rotated nothing.
 *
 * THE MECHANISM — the SAME one the description panels use since
 * PANEL-TOP-LAYER: a `popover="manual"` host opened with showPopover(), so
 * the whole cluster paints in the browser's TOP LAYER, above every shape,
 * overlay and z-index BY SPECIFICATION (not by a bigger magic number — a
 * stored node z can be any number, arithmetic never wins that race).
 * Fallback where showPopover is missing: the host renders as before and the
 * promoting effect sets its inline z-index ONE ABOVE the board's highest
 * computed node z (a comparison, never a constant — DescPanels' rule).
 *
 * ONE CLUSTER, ONE POSITION — ANCHORED TO THE CARD, NOT THE WRAPPER
 * (measured, X3): the controls' local CSS (`left:50%`, `top:-30px`,
 * `calc(50% + 15px)`) used to resolve against the CARD root, and a goblin
 * card AUTO-FITS from text metrics — it can be 30 px wider than the RF
 * wrapper (a seeded 160px wrapper grew a 190px card), so flow-geometry
 * placement from `node.measured` drifts by exactly that overflow. Each
 * frame therefore measures the card element itself: the gBCR CENTRE (the
 * rotation-invariant point of the rotated box) anchors the frame, and
 * offsetWidth/offsetHeight (layout, untransformed) size the inner box. A
 * rAF pass re-measures and repositions while any frame exists — the
 * DescPanels FOLLOW pattern: one loop covers pan, zoom, node drags, live
 * rotation AND auto-fit growth (a title edit can widen the card without
 * moving `node.measured`). The inner box carries the SAME transform chain
 * the card root does — rotate(paintRotation) scale(k), origin 50% 50% — so
 * the unchanged RotateGrip and DescBadge arrive at the same screen pixels,
 * orbiting the node when it rotates, shrinking with the zoom.
 *
 * POINTER DISCIPLINE: the host and every frame are pointer-events:none —
 * only the badge re-enables hits (display:contents wrappers inherit
 * `auto` down to the button), so the empty area around the cluster passes
 * clicks through to the canvas (C6). NOTHING selected and no panel open →
 * no host at all: zero chrome elements in the DOM (BADGE-ON-SELECT's rule).
 */
import {memo, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {useReactFlow, useStore} from '@xyflow/react';
import {paintRotation} from '../canvas/rotation';
import {DescBadge} from './DescBadge';
import {useDescOpenList} from './DescPanels';

/* display:contents keeps the wrapper box-less; pointer-events is inherited,
   so the control inside computes `auto` while its frame stays click-through */
const HIT = {pointerEvents: 'auto', display: 'contents'} as const;

/* The card root under the RF wrapper — the element the controls' local CSS
   used to resolve against (goblin .node, table .tnode, label, customshape).
   firstElementChild is the card on every kind (each renderer returns ONE
   root div); the wrapper itself only carries RF's own chrome. */
const cardOf = (root: Element | null, id: string): HTMLElement | null =>
  ((root ?? document).querySelector(`.react-flow__node[data-id="${id}"]`)?.firstElementChild ??
   null) as HTMLElement | null;

export const NodeChrome = memo(function NodeChrome() {
  const rf = useReactFlow();
  const openIds = useDescOpenList();
  /* frame retention while the badge HOLDS FOCUS (DESC-5's belt seats focus
     on the badge before the state flip — the frame must survive it) */
  const hostRef = useRef<HTMLDivElement | null>(null);
  const framesRef = useRef(new Map<string, HTMLDivElement | null>());
  const [focusId, setFocusId] = useState<string | null>(null);

  const sig = useStore(s => s.nodes
      /* CHROME-GROUPED (t_39ac5568): children TOO — a grouped card's wrapper
       * is a DOM sibling translated by internals.positionAbsolute, so the
       * card-measured frames below are already at the right pixels. */
      /* GROUP-LOGICAL (t_eb8fab7e): a selected RF logical group gets NO chrome — its card is GroupNode's null render, so a badge would float unanchored at the host origin */
      .filter(n => (n.selected && n.type !== 'group') || openIds.includes(n.id) || n.id === focusId)
      .map(n => `${n.id}:${n.selected ? 1 : 0}:${paintRotation((n.data ?? {}) as {rotation?: number; shape?: string})}`)
      .join('|'));
  const nodes = useStore(s => s.nodes);

  /* the popover lifecycle: promote on mount, and where the API is missing
     set the fallback z ONE ABOVE the board's highest computed node z */
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    if (typeof el.showPopover === 'function' && !el.matches(':popover-open')) {
      try { el.showPopover(); } catch { /* closed mid-flight — fallback below */ }
    }
    if (!el.matches(':popover-open')) {
      let zMax = -1;
      for (const nd of document.querySelectorAll('.react-flow__node')) {
        const z = parseFloat(getComputedStyle(nd).zIndex);
        if (Number.isFinite(z) && z > zMax) zMax = z;
      }
      el.style.zIndex = String(zMax + 1);
    } else if (el.style.zIndex) el.style.zIndex = '';
  }, [sig]);

  /* FOLLOW — the one positioning pass (DescPanels' pattern): measure each
     frame's CARD, anchor the frame at the card's rotated-rect CENTRE (the
     rotation-invariant point), size/turn the inner box from the card's
     layout box + paintRotation, scale by the live zoom. Style writes only,
     never animation; covers pan, zoom, drags, live rotation and auto-fit
     growth in one loop. Runs while any frame exists. */
  useEffect(() => {
    let alive = true;
    let raf = 0;
    const place = () => {
      if (!alive) return;
      const k = rf.getZoom();
      const root = hostRef.current?.closest('.react-flow') ?? null;
      for (const [id, frame] of framesRef.current) {
        if (!frame) continue;
        const n = rf.getNodes().find(m => m.id === id);
        const card = cardOf(root, id);
        if (!n || !card) continue;
        const r = card.getBoundingClientRect();
        const rot = paintRotation((n.data ?? {}) as {rotation?: number; shape?: string});
        const w = card.offsetWidth, h = card.offsetHeight;
        frame.style.left = `${r.left + r.width / 2}px`;
        frame.style.top = `${r.top + r.height / 2}px`;
        const box = frame.firstElementChild as HTMLElement | null;
        if (box) {
          box.style.width = `${w}px`;
          box.style.height = `${h}px`;
          box.style.left = `${-w / 2}px`;
          box.style.top = `${-h / 2}px`;
          box.style.transform = `rotate(${rot}deg) scale(${k})`;
        }
      }
      raf = requestAnimationFrame(place);
    };
    raf = requestAnimationFrame(place);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [sig, rf]);

  const entries = sig ? sig.split('|') : [];
  if (!entries.length) return null;

  return (
    /* the persistent anchor (always mounted, box-less) gives the host its
       .react-flow scope even before the first frame exists */
    <div aria-hidden="true" style={{position: 'absolute', width: 0, height: 0, pointerEvents: 'none'}}>
      <div
        ref={hostRef}
        popover="manual"
        data-chrome-layer="1"
        style={{
          position: 'fixed', inset: 'auto', margin: 0, padding: 0,
          width: 0, height: 0, border: 'none', background: 'transparent',
          overflow: 'visible', pointerEvents: 'none',
        }}
        onFocusCapture={(e) => {
          const f = (e.target as HTMLElement).closest('[data-chrome-node]');
          if (f) setFocusId(f.getAttribute('data-chrome-node'));
        }}
        onBlurCapture={() => {
          setTimeout(() => {
            if (!hostRef.current?.contains(document.activeElement)) setFocusId(null);
          }, 0);
        }}
      >
        {entries.map(e => {
          const at = e.indexOf(':');
          const id = e.slice(0, at);
          const [sel] = e.slice(at + 1).split(':').map(Number);
          const n = nodes.find(m => m.id === id);
          const d = (n?.data ?? {}) as {title?: string; name?: string; desc?: string};
          const badge = d.desc ? (
            <div style={HIT}>
              <DescBadge id={id} title={d.title ?? d.name ?? ''} desc={d.desc}
                selected={sel === 1} w={n?.measured?.width} h={n?.measured?.height} />
            </div>
          ) : null;
          if (!badge) return null;
          return (
            <div key={id} data-chrome-node={id} ref={f => { framesRef.current.set(id, f); }}
              style={{position: 'absolute', width: 0, height: 0, pointerEvents: 'none'}}>
              <div style={{
                position: 'absolute', pointerEvents: 'none',
                transformOrigin: '50% 50%',
              }}>
                {badge}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
