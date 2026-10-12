import {getSmoothStepPath, Position} from '@xyflow/system';
const base = {sourceX: 100, sourceY: 300, targetX: 600, targetY: 300, borderRadius: 12};
const r = (o) => { const p = getSmoothStepPath({...base, ...o}); return {path: p[0], labelX: p[1], labelY: p[2]}; };
console.log('R->L stepPosition omitted :', JSON.stringify(r({sourcePosition: Position.Right, targetPosition: Position.Left})));
console.log('R->L stepPosition 0.5     :', JSON.stringify(r({sourcePosition: Position.Right, targetPosition: Position.Left, stepPosition: 0.5})));
console.log('R->L stepPosition 0.1     :', JSON.stringify(r({sourcePosition: Position.Right, targetPosition: Position.Left, stepPosition: 0.1})));
console.log('R->L stepPosition 0.9     :', JSON.stringify(r({sourcePosition: Position.Right, targetPosition: Position.Left, stepPosition: 0.9})));
console.log('R->R stepPosition 0.1     :', JSON.stringify(r({sourcePosition: Position.Right, targetPosition: Position.Right, stepPosition: 0.1})));
console.log('R->R stepPosition omitted :', JSON.stringify(r({sourcePosition: Position.Right, targetPosition: Position.Right})));
console.log('R->T stepPosition 0.1     :', JSON.stringify(r({sourcePosition: Position.Right, targetPosition: Position.Top, stepPosition: 0.1})));
console.log('T->B stepPosition 0.8     :', JSON.stringify(r({sourcePosition: Position.Top, targetPosition: Position.Bottom, stepPosition: 0.8,
  sourceX: 300, sourceY: 100, targetX: 300, targetY: 600})));
