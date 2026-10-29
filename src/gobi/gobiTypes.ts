/* ROUND GOBI-1 — the .gobi language types + shared vocabulary tables.
 * SPEC-gobi-language.md §2/§3.4. Importable from browser AND node
 * (the blog/headless doors), like the rest of src/gobi/. Since ROUND
 * GOBI-LOCK the vocabulary arrays are DERIVED from the shipped registries
 * (palette, presets, flow icons, themes, edge flow kinds) — see the
 * vocabulary section; colours and icons stay leaf lookups resolved by the
 * validator. */

import {COLOR_KEYS} from '../colors';
import {PALETTE} from '../palette';
import {FLOWCHART_PALETTE} from '../presets/flowchart';
import {TABLE_PALETTE_ITEM, SEQUENCE_PALETTE} from '../presets/dataStorage';
import {SEQUENCE_ENABLED} from '../presets/basic';
import {FLOW_ICON_PATHS} from '../nodes/flowIcons';
import {THEME_IDS} from '../theme';
import {EDGE_FLOW_KINDS} from '../edges/edgeData';

/* ------------------------------------------------------------------ tokens */

export type GobiTokenType =
  | 'ident' | 'string' | 'number' | 'arrow' | 'card' | 'dotdot'
  | '{' | '}' | ';' | ':' | '=';

export type GobiToken = {
  type: GobiTokenType;
  /** ident/string: the decoded text · number: the value · arrow: the operator. */
  value: string | number;
  /** 1-based source position of the token's first character. */
  line: number;
  col: number;
};

/** Thrown by the lexer on the two lexical refusals; converted to a GobiError
 *  by parseGobi so callers only ever see the error-array shape. */
export class GobiLexError extends Error {
  line: number;
  col: number;
  constructor(line: number, col: number, message: string) {
    super(message);
    this.line = line;
    this.col = col;
  }
}

/* --------------------------------------------------------------------- AST */

export type GobiNodeKind =
  /* architecture shapes */
  | 'service' | 'database' | 'queue' | 'external' | 'actor' | 'storage'
  | 'gateway' | 'note' | 'group'
  /* flowchart shapes */
  | 'terminator' | 'process' | 'decision' | 'io' | 'document' | 'subprocess'
  | 'manual' | 'delay' | 'connector' | 'preparation' | 'offpage'
  | 'manualinput' | 'display' | 'storeddata' | 'looplimit' | 'internalstorage'
  /* non-shape kinds */
  | 'table' | 'text';

export type GobiAttrKey = 'sub' | 'icon' | 'color' | 'kicker';

/** v1 node attrs; values are decoded strings (idents need no quotes, free
 *  text does — the spec's quoting rule). */
export type GobiAttrs = Partial<Record<GobiAttrKey, string>>;

export type GobiColumn = {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  notNull: boolean;
  unique: boolean;
  line: number;
};

export type GobiNodeStmt = {
  kind: 'node';
  id: string;
  nodeKind: GobiNodeKind;
  /** The Shape id when nodeKind is a real shape; null for table/text. */
  shape: string | null;
  /** Quoted title, or null (title defaults to the identifier). */
  title: string | null;
  attrs: GobiAttrs;
  columns?: GobiColumn[];
  line: number;
  col: number;
};

export type GobiEdgeStmt = {
  kind: 'edge';
  from: string;
  to: string;
  op: '->' | '..>' | '-.>';
  label: string | null;
  /** Explicit dash keyword wins over the operator (spec §2.4). */
  dash: 'solid' | 'dashed' | 'dotted' | null;
  flow: string | null;
  flowIcon: string | null;
  flowCount: number | null;
  card: string | null;
  techn: string | null;
  x: number;
  line: number;
  col: number;
};

export type GobiGroupStmt = {
  kind: 'group';
  id: string;
  title: string | null;
  attrs: GobiAttrs;
  line: number;
  col: number;
};

export type GobiMembershipStmt = {
  kind: 'membership';
  group: string;
  members: {id: string; line: number; col: number}[];
  line: number;
  col: number;
};

export type GobiStatement = GobiNodeStmt | GobiEdgeStmt | GobiGroupStmt | GobiMembershipStmt;

export type GobiAst = {
  board: {name: string; line: number} | null;
  direction: 'TB' | 'LR';
  theme: string | null;
  statements: GobiStatement[];
};

/* ------------------------------------------------------------------ errors */

/** §3.4 — every compile error: 1-based line/col of the offending token. */
export type GobiError = {line: number; col: number; message: string; hint?: string};

