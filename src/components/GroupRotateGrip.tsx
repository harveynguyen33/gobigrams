/* GroupRotateGrip.tsx — the ONE shared handle of a selection.
 *
 * ROUND GROUP-ROTATE (the original job): in a multi-selection EVERY selected
 * node rendered its own rotate grip — noisy, and each one rotated just its own
 * node while the user expects the GROUP ("nên hiện 1 icon xoay chung đúng
 * ko?"). This grip lives at APP level (a direct child of <ReactFlow>) because
 * it needs ALL selected nodes, and it drives the existing GROUP path
 * (useRotation's selection gesture writer → rotateMembersAround, ONE undo entry
 * per gesture, updateNodeInternals for every member — never a per-node write).
 *
 * SEL-CHROME-B (t_edb37ea1, owner device test 2026-11-17) — variant B of
 * docs/sketches/lock-chrome-options.html, geometry reused verbatim: the grip
 * became a PILL holding two 24px controls, [rotate][lock]. THE ANCHOR IS THE
 * BOX the eye sees: it consumes `frameOf` from src/canvas/selectionFrame.ts —
 * the SAME padded painted union SelectionBox paints, BOUNDARY_PAD included.
 * The pill floats just OUTSIDE the box, its bottom edge on the box's top edge,
 * horizontally centred — no card can claim it. SCREEN-PX CONSTANT: left/top
 * are renderer-local screen coordinates, so the pill keeps its full hit target
 * at 2× and 0.5× zoom. THE FLIP: within `SEL_HANDLE.flipAt` (40) screen px of
 * the scroller's top it flips BELOW that edge (`data-handle-flip="1"`).
 *
 * SEL-CHROME-UNIFY (t_e479c12d, 2026-11-19, owner after
 * docs/sketches/sel-chrome-unify.png): one pill for 1 node AND N nodes — the
 * sole selection used to carry an 18px disc INSIDE the card and no rotate
 * handle of its own, three grammars for one verb. The pill now mounts from the
 * FIRST visible selected node (`selCount >= 1`; a binder-only selection paints
 * nothing — the visibleSelectedCount rule). Two consequences:
 *   - SOLO ROTATE delegates to useRotation's per-node writer (in-place, one
 *     undo entry) — identical to what the deleted per-card grip did, and it
 *     still works for a child inside a group, which the group writer's
 *     `!n.parentId` filter would refuse.
 *   - The verb slot is a SWAP, not a new button: `Group` when ≥2 visible nodes are
 *     selected and they are not already one block; `Ungroup` when the
 *     selection is (or contains) a group. `canGroup` refuses any selection
 *     containing a group/child and `canUngroup` requires one, so the two are
 *     MUTUALLY EXCLUSIVE by construction and the pill never exceeds three
 *     controls (86×30). MENU-STATES: the verb comes from the SAME `menu`
 *     object the context menu reads (useGroupLock's ONE derivation), so the
 *     pill and the worded menu can never disagree — and a verb that cannot
 *     act is not offered.
 * Order: [rotate][group|ungroup][lock] (PILL-ORDER t_1270c161, 2026-11-19).
 */
import {useRef} from 'react';
import {useReactFlow, useStore} from '@xyflow/react';
import {Group, Ungroup} from 'lucide-react';
import {beginRotate, rotateDelta, snapRotation, ROTATE_SNAP_DEG} from '../canvas/rotation';
import {unionMembers} from '../canvas/groupLogical';
import {absPos} from '../canvas/groupObject';
import {visibleSelected, lockedIdSet} from '../canvas/nodeLock';
import {memberSig, paintSig, frameOf} from '../canvas/selectionFrame';
import {usePaintedCardRects} from '../hooks/usePaintedCardRects';
import {LockChip} from './LockChip';
import type {RotateBegin} from '../canvas/rotation';
import type {CtxMenuState} from '../ui/ContextMenu';

/** The pill's membership: the selection's VISIBLE members. unionMembers is
 *  the multi-box union (logical-group children at absolute positions, the
 *  binder and FRAME children excluded) — but the pill serves EVERY visible
 *  selection (SEL-CHROME-UNIFY), and a frame child is still a node the owner
 *  can see and lock (LOCK-CHROME e: a member of a locked FRAME keeps its
 *  inherited indicator through this fallback). Binder-only selections fall
 *  through to nothing (visibleSelected drops them) — the counting rule. */
const pillMembers = (nodes: Parameters<typeof unionMembers>[0]) => {
  const viaUnion = unionMembers(nodes);
  if (viaUnion.length) return viaUnion;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return visibleSelected(nodes).map((n) => ({n, ax: absPos(n, byId).x, ay: absPos(n, byId).y}));
};

