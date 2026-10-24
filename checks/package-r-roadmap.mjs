/* PACKAGE-R — the roadmap surface: the data model, the no-dates rule, the
 *  hex ratchet, and the one property the whole design rests on (status is
 *  TEXT, never colour alone).
 *
 *  House shape copied from checks/round-ao-colour-and-nub.mjs: DS_ROOT +
 *  DS_PRE_COMMIT env overrides, an assert() that prints PASS/FAIL with a detail
 *  line, a blank comment before every source probe, and a REPLAY at the bottom
 *  that re-runs the SOURCE probes against the pinned pre-change commit and
 *  REQUIRES THEM RED.
 *
 *  WHY THE REPLAY IS NOT OPTIONAL: an assertion that is green on both trees
 *  proves nothing. The probes that can only be green because PACKAGE-R landed
 *  are replayed and MUST be red on the pinned commit.
 *
 *  HOW THE DATA IS ASSERTED: `src/roadmap.ts` is EXECUTED, not transcribed.
 *  The project's own esbuild bundles it to ESM in the scratch dir and the
 *  bundle is imported, so the arrays under test are the shipped arrays. A
 *  source-text probe would pass on a file whose literals never reach ROADMAP.
 *
 *  WHAT IS DELIBERATELY NOT HERE: the live DOM (7 cards / 8 rows / 3 headings in
 *  a running browser) and the per-tier overflow measurements are the
 *  orchestrator's job — this process cannot drive a browser, and a live probe
 *  that silently degrades to a pass in that situation is worse than no probe.
 *
 *  Run:  node checks/package-r-roadmap.mjs
 *  Env:  DS_ROOT=<repo>          (defaults to this file's project dir)
 *        DS_PRE_COMMIT=<sha>     (defaults to the commit before PACKAGE-R)
 */

