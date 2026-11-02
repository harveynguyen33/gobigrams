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
import {getBezierPath, Position} from '@xyflow/react';
import {gobiMemberOrder, packGroup, routeEdgeHandles, placeEdgeLabels, handlePoint} from './gobiLayout';
import {gobiTextStyle} from './gobiText';
import {validateGobi} from './gobiValidator';
import {
  GOBI_CARD_TOKENS,
  GOBI_KIND_ITEM,
  type GobiAst,
  type GobiEdgeStmt,
  type GobiError,
  type GobiNodeStmt,
} from './gobiTypes';

/* ------------------------------------------------------------------ kinds */

/** ROUND GOBI-LOCK — kind → palette item is DERIVED from the same registry
 * union gobiTypes builds its vocabulary from (GOBI_KIND_ITEM): the kind word
 * IS the item's Shape id (or `text`/`table` for the two non-shape kinds), and
 * the palette LABEL (the unique key every palette list carries) comes along
 * for the ride. The hand-written 27-entry KIND_LABEL map this replaces could
 * drift from the registry in either direction — the exact defect the lock
 * closes; checks/round-gobi-lock.mjs C7 asserts no restatement returns. */
const ITEMS: PaletteItem[] = [...PALETTE, ...FLOWCHART_PALETTE, TABLE_PALETTE_ITEM];

