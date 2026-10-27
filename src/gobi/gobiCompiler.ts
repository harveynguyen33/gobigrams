/* ROUND GOBI-1 — the .gobi compiler (SPEC §3.1): AST → BoardDoc through the
 * REAL palette factories, the REAL layout engine and the REAL edge factory.
 * Nothing restates palette values — every node's defaults come from the same
 * `make()` the panel uses, every edge from the same `makeEdge` the app's
 * connect paths use.
 *
 * Pipeline: BUILD (factories + author overrides, placeholder positions in
 * authored order) → LAYOUT (layoutDiagram on top-level participants; children
 * follow their group) → GROUPS (bottom-up bounding rectangles) → EDGES
 * (makeEdge + payload patches) → EMIT BoardDoc preset:'custom'.
 *
 * Pure: `now` is injectable so golden tests are deterministic; no DOM. */

import type {Node, Edge} from '@xyflow/react';
import {PALETTE, type PaletteItem} from '../palette';
import {FLOWCHART_PALETTE} from '../presets/flowchart';
import {TABLE_PALETTE_ITEM} from '../presets/dataStorage';
import {makeEdge} from '../presets/basic';
import {CUSTOM_PRESET} from '../presets/index';
import {layoutDiagram} from '../layout';
import type {BoardDoc} from '../boards';
import type {ColorKey} from '../colors';
import type {TableColumn} from '../nodes/TableNode';
import {parseGobi} from './gobiParser';
import {validateGobi} from './gobiValidator';
import {
  GOBI_CARD_TOKENS,
  type GobiAst,
  type GobiEdgeStmt,
  type GobiError,
  type GobiNodeStmt,
} from './gobiTypes';

/* ------------------------------------------------------------------ kinds */

/** kind → palette LABEL (the unique key every palette list carries). */
const KIND_LABEL: Record<string, string> = {
  service: 'Service', database: 'Database', queue: 'Queue', external: 'External',
  actor: 'Actor', storage: 'Storage', gateway: 'Gateway', group: 'Group', note: 'Note',
  terminator: 'Terminal', process: 'Process', decision: 'Decision', io: 'Input / Output',
  document: 'Document', subprocess: 'Predefined process', preparation: 'Preparation',
  manual: 'Manual operation', delay: 'Delay', connector: 'On-page connector',
  offpage: 'Off-page connector', manualinput: 'Manual input', display: 'Display',
  storeddata: 'Stored data', looplimit: 'Loop limit', internalstorage: 'Internal storage',
  text: 'Text',
};

/** REAL palette items — PALETTE and FLOWCHART_PALETTE stay UNFILTERED by the
 *  create-surface gates (the flags only gate LIBRARY), so the compiler speaks
 *  the full v1 vocabulary whatever the UI currently offers. */
const ITEMS: PaletteItem[] = [...PALETTE, ...FLOWCHART_PALETTE, TABLE_PALETTE_ITEM];

const itemFor = (kind: string): PaletteItem | undefined =>
  ITEMS.find((p) => p.label === KIND_LABEL[kind]);

/* ------------------------------------------------------------- the result */

export type GobiCompileResult =
  | {ok: true; board: BoardDoc}
  | {ok: false; errors: GobiError[]};

export type GobiCompileOptions = {now?: number; id?: string};

