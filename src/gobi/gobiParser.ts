/* ROUND GOBI-1 — the .gobi parser (SPEC §2.2 EBNF). Recursive descent, line-
 * oriented outside blocks (one statement per line), newline-agnostic inside
 * `{}` blocks. Error-recovering: a bad line records a GobiError and the parse
 * resumes at the next line, so ONE pass reports ALL bad lines (§3.1 step 2).
 *
 * Contextual keywords: `board`/`direction`/`theme` are only headers when they
 * start a line; `"note" = service` is a node NAMED note (SPEC §2.1).
 *
 * The parser itself owns the checks that need no cross-line semantics beyond
 * the declaration table it maintains as it goes:
 *   · duplicate declaration ids (spec-exact wording),
 *   · `{` blocks only on declared groups (and closed by `}`),
 *   · edge endpoints already declared.
 * Everything else (shape/color/icon/flow vocab, membership duplicates, group
 * cycles, emptiness) is the validator's — EXCEPT vocabulary the grammar pins
 * (direction/theme values, attr keys, card tokens), which the parser rejects
 * with suggestions because it is the only place the token is in hand. */

import {lexGobi} from './gobiLexer';
import {
  GobiLexError,
  GOBI_KINDS,
  GOBI_COLOR_KEYS,
  GOBI_FLOW_KINDS,
  GOBI_FLOW_ICONS,
  GOBI_THEMES,
  GOBI_CARD_TOKENS,
  gobiSuggest,
  gobiKindList,
  type GobiAst,
  type GobiError,
  type GobiEdgeStmt,
  type GobiMembershipStmt,
  type GobiNodeKind,
  type GobiStatement,
  type GobiToken,
} from './gobiTypes';

const SHAPE_KINDS = new Set<string>(GOBI_KINDS);
const ATTR_KEYS = new Set(['sub', 'icon', 'color', 'kicker']);
const EDGE_TAIL_KEYWORDS = new Set(['dashed', 'dotted', 'solid', 'flow', 'flowIcon', 'flowCount', 'card', 'techn', 'x']);

type Declared = {kind: 'node' | 'group' | 'table' | 'text'; line: number};

