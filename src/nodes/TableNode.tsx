import {memo} from 'react';
import {Handle, Position, useStore, type NodeProps} from '@xyflow/react';
import {KeyRound, Link, Table2, ChevronDown, ChevronRight, Eye} from 'lucide-react';
import {resolveColor, type ColorKey} from '../colors';
import {paintRotation, rotateTransform} from '../rotation';
import {RotateGrip} from '../components/RotateGrip';

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
--------------------------------------------------------------------------- */

export type TableColumn = {
  id: string;
  name: string;
  type: string;
  pk?: boolean;
  fk?: boolean;
  notNull?: boolean;
  unique?: boolean;
};

/** Liam ERD's `showMode` — the cheapest large-schema lever. */
export type ShowMode = 'ALL_FIELDS' | 'TABLE_NAME' | 'KEY_ONLY';

export type TableKind = {
  /** Table name (schema-qualified shown when `schema` is set). */
  name: string;
  schema?: string;
  columns: TableColumn[];
  /** Symbolic accent key (L1) — resolved per theme. */
  colorKey?: ColorKey;
  /** Literal user-typed hex escape hatch. */
  color?: string;
  /** Column list collapsed to the header only. */
  collapsed?: boolean;
  /** injected by App: the board's ERD show-mode */
  __showMode?: ShowMode;
  /** injected by App: called with the new collapsed flag */
  __onToggle?: (id: string, collapsed: boolean) => void;
  /** ROUND ROTATE — geometry rotation (absent = 0) + App's grip writer. */
  rotation?: number;
  __rotate?: (id: string, phase: 'start' | 'delta' | 'end' | 'cancel', delta: number) => void;
  /** injected by App: called when a column is clicked (inspector focus) */
  __onPickColumn?: (id: string, col: TableColumn) => void;
};

/** Handle ids: one source + one target per column, plus extra target handles so
 *  N incoming FKs to the same column never stack on one point (ChartDB's trick). */
export const relHandleId = (side: 'left' | 'right', colId: string) =>
  side === 'left' ? `left_rel_${colId}` : `right_rel_${colId}`;
export const extraTargetHandleId = (i: number, colId: string) => `target_rel_${i}_${colId}`;

/** Should this column be visible under the given show-mode? */
export function visibleColumns(cols: TableColumn[], mode: ShowMode): TableColumn[] {
  if (mode === 'TABLE_NAME') return [];
  if (mode === 'KEY_ONLY') return cols.filter(c => c.pk || c.fk);
  return cols;
}

const Node = memo(({id, data, selected}: NodeProps) => {
  const d = data as unknown as TableKind;
  const nc = resolveColor(d);
  const mode: ShowMode = d.__showMode ?? 'ALL_FIELDS';
  const collapsed = !!d.collapsed || mode === 'TABLE_NAME';
  const shown = collapsed ? [] : visibleColumns(d.columns ?? [], mode);
  const hidden = (d.columns?.length ?? 0) - shown.length;

  // extra target handles: this many incoming edges already attach to a column
  const edges = useStore(s => s.edges);
  const incoming = new Map<string, number>();
  edges.forEach(e => {
    if (e.target !== id || !e.targetHandle) return;
    incoming.set(e.targetHandle, (incoming.get(e.targetHandle) ?? 0) + 1);
  });

  /* ROUND ROTATE — same root transform scheme as DiagramNode (see there);
     the column handles are children, so FK edges follow the rotated rows. */
  const rot = rotateTransform(paintRotation(d as {rotation?: number}));
  const grip = selected && d.__rotate ? (
    <RotateGrip nodeId={id} rotation={d.rotation ?? 0}
      onGesture={(phase, delta) => d.__rotate!(id, phase, delta)} />
  ) : null;
  return (
    <div
      className={`tnode${selected ? ' selected' : ''}${collapsed ? ' collapsed' : ''}`}
      style={{'--nc': nc, ...(rot ? {transform: rot} as React.CSSProperties : {})} as React.CSSProperties}
    >
      {grip}
      <Handle type="target" position={Position.Left} id={`left_rel_${d.columns?.[0]?.id ?? 'h'}`} className="tnode-h tnode-h-head" />
      <Handle type="source" position={Position.Right} id={`right_rel_${d.columns?.[0]?.id ?? 'h'}`} className="tnode-h tnode-h-head" />

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

      {shown.map(col => {
        const n = incoming.get(relHandleId('left', col.id)) ?? 0;
        return (
          <div
            key={col.id}
            className={`tnode-col${col.fk ? ' is-fk' : ''}`}
            onClick={e => { e.stopPropagation(); d.__onPickColumn?.(id, col); }}
          >
            <Handle type="target" position={Position.Left} id={relHandleId('left', col.id)} className="tnode-h" />
            {Array.from({length: Math.max(0, n - 1)}).map((_, i) => (
              <Handle
                key={i}
                type="target"
                position={Position.Left}
                id={extraTargetHandleId(i, col.id)}
                className="tnode-h"
                style={{top: `${((i + 1) / (n + 1)) * 100}%`}}
              />
            ))}
            <span className="tnode-flags">
              {col.pk && <KeyRound size={11} className="tnode-pk" aria-label="primary key" />}
              {col.fk && <Link size={11} className="tnode-fkico" aria-label="foreign key" />}
            </span>
            <span className="tnode-cname">{col.name}</span>
            {col.unique && <span className="tnode-u" title="unique">U</span>}
            <span
              className={`tnode-nn${col.notNull ? ' on' : ''}`}
              title={col.notNull ? 'NOT NULL' : 'nullable'}
            />
            <span className="tnode-ctype">{col.type}</span>
            <Handle type="source" position={Position.Right} id={relHandleId('right', col.id)} className="tnode-h" />
          </div>
        );
      })}

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
