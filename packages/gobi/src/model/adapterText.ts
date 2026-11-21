/* UNISURF-S1 (SPEC-UNIFIED-SURFACE §1/§9 step 1, 2026-11-08) — the TEXT
 * ADAPTER: BoardDoc → `.gobi` source. The ONE serialiser; until this file the
 * pipeline could only READ the language (compileGobi → toBoardDoc), so the
 * code pane had nothing to show. It is the exact inverse door of
 * adapterCanvas.toBoardDoc and lives beside it for the same reason: only this
 * file knows how a canvas node reads as a declaration line.
 *
 * CONTRACT (the spec's closed world — the output must NEVER be a document
 * compileGobi rejects):
 *   · every emitted word is vocabulary the parser/validator already accepts:
 *     kind words come from GOBI_KINDS, colors from GOBI_COLOR_KEYS, icons from
 *     the lucide ICON_NAMES table, align/valign from gobiText, flow words from
 *     the flow registries, dash from EDGE_DASH's own values;
 *   · nodes whose RF type/shape is outside the vocabulary (customshape, a
 *     hidden sequence piece) are NEVER emitted — they count in `skipped`, and
 *     an edge touching one is dropped with them (an edge to an undeclared id
 *     would not compile);
 *   · strings are quoted with the lexer's own two escapes (\ and ") — nothing
 *     else — and line breaks inside a label become spaces (a .gobi string
 *     cannot span lines);
 *   · emission is DETERMINISTIC: canonical id order for nodes and group
 *     members, stored order for columns, a fixed attr order, attrs only when
 *     they differ from the palette factory the drag path seeds — so
 *     serialising the board a compile produced reproduces the same text
 *     byte-for-byte (H1 idempotence, checks/unisurf-serialise.mjs).
 *
 * What a text round-trip loses on purpose (spec §1 loss list): edge identity
 * (bends, pinned label offsets — the grammar has no words for them), the
 * table collapsed/__showMode flags, node rotation, z-order and positions. */

import type {BoardDoc} from './boardDoc';
import type {FlowEdge, FlowNode} from './flowTypes';
import {PALETTE, type PaletteItem} from './palette';
import {FLOWCHART_PALETTE} from './presets/flowchart';
import {TABLE_PALETTE_ITEM} from './presets/dataStorage';
import {EDGE_DASH} from './presets/basic';
import {GOBI_CARD_TOKENS, GOBI_COLOR_KEYS, GOBI_FLOW_ICONS, GOBI_FLOW_KINDS, GOBI_KINDS} from '../gobiTypes';
import {GOBI_ALIGN_DEFAULT, GOBI_ALIGN_VALUES, GOBI_VALIGN_DEFAULT, GOBI_VALIGN_VALUES} from '../gobiText';
import {ICON_NAMES} from '../iconNames';

/** Same registry union adapterCanvas resolves kinds through — the ONE table
 * (ROUND GOBI-LOCK); the serialiser must answer "what does this shape read
 * as" with the same rows the parser answers "what does this word mean". */
const ITEMS: PaletteItem[] = [...PALETTE, ...FLOWCHART_PALETTE, TABLE_PALETTE_ITEM];

/** shape word → palette item (factory defaults live on its make()). */
const itemFor = (shape: string): PaletteItem | undefined => {
  for (const p of ITEMS) if (String(p.shape) === shape && p.kind === 'goblin') return p;
  return undefined;
};

/* ------------------------------------------------------------- quoting --- */

/** The lexer's ident shape — anything else is emitted as a quoted name. */
const IDENT = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/** Exactly the two escapes the lexer understands, plus the line-break fold
 * (a .gobi string may not span lines). Unrepresentable content degrades to a
 * space rather than producing a rejected document. */
const esc = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');
const str = (s: string): string => `"${esc(s)}"`;
/** Bare ident when legal, quoted name otherwise (ids, attr values, members). */
const word = (s: string): string => (IDENT.test(s) ? s : str(s));

/* --------------------------------------------------- inverse vocab tables */

/** strokeDasharray value → the `dashed`/`dotted` keyword (EDGE_DASH inverted;
 * solid is undefined there and stays unspoken — it is the default). */
export const DASH_WORD: Record<string, string> = {};
for (const [w, pattern] of Object.entries(EDGE_DASH)) if (pattern) DASH_WORD[pattern] = w;

/** marker.type (a CrowFoot word) → the cardinality token ('one' → '1', …). */
const CROW_WORD: Record<string, string> = {};
for (const [token, crow] of Object.entries(GOBI_CARD_TOKENS)) CROW_WORD[crow] = token;

export const crowOf = (m: FlowEdge['markerEnd'] | FlowEdge['markerStart']): string | null =>
  m !== null && typeof m === 'object' ? CROW_WORD[(m as {type?: string}).type ?? ''] ?? null : null;

/* ------------------------------------------------------------ node line --- */

type Columnish = {id?: string; name?: string; type?: string; pk?: boolean; fk?: boolean; notNull?: boolean; unique?: boolean; ref?: string};

