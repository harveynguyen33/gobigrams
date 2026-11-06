import {cloneElement, isValidElement, useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

type TooltipProps = {
  /** PACKAGE-Q: widened from `string` to `ReactNode` so a tooltip can carry the
   *  shortcut as `kbd` chips (the panel-edge chevrons' tooltips do). A plain
   *  string still satisfies this, so every existing call site is unchanged. */
  label: React.ReactNode;
  /** Which side of the trigger the popover appears on. Default: bottom. */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing, in ms. Default: 350. */
  delay?: number;
  children: React.ReactElement;
};

type Side = NonNullable<TooltipProps['side']>;

/* ===========================================================================
   ROUND 4, ITEM 3 (2026-09-20) — INPUT MODALITY, and why a programmatic focus
   must not open a tooltip.

   Harvey, verbatim: "khi tôi create template, hay tôi remove a board, nó đều tự
   nhiên show tooltip như hình. Cần phải click somewhere để nó ẩn."

   MEASURED CAUSE (orchestrator, reproduced live): after a create or a delete the
   app restores focus to the Boards menu button with `.focus()`. The pointer is
   nowhere near that button, so nothing is hovering it; the trigger's `onFocus`
   fired, the tooltip opened, and NO `mouseleave` could ever arrive to close it —
   it stayed until the user clicked elsewhere. A bare `.focus()` on a clean state
   reproduced it.

   THE JUDGEMENT. A tooltip answers "what is this control?" asked by the person
   pointing at it. Focus moving PROGRAMMATICALLY is not a question, so it must not
   be answered. The fix therefore tracks the last input modality document-wide —
   `keydown` means the caret moves because a person is at the keyboard, a pointer
   event means the caret moves because a person is at the mouse — and `onFocus`
   opens the popover ONLY in keyboard mode. Tab-to-the-button still gets its
   tooltip (accessibility preserved); a programmatic `.focus()` after a click does
   not. Hover and mouse-leave are untouched: hovering still shows, leaving still
   hides, Escape still hides.

   WHY THE CLASS AND NOT THE INSTANCE. The narrower fix (hide on every board /
   dialog action close) would silence the two reported flows and leave every OTHER
   programmatic-focus call in the app — the gallery's own restore, the dialog's
   `returnFocusTo`, the focus trap's wrap-around — with the same noise. The
   modality tracker lives HERE, so all ~20 call sites benefit and no call site had
   to change. `App.tsx` gained no state.

   The default is `pointer`: on a fresh document nothing has been typed yet, so a
   focus that arrives before any input is not evidence of a keyboard user. (One
   known nuance, recorded rather than special-cased: an Escape press counts as
   `keydown`, so a programmatic focus landing immediately after an Escape is
   treated as keyboard-driven and may show one tooltip. The next pointer move
   clears it, and the reported flows never take that path.)
   =========================================================================== */
type Modality = 'keyboard' | 'pointer';
let lastModality: Modality = 'pointer';

/** Record that the last input was the keyboard. Exported for the probe. */
export function markKeyboard() { lastModality = 'keyboard'; }
/** Record that the last input was a pointer. Exported for the probe. */
export function markPointer() { lastModality = 'pointer'; }
/** THE DECISION a focus event asks for: show only when the keyboard caused it. */
export function showsOnFocus(): boolean { return lastModality === 'keyboard'; }

/* ONE document-wide pair of listeners, NOT one per Tooltip instance. Capture
   phase so a handler that stops propagation cannot hide the input from us. */
if (typeof window !== 'undefined') {
  const onKey = () => markKeyboard();
  const onPointer = () => markPointer();
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('mousedown', onPointer, true);
  window.addEventListener('pointerdown', onPointer, true);
  window.addEventListener('mousemove', onPointer, true);
  window.addEventListener('touchstart', onPointer, true);
}

/** Compute the fixed-page position for the popover given trigger rect + side.
 * I3: after placing on the preferred side, measure the popover and clamp it
 * into the viewport, flipping to the opposite side when the preferred side
 * does not fit (bottom↔top, left↔right). */
function place(r: DOMRect, side: Side, size: {w: number; h: number}) {
  const M = 8; // viewport margin
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const midX = r.left + r.width / 2;
  const midY = r.top + r.height / 2;

  let top: number; let left: number; let transform: string;
  switch (side) {
    case 'top':    top = r.top - M;    left = midX;   transform = 'translate(-50%, -100%)'; break;
    case 'left':   top = midY;         left = r.left - M; transform = 'translate(-100%, -50%)'; break;
    case 'right':  top = midY;         left = r.right + M; transform = 'translate(0, -50%)'; break;
    default:       top = r.bottom + M; left = midX;   transform = 'translate(-50%, 0)'; break;
  }

  // Flip vertically when the preferred side would push the popover off-screen
  // AND the trigger is close enough to that edge that the other side fits better.
  if (side === 'bottom' && top + size.h > vh - M && r.bottom - M - size.h >= M) {
    side = 'top'; top = r.top - M; transform = 'translate(-50%, -100%)';
  } else if (side === 'top' && top - size.h < M && r.bottom + M + size.h <= vh - M) {
    side = 'bottom'; top = r.bottom + M; transform = 'translate(-50%, 0)';
  } else if (side === 'right' && left + size.w > vw - M && r.left - M - size.w >= M) {
    side = 'left'; left = r.left - M; transform = 'translate(-100%, -50%)';
  } else if (side === 'left' && left - size.w < M && r.right + M + size.w <= vw - M) {
    side = 'right'; left = r.right + M; transform = 'translate(0, -50%)';
  }
  void side;

  // Resolve the transform into plain coords so we can clamp both axes.
  let x = left; let y = top;
  if (transform === 'translate(-50%, -100%)') { x = left - size.w / 2; y = top - size.h; }
  else if (transform === 'translate(-50%, 0)') { x = left - size.w / 2; }
  else if (transform === 'translate(-100%, -50%)') { x = left - size.w; y = top - size.h / 2; }
  else if (transform === 'translate(0, -50%)') { y = top - size.h / 2; }
  x = Math.min(Math.max(M, x), Math.max(M, vw - M - size.w));
  y = Math.min(Math.max(M, y), Math.max(M, vh - M - size.h));
  return {top: y, left: x, transform: 'none'};
}

/**
 * Custom tooltip wrapper: small dark popover on hover, and on focus only when
 * the keyboard caused that focus (ROUND 4, above), after a short delay,
 * positioned with position:fixed so it is never clipped by overflow:hidden
 * containers (the toolbar, panels). Dismisses on mouse leave, blur and Escape.
 * No animation, so prefers-reduced-motion is respected.
 */
export default function Tooltip({label, side = 'bottom', delay = 350, children}: TooltipProps) {
  const [pos, setPos] = useState<{top: number; left: number; transform: string} | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const triggerRef = useRef<HTMLElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const clear = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const show = useCallback(() => {
    clear();
    timer.current = window.setTimeout(() => {
      const el = triggerRef.current;
      if (!el) return;
      // I3: clamp + flip needs the popover size; estimate it by rendering
      // invisibly first, then re-measure once mounted for exact placement.
      setPos(place(el.getBoundingClientRect(), side, {w: 160, h: 32}));
      requestAnimationFrame(() => {
        const el2 = triggerRef.current;
        const pop = popRef.current;
        if (el2 && pop) setPos(place(el2.getBoundingClientRect(), side, {w: pop.offsetWidth, h: pop.offsetHeight}));
      });
    }, delay);
  }, [clear, delay, side]);

  const hide = useCallback(() => {
    clear();
    setPos(null);
  }, [clear]);

  useEffect(() => clear, [clear]);

  const child = isValidElement(children) ? children : <span>{String(children)}</span>;
  /* AR-8 — React 19 removed `element.ref`: the ref now lives on `props.ref`.
     Reading it off the element logs "Accessing element.ref was removed" on
     every load. Both refs chain through ONE closure: the child's own ref
     (callback OR object, read from props) is invoked alongside the tooltip's
     triggerRef, so the child keeps receiving the node. */
  const origRef = (child.props as {ref?: React.Ref<HTMLElement>}).ref;
  const chainRef = (el: HTMLElement | null) => {
    triggerRef.current = el;
    if (typeof origRef === 'function') origRef(el);
    else if (origRef && typeof origRef === 'object') (origRef as {current: HTMLElement | null}).current = el;
  };
  const trigger = cloneElement(child as React.ReactElement<Record<string, unknown>>, {
    ref: chainRef,
    onMouseEnter: (e: React.MouseEvent) => {
      show();
      (child.props as any).onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide();
      (child.props as any).onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      /* ROUND 4, ITEM 3 — the guard. A focus the KEYBOARD caused is a person
         asking what the control is; a focus that arrived from `.focus()` is
         usually the app tidying up after a dialog, and answering it leaves a
         tooltip with no `mouseleave` coming to close it. */
      if (showsOnFocus()) show();
      (child.props as any).onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      hide();
      (child.props as any).onBlur?.(e);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') hide();
      (child.props as any).onKeyDown?.(e);
    },
  });

  return (
    <>
      {trigger}
      {pos !== null && createPortal(
        <div className="tooltip" role="tooltip" ref={popRef} style={pos}>{label}</div>,
        document.body,
      )}
    </>
  );
}
