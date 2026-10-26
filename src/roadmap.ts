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
    title: 'A canvas that mixes diagram families',
    desc: 'Any shape on any board, with new-line defaults that follow the last style you set instead of the board\u2019s birth preset. Researched; the spec pass is next.',
    status: 'now',
    confidence: 'committed',
    area: 'editor',
  },
  {
    title: 'Install as an app (PWA)',
    desc: 'Add the editor to your desktop or home screen — it opens full-screen and keeps working offline. The board storage is already local; this makes it feel native.',
    status: 'now',
    confidence: 'committed',
    area: 'site',
  },
  {
    title: 'Public launch',
    desc: 'License, public repository and a hosted build so anyone can open the editor in a browser. Feedback and issue reporting shipped; the hosting decision is the gate.',
    status: 'now',
    confidence: 'committed',
    area: 'site',
  },
  {
    title: 'Rotation for shapes and groups',
    desc: 'Rotate a shape or a selected group — connection points rotate with the shape so edges stay attached. CSS-transform approach (the library\u2019s own rotatable-node pattern); a scoped round of its own.',
    status: 'next',
    confidence: 'committed',
    area: 'editor',
  },
  {
    title: 'Smarter auto-layout',
    desc: 'The layered layout grows direction control (top-down / left-right) and better spacing for wide ERDs and architecture boards.',
    status: 'next',
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
    title: 'Share a board by link',
    desc: 'The whole board folded into a URL — no account, no server, open-and-see. The companion to self-hosted storage.',
    status: 'later',
    confidence: 'exploring',
    area: 'data',
  },
  {
    title: 'Embed a board in a page',
    desc: 'An iframe snippet from the share link, for blogs and docs.',
    status: 'later',
    confidence: 'exploring',
    area: 'site',
  },
  {
    title: 'Import from draw.io',
    desc: 'Paste .drawio XML and get nodes on the canvas — the migration path for the biggest audience.',
    status: 'later',
    confidence: 'exploring',
    area: 'data',
  },
  {
    title: 'Find and replace text',
    desc: 'Rename an entity across a fifty-table ERD in one pass.',
    status: 'later',
    confidence: 'exploring',
    area: 'editor',
  },
  {
    title: 'More diagram notations',
    desc: 'Beyond flowcharts, ERD, C4 and architecture \u2014 following the same shape-library and template structure.',
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
  {label: 'round BG', what: 'Connection handles on imported art, plain arrows for every new line, feedback and issue reporting', when: '2026-10'},
  {label: 'round BF', what: 'Per-shape resize floors and the selected-box ring for imported art \u2014 the resize snap is gone', when: '2026-10'},
  {label: 'round AZ', what: 'Shipped fonts (Inter, JetBrains Mono) embedded in exports \u2014 files render the same on machines that have nothing installed', when: '2026-10'},
  {label: 'round BA/AY', what: 'Real vector SVG and PNG export \u2014 text as text or outlined paths, measured pixel-accurate against the canvas', when: '2026-10'},
  {label: 'round AT', what: 'Boards saved in the browser itself \u2014 the editor runs on a plain static host with no server', when: '2026-10'},
  {label: 'round AS', what: 'Mermaid import that survives round-trips, and one-undo imports', when: '2026-10'},
  {label: 'round AR', what: 'SVG export became real vector \u2014 selectable text, no flicker', when: '2026-10'},
  {label: 'package 7', what: 'Settings completion \u2014 export defaults (PNG scale, padding), autosave control, persisted canvas preferences', when: '2026-10'},
  {label: 'package 6', what: 'Roadmap surface \u2014 what the tool does today, next, and is exploring, in Settings \u2192 About', when: '2026-09'},
  {label: 'round 3', what: 'Colour palette, connection points, node resizing and rotation rules', when: '2026-09'},
  {label: 'round 2', what: 'Edge utilities \u2014 labels, line markers, flow animation', when: '2026-09'},
  {label: 'round 1', what: 'Templates gallery with three difficulty levels', when: '2026-09'},
  {label: 'package 5', what: 'Shape library \u2014 34 shapes, search, favourites, custom SVG import', when: '2026-09'},
  {label: 'package 4', what: 'Inspector panel \u2014 per-shape sections, icon pickers, fold state', when: '2026-09'},
  {label: 'package 3', what: 'Settings and themes \u2014 five themes, one layout per screen size', when: '2026-09'},
  {label: 'package 2', what: 'Multi-diagram types \u2014 flowchart, ERD, C4, architecture', when: '2026-09'},
  {label: 'package 1', what: 'Onboarding \u2014 guided tour and a getting-started checklist', when: '2026-09'},
];

/**
 * The honest line of provenance the pane renders in the header area. Deliberately
 * NOT a warning, a badge or a banner, and it changes nothing else: deleting this
 * one element is the whole change if it is ever dropped.
 */
export const ROADMAP_REVIEWED = '2026-10-24';
