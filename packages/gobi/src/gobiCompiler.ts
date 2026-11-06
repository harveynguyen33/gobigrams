/* ROUND GOBI-1 — the .gobi compiler (SPEC §3.1): AST → GobiDocument through
 * the REAL layout engine and the REAL routing/label passes.
 *
 * CORE-STEP2 (SPEC-GOBI-CORE §A/step 2): the compiler's OUTPUT is the
 * surface-neutral GobiDocument (src/gobi/gobiTypes.ts) — plain data with
 * post-layout geometry and language-resolved content. The React-Flow board
 * (palette factories, makeEdge, RF sizing fields) is a SURFACE decision and
 * lives in exactly one place: src/gobi/adapterCanvas.ts (`toBoardDoc`).
 * Nothing here imports the palette factories or the preset edge defaults;
 * the only registry data the compiler needs is the derived kind geometry
 * (src/gobi/registry.ts).
 *
 * Pipeline: BUILD (authored specs + geometry shells, placeholder positions
 * in authored order) → LAYOUT (layoutDiagram on top-level participants;
 * children follow their group) → GROUPS (bottom-up bounding rectangles) →
 * EDGES (routing passes write the resolved handle pair + pinned labels) →
 * EMIT GobiDocument.
 *
 * Pure: no clock, no DOM — board identity (id/updatedAt) is minted by the
 * adapter, so the same text always compiles to a byte-identical doc. */

import type {FlowNode, FlowEdge} from './model/flowTypes';
import {layoutDiagram} from './model/layout';
import {GROUP_TITLE_H} from './model/layoutConstants';
import {parseGobi} from './gobiParser';
import {getBezierPath, Position} from './paths';
import {gobiMemberOrder, packGroup, routeEdgeHandles, detourEdgeHandles, placeEdgeLabels, handlePoint} from './gobiLayout';
import {gobiBodyOf, gobiTextStyle} from './gobiText';
import {validateGobi} from './gobiValidator';
import {GOBI_KIND_GEOMETRY} from './registry';
import {GOBI_KIND_ITEM} from './gobiTypes';
import {
  type GobiAst,
  type GobiDocColumn,
  type GobiDocEdge,
  type GobiDocNode,
  type GobiDocument,
  type GobiEdgeStmt,
  type GobiError,
  type GobiNodeStmt,
} from './gobiTypes';

/* ------------------------------------------------------------- the result */

export type GobiCompileResult =
  | {ok: true; doc: GobiDocument}
  | {ok: false; errors: GobiError[]};

