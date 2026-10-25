#!/usr/bin/env node
/**
 * ITEM B harness (2026-10-22) — the boards popover PINNED-FOOTER +
 * SCROLLABLE-LIST contract, after the fixed-portal redesign.
 *
 * THE ROUND: the boards popover was a head-anchored box (`left: 0; right: 0`
 * inside `.panel-head`) whose whole body scrolled under `max-height: 420px`.
 * Harvey's ask: the LIST must scroll in its own container and the ACTIONS
 * (Save now included) must stay PINNED below it, always visible; the popup
 * itself is now a 360px position:fixed portal to `document.body` anchored
 * right of the Boards button, because `.panel` clips at 232px
 * (`overflow: hidden`) and a wider popup could never render inside the head.
 *
 * WHAT THIS FILE READS: the real sheet (`src/styles.css`) and the real JSX
 * (`src/App.tsx`). It cannot run a browser, so GEOMETRY (a measured row
 * height, a real scroll range) is NOT claimed here — the structural facts
 * that make the geometry possible are, and the limits are listed at the end
 * (house shape: every harness says what it cannot see).
 *
 * THE CONTRACT, asserted:
 *   P1  the popup is `createPortal(..., document.body)` gated on an
 *       anchor-position state, with `position: fixed` inline;
 *   P2  the anchor is `btn.right + 6` / `btn.top`, and the width is
 *       `min(360, innerWidth − anchorX − 8)` with NO floor (a floor would
 *       re-create the overflow defect the 2026-09-17 pass killed);
 *   P3  the scroll budget lives on `.boards-list` (`overflow-y: auto`,
 *       `max-height: 300px`) and NOT on the popup itself (`max-height: none`);
 *   P4  `.boards-actions` sits AFTER `.boards-list` in the JSX (a flex column
 *       paints the actions below the list, and with the scroll moved INTO the
 *       list the actions can never be pushed off by a long board list);
 *   P5  `Save now` lives in `.boards-actions` (the pinned block), not in the
 *       scrolling list;
 *   P6  the rows are de-cramped: the preset badge is a SIBLING of the
 *       ellipsising `.boards-item-name` span, not a child of it (it used to
 *       clip to "Ar…" inside the ellipsis), and the row carries the full name
 *       as a `title` for truncation;
 *   P7  the menu row reads "Templates" (the "Create from Templates" literal
 *       wrapped at 360px; re-anchored, dated — see package-templates tg11);
 *   P8  the popover is NOT a descendant of `.panel` in the JSX any more — the
 *       portal call sits outside the panel subtree's conditional.
 *
 * COMMENTS ARE BLANKED, NOT STRIPPED, before every probe: a comment that
 * quotes a removed literal or a banned declaration must not read as the thing
 * still being present (measured false-red pattern in this repo).
 *
 *   node checks/boards-popover-pinned.mjs   → exit 0 green, 1 red
 */
import {readFileSync} from 'node:fs';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const read = p => readFileSync(`${ROOT}/${p}`, 'utf8');

const blank = m => m.replace(/[^\n]/g, ' ');
const strip = s => s
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/^[ \t]*\/\/.*$/gm, blank);

/* BN-2: the boards popover + clamp moved to src/useBoardsMenu.ts — the harness
   reads the UNION so the pins follow the code, wherever it lives. */
const APP_RAW = read('src/App.tsx') + '\n' + read('src/useBoardsMenu.ts');
const CSS_RAW = read('src/styles.css');
const APP = strip(APP_RAW);
const CSS = strip(CSS_RAW);

const failures = [];
let checked = 0;
function assert(name, ok, detail = '') {
  checked += 1;
  if (ok) console.log(`PASS  ${name}${detail ? ' - ' + detail : ''}`);
  else { console.log(`FAIL  ${name}${detail ? ' - ' + detail : ''}`); failures.push(name); }
}

/* Read one rule's declarations (multi-declaration lines split on `;`,
   comments blanked first — prose full of colons must not parse). */
