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
/** ROUND W, ITEM 2 — WHICH FAMILY THE WHOLE NODE PAINTS IN.
 *
 *  ROUND Z, ITEM 1 — SIX REAL FAMILY NAMES, NOT FOUR INVENTED ROLES. Harvey:
 *  "Font name hơi kì, nên theo tên Font". The four keys below (`mono`, `ui`,
 *  `read`, `viet`) were ROLE names; the control now says the family, and the
 *  keys are the family. Every one of the six was MEASURED, not chosen by taste:
 *  each family's vietnamese woff2 was downloaded, its cmap read, and all 24
 *  Vietnamese diacritic codepoints confirmed present. The families that failed
 *  that measurement (Atkinson Hyperlegible, Fira Code, Caveat, Architects
 *  Daughter — none ships a `vietnamese` subset at all) are NOT in this union. */
export type TextFont = 'jetbrains' | 'inter' | 'plex' | 'shantell' | 'lexend' | 'bevietnam';

/** ROUND Z, ITEM 1 — THE FOUR KEYS A BOARD MAY ALREADY CARRY.
 *
 *  `TextStyle.font` shipped in ROUND W with these four role names, so a board
 *  saved by that build has one of them on disk. They are NOT deleted and NOT
 *  renamed in place: a stored value is data, and `LEGACY_FONT_KEY` is the ONE
 *  place old→new is decided. `TextStyle.font` is therefore typed as the union
 *  of both, which is the truth about what a board file can hold. */
export type LegacyTextFont = 'mono' | 'ui' | 'read' | 'viet';
/** What `TextStyle.font` accepts on READ. `resolveFontKey` maps it to `TextFont`. */
export type TextFontStored = TextFont | LegacyTextFont;

/** ROUND Z, ITEM 2 — WHERE THE TEXT SITS VERTICALLY INSIDE ITS PADDED BOX.
 *
 *  Harvey: "Align chỉ có left center right. Tôi nghĩ chắc cần vertical align
 *  nữa nhỉ". The values and the default are draw.io's, verified in mxGraph's
 *  source (`mxText.js`: `this.valign = (valign != null) ? valign :
 *  mxConstants.ALIGN_MIDDLE`), and the model is draw.io's too: the padded box is
 *  the LABEL BOUNDS and the alignment resolves INSIDE it, so a choice here can
 *  never move text onto a cylinder cap or a diamond corner. */
export type TextVAlign = 'top' | 'middle' | 'bottom';

/** §E.2 — persisted verbatim on `node.data.textStyle`. Every field OPTIONAL and
 *  every field independently absent: a node with `{weight: 'bold'}` and nothing
 *  else renders bold text at the theme's own sizes and colours. */
