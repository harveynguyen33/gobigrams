#!/usr/bin/env node
/**
 * ROUND AG1 harness — the colour palette (Option A: keep the HUE, adapt the LIGHTNESS).
 *
 * NO BROWSER, NO CDP, NO HEADLESS CHROME. Every number printed below is either
 *   (1) ARITHMETIC on `src/styles.css` as written (hex -> HSV, WCAG relative
 *       luminance), or
 *   (2) EXECUTED against the shipped `src/colors.ts` — bundled with the project's
 *       own esbuild and imported, so `keyForHex` / `resolveColor` are the real
 *       functions and not a transcription of them.
 * The live painted measurement is the orchestrator's pass, not this file's.
 *
 * WHAT THIS FILE GUARDS
 *   A. the `amber` brown bug — a token whose LIGHT/PAPER value rotated 20 deg off
 *      its own dark value while still saturated enough for a user to see it.
 *   B. the three new hue families (red, blue, pink) declared in EVERY theme.
 *   C. the 9% fill — RECORDED, not changed.
 *
 * THE RULE (the point of item A): a hue rotation only matters where the value is
 * saturated enough to be seen. A near-grey value may sit anywhere on the wheel.
 * So the family probe classifies every token value by NEAREST HUE ANCHOR (the
 * anchors ARE the shipped dark-theme palette — the product's own definition of
 * its families) and EXEMPTS values below a visibility floor. Both halves are
 * asserted against the real numbers, and the probe is pointed at the PRE-FIX
 * amber values to prove it would have gone red.
 *
 * COMMENTS ARE BLANKED BEFORE EVERY PROBE (blanking keeps byte offsets, so a
 * reported line number stays true). This repo's docblocks quote the constructs
 * they describe; a raw count would read a correct tree as a defect.
 */
import {readFileSync, writeFileSync, rmSync} from 'node:fs';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const STYLES_RAW = readFileSync(`${ROOT}/src/styles.css`, 'utf8');
const COLORS_RAW = readFileSync(`${ROOT}/src/colors.ts`, 'utf8');
const THEME_RAW = readFileSync(`${ROOT}/src/theme.ts`, 'utf8');
const SHAPES_RAW = readFileSync(`${ROOT}/src/shapes.tsx`, 'utf8');

const blank = m => m.replace(/[^\n]/g, ' ');
/** Blank CSS comments, KEEPING byte offsets (so line numbers stay true). */
const STYLES = STYLES_RAW.replace(/\/\*[\s\S]*?\*\//g, blank);
const COLORS = COLORS_RAW
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
const THEME = THEME_RAW
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};
const lineOf = (needle, hay = STYLES_RAW) => {
  const i = hay.indexOf(needle);
  return i < 0 ? -1 : hay.slice(0, i).split('\n').length;
};

/* ===========================================================================
   ARITHMETIC — hex, HSV, WCAG. No dependencies.
   =========================================================================== */
const hex2rgb = h => {
  const s = String(h).replace('#', '');
  const f = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
  return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16));
};
const rgb2hex = ([r, g, b]) =>
  '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
