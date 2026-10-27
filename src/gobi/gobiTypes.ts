/* ROUND GOBI-1 — the .gobi language types + shared vocabulary tables.
 * SPEC-gobi-language.md §2/§3.4. No runtime imports beyond the colour list and
 * the icon names (both leaf vocabularies) — this module is importable from
 * browser AND node (the blog/headless doors), like the rest of src/gobi/. */

import {COLOR_KEYS} from '../colors';

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

/** The §2.3 kind vocabulary, grouped for the "list the valid kinds" error. */
export const GOBI_SHAPE_CATEGORIES: {label: string; kinds: string[]}[] = [
  {label: 'architecture', kinds: ['service', 'database', 'queue', 'external', 'actor', 'storage', 'gateway']},
  {label: 'flowchart', kinds: ['terminator', 'process', 'decision', 'io', 'document', 'subprocess', 'manual', 'delay', 'connector', 'preparation', 'offpage', 'manualinput', 'display', 'storeddata', 'looplimit', 'internalstorage']},
  {label: 'groups', kinds: ['group']},
  {label: 'annotations', kinds: ['note', 'text']},
  {label: 'data', kinds: ['table']},
];

export const GOBI_KINDS: string[] = GOBI_SHAPE_CATEGORIES.flatMap((c) => c.kinds);

export const GOBI_COLOR_KEYS: string[] = [...COLOR_KEYS];

export const GOBI_FLOW_KINDS = ['none', 'dots', 'dash', 'pulse', 'icon'];

export const GOBI_FLOW_ICONS = ['mail', 'package', 'file', 'zap', 'settings', 'database'];

export const GOBI_THEMES = ['dark', 'light', 'paper', 'midnight', 'contrast'];

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
