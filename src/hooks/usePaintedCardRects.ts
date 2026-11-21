import {useLayoutEffect, useState} from 'react';

/**
 * SELBOX-FIT (t_b9215bd1) — the PAINTED card extents of the current
 * selection, in flow units.
 *
 * RF's `measured` is the WRAPPER box; a goblin card auto-fits its content
 * and paints taller/wider than that wrapper (probe-selbox4: a wrapping
 * note painted 207.1x410.9 vs its 200x60 wrapper). This hook reads the
 * painted card root — `.react-flow__node[data-id] > :first-child`, the
 * same measurement the app's other chrome uses — and reports per
 * selected id the card's offset from the UNROTATED wrapper origin plus
 * its size, divided by the live zoom (screen -> flow). The card root
 * carries the inline rotate transform, so its client rect is already the
 * rotated AABB — no extra rotation math is needed here.
 *
 * PERF CONTRACT: the DOM is read only when `trigger` changes — a
 * selection-set / measured-size / rotation change — or zoom changes,
 * never per render and never per pointer move (node POSITIONS are
 * deliberately excluded from the trigger; a drag re-unions from the
 * cached map). Callers fall back to the measured rotated extent for a
 * card that is not in the DOM (virtualised/offscreen).
 * UNISURF-LOCK-SEAM: this module deliberately holds NO React Flow store
 * access — the caller (SelectionBox, a canvas-owning file) subscribes and
 * passes both inputs, so the instance-holder closed set does not grow.
 * GROUP-BOUNDARY-INSIDE (t_42fb2888): `selector` lets the inside-boundary
 * measure members that are NOT selected (the selection-only default cannot
 * see them); it is part of the effect key, so a changed membership re-reads.
 */
export type PaintedRect = {ox: number; oy: number; w: number; h: number};
export type PaintedMap = Record<string, PaintedRect>;

export function usePaintedCardRects(
  trigger: string,
  zoom: number,
  selector = '.react-flow__node.selected[data-id]',
): PaintedMap {
  const [painted, setPainted] = useState<PaintedMap>({});
  useLayoutEffect(() => {
    if (!trigger) return;
    const next: PaintedMap = {};
    document.querySelectorAll<HTMLElement>(selector).forEach(w => {
      const card = w.firstElementChild as HTMLElement | null;
      if (!card) return;
      const wr = w.getBoundingClientRect();
      const cr = card.getBoundingClientRect();
      next[w.dataset.id as string] = {
        ox: (cr.left - wr.left) / zoom,
        oy: (cr.top - wr.top) / zoom,
        w: cr.width / zoom,
        h: cr.height / zoom,
      };
    });
    const key = JSON.stringify(next);
    setPainted(prev => (JSON.stringify(prev) === key ? prev : next));
  }, [trigger, zoom, selector]);
  return painted;
}
