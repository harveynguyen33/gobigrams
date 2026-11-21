/**
 * PACKAGE-K — interaction choreography helpers.
 *
 * Everything here manipulates already-rendered React Flow DOM directly
 * (classList.add/remove on `.react-flow__node[data-id]` /
 * `.react-flow__edge[data-id]`), so hovering never causes a React render.
 * Technique source: EventCatalog `packages/visualiser` (MIT) — see
 * internal research notes, sections T1/T3/T4/T11.
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import type {Edge, Node} from '@xyflow/react';
import {isLogicalGroup} from './groupLogical';

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

/* HIGHLIGHT ROUND — the neighbourhood halo (mode 2 "halo + lift",
   docs/sketches/highlight-options.html, owner-approved).

   HL_FOCUS rides the wrapper (`.ds-hl`) and is the ONE switch for focus mode
   (the rest of the board quiets while anything is lit). HL_LIT / HL_PEER ride
   the node WRAPPER and paint the halo — deliberately on `filter`, because the
   ONE box-shadow on a node card is the selection ring (`var(--sel)`), and a
   halo written into box-shadow would erase selection on a selected+hovered
   node (exactly why mock option 3 was rejected). The halo colour is
   token-derived in CSS (`color-mix(in srgb, var(--fg) …)`), never --sel,
   and it is a blur, not a line. */
export const HL_FOCUS = 'ds-hl';
export const HL_LIT = 'ds-hl-lit';
export const HL_PEER = 'ds-hl-peer';
/* HIGHLIGHT-CONTAINER (GROUP-LOGICAL) — the quieter CONTEXT treatment for the
   container of a lit node. Only a visible FRAME (goblin `shape:'group'`) ever
   carries it: the frame is context, never the subject, so it gets a border
   lift (see .ds-hl-ctx in styles.css) instead of the halo. A LOGICAL group
   paints nothing at all — it lights by membership instead. */
export const HL_CTX = 'ds-hl-ctx';

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

/* HIGHLIGHT ROUND — desired-state painter. Everything below is computed FROM
   SCRATCH on every call, then diffed onto the DOM with classList.toggle, so
   two drivers (a hover focus and the current selection) can share the same
   classes without ever leaving a stranded class behind: there is no touched
   list to get out of sync, only the desired state. Hover never re-renders
   React — this runs on RF's mouseenter/leave and on the selection callback,
   touching classList only. */
type HoverFocus = {kind: 'node' | 'edge', id: string} | null;

