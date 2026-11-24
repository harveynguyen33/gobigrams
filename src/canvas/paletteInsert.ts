/* APP-SPLIT t_b2cad7a8 (S5) — the insert policy, moved verbatim from App.tsx.
   TWO factories: makeAddNodeByLabel returns the exact (label, pos?) => void
   App always exposed — the SAME 10-value read set the closure had, threaded
   as ctx, no new context; insertFromSearchImpl is the searchable-palette
   body (App keeps its dependency-bounded wrapper). The bodies below the ctx
   destructure are verbatim; the only textual edits are the two `c${idc++}`
   mints -> mintColId() (the counter lives in ./idFactory since this move). */
import type {Node, ReactFlowInstance} from '@xyflow/react';
import {mintColId} from './idFactory';
import {LIBRARY, type DiagramPreset} from '../presets';
import {type TipId} from '../ui/tips';

export type AddNodeCtx = {
  LIBRARY: typeof LIBRARY;
  nextId: () => number;
  wrap: {current: HTMLDivElement | null};
  rf: ReactFlowInstance | null;
  pushHistory: () => void;
  tickTask: (t: string) => void;
  setNodes: (u: Node[] | ((ns: Node[]) => Node[])) => void;
  fireTip: (id: TipId) => void;
  asShape: (s: any) => string;
  preset: DiagramPreset;
};

