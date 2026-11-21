/* DescDot.tsx — READONLY-DOT (task t_c1564804, 2026-11-13): the READ-ONLY
 * rest cue. After BADGE-ON-SELECT removed the hover reveal, a read-only
 * viewer had NO way to know which shapes carry a definition — the ⓘ only
 * exists after a click (Harvey's approved consequence fix).
 *
 * THE RULE, all of it (one component, mounted twice — App with on={readOnly}
 * and the /embed tree; there is no second implementation):
 *   read-only (Shift+2 review, the #b= share view — useShareView sets the
 *   SAME readOnly state — and the embed viewer) AND a non-empty `desc` AND
 *   the node's measured box ≥60px on both axes AND zoom ≥0.4 (DescBadge's
 *   own DESC_MIN_PX/DESC_MIN_ZOOM floors, imported — the dot never has a
 *   suppression rule the badge does not). Table ROWS never qualify by
 *   construction: rows are DOM rows inside TableNode (TableRowList), never
 *   store nodes — the filter below cannot see them. NEVER in edit mode:
 *   `on` is false there and the host does not mount at all (zero elements
 *   in the DOM, R1).
 *
 * IT IS A SIGNAL, NOT A CONTROL: a 5px dot at the card's top-right corner,
 * inset 6px, var(--dim) at opacity .55 — the badge ghost glyph's exact
 * rest weight (`.desc-badge{color:var(--dim);opacity:.55}`), so it cannot
 * read as a button. pointer-events:none everywhere, aria-hidden, no
 * tabindex, no tooltip; elementFromPoint at its centre returns the NODE
 * (R4).
 *
 * GEOMETRY (the NodeChrome frame pattern, measured): each frame anchors at
 * the CARD's gBCR centre (a goblin card auto-fits wider than the RF
 * wrapper — flow placement from node.measured would drift), the inner box
 * carries the card's layout size and the SAME transform chain the card
 * paints (rotate(paintRotation) scale(k), origin 50% 50%), and the dot
 * sits in that LOCAL box at top:6/right:6 — so it orbits and shrinks with
 * the card at every zoom and rotation, flow-constant like the badge (a
 * screen-constant dot would crowd a small card exactly the way the 24k
 * badge did below zoom 0.571). One rAF pass re-measures every frame while
 * any exists (pan, zoom, drags, live rotation, auto-fit growth); style
 * writes only, never animation. Absolutely positioned outside the card:
 * the card's rect is byte-identical with and without the dot (R3).
 *
 * PAINT ORDER, not arithmetic: the host is a body-level fixed layer at
 * z-index 1500 — RF v12 clamps the whole canvas under the wrapper's inline
 * zIndex 0 (the PANEL-TOP-LAYER measurement), so any body z>0 clears every
 * stored node z; 1500 stays BELOW the desc panels (2000) and the top-layer
 * chrome, which cover the dot as dialogs should. The dot never intersects
 * the badge or any grip: those sit on/above the grip line OUTSIDE the
 * card, the dot is 6px INSIDE it (R5).
 *
 * unisurf-desc-panel R1–R6 is the proof (RED on c70638b: R2 expected=19
 * got=0 — no dots anywhere). */
import {memo, useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import {useReactFlow, useStore, type Node} from '@xyflow/react';
import {paintRotation} from '../canvas/rotation';
import {DESC_MIN_PX, DESC_MIN_ZOOM} from './DescBadge';

/** the dot's own box and its inset from the card's top-right (flow px) */
const DOT_PX = 5, INSET_PX = 6;

/* the store's zoom only — subscribing to the whole transform would
   re-render on every pan; transform[2] is the scale. */
const zoomSelector = (s: {transform: [number, number, number]}) => s.transform[2];

/* The card root under the RF wrapper (goblin .node, table .tnode, label,
   customshape) — the SAME element NodeChrome anchors to. firstElementChild
   is the card on every kind; the wrapper only carries RF's own chrome. */
const cardOf = (id: string): HTMLElement | null =>
  ((document.querySelector(`.react-flow__node[data-id="${id}"]`)?.firstElementChild ??
    null) as HTMLElement | null);

export const DescDotLayer = memo(function DescDotLayer({on}: {on: boolean}) {
  const rf = useReactFlow();
  const zoom = useStore(zoomSelector);
  const nodes = useStore((s: {nodes: Node[]}) => s.nodes);
  const framesRef = useRef(new Map<string, HTMLDivElement | null>());

  /* the WHOLE rule in one filter — `on` false, sub-60px boxes and the
     sub-0.4 zoom all unmount the host entirely (suppression is not hiding) */
  const entries = on && zoom >= DESC_MIN_ZOOM
    ? nodes.filter(n => {
        const d = (n.data ?? {}) as {desc?: string};
        return !!d.desc &&
          (n.measured?.width ?? 0) >= DESC_MIN_PX && (n.measured?.height ?? 0) >= DESC_MIN_PX;
      })
    : [];

  /* FOLLOW (one positioning pass while any frame exists): measure each
     frame's CARD, anchor the frame at the card's rotated-rect centre, size
     and turn the inner box from the card's layout box + paintRotation. */
  const active = entries.length > 0;
  useEffect(() => {
    if (!active) return;
    let alive = true;
    let raf = 0;
    const place = () => {
      if (!alive) return;
      const k = rf.getZoom();
      for (const [id, frame] of framesRef.current) {
        if (!frame) continue;
        const n = rf.getNodes().find(m => m.id === id);
        const card = cardOf(id);
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
  }, [active, rf]);

  if (!active) return null;
  return createPortal(
    <div data-desc-dot-layer="1" aria-hidden="true"
      style={{position: 'fixed', top: 0, left: 0, width: 0, height: 0,
        overflow: 'visible', pointerEvents: 'none', zIndex: 1500}}>
      {entries.map(n => (
        <div key={n.id} data-desc-dot-frame={n.id}
          ref={f => { framesRef.current.set(n.id, f); }}
          style={{position: 'absolute', width: 0, height: 0, pointerEvents: 'none'}}>
          <div style={{position: 'absolute', pointerEvents: 'none', transformOrigin: '50% 50%'}}>
            <div data-desc-dot={n.id} aria-hidden="true"
              style={{position: 'absolute', top: INSET_PX, right: INSET_PX,
                width: DOT_PX, height: DOT_PX, borderRadius: '50%',
                background: 'var(--dim)', opacity: 0.55}} />
          </div>
        </div>
      ))}
    </div>, document.body);
});
