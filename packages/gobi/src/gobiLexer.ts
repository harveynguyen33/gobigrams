/* ROUND GOBI-1 — the .gobi lexer (SPEC §2.1). Line-oriented outside blocks;
 * inside `{}` the parser is newline-agnostic, but the LEXER is uniform: it
 * scans the whole text once, honouring strings (a `#` inside quotes is text)
 * and comments (`#` to end of line outside quotes).
 *
 * Token set: ident (bare or "quoted as a name"), string, number, the three
 * arrows, `..` (card separator), single-char punctuation { } ; : =.
 *
 * Longest match rules that matter:
 *   · `->` is matched greedily BEFORE `-` could split an ident — `a->b` is
 *     two idents and an arrow; `order-items` keeps its hyphen (SPEC §2.1).
 *   · `0..1` / `0..n` are matched as ONE number token before the `..`
 *     separator can claim the dots (SPEC §2.5).
 *   · identifiers may contain `-` and `_`, never start with a digit; a quoted
 *     string may serve as a name ("order items" = service). */

import {GobiLexError, type GobiToken} from './gobiTypes';

const IDENT_START = /[A-Za-z_]/;
const IDENT_BODY = /[A-Za-z0-9_-]/;

export function lexGobi(text: string): GobiToken[] {
  const tokens: GobiToken[] = [];
  let i = 0;
  let line = 1;
  let lineStart = 0;
  const n = text.length;
  const col = () => i - lineStart + 1;

  const push = (type: GobiToken['type'], value: string | number) =>
    tokens.push({type, value, line, col: col()});

  while (i < n) {
    const c = text[i]!;

    // whitespace — newlines advance the position tracker
    if (c === '\n') { i++; line++; lineStart = i; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }

    // comment: # to end of line (outside strings — the string branch is above this)
    if (c === '#') { while (i < n && text[i] !== '\n') i++; continue; }

    // string: "...", escapes \" and \\ (and \ before anything else passes through)
    if (c === '"') {
      const startLine = line, startCol = col();
      i++;
      let out = '';
      let closed = false;
      while (i < n) {
        const s = text[i]!;
        if (s === '\n') break; // strings do not span lines
        if (s === '\\') {
          const next = text[i + 1];
          if (next === '"' || next === '\\') { out += next; i += 2; continue; }
          out += s; i++; continue;
        }
        if (s === '"') { closed = true; i++; break; }
        out += s; i++;
      }
      if (!closed) throw new GobiLexError(startLine, startCol, `line ${startLine}: unterminated string — add the closing "quote"`);
      tokens.push({type: 'string', value: out, line: startLine, col: startCol});
      continue;
    }

    // arrows — greedy before any `-` ident body could claim the char
    if (c === '-' || c === '.') {
      const two = text.slice(i, i + 2);
      const three = text.slice(i, i + 3);
      if (two === '->') { push('arrow', two); i += 2; continue; }
      if (three === '..>' || three === '-.>') { push('arrow', three); i += 3; continue; }
      if (three === '...') { throw new GobiLexError(line, col(), `line ${line}: "..." is not an operator — edges use -> ..> -.>`); }
      if (c === '.') {
        // the only legal 2-dot token is the cardinality separator
        if (text.slice(i, i + 2) === '..') { push('dotdot', '..'); i += 2; continue; }
        // `0..1`/`0..n` were matched above as cards; a bare leading dot is illegal
        throw new GobiLexError(line, col(), `line ${line}: illegal character "." — numbers are bare digits; cardinality uses 0..1 / 0..n`);
      }
      throw new GobiLexError(line, col(), `line ${line}: illegal character "-"`);
    }

    // numbers: 0..1 / 0..n cardinality tokens (longest match, SPEC §2.5), else digits
    if (/[0-9]/.test(c)) {
      const card2 = text.slice(i, i + 4);
      if (card2 === '0..1' || card2 === '0..n') { push('card', card2); i += 4; continue; }
      let j = i;
      while (j < n && /[0-9]/.test(text[j]!)) j++;
      const digits = text.slice(i, j);
      if (j < n && IDENT_START.test(text[j]!)) {
        throw new GobiLexError(line, col(), `line ${line}: "${digits}${text[j]}" starts with a digit — identifiers never do`);
      }
      push('number', parseInt(digits, 10));
      i = j;
      continue;
    }

    // identifiers (bare form). `-` is an ident body char (order-items) BUT an
    // arrow opener when followed by `>` (a->b) or `.>` (a-.>b) — the greedy
    // arrow rule from SPEC §2.1, applied at the ident boundary.
    if (IDENT_START.test(c)) {
      let j = i;
      while (j < n && IDENT_BODY.test(text[j]!)) {
        if (text[j] === '-' && (text.slice(j, j + 2) === '->' || text.slice(j, j + 3) === '-.>')) break;
        j++;
      }
      push('ident', text.slice(i, j));
      i = j;
      continue;
    }

    // punctuation
    if (c === '{' || c === '}' || c === ';' || c === ':' || c === '=') { push(c, c); i++; continue; }

    throw new GobiLexError(line, col(), `line ${line}: illegal character "${illegalRun(text, i, c)}"`);
  }
  return tokens;
}

/** The run of the SAME illegal character starting at position i (`%%` reads
 *  as "%%", not two separate errors) — the message shows what to delete. */
function illegalRun(source: string, i: number, c: string): string {
  let j = i;
  while (j < source.length && source[j] === c) j++;
  return source.slice(i, j);
}
