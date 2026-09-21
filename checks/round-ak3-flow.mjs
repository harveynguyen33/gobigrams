#!/usr/bin/env node
/**
 * ROUND AK, PASS 3 — the flow animation, after AK-16 / AK-17 / AK-18.
 *
 * WHAT THIS FILE IS. A source-text harness with its own negative control, in the
 * same house style as `checks/round-ak-edge-panel.mjs` (read that file's header
 * for why comments are blanked before every count — this project deletes a
 * control and leaves a comment QUOTING it in its place, so a raw substring probe
 * would read a correct tree as a defect).
 *
 * WHY IT EXISTS. Pass 1 and Pass 2 already have harnesses; Pass 3's changes had
 * NONE, which means the de-duplication could be undone by a later round with
 * nothing going red. It asserts the THREE claims Pass 3 makes, and each one is
 * demonstrated RED against the pinned pre-change commit.
 *
 * WHAT IT CANNOT DO: it cannot prove the animation PLAYS. That is the owner's
 * device test. This file asserts the source and the option tables.
 *
 * DS_ROOT overrides the project root; DS_PRE_COMMIT overrides the pinned commit.
 */
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const ROOT = process.env.DS_ROOT || '/home/harvey/projects/tech-goblin/lab/diagram-studio';

/* The tree ROUND AK PASS 3 was built on. PINNED, not `HEAD`: once this round is
   committed, `HEAD` IS the fixed tree and a `HEAD`-based control would compare
   the fix with itself. This is the commit that already carried Pass 1 and Pass 2
   (so the control isolates PASS 3's change, not the whole round's). */
const PRE_COMMIT = process.env.DS_PRE_COMMIT || '50a8eff';

/** Blank block AND line comments to spaces, keeping length and newlines so a
 *  reported line number is the line the code is really on. */
const blankComments = s => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));

const readAt = (rel, commit) => commit
  ? execFileSync('git', ['show', `${commit}:${rel}`], {cwd: ROOT, encoding: 'utf8'})
  : readFileSync(`${ROOT}/${rel}`, 'utf8');

const bundleOf = commit => {
  const raw = {
    App: readAt('src/App.tsx', commit),
    GoblinEdge: readAt('src/GoblinEdge.tsx', commit),
    styles: readAt('src/styles.css', commit),
    choreography: readAt('src/choreography.ts', commit),
  };
  return {
    App: {raw: raw.App, code: blankComments(raw.App)},
    GoblinEdge: {raw: raw.GoblinEdge, code: blankComments(raw.GoblinEdge)},
    styles: {raw: raw.styles, code: blankComments(raw.styles)},
    choreography: {raw: raw.choreography, code: blankComments(raw.choreography)},
  };
};

/* ---------------- the probes ---------------- */
const P = {};

/* AK-17 (1) — THE OPTION LIST HAS NO DUPLICATE MEANING.
   The panel's `flow` button list must offer each meaning exactly once. Before
   Pass 3 it offered SIX: none / dots / dash / pulse / icon / event, and `event`
   (a 16×12 envelope) and `icon`+`mail` (a 24×20 chip carrying an envelope glyph)
   drew the same picture under two names. */
const FLOW_OPTIONS = ['none', 'dots', 'dash', 'pulse', 'icon'];
P.flowOptionListIsUnique = src => {
  /* The flow body's list is the `([...] as const).map` tuple of [value, label]
     pairs. Several such tuples exist earlier in the file, and probing "the
     first one containing 'None'" still picked the wrong table, so this reads
     the tuple that carries the flow labels AND requires it to be a six-then-
     five-shaped list of `['value', 'Label']` pairs. */
  const re = /\(\[([\s\S]*?)\]\s*as const\)\.map/g;
  let m, block = null;
  while ((m = re.exec(src.App.code))) {
    /* the flow list is the ONLY one whose labels are capitalised AND whose
       values are exactly this vocabulary (dots/dash/pulse are unique to it) */
    if (/'dots'/.test(m[1]) && /'pulse'/.test(m[1])) { block = m[1]; break; }
  }
  if (!block) return false;
  const vals = [...block.matchAll(/\['([a-z]+)'\s*,/g)].map(x => x[1]);
  /* exactly the five surviving values, no duplicate, in order */
  return vals.length === FLOW_OPTIONS.length
    && vals.every((v, i) => v === FLOW_OPTIONS[i])
    && new Set(vals).size === vals.length;
};
/** the literal string `Envelope` must not be offered as an option label */
P.envelopeOptionGone = src => !/'Envelope'/.test(src.App.code);

/* AK-16 (2) — `event` IS FOLDED, AND THE FOLD IS ON READ.
   A stored `flow:'event'` must still animate, and the board must NOT be
   rewritten: the mapping lives in `migrateEdge`, which runs on the way IN. */
P.foldOnRead = src => /\.flow === 'event'/.test(src.App.code)
  && /flow:\s*'icon'/.test(src.App.code)
  && /flowIcon:\s*'mail'/.test(src.App.code);
/** the renderer can no longer receive `event`: the branch and its envelope are
 *  gone, so nothing draws it twice. */
P.eventBranchAndEnvelopeDeleted = src => !/flow === 'event'/.test(src.GoblinEdge.code)
  && !/edge-flow-event/.test(src.GoblinEdge.code)
  && !/const envelope =/.test(src.GoblinEdge.code);
/** the type union no longer admits it either — the value cannot be re-created */
P.eventNotInTypeUnion = src => !/'none' \| 'dots' \| 'dash' \| 'pulse' \| 'icon' \| 'event'/.test(src.GoblinEdge.code);

/* AK-18 (3) — THE HONEST LIMIT IS RECORDED IN THE CODE, NOT ONLY IN A REPORT.
   The research established that NO surveyed tool ships a connector-wide
   marching-ants animation, so only the REMOVAL is evidence-backed. The comment
   must say so and must name the tools, and must NOT cite a false precedent. */
P.honestLimitRecorded = src =>
  /no mature tool/i.test(src.App.raw) && /miro/i.test(src.App.raw) && /lucidchart/i.test(src.App.raw)
  && /(could not|could NOT|cannot) justify/i.test(src.App.raw);

/* the reduce-motion gate must stay a SEPARATE axis (AK-18's last requirement).
   It lives in `src/choreography.ts` (`ANIMATE_KEY = 'diagram-studio:animate'`),
   NOT in App.tsx — the first draft of this probe looked in the wrong file and
   failed a correct tree. */
P.reduceMotionStillSeparate = src => /diagram-studio:animate/.test(src.choreography.raw);

/* ---------------- the run ---------------- */
let fails = 0;
const assert = (name, ok, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        ${detail}` : ''}`);
};

