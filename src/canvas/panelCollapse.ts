/**
 * PACKAGE-M3 / Step 2 — docked-panel collapse state + persistence.
 *
 * ONE hide state, ONE shortcut. `collapsed[side]` is the ONLY thing that can
 * mean "this panel is hidden"; Shift+Mod+\ (or each panel's own edge chevron)
 * flips it. The flag is durable on purpose: selecting a node must NOT silently
 * re-expand a panel the user closed.
 *
 * TWO RETIRED FIELDS (parsed tolerantly, never read, never written):
 *
 *   `uiHidden` — an app-wide "hide ALL panel UI" boolean, written by a bare
 *   Mod+\\. Two independent flags that both meant "hidden" let the pair go out
 *   of sync: the second shortcut wrote the first one's flag, so pressing the
 *   first again cleared only its own flag, the panels stayed hidden, and the
 *   toggle looked dead. One flag per side makes that state unreachable.
 *
 *   `pinned` — the override for the old C4 rule ("auto-hide the inspector while
 *   nothing is selected"). Step 2d deleted that derived hide, so there is
 *   nothing left to override: a flag that has no live meaning is a control that
 *   lies, and it was the residue that could hold a panel open forever. Both
 *   sides now hide for exactly ONE reason — the user collapsed them.
 *
 * Net: ONE durable flag per side, ONE localStorage key, no derived hide and no
 * override. A value written by an older build (with either retired key) still
 * parses without throwing; the keys are simply dropped on the next save.
 */
import {useCallback, useEffect, useState} from 'react';

export type PanelSide = 'left' | 'right';

/** ONE namespaced key for both panels (`diagram-studio:` matches MODE_KEY in
 *  theme.ts and ANIMATE_KEY in choreography.ts). */
export const PANELS_KEY = 'diagram-studio:panels';

export type PanelState = {
  /** Manual collapse, per side. "user-collapsed", never "minimize". */
  collapsed: Record<PanelSide, boolean>;
};

export const DEFAULT_PANEL_STATE: PanelState = {
  collapsed: {left: false, right: false},
};

/** Tolerant parse: never throw on a hand-edited or half-written value, and
 *  never trust the shape — a missing/extra field falls back to the defaults.
 *  The retired `uiHidden` and `pinned` keys are ignored on purpose: neither has
 *  any live meaning, so such a board reloads expanded instead of stuck hidden. */
export function parsePanelState(raw: string | null): PanelState {
  if (!raw) return DEFAULT_PANEL_STATE;
  try {
    const v = JSON.parse(raw) as {
      collapsed?: {left?: unknown; right?: unknown};
      // retired fields — an old value may also carry `uiHidden` and `pinned`;
      // neither is read here, so they are deliberately absent from this type.
    } | null;
    return {
      collapsed: {
        left: v?.collapsed?.left === true,
        right: v?.collapsed?.right === true,
      },
    };
  } catch {
    return DEFAULT_PANEL_STATE;
  }
}

export function loadPanelState(): PanelState {
  try {
    return parsePanelState(localStorage.getItem(PANELS_KEY));
  } catch {
    // private mode / storage disabled — the app still works, just never remembers
    return DEFAULT_PANEL_STATE;
  }
}

export function savePanelState(state: PanelState): void {
  try {
    localStorage.setItem(PANELS_KEY, JSON.stringify(state));
  } catch { /* storage full or disabled — collapsing still works for this session */ }
}

/**
 * The one rule. Step 2d removed the derived `autoHidden` reason, so a panel is
 * hidden when — and only when — the user collapsed it by hand. Both sides use
 * the same shape, which is what makes the inspector symmetric with the palette.
 */
export function isPanelHidden(state: PanelState, side: PanelSide): boolean {
  return state.collapsed[side];
}

export type PanelCollapse = {
  state: PanelState;
  /** Flip the manual collapse flag for one side. */
  togglePanel: (side: PanelSide) => void;
  /**
   * The shortcut's ONE atomic write: make both panels match a single VISIBLE
   * decision, in a SINGLE `setState`. `visible=true` → expand both,
   * `visible=false` → collapse both.
   *
   * It must stay atomic and driven by what is VISIBLE, because the shortcut is
   * a global action: deriving the next value from the raw `collapsed` flags
   * once let a press change nothing the eye could see (a left-only collapse
   * read as "not both collapsed" → next=true → it wrote right:true for a right
   * panel that was already hidden). Passing the visible state in makes the
   * press always change something the user can see. There is no pin left to
   * clear — one flag per side is the whole state.
   */
  setPanelsVisible: (visible: boolean) => void;
};

/** Owns the state and mirrors every change into localStorage. */
export function usePanelCollapse(): PanelCollapse {
  const [state, setState] = useState<PanelState>(loadPanelState);

  useEffect(() => { savePanelState(state); }, [state]);

  const togglePanel = useCallback((side: PanelSide) => {
    setState(s => ({...s, collapsed: {...s.collapsed, [side]: !s.collapsed[side]}}));
  }, []);

  const setPanelsVisible = useCallback((visible: boolean) => {
    setState({collapsed: {left: !visible, right: !visible}});
  }, []);

  return {state, togglePanel, setPanelsVisible};
}
