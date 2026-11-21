/* HEADROOM (t_a21adb78) — the persisted canvas preferences, moved VERBATIM out
 * of App.tsx (the file sits at its hard cap). Same states, same clamps, same
 * one-writer callbacks, same localStorage keys — the Settings rows and the
 * behaviours they feed are unchanged; only the module boundary moved.
 *
 * Contract reminders the moved comments already carry:
 *  - prefs.ts lazy-init: nothing is written until the user picks a value, so
 *    first visit behaves exactly like the pre-persistence defaults.
 *  - `gridSize` is the ONE source of truth for the snap grid, the visible dot
 *    spacing, the "round onto the grid" math and the toolbar tooltip.
 *  - `defaultPath` is the edge-path PREFERENCE (new edges); the inspector's
 *    curvature control keeps showing the SELECTED edge's type, never this.
 */
import {useCallback, useState} from 'react';
import {loadPref, savePref} from '../board/prefs';
import type {PathId} from '../presets';

export function useCanvasPrefs() {
  /** M4: the grid pitch in px — the ONE source of truth for the snap grid, the
   *  visible dot spacing, the "round onto the grid" math and the toolbar
   *  tooltip. The toolbar keeps the on/off toggle and Settings → Canvas owns
   *  the number, so neither is a duplicate control. Never written to a board. */
  /* PACKAGE-S §S-1 — the pitch persists (was session-only, which made the
     Settings choice a lie across reloads). Lazy-init reads; the first visit
     writes nothing until the user picks (prefs.ts contract). */
  const [gridSize, setGridSize] = useState(() => loadPref('grid-size', 16));
  // ---- PACKAGE-S §S-2 — export defaults (persisted; defaults = today's behaviour) ----
  const [pngScale, setPngScale] = useState(() => loadPref('png-scale', 2));
  const onPngScale = useCallback((n: number) => {
    if (![1, 2, 3].includes(n)) return;
    setPngScale(n);
    savePref('png-scale', n);
  }, []);
  const [pngPad, setPngPad] = useState(() => loadPref('png-pad', 48));
  const onPngPad = useCallback((n: number) => {
    if (![24, 48, 96].includes(n)) return;
    setPngPad(n);
    savePref('png-pad', n);
  }, []);
  // ---- PACKAGE-S §S-3 — autosave control (default ON = today's behaviour) ----
  const [autosave, setAutosave] = useState(() => loadPref('autosave', true));
  const onAutosave = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    setAutosave(prev => {
      const next = typeof v === 'function' ? (v as (p: boolean) => boolean)(prev) : v;
      savePref('autosave', next);
      return next;
    });
  }, []);
  /** The only way the pitch is set: non-finite input (cleared / partial field)
   *  is ignored — the last valid value stands — and anything finite is clamped
   *  to [4, 64] and rounded to the nearest 4px step, so `snapGrid`,
   *  `Background`'s gap and the rounding math can never disagree or go NaN. */
  const onGridSize = useCallback((n: number) => {
    if (!Number.isFinite(n)) return;
    const next = Math.min(64, Math.max(4, Math.round(n / 4) * 4));
    setGridSize(next);
    savePref('grid-size', next);
  }, []);
  /* HARVEY 2026-10-13 — the dblclick auto-connect setting: toggle + reach
     (clamped 150–800, 50px steps so the slider lands on sane numbers). */
  const [dblConnect, setDblConnect] = useState(() => loadPref('dbl-connect', true));
  const [dblRange, setDblRange] = useState(() => loadPref('dbl-range', 400));
  const onDblConnect = useCallback((v: boolean) => {
    setDblConnect(v);
    savePref('dbl-connect', v);
  }, []);
  const onDblRange = useCallback((n: number) => {
    if (!Number.isFinite(n)) return;
    const next = Math.min(800, Math.max(150, Math.round(n / 50) * 50));
    setDblRange(next);
    savePref('dbl-range', next);
  }, []);
  /* PACKAGE-S §S-1 — persisted like its Canvas-pane neighbours. */
  const [alignGuides, setAlignGuidesState] = useState(() => loadPref('align-guides', true));
  const setAlignGuides = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    setAlignGuidesState(prev => {
      const next = typeof v === 'function' ? (v as (p: boolean) => boolean)(prev) : v;
      savePref('align-guides', next);
      return next;
    });
  }, []);
  // ---- G: the default edge path. `smoothstep` until the user changes an edge's
  // curvature in the inspector, at which point that choice becomes the default
  // for every edge drawn afterwards. Same convention as
  // `diagram-studio:theme`: one namespaced key, read
  // once through a lazy `useState` initialiser that never throws when storage is
  // unavailable. An absent or unparseable value reads as `smoothstep`.
  const EDGE_PATH_KEY = 'diagram-studio:edge-path';
  const readEdgePath = (): PathId => {
    try {
      const v = localStorage.getItem(EDGE_PATH_KEY);
      return v === 'bezier' || v === 'smoothstep' || v === 'step' || v === 'straight'
        ? (v as PathId)
        : 'smoothstep';
    } catch { return 'smoothstep'; }
  };
  const [defaultPath, setDefaultPath] = useState<PathId>(readEdgePath);
  const rememberEdgePath = useCallback((p: PathId) => {
    setDefaultPath(p);
    try { localStorage.setItem(EDGE_PATH_KEY, p); } catch { /* ignore */ }
  }, []);

  // Return TUPLE, not an object (the useExportActions convention): minified
  // property keys would survive; positions do not. Order:
  // [gridSize, onGridSize, pngScale, onPngScale, pngPad, onPngPad, autosave,
  //  onAutosave, dblConnect, onDblConnect, dblRange, onDblRange, alignGuides,
  //  setAlignGuides, defaultPath, rememberEdgePath]
  return [
    gridSize, onGridSize,
    pngScale, onPngScale, pngPad, onPngPad,
    autosave, onAutosave,
    dblConnect, onDblConnect, dblRange, onDblRange,
    alignGuides, setAlignGuides,
    defaultPath, rememberEdgePath,
  ] as const;
}
