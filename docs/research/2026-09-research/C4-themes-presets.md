# Theming, diagram-type presets, the remaining diagram families, and C4

**Cluster:** THEMING + PRESET SYSTEM + remaining diagram families + C4 model
**Target:** `/home/harvey/projects/tech-goblin/lab/diagram-studio` (React 19 + Vite 5 + `@xyflow/react` 12.11.6 + lucide-react + html-to-image)
**Date:** 2026-09-14 · Research only — no project code was modified.

**Method / evidence base.** Everything about *our* app is cited to a file:line in the real
source I read. Everything about React Flow is cited both to the docs URL **and** to the
installed package inside the project (`node_modules/@xyflow/react/dist/...`), because the
installed build is the ground truth for what the prop actually does. Nothing was cloned to
disk — I read individual files over `raw.githubusercontent.com` / the GitHub trees API and
the npm registry. `/tmp` usage peaked at 146 MB (five GitHub tree-listing JSONs, one 57 KB
SCSS file); `df -h /` before = 29G/96G used, after = 29G/96G used. No GB-scale clone
happened, so no escalation was needed. Temp files are listed at the end for deletion.

---

## 0. The one-paragraph answer

React Flow's `colorMode` prop is **necessary but not sufficient**: it toggles ~24 internal
`--xy-*-default` CSS variables and nothing of ours. Diagram Studio's light mode therefore
hinges on two separate changes — (a) a token refactor of `src/styles.css` plus ~15 hard-coded
colours scattered across CSS/TSX, and (b) **making node/edge colours symbolic instead of
literal**, because today each node stores its accent as a hex string inside `data.color`
(verified in a real saved board) and no theme can ever recolour that. Once (b) is done,
`colorMode` + a `data-theme` attribute covers it. Separately: React Flow ships **no**
diagram-type preset system at all — 67 example pages, zero ERD/mindmap/sequence presets — so
the preset system is ours to design, and the good news is that the *C4 model* is by far the
best-fit extra diagram type, because Diagram Studio already has 8 of the 9 C4 primitives.

---

# A. THEMING — light / dark / system / more

## A.1 The exact `colorMode` mechanism (verified against the installed build, not just docs)

**The prop.** `<ReactFlow colorMode>` — type `ColorMode = 'light' | 'dark' | 'system'`;
**default is `'light'`**, not `'system'`.
- Docs: https://reactflow.dev/learn/customization/theming ("You can choose one of the built-in color modes by using the `colorMode` prop ('dark', 'light' or 'system')"), https://reactflow.dev/api-reference/react-flow#colormode (`colorMode | ColorMode | Controls color scheme used for styling the flow. | 'light'`), https://reactflow.dev/api-reference/types/color-mode (`export type ColorMode = 'light' | 'dark' | 'system';`), https://reactflow.dev/examples/styling/dark-mode.
- Installed proof of the default: `node_modules/@xyflow/react/dist/esm/index.js:3767` — `... height, colorMode = 'light', debug, onScroll, ...`.

**What it does internally.** Two things, both tiny:

1. `useColorModeClass(colorMode)` — `node_modules/@xyflow/react/dist/esm/index.js:344-359`:
   ```js
   function useColorModeClass(colorMode) {
     const [colorModeClass, setColorModeClass] = useState(colorMode === 'system' ? null : colorMode);
     useEffect(() => {
       if (colorMode !== 'system') { setColorModeClass(colorMode); return; }
       const mediaQuery = getMediaQuery();                       // window.matchMedia('(prefers-color-scheme: dark)')
       const updateColorModeClass = () => setColorModeClass(mediaQuery?.matches ? 'dark' : 'light');
       updateColorModeClass();
       mediaQuery?.addEventListener('change', updateColorModeClass);
       ...
     }, [colorMode]);
     return colorModeClass !== null ? colorModeClass : getMediaQuery()?.matches ? 'dark' : 'light';
   }
   ```
   `getMediaQuery()` is at `index.js:336`.

2. It appends that resolved value as a class on the **root `div` of the React Flow wrapper** —
   `index.js:3775`: `className: cc(['react-flow', className, colorModeClassName])`. So the DOM
   becomes `<div class="react-flow ds-flow-wrap dark">` (our `ds-flow-wrap` class is passed via
   `className` at `src/App.tsx:1735-1739`).

3. The stylesheet `.react-flow.dark { ... }` re-declares the internal variable set:
   `node_modules/@xyflow/react/dist/style.css:53-97` (dark) vs `:3-52` (light defaults). Notably
   `--xy-edge-stroke-default` `#b1b1b7` → `#3e3e3e`, `--xy-minimap-background-color-default`
   `#fff` → `#141414`, `--xy-background-pattern-dots-color-default` `#91919a` → `#555`,
   `--xy-controls-button-background-color-default` `#fefefe` → `#2b2b2b`,
   `--xy-edge-label-background-color-default` `#ffffff` → `#141414`,
   `--xy-background-color-default` `transparent` → `#141414`.

**The three limitations that matter for us.** These are the reason "just add the prop" is not
the answer:

- **It never writes `data-theme` or any attribute to `document`.** It only returns a *class
  string* for the RF wrapper div. Our own CSS cannot key off "what mode RF thinks it is" unless
  we duplicate the resolution ourselves. (Verified by reading the whole hook, above.)
- **It only themes React Flow's own chrome** — the background pattern, the minimap, the zoom
  `Controls`, the built-in node border/background, the selection rectangle, the default handle
  and the default arrowhead colour. `src/shapes.tsx`, `src/DiagramNode.tsx`,
  `src/GoblinEdge.tsx` and the whole 986-line `src/styles.css` are **ours** and are untouched by
  it. The docs are explicit that you use the class yourself: "When you use the `colorMode` prop,
  React Flow adds a class to the root element (`.react-flow`) that you can use to style your
  flow based on the color mode: `.dark .react-flow__node { ... }`".
- **The arrowhead default only fires when you don't pass a marker colour.** `style.css:193-198`:
  `.react-flow__arrowhead polyline { stroke: var(--xy-edge-stroke, var(--xy-edge-stroke-default)); }`.
  Our edges always pass an explicit `markerEnd: {type, color}` (e.g. `src/App.tsx:57-58, 772, 886, 912`),
  so `colorMode` will **not** recolour our arrows — the edge data will.

## A.2 What is hard-coded today — the full audit

### A.2.1 The token block is small and incomplete

`src/styles.css:3-18` — 14 variables, dark only:

```
--bg #0b0b0d · --surface #131316 · --elevated #1a1b1f · --border #26272c · --border-strong #33343a
--fg #e8e8ea · --dim #8a8a92 · --acc #f54e00 · --acc-soft rgba(245,78,0,.12)
--sel #3b82f6 · --sel-soft rgba(59,130,246,.14) · --green #4ade80 · --mono … · --sans …
```

There is **no** token for: canvas background gradient, panel/toolbar translucency, shadow
strength, overlay/scrim, scrollbar hover, danger/error, the six per-shape accent colours,
edge default stroke, minimap mask, or the export background. Every one of those is a literal.

### A.2.2 Literal colours outside the token block (file:line)

| Where | Literal(s) | What it is |
|---|---|---|
| `styles.css:99` | `#43444a` | scrollbar thumb hover |
| `styles.css:104` | `rgba(245,78,0,0.06)` | canvas radial "brand glow" |
| `styles.css:134`, `:575`, `:764` | `rgba(19,19,22,0.86)` / `.92` | toolbar + popover + toast translucency (hard-coded dark surface → **will look wrong in light**) |
| `styles.css:206-207`, `:755-756` | `#fff`, `#ff5f12`, `#ff6a26` | CTA text + hover on `--acc` |
| `styles.css:490` | `#1a1b1f` | `react-flow__edge-textbg` fill — **overrides** `:315`'s `var(--surface)` because it comes later |
| `styles.css:497` | `rgba(11,11,13,0.45)` | search-palette scrim |
| `styles.css:647` | `#ef4444` | save-error text |
| `styles.css:669`, `:693` | `rgba(245,78,0,0.12)` | danger hover tint |
| `styles.css:807` | `#0b0b0d` | checklist-tick foreground on `--green` |
| `styles.css:858-859` | `rgba(59,130,246,.8/.2)` | `ds-node-pulse` outline keyframes — **duplicates** `--sel` as a literal so it will not follow a theme that changes `--sel` |
| `styles.css:913` | `color-mix(… 55%, #fff)` | glow-handle gradient highlight — assumes dark |
| `styles.css:934`, `:941`, `:975` + ~9 more | `rgba(0,0,0,.2 … .85)` | shadows — invisible-ish in light mode; light themes need a different shadow model, not just a colour swap |
| `styles.css:621` | `opacity: 1.6` | (latent bug — invalid opacity, snaps nothing) |
| `shapes.tsx:29`, `:35`, `:56-57`, `:64-70`, `:76-77` | `#33343a` ×14 | `var(--nc, #33343a)` fallback in the SVG shape frames |
| `palette.ts:6-11` | `#f54e00 #4ade80 #22d3ee #a78bfa #fbbf24 #94a3b8` | **the six shape accents** — see A.3, this is the hard one |
| `GoblinEdge.tsx:132` | `#94a3b8` | fallback edge stroke |
| `GoblinEdge.tsx:155` | `var(--card, var(--bg))` | `--card` is **never declared anywhere** (verified: only `--bg --surface --elevated --border --border-strong --fg --dim --acc --acc-soft --sel --sel-soft --green --mono --sans` exist) — the envelope flap silently falls back to `--bg` |
| `App.tsx:1241` | `#0b0b0d` | SVG-export background rect |
| `App.tsx:1245-1247` | `#8a8a92`, `#e8e8ea` | SVG-export inline `<style>` for kicker/sub/title |
| `App.tsx:1292` | `#0b0b0d` | PNG-export `backgroundColor` |
| `App.tsx:1790` | `rgba(255,255,255,0.07)` | `<Background color>` dots |
| `App.tsx:1828` | `rgba(11,11,13,0.7)` | MiniMap `maskColor` |
| `App.tsx:1829` | `#333` | MiniMap node-colour fallback |
| `App.tsx:57-58, 88, 772, 886, 912, 1371` | `COLORS.slate` / `COLORS.accent` | **default edge colour written into edge `style.stroke` and `markerEnd.color`** |

### A.2.3 The actual blocker: colours are stored as DATA

A real saved board (`boards/mu01q1ue3a854b81.json`, "Kafka rebalance") contains:

```json
{ "type": "goblin", "data": { "shape": "external", …, "color": "#f54e00" } }
```

and its edges store `"style": { "stroke": "#94a3b8" }, "markerEnd": { "type": "arrowclosed", "color": "#94a3b8", … }`.
`palette.ts:29-30` builds nodes with `color` baked in; `DiagramNode.tsx:122/141/160` sets
`style={{'--nc': d.color}}`. Consequences:

- Node/edge colour is **per-node user data**, editable through the inspector swatch row
  (`App.tsx:1391-1402` iterates `Object.values(COLORS)`).
- Any theme that changes the six accents would leave every existing node at its old literal hex.
- `shapes.tsx` derives the whole node (outline, icon tint, metric) from `--nc`, so there is exactly
  one place to fix per node — `--nc` — but its *value* comes from data.

**Design decision taken below:** keep literals for genuine user-chosen custom colours, and add a
*symbolic key* alongside, resolved at render time. That is the only change that lets a theme
recolour existing boards without touching the nine shapes.

## A.3 The mechanism to add light/dark/system + more, concretely

### Step 1 — Two-layer tokens in `src/styles.css`

