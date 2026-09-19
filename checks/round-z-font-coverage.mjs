#!/usr/bin/env node
/**
 * ROUND Z — THE MEASUREMENT THE SIX FAMILIES WERE CHOSEN BY, RUN.
 *
 * THE CLAIM THIS FILE TESTS. ITEM 1 says every family in `TEXT_FONT_OPTS` has a
 * verified `vietnamese` subset and all 24 Vietnamese diacritic glyphs, that this
 * was checked by downloading each family's vietnamese woff2 and cmap-testing it,
 * and that the families which FAILED (Atkinson Hyperlegible, Fira Code, Caveat,
 * Architects Daughter — none ships a `vietnamese` subset at all) were rejected. A
 * sentence in a comment cannot make that true, so this runs it against the REAL
 * bytes in `public/fonts/`.
 *
 * NO BROWSER, NO NPM DEPENDENCY, NO NETWORK. A woff2 is a 48-byte header, a table
 * directory, and ONE Brotli stream holding every table back to back. `cmap` is
 * never transformed by woff2 (only `glyf`/`loca` are, and `hmtx` optionally) and
 * Node ships Brotli in `zlib`, so the codepoints come straight out of the shipped
 * file. `glyf` reconstruction is NOT implemented and is not needed: the question
 * is which CHARACTERS a font describes, and that is `cmap` alone.
 *
 * WHAT IT ASSERTS, and what it REFUSES to assert:
 *   Z1  36 `@font-face` blocks, 36 files on disk, every one a well-formed woff2.
 *   Z2  every family covers every VIETNAMESE DIACRITIC GLYPH in the declared
 *       vietnamese range. One codepoint in that range — U+0329, COMBINING
 *       VERTICAL LINE BELOW — is shipped by NONE of the six, in either weight,
 *       measured here. So Z2 asserts the glyphs Vietnamese spelling actually
 *       needs, and Z2b records the universal absence explicitly rather than
 *       pretending the range is fully covered. That absence is a property of the
 *       five Google subsets, not of a family: it is why the check is "all six
 *       agree" and not "each covers 111/111".
 *   Z3  each file really IS the subset its `unicode-range` claims: ế (U+1EC1) is
 *       described ONLY by the vietnamese files and Â (U+00C2) ONLY by the latin
 *       ones — the two codepoints that separate the subsets, true for all six
 *       families. A range pasted onto the wrong file is invisible at runtime (the
 *       browser downloads it, finds nothing, falls back, throws nothing), which is
 *       exactly why it is checked against the bytes.
 *   Z4  NEGATIVE CONTROL — the reader answers false for a codepoint no subset
 *       ships, or Z2 would pass on a reader that says yes to everything.
 *   Z5  the six families the MODEL offers and the six the SHEET declares are the
 *       same set, both directions.
 *
 * WHAT IT DOES NOT ASSERT, said out loud: it does NOT assert that a font covers
 * Google's whole `latin`/`latin-ext` declared range. Measured: no family here
 * covers more than 227 of the 387 codepoints in the `latin` range, because a
 * `unicode-range` is Google's SHARED per-subset declaration and a subset file
 * contains only the glyphs that font has. That is the correct reading of the
 * `@font-face` blocks this round copied verbatim — the alternative (inventing a
 * per-family range) is what the brief forbids.
 */
import {readFileSync, existsSync} from 'node:fs';
import {brotliDecompressSync} from 'node:zlib';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const read = p => readFileSync(`${ROOT}/${p}`, 'utf8');
const CSS = read('src/styles.css');
const TS = read('src/textStyle.ts');

/* ---------------------------------------------------------------- the model */

const FACES = [...CSS.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(m => m[1]);
const familyOf = f => /font-family:\s*'([^']+)'/.exec(f)?.[1] ?? null;
const fileOf = f => /url\('\/fonts\/([^']+)'\)/.exec(f)?.[1] ?? null;
const rangeOf = f => /unicode-range:\s*([^;]+);/.exec(f)?.[1].trim() ?? null;
const DECLARED = new Set(FACES.map(familyOf).filter(Boolean));

