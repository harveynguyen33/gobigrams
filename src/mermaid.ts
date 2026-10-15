/* AQ21 — Mermaid bridge. EXPORT: our graph → a Mermaid `flowchart` document
 * (nodes, edges, labels, subgraphs for groups). IMPORT: the common flowchart
 * subset back into nodes + edges.
 *
 * HONEST SCOPE (stated in the export modal too):
 *  - Export covers the FLOWCHART-ish subset: goblin nodes with a shape, edge
 *    labels, groups as subgraphs. Lost: colours, text styles, icons, metrics,
 *    custom shapes, ERD tables, C4 relationship semantics (edges become plain
 *    labelled arrows).
 *  - Import parses the line-based flowchart syntax most diagrams use: node
 *    definitions with the common shape tokens, `-->`/`---` edges with `|label|`
 *    or `-- text ---`, and `subgraph` blocks. Lost: classDef styling, nested
 *    quotes tricks, `&` chaining beyond simple A & B --> C.
 */
import type {Edge, Node} from '@xyflow/react';

/* ------------------------------------------------------------------ export */

/** Mermaid shape wrapper per our shape. Order matters: check the specific
 *  cylinders before the generic brackets. */
const SHAPE_TO_MERMAID: Record<string, {open: string; close: string}> = {
  database: {open: '[(', close: ')]'},
  storeddata: {open: '[(', close: ')]'},
  decision: {open: '{', close: '}'},
  gateway: {open: '{', close: '}'},
  external: {open: '([', close: '])'},
  actor: {open: '((', close: '))'},
  queue: {open: '[/', close: '/]'},
  service: {open: '(', close: ')'},
  note: {open: '[', close: ']'},
};

