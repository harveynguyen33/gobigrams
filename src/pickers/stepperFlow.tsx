/* ROUND BN-4 — one slice of the former src/InspectorPickers.tsx (split
   verbatim, 2026-10-25 along the section banners the file declares).
   src/InspectorPickers.tsx re-exports the union, so no importer changes. */
import {useCallback, useEffect, useRef, useState} from 'react';
import type {PickerOption} from './rows';

/* ===========================================================================
   Stepper — §B #7. A numeric ordinal from 1..6 has no icon vocabulary, and a
   6-item select was the wrong shape for it. `min`/`max` clamp in the handler so
   the control cannot emit an out-of-range value.

   ROUND AM, AM-5 — `compact`. A stepper in a FULL-WIDTH field stretched its
   buttons across the whole 253px inspector row to show one digit, which is far
   more control than the value has. `.compact` caps the group at 96px.

   A MODIFIER, NOT A CHANGE TO THE DEFAULT, and deliberately so: this component
   has more than one caller's worth of geometry (the count row here, and any
   later ordinal row), and a stepper that suddenly stopped filling its field
   would silently re-flow every row that already relied on the full width. The
   default class string is untouched, so a caller opts IN to the compact form by
   passing `compact` — and the harness asserts exactly that: the default is
   still `.insp-stepper` and only the flow count's instance is compact.
   =========================================================================== */
export function Stepper({value, onChange, min, max, title, compact = false}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  title: string;
  compact?: boolean;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className={`insp-stepper${compact ? ' compact' : ''}`} role="group" aria-label={title}>
      <button
        type="button" className="insp-step-btn" title={`Fewer (min ${min})`}
        disabled={value <= min} onClick={() => onChange(clamp(value - 1))}
      >−</button>
      <span className="insp-step-val" data-value={value}>{value}</span>
      <button
        type="button" className="insp-step-btn" title={`More (max ${max})`}
        disabled={value >= max} onClick={() => onChange(clamp(value + 1))}
      >+</button>
    </div>
  );
}

/* ===========================================================================
   ROUND AM, AM-4/AM-5 — THE FLOW SPEED CONTROL: a slider whose PICTURE is the
   speed, plus the live rail that draws it.

   WHY A SLIDER AND NOT THE FOUR WORDS. `slow / normal / fast / very fast` spent
   a whole 30px row and a second field label to offer four hard steps over a
   value that is genuinely continuous — the renderer already accepts any number
   in its clamp, so the four chips were coarser than the field they wrote. One
   slider on the SAME range (`0.6 … 8` seconds, which is `GoblinEdge`'s own
   clamp — the four chip values 4 / 2.4 / 1.4 / 0.8 all live inside it) shows
   and sets every value the field can hold.

   THE DISPLAY DIRECTION IS INVERTED, ON PURPOSE, AND THIS IS THE ONE PLACE IT
   HAPPENS. The stored value is DURATION — bigger means slower. On a slider that
   also runs left-to-right, a bigger number to the right would mean dragging
   right makes the animation SLOWER, which is the opposite of the gesture
   everyone brings to a speed control. So the INPUT's own min/max/step are the
   duration range (unchanged, so the DOM stays honest about the value it holds)
   and the arithmetic below maps the slider's POSITION to a duration as
   `SPEED_MAX + SPEED_MIN - seconds`: position 0 → 8.0s (slowest, left), position
   max → 0.6s (fastest, right). The helper is exported and pure so the harness
   can EXECUTE the mapping instead of restating it, and the printed number is
   always the real stored seconds so the inversion is never hidden from the user.

   ONE GESTURE, ONE UNDO STEP. `input` fires per frame of a drag; calling the
   writer raw would push an entry per frame and bury the user's real history
   under hundreds of steps — the same defect `src/resizeHistory.ts` was written
   to prevent, and the same rule ROUND T's bend slider followed. `pointerdown`
   and `keydown` push ONCE, at the start of the gesture; `input` writes the value
   with `coalesce` so the frames after the first do not push again. The keyboard
   path matters for the same reason: holding an arrow key repeats `input`, so it
   opens a gesture the same way a pointer does, and `blur` closes it.

   ROUND AN, AN-4 — THE RAIL THAT USED TO BE DESCRIBED HERE IS DELETED (see the
   note at the end of this module): the owner did not want a preview of the
   speed, so the only read-out left is `.speedval`, driven by the SAME `value`
   prop, which is why that number is now the control's whole feedback.
   =========================================================================== */

