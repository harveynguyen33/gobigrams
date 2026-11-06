/* CORE-STEP4A-FIX — this file is the REACT half of the shape module. The pure
 * geometry (the Shape union, the registry tables, the SVG emitters the
 * exporter and the .gobi core share) moved into the @techgoblin/gobi-core package
 * (packages/gobi/src/model/nodes/shapes.ts); these two React renderers
 * (ShapeFrame on the canvas, ShapePreview in the palette) stay app-side
 * because they are JSX — the package must not depend on react. This file
 * re-exports the pure surface so every existing `from './nodes/shapes'`
 * import (Shape, asShape, SHAPES, shapeFrameSvg …) is unchanged. */
export * from '../../packages/gobi/src/model/nodes/shapes.ts';
import type {Shape} from '../../packages/gobi/src/model/nodes/shapes.ts';
import {shapeFrameMarkup} from '../../packages/gobi/src/model/nodes/shapes.ts';
import type {ReactNode} from 'react';

export function ShapeFrame({shape, plain}: {shape: Shape; plain?: boolean}) {
  const inner = shapeFrameMarkup(shape, 'var(--nc, var(--border-strong))', plain !== false);
  /* ROUND BE (2026-10-23) — the connector is the ONE shape whose silhouette is
     round, so its frame is square: a circle drawn in the 2:1 frame and
     stretched into a 145-tall node paints as a tall ellipse, which is worse
     than the margins it replaces. SQUARE FRAME + SQUARE NODE (the palette's
     CONNECTOR_NODE_SIZE) keeps it a true circle and lets the paint reach the
     frame — grips on the circle (Harvey: the corner grips floated far from
     it). The <svg> is width/height 100% of the node either way; only the
     internal coordinate system differs. */
  const vb = shape === 'connector' ? '0 0 100 100' : '0 0 200 100';
  return (
    <svg className={`shape-frame ${shape}`} viewBox={vb} preserveAspectRatio="none"
      dangerouslySetInnerHTML={{__html: inner}} />
  );
}

