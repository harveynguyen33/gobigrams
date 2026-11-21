import {memo} from 'react';
import {NodeResizer, type NodeProps} from '@xyflow/react';
import {Table2, ChevronDown, ChevronRight, Eye} from 'lucide-react';
import {resolveColor, type ColorKey} from '../theme/colors';
import {paintRotation, rotateTransform} from '../canvas/rotation';
import TableRowList from './TableRowList';

/* ---------------------------------------------------------------------------
   L3c — the ERD `table` node. The one genuinely new node type in the package
   (a variable-height column list is not a `Shape`: the shared ShapeFrame uses
   a 200×100 viewBox with preserveAspectRatio="none", which would stretch).

   ChartDB / Liam ERD conventions kept here:
     · colour strip + header with the table name, collapsible column list
     · PK badge (key in the accent), FK = the column NAME in --sel + a link icon
     · NOT NULL = filled dot, nullable = hollow dot  (Liam's quiet convention)
     · UNIQUE = a small U chip, shown only when set
     · the mono type is right-aligned and faded until the row is hovered
     · one invisible handle per column row, so an FK edge attaches to the COLUMN
       and not to the card's vertical centre

   UNISURF-S5: the column rows (now EDITABLE — name input, type chip, not-null,
   FK picker; SPEC-UNIFIED-SURFACE §3) live in src/nodes/TableRowList.tsx so
   this file stays in its 171-line budget; every handle is a ROW handle there.

   TABLEROW-LEGIBILITY (2026-11-09): the node-level target+source pair that
   used to sit here is GONE. It was centred on the CARD (50% of the height) and
   carried the FIRST column's own ids (`left_rel_<c1>`) a second time, so a
   4-column table rendered 10 handles with one id twice and the duplicate pair
   floated beside whichever row crossed the card's midpoint — "in the second
   field, it always show 2 handles" (Harvey). The adapter now resolves every
   table endpoint to a column handle, so the pair had no consumer left.
--------------------------------------------------------------------------- */

/* CORE-STEP4A-FIX — TableColumn/ShowMode/TableKind moved to the package
 * (@techgoblin/gobi-core model/nodeData.ts); re-exported for existing importers. */
export type {TableColumn, ShowMode, TableKind} from '../../packages/gobi/src/model/nodeData';
import type {ShowMode, TableKind, TableColumn} from '../../packages/gobi/src/model/nodeData';
import {resolveTableScale} from '../../packages/gobi/src/model/tableStyle';



/** Handle ids: one source + one target per column, plus extra target handles so
 *  N incoming FKs to the same column never stack on one point (ChartDB's trick). */
export const relHandleId = (side: 'left' | 'right', colId: string) =>
  side === 'left' ? `left_rel_${colId}` : `right_rel_${colId}`;
export const extraTargetHandleId = (i: number, colId: string) => `target_rel_${i}_${colId}`;

/** Should this column be visible under the given show-mode? */
export function visibleColumns(cols: TableColumn[], mode: ShowMode) {
  if (mode === 'TABLE_NAME') return [];
  if (mode === 'KEY_ONLY') return cols.filter(c => c.pk || c.fk);
  return cols;
}

const Node = memo(({id, data, selected, width, height}: NodeProps) => {
  const d = data as unknown as TableKind;
  /* UNISURF-S4 — render-only stale marks from App (never persisted): the
     card outline plus, per offending row, a marker (spec §4.3). */
  const staleCols = (d as {__staleCols?: string[]}).__staleCols;
  const nc = resolveColor(d);
  const mode: ShowMode = d.__showMode ?? 'ALL_FIELDS';
  const collapsed = !!d.collapsed || mode === 'TABLE_NAME';
  const shown = collapsed ? [] : visibleColumns(d.columns ?? [], mode);
  const hidden = (d.columns?.length ?? 0) - shown.length;

  /* ROUND ROTATE — same root transform scheme as DiagramNode (see there);
     the column handles are children, so FK edges follow the rotated rows. */
  const rot = rotateTransform(paintRotation(d as {rotation?: number}));
  /* TABLE-SCALE (t_cdd8e4f6) — this table's OWN scale, published as `--ts` so
     the density block's numbers (row height, fonts, padding, gaps) multiply it
     for THIS card only. The width is not painted from here: useTableWidth asks
     the core for the box at the same scale (one number, in the document). */
  const ts = resolveTableScale(d.scale);
  /* CHROME-ABOVE (t_31a9bec9): the rotate grip and the desc badge render in
     App's NodeChrome (top layer), not in the card's stacking context. */
  /* TABLE-GRIP (t_ef4b3f8a) — the SAME resize affordance every other node has
     (8 controls, `resize-line` + `resize-handle`, so it looks and feels
     identical). A table's box is DERIVED, so the gesture writes NOTHING of its
     own: `tableGripChanges` (src/board/resizeHistory.ts) converts the width it
     emits into the node's `scale` — the 0.75-1.5 ladder the inspector offers —
     and drops the dimensions change before it can be persisted. No min/max here
     on purpose: React Flow re-reads `params.boundaries` at every drag event, and
     a boundary derived from a width that MOVES with the scale would re-clamp the
     gesture mid-drag. The clamp is the ladder's, in one place. */
  const resizer = selected && !d.__lock && !(d as any).__locked ? (
    <NodeResizer lineClassName="resize-line" handleClassName="resize-handle" />
  ) : null;
  /* CHROME-ABOVE (t_31a9bec9): a desc table's badge renders in App's
     NodeChrome (top layer) — the card's stacking context no longer owns it. */
  return (
    <div
      className={`tnode${selected ? ' selected' : ''}${collapsed ? ' collapsed' : ''}${staleCols ? ' stale-card' : ''}${d.__lock ? ' locked' : ''}`}
      style={{'--nc': nc, '--ts': String(ts), ...(rot ? {transform: rot} as React.CSSProperties : {})} as React.CSSProperties}
    >
      {resizer}

      <div className="tnode-head">
        <Table2 size={13} className="tnode-ico" />
        <span className="tnode-name">
          {d.schema && <small>{d.schema}.</small>}
          {d.name}
        </span>
        {mode === 'KEY_ONLY' && <span className="tnode-mode" title="show-mode: KEY_ONLY">keys</span>}
        <button
          type="button"
          className="tnode-toggle nodrag"
          aria-label={collapsed ? 'Show columns' : 'Hide columns'}
          title={collapsed ? 'Show columns' : 'Hide columns'}
          onClick={e => { e.stopPropagation(); d.__onToggle?.(id, !collapsed); }}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      <TableRowList
        nodeId={id}
        columns={d.columns ?? []}
        shown={shown}
        lock={d.__lock}
        staleCols={staleCols}
        hl={(d as {__hl?: string}).__hl}
        seam={d.__onColumns}
        onPickColumn={d.__onPickColumn}
        onFk={d.__onFk}
      />

      {!collapsed && hidden > 0 && (
        <div className="tnode-more" onClick={() => d.__onToggle?.(id, true)}>
          <Eye size={11} /> {hidden} hidden by show-mode
        </div>
      )}
      {collapsed && (d.columns?.length ?? 0) > 0 && (
        <div className="tnode-more">{d.columns.length} column{d.columns.length === 1 ? '' : 's'}</div>
      )}
    </div>
  );
});

export default Node;
