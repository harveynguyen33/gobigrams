/**
 * PASTE-AT-CURSOR (t_40bd1842) — the ONE placement writer for clipboard
 * pastes. App's `pasteClipboard` used to write `position + offset` (a
 * constant nudge from the SOURCE, in flow units) no matter where the pointer
 * was, which is exactly the "jumps somewhere I cannot explain" report.
 *
 * Two explicit modes, one function:
 *  - `target == null`  → LEGACY nudge, byte-identical to the old behaviour:
 *    every STORED position (top-level AND group child AND orphan) gets
 *    +offset. No absolute maths, no grid quantise — Cmd+D keeps this.
 *  - `target != null`  → cursor placement: resolve the clipboard's bounding
 *    box in ABSOLUTE flow space (a child of a copied group resolves up the
 *    clipboard tree, its extent from the DECLARED sizes the clipboard
 *    carries — `measured` then `style`), translate the whole set so the bbox
 *    CENTRE lands at the target — the double-click placement contract
 *    (PASTE-CENTRE, t_114d880a) — and write each node back in ITS
 *    OWN space: a child whose parent was also pasted keeps its stored
 *    RELATIVE position (the parent's translation carries it — internal
 *    geometry preserved exactly); every other node (top-level, or a child
 *    whose parent was NOT copied — the AUDIT-1 orphan) translates on its
 *    stored position by the same delta.
 *
 * The grid quantise applies to the RESULTING bbox TOP-LEFT, never the
 * centre: a snapped centre would put the top-left on half-grid offsets
 * whenever a pasted extent is odd-sized, visibly breaking alignment with
 * the surrounding snapped nodes.
 *
 * Pure: no React, no DOM. Group ADOPTION under the cursor is deliberately
 * NOT handled here (AUDIT-1 stands: a paste never auto-joins a group).
 */
import type { Node, XYPosition } from '@xyflow/react';

type CbNode = Pick<Node, 'id' | 'position'> & {
  parentId?: string;
  measured?: Node['measured'];
  style?: Node['style'];
};

/** Absolute position within the clipboard: resolve up the PASTED tree only. */
function cbAbs(n: CbNode, byId: Map<string, CbNode>): XYPosition {
  let { x, y } = n.position;
  let p = n.parentId ? byId.get(n.parentId) : undefined;
  while (p) {
    x += p.position.x;
    y += p.position.y;
    p = p.parentId ? byId.get(p.parentId) : undefined;
  }
  return { x, y };
}

export function pastePositions(
  clipboard: CbNode[],
  target: XYPosition | null,
  offset: number,
  grid: number | null,
): Map<string, XYPosition> {
  const out = new Map<string, XYPosition>();
  if (!target) {
    /* legacy nudge — parity with the pre-round behaviour, verbatim */
    for (const n of clipboard) out.set(n.id, { x: n.position.x + offset, y: n.position.y + offset });
    return out;
  }
  const byId = new Map(clipboard.map((n) => [n.id, n]));
  const copiedParent = (n: CbNode) => !!(n.parentId && byId.has(n.parentId));
  /* bbox extents over ABSOLUTE positions + DECLARED sizes (`measured`
     first, then `style` — style widths may be `"190px"` strings). */
  const q = (v?: number | string) => parseFloat(v as string) || 0;
  const sz = (n: CbNode, k: 'width' | 'height') => q(n.measured?.[k]) || q(n.style?.[k]);
  /* per-axis extents: xs collects every x0/x1, ys every y0/y1 — NEVER one
     flat list (Math.min over it would mix the axes). */
  const xs: number[] = [];
  const ys: number[] = [];
  for (const n of clipboard) {
    const a = cbAbs(n, byId);
    xs.push(a.x, a.x + sz(n, 'width'));
    ys.push(a.y, a.y + sz(n, 'height'));
  }
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const extW = Math.max(...xs) - minX;
  const extH = Math.max(...ys) - minY;
  /* bbox CENTRE at the target (double-click contract); the snap quantises
     the RESULTING top-left, never the centre. */
  const snap = (v: number) => (grid ? Math.round(v / grid) * grid : v);
  const dx = snap(target.x - extW / 2) - minX;
  const dy = snap(target.y - extH / 2) - minY;
  for (const n of clipboard) {
    out.set(n.id, copiedParent(n)
      ? { ...n.position }
      : { x: n.position.x + dx, y: n.position.y + dy });
  }
  return out;
}

/**
 * Pointer tracker for the paste anchor: a NATIVE `pointermove` listener on
 * the `.react-flow` root. RF's own `onPaneMouseMove` prop never fires here
 * (measured 2026-11-15 — native events reach the pane but the synthetic
 * handler does not), and a native listener on the canvas root also covers
 * node and edge moves by bubbling. Panels/toolbar are NOT inside the root,
 * so a pointer over them never updates the anchor and a keyboard paste keeps
 * the legacy nudge.
 */
export function trackCanvasPointer(
  el: Element | null,
  rf: { screenToFlowPosition(p: { x: number; y: number }): XYPosition },
  set: (p: XYPosition | null) => void,
): () => void {
  if (!el) return () => {};
  const track = (ev: PointerEvent) => set(rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY }));
  const leave = () => set(null);
  el.addEventListener('pointermove', track, { passive: true });
  /* leaving the canvas (panel, toolbar, dialog) CLEARS the anchor, so a
     keyboard paste afterwards keeps the legacy nudge instead of jumping to
     a stale pointer position. */
  el.addEventListener('pointerleave', leave);
  return () => {
    el.removeEventListener('pointermove', track);
    el.removeEventListener('pointerleave', leave);
  };
}

