/**
 * node-click-distance.harness.mjs — machine check for the CLICK / DRAG DEAD BAND.
 *
 * Run:  node checks/node-click-distance.harness.mjs
 *
 * WHAT IT GUARDS. A press on a node body is judged by TWO INDEPENDENT GATES in
 * `@xyflow/system` + `d3-drag`, and each reads a DIFFERENT number:
 *
 *   GATE 1 (the click)  d3-drag `clickDistance`, fed by the `nodeClickDistance`
 *                       prop. Travel ABOVE it latches `mousemoving`, and
 *                       `yesdrag(view, mousemoving)` then swallows the trailing
 *                       click. React Flow's default is 0 -> any travel kills
 *                       the click.
 *   GATE 2 (the drag)   `nodeDragThreshold`. The drag only starts when travel
 *                       is ABOVE it.
 *
 * If `nodeClickDistance < nodeDragThreshold` the interval
 * `(clickDistance, dragThreshold]` is a DEAD BAND: the click is already
 * suppressed while the drag has not started. The press does nothing at all.
 * That was the shipped defect (0px selected, 1/2/3/4px did NOTHING, 6px+ dragged).
 * If `nodeClickDistance > nodeDragThreshold` the gates OVERLAP instead and a
 * short drag also fires a click.
 *
 * So the invariant is EQUALITY per pointer class — and these assertions walk
 * the actual pixel travel values through both gate predicates, rather than
 * only comparing the constants, so they would also catch a future change that
 * keeps the numbers equal but edits one of the comparisons.
 *
 * SELF-TESTING. The negative controls at the bottom re-run the same predicate
 * over a deliberately BROKEN pair and require it to be rejected. Without them
 * this file could pass while never being able to fail.
 */
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const {
  FINE_DRAG_THRESHOLD_PX,
  COARSE_DRAG_THRESHOLD_PX,
  FINE_NODE_CLICK_DISTANCE_PX,
  COARSE_NODE_CLICK_DISTANCE_PX,
} = await import(join(ROOT, 'src/touch.ts'));

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
};

// --- the two gates, transcribed from the libraries -------------------------
// GATE 1: d3-drag `mousemoved` — `dx*dx + dy*dy > clickDistance2`, where
//         `clickDistance2 = distance * distance`. Strictly greater-than.
const clickIsSuppressed = (travelPx, clickDistancePx) =>
  travelPx * travelPx > clickDistancePx * clickDistancePx;

// GATE 2: @xyflow/system `XYDrag` `.on('drag')` —
//         `if (distance > nodeDragThreshold) startDrag(event)`. Strictly `>`.
const dragStarts = (travelPx, dragThresholdPx) => travelPx > dragThresholdPx;

/** Walk 0..maxPx of travel and classify what the user would observe. */
const classify = (travelPx, clickDistancePx, dragThresholdPx) => {
  const drags = dragStarts(travelPx, dragThresholdPx);
  const clicks = !clickIsSuppressed(travelPx, clickDistancePx);
  if (!drags && !clicks) return 'DEAD';
  if (drags && clicks) return 'BOTH';
  return drags ? 'drag' : 'click';
};

console.log('diagram-studio — click/drag dead-band harness\n');
console.log(
  `  fine   : dragThreshold=${FINE_DRAG_THRESHOLD_PX}  nodeClickDistance=${FINE_NODE_CLICK_DISTANCE_PX}`,
);
console.log(
  `  coarse : dragThreshold=${COARSE_DRAG_THRESHOLD_PX}  nodeClickDistance=${COARSE_NODE_CLICK_DISTANCE_PX}\n`,
);