/** The pill's geometry, in SCREEN px at any zoom. Mirrors styles.css
 *  (`.ds-group-rotate-grip` = 2px padding + 1px border + N 24px controls +
 *  4px gaps = 58×30 with two controls, 86×30 with three); the harness asserts
 *  the rendered rect, not this table. */
export const SEL_HANDLE = {
  w: 58, w3: 86, h: 30, btn: 24, gap: 4, pad: 2, edge: 1,
  /** within this many screen px of the scroller's top, the pill flips. */
  flipAt: 40,
  /** how far below the box's top edge it sits once flipped. */
  flipGap: 6,
} as const;

type Props = {
  /** The GROUP gesture writer (useRotation): `delta` is the TOTAL angle
   *  since gesture start, around the selection centroid. */
  onGesture: (phase: 'start' | 'delta' | 'end' | 'cancel', delta: number) => void;
  /** The PER-NODE gesture writer (useRotation) — the pill's rotate path for a
   *  SOLE selection, so a single node (incl. a child inside a group) rotates
   *  in place with one undo entry, exactly like the retired per-card grip. */
  onSoloGesture: (id: string, phase: 'start' | 'delta' | 'end' | 'cancel', delta: number) => void;
  /** The selection's convergent lock toggle (one history entry). */
  onLockToggle?: () => void;
  /** The two group verbs, straight from useGroupLock. Optional in read-only —
   *  App does not even mount the pill there. */
  onGroup?: () => void;
  onUngroup?: () => void;
  /** useGroupLock's ONE row derivation — the SAME object the context menu
   *  reads, so the pill's verb can never disagree with the worded surface. */
  menu?: CtxMenuState;
};

