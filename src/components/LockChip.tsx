/* LockChip.tsx — LOCK-CHROME (t_63bd6f5d, 2026-11-17) · SEL-CHROME-B
 * (t_edb37ea1) · SEL-CHROME-UNIFY (t_e479c12d, 2026-11-19).
 *
 * The ONE lock control, and it lives on the selection pill. LOCK v1 painted a
 * padlock on every locked CARD (`LockGlyph`) — ten locked nodes turned the
 * canvas into a field of padlocks; LOCK-CHROME moved the affordance to the
 * selection chrome. The 2026-11-17 grammar then drew NOTHING while unlocked
 * ("absence is the state") — the owner overturned that on 2026-11-18 after his
 * device test: a control that only appears once you have locked cannot be
 * DISCOVERED before you need it. The padlock is therefore ALWAYS present, in
 * two glyphs (the rationale this comment must keep):
 *   locked   -> CLOSED shackle (accent disc, heavier stroke)
 *   unlocked -> OPEN shackle, muted (a grey closed padlock reads as "locked")
 *   mixed    -> the SAME disc half-filled + a dashed ring — never a second icon
 *   inherited-> data-lock-owner="group"; the label names the GROUP, because
 *              pressing it cannot write: `toggleLock` refuses an inherited-only
 *              unlock with that reason (MENU-STATES rule).
 *
 * The per-CARD surface (18px disc inset 5px — LOCK_CHIP.sizePx/insetPx) retired
 * with the same round: one pill serves the sole selection and the multi-
 * selection alike, so this is a flex CHILD of GroupRotateGrip's pill — no inline
 * position, 24px so the hit target matches the rotate control beside it.
 */
import {memo} from 'react';

/** Geometry shared with the harness: the pill control's square size. The card
 *  disc's sizePx/insetPx died with the card surface (SEL-CHROME-UNIFY). */
export const LOCK_CHIP = {handlePx: 24} as const;

export const LockChip = memo(function LockChip({inherited, onToggle, mixed = false, locked = true}: {
  inherited: boolean;
  onToggle: () => void;
  mixed?: boolean;
  /** false = nothing locked: the OPEN shackle — still present on the pill. */
  locked?: boolean;
}) {
  const state = !locked ? 'none' : mixed ? 'some' : 'all';
  const label = !locked
    ? inherited
      ? 'Lock the group (Alt+L)'
      : 'Lock the selection (Alt+L)'
    : mixed
      ? inherited
        ? 'Some nodes locked by their group — unlock the group'
        : 'Some nodes locked — click to unlock all (Alt+L)'
      : inherited
        ? 'Locked by its group — unlock the group'
        : 'Locked — click to unlock the selection (Alt+L)';
  return (
    <button
      type="button"
      /* The handle pill is NOT inside React Flow's pane (it is an app-level
         sibling), so no `nopan` is needed there; a press still stops here so no
         selection change can fire under it. */
      className="ds-lock-chip ds-lock-chip-btn"
      data-lock-chip="1"
      data-lock-state={state}
      data-lock-owner={inherited ? 'group' : 'own'}
      aria-label={label}
      /* no `title`: an always-visible control in the handle's own pill must not
         need a hover tooltip to be understood (the aria-label carries it). */
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {e.stopPropagation(); onToggle();}}
      style={{width: LOCK_CHIP.handlePx, height: LOCK_CHIP.handlePx}}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <rect x="3" y="7" width={mixed ? 4.6 : 10} height="7" rx="1.6" fill="currentColor" />
        {/* the shackle: BOTH legs descend into the body when locked; the right
            leg RISES clear of it when unlocked — two glyphs, never an absence. */}
        <path
          d={locked ? 'M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7' : 'M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V3'}
          fill="none"
          stroke="currentColor"
          strokeWidth={state === 'all' ? 2 : 1.6}
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
});
