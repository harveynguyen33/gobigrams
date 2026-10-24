/* TRAP #4 probe — does the label still sit on the wire when the bend moves far?
   Compares the CURRENT rebasing formula against short-circuiting it, by measuring
   the distance from the computed label point to the REAL path polyline. */
import {getSmoothStepPath, Position} from '@xyflow/system';

const ptPairs = (d) => {
  const nums = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const out = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push({x: nums[i], y: nums[i + 1]});
  return out;
};
const distToSeg = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2));
  const q = {x: a.x + t * dx, y: a.y + t * dy};
  return Math.hypot(p.x - q.x, p.y - q.y);
};
const distToWire = (p, d) => {
  const pts = ptPairs(d);
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) best = Math.min(best, distToSeg(p, pts[i], pts[i + 1]));
  return best;
};

/* real boxes: the demo board's canonical geometry + a y-equal pair + a tb pair */
const GEO = {
  'demo e1 (src R -> topic L)': {sx: -53 + 218, sy: 298 + 84, tx: 324, ty: 290 + 112.5, sp: Position.Right, tp: Position.Left},
  'y-equal 500 apart':        {sx: 100, sy: 300, tx: 600, ty: 300, sp: Position.Right, tp: Position.Left},
  'tb pair':                  {sx: 300, sy: 100, tx: 300, ty: 600, sp: Position.Bottom, tp: Position.Top},
};
const OFFSETS = {center: 0.5, start: 0.25, end: 0.75};

console.log('dist = px from the label CENTRE to the wire polyline (0 = on the wire)\n');
console.log('geometry                     offset   bend |   current | short-circuited');
for (const [name, g] of Object.entries(GEO)) {
  for (const [oname, f] of Object.entries(OFFSETS)) {
    let worstA = 0, worstB = 0, sumA = 0, sumB = 0, n = 0;
    for (let b = 0; b <= 1.0001; b += 0.1) {
      const r = getSmoothStepPath({sourceX: g.sx, sourceY: g.sy, targetX: g.tx, targetY: g.ty,
        sourcePosition: g.sp, targetPosition: g.tp, borderRadius: g.sp === Position.Right ? 12 : 0, stepPosition: b});
      const [d, labelX, labelY] = r;
      const A = {x: g.sx + (g.tx - g.sx) * f + (labelX - (g.sx + g.tx) / 2),
                 y: g.sy + (g.ty - g.sy) * f + (labelY - (g.sy + g.ty) / 2)};
      const B = {x: g.sx + (g.tx - g.sx) * f, y: g.sy + (g.ty - g.sy) * f};
      const da = distToWire(A, d), db = distToWire(B, d);
      worstA = Math.max(worstA, da); worstB = Math.max(worstB, db);
      sumA += da; sumB += db; n++;
    }
    console.log(`${name.padEnd(28)} ${oname.padEnd(8)} 0..1 | ${worstA.toFixed(1).padStart(6)}px | ${worstB.toFixed(1).padStart(6)}px   (mean ${(sumA / n).toFixed(1)} vs ${(sumB / n).toFixed(1)})`);
  }
}