const SHIP = bundleOf(null);
const PRE = bundleOf(PRE_COMMIT);

console.log('\n==============================================================================');
console.log('ROUND AK PASS 3 — the flow animation, de-duplicated');
console.log('==============================================================================\n');

console.log('AK-17 — ONE AXIS, NO DUPLICATE MEANING');
assert('ak17.the-flow-option-list-offers-each-meaning-exactly-once', P.flowOptionListIsUnique(SHIP),
  `the panel offers [${FLOW_OPTIONS.join(', ')}] — five names, five meanings. ` +
  'OLD: six, where `Envelope` and `Icon`+mail drew the same envelope.');
assert('ak17.the-Envelope-option-is-gone', P.envelopeOptionGone(SHIP),
  'no `Envelope` label is offered any more — the option that duplicated `Icon` cannot be picked.');

console.log('\nAK-16 — `event` FOLDED ON READ, RENDERER CANNOT DRAW IT TWICE');
assert('ak16.a-stored-event-is-folded-onto-icon+mail-when-the-board-is-read', P.foldOnRead(SHIP),
  "`migrateEdge` maps `data.flow === 'event'` to `flow:'icon'` with `flowIcon:'mail'` — so an edge that " +
  'already stored the removed option still animates, and the board is never rewritten.');
assert('ak16.the-event-branch-and-its-own-envelope-are-deleted', P.eventBranchAndEnvelopeDeleted(SHIP),
  'the renderer has no `event` branch and no second envelope: the surviving `icon` chip carries the ' +
  '`FLOW_ICON_PATHS.mail` glyph, which IS an envelope. Dead code left "just in case" is how a removed option returns.');
assert('ak16.the-type-union-no-longer-admits-event', P.eventNotInTypeUnion(SHIP),
  'the value cannot be re-created from inside the app.');

console.log('\nAK-18 — THE LIMIT IS IN THE CODE, AND THE REDUCE-MOTION AXIS IS UNTOUCHED');
assert('ak18.the-honest-limit-is-recorded-in-the-source', P.honestLimitRecorded(SHIP),
  'the comment names the surveyed tools and states that the research could NOT justify what to keep — ' +
  'only the removal is evidence-backed. A future reader cannot mistake the five names for a precedent.');
assert('ak18.reduce-motion-remains-a-separate-axis', P.reduceMotionStillSeparate(SHIP),
  'the `diagram-studio:animate` gate still exists, so the edge animation can be switched off without ' +
  'touching the document — the two axes were deliberately not merged.');

/* ---------------- the negative control ---------------- */
console.log('\n==============================================================================');
console.log(`REPLAY (negative control) — the same probes over the PRE-CHANGE tree ${PRE_COMMIT.slice(0, 7)}`);
console.log('each must be RED, or the probe measures nothing');
console.log('==============================================================================\n');

const REPLAY = [
  ['ak17.a-flow-option-list-with-a-duplicate-meaning', src => !P.flowOptionListIsUnique(src)],
  ['ak17.b-Envelope-still-offered', src => !P.envelopeOptionGone(src)],
  ['ak16.a-event-not-folded-on-read', src => !P.foldOnRead(src)],
  ['ak16.b-event-branch-and-envelope-still-present', src => !P.eventBranchAndEnvelopeDeleted(src)],
  ['ak16.c-event-still-in-the-type-union', src => !P.eventNotInTypeUnion(src)],
  ['ak18.the-honest-limit-not-yet-recorded', src => !P.honestLimitRecorded(src)],
];
let reds = 0;
for (const [name, probe] of REPLAY) {
  const red = probe(PRE);
  if (red) reds++;
  console.log(`  ${red ? 'RED    ' : 'NOT-RED'}  ${name}`);
}
assert('replay.every-pass-3-probe-is-RED-on-the-pre-change-tree', reds === REPLAY.length,
  `${reds}/${REPLAY.length} probes are RED at ${PRE_COMMIT} and GREEN on the working tree — each assertion ` +
  'really detects the change it claims to. The one exception is the reduce-motion probe, which is TRUE on ' +
  'both trees BY DESIGN: AK-18 required that axis be LEFT ALONE, so it is asserted as an invariant, not as a change.');

console.log('\n==============================================================================');
console.log(fails ? `ROUND AK PASS 3 HARNESS: ${fails} FAILURE(S)` : 'ROUND AK PASS 3 HARNESS: all checks passed');
console.log('==============================================================================\n');
process.exit(fails ? 1 : 0);
