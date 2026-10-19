/* Architectural shapes — one generic component per conventional diagram notation.
   Every shape is geometry only (no use-case text baked in); colour comes from the
   node's --nc custom property, so the colour swatches drive the shape outline,
   icon, metric and glow for all shapes.

   Frames use a normalised viewBox (0 0 200 100) with preserveAspectRatio="none"
   and non-scaling strokes, so they scale with any node size.

   L3a: the ISO 5807 flowchart set joins the architecture set here. One `Shape`
   union, one `ShapeFrame`, one `ShapePreview` — presets select a subset for
   their palette, they never fork the shape component. */

export type Shape =
  /* architecture */
  | 'service' | 'database' | 'queue' | 'external' | 'actor' | 'storage' | 'gateway' | 'group' | 'note'
  /* L3a — ISO 5807 flowchart */
  | 'terminator' | 'process' | 'decision' | 'io' | 'document' | 'subprocess'
  | 'manual' | 'delay' | 'connector' | 'preparation'
  /* ROUND AD — the six "every tool ships this" additions Harvey approved. */
  | 'offpage' | 'manualinput' | 'display' | 'storeddata' | 'looplimit' | 'internalstorage'
  /* PACKAGE-SEQ — UML sequence. The lifeline is a STRETCHABLE node: the head
     box carries the participant name; the dashed stem is drawn inside the same
     frame, so stretching the node downward lengthens the lifeline. Activation
     is the thin bar; fragment is the combined-fragment frame (alt/opt/loop/…
     named in the node's sub line). */
  | 'lifeline' | 'activation' | 'fragment';

/* ITEM 4 (2026-09-17) — EVERY `hint` IS A GLANCEABLE SECONDARY LINE.

   Harvey: "ở các hình shape chữ description nhìn hơi dài, có thể nào gọn nhẹ hơn
   ko" — the shape descriptions read too long, make them lighter.

   RULES APPLIED TO EVERY ROW:
     1. Never repeat the LABEL inside the hint. The row already renders
        `{label}` on its first line and `{hint}` beneath it, so a hint that
        restates the label spends a line saying nothing. Measured before this
        pass: `storage` ("bucket · object storage") and `preparation`
        ("Preparation · Initialization · hexagon · setup / init") both did it.
     2. Keep the GEOMETRY cue only where the silhouette is the useful part of
        the name — "dashed rect" earns its place because "External" does not say
        a rectangle is coming; "hexagon" earns it for Gateway. Drop it where the
        label is self-describing.
     3. Keep the SEMANTIC cue, because that is what actually disambiguates two
        shapes that look different but mean similar things (io "data in / out"
        vs process "action step").
     4. ≤ ~22 chars where the meaning survives. The five longest rows went from
        33–53 chars down to 14–22.
     5. NO TWO HINTS MAY COLLIDE. All 19 are distinct — asserted by
        `checks/package-o-metrics.mjs`, which reads this table.

   These strings are shared: the palette ROW (`renderPaletteRow` in App.tsx), the
   shape-inspector `<select>` (`{s.label} — {s.hint}`) and the library search
   haystack all read them, so all four surfaces tightened together with no second
   edit. The `LIBRARY`-side hints in `presets.ts` are a SEPARATE table and were
   tightened in the same pass. */
