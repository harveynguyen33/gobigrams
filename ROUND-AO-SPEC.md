# ROUND AO — colour cells, missing neutrals, a custom picker, flow-glyph spacing, the selected-edge nub

Base commit: **`e4a3e14`** (branch `main`, clean). Pre-change tree for every negative control: `e4a3e14`.
Evidence base: `ROUND-AO-DIAGNOSIS.md` (the orchestrator's live-headless measurements). Every number
below is read from that file or from the shipped source; none is re-derived here.

Harvey's verbatim items, each with the measured cause in the code.

---

## AO-1 — colour cells smaller, add black/white, add a CUSTOM picker

> *"các ô nên nhỏ lại cho đẹp"* · black/white (normal colours) missing · *"khi chọn custom, nó sẽ dễ dàng cho user"*

Three sub-decisions, each settled here so the coder makes no design call.

### AO-1a — cell size: three columns become six

**CAUSE (measured).** The shared colour row is `div.swatches.swatch3` (`swatchRow`, `src/App.tsx:4168`).
`.swatches.swatch3 { --cell: calc((100% - 14px) / 3) }` (`src/styles.css:2182`) divides the 253px field
into THREE columns, so each cell is `(253 − 14) / 3 ≈ 80px` wide × 26px tall — a wide slab. That is the
whole of "too big". ROUND AG2 chose 3×3 to keep the ninth key from orphaning; the side effect is the slab.

**DECISION.** Six columns, cell ≈ 36 × 26.

- Rename the modifier `.swatches.swatch3` → **`.swatches.swatch6`** and change its arithmetic to
  `--cell: calc((100% - 35px) / 6)` (5 gaps × 7px = 35px). At the 253px field that is
  `(253 − 35) / 6 ≈ 36.3px` — down from 80, near-square against the 26px height. The cell height stays
  `26px` (unchanged). `src/styles.css:2182-2183` is the only block to touch; `.swatches` (line 2124) and
  `.swatch` (line 2125) are NOT touched — they still serve the 5-swatch edge rows and the shape-palette
  rows at their 26px square.
- Rename the ONE consumer: `swatchRow`'s `className="swatches swatch3"` → `"swatches swatch6"`
  (`src/App.tsx:4169`). The name `swatch3` was already load-bearing for "what the row IS" (the AG2 comment
  at 2160 warns against `grid3`); `swatch6` keeps that honesty rather than leaving a lie in the class name.
- **One rule, every row.** This modifier is SHARED by all seven `swatchRow` call sites (grep: node Style
  `color` 6388, table `color` 6137, bulk multi-select 6096, Text `text color` 4330, edge `text color`
  5736, `background color` 5750, `stroke color` 5778), so changing the modifier changes every colour row
  at once. That is the point and it is deliberate — say so in the code comment.
- **Tiers need no new breakpoint.** `--cell` is a percentage, so it auto-scales to the tier's field width:
  desktop 253px → ~36px; tablet-portrait drawer (`min(320px, 100% − 56px)`) → wider; phone bottom sheet
  (`width: auto`, up to full-bleed) → wider still. Cells only ever GROW on the compact tiers, never shrink,
  so the touch target stays ≥ 36px everywhere with zero media-query work (house rule: no second breakpoint
  number).
- **Wrap honesty.** With black/white joining the palette (AO-1b) every `swatchRow` renders **11** keys;
  the three literal-legal rows gain a 12th "custom" cell (AO-1c). 12 cells = clean 6×2. The 11-key rows
  (Text `text color`, edge `text color`/`background color`, bulk) wrap **6 + 5** — one full row and a
  near-full second. That is NOT the 2-wide stub ROUND AG2 removed; a five-of-six last row reads as a
  near-full line, not an orphan. Record this trade-off in the comment rather than hiding it.

### AO-1b — the missing neutrals: black and white join `COLOR_KEYS`

**CAUSE (measured).** `COLOR_KEYS` (`src/colors.ts:18`) is nine HUES; `slate` is a blue-grey. There is
genuinely no black and no white. Five theme scopes declare `--c-*` (`src/styles.css` lines 13/70/128/177/226).

**DECISION — black and white are two new `ColorKey`s, declared in ONE scope.**

1. Extend the union and the array (`src/colors.ts:15-20`): add `'black'` and `'white'` → `COLOR_KEYS`
   becomes 11. Add `COLOR_VAR.black = 'var(--c-black)'`, `COLOR_VAR.white = 'var(--c-white)'`.
   `isColorKey` picks them up automatically (it derives from `COLOR_KEYS`); `resolveColor` /
   `resolveColorKey` / `keyForHex` need no change (they are `ColorKey`-generic).
2. Declare the two tokens **once, in the `:root` block** (`src/styles.css:12-68`), NOT in the five
   `[data-theme=…]` blocks: `--c-black: #000000; --c-white: #ffffff;`. They are THEME-INVARIANT by
   definition — black is black in every theme. The cascade is safe because `:root` matches the `<html>`
   element in every theme and no `[data-theme=…]` block re-declares either name, so `:root`'s value is the
   only declaration and wins everywhere.
3. **They JOIN `COLOR_KEYS` — deliberately.** Joining is what makes black/white "normal colours": they
   appear on every colour row (node, edge stroke, Text, edge label text/background, table, bulk) and in
   the palette's shape previews, all through the one `COLOR_KEYS.map`. The "smaller list" alternative
   (two special-cased cells) would need a second storage mechanism for zero benefit. Stored symbolically
   (`colorKey: 'black'`), they survive a theme change exactly like the other nine.
4. **`LEGACY_HEX` and `keyForHex` are UNCHANGED.** Only the six ORIGINAL hexes ever shipped; no board
   carries a `#000000`/`#ffffff` literal that must map back, and neither hex belongs to the legacy six.
   Do not add them.
5. **Honest consequence, stated in the code comment:** a `#000000` node is invisible on the dark canvas
   and a `#ffffff` node on the light/paper canvas. That is inherent to a theme-invariant black/white and
   is the user's choice — do NOT "fix" it by tinting either token (that breaks theme-invariance).

**Hex ratchet.** 2 new hex declarations → **144** today (ceiling 160). Report before/after in the commit.

### AO-1c — the custom picker: a native input under a styled trigger

**ESTABLISHED FACTS (from the diagnosis).** `data.color` (node) and `data.strokeKey`/`data.color` (edge)
already accept a literal hex; `resolveColor` returns the literal when present and no symbolic key wins
(`src/colors.ts:68`); `resolveColorKey` maps a literal back only through the six-value `LEGACY_HEX` and
returns `null` otherwise (`:73-78`); `swatchRow(current, onPick, custom?)` has an unused third parameter
(`src/App.tsx:4168`); there is NO `type="color"` anywhere in `src/`.

**DECISION — a trailing "custom" cell that opens a native `<input type="color">`.**

- **How it is reached.** `swatchRow` renders a trailing 12th cell (after the 11 key swatches) ONLY when the
  caller opts in. Formalise the existing third parameter into `custom?: string` (the current literal, used
  to show "on") plus a new `onCustom?: (hex: string) => void` (or a single `custom?: {value, onPick}`
  object — pick one, but keep `swatchRow(current, onPick)` call-compatible so the non-participating call
  sites stay untouched). The cell shows a styled rainbow/gradient swatch (tokens only — no new hex), and
  when `custom` holds a hex it paints that hex and reads as "on" via the `.on` ring.
- **Native input, styled trigger.** The cell contains an `<input type="color">` positioned `absolute;
  inset: 0; opacity: 0` over the visible swatch. A click/tap anywhere on the cell hits the native input,
  which opens the OS picker (eyedropper + HSV + hex). This is what the mature tools do — Figma, draw.io and
  Excalidraw all sit a native colour input behind a designed trigger rather than building a full HSV wheel —
  and it is the whole answer to "easy for the user": the OS gives the picker for free, and the trigger
  stays finished-looking (Harvey's standing rule against raw browser chrome, `SKILL.md`).
- **Storage.** A chosen hex is stored as the literal on `data.color`, with the symbolic key CLEARED —
  the exact inverse of the existing writes. Node colour row: `update({color: hex, colorKey: undefined})`
  (mirror `update({colorKey: k, color: undefined})` at `src/App.tsx:6388`). Edge stroke: `updateEdge` with
  `style: {stroke: hex}` + `data: {color: hex, strokeKey: undefined}` and both markers recoloured to the
  literal (mirror `edgeColorPatch`'s shape, `src/presets.ts:201`, which today writes `COLOR_VAR[key]` +
  `strokeKey: key`). `resolveColor` already returns the literal; `resolveColorKey` already returns `null`
  for an arbitrary hex — so no key lights up and the custom cell lights up instead.
- **Theme honesty, stated plainly.** A literal cannot follow a theme. Say so in the code: a custom colour
  stays exactly as chosen across a theme switch. The "back to theme colour" path is the eleven hue swatches
  themselves — picking any key clears the literal (`color: undefined`) and re-links to the theme, which is
  already what the existing writers do. No separate "reset" button is needed.
- **Touch.** The native input is the hit target and covers the full cell, so it opens on tablet and phone
  exactly as on desktop; mobile browsers ship a native colour UI. No separate touch code.
- **Which rows get it, which do not.** The picker (and the literal path) land ONLY on the rows where a
  literal is already legal: node Style `color` (`src/App.tsx:6388`), edge `stroke color` (`:5778`), and
  table `color` (`:6137`). The Text-section `text color` (`:4330`), edge `text color` (`:5736`) and
  `background color` (`:5750`), and the bulk multi-select row (`:6096`) do NOT — they store a `ColorKey`
  (`textStyle.colorKey` / `labelTextKey` / `labelBgKey`) with no literal storage path, and bulk custom
  colour is out of scope. They DO gain black/white (AO-1b), just not arbitrary hex. Extending them to a
  literal is a follow-up, not this round.

---

## AO-2 — the flow-glyph row sits 2px under the count/speed row

**CAUSE (measured, live).** The count/speed `.pair` box ends at y=1379 and the `flow glyph` field starts
at y=1379 — a 0px box gap (~2px of ink). `.pair .field { margin: 0 }` (`src/styles.css:1920`, specificity
(0,2,0)) beats `.field { margin-bottom: 13px }` (0,1,0), so the two fields INSIDE the pair correctly lose
their margin — but the `.pair` element itself (`src/styles.css:1919`, `display:flex; gap:8px;
align-items:flex-end`) carries no bottom margin, so it never contributes the section's 13px rhythm back to
the row below it. `.pair` has exactly ONE call site (`src/App.tsx:5958`).

**FIX.** Add `margin-bottom: 13px` to the `.pair` rule at `src/styles.css:1919`.

- The value is 13px — the same rhythm `.field { margin-bottom: 13px }` (line 2110) gives every other row
  in the section, i.e. the 13px the collapsed pair owes the stack (the ROUND AM comment's own intent).
- **Why it cannot leak.** `.pair` has one call site, so the rule reaches exactly one row. `.pair .field
  { margin: 0 }` targets the pair's CHILDREN, not the pair, so it does not touch the pair's own bottom
  margin. No `.field` outside a `.pair` is reachable by either selector, so the section's other rows are
  untouched. Same cascade discipline ROUND AG2/AA used when they measured `.swatches` vs `.insp-seg` gaps.
- Update the ROUND AM comment above the pair (and the block comment in the CSS) to say the pair now pays
  the 13px it owes the stack.

---

## AO-3 — delete the nub on a selected step edge (the empty label box)

**CAUSE (measured, live + source).** It is NOT a marker and NOT a corner artifact. On a selected edge with
no label, two things sit at the midpoint: the round `.edge-bend-handle` (14×14, radius 50%) and, on top of
it and wider, an EMPTY `.edge-label` box (measured 17×5 at one zoom, 25×7 at another) that still carries
`.selected`, so it paints a 1px `--sel` border ~5px out each side of the circle — the "1 điểm nhô ra 2 bên".
The render gate (`src/GoblinEdge.tsx:1044`) is `(shown || editing || d.techn || bendDraggable)`: selecting
an edge turns on `bendDraggable` (`bendActive && !ro && !!selected`, `:396`), the block opens to show the
handle, and the SAME block renders the label `<div>` (`:1078`) UNCONDITIONALLY — so an unlabelled selected
edge gets an empty-but-bordered label. Unselected, the empty box is invisible (no border), which is why it
only appears on selection.

**FIX — guard the label with `hasLabel`; the handle is already independent.**

1. Wrap the label `<div>` (`src/GoblinEdge.tsx:1078`) in `{hasLabel && (…)}`. `hasLabel` already exists at
   `:311` as `!!(shown || editing || d.techn)` — the exact "has something to show" test. The block gate at
   `:1044` stays as-is (`shown || editing || d.techn || bendDraggable`): it must still open for the handle
   alone. The bend handle `{bendDraggable && (…)}` (`:1060`) is untouched — it renders independently and
   keeps working with NO label.
2. **`handleAt` needs NO change.** It already reads `hasLabel ? nudgeAlongPath(…, HANDLE_CLEAR_PX + halfW)
   : {x: labelX, y: labelY}` (`:797`), and `hasLabel` already EXCLUDES `bendDraggable`. So an unlabelled
   selected edge already has `hasLabel === false` and the handle already sits exactly on the path midpoint
   with nothing to avoid. The only defect was the render gate letting the empty label into the DOM — the
   `hasLabel` definition was correct all along. Verify this rather than "fixing" it.
3. **PARITY rule.** An unlabelled edge that is NOT selected must produce the same DOM and the same pixels
   as today. Before and after, unselected → `bendDraggable === false` → the block gate is `hasLabel` (false)
   → nothing renders. Byte-identical. Assert it.
4. **Defensive CSS (do it).** Add `.edge-label:empty { display: none; }` in `src/styles.css` so an empty
   label can never paint again even if a future path re-introduces one. Prove it cannot affect a label that
   HAS text: a text-bearing label has a text-node child and therefore does NOT match `:empty`; an editing
   label has an `<input>` child; a `techn` label has a `<small>` child. The harness asserts
   `el.matches(':empty') === false` for a text-bearing label and that its box renders at full size.

---

## Gates

`npx tsc --noEmit` = 0 · `node ./node_modules/vite/bin/vite.js build` = 0 (this exact command, NOT
`npx vite build`) · hex literals in `src/styles.css` REPORTED before/after — **142 → 144**, ceiling 160 ·
**every** `checks/*.mjs` run BY HAND and green, the touched ones re-run with their full verdict printed ·
every new assertion shown RED on `e4a3e14` (the pinned pre-change commit) before the change — an assertion
that is green on both trees proves nothing · `boards/` untouched (see Data safety) · one commit per item,
commit-as-you-go · comments in ENGLISH, carrying the WHY (the code is this project's design record).

---

## Acceptance criteria (one block per item; every line is harness-assertable, no human)

The environment's headless browser DOES render edges live (the orchestrator measured 11 edges + 10 nodes),
so live-DOM assertions are honest for geometry; source/Node-executed assertions are used for the data model.

### AO-1a — cell size

- `ao1a-1`: `src/styles.css` contains `.swatches.swatch6` and NO `.swatches.swatch3`; its `--cell` is
  `calc((100% - 35px) / 6)`.
- `ao1a-2`: live DOM — a `.swatches.swatch6` cell's `getBoundingClientRect().width` is within 1px of
  `(fieldWidth − 35) / 6` at the desktop tier (measured ≈ 36px), and its height is 26px.
- `ao1a-3`: live DOM — `.swatches.swatch6` lays out 6 cells per row (first-row cell count === 6).
- `ao1a-4`: live DOM — the BASE `.swatches` (a 5-swatch edge row) still measures 26×26 per `.swatch`,
  proving the modifier change did not leak into the shared `.swatches`/`.swatch` base.
- `ao1a-5`: negative control — the assertion that `--cell` is `calc((100% - 14px)/3)` (the old arithmetic)
  is RED on `e4a3e14`.
- `ao1a-6`: at the tablet (drawer) and phone (bottom sheet) tiers, a `.swatches.swatch6` cell width is
  ≥ 32px (touch target) with no horizontal overflow of the field.

### AO-1b — neutrals

- `ao1b-1`: `src/colors.ts` — `COLOR_KEYS.length === 11` and contains `'black'` and `'white'`;
  `COLOR_VAR.black === 'var(--c-black)'` and `COLOR_VAR.white === 'var(--c-white)'`.
- `ao1b-2`: `src/styles.css` declares `--c-black: #000000` and `--c-white: #ffffff` in the `:root` block
  only — a grep count of `--c-black`/`--c-white` across the five `[data-theme=…]` blocks is 0.
- `ao1b-3`: hex-literal count in `src/styles.css` is 144 (was 142).
- `ao1b-4`: `LEGACY_HEX` still has exactly six entries; `keyForHex('#000000')` and `keyForHex('#ffffff')`
  are `undefined`.
- `ao1b-5`: live DOM — a colour row renders 11 key swatches (black and white present, painted `#000000` /
  `#ffffff`), and the swatch recolours correctly under a theme switch (black/white stay fixed, the nine
  hues follow the theme).
- `ao1b-6`: negative control — `COLOR_KEYS.length === 9` is RED on `e4a3e14`.

### AO-1c — custom picker

- `ao1c-1`: `src/styles.css` (or the component) contains NO new hex for the picker — the trigger is tokens
  only; hex count stays 144.
- `ao1c-2`: live DOM — the node `color` row (`src/App.tsx:6388`) and the edge `stroke color` row (`:5778`)
  each render a 12th "custom" cell containing an `<input type="color">`; the Text `text color` (`:4330`),
  edge `text color` (`:5736`), `background color` (`:5750`) and bulk (`:6096`) rows render NO custom cell
  (11 swatches each).
- `ao1c-3`: driving the custom input to a hex (e.g. `#123456`) writes `data.color === '#123456'` and
  `data.colorKey === undefined` on the node (and `data.color` + `strokeKey: undefined` + `style.stroke`
  on the edge), verified by reading the saved board / the store, not just the DOM.
- `ao1c-4`: after a custom pick, `resolveColorKey(data) === null` (no hue lights) and the custom cell
  carries the `.on` ring and paints the chosen hex.
- `ao1c-5`: picking a hue afterwards clears the literal (`data.color === undefined`) and sets the
  `colorKey` — the "back to theme colour" path.
- `ao1c-6`: a custom literal renders unchanged across a theme switch (the literal is returned verbatim by
  `resolveColor`), asserted at source level.
- `ao1c-7`: negative control — `swatchRow` having a reachable custom cell (or any `type="color"` in
  `src/`) is RED on `e4a3e14`.

### AO-2 — flow-glyph spacing

- `ao2-1`: `src/styles.css` — the `.pair` rule (`:1919`) declares `margin-bottom: 13px`.
- `ao2-2`: live DOM (Flow section expanded, a `dots`/`icon` flow) — the `flow glyph` field's top equals
  the `.pair` box's bottom + 13px (within 1px), i.e. the 0px gap is gone.
- `ao2-3`: cascade proof — computed `margin-bottom` of a `.pair .field` child is still `0px` (the inner
  zero survives), and a sibling `.field` in the same section still reads `13px` (no leak).
- `ao2-4`: negative control — the assertion that `.pair` has `margin-bottom: 0` (implicit) is RED on
  `e4a3e14`.

### AO-3 — no nub on a selected step edge

- `ao3-1`: source — the label `<div>` in `src/GoblinEdge.tsx` (`:1078`) is wrapped in `hasLabel &&`;
  `hasLabel` is still `!!(shown || editing || d.techn)` (`:311`).
- `ao3-2`: live DOM — a selected `step` edge with NO label renders a `.edge-bend-handle` (14×14) and NO
  `.edge-label` in the edge-label layer (the negative control in the diagnosis: before = handle + empty
  label, after = handle only).
- `ao3-3`: live DOM — a selected `step` edge WITH a label renders BOTH the handle and a text-bearing
  `.edge-label`; the label is NOT `:empty` and paints at full size.
- `ao3-4`: parity — an UNSELECTED unlabelled edge produces byte-identical DOM to `e4a3e14` (no handle, no
  label layer).
- `ao3-5`: `src/styles.css` contains `.edge-label:empty { display: none; }`, and a text-bearing label
  asserts `matches(':empty') === false`.
- `ao3-6`: negative control — the assertion "a selected unlabelled edge renders a `.edge-label`" is RED on
  `e4a3e14`.

---

## Data safety

`boards/` is runtime user data and is NEVER test fixture. The orchestrator's probe board
**`boards/mubyomfsd401e1f5.json` MUST be deleted** as part of closing this round (it is the diagnosis's
synthetic step-edge board, not Harvey's). Harvey's six boards must be byte-identical after: snapshot a
`sha256sum` of every board in `boards/` (excluding `mubyomfsd401e1f5.json` and `library.json*`) BEFORE any
probe, re-hash after, and require equality. `library.json` / `library.json.bak` are the shape library, not
fixture either — leave them untouched. Unmount the browser tab (`goto_url('about:blank')`) before any
restore so the live autosave cannot clobber it. No board may be copied as a baseline over a live board.

---

## Not in scope

- Extending a LITERAL (custom hex) path to the Text-section `text color` (`textStyle.colorKey`), the edge
  label `text color` / `background color` (`labelTextKey` / `labelBgKey`), or the bulk multi-select row —
  those stay `ColorKey`-only this round (they gain black/white via AO-1b, not arbitrary hex).
- A fully custom in-app HSV/eyedropper colour wheel (the native input is the picker; a custom wheel is its
  own round).
- The invisibility of a `#000000` node on the dark canvas / `#ffffff` on light — accepted as the honest
  consequence of theme-invariant neutrals; not "fixed" by tinting.
- Any change to `.swatches` / `.swatch` base (the 5-swatch and shape-palette rows) — those stay 26px.
- Any new responsive breakpoint (the percentage `--cell` scales on its own).

### Decisions deliberately left to the coder (mechanical, not design)

- The exact TypeScript shape of `swatchRow`'s opt-in custom parameter (`{value, onPick}` object vs two
  added params) — keep `swatchRow(current, onPick)` call-compatible so the four non-participating call
  sites stay untouched.
- The internal composition of the styled custom-cell trigger (gradient vs glyph), so long as it is tokens
  only and carries `aria-label` "Custom colour".
- The exact `edgeColorPatch`-shaped patch for an edge literal (which keys to write and clear), within the
  storage contract stated in AO-1c.
