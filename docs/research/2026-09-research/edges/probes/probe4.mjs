import {getSmoothStepPath, Position} from '@xyflow/system';
const base = {borderRadius: 12, sourceX: 100, sourceY: 300, targetX: 600, targetY: 200, offset: 20};
for (const [s, t] of [[Position.Left, Position.Right], [Position.Right, Position.Left], [Position.Right, Position.Right], [Position.Top, Position.Bottom], [Position.Bottom, Position.Top]]) {
  const a = getSmoothStepPath({...base, sourcePosition: s, targetPosition: t, stepPosition: 0.1});
  const b = getSmoothStepPath({...base, sourcePosition: s, targetPosition: t, stepPosition: 0.9});
  console.log(`${s}->${t}`);
  console.log(`   @0.1 ${a[0]}  label ${a[1]},${a[2]}`);
  console.log(`   @0.9 ${b[0]}  label ${b[1]},${b[2]}`);
  console.log(`   differ: ${a[0] !== b[0]}`);
}
