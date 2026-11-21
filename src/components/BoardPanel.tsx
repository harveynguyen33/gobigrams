/* BOARD-STYLE (task t_e13e056b) → INSPECTOR-DOORS (t_e6ab2d1c) →
 * TABLE-STYLE-CONTEXT (t_e965f3a8). The inspector edits THE SELECTION, so the
 * board's style + density rows no longer live in the nothing-selected body:
 * they render under the table-selected branch only (App.tsx passes this
 * component twice — `empty` picks the body). Nothing selected, even on a
 * board full of tables, shows just the hint; a process shape or an edge hides
 * the block too (Harvey 2026-11-09, second pass — gating on the board HOLDING
 * a table was the first fix and was not what he asked). The heading says
 * "this board" so nobody reads the rows as restyling one table; the rows
 * still write the BOARD's data-style / data-density (per-board, unchanged),
 * and the displayed value falls back to Settings → New boards until one is
 * written. */
import type {BoardDoc} from '../board/boards';
import {resolveTableStyle, resolveDensity, type TableStyle, type Density} from '../../packages/gobi/src/model/tableStyle';
import {readNewBoardStyle, readNewBoardDensity} from '../hooks/useNewBoardDefaults';
import BoardStyleControls from './BoardStyleControls';

type Props = {
  /** the board whose style/density the rows read (absent under `empty`). */
  board?: BoardDoc | null;
  /** true = the inspector's nothing-selected body: the hint, nothing else. */
  empty?: boolean;
  onStyle: (s: TableStyle) => void;
  onDensity: (d: Density) => void;
  disabled?: boolean; /* read-only / stale review: a style write is a board write */
};

export default function BoardPanel({board, empty, onStyle, onDensity, disabled}: Props) {
  if (empty) return (
    <div className="empty">
      No selection.<br />Click a node to edit its fields, or click an edge (the arrow)
      to edit its label, stroke and arrow heads.
    </div>
  );
  return (
    <>
      <div className="sec-label">Table style — this board</div>
      <BoardStyleControls
        style={resolveTableStyle(board?.style ?? readNewBoardStyle())}
        density={resolveDensity(board?.density ?? readNewBoardDensity())}
        onStyle={onStyle} onDensity={onDensity} disabled={disabled}
      />
    </>
  );
}
