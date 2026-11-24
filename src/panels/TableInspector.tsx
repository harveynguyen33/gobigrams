/**
 * JSX-SPLIT P2 (t_5c2d6fad) — the inspector's table branch, moved VERBATIM
 * out of App.tsx (interior byte-for-byte; only the docblock + the inspTarget
 * derivation are new). Census: 12 props MEASURED (the plan estimated 9 —
 * selectedEdge + isCollapsed + toggleSection ride as the P0 registry hook's
 * inputs, exactly as P1; one drilling level only, App -> child). The three
 * secBody IIFEs ('table', 'columns', 'showMode') moved verbatim; the
 * selection-following BoardPanel (TABLE-STYLE-CONTEXT, t_e965f3a8) moved
 * verbatim with them. update was useCallback-stabilised in P1; setBoardStyle
 * is a useCallback in useBoardsMenu; tableStyle/tableDensity are primitives
 * (resolveTableStyle/resolveDensity) — every prop is a state value, a
 * setter, a useCallback, or a primitive, so the memo (with the rf
 * node.selected comparator, see tablePropsEqual) re-renders the child only
 * when a table-relevant input actually changes.
 */
import * as React from 'react';
import type {Edge, Node} from '@xyflow/react';
import type {ShowMode, TableColumn} from '../nodes/TableNode';
import type {BoardDoc} from '../board/boards';
import type {TableStyle, Density} from '../../packages/gobi/src/model/tableStyle';
import {getInspectorSections, type SectionId} from '../canvas/inspector';
import {resolveColorKey} from '../theme/colors';
import {swatchRow} from '../components/swatchRow';
import {ScaleRow} from '../ui/InspectorPickers';
import BoardPanel from '../components/BoardPanel';
import {mintColId} from '../canvas/idFactory';
import {useInspectorSectionRegistry} from '../hooks/useInspectorSections';

export type TableInspectorProps = {
  /** The selected table node object (App's `selected`). */
  selected: Node;
  /** Field-visibility mode (ShowMode), App state. */
  showMode: ShowMode;
  setShowMode: React.Dispatch<React.SetStateAction<ShowMode>>;
  /** The board style/density write lane (useCallback in useBoardsMenu). */
  setBoardStyle: (style: TableStyle, density: Density) => void;
  /** The resolved board style/density (primitives — resolveTableStyle/resolveDensity). */
  tableStyle: TableStyle;
  tableDensity: Density;
  /** The loaded board doc (App state), BoardPanel's `board`. */
  curBoard: BoardDoc | null;
  /** Read-only gate (history/saved-board mode). */
  readOnly: boolean;
  /** The single node-data write lane (useCallback-stabilised in App, P1). */
  update: (patch: Record<string, unknown>) => void;
  /** The selected edge — the P0 registry's folded-readout input. */
  selectedEdge: Edge | null;
  /** Fold state, App's single useInspectorSections() instance. */
  isCollapsed: (id: SectionId) => boolean;
  toggleSection: (id: SectionId) => void;
};

/* The rf store rewrites node.selected/edge.selected on pane gestures —
   identity churn the panel never reads. Same comparator discipline as P1
   (shapePropsEqual): shallow on everything, .data-identity on the two
   node/edge inputs. */
const tablePropsEqual = (a: TableInspectorProps, b: TableInspectorProps) =>
  a.showMode === b.showMode && a.setShowMode === b.setShowMode
    && a.setBoardStyle === b.setBoardStyle && a.tableStyle === b.tableStyle
    && a.tableDensity === b.tableDensity && a.curBoard === b.curBoard
    && a.readOnly === b.readOnly && a.update === b.update
    && a.isCollapsed === b.isCollapsed && a.toggleSection === b.toggleSection
    && a.selected?.data === b.selected?.data && a.selectedEdge?.data === b.selectedEdge?.data;