export function compileGobi(text: string, opts: GobiCompileOptions = {}): GobiCompileResult {
  /* 1–3. PARSE + VALIDATE — one pass each, all errors collected. */
  const parsed = parseGobi(text);
  if (!parsed.ok) {
    const bad = parsed as {ok: false; errors: GobiError[]};
    return {ok: false, errors: bad.errors};
  }
  const errors = validateGobi(parsed.ast);
  if (errors.length) return {ok: false, errors};
  const ast = parsed.ast;

  /* 4. BUILD — real factories + author overrides. */
  const {nodes, order} = buildNodes(ast);
  const edges = buildEdges(ast);

  /* placeholder positions: authored order packed at (i·600, 0) so layout's
     island logic has deterministic pre-offsets (§3.1 step 4). */
  nodes.forEach((n, i) => { if (!n.position) n.position = {x: order.indexOf(n.id) * 600, y: 0}; });

  /* 5. LAYOUT — top-level participants only (children follow their group);
     groups WITH members are excluded (their rect is derived in step 5b). */
  const withMembers = new Set<string>();
  for (const s of ast.statements) if (s.kind === 'membership') withMembers.add(s.group);
  const participants = nodes.filter((n) => !n.parentId && !(withMembers.has(n.id) && (n.data as {shape?: string}).shape === 'group'));
  const placed = layoutDiagram(participants, edges as Edge[], {direction: ast.direction, spacing: {x: 70, y: 24}});
  for (const [id, p] of placed) {
    const n = nodes.find((t) => t.id === id);
    if (n) n.position = {x: p.x, y: p.y};
  }

  /* 5b. GROUPS — children first (grid-packed inside the group's origin),
     then bottom-up bounding rectangles (+padding). The C4 template pattern:
     a group is placed by layout, then its members are packed inside. */
  const parentOf = new Map<string, string>();
  for (const s of ast.statements) if (s.kind === 'membership') for (const m of s.members) parentOf.set(m.id, s.group);
  const depth = (id: string): number => {
    let d = 0;
    let cur = parentOf.get(id);
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) { seen.add(cur); d++; cur = parentOf.get(cur); }
    return d;
  };
  const groupsWithMembers = [...new Set([...parentOf.values()])].sort((a, b) => depth(b) - depth(a));
  const PAD = 40;
  const inner = 20; // padding between packed members
  const boxOf = (n: Node) => ({
    x: n.position.x, y: n.position.y,
    w: (n.width as number) ?? (n.style?.width as number) ?? 190,
    h: (n.height as number) ?? (n.style?.height as number) ?? 60,
  });
  for (const g of groupsWithMembers) {
    const gNode = nodes.find((n) => n.id === g);
    if (!gNode) continue;
    const members = nodes.filter((n) => parentOf.get(n.id) === g);
    if (!members.length) continue;
    /* stamp parentId (the board model's ONE parent field) and pack members
       in a grid from the group's own top-left (laid out above, or its
       authored-order placeholder when the group nests inside another). */
    const origin = {x: gNode.position.x + PAD, y: gNode.position.y + PAD};
    const cols = Math.ceil(Math.sqrt(members.length));
    let cx = origin.x, cy = origin.y, rowH = 0;
    for (const m of members) {
      m.parentId = g;
      m.position = {x: cx, y: cy};
      const b = boxOf(m);
      rowH = Math.max(rowH, b.h);
      cx += b.w + inner;
      if ((members.indexOf(m) + 1) % cols === 0) { cx = origin.x; cy += rowH + inner; rowH = 0; }
    }
    const boxes = members.map(boxOf);
    const x0 = Math.min(...boxes.map((b) => b.x)) - PAD;
    const y0 = Math.min(...boxes.map((b) => b.y)) - PAD;
    const x1 = Math.max(...boxes.map((b) => b.x + b.w)) + PAD;
    const y1 = Math.max(...boxes.map((b) => b.y + b.h)) + PAD;
    gNode.position = {x: x0, y: y0};
    gNode.width = x1 - x0;
    gNode.height = y1 - y0;
    gNode.style = {width: x1 - x0, height: y1 - y0};
  }

  /* 7. EMIT — nodes in canvas READING order (y, then x) of their absolute
     positions: deterministic, and it matches the spec §3.2 golden, which
     prints broker(0,0) → orders(260,0) → consumer(520,0) even though the
     group is declared FIRST. Members keep absolute coords for the sort,
     then convert to parent-relative (React Flow's model for parentId). */
  const absPos = new Map<string, {x: number; y: number}>();
  for (const n of nodes) absPos.set(n.id, {x: n.position.x, y: n.position.y});
  nodes.sort((a, b) => {
    const pa = absPos.get(a.id)!, pb = absPos.get(b.id)!;
    return pa.y - pb.y || pa.x - pb.x;
  });
  for (const n of nodes) {
    if (n.parentId) {
      const gp = absPos.get(n.parentId)!;
      n.position = {x: absPos.get(n.id)!.x - gp.x, y: absPos.get(n.id)!.y - gp.y};
    }
  }

  /* 7. EMIT. */
  const now = opts.now ?? Date.now();
  const board: BoardDoc = {
    id: opts.id ?? `gobi-${now}`,
    name: ast.board?.name ?? 'Untitled',
    nodes: nodes as Node[],
    edges: edges as Edge[],
    updatedAt: now,
    preset: 'custom',
  };
  return {ok: true, board};
}

/* ------------------------------------------------------------------ build */