```css
/* Layer 1 — semantic tokens, per theme. Only these are themed. */
:root,[data-theme="dark"]{ --bg:#0b0b0d; --surface:#131316; --elevated:#1a1b1f;
  --border:#26272c; --border-strong:#33343a; --fg:#e8e8ea; --dim:#8a8a92;
  --acc:#f54e00; --acc-soft:color-mix(in srgb, var(--acc) 12%, transparent);
  --sel:#3b82f6; --sel-soft:color-mix(in srgb, var(--sel) 14%, transparent);
  --green:#4ade80;
  /* + the new ones: */
  --canvas-glow:rgba(245,78,0,.06); --panel-glass:rgba(19,19,22,.86);
  --scrim:rgba(11,11,13,.45); --minimap-mask:rgba(11,11,13,.7);
  --dots:rgba(255,255,255,.07); --shadow:rgba(0,0,0,.6); --danger:#ef4444;
  --on-acc:#fff; --on-acc-hover:#ff5f12; --edge-text-bg:#1a1b1f; --scroll-hover:#43444a;
  /* Layer 2 — the six shape accents, symbolic: */
  --c-accent:#f54e00; --c-green:#4ade80; --c-cyan:#22d3ee; --c-violet:#a78bfa;
  --c-amber:#fbbf24; --c-slate:#94a3b8;
}
[data-theme="light"]{ … }        /* table in A.4 */
[data-theme="paper"]{ … }
[data-theme="midnight"]{ … }
[data-theme="contrast"]{ … }
```
Then delete every literal in the A.2.2 table in favour of the token. The two real edits inside
`styles.css` are `#490` (edge-textbg) and the `ds-node-pulse` keyframes (`rgba(59,130,246,…)` →
`color-mix(in srgb, var(--sel) 80%/20%, transparent)`).

### Step 2 — The theme controller (ChartDB is the reference implementation)

ChartDB does exactly this and is only 3 small files; I read them all:
`src/context/theme-context/theme-provider.tsx`, `theme-context.tsx`, `src/hooks/use-theme.ts`,
`src/context/local-config-context/local-config-provider.tsx` (all
`raw.githubusercontent.com/chartdb/chartdb/main/...`).
- `theme: 'light'|'dark'|'system'` persisted in **localStorage key `theme`**, default `'system'`.
- `effectiveTheme = theme === 'system' ? (prefers-color-scheme:dark ? 'dark':'light') : theme`
  via `react-responsive`'s `useMediaQuery`.
- `document.documentElement.classList.add/remove('dark')` — Tailwind's `darkMode: ['class']`.
- `<ReactFlow colorMode={effectiveTheme}>` at `src/pages/editor-page/canvas/canvas.tsx:1674`.
- A theme hotkey (toggle light/dark) via `react-hotkeys-hook`.

**Apply to Diagram Studio** (`src/theme.ts` + a tiny context, ~60 lines, zero dependencies):

```ts
export type ThemeName = 'dark'|'light'|'paper'|'midnight'|'contrast';
// board-independent UI preference:
export type Mode = 'system'|ThemeName;
export function resolveMode(mode: Mode): ThemeName   // 'system' → matchMedia('(prefers-color-scheme:dark)')
export function applyTheme(t: ThemeName) {
  document.documentElement.dataset.theme = t;                       // drives OUR tokens
  document.documentElement.classList.toggle('dark', t !== 'light' && t !== 'paper'); // drives RF chrome
}
```
…and in `App.tsx` next to the existing `ds-flow-wrap` className (`App.tsx:1735-1739`) add
`colorMode={themeIsDark ? 'dark' : 'light'}`.

Two deliberate choices, both grounded in the code I read:
1. **Resolve `system` ourselves and pass only `'light'`/`'dark'` to `colorMode`.** Because
   `useColorModeClass` returns only a class and writes nothing to `document` (`index.js:344-359`),
   passing `'system'` gives us no hook to drive our own tokens. One resolution, two consumers.
2. **Do not rely on RF's `.dark` class for our own colours.** We only get 24 variables covering
   RF's chrome; ours are keyed off `[data-theme]`. The two are set from the same `applyTheme` call
   so they can never disagree.

### Step 3 — The symbolic-colour refactor (the crux, and it does not touch the 9 shapes)

```ts
// palette.ts
export type ColorKey = 'accent'|'green'|'cyan'|'violet'|'amber'|'slate';
export const COLOR_VAR: Record<ColorKey,string> = {
  accent:'var(--c-accent)', green:'var(--c-green)', cyan:'var(--c-cyan)',
  violet:'var(--c-violet)', amber:'var(--c-amber)', slate:'var(--c-slate)' };
export const LEGACY_HEX: Record<string,ColorKey> = {           // migrate old boards on load
  '#f54e00':'accent', '#4ade80':'green', '#22d3ee':'cyan',
  '#a78bfa':'violet', '#fbbf24':'amber', '#94a3b8':'slate' };
export const resolveColor = (d:{colorKey?:ColorKey; color?:string}) =>
  d.colorKey ? COLOR_VAR[d.colorKey] : (d.color ?? COLOR_VAR.slate);
```
- `NodeKind` gains `colorKey?: ColorKey` (`src/DiagramNode.tsx:17-30`); `DiagramNode` renders
  `style={{'--nc': resolveColor(d)}}` at the three existing sites (`:122`, `:141`, `:160`).
  Because `--nc` is a CSS custom property, `var(--c-cyan)` **cascades from the themed root** and
  every shape frame, icon tint, metric and glow (`styles.css:265-273, 913, 923, 948, 956, 964, 973`)
  follows the theme with no other change. `shapes.tsx` needs **no edit at all** except swapping its
  `var(--nc, #33343a)` fallback to `var(--nc, var(--border-strong))` (14 occurrences).
- Edges: add `strokeKey?: ColorKey` to the edge `data` object (`App.tsx:66-69`) and resolve
  `style.stroke` + `markerEnd.color` at render time (the same helper). `GoblinEdge.tsx:132`'s
  `?? '#94a3b8'` fallback becomes `?? 'var(--c-slate)'`; `:174`'s `drop-shadow(0 0 4px ${stroke})`
  and the `animateMotion` payload fills work unchanged because they already interpolate `stroke`.
- The inspector swatch row (`App.tsx:1391-1402`) becomes colour-**key** swatches drawn with
  `background: var(--c-cyan)` etc., plus a "custom…" hex input that sets `color` (not `colorKey`).
- Board-load migration: one pass over `nodes[].data.color` and `edges[].style.stroke` mapping
  `LEGACY_HEX` → key. Boards saved before the migration keep working; boards saved after carry the
  key. `exportJson`/`importJson` (`App.tsx:1262-1273`, `:1317+`) need no change.

**Why bother:** this is the difference between "light mode recolours the UI" and "light mode
recolours the diagram". It is ~120 lines of diff, spread over `palette.ts`, `DiagramNode.tsx`,
`GoblinEdge.tsx`, `App.tsx` (render + inspector) and zero lines of `shapes.tsx`.

### Step 4 — Exports must read the live theme

`exportSvg` writes `fill="#0b0b0d"` and a hard-coded inline `<style>` (`App.tsx:1241-1250`);
`exportPng` passes `backgroundColor:'#0b0b0d'` (`:1292`). Change both to read
`getComputedStyle(document.documentElement).getPropertyValue('--bg')` (and `--dim`/`--fg`) at
export time so a light-mode board exports on a light background. Also the SVG `<style>` should
include `--nc`-resolved colours — easiest is to keep `var(--nc)` in the serialized DOM and inject
the resolved token values into the exported `<style>` block.

### Step 5 — Optional: stop leaning on RF's `.dark` class

For custom themes (paper/midnight/contrast) `.dark` is either wrong or too coarse. Override the
five `--xy-*` variables we actually use, scoped to our wrapper, from our own tokens:
`--xy-background-pattern-dots-color: var(--dots)`, `--xy-minimap-background-color: var(--surface)`,
`--xy-minimap-mask-background-color: var(--minimap-mask)`,
`--xy-controls-button-background-color: var(--surface)`, `--xy-controls-button-color: var(--dim)`,
`--xy-edge-label-background-color: var(--surface)`. This makes RF's chrome track *any* theme, not
just dark. (Variable names verified in `node_modules/@xyflow/react/dist/style.css:3-97`.)
Note we currently override the minimap/controls by hand anyway (`App.tsx:1827`, `styles.css:109-126`),
so this is mostly de-duplication.

## A.4 Token tables — dark (today, unchanged), light, paper, midnight, high-contrast

Contrast ratios below are **calculated with the WCAG relative-luminance formula** (I ran the
computation; numbers are measured, not eyeballed). Target: ≥4.5 for body text, ≥3.0 for large
text/graphics.

### A.4.1 Surface + text + action tokens

| Token | **dark** (today) | **light** | **paper** (warm) | **midnight** (deep indigo) | **contrast** (WCAG-AAA) |
|---|---|---|---|---|---|
| `--bg` | `#0b0b0d` | `#f7f7f8` | `#f6f1e7` | `#0a0f1e` | `#000000` |
| `--surface` | `#131316` | `#ffffff` | `#fffaf1` | `#121a2e` | `#000000` |
| `--elevated` | `#1a1b1f` | `#f2f2f4` | `#efe8da` | `#18233c` | `#141414` |
| `--border` | `#26272c` | `#e4e4e7` | `#e2d8c6` | `#1e2a45` | `#808080` |
| `--border-strong` | `#33343a` | `#d4d4d8` | `#cfc2ab` | `#2b3a5e` | `#c0c0c0` |
| `--fg` | `#e8e8ea` (15.2 on surface) | `#18181b` (17.7) | `#2b2620` (13.3 on bg) | `#dbe4ff` (15.1) | `#ffffff` (21.0) |
| `--dim` | `#8a8a92` (5.4) | `#52525b` (7.7) | `#7a6f60` (4.4 bg) | `#8b9ac0` (6.8) | `#c8c8c8` |
| `--acc` | `#f54e00` (5.3) | `#c2410c` (5.2) | `#8a2e05` (7.5 bg) | `#ff7a45` (7.4) | `#ffff00` (19.6) |
| `--acc-soft` | 12% `--acc` | 10% `--acc` | 10% `--acc` | 12% `--acc` | 20% `--acc` |
| `--sel` | `#3b82f6` (5.0) | `#2563eb` (5.2) | `#1e3a8a` | `#6c9dff` (7.2) | `#00ffff` (16.8) |
| `--green` | `#4ade80` (10.6) | `#15803d` (5.0) | `#14532d` (8.1 bg) | `#5eead4` (12.9) | `#80ff80` (16.5) |
| `--danger` | `#ef4444` | `#b91c1c` | `#991b1b` | `#ff8a80` | `#ff8080` |
| `--on-acc` | `#fff` | `#fff` | `#fffaf1` | `#0a0f1e` | `#000` |
| `--panel-glass` | `rgba(19,19,22,.86)` | `rgba(255,255,255,.86)` | `rgba(255,250,241,.86)` | `rgba(18,26,46,.88)` | `rgba(0,0,0,.92)` |
| `--scrim` | `rgba(11,11,13,.45)` | `rgba(24,24,27,.28)` | `rgba(43,38,32,.28)` | `rgba(10,15,30,.5)` | `rgba(0,0,0,.6)` |
| `--shadow` | `rgba(0,0,0,.6)` | `rgba(24,24,27,.12)` | `rgba(80,60,30,.14)` | `rgba(0,0,0,.7)` | `rgba(0,0,0,.85)` |
| `--dots` | `rgba(255,255,255,.07)` | `rgba(24,24,27,.10)` | `rgba(80,60,30,.12)` | `rgba(219,228,255,.08)` | `rgba(255,255,255,.25)` |
| `--canvas-glow` | `rgba(245,78,0,.06)` | `rgba(194,65,12,.05)` | `rgba(138,46,5,.05)` | `rgba(255,122,69,.06)` | none |
| `--minimap-mask` | `rgba(11,11,13,.7)` | `rgba(24,24,27,.15)` | `rgba(43,38,32,.16)` | `rgba(10,15,30,.7)` | `rgba(0,0,0,.75)` |
| `--scroll-hover` | `#43444a` | `#a1a1aa` | `#b8ab93` | `#33436b` | `#a0a0a0` |
| `--edge-text-bg` | `#1a1b1f` | `#ffffff` | `#fffaf1` | `#121a2e` | `#000000` |