export const SHAPES: {id: Shape; label: string; hint: string}[] = [
  {id: 'service', label: 'Service', hint: 'rounded rect · app'},
  {id: 'database', label: 'Database', hint: 'cylinder · datastore'},
  {id: 'queue', label: 'Queue', hint: 'rows + items · bus'},
  {id: 'external', label: 'External', hint: 'dashed rect · 3rd party'},
  {id: 'actor', label: 'Actor', hint: 'rect + person · user'},
  {id: 'storage', label: 'Storage', hint: 'bucket · objects'},
  {id: 'gateway', label: 'Gateway', hint: 'hexagon · api / lb'},
  {id: 'group', label: 'Group', hint: 'dashed boundary'},
  {id: 'note', label: 'Note', hint: 'plain text'},
  {id: 'terminator', label: 'Terminal', hint: 'stadium · start / end'},
  {id: 'process', label: 'Process', hint: 'rect · action step'},
  {id: 'decision', label: 'Decision', hint: 'diamond · yes / no'},
  {id: 'io', label: 'Input / Output', hint: 'parallelogram · data'},
  {id: 'document', label: 'Document', hint: 'wavy base · in or out'},
  {id: 'subprocess', label: 'Predefined process', hint: 'double-bar rect'},
  {id: 'preparation', label: 'Preparation', hint: 'hexagon · setup'},
  {id: 'manual', label: 'Manual operation', hint: 'trapezoid · by hand'},
  {id: 'delay', label: 'Delay', hint: 'D-shape · wait'},
  {id: 'connector', label: 'On-page connector', hint: 'circle · jump'},
  /* ROUND AD — draw.io's own template labels, verbatim, for the six additions. */
  {id: 'offpage', label: 'Off-page connector', hint: 'home plate · another page'},
  {id: 'manualinput', label: 'Manual input', hint: 'sloped top · by keyboard'},
  {id: 'display', label: 'Display', hint: 'curved trapezoid · show data'},
  {id: 'storeddata', label: 'Stored data', hint: 'cylinder · read / write'},
  {id: 'looplimit', label: 'Loop limit', hint: 'notched top · loop start'},
  {id: 'internalstorage', label: 'Internal storage', hint: 'pane rect · in-memory'},
  /* PACKAGE-SEQ — UML sequence trio. Hints follow the SAME rules as above:
     geometry cue + semantic cue, ≤22 chars, no label repetition, no collisions
     (package-o-metrics asserts distinctness across the whole table). */
  {id: 'lifeline', label: 'Lifeline', hint: 'head + dashed stem'},
  {id: 'activation', label: 'Activation', hint: 'thin bar · processing'},
  {id: 'fragment', label: 'Fragment', hint: 'frame · alt / loop'},
];

export const SHAPE_IDS: Shape[] = SHAPES.map(s => s.id);

/** Shapes a flowchart preset offers as its own vocabulary (the 9 ISO additions
 *  plus `preparation`, which adapts the existing `gateway` hexagon geometry),
 *  plus ROUND AD's six "every tool ships this" additions. */
export const FLOWCHART_EXTRA_SHAPES: Shape[] =
  ['terminator', 'process', 'decision', 'io', 'document', 'subprocess', 'manual', 'delay', 'connector', 'preparation',
   'offpage', 'manualinput', 'display', 'storeddata', 'looplimit', 'internalstorage'];

export function asShape(v: unknown): Shape {
  return typeof v === 'string' && (SHAPE_IDS as string[]).includes(v) ? (v as Shape) : 'service';
}

const FILL = 'color-mix(in srgb, var(--nc, var(--border-strong)) 9%, transparent)';

/* ROUND AR, AR-1 — THE SHAPE GEOMETRY, AS DATA.
 *
 * Every case below is the SAME drawing its React sibling renders, expressed as
 * inner markup in the normalised 200×100 frame. `ShapeFrame` consumes this
 * table through `shapeFrameMarkup` (below), so the exporter (src/exportSvg.ts)
 * and the canvas share ONE source — the file's own "never a second copy free
 * to drift" rule, now enforced rather than aspirational.
 *
 * `p` = the outline primitive's attributes (resolved fill/stroke, NOT var()
 * references — the exporter writes literal values); `line` = inner detail
 * strokes; `plain` drops the cylinder's inner arcs exactly as the React
 * `plainCylinder` flag does. */

type FramePaint = {
  fill: string; stroke: string; strokeWidth?: number;
  fillOpacity?: string; dash?: string; plain?: boolean;
};

