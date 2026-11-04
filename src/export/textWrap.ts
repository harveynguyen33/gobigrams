/* GOBI-WRAP-RULES (2026-11-03) — the pure text wrap, moved OUT of exportSvg.ts
 * (a hard-capped file that may not grow) into its own module so the break
 * ladder below could gain its rules. ONE home: every wrapping surface (title,
 * kicker, sub — exportScene through the textMetrics cache, and exportSvg's
 * own title path) wraps through wrapText.
 *
 * THE BREAK-OPPORTUNITY LADDER (defects measured off the emitted SVG rows of
 * the dogfood architecture fixture, before this round):
 *   1. SPACES — always the first choice (unchanged).
 *   2. INTRA-TOKEN SEPARATORS — a token that cannot fit whole breaks AFTER its
 *      own `-` or `/` first: `surface-neutral JSON` wraps as
 *      ['surface-', 'neutral JSON'], never as the mid-glyph fragments
 *      'surface-n' / 'eutral' the bare character walk produced. Hair spaces
 *      are normalised to plain spaces by the `\s+` pass below, so they are
 *      break opportunities before this ladder even runs.
 *   3. CHARACTER WALK — only a piece with NO intra separator that still
 *      exceeds the line breaks mid-token, exactly as before (lossless: the
 *      pieces concatenate back to the token).
 *
 * Plus the DANGLING-SEPARATOR rule (N3): a line never ENDS on a lone
 * separator token (a space-delimited token that is exactly one of the three
 * list separators). When one lands at a line end it is dropped from that
 * line: the dogfood sub 'lexer · parser · validate · layout' used to emit
 * 'lexer · parser · validate ·' then 'layout'; it now emits 'lexer · parser
 * · validate' then 'layout'. A hyphen that is PART of a token ('surface-')
 * is a legitimate typographic break and is never trimmed. */

/** A whole token that is exactly one separator character. */
const isLoneSeparator = (tok: string): boolean => tok === '·' || tok === '-' || tok === '/';

export function wrapText(
  text: string,
  availableWidth: number,
  measure: (s: string) => number,
): string[] {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t || availableWidth <= 0) return [text];
  if (measure(t) <= availableWidth) return [t];

  /* One atom per break opportunity: a word splits AFTER each intra-token
     separator (the separator stays with the piece before it, the way CSS
     breaks after a hyphen); `glue` marks a piece that rejoins the line
     WITHOUT a space when the break does not land there. */
  type Atom = {s: string; glue: boolean};
  const atoms: Atom[] = [];
  for (const word of t.split(' ')) {
    const pieces = word.split(/(?<=[-/])/);
    pieces.forEach((s, i) => atoms.push({s, glue: i > 0}));
  }

  const lines: string[] = [];
  let cur = '';
  const push = (): void => {
    if (!cur) return;
    const ws = cur.split(' ');
    if (ws.length > 1 && isLoneSeparator(ws[ws.length - 1])) ws.pop();
    const ln = ws.join(' ');
    if (ln) lines.push(ln);
    cur = '';
  };
  /* Ladder rung 3 — the character walk, only for a piece with no separator
     left. Returns the trailing fragment so the next atom can glue onto it. */
  const hardBreak = (piece: string): string => {
    let frag = '';
    for (const ch of piece) {
      if (frag && measure(frag + ch) > availableWidth) { lines.push(frag); frag = ch; }
      else frag += ch;
    }
    return frag;
  };

  for (const a of atoms) {
    const cand = cur ? cur + (a.glue ? '' : ' ') + a.s : a.s;
    if (measure(cand) <= availableWidth) { cur = cand; continue; }
    push(); /* rung 1 or 2: the line ends here — push() applies the N3 trim */
    cur = measure(a.s) <= availableWidth ? a.s : hardBreak(a.s);
  }
  push();
  return lines;
}
