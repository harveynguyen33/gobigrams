/* CodeRailSplit.tsx — CODE-RAIL-WIDTH (task t_b3986041, 2026-11-17).
 *
 * The rail's resize separator: a vertically-oriented `role="separator"` on the
 * pane's INNER (canvas-facing) edge. It owns only the GESTURE — the width lives
 * in `useRailWidth` and the pane's own width is the grid column, so this file
 * writes no geometry of its own:
 *
 *   · drag        → `preview` per move, `commit` on release (one store write);
 *   · ArrowLeft / ArrowRight → ±16px (Shift = ±64px), committed at once;
 *   · Home / End  → the clamp window's own ends;
 *   · double-click → the shipped default width.
 *
 * The ARIA window-splitter shape is what makes it keyboard-reachable: focusable,
 * `aria-valuemin`/`aria-valuemax`/`aria-valuenow` kept in step with the width, so
 * a screen reader announces a number that actually changed.
 */
import type {PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent} from 'react';
import {useEffect, useRef} from 'react';
import {RAIL_MAX, RAIL_MIN, railMaxFor, type RailWidth} from '../hooks/useRailWidth';

/** one arrow press; shift takes a coarser step (a palette-width, not a hair). */
const STEP = 16;
const BIG_STEP = 64;

export default function CodeRailSplit({rail}: {rail: RailWidth}) {
  /* the live bounds come from the container the rail actually sits in — the pane
     is grid column 2 of .canvas-wrap, so the wrapper's right edge is the rail's
     own right edge and `wrap − pointerX` IS the width the user is drawing. */
  const boundsOf = (el: Element) => {
    const box = el.closest('.canvas-wrap')?.getBoundingClientRect();
    return {wrapWidth: box?.width, right: box?.right};
  };

  /* THE MAXIMUM IS LIVE, NOT ADVISORY: a width stored on a 2560px monitor would
     otherwise starve the canvas on a 1280px one (700px of a 760px wrap). The
     stored preference is NOT rewritten — this is a DISPLAY clamp, so the width
     the user chose comes back when the window does. */
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef(rail);
  latest.current = rail;
  useEffect(() => {
    const wrap = root.current?.closest('.canvas-wrap');
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      const box = wrap.getBoundingClientRect();
      if (!box.width || latest.current.width <= railMaxFor(box.width)) return;
      latest.current.preview(railMaxFor(box.width), box.width);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    fit();
    return () => ro.disconnect();
  }, []);

  const lastPress = useRef(0);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    /* a DOUBLE-CLICK resets, detected HERE: `preventDefault()` on pointerdown
     * suppresses the compatibility mouse events (so React's `onDoubleClick` never
     * fires once the drag handler prevents the default) and PointerEvent carries no
     * click count — measured: `e.detail` is 0 on a pointerdown. */
    const now = Date.now();
    if (now - lastPress.current < 400) { lastPress.current = 0; e.preventDefault(); rail.reset(); return; }
    lastPress.current = now;
    e.preventDefault();
    const {wrapWidth, right} = boundsOf(e.currentTarget);
    const x0 = e.clientX;
    let moved = false;
    rail.setDragging(true);
    const move = (ev: PointerEvent) => {
      if (right == null || Math.abs(ev.clientX - x0) < 1) return;
      moved = true;
      rail.preview(right - ev.clientX, wrapWidth);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      /* a PRESS that never moved is a click (the first half of a double-click), and
       * committing it would rewrite the width by the grab offset — measured: a plain
       * click at the strip's centre narrowed the rail by 3px per click. */
      if (moved && right != null) rail.commit(right - ev.clientX, wrapWidth);
      rail.setDragging(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const {wrapWidth} = boundsOf(e.currentTarget);
    const step = e.shiftKey ? BIG_STEP : STEP;
    switch (e.key) {
      /* the separator is the rail's LEFT edge: moving it left WIDENS the rail. */
      case 'ArrowLeft': rail.step(step, wrapWidth); break;
      case 'ArrowRight': rail.step(-step, wrapWidth); break;
      case 'Home': rail.commit(RAIL_MIN, wrapWidth); break;
      case 'End': rail.commit(RAIL_MAX, wrapWidth); break;
      default: return;
    }
    e.preventDefault();
  };

  return (
    <div
      ref={root}
      className={`cp-split${rail.dragging ? ' dragging' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the code pane"
      aria-valuemin={RAIL_MIN}
      aria-valuemax={RAIL_MAX}
      aria-valuenow={Math.round(rail.width)}
      tabIndex={0}
      data-cp-split
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={() => rail.reset()}
    />
  );
}
