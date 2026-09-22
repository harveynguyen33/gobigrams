# ROUND AO — ORCHESTRATOR DIAGNOSIS (measured evidence, pre-spec)

All numbers below were measured by the orchestrator in a LIVE headless browser against the
running dev server (`http://192.168.33.200:5200/`), on a purpose-built probe board, or by
reading the shipped source. This file is EVIDENCE, not a spec — the spec is written from it.

**Head at diagnosis time:** `e4a3e14` (branch `main`, clean, pushed).

---

## Harvey's four items (verbatim)

1. Colors: cells too big; looks like black/white (normal colours) are missing; add a CUSTOM
   colour picker that is easy to use.
2. Flow glyph row is too close to the Count/Speed row above it — needs proper spacing.
3. On a `step` edge, when selected, there is a point in the middle that sticks out on both
   sides instead of just a circle => looks ugly, delete it.

(Item 2 in Harvey's message is the flow-glyph spacing; his numbering also covers the custom
picker under item 1.)

---

## AO-1 — Colour cells are 80px wide, and there is no black/white

### Measured

The shared colour row is `div.swatches.swatch3` (`src/App.tsx`, `swatchRow`). Live geometry
of its cells, and of the only other `swatch3` consumer (node Style section):

```
rowCls: "swatches swatch3"   row width 253px   row height 92px   gap 7px
  cell .swatch  w=80  h=26  (x9, laid out 3 x 3)
rowCls: "swatches swatch3"   (stroke color row, same geometry)
  cell .swatch  w=80  h=26  (x9)
```

So each colour cell is **80 x 26** — a wide slab, which is what Harvey means by "các ô nên
nhỏ lại cho đẹp". The 80px is by construction: `.swatches.swatch3 { --cell: calc((100% - 14px)
/ 3); }` (`src/styles.css`) divides the 253px field into THREE columns, so each cell is a
third of the panel. ROUND AG2 chose 3 x 3 to make the ninth key stop orphaning; the side
effect is a very wide cell.

### The palette is NINE symbolic keys, and none of them is black or white

`src/colors.ts`:

```
COLOR_KEYS = ['accent','green','cyan','violet','amber','slate','red','blue','pink']
COLOR_VAR  = each -> var(--c-<key>)
```

Five theme scopes declare `--c-*` in `src/styles.css`: `:root,[data-theme="dark"]` (line 13),
`[data-theme="light"]` (70), `[data-theme="paper"]` (128), `[data-theme="midnight"]` (177),
`[data-theme="contrast"]` (226). Every key is a HUE; `slate` is the nearest to a neutral and
it is a blue-grey. So there is genuinely no black and no white — the report is correct.

### The custom-colour escape hatch EXISTS in the data model and has NO UI

`src/colors.ts`:

```
export type Colored = {colorKey?: ColorKey; color?: string; strokeKey?: ColorKey};
/** Live render value ... A symbolic key wins over a literal. */
export function resolveColor(d) {
  if (isColorKey(d.colorKey)) return COLOR_VAR[d.colorKey];
  if (isColorKey(d.strokeKey)) return COLOR_VAR[d.strokeKey];
  if (typeof d.color === 'string' && d.color) return d.color;   // <- the literal hex
  return COLOR_VAR.slate;
}
export const keyForHex = (hex) => LEGACY_HEX[hex.trim().toLowerCase()];
```

- `data.color` (node) and `data.strokeKey`/`data.color` (edge) already accept a literal hex.
- `LEGACY_HEX` maps only the six ORIGINAL hex literals back to keys, so `resolveColorKey`
  (`keyForHex(d.color) ?? null`) returns `null` for an arbitrary hex — which is exactly what
  `swatchRow(current: ColorKey | null, ...)` already accepts as "nothing is on".
- `swatchRow` has a THIRD parameter, `custom?: string`, that is **never passed at any of its
  seven call sites** (grep). It is a leftover hook for a custom colour that was never built.
- There is **no `type="color"` input anywhere in `src/`** (grep returns nothing).

So the panel renders nine symbolic hues, offers no neutral, and the documented "custom…"
escape hatch in the colour model is unreachable from the UI. This is the seventh shape of
the project's recurring "capability exists but is never surfaced" defect class.

### Hex ratchet

`grep -oE '#[0-9a-fA-F]{3,8}\b' src/styles.css | wc -l` => **142** (ceiling 160).

Adding a black and a white token means 2 new hex declarations. They are THEME-INVARIANT
(black is black in every theme), so they belong in ONE scope (the `:root` block), not five.
Budget after: 144/160.

---

## AO-2 — the flow glyph row sits 2px under the count/speed row

### Measured (live, Flow animation section expanded)

The section's rows, in DOM order, with their real box geometry:

```
field  "flow"        top=1268  h=48   (its .chips at top=1286, h=30)     mb=13px
pair   (count/speed) top=1329  h=50   mb=0px                             <-- NO margin
  field "count"      top=1329  h=50
  field "speed"      top=1331  h=48
