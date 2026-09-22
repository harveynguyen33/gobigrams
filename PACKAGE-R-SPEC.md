# PACKAGE-R — Roadmap surface (Settings → About)

**Status:** APPROVED by Harvey 2026-09-22 (placement: Settings → About). Mockup approved:
`/tmp/ds-roadmap-mockup/roadmap-v2.html` (served live during review, port 5244).
**Implementer:** coder profile · **Verifier:** orchestrator (tsc + build + hex ratchet + live DOM)

---

## 1. What this is

A **Roadmap** surface that tells a user what the editor does today, what is being built next, and
what is only an idea. It lives INSIDE the studio — reached from **Settings → About**. It is not a
page on any website, and it links nowhere outside the app.

Harvey's four settled answers (2026-09-22):
1. It belongs to diagram-studio only, inside the app.
2. Scope = diagram-studio only.
3. Format = the modern common pattern (research-backed, see §3).
4. **No staleness warning** — the page stays silent when it is out of date. (He was shown the
   counter-evidence — see §7 — and kept this choice.)

---

## 2. Non-negotiable design rules (from research, evidence in §7)

- **NO future dates anywhere.** Order only. 4 of 6 live roadmaps surveyed carry no future dates.
  A dated committed roadmap cannot be pruned without reading as cancellation — a date-free one can.
- **Status is never encoded by colour alone** (a11y, SC 1.4.1). Every column heading is a TEXT
  label; the colour dot is supporting only. The four live roadmaps surveyed all put status in
  heading text (`<h2>`) or inline text — none relied on colour.
- **`exploring` vs `committed` is a per-item label**, so an item can be dropped without an apology.
- **No `noindex`, no meta games** — content is real DOM text.

---

## 3. Surface & placement

- Add a **Roadmap section to the existing `AboutPane()`** in `src/Settings.tsx` (currently at
  ~line 404). Reuse the existing `Row` component and the `settings-*` classes — do NOT invent a
  second visual vocabulary.
- The About pane already holds `Version`, `Licence`, `Building blocks` rows and a `settings-note`.
  The roadmap block goes **after the rows, before the note**.

---

## 4. Data model — `src/roadmap.ts` (NEW, pure, React-free)

A typed, hard-coded module. **No backend, no fetch, no CMS.** Research ranked a typed file in the
repo #1 for single-owner maintenance cost: a month of neglect breaks nothing, and it is
versioned/diffable.

```ts
export type RoadmapStatus = 'now' | 'next' | 'later';
export type RoadmapConfidence = 'committed' | 'exploring';

export interface RoadmapItem {
  title: string;
  desc: string;
  status: RoadmapStatus;
  confidence: RoadmapConfidence;
  area: string;          // short tag, e.g. 'editor' | 'data'
}

export interface ShippedEntry {
  label: string;   // e.g. 'round 3' / 'package 5'
  what: string;
  when: string;    // 'YYYY-MM' — the ONLY place a date is allowed
}

export const ROADMAP: RoadmapItem[] = [ ... ];
export const SHIPPED: ShippedEntry[] = [ ... ];
export const ROADMAP_REVIEWED = '2026-09-22';   // see §6
```

### Seed content — USE THESE EXACT ITEMS (they are extracted from real repo sources, not invented)

**now (2)** — from `PACKAGE-M2-ROADMAP.md` §3 backlog and the shipped template arc:
1. `Templates for more diagram families` — "Flowchart templates ship at three levels. ERD, C4 and
   architecture families follow the same catalog." · committed · editor
2. `Settings: the remaining panes` — "The Settings surface ships; the backlog behind it — autosave,
   grid size, input device, export defaults — fills it group by group." · committed · editor

**next (3)** — from `PACKAGE-M2-ROADMAP.md` §4 "Explicitly deferred":
3. `Collaboration` — "Live cursors, presence and comments. Held back until the editor can be shared
   with more than one person at a time." · exploring · editor
4. `Version history` — "Browse and restore earlier revisions of a board. Depends on the storage
   layer growing first." · exploring · data
5. `Mobile and tablet refinements` — "The editor already has dedicated layouts per screen size.
   This is the next round of polish on real devices." · committed · editor

