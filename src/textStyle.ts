/* PACKAGE-P §E.1/§E.2 — THE TEXT STYLE MODEL (the Text section's data half).

   WHY A SEPARATE MODULE. The Text section is the ONE inspector section two
   different targets share (§A.3: `goblin` + `label`), and the values it writes
   are read by THREE renderers (`DiagramNode`, `LabelNode`, and the panel
   itself). All three need the same answer to "what does this style mean in
   pixels", so that answer lives here — one table, no renderer re-deriving it.
   React-free and JSX-free on purpose, exactly like `src/inspector.ts`: this
   answers the data question, the renderers consume the answer.

   WHY `size` IS A SCALE AND NOT A PX VALUE. Measured from `src/styles.css`, one
   node already paints FOUR different sizes — `.node-kicker` 10.5, `.node-title`
   14.5, `.node-sub` 11.5, `.node-metric` 20 — i.e. the node's hierarchy IS the
   size ladder. A single px value would flatten all four to one number, destroy
   that hierarchy, and push the worst-case content (`queue`, 199x131, the
   number `src/DiagramNode.tsx`'s `NODE_MIN_H` is derived from) past the resizer
   floor this repo asserts. So the control emits a MULTIPLIER, it lands as ONE
   custom property (`--ts-scale`) on the node root, and every text rule in the
   sheet multiplies its own size by it: one write, whole block, and an unset
   property (`var(--ts-scale, 1)`) changes nothing at all.

   THE LADDER, and why these four numbers:
     0.85  S   — .node-title 12.3px / .node-metric 17px: still legible, still a
                 title-over-body relationship, and it is the ONLY step that
                 shrinks, so it is kept mild (no 0.5 "tiny" step: below ~0.8 the
                 10.5px kicker's uppercase mono starts to smear).
     1     M   — "Default". NOT WRITTEN (see `mergeTextStyle`), so a board that
                 never touched the control renders byte-for-byte as today.
     1.15  L   — .node-title 16.7px / .node-metric 23px.
     1.3   XL  — .node-title 18.8px / .node-metric 26px.
   The gaps are 0.15 / 0.15 / 0.15 — equal, and each is > 10% of the default, so
   every step is visibly different from its neighbour without any one of them
   being a jump the user cannot undo. */

import {COLOR_KEYS, COLOR_VAR, isColorKey, type ColorKey} from './colors';

/** The four steps of the size control, as the SCALE they apply. */
export type TextSize = 'sm' | 'md' | 'lg' | 'xl';
export type TextWeight = 'regular' | 'bold';
export type TextAlign = 'left' | 'center' | 'right';

/** §E.2 — persisted verbatim on `node.data.textStyle`. Every field OPTIONAL and
 *  every field independently absent: a node with `{weight: 'bold'}` and nothing
 *  else renders bold text at the theme's own sizes and colours. */
export type TextStyle = {
  size?: TextSize;
  weight?: TextWeight;
  /** §E.1 — a SYMBOLIC KEY, resolved through `COLOR_VAR` (`src/colors.ts:20`).
   *  A hex here would be unthemable, which is the whole point of PACKAGE-L. */
  colorKey?: ColorKey;
  align?: TextAlign;
};

/** The multiplier each step applies. `md` is 1 — the "no write" step. */
export const TEXT_SCALE: Record<TextSize, number> = {sm: 0.85, md: 1, lg: 1.15, xl: 1.3};

export const TEXT_DEFAULT_SIZE: TextSize = 'md';
export const TEXT_DEFAULT_WEIGHT: TextWeight = 'regular';

/** The align a target renders with when NOTHING is stored. It is a property of
 *  the TARGET, not a global constant: `.node .lo-body { text-align: center }`
 *  centres the label-only sentence BY DESIGN (`styles.css`, L3a), so `center`
 *  is that target's inherited value and `left` is everyone else's. App derives
 *  it from `inspTarget` with this helper; the sheet's fallbacks below are the
 *  other half of the same statement (`.node-body` → left, `.lo-body` → center),
 *  and `checks/package-p-inspector.mjs` asserts the two halves agree. */
export const alignForBody = (body: 'card' | 'label-only' | undefined): TextAlign =>
  body === 'label-only' ? 'center' : 'left';

/** The option tables (§E.1). Plain data — `ToggleRow` renders `o.art ?? o.label`,
 *  so labels alone are enough and this file stays JSX-free. COLOUR has no table
 *  here on purpose: §E.1 says "reuses the existing colour swatch row", so the
 *  colour control is `swatchRow` driven by `COLOR_KEYS` (`src/colors.ts:17`). */
export const TEXT_SIZE_OPTS: {v: TextSize; label: string}[] = [
  {v: 'sm', label: 'S'}, {v: 'md', label: 'M'}, {v: 'lg', label: 'L'}, {v: 'xl', label: 'XL'},
];
export const TEXT_WEIGHT_OPTS: {v: TextWeight; label: string}[] = [
  {v: 'regular', label: 'Regular'}, {v: 'bold', label: 'Bold'},
];
export const TEXT_ALIGN_OPTS: {v: TextAlign; label: string}[] = [
  {v: 'left', label: 'Left'}, {v: 'center', label: 'Center'}, {v: 'right', label: 'Right'},
];
export {COLOR_KEYS, COLOR_VAR};