export type TextStyle = {
  size?: TextSize;
  weight?: TextWeight;
  /** §E.1 — a SYMBOLIC KEY, resolved through `COLOR_VAR` (`src/colors.ts:20`).
   *  A hex here would be unthemable, which is the whole point of PACKAGE-L. */
  colorKey?: ColorKey;
  /* ROUND AQ2 (Harvey 2026-10-13) — a LITERAL hex for the text colour, for the
     case no key matches (the same need AO-1c served for the edge stroke). Stored
     beside `colorKey`; setting one clears the other, because two writers for one
     `--ts-color` is a value that can contradict itself. A literal cannot follow
     a theme — that is stated here, not worked around. */
  customColor?: string;
  align?: TextAlign;
  /** ROUND W, ITEM 2 — a family KEY, resolved through `TEXT_FONT_FAMILY` below.
   *  Stored as a key and not as a stack for the same reason `colorKey` is: a
   *  literal family list here would be a second copy of the sheet's stacks and
   *  would pin a node to the theme's current fonts forever.
   *
   *  ROUND Z, ITEM 1 — TYPED AS THE UNION, because that is what is on disk. A
   *  board written by ROUND W holds `'mono' | 'ui' | 'read' | 'viet'`; a board
   *  written now holds one of the six family keys. Reading either is
   *  `resolveFontKey`'s job, and writing is always a live key. */
  font?: TextFontStored;
  /** ROUND Z, ITEM 2 — the vertical position of the text INSIDE its padded
   *  box. The value that renders anyway stores ABSENCE, exactly like `size:
   *  'md'`, `weight: 'regular'` and `font: 'jetbrains'` — but WHICH value that
   *  is depends on the TARGET (`vAlignForBody`): `top` for a card, a note and a
   *  label, `middle` for a label-only node, whose box is centred by design.
   *  ROUND Z FIX 2 corrected this from one global `middle`; a single constant
   *  cannot describe a box that renders from its own `padding-top`. */
  vAlign?: TextVAlign;
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
   THE FAMILIES ARE LOCAL. `public/fonts/` holds 36 woff2 files — six families ×
   two weights × three subsets — declared by the `@font-face` blocks in
   `src/styles.css`. Nothing here mentions a CDN and nothing is downloaded at
   runtime — the app stays offline. */
export const TEXT_FONT_OPTS: {v: TextFont; label: string; title: string; hint: string}[] = [
  {v: 'jetbrains', label: 'JetBrains', title: 'JetBrains Mono', hint: 'technical / code'},
  {v: 'inter', label: 'Inter', title: 'Inter', hint: 'neutral UI'},
  {v: 'plex', label: 'IBM Plex', title: 'IBM Plex Sans', hint: 'architecture'},
  {v: 'shantell', label: 'Shantell', title: 'Shantell Sans', hint: 'hand-drawn'},
  {v: 'lexend', label: 'Lexend', title: 'Lexend', hint: 'reading ease'},
  {v: 'bevietnam', label: 'Be Vietnam', title: 'Be Vietnam Pro', hint: 'built for Vietnamese'},
];

/* ROUND Z, ITEM 1 — WHY THE BUTTON PRINTS A SHORT LABEL AND THE TITLE CARRIES
   THE REAL NAME, and why that is a MEASUREMENT rather than a preference.

   Six options in two rows of three is Harvey's layout ("nếu 6 nút thì 3 3 cho
   đẹp"). The panel field is 253px, the row gaps are 2×5px, so a cell is 81px and
   its content box is 65px (7px side padding + 1px border, `box-sizing:
   border-box`). Measured at 10px, the FULL family names are 84.0px (`JetBrains
   Mono`) and 75.2px (`Be Vietnam Pro`) — both wider than the box they would sit
   in, i.e. they would wrap and break the row's height. `IBM Plex Sans` (64.4px)
   and `Shantell Sans` (64.7px) fit by less than a pixel, which is not a margin.
   The SHORT labels at 10.5px are 56.7 / 22.5 / 42.4 / 41.0 / 37.4 / 58.9px —
   every one inside 65px with room to spare. So `label` is what the button
   prints and `title` is what hovering says; the two are the same family, and
   the button still renders the name IN that family, which is the whole reason
   the control exists. */

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
 *  `jetbrains`'s stack is `--mono` WITH the web font in front, so the default is
 *  today's exact stack plus the family as an alias — deliberately the only one
 *  of the six that changes no glyph on an already-installed machine. */
export const TEXT_FONT_FAMILY: Record<TextFont, string> = {
  jetbrains: "'JetBrains Mono', var(--mono)",
  inter: "'Inter', 'Inter Fallback', ui-sans-serif, system-ui, sans-serif",
  plex: "'IBM Plex Sans', 'IBM Plex Sans Fallback', ui-sans-serif, system-ui, sans-serif",
  shantell: "'Shantell Sans', 'Shantell Sans Fallback', ui-sans-serif, system-ui, sans-serif",
  lexend: "'Lexend', 'Lexend Fallback', ui-sans-serif, system-ui, sans-serif",
  bevietnam: "'Be Vietnam Pro', 'Be Vietnam Pro Fallback', ui-sans-serif, system-ui, sans-serif",
};

/** ROUND Z, ITEM 1 — THE OLD→NEW MAP, AND WHY IT IS A MAP AND NOT A RENAME.
 *
 *  A board saved before this round carries one of ROUND W's four ROLE keys on
 *  disk. `'viet'` there painted Be Vietnam Pro, so it must STILL paint Be
 *  Vietnam Pro — a board must not change face because the control was relabelled.
 *  The four keys are therefore kept in `LegacyTextFont`, `TextStyle.font` accepts
 *  them, and this table is the ONE place the translation is decided. Nothing
 *  silently drops a stored value; `resolveFontKey` is what every reader calls.
 *
 *    mono → jetbrains   (it already resolved to 'JetBrains Mono', var(--mono))
 *    ui   → inter       (it already resolved to 'Inter')
 *    read → lexend      (it already resolved to 'Lexend')
 *    viet → bevietnam   (it already resolved to 'Be Vietnam Pro')
 *
 *  THE KEYS ARE UNCHANGED KEYS, NOT NEW FAMILIES: each row names the family the
 *  old key already painted, so the mapping cannot move an existing board. */
export const LEGACY_FONT_KEY: Record<LegacyTextFont, TextFont> = {
  mono: 'jetbrains', ui: 'inter', read: 'lexend', viet: 'bevietnam',
};

/** Does this string name one of the six families this build declares? A stored
 *  value that is neither a live key nor a known legacy key — a hand-edited
 *  board, a key from a future round — is not a key, and the caller decides. */
export function isFontKey(v: unknown): v is TextFont {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(TEXT_FONT_FAMILY, v);
}

/** ROUND Z, ITEM 1 — EVERY READER'S ONE ENTRY POINT for a stored `font`.
 *
 *  A live key resolves to itself; a legacy key resolves through `LEGACY_FONT_KEY`;
 *  anything else resolves to the default. It is a FUNCTION rather than an index
 *  so the fallback cannot be forgotten at one call site: `TEXT_FONT_FAMILY[v]`
 *  on an unknown key is `undefined`, which would paint the unquoted fallback
 *  list and silently change the face of a node whose value nobody recognises. */
export function resolveFontKey(stored: TextFontStored | undefined): TextFont {
  if (isFontKey(stored)) return stored;
  if (typeof stored === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_FONT_KEY, stored)) {
    return LEGACY_FONT_KEY[stored as LegacyTextFont];
  }
  return TEXT_DEFAULT_FONT;
}

