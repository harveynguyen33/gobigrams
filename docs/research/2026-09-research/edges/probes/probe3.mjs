import {getSmoothStepPath, Position} from '@xyflow/system';

const base = {borderRadius: 12, sourceX: 100, sourceY: 300, targetX: 600, targetY: 200};
const r = (o) => getSmoothStepPath({...base, ...o})[0];

const sides = [Position.Left, Position.Right, Position.Top, Position.Bottom];
const OPP = {left: 'right', right: 'left', top: 'bottom', bottom: 'top'};
let mismatches = 0;
console.log('src      tgt      | bends? | target===opposite(src)?');
for (const s of sides) {
  for (const t of sides) {
    const a = r({sourcePosition: s, targetPosition: t, stepPosition: 0.1});
    const b = r({sourcePosition: s, targetPosition: t, stepPosition: 0.9});
    const bends = a !== b;
    const expected = OPP[s] === t;
    if (bends !== expected) mismatches++;
    console.log(`${s.padEnd(8)} ${t.padEnd(8)} | ${String(bends).padEnd(6)} | ${expected}${bends !== expected ? '   <<< MISMATCH' : ''}`);
  }
}
console.log('\nstepPosition is honoured EXACTLY when target === opposite(source)? ', mismatches === 0);