/** `justify-content` for the two FLEX text rows. `text-align` cannot reach a
 *  flex item — `.node-title` is `display: flex`, so centring it needs a second
 *  property. Two properties, one user choice; `align` alone would silently do
 *  nothing to the title, which is the one row most people want centred. */
const JUSTIFY: Record<TextAlign, string> = {left: 'flex-start', center: 'center', right: 'flex-end'};

/** Is this choice the value that renders ANYWAY? If so it must not be stored —
 *  `cur` being told about a field the user never chose is exactly the defect
 *  §E.2 names ("do not write a value the user did not choose"). */
export function isTextDefault(
  key: keyof TextStyle,
  v: unknown,
  alignDefault: TextAlign,
): boolean {
  if (key === 'size') return v === TEXT_DEFAULT_SIZE;
  if (key === 'weight') return v === TEXT_DEFAULT_WEIGHT;
  if (key === 'align') return v === alignDefault;
  /* colorKey has NO default: the theme's text colour is not a swatch, so any
   * key the user picks is a real choice and is always stored. */
  return false;
}

/** §E.2 — THE LAZY WRITE, as a pure function.
 *
 *  Given what is stored and what the user just chose, return what to STORE:
 *  a choice equal to the inherited default is stored as ABSENCE (the key is
 *  dropped), so switching a field back to Default leaves nothing behind. A node
 *  that was never touched therefore keeps `textStyle === undefined` — the same
 *  discipline the app already uses for `colorKey` vs derived `color`
 *  (`App.tsx:3030-3037`). Returns `undefined` when nothing is left to store, so
 *  the caller writes no key at all rather than an empty object.
 *
 *  `alignDefault` is passed in because align has no global default (see
 *  `alignForBody`). */
export function mergeTextStyle(
  cur: TextStyle | undefined,
  patch: Partial<TextStyle>,
  alignDefault: TextAlign,
): TextStyle | undefined {
  const next: TextStyle = {...(cur ?? {})};
  // Fixed key order, so a delete-then-re-add cannot reorder the object and make
  // a value-equality check below read as a change.
  for (const k of ['size', 'weight', 'colorKey', 'align'] as (keyof TextStyle)[]) {
    if (!(k in patch)) continue;
    const v = patch[k];
    if (v === undefined || isTextDefault(k, v, alignDefault)) delete next[k];
    else (next as Record<string, unknown>)[k] = v;
  }
  return Object.keys(next).length ? next : undefined;
}

/** The values the panel SHOWS for a stored style: a missing field reads as the
 *  inherited default, never as a blank. */
export function readTextStyle(ts: TextStyle | undefined, alignDefault: TextAlign) {
  return {
    size: ts?.size ?? TEXT_DEFAULT_SIZE,
    weight: ts?.weight ?? TEXT_DEFAULT_WEIGHT,
    colorKey: ts?.colorKey ?? null,
    align: ts?.align ?? alignDefault,
  };
}

/** The custom properties the renderers put on the node ROOT. Only the fields
 *  the user actually chose produce a property — an untouched node gets `{}`,
 *  so the sheet's `var(--ts-*, <own default>)` fallbacks apply and nothing
 *  moves. Spread into the same style object that already carries `--nc`.
 *
 *  `alignDefault` IS A PARAMETER, NOT A CONSTANT. align has no global default:
 *  `.node .lo-body` is centred BY DESIGN and `.node-body`/`.label-node` are
 *  left (`styles.css:3304-3308`), so "the value that renders anyway" differs
 *  per target. The caller passes what `alignForBody` already answers — the same
 *  function the panel and `mergeTextStyle` use — so a stored align and its
 *  painted property can never disagree. Hard-coding `left` here was the defect:
 *  on a `label-only` node, which inherits `center`, a stored `align:'left'` is
 *  a REAL choice, and dropping it left the user's Left indistinguishable from
 *  an untouched node.
 *
 *  `size` and `weight` take no such default because they have none to take:
 *  `TEXT_SCALE['md'] === 1` is the multiplicative identity and `'regular'` is
 *  the inherited weight FOR EVERY TARGET (`.label-node`, `.note-node`,
 *  `.node-sub` all read `var(--ts-weight, 400)`), so those two tests are
 *  target-INDEPENDENT by construction. */
export function textStyleVars(
  ts: TextStyle | undefined,
  alignDefault: TextAlign,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!ts) return out;
  if (ts.size && TEXT_SCALE[ts.size] !== 1) out['--ts-scale'] = String(TEXT_SCALE[ts.size]);
  if (ts.weight === 'bold') out['--ts-weight'] = '700';
  if (isColorKey(ts.colorKey)) out['--ts-color'] = COLOR_VAR[ts.colorKey];
  if (ts.align && ts.align !== alignDefault) {
    out['--ts-align'] = ts.align;
    out['--ts-justify'] = JUSTIFY[ts.align];
  }
  return out;
}
