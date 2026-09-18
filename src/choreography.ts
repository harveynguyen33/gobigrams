/**
 * PACKAGE-K — interaction choreography helpers.
 *
 * Everything here manipulates already-rendered React Flow DOM directly
 * (classList.add/remove on `.react-flow__node[data-id]` /
 * `.react-flow__edge[data-id]`), so hovering never causes a React render.
 * Technique source: EventCatalog `packages/visualiser` (MIT) — see
 * `/home/harvey/ec-research/eventcatalog-reactflow-report.md` T1/T3/T4/T11.
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import type {Edge} from '@xyflow/react';

/** class added to an edge group + path (and its label) while it is "electric" */
export const ELECTRIC = 'ds-electric';
/** wrapper class that hides animated payloads during a gesture */
export const INTERACTION = 'ds-interaction-active';
/** wrapper class that enables the CSS re-layout transition */
export const ANIMATING = 'ds-animating-layout';
/** wrapper class that kills payload animation (K3 gating) */
export const NO_ANIM = 'ds-no-anim';
/* K — REVIEW MODE's two shared tokens. Both are exported here so the CSS side
   and the JSX side name the mode exactly once (same shape as NO_ANIM above).

   `READ_ONLY` rides the `.ds-flow-wrap` className, i.e. the element the canvas
   actually lives in, and is the ONE hook the mode-specific CSS hangs off.

   `NO_PAN` is NOT new: it is React Flow's own `noPanClassName` DEFAULT. RF reads
   it back with `event.target.closest('.nopan')` in its pan-zoom filter (see
   @xyflow/system `isWrappedWithClass`), and it applies that class to a node
   wrapper only while the node is draggable — so in review mode, where
   `nodesDraggable` is false, the class disappears from every node and a drag
   that starts on a node falls through to the pane and pans. Re-applying THIS
   token to the node wrapper while read-only is what restores that guarantee. */
export const READ_ONLY = 'ds-read-only';
export const NO_PAN = 'nopan';

/**
 * True when an element currently carries RF's OWN `selected` class.
 *
 * Selection is the stronger state, so a hover effect must never re-draw it. RF
 * stamps `selected` on the edge GROUP and on the node WRAPPER, and the DOM is
 * walked directly below anyway, so the class list is the cheapest correct test —
 * no React render and no new prop.
 */
function isSelected(el: HTMLElement | null): boolean {
  return !!el && el.classList.contains('selected');
}
/** how long the layout-transition class stays on (must exceed the .35s CSS transition) */
export const LAYOUT_MS = 400;

const esc = (v: string) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(v) : v);

const edgeEls = (root: HTMLElement, id: string) =>
  Array.from(root.querySelectorAll<HTMLElement>(`.react-flow__edge[data-id="${esc(id)}"]`));

const edgePathEls = (root: HTMLElement, id: string) =>
  Array.from(root.querySelectorAll<HTMLElement>(
    `.react-flow__edge[data-id="${esc(id)}"] .react-flow__edge-path`,
  ));

const edgeLabelEls = (root: HTMLElement, id: string) =>
  Array.from(root.querySelectorAll<HTMLElement>(`.edge-label[data-edge-id="${esc(id)}"]`));

/** Add `cls` to every element of `els`, recording the touched elements for cleanup. */
function paint(els: HTMLElement[], cls: string, touched: HTMLElement[]) {
  els.forEach(el => {
    el.classList.add(cls);
    touched.push(el);
  });
}

/** Remove every recorded class and clear the tally. */
function unpaint(touched: HTMLElement[], cls: string) {
  touched.forEach(el => el.classList.remove(cls));
  touched.length = 0;
}

/**
 * K1 — hover choreography.
 *
 * Hover an edge  → that edge goes electric (accent stroke + glow + flowing dash).
 * Hover a node  → every connected edge (either direction) goes electric.
 *
 * THE PULSE IS DELIBERATELY GONE (Harvey, 2026-09-17). A hover effect used to
 * also outline the hovered node and every peer. That ring was drawn in the SAME
 * `--sel` colour as the selection ring, i.e. ONE visual signal carrying two
 * different meanings ("hovering" / "selected"), and it covered the whole
 * neighbourhood of the hovered node — so the UI read as confused, which is the
 * opposite of what a hover hint is for. The information worth keeping is
 * "what does this node connect to?", and the ELECTRIC edges answer exactly that
 * without inventing a second selection colour. Do not re-add a node outline here.
 *
 * Returns the four `on*MouseEnter/Leave` handlers for `<ReactFlow>`.
 *
 * F — `enabled` gates the whole effect. The hover highlight is a user option
 * now and it DEFAULTS OFF, so when it is false every handler returns early and
 * `clear()` runs (the effect below) to un-paint anything already lit: toggling
 * the option off mid-hover must not strand an ELECTRIC edge.
 */
