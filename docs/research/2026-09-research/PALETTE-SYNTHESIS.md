# PALETTE REDESIGN — SYNTHESIS (orchestrator, 2026-09-16)

Consolidates the four grounded cluster reports. This is the input for the spec + mockup.
**Every claim below is traceable to a cluster report, which cites its own source URL.**

Sources:
- `PALETTE-1-drawio.md` — draw.io source (`jgraph/drawio@dev`, HEAD `f3abfe0`, 31.4.5) + live DOM read
- `PALETTE-2-excalidraw-tldraw.md` — Excalidraw `master` + tldraw `main` source, real `.excalidrawlib` files
- `PALETTE-3-taxonomy.md` — Mermaid / C4 / ISO 5807 + 4 published search implementations
- `PALETTE-4-custom-shapes.md` — SVG safety, library formats, persistence quotas, layout clamps

---

## 1. What Harvey decided (settled, do not re-open)

| # | Decision |
|---|---|
| 1 | Palette organised like draw.io's sidebar — **but take the better design where one exists** |
| 2 | **Scratchpad = a place to keep the shapes he LIKES** — a favourites/library, NOT draw.io's drag-here holding pen |
| 3 | **Custom element**: a **separate personal library** reusable across boards (Excalidraw's model), not stored per-board |
| 4 | Shape source must be **flexible — "like Excalidraw allows"**: importing user-supplied SVG is in scope |
| 5 | Custom material must **not break the layout** ("không phá layout là chính") |
| 6 | Everything stored **on the local machine** (no backend) |

**Orchestrator verification of the load-bearing source claim** (the one that decides decision 3):
`LIBRARY_DISABLED_TYPES = new Set(["iframe", "embeddable", "image"])` confirmed at
`packages/common/src/constants.ts:525` of Excalidraw `master`, and its enforcement read at
`components/LibraryMenu.tsx:97-100`. So Excalidraw's library **excludes raster images** — meaning
Diagram Studio allowing an imported SVG/icon in a favourite is a deliberate improvement over the model,
exactly as cluster 2 argues.

---

## 2. The design that satisfies all six decisions

### 2.1 Left panel = three sections in ONE scroll container (from draw.io, simplified)
Order, top to bottom:
1. **Search field** (omnibox) — draw.io puts it at the top of the panel.
2. **Favourites** — the personal library (decision 2). Flat grid, NOT categorised.
3. **Categories** — collapsible sections of the built-in shapes (decision 1).

Explicitly do NOT copy the `+ More Shapes` 66-entry 5-group dialog — over-engineered for this app's
shape count (cluster 1's own "do not copy" list).

### 2.2 Categories — 8, from the standards' own vocabulary (cluster 3 §2)
`Basic` · `Flowchart` · `Data & storage` · `Architecture` · `C4` · `Entities` · `Groups & boundaries` ·
`Annotations`

- **C4 boundary shapes live in the `C4` category** (Harvey's decision, 2026-09-16). Cluster 3 flagged
  that the sources do not decide this — it is a product choice, now made: keep the C4 vocabulary
  together in one place rather than splitting boundaries into a generic group.

- **Visibility is preset-driven** (cluster 3 §3): a category absent for a preset is genuinely absent;
  one category is expanded by default per preset; the rest start collapsed. This is what stops a
  50–100 item palette from becoming a wall.
- Categories are **metadata on `PaletteItem`** — one shape union stays (the codebase already enforces
  "one union, presets select a subset"). No per-preset shape registries.
- **Rename 5 items to their standard names** (cluster 3 §1.3), keeping the old word in `hint` so
  muscle memory and search still work:
  `Start / End` → **Terminal** · `Subprocess` → **Predefined process** ·
  `Manual step` → **Manual operation** · `Connector` → **On-page connector**.
- **One open question for Harvey** (sources do not decide it): do C4 boundary shapes live in **C4** or
  in **Groups & boundaries**? Cluster 3 flagged it explicitly.

### 2.3 Favourites = a REFERENCE list, not a snapshot (cluster 1 §3 + cluster 2 §1,2)
This is where Harvey's ask diverges from draw.io and the divergence must be documented in code:
- draw.io's scratchpad stores **styled cell snapshots that only exist after being placed on canvas**,
  one flat bucket, autosaved to IndexedDB, and its docs call it "temporary".
- A Diagram Studio favourite must store the **palette identity** (`{shape, colorKey, kind, size}`) so a
  theme change recolours a favourite exactly as it recolours a board, and a favourite can be starred
  **from the palette itself** with no round-trip through the canvas.
- Model it as **plain node/edge payloads, not a new node type** (cluster 2's #1 lesson): a favourite is
  `{id, name, created, nodes:[…], edges:[…]}`. No new renderer needed; the existing colour-key rules
  keep working.

### 2.4 Adding a favourite — copy Excalidraw's pending `+` affordance (cluster 2 §3)
A pulsing `+` tile at the top of the Favourites section while a canvas selection exists. Zero menus,
one button, self-explanatory. (Plus a star/pin on palette items — the part draw.io does not have.)

### 2.5 Persistence — ONE plain JSON file via a dev-server route (cluster 4 §6.1)
`/api/library` mirroring the existing `/api/boards` middleware. Rationale, all cited:
- localStorage is **out** on quota: 5 MiB/origin, stored as UTF-16, synchronous, no locking, and lost
  on "clear browsing data" — and a single real `.excalidrawlib` from the official registry already
  weighs **3.98 MiB** on its own.
- IndexedDB is the documented fallback but its **eviction is all-or-nothing per origin**, so one quota
  squeeze would take the board autosave AND the shared library together.
- A file is the only option that **survives "clear browsing data"** and is **portable** between users.

Four requirements on that store (cluster 4 §6.1):
1. **Atomic write** (temp file + `rename`) — the report notes the CURRENT board writer does
   `writeFileSync` (truncate-first) and is an existing data-loss bug worth fixing in the same pass.
2. **One `.bak` generation** before replacing.
3. **Explicit `version` + migration on read**, following this project's own PACKAGE-M pattern
   ("read the legacy key, never write it back").
4. **Surface write failures** — never fail silently on a library with no server copy.

### 2.6 Custom shape format — versioned envelope + embedded sanitised SVG (cluster 4 §6.2)
Excalidraw's envelope (`type`/`version`/`source`) with draw.io's image-entry payload
(`{title, tags, data, w, h, aspect}`). `w`/`h` are REQUIRED (layout safety), `aspect: "fixed"` prevents
distortion. `svg` inline (not base64), `viewBox` first-class, `colorKey` preserved (the app's
never-store-hex invariant). `.excalidrawlib` byte-compat and draw.io's XML wrapper both rejected, with
reasons.

### 2.7 SVG safety — render as an image + sanitise (cluster 4 §6.3)
The load-bearing rule: **render user SVG in an `<img>`/CSS context**, where the platform disables
JavaScript and external resource loads — restrictions that do NOT apply to `<iframe>/<object>/<embed>`.
Then strip with DOMPurify `USE_PROFILES:{svg:true}` + `FORBID_TAGS/FORBID_ATTR:['style']`, and
additionally strip remote `href`/`xlink:href`, `<foreignObject>` and animation elements. Never
post-process the sanitised output.

### 2.8 Layout safety — clamps, each preventing a named failure (cluster 4 §6.4)
| Failure mode | Clamp | Precedent |
|---|---|---|
| Zero / invisible size | minimum **32 px** | Excalidraw `INVISIBLY_SMALL_ELEMENT_SIZE = 0.1` + `isInvisiblySmallElement` |
| Enormous size | maximum **512 px** | Excalidraw `MAX_LINEAR_PX = 75_000` (last-resort `isDeleted`) |
| Off-grid size | quantise to the grid (pitch is **16**, offered `[8,16,20,32,64]`) | draw.io `snapCellsToGrid` rounds w/h too |
| Distortion | `aspect: "fixed"` on every imported shape | draw.io `aspect="fixed"` vs the unvalidated `aspect="variable"` default |

Quantise at BOTH the store and the resizer so the two cannot drift.

### 2.9 Insert must re-derive geometry, never trust stored coordinates (cluster 2 §4)
Re-centre on the drop point, snap to grid, **re-generate ids**, then select what was inserted. This
satisfies decision 5 **structurally** rather than by validation rules.

### 2.10 Search (cluster 1 §2 + cluster 3 §4)
- Index by **tags/aliases**, not by label alone. Mermaid ships curated aliases
  (`subproc`/`subroutine`/`fr-rect`, `diam`/`decision`/`diamond`/`question`, …) — copying that list is
  free correctness.
- Put the **geometry word in its own searchable field** — users search "hexagon"/"cylinder"/"diamond"
  as often as semantic names.
- Ranking: 6-tier match ladder with VS Code's published weights (prefix 7 / separator 5 / gap −5 /
  skipped char −1 / full-match +2 / permutation −3), tiebreak `length → begin → palette index` (fzf).
- **Search across collapsed/disabled groups and render hits dimmed** — cluster 1 calls this draw.io's
  single best palette idea: a user who collapsed a group still finds its shapes.
- Keep groups rendered-and-hidden (cmdk's behaviour) rather than flattening results.
- Skip the Soundex phonetic tier — cluster 1's own call: lowest value, highest complexity.

### 2.11 Scale handling for "many items" (cluster 2 §6)
4-column grid, scroll-y, ~17-item batches, per-id thumbnail cache. Excalidraw proves a flat, searchable
thumbnail grid scales; its own users are asking for categories as a LATER layer — so v1 ships the
working library, categories are the refinement on top.

### 2.12 Two UI patterns from tldraw, nothing else (cluster 2)
- A "More" trigger whose icon shows the **last-used hidden tool** — self-explanatory overflow.
- **Width-driven overflow with an explicit budget** (`minItems`/`maxItems`/`minSizePx`/`maxSizePx`) so
  the palette never overflows at phone width — this app ships responsive tiers.
- Do NOT copy tldraw's custom-content model: it needs code, has no portable library file, and **throws**
  (`No shape util found for type "X"`) when a document meets an unregistered shape.

---

## 3. Scope boundary for the FIRST implementation pass

Ship the foundation, not all of it at once (the app's own "review-gated passes" rule):
- **In**: `PaletteItem.category` metadata + the 8 categories; collapsible sections with persisted
  collapse state; preset-driven visibility; the standard-name renames; the alias/geometry search fields;
  the Favourites section as a reference list with the pending `+`; `/api/library` with atomic write +
  `.bak` + version; custom-shape import with sanitise + clamps.
- **Deferred**: the full ranked-search ladder (ship plain alias matching first, ranking second), C4
  custom icons, and any taxonomy refinement.

## 4. Open questions — ALL RESOLVED by Harvey (2026-09-16)
1. **C4 boundaries** → in the **`C4`** category (see §2.2). Decided; do not re-open.
2. **Naming a favourite** → **optional on add** (Excalidraw requires a name only for publishing; cluster 2
   recommended prompt-on-export). Confirmed by Harvey: optional.
3. **The 5 standard-name renames** (§2.2) → **approved**. The old word stays in `hint` so search still
   finds it.
