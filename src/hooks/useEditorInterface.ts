/**
 * PACKAGE-M3 / Step 1 — editor interface hook (foundation).
 *
 * Decides the LAYOUT CLASS the editor should render in (desktop / tablet /
 * phone) from the size of the editor CONTAINER, not the window. The tool is
 * meant to be embeddable and shareable, so a window media query would be wrong
 * the moment the editor sits in a pane, an iframe or a split column.
 * Precedent: Excalidraw measures `container.getBoundingClientRect()` and
 * exposes `UIOptions.dockedSidebarBreakpoint`; tldraw has `forceMobile`.
 *
 * Consumers:
 *   - `App.tsx` — panel collapse / compact shell (Step 2).
 *   - later steps (touch, tablet, phone shells) consume `formFactor` +
 *     `isTouchScreen` without re-measuring anything.
 */
import {useEffect, useMemo, useState} from 'react';

export type FormFactor = 'desktop' | 'tablet' | 'phone';

/** The canonical 3-column layout threshold.
 *  Same number as Excalidraw's `MQ_RIGHT_SIDEBAR_MIN_WIDTH` — at or above it
 *  the editor can host both docked sidebars plus a usable canvas. Overridable
 *  per call so a narrow host (embed, side pane) can force the compact layout.
 *  NOTE: `styles.css` mirrors this as `@media (max-width: 1228.98px)`, the
 *  0.02px-staggered complement of `>= 1229` — one number, two runtimes. */
export const dockedSidebarBreakpoint = 1229;

/** Width at or below which we are always in the phone shell. */
export const PHONE_MAX_WIDTH = 599;
/** A short viewport is a landscape phone — an iPhone in landscape is 932×430,
 *  so a width-only test would wrongly keep the sidebars docked. */
export const PHONE_LANDSCAPE_MAX_HEIGHT = 500;
export const PHONE_LANDSCAPE_MAX_WIDTH = 1000;

/** Tablet band: the SMALLER edge is at least this wide … */
export const TABLET_MIN_EDGE = 600;
/** … and the LARGER edge is at most this wide. */
export const TABLET_MAX_EDGE = 1180;

/** Anything this ref-like has a `.current` we should unwrap. */
type RefLike = {current: HTMLElement | null};
export type InterfaceTarget = RefLike | HTMLElement | null | undefined;

export type InterfaceSize = {
  width: number;
  height: number;
  formFactor: FormFactor;
  /** true when the container is wider than it is tall. */
  isLandscape: boolean;
  /** Can the docked 3-column layout fit in this container? */
  canFitSidebar: boolean;
};

export type EditorInterface = InterfaceSize & {
  isTouchScreen: boolean;
};

/** Unwrap a ref object, an element, or nothing. */
export function resolveElement(target: InterfaceTarget): HTMLElement | null {
  if (!target) return null;
  if (typeof (target as RefLike).current !== 'undefined') return (target as RefLike).current;
  return target as HTMLElement;
}

/** Pure breakpoint rules — the single source of truth, trivially testable. */
export function resolveFormFactor(width: number, height: number): FormFactor {
  // phone: narrow, OR short-and-not-wide (landscape phone)
  if (width <= PHONE_MAX_WIDTH) return 'phone';
  if (height < PHONE_LANDSCAPE_MAX_HEIGHT && width < PHONE_LANDSCAPE_MAX_WIDTH) return 'phone';

  const minEdge = Math.min(width, height);
  const maxEdge = Math.max(width, height);
  if (minEdge >= TABLET_MIN_EDGE && maxEdge <= TABLET_MAX_EDGE) return 'tablet';

  return 'desktop';
}

/** Full derivation for one measured box. */
export function computeInterface(
  width: number,
  height: number,
  breakpoint: number = dockedSidebarBreakpoint,
): InterfaceSize {
  const formFactor = resolveFormFactor(width, height);
  return {
    width,
    height,
    formFactor,
    isLandscape: width > height,
    canFitSidebar: formFactor === 'desktop' && width >= breakpoint,
  };
}

/** Read a live box; before the container exists (first paint / SSR) fall back
 *  to the viewport so the first frame is never stuck in the wrong shell. */
function measureBox(el: HTMLElement | null): {width: number; height: number} {
  if (el) {
    const r = el.getBoundingClientRect();
    return {width: Math.round(r.width), height: Math.round(r.height)};
  }
  if (typeof window === 'undefined') return {width: 0, height: 0};
  return {width: window.innerWidth, height: window.innerHeight};
}

/** Pointer-capability probe: `(pointer: coarse)` first, capability fallback
 *  when matchMedia is unavailable (older embedded webviews, jsdom). */
export function detectTouchScreen(): boolean {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(pointer: coarse)').matches;
    }
  } catch { /* fall through to the capability probe */ }
  try {
    if (typeof navigator !== 'undefined') {
      const nav = navigator as Navigator & {msMaxTouchPoints?: number};
      return (nav.maxTouchPoints ?? nav.msMaxTouchPoints ?? 0) > 0;
    }
  } catch { /* ignore */ }
  return false;
}

/** `isTouchScreen`, kept live across a pointer change (e.g. a hybrid laptop
 *  switching from touch to trackpad). */
export function useIsTouchScreen(): boolean {
  const [touch, setTouch] = useState<boolean>(detectTouchScreen);

  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia('(pointer: coarse)');
    } catch { mq = null; }
    if (!mq) return;

    const sync = () => setTouch(mq!.matches);
    sync();
    // Safari < 14 has no addEventListener on MediaQueryList.
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', sync);
      return () => mq!.removeEventListener('change', sync);
    }
    mq.addListener(sync);
    return () => mq!.removeListener(sync);
  }, []);

  return touch;
}

export type UseEditorInterfaceOptions = {
  /** Override {@link dockedSidebarBreakpoint} for a narrow host. */
  breakpoint?: number;
};

/**
 * Observe the EDITOR CONTAINER and report the interface class it should use.
 *
 * @param target the container element or a ref to it (the `.app` element).
 * @param options.breakpoint override the docked-sidebar threshold.
 */
export function useEditorInterface(
  target: InterfaceTarget,
  options: UseEditorInterfaceOptions = {},
): EditorInterface {
  const breakpoint = options.breakpoint ?? dockedSidebarBreakpoint;
  const [box, setBox] = useState<{width: number; height: number}>(() =>
    measureBox(resolveElement(target)),
  );

  useEffect(() => {
    const el = resolveElement(target);

    const read = () => {
      const next = measureBox(el);
      // Only re-render on a real pixel change — a ResizeObserver on a grid
      // container fires on every animation frame of the .22s width transition.
      setBox(prev => (prev.width === next.width && prev.height === next.height ? prev : next));
    };

    read();

    let ro: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(read);
      ro.observe(el);
    }
    // Container-less hosts and orientation changes still need a signal.
    window.addEventListener('resize', read);
    window.addEventListener('orientationchange', read);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', read);
      window.removeEventListener('orientationchange', read);
    };
  }, [target, breakpoint]);

  const info = useMemo(
    () => computeInterface(box.width, box.height, breakpoint),
    [box.width, box.height, breakpoint],
  );
  const isTouchScreen = useIsTouchScreen();

  return {
    formFactor: info.formFactor,
    isLandscape: info.isLandscape,
    canFitSidebar: info.canFitSidebar,
    isTouchScreen,
    width: info.width,
    height: info.height,
  };
}