field  "flow glyph"  top=1379  h=48   (its .chips at top=1397, h=30)     mb=13px
```

Arithmetic: the count/speed `pair` box ends at 1329 + 50 = **1379**. The `flow glyph` field
starts at **1379**. Gap = **0px between the boxes**. Counting the ink (the `pair`'s content
bottom vs the glyph row's label top) the visual gap is about **2px**.

### Root cause

The `pair` is the ONLY consumer of a wrapper that does NOT carry the section's 13px rhythm.
The rule is `src/styles.css`:

```
.pair { display: flex; gap: 8px; align-items: flex-end; }
.pair .field { margin: 0; }      <-- the ONLY .pair call site, line 5958 in src/App.tsx
.pair .grow { flex: 1; min-width: 0; }
```

`.pair .field { margin: 0 }` is (0,2,0): it beats `.field { margin-bottom: 13px }` (0,1,0), so
every field INSIDE the pair loses its margin — which is correct, the pair supplies its own
layout. But the `pair` ELEMENT ITSELF never gets a bottom margin back, so it does not
participate in the section's stacking rhythm at all: `gap: 8px` + margins elsewhere, and this
one row opts out of both.

Every other row in the section (and in the panel) is a `.field` with `margin-bottom: 13px`.

The ROUND AM comment above the pair is aware of the intent ("Two rows of ~50px collapse into
one of ~44px") but the row that follows it was never given the 13px the collapsed pair owes
the stack.

### Fix shape (for the spec to decide)

Give the `pair` the same bottom rhythm the fields it replaces would have contributed. Because
`.pair .field` is zeroed inside, the margin must live on `.pair` itself and must not be
reachable by `.pair .field`'s rule. Note `.pair` has exactly ONE call site, so a rule here
cannot regress anything else — but the margin must be scoped so it cannot be inherited into
the section's other rows.

---

## AO-3 — the "nub" on a selected step edge is the EMPTY LABEL BOX

This is the item Harvey asked to delete, and the diagnosis contradicts the obvious reading.
It is NOT a stray marker, and it is NOT a corner artifact.

### Measured — a probe board with one `step` edge (no label), selected

The edge's own SVG children, and the edge-label layer, at the path's midpoint:

```
=== SVG children of the selected edge ===
  path.react-flow__edge-path          stroke=rgb(37,99,235)  sw=1.8px   d=M195 186L195 206L195 250L195 250L195 294L195 314
  path.react-flow__edge-interaction   stroke=none            sw=26px    (the hit target)
  path.edge-sel-core                  stroke=rgb(71,85,105)  sw=1.1px   (the authored-colour core)
  circle.react-flow__edgeupdater      r=14  stroke=transparent fill=transparent   (x2, at the ENDS)

=== .react-flow__edgelabel-renderer children (the DOM overlay) ===
  div.edge-bend-handle                       w=14  h=14  radius=50%    bg=rgb(37,99,235)   border=2px solid rgb(37,99,235)
  div.edge-label.lb-none.selected            w=17  h=5   radius=5px    bg=transparent      border=1px solid rgb(37,99,235)
