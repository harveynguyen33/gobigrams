/**
 * ROUND LAYOUT — the AUTO-LAYOUT DIRECTION, and its persistence.
 *
 * The engine (`src/layout.ts`) already knew how to lay out in either
 * direction, but it was never a USER choice: the toolbar's auto-layout routes
 * through the preset's own LAYOUTS registry, so a flowchart board could only
 * ever arrange top-down. This module owns the persisted Canvas preference
 * that overrides that per-preset default from Settings → Canvas.
 *
 * PERSISTENCE follows the one Settings path (prefs.ts): `loadPref` /
 * `savePref` under `diagram-studio:pref:layout-direction`, same as grid-size
 * and png-scale — lazy init that reads only, the first visit writes nothing
 * until the user picks, and a value that cannot persist never takes the app
 * down. The stored token is the engine's own ('TB' / 'LR'); the default is
 * 'TB' because a diagram reads downward. The hook shape copies zOrderMode.ts
 * so App wires it exactly like every other Canvas preference. */
import {useCallback, useState} from 'react';
import {loadPref, savePref} from './prefs';
import type {LayoutDirection} from './layout';

/** The stored preference key (under the prefs.ts prefix). */
export const LAYOUT_DIR_KEY = 'layout-direction';
/** The default: 'TB' — a diagram reads downward. */
export const DEFAULT_LAYOUT_DIR: LayoutDirection = 'TB';

/** The picker's options, in display order, with plain-language labels. */
export const LAYOUT_DIR_OPTS: {v: LayoutDirection; label: string; title: string}[] = [
  {v: 'TB', label: 'Top-down', title: 'Layers stack downward; a flowchart reads from top to bottom'},
  {v: 'LR', label: 'Left-right', title: 'Layers stack rightward; a process reads from left to right'},
];

/** Tolerant parse: only the two engine tokens are accepted; anything else
 * (including an unset value) resolves to the DEFAULT. */
export function parseLayoutDir(raw: unknown): LayoutDirection {
  return raw === 'TB' || raw === 'LR' ? raw : DEFAULT_LAYOUT_DIR;
}

/** Owns the state and mirrors every change into the preference store. */
export function useLayoutDir(): {layoutDir: LayoutDirection; setLayoutDir: (d: LayoutDirection) => void} {
  const [layoutDir, setDirState] = useState<LayoutDirection>(() => parseLayoutDir(loadPref(LAYOUT_DIR_KEY, DEFAULT_LAYOUT_DIR)));

  const setLayoutDir = useCallback((d: LayoutDirection) => {
    if (d !== 'TB' && d !== 'LR') return;
    setDirState(d);
    savePref(LAYOUT_DIR_KEY, d);
  }, []);

  return {layoutDir, setLayoutDir};
}