console.log('constants — the invariant itself');
for (const [label, click, drag] of [
  ['fine pointer', FINE_NODE_CLICK_DISTANCE_PX, FINE_DRAG_THRESHOLD_PX],
  ['coarse pointer', COARSE_NODE_CLICK_DISTANCE_PX, COARSE_DRAG_THRESHOLD_PX],
]) {
  check(`${label}: nodeClickDistance === nodeDragThreshold`, () => {
    assert.equal(
      click,
      drag,
      `${label}: nodeClickDistance (${click}) !== nodeDragThreshold (${drag}) — ` +
        'a mismatch reopens the dead band or overlaps the gates. See src/touch.ts.',
    );
  });
  check(`${label}: nodeClickDistance >= nodeDragThreshold (the stated floor)`, () => {
    assert.ok(
      click >= drag,
      `${label}: nodeClickDistance (${click}) < nodeDragThreshold (${drag})`,
    );
  });
  check(`${label}: nodeClickDistance is a non-negative finite number`, () => {
    assert.ok(Number.isFinite(click) && click >= 0, `${label}: bad nodeClickDistance ${click}`);
    assert.ok(Number.isFinite(drag) && drag >= 0, `${label}: bad nodeDragThreshold ${drag}`);
  });
}

console.log('\nbehaviour — every travel value the pointer can take');
for (const [label, click, drag] of [
  ['fine pointer', FINE_NODE_CLICK_DISTANCE_PX, FINE_DRAG_THRESHOLD_PX],
  ['coarse pointer', COARSE_NODE_CLICK_DISTANCE_PX, COARSE_DRAG_THRESHOLD_PX],
]) {
  const maxPx = drag + 3;
  const observed = [];
  for (let t = 0; t <= maxPx; t += 1) observed.push(classify(t, click, drag));
  const summary = observed.map((r, t) => `${t}px=${r}`).join(' ');

  check(`${label}: no DEAD band anywhere in 0..${maxPx}px  [${summary}]`, () => {
    const dead = observed
      .map((r, t) => (r === 'DEAD' ? t : -1))
      .filter((t) => t >= 0);
    assert.deepEqual(
      dead,
      [],
      `${label}: travel of ${dead.join('/')}px does NOTHING (click suppressed, drag not started)`,
    );
  });

  check(`${label}: no BOTH overlap (a travel is never a drag AND a click)`, () => {
    const both = observed
      .map((r, t) => (r === 'BOTH' ? t : -1))
      .filter((t) => t >= 0);
    assert.deepEqual(both, [], `${label}: travel of ${both.join('/')}px both drags and clicks`);
  });

  check(`${label}: 0px is a click (a still press always takes)`, () => {
    assert.equal(classify(0, click, drag), 'click');
  });

  check(`${label}: <= threshold is a click, > threshold is a drag (clean handoff)`, () => {
    for (let t = 0; t <= drag; t += 1) {
      assert.equal(classify(t, click, drag), 'click', `${label}: ${t}px should still be a click`);
    }
    for (let t = drag + 1; t <= maxPx; t += 1) {
      assert.equal(classify(t, click, drag), 'drag', `${label}: ${t}px should be a drag`);
    }
  });

  check(`${label}: tremor band 1..3px selects (the original complaint)`, () => {
    for (const t of [1, 2, 3]) {
      assert.equal(classify(t, click, drag), 'click', `${label}: ${t}px of tremor was lost`);
    }
  });
}

