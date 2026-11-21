/* DescBadge.tsx — DESC-2 (SPEC-NODE-DESCRIPTION, task t_468014a7,
 * 2026-11-12; restyled DA-1 t_b6d2b0a1; panel side extracted DA-2
 * t_5189e3a8; anchor moved OUTSIDE the card EDIT-BALANCE t_864a8e0c).
 * BADGE-ON-SELECT (t_e1ad9237, 2026-11-13): the badge renders iff the node
 * is SELECTED and has a `desc`. The hover path is REMOVED entirely — no
 * pointer-enter/leave reveal, no timers, no host-tracked hover state: hover
 * does not exist on touch devices, and a badge that appears/disappears as
 * the pointer crosses the canvas makes the diagram flicker while the
 * description is being read (Harvey's ask; the DiagramNode listener block
 * that tracked pointer/focus relevance was deleted with it).
 *
 * THE INVARIANT: while a panel for this node is OPEN, the badge stays
 * rendered and clickable even if the selection moves away (otherwise the
 * panel is orphaned with no visible control to close it) — and while the
 * badge HOLDS FOCUS (DESC-5's focus-return contract). Closing the panel
 * returns to the plain selection rule. Read-only review mode (Shift+2)
 * allows sole selection for exactly this door, so the badge reveals there
 * too (App gates every editing affordance off the same lock).
 *
 * DA-1 (§v2): the badge is NOT a disc — no fill, no ring, no shadow at
 * rest. A 24×24 hit box carries a 12px glyph (.desc-badge-g, 50% of the
 * button); --dim at opacity .55 at rest, --acc at full opacity on
 * hover/:focus-visible; the keyboard ring (0 0 0 2px var(--sel)) is
 * :focus-visible only.
 *
 * THE ANCHOR — the rotate grip's LINE (both flow-constant, both children
 * of the card root so they rotate together): the badge's centre y equals
 * the grip's centre y (-21: ROTATE_GRIP.topPx + sizePx/2), its left edge
 * sits 6px right of the grip's right edge (ROTATE_GRIP.sizePx/2 + 6 = 15
 * past the card's centre-x) — derived from ROTATE_GRIP, never a magic
 * pair. WHY FLOW-CONSTANT (k retired): the old k = max(1/zoom, 1) existed
 * to hold a constant SCREEN gap from the SCREEN-CONSTANT resize grips; the
 * new partner is the rotate grip, which is FLOW-SCALED, and a 24k box
 * centred on its flow-constant centre line crosses the card's top edge
 * below zoom ≈ 0.571 (−21 + 12k > 0), violating EDIT-BALANCE's shipped
 * "never overlaps the card at ANY shape or size". Flow-constant geometry
 * keeps the pair adjacent at EVERY zoom (both shrink together), the centre
 * lines coincide exactly, and the box stays the grip's own 1⅓× size.
 *
 * DA-2 (§v2 item 4): the OPEN state lives in DescPanels.tsx (an ORDERED
 * SET of node ids). The badge keeps the INVOKER side only: `open` is read
 * from that set (aria-expanded), and a click toggles THIS node's panel
 * through it — siblings stay open.
 *
 * Nodes without a `desc` never mount one at all; table ROWS never do (the
 * table CARD can — TableNode mounts its own). SUPPRESSION is not hiding
 * but not rendering: below 60px on either rendered axis, or below 0.4
 * zoom, there is no badge in the DOM.
 *
 * ARIA (the spec carries BOTH APG patterns at once):
 *   - the trigger is a real <button> with aria-expanded + aria-controls
 *     (Disclosure) and the accessible name `Additional description: <node title>`;
 *   - the panel (DescPanels) is role="dialog" with aria-labelledby → the
 *     heading (NOT role="tooltip" — a tooltip cannot hold focus or copy);
 *   - on close (DescPanels' ONE close path) focus RETURNS to the badge —
 *     NEVER to body; the badge stays mounted while it holds focus,
 *     surviving the re-render that drops `open`;
 *   - NON-MODAL by design: no focus trap, the canvas stays usable while open.
 *
 * unisurf-desc-panel B1–B9 + E + G + X + Y1–Y6 and DA-2's
 * unisurf-desc-multi M1–M8 are the proof. */
import {memo, useEffect, useState} from 'react';
import {useStore} from '@xyflow/react';
import {toggleDesc, useDescOpen} from './DescPanels';