export function compileGobi(text: string): GobiCompileResult {
  /* 1–3. PARSE + VALIDATE — one pass each, all errors collected. */
  const parsed = parseGobi(text);
  if (!parsed.ok) {
    const bad = parsed as {ok: false; errors: GobiError[]};
    return {ok: false, errors: bad.errors};
  }
  const errors = validateGobi(parsed.ast);
  if (errors.length) return {ok: false, errors};
  const ast = parsed.ast;

  /* 4. BUILD — authored specs (language content) + geometry shells. The
     shell is the minimum the layout passes read (id/position/size/style +
     the shape marker the label pass groups by); the authored content it
     carries in the doc is projected at emit. */
  const {nodes, order, specs} = buildWork(ast);
  const {edgeShells, edgeSpecs} = buildEdgeWork(ast);

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
  const lifted = edgeShells
    .filter((e) => topOf(e.source) !== topOf(e.target))
    .map((e) => ({...e, source: topOf(e.source), target: topOf(e.target)}) as FlowEdge);
  const placed = layoutDiagram(participants, lifted, {direction: ast.direction, spacing: {x: 70, y: 24}});
  for (const [id, p] of placed) {
    const n = nodes.find((t) => t.id === id);
    if (n) n.position = {x: p.x, y: p.y};
  }

  /* 5b. GROUPS — bottom-up PACK for size (members ordered so internally
     connected ones sit adjacent, packed on the CROSS axis: a column in LR, a
     row in TB, so every member's layer-axis face is reachable from outside
     the box), then top-down STAMP: members are written inside wherever the
     layer engine puts the group. */
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
  /* ROUND GOBI-LAYOUT-2 (R1): the group's TOP inset is NOT the side pad. The
     K5 header banner (`.group-head` / `.group-label`) paints across the top
     GROUP_TITLE_H of the box, so a member row stamped at PAD=40 put the title's
     descenders ON the first member's top border (measured on fanout-a/b:
     1,160 px2 title-x-member, title-bottom-to-member = -4px). One member gap
     of clear air below the banner restores it (+24px). Bottom/sides stay PAD. */
  const TOP = GROUP_TITLE_H + INNER;
  const boxOf = (n: FlowNode) => ({
    x: n.position.x, y: n.position.y,
    w: (n.width as number) ?? (n.style?.width as number) ?? 190,
    h: (n.height as number) ?? (n.style?.height as number) ?? 60,
  });
  const packOf = new Map<string, {w: number; h: number; slots: Map<string, {x: number; y: number}>}>();
  for (const g of groupsWithMembers) {
    const gNode = nodes.find((n) => n.id === g);
    if (!gNode) continue;
    const members = gobiMemberOrder(nodes.filter((n) => parentOf.get(n.id) === g), edgeShells);
    if (!members.length) continue;
    const sizeOf = (m: FlowNode) => {
      const p = packOf.get(m.id);
      if (p) return {w: p.w + 2 * PAD, h: p.h + 2 * PAD};
      const b = boxOf(m);
      return {w: b.w, h: b.h};
    };
    const pack = packGroup(members, sizeOf, ast.direction, INNER);
    packOf.set(g, pack);
    /* ROUND GOBI-LAYOUT-2 (R1): asymmetric vertical padding — TOP above (the
       title banner + one member gap), PAD below. Sides stay symmetric. */
    gNode.width = pack.w + 2 * PAD;
    gNode.height = pack.h + TOP + PAD;
    gNode.style = {width: pack.w + 2 * PAD, height: pack.h + TOP + PAD};
  }
  for (const g of [...groupsWithMembers].reverse()) {
    const gNode = nodes.find((n) => n.id === g);
    const pack = packOf.get(g);
    if (!gNode || !pack) continue;
    for (const [id, slot] of pack.slots) {
      const m = nodes.find((t) => t.id === id);
      if (!m) continue;
      m.parentId = g;
      /* ROUND GOBI-LAYOUT-2 (R2 root cause): PARENT-RELATIVE, the React Flow
         model `parentId` demands. The old stamp wrote the ABSOLUTE point while
         setting parentId, and every downstream reader that resolves the parent
         chain (5c routing, 5d labels) then added the group origin a SECOND
         time — members sat +group.x off to the right of where they render, the
         dominant-axis handle chooser saw |dy|>|dx| for a plainly horizontal
         hop, and an outside-node edge entered a MIDDLE member's side face
         (measured: fanout-c's heartbeat crossed consumer-2 for 149 of 513
         path samples). The doc stores the same parent-relative point. */
      m.position = {x: PAD + slot.x, y: TOP + slot.y};
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
    const absOf = (n: FlowNode): {x: number; y: number} => {
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
  routeEdgeHandles(edgeShells, absBox);

  /* 5c2. DETOUR — ROUND GOBI-LAYOUT-2 (R2): with true boxes the dominant-axis
     pair clears the members on every fixture we can measure, but the pair is
     chosen from CENTRES, not from the ink; a shape the fixtures do not cover
     (an outside node reaching a middle member from below) can still cross a
     sibling body. When the chosen pair's bezier crosses one, the detour
     re-routes around the pack (perimeter arc / far face). Writes NOTHING for
     edges that already run clean — byte-identical boards. */
  const SIDE: Record<string, Position> = {
    left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom,
  };
  const bezNums = (s: {x: number; y: number; w: number; h: number}, t: {x: number; y: number; w: number; h: number},
                   sh: string, th: string): number[] | null => {
    const sp = handlePoint(s, sh), tp = handlePoint(t, th);
    const d = getBezierPath({
      sourceX: sp.x, sourceY: sp.y, targetX: tp.x, targetY: tp.y,
      sourcePosition: SIDE[sh] ?? Position.Right, targetPosition: SIDE[th] ?? Position.Left,
    })[0];
    const nums = (d.match(/-?[\d.]+/g) ?? []).map(Number);
    return nums.length === 8 ? nums : null;
  };
  detourEdgeHandles(nodes, edgeShells, absBox, bezNums);

  /* 5d. LABELS — ROUND GOBI-FANOUT: an edge label whose auto-centred box
     would land on a node box (or on a sibling label — two labels share one
     gap when their edges run between the same stacked pair) is offset
     PERPENDICULAR to the line, through the SAME stored pair a manual drag
     writes, so the canvas renders it through the one anchor path and it
     stays draggable. Labels already in air are left unpinned — a board that
     needed no correction compiles to byte-identical JSON. The anchor is the
     SAME bezier call GoblinEdge paints with, so the compiler corrects the
     label exactly where the canvas will put it. */
  placeEdgeLabels(nodes, edgeShells, absBox, (e) => {
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
     group is declared FIRST. ROUND GOBI-LAYOUT-2: member positions are
     ALREADY parent-relative (the 5b stamp writes the React Flow model), so
     the absolute sort key resolves the parent chain and the old
     subtract-the-parent conversion pass is GONE — it existed only to undo the
     stamp's absolute write, the same write that double-counted the group
     origin in 5c/5d. */
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const absPos = new Map<string, {x: number; y: number}>();
  const absOfId = (id: string): {x: number; y: number} => {
    if (absPos.has(id)) return absPos.get(id)!;
    const n = nodeById.get(id)!;
    const par = n.parentId ? absOfId(n.parentId) : {x: 0, y: 0};
    const p = {x: par.x + n.position.x, y: par.y + n.position.y};
    absPos.set(id, p);
    return p;
  };
  for (const n of nodes) absOfId(n.id);
  nodes.sort((a, b) => {
    const pa = absPos.get(a.id)!, pb = absPos.get(b.id)!;
    return pa.y - pb.y || pa.x - pb.x;
  });

  /* 7. EMIT — project the shells + specs into the neutral document. */
  const docNodes: GobiDocNode[] = nodes.map((s) => {
    const spec = specs.get(s.id)!;
    return {
      id: s.id,
      kind: spec.kind,
      label: spec.label,
      ...(spec.sub !== undefined ? {sub: spec.sub} : {}),
      ...(spec.kicker !== undefined ? {kicker: spec.kicker} : {}),
      ...(spec.icon !== undefined ? {icon: spec.icon} : {}),
      ...(spec.color !== undefined ? {color: spec.color} : {}),
      ...(spec.body !== undefined ? {body: spec.body} : {}),
      ...(spec.textStyle !== undefined ? {textStyle: spec.textStyle} : {}),
      ...(spec.columns !== undefined ? {columns: spec.columns} : {}),
      size: {w: s.width as number, h: s.height as number},
      position: {x: s.position.x, y: s.position.y},
      ...(s.parentId ? {parent: s.parentId} : {}),
    };
  });
  const docEdges: GobiDocEdge[] = edgeShells.map((sh, i) => {
    const spec = edgeSpecs[i];
    const pinned = (sh.data as {labelOffset?: {x: number; y: number}} | undefined)?.labelOffset;
    return {
      id: spec.id,
      from: spec.from,
      to: spec.to,
      fromHandle: sh.sourceHandle as string,
      toHandle: sh.targetHandle as string,
      ...(spec.label !== undefined ? {label: spec.label} : {}),
      ...(spec.techn !== undefined ? {techn: spec.techn} : {}),
      ...(spec.card !== undefined ? {card: spec.card} : {}),
      dash: spec.dash,
      ...(spec.flow !== undefined ? {flow: spec.flow} : {}),
      ...(spec.flowIcon !== undefined ? {flowIcon: spec.flowIcon} : {}),
      ...(spec.flowCount !== undefined ? {flowCount: spec.flowCount} : {}),
      ...(pinned !== undefined ? {labelOffset: pinned} : {}),
    };
  });

  return {
    ok: true,
    doc: {
      docVersion: 1,
      name: ast.board?.name ?? 'Untitled',
      direction: ast.direction,
      ...(ast.theme ? {theme: ast.theme} : {}),
      nodes: docNodes,
      edges: docEdges,
    },
  };
}

/* ------------------------------------------------------------------ build */

/** The authored + language-resolved content of one node, projected into the
 *  doc at emit. This is everything the ADAPTER cannot re-derive: palette
 *  factory defaults are absent on purpose (the adapter calls the same
 *  `item.make()` the panel does). */
type NodeSpec = {
  kind: string;
  label: string;
  sub?: string;
  kicker?: string;
  icon?: string;
  color?: string;
  body?: 'card' | 'label-only';
  textStyle?: {align: string; vAlign: string};
  columns?: GobiDocColumn[];
};

function buildWork(ast: GobiAst): {nodes: FlowNode[]; order: string[]; specs: Map<string, NodeSpec>} {
  const nodes: FlowNode[] = [];
  const order: string[] = [];
  const specs = new Map<string, NodeSpec>();
  for (const s of ast.statements) {
    if (s.kind !== 'node') continue;
    const stmt = s as GobiNodeStmt;
    order.push(stmt.id);

    /* geometry from the registry (GOBI-SIZE: the palette item's own size —
       the ONE source both create paths read). Vocabulary guaranteed by the
       parser/GOBI-LOCK, so a miss is unreachable (mirrors the old
       `if (!item) continue` guard). */
    const size = GOBI_KIND_GEOMETRY[stmt.nodeKind];
    if (!size) continue;
    const meta = GOBI_KIND_ITEM[stmt.nodeKind];

    /* table — its own kind (a column list is not a Shape). The language's
       own default colour is resolved HERE, not on the surface. */
    if (stmt.nodeKind === 'table') {
      const columns: GobiDocColumn[] = (stmt.columns ?? []).map((c) => ({
        name: c.name, type: c.type,
        ...(c.pk ? {pk: true as const} : {}), ...(c.fk ? {fk: true as const} : {}),
        ...(c.notNull ? {notNull: true as const} : {}), ...(c.unique ? {unique: true as const} : {}),
      }));
      specs.set(stmt.id, {
        kind: 'table', label: stmt.title ?? stmt.id,
        color: (stmt.attrs.color as string) ?? 'cyan',
        columns,
      });
      nodes.push({
        id: stmt.id, type: 'table', position: {x: 0, y: 0},
        width: size.w, height: size.h,
        style: {width: size.w, height: size.h},
        data: {shape: null},
      } as unknown as FlowNode);
      continue;
    }

    /* author overrides (smart defaults, explicit overrides — §1 goal 3).
       ROUND GOBI-LAYOUT: a .gobi node NEVER inherits the palette's `sub` —
       in a text language the author's words are the source of truth, and the
       seeded default was inventing prose he never wrote (actor → "person",
       service → "stateless"). `sub` exists on the node ONLY when written.
       `kicker` stays a factory default on the surface: it is the KIND label,
       not prose, and the palette drag path (a different product surface)
       keeps its defaults. */
    const spec: NodeSpec = {kind: stmt.nodeKind, label: stmt.title ?? stmt.id};
    if (meta?.kind === 'label') {
      /* text — the caption kind; the label branch writes the text only. */
    } else {
      if (stmt.attrs.sub !== undefined) spec.sub = stmt.attrs.sub;
      if (stmt.attrs.kicker) spec.kicker = stmt.attrs.kicker;
      if (stmt.attrs.icon) spec.icon = stmt.attrs.icon;
      if (stmt.attrs.color) spec.color = stmt.attrs.color;
      /* GOBI-TEXT-FIT (R3) — the body layout is the AUTHOR's choice, and the
         language reaches the model's own `body: 'card' | 'label-only'`.
         `body:card` / `body:simple` wins verbatim; the DEFAULT is
         content-driven, not "card always": a node the author gave neither a
         `sub:` nor an authored `kicker:` renders SIMPLE (Harvey: "ko nhất bạn
         phải dùng body là card layout"), and one line of prose — a sub or a
         kicker — buys the card shell. The factory kicker (the kind label)
         does NOT buy the shell by itself: it is not prose, so `service api`
         stays a sentence while `service api sub:auth` is a card. Note and
         group keep their own layouts, so the choice is written for the card
         kinds only. */
      if (stmt.shape !== 'note' && stmt.shape !== 'group') {
        spec.body = gobiBodyOf(stmt.attrs.body)
          ?? ((stmt.attrs.sub || stmt.attrs.kicker) ? 'card' : 'label-only');
      }
    }

    /* ROUND GOBI-TEXT (§2.9) — the language's text alignment. Every non-table
       kind carries it, because the canvas reads `data.textStyle` through ONE
       emitter (`textStyleVars`) for the card, the note, the label and the
       group label alike. `align` is always written (the .gobi default is
       CENTER, which the app's own card default — left — does not supply), and
       since GOBI-TEXT3 so is `vAlign` (the language default is middle). */
    spec.textStyle = gobiTextStyle(stmt.attrs) as {align: string; vAlign: string};

    specs.set(stmt.id, spec);
    nodes.push({
      id: stmt.id, type: meta?.kind ?? 'goblin', position: {x: 0, y: 0},
      width: size.w, height: size.h,
      style: {width: size.w, height: size.h},
      data: {shape: meta?.shape ?? null},
    } as unknown as FlowNode);
  }
  return {nodes, order, specs};
}

/** The authored edge payload (doc side) plus the geometry shell the routing
 *  passes mutate. The seed handle pair is direction-based exactly as the old
 *  factory seed wrote it; routing overwrites both sides for every edge (all
 *  endpoints are placed), and what survives into the doc is the RESOLVED
 *  pair. */
type EdgeSpec = {
  id: string;
  from: string;
  to: string;
  label?: string;
  techn?: string;
  card?: [string, string];
  dash: 'solid' | 'dashed' | 'dotted';
  flow?: string;
  flowIcon?: string;
  flowCount?: number;
};

function buildEdgeWork(ast: GobiAst): {edgeShells: FlowEdge[]; edgeSpecs: EdgeSpec[]} {
  const edgeShells: FlowEdge[] = [];
  const edgeSpecs: EdgeSpec[] = [];
  let n = 0;
  for (const s of ast.statements) {
    if (s.kind !== 'edge') continue;
    const stmt = s as GobiEdgeStmt;
    n++;
    for (let k = 0; k < stmt.x; k++) {
      const id = stmt.x === 1 ? `e${n}` : `e${n}${suffix(k)}`;
      const spec: EdgeSpec = {
        id, from: stmt.from, to: stmt.to,
        /* operator/attribute dash override (attribute is the authority, §2.4). */
        dash: stmt.dash ?? opDash(stmt.op),
      };
      if (stmt.label) spec.label = stmt.label;
      if (stmt.techn) spec.techn = stmt.techn;
      if (stmt.card) spec.card = stmt.card.split('..') as [string, string];
      if (stmt.flow) spec.flow = stmt.flow;
      if (stmt.flowIcon) spec.flowIcon = stmt.flowIcon;
      if (stmt.flowCount !== null) spec.flowCount = stmt.flowCount;
      edgeSpecs.push(spec);
      edgeShells.push({
        id,
        source: stmt.from, target: stmt.to,
        sourceHandle: ast.direction === 'LR' ? 'right' : 'bottom',
        targetHandle: ast.direction === 'LR' ? 'left' : 'top',
        label: stmt.label ?? undefined,
        data: {},
      } as unknown as FlowEdge);
    }
  }
  return {edgeShells, edgeSpecs};
}

const opDash = (op: GobiEdgeStmt['op']): 'solid' | 'dashed' | 'dotted' =>
  op === '->' ? 'solid' : op === '..>' ? 'dashed' : 'dotted';

/** xN copy suffix: a, b, … z, then z2, z3 (26+ is pathological but total). */
function suffix(k: number): string {
  return k < 26 ? String.fromCharCode(97 + k) : `z${k - 24}`;
}