console.log('\nwiring — the props must actually reach <ReactFlow>');
{
  const app = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8');
  const grab = (prop) => {
    const m = app.match(new RegExp(`\\b${prop}=\\{([^}]*)\\}`));
    return m ? {expr: m[1].trim(), raw: m[0]} : null;
  };
  const dragProp = grab('nodeDragThreshold');
  const clickProp = grab('nodeClickDistance');
  const connProp = grab('connectionDragThreshold');

  check('App.tsx passes nodeDragThreshold', () => {
    assert.ok(dragProp, 'no nodeDragThreshold prop found in src/App.tsx');
  });
  check('App.tsx passes nodeClickDistance (the fix)', () => {
    assert.ok(
      clickProp,
      'no nodeClickDistance prop found in src/App.tsx — the dead band is OPEN',
    );
  });

  check('both props select on ui.isTouchScreen with the same shape', () => {
    for (const [name, p] of [
      ['nodeDragThreshold', dragProp],
      ['nodeClickDistance', clickProp],
    ]) {
      assert.match(
        p.expr,
        /ui\.isTouchScreen\s*\?/,
        `${name} is not gated on ui.isTouchScreen: ${p.raw}`,
      );
      const branches = p.expr.split('?')[1].split(':');
      assert.equal(branches.length, 2, `${name} is not a simple ternary: ${p.raw}`);
    }
  });

  check('both props resolve to the SAME pointer classes (fine vs coarse pairing)', () => {
    const parse = (expr) => {
      const [coarse, fine] = expr
        .split('?')[1]
        .split(':')
        .map((s) => s.trim());
      return {coarse, fine};
    };
    const d = parse(dragProp.expr);
    const c = parse(clickProp.expr);
    assert.equal(c.fine, 'FINE_NODE_CLICK_DISTANCE_PX', `unexpected fine click class: ${c.fine}`);
    assert.equal(
      c.coarse,
      'COARSE_NODE_CLICK_DISTANCE_PX',
      `unexpected coarse click class: ${c.coarse}`,
    );
    assert.equal(d.fine, 'FINE_DRAG_THRESHOLD_PX', `unexpected fine drag class: ${d.fine}`);
    assert.equal(d.coarse, 'COARSE_DRAG_THRESHOLD_PX', `unexpected coarse drag class: ${d.coarse}`);
  });

  check('the connection threshold is NOT the node threshold (1px, no click to swallow)', () => {
    assert.ok(connProp, 'no connectionDragThreshold prop found in src/App.tsx');
    assert.match(connProp.expr, /FINE_CONNECTION_DRAG_THRESHOLD_PX/);
  });

  check('paneClickDistance is NOT overridden — the pane has no second gate', () => {
    const pane = grab('paneClickDistance');
    assert.equal(
      pane,
      null,
      'src/App.tsx now overrides paneClickDistance; the pane path has no paired ' +
        'drag threshold, so there is no dead band to close there. See src/touch.ts ' +
        'before re-adding this prop.',
    );
  });

  check('the nodeClickDistance PROP is wired in exactly one place (App.tsx)', () => {
    const offenders = [];
    for (const file of readdirSync(join(ROOT, 'src'))) {
      if (!/\.tsx$/.test(file)) continue;
      const src = readFileSync(join(ROOT, 'src', file), 'utf8');
      const propCount = (src.match(/nodeClickDistance=\{/g) || []).length;
      if (propCount > 0) offenders.push(`${file}:${propCount}`);
    }
    assert.deepEqual(
      offenders,
      ['App.tsx:1'],
      `the nodeClickDistance prop should be passed exactly once, in App.tsx — found: ${offenders.join(', ')}`,
    );
  });

  check('src/touch.ts documents the pairing (the spec requires it there)', () => {
    const touch = readFileSync(join(ROOT, 'src/touch.ts'), 'utf8');
    assert.match(touch, /nodeClickDistance/, 'touch.ts no longer names the paired prop');
    assert.match(
      touch,
      /dead band/i,
      'touch.ts no longer explains the dead band — a future reader would have to rediscover it',
    );
    assert.match(
      touch,
      /GATE 1|GATE 2/,
      'touch.ts no longer separates the two gates, which is the whole point',
    );
  });
}

console.log('\nnegative controls — the harness must be able to FAIL');
check('a LOWER nodeClickDistance is rejected as a dead band', () => {
  // (click=1, drag=4) — the pre-fix shape with a raised threshold.
  const dead = [];
  for (let t = 0; t <= 5; t += 1) if (classify(t, 1, 4) === 'DEAD') dead.push(t);
  assert.deepEqual(dead, [2, 3, 4], 'expected a 2..4px dead band for click=1, drag=4');
});
check('a HIGHER nodeClickDistance is rejected as an overlap', () => {
  const both = [];
  for (let t = 0; t <= 6; t += 1) if (classify(t, 6, 4) === 'BOTH') both.push(t);
  assert.deepEqual(both, [5, 6], 'expected a 5..6px overlap for click=6, drag=4');
});
check('the shipped pre-fix default (click=0, drag=4) reproduces the reported table', () => {
  // 0px selects; 1..4px do nothing; 5px+ drags. Harvey's measurement.
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((t) => classify(t, 0, 4)),
    ['click', 'DEAD', 'DEAD', 'DEAD', 'DEAD', 'drag'],
  );
});

console.log(`\n${passed} checks passed.`);
