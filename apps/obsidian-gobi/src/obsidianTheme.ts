/* STEP-6-OBSIDIAN — the theme bridge: gobi's token vocabulary re-mapped at
 * inject time onto Obsidian's own CSS variables (SPEC-GOBI-CORE §E), so a
 * diagram belongs to the vault's theme with zero theme logic of its own.
 *
 * WHY HERE AND NOT IN CSS: renderGobiDocument bakes resolved token VALUES
 * into the SVG (literal fills + the embedded <style> block), so a var() in a
 * stylesheet could never re-colour a painted shape. The bridge therefore
 * resolves Obsidian's variables to concrete colours at render time and hands
 * them to the core as the token table. The --c-* accent vocabulary (symbolic
 * shape accents) intentionally stays on the gobi baseline — shapes keep their
 * meaning across vaults; only neutrals and accents follow the vault.
 *
 * The mapping core is a PURE function of a value-getter so the headless test
 * can drive it with fixture values for a light and a dark vault. */

/** One gobi token <- one Obsidian variable. `alpha` (0..1) asks for a soft
 * wash of the same colour (gobi's *-soft tokens are 14% accent washes). */
export type TokenMapping = {gobi: string; obsidian: string; alpha?: number};

export const OBSIDIAN_TOKEN_MAP: readonly TokenMapping[] = [
  {gobi: '--bg', obsidian: '--background-primary'},
  {gobi: '--surface', obsidian: '--background-secondary'},
  {gobi: '--elevated', obsidian: '--background-secondary'},
  {gobi: '--card', obsidian: '--background-secondary'},
  {gobi: '--border', obsidian: '--background-modifier-border'},
  {gobi: '--border-strong', obsidian: '--background-modifier-border-hover'},
  {gobi: '--fg', obsidian: '--text-normal'},
  {gobi: '--dim', obsidian: '--text-muted'},
  {gobi: '--dim2', obsidian: '--text-faint'},
  {gobi: '--acc', obsidian: '--interactive-accent'},
  {gobi: '--acc-soft', obsidian: '--interactive-accent', alpha: 0.14},
  {gobi: '--sel', obsidian: '--text-accent'},
  {gobi: '--sel-soft', obsidian: '--text-accent', alpha: 0.14},
  {gobi: '--green', obsidian: '--color-green'},
  {gobi: '--red', obsidian: '--color-red'},
  {gobi: '--danger', obsidian: '--color-red'},
];

/** Parse a CSS colour the vault can hand us — #rgb/#rgba/#rrggbb(#aa),
 * rgb()/rgba(). Returns [r,g,b,a] or null (named colours, color-mix(), empty).
 * getComputedStyle resolves Obsidian's variables to one of these forms. */
export function parseColor(s: string): [number, number, number, number] | null {
  const v = s.trim().toLowerCase();
  if (!v) return null;
  if (v.startsWith('#')) {
    const h = v.slice(1);
    const two = h.length === 3 || h.length === 4;
    if (two ? /^[0-9a-f]{3,4}$/.test(h) : /^[0-9a-f]{6}([0-9a-f]{2})?$/.test(h)) {
      const pick = (i: number) => parseInt(two ? h[i]! + h[i]! : h.slice(i * 2, i * 2 + 2), 16);
      return [
        pick(0), pick(1), pick(2),
        h.length === 4 || h.length === 8 ? pick(3) / 255 : 1,
      ];
    }
    return null;
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(v);
  if (m) {
    const parts = m[1]!.split(/[\s,/]+/).filter(Boolean);
    if (parts.length >= 3) {
      const n = (x: string) => {
        const p = x.endsWith('%') ? (parseFloat(x) / 100) * 255 : parseFloat(x);
        return Number.isFinite(p) ? Math.max(0, Math.min(255, Math.round(p))) : NaN;
      };
      const r = n(parts[0]!), g = n(parts[1]!), b = n(parts[2]!);
      const a = parts[3] === undefined ? 1 : parseFloat(parts[3]!);
      if ([r, g, b, a].every(Number.isFinite)) return [r, g, b, Math.max(0, Math.min(1, a))];
    }
  }
  return null;
}

const toRgba = (c: [number, number, number, number]): string =>
  `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3]})`;

/** The bridge itself: gobi baseline + Obsidian overrides. A variable the
 * vault does not define (or resolves to something unparsable) KEEPS the
 * baseline token — the diagram always renders, never half-themed. */
export function obsidianTokens(
  get: (obsidianVar: string) => string,
  base: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {...base};
  for (const m of OBSIDIAN_TOKEN_MAP) {
    const parsed = parseColor(get(m.obsidian));
    if (!parsed) continue; /* keep the baseline token */
    out[m.gobi] = m.alpha === undefined ? toRgba(parsed) : toRgba([parsed[0], parsed[1], parsed[2], m.alpha]);
  }
  return out;
}

/** The live value-getter against the vault body, or null when there is no
 * DOM (headless test / SSR) — the caller then renders the dark baseline. */
export function liveObsidianGetter(): ((name: string) => string) | null {
  if (typeof document === 'undefined' || !document.body) return null;
  const cs = getComputedStyle(document.body);
  return (name) => cs.getPropertyValue(name).trim();
}
