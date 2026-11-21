/**
 * VIEW-MODE CHROME (2026-11-14) — the READ-ONLY panel reveal.
 *
 * Owner's report: in view mode the two docked panels must be HIDDEN by
 * default, and the panel shortcut did nothing there. The root cause was a
 * wrong rationale, not a missing feature: App.tsx kept the three panel chords
 * BELOW the `readOnly || codeStale` early-return on the argument that "panel
 * visibility is a persisted layout mutation". It is not — hiding or showing a
 * panel is a VIEW concern; only the persisted WRITE is a layout mutation, and
 * review never performs one. The chords moved above the return; this module
 * owns the REVIEW HALF of that move.
 *
 * A viewer gets a TRANSIENT reveal that is deliberately NEVER persisted: they
 * may bring the palette/inspector on screen, but they must never rewrite the
 * `diagram-studio:panels` layout of the editor they will return to — and a
 * first-time #b= share visitor (the same readOnly, no separate branch) should
 * not inherit docked UI they cannot use.
 *
 * SHAPE (follows marqueeMode.ts / panelCollapse.ts): the effective-hidden
 * mapping lives ONLY here, so the chord writer, the chevron and the `.app`
 * classes cannot disagree about what the eye sees.
 *
 *   - `useReviewReveal(active)` holds the local `{left, right}` reveal state
 *     and RESETS it on every entry into AND exit from read-only (the effect
 *     keys on `active`): leaving view mode restores the persisted editor
 *     layout exactly, and the next entry starts fully hidden again.
 *   - `panelHiddenFor()` is the ONE effective-hidden read: read-only ? !reveal
 *     : persisted collapse. App computes `leftHidden`/`rightHidden` through
 *     it, so `hiddenRef`, the group chord's "any visible → hide both"
 *     decision and the render classes all describe the EFFECTIVE state.
 *
 * Deliberately NOT a Settings row (the same reasoning that retired the Tips
 * switch): the controls are the chords and the edge chevrons, where the need
 * appears. The phone/tablet drawer+sheet tiers keep their own overlay openers
 * — a second reveal mechanism there would be a second truth.
 */
import {useCallback, useEffect, useState} from 'react';
import {isPanelHidden, type PanelSide, type PanelState} from './panelCollapse';

/** Local-only reveal set: true = the viewer asked this panel on screen. */
export type ReviewReveal = {left: boolean; right: boolean};

export const DEFAULT_REVEAL: ReviewReveal = {left: false, right: false};

export type ReviewRevealApi = {
  reveal: ReviewReveal;
  /** Per-side chord + edge chevron: flip one side's transient visibility. */
  toggleSide: (side: PanelSide) => void;
  /** Group chord: ONE atomic both-sides write of a VISIBLE decision. */
  setBothVisible: (visible: boolean) => void;
};

/** Owns the reveal state and resets it on every entry into and exit from
 *  read-only. `active` is App's `readOnly`; a #b= share view boots with it
 *  already true, so the mount pass is a harmless no-op there. */
export function useReviewReveal(active: boolean): ReviewRevealApi {
  const [reveal, setReveal] = useState<ReviewReveal>(DEFAULT_REVEAL);
  useEffect(() => { setReveal(DEFAULT_REVEAL); }, [active]);
  const toggleSide = useCallback((side: PanelSide) => {
    setReveal(r => ({...r, [side]: !r[side]}));
  }, []);
  const setBothVisible = useCallback((visible: boolean) => {
    setReveal({left: visible, right: visible});
  }, []);
  return {reveal, toggleSide, setBothVisible};
}

/** The ONE effective-hidden read. In review a panel is hidden unless the
 *  viewer revealed it; in edit mode it is exactly the persisted collapse. */
export function panelHiddenFor(readOnly: boolean, reveal: ReviewReveal, state: PanelState, side: PanelSide): boolean {
  return readOnly ? !reveal[side] : isPanelHidden(state, side);
}
