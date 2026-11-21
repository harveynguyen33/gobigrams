/* CORE-STEP1 (task t_f808b5fb) — the .gobi core's LOCAL edge-path math.
 *
 * WHY THIS FILE EXISTS: gobiCompiler.ts (label anchoring on the painted curve)
 * and export/edgeRoute.ts (the headless route) used to import these three
 * generators from '@xyflow/react' at RUNTIME — which dragged react +
 * @xyflow/react + everything they ship into every headless consumer of the
 * language compiler (measured: a compileGobi-only esbuild bundle was 1,044,662
 * B minified, most of it React Flow). A language parser does not need a
 * renderer.
 *
 * PROVENANCE: this is a faithful copy of the three path generators of
 * `@xyflow/system` 12.12.1 (pinned in this repo), which is MIT licensed:
 *
 *   Copyright (c) 2023 xyflow, Karsten Schmidt and contributors
 *   Permission is hereby granted, free of charge, to any person obtaining a
 *   copy of this software and associated documentation files (the "Software"),
 *   to deal in the Software without restriction, including without limitation
 *   the rights to use, copy, modify, merge, publish, distribute, sublicense,
 *   and/or sell copies of the Software, and to permit persons to whom the
 *   Software is furnished to do so, subject to the following conditions:
 *   The above copyright notice and this permission notice shall be included
 *   in all copies or substantial portions of the Software.
 *
 * Copies of the MIT licence text ship with @xyflow/system in node_modules.
 *
 * THE CONTRACT: byte-identical output to the library, forever. The string
 * values of `Position` are identical to React Flow's, so compiled board JSON
 * (which stores handle ids/positions derived from these) does not change.
 * checks/round-gobi-core-decouple.mjs P2 compares the local copies against the
 * REAL @xyflow/react exports over >= 1000 randomized cases (max deviation
 * <= 0.001 px) and P1 proves every corpus artefact stayed byte-identical.
 * The app itself still ships @xyflow/react for the canvas — this copy exists
 * only inside the core's own import graph.
 */

/** React Flow's handle-side vocabulary, verbatim (string values are
 *  load-bearing: they are stored in board JSON). */
export const Position = {
  Left: 'left',
  Top: 'top',
  Right: 'right',
  Bottom: 'bottom',
} as const;
export type Position = (typeof Position)[keyof typeof Position];

/* ------------------------------------------------------------ bezier ---- */

/** Cubic bezier t=0.5 mid point (not the actual mid point, but easy to
 *  calculate) — verbatim from @xyflow/system's getBezierEdgeCenter. */
function getBezierEdgeCenter({
  sourceX, sourceY, targetX, targetY, sourceControlX, sourceControlY, targetControlX, targetControlY,
}: {
  sourceX: number; sourceY: number; targetX: number; targetY: number;
  sourceControlX: number; sourceControlY: number; targetControlX: number; targetControlY: number;
}): [number, number, number, number] {
  const centerX = sourceX * 0.125 + sourceControlX * 0.375 + targetControlX * 0.375 + targetX * 0.125;
  const centerY = sourceY * 0.125 + sourceControlY * 0.375 + targetControlY * 0.375 + targetY * 0.125;
  const offsetX = Math.abs(centerX - sourceX);
  const offsetY = Math.abs(centerY - sourceY);
  return [centerX, centerY, offsetX, offsetY];
}

function calculateControlOffset(distance: number, curvature: number): number {
  if (distance >= 0) {
    return 0.5 * distance;
  }
  return curvature * 25 * Math.sqrt(-distance);
}

function getControlWithCurvature(
  {pos, x1, y1, x2, y2, c}: {pos: Position; x1: number; y1: number; x2: number; y2: number; c: number},
): [number, number] {
  switch (pos) {
    case Position.Left:
      return [x1 - calculateControlOffset(x1 - x2, c), y1];
    case Position.Right:
      return [x1 + calculateControlOffset(x2 - x1, c), y1];
    case Position.Top:
      return [x1, y1 - calculateControlOffset(y1 - y2, c)];
    case Position.Bottom:
      return [x1, y1 + calculateControlOffset(y2 - y1, c)];
  }
}

