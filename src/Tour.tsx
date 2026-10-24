import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';

/** One guided-tour step. `sel` is a CSS selector for the target element;
 *  a step without `sel` renders centred; a step whose target is missing is
 *  skipped automatically. */
export type TourStep = {
  sel?: string;
  title: string;
  body: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to Diagram Studio',
    body: 'Draw your system as boxes and arrows. Everything autosaves.',
  },
  {
    sel: '.boards-btn',
    title: 'Board menu',
    body: 'Everything lives in a board. Create as many as you want; rename, duplicate or delete from here.',
  },
  {
    sel: '.palette',
    title: 'Shape palette',
    body: 'Drag any shape onto the canvas, or double-click it to drop it in the middle. Database, Queue, Service… each shape has an architectural meaning.',
  },
  {
    sel: '.canvas-wrap',
    title: 'Canvas',
    body: 'Drop shapes here. Scroll to move around the canvas, Ctrl/Cmd+scroll (or pinch) to zoom, drag on empty space to box-select, and double-click empty space to search and insert a node.',
  },
  {
    sel: '.toolbar',
    title: 'Toolbar',
    body: 'Undo, snap, alignment guides, auto-layout, and Export (PNG / SVG / JSON) — and Settings, where the theme, canvas and keyboard options live.',
  },
  {
    sel: '.panel.right',
    title: 'Inspector',
    body: 'Select a node to edit its text, icon and color. Select an arrow to edit its label, style and flow animation.',
  },
  {
    sel: '.react-flow__edge',
    title: 'Arrows + flow',
    body: 'Arrows show the flow. Give them a label, or animate them (dots / dash / pulse / icon) to show data moving.',
  },
  {
    sel: '.help-btn',
    title: 'Help',
    body: 'Press ? any time for the shortcut list — and to replay this tour.',
  },
];

const PAD = 6;
const CARD_W = 340;

/**
 * H1 — guided tour overlay: dims the whole app except the current target
 * (box-shadow spotlight trick), tooltip card anchored to the target with
 * auto-flip / side placement when the viewport would overflow.
 */
