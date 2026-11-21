/* SHAPE-FIDELITY (t_926d8509) — the post-it note's export markup, extracted
 * from exportSvg.ts so that file stays under its hard line cap. The CANVAS
 * wins: the note exports the same geometry it paints (styles.css .ds-postit)
 * — radius 12, a REAL two-stop linearGradient at 135deg (top-left ->
 * bottom-right) reproducing the canvas colour-mixes (nc 15% over --elevated)
 * -> (nc 4% over --surface), and the fold triangle at the BOTTOM-RIGHT with
 * the 18px leg in --nc at 50% alpha. No stroke and no shadow: the canvas card
 * is borderless and print stays flat. */
/** Attribute escaper — the same contract as exportSvg.ts's local escAttr. */
const escAttr = (s: unknown): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Hex blend `a` over `b` at t: the CSS `color-mix` equivalent the note
 *  gradient needs (gobi ships no blend helper; tokens resolve as hex, and a
 *  non-hex value degrades to `a` untouched). */
export function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  if ([r1, g1, b1, r2, g2, b2].some(Number.isNaN)) return a;
  const q = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${q(r1, r2)}${q(g1, g2)}${q(b1, b2)}`;
}

/** Post-it note: rect + folded corner + text (the POSTIT silhouette). The
 *  gradient stops are PRE-BLENDED here so the markup needs one def, pushed
 *  into `defs` once per document. */
export function noteMarkup(s: {w: number; h: number}, surface: string, elevated: string, nc: string, defs: string[]): string {
  const gid = 'gobi-note-grad';
  if (!defs.some(d => d.includes(`id="${gid}"`))) {
    defs.push(`<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${escAttr(mixHex(elevated, nc, 0.15))}"/>` +
      `<stop offset="1" stop-color="${escAttr(mixHex(surface, nc, 0.04))}"/></linearGradient>`);
  }
  return [
    `<rect x="1" y="1" width="${s.w - 2}" height="${s.h - 2}" rx="12" fill="url(#${gid})"/>`,
    `<path d="M${s.w - 19} ${s.h - 1} L${s.w - 1} ${s.h - 19} L${s.w - 1} ${s.h - 1} Z" fill="${escAttr(nc)}" fill-opacity="0.5"/>`,
  ].join('');
}
