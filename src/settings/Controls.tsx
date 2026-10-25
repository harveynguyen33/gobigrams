/* ROUND BN-4 — split out of the former src/Settings.tsx (verbatim,
   2026-10-25). src/Settings.tsx keeps the shell; every import of the
   dialog itself is unchanged. */
import {useCallback, useEffect, useRef, useState} from 'react';


/** M4 — Canvas → Grid size: the standard snap pitches the segmented control
 *  offers, in ascending order. `16` is the app's default and must stay in this
 *  list. The list lives here (not in App) because it is presentation, not app
 *  state. */
export const GRID_SIZES = [8, 16, 20, 32, 64] as const;

/** The options the Grid size control renders. `gridSize` is App state, so a
 *  value from outside the list is possible in principle: a fixed list that
 *  matches nothing would show no selection at all, so a stray value is appended
 *  as its own segment and the control still shows what the board actually uses.
 *  No clamp or rounding is invented — this only reports the value. */
export function gridSizeOptions(current: number): number[] {
  if ((GRID_SIZES as readonly number[]).includes(current)) return [...GRID_SIZES];
  return [...GRID_SIZES, current];
}

/* HARVEY 2026-10-13 — the dblclick auto-connect reach, in the same segmented
   style as Grid size. 150–800 px, and a stray stored value still shows. */
export const DBL_RANGES = [150, 200, 300, 400, 600, 800] as const;

export function dblRangeOptions(current: number): number[] {
  if ((DBL_RANGES as readonly number[]).includes(current)) return [...DBL_RANGES];
  return [...DBL_RANGES, current];
}

export function Row({label, hint, children}: {label: string; hint?: string; children?: React.ReactNode}) {
  return (
    <div className="settings-row">
      <span className="settings-row-label">
        {label}
        {hint && <span className="settings-row-hint">{hint}</span>}
      </span>
      <span className="settings-row-val">{children}</span>
    </div>
  );
}

/** Marks a row whose control ALSO lives on the toolbar (not "only there"). */
export function ToolbarChip() {
  return <span className="settings-chip" title="Also available on the canvas toolbar">toolbar</span>;
}

/** A real on/off control (role=switch) for the settings that moved off the
 *  toolbar. The value and its setter are owned by App; this is presentation. */
export function Toggle({label, value, onToggle}: {
  label: string; value: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      className={`settings-toggle${value ? ' on' : ''}`}
      aria-label={label}
      aria-checked={value}
      onClick={onToggle}
    >
      <span className="settings-toggle-knob" aria-hidden="true" />
    </button>
  );
}

/** A segmented control (role=radiogroup + role=radio): one tap picks a value
 *  and the current one is always visible. Mirrors ThemePicker's card grid —
 *  roving tabindex, so exactly one segment is in the Tab order, and
 *  ArrowLeft/ArrowRight/Home/End move the selection and fire `onPick`.
 *
 *  ROUND AA, ITEM 2 — GENERIC OVER THE VALUE TYPE, NOT DUPLICATED FOR STRINGS.
 *  The Canvas group's first row (Grid size) is a list of NUMBERS and the new
 *  marquee row is a list of MODE STRINGS (`touch` / `enclose`), so the same
 *  radiogroup had to serve both. A second, near-identical control would be the
 *  actual defect here — two roving-tabindex implementations that can drift
 *  apart — so the component is generic and `String(n)` names each segment. The
 *  call sites are unchanged in shape.
 *
 *  `labelOf` is the one addition that genericness needs: the marquee row's
 *  VALUES are the stored tokens (`touch` / `enclose`) while the WORDS on the
 *  buttons are the plain-language names. Printing the raw token would put
 *  `enclose` in front of the user; the stored value stays the token. Absent, it
 *  is `String(n)` — byte-identical to what every existing row printed. */
export function Segmented<T extends string | number>({label, options, value, onPick, labelOf}: {
  label: string;
  options: readonly T[];
  value: T;
  onPick: (n: T) => void;
  labelOf?: (n: T) => string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIdx = Math.max(0, options.indexOf(value));
  const [focusIdx, setFocusIdx] = useState(selectedIdx);
  useEffect(() => { setFocusIdx(selectedIdx); }, [selectedIdx]);

  const pick = useCallback((i: number) => {
    const n = options[i];
    if (n === undefined) return;
    setFocusIdx(i);
    onPick(n);
    refs.current[i]?.focus();
  }, [options, onPick]);

  const onKey = useCallback((e: React.KeyboardEvent, i: number) => {
    const last = options.length - 1;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': e.preventDefault(); pick(Math.min(i + 1, last)); break;
      case 'ArrowLeft': case 'ArrowUp': e.preventDefault(); pick(Math.max(i - 1, 0)); break;
      case 'Home': e.preventDefault(); pick(0); break;
      case 'End': e.preventDefault(); pick(last); break;
      default: break;
    }
  }, [options, pick]);

  return (
    <div className="settings-seg" role="radiogroup" aria-label={label}>
      {options.map((n, i) => {
        const on = n === value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={labelOf ? labelOf(n) : String(n)}
            className={`settings-seg-btn${on ? ' on' : ''}`}
            tabIndex={i === focusIdx ? 0 : -1}
            ref={el => { refs.current[i] = el; }}
            onClick={() => pick(i)}
            onKeyDown={e => onKey(e, i)}
          >{labelOf ? labelOf(n) : n}</button>
        );
      })}
    </div>
  );
}