import {execFileSync} from 'node:child_process';
import {readFileSync, existsSync, mkdtempSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {dirname, resolve, join} from 'node:path';
import {tmpdir} from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DS_ROOT || resolve(HERE, '..');
/* 9532cf9 is the commit that ADDED src/roadmap.ts; its parent is the last tree
   on which the roadmap does not exist. Pinned as a default so a plain
   `node checks/package-r-roadmap.mjs` still runs the replay. */
const PRE_COMMIT = process.env.DS_PRE_COMMIT || 'c018656';

let pass = 0, fail = 0, skipped = 0;
const fails = [];

function assert(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; fails.push(name); console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
  if (detail) console.log(`        ${detail}`);
}
function skipProbe(name, why) { skipped++; console.log(`  SKIP  ${name} — ${why}`); }

const src = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const srcAt = (commit, p) => {
  try {
    return execFileSync('git', ['-C', ROOT, 'show', `${commit}:${p}`], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
  } catch { return null; }
};

/* Comments are stripped before any CSS text probe. This sheet legitimately
   QUOTES selectors and rules inside its prose (the ROUND AG2/AO comments do),
   so a naive `includes('<rule>')` can be satisfied by a comment describing the
   rule that the code no longer has — or, in the other direction, a probe can be
   broken by a comment. The REPLAY compares comment-stripped text too.
   NOTE the two counts differ on this sheet, and the difference is honest: 3 of
   the literals live INSIDE comments, so the project's ratchet command (raw
   grep) reads 144 while the code-only count reads 141. The ceiling applies to
   the RAW number, because that is the command the project runs. */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const hexCount = (css) => (css.match(/#[0-9a-fA-F]{3,8}/g) || []).length;

/* The one hex count the sheet is pinned at (PACKAGE-R §8.2). Kept as a CONSTANT
   of this harness rather than a live baseline: a harness that re-derives its own
   baseline is green after a ratchet break. 144 was measured on the pre-change
   tree and is asserted below, so the constant cannot silently rot. */
const HEX_CEILING = 144;

console.log(`\nPACKAGE-R — roadmap data, no-dates rule, hex ratchet, no colour-only status`);
console.log(`  ROOT=${ROOT}\n  PRE_COMMIT=${PRE_COMMIT}\n`);

/* ------------------------------------------------------------- the data --- */

/* The module is EXECUTED. esbuild bundles the project's OWN source to ESM (and
   to CJS as a fallback, for the same reason package-templates.mjs does — an
   esbuild build failure must not silently skip every data assertion). */
let M = null;
try {
  const outDir = mkdtempSync(join(tmpdir(), 'ds-roadmap-'));
  const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');
  let built = null;
  if (existsSync(ESBUILD)) {
    for (const [fmt, ext] of [['esm', '.mjs'], ['cjs', '.cjs']]) {
      const out = join(outDir, `roadmap${ext}`);
      try {
        execFileSync(ESBUILD, [resolve(ROOT, 'src/roadmap.ts'), '--bundle', `--format=${fmt}`, `--outfile=${out}`], {stdio: 'pipe'});
        built = out; break;
      } catch { /* try the next format */ }
    }
  }
  if (built) M = await import(pathToFileURL(built).href);
} catch { M = null; }

if (!M) {
  fail++;
  console.log('  FAIL  r0  src/roadmap.ts could not be bundled and executed (esbuild missing or the module does not compile)');
} else {
  const {ROADMAP, SHIPPED, ROADMAP_REVIEWED} = M;

  assert('r0  src/roadmap.ts exports ROADMAP, SHIPPED and ROADMAP_REVIEWED',
    Array.isArray(ROADMAP) && Array.isArray(SHIPPED) && typeof ROADMAP_REVIEWED === 'string',
    `ROADMAP=${typeof ROADMAP}, SHIPPED=${typeof SHIPPED}, ROADMAP_REVIEWED=${JSON.stringify(ROADMAP_REVIEWED)}`);

  /* The four names the consumer imports must exist as VALUES. The two type
     aliases are erased at runtime by definition, so they are asserted from
     SOURCE — which is the only place a type exists at all. */
  const rmSrc = src('src/roadmap.ts');
  assert('r1  the interface + type surface is declared (RoadmapStatus, RoadmapConfidence, RoadmapItem, ShippedEntry)',
    /export type RoadmapStatus\s*=\s*'now'\s*\|\s*'next'\s*\|\s*'later'/.test(rmSrc) &&
    /export type RoadmapConfidence\s*=\s*'committed'\s*\|\s*'exploring'/.test(rmSrc) &&
    /export interface RoadmapItem\s*\{/.test(rmSrc) &&
    /export interface ShippedEntry\s*\{/.test(rmSrc));

  /* 7 items, 2 now / 3 next / 2 later, 8 shipped — the spec's exact counts. */
  const counts = {now: 0, next: 0, later: 0};
  for (const it of ROADMAP) if (counts[it.status] !== undefined) counts[it.status]++;
  assert('r2  ROADMAP.length === 7', ROADMAP.length === 7, `measured ${ROADMAP.length}`);
  assert('r3  the status split is exactly 2 now / 3 next / 2 later',
    counts.now === 2 && counts.next === 3 && counts.later === 2,
    `now=${counts.now} next=${counts.next} later=${counts.later}`);
  /* PACKAGE-S re-anchor: SHIPPED grows as packages land — it is a floor (>= 8),
     not a pin. A pinned count goes RED on every future legitimate append, which
     is the same mistake the hex ratchet avoids by bounding, not pinning. */
  assert('r4  SHIPPED.length >= 8 (append-only ratchet)', SHIPPED.length >= 8, `measured ${SHIPPED.length}`);
  /* 2026-10-24 re-anchor: the reviewed line moved with the BF/BG review pass
     (the pane's honest provenance — it tracks the last real review, and pinning
     it to a past date would claim a review that did not happen). */
  assert('r5  ROADMAP_REVIEWED is 2026-10-24', ROADMAP_REVIEWED === '2026-10-24',
    `measured ${JSON.stringify(ROADMAP_REVIEWED)}`);

  /* --- the no-dates rule (spec §2, the non-negotiable one) ----------------
     A DATE-LIKE STRING IN AN ITEM IS THE FAILURE MODE THE RESEARCH MEASURED:
     a dated committed roadmap cannot be pruned without reading as
     cancellation. The pattern is the brief's, verbatim. */
  const DATEISH = /\b(20\d\d|Q[1-4]\b|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/;
  const dated = ROADMAP.filter((i) => DATEISH.test(i.title) || DATEISH.test(i.desc));
  assert('r6  NO date-like string in any item title or desc (the no-dates rule)',
    dated.length === 0,
    dated.length ? `${dated.length} item(s): ${dated.map((i) => i.title).join(' | ')}` : 'none of 7 items');

  /* Every item is renderable: a non-empty title and desc, a confidence IN the
     union, a status IN the union, and an area tag for the second chip. */
  const bad = ROADMAP.filter((i) =>
    typeof i.title !== 'string' || i.title.trim() === '' ||
    typeof i.desc !== 'string' || i.desc.trim() === '' ||
    (i.confidence !== 'committed' && i.confidence !== 'exploring') ||
    (i.status !== 'now' && i.status !== 'next' && i.status !== 'later') ||
    typeof i.area !== 'string' || i.area.trim() === '');
  assert('r7  every item has a non-empty title + desc, a valid confidence, a valid status and an area',
    bad.length === 0,
    bad.length ? `${bad.length} bad item(s)` : 'all 7 items');

  /* Both confidence words must actually OCCUR — a one-word file would satisfy
     r7 while making the label meaningless. */
  const confs = new Set(ROADMAP.map((i) => i.confidence));
  assert('r8  the items use BOTH confidence words', confs.has('committed') && confs.has('exploring'),
    [...confs].join(', '));

  /* Shipped rows: label/what/when all non-empty, and `when` is the one place a
     date belongs — asserted as a real YYYY-MM month, not free text. */
  const badShip = SHIPPED.filter((s) =>
    typeof s.label !== 'string' || s.label.trim() === '' ||
    typeof s.what !== 'string' || s.what.trim() === '' ||
    !/^\d{4}-\d{2}$/.test(s.when || ''));
  assert('r9  every shipped row has a label, a what, and a YYYY-MM when',
    badShip.length === 0,
    badShip.length ? `${badShip.length} bad row(s)` : 'all 8 rows');

  /* NEWEST FIRST is a claim the block's ORDER makes: the pane renders the array
     as-is, so the array IS the presentation order. Asserted exactly as the spec
     §4 table gives it, and separately as the structural property that makes the
     order meaningful (numbers descend inside each family, families do not
     interleave). A comment saying "newest first" proves nothing. */
  /* PACKAGE-S re-anchor: package 6 + 7 appended (newest first). The probe keeps
     checking the FULL sequence so an out-of-order insert still goes red.
     2026-10-24 re-anchor: the AR..BG arc prepended (newest first); the full
     sequence stays pinned so an out-of-order insert still goes red. */
  const EXPECT_ORDER = ['round BG', 'round BF', 'round AZ', 'round BA/AY', 'round AT', 'round AS', 'round AR', 'package 7', 'package 6', 'round 3', 'round 2', 'round 1', 'package 5', 'package 4', 'package 3', 'package 2', 'package 1'];
  const gotOrder = SHIPPED.map((s) => s.label);
  assert('r10 the shipped rows are in the spec order, newest first',
    gotOrder.length === EXPECT_ORDER.length && gotOrder.every((l, i) => l === EXPECT_ORDER[i]),
    `measured [${gotOrder.join(', ')}]`);

  /* 2026-10-24 re-anchor: the AR..BG arc prepended. Those labels are LETTER
     rounds (no trailing number) — their order is pinned by r10's full-sequence
     probe instead. This loop keeps policing the NUMBERED families only; a
     letter label that reaches it is skipped, not failed. */
  let desc = true, prevFam = null, prevN = Infinity;
  for (const s of SHIPPED) {
    const n = Number((s.label.match(/(\d+)\s*$/) || [])[1]);
    if (!Number.isFinite(n)) continue;
    const f = s.label.replace(/\s*\d+$/, '').trim();
    if (f !== prevFam) { prevFam = f; prevN = Infinity; }
    if (n > prevN) { desc = false; break; }
    prevN = n;
  }
  assert('r10b the numbers descend within each family and the families never interleave', desc,
    `measured [${gotOrder.join(', ')}]`);
}

/* -------------------------------------------------- zero hex in the block --- */

const css = stripComments(src('src/styles.css'));
/* The ratchet is measured on the RAW sheet, not on the stripped one: the
   project's command is a plain `grep -oE '#[0-9a-fA-F]{3,8}' src/styles.css`,
   and it counts the literals quoted inside comments too. A ceiling applied to a
   smaller number than the project's own command reports would be a quieter
   limit than the one the spec set. */
const now = hexCount(src('src/styles.css'));
assert(`r11 src/styles.css hex literals <= ${HEX_CEILING} (raw, the project's own command)`,
  now <= HEX_CEILING, `measured ${now}`);

/* R12 — the roadmap BLOCK specifically is literal-free. Scoped to the `.rm`
   rules rather than the whole sheet, so a later edit elsewhere cannot mask an
   introduced literal here (and this probe cannot be satisfied by the 144
   pre-existing literals). */
const rmRules = css.split('\n').filter((l) => /^\s*\.rm[-.\s]/.test(l));
const rmHex = rmRules.filter((l) => /#[0-9a-fA-F]{3,8}/.test(l));
assert('r12 the .rm* rules carry ZERO hex literals', rmRules.length > 0 && rmHex.length === 0,
  `${rmRules.length} .rm rule line(s), ${rmHex.length} with a literal`);

/* -------------------------------------------------- the block is rendered ---
   The two structural claims a source harness CAN make: the component exists and
   its heading is TEXT with an aria-hidden dot, and it is rendered between the
   rows and the note. The live card/row COUNT in a browser is the orchestrator's
   job, not this file's. */

const settings = src('src/Settings.tsx');
/* JS comments are stripped before the ORDER probe, and that is load-bearing:
   `about.indexOf('className="settings-rows"')` on the raw text found an
   occurrence inside a comment that this pane legitimately quotes — the probe
   then reported the block as before the note when the real JSX has it after.
   String literals are deliberately NOT stripped (the markers ARE string
   literals), so only comments go. */
const stripJsComments = (js) => js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

{
  const about = stripJsComments(settings.slice(settings.indexOf('function AboutPane()')));
  const iRm = about.indexOf('<RoadmapBlock />');
  /* HARVEY 2026-10-13 re-anchor: AboutPane was rewritten (rows trimmed to one
     Version row; Licence/Building-blocks rows and the settings-note removed by
     name). The block's contract is now simply: it renders inside AboutPane. */
  assert('r13 RoadmapBlock renders inside AboutPane',
    iRm >= 0,
    `block@${iRm} (within AboutPane)`);

  /* STATUS IS TEXT, NOT COLOUR (a11y SC 1.4.1). The dot is aria-hidden and the
     label is a text span beside it. */
  assert('r14 the column heading renders a TEXT label beside the dot',
    /<span className="rm-collabel">\{c\.label\}<\/span>/.test(settings));
  assert('r15 the dot is decoration only (aria-hidden)', /className=\{`rm-dot \$\{c\.status\}`\} aria-hidden="true"/.test(settings));
  assert('r16 the heading carries the item count too', /className="rm-colcount">\{items\.length\}/.test(settings));

  /* The confidence WORD and the area tag are both rendered — no colour-only
     encoding and no unlabelled chip. */
  assert('r17 the confidence chip renders the WORD', /\{it\.confidence\}/.test(settings));
  assert('r18 the area chip renders the area tag', /<span className="rm-chip">\{it\.area\}<\/span>/.test(settings));

  /* The three column headings are the spec's: Now / Next / Exploring. */
  assert('r19 the three headings are Now / Next / Exploring',
    /label: 'Now'/.test(settings) && /label: 'Next'/.test(settings) && /label: 'Exploring'/.test(settings));

  /* One reviewed line, and it is the const that supplies it. */
  assert('r20 the reviewed line renders from ROADMAP_REVIEWED',
    /last reviewed \{ROADMAP_REVIEWED\}/.test(settings));

  /* The block links nowhere: no anchor, no href anywhere in it. */
  const block = settings.slice(settings.indexOf('function RoadmapBlock()'), settings.indexOf('function AboutPane()'));
  assert('r21 the block contains no link out of the app', block.length > 0 && !/<a\s|href=/.test(block));
}

console.log(`\n  ${pass} PASS / ${fail} FAIL / ${skipped} SKIP\n`);

/* ------------------------------------------------------------- REPLAY ---- */

/* Every SOURCE probe above must be RED on the pinned pre-change tree, or it
   proves nothing. The replays below are the ones that CANNOT be green before
   PACKAGE-R: the module does not exist, the block is not rendered, and the .rm
   rules are not in the sheet. A replay that is green there is reported as a
   FAILURE of this harness, not of the code under test. */
console.log(`REPLAY — the source probes re-run against ${PRE_COMMIT}, and they must be RED\n`);

const preRm = srcAt(PRE_COMMIT, 'src/roadmap.ts');
const preCssRaw = srcAt(PRE_COMMIT, 'src/styles.css');
const preSettings = srcAt(PRE_COMMIT, 'src/Settings.tsx');

if (preCssRaw === null || preSettings === null) {
  skipProbe('replay', `cannot read ${PRE_COMMIT} from this worktree — run it with DS_ROOT set to the repo, or pin DS_PRE_COMMIT`);
} else {
  const oldCss = stripComments(preCssRaw);
  const red = (name, probe, detail = '') => {
    const v = probe();
    assert(`replay ${name} is RED on ${PRE_COMMIT}`, v === false || v === null || v === 0,
      v ? `the probe is GREEN on the old tree — it proves nothing (${detail || v})` : '');
  };

  red('r0 (the data module exists)', () => preRm !== null, 'src/roadmap.ts present at the pinned commit');
  /* THE RATCHET IS AN INVARIANT, NOT A NEW FEATURE: r11 is green on BOTH trees
     by construction — the sheet was already at 144 and the block adds no
     literal. Replaying it as "must be RED" would be a category error, so it is
     reported here as the plain fact it is. This is precisely why r12 exists:
     the ratchet alone cannot tell "no literal added" from "a literal added
     somewhere else with one removed", and the .rm-scoped probe can. */
  assert(`replay r11 is an INVARIANT (${PRE_COMMIT} was already at or under the ceiling)`,
    hexCount(preCssRaw) <= HEX_CEILING, `pre-change measured ${hexCount(preCssRaw)} literals`);
  red('r12 (the .rm rules are absent)',
    () => oldCss.split('\n').filter((l) => /^\s*\.rm[-.\s]/.test(l)).length);
  red('r13 (the block is not rendered)',
    () => preSettings.includes('<RoadmapBlock />'));
  red('r14 (no rm-collabel in the pane)',
    () => preSettings.includes('rm-collabel'));
  red('r20 (no reviewed line in the pane)',
    () => preSettings.includes('ROADMAP_REVIEWED'));

  console.log(`\n  REPLAY done — ${pass} PASS / ${fail} FAIL / ${skipped} SKIP (cumulative)\n`);
}

console.log(fail === 0 ? 'PACKAGE-R HARNESS: GREEN' : `PACKAGE-R HARNESS: RED — ${fails.join(', ')}`);
process.exit(fail === 0 ? 0 : 1);
