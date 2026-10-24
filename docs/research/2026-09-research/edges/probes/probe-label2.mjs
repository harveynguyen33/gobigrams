/* TRAP #4 probe v2 — is a box clamp into {source, target, bend}
   (a) NEUTRAL at the current live bend (0.5), and (b) better at extreme bends? */
import {getSmoothStepPath, Position} from '@xyflow/system';

const ptPairs = (d) => {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const out = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push({x: nums[i], y: nums[i + 1]});
  return out;
};
const distToSeg = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};
const distToWire = (p, d) => {
  const pts = ptPairs(d);
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) best = Math.min(best, distToSeg(p, pts[i], pts[i + 1]));
  return best;
};
const clamp = (v, a, b) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));

const labelPts = (g, f, bend) => {
  const [d, labelX, labelY] = getSmoothStepPath({sourceX: g.sx, sourceY: g.sy, targetX: g.tx, targetY: g.ty,
    sourcePosition: g.sp, targetPosition: g.tp, borderRadius: g.round, stepPosition: bend});
  const raw = {x: g.sx + (g.tx - g.sx) * f + (labelX - (g.sx + g.tx) / 2),
               y: g.sy + (g.ty - g.sy) * f + (labelY - (g.sy + g.ty) / 2)};
  const clamped = {x: clamp(raw.x, Math.min(g.sx, g.tx, labelX), Math.max(g.sx, g.tx, labelX)),
                   y: clamp(raw.y, Math.min(g.sy, g.ty, labelY), Math.max(g.sy, g.ty, labelY))};
  return {d, raw, clamped};
};

/* geometries: real demo-board boxes, aligned pairs, an L-shaped pair, a BACKWARDS
   pair, same-side handles, mixed sides, and a vertical pair. */
const G = [];
const push = (name, sx, sy, tx, ty, sp, tp, round) => G.push({name, sx, sy, tx, ty, sp, tp, round});
push('demo e1 real boxes', 165, 382, 324, 402.5, Position.Right, Position.Left, 12);
push('demo e2 real boxes', 324 + 368, 402.5, 726, 299 + 57, Position.Right, Position.Left, 12);
push('y-equal 500', 100, 300, 600, 300, Position.Right, Position.Left, 12);
push('y-equal 900', 100, 300, 1000, 300, Position.Right, Position.Left, 12);
push('L-shaped 500x220', 100, 100, 600, 320, Position.Right, Position.Left, 12);
push('L-shaped 500x220 tb', 300, 100, 520, 600, Position.Bottom, Position.Top, 0);
push('BACKWARDS R->L', 600, 300, 100, 320, Position.Right, Position.Left, 12);
push('same-side R->R', 300, 300, 700, 340, Position.Right, Position.Right, 12);
push('mixed R->T', 100, 300, 600, 200, Position.Right, Position.Top, 12);
push('narrow 120', 100, 300, 220, 305, Position.Right, Position.Left, 12);
push('vertical B->T 500', 300, 100, 300, 600, Position.Bottom, Position.Top, 0);

const OFFSETS = {center: 0.5, start: 0.25, end: 0.75};

console.log('NEUTRALITY at the live bend (stepPosition 0.5) — clamped must EQUAL raw');
let neutral = true;
for (const g of G) for (const f of Object.values(OFFSETS)) {
  const {raw, clamped} = labelPts(g, f, 0.5);
  if (Math.abs(raw.x - clamped.x) > 1e-9 || Math.abs(raw.y - clamped.y) > 1e-9) {
    neutral = false;
    console.log(`  MOVED  ${g.name} f=${f}: raw (${raw.x.toFixed(2)},${raw.y.toFixed(2)}) -> (${clamped.x.toFixed(2)},${clamped.y.toFixed(2)})`);
  }
}
console.log(`  -> ${neutral ? 'NEUTRAL on all ' + G.length * 3 + ' (geometry x offset) combinations' : 'NOT neutral'}`);

console.log('\nBEND SWEEP 0..1 — worst distance from the label to the wire (px)');
console.log('geometry                 offset |   raw | clamped');
let rawWorst = 0, clWorst = 0;
for (const g of G) for (const [on, f] of Object.entries(OFFSETS)) {
  let a = 0, b = 0;
  for (let bend = 0; bend <= 1.0001; bend += 0.05) {
    const {d, raw, clamped} = labelPts(g, f, bend);
    a = Math.max(a, distToWire(raw, d)); b = Math.max(b, distToWire(clamped, d));
  }
  rawWorst = Math.max(rawWorst, a); clWorst = Math.max(clWorst, b);
  const flag = b > a + 1e-9 ? '  <<< WORSE' : '';
  console.log(`${g.name.padEnd(24)} ${on.padEnd(6)} | ${a.toFixed(1).padStart(5)} | ${b.toFixed(1).padStart(6)}${flag}`);
}
console.log(`\nworst over all: raw ${rawWorst.toFixed(1)}px, clamped ${clWorst.toFixed(1)}px`);