function paintHighlight(
  root: HTMLElement,
  edges: Edge[],
  nodes: Node[],
  focus: HoverFocus,
  selIds: readonly string[],
) {
  /* A node is LIT when it is the hover focus OR selected; peers are the nodes
     at the other ends of the edges that touch a lit node. An edge-hover lights
     just that edge and NO node, so it can never trigger focus mode — today's
     behaviour, kept. */
  const foci = new Set(selIds);
  if (focus?.kind === 'node') foci.add(focus.id);
  const litEdges = new Set<string>();
  const peers = new Set<string>();
  for (const ed of edges) {
    if (foci.has(ed.source) || foci.has(ed.target)) {
      litEdges.add(ed.id);
      peers.add(ed.source);
      peers.add(ed.target);
    }
  }
  if (focus?.kind === 'edge') litEdges.add(focus.id);

  /* HIGHLIGHT-CONTAINER (GROUP-LOGICAL) — the two container kinds answer the
     hover question DIFFERENTLY, on purpose:
     • A FRAME (goblin `shape:'group'`) is scenery. A hovered child lights its
       OWN neighbourhood exactly as above — never the frame's other children,
       never their edges — and the frame itself gets only the quieter HL_CTX
       border lift: the frame is context, not the subject.
     • A LOGICAL group (RF `type:'group'`, paints nothing) is a UNIT: the block
       is what answers "what does this connect to", so lighting one member
       alone would be a half-truth. Every member becomes a peer, and EVERY edge
       attached to any member lights — even the edge to a node far outside the
       block. This is the deliberate difference from the frame rule. */
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ctxParents = new Set<string>();
  for (const id of foci) {
    const pid = byId.get(id)?.parentId;
    if (!pid) continue;
    const parent = byId.get(pid);
    if (!parent) continue;
    if (isLogicalGroup(parent)) {
      for (const m of nodes) if (m.parentId === pid && m.id !== id) peers.add(m.id);
      for (const ed of edges) {
        if (byId.get(ed.source)?.parentId === pid || byId.get(ed.target)?.parentId === pid ||
            ed.source === pid || ed.target === pid) litEdges.add(ed.id);
      }
    } else if (parent.data?.shape === 'group') {
      ctxParents.add(pid);
    }
  }

  /* Nodes: lit outranks peer (the mock's paint priority). A selected+hovered
     node is simply lit once — the halo never contests the selection ring. The
     HL_CTX toggle rides the same pass so a re-paint that no longer names a
     frame as context strips the class (computed-from-scratch, no touched
     list). */
  let litNodes = 0;
  root.querySelectorAll<HTMLElement>('.react-flow__node').forEach((el) => {
    const id = el.getAttribute('data-id');
    const lit = !!id && foci.has(id);
    el.classList.toggle(HL_LIT, lit);
    el.classList.toggle(HL_PEER, !lit && !!id && peers.has(id));
    el.classList.toggle(HL_CTX, !!id && ctxParents.has(id));
    if (lit) litNodes++;
  });

  /* Edges: electric on the lit neighbourhood — except a SELECTED edge, which
     already reads as highlighted and must not jump under the pointer (the old
     lightEdge rule, kept verbatim). */
  const electricIds = new Set<string>();
  root.querySelectorAll<HTMLElement>('.react-flow__edge').forEach((el) => {
    const id = el.getAttribute('data-id');
    const on = !!id && litEdges.has(id) && !isSelected(el);
    el.classList.toggle(ELECTRIC, on);
    if (id && on) electricIds.add(id);
  });
  /* path + label ride the same state (the label is a SIBLING element, matched
     by data-edge-id, not a descendant — see the .edge-label.ds-electric note). */
  root.querySelectorAll<HTMLElement>('.react-flow__edge-path').forEach((el) => {
    const g = el.closest('.react-flow__edge');
    el.classList.toggle(ELECTRIC, !!g && g.classList.contains(ELECTRIC));
  });
  root.querySelectorAll<HTMLElement>('.edge-label').forEach((el) => {
    const id = el.getAttribute('data-edge-id');
    el.classList.toggle(ELECTRIC, !!id && electricIds.has(id));
  });

  /* FOCUS MODE: on while any NODE is lit. Rooted on the wrapper so the CSS
     dim (.ds-hl …) can never leak into the code rail, dialogs or panels. */
  root.classList.toggle(HL_FOCUS, litNodes > 0);
}

/** Strip every highlight class from the tree — board switch / unmount only. */
function wipeHighlight(root: HTMLElement) {
  root.classList.remove(HL_FOCUS);
  root.querySelectorAll<HTMLElement>('.react-flow__node').forEach((el) => {
    el.classList.remove(HL_LIT, HL_PEER, HL_CTX);
  });
  root.querySelectorAll<HTMLElement>('.react-flow__edge, .react-flow__edge-path, .edge-label')
    .forEach((el) => el.classList.remove(ELECTRIC));
}

