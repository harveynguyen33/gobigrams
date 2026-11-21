/* TABLE-HANDLES (task t_99583ca8) — ONE rule for "which column handle does a
 * table endpoint mean?", shared by every surface that writes a React-Flow
 * handle id:
 *
 *   - `toBoardDoc` (model/adapterCanvas.ts) when a `.gobi` doc is compiled into
 *     a board — the layout assigns SURFACE-NEUTRAL sides (`right`, `top`, …)
 *     because a neutral document must not know about handles;
 *   - `migrateEdgeEnds` (src/board/boardMigrations.ts) when a STORED board is
 *     read — boards saved before this rule hold the same generic sides, and a
 *     `table` node renders NONE of them, so React Flow resolved nothing and
 *     painted no line at all (Harvey's "ERP Test" board: 7 nodes / 7 edges /
 *     0 visible connections).
 *
 * A `table` renders exactly one source and one target handle per column
 * (`right_rel_<colId>` / `left_rel_<colId>`, src/nodes/TableNode.tsx +
 * TableRowList.tsx), so the ONLY safe answer is a column id — never a side.
 * Column by meaning, in this order:
 *
 *   1. the column whose `ref` names the OTHER endpoint (an FK column: the line
 *      lands on `order_id`, which is what the relationship is about);
 *   2. else the primary key (the referenced side of a relationship);
 *   3. else the first column (`h` when the table has none — the id TableNode
 *      falls back to, so the answer is ALWAYS an id the node renders).
 *
 * `current` is the handle the caller already holds: a non-table endpoint hands
 * it straight back (the caller keeps the layout's side), and an endpoint that
 * already names a column (`*_rel_*`) is never second-guessed — a deliberate
 * aim survives. `null` therefore means "not a table / nothing to resolve".
 *
 * Pure data in, string out: no React, no palette, no document — so the `.gobi`
 * compiler bundle and the app's board-load path can both carry it. */
export type RelColumn = {id: string; pk?: boolean; ref?: string};

export const tableRelEnd = (
  cols: readonly RelColumn[] | undefined | null, otherId: string, isSource: boolean,
  current?: string | null,
): string | null | undefined => {
  /* `Array.isArray` is not ceremony: the adapter keys its column lists in a
     plain object, so an id that collides with an Object.prototype key
     (`constructor`, `toString`) must read as "not a table", never crash. */
  if (!Array.isArray(cols) || current?.includes('rel')) return current;
  return `${isSource ? 'right' : 'left'}_rel_${(cols.find((c) => c.ref === otherId) ?? cols.find((c) => c.pk) ?? cols[0])?.id ?? 'h'}`;
};