export function useHoverChoreography(
  wrapRef: React.RefObject<HTMLElement | null>,
  edgesRef: React.RefObject<Edge[]>,
  enabled: boolean,
) {
  const touchedEdges = useRef<HTMLElement[]>([]);

  const clear = useCallback(() => {
    unpaint(touchedEdges.current, ELECTRIC);
  }, []);

  const noop = useCallback(() => {}, []);

  /* F — disabled: un-paint on the very next render after the toggle. `clear` is
     idempotent, so this is a cheap no-op while something else owns the paint. */
  useEffect(() => {
    if (!enabled) clear();
  }, [enabled, clear]);

  /** Paint one edge (group + path + label) electric — unless it is SELECTED.
   *  Selection outranks hover: a selected edge already reads as highlighted, so
   *  the electric repaint would make it jump (1.8px → 4px + dash + glow) under
   *  the pointer. Same rule the removed node pulse followed. */
  const lightEdge = useCallback((root: HTMLElement, id: string) => {
    if (isSelected(edgeEls(root, id)[0] ?? null)) return;
    paint(edgeEls(root, id), ELECTRIC, touchedEdges.current);
    paint(edgePathEls(root, id), ELECTRIC, touchedEdges.current);
    paint(edgeLabelEls(root, id), ELECTRIC, touchedEdges.current);
  }, []);

  const onEdgeMouseEnter = useCallback((_e: React.MouseEvent, edge: Edge) => {
    const root = wrapRef.current;
    if (!enabled || !root) return;
    clear();
    lightEdge(root, edge.id);
  }, [wrapRef, clear, lightEdge, enabled]);

  const onEdgeMouseLeave = useCallback(() => { clear(); }, [clear]);

  const onNodeMouseEnter = useCallback((_e: React.MouseEvent, node: {id: string}) => {
    const root = wrapRef.current;
    if (!enabled || !root) return;
    clear();
    // every edge touching this node, in either direction — this is the whole
    // effect: it shows the node's connections without touching any node's ring.
    (edgesRef.current ?? [])
      .filter(ed => ed.source === node.id || ed.target === node.id)
      .forEach(ed => lightEdge(root, ed.id));
  }, [wrapRef, edgesRef, clear, lightEdge, enabled]);

  const onNodeMouseLeave = useCallback(() => { clear(); }, [clear]);

  // A board switch / unmount must not leave stale highlighted classes behind.
  useEffect(() => clear, [clear]);

  if (!enabled) {
    return {onEdgeMouseEnter: noop, onEdgeMouseLeave: noop, onNodeMouseEnter: noop, onNodeMouseLeave: noop};
  }
  return {onEdgeMouseEnter, onEdgeMouseLeave, onNodeMouseEnter, onNodeMouseLeave};
}

/**
 * K1 — interaction perf guard (technique T3).
 *
 * SMIL `animateMotion` cannot be paused with CSS, so while the user is
 * panning / zooming / dragging we hide every animated payload
 * (`visibility: hidden`) to avoid expensive SVG repaints. Reference-counted so
 * overlapping start/end events (pan start + node drag start) never clear the
 * class early.
 *
 * H — the release is TIMER-BASED as well as event-based. MEASURED defect: a
 * ctrl-wheel / trackpad-pinch zoom leaks a START. This app runs
 * `panOnScroll` + `zoomOnScroll={false}` + `zoomActivationKeyCode=['Meta',
 * 'Control']`, and in that configuration `createPanOnScrollHandler` takes its
 * pinch branch, which `return`s early — before the block that arms the
 * handler's own pan-scroll end (`zoomPanValues.panScrollTimeout`). So no END
 * event is produced for the gesture, the count never returned to 0, and the
 * canvas stayed frozen until the next `pointerup` (a stray click). Every START
 * therefore (re)arms a short self-release timer, and every `wheel` tick on the
 * canvas re-arms it again, so a zoom burst thaws ~200ms after the last tick
 * with no click needed.
 */
