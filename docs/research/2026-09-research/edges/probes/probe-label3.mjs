/* TRAP #4, final measurement: on the LIVE board geometry, is the label's
   distance-to-wire at bend=0.5 (today's only value) the SAME as the worst over
   the whole bend sweep? If yes, the bend control does not make the label worse
   and no label change is warranted. */
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
const F = {center: 0.5, start: 0.25, end: 0.75};
const GEO = [
  ['demo e1 src->topic', 165, 382, 324, 402.5, Position.Right, Position.Left, 12],
  ['demo e2 topic->cg', 692, 402.5, 726, 356, Position.Right, Position.Left, 12],
];
console.log('LABEL distance to the wire (px) — live board geometry, smoothstep');
console.log('geometry              offset |  at bend 0.5 | worst over 0..1 | delta');
for (const [n, sx, sy, tx, ty, sp, tp, br] of GEO) for (const [on, f] of Object.entries(F)) {
  const at = (bend) => {
    const [d, lx, ly] = getSmoothStepPath({sourceX: sx, sourceY: sy, targetX: tx, targetY: ty,
      sourcePosition: sp, targetPosition: tp, borderRadius: br, stepPosition: bend});
    const p = {x: sx + (tx - sx) * f + (lx - (sx + tx) / 2), y: sy + (ty - sy) * f + (ly - (sy + ty) / 2)};
    return distToWire(p, d);
  };
  const cur = at(0.5);
  let worst = 0; for (let b = 0; b <= 1.0001; b += 0.02) worst = Math.max(worst, at(b));
  console.log(`${n.padEnd(20)} ${on.padEnd(6)} | ${cur.toFixed(2).padStart(11)}px | ${worst.toFixed(2).padStart(14)}px | ${(worst - cur).toFixed(2)}px`);
}
/* and the same question for a HYPOTHETICAL long aligned pair, where the label
   feature is most visible: is the drift pre-existing? */
console.log('\nsame question on a long y-aligned pair (500px apart) — the hardest case');
{
  const [sx, sy, tx, ty, sp, tp, br] = [100, 300, 600, 300, Position.Right, Position.Left, 12];
  for (const [on, f] of Object.entries(F)) {
    const at = (bend) => {
      const [d, lx, ly] = getSmoothStepPath({sourceX: sx, sourceY: sy, targetX: tx, targetY: ty,
        sourcePosition: sp, targetPosition: tp, borderRadius: br, stepPosition: bend});
      return distToWire({x: sx + (tx - sx) * f + (lx - (sx + tx) / 2), y: sy + (ty - sy) * f + (ly - (sy + ty) / 2)}, d);
    };
    console.log(`  ${on.padEnd(6)} at bend 0.5: ${at(0.5).toFixed(1)}px   worst 0..1: ${(() => { let w = 0; for (let b = 0; b <= 1.0001; b += 0.02) w = Math.max(w, at(b)); return w.toFixed(1); })()}px`);
  }
}