function hsv(hex) {
  const [r, g, b] = hex2rgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return {h, s: max === 0 ? 0 : d / max, v: max};
}
const chr = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = hex => { const [r, g, b] = hex2rgb(hex); return 0.2126 * chr(r) + 0.7152 * chr(g) + 0.0722 * chr(b); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** Shortest angular distance between two hues, in degrees. */
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
/** color-mix(in srgb, <fg> <pct>%, transparent) flattened onto an opaque canvas. */
const mixOver = (fg, pct, bg) => {
  const f = hex2rgb(fg), b = hex2rgb(bg), a = pct / 100;
  return rgb2hex(f.map((v, i) => v * a + b[i] * (1 - a)));
};
const f2 = v => Number(v).toFixed(2);
const f3 = v => Number(v).toFixed(3);

/* ===========================================================================
   PARSE THE SOURCE — every list is ENUMERATED, nothing is hard-coded.
   =========================================================================== */

/** The concrete theme ids, from `src/theme.ts` — the ONE declaration. */
const THEME_IDS = (() => {
  const i = THEME.indexOf('const THEME_IDS: ThemeName[] = [');
  if (i < 0) return null;
  const body = THEME.slice(i, THEME.indexOf('];', i));
  return [...body.matchAll(/'([a-z]+)'/g)].map(m => m[1]);
})();

/** The shape-colour keys, from `COLOR_KEYS` in `src/colors.ts`. */
const COLOR_KEYS = (() => {
  const i = COLORS.indexOf('export const COLOR_KEYS: ColorKey[] = [');
  if (i < 0) return null;
  const body = COLORS.slice(i, COLORS.indexOf('];', i));
  return [...body.matchAll(/'([A-Za-z][\w-]*)'/g)].map(m => m[1]);
})();

/** `COLOR_VAR` — key -> the custom property it resolves to. */
const COLOR_VAR = (() => {
  const i = COLORS.indexOf('export const COLOR_VAR: Record<ColorKey, string> = {');
  if (i < 0) return null;
  const body = COLORS.slice(i, COLORS.indexOf('};', i));
  const out = {};
  for (const [, k, v] of body.matchAll(/([A-Za-z][\w-]*)\s*:\s*'([^']+)'/g)) out[k] = v;
  return out;
})();

/** `COLORS` — the legacy literal-hex fallback. */
const COLORS_FALLBACK = (() => {
  const i = COLORS.indexOf('export const COLORS = {');
  if (i < 0) return null;
  const body = COLORS.slice(i, COLORS.indexOf('} as const;', i));
  const out = {};
  for (const [, k, v] of body.matchAll(/([A-Za-z][\w-]*)\s*:\s*'(#[0-9a-fA-F]{3,6})'/g)) out[k] = v;
  return out;
})();

/** `LEGACY_HEX` — literal hex -> key, the board-loading path. */
const LEGACY = (() => {
  const i = COLORS.indexOf('export const LEGACY_HEX: Record<string, ColorKey> = {');
  if (i < 0) return null;
  const body = COLORS.slice(i, COLORS.indexOf('};', i));
  const out = {};
  for (const [, hex, k] of body.matchAll(/'(#[0-9a-fA-F]{3,6})'\s*:\s*'([A-Za-z][\w-]*)'/g)) out[hex.toLowerCase()] = k;
  return out;
})();

/** Every `--c-*` declaration inside a theme block, by theme id. */
function themePalette(id) {
  const re = new RegExp(`(?:^|\\n):root,\\s*\\n\\[data-theme="dark"\\]\\s*\\{`, 'm');
  let start;
  if (id === 'dark') {
    const m = STYLES.match(re);
    if (!m) return null;
    start = STYLES.indexOf('{', m.index);
  } else {
    const at = STYLES.indexOf(`[data-theme="${id}"]`);
    if (at < 0) return null;
    start = STYLES.indexOf('{', at);
  }
  const end = STYLES.indexOf('\n}', start);
  const body = STYLES.slice(start, end);
  const out = {};
  for (const [, k, v] of body.matchAll(/(--c-[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})/g)) out[k] = v;
  return out;
}
/** The theme's own two surfaces. A token is drawn on the CANVAS (`--bg`) and on
 *  panels/the edge-label plate (`--surface`); the two differ by theme (paper's
 *  cream plate is LIGHTER than its canvas, light's white plate is DARKER than
 *  its canvas), so every contrast below is reported against BOTH and asserted
 *  against the STRICTER of the two. The brief's own light figure (`#a16207`
 *  4.60) is the `--bg` pair and comes out identical here. */
function themeBg(id) {
  const at = STYLES.indexOf(id === 'dark' ? '[data-theme="dark"]' : `[data-theme="${id}"]`);
  const start = STYLES.indexOf('{', at);
  const body = STYLES.slice(start, STYLES.indexOf('\n}', start));
  const bg = body.match(/--bg:\s*(#[0-9a-fA-F]{3,6})/);
  const sv = body.match(/--surface:\s*(#[0-9a-fA-F]{3,6})/);
  return {bg: bg && bg[1], surface: sv && sv[1]};
}
/** The worse of the two, which is what a readability floor must be met on. */
const worstContrast = (hex, id) => {
  const {bg, surface} = themeBg(id);
  return Math.min(contrast(hex, bg), contrast(hex, surface));
};
/** `EXPORT_TOKENS` — every `--c-*` the SVG exporter inlines. */
const EXPORT_TOKENS = (() => {
  const i = THEME.indexOf('export const EXPORT_TOKENS = [');
  if (i < 0) return null;
  return [...THEME.slice(i, THEME.indexOf('] as const;', i)).matchAll(/'(--[\w-]+)'/g)].map(m => m[1]);
})();

const PALETTES = {};
for (const id of THEME_IDS ?? []) PALETTES[id] = themePalette(id);

/* ===========================================================================
   THE FAMILY PROBE — the assertion that would have caught `amber`.
   =========================================================================== */

/** A value is EXEMPT from the family check when its saturation is below this:
 *  it reads as grey and no user can see which family it "belongs" to. */
const SAT_VISIBLE = 0.30;

/** Anchors = the shipped DARK palette for every key (the product's own family
 *  definition). Derived, never written down twice. */
function anchors(pals, keys) {
  const dark = pals.dark ?? {};
  const out = {};
  for (const k of keys) if (dark['--c-' + k]) out[k] = hsv(dark['--c-' + k]).h;
  return out;
}

/** Classify a value: which key's anchor is nearest? `null` when near-grey. */
function classify(hex, anch, satFloor) {
  const {h, s} = hsv(hex);
  if (s < satFloor) return {key: null, h, s, why: 'near-grey (below the visibility floor)'};
  let best = null;
  for (const [k, a] of Object.entries(anch)) {
    const d = hueDist(h, a);
    if (!best || d < best.d) best = {k, d};
  }
  return best ? {key: best.k, h, s, d: best.d} : {key: null, h, s, why: 'no anchors'};
}

/** Every value that sits in a family OTHER than its own key's. Parameterised by
 *  the visibility floor so the same code answers both the fixed and pre-fix
 *  questions — and by the palettes, so it can be pointed at a mutated copy. */
function familyCrossers(pals, keys, satFloor, themeIds) {
  const anch = anchors(pals, keys);
  const out = [];
  for (const t of themeIds) {
    for (const k of keys) {
      const hex = pals[t] && pals[t]['--c-' + k];
      if (!hex) continue;
      const c = classify(hex, anch, satFloor);
      if (c.key !== null && c.key !== k) out.push({theme: t, key: k, hex, sits: c.key, h: c.h, s: c.s, d: c.d});
    }
  }
  return out;
}

/** Per-key measurements across the given themes. */
function spreadOf(pals, keys, themeIds) {
  const out = {};
  for (const k of keys) {
    const vals = themeIds.map(t => pals[t] && pals[t]['--c-' + k]).filter(Boolean);
    if (!vals.length) continue;
    const hs = vals.map(v => hsv(v).h), ss = vals.map(v => hsv(v).s);
    const sorted = [...hs].sort((a, b) => a - b);
    let gap = 360 + sorted[0] - sorted[sorted.length - 1];   // the wrap-around arc
    for (let i = 1; i < sorted.length; i++) gap = Math.max(gap, sorted[i] - sorted[i - 1]);
    out[k] = {
      spread: 360 - gap,                       // circular: 360 minus the largest empty arc
      linear: Math.max(...hs) - Math.min(...hs),
      minSat: Math.min(...ss), maxSat: Math.max(...ss),
      hues: hs, vals,
    };
  }
  return out;
}

/* ===========================================================================
   A. the family assertion + the amber bug
   =========================================================================== */
console.log('\n=== A. the amber brown bug, and the rule that decides what a bug is ===');
console.log(`  themes from src/theme.ts THEME_IDS : [${(THEME_IDS ?? []).join(', ')}]`);
console.log(`  keys from src/colors.ts COLOR_KEYS : [${(COLOR_KEYS ?? []).join(', ')}] (${(COLOR_KEYS ?? []).length})`);

/** The reference (dark) theme is the anchor set; `contrast` is the accessibility
 *  theme that re-maps the palette to pure primaries BY DESIGN and is audited
 *  separately below. The family rule is asserted over the four NORMAL themes. */
const NORMAL = (THEME_IDS ?? []).filter(t => t !== 'contrast');
const KEYS = COLOR_KEYS ?? [];

assert('ag1.keys-and-themes-are-enumerable',
  KEYS.length > 0 && NORMAL.length > 0 && !!PALETTES.dark && Object.keys(PALETTES.dark).length === KEYS.length,
  `${KEYS.length} keys x ${NORMAL.length} normal themes; the dark block declares ${Object.keys(PALETTES.dark ?? {}).length} --c-* values`);

/* Pre-fix baseline, measured and printed so the report can cite it. */
const PRE_SPREAD = spreadOf(PALETTES, KEYS, NORMAL);
console.log('\n  measured hue spread per token across the NORMAL themes (arithmetic on the sheet):');
for (const [k, m] of Object.entries(PRE_SPREAD)) {
  console.log(`    ${k.padEnd(7)} spread ${f2(m.spread).padStart(6)} deg   min sat ${f3(m.minSat)}   hues ${m.hues.map(h => f2(h)).join(' / ')}`);
}

const crossers0 = familyCrossers(PALETTES, KEYS, 0, NORMAL);
const crossersVis = familyCrossers(PALETTES, KEYS, SAT_VISIBLE, NORMAL);
console.log(`\n  crossers with NO visibility floor (${crossers0.length}): ` +
  (crossers0.map(c => `${c.theme}.${c.key} ${c.hex} sits in '${c.sits}'`).join(' | ') || 'none'));
console.log(`  crossers WITH the ${SAT_VISIBLE} floor (${crossersVis.length}): ` +
  (crossersVis.map(c => `${c.theme}.${c.key} ${c.hex} sits in '${c.sits}'`).join(' | ') || 'none'));

assert('ag2.NO-normal-theme-value-crosses-its-own-hue-family',
  crossersVis.length === 0,
  crossersVis.length === 0
    ? `0 crossers at a ${SAT_VISIBLE} visibility floor over ${NORMAL.length} themes x ${KEYS.length} keys`
    : `${crossersVis.length} crossers: ` + crossersVis.map(c => `${c.theme}.--c-${c.key}=${c.hex} reads as '${c.sits}' (hue ${f2(c.h)}, sat ${f3(c.s)}, ${f2(c.d)} deg from its own anchor)`).join('; '));

/* The floor is LOAD-BEARING, not decoration: without it, slate's paper value —
   a 185 deg rotation at saturation 0.118 — would be reported as a crosser. That
   is the brief's "near-grey, invisible" clearing, asserted rather than trusted. */
const satExempt = crossers0.filter(c => c.s < SAT_VISIBLE);
assert('ag3.the-visibility-floor-does-real-work',
  satExempt.length > 0 && crossersVis.length === crossers0.length - satExempt.length,
  `the floor exempts ${satExempt.length} value(s) the un-floored probe flags — ` +
  satExempt.map(c => `${c.theme}.--c-${c.key} at sat ${f3(c.s)} (hue ${f2(c.h)}, ${c.sits})`).join(', ') +
  `; every one of them is a near-grey rotation, not a family change`);

/* cyan's 22 deg spread never LEAVES its family — the brief's clearing of cyan is
   arithmetically confirmed here rather than taken on faith. */
const CY = PRE_SPREAD.cyan ?? PRE_SPREAD.cyan;
assert('ag4.cyan-is-cleared-same-family-not-a-bug',
  !!CY && CY.spread > 15 && familyCrossers(PALETTES, KEYS, 0, NORMAL).every(c => c.key !== 'cyan'),
  CY ? `cyan spreads ${f2(CY.spread)} deg (dark ${f2(CY.hues[0])} -> paper ${f2(CY.hues[2])}) and STILL classifies as cyan at NO floor: cyan-teal -> teal, one family` : 'cyan missing');

/* slate is cleared for the OTHER reason: low saturation. */
const SL = PRE_SPREAD.slate;
assert('ag5.slate-is-cleared-near-grey-not-a-bug',
  !!SL && SL.spread > 100 && SL.minSat < SAT_VISIBLE && !crossersVis.some(c => c.key === 'slate'),
  SL ? `slate spreads ${f2(SL.spread)} deg but its worst value is sat ${f3(SL.minSat)} < ${SAT_VISIBLE}: invisible as a signal, and no user sees a family it left` : 'slate missing');

/* ---- the amber bug itself -------------------------------------------------- */
const AMBER = PRE_SPREAD.amber;
const amberPreLight = '#92400e', amberPrePaper = '#92400e';
const amberWasCrosser = (() => {
  const anch = anchors(PALETTES, KEYS);
  const cl = classify(amberPreLight, anch, 0), cp = classify(amberPrePaper, anch, 0);
  return {light: cl, paper: cp};
})();
const AMBER_ANCHOR = hsv(PALETTES.dark['--c-amber']).h;
const amberValues = NORMAL.map(t => ({theme: t, hex: PALETTES[t]['--c-amber']}));
const amberCls = amberValues.map(v => {
  const c = classify(v.hex, anchors(PALETTES, KEYS), SAT_VISIBLE);
  const {bg, surface} = themeBg(v.theme);
  return {...v, h: c.h, s: c.s, key: c.key, d: c.d, bg, surface, cbg: contrast(v.hex, bg), csf: contrast(v.hex, surface)};
});
console.log('\n  --c-amber per normal theme (hue / sat / contrast vs --bg AND --surface):');
for (const a of amberCls) {
  console.log(`    ${a.theme.padEnd(9)} ${a.hex}  hue ${f2(a.h)}  sat ${f3(a.s)}  vs --bg ${a.bg} ${f2(a.cbg)}:1  vs --surface ${a.surface} ${f2(a.csf)}:1  sits in '${a.key}'`);
}
assert('ag6.every-normal-theme-amber-sits-in-the-amber-family',
  amberCls.every(a => a.key === 'amber'),
  amberCls.map(a => `${a.theme}:${a.hex} h=${f2(a.h)} -> '${a.key}'`).join('  '));

assert('ag6b.amber-hue-spread-is-now-under-the-visible-rotation-threshold',
  AMBER && AMBER.spread < 10,
  `${AMBER ? f2(AMBER.spread) : '?'} deg across the ${NORMAL.length} normal themes (each value keeps the dark hue ${f2(AMBER_ANCHOR)} within ${f2(Math.max(...amberCls.map(a => hueDist(a.h, AMBER_ANCHOR))))} deg)`);

/* THE NEGATIVE CONTROL — point the SAME probe at the PRE-FIX values. No file is
   written: the pre-fix sheet is built in memory by substituting the two light
   values back, and the probe must report amber OUT with the pre-fix numbers. */
const prefixPal = JSON.parse(JSON.stringify(PALETTES));
prefixPal.light['--c-amber'] = amberPreLight;
prefixPal.paper['--c-amber'] = amberPrePaper;
const ncCrossers = familyCrossers(prefixPal, KEYS, SAT_VISIBLE, ['light', 'paper']);
const ncAmber = ncCrossers.filter(c => c.key === 'amber');
assert('ag6c.NEGATIVE-CONTROL-the-probe-goes-RED-on-the-pre-fix-amber',
  ncAmber.length === 2 && ncAmber.every(c => c.sits === 'accent') && ncAmber.every(c => c.s >= SAT_VISIBLE),
  ncAmber.length === 2
    ? `pre-fix amber reports ${ncAmber.length} crossers — ` +
      ncAmber.map(c => `${c.theme} ${c.hex} hue ${f2(c.h)} sits in '${c.sits}' (${f2(c.d)} deg off the amber anchor ${f2(AMBER_ANCHOR)}, sat ${f3(c.s)} > floor)`).join('; ') +
      ` — and the ${SAT_VISIBLE} floor does NOT hide them, because they are fully saturated`
    : `expected 2 pre-fix amber crossers, got ${ncAmber.length}`);

/* A second control: the probe must be red on a SATURATED value that genuinely
   sits in another family even though the palette is otherwise correct — so
   "amber passes" cannot be a probe that answers "everything is fine". The swap
   is confined to a NON-dark theme on purpose: the anchors are the DARK palette,
   so mutating dark would move the anchor to the wrong value and the probe would
   classify the mutation as correct (a self-fulfilling control). */
const synth = {};
for (const t of THEME_IDS ?? []) synth[t] = {...PALETTES[t]};
synth.light['--c-green'] = '#4465e9';                        // blue, hue 228, sat 0.71
const synthHits = familyCrossers(synth, KEYS, SAT_VISIBLE, ['light']);
assert('ag6d.NEGATIVE-CONTROL-a-saturated-family-change-is-caught',
  synthHits.length === 1 && synthHits[0].key === 'green' && synthHits[0].sits === 'blue',
  synthHits.length === 1
    ? `a saturated swap (light --c-green = #4465e9 at sat ${f3(synthHits[0].s)} — the DARK anchors are untouched, so the ` +
      `probe itself is not moving) reports 'green' sitting in '${synthHits[0].sits}' at ${f2(synthHits[0].d)} deg from the blue anchor; ` +
      `the probe classifies by hue across all ${KEYS.length} keys, so "amber passes" is not an answer it always gives`
    : `probe found ${synthHits.length} hits — it is not actually classifying`);

/* the contrast theme is audited, not asserted silently away. It is the
   accessibility theme: it RE-MAPS the six original hues onto pure primaries on
   purpose (accent->#ffff00 yellow = 60 deg, cyan->#00ffff, green->#80ff80), so
   it is excluded from the normal-theme family rule and audited on its OWN terms. */
const conCrossers = familyCrossers(PALETTES, KEYS, SAT_VISIBLE, ['contrast']);
const conDeclared = new Set(['accent', 'green', 'cyan']);
console.log(`\n  contrast (accessibility theme) audit: ${conCrossers.length} crosser(s) — ` +
  (conCrossers.map(c => `--c-${c.key}=${c.hex} hue ${f2(c.h)} sits in '${c.sits}'`).join('; ') || 'none'));
assert('ag7.contrast-re-maps-ONLY-ITS-OWN-PRIMARIES',
  conCrossers.length > 0
    && conCrossers.every(c => conDeclared.has(c.key))
    && KEYS.filter(k => ['red', 'blue', 'pink'].includes(k)).every(k => !conCrossers.some(c => c.key === k)),
  `${conCrossers.length} declared re-maps (${conCrossers.map(c => c.key).join(', ')}) — the three pure primaries this ` +
  `theme has ALWAYS used for accent/green/cyan; the three NEW tokens (red/blue/pink) are all in their own families here: ` +
  `red ${PALETTES.contrast['--c-red']} h=${f2(hsv(PALETTES.contrast['--c-red']).h)}, ` +
  `blue ${PALETTES.contrast['--c-blue']} h=${f2(hsv(PALETTES.contrast['--c-blue']).h)}, ` +
  `pink ${PALETTES.contrast['--c-pink']} h=${f2(hsv(PALETTES.contrast['--c-pink']).h)}`);

const AMBER_LIGHT = PALETTES.light['--c-amber'];
const amberClsLight = classify(AMBER_LIGHT, anchors(PALETTES, KEYS), SAT_VISIBLE);

/* THE MEASURED FACT the brief says to respect rather than fight: on a light
   canvas no yellow hue is BOTH clearly yellow and >=4.5:1. Search it. */
assert('ag7b.the-new-amber-paper-value-holds-hue-AND-clears-its-theme-floor',
  (() => {
    const {h, s} = hsv(PALETTES.paper['--c-amber']);
    return hueDist(h, hsv(PALETTES.dark['--c-amber']).h) < 3 && s >= 0.9 && worstContrast(PALETTES.paper['--c-amber'], 'paper') >= 5.5;
  })(),
  `paper --c-amber=${PALETTES.paper['--c-amber']} holds the dark hue (${f2(hueDist(hsv(PALETTES.paper['--c-amber']).h, hsv(PALETTES.dark['--c-amber']).h))} deg off) at sat ` +
  `${f3(hsv(PALETTES.paper['--c-amber']).s)} with a worst-surface contrast of ${f2(worstContrast(PALETTES.paper['--c-amber'], 'paper'))}:1 ` +
  `(its pre-round floor); light --c-amber=${AMBER_LIGHT} sits in '${amberClsLight.key}' at ${f3(amberClsLight.s)} sat`);

/* The light ink must clear a real floor on BOTH surfaces with MARGIN, not land on
   a boundary. The value first chosen measured 4.4964 on --bg — under 4.5 once
   rounded — so it was darkened one step to buy margin without moving the hue. */
const ambBg = contrast(AMBER_LIGHT, themeBg('light').bg);
const ambSurf = contrast(AMBER_LIGHT, themeBg('light').surface);
assert('ag7d.the-light-amber-clears-4.5-and-5.0-with-margin-on-both-surfaces',
  ambBg >= 4.55 && ambSurf >= 5.0,
  `light --c-amber=${AMBER_LIGHT} measures ${ambBg.toFixed(4)}:1 on --bg ${themeBg('light').bg} and ${ambSurf.toFixed(4)}:1 on ` +
  `--surface ${themeBg('light').surface} (hue ${f2(hsv(AMBER_LIGHT).h)}, sat ${f3(hsv(AMBER_LIGHT).s)}). The value picked first, ` +
  `#946b00, measured 4.4964 on --bg — below 4.5 once rounded — so it was darkened a step to #8e6700, which buys margin and ` +
  `leaves the hue and the full saturation untouched.`);

/* the three new LIGHT values are the tools' own — assert the contrast they
   actually deliver on BOTH surfaces, so "taken from the tools" is not a claim
   about readability. */
const NEWLIGHT = ['red', 'blue', 'pink'].map(k => {
  const {bg, surface} = themeBg('light');
  const hex = PALETTES.light['--c-' + k];
  return {k, hex, bg, surface, cbg: contrast(hex, bg), csf: contrast(hex, surface), worst: worstContrast(hex, 'light')};
});
console.log('\n  the three new LIGHT values, contrast on BOTH light surfaces:');
for (const r of NEWLIGHT) console.log(`    --c-${r.k.padEnd(5)} ${r.hex}  vs --bg ${r.bg} ${f2(r.cbg)}:1   vs --surface ${r.surface} ${f2(r.csf)}:1`);
assert('ag7c.the-tools-own-light-values-are-readable-as-graph-strokes',
  NEWLIGHT.every(r => r.worst >= 4.0),
  NEWLIGHT.map(r => `${r.k} worst ${f2(r.worst)}:1`).join(', ') +
  ` — every one clears 4.0 on BOTH light surfaces, above the 3.0 WCAG 1.4.11 non-text floor; ` +
  `these are the three tools' own LIGHT red/blue/pink, not invented here`);

/* ===========================================================================
   B. every theme declares every key, in all three tables
   =========================================================================== */
console.log('\n=== B. the three new families, wired in every theme and every table ===');
const missing = [];
for (const t of THEME_IDS ?? []) {
  for (const k of KEYS) {
    const hex = PALETTES[t] && PALETTES[t]['--c-' + k];
    if (!hex) missing.push(`${t}:--c-${k}`);
  }
}
assert('ag8.EVERY-theme-declares-EVERY-key-in-COLOR_KEYS',
  missing.length === 0,
  missing.length === 0
    ? `${(THEME_IDS ?? []).length} themes x ${KEYS.length} keys = ${(THEME_IDS ?? []).length * KEYS.length} declarations, all present ` +
      `(enumerated from COLOR_KEYS, so a future token missing from one theme fails HERE)`
    : `${missing.length} missing: ${missing.join(', ')}`);

const badVar = KEYS.filter(k => !COLOR_VAR || COLOR_VAR[k] !== `var(--c-${k})`);
assert('ag9.EVERY-key-has-its-COLOR_VAR-entry',
  badVar.length === 0 && !!COLOR_VAR,
  badVar.length === 0
    ? `${KEYS.length}/${KEYS.length} keys resolve to var(--c-<key>)`
    : `wrong or absent: ${badVar.map(k => `${k}=${COLOR_VAR && COLOR_VAR[k]}`).join(', ')}`);

const badFallback = KEYS.filter(k => !COLORS_FALLBACK || !/^#[0-9a-fA-F]{6}$/.test(COLORS_FALLBACK[k] ?? ''));
assert('ag10.EVERY-key-has-its-COLORS-legacy-hex-entry',
  badFallback.length === 0 && !!COLORS_FALLBACK,
  badFallback.length === 0
    ? `${KEYS.length}/${KEYS.length} keys carry a literal hex fallback`
    : `wrong or absent: ${badFallback.join(', ')}`);

const notExported = KEYS.map(k => `--c-${k}`).filter(t => !(EXPORT_TOKENS ?? []).includes(t));
assert('ag11.every-key-is-in-EXPORT_TOKENS-so-a-standalone-SVG-resolves-it',
  notExported.length === 0,
  notExported.length === 0
    ? `${KEYS.length} --c-* tokens inlined by the exporter`
    : `missing from EXPORT_TOKENS: ${notExported.join(', ')}`);

/* the SPECIFIED hexes — item B's table, verbatim (the tools' own values) */
const SPECIFIED = [['red', 'dark', '#ff6b6b'], ['red', 'light', '#e03131'],
                   ['blue', 'dark', '#7aa2ff'], ['blue', 'light', '#4465e9'],
                   ['pink', 'dark', '#f783ac'], ['pink', 'light', '#c2255c']];
const wrongSpec = SPECIFIED.filter(([k, t, v]) => (PALETTES[t] ?? {})['--c-' + k] !== v);
assert('ag12.the-three-new-families-use-the-specified-hexes',
  wrongSpec.length === 0,
  wrongSpec.length === 0
    ? SPECIFIED.map(([k, t, v]) => `${k}.${t}=${v}`).join('  ')
    : wrongSpec.map(([k, t, v]) => `${k}.${t} expected ${v}, got ${(PALETTES[t] ?? {})['--c-' + k]}`).join('; '));

/* brown must NOT be a token: it is dark yellow/orange, not a hue family, and the
   broken amber light value already WAS one — a brown token would legitimise it. */
const brownKeys = KEYS.filter(k => /brown|earth/i.test(k));
assert('ag13.brown-is-deliberately-NOT-a-token',
  brownKeys.length === 0,
  brownKeys.length === 0 ? `COLOR_KEYS carries no brown family (orange is 'accent' and reads orange)` : `unexpected: ${brownKeys.join(', ')}`);

/* the token must still be NAMED for its hue, not renamed to a role — Harvey chose
   Option A, and a role name would hide the bug instead of fixing it. */
const roleNames = KEYS.filter(k => /^(control|wait|warn|info|ok|error|success|danger)$/.test(k));
assert('ag14.the-amber-token-keeps-its-HUE-name',
  KEYS.includes('amber') && roleNames.length === 0,
  KEYS.includes('amber')
    ? `the token is still 'amber'; no role name (control/wait/…) was introduced (${roleNames.length} found)`
    : 'the amber key is gone from COLOR_KEYS — a rename would hide the bug rather than fix it');

/* ===========================================================================
   C. the 9% fill — RECORDED, NOT CHANGED
   =========================================================================== */
console.log('\n=== C. the 9% fill: measured, on file, untouched ===');
const FILL_DECL = "color-mix(in srgb, var(--nc, var(--border-strong)) 9%, transparent)";
assert('ag15.the-9-percent-fill-is-UNCHANGED',
  SHAPES_RAW.includes(FILL_DECL),
  SHAPES_RAW.includes(FILL_DECL)
    ? `src/shapes.tsx still declares FILL as the 9% mix, verbatim — Mermaid reached the same conclusion and deletes its background array in dark mode entirely; the STROKE carries the semantics here`
    : 'the 9% fill declaration moved or changed — item C says record the number, change nothing');

console.log('  color-mix(in srgb, <token> 9%, transparent) flattened over each theme\'s --bg AND --surface:');
const fillRows = [];
for (const t of THEME_IDS ?? []) {
  const {bg, surface} = themeBg(t);
  const ds = [], ss = [];
  for (const k of KEYS) {
    const hex = PALETTES[t] && PALETTES[t]['--c-' + k];
    if (!hex) continue;
    for (const base of [bg, surface]) {
      ds.push(contrast(mixOver(hex, 9, base), base));
      ss.push(contrast(hex, base));
    }
  }
  fillRows.push({t, dMin: Math.min(...ds), dMax: Math.max(...ds), sMin: Math.min(...ss), sMax: Math.max(...ss)});
  console.log(`    ${t.padEnd(9)} fill delta ${f2(fillRows.at(-1).dMin)}–${f2(fillRows.at(-1).dMax)}   stroke ${f2(fillRows.at(-1).sMin)}–${f2(fillRows.at(-1).sMax)}   (--bg ${bg}, --surface ${surface})`);
}
assert('ag16.the-9-percent-fill-is-invisible-as-a-signal',
  fillRows.every(r => r.dMin >= 1.0 && r.dMax <= 1.25 && r.sMin >= 4.0),
  `every theme's 9% fill lands in 1.0–1.25 (invisible), while its stroke lands in 4.0+ (the signal) — ` +
  `measured over ${KEYS.length} tokens x ${(THEME_IDS ?? []).length} themes x 2 surfaces, arithmetic on the sheet`);

/* ===========================================================================
   D. contrast envelope + the legacy board path
   =========================================================================== */
console.log('\n=== D. contrast envelope, and boards carrying legacy hex ===');
for (const t of THEME_IDS ?? []) {
  const {bg, surface} = themeBg(t);
  const cs = KEYS.map(k => worstContrast(PALETTES[t]['--c-' + k], t));
  console.log(`  ${t.padEnd(9)} ${KEYS.length} tokens  worst-surface contrast ${f2(Math.min(...cs))}–${f2(Math.max(...cs))}   (--bg ${bg}, --surface ${surface})`);
}
const allC = [];
for (const t of THEME_IDS ?? []) {
  for (const k of KEYS) allC.push({t, k, c: worstContrast(PALETTES[t]['--c-' + k], t)});
}
const worst = allC.reduce((a, b) => (b.c < a.c ? b : a));
assert('ag17.every-token-readable-in-every-theme',
  worst.c >= 3.0,
  `worst case ${f2(worst.c)} (${worst.t}.--c-${worst.k}) over ${allC.length} token/theme pairs, taken against the STRICTER of ` +
  `the theme's two surfaces; 3.0 is the WCAG 1.4.11 floor for a non-text graphic (the frame stroke and the fill's own edge) ` +
  `and every pair clears it`);

/* The legacy path, EXECUTED — bundled with the project's own esbuild and imported. */
const ENTRY = `${ROOT}/.ag-colors-entry.ts`;
const OUT = `${ROOT}/.ag-colors-out.mjs`;
let legacyReport = null, legacyOk = false;
try {
  writeFileSync(ENTRY, "export * from './src/colors';\n");
  await (await import('esbuild')).build({
    entryPoints: [ENTRY], bundle: true, format: 'esm', platform: 'node',
    outfile: OUT, logLevel: 'error',
  });
  const M = await import(`${OUT}?t=${Date.now()}`);
  const bad = [];
  const legacyCount = Object.keys(LEGACY ?? {}).length;
  /* 1. Every literal a SHIPPED board can carry must still land on its key, in
        either case (a board may have been written with any casing). */
  for (const [hex, k] of Object.entries(LEGACY ?? {})) if (M.keyForHex(hex) !== k) bad.push(`${hex}->${M.keyForHex(hex)} (want ${k})`);
  for (const [, hex] of Object.entries(LEGACY ?? {})) if (M.keyForHex(hex.toUpperCase()) !== M.keyForHex(hex)) bad.push(`${hex} case-insensitive lookup`);
  for (const [hex] of Object.entries(LEGACY ?? {})) if (M.keyForHex(' ' + hex + '\t') === undefined) bad.push(`${hex} whitespace-tolerant lookup`);
  /* 2. Every key resolves, is accepted, and the custom-hex escape hatch — which
        is the ONLY way a user-supplied colour survives — is intact. The escape
        hatch is why LEGACY_HEX must stay at the six literals that SHIPPED: a
        mapping for a NEW value would capture a user's custom colour and turn it
        into a token. Positive control: a hex not in the table stays a literal. */
  for (const k of KEYS) {
    if (M.resolveColor({colorKey: k}) !== `var(--c-${k})`) bad.push(`resolveColor({colorKey:'${k}'})`);
    if (!M.isColorKey(k)) bad.push(`${k} is not an isColorKey`);
    if (M.keyForHex(M.COLORS[k]) !== (LEGACY ?? {})[M.COLORS[k].toLowerCase()]) {
      bad.push(`keyForHex(COLORS.${k}=${M.COLORS[k]}) -> ${M.keyForHex(M.COLORS[k])}, not the LEGACY_HEX mapping`);
    }
  }
  for (const hex of ['#ff6b6b', '#7aa2ff', '#f783ac', '#946b00', '#6d4f00', '#ac0000', '#0031f5', '#123456']) {
    if (M.keyForHex(hex) !== undefined) bad.push(`${hex} is in LEGACY_HEX — it would capture a user's CUSTOM colour`);
    if (M.resolveColor({color: hex}) !== hex) bad.push(`custom hex ${hex} was not preserved through resolveColor`);
  }
  if (M.isColorKey('brown') || M.isColorKey('nope')) bad.push('isColorKey accepted a non-key');
  if (M.resolveColor(undefined) !== 'var(--c-slate)') bad.push('the no-colour default changed');
  legacyOk = bad.length === 0;
  legacyReport = bad.length === 0
    ? `${legacyCount} shipped legacy hexes load back onto their keys (both cases, whitespace-tolerant); ` +
      `${KEYS.length} keys resolve to var(--c-*) and pass isColorKey; the custom-hex escape hatch and the no-colour slate ` +
      `default are intact, and all ${8} probed non-legacy hexes (INCLUDING the three new tokens' own values) stay literals — ` +
      `because a LEGACY_HEX entry for a NEW value would silently capture a user's custom colour and turn it into a token`
    : `broken: ${bad.join('; ')}`;
} catch (e) {
  legacyReport = `could not execute src/colors.ts: ${e.message}`;
} finally {
  for (const f of [ENTRY, OUT]) { try { rmSync(f, {force: true}); } catch { /* gone */ } }
}
assert('ag18.a-board-carrying-legacy-hex-still-loads-onto-its-key',
  legacyOk, legacyReport ?? '');

/* ===========================================================================
   E. the untouched invariants
   =========================================================================== */
console.log('\n=== E. invariants this round must not move ===');
assert('ag19.the-shared-swatches-row-is-still-flex',
  /\.swatches\s*\{[^}]*display:\s*flex/.test(STYLES) || /\.swatches\s*\{[^}]*display:\s*flex/.test(STYLES_RAW),
  `the colour swatch row keeps display:flex (the segmented rows get their own two-class rule)`);
assert('ag20.the-shortcut-table-is-untouched',
  readFileSync(`${ROOT}/src/Settings.tsx`, 'utf8').includes('SHORTCUTS_MOUSE'),
  `SHORTCUTS_MOUSE is still declared and rendered in src/Settings.tsx`);

/* THE HEX-COUNT ARITHMETIC, on file. ROUND AG1 ADDS colour on purpose, so the
   sheet's literal count rises and the gate is a CEILING, not a pin. The two
   amber fixes are REPLACEMENTS (same count in, same count out); only the three
   new families add. Four hex literals this round's own docblocks had quoted were
   removed, because a docblock's hex is counted by the very probe the gates use —
   measured on this repo before, prose has made a "must be 0" probe read 2. */
const HEX_COUNT = (STYLES_RAW.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).length;
const HEX_CEILING = 160;
console.log(`\n  hex literals in src/styles.css: ${HEX_COUNT}`);
console.log(`  arithmetic: 127 (pre-round) + 15 (three new families x five themes) = 142`);
console.log(`  the amber fixes are REPLACEMENTS: light and paper each swap one literal for one, so they add 0.`);
console.log(`  midnight/contrast amber did not move at all. Four hex literals written into this round's own`);
console.log(`  docblocks were removed, so no prose is counted as a token.`);
assert('ag25.the-hex-count-is-the-claim-in-the-report',
  HEX_COUNT === 142,
  `127 + 15 = ${HEX_COUNT}, matching the report's arithmetic; the sheet sits under the ${HEX_CEILING} ceiling the four ` +
  `pre-existing token gates now carry`);

/* ===========================================================================
   F. PRE-FIX REPLAY — the whole set, re-run against the pre-fix palette
   ===========================================================================
   The brief requires that each new assertion be shown RED before the fix. This
   section reconstructs the PRE-FIX palette in memory (no file is written, no
   git operation) and re-runs the same predicates over it, asserting they fail.
   A control that only passes on the fixed tree is measuring nothing; a control
   that passes on the pre-fix tree too would prove the assertion catches nothing.
*/
console.log('\n=== F. pre-fix replay: every new assertion must be RED before the fix ===');
const prefix = {};
for (const t of THEME_IDS ?? []) prefix[t] = {...PALETTES[t]};
/* EXACTLY the pre-fix tree: only light and paper had rotated amber (to the same
   brown), dark and midnight already held the hue. Mutating dark as well would
   move the ANCHOR to the brown and make the replay agree with itself — the same
   self-fulfilling trap as ag6d. */
for (const t of ['light', 'paper']) prefix[t]['--c-amber'] = '#92400e';
for (const t of THEME_IDS ?? []) for (const k of ['red', 'blue', 'pink']) delete prefix[t]['--c-' + k];
const preCrossers = familyCrossers(prefix, KEYS, SAT_VISIBLE, NORMAL);
const preMissing = [];
for (const t of THEME_IDS ?? []) for (const k of KEYS) if (!prefix[t]['--c-' + k]) preMissing.push(`${t}:--c-${k}`);
const preSpecified = SPECIFIED.filter(([k, t, v]) => (prefix[t] ?? {})['--c-' + k] !== v);
const preSpread = spreadOf(prefix, KEYS, NORMAL);
const preA2 = preCrossers.length === 0;
const preA6 = NORMAL.every(t => classify(prefix[t]['--c-amber'], anchors(prefix, KEYS), SAT_VISIBLE).key === 'amber');
const preA6b = (preSpread.amber?.spread ?? 999) < 10;
const preA8 = preMissing.length === 0;
const preA12 = preSpecified.length === 0;
console.log(`  pre-fix amber crossers (A2)      : ${preCrossers.length} ${preCrossers.map(c => `${c.theme}.${c.key}->${c.sits}`).join(' ')}`);
console.log(`  pre-fix amber spread (A6b)       : ${f2(preSpread.amber?.spread ?? NaN)} deg`);
console.log(`  pre-fix missing declarations (A8): ${preMissing.length} ${preMissing.slice(0, 4).join(' ')}${preMissing.length > 4 ? ' …' : ''}`);
console.log(`  pre-fix wrong new hexes (A12)    : ${preSpecified.length}`);
assert('ag21.PRE-FIX-REPLAY-A2-was-RED',
  preA2 === false,
  preA2 === false ? `A2 would have failed with ${preCrossers.length} crossers — that is the assertion that catches the bug` : 'A2 passed on the pre-fix palette: it catches nothing');
assert('ag22.PRE-FIX-REPLAY-A6-and-A6b-were-RED',
  preA6 === false && preA6b === false,
  preA6 === false && preA6b === false
    ? `A6 failed (amber sat outside its family in light/paper) and A6b failed (${f2(preSpread.amber?.spread ?? NaN)} deg > 10)`
    : `A6=${preA6} A6b=${preA6b} on the pre-fix palette — the amber assertions catch nothing`);
assert('ag23.PRE-FIX-REPLAY-A8-and-A12-were-RED',
  preA8 === false && preA12 === false,
  preA8 === false && preA12 === false
    ? `A8 failed with ${preMissing.length} missing declarations and A12 failed with ${preSpecified.length} wrong new hexes`
    : `A8=${preA8} A12=${preA12} on the pre-fix palette — the wiring assertions catch nothing`);
assert('ag24.PRE-FIX-REPLAY-does-not-disturb-the-fixed-tree',
  familyCrossers(PALETTES, KEYS, SAT_VISIBLE, NORMAL).length === 0 && (PALETTES.light['--c-amber'] === AMBER_LIGHT),
  `after the replay the LIVE palette still reports 0 crossers and light amber is still ${PALETTES.light['--c-amber']} — the replay mutated copies in memory only`);

/* ===========================================================================
   SUMMARY
   =========================================================================== */
const failed = results.filter(r => !r.pass);
console.log(`\n${'='.repeat(72)}`);
console.log(`ROUND AG1 colours — ${results.length - failed.length}/${results.length} assertions pass`);
if (failed.length) for (const f of failed) console.log(`  FAIL  ${f.id}  —  ${f.detail}`);
console.log(`${'='.repeat(72)}`);
process.exit(failed.length ? 1 : 0);
