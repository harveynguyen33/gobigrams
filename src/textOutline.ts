/* ROUND C (t_a5c17861) — "Outline text": text -> glyph outline paths.
 *
 * Harvey-approved design (card comment, 2026-10-21 "ok 1"):
 *  - harfbuzzjs@1.6.3 (MIT) is the shaper — the same HarfBuzz Chrome/
 *    Firefox/Figma/Adobe shape with, so outlined glyphs match the canvas's
 *    shaping BY CONSTRUCTION. +16,332 B minified / 5,421 gzip (measured,
 *    STEP 0 probe); consumed 66% of the 24,855 B headroom against the
 *    900,000 client_js_bytes ceiling.
 *  - harfbuzz.wasm (~431 KB) is a LAZY ASSET: imported with vite's `?url`
 *    (a URL string constant, never bundled/fetched) and fetched only on
 *    the FIRST outlined export. The default <text> path never touches it.
 *
 * Coordinate contract (verified live on DejaVu Sans, coder scratch
 * c-spike/spike2-3.mjs):
 *  - hb_font_set_scale(s, s) makes "s" the pixels-per-em of every advance
 *    and glyphToPath coordinate; s = 64 gives 1/64-px resolution at our
 *    sizes and keeps float math exact.
 *  - glyphToPath is Y-UP (font space: +y above the baseline, descenders
 *    negative). SVG is Y-DOWN. The run group flips with scale(1,-1)
 *    around its own baseline (translate(x, baselineY) scale(1,-1)), so a
 *    glyph coordinate (gx, gy) lands at (x + gx*k, baselineY - gy*k).
 *
 * Typography-report rules encoded (research/svg-text-typography-fidelity.md):
 *  - §7.4 "shape first, spacing second": letter-spacing is folded into the
 *    shaped ADVANCES before glyph placement, never re-emitted as an SVG
 *    attribute (SVG applies it per character and would change ligatures).
 *  - one shaped run per line (no per-word splitting).
 *  - §7.4 "Losses": the source string stays in a data-text attribute on
 *    the run group (search/round-trip/a11y survive as data).
 */

/** The narrow shaper surface textOutline needs. The real implementation
 *  wraps harfbuzzjs; the harness stubs it (deterministic, no wasm). */
export type OutlineShaper = {
  /** Shape one LINE: per-glyph id, offsets and advances in FONT UNITS,
   *  with the face's upem. RTL/ligatures/kerning are the shaper's job. */
  shapeRun(text: string): {
    glyphs: Array<{gid: number; xOffset: number; yOffset: number; xAdvance: number}>;
    upem: number;
  };
  /** The glyph's outline as SVG path data in FONT UNITS, y-up. */
  glyphPath(gid: number): string;
};

/** The seam that turns a (family, weight) pair into font BYTES. The app
 *  wires the browser's local-font access (window.queryLocalFonts — a user-
 *  permissioned API, the only lawful way to read a SYSTEM font's bytes);
 *  tests inject a file-backed provider. Returns null when the font cannot
 *  be resolved (caller falls back to <text> for that run and reports). */
export type FontBytesProvider = (family: string, weight: number) => Promise<Uint8Array | null>;

/** ONE positioned glyph in user (px) space, y still FONT-UP. */
export type PlacedGlyph = {gid: number; x: number; y: number};

/** A fully laid-out run: the transform + per-glyph (x, y) placements,
 *  y-up, baseline at y=0 — flip once in the emitter. */
export type ShapedRun = {
  glyphs: PlacedGlyph[];
  /** shaped width in px (advances + spacing, before anchoring) */
  width: number;
  /** the anchor offset ALREADY APPLIED to every glyph x */
  x0: number;
};

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Pure run layout — the typography rules live HERE and nowhere else.
 *  scale is chosen so advances carry sub-px resolution: 64 px/em,
 *  independent of the row's own size; the size ratio folds into k. */
export function layoutRun(
  text: string,
  shaper: OutlineShaper,
  o: {size: number; spacing: number; anchor?: string},
): ShapedRun {
  const {glyphs, upem} = shaper.shapeRun(text);
  const SCALE = 64; /* shaper px-per-em at shape time */
  /* font units -> shaper px, then shaper px -> row px */
  const k = o.size / SCALE;
  const unitK = SCALE / upem;
  /* shape first, spacing second: fold letter-spacing into the ADVANCE */
  let x = 0;
  const placed: PlacedGlyph[] = [];
  for (const g of glyphs) {
    placed.push({
      gid: g.gid,
      x: x + g.xOffset * unitK * k,
      y: g.yOffset * unitK * k,
    });
    x += g.xAdvance * unitK * k + o.spacing;
  }
  /* the trailing spacing of the last glyph is not ink */
  const width = x - (glyphs.length ? o.spacing : 0);
  /* anchor: middle/centre the run on the requested x (the emitter passes
   * the row's own x; start leaves it). end would right-align — unused by
   * the scene today but symmetric. */
  let x0 = 0;
  if (o.anchor === 'middle' || o.anchor === 'central') x0 = -width / 2;
  else if (o.anchor === 'end') x0 = -width;
  if (x0 !== 0) for (const g of placed) g.x += x0;
  return {glyphs: placed, width, x0};
}