/**
 * K1 — hover + selection choreography.
 *
 * Hover an edge  → that edge goes electric (accent stroke + glow + flowing dash).
 * Hover a node  → every connected edge goes electric, and (HIGHLIGHT ROUND)
 *                 the hovered node and its peers get the halo `filter`, the
 *                 rest of the board dims until the pointer leaves.
 * Select a node → the same neighbourhood lights, PERSISTENTLY — and since
 *                 the owner's override (2026-11-20, HL-GATE) the option gates
 *                 BOTH halves: off paints nothing on hover or select, and a
 *                 toggle-off wipes mid-hover AND mid-selection paint.
 *                 Read-only still lights (App's gate there is the option OR
 *                 read-only). See App's wiring at the useHoverChoreography
 *                 call and onSelectionChange.
 *
 * THE PULSE IS STILL GONE (Harvey, 2026-09-17): the halo is `filter`
 * brightness + drop-shadow on the node WRAPPER — a different property from
 * the selection ring's `box-shadow`, a different colour (`--fg`-derived, not
 * `--sel`), a blur and not a line. It therefore answers "what does this node
 * connect to?" without ever contesting or resembling the one selection
 * signal. Do not re-add a node outline here.
 *
 * F/HL-GATE — `enabled` gates BOTH halves: when false the handlers ignore
 * enter events and the effect below repaints empty, so a toggle-off
 * strands no ELECTRIC edge, no lit halo, and no lit selection.
 */
export function useHoverChoreography(
  wrapRef: React.RefObject<HTMLElement | null>,
  edgesRef: React.RefObject<Edge[]>,
  nodesRef: React.RefObject<Node[]>,
  enabled: boolean,
) {
  const focusRef = useRef<HoverFocus>(null);
  const selIdsRef = useRef<string[]>([]);

  const repaint = useCallback(() => {
    const root = wrapRef.current;
    if (!root) return;
    paintHighlight(root, edgesRef.current ?? [], nodesRef.current ?? [], enabled ? focusRef.current : null, enabled ? selIdsRef.current : []);
  }, [wrapRef, edgesRef, nodesRef, enabled]);

  /** Selection driver — called from App's onSelectionChange, which fires AFTER
   *  RF commits the new selection, so RF's own `selected` classes are already
   *  fresh when the paint walks the DOM. WRITE unconditional, paint gated. */
  const applySelection = useCallback((nodes: readonly {id: string}[]) => {
    selIdsRef.current = nodes.map((n) => n.id);
    repaint();
  }, [repaint]);

  const clearHover = useCallback(() => {
    focusRef.current = null;
    repaint();
  }, [repaint]);

  const onEdgeMouseEnter = useCallback((_e: React.MouseEvent, edge: Edge) => {
    if (!enabled) return;
    focusRef.current = {kind: 'edge', id: edge.id};
    repaint();
  }, [enabled, repaint]);

  const onNodeMouseEnter = useCallback((_e: React.MouseEvent, node: {id: string}) => {
    if (!enabled) return;
    focusRef.current = {kind: 'node', id: node.id};
    repaint();
  }, [enabled, repaint]);

  const onEdgeMouseLeave = clearHover;
  const onNodeMouseLeave = clearHover;

  /* F/HL-GATE — disabled: repaint EMPTY on the very next render after the
     toggle — the gated pass drops the hover focus AND wipes the selection
     paint (owner override 2026-11-20: one option, both lights). */
  useEffect(() => {
    if (!enabled) {
      focusRef.current = null;
      repaint();
    }
  }, [enabled, repaint]);

  // A board switch / unmount must not leave stale highlighted classes behind.
  useEffect(() => () => {
    const root = wrapRef.current;
    if (root) wipeHighlight(root);
  }, [wrapRef]);

  return {onEdgeMouseEnter, onEdgeMouseLeave, onNodeMouseEnter, onNodeMouseLeave, applySelection};
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

  /* AUDIT-4 — the OS reduce-motion setting is the one gate CSS cannot express
     for the SMIL payload beads (they live in attributes, not styles). Folding
     it into the effective flag lands .ds-no-anim on the wrapper for those
     users, same as the 30-node gate. The override still wins: a user who
     EXPLICITLY toggled motion on has stated a preference louder than the OS. */
  const [osReduced] = useState(() => {
    try {
      return typeof matchMedia === 'function'
        && matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });

  const auto = nodeCount <= LARGE_GRAPH_NODE_THRESHOLD && !osReduced;
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
