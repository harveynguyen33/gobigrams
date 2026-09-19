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
/** ROUND W, ITEM 2 — WHICH FAMILY THE WHOLE NODE PAINTS IN. */
export type TextFont = 'mono' | 'ui' | 'read' | 'viet';

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
  /** ROUND W, ITEM 2 — a family KEY, resolved through `TEXT_FONT_FAMILY` below.
   *  Stored as a key and not as a stack for the same reason `colorKey` is: a
   *  literal family list here would be a second copy of the sheet's stacks and
   *  would pin a node to the theme's current fonts forever. */
  font?: TextFont;
  /** ROUND W, ITEM 3 — a CUSTOM multiplier beside the four steps, 0.5..2.0.
   *  Mutually exclusive with `size` by construction: setting one clears the
   *  other, because both land on the same `--ts-scale` property and two writers
   *  for one property is a value that can contradict itself. A user who types
   *  `1` stores neither (see `clampTextScale`). */
  scale?: number;
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

/* ===========================================================================
   ROUND W, ITEM 2 — THE FONT PICKER'S DATA HALF.

   WHY A TABLE AND NOT A CONTROL THAT WRITES A FAMILY. The renderers paint four
   rows that ALREADY mix two stacks — `.node-title` and `.node .lo-title` are
   `var(--sans)`, everything else is `var(--mono)` — and the picker's job is to
   set ALL of them at once. It therefore emits ONE custom property on the node
   root and each row falls back to the stack it declares today, which is the
   same "one write, whole block, fallback is the base value" discipline
   `--ts-scale` uses and the reason an untouched node cannot move.

   `--ts-font` CANNOT SIMPLY BE A KEY. The sheet has no font per key, so the
   `font-family: var(--ts-font, <own stack>)` fallback would be inert unless the
   property resolves to a real family list. It is therefore emitted as the
   resolved STACK (`TEXT_FONT_FAMILY[key]`), and the fallback is what makes the
   no-write case work.
   THE FAMILIES ARE LOCAL. `public/fonts/` holds 24 woff2 files, one per family ×
   weight × subset, declared by the `@font-face` blocks in `src/styles.css`.
   Nothing here mentions a CDN and nothing is downloaded at runtime — the app
   stays offline. */
export const TEXT_FONT_OPTS: {v: TextFont; label: string; hint: string}[] = [
  {v: 'mono', label: 'Mono', hint: 'coding / technical'},
  {v: 'ui', label: 'UI', hint: 'neutral UI text — architecture diagrams'},
  {v: 'read', label: 'Read', hint: 'designed for reading ease'},
  {v: 'viet', label: 'Viet', hint: 'for Vietnamese diacritics'},
];

/** ROUND W, ITEM 2 — the ONE place a family is chosen, and the reason it is
 *  here rather than in the `.tsx`.
 *
 *  THE QUOTED NAME IS LOAD-BEARING. `TEXT_FONT_FAMILY[key][0]` is the family
 *  `@font-face` declares in `src/styles.css`; the unquoted names after it are
 *  the metric-compatible system fallbacks, so a board opened on a machine that
 *  refused the woff2 still renders in a similar face rather than in Times. The
 *  harness asserts the two halves agree — it reads the `font-family:` of every
 *  `@font-face` in the sheet and requires it to appear here — so a family that
 *  is declared but never chosen (or chosen but never declared) cannot ship.
 *
 *  `mono`'s stack is `--mono` WITH the web font in front, so the default is
 *  today's exact stack plus the family as an alias — deliberately the only one
 *  of the four that changes no glyph on an already-installed machine. */
export const TEXT_FONT_FAMILY: Record<TextFont, string> = {
  mono: "'JetBrains Mono', var(--mono)",
  ui: "'Inter', 'Inter Fallback', ui-sans-serif, system-ui, sans-serif",
  read: "'Lexend', 'Lexend Fallback', ui-sans-serif, system-ui, sans-serif",
  viet: "'Be Vietnam Pro', 'Be Vietnam Pro Fallback', ui-sans-serif, system-ui, sans-serif",
};

export const TEXT_DEFAULT_FONT: TextFont = 'mono';
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
  /* ROUND W, ITEM 2 — `mono` renders anyway, so picking Mono stores ABSENCE,
   *  exactly like M and Regular. Target-independent, like size and weight: the
   *  sheet's own stacks ARE the mono/sans mix every node already paints. */
  if (key === 'font') return v === TEXT_DEFAULT_FONT;
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
  for (const k of ['size', 'weight', 'colorKey', 'align', 'font', 'scale'] as (keyof TextStyle)[]) {
    if (!(k in patch)) continue;
    const v = patch[k];
    if (v === undefined || isTextDefault(k, v, alignDefault)) delete next[k];
    else (next as Record<string, unknown>)[k] = v;
  }
  /* ROUND W, ITEM 3 — THE MUTUAL EXCLUSION, and why it lives here rather than in
     the panel. `size` and `scale` are two spellings of ONE property
     (`--ts-scale`), so they can never both be stored: whichever the user just
     chose clears the other. `patch.scale === null` is the panel's "this typed
     value is the identity, drop the custom field" (a JSON board cannot hold
     `undefined`, and `clampTextScale` already answers null for `1`). Putting
     this in the merge — not in the click handler — is what keeps a node that
     arrives from a board file with both fields from being re-emitted with both. */
  if ('scale' in patch) {
    if (patch.scale == null) delete next.scale;
    if (patch.scale != null) delete next.size;
  }
  if ('size' in patch && patch.size !== undefined) delete next.scale;
  return Object.keys(next).length ? next : undefined;
}