/** The slider's own numeric range, as the renderer clamps it (`GoblinEdge`). */
export const SPEED_MIN = 0.6;
export const SPEED_MAX = 8;

/** Slider POSITION (the input's own value, in SECONDS) → the duration it means.
 *  The inversion, in one place: dragging RIGHT is FASTER, because the position
 *  axis is read as "toward fast" while the stored axis is "seconds per loop". */
export const sliderSeconds = (position: number) => (SPEED_MAX + SPEED_MIN) - position;

/** The value actually stored, rounded to ONE DECIMAL, so a drag cannot write
 *  2.3999999 into a board (the input is `step="0.1"`, but a pointer drag is the
 *  browser's arithmetic, not ours, and the float noise is real). */
export const storableSeconds = (n: number) => Math.round(n * 10) / 10;

export function FlowSpeed({value, onInput, onGestureBoundary, title}: {
  value: number;
  /** Write the new duration. `coalesce` collapses the gesture's frames into the
   *  single entry `onGestureBoundary` opened. */
  onInput: (seconds: number) => void;
  /** A GESTURE BOUNDARY — arm the coalesce latch. Called at the START of a
   *  gesture (so the first frame writes one history entry) and at its END (so
   *  the NEXT gesture writes another). Both boundaries are the same operation,
   *  which is why there is one prop and not two. */
  onGestureBoundary: () => void;
  title: string;
}) {
  const seconds = Math.max(SPEED_MIN, Math.min(SPEED_MAX, value));
  return (
    <div className="speedwrap">
      <input
        type="range"
        className="flow-speed-range"
        min={SPEED_MIN} max={SPEED_MAX} step={0.1}
        /* the POSITION the thumb sits at — the inversion, applied here */
        value={sliderSeconds(seconds)}
        aria-label={title}
        aria-valuetext={`${seconds.toFixed(1)} seconds per loop`}
        title={`${seconds.toFixed(1)}s per loop — drag right for faster`}
        onPointerDown={onGestureBoundary}
        onPointerUp={onGestureBoundary}
        onPointerCancel={onGestureBoundary}
        /* `ev.repeat` is the whole reason this guard exists: HOLDING an arrow key
           repeats keydown, and an ungated handler would re-arm the latch on every
           repeat — one history entry per repeat, i.e. exactly the flooding the
           coalesce rule prevents. A key's FIRST press is a new gesture; its
           repeats are frames of the one already running. */
        onKeyDown={ev => { if (!ev.repeat) onGestureBoundary(); }}
        onKeyUp={onGestureBoundary}
        onBlur={onGestureBoundary}
        onChange={ev => onInput(storableSeconds(sliderSeconds(Number(ev.target.value))))}
      />
      <span className="speedval" data-value={seconds}>{seconds.toFixed(1)}s</span>
    </div>
  );
}

/* ROUND AN, AN-4 — THE FLOW RAIL IS DELETED, WITH ITS REASON, SO A LATER ROUND
   DOES NOT RE-ADD IT. AM-4 put a bead on a rail here, travelling at the edge's
   stored `flowDuration`, on the theory that the speed would be better FELT than
   read. The owner removed it in his second device test: "tôi k cần cái Flow
   rail, xoá đi". Gone: this component, its render site in the flow section, its
   five rules in `styles.css`, both of its motion-gate entries, and the `label`
   prop that carried its caption.

   WHAT STAYED, and it is the whole live subject of the item: `FlowSpeed`'s
   `.speedval` number, still printed beside the thumb and still built from the
   same stored seconds the slider writes. So the speed is still legible and still
   checkable; only the illustration went. Recorded so it is not re-learned: a
   preview inside the panel is not a CONTROL, and the owner asked for controls. */

