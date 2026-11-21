/* CORE-STEP2 (SPEC-GOBI-CORE §C) — the CANVAS ADAPTER: GobiDocument →
 * BoardDoc (React-Flow nodes/edges). This is the ONE place in the .gobi
 * pipeline that knows about the canvas: palette item lookup, the node
 * factories (`item.make()`), `makeEdge` + the custom preset's edge
 * defaults, RF sizing fields (width/height/style) and the board identity
 * (id/updatedAt — a SURFACE concern the neutral document deliberately does
 * not carry).
 *
 * The mapping code MOVED here from gobiCompiler.ts (not copied — the
 * compiler no longer imports the factories; two copies is the drift the
 * SPEC-GOBI-CORE exists to prevent). Every door (paste box, Export >
 * Import, `gobi-insert`, the headless renderer) goes through `toBoardDoc`;
 * no door may reach into GobiDocument fields to build RF objects itself.
 *
 * Byte parity is pinned by the corpus: for every fixture,
 * toBoardDoc(compileGobi(src).doc, opts) deep-equals the committed
 * `<name>.board.json` (checks/round-gobi-doc-parity.mjs), so the adapter
 * can never silently reinterpret the document. */

import type {FlowNode, FlowEdge} from './flowTypes';
import {PALETTE, type PaletteItem} from './palette';
import {FLOWCHART_PALETTE} from './presets/flowchart';
import {TABLE_PALETTE_ITEM} from './presets/dataStorage';
import {makeEdge, EDGE_DASH} from './presets/basic';
import {CUSTOM_PRESET} from './presets/index';
import type {BoardDoc} from './boardDoc';
import type {ColorKey} from './colors';
import type {TableColumn} from './nodeData';
import {tableRelEnd} from './relEnd';
import {tableNaturalWidth} from './tableWidth';
import {GOBI_CARD_TOKENS, GOBI_KIND_ITEM, type GobiDocument} from '../gobiTypes';

/** ROUND GOBI-LOCK — kind → palette item is DERIVED from the same registry
 * union gobiTypes builds its vocabulary from (GOBI_KIND_ITEM): the kind word
 * IS the item's Shape id (or `text`/`table` for the two non-shape kinds), and
 * the palette LABEL (the unique key every palette list carries) comes along
 * for the ride. checks/round-gobi-lock.mjs C7 asserts no restatement
 * returns. */
const ITEMS: PaletteItem[] = [...PALETTE, ...FLOWCHART_PALETTE, TABLE_PALETTE_ITEM];

const itemFor = (kind: string): PaletteItem | undefined => {
  const meta = GOBI_KIND_ITEM[kind];
  return meta ? ITEMS.find((p) => p.label === meta.label) : undefined;
};

/* DASHED-EXPORT (t_4a50be14) — the dash vocabulary is EDGE_DASH from
 * presets/basic (the ONE table); the local copy this file kept was deleted so
 * the adapter and makeEdge cannot drift apart. */

export type ToBoardDocOptions = {now?: number; id?: string; style?: unknown; density?: unknown};

/** GobiDocument → the React-Flow board the app inserts. Pure: the same doc
 *  + opts always produce a byte-identical board (the corpus's determinism
 *  proof). Board identity defaults mirror the pre-CORE-STEP2 compiler:
 *  `updatedAt = now`, `id = opts.id ?? gobi-<now>`. */