/** The align/valign attrs every non-table kind carries via data.textStyle —
 * emitted only when they differ from the LANGUAGE's own defaults (center /
 * middle), so a compiled node re-emits to the same line. */
const pushTextAttrs = (attrs: string[], ts: unknown): void => {
  const s = (ts ?? {}) as {align?: unknown; vAlign?: unknown};
  if (typeof s.align === 'string' && s.align !== GOBI_ALIGN_DEFAULT && GOBI_ALIGN_VALUES.includes(s.align)) {
    attrs.push(`align:${s.align}`);
  }
  if (typeof s.vAlign === 'string' && s.vAlign !== GOBI_VALIGN_DEFAULT && GOBI_VALIGN_VALUES.includes(s.vAlign)) {
    attrs.push(`valign:${s.vAlign}`);
  }
};

/** One node's declaration + column lines, or null when the node is outside
 * the vocabulary (the caller counts it in `skipped`). */
const classify = (n: FlowNode): {head: string; cols: {line: string; colId?: string}[]} | null => {
  const d = (n.data ?? {}) as Record<string, unknown>;

  /* table — the language's own default colour is cyan, resolved on the doc. */
  if (n.type === 'table') {
    const attrs: string[] = [];
    const color = typeof d.colorKey === 'string' ? d.colorKey : '';
    if (color !== 'cyan' && GOBI_COLOR_KEYS.includes(color)) attrs.push(`color:${color}`);
    const columns: Columnish[] = Array.isArray(d.columns) ? (d.columns as Columnish[]) : [];
    const cols = columns.map((c) => {
      /* UNISURF-S7 — ref:<target id> closes the loop the drag opened; the
       * author's TYPE is never rewritten (fk is a flag, not a type). */
      const flags = [
        c.pk ? 'pk' : '', c.fk ? 'fk' : '', c.notNull ? 'notnull' : '', c.unique ? 'unique' : '',
        c.ref ? `ref:${word(String(c.ref))}` : '',
      ].filter(Boolean).join(' ');
      const line = `  ${word(String(c.name ?? ''))} ${word(String(c.type ?? ''))}${flags ? ` ${flags}` : ''};`;
      return typeof c.id === 'string' ? {line, colId: c.id} : {line};
    });
    const tail = attrs.length ? ` ${attrs.join(' ')}` : '';
    return {head: `${word(n.id)} = table ${str(String(d.name ?? n.id))}${tail} {`, cols};
  }

  /* text — the caption kind (RF 'label' nodes carry no card attrs at all). */
  if (n.type === 'label') {
    const attrs: string[] = [];
    pushTextAttrs(attrs, d.textStyle);
    const tail = attrs.length ? ` ${attrs.join(' ')}` : '';
    return {head: `${word(n.id)} = text ${str(String(d.text ?? n.id))}${tail}`, cols: []};
  }

  /* shapes — the kind word IS the node's data.shape (GOBI-LOCK); anything the
     language does not speak is unserialisable. */
  if (n.type !== 'goblin' && n.type !== undefined) return null;
  const kind = typeof d.shape === 'string' ? d.shape : '';
  if (!GOBI_KINDS.includes(kind) || kind === 'table' || kind === 'text') return null;

  const def = (itemFor(kind)?.make() ?? {}) as Record<string, unknown>;
  const attrs: string[] = [];
  /* Factory-equal values stay unspoken: the drag path seeds the same defaults
     through make(), so "differs from the factory" IS "the author wrote it" —
     and an unemitted attr re-derives to the same value next generation. */
  if (typeof d.kicker === 'string' && d.kicker && d.kicker !== def.kicker) attrs.push(`kicker:${word(d.kicker)}`);
  if (typeof d.sub === 'string' && d.sub) attrs.push(`sub:${word(d.sub)}`);
  if (typeof d.icon === 'string' && d.icon && d.icon !== def.icon && ICON_NAMES.includes(d.icon)) {
    attrs.push(`icon:${word(d.icon)}`);
  }
  const color = typeof d.colorKey === 'string' ? d.colorKey : '';
  if (color && color !== def.colorKey && GOBI_COLOR_KEYS.includes(color)) attrs.push(`color:${color}`);
  /* body: only the card kinds take it (the validator refuses it on
     note/group), and only when it differs from the content-derived default —
     the compiler re-derives "a sub or a kicker buys the card shell" from the
     attrs emitted above, so the unspoken case reproduces itself. */
  if (kind !== 'note' && kind !== 'group') {
    const body = d.body === 'card' ? 'card' : d.body === 'label-only' ? 'simple' : '';
    const derived = attrs.some((a) => a.startsWith('kicker:') || a.startsWith('sub:')) ? 'card' : 'simple';
    if (body && body !== derived) attrs.push(`body:${body}`);
  }
  pushTextAttrs(attrs, d.textStyle);

  const tail = attrs.length ? ` ${attrs.join(' ')}` : '';
  return {head: `${word(n.id)} = ${kind} ${str(String(d.title ?? n.id))}${tail}`, cols: []};
};