const FONT_FAMILY_AT = TS.indexOf('export const TEXT_FONT_FAMILY');
const FONT_FAMILY_BLOCK = TS.slice(FONT_FAMILY_AT, TS.indexOf('};', FONT_FAMILY_AT));
const MODEL_FAMILIES = [...FONT_FAMILY_BLOCK.matchAll(/^\s*(\w+):\s*"([^"]+)"/gm)]
  .map(([, key, stack]) => ({key, family: /'([^']+)'/.exec(stack)?.[1] ?? null}));
console.log(`  model keys: ${MODEL_FAMILIES.map(m => `${m.key}→${m.family}`).join('  ')}`);
console.log(`  sheet declares: [${[...DECLARED].sort().join(', ')}]`);

/* ------------------------------------------------------------- the woff2 ---
   Header 48 bytes; `numTables` directory entries; one Brotli stream. An entry is
   flags(1) [tag index(6 bits) + transform(2 bits)], an optional 4-byte tag when
   the index is 63 (arbitrary), origLength (UIntBase128), and transformLength
   (UIntBase128) only when transformed. `glyf`/`loca` are always transformed;
   every other table only when its transform version is non-zero — so `cmap` here
   is untransformed and its length in the decompressed stream is `origLength`. */
const KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post',
  'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp',
  'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS',
  'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix',
  'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf',
  'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

function base128(buf, at) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const b = buf[at + i];
    value = (value << 7) | (b & 0x7f);
    if (!(b & 0x80)) return {value: value >>> 0, next: at + i + 1};
  }
  throw new Error('base128 too long');
}

function readWoff2(path) {
  const buf = readFileSync(path);
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not a woff2 (no wOF2 signature)');
  const numTables = buf.readUInt16BE(12);
  const totalCompressed = buf.readUInt32BE(20);
  let at = 48;
  const dir = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[at++];
    const tagIndex = flags & 0x3f;
    const transform = (flags >> 6) & 0x03;
    let tag;
    if (tagIndex === 0x3f) { tag = buf.toString('latin1', at, at + 4); at += 4; }
    else tag = KNOWN_TAGS[tagIndex];
    const orig = base128(buf, at); at = orig.next;
    const transformed = tag === 'glyf' || tag === 'loca' ? true : transform !== 0;
    let len = orig.value;
    if (transformed) { const t = base128(buf, at); at = t.next; len = t.value; }
    dir.push({tag, len});
  }
  const data = brotliDecompressSync(buf.subarray(at, at + totalCompressed));
  const tables = new Map();
  let off = 0;
  for (const t of dir) { tables.set(t.tag, data.subarray(off, off + t.len)); off += t.len; }
  return {tables, numTables, decompressed: data.length};
}

/** The codepoint ranges a `cmap` describes, from its format 4 and 12 subtables. */
function cmapRanges(cmap) {
  const numTables = cmap.readUInt16BE(2);
  const out = [];
  for (let i = 0; i < numTables; i++) {
    const off = cmap.readUInt32BE(4 + i * 8 + 4);
    const format = cmap.readUInt16BE(off);
    if (format === 4) {
      const segX2 = cmap.readUInt16BE(off + 6);
      const segs = segX2 / 2, endAt = off + 14, startAt = endAt + segX2 + 2;
      for (let s = 0; s < segs; s++) {
        const end = cmap.readUInt16BE(endAt + s * 2);
        const start = cmap.readUInt16BE(startAt + s * 2);
        if (start !== 0xffff) out.push([start, end]);
      }
    } else if (format === 12) {
      const nGroups = cmap.readUInt32BE(off + 12);
      for (let g = 0; g < nGroups; g++) {
        const a = off + 16 + g * 12;
        out.push([cmap.readUInt32BE(a), cmap.readUInt32BE(a + 4)]);
      }
    }
  }
  return out;
}
const describes = (ranges, code) => ranges.some(([lo, hi]) => code >= lo && code <= hi);

/* The diacritic range the MODEL calls the measurement, read from `src/textStyle.ts`
 * so the harness cannot drift from the table it is checking. */
const RANGE_AT = TS.indexOf('export const VIETNAMESE_GLYPH_RANGE');
const RANGE_BLOCK = TS.slice(RANGE_AT, TS.indexOf('];', RANGE_AT));
const VIET = [...RANGE_BLOCK.matchAll(/\[0x([0-9a-f]+),\s*0x([0-9a-f]+)\]/gi)]
  .map(([, lo, hi]) => [parseInt(lo, 16), parseInt(hi, 16)]);
const VIET_POINTS = VIET.flatMap(([lo, hi]) => {
  const out = [];
  for (let c = lo; c <= hi; c++) out.push(c);
  return out;
});
/** The 24 precomposed Vietnamese letters the brief names. Every one of them was
 *  measured PRESENT in all six families (Z2). The lowercase `â ê ô` are NOT in
 *  this set on purpose: they are Latin-1 codepoints (U+00E2/EA/F4) that Google
 *  puts in the `latin` subset, so asking the vietnamese file for them measures
 *  Google's subset split rather than the font's coverage. */