export default function Tour({onDone, onSkip}: {onDone: () => void; onSkip: () => void}) {
  const [idx, setIdx] = useState(0);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [spot, setSpot] = useState<{x: number; y: number; w: number; h: number} | null>(null);
  const [cardPos, setCardPos] = useState<{top: number; left: number} | null>(null);
  const cardH = useRef(0);

  /** Resolve the target for a step index; null for a centred (no-selector) step. */
  const resolve = useCallback((i: number): HTMLElement | null => {
    const st = TOUR_STEPS[i];
    if (!st || !st.sel) return null;
    const el = document.querySelector<HTMLElement>(st.sel);
    return el ?? null;
  }, []);

  // On step change: measure the target, auto-skipping steps whose target is
  // missing (scan forward first, then backward). If nothing resolves, finish.
  useEffect(() => {
    let i = idx;
    let found: HTMLElement | null = null;
    for (; i < TOUR_STEPS.length; i++) {
      const st = TOUR_STEPS[i];
      if (!st.sel) { break; } // centred step always works
      const el = resolve(i);
      if (el) { found = el; break; }
    }
    if (i >= TOUR_STEPS.length) {
      // nothing forward — scan backward
      for (let j = idx - 1; j >= 0; j--) {
        const st = TOUR_STEPS[j];
        if (!st.sel) { i = j; found = null; break; }
        const el = resolve(j);
        if (el) { i = j; found = el; break; }
      }
    }
    if (i >= TOUR_STEPS.length) { onDone(); return; }
    if (i !== idx) { setIdx(i); return; }
    setTarget(found);
  }, [idx, resolve, onDone]);

  const step = TOUR_STEPS[idx];

  // (re)measure on target / step change, resize and scroll.
  const measure = useCallback(() => {
    let r: {x: number; y: number; w: number; h: number} | null = null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (target) {
      const b = target.getBoundingClientRect();
      // I1: clamp the spotlight (and its padding) into the viewport. Without
      // this, a target larger than the window pushes the ring's box-shadow
      // spotlight off-screen, so only part of its border is visible.
      const M = 4; // keep the full ring >= 4px inside the window
      const padX = Math.max(0, Math.min(PAD, b.x - M, vw - M - (b.x + b.width)));
      const padY = Math.max(0, Math.min(PAD, b.y - M, vh - M - (b.y + b.height)));
      let sx = Math.min(Math.max(M, b.x - padX), vw - M);
      let sy = Math.min(Math.max(M, b.y - padY), vh - M);
      // If the target itself extends past the viewport, inset the spotlight
      // so the ring stays fully inside the window.
      let sw = Math.max(0, Math.min(b.width + padX * 2, vw - M - sx));
      let sh = Math.max(0, Math.min(b.height + padY * 2, vh - M - sy));
      r = {x: sx, y: sy, w: sw, h: sh};
      setSpot(r);
    } else {
      setSpot(null);
    }
    const H = cardH.current || 200;
    if (!r) {
      // centred card
      setCardPos({top: Math.max(48, vh / 2 - H / 2), left: vw / 2 - CARD_W / 2});
      return;
    }
    let left = Math.min(Math.max(12, r.x + r.w / 2 - CARD_W / 2), vw - CARD_W - 12);
    let top = r.y + r.h + 14;
    if (top + H > vh - 12) {
      const above = r.y - H - 14;
      if (above >= 12) {
        top = above; // flip above
      } else {
        // side placement
        top = Math.min(Math.max(12, r.y + r.h / 2 - H / 2), Math.max(12, vh - H - 12));
        const rightEdge = r.x + r.w;
        if (rightEdge + CARD_W + 14 <= vw - 12) left = rightEdge + 14;
        else left = Math.max(12, r.x - CARD_W - 14);
      }
    }
    left = Math.min(Math.max(12, left), Math.max(12, vw - CARD_W - 12));
    setCardPos({top, left});
  }, [target]);

  useLayoutEffect(() => { measure(); }, [measure, idx]);

  useEffect(() => {
    const re = () => measure();
    window.addEventListener('resize', re);
    window.addEventListener('scroll', re, true);
    return () => {
      window.removeEventListener('resize', re);
      window.removeEventListener('scroll', re, true);
    };
  }, [measure]);

  const last = idx === TOUR_STEPS.length - 1;
  const next = useCallback(() => {
    if (last) onDone();
    else setIdx(i => i + 1);
  }, [last, onDone]);
  const back = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);

  // Keyboard: →/Enter next, ← back, Esc skip. Registered with capture so the
  // tour wins over the app's own shortcuts while it is open.
  const nextRef = useRef(next); nextRef.current = next;
  const backRef = useRef(back); backRef.current = back;
  const skipRef = useRef(onSkip); skipRef.current = onSkip;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); skipRef.current(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); nextRef.current(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); backRef.current(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div className="tour-overlay" aria-hidden={false}>
      {spot && (
        <div className="tour-spot" style={{left: spot.x, top: spot.y, width: spot.w, height: spot.h}} />
      )}
      {cardPos && (
        <div
          className="tour-card"
          ref={el => {
            if (el && Math.abs(el.offsetHeight - cardH.current) > 1) {
              cardH.current = el.offsetHeight;
              measure();
            }
          }}
          style={{top: cardPos.top, left: cardPos.left, visibility: cardH.current ? undefined : 'hidden'}}
        >
          <div className="tour-count">{idx + 1} / {TOUR_STEPS.length}</div>
          <div className="tour-title">{step.title}</div>
          <div className="tour-body">{step.body}</div>
          <div className="tour-actions">
            <button type="button" className="tour-btn tour-replay" onClick={() => setIdx(0)} title="Restart from the first step">
              Replay tour
            </button>
            <span style={{flex: 1}} />
            <button type="button" className="tour-btn" onClick={onSkip}>Skip tour</button>
            <button type="button" className="tour-btn" disabled={idx === 0} onClick={back}>Back</button>
            <button type="button" className="tour-btn tour-primary" onClick={next} autoFocus>
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}