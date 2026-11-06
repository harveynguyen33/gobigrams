/* CORE-STEP4A-FIX (2026-11-05) — the node DATA vocabulary, extracted from the
 * React component files it used to live in (DiagramNode.tsx / LabelNode.tsx /
 * TableNode.tsx / Crowfoot.tsx). The package's palette + presets need these
 * shapes (a palette item's `make()` returns one), and the package must not
 * import app component files — so the TYPES moved here and the components
 * import them back through the app-side shims. The definitions are verbatim
 * moves; the components re-export them so every existing importer
 * (`import {type NodeKind} from './nodes/DiagramNode'`) is unchanged. */

import type {ColorKey} from './colors';
import type {TextStyle} from './textStyle';

/** L3a: handle orientation. A flowchart reads top-to-bottom, and a diamond with
 *  only left/right ports physically cannot express "Yes ↓ / No →". */
export type HandleMode = 'lr' | 'tb';

/** Card-node data (the `goblin` node kind). */
export type NodeKind = {
  kicker: string;
  title: string;
  sub?: string;
  metric?: string;
  metricUnit?: string;
  /** kebab-case lucide icon name ("server") or a raw unicode glyph ("◆"). */
  icon?: string;
  /** Symbolic accent key — resolved per theme at render time (L1). */
  colorKey?: ColorKey;
  /** Literal user-typed hex (the "custom…" escape hatch). Keys win. */
  color?: string;
  /** Architectural shape — generic notation, not a use case. */
  shape?: string;
  /** ROUND ROTATE — geometry rotation in degrees, normalised (-180, 180].
   *  OPTIONAL: absent = 0, and boards from before this round render
   *  byte-identically (no migration needed — see boardMigrations.ts).
   *  The K5 post-it tilt is NOT stored here; paintRotation adds it. */
  rotation?: number;
  /** ROUND ROTATE — App's gesture writer, threaded per-node (selected only). */
  __rotate?: (id: string, phase: 'start' | 'delta' | 'end' | 'cancel', delta: number) => void;
  /** GROUP-ROTATE — App injects this ONLY on the sole selected node (the
   *  per-node grip is guarded to a single selection; multi gets the shared
   *  GroupRotateGrip at App level instead). */
  __rotateSel?: boolean;
  /** L3a: 'tb' renders Top(target)/Bottom(source) ports instead of Left/Right. */
  handles?: HandleMode;
  /** L3a: 'label-only' renders one centered sentence, no kicker/sub/metric. */
  body?: 'card' | 'label-only';
  /** L3b: C4 element type — drives kicker/colour on the preset palette. */
  c4Type?: string;
  /** L3b: C4 relationship technology, rendered dim after the edge label. */
  techn?: string;
  /** PACKAGE-P §E.2 — the Text section's stored style. OPTIONAL and every field
   *  optional: a board that predates the section has none, and `textStyleVars`
   *  returns `{}` for it, so such a node renders byte-for-byte as it always
   *  did. Nothing here is a size in px — see textStyle.ts for why `size`
   *  is a SCALE. */
  textStyle?: TextStyle;
  /** HARVEY 2026-10-14 — drop the two inner arcs on a cylinder (database /
      storeddata), leaving a bare drum. OPTIONAL: absent keeps the arcs, so a
      board from before this field renders byte-identically. */
  plainCylinder?: boolean;
  /** AQ15 — auto-grow: called once fonts/measure settle if the body clips;
      App grows the node's height (the same write a manual resize performs). */
  __onGrow?: (id: string, height: number, width?: number) => void;
};

/** Free-text annotation node data. No handles, no chrome. */
export type LabelKind = {
  text: string;
  /** ROUND S — injected per-node by App's `rfNodes` memo, exactly like the
   *  edge label's `onCommitLabel` in `rfEdges`. Props do NOT reach inside a
   *  custom node component, so a callback has to travel through `data`. */
  onCommitText?: (id: string, v: string) => void;
  /** ROUND S — review mode, threaded through `data` for the same reason (the
   *  read-only flag had to reach the edge renderer this way too — fix L). */
  readOnly?: boolean;
  /** ROUND ROTATE — geometry rotation (absent = 0) + App's grip writer. */
  rotation?: number;
  __rotate?: (id: string, phase: 'start' | 'delta' | 'end' | 'cancel', delta: number) => void;
  /** GROUP-ROTATE — App injects this ONLY on the sole selected node. */
  __rotateSel?: boolean;
  /** PACKAGE-P §E.3(b) — the Text section's stored style, same shape and same
   *  lazy-write discipline as the goblin kind. Absent on every board written
   *  before PACKAGE-P, and an absent one renders exactly as today. */
  textStyle?: TextStyle;
};

/** ERD table column. */
export type TableColumn = {
  id: string;
  name: string;
  type: string;
  pk?: boolean;
  fk?: boolean;
  notNull?: boolean;
  unique?: boolean;
};

/** Liam ERD's `showMode` — the cheapest large-schema lever. */
export type ShowMode = 'ALL_FIELDS' | 'TABLE_NAME' | 'KEY_ONLY';

/** ERD table-node data (the `table` node kind). */
export type TableKind = {
  /** Table name (schema-qualified shown when `schema` is set). */
  name: string;
  schema?: string;
  columns: TableColumn[];
  /** Symbolic accent key (L1) — resolved per theme. */
  colorKey?: ColorKey;
  /** Literal user-typed hex escape hatch. */
  color?: string;
  /** Column list collapsed to the header only. */
  collapsed?: boolean;
  /** injected by App: the board's ERD show-mode */
  __showMode?: ShowMode;
  /** injected by App: called with the new collapsed flag */
  __onToggle?: (id: string, collapsed: boolean) => void;
  /** ROUND ROTATE — geometry rotation (absent = 0) + App's grip writer. */
  rotation?: number;
  __rotate?: (id: string, phase: 'start' | 'delta' | 'end' | 'cancel', delta: number) => void;
  /** GROUP-ROTATE — App injects this ONLY on the sole selected node. */
  __rotateSel?: boolean;
  /** injected by App: called when a column is clicked (inspector focus) */
  __onPickColumn?: (id: string, col: TableColumn) => void;
};

/** Crow's-foot cardinality end (L3c). */
export type CrowFoot = 'one' | 'many' | 'zeroOrOne' | 'zeroOrMany';