### A.4.2 The six shape accents (Layer 2) — and why the light column must be *darker inks*

The dark accents are bright; measured on white they fail badly. These are the numbers:

| key | **dark** (as-shipped) | CR on `#fff` | **light** "ink" | CR `#fff` | CR on its own 9 % fill |
|---|---|---|---|---|---|
| `--c-accent` | `#f54e00` | 3.52 ✗ | **`#9a3412`** | 7.31 ✓ | 6.52 |
| `--c-green` | `#4ade80` | 1.74 ✗ | **`#166534`** | 7.13 ✓ | 6.76 |
| `--c-cyan` | `#22d3ee` | 1.81 ✗ | **`#0e7490`** | 5.36 ✓ | 5.04 |
| `--c-violet` | `#a78bfa` | 2.72 ✗ | **`#5b21b6`** | 8.98 ✓ | 8.32 |
| `--c-amber` | `#fbbf24` | 1.67 ✗ | **`#92400e`** | 7.09 ✓ | 6.75 |
| `--c-slate` | `#94a3b8` | 2.56 ✗ | **`#475569`** | 7.58 ✓ | 7.06 |

| key | **paper** | **midnight** | **contrast** |
|---|---|---|---|
| `--c-accent` | `#8a2e05` | `#ff7a45` | `#ffff00` |
| `--c-green` | `#14532d` | `#86efac` | `#80ff80` |
| `--c-cyan` | `#115e59` | `#5eead4` | `#00ffff` |
| `--c-violet` | `#5b21b6` | `#c4b5fd` | `#c0c0ff` |
| `--c-amber` | `#92400e` | `#fcd34d` | `#ffe066` |
| `--c-slate` | `#44403c` | `#94a3b8` | `#c8c8c8` |

Every light/paper/contrast ink was checked against **both** the plain surface **and** its own
alpha-blended node fill (`color-mix(in srgb, var(--nc) 9%, transparent)` over the canvas), because
the metric number and the icon tint sit on the fill, not on the bare canvas. Lowest measured value
in the light column: **5.04** (cyan, `#0e7490`, on its own fill) — comfortably above 4.5.
Dark column lowest on its own fill: **4.87** (`#f54e00`), i.e. the shipped dark theme is already
borderline for the orange accent and that is worth knowing.

Note the *fill* mechanism needs no change: `shapes.tsx:29` `FILL = color-mix(in srgb, var(--nc,#33343a) 9%, transparent)`
already blends against whatever is behind it, so a 9 % tint of a dark ink on a white canvas gives a
soft pastel card automatically (verified: `#f54e00` 9 % on white = `#feefe8`; ink `#9a3412` on that
fill = 6.52).

### A.4.3 Dark themes that don't need the class trick

`midnight` and `contrast` are dark themes, so they can share RF's `.dark` class. `paper` and
`light` are light. So `classList.toggle('dark', isDark(theme))` is enough — no fourth branch.

## A.5 Per-finding verdicts (theming)

| Finding | Verdict | Reason, tied to our code |
|---|---|---|
| `colorMode` prop `'light'\|'dark'\|'system'`, default `'light'` | **ADOPT** | One prop + one class; free correct theming of Background dots, MiniMap, Controls, selection rect, default handles. Must pair with `data-theme` because it writes nothing to `document` (`index.js:344-359`) |
| `colorMode="system"` and let RF resolve it | **SKIP** | We need the resolved value for our own tokens; resolve it ourselves once and pass `'light'`/`'dark'` down |
| RF's `.dark` CSS variable set | **ADAPT** | Use it for dark/dark-ish themes; override the ~6 `--xy-*` vars we care about so paper/light/contrast also get correct minimap/controls/edge-label backgrounds |
| Override `--xy-*` from our own tokens | **ADOPT** | Removes the duplicated hand-styling at `styles.css:109-126` and `App.tsx:1827-1829` |
| ChartDB's `ThemeProvider` + `useLocalConfig` pattern (`theme` in localStorage, `effectiveTheme`, `classList`, `colorMode={effectiveTheme}`) | **ADOPT** | ~60 lines, no dependency, proven in an OSS React-Flow editor. I read all four files |
| ChartDB's `colorOptions` (12 fixed hex + `randomColor`) for table colours | **ADAPT** | Same shape as our `COLORS` but theirs is static too; our `colorKey` indirection is the improvement |
| ChartDB's Tailwind `darkMode:['class']` + HSL-triplet tokens | **SKIP** | Tailwind isn't in this project; plain custom properties + `[data-theme]` is simpler here |
| n8n's `[data-theme='light'|'dark']` + `@media (prefers-color-scheme:dark) body:not([data-theme])` + `color-scheme` | **ADOPT** | `_tokens.scss:1245-1268` — the `color-scheme` declaration makes native form controls/scrollbars match; add it to each of our themes |
| n8n's two-tier tokens (`--color--neutral-700` primitives → `--canvas--color--background` semantics, `_primitives.scss` / `_tokens.scss:73-79, 759-765`) | **ADOPT** | That is exactly the Layer 1 / Layer 2 split above, and n8n has explicit `--canvas--dot--color`, `--canvas--color--selected`, `--canvas--label--color` — the same three things we currently hard-code |
| n8n's oklch() primitives | **SKIP** | Our palette is 6 hand-picked accents, not a generated scale; oklch buys nothing at this size and costs browser support |
| Dify's per-theme CSS files + `dark:` variants | **SKIP** | Requires their Tailwind setup; nothing transferable I could cite from the docs page (the `/guides/workspace/theme` doc covers the *published web app* theme, not the editor) |
| CircuLearn "dark/light theme via system preference" (its README) + `@wrksz/themes` dep | **ADAPT** | Confirms the system-preference default is standard in React-Flow apps; `@wrksz/themes` is a Next.js-oriented lib — we don't need it |
| The nine shapes | **no change** | Everything routes through `--nc`; making `--nc` a token reference is the entire fix |
| The 14 `var(--nc, #33343a)` fallbacks | **ADAPT** | Swap to `var(--nc, var(--border-strong))` — trivial, keeps intent |
| Exports hard-coding `#0b0b0d` | **ADOPT** | `App.tsx:1241, 1245-1247, 1292` — otherwise every light-mode export is wrong |
| `--card` undeclared (`GoblinEdge.tsx:155`) | **ADOPT (bug fix)** | Declare `--card: var(--surface)` or delete the reference |
| `.react-flow__edge-textbg` double-declaration (`styles.css:315` vs `:490`) | **ADOPT (bug fix)** | `:490`'s `#1a1b1f` wins; must become `var(--edge-text-bg)` |
| `ds-node-pulse` keyframes duplicating `--sel` as `rgba(59,130,246,…)` | **ADOPT (bug fix)** | A theme that changes `--sel` would leave the pulse blue |
| `styles.css:621 opacity:1.6` | **ADOPT (bug fix)** | Invalid value; harmless but dead |
| A 5th "interesting" theme beyond light/dark | **ADOPT** | `paper` + `midnight` + `contrast` cost ~20 lines each once Layer 1/2 exist. `contrast` is also the accessibility answer, and `color-scheme` + `prefers-contrast` can auto-select it |

---

# B. React Flow's official diagram-type examples & Pro sets — what actually exists

I enumerated the entire `/examples` page (saved to
`/home/harvey/.hermes/cache/web/reactflow.dev-94a7954dd0.md`, 644 lines): **67 example pages** in
8 sections — Overview, Nodes (16), Edges (16), Interaction (13), Subflows & Grouping (3),
Layout (9), Styling (4), Whiteboard (4), Misc (2).

## B.1 The honest finding