export function GroupRotateGrip({onGesture, onSoloGesture, onLockToggle, onGroup, onUngroup, menu}: Props) {
  const rf = useReactFlow();
  /* ROTATE-FIX shape — a NULLABLE anchor, never a zero-filled one: the centre
     is computed fresh from the frame and passed to beginRotate as an argument,
     so the first frame is exactly 0°. */
  const live = useRef<{begin: RotateBegin; moved: boolean} | null>(null);

  /* ONE comparable string per concern (the RotateInternalsBridge pattern):
     membership + absolute positions via unionMembers (after Cmd+G the members'
     stored positions are parent-relative — without the resolution the handle
     would anchor to a garbage union), the painted-rect trigger, the lock state
     and the viewport transform. */
  const sig = useStore(s => memberSig(pillMembers(s.nodes)));
  const paintKey = useStore(s => paintSig(pillMembers(s.nodes)));
  const zoom = useStore(s => s.transform[2]);
  const view = useStore(s => s.transform.join(','));
  /* the selection's OWN lock state, derived once — 'all' | 'some' | '' (none),
     plus whether the lock is INHERITED from a group, so the toggle can say why
     it acts on the group instead of the members. `ms.length < 1`: a SOLE
     selection locks too (SEL-CHROME-UNIFY — the old < 2 gate left the single
     node's pill mute). */
  const lockSig = useStore(s => {
    const ms = pillMembers(s.nodes);
    if (ms.length < 1) return '';
    const set = lockedIdSet(s.nodes);
    const on = ms.filter(m => set.has(m.n.id));
    if (!on.length) return '';
    const inherited = on.every(m => (m.n.data as {locked?: boolean} | undefined)?.locked !== true);
    return `${on.length === ms.length ? 'all' : 'some'}|${inherited ? 'inherited' : 'own'}`;
  });
  const painted = usePaintedCardRects(paintKey, zoom);

  const frame = frameOf(sig, painted);
  if (!frame || (sig ? sig.split('|').length : 0) < 1) return null; /* App gates on selCount >= 1; the store is the truth */

  /* the SOLE member (a 1-part sig) — its rotate path is the per-node writer;
     the group writer would orbit it around its own centroid with a rewritten
     absolute position, and its `!n.parentId` filter would refuse a child. */
  const parts = sig.split('|');
  const soloId = parts.length === 1 ? parts[0].slice(0, parts[0].indexOf(':')) : null;
  const write = soloId
    ? (phase: 'start' | 'delta' | 'end' | 'cancel', delta: number) => onSoloGesture(soloId, phase, delta)
    : onGesture;

  /* The verb slot — the swap (slot 2 since PILL-ORDER). One derivation, never both verbs. */
  const verb = !menu?.ungroup?.disabled && onUngroup ? 'ungroup'
    : !menu?.group?.disabled && onGroup ? 'group'
    : null;

  const [tx, ty, tz] = view.split(',').map(Number);
  /* the anchor: the FRAME's top-centre in renderer-local screen px. The
     renderer's own top edge is the scroller's top, so the flip test is
     arithmetic, not a DOM read. */
  const sx = tx + (frame.x + frame.w / 2) * tz;
  const boxTop = ty + frame.y * tz;
  const flip = boxTop < SEL_HANDLE.flipAt;
  const sy = flip ? boxTop + SEL_HANDLE.flipGap : boxTop - SEL_HANDLE.h;

  const flowPoint = (clientX: number, clientY: number) =>
    rf.screenToFlowPosition({x: clientX, y: clientY});

  /* THE WHOLE PILL IS THE GRAB SURFACE (not just the rotate button): variant B
     reads as ONE handle, so a drag on the padding, a gap or the rotate glyph
     all rotates; the lock and verb buttons stop their own pointerdown, so a
     press there never starts a rotation. The 58px pill's centre is the gap
     (the documented grab); the 86px verb pill's centre lands INSIDE the verb
     since PILL-ORDER (2026-11-19) — refused by design (G7 was re-anchored). */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    /* CENTRE first (the frame centre, an argument), then the grab bearing. */
    const p = flowPoint(e.clientX, e.clientY);
    live.current = {
      begin: beginRotate(frame.x + frame.w / 2, frame.y + frame.h / 2, p.x, p.y),
      moved: false,
    };
    write('start', 0);

    const onMove = (ev: PointerEvent) => {
      const g = live.current;
      if (!g) return;
      const q = flowPoint(ev.clientX, ev.clientY);
      g.moved = true;
      write('delta', snapRotation(rotateDelta(g.begin, q.x, q.y), ev.shiftKey, ROTATE_SNAP_DEG));
    };
    const finish = (cancelled: boolean) => {
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      const moved = live.current?.moved ?? false;
      live.current = null;
      if (cancelled || !moved) write('cancel', 0);
      else write('end', 0);
    };
    const onUp = () => finish(false);
    const onCancel = () => finish(true);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
  };

  /* Keyboard parity, plus Escape: ArrowLeft/Down = -1°, ArrowRight/Up = +1°;
     Shift = ±15°; each press is its own one-entry gesture. Escape cancels a
     LIVE drag back to the gesture snapshot. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape' && live.current) {
      e.preventDefault();
      live.current = null; /* a later pointerup finds no gesture: a no-op cancel */
      write('cancel', 0);
      return;
    }
    const step = e.shiftKey ? ROTATE_SNAP_DEG : 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      write('start', 0); write('delta', -step); write('end', 0);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      write('start', 0); write('delta', step); write('end', 0);
    }
  };

  return (
    <div
      /* `ds-group-rotate-grip` is the historic class the harness arms anchor
         on (checks/round-selbox-live, unisurf-chrome-layer, round-selbox); the
         handle is the same affordance, now the ONE pill for every selection
         size — rotate, the group verb, lock, in that order (PILL-ORDER 2026-11-19). */
      className="ds-group-rotate-grip ds-sel-handle"
      data-handle-flip={flip ? '1' : '0'}
      style={{left: sx, top: sy}}
      onPointerDown={onPointerDown}
      role="group"
      aria-label="Selection handle"
    >
      <button
        type="button"
        className="ds-sel-handle-btn ds-sel-handle-rot"
        aria-label={`Rotate selection (arrow keys nudge, Shift snaps ${ROTATE_SNAP_DEG} degrees, Escape cancels)`}
        onKeyDown={onKeyDown}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" aria-hidden="true">
          <path d="M20 12a8 8 0 1 1-2.6-5.9" />
          <path d="M20 3v5h-5" />
        </svg>
      </button>
      {verb && (
        <button
          type="button"
          className="ds-sel-handle-btn ds-sel-handle-grp"
          data-sel-verb={verb}
          aria-label={verb === 'ungroup' ? 'Ungroup (Cmd+Shift+G)' : 'Group (Cmd+G)'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {e.stopPropagation(); (verb === 'ungroup' ? onUngroup : onGroup)?.();}}
        >
          {verb === 'ungroup' ? <Ungroup size={13} aria-hidden="true" /> : <Group size={13} aria-hidden="true" />}
        </button>
      )}
      {/* A real TOGGLE (variant B draws a control, not a state glyph): the
          block's lock is reachable from the handle, and SEL-CHROME-UNIFY made
          the two-glyph grammar universal — `locked={false}` paints the OPEN
          padlock (muted), `locked={true}` the closed one (accent, heavier
          stroke). Never absent: a control that only appears once you have
          locked cannot be discovered before you need it (owner, 2026-11-18). */}
      {onLockToggle && (
        <LockChip
          locked={!!lockSig}
          mixed={lockSig.startsWith('some')}
          inherited={lockSig.endsWith('inherited')}
          onToggle={onLockToggle}
        />
      )}
    </div>
  );
}
