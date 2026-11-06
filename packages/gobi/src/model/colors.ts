/* PACKAGE-L / L1 — SYMBOLIC COLOURS (the crux of the theming work).
 *
 * Node and edge colours used to be stored as literal hex inside the board JSON
 * (`data.color`, `style.stroke`, `markerEnd.color`). A hex string baked into a
 * document can never be recoloured by a theme, so the *stored* value becomes a
 * symbolic key (`colorKey` / `strokeKey`) and `resolveColor()` turns it into
 * `var(--c-*)` at render time. The CSS variable cascades from the themed root,
 * so every shape frame, icon tint, metric and glow follows the theme —
 * shapes.tsx needs no per-theme logic at all.
 *
 * This module has no imports, so both palette.ts and DiagramNode.tsx can use it
 * without a cycle.
 */

export type ColorKey =
  | 'accent' | 'green' | 'cyan' | 'violet' | 'amber' | 'slate' | 'red' | 'blue' | 'pink'
  | 'black' | 'white';

export const COLOR_KEYS: ColorKey[] = [
  'accent', 'green', 'cyan', 'violet', 'amber', 'slate', 'red', 'blue', 'pink',
  'black', 'white',
];

/** Layer-2 tokens: the shape accents, declared per theme in styles.css.
 *  `black` and `white` are the two THEME-INVARIANT members (ROUND AO, AO-1b) —
 *  declared once in `:root` and by no `[data-theme=…]` block, because black is
 *  black in every theme. They are here so that "no neutral in the palette" stops
 *  being a special case: every `COLOR_KEYS.map` surface (the seven colour rows,
 *  the shape previews, the payload tints) gains them with no second mechanism. */
export const COLOR_VAR: Record<ColorKey, string> = {
  accent: 'var(--c-accent)', green: 'var(--c-green)', cyan: 'var(--c-cyan)',
  violet: 'var(--c-violet)', amber: 'var(--c-amber)', slate: 'var(--c-slate)',
  red: 'var(--c-red)', blue: 'var(--c-blue)', pink: 'var(--c-pink)',
  black: 'var(--c-black)', white: 'var(--c-white)',
};

/** The dark-layer hexes — the legacy board format and the export fallback.
 *  These are the DARK-theme values verbatim: that was already true for the six
 *  original keys, and the three added in ROUND AG1 keep the rule.
 *
 *  ROUND AO, AO-1b — the two NEUTRALS JOIN, and the rule is why. This map is
 *  `Record<ColorKey, string>`: it is the literal fallback for EVERY key, and the
 *  theme-invariant pair is no exception (black IS the dark value of `black`). Its
 *  readers are the colour harness (which executes every key's fallback through
 *  `keyForHex`) and the export path, so a missing entry is not cosmetic: before
 *  this line `keyForHex(COLORS.black)` read `undefined.toLowerCase()` and threw,
 *  which took the whole colours module down inside the harness. The pair keeps the
 *  `COLORS`/`LEGACY_HEX` split intact: an entry HERE is a fallback, an entry THERE
 *  would be a migration — and a migration for a value that never shipped is what
 *  AO-1b refuses (see below). */
export const COLORS = {
  accent: '#f54e00',
  green: '#4ade80',
  cyan: '#22d3ee',
  violet: '#a78bfa',
  amber: '#fbbf24',
  slate: '#94a3b8',
  red: '#ff6b6b',
  blue: '#7aa2ff',
  pink: '#f783ac',
  black: '#000000',
  white: '#ffffff',
} as const;

/** Legacy board JSON carries these literals — map them back onto keys on load.
 *  Only the ORIGINAL six ever shipped, so no new key is added here: a board
 *  written before ROUND AG1 has never seen a `red`/`blue`/`pink` literal.
 *  ROUND AO, AO-1b adds NOTHING here either, and deliberately: `#000000` /
 *  `#ffffff` were never a legacy stored value, so there is no board that needs
 *  mapping back. Adding them would make `keyForHex('#000000')` return `'black'`,
 *  i.e. invent a migration for a format that never existed. */
export const LEGACY_HEX: Record<string, ColorKey> = {
  '#f54e00': 'accent',
  '#4ade80': 'green',
  '#22d3ee': 'cyan',
  '#a78bfa': 'violet',
  '#fbbf24': 'amber',
  '#94a3b8': 'slate',
};

export const isColorKey = (v: unknown): v is ColorKey =>
  typeof v === 'string' && (COLOR_KEYS as string[]).includes(v);

/** The colour-carrying shape shared by node data and edge data. `color` is a
 *  literal user-typed hex (the "custom…" escape hatch). */
export type Colored = {colorKey?: ColorKey; color?: string; strokeKey?: ColorKey};

/** Live render value for a node or edge. A symbolic key wins over a literal. */
export function resolveColor(d: Colored | undefined | null): string {
  if (!d) return COLOR_VAR.slate;
  if (isColorKey(d.colorKey)) return COLOR_VAR[d.colorKey];
  if (isColorKey(d.strokeKey)) return COLOR_VAR[d.strokeKey];
  if (typeof d.color === 'string' && d.color) return d.color;
  return COLOR_VAR.slate;
}

/** Which swatch reads as "on" (key preferred, literal hex mapped back). */
export function resolveColorKey(d: Colored | undefined | null): ColorKey | null {
  if (!d) return null;
  if (isColorKey(d.colorKey)) return d.colorKey;
  if (isColorKey(d.strokeKey)) return d.strokeKey;
  return keyForHex(d.color) ?? null;
}

/** Hex (any case / whitespace) → key, or undefined. */
export const keyForHex = (hex: unknown): ColorKey | undefined =>
  typeof hex === 'string' ? LEGACY_HEX[hex.trim().toLowerCase()] : undefined;
