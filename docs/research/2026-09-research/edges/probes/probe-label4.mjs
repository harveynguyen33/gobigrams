/* TRAP #4, candidate C: SINGLE-AXIS clamp along the bend axis.
   Neutral at the live bend (0.5) for every geometry, and bounded at extremes? */
import {getSmoothStepPath, Position} from '@xyflow/system';
const ptPairs = (d) => {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const out = []; for (let i = 0; i + 1 < nums.length; i += 2) out.push({x: nums[i], y: nums[i + 1]}); return out;
};
const distToSeg = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};
const distToWire = (p, d) => {
  const pts = ptPairs(d); let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) best = Math.min(best, distToSeg(p, pts[i], pts[i + 1]));
  return best;
};
const lo = (a, b, c) => Math.min(a, b, c), hi = (a, b, c) => Math.max(a, b, c);

const G = [];
const push = (n, sx, sy, tx, ty, sp, tp, round) => G.push({n, sx, sy, tx, ty, sp, tp, round});
push('demo e1', 165, 382, 324, 402.5, Position.Right, Position.Left, 12);
push('demo e2', 692, 402.5, 726, 356, Position.Right, Position.Left, 12);
push('y-equal 500', 100, 300, 600, 300, Position.Right, Position.Left, 12);
push('y-equal 900', 100, 300, 1000, 300, Position.Right, Position.Left, 12);
push('L 500x220 R->L', 100, 100, 600, 320, Position.Right, Position.Left, 12);
push('L 500x220 B->T', 300, 100, 520, 600, Position.Bottom, Position.Top, 0);
push('BACKWARDS R->L', 600, 300, 100, 320, Position.Right, Position.Left, 12);
push('BACKWARDS T->B', 300, 600, 300, 100, Position.Top, Position.Bottom, 0);
push('same-side R->R', 300, 300, 700, 340, Position.Right, Position.Right, 12);
push('mixed R->T', 100, 300, 600, 200, Position.Right, Position.Top, 12);
push('mixed T->R', 300, 100, 600, 400, Position.Top, Position.Right, 12);
push('narrow 120', 100, 300, 220, 305, Position.Right, Position.Left, 12);
push('vertical B->T 500', 300, 100, 300, 600, Position.Bottom, Position.Top, 0);
push('offset diag R->L', 100, 100, 700, 500, Position.Right, Position.Left, 12);
const F = {center: 0.5, start: 0.25, end: 0.75};

const calc = (g, f, bend, mode) => {
  const [d, labelX, labelY] = getSmoothStepPath({sourceX: g.sx, sourceY: g.sy, targetX: g.tx, targetY: g.ty,
    sourcePosition: g.sp, targetPosition: g.tp, borderRadius: g.round, stepPosition: bend});
  let x = g.sx + (g.tx - g.sx) * f + (labelX - (g.sx + g.tx) / 2);
  let y = g.sy + (g.ty - g.sy) * f + (labelY - (g.sy + g.ty) / 2);
  if (mode === 'axis') {
    // bend axis: X when the source side is Left/Right (mirrors getDirection's dirAccessor rule)
    if (g.sp === Position.Left || g.sp === Position.Right) x = Math.min(Math.max(x, lo(g.sx, g.tx, labelX)), hi(g.sx, g.tx, labelX));
    else y = Math.min(Math.max(y, lo(g.sy, g.ty, labelY)), hi(g.sy, g.ty, labelY));
  }
  return {p: {x, y}, d, labelX, labelY};
};

console.log('NEUTRALITY at the live bend 0.5 (all geometries x 3 offsets)');
let bad = 0;
for (const g of G) for (const [on, f] of Object.entries(F)) {
  const a = calc(g, f, 0.5, 'raw'), b = calc(g, f, 0.5, 'axis');
  if (Math.abs(a.p.x - b.p.x) > 1e-9 || Math.abs(a.p.y - b.p.y) > 1e-9) {
    bad++;
    console.log(`  MOVED ${g.n} ${on}: (${a.p.x},${a.p.y}) -> (${b.p.x},${b.p.y})`);
  }
}
console.log(`  -> ${bad === 0 ? 'NEUTRAL on all ' + G.length * 3 + ' combinations' : bad + ' moved'}`);

console.log('\nDRIFT (px label-centre to wire), worst over bend 0..1');
console.log('geometry            offset |    raw |  axis-clamp');
let wr = 0, wa = 0;
for (const g of G) for (const [on, f] of Object.entries(F)) {
  let r = 0, a2 = 0;
  for (let bend = 0; bend <= 1.0001; bend += 0.02) {
    const a = calc(g, f, bend, 'raw'), b = calc(g, f, bend, 'axis');
    r = Math.max(r, distToWire(a.p, a.d)); a2 = Math.max(a2, distToWire(b.p, b.d));
  }
  wr = Math.max(wr, r); wa = Math.max(wa, a2);
  if (a2 > r + 1e-9) console.log(`  <<< WORSE ${g.n} ${on}: raw ${r.toFixed(1)} -> ${a2.toFixed(1)}`);
  console.log(`${g.n.padEnd(19)} ${on.padEnd(6)} | ${r.toFixed(1).padStart(6)} | ${a2.toFixed(1).padStart(10)}`);
}
console.log(`\nworst overall: raw ${wr.toFixed(1)}px  axis-clamp ${wa.toFixed(1)}px`);
console.log('\nstart vs end remain DISTINCT (dx between them at bend 0.5):');
for (const g of G) {
  const s = calc(g, 0.25, 0.5, 'axis').p, e = calc(g, 0.75, 0.5, 'axis').p;
  console.log(`  ${g.n.padEnd(19)} ${Math.hypot(s.x - e.x, s.y - e.y).toFixed(1)}px apart`);
}