export type GobiParseResult =
  | {ok: true; ast: GobiAst}
  | {ok: false; ast: GobiAst | null; errors: GobiError[]};

/* -------------------------------------------------------------- vocabulary */

/* ROUND GOBI-LOCK (Harvey, 2026-10-28: "generate chỉ được phép dựa vào shape
 * đã được publish theo gobigrams, không được vượt ngoài khuôn khổ") — the kind
 * vocabulary is DERIVED from the shipped registries at module load, never
 * hand-listed. The rule, per registry item (SPEC §2.3):
 *   · a `goblin` item's kind word is its Shape id (service, terminator, …);
 *   · the Text item (`kind: 'label'`) is the `text` kind — a caption node;
 *   · the Table item is the `table` kind — a column-list node type, not a Shape;
 *   · duplicate rows are skipped, first wins (Lane = Group's `group`; the ERD
 *     enum Note = the shared `note`).
 * KIND_LABEL (the compiler's kind → palette-label map) is derived the same way
 * in gobiCompiler.ts, from the SAME registry lists — one derivation, no second
 * restatement. Adding a shape to the canvas (a new palette item with a new
 * Shape id) is what adds it to the language; the language can never gain a
 * kind with no shipped shape behind it, and no shipped shape can go unspoken
 * unless it is on GOBI_HIDDEN_SHAPES below. checks/round-gobi-lock.mjs holds
 * the lock in both directions. */

/** Registry items the compiler itself resolves kinds through — the ONE union
 * (PALETTE and FLOWCHART_PALETTE stay unfiltered by the create-surface gates:
 * the flags only gate LIBRARY, so the language speaks the full vocabulary
 * whatever the UI currently offers). */
const KIND_ITEMS = [...PALETTE, ...FLOWCHART_PALETTE, TABLE_PALETTE_ITEM];

/** kind word → the palette item it resolves to. `text`/`table` are kinds
 * without a Shape of their own; every other kind word IS the item's Shape id. */
export const GOBI_KIND_ITEM: Record<string, {label: string; shape: string | null; kind: string}> = {};
for (const p of KIND_ITEMS) {
  const word: string | null =
    p.kind === 'label' ? 'text'
    : p.label === 'Table' ? 'table'
    : p.label === 'Lane' || p.label === 'Note (enum)' ? null
    : String(p.shape);
  if (word !== null && GOBI_KIND_ITEM[word] === undefined) {
    GOBI_KIND_ITEM[word] = {label: p.label, shape: word === 'text' || word === 'table' ? null : word, kind: p.kind};
  }
}

/** The §2.3 kind vocabulary — DERIVED. The hand-written parts are ONLY the
 * human-readable groupings for the "list the valid kinds" error: the five
 * category labels and the palette-category → group-label table below (labels
 * group kinds for the error message; they never define WHICH kinds exist —
 * membership comes from the registries alone, and an unmapped registry
 * category makes its kinds fall out of GOBI_KINDS, which the lock harness
 * catches as a red L2). */
export const GOBI_SHAPE_CATEGORIES: {label: string; kinds: string[]}[] = [
  {label: 'architecture', kinds: []},
  {label: 'flowchart', kinds: []},
  {label: 'groups', kinds: []},
  {label: 'annotations', kinds: []},
  {label: 'data', kinds: []},
];
{
  /* Registry palette category → the error-message group. The sequence and C4
   * categories are deliberately unmapped: their pieces are either hidden
   * (sequence — GOBI_HIDDEN_SHAPES) or reach the canvas only through the same
   * shapes the architecture kinds already speak (C4 items reuse actor /
   * service / database / queue / storage / external / group). */
  const GROUP_OF: Record<string, string> = {
    architecture: 'architecture', 'data-storage': 'architecture', basic: 'annotations',
    flowchart: 'flowchart', groups: 'groups', annotations: 'annotations', entities: 'data',
  };
  const byLabel = new Map(GOBI_SHAPE_CATEGORIES.map((c) => [c.label, c.kinds]));
  for (const [word, item] of Object.entries(GOBI_KIND_ITEM)) {
    const src = KIND_ITEMS.find((p) => p.label === item.label);
    const group = src ? GROUP_OF[src.category] : undefined;
    if (group && !byLabel.get(group)!.includes(word)) byLabel.get(group)!.push(word);
  }
}

export const GOBI_KINDS: string[] = GOBI_SHAPE_CATEGORIES.flatMap((c) => c.kinds);