**React Flow ships no diagram-type preset system and no diagram-type examples.** There is no
"ERD example", no "mindmap example", no "sequence diagram example", no "flowchart example" — the
closest thing on the whole site is the Pro *Shapes* example ("Render Custom Nodes with different
shapes that are commonly used in flow charts", `reactflow.dev/examples/nodes/shapes`). The library
is deliberately diagram-agnostic: it gives you a canvas, nodes, edges and a viewport, and every
"diagram type" is a convention the app imposes. The docs page list is explicit that the Pro
examples come with a subscription ("Browse our examples … the MIT Licensed examples, which you are
free to use in your projects without restrictions, as well as our Pro examples that come with our
React Flow Pro subscription plans").

That is the single most important strategic fact in this report: **the preset system is a
differentiator, not a catch-up.**

## B.2 What is reusable — the OSS (MIT) half

| Example | URL | Why it matters to us | Verdict |
|---|---|---|---|
| Custom Nodes | `/examples/nodes/custom-node` | The node-contract basics | already have it |
| Node Resizer | `/examples/nodes/node-resizer` | `NodeResizer` | already have it (`DiagramNode.tsx:97-104`) |
| Node Toolbar | `/examples/nodes/node-toolbar` | `NodeToolbar` | already have it (`DiagramNode.tsx:44`) |
| Proximity Connect | `/examples/nodes/proximity-connect` | auto-connect on drop | already have it (`App.tsx:1576-1583`) |
| Prevent Cycles | `/examples/interaction/prevent-cycles` | cycle detection on connect | already have it (`App.tsx:1560-1567`) |
| Drag and Drop | `/examples/interaction/drag-and-drop` | palette→canvas via native DnD | already have it (`App.tsx:1479`) |
| Context Menu | `/examples/interaction/context-menu` | node/pane right-click | already have it (`src/ContextMenu.tsx`) |
| Helper Lines | Pro in docs | align guides + snapping | already have it OSS-style (`src/helperLines.ts`) |
| **Sub Flow** | `/examples/grouping/sub-flows` + guide `/learn/layouting/sub-flows` | **the drill-down primitive** (see C4 §D.4) | **ADOPT the pattern** |
| **Dagre Tree** | `/examples/layout/dagre` | layered layout | already have a hand-rolled one (`src/layout.ts`) |
| **Elkjs Tree** / **Elkjs Multiple Handles** | `/examples/layout/elkjs`, `/elkjs-multiple-handles` | the layout that *does* sub-flows and multi-handle ports | **ADAPT** — candidate for the network/sequence presets |
| Horizontal Flow | `/examples/layout/horizontal` | LR vs TB is a per-preset decision | ADOPT as a preset field |
| Node Collisions | `/examples/layout/node-collisions` | overlap resolution | ADAPT (nice-to-have) |
| Edge Types | `/examples/edges/edge-types` | straight/step/smoothstep/bezier | already have all four (`GoblinEdge.tsx:280-286`) |
| Edge Markers | `/examples/edges/markers` | arrow/marker types | already have it (`App.tsx:1385-1389`) |
| Edge Label Renderer | `/examples/edges/edge-label-renderer` | labels as divs | already inline-editable (`GoblinEdge.tsx:240-271`) |
| Markers/arrowhead CSS var | `style.css:193-198` | `stroke: var(--xy-edge-stroke,…)` | note: only matters when marker colour is null — ours never is |
| Save and Restore | `/examples/interaction/save-and-restore` | persistence shape | already have boards |
| Download Image | `/examples/misc/download-image` | html-to-image export | already have PNG/SVG/JSON |

## B.3 What is behind the Pro paywall

| Pro example | URL | Would-be value | Verdict |
|---|---|---|---|
| **Shapes** | `/examples/nodes/shapes` | "circle, diamond, or hexagon … one centralized `Shape` component that renders different SVG paths based on the shape type … sidebar, custom minimap nodes, node toolbar for changing colour". Licence: "xyflow Pro License" | **SKIP the code** (licence blocks copying into a project that will be shared), **ADOPT the architecture idea** — we already do exactly this in `shapes.tsx` |
| **Auto Layout** | `/examples/layout/auto-layout` | "Automatically arrange nodes using various layout engines like dagre, d3-hierarchy, or elkjs" | **SKIP** for licence; the *idea* (a layout registry keyed by engine) is free and is part of our preset design |
| **Expand and Collapse** | `/examples/layout/expand-collapse` | "hierarchical trees with expandable and collapsible nodes using dagre" | **ADAPT** — this is drill-down-for-trees; relevant to mindmap and C4-L1→L2. Pattern is describeable without the code |
| **Force Layout** | `/examples/layout/force-layout` | d3-force, "newly added nodes never overlap" | **ADAPT** — mindmap/network want it; `d3-force` is ISC, we can implement it ourselves |
| **Dynamic Layouting** | `/examples/layout/dynamic-layouting` | self-organizing graph | SKIP (not our interaction model) |
| **Edge Routing** | `/examples/edges/edge-routing` | "routable edge with libavoid" — orthogonal paths avoiding nodes | **ADAPT** — the network/BPMN presets want this; `libavoid-js` is the engine named |
| **Editable Edge** | `/examples/edges/editable-edge` | draggable control points | ADAPT (nice) |
| **Copy/Paste**, **Undo/Redo** | `/examples/interaction/*` | selection clipboard + history | already have both hand-rolled (`App.tsx` `pushHistory`, `duplicateSelection`) |
| Collaborative, Server-Side Image Creation, Freehand Draw, Selection Grouping, Parent-Child Relation | — | not needed for a multi-diagram-type editor | SKIP |

## B.4 The showcase — what diagram types real React-Flow apps actually ship

From `/home/harvey/.hermes/cache/web/reactflow.dev-25e3206c57.md` (778 lines, the full page):

| Diagram family | Apps on the showcase | Takeaway for us |
|---|---|---|
| **Data-model / ERD** | ChartDB, Liam ERD, DBDraw, Prismaliser, TSdiagram, Datadef, Datascale, Hubql, Supabase Schema Visualizer, OpenMetadata | The single most crowded family. ChartDB + Liam ERD + DBDraw are all OSS React Flow. **A generic ERD preset will be compared against dedicated tools** — keep it simple (tables + columns + cardinality edges) or skip |
| **Flowchart** | Ameliorate (OSS), Docugram, VisualFlows (sitemap), Stripe docs, Ideation Studio | Flowchart is the lowest-effort, highest-value preset. Ameliorate is an OSS Next.js + React Flow flowchart builder (README read) |
| **Mind map** | Heuristica, MindSnap, Traverse | All three close-source. A radial/tree layout + a rounded node is enough |
| **AI / workflow** | Dify, LangFlow, Flowise, Flow-Like, Dafthunk, Waldiez, Agentok, ToolJet, Retool, Sim Studio, Tersa, Bleu AI | Very crowded; not a differentiator |
| **Logic / circuit** | **CircuLearn** (OSS, `github.com/amin0075/CircuLearn`) | Interesting: README confirms `@xyflow/react ^12.10.2` + Next 16 + Tailwind 4 + "Dark/light theme via system preference". Its simulator route is exactly a "logic" preset with a different node vocabulary |
| **Audio modular** | **Vestige** (OSS), Flojoy | Domain-specific; ports matter more than shapes |
| **Dependency graph** | Bit Cloud, Repree | Free-form, force layout |
| **Config visualiser** | OTelBin (OSS) | Renders an OTel collector pipeline from YAML — a *notation* preset, not a shape preset |
| **Logic map / survey** | Typeform Logic Map, OneSignal Journeys | Branching + numbered steps |
| **Sitemap** | VisualFlows | Hierarchical tree |

**Nobody on the list is a general multi-diagram-type editor.** Every app picked one family and
went deep. So "pick your diagram type" is genuinely new in this ecosystem — and it means each
preset has to be *good enough to be recognisable*, not best-in-class.

---

# C. The remaining diagram families — realistic verdicts

Ranked by (value for Harvey) ÷ (cost in this codebase). "Effort" is measured against what
already exists: 9 shapes (`,/shapes.tsx`), one custom edge with 4 path types and 6 flow
animations (`GoblinEdge.tsx`), NodeResizer, subflows, dagre-ish layout (`layout.ts`), 350+ lucide
icons (`lucideIcons.ts:82`, `ICON_NAMES` at `:364`).

## C.1 Ranking

| # | Family | Effort | Node primitives **new** (on top of the 9) | Edge primitives **new** | Layout | Icon set | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | **C4 model** | **S–M** | *none* — reuse `actor/external/service/database/storage/queue/gateway/group/note`; add a `c4Type` field | 1 intent-label convention + protocol suffix; solid vs dashed | LR layered (have it) | none needed | **ADOPT first** — see §D |
| 2 | **Flowchart / BPMN-lite** | **S** | `process` (rounded rect = have it via `service`), `decision` (diamond — **new**, ~8 SVG lines), `terminator` (stadium — new, ~6 lines), `io` (parallelogram — new, ~6 lines) | labelled + solid/dashed (have both) | TB layered (have it, just flip an axis) | none | **ADOPT** — cheapest big win; flowchart is the #1 stated goal |
| 3 | **ERD / database** | **M** | `table` (a column-list card: title + rows + key/type glyphs — the *only* genuinely new shape, ~60 lines), `view` (a `table` variant) | cardinality markers `1—*`, `1—1`, `0..*` — implement as **edge label presets + `markerStart`/`markerEnd` combos** rather than crow's-foot SVG (crow's-feet need custom SVG markers = the one place RF's `MarkerType` runs out; `MarkerType` has ARROW/ARROWCLOSED only — verified `App.tsx:1385-1389`) | **new**: left-to-right table-column packing (trivial), not layered | none | **ADOPT but scope it** — a "table + cardinality edge" preset, *not* a DBML/SQL importer. Competing against ChartDB (OSS) and Liam ERD (OSS) means don't try to win on features |
| 4 | **Mind map** | **S–M** | `leaf` (pill/stadium — new, ~6 lines); the `note` shape already reads as a sticky idea | none (unlabelled curves) | **new**: radial/d3-hierarchy tree. `d3-hierarchy` is ISC, ~15 KB; or write a simple radial packer (~40 lines) since we already hand-roll layouts | none | **ADOPT** — very cheap, visually distinct, and it exercises the "layout is a preset field" architecture |
| 5 | **Sequence diagram** | **L** | actor *header* (have `actor`), **lifeline** (a tall thin dashed node — new), **activation box** (a small node), a **fragment** box (frame — new) | **new**: straight horizontal message edge + dashed return + self-message; labels must sit centred on a horizontal line | **new & rigid** — this is the hard part: sequence diagrams require *constrained* layout (time flows down, actors locked to `y=0`, vertical spacing derived from message order). The VisualFlow write-up documents the technique: intercept `onNodesChange` and reject y-axis changes for actors, draw lifelines as a background SVG layer from each actor's x, and compute activation-box y-from-message-order | none | **SKIP for now** | Sequence is a genuinely different editing model grafted onto a free-form canvas. The publicly documented attempt (VisualFlow's $100 template — `visualflow.dev/blogs/sequence-diagram-flow`) describes intercepting "almost every default behavior the library provides". That is the opposite of "without forking the app". Revisit only if a real need appears |
| 6 | **Network / cloud topology** | **M–L** | reuse `service/database/storage/gateway/queue/external/group`; add `cloud-region`/`vpc` (a `group` variant with a different tint), `cdn`, `firewall` | none | LR/TB layered (have it) | **the real cost**: AWS/Azure/GCP icons | **ADAPT, icon-limited** — see C.2 |
| 7 | **UML class / state** | **M** | `class` (compartmented box: name / fields / methods — a `table` twin, ~40 lines), `state` (rounded rect + have it), `start`/`end` (filled circle / circle-in-circle — ~8 lines), `choice` (diamond — reuse from flowchart) | inheritance (hollow triangle), composition/aggregation (diamond), dependency (dashed open arrow) — **all need custom SVG markers** | layered (have it) | none | **SKIP** — UML's value is its *notation fidelity*, and RF gives no custom-marker primitives; approximating UML with wrong arrowheads is worse than not doing it. If Harvey wants "UML-ish", the flowchart preset's shapes cover 80 % of the practical need |
| 8 | **BPMN** | **L** | tasks/events/gateways/data objects/pools/lanes/message flows — ~12 new shapes | conditional/default/message/compensation flows | BPMN-aware layout | none | **SKIP** — `bpmn-js` (v18.28.0) is the right tool and its licence *requires* keeping the bpmn.io watermark visible in rendered diagrams (`raw.githubusercontent.com/bpmn-io/bpmn-js/develop/LICENSE`: "The source code responsible for displaying the bpmn.io project watermark … MUST NOT be removed or changed"). Also a different data model (`moddle` XML), i.e. a second engine. Do not build BPMN inside Diagram Studio |
| 9 | **Logic / circuit** | **M** | `and/or/not/nand/nor/xor` gates (each ~10 SVG lines), `input` toggle, `output` lamp | wires (existing straight/step are fine; **junction dots** are a new edge decoration) | free-form (have it) | none | **ADAPT, as a fun preset** — CircuLearn (OSS) proves it fits React Flow; the *simulation* is the interesting part and is out of scope for a v1 preset |
| 10 | **Timeline / roadmap** | **S–M** | `milestone` (circle/diamond), reuse `note`/`service` for phases; lane headers | unlabelled | **new**: horizontal lane packing | none | **ADAPT** — a "roadmap" preset is mostly *chrome* (lane backgrounds + a date axis drawn in a `Panel`/background layer) rather than new shapes. Cheap and demo-friendly |
| 11 | **Sitemap** | **S** | reuse flowchart shapes; page-cards are `service` with a `note` | none | TB tree (have it) | none | **ADOPT as a preset, not a family** — sitemap ≡ flowchart with a tree layout and page-shaped nodes (see Ameliorate/VisualFlows for the visual) |
| 12 | **Kanban** | **XL** | cards, columns, lanes, WIP limits | **none — there are no edges** | **not a graph layout at all** (column packing) | none | **SKIP** — Kanban is a board, not a diagram. Forcing it through React Flow means fighting `onNodesChange` for every drop (same trap as sequence). `@dnd-kit/core` (MIT) or `@atlaskit/pragmatic-drag-and-drop` (Apache-2.0) are the right tools if Harvey ever wants one — but that's a separate app, not a preset |

## C.2 Cloud icon sets — what actually exists (checked against the registry, not from memory)

| Package | Latest | Licence | Reality |
|---|---|---|---|
| `react-icons` | 5.7.0 | MIT | 5.7.0 exposes **3,446 `Si*` icons** and includes `SiGooglecloud`, `SiKubernetes`, `SiDocker`, `SiPostgresql`, `SiApachekafka`, `SiRedis`, `SiTerraform`, `SiNginx`, `SiGrafana`, `SiPrometheus`, `SiMongodb` (all verified `200` in `react-icons@5.7.0/si/index.d.ts`). **`SiAmazonwebservices` and `SiMicrosoftazure` are NOT in 5.7.0** — they exist in `simple-icons` up to v11 and were removed in v13 (verified: the SVG paths return `200` for `simple-icons@9.21/11.0` and `404` for `13/14/15`). |
| `simple-icons` | 16.31.0 | CC0-1.0 | Same removal: `amazonaws`/`microsoftazure` gone from current versions; `googlecloud`, `kubernetes`, `docker`, `postgresql`, `redis`, `apachekafka`, `nginx`, `grafana`, `prometheus`, `elasticsearch`, `mongodb`, `mysql`, `terraform`, `cloudflare`, `supabase`, `snowflake`, `apachespark`, `rabbitmq` all present. |
| `aws-icons` | 3.3.0 | MIT | "based on the official AWS icon set (SVG)", `github.com/MKAbuMattar/aws-icons` — the practical way to get AWS service icons without the trademark-removed brand marks |
| Kubernetes | — | Apache-2.0 | Official k8s icon pack (38 icons, "Designed by The Kubernetes Authors"); `SiKubernetes` covers the single-logo case |
| Azure | — | — | **No maintained React package.** `azure-icons`, `react-azure-icons`, `@azure/ms-icons`, `microsoft-azure-icons` all return `{"error":"Not found"}` on the registry. Azure icons must be vendored SVGs from Microsoft's own icon set |
| lucide (already a dependency) | — | ISC | 350+ generic icons via `src/lucideIcons.ts:82-364` |

**Verdict:** `react-icons` (MIT) or `simple-icons` (CC0) covers *generic* tech logos today with zero
new SVG assets. Full **cloud-provider service** diagrams (an S3 bucket, an RDS instance, an Azure
Service Bus) need `aws-icons` (MIT) plus **vendored Azure/GCP SVGs**, and those are trademarked
marks — a real consideration if the app is "shared with other users eventually". **Recommendation:
make the icon set a preset field (`iconPack: 'lucide'|'si'|'aws'|'vault'`) and ship `lucide` +
optional `react-icons/si`; let a "network" preset opt into `aws-icons` only if Harvey accepts the
vendor-asset maintenance.** ADAPT, don't gate the whole diagram-type system on icons.

---

# D. C4 model — element set, notation, drill-down, preset + starter templates

Everything in D.1–D.3 is cited to the official site (`c4model.com`, the C4 model's own website
authored by Simon Brown) and to the two reference implementations (C4-PlantUML, Structurizr).
D.4–D.6 is my mapping onto Diagram Studio.

## D.1 The canonical element set, per level

From `https://c4model.com/abstractions`: "A software system is made up of one or more containers
(applications and data stores), each of which contains one or more components, which in turn are
implemented by one or more code elements … And people (actors, roles, personas, named
individuals, etc) use the software systems that we build."

| Level | Diagram | Scope | **Primary** elements | **Supporting** elements | Audience | C4's own "Recommended?" |
|---|---|---|---|---|---|---|
| L1 | System context | one software system | **the software system in scope** | **people** + **external software systems** directly connected | everybody, technical and not | Yes, for all teams |
| L2 | Container | one software system | **containers** inside it (`=application` or `=data store`) | people + software systems directly connected to the containers | architects, devs, ops | Yes |
| L3 | Component | one container | **components** inside it | containers in the same system + people/systems connected | architects, devs | **No** — "only create component diagrams if you feel they add value" |
| L4 | Code | one component | classes/interfaces/objects/functions/tables | — | architects, devs | **No** — "most IDEs can generate this level on demand" |
| — | System landscape | an enterprise/org/dept | people + software systems in scope | — | everybody | Yes for larger orgs — "really just a system context diagram without a specific focus" |
| — | Dynamic | a feature/story/use case | your choice of systems/containers/components, **numbered interactions** | — | everybody | No — "use sparingly"; two styles: collaboration (free-form) and sequence |
| — | Deployment | one environment | deployment nodes + container instances | infrastructure nodes | devs, ops | as needed |

Sources: `c4model.com/diagrams` (the level table + "you don't need to use all 4 levels; the
system context and container diagrams are sufficient for most teams"), `c4model.com/diagrams/system-context`,
`/diagrams/container`, `/diagrams/component`, `/diagrams/code`, `/diagrams/system-landscape`,
`/diagrams/dynamic`.

**"Container" is not Docker.** `c4model.com/abstractions/container`: "In the C4 model, a container
represents an **application** or a **data store** … a server-side web application, a client-side
SPA, a desktop app, a mobile app, a serverless function, a database schema, an S3 bucket, a file
system, a shell script". And on the FAQ: AWS S3 / RDS / Azure SQL **are containers** where you own
the buckets/schemas ("treat them as containers because they are an integral part of your software
architecture, although they are hosted elsewhere").

**The element vocabulary the two reference tools actually implement** (this is the concrete,
adoptable list):

| Concept | C4-PlantUML macro (`C4_Context.puml:371-428`, `C4_Container.puml`) | Structurizr terminology (`docs.structurizr.com/ui/diagrams/notation`) |
|---|---|---|
| Person (internal) | `Person(alias,label,descr,sprite,tags)` → bg `#08427B` | tag `Person` |
| Person (external) | `Person_Ext` → bg `#686868` | (role/`external` flag) |
| System in scope | `System(alias,label,descr)` → bg `#1168BD` | tag `Software System` |
| External system | `System_Ext` → bg `#999999` | (ditto) |
| Database in scope | `SystemDb` / `SystemDb_Ext` | shape `Cylinder` on tag `Container` |
| Queue in scope | `SystemQueue` / `SystemQueue_Ext` | shape `Pipe` |
| Container | `Container` → bg `#438DD5`; `ContainerDb`, `ContainerQueue`, `Container_Ext` (`#B3B3B3`), `ContainerDb_Ext`, `ContainerQueue_Ext` | tag `Container` |
| Component | `Component` → bg `#85BBF0`; `ComponentDb`, `ComponentQueue`, `Component_Ext` | tag `Component` |
| Boundary | `Boundary(alias,label,type,tags)`; `System_Boundary`, `Container_Boundary`, `Enterprise_Boundary` | `Software system boundary` / `Container boundary` / `Group` / `Enterprise`(deprecated) |
| Deployment node | `Deployment_Node` / `Node` / `Node_L` / `Node_R` | tag `Deployment Node` |
| Relationship | `Rel(from,to,label,techn,descr)` and directional variants `Rel_D/U/L/R/Neighbor/Back` | tag `Relationship` |
| Legend | automatic (`SetDefaultLegendEntries(...)`) + `LAYOUT_WITH_LEGEND()` | auto-generated diagram key (ⓘ button) |

**C4-PlantUML's default colours are the de-facto convention everyone recognises:**
person `#08427B`, external person `#686868`, system `#1168BD`, external system `#999999`,
container `#438DD5`, container-border `#3C7FC0`, external container `#B3B3B3`,
component `#85BBF0`, external component `#CCCCCC`, arrow `#666666` (from
`C4.puml:60`, `C4_Context.puml:17-35`, `C4_Container.puml:13-25`, `C4_Component.puml:13-25`).

**But** `c4model.com/diagrams/notation#colours` says the blue/grey palette is **not** mandated:
"Although you may see many example diagrams and tools that make use of blue and grey boxes, this
**isn't** something that is dictated by the C4 model, and you are free to use whatever colours you
like! Just make sure that any colour coding is consistent (within and across diagrams)."
→ **We are free to map C4 element types onto Diagram Studio's existing 6-accent token palette**,
which is much better for a themed app than importing `#1168BD`.

## D.2 The standard notation (the rules that make a diagram "C4")

`c4model.com/diagrams/notation` — the official recommendations, verbatim in substance:

**Diagrams**
- "Every diagram should have a **title** describing the diagram type and scope (e.g. 'System Context diagram for My Software System')."
- "Every diagram should have a **key/legend** explaining the notation being used (e.g. shapes, colours, border styles, line types, arrow heads, etc)."
- Acronyms/abbreviations must be understandable or explained in the key.

**Elements**
- "The **type** of every element should be explicitly specified (e.g. Person, Software System, Container or Component)."
- "Every element should have a short **description**, to provide an 'at a glance' view of key responsibilities."
- "Every **container and component** should have a **technology** explicitly specified."

**Relationships**
- "Every line should represent a **unidirectional** relationship."
- "Every line should be **labelled**, the label being consistent with the **direction and intent** of the relationship … Try to be as specific as possible with the label, **ideally avoiding single words like 'Uses'**."
- "Relationships between containers (typically inter-process communication) should have a **technology/protocol** explicitly labelled."

Structurizr's rendering choices add the visual conventions: "purposely uses a very simple and
constrained notation consisting of **boxes and unidirectional arrows**"; relationships are
**dashed by default** with `Direct`/`Curved`/`Orthogonal` routing, and **"Bidirectional (two-way)
arrows are not recommended because they are ambiguous, and are not supported by Structurizr."**
(`docs.structurizr.com/ui/diagrams/notation`). C4-PlantUML's `Rel()` emits `-->>` (dashed +
arrowhead) — `C4.puml:1803`.

**Solid vs dashed — the practical rule that falls out:** use the *default dashed* relationship
line for everything in a static C4 diagram (it's the convention), and reserve **solid** for
emphasis/a specific flow, or use it inside dynamic diagrams. Since Diagram Studio's edge already
has `strokeDasharray` control (`App.tsx:1372-1374`) with `dashed` → `6 4` and `dotted` → `1.5 3.5`
(`App.tsx:81-82`), both are one click.

**Boundary boxes.** Structurizr's table of which views contain which boundaries
(`docs.structurizr.com/ui/diagrams/notation#boundaries-and-groups`) is the authoritative reference:

| View | Boundaries | Groups |
|---|---|---|
| System landscape | Enterprise (deprecated → use groups) | software systems, people, custom elements |
| System context | Enterprise (deprecated) | software systems, people, custom elements |
| **Container** | **Software systems** | **containers** |
| **Component** | **Containers** (optionally software systems) | components |
| Dynamic | same as the level it's scoped to | ditto |
| Deployment | none | none |

Default boundary styling: enterprise boundary `#444444`, group `#444444`, software-system boundary
= the system's stroke colour, container boundary = the container's stroke colour. Boundaries can be
tagged `Boundary`, `Boundary:SoftwareSystem`, `Boundary:Container`, `Group`, `Group:Name`.

**The arrow-intent label convention.** The canonical label text comes from Simon Brown's own
example "Internet Banking System" as reproduced in Mermaid's C4 docs and in the c4mjs README — the
same four sentences everywhere:
- `"Views account balances, and makes payments using"`
- `"Gets account information from, and makes payments using"`
- `"Sends e-mail using"` (+ technology `"SMTP"`)
- `"Sends e-mails to"`
and in Mermaid's example: `"Uses"`, `"Reads from and writes to", "sync, JDBC"`, `"Sends e-mails", "SMTP"`.
(mermaid.ai/open-source/syntax/c4.html; github.com/c4mjs/c4-react README.) **Note the shape**: an
*intent verb phrase*, not a bare verb; a **technology suffix** on container-level relationships;
and the C4 site explicitly says to avoid "Uses" alone — yet it appears in examples because the
*tool* defaults are lax, not because the model endorses it. Our preset should ship better defaults.

## D.3 Do React Flow tools support C4 drill-down / nested navigation?

**The only React-Flow C4 library I found:** `c4mjs/c4-react` (`github.com/c4mjs/c4-react`,
npm `@c4mjs/c4-react@1.1.1`). README: "It uses React Flow for rendering the diagrams … The
interactive zooming and panning features … make it easy to create and view large diagrams";
features include "Supports **Light 🌞 and Dark 🌚 themes** out of the box" and "Downloadable
diagrams using html-to-image". Its API is `{ id, name, description, type: C4NodeType.System,
external?: true }` + a `model` array of `[from, label, to]` tuples + explicit `positions` — i.e.
it is **model-as-code, static positions, no drill-down**. 2 stars, 0 forks, 19 commits. Verdict:
**good confirmation that C4 maps onto React Flow cleanly; not worth depending on** (it owns the
layout and the model, which is exactly what our preset system must own).

**Drill-down in React Flow itself** — the primitives exist:
- **Sub Flows (OSS):** `parentId` + `extent:'parent'` gives child nodes positioned relative to a
  parent; "edges connected to a node with a parent are rendered above nodes"; and the docs warn
  "it's important that your parent nodes appear before their children in the `nodes` array"
  (`reactflow.dev/learn/layouting/sub-flows`, `/examples/grouping/sub-flows`). Diagram Studio
  **already implements this** — group reparenting on drop with `parentId` + `extent:'parent'` and
  correct array splicing at `App.tsx:796-825`, and `layout.ts:15` already excludes children from
  the layered layout. That is the container-boundary mechanic, already working.
- **Expand and Collapse (Pro):** "hierarchical trees with expandable and collapsible nodes using
  dagre" — the tree-drill-down mechanic.
- **Contextual Zoom (OSS):** "Only display the content of a node when you are zoomed in close
  enough" — a *cheap* drill-down: the same node shows `title` at L2 detail and a full component
  list when you zoom past 1.5×. **This is the most promising idea for us** and it's MIT
  (`/examples/interaction/contextual-zoom`).
- **What React Flow does *not* have:** no built-in "zoom into this node and swap the graph"
  navigation, no breadcrumb, no multi-view model. IcePanel does that as product logic: "Zoom into
  a system using the + 🔍 icon on the top left of the system" then "add apps and stores"
  (`icepanel.io/blog/getting-started-c4-model`). Structurizr's answer is the same: one *model*,
  many *views*, plus "Automatic layout / Manual layout" and a "Navigation" doc
  (`docs.structurizr.com/ui/diagrams`).

**So drill-down has three implementable levels, cheapest first:**
1. **Linked boards** (L0, ~free): a node action "Open drill-down" that opens/creates another board
   and stores `{ childBoardId }` in `data`. Diagram Studio already has multi-board persistence
   (`src/boards.ts`, `App.tsx` board menu) and a node toolbar (`DiagramNode.tsx:41-54`) to hang the
   action on. A breadcrumb is 20 lines of `Panel`. **This is what I recommend.**
2. **Sub-flow containment** (L1, we already have the primitive): the *container* diagram lives
   inside a group node on the *context* diagram, collapsed by default; expanding it shows the
   children in place. Requires `hidden`-toggling children (`layout.ts:15` already skips them).
3. **Contextual zoom** (L2, MIT pattern to copy): detail rows appear/disappear by zoom level.

## D.4 Mapping C4 onto what Diagram Studio already has

| C4 element | Diagram Studio today | Gap |
|---|---|---|
| **Person** | `actor` shape — rect + ArchiMate person badge, `--nc` green, post-it treatment (`shapes.tsx:72-78`, `DiagramNode.tsx:107-116`, `styles.css:928-936`) | needs an **external person** variant (same shape, neutral colour + dashed?) |
| **Software system (in scope)** | `service` (rounded rect, `shapes.tsx:46-47`) | fine — but a C4 system is usually bigger and carries a short description: `sub` holds that |
| **External software system** | `external` shape — **already a dashed rounded rect** (`shapes.tsx:48-49`) — exactly the C4 "external" convention | none 🎉 |
| **Container (application)** | `service`, `gateway` (hexagon, `shapes.tsx:84-87`) | gateway reads as "API/LB", fine for an API container |
| **Container (data store)** | `database` (3-ring cylinder, `shapes.tsx:50-58`), `storage` (bucket, `:79-83`), `queue` (message rows, `:59-71`) | none 🎉 — this is a very strong match: C4's Db/Queue/Blob-store trio is already there |
| **Component** | `service` at a smaller size | needs a visual differentiator from container; a **tint + kicker** is enough (C4-PlantUML uses `#85BBF0` vs `#438DD5` — one accent step) |
| **Boundary** | `group` shape — **already a dashed boundary with a header banner + icon badge** (`shapes.tsx:130-131`, `styles.css:962-978`) and reparent-on-drop (`App.tsx:796-825`) | boundary *type* tinting (system vs container vs enterprise) + label convention (`[boundary]` kicker) |
| **Technology** | `sub` field renders as a `--dim` mono line (`styles.css:268-270`) | convention: put `sub` = technology for containers/components, `sub` = role for people |
| **Short description** | `sub`; `metric`/`metricUnit` for numbers (`styles.css:271-275`) | C4 wants *both* a technology and a description on containers. `sub` + `metric` can carry both; or add a `desc` field to `NodeKind` (`DiagramNode.tsx:17-30`) |
| **Relationship label (intent)** | double-click inline edge label editor (`GoblinEdge.tsx:240-271`) | **needs shipped label presets** (a dropdown in the edge inspector) |
| **Relationship technology** | not modelled | either append `" · HTTP/JSON"` into the label, or add `techn` to `EdgeData` (`App.tsx:66-69`) and render it as a second, dimmer line in the label |
| **Diagram title + key/legend** | board name (in the boards API) — no on-canvas key | **real gap**: C4 requires a title and a legend. Cheapest implementation: a new `legend` preset element rendered via a React Flow `<Panel>` (`App.tsx:1793-1809` already uses `Panel` for the empty state) |
| **Drill-down** | multi-board + `group` + `parentId` | a node action + a breadcrumb |
| **Element type label** | `kicker` (uppercase mono, `styles.css:254-258`) — **this is already the C4 "explicit type" line** | convention only; a `c4Type` field makes it enforceable |

**The verdict is unusually good: Diagram Studio needs *zero* new shapes for C4 Context and
Container diagrams.** What it needs is a *convention layer*: a `c4Type` field that drives the
kicker, the accent key and the shape, a legend, labelled-relationship presets, and a drill-down
action. That is the cheapest high-value preset in the whole system.

## D.5 Proposed C4 preset — the data shape

```ts
// A C4 element type is a named bundle of {shape, accentKey, kicker, level}.
type C4Type =
  | 'person' | 'personExternal'
  | 'system' | 'systemExternal'
  | 'container'            // application
  | 'containerDb' | 'containerQueue' | 'containerStore'
  | 'containerExternal'
  | 'component' | 'componentDb' | 'componentQueue'
  | 'boundarySystem' | 'boundaryContainer' | 'boundaryEnterprise'
  | 'undefined';           // anything the user drops manually

const C4: Record<C4Type, {level: 1|2|3; shape: Shape; colorKey: ColorKey; kicker: string; dashed?: boolean}> = {
  person:            {level:1, shape:'actor',    colorKey:'green',  kicker:'[Person]',        },
  personExternal:    {level:1, shape:'actor',    colorKey:'slate',  kicker:'[Person, External]'},
  system:            {level:1, shape:'service',  colorKey:'cyan',   kicker:'[Software System]' },
  systemExternal:    {level:1, shape:'external', colorKey:'accent', kicker:'[Software System, External]'},
  container:         {level:2, shape:'service',  colorKey:'cyan',   kicker:'[Container: application]'},
  containerDb:       {level:2, shape:'database', colorKey:'violet', kicker:'[Container: database]'},
  containerQueue:    {level:2, shape:'queue',    colorKey:'amber',  kicker:'[Container: queue]'},
  containerStore:    {level:2, shape:'storage',  colorKey:'amber',  kicker:'[Container: object store]'},
  containerExternal: {level:2, shape:'external', colorKey:'slate',  kicker:'[Container, External]'},
  component:         {level:3, shape:'service',  colorKey:'green',  kicker:'[Component]'},
  componentDb:       {level:3, shape:'database', colorKey:'violet', kicker:'[Component: store]'},
  componentQueue:    {level:3, shape:'queue',    colorKey:'amber',  kicker:'[Component: queue]'},
  boundarySystem:    {level:2, shape:'group',    colorKey:'cyan',   kicker:'[System boundary]'},
  boundaryContainer: {level:3, shape:'group',    colorKey:'violet', kicker:'[Container boundary]'},
  boundaryEnterprise:{level:1, shape:'group',    colorKey:'slate',  kicker:'[Enterprise boundary]'},
};
```
Colour policy (deliberate): **do not** import C4-PlantUML's blue/grey hexes — `c4model.com/diagrams/notation`
rules out a mandated palette, and our themed accents are strictly better for a light/dark app. What
must stay *consistent* is the mapping (same type ⇒ same accent in every diagram), which is exactly
what the table above enforces. Kicker text follows the notation rule "the type of every element
should be explicitly specified".

Edge defaults for the C4 preset:
```ts
edgeDefaults = {
  path: 'smoothstep',          // C4 boxes-and-arrows, orthogonal-ish, not curvy
  offset: 'center',
  strokeKey: 'slate',          // neutral, like Structurizr's #707070 / C4-PlantUML #666666
  dash: 'dashed',              // the C4 convention (Structurizr default = Dashed)
  markerEnd: 'arrowclosed',    // unidirectional only — no BiRel
  labelRequired: true,         // the preset nudges: empty label → show a hint
  labelPresets: [              // intent phrases, per level
    // L1
    'uses', 'sends emails to', 'reads from', 'sends events to',
    // L2 (with technology suffix; the preset renders " · <tech>")
    'makes API calls to · HTTPS/JSON', 'reads from and writes to · sync, JDBC',
    'publishes events to · Kafka', 'sends emails using · SMTP',
    'serves static assets to · HTTPS',
    // L3
    'invokes · in-process', 'reads configuration from', 'delegates to',
  ],
  technField: true,            // adds `techn` to EdgeData, rendered dim after the label
}
```
The `techn` rendering piggyback on the existing label component: `GoblinEdge.tsx:240-271` already
renders a div at the label position; `techn` becomes a `<small>` in the same div (the styling
pattern exists at `styles.css:275` `.node-metric small`).

**Legend.** C4 requires a key on every diagram. Implement as a `legend` preset element: a
`<Panel position="bottom-left">` (`App.tsx:1793-1809` shows `Panel` is already imported and used)
listing the element types actually present on the board + their shape/colour, plus the line
conventions. Board title goes in the same panel (top-left) or in the existing board name.

## D.6 Starter templates — the two that matter

Ship as board-creation options (`src/boards.ts` `createBoard(name)` already POSTs; a
`createBoard(name, {template})` variant that seeds `nodes`/`edges` is a ~30-line change, and the
seed-data pattern already exists at `App.tsx:52-59` for the onboarding seed).

### Template 1 — C4 Level 1: System Context (internet-banking shape)

Title: **"System Context diagram for Internet Banking System"** (C4 requires the type + scope in
the title). Layout: `LR`, layered (our `layoutDiagram`, `src/layout.ts`).

| Node | `c4Type` | shape | accent | kicker | `sub` (technology/role) | `metric` |
|---|---|---|---|---|---|---|
| Personal Banking Customer | `person` | actor | green | `[Person]` | "A customer of the bank, with personal bank accounts" | — |
| Internet Banking System | `system` | service | cyan | `[Software System]` | "Allows customers to view information about their bank accounts, and make payments" | — |
| E-mail System | `systemExternal` | external | accent | `[Software System, External]` | "The internal Microsoft Exchange e-mail system" | — |
| Mainframe Banking System | `systemExternal` | external | accent | `[Software System, External]` | "Stores all of the core banking information about customers, accounts, transactions, etc" | — |

Edges (all `smoothstep`, dashed, `arrowclosed`, neutral stroke):

| from → to | label | techn |
|---|---|---|
| Customer → Internet Banking System | "Views account balances, and makes payments using" | — (L1 usually omits protocols) |
| Internet Banking System → Mainframe Banking System | "Gets account information from, and makes payments using" | — |
| Internet Banking System → E-mail System | "Sends e-mail using" | — |
| E-mail System → Customer | "Sends e-mails to" | — |

(Labels taken verbatim from the C4 example used by Mermaid and c4mjs — identical text in both, so
it is the canonical wording.) Note **no boundary** at L1: `c4model.com/diagrams/system-context`
lists people + external systems as *supporting* elements and the system as *primary*; a system
boundary belongs on L2.

### Template 2 — C4 Level 2: Containers

Title: **"Container diagram for Internet Banking System"**. Layout: `TB` or `LR`, with one
`boundarySystem` group node wrapping the containers.

| Node | `c4Type` | shape | accent | kicker | `sub` |
|---|---|---|---|---|---|
| Personal Banking Customer | `person` | actor | green | `[Person]` | role |
| E-mail System | `systemExternal` | external | accent | `[Software System, External]` | — |
| **Internet Banking System** (boundary) | `boundarySystem` | group | cyan | `[System boundary]` | — |
| — Web Application | `container` | service | cyan | `[Container: application]` | "Java, Spring MVC" |
| — Single-Page Application | `container` | service | cyan | `[Container: application]` | "JavaScript, Angular" |
| — Mobile App | `container` | service | cyan | `[Container: application]` | "Kotlin, iOS/Android" |
| — API Application | `container` | gateway | cyan | `[Container: application]` | "Java, Spring Boot" |
| — Database | `containerDb` | database | violet | `[Container: database]` | "MySQL 8" |
| — Message Bus | `containerQueue` | queue | amber | `[Container: queue]` | "Kafka" |
| Mainframe Banking System | `systemExternal` | external | accent | `[Software System, External]` | — |

Edges:

| from → to | label | techn |
|---|---|---|
| Customer → Web App / SPA / Mobile App | "Uses" → *preset suggests better:* "Views account balances, and makes payments using" | HTTPS |
| SPA / Mobile App → API Application | "Makes API calls to" | JSON/HTTPS |
| API Application → Database | "Reads from and writes to" | sync, JDBC |
| API Application → Message Bus | "Publishes events to" | async, Kafka |
| API Application → Mainframe Banking System | "Gets account information from, and makes payments using" | XML/HTTPS |
| API Application → E-mail System | "Sends e-mail using" | SMTP |

Boundary: the group node carries `parentId`-less position but its **children** carry
`parentId` + `extent:'parent'` (`App.tsx:796-825` is the existing mechanic); `src/layout.ts:15`
already keeps children out of the layered layout, so the auto-layout will put the boundary in the
flow and pack its children — verify that visual before shipping, it's the one place I'd expect a
rough edge.

**Drill-down wiring:** on the L1 board, the "Internet Banking System" node carries
`data.drillTo: '<L2 board id>'`; the node toolbar (`DiagramNode.tsx:41-54`) shows an
"Open container diagram" button when `drillTo` is set; a breadcrumb `Panel` shows
`L1 Context › L2 Containers`. Creating the pair is part of the template (create both boards at
once, then link).

## D.7 Verdicts (C4)

| Finding | Verdict | Reason |
|---|---|---|
| C4 element set (person/system/container/component/boundary/store/queue) | **ADOPT** | 8 of 9 already exist as shapes; zero new SVG |
| C4-PlantUML default blue/grey palette (`#08427B`/`#1168BD`/`#438DD5`/`#85BBF0`) | **SKIP** | `c4model.com/diagrams/notation` explicitly does not mandate colours, and hard-coded blues would break our theming |
| C4-PlantUML's `_Ext` variant pattern (external person, external system, external container) | **ADOPT** | Doubles the vocabulary for free; `external` shape already exists and is already dashed |
| Unidirectional-only relationships (Structurizr rejects bidirectional arrows as ambiguous) | **ADOPT as a preset constraint** | The C4 preset's edges default to `markerEnd: arrowclosed`, `markerStart: none` |
| Dashed-by-default relationship lines (Structurizr default style = Dashed) | **ADOPT** | One preset field; we already support `6 4` dashes |
| Intent labels, not bare "Uses"; technology suffix at container level | **ADOPT** | Ship the label-preset list + a `techn` field; this is the single thing that makes a diagram *read* as C4 |
| Mandatory title + key/legend per diagram | **ADOPT** | Real gap. `Panel` already exists in the codebase |
| Element type explicit in the label | **ADOPT** | `kicker` already exists; add a `c4Type` field to make it automatic |
| L1 + L2 templates | **ADOPT both**; **SKIP L3/L4** by default | c4model.com: L3/L4 are "recommended? No"; L4 is IDE-generated |
| L3 component template | **ADAPT** (offer, don't seed) | A component diagram is the same machinery at a smaller scale; cheap to support, not worth a default template |
| Dynamic (numbered collaboration) diagram | **ADAPT** | Cheap: the C4 dynamic diagram is "a free-form arrangement with numbered interactions" — that is literally our canvas plus a numbered edge-label prefix. Mermaid's `RelIndex` ignores the index param and numbers by statement order. We could number by edge creation order |
| Deployment diagram | **SKIP** | Different element set (deployment/infrastructure nodes); low value for a solo builder |
| System landscape diagram | **ADAPT** | "really just a system context diagram without a specific focus" — the same template minus the centre system |
| `c4mjs/c4-react` (React Flow C4 lib, 2★) | **SKIP as a dependency** | Static positions, own model, no drill-down; useful only as confirmation that C4 fits RF. npm `@c4mjs/c4-react@1.1.1` |
| Structurizr's "one model, many views" | **ADAPT (conceptually)** | Our model is per-board JSON, so we get "many boards" not "many views". Linked boards + drill-down is the right-sized version of the idea; a full model layer is a rewrite |
| IcePanel's 🔍 zoom-into-system interaction | **ADAPT** | The interaction is right; its implementation is product logic, not a library. Our version = node action + board link |
| React Flow sub-flows (`parentId` + `extent:'parent'`) for container boundaries | **ADOPT** | Already implemented at `App.tsx:796-825`; `layout.ts:15` already excludes children |
| Contextual Zoom (OSS example) for progressive detail by zoom level | **ADAPT** | MIT, and the cheapest "drill-down feel" |
| bpmn-js's licence as a *precedent* for what to avoid | n/a | Cited only to justify skipping BPMN (§C.1 row 8) |

---

# E. PRESET SYSTEM — switching palette / shapes / edges / layout / theme without forking

## E.1 The design constraint, stated precisely

"Without forking the app" means: **one `DiagramNode`, one `GoblinEdge`, one `App`, one canvas, one
layout dispatcher, one persistence format.** A preset may change *what the palette offers*, *what
defaults a new element gets*, *which layout runs*, *which accent family is used*, *which chrome is
shown*, and *which theme is suggested* — and nothing else. It must not introduce a second edge
component, a second node type, or a second editor screen.

That constraint is satisfiable here because of two facts about the current code:
1. `DiagramNode` already dispatches on `data.shape` through one `asShape()` + one `ShapeFrame()`
   (`shapes.tsx:25-27, 32-91`) — the "one node, many shapes" pattern the React Flow Pro Shapes
   example describes. Adding shapes is additive.
2. `GoblinEdge` is already registered under five type ids (`GoblinEdge.tsx:280-289`) so the canvas
   never loses styling when the path type changes. Adding *kinds of relationship* is a `data` field,
   not a component.

## E.2 The type

```ts
// src/presets.ts  (new file, ~250 lines of data)
export type PresetId =
  | 'architecture'   // today's behaviour — the default
  | 'c4-context' | 'c4-container' | 'c4-component'
  | 'flowchart' | 'erd' | 'mindmap' | 'network' | 'roadmap' | 'logic' | 'blank';

export type LayoutId = 'layered-lr' | 'layered-tb' | 'radial' | 'grid' | 'free';

export type PaletteItem = {                 // already exists in palette.ts:17-26
  label: string; hint: string; shape: Shape; colorKey: ColorKey;
  kind: 'goblin' | 'label'; make: () => NodeKind | LabelKind;
  /** optional preset-specific seed fields */
  c4Type?: C4Type; tableColumns?: Column[]; gate?: GateKind;
};

export type DiagramPreset = {
  id: PresetId;
  label: string;                 // "C4 — System Context"
  hint: string;                  // one line shown in the picker
  /** 1 — PALETTE: which shapes the left panel shows, and their default accent keys */
  palette: PaletteItem[];
  /** 2 — SHAPE LIBRARY: extra SVG shapes this preset may use (union w/ base 9) */
  extraShapes?: Shape[];         // e.g. ['diamond','stadium','parallelogram','table','pill']
  /** 3 — EDGE DEFAULTS for every edge created in this preset */
  edges: {
    path: 'bezier' | 'smoothstep' | 'step' | 'straight';
    strokeKey: ColorKey;
    dash?: 'solid' | 'dashed' | 'dotted';
    markerStart?: MarkerType | null;
    markerEnd?: MarkerType | null;
    labelPresets?: string[];      // dropdown suggestions in the edge inspector
    technField?: boolean;         // render `techn` dim after the label
    flowAllowed?: boolean;        // whether the 6 flow animations are offered
  };
  /** 4 — LAYOUT: which engine the Auto-arrange button runs, and its axis */
  layout: { engine: LayoutId; direction: 'LR' | 'TB'; spacing?: {x:number; y:number} };
  /** 5 — THEME: suggested theme + chrome overrides (NOT forced) */
  theme: { suggested?: ThemeName; canvas?: 'dots' | 'lines' | 'plain' | 'none';
           showLegend?: boolean; showAxis?: boolean };
  /** 6 — GUIDANCE: onboarding hints + a required-field nudge */
  guidance?: { tip?: string; requireLabel?: boolean; requireTechnology?: boolean };
  /** 7 — TEMPLATES: named seed documents offered on board creation */
  templates?: { id: string; label: string; nodes: Node[]; edges: Edge[] }[];
  /** 8 — CAPABILITIES: what the toolbar shows for this preset */
  caps?: { subflow?: boolean; proximityConnect?: boolean; cyclePrevention?: boolean;
           multiParent?: boolean; resizable?: boolean };
};
```

## E.3 The five switch points, and where each lands in the existing code

| # | What a preset switches | Implementation | Existing code it reuses | New code |
|---|---|---|---|---|
| 1 | **Palette** | `PALETTE` (`palette.ts:32-73`) becomes `preset.palette`; the left panel maps over it (`App.tsx:1474-1496`) | drag `dataTransfer.setData('palette', String(i))` (`:1479`), `addNode(i)` | none — parameterise the import |
| 2 | **Shape library** | `SHAPES`/`ShapeFrame`/`ShapePreview` are the *union* of all shapes; a preset picks a subset for its palette and may add rows to the union | `shapes.tsx` is already a switch over `data.shape`; both `ShapeFrame` (`:32`) and `ShapePreview` (`:94`) are the two functions a new shape must be added to | one `case` per new shape in two functions (~8-60 lines each); add to the `Shape` union (`shapes.tsx:9`) and to `RESIZABLE` (`DiagramNode.tsx:10`) |
| 3 | **Edge defaults** | Applied in `onConnectRules`/`onConnect` and in the palette-drop edge creation, plus `defaultEdgeOptions` on `<ReactFlow>` | the exact edge object shape already exists 4× (`App.tsx:57-58, 772, 886, 912`) — factor it into `makeEdge(source,target,preset)` | one factory function |
| 4 | **Layout engine** | `autoLayout` (`App.tsx:942-955`) currently calls `layoutDiagram` directly. Replace with `const fn = LAYOUTS[preset.layout.engine]` and pass `direction`/`spacing`. **Critical:** the CSS transition wrapper (`animateLayout`, K3) must stay — it is preset-independent | `layoutDiagram` stays the `layered-*` engine (`src/layout.ts`); its `direction` is currently implicitly LR (`layout.ts:81-97`) so TB is a small refactor (swap the axis/`GAP_X`/`GAP_Y`) | a `LAYOUTS` registry with `layered-lr/tb` (have), `radial` (d3-hierarchy or ~40 lines), `grid`, `free` (no-op) |
| 5 | **Theme** | The **preset suggests**, the **user decides**: creating a board from the C4 preset sets `board.theme = 'midnight'` once, and the theme picker remains global/board-level and always overridable. Never let a preset force a theme — the user may have a light-mode preference | `applyTheme()` from §A.3; the existing `localStorage` convention (`boards.ts:19`, `App.tsx:166, 173`) | a per-board `theme?` field in `BoardDoc` (`boards.ts:11-17`) |

## E.4 Where the preset lives: board metadata, not global mode

```ts
// boards.ts:11-17
export type BoardDoc = {
  id: string; name: string; nodes: Node[]; edges: Edge[]; updatedAt: number;
  preset?: PresetId;        // NEW — the board's diagram type
  theme?: ThemeName;        // NEW — optional per-board theme suggestion
  legend?: boolean;         // NEW — C4 key visibility
};
```
Why board-level rather than a global mode:
- A preset determines *how you *create* things* (palette, defaults) and *how the board is arranged*
  (layout) — both are per-document concerns, and a user may well keep a flowchart board and a C4
  board side by side. A global switch would make every existing board look wrong.
- It survives the boards API unchanged: `vite.config.ts:83-171`'s `boardsApi()` plugin writes
  whatever JSON it is given (`PUT /api/boards/:id`), and `exportJson`/`importJson` (`App.tsx:1262-1273,
  1317+`) already round-trip arbitrary objects. **No backend change whatsoever.**
- Old boards have no `preset` → default `'architecture'` → today's behaviour exactly. Zero migration.
- "Blend types" (Harvey's other stated wish) falls out naturally: switching a board's preset does not
  rewrite its nodes; it only changes the palette/defaults/layout from then on. Plus a **`blank`/`custom`
  preset** whose palette is the union of everything, for genuine mixing.

## E.5 The preset picker (UI, three entry points)

1. **Board creation** (`App.tsx:1448-1450` "New board") → a preset choice, with "Architecture" preselected,
   and if the preset has `templates`, a template choice ("Empty" / "C4 Context" / "C4 Container").
2. **Board menu → "Diagram type…"** (next to Rename/Duplicate/Delete, `App.tsx:1451-1459`): switch the
   preset of the current board. Show a one-line warning when switching: *"This changes the palette,
   edge defaults and auto-layout. Existing elements are kept."*
3. **Board list badge** (`App.tsx:1433-1443`): show the preset label next to `{b.nodeCount}n · {b.edgeCount}e`
   so multi-type boards are distinguishable at a glance.

## E.6 What must NOT become a preset field (the anti-fork list)

| Thing | Why it stays global |
|---|---|
| The node component | One `DiagramNode`. Presets select `shape` from a union; a per-preset node component is the fork we're avoiding |
| The edge component | One `GoblinEdge` under 5 type ids. Presets change `data` (path/dash/flow/label), never the component |
| Undo/redo, autosave, boards CRUD, export | Orthogonal to diagram type |
| Hover choreography / perf guard / glow handles / post-it | Presentation layer; already keyed off `--nc` and shape, so presets inherit it for free |
| The canvas interaction model | `panOnDrag`, `selectionOnDrag`, `snapToGrid` (`App.tsx:1781-1788`) — one editor feel. The *one* preset-dependent exception worth making: `caps.cyclePrevention` (a flowchart may want cycles allowed, an architecture diagram may not) — and it already exists as a toggle (`App.tsx:1560-1567`) |
| The 9 shapes | They stay in the union. A preset *hides* shapes from the palette; it never deletes them, so a user can always get back to architecture notation |

## E.7 Worked preset definitions (the three that prove the design)

### `architecture` — today's behaviour, default
```ts
{ id:'architecture', label:'Architecture', hint:'services, datastores, boundaries',
  palette: PALETTE /* as today */,
  edges:{path:'bezier', strokeKey:'slate', markerEnd:MarkerType.ArrowClosed, flowAllowed:true},
  layout:{engine:'layered-lr', direction:'LR'}, theme:{canvas:'dots'},
  caps:{subflow:true, proximityConnect:true, cyclePrevention:true, resizable:true} }
```

### `c4-context`
```ts
{ id:'c4-context', label:'C4 — System Context', hint:'one system + its people and neighbours',
  palette:[Person, Person_Ext, System, System_Ext, Boundary_Enterprise],
  edges:{path:'smoothstep', strokeKey:'slate', dash:'dashed', markerEnd:MarkerType.ArrowClosed,
         labelPresets:['views … using','sends e-mails to','uses'],
         technField:false},                     // L1 rarely carries protocols
  layout:{engine:'layered-lr', direction:'LR'},
  theme:{suggested:'midnight', canvas:'plain', showLegend:true},
  guidance:{tip:'Name the diagram "System Context diagram for <system>". Label every arrow with its intent.',
            requireLabel:true},
  templates:[{id:'l1-web', label:'Internet Banking (Context)', nodes:[…], edges:[…]}] }
```

### `flowchart`
```ts
{ id:'flowchart', label:'Flowchart', hint:'steps, decisions, paths',
  palette:[Start(stadium), Process(service), Decision(diamond), Input(parallelogram),
           Data(database), Note],
  edges:{path:'smoothstep', strokeKey:'fg', markerEnd:MarkerType.ArrowClosed,
         labelPresets:['yes','no','retry','timeout','error'], flowAllowed:false},
  layout:{engine:'layered-tb', direction:'TB'},
  theme:{canvas:'plain'},
  guidance:{requireLabel:false},
  caps:{cyclePrevention:false /* a flowchart legitimately loops */, proximityConnect:true} }
```

### `mindmap` / `erd` / `network` / `roadmap` / `logic` — same shape, different rows
- **mindmap:** palette = `[Central(pill), Branch(pill), Leaf(pill)]`; edges `{path:'bezier', dash:'solid', markerEnd:null, labelAllowed:false}`; layout `{engine:'radial'}`; theme `{canvas:'plain'}`; caps `{subflow:false, cyclePrevention:false}`.
- **erd:** palette = `[Table, View, Note]`; edges `{path:'step', strokeKey:'slate', markerEnd:ArrowClosed, labelPresets:['1—1','1—*','*—*'], labelRequired:true}`; layout `{engine:'grid'}`; the cardinality is carried in the label + marker combo.
- **network:** palette = architecture's plus `[Region, VPC, CDN, Firewall]`; `theme:{canvas:'dots'}`; `caps.subflow:true` (VPC = a group). Icons: `iconPack:'si'` (see §C.2).
- **roadmap:** palette = `[Phase, Milestone, Deliverable, Note]`; edges `{markerEnd:null}`; layout `{engine:'layered-lr', direction:'LR'}`; `theme:{showAxis:true}`.
- **logic:** palette = `[Input, Output, And, Or, Not, Xor]`; edges `{path:'straight', markerEnd:null, flowAllowed:true /* signal flow */}`; layout `{engine:'free'}`.

## E.8 Verdicts (preset system)

| Finding | Verdict | Reason |
|---|---|---|
| Preset as **board metadata** (`BoardDoc.preset`) | **ADOPT** | Survives the existing boards API and JSON round-trip untouched (`vite.config.ts:83-171`, `App.tsx:1262+`) |
| Preset as a **data object with 8 fields** (palette/shapes/edges/layout/theme/guidance/templates/caps) | **ADOPT** | Every field maps to a place the code already parameterises or can trivially parameterise |
| Palette = "a subset of a shape union", not a per-preset palette component | **ADOPT** | Exactly the pattern in `reactflow.dev/examples/nodes/shapes` (Pro) and already in `shapes.tsx` |
| Layout = a **registry keyed by engine** | **ADOPT** | The idea behind the Pro *Auto Layout* example; we implement the engines ourselves (`layout.ts` for layered, ~40 lines for radial, no-op for free) |
| Layout engine adds a dependency (elkjs) | **ADAPT later** | `elkjs@0.12.0` is `EPL-2.0 OR GPL-3.0-or-later` and 1.4 MB unpacked (per `reactflow.dev/learn/layouting/layouting`'s bundle badges). Keep the registry so it can be swapped in; don't add it now. `d3-hierarchy@3.1.2` (ISC) for radial is the cheap one |
| A per-board theme suggestion, global theme override | **ADOPT** | A preset must never lock a user out of light mode |
| A `custom`/`blank` preset = union of all shapes | **ADOPT** | This *is* Harvey's "blend them" requirement, and it costs one palette definition |
| Preset switch rewriting existing nodes | **SKIP** | Destructive; the presets that matter (C4, architecture) share the node vocabulary anyway |
| Per-preset node/edge components | **SKIP (this is the fork)** | One `DiagramNode`, one `GoblinEdge` |
| Onboarding tour / checklist per preset | **ADAPT later** | `Tour.tsx` is step-sequence driven and `Checklist.tsx` is task-id driven; making the steps preset-aware is a follow-up, not part of v1 |
| A "diagram type" field visible in the board list | **ADOPT** | `App.tsx:1433-1443` already renders per-board metadata; one more span |

---

# F. Top recommendations, in build order

1. **Tokens + theme controller first (1–2 h).** Add the Layer 1 tokens (§A.4.1) and the
   `[data-theme]` blocks, fix the ~8 bug-class literals (`edge-textbg` double-declaration, the
   `ds-node-pulse` blue, `--card` undeclared, `opacity:1.6`), add `color-scheme`, add the
   `applyTheme()` + `colorMode={isDark?'dark':'light'}` pair. Ship **light** and keep **dark**
   byte-identical so nothing regresses. Then add `paper` / `midnight` / `contrast` as pure token
   additions — they cost ~20 lines each afterwards.
2. **Symbolic colours (2–3 h, and this is the one that matters).** `ColorKey` + `resolveColor()` +
   `LEGACY_HEX` migration on board load + the inspector's key swatches + `<markerEnd.color>` from
   the key. Without this, light mode changes the chrome and nothing else.
3. **Make exports theme-aware (15 min).** `App.tsx:1241, 1245-1247, 1292`.
4. **The preset object + board-level `preset` field (2–3 h).** Ship `architecture` (identical
   behaviour) + `flowchart` + `custom` first — flowchart is the smallest real preset and it proves
   the whole switch mechanism, including the `layered-tb` axis flip and the two new shapes a
   decision/stadium needs.
5. **C4 (3–4 h).** It needs no new shapes, so it is the highest value-per-hour preset in the list:
   `c4Type` table (§D.5), the two templates (§D.6), the dashed-unidirectional edge defaults, the
   label-preset dropdown, the legend panel, and a linked-board drill-down. Mark
   L3/L4 as "advanced, empty template only".
6. **Then, in this order if wanted:** `mindmap` (radial layout, cheap) → `erd` (the `table` shape,
   the only genuinely new shape in the whole list) → `network` (icon-pack decision first, §C.2) →
   `roadmap` / `logic`.
7. **Explicitly do not build:** sequence, UML, BPMN, Kanban. Reasons per §C.1 rows 5, 7, 8, 12 —
   they each require fighting React Flow's free-form editing model or a second engine, which is
   the fork the brief rules out.

**Cleanup:** `/tmp` files created during research (146 MB total): `si.json`, `cd.json`, `cl.json`,
`dify.json`, `difyfull.json`, `ex.json`, `n8n.json`, `n8nfull.json`, `n8ntok.scss`, `wt.json`,
`aws.json`, `p.json`, `c4c.puml`, `c4p.puml`, `c4s.md`. No git clone was made; nothing to delete
under a repo path. `df -h /` unchanged (29G/96G).