/** Tiny palette preview of a shape, 26×18 CSS pixels. */
export function ShapePreview({shape, color}: {shape: Shape; color: string}) {
  const s = {stroke: color, fill: 'none', strokeWidth: 1.4, strokeLinejoin: 'round' as const};
  const wrap = (children: ReactNode, cls: string) => (
    <svg className={`shape-preview ${cls}`} viewBox="0 0 26 18" width="26" height="18">{children}</svg>
  );
  const line = (d: string, w = 1.1, o = 0.85) =>
    <path d={d} fill="none" stroke={color} strokeWidth={w} opacity={o} />;
  switch (shape) {
    case 'service':
      return wrap(<rect x="1" y="2" width="24" height="14" rx="4" {...s} />, 'service');
    case 'external':
      return wrap(<rect x="1" y="2" width="24" height="14" rx="4" strokeDasharray="3 2" {...s} />, 'external');
    case 'database':
      /* AQ10b — the preview matches the Minimal default (no inner arc). */
      return wrap(<>
        <ellipse cx="13" cy="4.6" rx="11.5" ry="3.4" {...s} />
        <path d="M1.5 4.6 V13.4 A 11.5 3.4 0 0 0 24.5 13.4 V4.6" {...s} />
      </>, 'database');
    case 'queue':
      return wrap(<>
        <rect x="1" y="2" width="24" height="14" rx="3.5" {...s} />
        <path d="M6 7 H21 M6 11 H21" fill="none" stroke={color} strokeWidth="1.1" strokeLinecap="round" opacity=".8" />
        <circle cx="4" cy="7" r="1.2" fill={color} opacity=".85" />
        <circle cx="4" cy="11" r="1.2" fill={color} opacity=".85" />
      </>, 'queue');
    case 'actor':
      return wrap(<>
        <rect x="1" y="2" width="24" height="14" rx="4" {...s} />
        <circle cx="7" cy="8" r="2.6" fill="none" stroke={color} strokeWidth="1.3" />
        <path d="M3.4 14.6 C 3.4 11.8 5.2 10.8 7 10.8 C 8.8 10.8 10.6 11.8 10.6 14.6" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      </>, 'actor');
    case 'storage':
      return wrap(<>
        <path d="M1 5 H25 V13.5 A 12 3.8 0 0 0 1 13.5 Z" {...s} />
        <rect x="1" y="1.5" width="24" height="3.6" rx="1.8" {...s} />
      </>, 'storage');
    case 'gateway':
      return wrap(<path d="M6 1.5 H20 L25 9 L20 16.5 H6 L1 9 Z" {...s} />, 'gateway');
    case 'group':
      return wrap(<rect x="1" y="2" width="24" height="14" rx="3" strokeDasharray="4 3" {...s} />, 'group');
    case 'note':
      return wrap(<path d="M19 2 H2 V16 H19 L24 9 Z" {...s} />, 'note');

    /* ---------------- L3a previews ---------------- */
    case 'terminator':
      return wrap(<rect x="1" y="4" width="24" height="10" rx="5" {...s} />, 'terminator');
    case 'process':
      return wrap(<rect x="1" y="3" width="24" height="12" rx="1" {...s} />, 'process');
    case 'decision':
      return wrap(<path d="M13 1.5 L25 9 L13 16.5 L1 9 Z" {...s} />, 'decision');
    case 'io':
      return wrap(<path d="M5 3 H25 L21 15 H1 Z" {...s} />, 'io');
    case 'document':
      return wrap(<>
        <path d="M1 3 H25 V12 C 21 15 17 10 13 12.5 S 5 15 1 12 Z" {...s} />
      </>, 'document');
    case 'subprocess':
      return wrap(<>
        <rect x="1" y="3" width="24" height="12" rx="1" {...s} />
        {line('M5 3 V15 M21 3 V15')}
      </>, 'subprocess');
    case 'preparation':
      return wrap(<path d="M7 1.5 H19 L25 9 L19 16.5 H7 L1 9 Z" {...s} />, 'preparation');
    case 'manual':
      return wrap(<path d="M1 4 H25 L21 14 H5 Z" {...s} />, 'manual');
    case 'delay':
      /* The mini glyph must match ShapeFrame's own fix: the arc has to land on
         the right edge of the 26×18 viewBox, not stop short of it (see the
         ShapeFrame `delay` case for the measurement). */
      return wrap(<path d="M1 3 H18 A 6 6 0 0 1 18 15 H1 Z" {...s} />, 'delay');
    case 'connector':
      /* ROUND BE (2026-10-23) — a true circle filling the 26x18 preview frame
         (was r=5.6 in a 26x18 box: visible side margins). The preview frame
         is 2:1 so a frame-filling circle is an ellipse here — matching the
         canvas node, whose silhouette is also wider than tall relative to
         the glyph cell. Both sites now paint to their frame (skill law 2). */
      return wrap(<ellipse cx="13" cy="9" rx="12.5" ry="8.5" {...s} />, 'connector');

    /* ---------------- ROUND AD previews (26x18) ---------------- */
    case 'offpage':
      return wrap(<path d="M1 2 H25 V11 L13 16.5 L1 11 Z" {...s} />, 'offpage');
    case 'manualinput':
      return wrap(<path d="M1 6 L25 1.5 V15 H1 Z" {...s} />, 'manualinput');
    case 'display':
      return wrap(<path d="M1 2 H15 A 9 6.5 0 0 1 15 16 H1 Z" {...s} />, 'display');
    case 'storeddata':
      /* AQ10b — preview matches the Minimal default (no inner arc). */
      return wrap(<>
        <ellipse cx="13" cy="4.6" rx="11.5" ry="3.4" {...s} />
        <path d="M1.5 4.6 V13 A 11.5 3.4 0 0 0 24.5 13 V4.6" {...s} />
      </>, 'storeddata');

    /* ---------------- PACKAGE-SEQ previews (26x18) ---------------- */
    case 'lifeline':
      return wrap(<>
        <rect x="3" y="1.5" width="20" height="6" rx="2" {...s} />
        <path d="M13 7.5 V16.5" strokeDasharray="2.5 2" {...s} strokeWidth={1.2} />
      </>, 'lifeline');
    case 'activation':
      return wrap(<rect x="10.5" y="1.5" width="5" height="15" rx="1.6" {...s} />, 'activation');
    case 'fragment':
      return wrap(<>
        <rect x="1" y="1.5" width="24" height="15" {...s} />
        <path d="M1 1.5 H8 L11.5 6 H1 Z" {...s} strokeWidth={1.1} />
      </>, 'fragment');
    case 'looplimit':
      return wrap(<path d="M5 2 H21 L25 4.5 V15 H1 V4.5 Z" {...s} />, 'looplimit');
    case 'internalstorage':
      return wrap(<>
        <rect x="1" y="3" width="24" height="12" rx="1" {...s} />
        {line('M5 3 V15 M1 6.5 H5')}
      </>, 'internalstorage');
  }
}
