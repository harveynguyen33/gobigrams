/* swatchRow.tsx — hoisted from App.tsx on DA-3 (t_683dbdfa, 2026-11-12) so the
 * Additional Description panel-colour rows render the SAME 12-cell control the
 * node colour does, instead of a near-copy that would cost bundle bytes the
 * byte ceiling could not afford (measured: the copy was +1,449 bytes; the
 * shared row + its two call sites is a fraction of that). Verbatim move: the
 * function body is App's own `swatchRow`, unchanged — App imports it back, so
 * all seven existing call sites keep the exact calls they had.
 *
 * The design notes (ROUND L1/AG2/BD/AO-1a/AO-1c) that used to live beside the
 * definition in App.tsx:
 *   · the inspector swatches are COLOUR KEYS, painted with the live
 *     `COLOR_VAR` tokens and stored as `colorKey` — a key a theme can recolour;
 *     the literal hex is the opt-in escape hatch (`custom`).
 *   · ROUND AG2 item 3 — the row lays the keys in a fixed column count via the
 *     `swatch6` class (NOT `grid3`, which is the segmented font row's own
 *     modifier), so a wrap problem is fixed once, here, for every call site.
 *   · ROUND BD — `current` is the caller's resolved KEY, never a constant
 *     null: a bulk row lights a key only when every selected node agrees.
 *   · ROUND AO-1a — six columns, `(253 - 5x7) / 6 ≈ 36px` cells: near-square,
 *     still a >= 36px tap target (Harvey: "các ô nên nhỏ lại cho đẹp").
 *   · ROUND AO-1c — `custom` is ONE optional object `{value, onPick}`: the
 *     picked literal (so the cell paints it and reads as "on") plus the
 *     writer; a value with no writer would be a cell that cannot set one. It
 *     renders a 12th cell after the eleven keys — a clean 6 x 2 — with the
 *     native `input type=color` underneath, so the OS picker does the work.
 *   · the signature stays `(current, onPick, custom?)`-compatible: the call
 *     sites that offer no literal keep the exact call they had. */
import {COLOR_KEYS, COLOR_VAR, type ColorKey} from '../theme/colors';

export const swatchRow = (
  current: ColorKey | null,
  onPick: (k: ColorKey) => void,
  custom?: {value?: string; onPick: (hex: string) => void},
) => (
  <div className="swatches swatch6">
    {COLOR_KEYS.map(k => (
      <div
        key={k}
        className={`swatch${current === k ? ' on' : ''}`}
        style={{background: COLOR_VAR[k]}}
        data-color-key={k}
        title={k}
        onClick={() => onPick(k)}
      />
    ))}
    {custom && (
      <div
        className={`swatch-custom${!current && custom.value ? ' on' : ''}`}
        data-custom="1"
        /* the picked literal paints the cell; with none stored the class's own
           gradient stands, so an untouched row is byte-identical to one that
           never had this cell's colour set. */
        style={custom.value ? {background: custom.value} : undefined}
        title={custom.value ?? 'Custom color'}
      >
        <input
          type="color"
          aria-label="Custom color"
          /* the input must SHOW the stored literal or the OS picker opens on
             its own default; `#000000` is the fallback most engines use when no
             value is given, so it is named rather than left implicit. */
          value={custom.value ?? '#000000'}
          onChange={e => custom.onPick(e.target.value)}
        />
      </div>
    )}
  </div>
);