/* ROUND Z, ITEM 1 — THE MEASUREMENT THE SIX FAMILIES WERE CHOSEN BY, AS DATA.
   Every family above passed it and the four that failed are absent from the
   union: Atkinson Hyperlegible, Fira Code, Caveat and Architects Daughter ship
   NO `vietnamese` subset at all, so no amount of cmap testing could pass them.
   `checks/package-p-inspector.mjs` runs this function over each family's
   vietnamese codepoints, so "measured" is a property of the harness rather than
   a sentence in a comment. */
export const VIETNAMESE_GLYPH_RANGE: [number, number][] = [
  [0x0102, 0x0103], [0x0110, 0x0111], [0x0128, 0x0129], [0x0168, 0x0169],
  [0x01a0, 0x01a1], [0x01af, 0x01b0], [0x0300, 0x0301], [0x0303, 0x0304],
  [0x0308, 0x0309], [0x0323, 0x0323], [0x0329, 0x0329], [0x1ea0, 0x1ef9],
  [0x20ab, 0x20ab],
];

/** True when the font describes EVERY codepoint in `VIETNAMESE_GLYPH_RANGE`.
 *  `cmap` is anything with a `has(code)` — a real opentype.js cmap in the
 *  harness, a stub in a negative control. */
export function hasVietnameseGlyphs(cmap: {has(code: number): boolean}): boolean {
  return VIETNAMESE_GLYPH_RANGE.every(([lo, hi]) => {
    for (let c = lo; c <= hi; c++) if (!cmap.has(c)) return false;
    return true;
  });
}

export const TEXT_DEFAULT_FONT: TextFont = 'jetbrains';

