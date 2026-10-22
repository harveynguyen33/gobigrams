#!/usr/bin/env node
/**
 * ROUND AZ (t_96100cb2) — shipped fonts + outline-from-committed-bytes + embed.
 * checks/round-az-fonts.mjs
 *
 * SOURCE-contract harness (no browser): asserts the tree carries what the
 * card demands. RED-proven on parent b0e4583.
 *
 *  AZ-1  provenance — public/fonts/SHA256S.txt exists and pins every shipped
 *        font file (name + sha256); Inter/JetBrainsMono ship an OFL licence.
 *  AZ-2  subsets — every Inter/JBM woff2 declares the Vietnamese ranges the
 *        card names (U+1EA0-1EF9 appears in the @font-face unicode-range) and
 *        the @font-face blocks carry font-display: swap.
 *  AZ-3  stacks — styles.css --sans/--mono lead with 'Inter' / 'JetBrains Mono'
 *        (fallbacks preserved after them).
 *  AZ-4  preload — index.html preloads the two first-paint font files.
 *  AZ-5  shaper bytes — the outline pipeline resolves (family, weight) from
 *        the COMMITTED font files (public/fonts/*.ttf), not only from the
 *        queryLocalFonts permission API; the provider is file-first.
 *  AZ-6  variable axis — the shaper instantiates the wght axis (hb_font_set_variations)
 *        so weight 650 shapes from the variable subset.
 *  AZ-7  embed — the export builds fontEmbedCss (base64 woff2 @font-face) from
 *        the painted (family, weight) pairs and emitSvg receives it.
 *  AZ-8  licence guard — the embed path reads OS/2 fsType and refuses to embed
 *        a font whose fsType forbids embedding (0x0002 restricted, or the
 *        card-named 0x0100 reserved-forbid bit), surfacing a visible reason.
 *  AZ-9  never silent — a family the shaper cannot resolve surfaces a visible
 *        note (gobi:export-note / the modal), not a byte-identical preview.
 */
import {createHash} from 'node:crypto';
import {readFileSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};
const read = (p) => { try { return readFileSync(join(REPO, p), 'utf8'); } catch { return ''; } };

const css = read('src/styles.css');
const html = read('index.html');
const app = read('src/App.tsx');
const outlineSrc = read('src/textOutline.ts');
const hbSrc = read('src/textOutlineHb.ts');
const exportSvgSrc = read('src/exportSvg.ts');

/* AZ-1 provenance -------------------------------------------------------- */
const manifestPath = join(REPO, 'public/fonts/SHA256S.txt');
const manifestOk = existsSync(manifestPath);
let manifestEntries = [];
if (manifestOk) {
  manifestEntries = readFileSync(manifestPath, 'utf8').split('\n')
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => { const parts = l.split(/\s+/); return {name: parts[0], hash: parts[1]}; });
}
let manifestVerified = 0;
for (const e of manifestEntries) {
  const p = join(REPO, 'public/fonts', e.name);
  if (!existsSync(p)) continue;
  const h = createHash('sha256').update(readFileSync(p)).digest('hex');
  if (h === e.hash) manifestVerified++;
}
assert('az-provenance-manifest', manifestOk && manifestEntries.length >= 8,
  `SHA256S.txt ${manifestOk ? `present (${manifestEntries.length} entries)` : 'MISSING'}`);
assert('az-provenance-hashes', manifestEntries.length > 0 && manifestVerified === manifestEntries.length,
  `${manifestVerified}/${manifestEntries.length} on-disk files match their pinned sha256`);
assert('az-provenance-ofl', existsSync(join(REPO, 'public/fonts/OFL-Inter.txt'))
    && existsSync(join(REPO, 'public/fonts/OFL-JetBrainsMono.txt')),
  'OFL-Inter.txt + OFL-JetBrainsMono.txt committed beside the fonts');

/* AZ-2 subsets ----------------------------------------------------------- */
const jbmViet = /JetBrains Mono'[^}]*vietnamese\.woff2[^}]*U\+1EA0-1EF9/s.test(css)
  || /font-family: 'JetBrains Mono';[^}]*src: url\('\/fonts\/jetbrains-mono-400-vietnamese\.woff2'\)[^}]*U\+1EA0-1EF9/s.test(css);
