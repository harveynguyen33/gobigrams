/**
 * CONFIG ROUND (2026-10-23) — the Z-ORDER DISPLAY MODE, and its persistence.
 *
 * Harvey's report: with the library default (`elevateNodesOnSelect`, mode
 * 'basic'), SELECTING a node silently raised it +1000 at PAINT time. A node
 * resting in back jumped to the front the moment it was clicked, so "Bring to
 * front" looked like a no-op (nothing changed on screen) and the real reorder
 * only became visible after deselecting. Measured live: marquee two overlapping
 * nodes, both painted at 1000; the stored zIndex never moved on selection.
 *
 * THE SETTING HAS TWO VALUES AND THE DEFAULT IS THE HONEST ONE:
 *
 *   'wysiwyg'  paint order = the STORED zIndex, nothing auto-raised.
 *              (`zIndexMode: 'manual'` on <ReactFlow>.) What you see IS the
 *              order Arrange writes. This is the DEFAULT: the canvas never
 *              lies about layering. Trade (accepted by Harvey): a selected
 *              EDGE no longer elevates over nodes it crosses.
 *   'lift'     the library default ('basic' + elevateNodesOnSelect): selecting
 *              a node raises it +1000 at paint time. Familiar "selection pops"
 *              feel, but Bring to front / Send to back can look like no-ops.
 *
 * The shape copies `marqueeMode.ts` exactly (same convention family:
 * `diagram-studio:*` key, lazy useState init that never throws, tolerant
 * parse by membership, try/catch on write). `wysiwyg` is the no-write default.
 */
import {useCallback, useState} from 'react';
import type {ZIndexMode} from '@xyflow/react';

/** ONE namespaced key, matching MARQUEE_KEY / ANIMATE_KEY / CATEGORIES_KEY. */
export const ZORDER_KEY = 'diagram-studio:z-order';

/** The two modes, as the USER sees them. `wysiwyg` is the default. */
export type ZOrderMode = 'wysiwyg' | 'lift';

/** The default, stated ONCE. It is also the no-write default: nothing resolves
 *  to `lift` except an explicit stored choice. */
export const DEFAULT_ZORDER_MODE: ZOrderMode = 'wysiwyg';

/** The picker's options, in display order, with plain-language labels. */
export const ZORDER_OPTS: {v: ZOrderMode; label: string; title: string}[] = [
  {v: 'wysiwyg', label: 'True layers', title: 'The canvas shows the real stack order; selecting never reorders'},
  {v: 'lift', label: 'Lift on select', title: 'Selecting a node raises it above neighbours while it stays selected'},
];

/** Tolerant parse: only the two known member strings are accepted; anything
 *  else resolves to the DEFAULT, so an unknown value can never silently pin
 *  the canvas to `lift`. */
export function parseZOrderMode(raw: string | null): ZOrderMode {
  return raw === 'lift' || raw === 'wysiwyg' ? raw : DEFAULT_ZORDER_MODE;
}

export function loadZOrderMode(): ZOrderMode {
  try {
    return parseZOrderMode(localStorage.getItem(ZORDER_KEY));
  } catch {
    // private mode / storage disabled — the app still works, just never remembers
    return DEFAULT_ZORDER_MODE;
  }
}

export function saveZOrderMode(mode: ZOrderMode): void {
  try {
    localStorage.setItem(ZORDER_KEY, mode);
  } catch { /* storage full or disabled — the choice still holds this session */ }
}

/** The mode, mapped to the React Flow prop it drives. Exported so the mapping
 *  is testable without a DOM and so `App.tsx` never re-derives it. */
export function zIndexModeFor(mode: ZOrderMode): ZIndexMode {
  return mode === 'wysiwyg' ? 'manual' : 'basic';
}

/** Owns the state, mirrors every change into localStorage, and hands back the
 *  React Flow value so the LIVE prop follows the control with no reload. */
export function useZOrderMode(): {mode: ZOrderMode; zIndexMode: ZIndexMode; setMode: (m: ZOrderMode) => void} {
  const [mode, setModeState] = useState<ZOrderMode>(loadZOrderMode);

  const setMode = useCallback((m: ZOrderMode) => {
    setModeState(m);
    saveZOrderMode(m);
  }, []);

  return {mode, zIndexMode: zIndexModeFor(mode), setMode};
}
