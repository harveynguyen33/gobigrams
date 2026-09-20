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
  | 'offpage' | 'manualinput' | 'display' | 'storeddata' | 'looplimit' | 'internalstorage';

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

/** SVG frame drawn behind the node content. Not used by group / note. */
export function ShapeFrame({shape}: {shape: Shape}) {
  const p = {
    fill: FILL,
    stroke: 'var(--nc, var(--border-strong))',
    strokeWidth: 1.5,
    vectorEffect: 'non-scaling-stroke' as const,
    strokeLinejoin: 'round' as const,
  };
  /** Inner detail strokes (cylinder rings, queue rows, …) — same colour, no fill. */
  const line = {
    fill: 'none',
    stroke: 'var(--nc, var(--border-strong))',
    strokeWidth: 1.5,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  const wrap = (children: React.ReactNode, cls: string) => (
    <svg className={`shape-frame ${cls}`} viewBox="0 0 200 100" preserveAspectRatio="none">
      {children}
    </svg>
  );
  /* ROUND AD — THE CYLINDER IS ONE DRAWING. `database` and the new `storeddata`
     are the same conventional cylinder (AWS / ArchiMate style: a rounder top
     and two inner bands, so it reads as a store rather than a flat pancake), so
     the markup lives HERE and both cases call it. Redrawing it under the new id
     would have been a second copy free to drift — the brief's "REUSE the path,
     do not redraw". Only the wrapper class differs. */
  const cylinder = (cls: string) => wrap(<>
    <ellipse cx="100" cy="20" rx="96" ry="15" {...p} />
    <path d="M4 20 V80 A 96 15 0 0 0 196 80 V20" {...p} />
    <path d="M4 42 A 96 15 0 0 0 196 42" {...line} opacity={0.5} />
    <path d="M4 60 A 96 15 0 0 0 196 60" {...line} opacity={0.3} />
  </>, cls);
  switch (shape) {
    case 'service':
      return wrap(<rect x="1" y="1" width="198" height="98" rx="14" {...p} />, 'service');
    case 'external':
      return wrap(<rect x="1" y="1" width="198" height="98" rx="14" strokeDasharray="8 5" {...p} />, 'external');
    case 'database':
      return cylinder('database');
    case 'queue':
      // Message queue: a container with an item gutter on the left (dots + short
      // rows) and a divider, leaving the centre free for the title text.
      return wrap(<>
        <rect x="1" y="1" width="198" height="98" rx="14" {...p} />
        <path d="M62 10 V90" {...line} opacity={0.35} />
        <path d="M28 26 H50" {...line} strokeLinecap="round" opacity={0.7} />
        <path d="M28 50 H50" {...line} strokeLinecap="round" opacity={0.7} />
        <path d="M28 74 H50" {...line} strokeLinecap="round" opacity={0.7} />
        <circle cx="16" cy="26" r="4.5" fill="var(--nc, var(--border-strong))" opacity={0.9} />
        <circle cx="16" cy="50" r="4.5" fill="var(--nc, var(--border-strong))" opacity={0.9} />
        <circle cx="16" cy="74" r="4.5" fill="var(--nc, var(--border-strong))" opacity={0.9} />
      </>, 'queue');
    case 'actor':
      return wrap(<>
        <rect x="1" y="1" width="198" height="98" rx="14" {...p} />
        {/* person badge, left side — ArchiMate-style actor notation */}
        <circle cx="36" cy="42" r="13" fill="none" stroke="var(--nc, var(--border-strong))" strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
        <path d="M14 84 C 14 66 24 59 36 59 C 48 59 58 66 58 84" fill="none" stroke="var(--nc, var(--border-strong))" strokeWidth={2.4} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      </>, 'actor');
    case 'storage':
      return wrap(<>
        <path d="M1 18 H199 V 76 A 99 23 0 0 0 1 76 Z" {...p} />
        <rect x="1" y="2" width="198" height="19" rx="9.5" {...p} />
      </>, 'storage');
    case 'gateway':
      return wrap(<>
        <path d="M34 1 H166 L199 50 L166 99 H34 L1 50 Z" {...p} />
      </>, 'gateway');

    /* ---------------- L3a: ISO 5807 flowchart shapes ---------------- */
    case 'terminator':
      // Stadium / pill — start & end of a process.
      return wrap(<rect x="1" y="1" width="198" height="98" rx="49" {...p} />, 'terminator');
    case 'process':
      // Plain rectangle — one processing operation.
      return wrap(<rect x="1" y="1" width="198" height="98" rx="2" {...p} />, 'process');
    case 'decision':
      // Diamond / rhombus — a conditional branch.
      return wrap(<path d="M100 2 L198 50 L100 98 L2 50 Z" {...p} />, 'decision');
    case 'io':
      // Parallelogram leaning right — data input / output.
      return wrap(<path d="M36 2 H198 L164 98 H2 Z" {...p} />, 'io');
    case 'document':
      // Rect with a wavy bottom edge — a report / printed output.
      return wrap(<>
        <path d="M1 1 H199 V78 C 175 96 155 68 131 80 S 91 96 67 78 S 27 62 1 78 Z" {...p} />
      </>, 'document');
    case 'subprocess':
      // Predefined process — rectangle with double vertical bars.
      return wrap(<>
        <rect x="1" y="1" width="198" height="98" rx="2" {...p} />
        <path d="M26 2 V98" {...line} />
        <path d="M174 2 V98" {...line} />
      </>, 'subprocess');
    case 'preparation':
      // ADAPTS the gateway hexagon geometry as its own case (never a second
      // hexagon component) — the meaning differs, the silhouette does not.
      return wrap(<>
        <path d="M46 2 H154 L198 50 L154 98 H46 L2 50 Z" {...p} />
      </>, 'preparation');
    case 'manual':
      // Trapezoid, wide base on top — a step performed by a person.
      return wrap(<path d="M2 2 H198 L164 98 H36 Z" {...p} />, 'manual');
    case 'delay':
      /* D-shape — a waiting period. The only asymmetric shape, so its ports read.
         FIX (2026-09-20): the arc used to be `M2 2 H100 A 48 48 …` — r=48 from
         x=100 puts the rightmost point at x=148 in a 200-wide viewBox, leaving a
         52-unit (26%) empty strip that the selection box, the alignment guides
         and the auto-layout all treated as part of the node. A user reported it
         as "the grip box contains it but it sinks in, not flush". The flat run now
         ends at x=122 so a 78-radius arc lands EXACTLY on 200, the same
         construction `display` below already used. The bulge is identical; only
         the flat part is longer, which is also the truer D-shape. */
      return wrap(<path d="M2 2 H122 A 78 48 0 0 1 122 98 H2 Z" {...p} />, 'delay');
    case 'connector':
      // Small circle — an on-page jump (label it A / B / 1 / 2).
      return wrap(<circle cx="100" cy="50" r="48" {...p} />, 'connector');

    /* ------------- ROUND AD: the six approved additions -------------
       Geometry from draw.io / Lucidchart's own shapes, drawn in THIS frame's
       normalised 200x100 box so they stretch with the node exactly as the rest
       of the set does. */
    case 'offpage':
      // Home plate pointing DOWN — continue on another page / sheet. The
      // deliberate partner of the round `connector` above (an on-page jump).
      return wrap(<path d="M2 2 H198 V66 L100 98 L2 66 Z" {...p} />, 'offpage');
    case 'manualinput':
      // A quadrilateral with a SLOPED TOP edge — data entered by hand. The
      // slope is what tells it apart from `manual` (a trapezoid, sloped on the
      // sides) and from `process` (a plain rect).
      return wrap(<path d="M2 30 L198 2 V98 H2 Z" {...p} />, 'manualinput');
    case 'display':
      // Trapezoid on the left, a curved right edge — show data to a person.
      // The arc is drawn to the frame's own centre line so the curve reads as
      // the shape's end cap rather than a stray bulge.
      return wrap(<path d="M2 2 H120 A 78 48 0 0 1 120 98 H2 Z" {...p} />, 'display');
    case 'storeddata':
      // Read / write store. SAME cylinder as `database` — see `cylinder()` above.
      return cylinder('storeddata');
    case 'looplimit':
      // Rectangle with the top corners CUT — the start of a loop. The cut is
      // what distinguishes it from `process`, and the flat top edge stays wide
      // enough for a label on a node at the resizer floor.
      return wrap(<path d="M36 2 H164 L198 24 V98 H2 V24 Z" {...p} />, 'looplimit');
    case 'internalstorage':
      // Rectangle with a vertical + horizontal pane line — in-memory storage.
      // The two lines divide off a corner pane, the way the notation does.
      return wrap(<>
        <rect x="1" y="1" width="198" height="98" rx="2" {...p} />
        <path d="M26 2 V98" {...line} />
        <path d="M2 26 H26" {...line} />
      </>, 'internalstorage');

    default:
      return null;
  }
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
      return wrap(<>
        <ellipse cx="13" cy="4.6" rx="11.5" ry="3.4" {...s} />
        <path d="M1.5 4.6 V13.4 A 11.5 3.4 0 0 0 24.5 13.4 V4.6" {...s} />
        {line('M1.5 9 A 11.5 3.4 0 0 0 24.5 9', 1, 0.55)}
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
      return wrap(<>
        <ellipse cx="13" cy="4.6" rx="11.5" ry="3.4" {...s} />
        <path d="M1.5 4.6 V13.4 A 11.5 3.4 0 0 0 24.5 13.4 V4.6" {...s} />
        {line('M1.5 9 A 11.5 3.4 0 0 0 24.5 9', 1, 0.55)}
      </>, 'storeddata');
    case 'looplimit':
      return wrap(<path d="M5 2 H21 L25 4.5 V15 H1 V4.5 Z" {...s} />, 'looplimit');
    case 'internalstorage':
      return wrap(<>
        <rect x="1" y="3" width="24" height="12" rx="1" {...s} />
        {line('M5 3 V15 M1 6.5 H5')}
      </>, 'internalstorage');
  }
}
