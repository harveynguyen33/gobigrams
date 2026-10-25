/* ROUND BN-4 — panes split out of the former src/Settings.tsx (verbatim,
   2026-10-25). src/Settings.tsx keeps the shell and imports these back,
   so the mounted UI is unchanged. */
import type React from 'react';
import {type Mode, type ThemeName} from '../theme';
import {type MarqueeMode} from '../marqueeMode';
import {type ZOrderMode} from '../zOrderMode';

export type Props = {
  open: boolean;
  onClose: () => void;
  /** the user's stored preference (Mode) — the picker writes back through this */
  mode: Mode;
  onMode: (m: Mode) => void;
  /** the theme actually painted right now (resolveMode(mode)) — for the System card */
  resolved: ThemeName;
  /** the connection rules — real controls, owned by App (session state) */
  noCycles: boolean;
  onNoCycles: React.Dispatch<React.SetStateAction<boolean>>;
  oneIn: boolean;
  onOneIn: React.Dispatch<React.SetStateAction<boolean>>;
  dblConnect: boolean;
  onDblConnect: (v: boolean) => void;
  dblRange: number;
  onDblRange: (n: number) => void;

  /** M4: the canvas snap-grid pitch — the NUMBER. The on/off toggle stays on
   *  the toolbar (so this row is not a duplicate control); App owns the value
   *  and clamps it, this file only reads it and asks for a new one. */
  gridSize: number;
  onGridSize: (n: number) => void;
  alignGuides: boolean;
  onAlignGuides: React.Dispatch<React.SetStateAction<boolean>>;
  /** PACKAGE-S §S-2 — export defaults (persisted in App via prefs.ts). */
  pngScale: number;
  onPngScale: (n: number) => void;
  pngPad: number;
  onPngPad: (n: number) => void;
  /** PACKAGE-S §S-3 — the autosave control (default ON). */
  autosave: boolean;
  onAutosave: React.Dispatch<React.SetStateAction<boolean>>;
  /** effective motion flag (`animate === true` means motion is ON) — the row
   *  reads "Reduce motion", i.e. the inverse. The setter is useAnimationGating's
   *  existing toggle, so the persisted override stays in one place. */
  animate: boolean;
  onAnimate: () => void;
  /** F — the hover edge-highlight option (default OFF). App owns the persisted
   *  flag via useHoverHighlight; this row only reads it and asks to flip it. */
  highlight: boolean;
  onHighlight: () => void;
  /** ROUND AA, ITEM 2 — THE MARQUEE SELECTION MODE. A real, persisted, live
   *  control: App owns the value through `useMarqueeMode` (which also owns the
   *  React Flow prop), and this row is the discoverable surface. The values are
   *  the stored tokens; `MARQUEE_OPTS` carries the plain-language names that
   *  print on the buttons. NOT a gesture row in the Shortcuts pane — see the
   *  `SHORTCUTS_MOUSE` comment below for why that list stays as it is. */
  marquee: MarqueeMode;
  onMarquee: (m: MarqueeMode) => void;
  /** CONFIG ROUND (2026-10-23) — the z-order display mode (Canvas pane). App
   *  owns the persisted value through `useZOrderMode`, which also owns the
   *  React Flow prop; this row is the discoverable surface. */
  zOrder: ZOrderMode;
  onZOrder: (m: ZOrderMode) => void;
  /** return focus to the toolbar button on close */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
  /** ROUND BI — the current board as a PNG data URL, through App's existing
   *  export path (buildPng). Null on an empty board: the feedback dialog's
   *  screenshot helper then renders nothing. */
  boardPng?: (() => Promise<string>) | null;
  /** ROUND BI, ITEM 3 — the About pane's feedback entry opens the APP-level
   *  dialog (App.tsx mounts the single instance; the ? help sheet is the other
   *  opener). The element is passed so Esc returns focus to the exact control. */
  onOpenFeedback: (from: HTMLElement | null) => void;
};