export type BezierPathOptions = {
  sourceX: number;
  sourceY: number;
  sourcePosition?: Position;
  targetX: number;
  targetY: number;
  targetPosition?: Position;
  curvature?: number;
};

/** Verbatim from @xyflow/system's getBezierPath (same tuple shape). */
export function getBezierPath({
  sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top, curvature = 0.25,
}: BezierPathOptions): [string, number, number, number, number] {
  const [sourceControlX, sourceControlY] = getControlWithCurvature({
    pos: sourcePosition,
    x1: sourceX,
    y1: sourceY,
    x2: targetX,
    y2: targetY,
    c: curvature,
  });
  const [targetControlX, targetControlY] = getControlWithCurvature({
    pos: targetPosition,
    x1: targetX,
    y1: targetY,
    x2: sourceX,
    y2: sourceY,
    c: curvature,
  });
  const [labelX, labelY, offsetX, offsetY] = getBezierEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourceControlX,
    sourceControlY,
    targetControlX,
    targetControlY,
  });
  return [
    `M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
    labelX,
    labelY,
    offsetX,
    offsetY,
  ];
}

/* ---------------------------------------------------------- straight ---- */

/** Verbatim from @xyflow/system's getEdgeCenter (also the smoothstep label
 *  offset source). */
function getEdgeCenter({
  sourceX, sourceY, targetX, targetY,
}: {sourceX: number; sourceY: number; targetX: number; targetY: number}): [number, number, number, number] {
  const xOffset = Math.abs(targetX - sourceX) / 2;
  const centerX = targetX < sourceX ? targetX + xOffset : targetX - xOffset;
  const yOffset = Math.abs(targetY - sourceY) / 2;
  const centerY = targetY < sourceY ? targetY + yOffset : targetY - yOffset;
  return [centerX, centerY, xOffset, yOffset];
}

export type StraightPathOptions = {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
};

/** Verbatim from @xyflow/system's getStraightPath — including the space after
 *  `M` and before `L`, which is part of the painted string. */
export function getStraightPath({sourceX, sourceY, targetX, targetY}: StraightPathOptions): [string, number, number, number, number] {
  const [labelX, labelY, offsetX, offsetY] = getEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });
  return [`M ${sourceX},${sourceY}L ${targetX},${targetY}`, labelX, labelY, offsetX, offsetY];
}

/* -------------------------------------------------------- smoothstep ---- */

type XY = {x: number; y: number};

const handleDirections: Record<Position, XY> = {
  [Position.Left]: {x: -1, y: 0},
  [Position.Right]: {x: 1, y: 0},
  [Position.Top]: {x: 0, y: -1},
  [Position.Bottom]: {x: 0, y: 1},
};

const getDirection = ({
  source, sourcePosition = Position.Bottom, target,
}: {source: XY; sourcePosition?: Position; target: XY}): XY => {
  if (sourcePosition === Position.Left || sourcePosition === Position.Right) {
    return source.x < target.x ? {x: 1, y: 0} : {x: -1, y: 0};
  }
  return source.y < target.y ? {x: 0, y: 1} : {x: 0, y: -1};
};

const distance = (a: XY, b: XY) => Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));

/** Checks if b lies on the straight segment from a to c, including b === c. */
const isBetween = (a: XY, b: XY, c: XY) =>
  (a.x === b.x && b.x === c.x && (b.y - a.y) * (c.y - b.y) >= 0) ||
  (a.y === b.y && b.y === c.y && (b.x - a.x) * (c.x - b.x) >= 0);

/**
 * Mimics an orthogonal edge routing behaviour — verbatim from
 * @xyflow/system's getPoints (it is not as good as a real orthogonal router,
 * but it is faster and good enough as the step/smoothstep default).
 */
function getPoints({
  source, sourcePosition = Position.Bottom, target, targetPosition = Position.Top, center, offset, stepPosition,
}: {
  source: XY; sourcePosition?: Position; target: XY; targetPosition?: Position;
  center: {x?: number; y?: number} | undefined; offset: number; stepPosition: number;
}): [XY[], number, number, number, number] {
  const sourceDir = handleDirections[sourcePosition];
  const targetDir = handleDirections[targetPosition];
  const sourceGapped = {x: source.x + sourceDir.x * offset, y: source.y + sourceDir.y * offset};
  const targetGapped = {x: target.x + targetDir.x * offset, y: target.y + targetDir.y * offset};
  const dir = getDirection({
    source: sourceGapped,
    sourcePosition,
    target: targetGapped,
  });
  const dirAccessor = dir.x !== 0 ? 'x' : 'y';
  const currDir = dir[dirAccessor];
  let points: XY[] = [];
  let centerX: number, centerY: number;
  const sourceGapOffset = {x: 0, y: 0};
  const targetGapOffset = {x: 0, y: 0};
  const [, , defaultOffsetX, defaultOffsetY] = getEdgeCenter({
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y,
  });
  // opposite handle positions, default case
  if (sourceDir[dirAccessor] * targetDir[dirAccessor] === -1) {
    if (dirAccessor === 'x') {
      centerX = center.x ?? sourceGapped.x + (targetGapped.x - sourceGapped.x) * stepPosition;
      centerY = center.y ?? (sourceGapped.y + targetGapped.y) / 2;
    } else {
      centerX = center.x ?? (sourceGapped.x + targetGapped.x) / 2;
      centerY = center.y ?? sourceGapped.y + (targetGapped.y - sourceGapped.y) * stepPosition;
    }
    const verticalSplit = [
      {x: centerX, y: sourceGapped.y},
      {x: centerX, y: targetGapped.y},
    ];
    const horizontalSplit = [
      {x: sourceGapped.x, y: centerY},
      {x: targetGapped.x, y: centerY},
    ];
    if (sourceDir[dirAccessor] === currDir) {
      points = dirAccessor === 'x' ? verticalSplit : horizontalSplit;
    } else {
      points = dirAccessor === 'x' ? horizontalSplit : verticalSplit;
    }
  } else {
    // sourceTarget means we take x from source and y from target, targetSource is the opposite
    const sourceTarget = [{x: sourceGapped.x, y: targetGapped.y}];
    const targetSource = [{x: targetGapped.x, y: sourceGapped.y}];
    // this handles edges with same handle positions
    if (dirAccessor === 'x') {
      points = sourceDir.x === currDir ? targetSource : sourceTarget;
    } else {
      /* NOTE: verbatim from @xyflow/system — the .y branch is INVERTED
         relative to the .x branch upstream. Do not "fix" it: byte-identical
         output to the library is the contract (harness P2d). */
      points = sourceDir.y === currDir ? sourceTarget : targetSource;
    }
    if (sourcePosition === targetPosition) {
      const diff = Math.abs(source[dirAccessor] - target[dirAccessor]);
      // if an edge goes from right to right for example (sourcePosition === targetPosition) and
      // the distance between source.x and target.x is less than the offset, the added point and
      // the gapped source/target will overlap — add a gapOffset to avoid the weird path.
      if (diff <= offset) {
        const gapOffset = Math.min(offset - 1, offset - diff);
        if (sourceDir[dirAccessor] === currDir) {
          sourceGapOffset[dirAccessor] = (sourceGapped[dirAccessor] > source[dirAccessor] ? -1 : 1) * gapOffset;
        } else {
          targetGapOffset[dirAccessor] = (targetGapped[dirAccessor] > target[dirAccessor] ? -1 : 1) * gapOffset;
        }
      }
    }
    // conditions for handling mixed handle positions like Right -> Bottom
    if (sourcePosition !== targetPosition) {
      const dirAccessorOpposite = dirAccessor === 'x' ? 'y' : 'x';
      const isSameDir = sourceDir[dirAccessor] === targetDir[dirAccessorOpposite];
      const sourceGtTargetOppo = sourceGapped[dirAccessorOpposite] > targetGapped[dirAccessorOpposite];
      const sourceLtTargetOppo = sourceGapped[dirAccessorOpposite] < targetGapped[dirAccessorOpposite];
      const flipSourceTarget = (sourceDir[dirAccessor] === 1 && ((!isSameDir && sourceGtTargetOppo) || (isSameDir && sourceLtTargetOppo))) ||
        (sourceDir[dirAccessor] !== 1 && ((!isSameDir && sourceLtTargetOppo) || (isSameDir && sourceGtTargetOppo)));
      if (flipSourceTarget) {
        points = dirAccessor === 'x' ? sourceTarget : targetSource;
      }
    }
    const sourceGapPoint = {x: sourceGapped.x + sourceGapOffset.x, y: sourceGapped.y + sourceGapOffset.y};
    const targetGapPoint = {x: targetGapped.x + targetGapOffset.x, y: targetGapped.y + targetGapOffset.y};
    const maxXDistance = Math.max(Math.abs(sourceGapPoint.x - points[0]!.x), Math.abs(targetGapPoint.x - points[0]!.x));
    const maxYDistance = Math.max(Math.abs(sourceGapPoint.y - points[0]!.y), Math.abs(targetGapPoint.y - points[0]!.y));
    // we want to place the label on the longest segment of the edge
    if (maxXDistance >= maxYDistance) {
      centerX = (sourceGapPoint.x + targetGapPoint.x) / 2;
      centerY = points[0]!.y;
    } else {
      centerX = points[0]!.x;
      centerY = (sourceGapPoint.y + targetGapPoint.y) / 2;
    }
  }
  const gappedSource = {x: sourceGapped.x + sourceGapOffset.x, y: sourceGapped.y + sourceGapOffset.y};
  const gappedTarget = {x: targetGapped.x + targetGapOffset.x, y: targetGapped.y + targetGapOffset.y};
  const pathPoints: XY[] = [];
  for (const point of [source, gappedSource, ...points, gappedTarget, target]) {
    const [a, b] = pathPoints.slice(-2);
    // drop b if the path runs straight through it, otherwise it would shrink the bend of the next corner
    if (b && isBetween(a!, b, point)) {
      pathPoints.pop();
    }
    pathPoints.push(point);
  }
  return [pathPoints, centerX!, centerY!, defaultOffsetX, defaultOffsetY];
}

function getBend(a: XY, b: XY, c: XY, size: number): string {
  const bendSize = Math.min(distance(a, b) / 2, distance(b, c) / 2, size);
  const {x, y} = b;
  // no bend
  if ((a.x === x && x === c.x) || (a.y === y && y === c.y)) {
    return `L${x} ${y}`;
  }
  // first segment is horizontal
  if (a.y === y) {
    const xDir = a.x < c.x ? -1 : 1;
    const yDir = a.y < c.y ? 1 : -1;
    return `L ${x + bendSize * xDir},${y}Q ${x},${y} ${x},${y + bendSize * yDir}`;
  }
  const xDir = a.x < c.x ? 1 : -1;
  const yDir = a.y < c.y ? -1 : 1;
  return `L ${x},${y + bendSize * yDir}Q ${x},${y} ${x + bendSize * xDir},${y}`;
}

export type SmoothStepPathOptions = {
  sourceX: number;
  sourceY: number;
  sourcePosition?: Position;
  targetX: number;
  targetY: number;
  targetPosition?: Position;
  borderRadius?: number;
  centerX?: number;
  centerY?: number;
  offset?: number;
  stepPosition?: number;
};

/** Verbatim from @xyflow/system's getSmoothStepPath. */
export function getSmoothStepPath({
  sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top,
  borderRadius = 5, centerX, centerY, offset = 20, stepPosition = 0.5,
}: SmoothStepPathOptions): [string, number, number, number, number] {
  const [points, labelX, labelY, offsetX, offsetY] = getPoints({
    source: {x: sourceX, y: sourceY},
    sourcePosition,
    target: {x: targetX, y: targetY},
    targetPosition,
    center: {x: centerX, y: centerY},
    offset,
    stepPosition,
  });
  let path = `M${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length - 1; i++) {
    path += getBend(points[i - 1]!, points[i]!, points[i + 1]!, borderRadius);
  }
  path += `L${points[points.length - 1]!.x} ${points[points.length - 1]!.y}`;
  return [path, labelX, labelY, offsetX, offsetY];
}