export default React.memo(function TableInspector({
  selected, showMode, setShowMode, setBoardStyle, tableStyle, tableDensity,
  curBoard, readOnly, update, selectedEdge, isCollapsed, toggleSection,
}: TableInspectorProps) {
  /* The table arm of App's conditional chain — a branch CONSTANT, derived
     (spec §3.2: identical ⇒ derive inside, drop the prop). */
  const inspTarget = {kind: 'table'} as const;
  /* P0's registry hook — secBody/renderSections are made HERE. */
  const {secBody, renderSections} = useInspectorSectionRegistry({
    inspSections: getInspectorSections(inspTarget),
    selectedEdge,
    eFlow: (((selectedEdge?.data as any)?.flow ?? 'none') as string),
    eFlowCount: (((selectedEdge?.data as any)?.flowCount ?? 3) as number),
    isCollapsed, toggleSection,
  });
  return (
            <>
              {(() => { secBody('table', <>
              <div className="field">
                <label>name</label>
                <input
                  value={(((selected.data as any).name ?? '') as string)}
                  onChange={e => update({name: e.target.value} as any)}
                />
              </div>
              <div className="field">
                <label>schema (optional)</label>
                <input
                  value={(((selected.data as any).schema ?? '') as string)}
                  placeholder="public"
                  onChange={e => update({schema: e.target.value} as any)}
                />
              </div>
              <div className="field">
                <label>color (symbolic key)</label>
                {swatchRow(
                  resolveColorKey(selected.data as any),
                  k => update({colorKey: k, color: undefined} as any),
                  /* ROUND AO, AO-1c — a table node takes a literal like a goblin
                     does: same two keys, same inverse write (the KEY follows the theme). */
                  {value: (selected.data as any).color, onPick: hex => update({color: hex, colorKey: undefined} as any)},
                )}
              </div>
              {/* TABLE-SCALE — one table's own scale (the board's density stays as-is). */}
              <ScaleRow value={(selected.data as any).scale} onChange={(v: number) => update({scale: v} as any)} />
              </>); return null; })()}
              {(() => { secBody('columns', <>
              {((((selected.data as any).columns ?? []) as TableColumn[])).map((c, i) => (
                <div className="tcol-edit" key={c.id}>
                  <input
                    className="tcol-name"
                    value={c.name}
                    aria-label={`column ${i + 1} name`}
                    onChange={e => update({
                      columns: ((selected.data as any).columns as TableColumn[]).map(x =>
                        x.id === c.id ? {...x, name: e.target.value} : x),
                    } as any)}
                  />
                  <input
                    className="tcol-type"
                    value={c.type}
                    aria-label={`column ${i + 1} type`}
                    onChange={e => update({
                      columns: ((selected.data as any).columns as TableColumn[]).map(x =>
                        x.id === c.id ? {...x, type: e.target.value} : x),
                    } as any)}
                  />
                  <div className="tcol-flags">
                    {([['pk', 'PK'], ['fk', 'FK'], ['notNull', 'NN'], ['unique', 'U']] as const).map(([f, lbl]) => (
                      <button
                        key={f}
                        type="button"
                        className={`mbtn${(c as any)[f] ? ' on' : ''}`}
                        style={(c as any)[f] ? {borderColor: 'var(--sel)', color: 'var(--sel)'} : undefined}
                        title={lbl}
                        onClick={() => update({
                          columns: ((selected.data as any).columns as TableColumn[]).map(x =>
                            x.id === c.id ? {...x, [f]: !(x as any)[f]} : x),
                        } as any)}
                      >{lbl}</button>
                    ))}
                    <button
                      type="button"
                      className="mbtn danger"
                      title="Remove this column"
                      onClick={() => update({
                        columns: ((selected.data as any).columns as TableColumn[]).filter(x => x.id !== c.id),
                      } as any)}
                    >×</button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="mbtn"
                onClick={() => update({
                  columns: [...(((selected.data as any).columns ?? []) as TableColumn[]),
                    {id: `c${mintColId()}`, name: 'new_column', type: 'text'}],
                } as any)}
              >+ add column</button>
              </>); return null; })()}
              {(() => { secBody('showMode', <>
                <div className="field">
                <div className="swatches" style={{gap: 6}}>
                  {([['ALL_FIELDS', 'All'], ['KEY_ONLY', 'Keys'], ['TABLE_NAME', 'Names']] as const).map(([v, lbl]) => (
                    <button
                      key={v}
                      className={`mbtn${showMode === v ? ' on' : ''}`}
                      style={showMode === v ? {borderColor: 'var(--sel)', color: 'var(--sel)'} : undefined}
                      onClick={() => setShowMode(v)}
                    >{lbl}</button>
                  ))}
                </div>
              </div>
              </>); return null; })()}
              <div className="hint">
                FK edges attach column-to-column — drag from a column's left dot to the
                referenced column. Crow's feet show the cardinality.
              </div>
              {renderSections()}
              {/* TABLE-STYLE-CONTEXT (t_e965f3a8) — the board's style rows
                  follow the SELECTION: they render here, under the table's
                  own fields; the empty body is the hint alone. */}
              <BoardPanel board={curBoard} onStyle={s => setBoardStyle(s, tableDensity)} onDensity={d => setBoardStyle(tableStyle, d)} disabled={readOnly} />
            </>
  );
}, tablePropsEqual);