export const INTERACTION_RELEASE_MS = 200;
/** Absolute ceiling on one freeze. Bounds the re-arm loop in `armRelease`:
 *  if the matching pointer release is never observed (`pointerHeld` stuck at
 *  true), the canvas still thaws instead of looping a timer forever. 60s is
 *  far longer than any real drag, so it never truncates a genuine gesture. */
export const INTERACTION_MAX_MS = 60_000;

export function useInteractionGuard(wrapRef: React.RefObject<HTMLElement | null>) {
  const count = useRef(0);
  const releaseTimer = useRef<number | undefined>(undefined);
  /* True between pointerdown and pointerup/pointercancel. A HELD pointer is a
     gesture that emits no wheel ticks (a slow node drag, a slow pane pan), so
     the debounce must not thaw it mid-flight: while this is set the timer
     re-arms itself and the pointer release below is what ends the freeze. */
  const pointerHeld = useRef(false);
  /** Wall-clock ceiling for the freeze currently in flight (see MAX above). */
  const freezeDeadline = useRef(0);

  const cancelTimer = useCallback(() => {
    window.clearTimeout(releaseTimer.current);
    releaseTimer.current = undefined;
  }, []);

  /** Force the canvas back to "live": drop the class and forget the count. */
  const release = useCallback(() => {
    cancelTimer();
    freezeDeadline.current = 0;
    if (count.current === 0) return;
    count.current = 0;
    wrapRef.current?.classList.remove(INTERACTION);
  }, [wrapRef, cancelTimer]);

  /**
   * (Re)arm the debounced self-release. The timer never fires while a pointer
   * is held — it re-arms for another window instead, so a drag longer than
   * `INTERACTION_RELEASE_MS` stays frozen until its own pointer release, and
   * never past `INTERACTION_MAX_MS`.
   */
  const armRelease = useCallback(() => {
    cancelTimer();
    function tick() {
      releaseTimer.current = undefined;
      if (pointerHeld.current && Date.now() < freezeDeadline.current) {
        releaseTimer.current = window.setTimeout(tick, INTERACTION_RELEASE_MS);
        return;
      }
      release();
    }
    releaseTimer.current = window.setTimeout(tick, INTERACTION_RELEASE_MS);
  }, [cancelTimer, release]);

  const startInteraction = useCallback(() => {
    count.current += 1;
    if (count.current === 1) {
      freezeDeadline.current = Date.now() + INTERACTION_MAX_MS;
      wrapRef.current?.classList.add(INTERACTION);
    }
    armRelease();
  }, [wrapRef, armRelease]);

  const endInteraction = useCallback(() => {
    count.current = Math.max(0, count.current - 1);
    if (count.current === 0) {
      // the last real gesture is over — nothing left to release on a timer
      cancelTimer();
      wrapRef.current?.classList.remove(INTERACTION);
    } else {
      // a coarser gesture is still running (pan + node drag): keep the freeze
      // alive and let its own end (or the debounce) finish the job
      armRelease();
    }
  }, [wrapRef, armRelease, cancelTimer]);

  // Safety net: React Flow suppresses a pan-zoom end event when a viewport
  // animation is interrupted, and a drag can end without a stop callback if the
  // pointer is released outside the window. Every gesture ends with a pointer
  // release, so treat that as the authoritative "interaction over" signal and
  // never leave the canvas frozen on a stale count. `pointerHeld` (same
  // listeners, capture so a stopPropagation upstream cannot hide them) is what
  // stops the debounce above from thawing a long drag.
  useEffect(() => {
    const hold = () => { pointerHeld.current = true; };
    const drop = () => {
      pointerHeld.current = false;
      release();
    };
    window.addEventListener('pointerdown', hold, true);
    window.addEventListener('pointerup', drop, true);
    window.addEventListener('pointercancel', drop, true);
    window.addEventListener('touchend', drop, true);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerdown', hold, true);
      window.removeEventListener('pointerup', drop, true);
      window.removeEventListener('pointercancel', drop, true);
      window.removeEventListener('touchend', drop, true);
      window.removeEventListener('blur', release);
    };
  }, [release]);

  // A wheel stream is the one gesture with no pointer event at either end:
  // every tick re-arms the debounce, so the freeze covers the whole burst and
  // expires INTERACTION_RELEASE_MS after the last tick.
  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;
    const onWheel = () => { if (count.current > 0) armRelease(); };
    root.addEventListener('wheel', onWheel, {capture: true, passive: true});
    return () => root.removeEventListener('wheel', onWheel, {capture: true});
  }, [wrapRef, armRelease]);

  // safety: never leave the canvas in the "frozen" state after an unmount,
  // and never leak the pending release timer
  useEffect(() => () => {
    window.clearTimeout(releaseTimer.current);
    releaseTimer.current = undefined;
    count.current = 0;
    pointerHeld.current = false;
    freezeDeadline.current = 0;
    wrapRef.current?.classList.remove(INTERACTION);
  }, [wrapRef]);

  return {startInteraction, endInteraction};
}