/** ROUND Z, ITEM 2 — the three vertical positions, in the order the control
 *  prints them. ROUND Z FIX 2 REMOVED THE GLOBAL DEFAULT THAT USED TO SIT HERE.
 *
 *  It was `'middle'` (`TEXT_DEFAULT_VALIGN`), justified by draw.io's
 *  `ALIGN_MIDDLE` — and it was WRONG FOR THIS SHEET. Before this round every one
 *  of these boxes was a plain block (`.node-body`, `.note-body` and
 *  `.label-node` declared no `display: flex` at all), so each laid its text out
 *  from its own `padding-top`: that IS the `top` of the box. `.node .lo-body`
 *  was — and still is — `justify-content: center`, and it is the element a
 *  label-only node renders (`class="node-body lo-body"`), so THAT box is the one
 *  that genuinely centres. There was therefore never a single no-write value:
 *  the boxes disagreed before the control existed, and a global default made the
 *  panel report `middle` for nodes painting top.
 *
 *  The fix is the shape the horizontal axis already uses (`alignForBody`): the
 *  no-write value is a property of the TARGET, not a constant. See
 *  `vAlignForBody` below. This table's order is unchanged, so the control is. */
export const TEXT_VALIGN_OPTS: {v: TextVAlign; label: string}[] = [
  {v: 'top', label: 'Top'}, {v: 'middle', label: 'Middle'}, {v: 'bottom', label: 'Bottom'},
];

/** THE ONE MAPPING, semantic name → flex keyword, for the vertical axis.
 *
 *  `justify-content` on a `flex-direction: column` box IS that box's vertical
 *  axis: `flex-start` is its top, `center` its middle, `flex-end` its bottom.
 *  `textStyleVars` emits the keyword through this table and every consumer rule
 *  in the sheet reads `justify-content: var(--ts-align-items, …)`, so the three
 *  vertical values can never be spelled two ways. Named without a `DEFAULT` in
 *  it on purpose: it holds no default — the no-write value is per-target. */
export const TEXT_VALIGN_FLEX: Record<TextVAlign, string> = {
  top: 'flex-start', middle: 'center', bottom: 'flex-end',
};

/** THE NO-WRITE VALUE, BY TARGET — the vertical half of `alignForBody`, and read
 *  the same way by the panel, the merge and the emitter.
 *
 *  `.node .lo-body` centres its one sentence BY DESIGN (`styles.css`, L3a) and is
 *  `flex-direction: column`, so `center`/`middle` is what THAT box renders with
 *  nothing stored. Every other target renders from its `padding-top`
 *  (`.node-body`, `.note-body` and `.label-node` were plain blocks until this
 *  round), so for them the value that renders with nothing stored is `top` —
 *  which is also what draw.io's `.node-body`-shaped boxes do unpadded, and what
 *  every existing board's pixels already show.
 *
 *  So a card reads back as Top and a label-only node as Middle. Each box's own
 *  `justify-content` fallback is the other half of this same statement, and
 *  `checks/package-p-inspector.mjs` asserts the two halves agree per box. */
export const vAlignForBody = (body: 'card' | 'label-only' | undefined): TextVAlign =>
  body === 'label-only' ? 'middle' : 'top';

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
  vAlignDefault: TextVAlign,
): boolean {
  if (key === 'size') return v === TEXT_DEFAULT_SIZE;
  if (key === 'weight') return v === TEXT_DEFAULT_WEIGHT;
  if (key === 'align') return v === alignDefault;
  /* ROUND W, ITEM 2 — `jetbrains` renders anyway, so picking it stores ABSENCE,
   *  exactly like M and Regular. Target-independent, like size and weight: the
   *  sheet's own stacks ARE the mono/sans mix every node already paints.
   *
   *  ROUND Z, ITEM 1 — ASKED THROUGH `resolveFontKey`, NOT BY EQUALITY. A board
   *  still carrying ROUND W's `'mono'` is a node that renders JetBrains Mono,
   *  which is this round's default; comparing the raw value against
   *  `TEXT_DEFAULT_FONT` would read that as a real choice and store a
   *  permanently-set field on a node the user never touched. The resolver is
   *  the same one the renderer uses, so "is this the default" and "what does
   *  this paint" can never disagree. */
  if (key === 'font') return resolveFontKey(v as TextFontStored | undefined) === TEXT_DEFAULT_FONT;
  /* ROUND Z, ITEM 2 — the value an untouched node OF THIS TARGET renders, so it
   *  stores absence like every other default here. ROUND Z FIX 2 — asked against
   *  the TARGET's default (`vAlignForBody`), never a global `middle`: `middle`
   *  is a REAL choice on a card (it centres a box that otherwise renders from its
   *  padding-top) and the no-write value only on a label-only node. A global
   *  constant here would have dropped a card's Middle, which is a pixel move. */
  if (key === 'vAlign') return v === vAlignDefault;
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
 *  `alignForBody`). ROUND Z FIX 2 — `vAlignDefault` is passed in for exactly the
 *  same reason and from the same place (`vAlignForBody`): the vertical default
 *  is `top` on a card and `middle` on a label-only node, so `middle` must be
 *  stored where it is a real choice and dropped where the box already centres. */