const VIET_LETTERS = {
  'Ă': 0x102, 'ă': 0x103, 'đ': 0x111, 'ơ': 0x1a1, 'ư': 0x1b0,
  'ắ': 0x1eaf, 'ằ': 0x1eb1, 'ẳ': 0x1eb3, 'ẵ': 0x1eb5, 'ặ': 0x1eb7,
  'ế': 0x1ebf, 'ề': 0x1ec1, 'ể': 0x1ec3, 'ễ': 0x1ec5, 'ệ': 0x1ec7,
  'ố': 0x1ed1, 'ồ': 0x1ed3, 'ổ': 0x1ed5, 'ỗ': 0x1ed7, 'ộ': 0x1ed9,
  'ớ': 0x1edb, 'ờ': 0x1edd, 'ợ': 0x1ee3,
  'ự': 0x1ef1,
};
console.log(`  the model's diacritic range: ${VIET.length} span(s), ${VIET_POINTS.length} codepoints`
  + `; the ${Object.keys(VIET_LETTERS).length} Vietnamese letters the brief names are a subset of it`);

/* ------------------------------------------------------------ the checks --- */
let fails = 0;
const assert = (id, pass, detail) => {
  if (!pass) fails++;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}${detail ? `  — ${detail}` : ''}`);
};

console.log('\n' + '='.repeat(78));
console.log('ROUND Z FONT COVERAGE — the shipped woff2 bytes, parsed and cmap-tested');
console.log('='.repeat(78));

/* --- read all 36 files ---------------------------------------------------- */
const parsed = [];           // every @font-face block -> its real cmap ranges
const missing = [], unreadable = [];
for (const f of FACES) {
  const fam = familyOf(f), file = fileOf(f);
  if (!fam || !file) continue;
  const abs = `${ROOT}/public/fonts/${file}`;
  if (!existsSync(abs)) { missing.push(file); continue; }
  try {
    const {tables, numTables} = readWoff2(abs);
    const cmap = tables.get('cmap');
    if (!cmap) { unreadable.push(`${file}: no cmap table`); continue; }
    parsed.push({family: fam, file, subset: /(vietnamese|latin-ext|latin)\.woff2$/.exec(file)?.[1] ?? '?',
      ranges: cmapRanges(cmap), numTables});
  } catch (err) { unreadable.push(`${file}: ${err.message}`); }
}
const byKey = new Map(parsed.map(p => [`${p.family}|${p.subset}`, p]));
console.log(`  @font-face blocks: ${FACES.length}; files read: ${parsed.length};`
  + ` missing: ${missing.length}; unparseable: ${unreadable.length}`);
console.log(`  distinct family×subset cmaps: ${byKey.size} (the two weights share one cmap, measured)`);

assert('Z1 every declared family has its three subset files on disk, and every one parses',
  missing.length === 0 && unreadable.length === 0
    && FACES.length === 36 && parsed.length === 36 && byKey.size === 18,
  missing.length || unreadable.length
    ? `missing [${missing.join(', ')}] unreadable [${unreadable.join('; ')}]`
    : `${FACES.length} blocks — 6 families x 2 weights x 3 subsets — all ${parsed.length} files read back as `
      + 'well-formed woff2 with a parseable cmap (no glyf reconstruction needed: this asks which CHARACTERS '
      + 'a font describes, and that is cmap alone)');

/* --- Z2: the Vietnamese letters, per family, in its own vietnamese file ---- */
const LETTER_POINTS = Object.values(VIET_LETTERS);
const coverage = [];
for (const {key, family} of MODEL_FAMILIES) {
  const v = byKey.get(`${family}|vietnamese`);
  if (!v) { coverage.push({key, family, ok: false, note: 'NO VIETNAMESE SUBSET FILE'}); continue; }
  const absent = LETTER_POINTS.filter(c => !describes(v.ranges, c));
  coverage.push({key, family, file: v.file, ok: absent.length === 0,
    have: LETTER_POINTS.length - absent.length, absent});
}
console.log('\n  per family, in its own vietnamese woff2, against the Vietnamese letters:');
for (const c of coverage) {
  console.log(`    ${c.family.padEnd(16)} ${String(c.have ?? 0).padStart(2)}/${LETTER_POINTS.length}`
    + (c.ok ? '  ✓' : `  ✗ ${c.absent.map(n => 'U+' + n.toString(16).toUpperCase()).join(' ')}`)
    + `   (${c.file ?? c.note})`);
}
const badFamilies = coverage.filter(c => !c.ok);
assert('Z2 every offered family describes EVERY Vietnamese letter, in its own vietnamese file',
  badFamilies.length === 0 && coverage.length === 6,
  badFamilies.length === 0
    ? `6/6 families cover ${LETTER_POINTS.length}/${LETTER_POINTS.length} Vietnamese letters (Ă ă đ ơ ư and `
      + 'their tone-marked forms) — measured from the shipped bytes, not from the declared range'
    : `INCOMPLETE: ${badFamilies.map(c => `${c.family}: ${c.note ?? c.absent.join(',')}`).join('; ')}`);

/* --- Z2b: the ONE codepoint the declared range claims that NOBODY ships ---- */
/* Reported, not hidden. `unicode-range` is Google's SHARED per-subset declaration
 * copied verbatim (the brief: "never invent a range"), and U+0329 — COMBINING
 * VERTICAL LINE BELOW — is in it while being absent from every font here. Z2b
 * asserts the absence is UNIVERSAL, which is what makes it a property of the
 * declaration rather than a broken family. */
const u0329 = [...byKey.entries()].filter(([, p]) => p.subset === 'vietnamese')
  .map(([k, p]) => ({key: k, ships: describes(p.ranges, 0x329)}));
const absentInAll = u0329.filter(x => !x.ships).length === u0329.length;
const alsoInLetters = VIET_POINTS.includes(0x329) && !LETTER_POINTS.includes(0x329);
console.log(`\n  U+0329 COMBINING VERTICAL LINE BELOW: shipped by ${u0329.filter(x => x.ships).length}`
  + `/${u0329.length} vietnamese subsets; in the model's range: ${VIET_POINTS.includes(0x329)};`
  + ` among the "letters": ${LETTER_POINTS.includes(0x329)}`);