const itemFor = (kind: string): PaletteItem | undefined =>
  ITEMS.find((p) => p.label === GOBI_KIND_ITEM[kind]?.label);

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
     island logic has deterministic pre-offsets (§3.1 step 4). ROUND
     GOBI-FANOUT: the stamp is UNCONDITIONAL now — buildNodes seeds every node
     at {0,0}, which silently defeated the old `if (!n.position)` guard and
     collapsed every island's pre-layout offset onto one point. */
  nodes.forEach((n) => { n.position = {x: order.indexOf(n.id) * 600, y: 0}; });

  /* 5. LAYOUT — ROUND GOBI-FANOUT: a member-holding group participates as ONE
     entity. Edges are LIFTED to each end's top-level ancestor (an edge into a
     member becomes an edge into its group; a wholly-internal edge lifts to a
     self-loop and drops out of the LAYOUT graph only — the board keeps it),
     and each group is sized by its packed members BEFORE the engine runs so
     its layer slot reserves real room. The old exclusion ("its rect is
     derived in 5b") packed members from the group's un-placed placeholder —
     the measured 42,050 px2 source-on-child overlap this round removes. */
  const parentOf = new Map<string, string>();
  for (const s of ast.statements) if (s.kind === 'membership') for (const m of s.members) parentOf.set(m.id, s.group);
  const topOf = (id: string): string => { let cur = id; while (parentOf.has(cur)) cur = parentOf.get(cur)!; return cur; };
  const participants = nodes.filter((n) => !parentOf.has(n.id));
  const lifted = edges
    .filter((e) => topOf(e.source) !== topOf(e.target))
    .map((e) => ({...e, source: topOf(e.source), target: topOf(e.target)}) as Edge);
  const placed = layoutDiagram(participants, lifted, {direction: ast.direction, spacing: {x: 70, y: 24}});
  for (const [id, p] of placed) {
    const n = nodes.find((t) => t.id === id);
    if (n) n.position = {x: p.x, y: p.y};
  }

  /* 5b. GROUPS — bottom-up PACK for size (members ordered so internally
     connected ones sit adjacent, packed on the CROSS axis: a column in LR, a
     row in TB, so every member's layer-axis face is reachable from outside
     the box), then top-down STAMP: members are written inside wherever the
     layer engine put the group. */
  const depth = (id: string): number => {
    let d = 0;
    let cur = parentOf.get(id);
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) { seen.add(cur); d++; cur = parentOf.get(cur); }
    return d;
  };
  const groupsWithMembers = [...new Set([...parentOf.values()])].sort((a, b) => depth(b) - depth(a));
  const PAD = 40;
  /* ROUND GOBI-FANOUT: 24 (was 20) so a label resting in the gap between two
     stacked members (16.8px tall) clears both boxes by >3px each side. */
  const INNER = 24;
  const boxOf = (n: Node) => ({
    x: n.position.x, y: n.position.y,
    w: (n.width as number) ?? (n.style?.width as number) ?? 190,
    h: (n.height as number) ?? (n.style?.height as number) ?? 60,
  });
  const packOf = new Map<string, {w: number; h: number; slots: Map<string, {x: number; y: number}>}>();
  for (const g of groupsWithMembers) {
    const gNode = nodes.find((n) => n.id === g);
    if (!gNode) continue;
    const members = gobiMemberOrder(nodes.filter((n) => parentOf.get(n.id) === g), edges);
    if (!members.length) continue;
    const sizeOf = (m: Node) => {
      const p = packOf.get(m.id);
      if (p) return {w: p.w + 2 * PAD, h: p.h + 2 * PAD};
      const b = boxOf(m);
      return {w: b.w, h: b.h};
    };
    const pack = packGroup(members, sizeOf, ast.direction, INNER);
    packOf.set(g, pack);
    gNode.width = pack.w + 2 * PAD;
    gNode.height = pack.h + 2 * PAD;
    gNode.style = {width: pack.w + 2 * PAD, height: pack.h + 2 * PAD};
  }
  for (const g of [...groupsWithMembers].reverse()) {
    const gNode = nodes.find((n) => n.id === g);
    const pack = packOf.get(g);
    if (!gNode || !pack) continue;
    for (const [id, slot] of pack.slots) {
      const m = nodes.find((t) => t.id === id);
      if (!m) continue;
      m.parentId = g;
      m.position = {x: gNode.position.x + PAD + slot.x, y: gNode.position.y + PAD + slot.y};
    }
  }

  /* 5c. ROUTING — ROUND GOBI-FANOUT: each edge's handle pair comes from the
     endpoints' PLACED geometry (dominant axis), so an edge between stacked
     group members enters through top/bottom rather than sweeping sideways
     across the column, and an edge to anything left of its source leaves
     left. Forward layer-to-layer edges resolve to exactly the old fixed
     pair (right/left in LR, bottom/top in TB), so existing boards keep the
     handles they compiled to before this round. */
  const absBox = new Map<string, {x: number; y: number; w: number; h: number}>();
  {
    const absOf = (n: Node): {x: number; y: number} => {
      const par = n.parentId ? nodes.find((t) => t.id === n.parentId) : undefined;
      const p = par ? absOf(par) : {x: 0, y: 0};
      return {x: p.x + n.position.x, y: p.y + n.position.y};
    };
    for (const n of nodes) {
      const b = boxOf(n);
      const p = absOf(n);
      absBox.set(n.id, {x: p.x, y: p.y, w: b.w, h: b.h});
    }
  }
  routeEdgeHandles(edges as Edge[], absBox);

  /* 5d. LABELS — ROUND GOBI-FANOUT: an edge label whose auto-centred box
     would land on a node box (or on a sibling label — two labels share one
     gap when their edges run between the same stacked pair) is offset
     PERPENDICULAR to the line, through the SAME stored pair a manual drag
     writes, so the canvas renders it through the one anchor path and it
     stays draggable. Labels already in air are left unpinned — a board that
     needed no correction compiles to byte-identical JSON. The anchor is the
     SAME bezier call GoblinEdge paints with, so the compiler corrects the
     label exactly where the canvas will put it. */
  const SIDE: Record<string, Position> = {
    left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom,
  };
  placeEdgeLabels(nodes, edges as Edge[], absBox, (e) => {
    const s = absBox.get(e.source), t = absBox.get(e.target);
    if (!s || !t) return {x: 0, y: 0, vertical: false};
    const sp = handlePoint(s, e.sourceHandle), tp = handlePoint(t, e.targetHandle);
    const [, lx, ly] = getBezierPath({
      sourceX: sp.x, sourceY: sp.y, targetX: tp.x, targetY: tp.y,
      sourcePosition: SIDE[e.sourceHandle ?? 'right'], targetPosition: SIDE[e.targetHandle ?? 'left'],
    });
    return {x: lx, y: ly, vertical: Math.abs(tp.y - sp.y) > Math.abs(tp.x - sp.x)};
  });

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

    /* author overrides (smart defaults, explicit overrides — §1 goal 3).
       ROUND GOBI-LAYOUT: a .gobi node NEVER inherits the palette's `sub` —
       in a text language the author's words are the source of truth, and the
       seeded default was inventing prose he never wrote (actor → "person",
       service → "stateless"). `sub` exists on the node ONLY when written.
       `kicker` stays a factory default: it is the KIND label, not prose, and
       the palette drag path (a different product surface) keeps its defaults. */
    if (item.kind === 'label') {
      data.text = stmt.title ?? stmt.id;
    } else {
      data.title = stmt.title ?? stmt.id;
      data.sub = stmt.attrs.sub ?? '';
      if (stmt.attrs.kicker) data.kicker = stmt.attrs.kicker;
      if (stmt.attrs.icon) data.icon = stmt.attrs.icon;
      if (stmt.attrs.color) data.colorKey = stmt.attrs.color;
    }

    /* ROUND GOBI-TEXT (§2.9) — the language's text alignment. Every non-table
       kind carries it, because the canvas reads `data.textStyle` through ONE
       emitter (`textStyleVars`) for the card, the note, the label and the
       group label alike. `align` is always written (the .gobi default is
       CENTER, which the app's own card default — left — does not supply), and
       `vAlign` only when the author wrote it (the app's per-target default is
       already right for every box). */
    data.textStyle = gobiTextStyle(stmt.attrs);

    /* size: the palette item's own size — the ONE source both create paths
       read (GOBI-SIZE, src/nodeSizes.ts). Every kind carries one, so this is
       unconditional: the old `group 320x200` fallback disagreed with the
       palette's 420x200 for the same shape, and the `? : {}` guard it needed
       goes with it. */
    const size = item.size!;
    nodes.push({
      id: stmt.id, type: item.kind, position: {x: 0, y: 0},
      width: size.width, height: size.height,
      style: {width: size.width, height: size.height},
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