/**
 * K3 — CSS-only re-layout transition (technique T4).
 *
 * Add `.ds-animating-layout` just before a programmatic layout change so
 * React Flow's new `transform` values ease in, and remove it 400ms later
 * (400 > the 350ms CSS transition) so it can never affect a user drag.
 * The pending timer is kept in a ref and cleared, so rapid successive layouts
 * do not strip the class mid-transition.
 */
export function useLayoutTransition(wrapRef: React.RefObject<HTMLElement | null>) {
  const timer = useRef<number | undefined>(undefined);

  const animateLayout = useCallback((apply: () => void) => {
    const root = wrapRef.current;
    if (root) root.classList.add(ANIMATING);
    try {
      apply();
    } finally {
      if (root) {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          timer.current = undefined;
          root.classList.remove(ANIMATING);
        }, LAYOUT_MS);
      }
    }
  }, [wrapRef]);

  // A layout change while a user drag is in flight would ease the drag; the
  // class is only ever added by animateLayout() and always removed by the
  // guarded timeout, so dragging stays 1:1.
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return {animateLayout};
}

/** K3 — a board larger than this turns edge payload animation off by default. */
export const LARGE_GRAPH_NODE_THRESHOLD = 30;
const ANIMATE_KEY = 'diagram-studio:animate';

/**
 * K3 — animation gating (technique T11).
 *
 * Priority: explicit user choice (persisted in localStorage)
 *           > auto (off once the board exceeds LARGE_GRAPH_NODE_THRESHOLD nodes).
 * Returns the effective flag plus a toggle that persists the user's choice.
 */
export function useAnimationGating(nodeCount: number) {
  const [override, setOverride] = useState<boolean | null>(() => {
    try {
      const v = localStorage.getItem(ANIMATE_KEY);
      return v === null ? null : v === '1';
    } catch {
      return null;
    }
  });

  const auto = nodeCount <= LARGE_GRAPH_NODE_THRESHOLD;
  const animate = override ?? auto;

  const toggle = useCallback(() => {
    setOverride(prev => {
      const next = !(prev ?? auto);
      try { localStorage.setItem(ANIMATE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, [auto]);

  /** Drop the user override so the board follows the node-count rule again. */
  const resetOverride = useCallback(() => {
    try { localStorage.removeItem(ANIMATE_KEY); } catch { /* ignore */ }
    setOverride(null);
  }, []);

  return {animate, auto, oversized: !auto, override, toggle, resetOverride};
}

/* F — the hover edge-highlight OPTION. Same shape as useAnimationGating above
   (lazy localStorage read in a try/catch, one persisting toggle), but with no
   `auto` rule: this is purely the user's choice, so an ABSENT key means OFF.
   The stored value is '1' / '0' under the same `diagram-studio:` namespace. */
const HIGHLIGHT_KEY = 'diagram-studio:hover-highlight';

export function useHoverHighlight() {
  const [highlight, setHighlight] = useState<boolean>(() => {
    try {
      return localStorage.getItem(HIGHLIGHT_KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setHighlight(prev => {
      const next = !prev;
      try { localStorage.setItem(HIGHLIGHT_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return {highlight, toggle};
}