const esc = (s: string): string => s.replace(/"/g, '#quot;').replace(/[\r\n]+/g, ' ');

/* PACKAGE-SEQ — UML sequence export. Participants = lifeline nodes (heads at
   the smallest y per column), ordered by x. Messages = edges carrying seqMsg,
   ordered by the y of the pair's midpoint. The Mermaid arrow token per kind:
   sync ->> (filled), async -) (open, fire-and-forget), return -->> (dashed). */
export function toMermaidSequence(nodes: Node[], edges: Edge[]): string {
  const heads = nodes.filter(n => n.type === 'goblin'
    && (n.data as {shape?: string})?.shape === 'lifeline');
  if (heads.length < 2) return ['sequenceDiagram', '%% fewer than two lifelines — nothing to draw'].join('\n');
  const sorted = [...heads].sort((a, b) => a.position.x - b.position.x);
  const ids = sorted.map((_, i) => `S${i + 1}`);
  const idOf = new Map(sorted.map((n, i) => [n.id, ids[i]]));
  const lines: string[] = ['sequenceDiagram'];
  const autonumber = edges.some(e => (e.data as {seqAuto?: boolean})?.seqAuto);
  if (autonumber) lines.push('  autonumber');
  sorted.forEach((n, i) => {
    const d = n.data as {shape?: string; title?: string};
    const isActor = (d.title ?? '').toLowerCase().includes('actor')
      || (n.data as {icon?: string})?.icon === 'user';
    lines.push(`  ${isActor ? 'actor' : 'participant'} ${ids[i]} as ${esc(d.title ?? `P${i + 1}`)}`);
  });
  const msgs = edges
    .filter(e => idOf.has(e.source) && idOf.has(e.target))
    .map(e => ({e, y: Math.min(
      nodes.find(n => n.id === e.source)?.position.y ?? 0,
      nodes.find(n => n.id === e.target)?.position.y ?? 0,
    )}))
    .sort((a, b) => a.y - b.y);
  for (const {e} of msgs) {
    const kind = (e.data as {seqMsg?: string})?.seqMsg ?? 'sync';
    const token = kind === 'return' ? '-->>' : kind === 'async' ? '-)' : '->>';
    const d = (e.data ?? {}) as {label?: string};
    const label = d.label ? `: ${d.label}` : '';
    lines.push(`  ${idOf.get(e.source)} ${token} ${idOf.get(e.target)}${label}`);
  }
  return lines.join('\n');
}

export function toMermaid(nodes: Node[], edges: Edge[]): string {
  const goblin = nodes.filter(n => n.type === 'goblin' || n.type === 'label');
  const groups = goblin.filter(n => (n.data as {shape?: string})?.shape === 'group');
  const others = goblin.filter(n => (n.data as {shape?: string})?.shape !== 'group');
  /* stable short ids: n123 → m1, m2, … in board order */
  const idMap = new Map<string, string>();
  let seq = 0;
  const mid = (id: string): string => {
    if (!idMap.has(id)) idMap.set(id, `m${++seq}`);
    return idMap.get(id)!;
  };
  goblin.forEach(n => mid(n.id));

  const wrap = (n: Node): string => {
    const d = n.data as {shape?: string; title?: string; sub?: string};
    const label = esc([d.title, d.sub].filter(Boolean).join(' — ') || n.id);
    const w = SHAPE_TO_MERMAID[d.shape ?? 'service'] ?? {open: '(', close: ')'};
    return `${w.open}"${label}"${w.close}`;
  };

  const lines: string[] = ['flowchart TD'];
  /* edges FIRST outside subgraphs keeps Mermaid's parser happy about ids */
  for (const e of edges) {
    if (!idMap.has(e.source) || !idMap.has(e.target)) continue;
    const d = (e.data ?? {}) as {label?: string};
    const lbl = d.label ? `|${esc(d.label)}|` : '';
    lines.push(`  ${idMap.get(e.source)} -->${lbl} ${idMap.get(e.target)}`);
  }
  /* groups → subgraphs with their children (children = nodes whose position
     sits inside the group's box — positions are absolute in this app unless
     parentId is set; RF parent-child uses parentId, so read that first) */
  const childOf = new Map<string, string[]>();
  for (const n of goblin) {
    const p = (n as {parentId?: string}).parentId;
    if (p && idMap.has(p)) {
      if (!childOf.has(p)) childOf.set(p, []);
      childOf.get(p)!.push(n.id);
    }
  }
  const written = new Set<string>();
  const emitNode = (n: Node, indent: string): void => {
    lines.push(`${indent}${mid(n.id)}: ${wrap(n)}`);
    written.add(n.id);
  };
  others.forEach(n => { if (!childOf.has(parentOf(n, goblin))) emitNode(n, '  '); });
  for (const g of groups) {
    const d = g.data as {title?: string};
    lines.push(`  subgraph ${idMap.get(g.id)}["${esc(d.title ?? 'group')}"]`);
    const kids = childOf.get(g.id) ?? [];
    if (kids.length) kids.forEach(k => {
      const kn = goblin.find(x => x.id === k);
      if (kn) emitNode(kn, '    ');
    });
    else {
      /* no explicit children — emit the group shell only */
      lines.push(`    ${idMap.get(g.id)}_empty[ ]`);
    }
    lines.push('  end');
  }
  /* orphans (children map said inside but never emitted) */
  goblin.forEach(n => { if (!written.has(n.id) && (n.data as {shape?: string})?.shape !== 'group') emitNode(n, '  '); });
  return lines.join('\n');
}

function parentOf(n: Node, all: Node[]): string | null {
  const p = (n as {parentId?: string}).parentId;
  return p ?? null;
}

/* ------------------------------------------------------------------ import */

type ParsedNode = {key: string; label: string; shape: string};
type ParsedEdge = {from: string; to: string; label?: string};
export type MermaidImport = {nodes: ParsedNode[]; edges: ParsedEdge[]; groups: Record<string, string[]>; direction: 'TB' | 'LR'};

/** Mermaid shape token → our shape. Checked longest-first. */
const TOKEN_SHAPES: [RegExp, string][] = [
  [/^\[\((.*)\)\]$/, 'database'],
  [/^\[\((.*)\)\]$/, 'storeddata'],
  [/^\(\((.*)\)\)$/, 'actor'],
  [/^\(\[(.*)\]\)$/, 'external'],
  [/^\{\{(.*)\}\}$/, 'gateway'],
  [/^\{(.*)\}$/, 'decision'],
  [/^\[\/(.*)\/\]$/, 'queue'],
  [/^\[\[(.*)\]\]$/, 'service'],
  [/^\[(.*)\]$/, 'queue'],
  [/^\((.*)\)$/, 'service'],
];

export function fromMermaid(text: string): MermaidImport | null {
  const lines = text.split(/\r?\n/).map(l => l.trim());
  const direction: 'TB' | 'LR' = /(?:flowchart|graph)\s+LR/.test(text) ? 'LR' : 'TB';
  const nodes = new Map<string, ParsedNode>();
  const edges: ParsedEdge[] = [];
  const groups: Record<string, string[]> = {};
  let groupStack: string[] = [];

  /* NODE_TOKEN: an id plus an optional shape token, e.g.  A  ·  A[Service]  ·
     B[(Database)]  ·  C{Check}  ·  D((Done))  ·  E([Ext])  ·  F[/Q/]. */
  const NODE = String.raw`([A-Za-z_][\w]*)\s*(\[\([^)]*\)\]|\(\([^)]*\)\)|\(\[[^\]]*\]\)|\{\{[^}]*\}\}|\{[^}]*\}|\[\/[^\]]*\/\]|\[\[[^\]]*\]\]|\[[^\]]*\]|\([^()]*\))?`;
  const shapeOf = (tok?: string): string => {
    if (!tok) return 'service';
    if (/^\[\(/.test(tok)) return 'database';
    if (/^\(\(/.test(tok)) return 'actor';
    if (/^\(\[/.test(tok)) return 'external';
    if (/^\{\{/.test(tok)) return 'gateway';
    if (/^\{/.test(tok)) return 'decision';
    if (/^\[\//.test(tok)) return 'queue';
    if (/^\[\[/.test(tok)) return 'service';
    return 'service'; /* [x] rectangle and (x) rounded both map to the box */
  };
  const labelOf = (tok?: string): string => {
    const m = tok ? /\((.*)\)|\[(.*)\]|\{(.*)\}/.exec(tok) : null;
    const raw = (m ? (m[1] ?? m[2] ?? m[3] ?? '') : '').replace(/^\/(.*)\/$/, '$1');
    return raw.replace(/^\(+|\)+$/g, '').replace(/^\[|\]$/g, '').replace(/^"|"$/g, '').replace(/#quot;/g, '"').trim();
  };

  const defNode = (key: string, tok?: string): void => {
    if (!nodes.has(key)) nodes.set(key, {key, label: labelOf(tok) || key, shape: shapeOf(tok)});
    else if (tok && labelOf(tok)) {
      const n = nodes.get(key)!;
      n.label = labelOf(tok);
      n.shape = shapeOf(tok);
    }
  };
  const claim = (key: string): void => {
    if (groupStack.length) {
      const g = groupStack[groupStack.length - 1];
      if (key !== g && !groups[g].includes(key)) groups[g].push(key);
    }
  };

  for (const line of lines) {
    if (!line || line.startsWith('%%')) continue;
    if (/^(flowchart|graph)\b/.test(line)) continue;
    if (line.startsWith('subgraph')) {
      const m = /subgraph\s+(\w+)\s*(?:\["([^"]*)"\])?/i.exec(line)
        ?? /subgraph\s+"?([^"\]]+)"?/i.exec(line);
      const gkey = 'g' + (Object.keys(groups).length + 1);
      const name = m ? (m[2] ?? m[1]) : ('group ' + gkey);
      groups[gkey] = [];
      groupStack.push(gkey);
      nodes.set(gkey, {key: gkey, label: String(name).replace(/"/g, ''), shape: 'group'});
      continue;
    }
    if (line === 'end') { groupStack.pop(); continue; }

    /* find all node tokens in order; edges are ADJACENT spans with an edge
       operator between them. |labels| and --text--> spans are scrubbed to
       NULs BEFORE node-lexing, so bare ids inside a label never become nodes. */
    const EDGE_OP = /-{1,3}>|-{3}|={2,}>|-\.->/;
    const labelSpans: {start: number; text: string}[] = [];
    let scrubbed = line.replace(/\|[^|]*\|/g, (m0, off) => { labelSpans.push({start: off, text: m0}); return '\u0000'.repeat(m0.length); });
    scrubbed = scrubbed.replace(/--\s+[^\s-][^-]*?\s*--(>)?/g, m0 => '\u0000'.repeat(m0.length));
    const nodeRe = new RegExp(NODE, 'g');
    const spans: {start: number; end: number; key: string; tok?: string}[] = [];
    let nm: RegExpExecArray | null;
    while ((nm = nodeRe.exec(scrubbed))) {
      if (nm[0].length === 0) { nodeRe.lastIndex++; continue; }
      spans.push({start: nm.index, end: nm.index + nm[0].length, key: nm[1], tok: nm[2]});
    }
    const ops: {a: string; tokA?: string; b: string; tokB?: string; label?: string}[] = [];
    for (let k = 0; k + 1 < spans.length; k++) {
      const between = scrubbed.slice(spans[k].end, spans[k + 1].start);
      if (!EDGE_OP.test(between)) continue;
      const gapStart = spans[k].end, gapEnd = spans[k + 1].start;
      const lbl = labelSpans.filter(l => l.start >= gapStart && l.start < gapEnd)
        .map(l => /\|([^|]*)\|/.exec(l.text)?.[1]?.trim()).find(Boolean);
      ops.push({a: spans[k].key, tokA: spans[k].tok, b: spans[k + 1].key, tokB: spans[k + 1].tok, label: (lbl as string) || undefined});
    }
    if (ops.length) {
      for (const o of ops) {
        defNode(o.a, o.tokA); defNode(o.b, o.tokB);
        claim(o.a); claim(o.b);
        edges.push({from: o.a, to: o.b, label: o.label});
      }
      continue;
    }
    /* bare definition line: one node token filling the line */
    if (spans.length === 1 && spans[0].start === 0) {
      defNode(spans[0].key, spans[0].tok);
      claim(spans[0].key);
    }
  }
  if (!nodes.size) return null;
  return {nodes: [...nodes.values()], edges, groups, direction};
}

/** Turn a MermaidImport into board nodes/edges with fresh ids, laid out in a
 *  simple column grid (TB: columns of 4; LR: rows). The caller re-ids if it
 *  wants — these ids are namespaced `mm` so they cannot collide. */
export function mermaidToGraph(parsed: MermaidImport, startId: number, width = 210, height = 96, gapX = 60, gapY = 60): {nodes: Node[]; edges: Edge[]; nextId: number} {
  let id = startId;
  const pos = new Map<string, {x: number; y: number}>();
  const colH = 4;
  let i = 0;
  for (const n of parsed.nodes) {
    const col = Math.floor(i / colH);
    const row = i % colH;
    pos.set(n.key, parsed.direction === 'LR'
      ? {x: row * (width + gapX), y: col * (height + gapY)}
      : {x: col * (width + gapX), y: row * (height + gapY)});
    i++;
  }
  const nodes: Node[] = parsed.nodes.map(n => ({
    id: `mm${id++}`,
    type: n.shape === 'group' ? 'goblin' : 'goblin',
    position: pos.get(n.key)!,
    data: {shape: n.shape, kicker: '', title: n.label, sub: '', metric: '', metricUnit: ''},
  }));
  const byKey = new Map(parsed.nodes.map(n => [n.key, `mm${startId + parsed.nodes.indexOf(n)}`]));
  const edges: Edge[] = parsed.edges.map(e => ({
    id: `me${id++}`,
    source: byKey.get(e.from)!,
    target: byKey.get(e.to)!,
    type: 'goblinEdge',
    data: {label: e.label},
  })).filter(e => e.source && e.target);
  return {nodes, edges, nextId: id};
}