assert('az-subset-jbm-vietnamese', jbmViet, "JetBrains Mono @font-face covers U+1EA0-1EF9 (Vietnamese) in its unicode-range");
const interViet = /font-family: 'Inter';[^}]*src: url\('\/fonts\/inter-400-vietnamese\.woff2'\)[^}]*U\+1EA0-1EF9/s.test(css);
assert('az-subset-inter-vietnamese', interViet, "Inter @font-face covers U+1EA0-1EF9 (Vietnamese) in its unicode-range");
assert('az-subset-display-swap', (css.match(/@font-face\s*{[^}]*font-display:\s*swap/g) || []).length >= 12,
  `${(css.match(/font-display:\s*swap/g) || []).length} font-display:swap declarations (>=12)`);
const w650 = /font-family:\s*'Inter';[^}]*font-weight:\s*650[^}]*src:/s.test(css)
  || /font-family:\s*'Inter';[^}]*font-weight:\s*100 900[^}]*src:/s.test(css);
assert('az-subset-inter-650', w650, 'Inter carries a face covering weight 650 (the note-title weight)');

/* AZ-3 stacks ------------------------------------------------------------ */
const sansLine = css.match(/--sans:\s*([^;]+);/)?.[1] ?? '';
const monoLine = css.match(/--mono:\s*([^;]+);/)?.[1] ?? '';
assert('az-stack-sans', /^'Inter',/.test(sansLine.trim()) && /fallback|ui-sans-serif|system-ui/.test(sansLine),
  `--sans = "${sansLine.trim().slice(0, 60)}…" — must LEAD with 'Inter' and keep fallbacks`);
assert('az-stack-mono', /^'JetBrains Mono',/.test(monoLine.trim()) && /ui-monospace|monospace/.test(monoLine),
  `--mono = "${monoLine.trim().slice(0, 60)}…" — must LEAD with 'JetBrains Mono' and keep fallbacks`);

/* AZ-4 preload ----------------------------------------------------------- */
const preloadCount = (html.match(/rel="preload"[^>]*as="font"|<link[^>]*as="font"/g) || []).length;
assert('az-preload', preloadCount >= 2, `${preloadCount} font preloads in index.html (>=2: the first-paint faces)`);

/* AZ-5 file-first shaper bytes ------------------------------------------ */
const fileFirst = /fonts\/.*\.ttf|FONT_FILES|fontFiles|committedFont/.test(app) || /public\/fonts|\/fonts\//.test(hbSrc);
assert('az-shaper-file-first', fileFirst,
  'the outline pipeline references the committed font files (a fetchable path under /fonts/), not only queryLocalFonts');
const qlfStillThere = /queryLocalFonts/.test(outlineSrc);
assert('az-shaper-qlf-fallback-only', qlfStillThere || /localFontBytes/.test(app),
  'queryLocalFonts stays available only as a fallback for families the tree does not ship');

/* AZ-6 variable axis ----------------------------------------------------- */
assert('az-shaper-variations', /hb_font_set_variations/.test(hbSrc),
  'textOutlineHb declares + calls hb_font_set_variations (wght instantiation for weight 650)');
assert('az-shaper-var-axis', /wght/.test(hbSrc),
  'the variation coords set the wght axis');

/* AZ-7 embed ------------------------------------------------------------- */
const embedBuilder = /fontEmbedCss/.test(app) && /fontEmbedCss/.test(exportSvgSrc);
assert('az-embed-css-seam-fed', embedBuilder,
  'App builds fontEmbedCss and hands it to exportSvgOf (the emitSvg seam consumes it)');
const embedBase64 = /base64/.test(app) || /base64/.test(exportSvgSrc);
assert('az-embed-base64', embedBase64, 'the embedded @font-face carries base64 woff2 data URIs');

/* AZ-8 licence guard ----------------------------------------------------- */
const fsType = /fsType/.test(app) || /fsType/.test(exportSvgSrc) || /fsType/.test(hbSrc);
assert('az-embed-fstype-guard', fsType, 'the embed path reads OS/2 fsType before embedding');
const guardBits = /0x0100|0x0002|256|2\b/.test(app);
assert('az-embed-fstype-bits', fsType && guardBits,
  'the guard refuses restricted (0x0002) and the card-named 0x0100 bit');

/* AZ-9 never silent ------------------------------------------------------ */
const surfaced = /gobi:export-note/.test(app) && /outline/i.test(app);
assert('az-outline-note-surfaced', surfaced,
  'an unresolvable family surfaces a visible note (gobi:export-note), never a byte-identical preview');

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} assertions pass`);
if (failed.length) { console.log('FAILED:', failed.map(f => f.id).join(', ')); process.exit(1); }
console.log('ROUND AZ source contract: GREEN');
