/* ROUND BN-4 — one slice of the former src/InspectorPickers.tsx (split
   verbatim, 2026-10-25 along the section banners the file declares).
   src/InspectorPickers.tsx re-exports the union, so no importer changes. */
import {useEffect, useLayoutEffect, useRef, useState} from 'react';

/* ===========================================================================
   ROUND AB, ITEM 3 — KEEPING AN OPEN POPOVER INSIDE THE VIEWPORT.

   Measured live before this round: the shape popover's `bottom` was 601 against
   a 577px viewport, so its last rows were clipped and unclickable. The panel is
   `overflow: auto`, so the popover cannot simply be scrolled into view — it has
   to be LIFTED, or shortened, or flipped.

   THE TECHNIQUE IS THE ONE THIS PROJECT ALREADY USES, borrowed from
   `src/ContextMenu.tsx:62-69`: read a real `getBoundingClientRect()` after
   mount and move the box by the overflow it reports. What is NOT reused is the
   right-click menu's "flip above the trigger when there is no room below": that
   menu is portalled at the pointer and can flip freely, while an inspector
   popover is anchored to a trigger that may sit anywhere in a 500px panel, so
   an unconditional flip would put the popover over the controls ABOVE the row —
   in a field that is not its own. Lifting keeps it attached to its trigger and
   keeps the scrollable list reachable; it is the same measurement, applied to
   the axis the panel can actually act on.

   A NEGATIVE `margin-top` is what moves it, and that is deliberate:
   `top: calc(100% + 6px)` is the anchor that ties the popover to its trigger,
   and overriding `top` would detach it. The sheet declares the lift as a
   margin, the sheet's own `max-height` rules (`.insp-opt-list`,
   `.insp-shape-list`, `.insp-pop`) cap and scroll the BODY, and this function
   only supplies the offset — so the three mechanisms compose instead of
   competing. The two guards below always apply, so the popover stays inside the
   viewport at ANY viewport height, not only the `dvh` ones the sheet can state:

     (1) the box must not reach below the viewport floor (`innerHeight - pad`);
     (2) it must not cover the trigger it hangs from — a box lifted past its own
         button would hide the control the user just clicked.

   `lift` is clamped at 0, so a popover with room below it is never moved at
   all, and the placement is recomputed on every open and on every scroll or
   resize while it is open — at the real layout size of the list the current
   search term produced. */
const POPOVER_PAD = 8;
/** The popover's own offset from its trigger — `top: calc(100% + 6px)` in
 *  `styles.css`, stated here because the placement is computed against the
 *  UNPLACED position. */
const POPOVER_GAP = 6;
/** Which side of the trigger the popover sits on, and how far it is shifted
 *  back toward the viewport from that side. `shift` is 0 for the ordinary case
 *  (the whole popover fits where it is). */
type PopoverPlacement = {above: boolean; shift: number};

/**
 * The measured placement of an open popover, relative to the VIEWPORT.
 *
 * WHY THE ANCHOR AND NOT THE POPOVER'S OWN RECT. Everything below is derived
 * from the TRIGGER's rect (the `.icon-field` wrapper, `box.parentElement`) plus
 * the popover's HEIGHT — never from the popover's current top. That matters
 * because the result decides the popover's own position: measuring the shifted
 * box would make the placement feed back on itself (shift it once and the next
 * measurement asks for zero), which is an oscillation, not a fix. Height and
 * the trigger's rect are both mode-independent, so this function is idempotent.
 */
