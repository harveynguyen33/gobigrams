/**
 * ROUND AA, ITEM 2 — the MARQUEE SELECTION MODE, and its persistence.
 *
 * Harvey's report: dragging a box around several elements only selected them
 * when the box FULLY enclosed each one — "nếu cái vòng bao của chuột ko dính
 * vào góc trái của element thì nó sẽ k đc chọn". Measured live on a node with
 * 60px margins, one side at a time: a marquee missing 60px on the node's RIGHT
 * or BOTTOM selected nothing, and a marquee covering ~50% selected nothing.
 *
 * THE CAUSE IS A LIBRARY DEFAULT, NOT OUR CODE. `@xyflow/react`'s `<ReactFlow>`
 * declares `selectionMode = SelectionMode.Full` (`@xyflow/system`:
 * `enum SelectionMode { Partial = 'partial', Full = 'full' }`), and the Pane
 * then calls `getNodesInside(..., selectionMode === SelectionMode.Partial, ...)`.
 * This app passed no `selectionMode` at all, so it inherited `Full` — the
 * marquee had to CONTAIN a node. Figma, Excalidraw, draw.io and tldraw all
 * select on OVERLAP, which is what Harvey expected and what he asked for as the
 * default.
 *
 * SO THE SETTING HAS TWO VALUES AND THE DEFAULT IS THE OVERLAP ONE:
 *
 *   'touch'    the marquee selects anything it OVERLAPS  -> SelectionMode.Partial
 *   'enclose'  the marquee must SURROUND a node wholly    -> SelectionMode.Full
 *
 * `touch` is the DEFAULT, and it is the NO-WRITE default: an absent key, an
 * unreadable key and a key holding a retired value all resolve to it, so the
 * prop follows the default without storage ever being written on first run.
 * This module is the ONE place that mapping lives; `App.tsx` reads `mode` and
 * passes the enum, so the control, the stored value and the canvas prop cannot
 * disagree.
 *
 * PERSISTENCE FOLLOWS THE ESTABLISHED CONVENTION — this is not a new mechanism.
 * `src/choreography.ts` (`diagram-studio:animate`, `:hover-highlight`),
 * `src/theme.ts` (`:theme`), `src/categoryState.ts` (`:categories`) and
 * `src/panelCollapse.ts` (`:panels`) all use ONE namespaced `diagram-studio:*`
 * key, a lazy `useState` initialiser that never throws when storage is
 * unavailable, a TOLERANT parse that drops anything it does not recognise, and
 * a `try`/`catch` on write. This file is that same shape for a third value
 * type: not a boolean but a closed two-member string union, parsed by
 * membership rather than by `=== '1'`.
 *
 * The canvas prefs that are NOT persisted are session state on purpose (`snap`
 * in App.tsx:614, `gridSize` at :620 — both explicitly never written to a
 * board). The ones that ARE persisted (`animate`, the hover highlight, the
 * theme, the panel folds, the read-only flag, the edge path) all go through the
 * convention above, and this setting joins them because Harvey asked for a
 * setting that survives a reload.
 */
import {useCallback, useState} from 'react';
import {SelectionMode} from '@xyflow/react';

/** ONE namespaced key, matching MODE_KEY / ANIMATE_KEY / CATEGORIES_KEY. */
export const MARQUEE_KEY = 'diagram-studio:marquee';

/** The two modes, as the USER sees them. `touch` is the default. */
export type MarqueeMode = 'touch' | 'enclose';

/** The default, stated ONCE. It is also the no-write default: nothing resolves
 *  to `enclose` except an explicit stored choice. */
export const DEFAULT_MARQUEE_MODE: MarqueeMode = 'touch';

/** The picker's options, in display order, with the plain-language labels. */
export const MARQUEE_OPTS: {v: MarqueeMode; label: string; title: string}[] = [
  {v: 'touch', label: 'Touch', title: 'Select anything the box overlaps'},
  {v: 'enclose', label: 'Enclose', title: 'Only select elements the box fully surrounds'},
];

/** Tolerant parse: never throw on a hand-edited or half-written value, and only
 *  the two known member strings are accepted. Anything else — including the
 *  empty string, a JSON blob from a future version, or a retired name — is the
 *  DEFAULT, so an unknown value can never silently pin the marquee to `enclose`
 *  (the behaviour Harvey asked to be rid of). */
export function parseMarqueeMode(raw: string | null): MarqueeMode {
  return raw === 'enclose' || raw === 'touch' ? raw : DEFAULT_MARQUEE_MODE;
}

export function loadMarqueeMode(): MarqueeMode {
  try {
    return parseMarqueeMode(localStorage.getItem(MARQUEE_KEY));
  } catch {
    // private mode / storage disabled — the app still works, just never remembers
    return DEFAULT_MARQUEE_MODE;
  }
}

export function saveMarqueeMode(mode: MarqueeMode): void {
  try {
    localStorage.setItem(MARQUEE_KEY, mode);
  } catch { /* storage full or disabled — the choice still holds this session */ }
}

/** The mode, mapped to the React Flow prop it drives. Exported so the mapping is
 *  testable without a DOM and so `App.tsx` never re-derives it. */
export function selectionModeFor(mode: MarqueeMode): SelectionMode {
  return mode === 'touch' ? SelectionMode.Partial : SelectionMode.Full;
}

/** Owns the state, mirrors every change into localStorage, and hands back the
 *  React Flow enum so the LIVE prop follows the control with no reload. */
export function useMarqueeMode(): {mode: MarqueeMode; selectionMode: SelectionMode; setMode: (m: MarqueeMode) => void} {
  const [mode, setModeState] = useState<MarqueeMode>(loadMarqueeMode);

  const setMode = useCallback((m: MarqueeMode) => {
    setModeState(m);
    saveMarqueeMode(m);
  }, []);

  return {mode, selectionMode: selectionModeFor(mode), setMode};
}
