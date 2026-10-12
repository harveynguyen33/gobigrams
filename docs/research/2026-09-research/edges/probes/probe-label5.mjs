/* TRAP #4, decision probe — compare the two candidate remedies against the raw
   rebasing. Metrics: (1) neutral at bend 0.5? (2) drift never worse? (3) do
   start and end stay visually distinct at the default bend? */
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
  if (mode === 'short') { x = labelX; y = labelY; }
  if (mode === 'axis') {
    if (g.sp === Position.Left || g.sp === Position.Right) x = Math.min(Math.max(x, lo(g.sx, g.tx, labelX)), hi(g.sx, g.tx, labelX));
    else y = Math.min(Math.max(y, lo(g.sy, g.ty, labelY)), hi(g.sy, g.ty, labelY));
  }
  return {p: {x, y}, d};
};
const modes = ['raw', 'short', 'axis'];

console.log('(1) NEUTRAL at the live bend 0.5 (must hold for the shipped default `center`)');
for (const m of ['short', 'axis']) {
  const moved = [];
  for (const g of G) for (const [on, f] of Object.entries(F)) {
    const a = calc(g, f, 0.5, 'raw').p, b = calc(g, f, 0.5, m).p;
    if (Math.abs(a.x - b.x) > 1e-9 || Math.abs(a.y - b.y) > 1e-9) moved.push(`${g.n}/${on}`);
  }
  const movedCenter = moved.filter(s => s.endsWith('/center'));
  console.log(`  ${m.padEnd(6)}: ${moved.length} of ${G.length * 3} moved; of those, ${movedCenter.length} are the DEFAULT (center).` +
    (moved.length ? `\n           moved: ${moved.join(', ')}` : ''));
}

console.log('\n(2) DRIFT never worse than raw? (worst px label-centre -> wire, bend 0..1)');
for (const m of ['short', 'axis']) {
  const worse = [];
  let wr = 0, wm = 0;
  for (const g of G) for (const [on, f] of Object.entries(F)) {
    let r = 0, mm = 0;
    for (let bend = 0; bend <= 1.0001; bend += 0.02) {
      r = Math.max(r, distToWire(calc(g, f, bend, 'raw').p, calc(g, f, bend, 'raw').d));
      mm = Math.max(mm, distToWire(calc(g, f, bend, m).p, calc(g, f, bend, m).d));
    }
    wr = Math.max(wr, r); wm = Math.max(wm, mm);
    if (mm > r + 1e-6) worse.push(`${g.n}/${on} ${r.toFixed(0)}->${mm.toFixed(0)}`);
  }
  console.log(`  ${m.padEnd(6)}: worst raw ${wr.toFixed(0)}px -> ${wm.toFixed(0)}px; worse cases: ${worse.length ? worse.join(', ') : 'NONE'}`);
}

console.log('\n(3) does start stay distinct from end at the DEFAULT bend (0.5)?');
for (const m of modes) {
  const pairs = G.map(g => {
    const s = calc(g, 0.25, 0.5, m).p, e = calc(g, 0.75, 0.5, m).p;
    return Math.hypot(s.x - e.x, s.y - e.y);
  });
  console.log(`  ${m.padEnd(6)}: min ${Math.min(...pairs).toFixed(1)}px, max ${Math.max(...pairs).toFixed(1)}px, coincident cases: ${pairs.filter(v => v < 1).length}`);
}
