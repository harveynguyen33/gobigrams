/* SelectionBox.tsx — ROUND SELBOX: the app's ROTATION-AWARE selection box,
 * and (GROUP-BOUNDARY-INSIDE, t_42fb2888) the QUIET boundary that stays on
 * screen while the user is INSIDE a logical group.
 *
 * WHOSE BOX IS THIS. React Flow paints the multi-selection's dashed box
 * itself (`.react-flow__nodesselection-rect`, NodesSelection in the vendor
 * dist): its selector unions `getInternalNodesBounds` over the selected
 * nodes — their UNROTATED `position` + `measured` internals. There is no
 * prop to feed it different geometry, so after a group rotation the dashed
 * box LAGS the shapes (a 100×50 card at 45° paints a ~106×106 footprint and
 * its corners poke out of the box). SELBOX therefore takes the box away
 * from RF (hidden via CSS, dated comment in styles.css) and paints the
 * app's own in the SAME visual vocabulary — the `--xy-selection-*` tokens
 * RF's rect painted from (`--sel-soft` fill, 1px dotted `--sel`), set in
 * this file from the app's own tokens so the box is indistinguishable at
 * 0°, and correct at every angle.
 *
 * THE MATH (SELBOX-FIT, t_b9215bd1): the box is the union of the selected
 * nodes' PAINTED card extents — a goblin card auto-fits its content and
 * paints TALLER/WIDER than RF's `measured` wrapper box (probe-selbox4: a
 * wrapping note painted 207×411 vs its 200×60 wrapper), so a `measured`-only
 * union cut the card ("vùng bao nó bị hở"). Per node: the painted card AABB
 * when the card is in the DOM (usePaintedCardRects — the card root carries
 * the inline rotate transform, so its client rect is already the rotated
 * footprint), else `rotatedExtent` of the measured wrapper (ONE corner-math
 * definition, shared with the export bounds path).
 *
 * THE PAD (SEL-CHROME-B, t_edb37ea1) and the ONE definition of it now live in
 * `src/canvas/selectionFrame.ts`: both frames here are the painted union GROWN
 * by BOUNDARY_PAD on every side, so a card's edge never sits on the dashed
 * line ("khi bao group có 1 gap nhẹ để tránh các nodes sát đè mép của
 * boundary"). The SHARED HANDLE consumes the same function, so the pill is
 * centred on the box the eye sees. PAINT only: no node geometry, no container
 * box and no board field is written.
 *
 * THE MEMBERSHIP (GROUP-SELECTION, t_d2a66b62): the union runs over
 * `unionMembers` (src/canvas/groupLogical.ts) — selected, NOT the logical
 * container itself (it paints nothing; its rect is the unrotated bbox +
 * GROUP_PAD and unioning it compressed/offset the box, the owner's D1
 * screenshot), and top-level OR a logical-group member with its ABSOLUTE
 * position (members store parent-relative positions after Cmd+G — mixing a
 * relative coordinate into the union was the same defect). Frame children
 * stay excluded, so the FRAME's box behaviour is unchanged.
 *
 * THE INSIDE BOUNDARY (GROUP-BOUNDARY-INSIDE, t_42fb2888): while the user is
 * INSIDE a logical group (double-click a member) the block keeps a boundary
 * as CONTEXT — owner defect D2 was it vanishing. It is the same PAINTED-
 * extent math over `groupMembers` (the group's own membership: direct
 * children at absolute positions, container excluded), painted quieter:
 * dotted `--sel` at reduced opacity and NO fill, so the selected state (which
 * owns the `--sel-soft` fill and full opacity) can never be confused with it,
 * and dotted keeps it distinct from a palette FRAME's dashed border. It
 * lives HERE, not in a second component, because this file is already an
 * allowed React Flow store holder (checks/unisurf-lock-seam.mjs A16) and the
 * instance-holder closed set must not grow.
 *
 * THE FRAME: flow coordinates, no viewport math — both boxes are
 * `ViewportPortal` children (HelperLinesView's pattern), so React Flow's own
 * transform carries them under zoom/pan. PAINT-ONLY: `pointer-events: none`
 * on both; RF's rect owned the group drag, and that behaviour is untouched
 * (drag still works — RF's rect keeps its hit target, only its PAINT is
 * hidden; see styles.css).
 *
 * NOTHING INTERACTIVE LIVES HERE (LOCK-MULTI's chip left in SEL-CHROME-B): the
 * multi-selection's lock now rides the shared handle pill with the rotate
 * control (GroupRotateGrip — variant B of docs/sketches/lock-chrome-options.html),
 * so this file stays a pure painter (checks/round-selbox.mjs d6 pins it).
 */
