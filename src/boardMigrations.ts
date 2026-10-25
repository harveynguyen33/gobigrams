/* boardMigrations.ts — ROUND BN, ITEM 2: the migration-on-read cluster moved out
 *  of App.tsx verbatim (L1 legacy-hex, the 4-point EDGE_HANDLE_REMAP, the orphan
 *  `animated` fold, flow:'event' folding, label folding, __editAt folding, and
 *  the B1 end re-aim). Behaviour-neutral: the code is byte-identical; only the
 *  `export` keywords and this file's imports are new.  (feature-map home: src/src/boardMigrations.ts)
 */
import type {Edge, Node} from '@xyflow/react';
import {type BoardDoc} from './boards';
import {COLOR_VAR, isColorKey, keyForHex, type ColorKey} from './colors';
import {asPreset, makeEdge} from './presets';
import {FLOW_ICON_PATHS} from './flowIcons';

/* ---------------------------------------------------------------------------
   L1 — legacy-hex migration.

   Boards saved before the symbolic-colour refactor carry literal hex in
   `data.color`, `style.stroke` and `markerEnd.color`. Map the six known
   accents back onto keys (leaving genuinely custom hexes alone) so a theme can
   recolour an existing board without touching its content.
--------------------------------------------------------------------------- */
export const migrateNode = (n: Node): Node => {
  const d = (n.data ?? {}) as any;
  const key = d.colorKey ?? keyForHex(d.color);
  if (!key) return n;
  const {color, ...rest} = d;
  return {...n, data: {...rest, ...(key ? {colorKey: key} : null)}};
};

/** G — the 4-point scheme removed the four CORNER handle ids. A board that
 *  still stores one in `sourceHandle` / `targetHandle` would otherwise fall
 *  back to React Flow's `bounds[0]` and re-aim silently, so each corner maps
 *  onto the NEAREST surviving side: the left half to `left`, the right half to
 *  `right`. Only the four removed ids are keys here — the four survivors and
 *  the ERD ids (`right_rel_o_id` / `left_rel_i_order`) are not, so they come
 *  back unchanged and the ERD guard below still returns early. */
export const EDGE_HANDLE_REMAP: Record<string, string> = {
  'top-left': 'left',
  'bottom-left': 'left',
  'top-right': 'right',
  'bottom-right': 'right',
};

export const remapEdgeHandle = (id: string | null | undefined): string | null | undefined =>
  id == null ? id : (EDGE_HANDLE_REMAP[id] ?? id);

/* ROUND AK, AK-4 — THE ORPHAN `animated` FLAG, MIGRATED ON READ.

   The `animated (dash on the line)` toggle was DELETED from the edge panel: it
   was a `field` sitting OUTSIDE every section (no `secBody` wrapper, directly
   under Flow Animation) that rendered the SAME marching-dash effect as
   `flow: 'dash'` — two controls, one effect. The React Flow side of it is
   `.react-flow__edge.animated path { stroke-dasharray: 5; animation: dashdraw … }`
   (`@xyflow/react/dist/style.css:162`); ours is `.edge-flow-dash`
   (`styles.css:2356`). `flow: 'dash'` is kept; the flag is not.

   NOTHING PERSISTED IT AS TRUE, MEASURED: every edge in `boards/` carries
   `"animated": false` (11 of them, 0 true) — the field only ever wrote `false`
   because `makeEdge` (`src/presets.ts:177`) hard-codes `animated: false` and the
   toggle was the only writer. But the read is still MAPPED rather than dropped,
   so an older board that did set it keeps the look the user chose: `animated:
   true` on an edge with no `flow` becomes `flow: 'dash'`, which is the same
   marching dash. An edge that already names a `flow` keeps its own value — the
   flag must never overwrite a deliberate choice. The `animated` KEY is left in
   place on the object (unknown to `Edge`, harmless in JSON) exactly as
   `src/presets.ts` still writes it, so nothing is rewritten on the board. */