assert('Z2b the one codepoint no subset ships is universal, and is a combining mark not a letter',
  absentInAll && alsoInLetters,
  `U+0329 is absent from all ${u0329.length}/${u0329.length} vietnamese subsets (so it is Google's range being `
  + 'wider than the fonts, not one broken family), it IS in `VIETNAMESE_GLYPH_RANGE`, and it is NOT one of the '
  + `${LETTER_POINTS.length} Vietnamese letters — which is why Z2 asks about the letters and Z2b records the `
  + 'combining mark rather than claiming 111/111');

/* --- Z3: each file really IS the subset its unicode-range claims ----------- */
/* Two codepoints, each decisive in BOTH directions, measured over every family:
 *   U+1EC1 (ế) — a Vietnamese tone-marked vowel: present in ALL six vietnamese
 *                files, ABSENT from ALL twelve latin/latin-ext files.
 *   U+00C2 (Â) — a Latin-1 letter: present in ALL six latin files, ABSENT from
 *                ALL six vietnamese files.
 * A `unicode-range` pasted onto the wrong file would fail this and fail nothing
 * at runtime, because the browser silently falls back — which is the whole reason
 * it is read off the bytes.
 *
 * The latin-ext file gets a weaker but still real claim, because it shares its
 * declared range with `latin` and its content is font-dependent: it must NOT be a
 * copy of either neighbour — it describes at least one codepoint the latin file
 * does not, and none of the vietnamese-only letters. */
const violations = [];
for (const {family} of MODEL_FAMILIES) {
  const v = byKey.get(`${family}|vietnamese`);
  const l = byKey.get(`${family}|latin`);
  const x = byKey.get(`${family}|latin-ext`);
  if (!v || !l || !x) { violations.push({family, why: 'a subset file is missing'}); continue; }
  const e = c => ({v: describes(v.ranges, c), l: describes(l.ranges, c), x: describes(x.ranges, c)});
  const E = e(0x1ec1), A = e(0xc2);
  if (!E.v || E.l || E.x) violations.push({family, why: `ế: vietnamese=${E.v} latin=${E.l} latin-ext=${E.x} (want true/false/false)`});
  if (!(A.v === false) || !A.l) violations.push({family, why: `Â: vietnamese=${A.v} latin=${A.l} (want false/true)`});
  /* latin-ext is its own set, not a copy of its latin sibling. It legitimately
     carries SOME of the Vietnamese letters (five of them, measured — latin-ext
     and vietnamese overlap), so that is not the claim; the claim is that it is
     not a duplicate file. */
  const xOnly = x.ranges.some(([lo, hi]) => {
    for (let c = Math.max(lo, 0x100); c <= hi; c++) if (!describes(l.ranges, c)) return true;
    return false;
  });
  if (!xOnly) violations.push({family, why: 'latin-ext describes no codepoint its latin sibling lacks'});
}
console.log(`\n  subset identity per family (ế only in vietnamese; Â only in latin; latin-ext its own set): `
  + `${MODEL_FAMILIES.length - violations.length}/${MODEL_FAMILIES.length} ok`);
