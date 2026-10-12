/* How WRONG is the SIMPLE gate (opposite sides only) vs the geometry-aware one?
   Sweep every side pair over an 8-direction geometry fan. */
import {getSmoothStepPath} from '@xyflow/system';
const OPP = {left: 'right', right: 'left', top: 'bottom', bottom: 'top'};
const DIRS = {left: {x: -1, y: 0}, right: {x: 1, y: 0}, top: {x: 0, y: -1}, bottom: {x: 0, y: 1}};
const OFFSET = 20;
function exact(sp, tp, sx, sy, tx, ty) {
  const sd = DIRS[sp], td = DIRS[tp];
  const sg = {x: sx + sd.x * OFFSET, y: sy + sd.y * OFFSET};
  const tg = {x: tx + td.x * OFFSET, y: ty + td.y * OFFSET};
  const dir = (sp === 'left' || sp === 'right') ? {x: sg.x < tg.x ? 1 : -1, y: 0} : {x: 0, y: sg.y < tg.y ? 1 : -1};
  const acc = dir.x !== 0 ? 'x' : 'y';
  if (sd[acc] * td[acc] !== -1) return false;
  return sd[acc] === dir[acc];
}
function actual(sp, tp, sx, sy, tx, ty) {
  const b = {sourceX: sx, sourceY: sy, targetX: tx, targetY: ty, sourcePosition: sp, targetPosition: tp, borderRadius: 12};
  return getSmoothStepPath({...b, stepPosition: 0.05})[0] !== getSmoothStepPath({...b, stepPosition: 0.95})[0];
}
const sides = ['left', 'right', 'top', 'bottom'];
const R = 500;
const fan = [];
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2;
  fan.push({x: Math.round(300 + R * Math.cos(a)), y: Math.round(300 + R * Math.sin(a))});
}
fan.push({x: 300, y: 300 + 60});   // very close
fan.push({x: 300 + 60, y: 300});
let simWrong = 0, exWrong = 0, total = 0, simOverEnables = 0;
for (const t of fan) for (const s of sides) for (const tp of sides) {
  total++;
  const S = {x: 300, y: 300};
  if (t.x === S.x && t.y === S.y) continue;
  const a = actual(s, tp, S.x, S.y, t.x, t.y);
  const sim = OPP[s] === tp;
  const ex = exact(s, tp, S.x, S.y, t.x, t.y);
  if (sim !== a) { simWrong++; if (sim) simOverEnables++; }
  if (ex !== a) exWrong++;
}
console.log(`cases ${total}`);
console.log(`simple gate (opposite sides only) mismatches: ${simWrong}  (over-enables: ${simOverEnables})`);
console.log(`geometry-aware gate mismatches            : ${exWrong}`);