function frameMarkup(shape: Shape, p: FramePaint): string {
  const sw = p.strokeWidth ?? 1.5;
  const a = `fill="${p.fill}"${p.fillOpacity ? ` fill-opacity="${p.fillOpacity}"` : ''} stroke="${p.stroke}" stroke-width="${sw}" stroke-linejoin="round"`;
  const line = `fill="none" stroke="${p.stroke}" stroke-width="${sw}"`;
  const accent = p.stroke;
  switch (shape) {
    case 'service':
      return `<rect x="1" y="1" width="198" height="98" rx="14" ${a}/>`;
    case 'external':
      return `<rect x="1" y="1" width="198" height="98" rx="14" stroke-dasharray="8 5" ${a}/>`;
    /* ROUND AD / HARVEY 2026-10-14 — ONE cylinder drawing for `database` and
       `storeddata`; `plain` drops the two inner arcs (see ShapeFrame). */
    case 'database':
    case 'storeddata': {
      const rings = p.plain === false
        ? `<path d="M4 42 A 96 15 0 0 0 196 42" ${line} opacity="0.5"/><path d="M4 60 A 96 15 0 0 0 196 60" ${line} opacity="0.3"/>`
        : '';
      return `<ellipse cx="100" cy="20" rx="96" ry="15" ${a}/><path d="M4 20 V80 A 96 15 0 0 0 196 80 V20" ${a}/>${rings}`;
    }
    case 'queue':
      return `<rect x="1" y="1" width="198" height="98" rx="14" ${a}/>` +
        `<path d="M62 10 V90" ${line} opacity="0.35"/>` +
        `<path d="M28 26 H50" ${line} stroke-linecap="round" opacity="0.7"/>` +
        `<path d="M28 50 H50" ${line} stroke-linecap="round" opacity="0.7"/>` +
        `<path d="M28 74 H50" ${line} stroke-linecap="round" opacity="0.7"/>` +
        `<circle cx="16" cy="26" r="4.5" fill="${accent}" opacity="0.9"/>` +
        `<circle cx="16" cy="50" r="4.5" fill="${accent}" opacity="0.9"/>` +
        `<circle cx="16" cy="74" r="4.5" fill="${accent}" opacity="0.9"/>`;
    case 'actor':
      return `<rect x="1" y="1" width="198" height="98" rx="14" ${a}/>` +
        `<circle cx="36" cy="42" r="13" fill="none" stroke="${accent}" stroke-width="2.4"/>` +
        `<path d="M14 84 C 14 66 24 59 36 59 C 48 59 58 66 58 84" fill="none" stroke="${accent}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'storage':
      return `<path d="M1 18 H199 V 76 A 99 23 0 0 0 1 76 Z" ${a}/>` +
        `<rect x="1" y="2" width="198" height="19" rx="9.5" ${a}/>`;
    case 'gateway':
      return `<path d="M34 1 H166 L199 50 L166 99 H34 L1 50 Z" ${a}/>`;
    case 'terminator':
      return `<rect x="1" y="1" width="198" height="98" rx="49" ${a}/>`;
    case 'process':
      return `<rect x="1" y="1" width="198" height="98" rx="2" ${a}/>`;
    case 'decision':
      return `<path d="M100 2 L198 50 L100 98 L2 50 Z" ${a}/>`;
    case 'io':
      return `<path d="M36 2 H198 L164 98 H2 Z" ${a}/>`;
    case 'document':
      return `<path d="M1 1 H199 V78 C 175 96 155 68 131 80 S 91 96 67 78 S 27 62 1 78 Z" ${a}/>`;
    case 'subprocess':
      return `<rect x="1" y="1" width="198" height="98" rx="2" ${a}/>` +
        `<path d="M26 2 V98" ${line}/><path d="M174 2 V98" ${line}/>`;
    case 'preparation':
      return `<path d="M46 2 H154 L198 50 L154 98 H46 L2 50 Z" ${a}/>`;
    case 'manual':
      return `<path d="M2 2 H198 L164 98 H36 Z" ${a}/>`;
    case 'delay':
      return `<path d="M2 2 H122 A 78 48 0 0 1 122 98 H2 Z" ${a}/>`;
    case 'connector':
      return `<circle cx="100" cy="50" r="48" ${a}/>`;
    case 'offpage':
      return `<path d="M2 2 H198 V66 L100 98 L2 66 Z" ${a}/>`;
    case 'manualinput':
      return `<path d="M2 30 L198 2 V98 H2 Z" ${a}/>`;
    case 'display':
      return `<path d="M2 2 H120 A 78 48 0 0 1 120 98 H2 Z" ${a}/>`;
    case 'looplimit':
      return `<path d="M36 2 H164 L198 24 V98 H2 V24 Z" ${a}/>`;
    case 'internalstorage':
      return `<rect x="1" y="1" width="198" height="98" rx="2" ${a}/>` +
        `<path d="M26 2 V98" ${line}/><path d="M2 26 H26" ${line}/>`;
    case 'lifeline':
      return `<rect x="1" y="1" width="198" height="30" rx="6" ${a}/>` +
        `<path d="M100 31 V98" ${line} stroke-dasharray="6 5"/>`;
    case 'activation':
      return `<rect x="88" y="1" width="24" height="98" rx="4" ${a}/>`;
    case 'fragment':
      return `<rect x="1" y="1" width="198" height="98" ${a}/>` +
        `<path d="M1 1 H66 L82 17 V1" ${line}/><path d="M1 1 H66 L82 18 H1 Z" ${a}/>`;
    default:
      return '';
  }
}

/** The exporter's entry point: resolved paint values in, inner markup out.
 *  Emitted inside a viewBox="0 0 200 100" wrapper by the caller. */
export function shapeFrameSvg(shape: Shape, paint: FramePaint): string {
  return frameMarkup(shape, paint);
}

/** The live render path: the SAME table, wrapped in the frame svg the canvas
 *  has always mounted. `nc` is the resolved `--nc` colour; `plain` matches the
 *  `plainCylinder` flag's semantics (undefined = plain, per AQ10). */
export function shapeFrameMarkup(shape: Shape, nc: string, plain: boolean): string {
  return frameMarkup(shape, {
    fill: 'transparent', stroke: nc,
    fillOpacity: '0.09', plain,
  });
}

/** SVG frame drawn behind the node content. Not used by group / note.
 *  ROUND AR — renders `shapeFrameMarkup`, the SAME table the exporter emits:
 *  the visual output is unchanged (fill + stroke from the node's `--nc` var,
 *  non-scaling stroke), but there is no second copy of the geometry left to
 *  drift.
 *  XSS note: the injected markup is 100% generated by `frameMarkup` above —
 *  static path/rect attribute strings with NO user data interpolated (node
 *  titles etc. never reach it) — so the trusted-input surface is empty and
 *  `dangerouslySetInnerHTML` is safe here. */
export function ShapeFrame({shape, plain}: {shape: Shape; plain?: boolean}) {
  const inner = shapeFrameMarkup(shape, 'var(--nc, var(--border-strong))', plain !== false);
  return (
    <svg className={`shape-frame ${shape}`} viewBox="0 0 200 100" preserveAspectRatio="none"
      dangerouslySetInnerHTML={{__html: inner}} />
  );
}

/** Tiny palette preview of a shape, 26×18 CSS pixels. */
export function ShapePreview({shape, color}: {shape: Shape; color: string}) {
  const s = {stroke: color, fill: 'none', strokeWidth: 1.4, strokeLinejoin: 'round' as const};
  const wrap = (children: React.ReactNode, cls: string) => (
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
      return wrap(<circle cx="13" cy="9" r="5.6" {...s} />, 'connector');

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