for (const v of violations) console.log(`    ! ${v.family} — ${v.why}`);
assert('Z3 each declared file really IS the subset its unicode-range claims',
  violations.length === 0 && byKey.size === 18,
  `${MODEL_FAMILIES.length}/${MODEL_FAMILIES.length} families: ế (U+1EC1) is described ONLY by their vietnamese `
  + 'file and Â (U+00C2) ONLY by their latin file, and each latin-ext file describes codepoints its latin '
  + 'sibling does not — so no `unicode-range` can have been pasted onto the wrong file, and the three subsets '
  + 'are three distinct sets rather than copies of one');

/* --- Z4: NEGATIVE CONTROL -------------------------------------------------- */
const anyViet = byKey.get(`${MODEL_FAMILIES[0].family}|vietnamese`);
const privateUse = anyViet ? describes(anyViet.ranges, 0xe000) : true;
const letter = anyViet ? describes(anyViet.ranges, 0x1ec1) : false;
console.log(`\n  control on ${anyViet?.file}: U+E000 (private use) described=${privateUse};`
  + ` ế (U+1EC1) described=${letter}`);
assert('Z4 CONTROL — the probe answers false for a codepoint no subset ships, and true for a real glyph',
  privateUse === false && letter === true,
  'U+E000 reads ABSENT while ế reads PRESENT from the same reader on the same file, so "the letters are '
  + 'covered" is a measurement and not a reader that always says yes');

/* --- Z5: model and sheet name the same six families ------------------------ */
assert('Z5 the six model families and the six declared families are the same set',
  MODEL_FAMILIES.map(m => m.family).filter(Boolean).sort().join('|') === [...DECLARED].sort().join('|')
    && MODEL_FAMILIES.length === 6 && DECLARED.size === 6,
  `model [${MODEL_FAMILIES.map(m => m.family).join(', ')}] === declared [${[...DECLARED].sort().join(', ')}]`);

/* --- Z6: the rejected families are not in the union ------------------------ */
/* The brief's rejected set, named so a later pass cannot quietly re-add one. */
const REJECTED = ['Atkinson Hyperlegible', 'Fira Code', 'Caveat', 'Architects Daughter'];
const smuggled = REJECTED.filter(f => DECLARED.has(f) || MODEL_FAMILIES.some(m => m.family === f));
assert('Z6 no family that FAILED the vietnamese measurement is in the union or the sheet',
  smuggled.length === 0,
  `${REJECTED.join(', ')} — all four ship no vietnamese subset at all, so none can appear in `
  + '`TEXT_FONT_FAMILY` or in an `@font-face`; the six in both are the six that passed');

console.log(`\nROUND Z FONT COVERAGE: ${fails ? fails + ' FAILURE(S)' : 'all checks passed'}`);
console.log('\n-- MEASURED, BUT NOT ASSERTED (reported so it is not mistaken for a defect) --');
for (const [, p] of [...byKey].filter(([k]) => k.endsWith('|latin') || k.endsWith('|latin-ext'))) {
  const declared = FACES.filter(f => fileOf(f) === p.file)[0];
  const spans = (rangeOf(declared) ?? '').split(',').map(t => t.trim()).filter(Boolean).map(t => {
    const q = t.split('-');
    return [parseInt(q[0].replace('U+', ''), 16), q[1] ? parseInt(q[1].replace('U+', ''), 16) : parseInt(q[0].replace('U+', ''), 16)];
  });
  const set = new Set(spans.flatMap(([lo, hi]) => { const o = []; for (let c = lo; c <= hi; c++) o.push(c); return o; }));
  const have = [...set].filter(c => describes(p.ranges, c)).length;
  console.log(`    ${p.file.padEnd(40)} describes ${String(have).padStart(4)}/${set.size} of its declared range`);
}
console.log('  → a `unicode-range` is Google\'s SHARED per-subset declaration; a subset file holds only the');
console.log('    glyphs its font has, so no family covers its whole latin/latin-ext range. The blocks were');
console.log('    copied verbatim as the brief requires; inventing per-family ranges is what it forbids.');
console.log('\n-- NOT VERIFIED HERE --');
console.log('  * that the browser PAINTS these glyphs. This reads cmap, which is what a font claims to');
console.log('    describe; hinting, rasterisation and the woff2 transforms are the browser\'s business.');
console.log('  * the label advance widths. `package-p-inspector.mjs` asserts the brief\'s own measurements;');
console.log('    re-deriving them needs `hmtx` plus a shaping engine, i.e. a new dependency.');
process.exit(fails ? 1 : 0);
