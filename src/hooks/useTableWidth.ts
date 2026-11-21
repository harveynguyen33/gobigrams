/* LAYOUT-FOLLOWS-WIDTH (task t_c50332ff) — the LIVE half of the ONE width.
 * The width is a CORE fact (`tableNaturalWidth`, packages/gobi/src/model/
 * tableWidth.ts) read by the import layout, the canvas adapter and the SVG
 * export. This hook only REFINES it: it keeps the store's node width equal to
 * the core's number when what the core reads has changed — the board's
 * style/density, or a column the author just typed into.
 *
 * WHY A STORE WRITE, NOT A CSS VARIABLE (the shape this replaced): the wrapper
 * React Flow draws, the edges, the minimap and the exporter all read the NODE's
 * width. A CSS-only override left the document at 250 while the card painted
 * 422 — measured 96px of overlap. One number, in the document.
 *
 * POSITIONS ARE NEVER TOUCHED (W4): a table grows to the RIGHT of its own
 * origin, so typing widens the card without re-flowing the diagram under the
 * user's hands. NO MEASUREMENT: every number comes from the pure core; the two
 * shared row tracks are published as CSS vars so every row's columns align.
 */
import {useLayoutEffect} from 'react';
import type {Node} from '@xyflow/react';
import {tableMetrics, type TableWidthInput} from '../../packages/gobi/src/model/tableWidth';
import {resolveDensity, resolveTableStyle, type Density, type TableStyle} from '../../packages/gobi/src/model/tableStyle';

const tracks = (id: string, flags: number, type: number) => {
  const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"] .tnode`);
  if (!el) return;
  el.style.setProperty('--gFlags', `${flags}px`);
  el.style.setProperty('--gType', `${type}px`);
};

export function useTableWidth(
  nodes: Node[],
  setNodes: (u: Node[]) => void,
  style: TableStyle,
  density: Density,
) {
  useLayoutEffect(() => {
    const style2 = resolveTableStyle(style), density2 = resolveDensity(density);
    let changed = false;
    const next = nodes.map((n) => {
      if (n.type !== 'table') return n;
      /* TABLE-SCALE — the node's OWN scale is an input of the same width, so a
         1.5x table is MEASURED by the core at 1.5, never guessed from its
         unscaled columns. */
      const box = tableMetrics(n.data as unknown as TableWidthInput, style2, density2,
        (n.data as {scale?: number}).scale);
      /* the refinement is published first: it depends on nothing React owns */
      tracks(n.id, box.flags, box.type);
      const styleW = (n.style as {width?: number} | undefined)?.width;
      if (n.width === box.width && styleW === box.width) return n;
      changed = true;
      return {...n, width: box.width, style: {...n.style, width: box.width}};
    });
    if (changed) setNodes(next);
  });
}