/** Shapes the language deliberately does not speak (GOBI-LOCK). Every entry
 * must carry its reason and must be GENUINELY unplaceable — an entry for a
 * shape a user CAN place is a bug (round-gobi-lock L2e fails on it):
 *   · lifeline/activation/fragment — the UML sequence pieces are HIDDEN from
 *     every create surface (SEQUENCE_ENABLED = false, src/presets/basic.ts);
 *     the language does not speak a hidden vocabulary (SPEC OQ-2). When the
 *     sequence preset ships, give them kinds and DELETE them from here. */
export const GOBI_HIDDEN_SHAPES: string[] = SEQUENCE_ENABLED
  ? [] as string[]
  : SEQUENCE_PALETTE.map((p) => String(p.shape));

export const GOBI_COLOR_KEYS: string[] = [...COLOR_KEYS];

/** The edge-flow vocabulary — the ONE union EdgeData.flow already carries
 * (src/edges/edgeData.ts); deriving it here keeps the language's flow: words
 * pinned to the animation set the canvas actually renders. */
export const GOBI_FLOW_KINDS: string[] = [...EDGE_FLOW_KINDS];

/** The flowIcon: vocabulary — the keys of the ONE glyph table (flowIcons.tsx);
 * a word the travelling chip cannot draw is refused. */
export const GOBI_FLOW_ICONS: string[] = Object.keys(FLOW_ICON_PATHS);

/** theme: — the five shipped board themes (theme.ts), never 'system' (a .gobi
 * document suggests a concrete theme; the user's OS preference is not one). */
export const GOBI_THEMES: string[] = [...THEME_IDS];

/** The valid `icon:` vocabulary (lucide names) — resolved by the VALIDATOR
 *  (gobiValidator.ts) from the real ICON_NAMES table so the two cannot drift. */
export const GOBI_ICON_NAMES: string[] = [];

export const GOBI_CARD_TOKENS: Record<string, string> = {
  '1': 'one', n: 'many', '0..1': 'zeroOrOne', '0..n': 'zeroOrMany',
};

/* ------------------------------------------------------------- suggestions */

/** Plain Levenshtein (the spec's ≤ 2 suggestion budget is applied by callers). */
export function gobiLevenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({length: n + 1}, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** Closest vocabulary word within distance 2 (first on ties — deterministic),
 *  or null when nothing is close enough (caller lists the categories instead). */
export function gobiSuggest(word: string, words: string[]): string | null {
  let best: string | null = null;
  let bestD = 3; // > the suggestion budget
  for (const w of words) {
    const d = gobiLevenshtein(word, w);
    if (d < bestD) { bestD = d; best = w; }
  }
  return best;
}

/** The §3.4 "valid kinds by category" listing for hopeless spellings. */
export function gobiKindList(): string {
  return GOBI_SHAPE_CATEGORIES.map((c) => `${c.label} (${c.kinds.join(', ')})`).join(' · ');
}

/** Closest shipped kind by plain Levenshtein, no cutoff (GOBI-FIX2); first on
 * ties in GOBI_KINDS order. A SUGGESTION string only — the input stays
 * refused; the vocabulary stays closed (no aliases, ever). */
export function closestGobiKind(word: string): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const k of GOBI_KINDS) {
    const d = gobiLevenshtein(word, k);
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

/** ROUND GOBI-HINT (2026-10-29) — curated suggestions for the role words
 * users actually type, where Levenshtein lands on a nonsense neighbour
 * (measured pre-fix: postgres -> "note", kafka -> "manual", redis -> "io").
 * HINTS ONLY — never accepted as a kind. Consulted BEFORE the distance
 * metric when building the suggestion TEXT; the input word stays refused,
 * and no curated word ever reaches the compiler as a valid kind. */
export const GOBI_KIND_HINTS: Record<string, string> = {
  producer: 'actor',
  broker: 'queue',
  consumer: 'service',
  kafka: 'queue',
  redis: 'database',
  postgres: 'database',
  lambda: 'process',
  server: 'service',
};

/** The suggestion for an unknown kind word (GOBI-HINT): the curated hint
 * when its target is still a shipped kind, otherwise the GOBI-FIX2 distance
 * pick — so a retired target degrades to the distance suggestion instead of
 * naming a kind that does not exist. Text only; callers keep the word
 * refused. */
export function gobiKindHint(word: string): string | null {
  const curated = GOBI_KIND_HINTS[word];
  return curated !== undefined && GOBI_KINDS.includes(curated)
    ? curated
    : closestGobiKind(word);
}
