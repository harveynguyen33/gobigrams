/**
 * ROUND AM, AM-3 — THE FLOW GLYPHS' ONE HOME.
 *
 * These six paths used to live inside `GoblinEdge.tsx`, which made them
 * unreachable from the inspector: the panel could only describe the options in
 * words ("Letter", "Package", …) while the canvas travelled the actual picture.
 * AL-6 wrote a comment claiming the panel "reuses FLOW_ICON_PATHS' own
 * vocabulary rather than inventing a second one" — true of the KEYS, but a
 * PROMISE rather than a structure, because the shape behind the key lived on the
 * other side of a module boundary the panel does not cross.
 *
 * This module makes it structural. `GoblinEdge.tsx` and `App.tsx` both read
 * THIS file, so a glyph is defined once and a chip cannot drift from the thing
 * it animates. The path data below is byte-for-byte the vocabulary the edge has
 * always animated — moving it was the whole change; not one `d` was retouched.
 *
 * A `.tsx` (not `.ts`) because it holds JSX, and deliberately FREE OF REACT FLOW
 * and of any other app import: it is a leaf, so the panel can read it without
 * dragging the canvas, the store or the renderer into the inspector's bundle.
 * It imports only `react`'s fragment, which the JSX runtimes already resolve.
 */
import type {ReactNode} from 'react';

/**
 * Inline SVG paths for the flow-icon animation. 24×24 viewBox, stroke geometry
 * drawn by hand (mail / package / file / zap / settings / database) so the
 * travelling chip needs no external dependency and inherits the edge colour.
 *
 * Both readers pass their own attributes on the wrapper `<svg>` (the canvas sets
 * the edge's colour and the chip's size, the panel sets the chip's), so nothing
 * here bakes in a stroke width or a class that would fight the caller.
 */
/* ROUND GOBI-LOCK — FlowIconName is derived from the table's own keys (the
 * `as const satisfies` form keeps every key a literal at the type level while
 * the runtime object stays byte-identical): the .gobi flowIcon: vocabulary
 * (gobiTypes) and EdgeData.flowIcon read THIS table as the one registry; no
 * second hand-listed icon set may exist. */
const FLOW_ICON_TABLE = {
  // envelope / letter
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  package: (
    <>
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="M3.3 7 12 12l8.7-5" />
      <path d="M12 22V12" />
    </>
  ),
  file: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </>
  ),
  zap: <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M2 12h3m14 0h3M4.9 19.1 7 17m10-10 2.1-2.1" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </>
  ),
} as const satisfies Record<string, ReactNode>;

export type FlowIconName = keyof typeof FLOW_ICON_TABLE;
export const FLOW_ICON_PATHS: Record<FlowIconName, ReactNode> = FLOW_ICON_TABLE;