export function popoverPlacement(box: HTMLElement | null): PopoverPlacement {
  if (!box) return {above: false, shift: 0};
  const rect = box.getBoundingClientRect();
  const anchor = box.parentElement?.getBoundingClientRect() ?? rect;
  const vh = window.innerHeight;
  const h = rect.height;
  const floor = vh - POPOVER_PAD;

  const belowTop = anchor.bottom + POPOVER_GAP;
  const belowOverflow = belowTop + h - floor;
  const aboveBottom = anchor.top - POPOVER_GAP;
  const aboveOverflow = POPOVER_PAD - (aboveBottom - h);

  /* (1) IT FITS BELOW — the normal case, and the one that must not move. */
  if (belowOverflow <= 0) return {above: false, shift: 0};
  /* (2) IT DOES NOT FIT BELOW BUT IT FITS ABOVE — FLIP, which is the
   *     established behaviour for a panel whose trigger sits low in a short
   *     viewport. `bottom: calc(100% + 6px)` in `.icon-pop` is the existing
   *     anchored-above idiom; the flip only chooses it. */
  if (aboveOverflow <= 0) return {above: true, shift: 0};
  /* (3) NEITHER SIDE FITS — the viewport is shorter than the popover. Take the
   *     roomier side and shift the remainder back inside, clamped so the
   *     popover cannot trade a clipped bottom for a clipped top. The list caps
   *     (`min(60dvh, 260px)` on `.insp-opt-list` / `.insp-shape-list`) are what
   *     keep case (3) rare. */
  if (belowOverflow <= aboveOverflow) {
    return {above: false, shift: Math.max(0, Math.min(belowOverflow, belowTop - POPOVER_PAD))};
  }
  return {above: true, shift: Math.max(0, Math.min(aboveOverflow, floor - aboveBottom))};
}

/** The placement as the inline style the popover wears.
 *
 *  BELOW is the class's own `top: calc(100% + 6px)`; ABOVE sets `top: auto`
 *  and `bottom: calc(100% + 6px)` — `top: auto` is not optional, because an
 *  absolutely-positioned box with BOTH `top` and `bottom` set and `height: auto`
 *  would STRETCH between them instead of hanging off the trigger.
 *
 *  The shift is a MARGIN, not a `top`/`bottom` value: the anchor is what keeps
 *  the popover tied to its trigger, and overriding it would detach the popover
 *  from the control it belongs to. A negative `margin-top` moves a `top`-anchored
 *  box up; a negative `margin-bottom` moves a `bottom`-anchored box down. */
export const placementStyle = ({above, shift}: PopoverPlacement) => above
  ? {top: 'auto', bottom: `calc(100% + ${POPOVER_GAP}px)`, marginTop: 0, marginBottom: -shift}
  : {top: `calc(100% + ${POPOVER_GAP}px)`, bottom: 'auto', marginTop: -shift, marginBottom: 0};

/** `useLayoutEffect` is the right hook in the browser (measure and place BEFORE
 *  the first paint, so a clipped popover is never painted) and a no-op warning
 *  on the server, where `checks/package-p-render-check.mjs` renders these
 *  components. The guard is the standard one, so the SSR pass stays silent and
 *  the browser pass still measures pre-paint. */
const useMeasure = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** One hook per popover component: the ref to measure, and the placement to
 *  apply. `dep` is whatever else changes the popover's HEIGHT — the result
 *  count, for the shape picker — so the placement is re-measured when the box
 *  resizes rather than only when it opens. */
export function usePopoverPlacement(open: boolean, dep: unknown = 0) {
  const popRef = useRef<HTMLDivElement>(null);
  const placeRef = useRef<PopoverPlacement>({above: false, shift: 0});
  const [place, setPlace] = useState<PopoverPlacement>(placeRef.current);
  useMeasure(() => {
    if (!open) return;
    const apply = () => {
      const next = popoverPlacement(popRef.current);
      /* Written through the ref as well, so the comparison below is against the
       *  last APPLIED placement rather than against a state value this closure
       *  cannot see. The early return is what keeps a scroll from re-rendering
       *  the panel once per frame: most scroll events do not change the answer. */
      if (next.above === placeRef.current.above && next.shift === placeRef.current.shift) return;
      placeRef.current = next;
      setPlace(next);
    };
    apply();
    /* The trigger can MOVE while the popover is open: the panel scrolls, the
     *  window resizes, the user's search re-flows the list. The placement is
     *  therefore re-derived on those events rather than frozen at open — the
     *  capture-phase scroll listener catches the panel, whose scroll event does
     *  not bubble to the window. */
    document.addEventListener('scroll', apply, true);
    window.addEventListener('resize', apply);
    return () => {
      document.removeEventListener('scroll', apply, true);
      window.removeEventListener('resize', apply);
    };
  }, [open, dep]);
  return {popRef, style: placementStyle(place)};
}

