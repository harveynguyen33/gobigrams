/* CORE-STEP2 (SPEC-GOBI-CORE §A) — the .gobi core's REGISTRY DATA: the
 * kind geometry, derived from the SAME registry union the vocabulary is
 * locked to (GOBI_KIND_ITEM, ROUND GOBI-LOCK). This is the data half of
 * the registry split the spec's section A begins: pure data the compiler
 * needs (sizes feed the layout passes), with zero presentation attached.
 * The presentation half (palette item lookup + the node factories) stays
 * with the canvas in src/gobi/adapterCanvas.ts.
 *
 * Derived, never restated: a palette size change moves the language's
 * layout with it, exactly as a palette label change moves the vocabulary
 * (checks/round-gobi-lock.mjs C7 holds the no-restatement rule for labels;
 * the doc-parity corpus holds it for geometry — a drifted size re-renders
 * every fixture differently). */

import {PALETTE} from './model/palette';
import {FLOWCHART_PALETTE} from './model/presets/flowchart';
import {TABLE_PALETTE_ITEM} from './model/presets/dataStorage';
import {GOBI_KIND_ITEM, GOBI_KINDS} from './gobiTypes';

/** The ONE union (unfiltered by the create-surface gates — the language
 * speaks the full vocabulary whatever the UI currently offers). */
const ITEMS = [...PALETTE, ...FLOWCHART_PALETTE, TABLE_PALETTE_ITEM];

/** kind word → the palette item's own size (GOBI-SIZE: the ONE source both
 * create paths read, src/nodeSizes.ts). This is what the compiler's layout
 * passes use for every node's box — including a memberless group (a group
 * WITH members is sized by its pack, which starts from these boxes). */
export const GOBI_KIND_GEOMETRY: Record<string, {w: number; h: number}> = {};
for (const [kind, meta] of Object.entries(GOBI_KIND_ITEM)) {
  const item = ITEMS.find((p) => p.label === meta.label);
  if (item?.size) GOBI_KIND_GEOMETRY[kind] = {w: item.size.width, h: item.size.height};
}

/** The kind vocabulary, re-exported so the corpus's fixture-per-kind
 * enumeration reads ONE registry module (SPEC §F: coverage is enumerated
 * FROM the registry — the corpus cannot silently miss a new kind). */
export {GOBI_KINDS};