/** The retired per-card rotate grip's geometry, as styles.css `.ds-rotate-grip`
 * pinned it (left:50% + translate(-50%,0); top:-30px; 18px disc). SEL-CHROME-UNIFY
 * (t_e479c12d, 2026-11-19) deleted the grip — the sole selection rotates through
 * the shared pill now — but the BADGE's anchor line survives verbatim, so the
 * numbers live on HERE, their one remaining consumer: centre y = topPx +
 * sizePx/2 = -21, right edge = sizePx/2 = 9 past the card's centre-x. Kept as an
 * export so the harnesses keep one home for the anchor pair. */
export const ROTATE_GRIP = {topPx: -30, sizePx: 18};

/** Below this rendered size on EITHER axis the badge is noise, not a door. */
export const DESC_MIN_PX = 60;
/** Below this canvas zoom the badge is suppressed (not just hidden). */
export const DESC_MIN_ZOOM = 0.4;
/** the badge's own box (flow px, like the grip it rides) and the gap to it */
const BADGE_PX = 24, GLYPH_PX = 12, GRIP_GAP_PX = 6;

/* The store's zoom only — a node component subscribing to the whole transform
   would re-render on every pan; transform[2] is the scale. */
const zoomSelector = (s: {transform: [number, number, number]}) => s.transform[2];

type DescBadgeProps = {
  /** the node id — scopes aria-controls/aria-labelledby and the panel anchor */
  id: string;
  title: string;
  desc: string;
  /** the node is SELECTED (RF prop) — the ONE reveal rule (BADGE-ON-SELECT) */
  selected: boolean;
  /** the node's rendered (measured) box — the suppression inputs */
  w: number | undefined;
  h: number | undefined;
};

export const DescBadge = memo(function DescBadge({id, title, desc, selected, w, h}: DescBadgeProps) {
  const zoom = useStore(zoomSelector);
  /* DA-2: the open state is the SHARED set's — clicking here toggles THIS
     node's panel and leaves every other panel open (side-by-side compare). */
  const open = useDescOpen(id);

  const suppressed = (w ?? 0) < DESC_MIN_PX || (h ?? 0) < DESC_MIN_PX || zoom < DESC_MIN_ZOOM;
  /* BADGE-ON-SELECT: selected is the whole reveal rule; the panel-open term
     is the stated INVARIANT (an open panel is never orphaned); btnFocus is
     DESC-5's holds-focus term, KEYBOARD-only since BADGE-PTR — a pointer
     close no longer seats the badge, so this flag is real focus only. */
  const [btnFocus, setBtnFocus] = useState(false);
  const showBadge = (selected || open || btnFocus) && !suppressed;
  /* Suppression can unmount a FOCUSED badge without a blur event (a removed
     element fires none) — clear the flag so the badge does not remount
     irrelevant the moment zoom/size recover. */
  useEffect(() => { if (suppressed) setBtnFocus(false); }, [suppressed]);

  if (!desc) return null;
  return showBadge ? (
    <button
      type="button"
      className="desc-badge"
      data-desc-badge="1"
      aria-expanded={open}
      aria-controls={`desc-panel-${id}`}
      aria-label={`Additional description: ${title}`}
      /* BADGE-ON-SELECT anchor, DERIVED from the grip's own numbers (the
         card's local frame; both children of the root, so rotation carries
         them together): centre y === grip centre y, left edge === grip
         right edge + 6. Flow-constant by design — see the header. */
      style={{
        top: `${ROTATE_GRIP.topPx + ROTATE_GRIP.sizePx / 2 - BADGE_PX / 2}px`,
        left: `calc(50% + ${ROTATE_GRIP.sizePx / 2 + GRIP_GAP_PX}px)`,
        width: BADGE_PX, height: BADGE_PX, fontSize: GLYPH_PX,
      }}
      /* stopPropagation keeps the press a press: no node drag, no select
         churn — the badge is a door, not a handle. */
      onPointerDown={(e) => e.stopPropagation()}
      onFocus={() => setBtnFocus(true)}
      onBlur={() => setBtnFocus(false)}
      /* DA-2: toggleDesc — THIS node's panel only; the set (and therefore
         every sibling panel) is DescPanels' to manage. */
      onClick={(e) => { e.stopPropagation(); toggleDesc(id); }}
    ><span className="desc-badge-g" aria-hidden="true">ⓘ</span></button>
  ) : null;
});