/** ROUND W, ITEM 3 — THE CUSTOM SIZE'S BOUNDS AND ITS "STORE ABSENCE" TEST.
 *
 *  Harvey's range, verbatim: "0.5x – 2.0x". The scale is the multiplier
 *  `--ts-scale` already is, so the control needs no new unit and no new
 *  property — it needs a clamp and a definition of "the default".
 *
 *  WHY 1 IS NOT STORED. `TEXT_SCALE.md` is 1 and the sheet reads
 *  `calc(<px> * var(--ts-scale, 1))`, so a stored `size:'md'` and a stored bare
 *  `1` would be two representations of the SAME rendered value, and the two
 *  would drift the moment either changed. Typing `1` therefore behaves exactly
 *  like picking M: `mergeTextStyle` drops the key. A custom value has no
 *  `TextSize` of its own — `size` stays the string union it always was — so the
 *  value rides in its own optional field and `size` is CLEARED beside it, or the
 *  two would fight over the same property. */
export const TEXT_SCALE_MIN = 0.5;
export const TEXT_SCALE_MAX = 2;

/** NaN-safe, and clamps to the range Harvey chose. Returns null when there is
 *  nothing to store: a blank field, a non-number, or the identity `1`. */
export function clampTextScale(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  const c = Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, n));
  return c === 1 ? null : c;
}

/** The multiplier a stored style paints, for the PANEL to show. The custom
 *  value wins when present, otherwise the step's own scale. */
export function scaleOfTextStyle(ts: TextStyle | undefined): number {
  if (ts?.scale !== undefined) return ts.scale;
  return TEXT_SCALE[ts?.size ?? TEXT_DEFAULT_SIZE];
}

/** ROUND X, ITEM 1 — WHICH STEP (IF ANY) A PAINTED MULTIPLIER CORRESPONDS TO.
 *
 *  The custom-size INPUT is gone; the custom `scale` FIELD is not (Harvey:
 *  "rule giữ khi cần"). A board that already carries `scale: 1.7` must still
 *  RENDER it — `textStyleVars` reads `scale` first, unchanged — and the restored
 *  segmented control must not lie about it. `1.7` is not any of the four steps,
 *  so NO step is marked rather than the control lighting M for a multiplier M
 *  does not paint. A stored value that DOES coincide with a step (`1.15`) shows
 *  that step, because there it is the truth.
 *
 *  The no-write case needs no special case: `TEXT_SCALE['md'] === 1`, `1` is
 *  never stored, and `scaleOfTextStyle` answers `1` for a node with no
 *  `textStyle` — so an untouched node resolves to `md` through this same path.
 *  A `null` return is the "matches none" case and is what the control paints as
 *  nothing selected. */
export function stepForScale(scale: number): TextSize | null {
  for (const k of Object.keys(TEXT_SCALE) as TextSize[]) if (TEXT_SCALE[k] === scale) return k;
  return null;
}

/** The values the panel SHOWS for a stored style: a missing field reads as the
 *  inherited default, never as a blank.
 *
 *  ROUND X, ITEM 1 — `size` IS DERIVED FROM WHAT PAINTS. It used to be "the
 *  stored step, or `md`", which was fine only while a second control (the
 *  custom-size input) carried the multiplier. With the input gone, that reading
 *  would light M on a node painting 1.7 — the control and the node disagreeing
 *  about the same property. `size` is therefore `stepForScale(painted)`: the
 *  step whose scale IS the multiplier on the node, or `null` for a custom value
 *  that matches no step. `scale` stays the painted number itself, so the two
 *  fields are one truth read two ways and cannot drift. */
export function readTextStyle(ts: TextStyle | undefined, alignDefault: TextAlign) {
  const painted = scaleOfTextStyle(ts);
  return {
    size: stepForScale(painted),
    weight: ts?.weight ?? TEXT_DEFAULT_WEIGHT,
    colorKey: ts?.colorKey ?? null,
    align: ts?.align ?? alignDefault,
    font: ts?.font ?? TEXT_DEFAULT_FONT,
    scale: painted,
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
  /* ROUND W, ITEM 3 — THE ORDER OF THESE TWO MATTERS. `scale` is the CUSTOM
     multiplier and `size` is the step; the merge guarantees they are never both
     stored, but this reads the custom one FIRST so that a hand-edited board
     carrying both paints the number the user typed rather than the step it
     contradicts. `1` still emits nothing, because `1` IS the fallback. */
  const scale = ts.scale ?? (ts.size ? TEXT_SCALE[ts.size] : undefined);
  if (scale !== undefined && scale !== 1) out['--ts-scale'] = String(scale);
  if (ts.weight === 'bold') out['--ts-weight'] = '700';
  if (isColorKey(ts.colorKey)) out['--ts-color'] = COLOR_VAR[ts.colorKey];
  /* ROUND W, ITEM 2 — ONE property, the WHOLE node. Each of the sheet's text
     rules keeps its own stack as the fallback, so an untouched node emits
     nothing here and is byte-identical to before this round. */
  if (ts.font && ts.font !== TEXT_DEFAULT_FONT) out['--ts-font'] = TEXT_FONT_FAMILY[ts.font];
  if (ts.align && ts.align !== alignDefault) {
    out['--ts-align'] = ts.align;
    out['--ts-justify'] = JUSTIFY[ts.align];
  }
  return out;
}
