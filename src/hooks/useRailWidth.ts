/* useRailWidth.ts — CODE-RAIL-WIDTH (task t_b3986041, 2026-11-17).
 *
 * Harvey's item G: "the code rail is too narrow to read code". The rail shipped
 * at ONE hard-coded width (`.cp-pane.open { width: 380px }`), so this hook turns
 * it into a PREFERENCE — the same lazy-init + one-namespaced-key shape as
 * `diagram-studio:edge-path`:
 *
 *   · `RAIL_MIN` 280 — below this the gobi line numbers + a wrapped row stop
 *     being readable, so the splitter refuses to go narrower;
 *   · `RAIL_MAX` 720 — a ceiling that keeps the pane a PANE (a rail as wide as
 *     the frame is a different feature: a full-screen code mode);
 *   · and a SECOND live bound: the canvas keeps `CANVAS_MIN` (240px). The rail
 *     is a grid column of `.canvas-wrap`, so `wrap − 240` is the real maximum at
 *     any window size; the stored value is clamped against BOTH on read and on
 *     every write, so a width that was legal on a 2560px monitor cannot starve
 *     the canvas on a 1280px one.
 *
 * A drag previews live and persists ONCE on release (`preview` vs `commit`):
 * localStorage must not be written on every pointermove, and a reload during a
 * drag should see the last COMMITTED width.
 */
import {useCallback, useRef, useState} from 'react';

export const RAIL_WIDTH_KEY = 'diagram-studio:code-width';
/** the width this rail shipped at before it became adjustable — the reset value. */
export const RAIL_DEFAULT = 380;
export const RAIL_MIN = 280;
export const RAIL_MAX = 720;
/** the canvas never goes below this, whatever the rail wants. */
export const CANVAS_MIN = 240;

/** the widest rail this container can carry: the static ceiling, or the frame
 *  minus the canvas's floor — whichever is smaller (never below RAIL_MIN). */
export function railMaxFor(wrapWidth?: number): number {
  if (wrapWidth == null || !Number.isFinite(wrapWidth)) return RAIL_MAX;
  return Math.min(RAIL_MAX, Math.max(RAIL_MIN, Math.round(wrapWidth - CANVAS_MIN)));
}

export function clampRailWidth(w: number, wrapWidth?: number): number {
  if (!Number.isFinite(w)) return RAIL_DEFAULT;
  return Math.round(Math.min(Math.max(w, RAIL_MIN), railMaxFor(wrapWidth)));
}

/* the store is read lazily and defended twice: a blocked/absent localStorage
 * must not break the rail, and an unparseable value falls back to the SAME
 * number the CSS declares as its default. */
function read(): number {
  try {
    const raw = localStorage.getItem(RAIL_WIDTH_KEY);
    if (raw == null) return RAIL_DEFAULT;
    return clampRailWidth(Number(raw));
  } catch { return RAIL_DEFAULT; }
}
function write(w: number): void {
  try { localStorage.setItem(RAIL_WIDTH_KEY, String(w)); } catch { /* ignore */ }
}

export type RailWidth = {
  /** the pane's width in px — the ONE value the pane and the separator read. */
  width: number;
  /** true while a pointer drag is in flight (the separator paints its grip). */
  dragging: boolean;
  /** live drag / live clamp: moves the pane WITHOUT touching the store. */
  preview: (w: number, wrapWidth?: number) => void;
  /** gesture end / keyboard / reset: clamps against the live bounds and PERSISTS. */
  commit: (w: number, wrapWidth?: number) => void;
  /** keyboard nudge: a delta from the CURRENT width, clamped and persisted once. */
  step: (delta: number, wrapWidth?: number) => void;
  setDragging: (v: boolean) => void;
  /** double-click on the separator: back to the shipped width. */
  reset: () => void;
};

export function useRailWidth(): RailWidth {
  const [width, setWidth] = useState<number>(read);
  const [dragging, setDragging] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  const commit = useCallback((w: number, wrapWidth?: number) => {
    const next = clampRailWidth(w, wrapWidth);
    setWidth(next);
    write(next);
  }, []);
  const preview = useCallback((w: number, wrapWidth?: number) => {
    setWidth(clampRailWidth(w, wrapWidth));
  }, []);
  const step = useCallback((delta: number, wrapWidth?: number) => {
    commit(widthRef.current + delta, wrapWidth);
  }, [commit]);
  const reset = useCallback(() => {
    setWidth(RAIL_DEFAULT);
    write(RAIL_DEFAULT);
  }, []);

  return {width, dragging, preview, commit, step, setDragging, reset};
}