export function toBoardDoc(doc: GobiDocument, opts: ToBoardDocOptions = {}): BoardDoc {
  const nodes: FlowNode[] = [];
  /* TABLE-HANDLES — every table node's COLUMN LIST (already id-minted below),
     keyed by node id: the edge pass resolves a generic side against the columns
     the node actually renders. Filled in the table branch, so no second walk. */
  const tableCols: Record<string, TableColumn[] | undefined> = {};
  for (const d of doc.nodes) {
    /* table — its own node type (a column list is not a Shape). */
    if (d.kind === 'table') {
      const columns: TableColumn[] = (d.columns ?? []).map((c, i) => ({
        id: `c${i + 1}`, name: c.name, type: c.type,
        ...(c.pk ? {pk: true} : {}), ...(c.fk ? {fk: true} : {}),
        ...(c.notNull ? {notNull: true} : {}), ...(c.unique ? {unique: true} : {}),
        /* UNISURF-S7 — the FK target id (authored ref:<id>); the column id is
           re-minted positionally as before, node ids stay stable. */
        ...(c.ref ? {ref: c.ref} : {}),
      }));
      /* LAYOUT-FOLLOWS-WIDTH — the document's OWN width: the same function the
         compiler laid out with, so React Flow, the edges, the minimap and the
         SVG export read one number. No options → the doc's stored size.
         TABLE-HEIGHT: NO height — a table's wrapper is as tall as its CARD, so the reservation stays in `size`. */
      const tw = opts.style !== undefined || opts.density !== undefined
        ? tableNaturalWidth({columns}, opts.style, opts.density) : d.size.w;
      nodes.push({
        id: d.id, type: 'table', position: {x: d.position.x, y: d.position.y},
        width: tw, style: {width: tw},
        data: {name: d.label, columns, colorKey: (d.color as ColorKey) ?? 'cyan'},
      });
      if (d.parent) (nodes[nodes.length - 1] as {parentId?: string}).parentId = d.parent;
      tableCols[d.id] = columns;
      continue;
    }

    const item = itemFor(d.kind);
    if (!item) continue; // vocabulary guaranteed by the parser; unreachable
    const data = {...item.make()} as Record<string, unknown>;

    /* Author overrides — the smart defaults the LANGUAGE resolved on the doc
       (§1 goal 3). ROUND GOBI-LAYOUT: `sub` is written unconditionally for
       the card kinds (the doc carries it only when authored, so an absent
       sub means the empty string — the author's words are the source of
       truth, never the palette's seeded prose). `kicker`/`icon`/`colorKey`
       overwrite the factory defaults ONLY when the author wrote them. */
    if (item.kind === 'label') {
      data.text = d.label;
    } else {
      data.title = d.label;
      data.sub = d.sub ?? '';
      if (d.kicker) data.kicker = d.kicker;
      if (d.icon) data.icon = d.icon;
      if (d.color) data.colorKey = d.color;
      /* GOBI-TEXT-FIT (R3) — the doc carries the resolved body for the card
         kinds only; presence-driven, exactly the kinds the compiler writes
         it for. */
      if (d.body) data.body = d.body;
    }

    /* ROUND GOBI-TEXT (§2.9) — the resolved text style travels on the doc
       for every non-table kind (align CENTER / vAlign middle are the
       language's own defaults, not the app's per-target ones). */
    if (d.textStyle) data.textStyle = {...d.textStyle};

    const node = {
      id: d.id, type: item.kind, position: {x: d.position.x, y: d.position.y},
      width: d.size.w, height: d.size.h,
      style: {width: d.size.w, height: d.size.h},
      data,
    } as FlowNode;
    if (d.parent) (node as {parentId?: string}).parentId = d.parent;
    nodes.push(node);
  }

  /* ERD-CARDINALITY D4 / TABLE-HANDLES — a `table` renders ONLY per-column
     handles, and their TYPE is fixed: `right_rel_<colId>` is a source,
     `left_rel_<colId>` is a target. The layout's generic side is therefore
     irrelevant on a table (a target-typed handle used as a source is exactly
     the invisible-edge defect). The COLUMN is chosen by meaning by the one
     shared rule (model/relEnd.ts) the stored-board read path uses too; a
     non-table endpoint gets the layout's own side handed straight back. */

  const edges: FlowEdge[] = doc.edges.map((d) => {
    const crow = d.card ?? null;
    const seed = {
      label: d.label ?? undefined,
      techn: d.techn ?? undefined,
      ...(crow ? {crowStart: GOBI_CARD_TOKENS[crow[0]!] as never, crowEnd: GOBI_CARD_TOKENS[crow[1]!] as never} : {}),
      /* the RESOLVED routing — the placement passes' answer, translated for a
         table endpoint into the column handle it actually renders. */
      sourceHandle: tableRelEnd(tableCols[d.from], d.to, true, d.fromHandle),
      targetHandle: tableRelEnd(tableCols[d.to], d.from, false, d.toHandle),
    };
    const edge = makeEdge(d.from, d.to, CUSTOM_PRESET.edges, d.id, seed);
    /* the resolved dash (§2.4: the explicit keyword won over the operator
       on the language side; here it becomes the stroke pattern). */
    const dash = EDGE_DASH[d.dash];
    if (dash) {
      edge.style = {...edge.style, strokeDasharray: dash};
    } else if (edge.style?.strokeDasharray) {
      const {strokeDasharray: _drop, ...rest} = edge.style;
      edge.style = rest;
    }
    /* flow payload patches (EdgeData.flow et al.). */
    const patch = edge.data as Record<string, unknown>;
    if (d.flow) patch.flow = d.flow;
    if (d.flowIcon) patch.flowIcon = d.flowIcon;
    if (d.flowCount !== undefined) patch.flowCount = d.flowCount;
    /* the label-placement pass's pinned offset — the SAME stored pair a
       manual drag writes, so the canvas anchors it through the one path. */
    if (d.labelOffset) {
      patch.labelOffset = d.labelOffset;
      patch.labelPinned = true;
    }
    return edge;
  });

  const now = opts.now ?? Date.now();
  return {
    id: opts.id ?? `gobi-${now}`,
    name: doc.name,
    nodes,
    edges,
    updatedAt: now,
    preset: 'custom',
  };
}
