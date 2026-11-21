/* BOARD-STYLE (task t_e13e056b) — the two segmented rows that write the BOARD's
 * style + density. ONE value, three doors (this card): the right inspector
 * (nothing selected), the Boards menu, and Settings → New boards (the default,
 * which is a different value — see useNewBoardDefaults). Extracted from App.tsx
 * because that file is at its hard 5,570-line cap.
 *
 * `data-board-style` / `data-board-density` are the stable hooks
 * checks/unisurf-board-style drives; the pressed state is aria-pressed, so the
 * control reads correctly to a screen reader and to the harness. */
import {TABLE_STYLES, DENSITIES, TABLE_STYLE_LABELS, DENSITY_LABELS, type TableStyle, type Density} from '../../packages/gobi/src/model/tableStyle';

type Props = {
  style: TableStyle;
  density: Density;
  onStyle: (s: TableStyle) => void;
  onDensity: (d: Density) => void;
  /** hidden while the board is locked: a style write IS a board write. */
  disabled?: boolean;
};

export default function BoardStyleControls({style, density, onStyle, onDensity, disabled}: Props) {
  const row = (opts: readonly string[], value: string, pick: (v: string) => void, attr: string) => (
    <div className="seg-row">
      {opts.map(v => (
        <button
          key={v}
          type="button"
          className={`mbtn${v === value ? ' on' : ''}`}
          aria-pressed={v === value}
          disabled={disabled}
          {...{[attr]: v}}
          onClick={() => pick(v)}
        >{TABLE_STYLE_LABELS[v as TableStyle] ?? DENSITY_LABELS[v as Density] ?? v}</button>
      ))}
    </div>
  );
  return (
    <>
      <div className="field">
        <label>style</label>
        {row(TABLE_STYLES, style, v => onStyle(v as TableStyle), 'data-board-style')}
      </div>
      <div className="field">
        <label>density</label>
        {row(DENSITIES, density, v => onDensity(v as Density), 'data-board-density')}
      </div>
    </>
  );
}
