/* railPanel.ts — CODE-RAIL-WIDTH part 2 (task t_b3986041, 2026-11-17).
 *
 * Harvey's ask: opening the code rail should AUTO-HIDE the inspector so the rail
 * gets the space — transient, "the user can reopen it".
 *
 * This is the VIEW-MODE CHROME shape, applied to a different cause: a LOCAL
 * reveal that is NEVER written to `diagram-studio:panels`. The rail's demand for
 * width ends the moment the rail closes, so:
 *
 *   · persisted collapse  = the user's durable layout (unchanged, byte-identical);
 *   · the rail's hide     = a transient layer on TOP of it, alive only while open;
 *   · a manual reopen while the rail is open flips the LAYER, never the store —
 *     so closing the rail restores exactly the layout that was persisted.
 *
 * `shown === null` means "no manual decision in this rail session" (the rail's
 * own hide applies); the effect resets it on every open/close so the NEXT open
 * starts from the rail's default rather than remembering the last gesture.
 *
 * Review mode is left alone: the read-only reveal already owns panel visibility
 * there, and two transient layers arguing over one panel is how a control starts
 * reading as dead.
 */
import {useEffect, useState, useCallback, useMemo} from 'react';
import {panelHiddenFor, type ReviewReveal} from './reviewChrome';
import type {PanelState} from './panelCollapse';

export type RailPanel = {
  /** true while the rail owns the transient layer (i.e. the rail is open). */
  active: boolean;
  /** the inspector's EFFECTIVE hidden state: the rail layer folded over the persisted one. */
  rightHidden: (readOnly: boolean, reveal: ReviewReveal, state: PanelState) => boolean;
  /** the right chevron's action while the rail is open: flips the TRANSIENT layer only. */
  toggle: () => void;
  /** the both-panels chord's right half: set the TRANSIENT layer to a visible decision,
   *  so a global chord computed from what the eye sees cannot leave this layer disagreeing. */
  setShown: (visible: boolean) => void;
};

export function useRailPanel(railOpen: boolean): RailPanel {
  /** null = no manual decision this rail session; true = the user showed it. */
  const [shown, setShownState] = useState<boolean | null>(null);
  useEffect(() => { setShownState(null); }, [railOpen]);
  const toggle = useCallback(() => setShownState(v => v === true ? false : true), []);
  const setShown = useCallback((visible: boolean) => setShownState(visible), []);
  /* A STABLE identity per (railOpen, shown) — App's keydown effect lists this
   * object as a dependency, and a fresh object every render would tear that
   * one-shot listener down on every canvas frame (the M3/S2c reason it reads a
   * ref instead of closing over the flags). */
  return useMemo(() => ({
    active: railOpen,
    rightHidden: (readOnly: boolean, reveal: ReviewReveal, state: PanelState) =>
      railOpen && !readOnly ? shown !== true : panelHiddenFor(readOnly, reveal, state, 'right'),
    toggle,
    setShown,
  }), [railOpen, shown, toggle, setShown]);
}
