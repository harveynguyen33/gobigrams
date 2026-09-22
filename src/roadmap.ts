/**
 * PACKAGE-R — the roadmap surface's data.
 *
 * A typed, hard-coded module: no backend, no fetch, no CMS. Research ranked a
 * typed file in the repo #1 for single-owner maintenance cost — a month of
 * neglect breaks nothing, and it is versioned and diffable. Its shape is
 * asserted by `checks/package-r-roadmap.mjs`.
 *
 * RULES THE DATA CARRIES (see PACKAGE-R-SPEC.md §2):
 *  - NO future dates anywhere in an item. Order only. `when` on a shipped row
 *    is the ONE place a date belongs, and it is a past month.
 *  - Status is never encoded by colour alone — the column heading is the text
 *    label and the dot supports it. Every item carries the WORD
 *    (`committed` / `exploring`) so an item can be dropped without an apology.
 */

export type RoadmapStatus = 'now' | 'next' | 'later';
export type RoadmapConfidence = 'committed' | 'exploring';

export interface RoadmapItem {
  title: string;
  desc: string;
  status: RoadmapStatus;
  confidence: RoadmapConfidence;
  area: string;
}

export interface ShippedEntry {
  label: string;   // internal handle, e.g. 'round 3' / 'package 5'
  what: string;
  when: string;    // 'YYYY-MM' — the ONLY place a date is allowed
}

/**
 * The four columns below read `now` / `next` / `later` here; the pane labels
 * them Now / Next / Exploring. `later` keeps its stored name because
 * "Exploring" is the display choice, not the data.
 *
 * `now` and `next` are drawn from the PACKAGE-M2 backlog and its explicitly
 * deferred list; `later` from HANDOFF.md (rotation is documented as a scoped
 * round of its own, not a quick add) and the notation roadmap.
 */
export const ROADMAP: RoadmapItem[] = [
  {
    title: 'Templates for more diagram families',
    desc: 'Flowchart templates ship at three levels. ERD, C4 and architecture families follow the same catalog.',
    status: 'now',
    confidence: 'committed',
    area: 'editor',
  },
  {
    title: 'Settings: the remaining panes',
    desc: 'The Settings surface ships; the backlog behind it — autosave, grid size, input device, export defaults — fills it group by group.',
    status: 'now',
    confidence: 'committed',
    area: 'editor',
  },
  {
    title: 'Collaboration',
    desc: 'Live cursors, presence and comments. Held back until the editor can be shared with more than one person at a time.',
    status: 'next',
    confidence: 'exploring',
    area: 'editor',
  },
  {
    title: 'Version history',
    desc: 'Browse and restore earlier revisions of a board. Depends on the storage layer growing first.',
    status: 'next',
    confidence: 'exploring',
    area: 'data',
  },
  {
    title: 'Mobile and tablet refinements',
    desc: 'The editor already has dedicated layouts per screen size. This is the next round of polish on real devices.',
    status: 'next',
    confidence: 'committed',
    area: 'editor',
  },
  {
    title: 'Rotation for shapes',
    desc: 'Needs connection points to rotate with the shape, or every edge detaches. A round of its own, not a quick add.',
    status: 'later',
    confidence: 'exploring',
    area: 'editor',
  },
  {
    title: 'More diagram notations',
    desc: 'Beyond flowcharts, ERD, C4 and architecture — following the same shape-library and template structure.',
    status: 'later',
    confidence: 'exploring',
    area: 'editor',
  },
];

/**
 * Newest first. The `label` is an internal handle (`round N`, `package N`), not
 * user vocabulary: it is acceptable here because the `what` column carries the
 * meaning. It is never used in the Now / Next / Exploring columns.
 */
export const SHIPPED: ShippedEntry[] = [
  {label: 'round 3', what: 'Colour palette, connection points, node resizing and rotation rules', when: '2026-09'},
  {label: 'round 2', what: 'Edge utilities — labels, line markers, flow animation', when: '2026-09'},
  {label: 'round 1', what: 'Templates gallery with three difficulty levels', when: '2026-09'},
  {label: 'package 5', what: 'Shape library — 34 shapes, search, favourites, custom SVG import', when: '2026-09'},
  {label: 'package 4', what: 'Inspector panel — per-shape sections, icon pickers, fold state', when: '2026-09'},
  {label: 'package 3', what: 'Settings and themes — five themes, one layout per screen size', when: '2026-09'},
  {label: 'package 2', what: 'Multi-diagram types — flowchart, ERD, C4, architecture', when: '2026-09'},
  {label: 'package 1', what: 'Onboarding — guided tour and a getting-started checklist', when: '2026-09'},
];

/**
 * The honest line of provenance the pane renders in the header area. Deliberately
 * NOT a warning, a badge or a banner, and it changes nothing else: deleting this
 * one element is the whole change if it is ever dropped.
 */
export const ROADMAP_REVIEWED = '2026-09-22';