function buildNodes(ast: GobiAst): {nodes: Node[]; order: string[]} {
  const nodes: Node[] = [];
  const order: string[] = [];
  for (const s of ast.statements) {
    if (s.kind !== 'node') continue;
    const stmt = s as GobiNodeStmt;
    order.push(stmt.id);

    /* table — its own node type (a column list is not a Shape). */
    if (stmt.nodeKind === 'table') {
      const columns: TableColumn[] = (stmt.columns ?? []).map((c, i) => ({
        id: `c${i + 1}`, name: c.name, type: c.type,
        ...(c.pk ? {pk: true} : {}), ...(c.fk ? {fk: true} : {}),
        ...(c.notNull ? {notNull: true} : {}), ...(c.unique ? {unique: true} : {}),
      }));
      nodes.push({
        id: stmt.id, type: 'table', position: {x: 0, y: 0},
        width: TABLE_PALETTE_ITEM.size!.width, height: TABLE_PALETTE_ITEM.size!.height,
        style: {width: TABLE_PALETTE_ITEM.size!.width, height: TABLE_PALETTE_ITEM.size!.height},
        data: {name: stmt.title ?? stmt.id, columns, colorKey: (stmt.attrs.color as ColorKey) ?? 'cyan'},
      });
      continue;
    }

    const item = itemFor(stmt.nodeKind);
    if (!item) continue; // vocabulary guaranteed by the parser; unreachable
    const data = {...item.make()} as Record<string, unknown>;

    /* author overrides (smart defaults, explicit overrides — §1 goal 3). */
    if (item.kind === 'label') {
      data.text = stmt.title ?? stmt.id;
    } else {
      data.title = stmt.title ?? stmt.id;
      if (stmt.attrs.sub) data.sub = stmt.attrs.sub;
      if (stmt.attrs.kicker) data.kicker = stmt.attrs.kicker;
      if (stmt.attrs.icon) data.icon = stmt.attrs.icon;
      if (stmt.attrs.color) data.colorKey = stmt.attrs.color;
    }

    /* size: the palette's own size, else the container defaults the app's
       insert path applies (C3), else the layout fallback takes over. */
    const size = item.size
      ?? (stmt.nodeKind === 'group' ? {width: 320, height: 200} : null);
    nodes.push({
      id: stmt.id, type: item.kind, position: {x: 0, y: 0},
      ...(size ? {width: size.width, height: size.height, style: {width: size.width, height: size.height}} : {}),
      data,
    } as Node);
  }
  return {nodes, order};
}

function buildEdges(ast: GobiAst): Edge[] {
  const out: Edge[] = [];
  let n = 0;
  const DASH: Record<string, string | undefined> = {solid: undefined, dashed: '6 4', dotted: '1.5 3.5'};
  for (const s of ast.statements) {
    if (s.kind !== 'edge') continue;
    const stmt = s as GobiEdgeStmt;
    n++;
    for (let k = 0; k < stmt.x; k++) {
      const id = stmt.x === 1 ? `e${n}` : `e${n}${suffix(k)}`;
      const crow = stmt.card ? stmt.card.split('..') : null;
      const seed = {
        label: stmt.label ?? undefined,
        techn: stmt.techn ?? undefined,
        ...(crow ? {crowStart: GOBI_CARD_TOKENS[crow[0]!] as never, crowEnd: GOBI_CARD_TOKENS[crow[1]!] as never} : {}),
        sourceHandle: ast.direction === 'LR' ? 'right' : 'bottom',
        targetHandle: ast.direction === 'LR' ? 'left' : 'top',
      };
      const edge = makeEdge(stmt.from, stmt.to, CUSTOM_PRESET.edges, id, seed);
      /* operator/attribute dash override (attribute is the authority, §2.4). */
      const dash = DASH[stmt.dash ?? opDash(stmt.op)];
      if (dash) {
        edge.style = {...edge.style, strokeDasharray: dash};
      } else if (edge.style?.strokeDasharray) {
        const {strokeDasharray: _drop, ...rest} = edge.style;
        edge.style = rest;
      }
      /* flow payload patches (EdgeData.flow et al.). */
      if (stmt.flow) (edge.data as Record<string, unknown>).flow = stmt.flow;
      if (stmt.flowIcon) (edge.data as Record<string, unknown>).flowIcon = stmt.flowIcon;
      if (stmt.flowCount !== null) (edge.data as Record<string, unknown>).flowCount = stmt.flowCount;
      out.push(edge);
    }
  }
  return out;
}

const opDash = (op: GobiEdgeStmt['op']): 'solid' | 'dashed' | 'dotted' =>
  op === '->' ? 'solid' : op === '..>' ? 'dashed' : 'dotted';

/** xN copy suffix: a, b, … z, then z2, z3 (26+ is pathological but total). */
function suffix(k: number): string {
  return k < 26 ? String.fromCharCode(97 + k) : `z${k - 24}`;
}
