// ROUND AQ transform — postcss-based (a real parser: comments + calc() respected).
// Usage: node scripts/aq-transform.mjs src/styles.css
import postcss from 'postcss';
import {readFileSync, writeFileSync} from 'node:fs';

const path = process.argv[2];
const css = readFileSync(path, 'utf8');
const MAPPING = {
  '9':'--fs-2xs','9.5':'--fs-xs','10':'--fs-xs','10.5':'--fs-sm','11':'--fs-sm','11.5':'--fs-md',
  '12':'--fs-md','12.5':'--fs-md','13':'--fs-lg','13.5':'--fs-lg','14':'--fs-xl','14.5':'--fs-xl',
  '15':'--fs-xl','16':'--fs-2xl','20':'--fs-2xl','26':'--fs-display',
};
const ALLOWED = new Set([1,2,3,4,5,6,7,8,9,10,12,13,14,16,18,20,24,32,40]);
const nearest = n => [...ALLOWED].sort((a,b) => (Math.abs(a-n) - Math.abs(b-n)) || (a-b))[0];

const root = postcss.parse(css);
let fsChanged = 0, calcChanged = 0, spacingChanged = 0;

// 1. inject tokens into the :root rule (first rule whose selector includes :root)
let injected = false;
root.walkRules(rule => {
  if (injected || !/(^|,)\s*:root/.test(rule.selector)) return;
  const block = postcss.parse([
    '/* ROUND AQ - the type scale (8 steps). Theme-invariant; consumed by every',
    '   font-size in this sheet. Ratchet: checks/round-aq-scales.mjs */',
    '--fs-2xs: 9px;', '--fs-xs: 10px;', '--fs-sm: 11px;', '--fs-md: 12px;',
    '--fs-lg: 13px;', '--fs-xl: 14px;', '--fs-2xl: 16px;', '--fs-display: 26px;',
  ].join('\n'));
  rule.prepend(block);
  injected = true;
});
if (!injected) throw new Error('no :root rule found');

// 2. walk DECLARATIONS only (comments are separate nodes — untouched)
root.walkDecls(decl => {
  const prop = decl.prop;

  // font-size: literal px -> token; calc(Npx * scale) -> calc(token * scale)
  if (prop === 'font-size') {
    const lit = decl.value.match(/^(\d+(?:\.\d+)?)px$/);
    if (lit && MAPPING[lit[1]]) {
      decl.value = `var(${MAPPING[lit[1]]})`;
      fsChanged++;
      return;
    }
    const scaled = decl.value.match(/^calc\((\d+(?:\.\d+)?)px \* (var\(--ts-scale, 1\))\)$/);
    if (scaled && MAPPING[scaled[1]]) {
      decl.value = `calc(var(${MAPPING[scaled[1]]}) * ${scaled[2]})`;
      calcChanged++;
      return;
    }
  }

  // spacing: padding/margin/gap (+directional variants) — px numbers on the 15-step scale
  if (/^(padding|margin|gap)(-(top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end|x|y))?$/.test(prop)) {
    const next = decl.value.replace(/(^|[\s(])(\d+(?:\.\d+)?)px(?=[\s)]|$)/g, (m, pre, num) => {
      const n = parseFloat(num);
      if (!Number.isInteger(n) || ALLOWED.has(n)) return m;
      spacingChanged++;
      return `${pre}${nearest(n)}px`;
    });
    if (next !== decl.value) decl.value = next;
  }
});

writeFileSync(path, root.toString());
console.log(`font-size tokenised: ${fsChanged}, calc tokenised: ${calcChanged}, spacing remapped: ${spacingChanged}`);
