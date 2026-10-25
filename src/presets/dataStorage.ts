/* ROUND BN-4 — this file is one slice of the former `src/presets.ts` (split verbatim, 2026-10-25). `src/presets/index.ts` re-exports the union, so every import of './presets' is unchanged. */
import type {Edge, Node} from '@xyflow/react';
import {type ColorKey} from '../colors';
import {type PaletteItem} from '../palette';
import {type TableColumn} from '../nodes/TableNode';
import {makeEdge, ERD_EDGES, type EdgeDefaults, type TemplateSpec} from './basic';
/* ===========================================================================
   L3c — ERD palette + template.
=========================================================================== */

export const TABLE_PALETTE_ITEM: PaletteItem = {
  label: 'Table', hint: 'columns + keys', shape: 'note', colorKey: 'cyan', kind: 'erg-table' as any,
  category: 'entities', types: ['erd'], aliases: ['entity', 'schema', 'db table'], geometry: 'table · columns',
  size: {width: 250, height: 170},
  // `make` is provided for the type contract only — App builds table nodes.
  make: () => ({text: ''} as any),
};

/** DISTINCT from the generic `Note` — the amber enum annotation (kicker
 *  'enum') that `erdTemplate`'s `note_enum` node uses. v2 §2.5/§12.7. */
export const ERD_ENUM_NOTE_ITEM: PaletteItem = {
  label: 'Note (enum)', hint: 'enum / annotation', shape: 'note', colorKey: 'amber', kind: 'goblin',
  category: 'annotations', types: ['erd'], aliases: ['enum', 'field values'], geometry: 'plain text annotation',
  /* AQ20 — same shape + category as the shared Note; the purpose line must
     say this one lists field values. */
  purpose: 'an ERD note listing the allowed values of a field',
  make: () => ({shape: 'note', kicker: 'enum', title: 'status', sub: 'pending · paid · shipped', metric: '', metricUnit: '', icon: 'sticky-note', colorKey: 'amber'}),
};

const col = (
  id: string, name: string, type: string,
  flags: {pk?: boolean; fk?: boolean; notNull?: boolean; unique?: boolean} = {},
): TableColumn => ({id, name, type, ...flags});

const table = (id: string, name: string, columns: TableColumn[], colorKey: ColorKey, x: number, y: number): Node => ({
  id, type: 'table', position: {x, y},
  data: {name, columns, colorKey},
});

export const erdTemplate: TemplateSpec = {
  id: 'commerce',
  label: 'users / orders / order_items',
  hint: 'one-to-many · associative table · enum · nullable · unique',
  nodes: [
    table('users', 'users', [
      col('u_id', 'id', 'uuid', {pk: true, notNull: true}),
      col('u_email', 'email', 'varchar(320)', {notNull: true, unique: true}),
      col('u_name', 'name', 'varchar(120)'),
      col('u_created', 'created_at', 'timestamptz', {notNull: true}),
    ], 'cyan', 0, 120),

    table('orders', 'orders', [
      col('o_id', 'id', 'uuid', {pk: true, notNull: true}),
      col('o_user', 'user_id', 'uuid', {fk: true, notNull: true}),
      col('o_status', 'status', 'order_status'),
      col('o_total', 'total_cents', 'integer', {notNull: true}),
      col('o_placed', 'placed_at', 'timestamptz', {notNull: true}),
    ], 'cyan', 400, 60),

    table('order_items', 'order_items', [
      col('i_id', 'id', 'uuid', {pk: true, notNull: true}),
      col('i_order', 'order_id', 'uuid', {fk: true, notNull: true}),
      col('i_product', 'product_id', 'uuid', {notNull: true}),
      col('i_qty', 'quantity', 'integer', {notNull: true}),
      col('i_unit', 'unit_cents', 'integer', {notNull: true}),
    ], 'violet', 800, 120),

    {
      id: 'note_enum', type: 'goblin', position: {x: 400, y: 420},
      data: {
        shape: 'note', kicker: 'enum', title: 'order_status',
        sub: 'pending · paid · shipped · cancelled', metric: '', metricUnit: '',
        icon: 'sticky-note', colorKey: 'amber',
      },
    },
  ],
  edges: [
    // order_items.order_id → orders.id  (one order, many items)
    makeEdge('orders', 'order_items', ERD_EDGES, 'r1', {
      sourceHandle: 'right_rel_o_id', targetHandle: 'left_rel_i_order',
      crowStart: 'one', crowEnd: 'many',
    }),
    // orders.user_id → users.id  (one user, many orders; nullable on the user side)
    makeEdge('users', 'orders', ERD_EDGES, 'r2', {
      sourceHandle: 'right_rel_u_id', targetHandle: 'left_rel_o_user',
      crowStart: 'zeroOrOne', crowEnd: 'many',
    }),
  ],
};

/* PACKAGE-SEQ — the UML sequence palette. Message ARROW KINDS (sync / async /
   reply) are edge data, not shapes; these rows are the NODE pieces. `purpose`
   lines carry the level (S1/S2/S3) so the search modal says which tier each
   piece belongs to (AQ20 override). */
export const SEQUENCE_PALETTE: PaletteItem[] = [
  {
    label: 'Lifeline', hint: 'head + dashed stem', shape: 'lifeline', colorKey: 'cyan', kind: 'goblin',
    category: 'sequence', types: ['sequence'], aliases: ['participant', 'column', 'object'],
    geometry: 'head + dashed stem', purpose: 'a sequence participant — stretch it downward to lengthen the lifeline',
    size: {width: 190, height: 380},
    make: () => ({shape: 'lifeline', kicker: '', title: 'Participant', sub: '', metric: '', metricUnit: '', colorKey: 'cyan'}),
  },
  {
    label: 'Activation', hint: 'thin bar · processing', shape: 'activation', colorKey: 'cyan', kind: 'goblin',
    category: 'sequence', types: ['sequence'], aliases: ['active', 'bar', 'focus'],
    geometry: 'thin vertical bar', purpose: 'the span in which a participant processes — level S2+',
    size: {width: 30, height: 220},
    make: () => ({shape: 'activation', kicker: '', title: 'activation', sub: '', metric: '', metricUnit: '', colorKey: 'cyan'}),
  },
  {
    label: 'Fragment', hint: 'frame · alt / loop', shape: 'fragment', colorKey: 'slate', kind: 'goblin',
    category: 'sequence', types: ['sequence'], aliases: ['alt', 'opt', 'loop', 'par', 'frame', 'combined'],
    geometry: 'frame + label tab', purpose: 'a combined fragment — set its kind in the kicker (alt / opt / loop / par)',
    size: {width: 480, height: 180},
    make: () => ({shape: 'fragment', kicker: 'loop', title: 'fragment', sub: '[ condition ]', metric: '', metricUnit: '', colorKey: 'slate'}),
  },
];
