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
  | 'accent' | 'green' | 'cyan' | 'violet' | 'amber' | 'slate' | 'red' | 'blue' | 'pink';

export const COLOR_KEYS: ColorKey[] = [
  'accent', 'green', 'cyan', 'violet', 'amber', 'slate', 'red', 'blue', 'pink',
];

/** Layer-2 tokens: the shape accents, declared per theme in styles.css. */
export const COLOR_VAR: Record<ColorKey, string> = {
  accent: 'var(--c-accent)', green: 'var(--c-green)', cyan: 'var(--c-cyan)',
  violet: 'var(--c-violet)', amber: 'var(--c-amber)', slate: 'var(--c-slate)',
  red: 'var(--c-red)', blue: 'var(--c-blue)', pink: 'var(--c-pink)',
};

/** The dark-layer hexes — the legacy board format and the export fallback.
 *  These are the DARK-theme values verbatim: that was already true for the six
 *  original keys, and the three added in ROUND AG1 keep the rule. */
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
} as const;

/** Legacy board JSON carries these literals — map them back onto keys on load.
 *  Only the ORIGINAL six ever shipped, so no new key is added here: a board
 *  written before ROUND AG1 has never seen a `red`/`blue`/`pink` literal. */
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
