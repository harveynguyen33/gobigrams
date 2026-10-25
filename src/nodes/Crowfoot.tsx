/* ---------------------------------------------------------------------------
   L3c — crow's-foot relationship markers (ERD).

   React Flow's `MarkerType` only ships Arrow / ArrowClosed, so crow's feet are
   hand-authored SVG (the Liam ERD / Prismaliser approach, simplified to the
   three IE glyphs):
     · ring   = zero (optional)
     · bar    = one
     · foot   = many  (three-line crow's foot)

   The end glyph is the *outer* (maximum) symbol and the ring is the *inner*
   (minimum) one, so:
     one            → bar                    (exactly one)
     many           → foot                   (one or many)
     zeroOrOne      → ring + bar             (zero or one)
     zeroOrMany     → ring + foot            (zero or many)

   ChartDB's model only has one|many and therefore cannot express zero-or-one;
   these four do.

   Marker ids are keyed by the SYMBOLIC colour key (not the resolved hex), so
   one `<defs>` set works for every theme; the glyph's actual colour comes from
   `var(--c-<key>)`, which the theme cascades. That keeps the id stable across a
   theme switch (no stale marker) while still recolouring.
--------------------------------------------------------------------------- */

import {COLOR_VAR, type ColorKey} from '../colors';

export type CrowFoot = 'one' | 'many' | 'zeroOrOne' | 'zeroOrMany';

export const CROW_FOOT_IDS = ['one', 'many', 'zeroOrOne', 'zeroOrMany'] as const;
export const isCrowFoot = (v: unknown): v is CrowFoot =>
  typeof v === 'string' && (CROW_FOOT_IDS as readonly string[]).includes(v);

/** Stable marker id for a glyph + symbolic colour key (theme-independent). */
export const markerIdFor = (type: CrowFoot, key: ColorKey) => `crow-${type}-${key}`;
/** The colour value a glyph is painted with — a token, so the theme cascades. */
export const markerColorVar = (key: ColorKey) => COLOR_VAR[key];

/** `refX = width / 2` puts the glyph's outer edge exactly on the node boundary.
 *  `c` is a CSS colour value — a `var(--c-*)` token, so the glyph follows the theme. */
const GLYPH = {
  one: {width: 10, content: (c: string) => <path d="M9 1 V11" stroke={c} strokeWidth={1.6} />},
  many: {
    width: 12,
    content: (c: string) => (
      <g stroke={c} strokeWidth={1.5} fill="none">
        <path d="M11 1 L1 6" />
        <path d="M11 11 L1 6" />
        <path d="M11 6 L1 6" />
      </g>
    ),
  },
  zeroOrOne: {
    width: 18,
    content: (c: string) => (
      <g stroke={c} strokeWidth={1.5} fill="none">
        <circle cx="13.5" cy="6" r="3.2" />
        <path d="M17 1 V11" />
      </g>
    ),
  },
  zeroOrMany: {
    width: 20,
    content: (c: string) => (
      <g stroke={c} strokeWidth={1.5} fill="none">
        <circle cx="15.5" cy="6" r="3.2" />
        <path d="M9 1 L19 6" />
        <path d="M9 11 L19 6" />
        <path d="M9 6 L19 6" />
      </g>
    ),
  },
} as const;

/** One <marker> per (glyph × colour key). Rendered as a sibling of the edges so
 *  the `url(#…)` references resolve in every browser (the same place React Flow
 *  renders its own arrowheads). */
export function CrowFootDefs({keys}: {keys: ColorKey[]}) {
  const used = keys.length ? keys : (['slate'] as ColorKey[]);
  return (
    <svg className="ds-crowdefs" aria-hidden="true" width="0" height="0">
      <defs>
        {used.flatMap(key => CROW_FOOT_IDS.map(t => {
          const g = GLYPH[t];
          const color = markerColorVar(key);
          return (
            <marker
              key={`${t}-${key}`}
              id={markerIdFor(t, key)}
              markerWidth={g.width}
              markerHeight={12}
              viewBox={`0 0 ${g.width} 12`}
              refX={g.width / 2}
              refY={6}
              orient="auto-start-reverse"
              markerUnits="userSpaceOnUse"
            >
              {g.content(color)}
            </marker>
          );
        }))}
      </defs>
    </svg>
  );
}

/** `1:N`, `1:1`, `0..1:N`, … derived from the two end glyphs. */
export function cardinalityLabel(source: CrowFoot | undefined, target: CrowFoot | undefined): string {
  if (!source && !target) return '';
  const end = (c?: CrowFoot) => {
    switch (c) {
      case 'one': return '1';
      case 'many': return '*';
      case 'zeroOrOne': return '0..1';
      case 'zeroOrMany': return '0..*';
      default: return '';
    }
  };
  const a = end(source);
  const b = end(target);
  if (!a || !b) return '';
  return a === b ? `${a}—${b}` : `${a}:${b}`;
}
