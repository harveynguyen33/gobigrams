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
    title: 'Copy the diagram to the clipboard',
    desc: 'Paste straight into a doc, a chat or an email \u2014 the diagram reaches the clipboard without a download step.',
    status: 'now',
    confidence: 'committed',
    area: 'editor',
  },
  {
    title: 'Find and replace text',
    desc: 'Rename an entity across a fifty-table ERD in one pass \u2014 the match comes into view as it is replaced.',
    status: 'now',
    confidence: 'committed',
    area: 'editor',
  },
  {
    title: 'Transparent-background PNG',
    desc: 'The PNG sits on any slide or doc theme without dragging its own dark rectangle along.',
    status: 'next',
    confidence: 'committed',
    area: 'editor',
  },
  {
    title: 'Present mode',
    desc: 'Walk a teammate through the architecture full-screen \u2014 arrow keys advance and all the chrome is gone.',
    status: 'next',
    confidence: 'committed',
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
    title: 'Command palette',
    desc: 'Every command \u2014 export, board switch, toggles, templates \u2014 reachable by typing a few letters of its name.',
    status: 'later',
    confidence: 'exploring',
    area: 'editor',
  },
  {
    title: 'Import from draw.io',
    desc: 'Paste .drawio XML and get nodes on the canvas — the migration path for the biggest audience.',
    status: 'later',
    confidence: 'exploring',
    area: 'data',
  },
  {
    title: 'More diagram notations',
    desc: 'Beyond flowcharts, ERD, C4 and architecture \u2014 following the same shape-library and template structure.',
    status: 'later',
    confidence: 'exploring',
    area: 'editor',
  },
  {
    title: 'Mermaid import returns',
    desc: 'The From-Mermaid door is hidden, not gone. It comes back rebuilt to do what the dialog promised.',
    status: 'later',
    confidence: 'exploring',
    area: 'data',
  },
  {
    title: '"What\u2019s new" release notes',
    desc: 'A short sheet for feature changes that reach existing users \u2014 deferred, not rejected; it earns its place once there are users coming back.',
    status: 'later',
    confidence: 'exploring',
    area: 'site',
  },
];

/**
 * Newest first. The `label` is an internal handle (`round N`, `package N`), not
 * user vocabulary: it is acceptable here because the `what` column carries the
 * meaning. It is never used in the Now / Next / Exploring columns.
 */
export const SHIPPED: ShippedEntry[] = [
  {label: 'round LAUNCH', what: 'The editor is public on the product domain, with published releases', when: '2026-11'},
  {label: 'package 8', what: 'The .gobi text surface ships as packages — an MCP server (@techgoblin/gobi-mcp 0.1.2) and an Obsidian plugin (obsidian-gobi 0.1.1) — plus the canvas-to-text direction (boardDocToGobi)', when: '2026-11'},
  {label: 'round MIX', what: 'A board declares a diagram type and the palette, shapes, edge defaults, layout and theme follow it', when: '2026-11'},
  {label: 'round SEL-CHROME', what: 'One selection chrome \u2014 a floating pill carries rotate, group and lock, for one shape or a whole selection', when: '2026-11'},
  {label: 'round GROUP', what: 'Bind shapes into one block \u2014 drag it, rotate it or grab its inner gap, every member moves together, one undo entry', when: '2026-11'},
  {label: 'round UNISURF', what: 'The board as .gobi text beside the canvas \u2014 edit either side, both stay in sync', when: '2026-11'},
  {label: 'round HIGHLIGHT', what: 'Hover a shape and its own connections light up while the rest dim \u2014 the eye finds the path', when: '2026-11'},
  {label: 'round FIDELITY', what: 'Every note is the same note \u2014 palette, search, canvas and export paint one post-it silhouette', when: '2026-11'},
  {label: 'round PASTE', what: 'Paste lands where the cursor points \u2014 the clipboard\u2019s centre anchored on the pointer', when: '2026-11'},
  {label: 'round EMBED', what: 'A chrome-less build for blogs and docs \u2014 the same share link, sized to fit any iframe', when: '2026-11'},
  {label: 'round SHARE', what: 'Share a board as one link \u2014 no account, no server, the link carries the whole board', when: '2026-11'},
  {label: 'round TOOLBAR', what: 'One icon language on the toolbar \u2014 dialogs open on the right tab and close back to where you were', when: '2026-11'},
  {label: 'round ROTATE', what: 'Rotate shapes and groups \u2014 connection points follow the shape and exports match', when: '2026-10'},
  {label: 'round LAYOUT', what: 'Auto-layout direction control + wide-board wrapping + islands keep their offsets', when: '2026-10'},
  {label: 'round PWA', what: 'Install as an app — PWA manifest + offline shell', when: '2026-10'},
  {label: 'round BG', what: 'Connection handles on imported art, plain arrows for every new line, feedback and issue reporting', when: '2026-10'},
  {label: 'round BF', what: 'Per-shape resize floors and the selected-box ring for imported art \u2014 the resize snap is gone', when: '2026-10'},
  {label: 'round AZ', what: 'Shipped fonts (Inter, JetBrains Mono) embedded in exports \u2014 files render the same on machines that have nothing installed', when: '2026-10'},
  {label: 'round BA/AY', what: 'Real vector SVG and PNG export \u2014 text as text or outlined paths, measured pixel-accurate against the canvas', when: '2026-10'},
  {label: 'round AT', what: 'Boards saved in the browser itself \u2014 the editor runs on a plain static host with no server', when: '2026-10'},
  {label: 'round AS', what: 'Mermaid import round-trips (door hidden — coming back later), and one-undo imports', when: '2026-10'},
  {label: 'round AR', what: 'SVG export became real vector \u2014 selectable text, no flicker', when: '2026-10'},
  {label: 'package 7', what: 'Settings completion \u2014 export defaults (PNG scale, padding), autosave control, persisted canvas preferences', when: '2026-10'},
  {label: 'package 6', what: 'Roadmap surface \u2014 what the tool does today, next, and is exploring, in Settings \u2192 About', when: '2026-09'},
  {label: 'round MOBILE', what: 'Form factor resolved from the editor container into phone / tablet / desktop tiers with one docked-sidebar threshold', when: '2026-09'},
  {label: 'round 3', what: 'Colour palette, connection points, node resizing and rotation rules', when: '2026-09'},
  {label: 'round 2', what: 'Edge utilities \u2014 labels, line markers, flow animation', when: '2026-09'},
  {label: 'round 1', what: 'Templates gallery with three difficulty levels', when: '2026-09'},
  {label: 'package 5', what: 'Shape library \u2014 34 shapes, search, favourites, custom SVG import', when: '2026-09'},
  {label: 'package 4', what: 'Inspector panel \u2014 per-shape sections, icon pickers, fold state', when: '2026-09'},
  {label: 'package 3', what: 'Settings and themes \u2014 five themes, one layout per screen size', when: '2026-09'},
  {label: 'package 2', what: 'Multi-diagram types \u2014 flowchart, ERD, C4, architecture', when: '2026-09'},
  {label: 'package 1', what: 'Onboarding \u2014 a capability list in the ? sheet and a getting-started checklist', when: '2026-09'},
];

/**
 * The honest line of provenance the pane renders in the header area. Deliberately
 * NOT a warning, a badge or a banner, and it changes nothing else: deleting this
 * one element is the whole change if it is ever dropped.
 */
export const ROADMAP_REVIEWED = '2026-11-24';