export const migrateEdge = (e: Edge): Edge => {
  // G: the handle remap runs FIRST, and the colour migration below works on
  // its result, so an edge with no legacy hex (the `!key` early return) still
  // comes back with its corner ids re-aimed.
  const m: Edge = {
    ...e,
    sourceHandle: remapEdgeHandle(e.sourceHandle),
    targetHandle: remapEdgeHandle(e.targetHandle),
  };
  const d = (m.data ?? {}) as any;
  const key = isColorKey(d.strokeKey)
    ? (d.strokeKey as ColorKey)
    : keyForHex((m.style as any)?.stroke) ?? keyForHex((m.markerEnd as any)?.color);
  /* AK-4: the legacy flag maps onto the surviving option — only when the edge
     has not named a flow of its own. */
  const flowed: Edge = (m.animated && !d.flow)
    ? {...m, data: {...d, flow: 'dash'}}
    : m;
  /* ROUND AK, AK-16 — `flow:'event'` IS FOLDED INTO `flow:'icon'` + `mail`.
     The two options drew the same thing two ways: `event` painted a 16×12
     ENVELOPE and `icon` painted a 24×20 chip carrying `FLOW_ICON_PATHS.mail`,
     which is ITSELF an envelope glyph. Two names, one meaning — exactly the
     "trùng lặp / confuse các option" the owner reported. Folding on READ (never
     rewriting the board) keeps the look for any edge that already stored
     `event`: the mail glyph IS the envelope it used to draw, so the animation
     does not visibly change. MEASURED before folding: no persisted board in
     `boards/` carries `flow:'event'` (11 edges in Harvey's board, only `fb7`
     has a flow at all, and it is `dots`), so this migration is insurance rather
     than a repair. `flowIcon` is left untouched — it is the decoration that
     picks WHICH glyph the chip carries. */
  /* ROUND AR-2 — A LEGACY `data.label` IS FOLDED ONTO THE TOP-LEVEL LABEL.
     Two label storages shipped by accident: mermaid imports wrote
     `data:{label}` while every UI writer (`onCommitLabel`, the `×N`
     parallel badge) writes top-level `label` — the ONLY storage the canvas
     paints (`GoblinEdge`'s `shown`). An edge carrying only `data.label`
     rendered bare on the canvas AND the exporter read `data?.label`, so
     the file invented a label the canvas never showed. Convergence: ONE
     storage (top level), the fold happens HERE on read (the same shape as
     the AK-4/AN-1 folds — never rewriting the board), and the exporter
     reads top level only. MEASURED live on :5200 (board `ar2-probe`,
     before the fix): the top-level label `emits` painted on canvas was
     ABSENT from the export; the `data.label` `reads` painted NOTHING on
     canvas yet exported at 10.5/500 with no family. */
  const foldedDataLabel: Edge = typeof (m.data as Record<string, unknown> | null)?.label === 'string' && (m.data as Record<string, unknown>).label
    ? {...m, label: (m.data as Record<string, unknown>).label as string,
       data: {...(m.data as Record<string, unknown>), label: undefined}}
    : m;
  const folded: Edge = ((foldedDataLabel.data ?? {}) as any).flow === 'event'
    ? {...foldedDataLabel, data: {...((foldedDataLabel.data ?? {}) as any), flow: 'icon', flowIcon: 'mail'}}
    : foldedDataLabel;
  /* ROUND AN, AN-1 — A STORED `__editAt` IS FOLDED AWAY ON READ.
   *
   *  THE KEY IS A TRANSIENT SIGNAL, NOT DOCUMENT STATE (see the SKILL rule on
   *  one-shots), and this project persisted it by accident: the renderer's
   *  create branch read it, `openLabelAt` wrote it, and NOTHING deleted it — so
   *  it rode into the saved document and stayed on every edge it had ever been
   *  set on. MEASURED in the user's own boards: `mub08gfl725d408a.json` carries
   *  4 occurrences, `mub6pfm9aa69a2cb.json` 2 and `mub0ur0w6c5ac3a4.json` 1.
   *  The visible half was "rename a label and it jumps back to the centre";
   *  the persisted half was worse — after a reload EVERY one of those labels
   *  was in the create state, so renaming any of them re-centred it.
   *
   *  FOLDED ON READ, NEVER REWRITTEN ON DISK — the convention `flow:'event'`
   *  above already uses, and the one the SKILL's transient-signal rule requires
   *  ("fix a persisted one at READ time; NEVER rewrite the user's boards"). The
   *  deleted key is the fix: `createAt` in `GoblinEdge` is then undefined on
   *  every loaded board, so a rename takes the edit path and writes no position,
   *  while a genuinely new path double-click still stamps a fresh signal from
   *  `openLabelAt` and still centres the first-created label (AL-4's intent).
   *
   *  PLACED AFTER the flow fold and BEFORE the colour migration's early return,
   *  so an edge with no legacy hex — which exits this function at `if (!key)`
   *  below — is folded too. A tolerant parse that lived past that return would
   *  miss exactly the modern boards that are most likely to carry the key. */
  const unfolded: Edge = (() => {
    const d2 = (foldedDataLabel.data ?? {}) as any;
    if (!('__editAt' in d2)) return foldedDataLabel;
    const {__editAt: _drop, ...rest} = d2;
    return {...foldedDataLabel, data: rest};
  })();
  if (!key) return unfolded;         // a genuine custom hex is left alone
  const md = (unfolded.data ?? {}) as any;
  // The literal is DROPPED, not kept alongside: the key is now the source of
  // truth and the render path resolves it, so a theme change actually recolours
  // the line. (`data.color` on an edge is the custom-hex escape hatch.)
  const style = {...(unfolded.style as any)};
  if (keyForHex(style.stroke)) delete style.stroke;
  const out: Edge = {...unfolded, style, data: {...md, strokeKey: key}};
  // the arrowhead colour must become the token too, otherwise it keeps the
  // legacy hex and a theme switch leaves it stale.
  if ((unfolded.markerEnd as any)?.type && keyForHex((unfolded.markerEnd as any).color)) {
    out.markerEnd = {...(unfolded.markerEnd as any), color: COLOR_VAR[key]};
  }
  if ((unfolded.markerStart as any)?.type && keyForHex((unfolded.markerStart as any).color)) {
    out.markerStart = {...(unfolded.markerStart as any), color: COLOR_VAR[key]};
  }
  return out;
};