/** Per-glyph paths + the run group, in final SVG user space.
 *  Emitted shape (ONE group per line — the unit the modal/scene talk):
 *
 *    <g transform="translate(x,baselineY) scale(1,-1)" fill=... data-text=...>
 *      <path transform="translate(gx,gy)" d="..."/>
 *      ...
 *    </g>
 *
 *  The group's scale(1,-1) flips font y-up to SVG y-down around the
 *  baseline; each glyph translates INSIDE the flipped space (font units
 *  already scaled to row px by layoutRun). */
export function shapeLineToSvg(
  text: string,
  o: {
    x: number; baselineY: number; size: number; weight: number;
    fill: string; spacing: number; anchor?: string; opacity?: string;
    shaper: OutlineShaper;
  },
): string {
  const run = layoutRun(text, o.shaper, o);
  const glyphs = run.glyphs
    .map(g => {
      const d = o.shaper.glyphPath(g.gid);
      if (!d) return '';
      return `<path transform="translate(${round2(g.x)},${round2(g.y)})" d="${d}"/>`;
    })
    .join('');
  const attrs = [
    `transform="translate(${o.x},${o.baselineY}) scale(1,-1)"`,
    `fill="${o.fill}"`,
    o.opacity ? `opacity="${o.opacity}"` : '',
    `data-text="${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}"`,
    `data-size="${o.size}"`,
  ].filter(Boolean).join(' ');
  return `<g ${attrs}>${glyphs}</g>`;
}

/* The harfbuzzjs loader (makeShaper) lives in src/textOutlineHb.ts —
 * App-only, because it carries the vite `?url` wasm-asset import the
 * legacy Node harnesses' plain-esbuild bundles cannot resolve. The pure
 * contract above (layoutRun / shapeLineToSvg) has no such dependency. */

/* ------------------------------------------------------------------ */
/* Font BYTES: the browser's Local Font Access API.                    */
/* ------------------------------------------------------------------ */

/** The (family, weight) -> bytes provider wired to window.queryLocalFonts.
 *  A USER-PERMISSIONED API (the prompt fires once per origin, Chrome only):
 *  the only lawful way to read a SYSTEM font's bytes for outlining — per
 *  the typography report §6, outlining a system font is licence-safe
 *  where subset-embedding would not be. Weight matching picks the
 *  closest face of the first family whose name matches the row's family
 *  (computed families arrive as full stacks: take the FIRST named face —
 *  ui-monospace etc. resolve to concrete PostScript-ish names in the
 *  API's response, which we match leniently). */
export async function localFontBytes(
  family: string,
  weight: number,
): Promise<{bytes: Uint8Array; name: string} | null> {
  const q = (window as unknown as {queryLocalFonts?: () => Promise<Array<{
    family: string; fullName: string; postscriptName: string; style: string; weight: number;
    blob(): Promise<Blob>;
  }>>}).queryLocalFonts;
  if (typeof q !== 'function') return null;
  try {
    const fonts = await q.call(window);
    if (!fonts.length) return null;
    /* the row's family may be a stack: try each comma part */
    const parts = family.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    const scored = fonts.map(f => {
      let score = -1;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i].toLowerCase();
        if (f.family.toLowerCase() === p || f.fullName.toLowerCase() === p ||
            f.postscriptName.toLowerCase().replace(/-/g, ' ') === p) {
          score = 100 - i; /* earlier stack parts win */
          break;
        }
        /* generic keywords (monospace/sans-serif) and ui- prefixes cannot
         * name a face — skip them for direct matches */
      }
      return {f, score};
    }).filter(s => s.score >= 0);
    if (!scored.length) return null;
    /* closest weight among the matched family's faces */
    scored.sort((a, b) =>
      (Math.abs(b.f.weight - weight) - Math.abs(a.f.weight - weight)) || (b.score - a.score));
    const pick = scored[0].f;
    const blob = await pick.blob();
    return {bytes: new Uint8Array(await blob.arrayBuffer()), name: pick.postscriptName};
  } catch (e) {
    console.error('[textOutline] queryLocalFonts failed:', e);
    return null;
  }
}


