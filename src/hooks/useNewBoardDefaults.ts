/* BOARD-STYLE (task t_e13e056b) — the Settings → New boards preference.
 *
 * The DEFAULT style + density, used ONLY when a board omits the two fields.
 * Persisted through the one prefs path (src/board/prefs.ts, lazy-init: nothing
 * is written until the user makes an explicit pick), so a fresh visit finds no
 * keys and every board renders the built-in `sheet` + `comfy`.
 *
 * `readNewBoard*` are plain module functions: the canvas reads them at render
 * time, so a board authored before BOARD-STYLE — or created without the two
 * fields — paints the preference the Settings row currently holds.
 */
import {useState} from 'react';
import {loadPref, savePref} from '../board/prefs';
import {
  DEFAULT_TABLE_STYLE, DEFAULT_DENSITY, resolveTableStyle, resolveDensity,
  type TableStyle, type Density,
} from '../../packages/gobi/src/model/tableStyle';

export const NEW_BOARD_STYLE_KEY = 'newBoardStyle';
export const NEW_BOARD_DENSITY_KEY = 'newBoardDensity';

export const readNewBoardStyle = (): TableStyle =>
  resolveTableStyle(loadPref(NEW_BOARD_STYLE_KEY, DEFAULT_TABLE_STYLE));

export const readNewBoardDensity = (): Density =>
  resolveDensity(loadPref(NEW_BOARD_DENSITY_KEY, DEFAULT_DENSITY));

/** Settings → New boards: the two rows' value + writer, persisted on pick. */
export function useNewBoardDefaults() {
  const [style, setStyleState] = useState<TableStyle>(readNewBoardStyle);
  const [density, setDensityState] = useState<Density>(readNewBoardDensity);
  const setStyle = (s: TableStyle) => { setStyleState(s); savePref(NEW_BOARD_STYLE_KEY, s); };
  const setDensity = (d: Density) => { setDensityState(d); savePref(NEW_BOARD_DENSITY_KEY, d); };
  return {style, density, setStyle, setDensity};
}
