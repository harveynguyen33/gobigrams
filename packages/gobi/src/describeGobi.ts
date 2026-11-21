/* STEP-5-MCP (task t_640282d6) — describeGobiDocument: the MODEL-READABLE
 * projection of a compiled GobiDocument.
 *
 * WHY THIS LIVES IN CORE, NOT THE SERVER: the MCP door's rule is "no logic in
 * the server" — the server parses JSON, calls the core, returns JSON. Walking
 * the document (nodes/kinds/labels, edges, group membership) is a doc-model
 * projection, so it ships here next to the types it reads, and the smoke test
 * pins it against the committed corpus (describe ids === .doc.json ids).
 *
 * PURE: no IO, no layout, no measurement — a strict subsetting of fields the
 * compiler already resolved. Nothing is derived that the document does not
 * already carry (group membership reads `parent`, the same frame every other
 * surface resolves). */

import type {GobiDocument, GobiDocEdge, GobiDocNode} from './gobiTypes';

/** One node, trimmed to what an agent needs to decide what to change. */
export type GobiDescribeNode = {
  id: string;
  kind: string;
  label: string;
  /** Owning group id — absent for top-level nodes. */
  parent?: string;
  sub?: string;
  icon?: string;
  color?: string;
  /** Column names — table kind only. */
  columns?: string[];
};

/** One edge: endpoints plus the authored payload the agent can rewrite. */
export type GobiDescribeEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
  techn?: string;
  dash: 'solid' | 'dashed' | 'dotted';
  /** The authored cardinality tokens, e.g. ['0..1', '0..n']. */
  card?: [string, string];
};

/** A `group` node with its DIRECT members (nested groups appear as members
 * AND in this list themselves — the document's own frame, no flattening). */
export type GobiDescribeGroup = {
  id: string;
  title: string;
  members: string[];
};

/** The compact summary `gobi_describe` returns — everything an agent reads
 * before deciding what to change, nothing it doesn't. */
export type GobiDescribe = {
  name: string;
  direction: 'LR' | 'TB';
  theme?: string;
  nodeCount: number;
  edgeCount: number;
  nodes: GobiDescribeNode[];
  edges: GobiDescribeEdge[];
  groups: GobiDescribeGroup[];
};

const describeNode = (n: GobiDocNode): GobiDescribeNode => {
  const out: GobiDescribeNode = {id: n.id, kind: n.kind, label: n.label};
  if (n.parent !== undefined) out.parent = n.parent;
  if (n.sub !== undefined) out.sub = n.sub;
  if (n.icon !== undefined) out.icon = n.icon;
  if (n.color !== undefined) out.color = n.color;
  if (n.columns !== undefined) out.columns = n.columns.map((c) => c.name);
  return out;
};

const describeEdge = (e: GobiDocEdge): GobiDescribeEdge => {
  const out: GobiDescribeEdge = {id: e.id, from: e.from, to: e.to, dash: e.dash};
  if (e.label !== undefined) out.label = e.label;
  if (e.techn !== undefined) out.techn = e.techn;
  if (e.card !== undefined) out.card = [e.card[0], e.card[1]];
  return out;
};

export function describeGobiDocument(doc: GobiDocument): GobiDescribe {
  const groups = doc.nodes
    .filter((n) => n.kind === 'group')
    .map((g) => ({
      id: g.id,
      title: g.label,
      members: doc.nodes.filter((n) => n.parent === g.id).map((n) => n.id),
    }));
  const out: GobiDescribe = {
    name: doc.name,
    direction: doc.direction,
    nodeCount: doc.nodes.length,
    edgeCount: doc.edges.length,
    nodes: doc.nodes.map(describeNode),
    edges: doc.edges.map(describeEdge),
    groups,
  };
  if (doc.theme !== undefined) out.theme = doc.theme;
  return out;
}