export function parseGobi(text: string): {ok: true; ast: GobiAst} | {ok: false; ast: GobiAst | null; errors: GobiError[]} {
  const errors: GobiError[] = [];
  let tokens: GobiToken[];
  try {
    tokens = lexGobi(text);
  } catch (e) {
    if (e instanceof GobiLexError) {
      return {ok: false, ast: null, errors: [{line: e.line, col: e.col, message: e.message.replace(/^line \d+: /, '')}]};
    }
    throw e;
  }

  const ast: GobiAst = {board: null, direction: 'TB', theme: null, statements: []};
  const declared = new Map<string, Declared>();
  let sawStatement = false; // board must be the FIRST statement (before any other)

  const err = (t: {line: number; col: number}, message: string, hint?: string) => {
    errors.push({line: t.line, col: t.col, message, ...(hint ? {hint} : {})});
  };

  let p = 0;
  const peek = (): GobiToken | undefined => tokens[p];
  const at = (type: string, value?: string): boolean => {
    const t = tokens[p];
    return !!t && t.type === type && (value === undefined || t.value === value);
  };
  const next = (): GobiToken | undefined => tokens[p++];
  /** Skip to the first token on a LATER line (error recovery, §3.1). */
  const skipToNextLine = () => {
    if (p === 0) { p++; return; }
    const t = tokens[p - 1];
    if (!t) return;
    while (p < tokens.length && tokens[p]!.line === t.line) p++;
  };

  /* ---------------- statement dispatch (one per line, outside blocks) ----- */

  while (p < tokens.length) {
    const t = peek()!;
    if (t.type !== 'ident' && t.type !== 'string') {
      err(t, `"${String(t.value)}" cannot start a statement`);
      next(); skipToNextLine();
      continue;
    }
    parseStatementLine();
  }

  function parseStatementLine() {
    const first = peek()!;
    const line = first.line;
    const nxt = tokens[p + 1];

    // board statement — must be the FIRST statement; `board = …` is a node NAMED board
    if (first.type === 'ident' && first.value === 'board' && nxt?.type !== '=' && nxt?.type !== ':' && nxt?.type !== 'arrow' && nxt?.type !== '{') {
      p++;
      if (!at('string')) {
        err(tokens[p] ?? first, 'board needs a quoted name: board "Untitled"');
        skipToNextLine(); return;
      }
      if (sawStatement) {
        err(first, 'the board statement must come first — move it above every node, edge and group');
      }
      ast.board = {name: String(next()!.value), line};
      sawStatement = true;
      endOfStatement(line);
      return;
    }
    if (first.type === 'ident' && first.value === 'direction' && nxt?.type !== '=') {
      p++;
      if (at('ident', 'TB') || at('ident', 'LR')) {
        ast.direction = String(next()!.value) as 'TB' | 'LR';
      } else {
        err(tokens[p] ?? first, 'direction must be TB or LR (top-down is the default)');
        if (at('ident')) next();
      }
      sawStatement = true;
      endOfStatement(line);
      return;
    }
    if (first.type === 'ident' && first.value === 'theme' && nxt?.type !== '=') {
      p++;
      if (at('ident') && GOBI_THEMES.includes(String(peek()!.value))) {
        ast.theme = String(next()!.value);
      } else {
        err(tokens[p] ?? first, `theme must be one of: ${GOBI_THEMES.join(', ')}`);
        if (at('ident')) next();
      }
      sawStatement = true;
      endOfStatement(line);
      return;
    }

    // string-named declaration: "order items" = service
    if (first.type === 'string') {
      const name = String(next()!.value);
      if (!at('=')) {
        err(tokens[p] ?? first, `expected "=" after the quoted name "${name}"`);
        skipToNextLine(); return;
      }
      next();
      parseDeclAfterEq(name, first, false);
      sawStatement = true;
      return;
    }

    // ident-led: declaration / edge / membership block
    const id = next()!;
    const idv = String(id.value);

    if (at('=')) {
      next();
      parseDeclAfterEq(idv, id, true);
      sawStatement = true;
      return;
    }

    if (at('arrow')) {
      parseEdge(id, idv, line);
      sawStatement = true;
      return;
    }

    if (at('{')) {
      parseMembership(id, idv, line);
      sawStatement = true;
      return;
    }

    // a helpful quoting hint when the next word on the line is another name
    const followed = peek();
    const multiword = followed && followed.line === line && (followed.type === 'ident' || followed.type === 'string');
    err(tokens[p] ?? id, `expected "=" (declare), an arrow (connect) or "{" (group members) after "${idv}"${multiword ? ` — multi-word names need quotes: "${idv} ${String(followed!.value)}" = service` : ''}`);
    skipToNextLine();
  }

  /* ---------------- declarations: id = kind ... --------------------------- */

  function parseDeclAfterEq(id: string, idTok: GobiToken, bare: boolean) {
    const kindTok = peek();
    if (!kindTok || (kindTok.type !== 'ident' && kindTok.type !== 'string')) {
      err(kindTok ?? idTok, `expected a kind after "=" — e.g. ${id.includes(' ') ? `"${id}"` : id} = service`);
      skipToNextLine(); return;
    }
    const kindWord = String(kindTok.value);
    // quoted kind word is never a kind
    if (kindTok.type === 'string' || !SHAPE_KINDS.has(kindWord)) {
      const suggestion = kindTok.type === 'ident' ? gobiSuggest(kindWord, GOBI_KINDS) : null;
      if (suggestion) {
        err(kindTok, `I don't know the shape "${kindWord}". Did you mean "${suggestion}"?`);
      } else {
        err(kindTok, `I don't know the shape "${kindWord}". Valid kinds: ${gobiKindList()}`);
      }
      skipToNextLine(); return;
    }
    next();
    if (bare && declared.has(id)) {
      err(idTok, `"${id}" is declared twice. Rename one of them.`);
    }
    const nodeKind = kindWord as GobiNodeKind;
    declared.set(id, {kind: nodeKind === 'group' ? 'group' : nodeKind === 'table' ? 'table' : nodeKind === 'text' ? 'text' : 'node', line: idTok.line});

    const stmt: GobiStatement = {
      kind: 'node', id, nodeKind,
      shape: nodeKind === 'table' || nodeKind === 'text' ? null : nodeKind,
      title: null, attrs: {}, line: idTok.line, col: idTok.col,
    };
    ast.statements.push(stmt);

    // title (optional STRING)
    if (at('string')) stmt.title = String(next()!.value);

    // attrs (key : value)+
    parseAttrs(stmt, false);

    // table block
    if (at('{')) {
      if (nodeKind !== 'table') {
        err(peek()!, `only the table kind takes a { columns } block — "${id}" is a ${nodeKind}`);
        // consume the block so recovery resumes after it
        parseBlockRaw();
        return;
      }
      stmt.columns = parseTableBlock();
      return;
    }
    endOfStatement(idTok.line);
  }

  function parseAttrs(stmt: {attrs: Record<string, string>}, edge: boolean) {
    while (at('ident') && ATTR_KEYS.has(String(peek()!.value)) && tokens[p + 1]?.type === ':') {
      const keyTok = next()!; // key
      next(); // ':'
      const valTok = peek();
      if (!valTok || (valTok.type !== 'ident' && valTok.type !== 'string')) {
        err(valTok ?? keyTok, `${edge ? 'edge' : 'node'} attribute ${keyTok.value} needs a value`);
        skipToNextLine(); return;
      }
      next();
      stmt.attrs[String(keyTok.value)] = String(valTok.value);
      if (String(keyTok.value) === 'color' && valTok.type === 'ident' && !GOBI_COLOR_KEYS.includes(String(valTok.value))) {
        const sug = gobiSuggest(String(valTok.value), GOBI_COLOR_KEYS);
        err(valTok, sug
          ? `color "${valTok.value}" isn't a board colour. Did you mean "${sug}"?`
          : `color "${valTok.value}" isn't a board colour. Try: ${GOBI_COLOR_KEYS.join(', ')}.`);
      }
      if (String(keyTok.value) === 'kicker' && valTok.type === 'string' && String(valTok.value).includes(' ')) {
        // kicker is a single word by convention but a string is legal; no error.
      }
    }
  }

  function parseTableBlock() {
    next(); // '{'
    const cols: {name: string; type: string; pk: boolean; fk: boolean; notNull: boolean; unique: boolean; line: number}[] = [];
    while (p < tokens.length && !at('}')) {
      const nameTok = peek()!;
      if (nameTok.type === ';') { next(); continue; }
      if (nameTok.type !== 'ident' && nameTok.type !== 'string') {
        err(nameTok, `expected a column name inside the table block, got "${String(nameTok.value)}"`);
        skipToNextLine(); continue;
      }
      next();
      const typeTok = peek();
      if (!typeTok || (typeTok.type !== 'ident' && typeTok.type !== 'string')) {
        err(typeTok ?? nameTok, `column "${String(nameTok.value)}" needs a bare type (e.g. uuid, varchar)`);
        skipToNextLine(); continue;
      }
      next();
      const col = {name: String(nameTok.value), type: String(typeTok.value), pk: false, fk: false, notNull: false, unique: false, line: nameTok.line};
      // flags until ; or }
      while (!at(';') && !at('}')) {
        const f = peek();
        if (!f) break;
        if (f.type === 'ident' && f.value === 'pk') { col.pk = true; next(); }
        else if (f.type === 'ident' && f.value === 'fk') { col.fk = true; next(); }
        else if (f.type === 'ident' && f.value === 'notnull') { col.notNull = true; next(); }
        else if (f.type === 'ident' && f.value === 'unique') { col.unique = true; next(); }
        else {
          err(f, `"${String(f.value)}" is not a column flag — the flags are pk, fk, notnull, unique`);
          next();
          skipToNextLine();
          break;
        }
      }
      cols.push(col);
      if (at(';')) next();
    }
    if (!at('}')) {
      err(tokens[Math.min(p, tokens.length - 1)] ?? {line: 1, col: 1}, `the { block is never closed — add the missing "}"`);
      // recover: consume rest
      p = tokens.length;
    } else {
      next();
    }
    return cols;
  }

  /** Consume a `{ ... }` run without interpreting it (error recovery path). */
  function parseBlockRaw() {
    next(); // '{'
    let depth = 1;
    while (p < tokens.length && depth > 0) {
      const t = next()!;
      if (t.type === '{') depth++;
      if (t.type === '}') depth--;
    }
  }

  /* ---------------- membership blocks -------------------------------------- */

  function parseMembership(idTok: GobiToken, group: string, line: number) {
    const decl = declared.get(group);
    if (!decl) {
      err(idTok, `"${group}" is never declared. Declare the group first: ${group} = group "…"`);
      parseBlockRaw();
      return;
    }
    if (decl.kind !== 'group') {
      err(idTok, `"${group}" is a ${decl.kind}, not a group — only groups take a { members } block`);
      parseBlockRaw();
      return;
    }
    next(); // '{'
    const members: {id: string; line: number; col: number}[] = [];
    while (p < tokens.length && !at('}')) {
      const m = next();
      if (!m) break;
      if (m.type !== 'ident' && m.type !== 'string') {
        err(m, `expected a member id inside the block, got "${String(m.value)}"`);
        continue;
      }
      members.push({id: String(m.value), line: m.line, col: m.col});
    }
    if (!at('}')) {
      err(tokens[Math.min(p, tokens.length - 1)] ?? idTok, `the { block for "${group}" is never closed — add the missing "}"`);
      p = tokens.length;
    } else {
      next();
    }
    const stmt: GobiMembershipStmt = {kind: 'membership', group, members, line, col: idTok.col};
    ast.statements.push(stmt);
    // trailing content on the same line after } is tolerated (nothing legal follows)
  }

  /* ---------------- edges --------------------------------------------------- */

  function parseEdge(fromTok: GobiToken, from: string, line: number) {
    const opTok = next()!; // arrow
    const op = String(opTok.value) as GobiEdgeStmt['op'];
    const toTok = peek();
    if (!toTok || (toTok.type !== 'ident' && toTok.type !== 'string')) {
      err(toTok ?? opTok, `an edge needs a target after ${op}`);
      skipToNextLine(); return;
    }
    next();
    const to = String(toTok.value);
    for (const [id, idt] of [[from, fromTok], [to, toTok]] as const) {
      if (!declared.has(id)) {
        err(idt, `edge mentions "${id}", which is never declared. Declare it first: ${id} = service "…"`);
      }
    }
    const edge: GobiEdgeStmt = {
      kind: 'edge', from, to, op, label: null, dash: null,
      flow: null, flowIcon: null, flowCount: null, card: null, techn: null,
      x: 1, line, col: fromTok.col,
    };
    ast.statements.push(edge);

    // tail: STRING? (attr|keyword)* xN?  — all on the SAME line as the edge
    if (at('string') && peek()!.line === line) edge.label = String(next()!.value);
    let done = false;
    while (!done) {
      const t = peek();
      if (!t || t.line !== line) break; // end of the edge's line
      if (t.type === 'ident') {
        const w = String(t.value);
        if (w === 'dashed' || w === 'dotted' || w === 'solid') { edge.dash = w as 'solid' | 'dashed' | 'dotted'; next(); continue; }
        if (w === 'flow' && tokens[p + 1]?.type === ':') {
          next(); next();
          const v = peek();
          if (v && v.type === 'ident' && GOBI_FLOW_KINDS.includes(String(v.value))) { edge.flow = String(next()!.value); }
          else { err(v ?? t, `flow must be one of: ${GOBI_FLOW_KINDS.join(', ')}`); skipToNextLine(); return; }
          continue;
        }
        if (w === 'flowIcon' && tokens[p + 1]?.type === ':') {
          next(); next();
          const v = peek();
          if (v && v.type === 'ident' && GOBI_FLOW_ICONS.includes(String(v.value))) { edge.flowIcon = String(next()!.value); }
          else { err(v ?? t, `flowIcon must be one of: ${GOBI_FLOW_ICONS.join(', ')}`); skipToNextLine(); return; }
          continue;
        }
        if (w === 'flowCount' && tokens[p + 1]?.type === ':') {
          next(); next();
          const v = peek();
          if (v && v.type === 'number') { edge.flowCount = next()!.value as number; }
          else { err(v ?? t, 'flowCount needs a number'); skipToNextLine(); return; }
          continue;
        }
        if (w === 'card' && tokens[p + 1]?.type === ':') {
          next(); next();
          const v = peek();
          // LEFT: 1 | n | 0..1 | 0..n as ident-or-card token
          let left: string | null = null;
          if (v && v.type === 'card') { left = String(v.value); next(); }
          else if (v && v.type === 'ident' && (v.value === '1' || v.value === 'n')) { left = String(v.value); next(); }
          else if (v && v.type === 'number' && v.value === 1) { left = '1'; next(); }
          else if (v && v.type === 'ident' && GOBI_CARD_TOKENS[String(v.value)]) { left = String(v.value); next(); }
          if (!left) { err(v ?? t, 'card needs LEFT..RIGHT where each side is 1, n, 0..1 or 0..n'); skipToNextLine(); return; }
          if (!at('dotdot')) { err(peek() ?? t, `card needs ".." between the two sides (got ${left}..)`); skipToNextLine(); return; }
          next();
          const r = peek();
          let right: string | null = null;
          if (r && r.type === 'card') { right = String(r.value); next(); }
          else if (r && r.type === 'ident' && (r.value === '1' || r.value === 'n')) { right = String(r.value); next(); }
          else if (r && r.type === 'number' && r.value === 1) { right = '1'; next(); }
          if (!right) { err(r ?? t, 'card needs a right side (1, n, 0..1 or 0..n)'); skipToNextLine(); return; }
          edge.card = `${left}..${right}`;
          continue;
        }
        if (w === 'techn' && tokens[p + 1]?.type === ':') {
          next(); next();
          const v = peek();
          if (v && v.type === 'string') { edge.techn = String(next()!.value); continue; }
          err(v ?? t, 'techn needs a quoted string');
          skipToNextLine(); return;
        }
        if (w === 'x') {
          next();
          const v = peek();
          if (v && v.type === 'number') {
            const n = next()!.value as number;
            if (n < 1) { err(v, 'x needs a count of at least 1'); skipToNextLine(); return; }
            edge.x = n;
            continue;
          }
          err(v ?? t, 'x needs a count (e.g. x 3)');
          skipToNextLine(); return;
        }
        // attached xN (the spec's own `x2` form): the lexer cannot split it
        // (idents contain digits), so `x3` arrives as ONE ident here.
        const attached = /^x([0-9]+)$/.exec(w);
        if (attached) {
          const n = parseInt(attached[1]!, 10);
          if (n < 1) { err(t, 'x needs a count of at least 1'); skipToNextLine(); return; }
          edge.x = n;
          next();
          continue;
        }
        // attached xN: ident "x3"? not produced by the lexer (x3 lexes as x, 3
        // only with a space) — treat any other ident as an unknown tail word.
        err(t, `"${w}" is not an edge attribute — the edge tail accepts dashed, dotted, solid, flow:, flowIcon:, flowCount:, card:, techn: and xN`);
        skipToNextLine(); return;
      }
      if (t.type === 'number' && t.value === 1 && (tokens[p - 1]?.value === 'x')) { next(); continue; }
      done = true;
    }
    // a trailing stray token on the line is an error (e.g. `%%`)
    const tailTok = peek();
    if (tailTok && tailTok.line === line) {
      err(tailTok, `"${String(tailTok.value)}" is not an edge attribute — the edge tail accepts dashed, dotted, solid, flow:, flowIcon:, flowCount:, card:, techn: and xN`);
      skipToNextLine();
    }
  }

  /** End-of-line check for statements outside blocks: nothing else may follow. */
  function endOfStatement(line: number) {
    const t = peek();
    if (t && t.line === line) {
      err(t, `"${String(t.value)}" does not belong on this line — one statement per line outside blocks`);
      skipToNextLine();
    }
  }

  if (errors.length) return {ok: false, ast, errors};
  return {ok: true, ast};
}
