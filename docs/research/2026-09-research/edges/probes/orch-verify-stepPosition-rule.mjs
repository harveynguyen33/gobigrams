import {getSmoothStepPath, Position} from '@xyflow/system';
// DERIVED RULE from @xyflow/system index.mjs L1263-1297:
//  - only in the "opposite handles" branch
//  - stepPosition feeds centerX (dirAccessor==='x') or centerY (dirAccessor==='y')
//  - points===verticalSplit when dirAccessor==='x' && sourceDir.x===currDir
//    points===horizontalSplit when dirAccessor==='y' && sourceDir.y===currDir
//  => stepPosition ACTIVE  iff  opposite-handles AND sourceDir[primary] === currDir
const HD={left:{x:-1,y:0},right:{x:1,y:0},top:{x:0,y:-1},bottom:{x:0,y:1}};
const OPP={left:'right',right:'left',top:'bottom',bottom:'top'};
const dirOf=(sp,s,t)=>{ // getDirection(source=s, target=t, sourcePosition=sp) on GAPPED points; offsets cancel for sign
  if(sp==='left'||sp==='right') return s.x<t.x?{x:1,y:0}:{x:-1,y:0};
  return s.y<t.y?{x:0,y:1}:{x:0,y:-1};
};
const pred=(sx,sy,tx,ty,sp,tp,offset=20)=>{
  if(OPP[sp]!==tp) return false;                 // same-side/mixed => inactive
  const sd=HD[sp];
  const sGap={x:sx+sd.x*offset,y:sy+sd.y*offset}, tGap={x:tx+HD[tp].x*offset,y:ty+HD[tp].y*offset};
  const d=dirOf(sp,sGap,tGap);
  const acc=d.x!==0?'x':'y';
  return sd[acc]===d[acc];
};
const sides=[Position.Left,Position.Right,Position.Top,Position.Bottom];
let n=0,bad=0,act=0,ex=[];
for(const s of sides)for(const t of sides)for(let i=0;i<600;i++){
  const dx=Math.round(Math.random()*2400-1200), dy=Math.round(Math.random()*2400-1200);
  const o={sourceX:300,sourceY:300,targetX:300+dx,targetY:300+dy,sourcePosition:s,targetPosition:t,borderRadius:12};
  const works=getSmoothStepPath({...o,stepPosition:0.1})[0]!==getSmoothStepPath({...o,stepPosition:0.9})[0];
  const p=pred(300,300,300+dx,300+dy,s,t);
  n++; if(works)act++;
  if(works!==p){bad++; if(ex.length<6)ex.push(`${s}->${t} d=(${dx},${dy}) works=${works} pred=${p}`);}
}
console.log(`swept ${n}; stepPosition active ${act} (${(100*act/n).toFixed(1)}%)`);
console.log(`counterexamples: ${bad}`);
ex.forEach(e=>console.log('  ',e));
