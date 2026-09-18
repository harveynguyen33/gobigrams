import {cloneElement, isValidElement, useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

type TooltipProps = {
  label: string;
  /** Which side of the trigger the popover appears on. Default: bottom. */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing, in ms. Default: 350. */
  delay?: number;
  children: React.ReactElement;
};

type Side = NonNullable<TooltipProps['side']>;

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
 * Custom tooltip wrapper: small dark popover on hover AND keyboard focus,
 * after a short delay, positioned with position:fixed so it is never clipped
 * by overflow:hidden containers (the toolbar, panels). Dismisses on mouse
 * leave, blur and Escape. No animation, so prefers-reduced-motion is respected.
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
  const trigger = cloneElement(child as React.ReactElement<any>, {
    ref: (el: HTMLElement | null) => {
      triggerRef.current = el;
      // preserve an existing ref on the child if there was one
      const orig = (child as any).ref;
      if (typeof orig === 'function') orig(el);
      else if (orig && typeof orig === 'object') orig.current = el;
    },
    onMouseEnter: (e: React.MouseEvent) => {
      show();
      (child.props as any).onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide();
      (child.props as any).onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      show();
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