/* ------------------------------------------------------------ edge line --- */

const edgeLine = (e: FlowEdge): string => {
  const d = (e.data ?? {}) as Record<string, unknown>;
  const parts: string[] = [word(e.source), '->', word(e.target)];
  if (typeof e.label === 'string' && e.label) parts.push(str(e.label));
  if (typeof d.techn === 'string' && d.techn) parts.push(`techn:${str(d.techn)}`);
  const cardL = crowOf(e.markerStart);
  const cardR = crowOf(e.markerEnd);
  if (cardL && cardR) parts.push(`card:${cardL}..${cardR}`);
  const dash = DASH_WORD[e.style?.strokeDasharray ?? ''];
  if (dash) parts.push(dash);
  if (typeof d.flow === 'string' && GOBI_FLOW_KINDS.includes(d.flow)) parts.push(`flow:${d.flow}`);
  if (typeof d.flowIcon === 'string' && GOBI_FLOW_ICONS.includes(d.flowIcon)) parts.push(`flowIcon:${d.flowIcon}`);
  if (typeof d.flowCount === 'number' && Number.isInteger(d.flowCount)) parts.push(`flowCount:${d.flowCount}`);
  return parts.join(' ');
};

/* --------------------------------------------------------------- public --- */

/** UNISURF-S2 — the ids a text commit may DELETE: exactly the nodes the
 * serialiser would emit (classify !== null). The merge (mergeGobi.ts) asks
 * this question here, never re-derives the vocabulary, so "skipped" means
 * one thing on both sides of the round-trip. */
export function emittableNodeIds(doc: BoardDoc): Set<string> {
  const ids = new Set<string>();
  for (const n of doc.nodes) if (classify(n)) ids.add(n.id);
  return ids;
}

export type BoardDocToGobiResult = {
  /** The generated `.gobi` source (newline-terminated). */
  text: string;
  /** 1-based line of every emitted declaration ("<nodeId>") and table column
   * ("<nodeId>:<colId>"). Header/membership/edge lines map nothing. */
  lineOf: Map<string, number>;
  /** Nodes outside the vocabulary — never emitted, never lost by a commit. */
  skipped: number;
};

export function boardDocToGobi(doc: BoardDoc): BoardDocToGobiResult {
  const lines: string[] = [`board ${str(doc.name)}`];
  const lineOf = new Map<string, number>();
  const emitted = new Set<string>();
  let skipped = 0;

  /* EMISSION ORDER — canonically by id, NOT the board array order. Measured
   * proof (UNISURF-S1, 2026-11-08): compileGobi emits its doc nodes sorted by
   * absolute (y, x), layout depends on `direction`, and BoardDoc cannot carry
   * direction — so a compile of board-ordered text re-sorts differently
   * (fanout-c: authored LR, re-compiled as the TB default) and the second
   * generation differs by line 4. Array order is not a fixpoint for ANY board
   * whose node order differs from the compile's reading order (every
   * hand-placed board included). Id order is a pure function of stable
   * content, so gen2 === gen1 for every input board — the idempotence H1
   * asserts. Reading order in the pane is the price; it is flagged to the
   * architect (the cure would be a direction field on BoardDoc, S2+ scope). */
  const order = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

  /* declarations — every vocabulary node, in canonical id order. */
  for (const n of [...doc.nodes].sort((x, y) => order(x.id, y.id))) {
    const decl = classify(n);
    if (!decl) { skipped++; continue; }
    emitted.add(n.id);
    lineOf.set(n.id, lines.length + 1);
    lines.push(decl.head);
    for (const c of decl.cols) {
      if (c.colId === undefined) continue;
      lineOf.set(`${n.id}:${c.colId}`, lines.length + 1);
      lines.push(c.line);
    }
    /* the table block's closing brace (a lone line: it maps nothing in
       lineOf — an error on it belongs to the whole block, not one column). */
    if (n.type === 'table') lines.push('}');
  }

  /* memberships — one block per group, canonical on BOTH axes (group id,
     member ids: the compiler's pack order inside a group is layout-derived
     and flips with direction exactly like node order); the group is already
     declared above, so the block parses. Members that were skipped (out of
     vocabulary) simply do not appear. */
  const membersOf = new Map<string, string[]>();
  for (const n of doc.nodes) {
    if (n.parentId && emitted.has(n.parentId) && emitted.has(n.id)) {
      const list = membersOf.get(n.parentId);
      if (list) list.push(n.id);
      else membersOf.set(n.parentId, [n.id]);
    }
  }
  for (const group of [...membersOf.keys()].sort(order)) {
    lines.push(`${word(group)} { ${membersOf.get(group)!.sort(order).map(word).join(' ')} }`);
  }

  /* edges — after every declaration (endpoints must be declared-before-use);
     an edge touching a skipped node cannot be spoken and is dropped. */
  for (const e of doc.edges) {
    if (emitted.has(e.source) && emitted.has(e.target)) lines.push(edgeLine(e));
  }

  return {text: `${lines.join('\n')}\n`, lineOf, skipped};
}
