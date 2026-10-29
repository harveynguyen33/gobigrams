/* embedNodeTypes.ts — ROUND GOBI-S2: the node renderers the /embed route
 * mounts. The app's own four kinds, with the read-only flag threaded per
 * node exactly the way App's rfNodes does it (a custom node component
 * receives only its own `data` — src/nodes/LabelNode.tsx reads d.readOnly,
 * GoblinEdge reads its own copy). No handlers are injected: an embed has no
 * editors, so there is nothing to commit.
 * (feature-map home: src/embed.tsx) */
import DiagramNode from './nodes/DiagramNode';
import LabelNode from './nodes/LabelNode';
import TableNode from './nodes/TableNode';
import CustomShapeNode from './nodes/CustomShapeNode';
import {NO_PAN} from './choreography';
import type {Node, NodeTypes} from '@xyflow/react';

const readOnlyData = (n: Node) => ({
  ...(n.data as Record<string, unknown>),
  readOnly: true,
});

/** The embed's nodeTypes: same renderers, read-only data, noPan wrappers. */
export const nodeTypes: NodeTypes = {
  goblin: DiagramNode,
  label: LabelNode,
  table: TableNode,
  customshape: CustomShapeNode,
};

/** Apply the embed's read-only threading to a decoded board's nodes. */
export function embedNodes(nodes: Node[]): Node[] {
  return nodes.map(n => ({
    ...n,
    className: [n.className, NO_PAN].filter(Boolean).join(' '),
    data: readOnlyData(n),
    selected: false,
  }));
}