import {useStore, ViewportPortal} from '@xyflow/react';
import {unionMembers, groupMembers} from '../canvas/groupLogical';
import {memberSig, paintSig, memberSelector, frameOf} from '../canvas/selectionFrame';
import {usePaintedCardRects} from '../hooks/usePaintedCardRects';

export function SelectionBox({ctxGroupId}: {ctxGroupId?: string} = {}) {
  /* ONE comparable string per concern (the RotateInternalsBridge pattern):
     the selected nodes' geometry INCLUDING rotation, so a live rotate drag
     (the angle changing every frame) moves the box with the true union.
     GROUP-SELECTION: membership + ABSOLUTE positions via unionMembers —
     Cmd+G keeps the whole block selected, and every member's coordinates
     turn parent-relative the moment it is parented. */
  const sig = useStore(s => memberSig(unionMembers(s.nodes)));

  /* SELBOX-FIT trigger: measured/rotation/selection-set, NOT positions — a
     drag never re-reads the DOM (the perf contract). */
  const paintKey = useStore(s => paintSig(unionMembers(s.nodes)));
  const zoom = useStore(s => s.transform[2]);
  const painted = usePaintedCardRects(paintKey, zoom);

  /* the QUIET boundary's inputs — same trigger discipline, its OWN
     membership; members are usually NOT selected while you are inside, so
     the DOM selector must be a member selector, never `.selected`. */
  const ctxSig = useStore(s => memberSig(ctxGroupId ? groupMembers(s.nodes, ctxGroupId) : []));
  const ctxPaintKey = useStore(s => paintSig(ctxGroupId ? groupMembers(s.nodes, ctxGroupId) : []));
  /* derived, not a third subscription: the selector is a pure function of the
     member signature (and it is part of the rect hook's own effect key). */
  const ctxSelector = memberSelector(ctxSig);
  const ctxPainted = usePaintedCardRects(ctxPaintKey, zoom, ctxSelector);
  if (!sig && !ctxSig) return null;

  /* SEL-CHROME-B: a multi-selection needs TWO members to have a box at all;
     both frames are the painted union grown by the shared BOUNDARY_PAD. */
  const sel = (sig ? sig.split('|').length : 0) >= 2 ? frameOf(sig, painted) : null;
  const ctx = frameOf(ctxSig, ctxPainted);

  return (
    <ViewportPortal>
      {/* RF's own vocabulary: --sel-soft fill + 1px dotted --sel (the exact
          pair styles.css feeds RF's tokens) — visually the box RF painted,
          now standing BOUNDARY_PAD off every card it encloses. */}
      {sel && (
        <div
          className="ds-selection-box"
          style={{left: sel.x, top: sel.y, width: sel.w, height: sel.h}}
        />
      )}
      {/* GROUP-BOUNDARY-INSIDE: context, not subject — dotted --sel at
          reduced weight, NO fill, the same pad. */}
      {ctx && (
        <div
          className="ds-group-ctx-box"
          style={{left: ctx.x, top: ctx.y, width: ctx.w, height: ctx.h}}
        />
      )}
    </ViewportPortal>
  );
}
