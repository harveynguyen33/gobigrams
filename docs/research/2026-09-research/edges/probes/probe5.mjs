/* prototype of the bend-gate predictor, checked against the REAL getSmoothStepPath */
import {getSmoothStepPath} from '@xyflow/react';

const DIRS = {left: {x: -1, y: 0}, right: {x: 1, y: 0}, top: {x: 0, y: -1}, bottom: {x: 0, y: 1}};
const OFFSET = 20;

function predict(sourceSide, targetSide, source, target) {
  const sd = DIRS[sourceSide], td = DIRS[targetSide];
  const sg = {x: source.x + sd.x * OFFSET, y: source.y + sd.y * OFFSET};
  const tg = {x: target.x + td.x * OFFSET, y: target.y + td.y * OFFSET};
  // getDirection(): Left/Right sources key off X, Top/Bottom off Y
  const dir = (sourceSide === 'left' || sourceSide === 'right')
    ? {x: sg.x < tg.x ? 1 : -1, y: 0}
    : {x: 0, y: sg.y < tg.y ? 1 : -1};
  const acc = dir.x !== 0 ? 'x' : 'y';
  if (sd[acc] * td[acc] !== -1) return false;    // RF's "opposite handle positions" branch
  return sd[acc] === dir[acc];                    // the split it picks consumes the centre coord
}

function actual(sourceSide, targetSide, source, target) {
  const base = {sourceX: source.x, sourceY: source.y, targetX: target.x, targetY: target.y,
                sourcePosition: sourceSide, targetPosition: targetSide, borderRadius: 12};
  const a = getSmoothStepPath({...base, stepPosition: 0.05})[0];
  const b = getSmoothStepPath({...base, stepPosition: 0.95})[0];
  return a !== b;
}

const cases = [];
for (let sx = 0; sx <= 1; sx++) for (let sy = 0; sy <= 1; sy++)
  for (let tx = 0; tx <= 1; tx++) for (let ty = 0; ty <= 1; ty++) {
    if (sx === tx && sy === ty) continue;
    cases.push({
      source: {x: sx ? 600 : 100, y: sy ? 500 : 300},
      target: {x: tx ? 600 : 100, y: ty ? 500 : 300},
    });
  }
const sides = ['left', 'right', 'top', 'bottom'];
let n = 0, bad = 0;
for (const c of cases) for (const s of sides) for (const t of sides) {
  n++;
  const p = predict(s, t, c.source, c.target);
  const a = actual(s, t, c.source, c.target);
  if (p !== a) {
    bad++;
    if (bad <= 12) console.log(`MISMATCH s=${s} t=${t} src=${JSON.stringify(c.source)} tgt=${JSON.stringify(c.target)} predict=${p} actual=${a}`);
  }
}
console.log(`cases ${n}, mismatches ${bad}`);