/* ---------------------------------------------------------------------------
   B1 — explicit edge endpoints.

   React Flow's getEdgePosition resolves an endpoint through getHandle(bounds,
   handleId), which returns bounds[0] — the FIRST handle in DOM order — whenever
   the stored id is missing. For the goblin node (src/DiagramNode.tsx
   NodeHandles) that first-of-type is the node's own orientation side, so an
   edge stored without ids "means" that side. Now that every handle carries an
   id we write that meaning down, so adding further handles later cannot
   silently re-aim an existing edge.

   The connected NODE's own `data.handles` is the authority (the same rule
   DiagramNode.tsx applies: `d.handles === 'tb' ? 'tb' : 'lr'`); a missing
   field renders `lr`, so it migrates to `lr`. The board preset is NOT consulted.

   B2 — the field is DATA, never UI: the inspector's orientation control is gone
   because all 8 points are exposed at once now, but `data.handles` and the
   HandleMode type stay because this migration is their last reader and stored
   boards still carry the key. Both id pairs it resolves to — right/left and
   bottom/top — are still spelled and positioned exactly as B1 left them, so an
   edge written under B1 lands on the same pixel under B2.
--------------------------------------------------------------------------- */
export const handleSidesOf = (n: Node | undefined): {source: string; target: string} =>
  ((n?.data ?? {}) as any).handles === 'tb'
    ? {source: 'bottom', target: 'top'}
    : {source: 'right', target: 'left'};

/** Fill in an endpoint that was never stored. An endpoint that already carries
 *  an explicit handle id (an ERD relationship: `right_rel_o_id` /
 *  `left_rel_i_order`) is passed through byte-identical. */
export const migrateEdgeEnds = (e: Edge, nodes: Node[]): Edge => {
  if (e.sourceHandle != null && e.targetHandle != null) return e;
  const ends = handleSidesOf(nodes.find(n => n.id === e.source));
  const tEnds = handleSidesOf(nodes.find(n => n.id === e.target));
  return {
    ...e,
    sourceHandle: e.sourceHandle ?? ends.source,
    targetHandle: e.targetHandle ?? tEnds.target,
  };
};

export const migrateDoc = (doc: BoardDoc): BoardDoc => {
  const nodes = (doc.nodes ?? []).map(migrateNode);
  return {
    ...doc,
    preset: asPreset(doc.preset),
    nodes,
    edges: (doc.edges ?? []).map(migrateEdge).map(e => migrateEdgeEnds(e, nodes)),
  };
};
