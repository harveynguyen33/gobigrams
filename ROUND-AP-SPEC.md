# ROUND-AP-SPEC — design polish + BN-01 narrowing

Base: `5a5466f` (gobstack install, verify 22/0/5). Orchestrator-measured findings
2026-10-12, all from the design-review pass (every number below was measured, not felt).

## AP-1 — `--dim2` no longer paints real text (contrast)

Measured: `--dim2` (#63636b) on `--surface` (#131316) = **3.12:1** — below the 4.5:1
body-text bar, and it was painting REAL text (not placeholders):

- `.lib-cat-n` (category count badge) — styles.css ~716
- the library empty-category line (12px text) — ~698
- `.settings-state.off` — ~3667

**Fix:** those three switch to `var(--dim)` (5.41:1 on surface — PASS). Placeholders
(`.lib-search-input::placeholder`, `.tcol-type::placeholder`), disabled states
(`.insp-step-btn:disabled`) and the non-text 1.5px border (3469) KEEP `--dim2` —
placeholders and disabled controls are exempt from 4.5:1; a border needs only 3:1.

Hex ratchet: no hex added or removed — value swaps only. Count stays 144.

## AP-2 — hit targets reach 24px

Measured: `.fav-remove` = **16×16px**, `.pal-star` = **22×22px** — both under the 24px
minimum for a clickable target. The receiving element grows, not the glyph:

- `.fav-remove`: 16→24px box, `top:-4px; right:-4px` so the visual anchor is unchanged;
  glyph stays 11px.
- `.pal-star`: 22→24px; glyph stays 14px.

Both must survive the palette/library harnesses (geometry probes re-run below).

## AP-3 — BN-01 exempt retired (the `any` sites narrowed)

The install carried a day-one exempt: 4 files with pre-existing `any` sites. This round
narrows them and DELETES the exempt line:

- `catch (err: any)` → `catch (err)` with `err instanceof Error ? err.message : String(err)`
  at the use site (or `unknown` + narrow where the error object is inspected).
- `library.ts` `nodes: any[]/edges: any[]` → the react-flow `Node[]/Edge[]` types.
- `presets.ts` `markerEnd?: any` → xyflow's `EdgeMarker`; `const patch: any` → `EdgeStylePatch`-shaped local type.
- `Tooltip.tsx` `React.ReactElement<any>` → `React.ReactElement<Record<string, unknown>>`.
- `App.tsx` one-offs (`connectionState`, `out`, `fav.nodes as any[]`, `(n: any)` predicates) → real types or `unknown` + predicate.

Gate after: `tsc --noEmit` + `vite build` = 0, `goblin-bans` BN-01 PASS with an EMPTY
exempt, behaviour unchanged (no logic edits — types only, plus AP-1/AP-2 which are CSS).

## Out of scope (deferred, stated)

- **Font-scale consolidation** (16 distinct sizes → ~8): every change moves real pixels
  across 5013 lines of CSS and several harnesses pin exact sizes. Its own round with a
  device test — not bundled here.
- Spacing scale (25 distinct values) — same reasoning, rides with the font round.

## Verification

1. `npx tsc --noEmit && npx vite build` → 0
2. `.gob/bin/goblin-verify` → 22/0/5 with `bans_exempt:` EMPTY
3. Harnesses re-run by hand: `round-ag-colors.mjs`, `round-ag2-copy-sub-swatch.mjs`,
   `round-ao-colour-and-nub.mjs`, `package-n` / library harnesses, `package-r-roadmap.mjs`
   (hex ratchet 144), `theme-boot-sync.mjs`
4. Demo board `boards/mu01q1ue3a854b81.json` byte-identical before == after