export function mergeTextStyle(
  cur: TextStyle | undefined,
  patch: Partial<TextStyle>,
  alignDefault: TextAlign,
  vAlignDefault: TextVAlign,
): TextStyle | undefined {
  const next: TextStyle = {...(cur ?? {})};
  // Fixed key order, so a delete-then-re-add cannot reorder the object and make
  // a value-equality check below read as a change.
  for (const k of ['size', 'weight', 'colorKey', 'align', 'font', 'vAlign', 'scale'] as (keyof TextStyle)[]) {
    if (!(k in patch)) continue;
    const v = patch[k];
    if (v === undefined || isTextDefault(k, v, alignDefault, vAlignDefault)) delete next[k];
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
export function readTextStyle(
  ts: TextStyle | undefined,
  alignDefault: TextAlign,
  vAlignDefault: TextVAlign,
) {
  const painted = scaleOfTextStyle(ts);
  return {
    size: stepForScale(painted),
    weight: ts?.weight ?? TEXT_DEFAULT_WEIGHT,
    colorKey: ts?.colorKey ?? null,
    /* ROUND AQ2 — the literal, read back so the custom cell can show the stored
       value and take its ring. Absent when a key is set (the merge forbids both). */
    customColor: ts?.customColor,
    align: ts?.align ?? alignDefault,
    /* ROUND Z, ITEM 1 — RESOLVED, so the control highlights the family that
     *  actually paints. A board carrying ROUND W's `'viet'` reads as
     *  `bevietnam` here, which is the button that repaints it; reading the raw
     *  `'viet'` would light NO button while the node painted Be Vietnam Pro. */
    font: resolveFontKey(ts?.font),
    /* ROUND Z, ITEM 2 — a missing field reads as the inherited default, never
     *  as a blank, exactly like `weight` and `align` above. ROUND Z FIX 2 — the
     *  inherited default is the TARGET's (`vAlignForBody`), so the panel reads
     *  back Top on a card — which is what that card paints — and Middle on a
     *  label-only node, which is the only box that centres. */
    vAlign: ts?.vAlign ?? vAlignDefault,
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
 *  target-INDEPENDENT by construction.
 *
 *  ROUND Z FIX 2 — `vAlignDefault` IS A PARAMETER FOR THE SAME REASON as
 *  `alignDefault`, and it is the fix for the defect this round shipped. The
 *  vertical default is NOT a constant: `.node .lo-body` centres by design, so a
 *  label-only node is already `middle` with nothing stored, while `.node-body`,
 *  `.note-body` and `.label-node` all render from their `padding-top` — `top` —
 *  because none of them was a flex container before this round. A single global
 *  `middle` therefore had to be wrong for one group or the other, and it was: it
 *  emitted nothing for `middle` while every card fell back to `flex-start`, so
 *  the panel said Middle and the pixels said Top. `vAlignForBody` answers it per
 *  target, and each box's own `justify-content` fallback states the same thing on
 *  the sheet's side. */
export function textStyleVars(
  ts: TextStyle | undefined,
  alignDefault: TextAlign,
  vAlignDefault: TextVAlign,
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
  /* ROUND AQ2 — the literal wins ONLY when no key is set (setting one clears the
     other at write time; a hand-edited board carrying both keeps the key, the
     same precedence the scale/size pair documents above). */
  else if (ts.customColor) out['--ts-color'] = ts.customColor;
  /* ROUND W, ITEM 2 — ONE property, the WHOLE node. Each of the sheet's text
     rules keeps its own stack as the fallback, so an untouched node emits
     nothing here and is byte-identical to before this round.
     ROUND Z, ITEM 1 — read through `resolveFontKey`, so a board carrying a
     ROUND W role key emits the SAME stack it emitted then (the default key, for
     all four, since each legacy key resolves to the family it already painted)
     and no stored board changes face. */
  const font = resolveFontKey(ts.font);
  if (font !== TEXT_DEFAULT_FONT) out['--ts-font'] = TEXT_FONT_FAMILY[font];
  /* ROUND Z, ITEM 2 — ONE MORE property beside `--ts-align`/`--ts-justify`, on
     the node root, consumed by each text box's own rule in the sheet with that
     box's CURRENT literal as the fallback.
     ROUND Z FIX 2 — THE NO-WRITE TEST IS PER-TARGET (`vAlignForBody`). The value
     that renders anyway is `top` for a card, a note and a label (they render from
     `padding-top` and did so before this round) and `middle` for a label-only
     node (`.node .lo-body` centres by design). Testing against a global `middle`
     was the defect: it dropped a card's Top — a real choice that moves the
     pixels — and it emitted nothing for `middle` on a card, where the sheet's
     `flex-start` fallback then painted TOP under a panel reporting Middle. */
  if (ts.vAlign && ts.vAlign !== vAlignDefault) {
    out['--ts-valign'] = ts.vAlign;
    out['--ts-align-items'] = TEXT_VALIGN_FLEX[ts.vAlign];
  }
  if (ts.align && ts.align !== alignDefault) {
    out['--ts-align'] = ts.align;
    out['--ts-justify'] = JUSTIFY[ts.align];
  }
  return out;
}

/** ROUND AM, AM-2 — THE EDGE LABEL'S OWN SUBSET of `textStyleVars`, as a
 *  FUNCTION rather than at the call site.
 *
 *  WHY THIS EXISTS AT ALL. The edge label is the fourth target of the text
 *  vocabulary and it is NOT a node: it is an inline chip with no padded box, so
 *  two of `TextStyle`'s six fields have no element to act on here.
 *
 *    · `align`    — `.edge-label` is a `display: inline` chip whose width IS its
 *                   text; there is no box for `text-align` or `justify-content`
 *                   to distribute text inside. Its POSITION on the line is
 *                   `data.labelOffset`, set by the drag.
 *    · `vAlign`   — same box, same reason, one axis over.
 *    · `colorKey` — the label's colour is ALREADY a control, and a different
 *                   one: `data.labelTextKey`, rendered by the LABEL section
 *                   (`--label-fg`, set by `GoblinEdge`). The Text section
 *                   deliberately renders no colour row for an edge, so emitting
 *                   `--ts-color` here would be a SECOND writer for the label's
 *                   ink — one the panel never shows, so a stored value in it
 *                   could repaint the label with nothing in the UI to undo it.
 *                   `--ts-color` keeps its single, node-and-label-kind meaning.
 *
 *  WHY NOT FILTER THE OUTPUT AT THE CALL SITE. That is what the first cut of
 *  AM-2 did, as a `delete` chain on the returned record, and it was wrong for
 *  this project's reason rather than for style: the decision becomes invisible
 *  to any harness (a probe would have to re-implement the deletes to ask what
 *  the label really emits) and the `delete v['--ts-valign']` pair silently
 *  assumed `textStyleVars` would emit `--ts-valign` and `--ts-align-items`
 *  TOGETHER, so a third property added to that pair in a future round would
 *  leak onto the label with nothing to catch it. Here the rule is stated once,
 *  positively, and `checks/round-am-edge-panel.mjs` executes THIS function to
 *  assert both halves: what an edge style emits, and what it must NOT.
 *
 *  IT DELEGATES RATHER THAN RE-DERIVING. The three properties it does emit come
 *  from the SAME `textStyleVars` call the node path makes, with the same
 *  emitter, so an untouched board emits nothing (the `{}` of a style-less
 *  label) and the sheet's fallbacks paint the previous bytes exactly. */
export function edgeTextStyleVars(ts: TextStyle | undefined): Record<string, string> {
  const out = textStyleVars(ts, 'left', 'middle');
  delete out['--ts-color'];
  delete out['--ts-align'];
  delete out['--ts-justify'];
  delete out['--ts-valign'];
  delete out['--ts-align-items'];
  return out;
}