export const makeAddNodeByLabel = (ctx: AddNodeCtx) => {
  const {LIBRARY, nextId, wrap, rf, pushHistory, tickTask, fireTip, setNodes, asShape, preset} = ctx;
  const addNodeByLabel = (label: string, pos?: {x: number; y: number}) => {
    const item = LIBRARY.find(p => p.label === label);
    if (!item) return;
    const id = `n${nextId()}`;
    /* AUDIT-14 (fold) — the no-position default centres on the WRAP
       (client coord rect.left + half), so with the palette open the insert
       lands at the canvas centre like every sibling path. */
    const wr3 = wrap.current?.getBoundingClientRect();
    const p = pos ?? (rf && wr3
      ? rf.screenToFlowPosition({x: wr3.left + wr3.width / 2, y: wr3.top + wr3.height / 2})
      : {x: 480, y: 300});
    pushHistory();
    tickTask('node');

    // L3c: the ERD `table` node is its own node type: a column list is not a
    // Shape. UNISURF-S13 — no preset gate: the SHAPE picks the type, not the board.
    if (item.label === 'Table') {
      setNodes(ns => [...ns, {
        id, type: 'table', position: p, selected: false,
        style: {width: 250}, /* TABLE-HEIGHT: no stored height — the wrapper hugs the card */
        data: {
          name: 'new_table',
          columns: [
            {id: `c${mintColId()}`, name: 'id', type: 'uuid', pk: true, notNull: true},
            {id: `c${mintColId()}`, name: 'created_at', type: 'timestamptz', notNull: true},
          ],
          colorKey: 'cyan',
        } as any,
      }]);
      /* ONBOARD-P5 — the first table the user creates. The keys below (pk/fk)
         are the one thing a fresh table cannot show them. */
      fireTip('table');
      return;
    }

    const data = item.make() as any;
    const shape = asShape(data?.shape);
    /* ONBOARD-P5 — the first frame the user drops teaches what a frame DOES
       (it adopts what you drag into it), which is not visible from the empty
       boundary on screen. */
    if (data.shape === 'group') fireTip('group');
    // C3: the palette item owns the box, so NodeResizer's baseline and the
    // persisted style agree by construction. GOBI-SIZE (src/nodeSizes.ts) gave
    // every kind an explicit size, which RETIRES the group/note fallbacks that
    // used to sit here as a SECOND, quietly different answer (320x200 / 200x90).
    const size = item.size;
    /* AQ19 — CENTRE THE NODE UNDER THE CURSOR: `p` is the cursor/flow point and
       RF anchors node.position at the TOP-LEFT, so a dropped node always sat
       down-right of where the user pointed. Offset by half the node's known
       size (every palette row has one — GOBI-SIZE made `size` REQUIRED on
       PaletteItem) — every insert path funnels the cursor point through here
       or its sibling inserters. */
    const half = {w: size.width / 2, h: size.height / 2};
    const centre = {x: p.x - half.w, y: p.y - half.h};
    // L3a: a flowchart node defaults to vertical handles and a label-only body.
    if (preset.id === 'flowchart' && shape !== 'group' && shape !== 'note') {
      data.handles = 'tb';
      data.body = 'label-only';
    }
    /* ITEM — NODE TEXT DEFAULTS TO CENTRE + MIDDLE, NEW NODES ONLY (2026-10-22).

       Harvey: new nodes should read centred. The inherited defaults live in
       `alignForBody`/`vAlignForBody` (`src/textStyle.ts`): `left` + `top` for a
       card, `center` + `middle` for a label-only body. Changing THOSE would
       repaint every stored board (absence is the value that renders), so the
       default moves at INSERT TIME instead: a new node stores
       `textStyle: {align: 'center', vAlign: 'middle'}` explicitly. The values
       are deliberately stored even where they collide with the inherited
       fallback (a label-only body already centres) — the stamp is a statement
       about the NODE ("this box is a centred box"), not about the sheet, and
       the inspector shows both keys as chosen, which is the truth.

       Stored boards never pass through here, so old nodes keep exactly the
       pixels they had. The `{align, vAlign}` literal is a NEW-NODE constant,
       not a value the user chose, but the §E.2 probe's ban on literals targets
       WRITE-PATH constructions in this file — the lazy-merge writers — and this
       is an insert-path default, the same class as the flowchart
       `handles: 'tb'` / `body: 'label-only'` stamps directly above. */
    data.textStyle = {align: 'center', vAlign: 'middle'};
    setNodes(ns => [...ns, {
      id, type: item.kind, position: centre, data: {...data, __dropAt: p}, selected: false,
      style: {width: size.width, height: size.height},
    }]);
    /* AQ19 — the estimated half-size differs from the RENDERED box (content,
       font, auto-grow), so after the node mounts and settles, re-measure and
       shift it so its CENTRE sits exactly on the drop point. One extra tick,
       idempotent (reads __dropAt, then clears it). */
    window.setTimeout(() => {
      const el = document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement | null;
      if (!el || !rf) return;
      const rr = el.getBoundingClientRect();
      if (!rr.width || !rr.height) return;
      setNodes(ns => ns.map(n => {
        if (n.id !== id || !(n.data as any)?.__dropAt) return n;
        const at = (n.data as any).__dropAt as {x: number; y: number};
        /* the rendered box is CLIENT coords — convert its centre to FLOW
           space before comparing with __dropAt (mixing the two spaces at
           non-1 zoom teleports the node — caught live at 0.53 zoom). */
        const cf = rf.screenToFlowPosition({x: rr.x + rr.width / 2, y: rr.y + rr.height / 2});
        const dx = at.x - cf.x;
        /* AQ19d — X-ONLY on BOTH passes now. The grow ladder's first steps
           (60/150ms) land BEFORE this 320ms pass, so a cylinder is already
           taller than the estimate here; a Y-recentre after that growth reads
           as the node jumping UP ~1s after the drop (Harvey). Vertical is
           decided at insert time and never revisited — growth extends
           downward from the placed head. */
        if (Math.abs(dx) < 1) return n;
        return {...n, position: {x: n.position.x + dx, y: n.position.y}, data: {...n.data}};
      }));
    }, 320);
    /* second pass after the auto-grow ladder settles (400/900ms steps) so a
       node that GREW after the first pass still ends centred; the flag is
       cleared here. */
    window.setTimeout(() => {
      const el = document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement | null;
      if (!el || !rf) return;
      const rr = el.getBoundingClientRect();
      if (!rr.width || !rr.height) return;
      setNodes(ns => ns.map(n => {
        if (n.id !== id || !(n.data as any)?.__dropAt) return n;
        const at = (n.data as any).__dropAt as {x: number; y: number};
        const cf = rf.screenToFlowPosition({x: rr.x + rr.width / 2, y: rr.y + rr.height / 2});
        const dx = at.x - cf.x;
        /* HARVEY 2026-10-16 — X-ONLY on this pass. A cylinder auto-grows ~2.2×
           taller on this ladder; re-centring Y after that growth yanks the node
           UP ~1s after the drop (the grown body pulls the head back to the
           drop point). The user placed the HEAD — growth belongs BELOW it, so
           vertical is anchored at pass 1 and never touched again. */
        const data = {...n.data};
        delete data.__dropAt;
        if (Math.abs(dx) < 1) return {...n, data};
        return {...n, position: {x: n.position.x + dx, y: n.position.y}, data};
      }));
    }, 1150);
  };
  return addNodeByLabel;
};

export type InsertCtx = {
  searchPos: {x: number; y: number} | null;
  addNodeByLabel: (label: string, pos?: {x: number; y: number}) => void;
  setSearchPos: (p: {x: number; y: number} | null) => void;
};

/* ---- D1: insert via the searchable palette ---- */
export const insertFromSearchImpl = (ctx: InsertCtx, label: string) => {
  if (!ctx.searchPos) return;
  ctx.addNodeByLabel(label, ctx.searchPos);
  ctx.setSearchPos(null);
};
