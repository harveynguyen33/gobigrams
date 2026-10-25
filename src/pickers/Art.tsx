/* ROUND BN-4 — one slice of the former src/InspectorPickers.tsx (split
   verbatim, 2026-10-25 along the section banners the file declares).
   src/InspectorPickers.tsx re-exports the union, so no importer changes. */
import type {ReactNode} from 'react';

/* ===========================================================================
   The glyph bank. Every glyph is 26×18, `currentColor`, stroke-filled only.
   A glyph is a picture of the VALUE, so the trigger shows what is set without
   the user opening the popover.
   =========================================================================== */
export const G = ({children}: {children: ReactNode}) => (
  <svg className="insp-glyph" viewBox="0 0 26 18" width="26" height="18" aria-hidden="true">
    {children}
  </svg>
);

/** Stroke width ladder — the line's own weight IS the glyph. */
export const ArtWidth = ({w}: {w: number}) => (
  <G><line x1="2" y1="9" x2="24" y2="9" stroke="currentColor" strokeWidth={w} strokeLinecap="round" /></G>
);

/** solid / dashed / dotted, drawn as the actual dash patterns the edge uses
 *  (`App.tsx:433` `dashArray` — '6 4' and '1.5 3.5'). */
export const ArtDash = ({kind}: {kind: 'solid' | 'dashed' | 'dotted'}) => (
  <G>
    <line
      x1="2" y1="9" x2="24" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeDasharray={kind === 'dashed' ? '6 4' : kind === 'dotted' ? '1.5 3.5' : undefined}
    />
  </G>
);

/** ROUND AL, AL-6 — the five FLOW states, drawn as what they DO to the line.
 *  The `flow` row is a GLYPH row, so these are what its square chips carry
 *  instead of the words the panel used to print. A glyph row built of squares is
 *  even by construction, and it is also what brought the row from 90.9% of the
 *  field down to ~69% — ten word-buttons on one line was the owner's "chen chúc".
 *
 *  `dots` and `pulse` share a rail line: dots shows three staggered beads, pulse
 *  a bright segment sweeping it. `icon` shows the travelling chip in miniature. */
export const ArtFlow = ({kind}: {kind: 'none' | 'dots' | 'dash' | 'pulse' | 'icon'}) => (
  <G>
    {kind === 'none' && (
      <line x1="2" y1="9" x2="24" y2="9" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" opacity=".38" />
    )}
    {kind === 'dots' && (
      <>
        <circle cx="5" cy="9" r="2" fill="currentColor" />
        <circle cx="13" cy="9" r="2" fill="currentColor" opacity=".6" />
        <circle cx="21" cy="9" r="2" fill="currentColor" opacity=".32" />
      </>
    )}
    {kind === 'dash' && (
      <line x1="2" y1="9" x2="24" y2="9" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeDasharray="4 3" />
    )}
    {kind === 'pulse' && (
      <>
        <line x1="2" y1="9" x2="24" y2="9" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" opacity=".35" />
        <line x1="9" y1="9" x2="17" y2="9" stroke="currentColor" strokeWidth="3.4"
          strokeLinecap="round" />
      </>
    )}
    {kind === 'icon' && (
      <>
        <line x1="2" y1="9" x2="24" y2="9" stroke="currentColor" strokeWidth="1.6"
          strokeLinecap="round" opacity=".5" />
        <rect x="9" y="5" width="8" height="8" rx="1.8" fill="currentColor" />
      </>
    )}
  </G>
);

/** The four path shapes `PATH_TYPES` (`App.tsx:109`) can produce. */
export const ArtCurve = ({kind}: {kind: 'bezier' | 'smoothstep' | 'step' | 'straight'}) => (
  <G>
    <path
      d={
        kind === 'bezier' ? 'M2 15 C 10 15 16 3 24 3'
        : kind === 'smoothstep' ? 'M2 15 H 11 C 13 15 13 3 15 3 H 24'
        : kind === 'step' ? 'M2 15 H 13 V 3 H 24'
        : 'M2 15 L 24 3'
      }
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
    />
  </G>
);

/** Arrowhead vocabulary: bare line, closed triangle, open chevron.
 *  `flip` mirrors the whole glyph so the head-start picker reads as the
 *  mirror of the head-end picker, exactly as the two controls relate. */
export const ArtArrow = ({kind, flip}: {kind: 'none' | 'closed' | 'open'; flip?: boolean}) => (
  <G>
    <g transform={flip ? 'translate(26 0) scale(-1 1)' : undefined}>
      <line x1="2" y1="9" x2={kind === 'none' ? 24 : 17} y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {kind === 'closed' && <path d="M17 4 L24 9 L17 14 Z" fill="currentColor" />}
      {kind === 'open' && <path d="M17 4 L24 9 L17 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
    </g>
  </G>
);

/** Crow's-foot cardinality notation, at the RIGHT end of the line. `flip`
 *  mirrors it for the source-end control. The six kinds are IE / IDEF1X
 *  notation, which is why this is drawn rather than iconised. */
export const ArtCardinality = ({kind, flip}: {kind: string; flip?: boolean}) => (
  <G>
    <g transform={flip ? 'translate(26 0) scale(-1 1)' : undefined}>
      <line x1="2" y1="9" x2={kind === 'arrow' ? 17 : 24} y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {kind === 'one' && <line x1="21" y1="3" x2="21" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
      {kind === 'zeroOrOne' && <>
        <circle cx="16.5" cy="9" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="22.5" y1="3.5" x2="22.5" y2="14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>}
      {kind === 'many' && <path d="M24 9 L18 3 M24 9 L18 9 M24 9 L18 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
      {kind === 'zeroOrMany' && <>
        <circle cx="16" cy="9" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M24 9 L18.5 3.5 M24 9 L18.5 9 M24 9 L18.5 14.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </>}
      {kind === 'arrow' && <path d="M17 4 L24 9 L17 14 Z" fill="currentColor" />}
    </g>
  </G>
);

/** Where the edge's label sits along the line: the box IS the label.
 *
 *  ROUND AK, AK-3 — DELETED WITH ITS ONLY CONSUMER. `ArtLabelPos` was drawn
 *  solely by `OFFSET_OPTS` in `App.tsx`, which backed the `label position` row.
 *  That row is gone (the label drag sets the same value), so the glyph has no
 *  referent. Left in the file as a written record rather than silently dropped;
 *  `checks/package-p-inspector.mjs` re-anchors its `ArtLabelPos` count to 0.
 *
 *  export const ArtLabelPos = ({pos}: {pos: 'center' | 'start' | 'end'}) => (
 *    <G>
 *      <line x1="1" y1="9" x2="25" y2="9" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
 *      <rect x={pos === 'start' ? 3 : pos === 'end' ? 15 : 9} y="5" width="8" height="8"
 *        rx="1.6" fill="var(--elevated)" stroke="currentColor" strokeWidth="1.5" />
 *    </G>
 *  );
 */