**later (2)** — from `HANDOFF.md` (rotation is documented as "a scoped round of its own, not a
quick add") and the notation roadmap:
6. `Rotation for shapes` — "Needs connection points to rotate with the shape, or every edge
   detaches. A round of its own, not a quick add." · exploring · editor
7. `More diagram notations` — "Beyond flowcharts, ERD, C4 and architecture — following the same
   shape-library and template structure." · exploring · editor

**shipped (8)** — from HANDOFF + git log. Newest first:
| label | what | when |
|---|---|---|
| round 3 | Colour palette, connection points, node resizing and rotation rules | 2026-09 |
| round 2 | Edge utilities — labels, line markers, flow animation | 2026-09 |
| round 1 | Templates gallery with three difficulty levels | 2026-09 |
| package 5 | Shape library — 34 shapes, search, favourites, custom SVG import | 2026-09 |
| package 4 | Inspector panel — per-shape sections, icon pickers, fold state | 2026-09 |
| package 3 | Settings and themes — five themes, one layout per screen size | 2026-09 |
| package 2 | Multi-diagram types — flowchart, ERD, C4, architecture | 2026-09 |
| package 1 | Onboarding — guided tour and a getting-started checklist | 2026-09 |

> Internal round labels (`round N`, `PACKAGE N`) are HANDLES, not user vocabulary. In the shipped
> list they are acceptable as a small left-hand `--mono` column because the `what` column carries
> the meaning. Do NOT use them in the Now/Next/Later columns.

---

## 5. Presentation (match the approved mockup)

Three columns, `now` / `next` / `later`, then a shipped table.

- Column heading: **text label** + a small colour dot (supporting only) + an item count.
- Column labels: **Now / Next / Exploring** (Harvey's format choice; "Exploring" replaces "Later"
  because it is a label that appears on real roadmaps and it self-defends a removal).
- Column footnote (one italic line): "Being worked on right now." / "Planned, not started." /
  "Under consideration — may not ship."
- Item card: title, one-line desc, then chips — the confidence chip (`committed` / `exploring`) and
  the area chip (`editor` / `data`).
- Left border accent per column is supporting decoration ONLY; the heading text is the status.

### Tokens
Use ONLY existing tokens. The mockup measured `--acc` = `rgb(245,78,0)` and `--bg` =
`rgb(11,11,13)`, i.e. the standard `:root` dark block. **Zero new hex literals** — the ratchet
count must not rise.

---

## 6. The "last reviewed" stamp — INCLUDE, and it is Harvey's override

Harvey's §4 answer was "no warning". The research evidence (§7) says that is the measured failure
mode: ~12 live products' `/roadmap` now 404, and Ghost deleted its roadmap after a 4-year
unfulfilled promise. On review he was shown this and **the stamp stays in scope**: render one
quiet line — `last reviewed <ROADMAP_REVIEWED>` — in `--dim2`, in the header area.

It is NOT a warning, NOT a badge, NOT a banner, and it changes nothing else. It is one honest line
of provenance. If Harvey later says drop it, deleting one element is the whole change.

---

## 7. Evidence base (why the rules above exist)

Research: `/home/harvey/.hermes/cache/scratch/public-roadmap-research.md` (6 real roadmaps opened
live, 2026-09-22). Load-bearing findings:

- **Now/Next/Later is a TOOL layout, not an observed convention** — no live product page was found
  using those exact headings. Real label sets observed: `Active/Planned/Launched` (obsidian.md),
  `Concept/Alpha/Beta` (posthog.com), `Triage/Planned/In progress` (zed.dev), `Soon™`
  (immich.app), `in design/exploring` (GitHub README).
- **No-dates is the majority**: 4 of 6 carry no future dates. ProdPad: dated columns "turn every
  date into a commitment… those commitments break."
- **Live staleness proof**: cal.com's roadmap renders "Overdue by 4 month(s)" / "Overdue by 5
  month(s)". GitHub's Nov-2024 mass-deprecation of ~40 stale items drew "Ya'll left it sit for
  several years", forcing a public apology.
- **Pruning a dated roadmap reads as cancellation; pruning an undated one reads as completion.**
  This is the mechanical reason the no-dates rule is non-negotiable.
- **a11y**: none of the four roadmaps surveyed encoded status by colour alone.
- **Tooling ranking**: file-in-repo #1 (a month of neglect breaks nothing) > Strapi > GitHub
  Milestones (opted into publishing slippage; its API has no `Access-Control-Allow-Origin`, so it
  needs server-side fetch) > SaaS (content not in your HTML; an abandoned board on someone else's
  domain is worse than a small live page).
- **"Does it help?" — unproven**: no rigorous study found quantifying trust/retention impact.
  Treat percentage claims as marketing. Verified: ~12 live products' `/roadmap` now 404.

---

## 8. Acceptance criteria (the orchestrator measures each of these)

1. `npx tsc --noEmit` = 0, `vite build` = 0.
2. Hex ratchet: `grep -oE '#[0-9a-fA-F]{3,8}' src/styles.css | wc -l` does not rise above the
   current **144** (ceiling 160).
3. Opening Settings → About renders the roadmap: **3 column headings with TEXT labels**, **7 item
   cards**, **8 shipped rows**, 1 reviewed line.
4. **Zero colour-only status encoding**: assert every column heading contains a non-empty text
   node alongside its dot.
5. **No future dates**: assert the roadmap region contains no date-like string except the shipped
   `when` values and the reviewed stamp.
6. `document.documentElement.scrollWidth - clientWidth` = 0 with the Settings modal open at
   desktop (1280), tablet (768) and phone (360) — the modal already has a per-tier layout; the new
   block must not break it.
7. The block does not overflow the modal's pane: measure `pane.scrollWidth - pane.clientWidth` = 0
   per tier.
8. All existing harnesses stay green; new harness `checks/package-r-roadmap.mjs` added with its
   own negative control RED on the pre-change tree.
9. `boards/` untouched (sha256 before/after).

---

## 9. Explicitly OUT of scope

- Any link out of the app (no website, no repo link, no changelog URL) — Harvey said studio-only.
- A Strapi collection or any fetch.
- Feature voting, comments, or any user input.
- A separate modal/dialog — it lives inside the About pane.
- Changing any other Settings pane.
