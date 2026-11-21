/* codeLayoutMode.ts — CODE-LAYOUT-MODE (t_760dec3c): what a code-pane commit
 * does to the board's geometry. ONE write path reads this module (the commit
 * lane in src/gobi/commitText.ts); one setting, three values:
 *
 *   off  — today's exact behaviour: the ONE merge keeps every surviving id
 *          byte-identical and gives new ids the compiler's layout coordinate.
 *   new  — survivors byte-identical; new TOP-LEVEL ids are parked in clear
 *          space right of the board bbox, grid-arranged among themselves.
 *   all  — the whole compiled layout adopted through the ONE engine
 *          (layoutDiagram from @techgoblin/gobi-core — the same module the
 *          Arrange button uses) with the persisted Arrange direction.
 *
 * GROUPS (engine semantics, stated and kept consistent): layoutDiagram places
 * TOP-LEVEL nodes only — a group's children keep their parent-relative
 * positions and follow their group. In 'all', a locked top-level node
 * (data.locked, read defensively — absent means unlocked, per the lock round)
 * is PINNED: the engine runs on the unlocked participants around it and the
 * locked node keeps its position; its children follow it as above.
 *
 * LAZY ENGINE: layoutDiagram arrives by dynamic import() so the gobi package
 * stays out of the boot chunk (the same lane commitText already uses). This
 * makes codeLayoutApply ASYNC; the commit lane is already async.
 */
import type {Edge, Node} from '@xyflow/react';
import {loadPref, savePref} from '../board/prefs';

export type CodeLayoutMode = 'off' | 'new' | 'all';

const MODE_KEY = 'code-layout-mode';

export const CODE_LAYOUT_OPTS: {v: CodeLayoutMode; label: string}[] = [
  {v: 'off', label: 'Keep'},
  {v: 'new', label: 'New beside'},
  {v: 'all', label: 'Re-arrange'},
];

/** Tolerant parse: only the three tokens are accepted; anything else
 * (including an unset value) resolves to 'off'. */
export function parseCodeLayoutMode(raw: unknown): CodeLayoutMode {
  return raw === 'off' || raw === 'new' || raw === 'all' ? raw : 'off';
}

export function loadCodeLayoutMode(): CodeLayoutMode {
  return parseCodeLayoutMode(loadPref<string>(MODE_KEY, 'off'));
}

export function saveCodeLayoutMode(m: CodeLayoutMode): void {
  savePref(MODE_KEY, m);
}

/* Parked-column geometry: every constant a multiple of GRID so the parked
 * nodes sit on the visible 16px grid the canvas snaps to. */
const GRID = 16;
const PARK_GAP = 80; /* clear-space gap between the board bbox and the column */
const PARK_COL_W = 240;
const PARK_ROW_H = 112;
const PARK_ROWS = 6; /* wrap to the next column after this many rows */

const snap = (v: number) => Math.round(v / GRID) * GRID;
const sizeOf = (n: Node) => ({
  w: ((n as {width?: number}).width ?? 190) as number,
  h: ((n as {height?: number}).height ?? 61) as number,
});
const parentIdOf = (n: Node) => (n as {parentId?: string}).parentId;

/* 'new' — park fresh top-level ids right of the survivor bbox. */
function parkNew(nodes: Node[], prevIds: Set<string>): Node[] {
  const isFreshTop = (n: Node) => !prevIds.has(n.id) && !parentIdOf(n);
  if (!nodes.some(isFreshTop)) return nodes;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (!prevIds.has(n.id) || parentIdOf(n)) continue; /* top-level survivors */
    const s = sizeOf(n);
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + s.w);
    maxY = Math.max(maxY, n.position.y + s.h);
  }
  if (maxX === -Infinity) { minX = minY = maxX = maxY = 0; } /* empty board */
  const x0 = snap(maxX + PARK_GAP);
  const y0 = snap(Math.max(0, minY));
  let col = 0, row = 0;
  return nodes.map(n => {
    if (!isFreshTop(n)) return n;
    const p = {x: x0 + col * PARK_COL_W, y: y0 + row * PARK_ROW_H};
    row += 1;
    if (row === PARK_ROWS) { row = 0; col += 1; }
    return {...n, position: p};
  });
}

/* 'all' — every node takes its engine position; locked nodes are pinned and
 * excluded from the engine's participants so they are not obstacles either. */
async function relayoutAll(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR',
): Promise<Node[]> {
  const isLocked = (n: Node) => ((n.data as {locked?: boolean} | undefined) ?? {}).locked === true;
  const movable = nodes.filter(n => !isLocked(n));
  const {layoutDiagram} = await import('@techgoblin/gobi-core/model/layout');
  const pos = layoutDiagram(movable as never, edges as never, {direction, spacing: {x: 70, y: 24}});
  return nodes.map(n => {
    if (isLocked(n)) return n;
    const p = pos.get(n.id);
    return p ? {...n, position: {x: p.x, y: p.y}} : n;
  });
}

/** What a commit's merged nodes become under `mode`. 'off' returns the input
 * UNCHANGED (same array — the control arm). Never mutates its inputs. */
export async function codeLayoutApply(
  mode: CodeLayoutMode,
  direction: 'TB' | 'LR',
  nodes: Node[],
  prevNodes: Node[],
  edges: Edge[],
): Promise<Node[]> {
  if (mode === 'off') return nodes;
  const prevIds = new Set(prevNodes.map(n => n.id));
  if (mode === 'new') return parkNew(nodes, prevIds);
  return relayoutAll(nodes, edges, direction);
}