```

There is **no circle painted in the middle by the renderer**. The only round thing is
`.edge-bend-handle` (14 x 14, `border-radius: 50%`) — and sitting on top of it, wider, is an
**empty `.edge-label` box** whose height collapses to 5px because it has no text, but whose
width has a floor of 17px (`padding: 1px 6px` + 2 x 1px border + the layout). Measured at
another zoom: the label box was **25 x 7** against the same 14 x 14 circle.

So the artifact Harvey sees is a **1px `--sel`-coloured border of a 17-25px wide box sticking
out ~5px on each side of a 14px circle**, at the exact midpoint. That is the "1 điểm nhô ra 2
bên thay vì vòng tròn only".

### Why the empty box exists at all

`src/GoblinEdge.tsx`:

```
{(shown || editing || d.techn || bendDraggable) && (
  <EdgeLabelRenderer>
    ... bend handle ...
    <div className={`edge-label ${labelBgClass(d.labelBg)}${selected ? ' selected' : ''}...`}>
      {editing ? <input .../> : <>{shown}{d.techn && <small .../>}</>}
    </div>
  </EdgeLabelRenderer>
)}
```

The gate is `bendDraggable` as well as `shown`: selecting an edge reveals the bend HANDLE, and
the same block unconditionally renders the LABEL. With `shown` empty and no `d.techn`, the
label renders as an empty div — but it still carries `.selected`, so it paints the `--sel`
border. On a NON-selected edge the empty box is invisible (no border, transparent background),
which is why the artifact only appears **when the edge is selected**, matching Harvey's report.

This is the same class of defect ROUND AN's AN-6a fixed: a selection style making an
invisible element visible.

### The negative control that proves it (orchestrator, live DOM)

Selecting a `step` edge with no label, then hiding ONLY the empty label box, live:

```
before: ["edge-bend-handle 14x14 border=2px", "edge-label lb-none selected 17x5 border=1px"]
after : ["edge-bend-handle 14x14 display=block", "edge-label lb-none selected 0x0 display=none"]
```

With the label hidden there is exactly ONE thing left at the midpoint — the circle. That is the
picture Harvey asked for ("vòng tròn only"), and it confirms the bordered empty box is the whole of
the artifact: no marker, no corner geometry, nothing else is involved.

### Fix shape (for the spec to decide)

The label should only be in the DOM when it has something to show (text, `techn`, or the open
editor). The bend handle must keep working with no label — it is the thing that must remain
when an unlabelled edge is selected. Also decide the `handleAt` nudge: it currently offsets
the handle along the path when `hasLabel` (`HANDLE_CLEAR_PX + halfW`), and if the label is no
longer rendered the nudge would move a handle that no longer needs to avoid anything — i.e.
an unlabelled selected edge's handle should sit exactly on the path midpoint (which is what
it already does when `hasLabel` is false; the change is what `hasLabel` should mean).

---

## Verification constraints for the round (project law)

- Gates: `npx tsc --noEmit` = 0 errors · `node ./node_modules/vite/bin/vite.js build` = 0 ·
  hex literal count in `src/styles.css` must be REPORTED before/after (142 today, ceiling 160).
- Run EVERY harness BY HAND after the change (`for f in checks/*.mjs; do node $f ...`); a sweep
  can print green while one is red. Re-run the harnesses you touch and print their verdicts.
- Every new assertion must be shown RED on the pre-change tree (pinned commit) or it proves
  nothing.
- `boards/` is runtime user data — it is NEVER test fixture. The orchestrator's probe board
  (`mubyomfsd401e1f5`) was created for this diagnosis and MUST be deleted before the round
  closes; Harvey's six boards must be byte-identical after.
- The dev server is already running. It is the app's server; do not start another.
- Headless CAN render edges in this environment (11 edges + 10 nodes measured), so a LIVE DOM
  assertion is possible for the panel geometry — the round should use it where it can.
- Comments in ENGLISH, writing the WHY — comments are this codebase's design record.

## Honest limits of this diagnosis

- The probe board is synthetic (2-4 nodes); Harvey's own boards carry no `step` edge at all
  (32 `smoothstep`, 4 `goblinEdge`, 1 `straight`), so the step geometry was measured on a
  purpose-built document rather than one he drew.
- The custom-colour UX (item 1c) is a DESIGN decision, not a diagnosis; this file only
  establishes that the data model already accepts a literal and no UI reaches it.