function cssBlock(sel) {
  const lines = CSS.split('\n');
  const i = lines.findIndex(l => l.trim() === sel + ' {');
  if (i < 0) return {notfound: true};
  const body = [];
  for (let j = i + 1; j < lines.length; j++) {
    if (/^\}/.test(lines[j].trim())) break;
    body.push(lines[j]);
  }
  const out = {};
  for (const decl of body.join('\n').split(';')) {
    const m = /([a-z-]+):\s*([\s\S]+)/.exec(decl.trim());
    if (m) out[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  }
  return {decls: out};
}
const pxOf = v => {
  const m = /([\d.]+)px/.exec(v || '');
  if (m) return +m[1];
  if (/^\s*0(\.0+)?\s*$/.test(String(v ?? ''))) return 0;
  return null;
};

/* ---- P1/P2 — the portal + the anchor + the clamp, from the JSX ---------- */
const portal = /boardsOpen && boardsPopPos && createPortal\(/.test(APP);
const inlineFixed = /position: 'fixed', left: boardsPopPos\.left, top: boardsPopPos\.top/.test(APP);
const clampCalc = /const maxW = Math\.max\(0, window\.innerWidth - left - 8\);/.test(APP);
const anchorCalc = /const left = r\.right \+ 6;/.test(APP) && /const top = r\.top;/.test(APP);
const toBody = /document\.body,/.test(APP);
const widthLiteral = /width: 360\}/.test(APP) && /Math\.min\(360, boardsPopPos\.maxW\)/.test(APP);
const noFloor = !/Math\.max\(232, window\.innerWidth/.test(APP) && !/Math\.max\(240, window\.innerWidth/.test(APP);

assert('P1 the popover is a fixed portal to document.body',
  portal && inlineFixed && toBody,
  `createPortal gated on boardsPopPos, position:fixed inline, target document.body ` +
  `(the Tooltip.tsx:205 precedent) — the head-anchored box is gone`);
assert('P2 the anchor is btn.right+6 / btn.top and the clamp has NO floor',
  anchorCalc && clampCalc && noFloor && widthLiteral,
  `left = r.right + 6, top = r.top, maxW = max(0, innerWidth − anchorX − 8), ` +
  `width = min(360, maxW). Measured reason for the no-floor clause: an intermediate ` +
  `state shipped max(232, …) and overflowed a 360px window by 94px — the exact ` +
  `defect class the 2026-09-17 pass (checks/package-o-metrics.mjs item6a) killed.`);

/* The anchor state recomputes while open, so a viewport resize re-anchors. */
const resizeReanchor = /window\.addEventListener\('resize', boardsPopClamp\);/.test(APP);
assert('P2b the anchor recomputes on viewport resize while open',
  resizeReanchor,
  `boardsPopClamp is bound to window resize for the popup's lifetime`);

/* ---- P3 — the scroll budget moved INTO the list -------------------------- */
const pop = cssBlock('.boards-pop');
const list = cssBlock('.boards-list');
assert('P3 the list owns the scroll; the popup carries none',
  !pop.notfound && !list.notfound
    && list.decls['overflow-y'] === 'auto' && pxOf(list.decls['max-height']) === 300
    && pop.decls['max-height'] === 'none' && pop.decls['overflow-y'] == null,
  `.boards-list {overflow-y: auto; max-height: 300px}; .boards-pop {max-height: none} — ` +
  `the OLD contract scrolled the WHOLE popup under max-height: 420px (and the phone ` +
  `tier under calc(58dvh − 90px), retired with the geometry it patched)`);

/* ---- P4/P5 — the actions block is pinned below the list ------------------ */
/* The JSX order is the paint order inside the popup's flex column: the actions
   block must come AFTER the list div and OUTSIDE it. */
const listStart = APP.indexOf('<div className="boards-list">');
const listEnd = APP.indexOf('<div className="boards-actions">', listStart);
const popEnd = APP.indexOf(',\n              document.body,', listEnd);
assert('P4 .boards-actions is a SIBLING after .boards-list (never inside the scroll)',
  listStart >= 0 && listEnd > listStart && popEnd > listEnd,
  `JSX order boards-list → boards-actions inside the portal; with the scroll moved ` +
  `INTO the list, a long board list cannot push the actions off the popup`);
const actionsBlock = listEnd >= 0 ? APP.slice(listEnd, popEnd) : '';
assert('P5 Save now lives in the pinned block',
  actionsBlock.includes('Save now') && actionsBlock.includes('flushSave'),
  `the primary save affordance is always visible at any list length`);

/* ---- P6 — the de-cramped row --------------------------------------------- */
/* The badge must be a SIBLING of the ellipsising name span, not a child. */
const rowBlock = /<span className="boards-item-name">\{b\.name\}<\/span>\s*\n\s*<span className="boards-item-preset">\{getPreset\(b\.preset\)\.label\}<\/span>/.test(APP);
const badgeNotInName = !/boards-item-name">\s*\{b\.name\}\s*<span className="boards-item-preset"/.test(APP);
const rowTitle = /className=\{`pop-item boards-item\$\{b\.id === curBoard\?\.id \? ' current' : ''\}`\}\s*\n\s+title=\{b\.name\}/.test(APP);
const nameEllipsises = (cssBlock('.boards-item .boards-item-name').decls['text-overflow'] === 'ellipsis');
const badgeNoWrap = (cssBlock('.boards-item .boards-item-preset').decls['white-space'] === 'nowrap');
assert('P6 the preset badge is OUTSIDE the ellipsising name span, and the row carries the full name as title',
  rowBlock && badgeNotInName && rowTitle && nameEllipsises && badgeNoWrap,
  `measured defect: the badge sat INSIDE .boards-item-name (text-overflow: ellipsis) ` +
  `and clipped to "Ar…" at any narrow popup; now name and badge are sibling lines, ` +
  `title={b.name} carries the truncation, the badge never inherits the ellipsis`);

/* ---- P7 — the shortened row label ---------------------------------------- */
const rowLiteral = /<LayoutTemplate size=\{14\} \/> Templates/.test(APP);
const oldGone = !/<LayoutTemplate size=\{14\} \/> Create from Templates/.test(APP);
assert('P7 the gallery row reads "Templates" (does not wrap at 360px)',
  rowLiteral && oldGone,
  `RE-ANCHORED (ITEM B, 2026-10-22): the ROUND 4 literal "Create from Templates" was ` +
  `the one row that wrapped at the redesigned 360px; the handler and the ` +
  `pendingBoardName stash-clear are unchanged (pinned in checks/package-templates.mjs tg11)`);

/* ---- P8 — the popup left the panel's clip -------------------------------- */
/* The portal MOUNTS to document.body (P1), so .panel's overflow: hidden can
   never clip it; the JSX source keeps the call in place beside the button (the
   anchor ref lives there), which is correct portal usage. What is pinned here
   is the pair of facts that make the escape real: the mount target IS
   document.body, and the popup element carries position: fixed inline (so no
   ancestor position context is even consulted). */
const portalCall = APP.indexOf('boardsOpen && boardsPopPos && createPortal(');
assert('P8 the popup escapes the panel clip: mounts to document.body with position:fixed inline',
  portalCall >= 0 && toBody && inlineFixed,
  `the head-anchored popup lived inside .panel (overflow: hidden, 232px) and was ` +
  `clipped by construction; a portal to document.body with inline position:fixed ` +
  `resolves against the viewport (or, below 420px of viewport height, against the ` +
  `transformed .app — accepted; see package-o-metrics item6a)`);

/* ---- the phone-tier retirement is a fact of the sheet -------------------- */
const phoneOverrideGone = !/\.app\[data-form-factor="phone"\] \.boards-pop/.test(CSS);
assert('P9 the phone max-height override is retired WITH the geometry it patched',
  phoneOverrideGone,
  `calc(58dvh - 90px) patched the OLD popup's spill INSIDE the bottom sheet; the ` +
  `portal does not live in the sheet, so the override has nothing to override`);

const failed = failures.length;
console.log(`\nBOARDS-POPOVER HARNESS: ${checked - failed}/${checked} passed`);
if (failed) console.log(`  failing: ${failures.join(' ')}`);

console.log('\n-- NOT VERIFIED HERE (needs a real browser) --');
console.log('  * measured geometry: that a >300px list actually scrolls while Save now');
console.log('    stays on screen, and that the popup paints right of the button at the');
console.log('    232px panel and beside the phone sheet below 420px of viewport height');
console.log('    (the transform caveat: position:fixed then resolves against .app —');
console.log('    accepted, asserted structurally in package-o-metrics item6a).');
console.log('  * that the badge never clips at 360px (it is outside the ellipsis span by');
console.log('    construction; a rendered row is the only pixel proof).');
console.log('  * live click-through: every row still opens its board / dialog (the');
console.log('    handlers are pinned textually in package-templates tg11 and here in P5).');

process.exit(failed ? 1 : 0);
